import { ArrowUpRight, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CatalogIndicator, CountryMeta, IndicatorSeries } from '../data/indicators';
import { formatIndicatorValue, inferCatalogFormat } from '../utils/format';
import { TimeSeriesChart } from './TimeSeriesChart';

type CatalogWorkspaceProps = {
  country: CountryMeta | undefined;
  onPlotInOverview: (series: IndicatorSeries) => void;
  onOpenRankingsFor: (code: string) => void;
};

export function CatalogWorkspace({
  country,
  onPlotInOverview,
  onOpenRankingsFor,
}: CatalogWorkspaceProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [topic, setTopic] = useState('all');
  const [page, setPage] = useState(1);
  const [topics, setTopics] = useState<string[]>([]);
  const [items, setItems] = useState<CatalogIndicator[]>([]);
  const [total, setTotal] = useState(0);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedItem, setSelectedItem] = useState<CatalogIndicator | null>(null);
  const [previewSeries, setPreviewSeries] = useState<IndicatorSeries | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 220);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      q: debouncedQuery,
      topic,
      page: String(page),
      limit: '25',
    });

    fetch(`/api/catalog?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setItems(Array.isArray(data.items) ? data.items : []);
        setTotal(data.total || 0);
        setCatalogTotal(data.catalogTotal || 0);
        if (Array.isArray(data.topics) && data.topics.length > 0) {
          setTopics(data.topics);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setError(err instanceof Error ? err.message : 'Failed to search catalog');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [debouncedQuery, topic, page]);

  useEffect(() => {
    if (!selectedItem || !country) return;
    const controller = new AbortController();
    setPreviewLoading(true);

    fetch(
      `/api/indicator/${encodeURIComponent(selectedItem.id)}/country/${encodeURIComponent(country.id)}`,
      { signal: controller.signal }
    )
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setPreviewSeries(data.indicator || null);
      })
      .catch(() => {
        if (!controller.signal.aborted) setPreviewSeries(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setPreviewLoading(false);
      });

    return () => controller.abort();
  }, [selectedItem, country]);

  const totalPages = Math.max(1, Math.ceil(total / 25));

  return (
    <div className="space-y-6">
      <section className="pb-5 border-b border-slate-200 space-y-2">
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          World Development Indicators Catalog
        </h1>
        <p className="text-sm text-slate-500">
          Search across {catalogTotal ? catalogTotal.toLocaleString('en-US') : '1,490+'} official World Bank public indicators and fetch live series for{' '}
          <span className="font-semibold text-slate-800">{country?.name || 'selected country'}</span>.
        </p>
      </section>

      {/* Search & Topic Bar */}
      <section className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search any indicator (e.g., external debt, tariff, renewable, research, fertility, exports)..."
            aria-label="Search all World Bank indicators"
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-700"
          />
        </div>

        <select
          value={topic}
          onChange={(e) => {
            setTopic(e.target.value);
            setPage(1);
          }}
          aria-label="Filter catalog by topic"
          className="sm:w-64 px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:border-blue-700"
        >
          <option value="all">All Topics</option>
          {topics.map((t) => (
            <option key={t} value={t.toLowerCase()}>
              {t}
            </option>
          ))}
        </select>
      </section>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Selected Indicator Live Preview */}
      {selectedItem && (
        <section className="bg-white border border-blue-200 rounded-lg p-5 sm:p-6 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <div className="space-y-1 max-w-3xl">
              <div className="text-xs font-mono text-blue-700">{selectedItem.id}</div>
              <h2 className="font-display text-lg font-semibold text-slate-900">
                {selectedItem.name}
              </h2>
              {selectedItem.sourceNote && (
                <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">
                  {selectedItem.sourceNote}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {previewSeries && (
                <button
                  type="button"
                  onClick={() => onPlotInOverview(previewSeries)}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 whitespace-nowrap"
                >
                  Open in Country Overview
                </button>
              )}
              <button
                type="button"
                onClick={() => onOpenRankingsFor(selectedItem.id)}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 whitespace-nowrap"
              >
                <span>Global Rankings</span>
                <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <TimeSeriesChart
            seriesList={[
              {
                id: selectedItem.id,
                label: country?.name || 'Country',
                color: '#1D4ED8',
                points: previewSeries?.points || [],
              },
            ]}
            format={inferCatalogFormat(selectedItem.name, selectedItem.unit)}
            loading={previewLoading}
            height={250}
          />
        </section>
      )}

      {/* Catalog Results Table */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing {items.length} of {total.toLocaleString('en-US')} matching indicators
          </span>
          <span className="font-mono">
            Page {page} / {totalPages}
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} className="h-12 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No indicators found matching &ldquo;{debouncedQuery}&rdquo;.
            </div>
          ) : (
            items.map((item) => {
              const isSelected = selectedItem?.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedItem(item)}
                  className={`w-full text-left px-5 py-3.5 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                    isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="text-sm font-medium text-slate-900">{item.name}</div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono text-slate-600">{item.id}</span>
                      {item.topics.length > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{item.topics.join(', ')}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-medium text-blue-700 shrink-0 whitespace-nowrap">
                    {isSelected
                      ? previewSeries
                        ? `Latest: ${formatIndicatorValue(
                            previewSeries.latestValue,
                            inferCatalogFormat(item.name, item.unit)
                          )}`
                        : 'Selected'
                      : `Inspect for ${country?.id || 'Country'}`}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-md text-slate-700 hover:bg-slate-100 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-md text-slate-700 hover:bg-slate-100 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
