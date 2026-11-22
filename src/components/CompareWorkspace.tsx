import { Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  CURATED_INDICATORS,
  INDICATOR_MAP,
  type CountryMeta,
  type IndicatorSeries,
} from '../data/indicators';
import { formatDelta, formatIndicatorValue, iso2ToFlagEmoji } from '../utils/format';
import { TimeSeriesChart } from './TimeSeriesChart';

type CompareWorkspaceProps = {
  countries: CountryMeta[];
  compareList: string[];
  onAddCompare: (iso3: string) => void;
  onRemoveCompare: (iso3: string) => void;
  onSelectCountry: (iso3: string) => void;
};

const SERIES_COLORS = ['#1D4ED8', '#0F766E', '#B45309', '#7C3AED'];

export function CompareWorkspace({
  countries,
  compareList,
  onAddCompare,
  onRemoveCompare,
  onSelectCountry,
}: CompareWorkspaceProps) {
  const [indicatorCode, setIndicatorCode] = useState('NY.GDP.MKTP.KD.ZG');
  const [indexed, setIndexed] = useState(false);
  const [timeframe, setTimeframe] = useState<'10Y' | '20Y' | 'MAX'>('20Y');
  const [countryToAdd, setCountryToAdd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seriesByCountry, setSeriesByCountry] = useState<Record<string, IndicatorSeries>>({});

  const countryMap = useMemo(
    () => new Map(countries.map((c) => [c.id, c])),
    [countries]
  );

  const availableToAdd = useMemo(
    () => countries.filter((c) => !compareList.includes(c.id)),
    [countries, compareList]
  );

  useEffect(() => {
    if (compareList.length === 0) {
      setSeriesByCountry({});
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(
      `/api/compare?countries=${encodeURIComponent(compareList.join(','))}&indicator=${encodeURIComponent(indicatorCode)}`,
      { signal: controller.signal }
    )
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setSeriesByCountry(data.seriesByCountry || {});
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setError(err instanceof Error ? err.message : 'Failed to load comparison');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [compareList, indicatorCode]);

  const indicatorDef = INDICATOR_MAP[indicatorCode] || CURATED_INDICATORS[0];

  const chartSeries = useMemo(() => {
    return compareList.map((iso3, idx) => {
      const rawPoints = seriesByCountry[iso3]?.points || [];
      let filtered = rawPoints;
      if (timeframe !== 'MAX' && rawPoints.length > 0) {
        const latestYr = rawPoints[rawPoints.length - 1].year;
        const span = timeframe === '10Y' ? 10 : 20;
        filtered = rawPoints.filter((p) => p.year >= latestYr - span);
      }
      return {
        id: iso3,
        label: countryMap.get(iso3)?.name || iso3,
        color: SERIES_COLORS[idx % SERIES_COLORS.length],
        points: filtered,
      };
    });
  }, [compareList, seriesByCountry, timeframe, countryMap]);

  return (
    <div className="space-y-6">
      <section className="pb-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Cross-Country Comparison
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Overlay macroeconomic trajectories for up to 4 countries simultaneously.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={countryToAdd}
            onChange={(e) => {
              const val = e.target.value;
              if (val) {
                onAddCompare(val);
                setCountryToAdd('');
              }
            }}
            disabled={compareList.length >= 4}
            aria-label="Add country to comparison"
            className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:border-blue-700 disabled:opacity-50"
          >
            <option value="">
              {compareList.length >= 4 ? 'Max 4 countries selected' : '+ Add Country to Compare...'}
            </option>
            {availableToAdd.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.id})
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Active Country Slots */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {compareList.map((iso3, idx) => {
          const meta = countryMap.get(iso3);
          const color = SERIES_COLORS[idx % SERIES_COLORS.length];
          const series = seriesByCountry[iso3];
          const delta = formatDelta(series, indicatorDef.format);
          return (
            <div
              key={iso3}
              className="p-4 bg-white border border-slate-200 rounded-lg flex flex-col justify-between gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onSelectCountry(iso3)}
                  className="flex items-center gap-2 text-left min-w-0 hover:underline"
                >
                  <span
                    className="w-3 h-3 rounded-xs shrink-0"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                  <span className="text-base leading-none shrink-0" aria-hidden="true">
                    {meta ? iso2ToFlagEmoji(meta.iso2) : ''}
                  </span>
                  <span className="font-medium text-sm text-slate-900 truncate">
                    {meta?.name || iso3}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveCompare(iso3)}
                  aria-label={`Remove ${meta?.name || iso3}`}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div>
                <div className="font-mono text-xl font-semibold text-slate-900 tabular-nums">
                  {loading && !series
                    ? '...'
                    : formatIndicatorValue(series?.latestValue, indicatorDef.format)}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 mt-1 font-mono tabular-nums">
                  <span>{delta.text}</span>
                  <span>{series?.latestYear ?? '—'}</span>
                </div>
              </div>
            </div>
          );
        })}

        {compareList.length < 4 && (
          <div className="p-4 border border-dashed border-slate-300 rounded-lg flex items-center justify-center text-xs text-slate-500 bg-slate-50/50">
            <span className="inline-flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              Select from dropdown above
            </span>
          </div>
        )}
      </section>

      {/* Chart Controls + Multi-Series Chart */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex-1 max-w-xl">
            <label htmlFor="compare-indicator-select" className="block text-xs font-medium text-slate-500 mb-1">
              Economic Indicator
            </label>
            <select
              id="compare-indicator-select"
              value={indicatorCode}
              onChange={(e) => setIndicatorCode(e.target.value)}
              className="w-full px-3 py-2 text-sm font-medium bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:bg-white focus:border-blue-700"
            >
              {CURATED_INDICATORS.map((ind) => (
                <option key={ind.code} value={ind.code}>
                  {ind.domain} — {ind.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-md border border-slate-200">
              {(['10Y', '20Y', 'MAX'] as const).map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setTimeframe(tf)}
                  className={`px-2.5 py-1 text-xs font-mono font-medium rounded transition-colors ${
                    timeframe === tf
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>

            <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-md border border-slate-200">
              <button
                type="button"
                onClick={() => setIndexed(false)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  !indexed ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Absolute
              </button>
              <button
                type="button"
                onClick={() => setIndexed(true)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  indexed ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Index (Base 100)
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800">
            {error}
          </div>
        )}

        <TimeSeriesChart
          seriesList={chartSeries}
          format={indicatorDef.format}
          indexed={indexed}
          loading={loading}
          height={340}
        />

        <div className="flex flex-wrap items-center gap-5 pt-2 text-xs text-slate-600">
          {chartSeries.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <span
                className="w-3 h-0.5 inline-block"
                style={{ backgroundColor: s.color }}
                aria-hidden="true"
              />
              <span className="font-medium text-slate-800">{s.label}</span>
              <span className="font-mono text-slate-400">({s.id})</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
