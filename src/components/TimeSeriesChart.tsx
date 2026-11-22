import { useMemo, useState } from 'react';
import type { IndicatorFormat, TimeSeriesPoint } from '../data/indicators';
import { formatIndicatorValue } from '../utils/format';

export type ChartSeriesInput = {
  id: string;
  label: string;
  color: string;
  points: TimeSeriesPoint[];
};

type TimeSeriesChartProps = {
  seriesList: ChartSeriesInput[];
  format: IndicatorFormat;
  chartType?: 'line' | 'bar';
  indexed?: boolean;
  height?: number;
  loading?: boolean;
};

function computeTicks(minVal: number, maxVal: number, count = 5): number[] {
  if (minVal === maxVal) {
    const base = minVal === 0 ? 1 : Math.abs(minVal) * 0.2;
    return [minVal - base, minVal, minVal + base];
  }
  const rawStep = (maxVal - minVal) / (count - 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  let niceFactor = 1;
  if (normalized > 5) niceFactor = 10;
  else if (normalized > 2) niceFactor = 5;
  else if (normalized > 1) niceFactor = 2;

  const step = niceFactor * magnitude;
  const niceMin = Math.floor(minVal / step) * step;
  const niceMax = Math.ceil(maxVal / step) * step;

  const ticks: number[] = [];
  for (let val = niceMin; val <= niceMax + step * 0.1; val += step) {
    ticks.push(Number(val.toPrecision(10)));
  }
  return ticks;
}

export function TimeSeriesChart({
  seriesList,
  format,
  chartType = 'line',
  indexed = false,
  height = 310,
  loading = false,
}: TimeSeriesChartProps) {
  const [hoverYear, setHoverYear] = useState<number | null>(null);

  const normalizedSeries = useMemo(() => {
    if (!indexed) return seriesList;
    return seriesList.map((s) => {
      const sorted = [...s.points].sort((a, b) => a.year - b.year);
      const basePoint = sorted.find((p) => p.value !== 0);
      if (!basePoint) return { ...s, points: [] };
      const baseVal = basePoint.value;
      return {
        ...s,
        points: sorted.map((p) => ({
          year: p.year,
          value: (p.value / baseVal) * 100,
        })),
      };
    });
  }, [seriesList, indexed]);

  const effectiveFormat: IndicatorFormat = indexed ? 'index' : format;

  const { years, minYear, maxYear, ticks, yMin, yMax } = useMemo(() => {
    const yearSet = new Set<number>();
    const allValues: number[] = [];

    normalizedSeries.forEach((s) => {
      s.points.forEach((p) => {
        yearSet.add(p.year);
        allValues.push(p.value);
      });
    });

    const sortedYears = Array.from(yearSet).sort((a, b) => a - b);
    if (sortedYears.length === 0 || allValues.length === 0) {
      return {
        years: [] as number[],
        minYear: 2000,
        maxYear: 2025,
        ticks: [0, 50, 100],
        yMin: 0,
        yMax: 100,
      };
    }

    let rawMin = Math.min(...allValues);
    let rawMax = Math.max(...allValues);
    if (chartType === 'bar' && rawMin > 0) {
      rawMin = 0;
    }

    const computedTicks = computeTicks(rawMin, rawMax, 5);
    return {
      years: sortedYears,
      minYear: sortedYears[0],
      maxYear: sortedYears[sortedYears.length - 1],
      ticks: computedTicks,
      yMin: computedTicks[0],
      yMax: computedTicks[computedTicks.length - 1],
    };
  }, [normalizedSeries, chartType]);

  if (loading) {
    return (
      <div
        style={{ height }}
        className="w-full rounded-md bg-slate-50 border border-slate-100 animate-pulse flex items-center justify-center"
      >
        <span className="text-xs font-mono text-slate-400">Loading time series...</span>
      </div>
    );
  }

  if (years.length === 0) {
    return (
      <div
        style={{ height }}
        className="w-full rounded-md bg-slate-50 border border-slate-100 flex items-center justify-center px-6 text-center"
      >
        <p className="text-sm text-slate-500">
          No historical observations available for this indicator in the selected timeframe.
        </p>
      </div>
    );
  }

  const svgWidth = 860;
  const svgHeight = height;
  const margin = { top: 18, right: 20, bottom: 32, left: 74 };
  const plotW = svgWidth - margin.left - margin.right;
  const plotH = svgHeight - margin.top - margin.bottom;

  const yearSpan = Math.max(1, maxYear - minYear);
  const valueSpan = Math.max(1e-9, yMax - yMin);

  const getX = (year: number) =>
    years.length === 1
      ? margin.left + plotW / 2
      : margin.left + ((year - minYear) / yearSpan) * plotW;

  const getY = (val: number) =>
    margin.top + plotH - ((val - yMin) / valueSpan) * plotH;

  const zeroY = yMin <= 0 && yMax >= 0 ? getY(0) : null;

  const xStep = Math.max(1, Math.ceil(years.length / 8));
  const xTicks = years.filter((_, idx) => idx % xStep === 0 || idx === years.length - 1);

  const handlePointerMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * svgWidth;
    if (relX < margin.left - 12 || relX > svgWidth - margin.right + 12) {
      setHoverYear(null);
      return;
    }

    let closest = years[0];
    let minDist = Infinity;
    for (const yr of years) {
      const dist = Math.abs(getX(yr) - relX);
      if (dist < minDist) {
        minDist = dist;
        closest = yr;
      }
    }
    setHoverYear(closest);
  };

  const activePoints =
    hoverYear !== null
      ? normalizedSeries
          .map((s) => ({
            ...s,
            point: s.points.find((p) => p.year === hoverYear) || null,
          }))
          .filter((item) => item.point !== null)
      : [];

  const primarySeries = normalizedSeries[0];
  const barWidth = Math.max(4, Math.min(26, (plotW / Math.max(years.length, 1)) * 0.65));

  return (
    <div className="relative w-full select-none">
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full h-auto block overflow-visible"
        onMouseMove={handlePointerMove}
        onMouseLeave={() => setHoverYear(null)}
        role="img"
        aria-label="Economic indicator time series chart"
      >
        <defs>
          <linearGradient id="atlas-area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1D4ED8" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {ticks.map((tick) => {
          const y = getY(tick);
          return (
            <g key={tick}>
              <line
                x1={margin.left}
                x2={svgWidth - margin.right}
                y1={y}
                y2={y}
                stroke="#E2E8F0"
                strokeWidth={1}
              />
              <text
                x={margin.left - 10}
                y={y + 4}
                textAnchor="end"
                className="fill-slate-500 font-mono text-[11px] tabular-nums"
              >
                {formatIndicatorValue(tick, effectiveFormat)}
              </text>
            </g>
          );
        })}

        {zeroY !== null && (
          <line
            x1={margin.left}
            x2={svgWidth - margin.right}
            y1={zeroY}
            y2={zeroY}
            stroke="#94A3B8"
            strokeWidth={1.2}
            strokeDasharray="4 3"
          />
        )}

        {xTicks.map((yr) => {
          const x = getX(yr);
          return (
            <text
              key={yr}
              x={x}
              y={svgHeight - 8}
              textAnchor="middle"
              className="fill-slate-500 font-mono text-[11px] tabular-nums"
            >
              {yr}
            </text>
          );
        })}

        {chartType === 'bar' && normalizedSeries.length === 1 && primarySeries ? (
          primarySeries.points.map((p) => {
            const x = getX(p.year) - barWidth / 2;
            const baselineY = zeroY !== null ? zeroY : getY(yMin);
            const valY = getY(p.value);
            const rectY = Math.min(valY, baselineY);
            const rectH = Math.max(1.5, Math.abs(baselineY - valY));
            const isHovered = hoverYear === p.year;
            return (
              <rect
                key={p.year}
                x={x}
                y={rectY}
                width={barWidth}
                height={rectH}
                rx={2}
                fill={p.value < 0 ? '#B91C1C' : primarySeries.color}
                opacity={hoverYear === null || isHovered ? 0.9 : 0.45}
              />
            );
          })
        ) : (
          <>
            {normalizedSeries.length === 1 && primarySeries && primarySeries.points.length > 1 && (
              <path
                d={`${primarySeries.points
                  .map(
                    (p, idx) =>
                      `${idx === 0 ? 'M' : 'L'}${getX(p.year).toFixed(1)},${getY(p.value).toFixed(1)}`
                  )
                  .join(' ')} L${getX(primarySeries.points[primarySeries.points.length - 1].year).toFixed(
                  1
                )},${(zeroY !== null ? zeroY : margin.top + plotH).toFixed(1)} L${getX(
                  primarySeries.points[0].year
                ).toFixed(1)},${(zeroY !== null ? zeroY : margin.top + plotH).toFixed(1)} Z`}
                fill="url(#atlas-area-grad)"
              />
            )}

            {normalizedSeries.map((series) => {
              if (series.points.length === 0) return null;
              const sorted = [...series.points].sort((a, b) => a.year - b.year);
              const linePath = sorted
                .map(
                  (p, idx) =>
                    `${idx === 0 ? 'M' : 'L'}${getX(p.year).toFixed(1)},${getY(p.value).toFixed(1)}`
                )
                .join(' ');
              const lastPt = sorted[sorted.length - 1];

              return (
                <g key={series.id}>
                  <path
                    d={linePath}
                    fill="none"
                    stroke={series.color}
                    strokeWidth={2.25}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {sorted.length === 1 && (
                    <circle
                      cx={getX(lastPt.year)}
                      cy={getY(lastPt.value)}
                      r={4}
                      fill={series.color}
                    />
                  )}
                </g>
              );
            })}
          </>
        )}

        {hoverYear !== null && (
          <g>
            <line
              x1={getX(hoverYear)}
              x2={getX(hoverYear)}
              y1={margin.top}
              y2={margin.top + plotH}
              stroke="#64748B"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            {activePoints.map((item) => (
              <circle
                key={item.id}
                cx={getX(hoverYear)}
                cy={getY(item.point!.value)}
                r={4.5}
                fill="#FFFFFF"
                stroke={item.color}
                strokeWidth={2.5}
              />
            ))}
          </g>
        )}
      </svg>

      {hoverYear !== null && activePoints.length > 0 && (
        <div
          className="pointer-events-none absolute top-2 right-3 bg-white/95 border border-slate-200 rounded-md px-3 py-2 shadow-sm min-w-[180px]"
        >
          <div className="font-mono text-xs font-semibold text-slate-500 mb-1 pb-1 border-b border-slate-100">
            {hoverYear}
          </div>
          <div className="space-y-1">
            {activePoints.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-slate-700 truncate max-w-[140px]">
                  <span
                    className="w-2.5 h-0.5 inline-block shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {formatIndicatorValue(item.point!.value, effectiveFormat)}
                  {indexed ? ' idx' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
