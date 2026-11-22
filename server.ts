import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  CORE_INDICATOR_CODES,
  EXTENDED_INDICATOR_CODES,
  INDICATOR_MAP,
  type CatalogIndicator,
  type CountryMeta,
  type IndicatorSeries,
  type TimeSeriesPoint,
} from './src/data/indicators.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const WB_BASE = 'https://api.worldbank.org/v2';
const IMF_BASE = 'https://www.imf.org/external/datamapper/api/v1';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const IMF_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const CURRENT_YEAR = new Date().getFullYear();

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
}

function setCached<T>(key: string, value: T, ttlMs = CACHE_TTL_MS): T {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

// Global semaphore + circuit breaker to handle World Bank API throttling/stalls
const MAX_WB_CONCURRENCY = 6;
let activeWbCount = 0;
const wbWaitQueue: Array<() => void> = [];
let wbConsecutiveFailures = 0;
let wbCircuitOpenUntil = 0;

function isWbCircuitOpen(): boolean {
  return Date.now() < wbCircuitOpenUntil;
}

function recordWbSuccess(): void {
  wbConsecutiveFailures = 0;
  wbCircuitOpenUntil = 0;
}

function recordWbFailure(): void {
  wbConsecutiveFailures += 1;
  if (wbConsecutiveFailures >= 4) {
    wbCircuitOpenUntil = Date.now() + 30_000; // 30s cooldown when WB origin stalls
  }
}

async function withWbSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (activeWbCount >= MAX_WB_CONCURRENCY) {
    await new Promise<void>((resolve) => wbWaitQueue.push(resolve));
  }
  activeWbCount++;
  try {
    return await fn();
  } finally {
    activeWbCount--;
    const next = wbWaitQueue.shift();
    if (next) next();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonWithTimeout<T>(
  url: string,
  timeoutMs = 8000,
  retries = 0
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; AtlasMacroExplorer/1.0)',
        },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await sleep(300 * (attempt + 1));
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Upstream request failed');
}

async function fetchWbJson<T>(url: string, timeoutMs = 8000, retries = 0): Promise<T> {
  if (isWbCircuitOpen()) {
    throw new Error('World Bank API temporarily paused due to upstream timeouts');
  }
  return withWbSlot(async () => {
    try {
      const payload = await fetchJsonWithTimeout<T>(url, timeoutMs, retries);
      if (
        Array.isArray(payload) &&
        payload[0] &&
        typeof payload[0] === 'object' &&
        'message' in (payload[0] as Record<string, unknown>)
      ) {
        const msgArr = (payload[0] as { message?: Array<{ value?: string }> }).message;
        const reason = msgArr?.[0]?.value || 'World Bank API returned an error message';
        throw new Error(reason);
      }
      recordWbSuccess();
      return payload;
    } catch (err) {
      recordWbFailure();
      throw err;
    }
  });
}

