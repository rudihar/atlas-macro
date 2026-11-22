import { Download } from 'lucide-react';

export type WorkspaceView = 'overview' | 'compare' | 'rankings' | 'catalog';

type HeaderProps = {
  activeView: WorkspaceView;
  onSelectView: (view: WorkspaceView) => void;
  onExportCsv: () => void;
  canExport: boolean;
};

const NAV_ITEMS: Array<{ id: WorkspaceView; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'compare', label: 'Compare' },
  { id: 'rankings', label: 'World Rankings' },
  { id: 'catalog', label: 'Indicator Catalog' },
];

export function Header({ activeView, onSelectView, onExportCsv, canExport }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-8">
      <button
        type="button"
        onClick={() => onSelectView('overview')}
        className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      >
        Atlas Macro
      </button>

      <nav
        aria-label="Primary workspaces"
        className="flex items-center gap-5 sm:gap-7 overflow-x-auto no-scrollbar"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectView(item.id)}
              className={`relative py-5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
                isActive
                  ? 'text-slate-900 font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-700"
                />
              )}
            </button>
          );
        })}
      </nav>

      <div className="shrink-0">
        <button
          type="button"
          onClick={onExportCsv}
          disabled={!canExport}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          <Download className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Export CSV</span>
        </button>
      </div>
    </header>
  );
}
