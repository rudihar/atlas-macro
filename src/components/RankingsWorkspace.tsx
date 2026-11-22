import { ArrowDownUp, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CURATED_INDICATORS, INDICATOR_MAP } from '../data/indicators';
import { formatIndicatorValue, inferCatalogFormat, iso2ToFlagEmoji } from '../utils/format';

type GlobalRankRow = {
  iso3: string;
  iso2: string;
  name: string;
  region: string;
  incomeLevel: string;
  year: number;
  value: number;
};

type RankingsWorkspaceProps = {
  initialIndicatorCode: string;
  selectedCountryIso3: string;
  onSelectCountryAndOpenOverview: (iso3: string) => void;
};

export function RankingsWorkspace({
  initialIndicatorCode,
  selectedCountryIso3,
  onSelectCountryAndOpenOverview,
}: RankingsWorkspaceProps) {
  const [indicatorCode, setIndicatorCode] = useState(initialIndicatorCode || 'NY.GDP.MKTP.CD');
  const [rows, setRows] = useState<GlobalRankRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState('ALL');
  const [sortDesc, setSortDesc] = useState(true);

  useEffect(() => {
    if (initialIndicatorCode) {
      setIndicatorCode(initialIndicatorCode);
    }
  }, [initialIndicatorCode]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`/api/indicator/${encodeURIComponent(indicatorCode)}/global`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setRows(Array.isArray(data.rankings) ? data.rankings : []);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setError(err instanceof Error ? err.message : 'Failed to load rankings');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [indicatorCode]);

  const indicatorDef = INDICATOR_MAP[indicatorCode];
  const format = indicatorDef
    ? indicatorDef.format
    : inferCatalogFormat(indicatorCode, '');

  const regions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.region) set.add(r.region);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const sortedGlobal = useMemo(() => {
    return [...rows].sort((a, b) => (sortDesc ? b.value - a.value : a.value - b.value));
  }, [rows, sortDesc]);

  const rankMap = useMemo(() => {
    const map = new Map<string, number>();
    sortedGlobal.forEach((row, idx) => map.set(row.iso3, idx + 1));
    return map;
  }, [sortedGlobal]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sortedGlobal.filter((r) => {
      if (regionFilter !== 'ALL' && r.region !== regionFilter) return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || r.iso3.toLowerCase().includes(q);
    });
  }, [sortedGlobal, searchQuery, regionFilter]);

  const summary = useMemo(() => {
    if (rows.length === 0) return null;
    const asc = [...rows].sort((a, b) => a.value - b.value);
    const median = asc[Math.floor(asc.length / 2)];
    const lowest = asc[0];
    const highest = asc[asc.length - 1];
    const activeRank = rankMap.get(selectedCountryIso3) ?? null;
    const activeRow = rows.find((r) => r.iso3 === selectedCountryIso3) || null;
    return { median, lowest, highest, activeRank, activeRow };
  }, [rows, rankMap, selectedCountryIso3]);

  const maxAbs = useMemo(() => {
    if (sortedGlobal.length === 0) return 1;
    return Math.max(...sortedGlobal.map((r) => Math.abs(r.value))) || 1;
  }, [sortedGlobal]);

  return (
    <div className="space-y-6">
      <section className="pb-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Global Rankings
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Latest available World Bank values benchmarked across {rows.length || '...'} reporting economies.
          </p>
        </div>

        <div className="w-full lg:w-96">
          <label htmlFor="rankings-indicator-select" className="block text-xs font-medium text-slate-500 mb-1">
            Ranked Indicator
          </label>
          <select
            id="rankings-indicator-select"
            value={indicatorCode}
            onChange={(e) => setIndicatorCode(e.target.value)}
            className="w-full px-3 py-2 text-sm font-medium bg-white border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-blue-700"
          >
            {!indicatorDef && (
              <option value={indicatorCode}>Custom Catalog — {indicatorCode}</option>
            )}
            {CURATED_INDICATORS.map((ind) => (
              <option key={ind.code} value={ind.code}>
                {ind.domain} — {ind.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Summary Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <div className="text-xs text-slate-500 mb-1">Highest Economy</div>
          <div className="font-mono text-xl font-semibold text-slate-900 tabular-nums">
            {loading ? '...' : formatIndicatorValue(summary?.highest.value, format)}
          </div>
          <div className="text-xs text-slate-600 mt-1 truncate">
            {summary?.highest.name || '—'} ({summary?.highest.year || '—'})
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <div className="text-xs text-slate-500 mb-1">Global Median</div>
          <div className="font-mono text-xl font-semibold text-slate-900 tabular-nums">
            {loading ? '...' : formatIndicatorValue(summary?.median.value, format)}
          </div>
          <div className="text-xs text-slate-600 mt-1 truncate">
            {summary?.median.name || '—'}
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <div className="text-xs text-slate-500 mb-1">Lowest Economy</div>
          <div className="font-mono text-xl font-semibold text-slate-900 tabular-nums">
            {loading ? '...' : formatIndicatorValue(summary?.lowest.value, format)}
          </div>
          <div className="text-xs text-slate-600 mt-1 truncate">
            {summary?.lowest.name || '—'} ({summary?.lowest.year || '—'})
          </div>
        </div>

        <div className="p-4 bg-white border border-blue-200 rounded-lg">
          <div className="text-xs text-blue-700 font-medium mb-1">
            Selected Country Rank
          </div>
          <div className="font-mono text-xl font-semibold text-slate-900 tabular-nums">
            {loading
              ? '...'
              : summary?.activeRank
                ? `#${summary.activeRank} of ${rows.length}`
                : 'N/A'}
          </div>
          <div className="text-xs text-slate-600 mt-1 truncate">
            {summary?.activeRow
              ? `${summary.activeRow.name}: ${formatIndicatorValue(summary.activeRow.value, format)}`
              : `${selectedCountryIso3} has no recent observation`}
          </div>
        </div>
      </section>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Leaderboard Table */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative w-full sm:w-64">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search country..."
                aria-label="Search country in rankings"
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-700"
              />
            </div>

            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              aria-label="Filter rankings by region"
              className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:border-blue-700"
            >
              <option value="ALL">All Regions</option>
              {regions.map((reg) => (
                <option key={reg} value={reg}>
                  {reg}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setSortDesc((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-md text-slate-700 hover:bg-slate-100 whitespace-nowrap self-start sm:self-auto"
          >
            <ArrowDownUp className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{sortDesc ? 'Highest First' : 'Lowest First'}</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500">
                <th className="py-2.5 px-4 w-16">Rank</th>
                <th className="py-2.5 px-3">Country</th>
                <th className="py-2.5 px-3 hidden md:table-cell">Region</th>
                <th className="py-2.5 px-3 text-right">Year</th>
                <th className="py-2.5 px-3 text-right">Value</th>
                <th className="py-2.5 px-5 w-44 hidden lg:table-cell">Scale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                Array.from({ length: 10 }).map((_, idx) => (
                  <tr key={idx}>
                    <td colSpan={6} className="py-3 px-4">
                      <div className="h-5 bg-slate-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-slate-500">
                    No country rankings match your filter.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const globalRank = rankMap.get(row.iso3) || 0;
                  const isActive = row.iso3 === selectedCountryIso3;
                  const pct = Math.min(100, (Math.abs(row.value) / maxAbs) * 100);
                  return (
                    <tr
                      key={row.iso3}
                      onClick={() => onSelectCountryAndOpenOverview(row.iso3)}
                      className={`cursor-pointer transition-colors ${
                        isActive ? 'bg-blue-50/80' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-500 tabular-nums">
                        #{globalRank}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <span className="text-base leading-none" aria-hidden="true">
                            {iso2ToFlagEmoji(row.iso2)}
                          </span>
                          <span className={`font-medium ${isActive ? 'text-blue-900' : 'text-slate-900'}`}>
                            {row.name}
                          </span>
                          <span className="font-mono text-xs text-slate-400">{row.iso3}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-500 hidden md:table-cell">
                        {row.region}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-xs text-slate-500 tabular-nums">
                        {row.year}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                        {formatIndicatorValue(row.value, format)}
                      </td>
                      <td className="py-2.5 px-5 hidden lg:table-cell">
                        <div className="w-full h-2 bg-slate-100 rounded-xs overflow-hidden">
                          <div
                            className={`h-full ${
                              row.value < 0 ? 'bg-red-600' : isActive ? 'bg-blue-700' : 'bg-slate-500'
                            }`}
                            style={{ width: `${Math.max(2, pct)}%` }}
                          />
                        </div>
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
