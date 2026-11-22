import { ArrowUpRight, Check, Globe, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  CURATED_INDICATORS,
  INDICATOR_DOMAINS,
  INDICATOR_MAP,
  type CountryMeta,
  type IndicatorDefinition,
  type IndicatorDomain,
  type IndicatorSeries,
} from '../data/indicators';
import {
  formatDelta,
  formatIndicatorValue,
  inferCatalogFormat,
  iso2ToFlagEmoji,
} from '../utils/format';
import { Sparkline } from './Sparkline';
import { TimeSeriesChart } from './TimeSeriesChart';

type OverviewWorkspaceProps = {
  country: CountryMeta | undefined;
  seriesMap: Record<string, IndicatorSeries>;
  coreLoading: boolean;
  extendedLoading: boolean;
  error: string | null;
  focusedCode: string;
  onFocusCode: (code: string) => void;
  customSeries: IndicatorSeries | null;
  compareList: string[];
  onToggleCompare: (iso3: string) => void;
  onOpenRankingsFor: (code: string) => void;
  onOpenMobileDirectory: () => void;
  onRetry: () => void;
};

type TimeframeOption = '5Y' | '10Y' | '20Y' | 'MAX';

const HEADLINE_CODES = [
  'NY.GDP.MKTP.CD',
  'NY.GDP.MKTP.KD.ZG',
  'FP.CPI.TOTL.ZG',
  'SL.UEM.TOTL.ZS',
];

