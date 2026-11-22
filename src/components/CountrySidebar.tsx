import { Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { CountryMeta } from '../data/indicators';
import { iso2ToFlagEmoji } from '../utils/format';

type CountrySidebarProps = {
  countries: CountryMeta[];
  loading: boolean;
  selectedIso3: string;
  onSelectCountry: (iso3: string) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

const QUICK_PICKS = ['USA', 'CHN', 'DEU', 'JPN', 'GBR', 'IND', 'BRA', 'SGP'];

export function CountrySidebar({
  countries,
  loading,
  selectedIso3,
  onSelectCountry,
  mobileOpen,
  onCloseMobile,
}: CountrySidebarProps) {
  const [query, setQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState('ALL');

  const regions = useMemo(() => {
    const set = new Set<string>();
    countries.forEach((c) => {
      if (c.region) set.add(c.region);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [countries]);

  const filteredCountries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return countries.filter((c) => {
      if (regionFilter !== 'ALL' && c.region !== regionFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.iso2.toLowerCase().includes(q) ||
        c.capital.toLowerCase().includes(q)
      );
    });
  }, [countries, query, regionFilter]);

  const quickPickCountries = useMemo(() => {
    const byId = new Map(countries.map((c) => [c.id, c]));
    return QUICK_PICKS.map((id) => byId.get(id)).filter((c): c is CountryMeta => Boolean(c));
  }, [countries]);

  const sidebarBody = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      <div className="p-4 border-b border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold tracking-wide text-slate-500">
            Country Directory ({countries.length || '...'})
          </h2>
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 rounded-md"
            aria-label="Close country directory"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search country or ISO..."
            aria-label="Search country or ISO code"
            className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-700"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <select
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          aria-label="Filter by region"
          className="w-full px-2.5 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:border-blue-700"
        >
          <option value="ALL">All Regions</option>
          {regions.map((region) => (
            <option key={region} value={region}>
              {region}
            </option>
          ))}
        </select>

        {!query && regionFilter === 'ALL' && quickPickCountries.length > 0 && (
          <div className="pt-1">
            <div className="text-[11px] font-medium text-slate-400 mb-1.5">
              Major Economies
            </div>
            <div className="grid grid-cols-4 gap-1">
              {quickPickCountries.map((c) => {
                const active = c.id === selectedIso3;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onSelectCountry(c.id);
                      onCloseMobile();
                    }}
                    className={`px-1.5 py-1.5 text-xs font-mono font-medium rounded border transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-blue-700 text-white border-blue-700'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {c.id}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {loading ? (
          <div className="p-4 space-y-2.5">
            {Array.from({ length: 14 }).map((_, idx) => (
              <div key={idx} className="h-9 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : filteredCountries.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">
            No matching countries found.
          </div>
        ) : (
          filteredCountries.map((country) => {
            const isSelected = country.id === selectedIso3;
            const flag = iso2ToFlagEmoji(country.iso2);
            return (
              <button
                key={country.id}
                type="button"
                onClick={() => {
                  onSelectCountry(country.id);
                  onCloseMobile();
                }}
                className={`w-full px-4 py-2.5 flex items-center justify-between gap-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-blue-700 ${
                  isSelected
                    ? 'bg-blue-50/80 text-blue-900 font-semibold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span className="text-base leading-none shrink-0" aria-hidden="true">
                    {flag || country.iso2}
                  </span>
                  <span className="text-sm truncate">{country.name}</span>
                </span>
                <span
                  className={`font-mono text-xs tabular-nums shrink-0 ${
                    isSelected ? 'text-blue-700' : 'text-slate-400'
                  }`}
                >
                  {country.id}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside
        aria-label="Country directory"
        className="hidden lg:block w-72 shrink-0 sticky top-16 h-[calc(100vh-4rem)]"
      >
        {sidebarBody}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative w-80 max-w-[85vw] h-full z-10 shadow-xl">
            {sidebarBody}
          </div>
        </div>
      )}
    </>
  );
}
