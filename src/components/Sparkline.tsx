import type { TimeSeriesPoint } from '../data/indicators';

type SparklineProps = {
  points: TimeSeriesPoint[];
  stroke?: string;
};

export function Sparkline({ points, stroke = '#1D4ED8' }: SparklineProps) {
  const recent = points.slice(-15);
  if (recent.length < 2) {
    return <span className="text-xs text-slate-300 font-mono">—</span>;
  }

  const width = 92;
  const height = 24;
  const padY = 3;
  const values = recent.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const coords = recent.map((p, idx) => {
    const x = (idx / (recent.length - 1)) * (width - 4) + 2;
    const y = height - padY - ((p.value - min) / range) * (height - padY * 2);
    return { x, y };
  });

  const pathD = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(' ');
  const last = coords[coords.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="inline-block overflow-visible"
      aria-hidden="true"
    >
      {min < 0 && max > 0 && (
        <line
          x1={0}
          x2={width}
          y1={height - padY - ((0 - min) / range) * (height - padY * 2)}
          y2={height - padY - ((0 - min) / range) * (height - padY * 2)}
          stroke="#CBD5E1"
          strokeWidth={1}
          strokeDasharray="2 2"
        />
      )}
      <path d={pathD} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={last.x} cy={last.y} r={2.2} fill={stroke} />
    </svg>
  );
}