export function OverviewWorkspace({
  country,
  seriesMap,
  coreLoading,
  extendedLoading,
  error,
  focusedCode,
  onFocusCode,
  customSeries,
  compareList,
  onToggleCompare,
  onOpenRankingsFor,
  onOpenMobileDirectory,
  onRetry,
}: OverviewWorkspaceProps) {
  const [selectedDomain, setSelectedDomain] = useState<'ALL' | IndicatorDomain>('ALL');
  const [tableQuery, setTableQuery] = useState('');
  const [timeframe, setTimeframe] = useState<TimeframeOption>('20Y');
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  const focusedDef: IndicatorDefinition | undefined = INDICATOR_MAP[focusedCode];
  const focusedSeries =
    customSeries && customSeries.code === focusedCode ? customSeries : seriesMap[focusedCode];

  const focusedFormat = focusedDef
    ? focusedDef.format
    : inferCatalogFormat(focusedSeries?.name || '', focusedSeries?.unit || '');

  const chartPoints = useMemo(() => {
    const raw = focusedSeries?.points || [];
    if (raw.length === 0 || timeframe === 'MAX') return raw;
    const latestYr = raw[raw.length - 1].year;
    const span = timeframe === '5Y' ? 5 : timeframe === '10Y' ? 10 : 20;
    return raw.filter((p) => p.year >= latestYr - span);
  }, [focusedSeries, timeframe]);

  const seriesStats = useMemo(() => {
    if (chartPoints.length === 0) return null;
    const values = chartPoints.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const minPt = chartPoints.find((p) => p.value === min);
    const maxPt = chartPoints.find((p) => p.value === max);
    const avg = values.reduce((acc, v) => acc + v, 0) / values.length;
    return { min, max, minYear: minPt?.year, maxYear: maxPt?.year, avg };
  }, [chartPoints]);

  const filteredIndicators = useMemo(() => {
    const q = tableQuery.trim().toLowerCase();
    return CURATED_INDICATORS.filter((ind) => {
      if (selectedDomain !== 'ALL' && ind.domain !== selectedDomain) return false;
      if (!q) return true;
      return (
        ind.name.toLowerCase().includes(q) ||
        ind.shortName.toLowerCase().includes(q) ||
        ind.code.toLowerCase().includes(q) ||
        ind.domain.toLowerCase().includes(q)
      );
    });
  }, [selectedDomain, tableQuery]);

  const isInCompare = country ? compareList.includes(country.id) : false;
  const flag = country ? iso2ToFlagEmoji(country.iso2) : '';

  return (
    <div className="space-y-8">
      {/* Country Identity Header */}
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="space-y-2 min-w-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onOpenMobileDirectory}
              className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-md text-slate-700 hover:bg-slate-50"
            >
              <Globe className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Select Country</span>
            </button>
          </div>

          <div className="flex items-center gap-3.5">
            {flag && (
              <span className="text-3xl leading-none shrink-0" aria-hidden="true">
                {flag}
              </span>
            )}
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 truncate">
              {country ? country.name : 'Select a Country'}
            </h1>
          </div>

          {country && (
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm text-slate-500">
              <span className="font-mono text-slate-700 font-medium">{country.id}</span>
              <span aria-hidden="true">·</span>
              <span>Capital: {country.capital}</span>
              <span aria-hidden="true">·</span>
              <span>{country.region}</span>
              <span aria-hidden="true">·</span>
              <span>{country.incomeLevel}</span>
              <span aria-hidden="true">·</span>
              <span>Source: World Bank WDI</span>
            </div>
          )}
        </div>

        {country && (
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onToggleCompare(country.id)}
              disabled={!isInCompare && compareList.length >= 4}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                isInCompare
                  ? 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50'
              }`}
            >
              {isInCompare ? (
                <>
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>In Compare ({compareList.length}/4)</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Add to Compare</span>
                </>
              )}
            </button>
          </div>
        )}
      </section>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between gap-4">
          <p className="text-sm text-red-800">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="px-3 py-1.5 text-xs font-semibold text-red-900 bg-white border border-red-200 rounded-md hover:bg-red-50 whitespace-nowrap shrink-0"
          >
            Retry Fetch
          </button>
        </div>
      )}

      {/* 4-Column Flagship Macro KPI Strip */}
      <section aria-label="Headline macroeconomic indicators" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {HEADLINE_CODES.map((code) => {
          const def = INDICATOR_MAP[code];
          const series = seriesMap[code];
          const isFocused = focusedCode === code;
          const delta = formatDelta(series, def.format);

          return (
            <button
              key={code}
              type="button"
              onClick={() => onFocusCode(code)}
              className={`text-left p-5 bg-white rounded-lg border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
                isFocused
                  ? 'border-blue-700 ring-1 ring-blue-700'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-xs font-medium text-slate-600 truncate">
                  {def.shortName}
                </span>
                <span className="font-mono text-[11px] text-slate-400 tabular-nums shrink-0">
                  {series?.latestYear ?? '—'}
                </span>
              </div>

              {coreLoading && !series ? (
                <div className="space-y-2">
                  <div className="h-8 w-28 bg-slate-100 rounded animate-pulse" />
                  <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
                </div>
              ) : (
                <>
                  <div className="font-mono text-2xl font-semibold text-slate-900 tabular-nums tracking-tight mb-1.5">
                    {formatIndicatorValue(series?.latestValue, def.format)}
                  </div>
                  <div
                    className={`text-xs font-mono tabular-nums ${
                      delta.direction === 'up'
                        ? def.polarity === 'lower-better'
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                        : delta.direction === 'down'
                          ? def.polarity === 'lower-better'
                            ? 'text-emerald-700'
                            : 'text-red-700'
                          : 'text-slate-400'
                    }`}
                  >
                    {delta.text}
                  </div>
                </>
              )}
            </button>
          );
        })}
      </section>

      {/* Interactive Time-Series Chart Panel */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-mono text-slate-600">{focusedCode}</span>
              {focusedDef && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{focusedDef.domain}</span>
                </>
              )}
              {focusedSeries?.unit && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Unit: {focusedSeries.unit}</span>
                </>
              )}
            </div>
            <h2 className="font-display text-lg sm:text-xl font-semibold text-slate-900">
              {focusedDef?.name || focusedSeries?.name || focusedCode}
            </h2>
            {focusedDef?.description && (
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                {focusedDef.description}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-md border border-slate-200">
              {(['5Y', '10Y', '20Y', 'MAX'] as TimeframeOption[]).map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setTimeframe(tf)}
                  className={`px-2.5 py-1 text-xs font-mono font-medium rounded transition-colors whitespace-nowrap ${
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
                onClick={() => setChartType('line')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  chartType === 'line'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Line
              </button>
              <button
                type="button"
                onClick={() => setChartType('bar')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  chartType === 'bar'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Bar
              </button>
            </div>

            <button
              type="button"
              onClick={() => onOpenRankingsFor(focusedCode)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors whitespace-nowrap"
            >
              <span>Global Rank</span>
              <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <TimeSeriesChart
          seriesList={[
            {
              id: focusedCode,
              label: country?.name || 'Selected Country',
              color: '#1D4ED8',
              points: chartPoints,
            },
          ]}
          format={focusedFormat}
          chartType={chartType}
          loading={coreLoading && !focusedSeries}
          height={310}
        />

        {seriesStats && (
          <div className="pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <div className="text-slate-500 mb-0.5">Latest ({focusedSeries?.latestYear})</div>
              <div className="font-mono font-semibold text-slate-900 tabular-nums">
                {formatIndicatorValue(focusedSeries?.latestValue, focusedFormat)}
              </div>
            </div>
            <div>
              <div className="text-slate-500 mb-0.5">Period Average</div>
              <div className="font-mono font-semibold text-slate-900 tabular-nums">
                {formatIndicatorValue(seriesStats.avg, focusedFormat)}
              </div>
            </div>
            <div>
              <div className="text-slate-500 mb-0.5">Period High ({seriesStats.maxYear})</div>
              <div className="font-mono font-semibold text-slate-900 tabular-nums">
                {formatIndicatorValue(seriesStats.max, focusedFormat)}
              </div>
            </div>
            <div>
              <div className="text-slate-500 mb-0.5">Period Low ({seriesStats.minYear})</div>
              <div className="font-mono font-semibold text-slate-900 tabular-nums">
                {formatIndicatorValue(seriesStats.min, focusedFormat)}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Full Macroeconomic Indicator Ledger */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="p-5 border-b border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900">
                Complete Macroeconomic Ledger
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Click any row to plot its multi-decade trajectory above.{' '}
                {extendedLoading && 'Fetching remaining domain series...'}
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                value={tableQuery}
                onChange={(e) => setTableQuery(e.target.value)}
                placeholder="Filter 36 indicators..."
                aria-label="Filter macroeconomic indicators"
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-700"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setSelectedDomain('ALL')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                selectedDomain === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              All Domains ({CURATED_INDICATORS.length})
            </button>
            {INDICATOR_DOMAINS.map((domain) => (
              <button
                key={domain}
                type="button"
                onClick={() => setSelectedDomain(domain)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  selectedDomain === domain
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                }`}
              >
                {domain}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500">
                <th className="py-2.5 px-5">Indicator</th>
                <th className="py-2.5 px-3 hidden md:table-cell">Domain</th>
                <th className="py-2.5 px-3 text-right">Latest Value</th>
                <th className="py-2.5 px-3 text-right hidden sm:table-cell">YoY Change</th>
                <th className="py-2.5 px-3 text-right">Year</th>
                <th className="py-2.5 px-5 text-right hidden lg:table-cell">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredIndicators.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-slate-500">
                    No indicators match your filter.
                  </td>
                </tr>
              ) : (
                filteredIndicators.map((ind) => {
                  const series = seriesMap[ind.code];
                  const isRowLoading =
                    (ind.tier === 'core' && coreLoading && !series) ||
                    (ind.tier === 'extended' && extendedLoading && !series);
                  const isSelected = focusedCode === ind.code;
                  const delta = formatDelta(series, ind.format);

                  return (
                    <tr
                      key={ind.code}
                      onClick={() => onFocusCode(ind.code)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-50/70'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-3 px-5">
                        <div className="font-medium text-slate-900">{ind.name}</div>
                        <div className="font-mono text-[11px] text-slate-400 mt-0.5">
                          {ind.code}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-500 hidden md:table-cell whitespace-nowrap">
                        {ind.domain}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                        {isRowLoading ? (
                          <span className="inline-block w-16 h-4 bg-slate-100 rounded animate-pulse" />
                        ) : (
                          formatIndicatorValue(series?.latestValue, ind.format)
                        )}
                      </td>
                      <td
                        className={`py-3 px-3 text-right font-mono text-xs tabular-nums hidden sm:table-cell whitespace-nowrap ${
                          delta.direction === 'up'
                            ? ind.polarity === 'lower-better'
                              ? 'text-amber-700'
                              : 'text-emerald-700'
                            : delta.direction === 'down'
                              ? ind.polarity === 'lower-better'
                                ? 'text-emerald-700'
                                : 'text-red-700'
                              : 'text-slate-400'
                        }`}
                      >
                        {isRowLoading ? (
                          <span className="inline-block w-20 h-4 bg-slate-100 rounded animate-pulse" />
                        ) : (
                          delta.text
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                        {series?.latestYear ?? '—'}
                      </td>
                      <td className="py-3 px-5 text-right hidden lg:table-cell whitespace-nowrap">
                        {isRowLoading ? (
                          <span className="inline-block w-20 h-5 bg-slate-100 rounded animate-pulse" />
                        ) : (
                          <Sparkline
                            points={series?.points || []}
                            stroke={isSelected ? '#1D4ED8' : '#475569'}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
