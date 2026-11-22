import type { IndicatorFormat, IndicatorSeries } from '../data/indicators';

export function iso2ToFlagEmoji(iso2: string): string {
  if (!iso2 || iso2.length !== 2) return '';
  const code = iso2.toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(
    0x1f1e6 + code.charCodeAt(0) - 65,
    0x1f1e6 + code.charCodeAt(1) - 65
  );
}

export function formatIndicatorValue(
  value: number | null | undefined,
  format: IndicatorFormat = 'numberCompact'
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }

  switch (format) {
    case 'currencyCompact': {
      const abs = Math.abs(value);
      const sign = value < 0 ? '-' : '';
      if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
      if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
      if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
      if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
      return `${sign}$${abs.toFixed(0)}`;
    }
    case 'currencyExact': {
      const sign = value < 0 ? '-' : '';
      const abs = Math.abs(value);
      return `${sign}$${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    }
    case 'percent': {
      return `${value.toFixed(2)}%`;
    }
    case 'rate': {
      if (Math.abs(value) >= 1000) return value.toLocaleString('en-US', { maximumFractionDigits: 1 });
      if (Math.abs(value) >= 10) return value.toFixed(2);
      return value.toFixed(3);
    }
    case 'index': {
      return value.toFixed(1);
    }
    case 'numberCompact':
    default: {
      const abs = Math.abs(value);
      const sign = value < 0 ? '-' : '';
      if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
      if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M`;
      if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`;
      if (Number.isInteger(abs)) return `${sign}${abs.toLocaleString('en-US')}`;
      return `${sign}${abs.toFixed(2)}`;
    }
  }
}

export function formatDelta(
  series: IndicatorSeries | undefined,
  format: IndicatorFormat
): { text: string; direction: 'up' | 'down' | 'flat' } {
  if (!series || series.deltaAbsolute === null || series.previousYear === null) {
    return { text: 'No prior yr', direction: 'flat' };
  }

  const diff = series.deltaAbsolute;
  if (Math.abs(diff) < 1e-6) {
    return { text: `0.0 vs ${series.previousYear}`, direction: 'flat' };
  }

  const arrow = diff > 0 ? '▲' : '▼';
  const direction = diff > 0 ? 'up' : 'down';

  if (format === 'percent' || format === 'index') {
    const sign = diff > 0 ? '+' : '';
    const unitSuffix = format === 'percent' ? 'pp' : 'pt';
    return {
      text: `${arrow} ${sign}${diff.toFixed(2)}${unitSuffix} vs ${series.previousYear}`,
      direction,
    };
  }

  if (series.deltaPercent !== null && Number.isFinite(series.deltaPercent)) {
    const sign = series.deltaPercent > 0 ? '+' : '';
    return {
      text: `${arrow} ${sign}${series.deltaPercent.toFixed(1)}% vs ${series.previousYear}`,
      direction,
    };
  }

  return {
    text: `${arrow} ${formatIndicatorValue(diff, format)} vs ${series.previousYear}`,
    direction,
  };
}

export function inferCatalogFormat(name: string, unit: string): IndicatorFormat {
  const lower = `${name} ${unit}`.toLowerCase();
  if (lower.includes('%') || lower.includes('percent')) return 'percent';
  if (lower.includes('current us$') || lower.includes('constant 2015 us$') || lower.includes('us$')) {
    if (lower.includes('per capita') || lower.includes('per person')) return 'currencyExact';
    return 'currencyCompact';
  }
  if (lower.includes('index')) return 'index';
  if (lower.includes('exchange rate')) return 'rate';
  return 'numberCompact';
}

export function downloadCsv(filename: string, rows: string[][]): void {
  const csvContent = rows
    .map((row) =>
      row
        .map((cell) => {
          const str = String(cell ?? '');
          if (/[",\n]/.test(str)) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(',')
    )
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
