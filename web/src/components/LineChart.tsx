import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { daysBetween, formatShortDate } from "../../../shared/dates";

export interface ChartPoint {
  date: string;
  value: number;
}

interface Props {
  points: ChartPoint[];
  formatValue: (v: number) => string;
  /** Accessible description of what is plotted */
  label: string;
  height?: number;
  /** Optional dashed target line (e.g. weight goal) */
  target?: { value: number; label: string } | null;
}

function niceStep(range: number, ticks: number): number {
  const raw = range / Math.max(1, ticks);
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * pow;
}

/** Single-series line chart with crosshair tooltip (pointer, touch and keyboard). */
export function LineChart({ points, formatValue, label, height = 190, target = null }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(200, Math.round(entry!.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const geo = useMemo(() => {
    const pad = { top: 16, right: 46, bottom: 24, left: 38 };
    const values = points.map((p) => p.value);
    if (target) values.push(target.value);
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (min === max) {
      min -= 1;
      max += 1;
    }
    const step = niceStep(max - min, 3);
    min = Math.floor(min / step) * step;
    max = Math.ceil(max / step) * step;
    const ticks: number[] = [];
    for (let v = min; v <= max + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);

    const first = points[0]?.date ?? "";
    const span = Math.max(1, points.length > 1 ? daysBetween(first, points[points.length - 1]!.date) : 1);
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;
    const x = (date: string) =>
      points.length === 1 ? pad.left + innerW / 2 : pad.left + (daysBetween(first, date) / span) * innerW;
    const y = (v: number) => pad.top + (1 - (v - min) / (max - min)) * innerH;
    const xy = points.map((p) => ({ ...p, x: x(p.date), y: y(p.value) }));
    return { pad, ticks, xy, y, innerH, bottom: pad.top + innerH };
  }, [points, width, height, target]);

  if (points.length === 0) return null;

  const path = geo.xy.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const area = `${path} L${geo.xy[geo.xy.length - 1]!.x.toFixed(1)} ${geo.bottom} L${geo.xy[0]!.x.toFixed(1)} ${geo.bottom} Z`;
  const last = geo.xy[geo.xy.length - 1]!;
  const showMarkers = points.length <= 16;
  const activePoint = active !== null ? geo.xy[active] : null;

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    let best = 0;
    for (let i = 1; i < geo.xy.length; i++) {
      if (Math.abs(geo.xy[i]!.x - px) < Math.abs(geo.xy[best]!.x - px)) best = i;
    }
    setActive(best);
  };

  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === "ArrowRight") setActive((a) => Math.min(geo.xy.length - 1, (a ?? -1) + 1));
    else if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? geo.xy.length) - 1));
    else if (e.key === "Escape") setActive(null);
  };

  // X labels: first, last and (if room) middle.
  const xLabels = geo.xy.length > 2 && width > 300 ? [0, Math.floor((geo.xy.length - 1) / 2), geo.xy.length - 1] : [0, geo.xy.length - 1];

  return (
    <div className="chart" ref={wrapRef}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${label}: ${points.length} valori, da ${formatValue(points[0]!.value)} a ${formatValue(last.value)}`}
        tabIndex={0}
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={() => setActive(null)}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
        style={{ outline: "none" }}
      >
        {geo.ticks.map((t) => (
          <g key={t}>
            <line x1={geo.pad.left} x2={width - geo.pad.right + 8} y1={geo.y(t)} y2={geo.y(t)} stroke="var(--chart-grid)" strokeWidth="1" />
            <text x={geo.pad.left - 8} y={geo.y(t) + 4} textAnchor="end">
              {t.toLocaleString("it-IT")}
            </text>
          </g>
        ))}
        {xLabels
          .filter((v, i, a) => a.indexOf(v) === i)
          .map((i) => {
            const p = geo.xy[i]!;
            return (
              <text key={p.date} x={p.x} y={height - 6} textAnchor={i === 0 && geo.xy.length > 1 ? "start" : i === geo.xy.length - 1 && geo.xy.length > 1 ? "end" : "middle"}>
                {formatShortDate(p.date)}
              </text>
            );
          })}

        {target ? (
          <g>
            <line
              x1={geo.pad.left}
              x2={width - geo.pad.right + 8}
              y1={geo.y(target.value)}
              y2={geo.y(target.value)}
              stroke="var(--good)"
              strokeWidth="1.5"
              strokeDasharray="5 5"
            />
            <text x={geo.pad.left + 6} y={geo.y(target.value) - 6} style={{ fill: "var(--good-ink)", fontWeight: 800 }}>
              🎯 {target.label} {formatValue(target.value)}
            </text>
          </g>
        ) : null}

        <path d={area} fill="var(--chart-series)" opacity="0.1" />
        <path d={path} fill="none" stroke="var(--chart-series)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {activePoint ? (
          <line x1={activePoint.x} x2={activePoint.x} y1={geo.pad.top - 6} y2={geo.bottom} stroke="var(--ink-3)" strokeWidth="1" />
        ) : null}

        {geo.xy.map((p, i) =>
          showMarkers || i === geo.xy.length - 1 || i === active ? (
            <circle
              key={p.date}
              cx={p.x}
              cy={p.y}
              r={i === active ? 6 : 4}
              fill="var(--chart-series)"
              stroke="var(--surface)"
              strokeWidth="2"
            />
          ) : null,
        )}

        <text className="end-label" x={last.x + 9} y={last.y + 4}>
          {formatValue(last.value)}
        </text>
      </svg>
      {activePoint ? (
        <div className="chart-tip" style={{ left: Math.min(Math.max(activePoint.x, 60), width - 60), top: activePoint.y - 8 }}>
          <b>{formatValue(activePoint.value)}</b>
          <span>{formatShortDate(activePoint.date)}</span>
        </div>
      ) : null}
    </div>
  );
}
