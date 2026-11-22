import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CatalogWorkspace } from './components/CatalogWorkspace';
import { CompareWorkspace } from './components/CompareWorkspace';
import { CountrySidebar } from './components/CountrySidebar';
import { Header, type WorkspaceView } from './components/Header';
import { OverviewWorkspace } from './components/OverviewWorkspace';
import { RankingsWorkspace } from './components/RankingsWorkspace';
import {
  CURATED_INDICATORS,
  type CountryMeta,
  type IndicatorSeries,
} from './data/indicators';
import { downloadCsv } from './utils/format';

export default function App() {
  const [countries, setCountries] = useState<CountryMeta[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [selectedIso3, setSelectedIso3] = useState('USA');
  const [activeView, setActiveView] = useState<WorkspaceView>('overview');
  const [mobileDirectoryOpen, setMobileDirectoryOpen] = useState(false);

  const [focusedCode, setFocusedCode] = useState('NY.GDP.MKTP.CD');
  const [customSeries, setCustomSeries] = useState<IndicatorSeries | null>(null);
  const [rankingsCode, setRankingsCode] = useState('NY.GDP.MKTP.CD');
  const [compareList, setCompareList] = useState<string[]>(['USA', 'CHN', 'DEU']);

  const [seriesByCountry, setSeriesByCountry] = useState<
    Record<string, Record<string, IndicatorSeries>>
  >({});
  const [coreLoading, setCoreLoading] = useState(false);
  const [extendedLoading, setExtendedLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const loadedExtendedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const controller = new AbortController();
    setCountriesLoading(true);
    fetch('/api/countries', { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load countries (HTTP ${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data.countries)) {
          setCountries(data.countries);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setFetchError(err instanceof Error ? err.message : 'Unable to load country list');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setCountriesLoading(false);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selectedIso3) return;
    if (loadedExtendedRef.current.has(selectedIso3) && reloadToken === 0) {
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    async function loadCountryIndicators() {
      setFetchError(null);
      setCoreLoading(true);
      setExtendedLoading(true);

      let coreOk = false;

      // Phase 1: Fetch 8 flagship indicators first to avoid bursting upstream API
      try {
        const res = await fetch(`/api/country/${encodeURIComponent(selectedIso3)}/core`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || `HTTP ${res.status}`);
        }
        if (!cancelled && data?.indicators) {
          setSeriesByCountry((prev) => ({
            ...prev,
            [selectedIso3]: {
              ...(prev[selectedIso3] || {}),
              ...data.indicators,
            },
          }));
          coreOk = !Array.isArray(data.failedCodes) || data.failedCodes.length === 0;
          if (!coreOk) {
            setFetchError(
              `Some flagship indicators timed out from the upstream data source (${data.failedCodes.length} failed).`
            );
          }
        }
      } catch (err) {
        if (!cancelled && (err as Error).name !== 'AbortError') {
          setFetchError(
            err instanceof Error ? err.message : 'Failed to load macroeconomic indicators'
          );
        }
      } finally {
        if (!cancelled) setCoreLoading(false);
      }

      if (cancelled || controller.signal.aborted) return;

      // Phase 2: Fetch remaining 28 domain indicators sequentially after core completes
      try {
        const res = await fetch(`/api/country/${encodeURIComponent(selectedIso3)}/extended`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || `HTTP ${res.status}`);
        }
        if (!cancelled && data?.indicators) {
          setSeriesByCountry((prev) => ({
            ...prev,
            [selectedIso3]: {
              ...(prev[selectedIso3] || {}),
              ...data.indicators,
            },
          }));
          const extFailed = Array.isArray(data.failedCodes) ? data.failedCodes.length : 0;
          if (coreOk && extFailed === 0) {
            loadedExtendedRef.current.add(selectedIso3);
          } else if (extFailed > 0) {
            setFetchError((prev) =>
              prev || `Some domain indicators (${extFailed}) timed out upstream. Click Retry to reload.`
            );
          }
        }
      } catch (err) {
        if (!cancelled && (err as Error).name !== 'AbortError') {
          setFetchError((prev) =>
            prev || (err instanceof Error ? err.message : 'Failed to load extended indicators')
          );
        }
      } finally {
        if (!cancelled) setExtendedLoading(false);
      }
    }

    loadCountryIndicators();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [selectedIso3, reloadToken]);

  const activeCountry = useMemo(
    () => countries.find((c) => c.id === selectedIso3),
    [countries, selectedIso3]
  );

  const activeSeriesMap = seriesByCountry[selectedIso3] || {};

  const handleSelectCountry = useCallback((iso3: string) => {
    setSelectedIso3(iso3);
    setCustomSeries(null);
    setReloadToken(0);
  }, []);

  const handleToggleCompare = useCallback((iso3: string) => {
    setCompareList((prev) => {
      if (prev.includes(iso3)) {
        return prev.filter((id) => id !== iso3);
      }
      if (prev.length >= 4) return prev;
      return [...prev, iso3];
    });
  }, []);

  const handleAddCompare = useCallback((iso3: string) => {
    setCompareList((prev) => {
      if (prev.includes(iso3) || prev.length >= 4) return prev;
      return [...prev, iso3];
    });
  }, []);

  const handleRemoveCompare = useCallback((iso3: string) => {
    setCompareList((prev) => prev.filter((id) => id !== iso3));
  }, []);

  const handleOpenRankingsFor = useCallback((code: string) => {
    setRankingsCode(code);
    setActiveView('rankings');
  }, []);

  const handlePlotCatalogInOverview = useCallback((series: IndicatorSeries) => {
    setCustomSeries(series);
    setFocusedCode(series.code);
    setActiveView('overview');
  }, []);

  const handleExportCsv = useCallback(() => {
    if (!activeCountry) return;
    const rows: string[][] = [
      ['Country', 'ISO3', 'Indicator Code', 'Indicator Name', 'Domain', 'Unit', 'Latest Year', 'Latest Value', 'Previous Year', 'Previous Value'],
    ];

    for (const def of CURATED_INDICATORS) {
      const s = activeSeriesMap[def.code];
      rows.push([
        activeCountry.name,
        activeCountry.id,
        def.code,
        def.name,
        def.domain,
        def.unit,
        s?.latestYear !== null && s?.latestYear !== undefined ? String(s.latestYear) : '',
        s?.latestValue !== null && s?.latestValue !== undefined ? String(s.latestValue) : '',
        s?.previousYear !== null && s?.previousYear !== undefined ? String(s.previousYear) : '',
        s?.previousValue !== null && s?.previousValue !== undefined ? String(s.previousValue) : '',
      ]);
    }

    downloadCsv(`${activeCountry.id.toLowerCase()}-economic-indicators.csv`, rows);
  }, [activeCountry, activeSeriesMap]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Header
        activeView={activeView}
        onSelectView={setActiveView}
        onExportCsv={handleExportCsv}
        canExport={Boolean(activeCountry && Object.keys(activeSeriesMap).length > 0)}
      />

      <div className="flex-1 flex">
        <CountrySidebar
          countries={countries}
          loading={countriesLoading}
          selectedIso3={selectedIso3}
          onSelectCountry={(iso3) => {
            handleSelectCountry(iso3);
            if (activeView === 'compare') {
              setActiveView('overview');
            }
          }}
          mobileOpen={mobileDirectoryOpen}
          onCloseMobile={() => setMobileDirectoryOpen(false)}
        />

        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-[1200px]">
          {activeView === 'overview' && (
            <OverviewWorkspace
              country={activeCountry}
              seriesMap={activeSeriesMap}
              coreLoading={coreLoading}
              extendedLoading={extendedLoading}
              error={fetchError}
              focusedCode={focusedCode}
              onFocusCode={(code) => {
                setCustomSeries(null);
                setFocusedCode(code);
              }}
              customSeries={customSeries}
              compareList={compareList}
              onToggleCompare={handleToggleCompare}
              onOpenRankingsFor={handleOpenRankingsFor}
              onOpenMobileDirectory={() => setMobileDirectoryOpen(true)}
              onRetry={() => {
                loadedExtendedRef.current.delete(selectedIso3);
                setReloadToken((n) => n + 1);
              }}
            />
          )}

          {activeView === 'compare' && (
            <CompareWorkspace
              countries={countries}
              compareList={compareList}
              onAddCompare={handleAddCompare}
              onRemoveCompare={handleRemoveCompare}
              onSelectCountry={(iso3) => {
                handleSelectCountry(iso3);
                setActiveView('overview');
              }}
            />
          )}

          {activeView === 'rankings' && (
            <RankingsWorkspace
              initialIndicatorCode={rankingsCode}
              selectedCountryIso3={selectedIso3}
              onSelectCountryAndOpenOverview={(iso3) => {
                handleSelectCountry(iso3);
                setActiveView('overview');
              }}
            />
          )}

          {activeView === 'catalog' && (
            <CatalogWorkspace
              country={activeCountry}
              onPlotInOverview={handlePlotCatalogInOverview}
              onOpenRankingsFor={handleOpenRankingsFor}
            />
          )}
        </main>
      </div>
    </div>
  );
}