async function cachedFetch<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs = CACHE_TTL_MS
): Promise<T> {
  const existing = getCached<T>(key);
  if (existing !== null) return existing;

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = loader()
    .then((result) => setCached(key, result, ttlMs))
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

type ImfMapping = {
  imfCode: string;
  scale: number;
};

const IMF_FALLBACK_MAP: Record<string, ImfMapping> = {
  'NY.GDP.MKTP.CD': { imfCode: 'NGDPD', scale: 1e9 },
  'NY.GDP.MKTP.KD.ZG': { imfCode: 'NGDP_RPCH', scale: 1 },
  'NY.GDP.PCAP.CD': { imfCode: 'NGDPDPC', scale: 1 },
  'NY.GDP.PCAP.PP.CD': { imfCode: 'PPPPC', scale: 1 },
  'FP.CPI.TOTL.ZG': { imfCode: 'PCPIPCH', scale: 1 },
  'SL.UEM.TOTL.ZS': { imfCode: 'LUR', scale: 1 },
  'SP.POP.TOTL': { imfCode: 'LP', scale: 1e6 },
  'BN.CAB.XOKA.GD.ZS': { imfCode: 'BCA_NGDPD', scale: 1 },
  'GC.DOD.TOTL.GD.ZS': { imfCode: 'GGXWDG_NGDP', scale: 1 },
  'GC.BAL.CASH.GD.ZS': { imfCode: 'GGXCNL_NGDP', scale: 1 },
  'GC.TAX.TOTL.GD.ZS': { imfCode: 'GGR_G01_GDP_PT', scale: 1 },
  'GC.XPN.TOTL.GD.ZS': { imfCode: 'G_X_G01_GDP_PT', scale: 1 },
};

type ImfDatasetResponse = {
  values?: Record<string, Record<string, Record<string, number>>>;
};

async function fetchImfIndicatorDataset(
  imfCode: string
): Promise<Record<string, Record<string, number>>> {
  return cachedFetch(
    `imf:${imfCode}`,
    async () => {
      const payload = await fetchJsonWithTimeout<ImfDatasetResponse>(
        `${IMF_BASE}/${encodeURIComponent(imfCode)}`,
        8000,
        1
      );
      return payload?.values?.[imfCode] || {};
    },
    IMF_CACHE_TTL_MS
  );
}

function buildSeriesFromPoints(
  code: string,
  points: TimeSeriesPoint[],
  fallbackName?: string,
  fallbackUnit?: string
): IndicatorSeries {
  const def = INDICATOR_MAP[code];
  const sorted = [...points]
    .filter((p) => Number.isFinite(p.year) && Number.isFinite(p.value))
    .sort((a, b) => a.year - b.year);

  const latest = sorted.length > 0 ? sorted[sorted.length - 1] : null;
  const prev = sorted.length > 1 ? sorted[sorted.length - 2] : null;

  let deltaAbsolute: number | null = null;
  let deltaPercent: number | null = null;
  if (latest && prev) {
    deltaAbsolute = latest.value - prev.value;
    if (prev.value !== 0) {
      deltaPercent = ((latest.value - prev.value) / Math.abs(prev.value)) * 100;
    }
  }

  return {
    code,
    name: def?.name || fallbackName || code,
    unit: def?.unit || fallbackUnit || '',
    latestYear: latest ? latest.year : null,
    latestValue: latest ? latest.value : null,
    previousYear: prev ? prev.year : null,
    previousValue: prev ? prev.value : null,
    deltaAbsolute,
    deltaPercent,
    points: sorted,
  };
}

async function fetchImfSeries(iso3: string, wbCode: string): Promise<IndicatorSeries | null> {
  const mapping = IMF_FALLBACK_MAP[wbCode];
  if (!mapping) return null;

  const dataset = await fetchImfIndicatorDataset(mapping.imfCode);
  const countryYears = dataset[iso3.toUpperCase()];
  if (!countryYears) return null;

  const points: TimeSeriesPoint[] = Object.entries(countryYears)
    .map(([yrStr, rawVal]) => ({
      year: Number(yrStr),
      value: Number(rawVal) * mapping.scale,
    }))
    .filter(
      (p) =>
        Number.isFinite(p.year) &&
        p.year >= 1975 &&
        p.year <= CURRENT_YEAR &&
        Number.isFinite(p.value)
    );

  if (points.length === 0) return null;
  return buildSeriesFromPoints(wbCode, points);
}

type WbCountryRow = {
  id: string;
  iso2Code: string;
  name: string;
  region?: { id?: string; value?: string };
  incomeLevel?: { id?: string; value?: string };
  lendingType?: { id?: string; value?: string };
  capitalCity?: string;
  longitude?: string;
  latitude?: string;
};

type WbObservationRow = {
  indicator?: { id?: string; value?: string };
  country?: { id?: string; value?: string };
  countryiso3code?: string;
  date?: string;
  value?: number | null;
  unit?: string;
};

type WbCatalogRow = {
  id: string;
  name: string;
  unit?: string;
  sourceNote?: string;
  sourceOrganization?: string;
  topics?: Array<{ id?: string; value?: string }>;
};

async function loadCountries(): Promise<CountryMeta[]> {
  const cached = getCached<CountryMeta[]>('countries:all');
  if (cached !== null) return cached;

  const pending = inflight.get('countries:all');
  if (pending) return pending as Promise<CountryMeta[]>;

  const loader = (async () => {
    try {
      const payload = await fetchWbJson<[unknown, WbCountryRow[]]>(
        `${WB_BASE}/country?format=json&per_page=350`,
        9000,
        1
      );
      const rows = Array.isArray(payload) && Array.isArray(payload[1]) ? payload[1] : [];
      if (rows.length > 0) {
        const list = rows
          .filter(
            (row) =>
              row.id &&
              row.region?.id &&
              row.region.id !== 'NA' &&
              row.incomeLevel?.id &&
              row.incomeLevel.id !== 'NA'
          )
          .map((row) => ({
            id: row.id.toUpperCase(),
            iso2: (row.iso2Code || '').toUpperCase(),
            name: row.name,
            capital: row.capitalCity || '—',
            region: (row.region?.value || 'Other').trim(),
            regionId: row.region?.id || '',
            incomeLevel: row.incomeLevel?.value || 'Not classified',
            lendingType: row.lendingType?.value || 'Not classified',
            longitude: row.longitude || '',
            latitude: row.latitude || '',
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        return setCached('countries:all', list, CACHE_TTL_MS);
      }
    } catch {
      // Fallback to IMF countries list if World Bank directory times out
    }

    const imfRes = await fetchJsonWithTimeout<{ countries?: Record<string, { label?: string }> }>(
      `${IMF_BASE}/countries`,
      8000,
      1
    );
    const entries = Object.entries(imfRes.countries || {}).filter(
      ([code, val]) => /^[A-Z]{3}$/.test(code) && val?.label
    );
    if (entries.length === 0) {
      throw new Error('Failed to load country directory from public APIs');
    }
    const fallbackList = entries
      .map(([code, val]) => ({
        id: code,
        iso2: '',
        name: val.label!,
        capital: '—',
        region: 'Global',
        regionId: '',
        incomeLevel: 'Reported',
        lendingType: 'IMF WEO',
        longitude: '',
        latitude: '',
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return setCached('countries:all', fallbackList, 5 * 60 * 1000);
  })().finally(() => {
    inflight.delete('countries:all');
  });

  inflight.set('countries:all', loader);
  return loader;
}

function buildIndicatorSeries(code: string, rows: WbObservationRow[]): IndicatorSeries {
  const fallbackName = rows[0]?.indicator?.value;
  const fallbackUnit = rows[0]?.unit;
  const points: TimeSeriesPoint[] = rows
    .filter((r) => r.value !== null && r.value !== undefined && Number.isFinite(Number(r.value)))
    .map((r) => ({
      year: Number(r.date),
      value: Number(r.value),
    }))
    .filter((p) => Number.isFinite(p.year) && p.year >= 1960);

  return buildSeriesFromPoints(code, points, fallbackName, fallbackUnit);
}

async function fetchSingleCountryIndicator(iso3: string, code: string): Promise<IndicatorSeries> {
  const cleanIso = iso3.toUpperCase();
  return cachedFetch(`series:${cleanIso}:${code}`, async () => {
    const hasImfFallback = Boolean(IMF_FALLBACK_MAP[code]);
    const url = `${WB_BASE}/country/${encodeURIComponent(cleanIso)}/indicator/${encodeURIComponent(code)}?format=json&per_page=80&date=1975:${CURRENT_YEAR}`;
    let wbSeries: IndicatorSeries | null = null;
    let wbError: unknown = null;

    if (!isWbCircuitOpen() || !hasImfFallback) {
      try {
        const timeoutMs = hasImfFallback ? 5000 : 7500;
        const payload = await fetchWbJson<[unknown, WbObservationRow[] | null]>(url, timeoutMs, 0);
        const rows = Array.isArray(payload) && Array.isArray(payload[1]) ? payload[1] : [];
        wbSeries = buildIndicatorSeries(code, rows);
      } catch (err) {
        wbError = err;
      }
    }

    const needsFallback =
      wbSeries === null ||
      wbSeries.points.length === 0 ||
      (wbSeries.latestYear !== null && wbSeries.latestYear < 2015);

    if (needsFallback && hasImfFallback) {
      try {
        const imfSeries = await fetchImfSeries(cleanIso, code);
        if (imfSeries && imfSeries.points.length > 0) {
          if (!wbSeries || wbSeries.points.length === 0) {
            return imfSeries;
          }
          const byYear = new Map<number, number>();
          wbSeries.points.forEach((p) => byYear.set(p.year, p.value));
          imfSeries.points.forEach((p) => {
            if (!byYear.has(p.year)) byYear.set(p.year, p.value);
          });
          const merged = Array.from(byYear.entries()).map(([year, value]) => ({ year, value }));
          return buildSeriesFromPoints(code, merged, wbSeries.name, wbSeries.unit);
        }
      } catch {
        // Ignore IMF error if WB succeeded with older data
      }
    }

    if (wbSeries !== null) {
      return wbSeries;
    }

    throw wbError instanceof Error ? wbError : new Error(`Failed to fetch ${code} for ${cleanIso}`);
  });
}

async function fetchIndicatorBatch(
  iso3: string,
  codes: string[],
  concurrency = 5
): Promise<{ indicators: Record<string, IndicatorSeries>; failedCodes: string[] }> {
  const indicators: Record<string, IndicatorSeries> = {};
  const failedCodes: string[] = [];
  let index = 0;

  async function worker() {
    while (index < codes.length) {
      const currentIdx = index++;
      const code = codes[currentIdx];
      try {
        indicators[code] = await fetchSingleCountryIndicator(iso3, code);
      } catch {
        failedCodes.push(code);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, codes.length) }, () => worker());
  await Promise.all(workers);
  return { indicators, failedCodes };
}

async function loadWdiCatalog(): Promise<CatalogIndicator[]> {
  return cachedFetch(
    'catalog:wdi',
    async () => {
      const [page1, page2] = await Promise.all([
        fetchWbJson<[unknown, WbCatalogRow[]]>(
          `${WB_BASE}/indicator?source=2&format=json&per_page=1000&page=1`,
          14000,
          1
        ),
        fetchWbJson<[unknown, WbCatalogRow[]]>(
          `${WB_BASE}/indicator?source=2&format=json&per_page=1000&page=2`,
          14000,
          1
        ),
      ]);

      const rows = [
        ...(Array.isArray(page1) && Array.isArray(page1[1]) ? page1[1] : []),
        ...(Array.isArray(page2) && Array.isArray(page2[1]) ? page2[1] : []),
      ];

      if (rows.length === 0) {
        throw new Error('World Bank WDI catalog returned empty response');
      }

      return rows
        .filter((r) => r.id && r.name)
        .map((r) => ({
          id: r.id,
          name: r.name,
          unit: r.unit || '',
          sourceNote: r.sourceNote || '',
          sourceOrganization: r.sourceOrganization || 'World Bank',
          topics: Array.isArray(r.topics)
            ? r.topics.map((t) => (t.value || '').trim()).filter(Boolean)
            : [],
        }));
    },
    IMF_CACHE_TTL_MS
  );
}

async function createServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/countries', async (_req, res) => {
    try {
      const countries = await loadCountries();
      res.json({ countries, total: countries.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load countries';
      res.status(502).json({ error: message });
    }
  });

  app.get('/api/country/:iso3/core', async (req, res) => {
    const iso3 = (req.params.iso3 || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (iso3.length !== 3) {
      res.status(400).json({ error: 'Invalid ISO3 country code' });
      return;
    }

    try {
      const { indicators, failedCodes } = await fetchIndicatorBatch(iso3, CORE_INDICATOR_CODES, 5);
      if (Object.keys(indicators).length === 0 && failedCodes.length > 0) {
        res.status(502).json({
          error: 'Source data API timed out while fetching core indicators. Please retry.',
        });
        return;
      }
      res.json({ iso3, indicators, failedCodes });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch core indicators';
      res.status(502).json({ error: message });
    }
  });

  app.get('/api/country/:iso3/extended', async (req, res) => {
    const iso3 = (req.params.iso3 || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (iso3.length !== 3) {
      res.status(400).json({ error: 'Invalid ISO3 country code' });
      return;
    }

    try {
      const { indicators, failedCodes } = await fetchIndicatorBatch(
        iso3,
        EXTENDED_INDICATOR_CODES,
        5
      );
      if (Object.keys(indicators).length === 0 && failedCodes.length > 0) {
        res.status(502).json({
          error: 'Source data API timed out while fetching extended indicators. Please retry.',
        });
        return;
      }
      res.json({ iso3, indicators, failedCodes });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch extended indicators';
      res.status(502).json({ error: message });
    }
  });

  app.get('/api/indicator/:code/country/:iso3', async (req, res) => {
    const code = (req.params.code || '').trim();
    const iso3 = (req.params.iso3 || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code || iso3.length !== 3) {
      res.status(400).json({ error: 'Invalid indicator code or ISO3 country' });
      return;
    }

    try {
      const series = await fetchSingleCountryIndicator(iso3, code);
      res.json({ iso3, indicator: series });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch indicator series';
      res.status(502).json({ error: message });
    }
  });

  app.get('/api/compare', async (req, res) => {
    const rawCountries = String(req.query.countries || '');
    const indicator = String(req.query.indicator || 'NY.GDP.MKTP.CD').trim();
    const codes = rawCountries
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter((s) => /^[A-Z0-9]{3}$/.test(s))
      .slice(0, 4);

    if (codes.length === 0 || !indicator) {
      res.status(400).json({ error: 'Provide up to 4 valid ISO3 country codes and an indicator code' });
      return;
    }

    try {
      const entries = await Promise.all(
        codes.map(async (iso3) => {
          const series = await fetchSingleCountryIndicator(iso3, indicator);
          return [iso3, series] as const;
        })
      );
      res.json({
        indicator,
        seriesByCountry: Object.fromEntries(entries),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to compare countries';
      res.status(502).json({ error: message });
    }
  });

  app.get('/api/indicator/:code/global', async (req, res) => {
    const code = (req.params.code || '').trim();
    if (!code) {
      res.status(400).json({ error: 'Indicator code required' });
      return;
    }

    try {
      const countries = await loadCountries();
      const countryLookup = new Map(countries.map((c) => [c.id, c]));

      let rankings: Array<{
        iso3: string;
        iso2: string;
        name: string;
        region: string;
        incomeLevel: string;
        year: number;
        value: number;
      }> = [];

      try {
        const globalPayload = await cachedFetch(`global:${code}`, async () => {
          const url = `${WB_BASE}/country/all/indicator/${encodeURIComponent(code)}?format=json&mrnev=1&per_page=350`;
          const payload = await fetchWbJson<[unknown, WbObservationRow[] | null]>(url, 14000, 1);
          return Array.isArray(payload) && Array.isArray(payload[1]) ? payload[1] : [];
        });

        rankings = globalPayload
          .filter((row) => {
            const iso3 = (row.countryiso3code || '').toUpperCase();
            return (
              iso3 &&
              countryLookup.has(iso3) &&
              row.value !== null &&
              row.value !== undefined &&
              Number.isFinite(Number(row.value))
            );
          })
          .map((row) => {
            const iso3 = row.countryiso3code!.toUpperCase();
            const meta = countryLookup.get(iso3)!;
            return {
              iso3,
              iso2: meta.iso2,
              name: meta.name,
              region: meta.region,
              incomeLevel: meta.incomeLevel,
              year: Number(row.date),
              value: Number(row.value),
            };
          });
      } catch (wbErr) {
        const mapping = IMF_FALLBACK_MAP[code];
        if (!mapping) throw wbErr;

        const imfDataset = await fetchImfIndicatorDataset(mapping.imfCode);
        rankings = Object.entries(imfDataset)
          .filter(([iso3]) => countryLookup.has(iso3.toUpperCase()))
          .map(([iso3, yearsObj]) => {
            const upperIso = iso3.toUpperCase();
            const meta = countryLookup.get(upperIso)!;
            const validYears = Object.entries(yearsObj)
              .map(([y, v]) => ({ year: Number(y), value: Number(v) * mapping.scale }))
              .filter(
                (p) =>
                  Number.isFinite(p.year) &&
                  p.year <= CURRENT_YEAR &&
                  Number.isFinite(p.value)
              )
              .sort((a, b) => a.year - b.year);
            const latest = validYears[validYears.length - 1];
            if (!latest) return null;
            return {
              iso3: upperIso,
              iso2: meta.iso2,
              name: meta.name,
              region: meta.region,
              incomeLevel: meta.incomeLevel,
              year: latest.year,
              value: latest.value,
            };
          })
          .filter((row): row is NonNullable<typeof row> => row !== null);
      }

      res.json({ code, rankings });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch global rankings';
      res.status(502).json({ error: message });
    }
  });

  app.get('/api/catalog', async (req, res) => {
    const q = String(req.query.q || '').trim().toLowerCase();
    const topic = String(req.query.topic || '').trim().toLowerCase();
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(60, Math.max(10, Number(req.query.limit || 30)));

    try {
      const all = await loadWdiCatalog();
      const filtered = all.filter((item) => {
        const matchesTopic =
          !topic ||
          topic === 'all' ||
          item.topics.some((t) => t.toLowerCase().includes(topic));
        if (!matchesTopic) return false;
        if (!q) return true;
        return (
          item.name.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q) ||
          item.sourceNote.toLowerCase().includes(q)
        );
      });

      const start = (page - 1) * limit;
      const items = filtered.slice(start, start + limit);
      const allTopics = Array.from(new Set(all.flatMap((i) => i.topics))).sort((a, b) =>
        a.localeCompare(b)
      );

      res.json({
        total: filtered.length,
        catalogTotal: all.length,
        page,
        limit,
        topics: allTopics,
        items,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load indicator catalog';
      res.status(502).json({ error: message });
    }
  });

  const isProd =
    process.env.NODE_ENV === 'production' &&
    fs.existsSync(path.join(__dirname, 'dist', 'index.html'));

  if (isProd) {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Atlas Macro server running on http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
