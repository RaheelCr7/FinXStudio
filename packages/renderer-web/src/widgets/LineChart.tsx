"use client";
import { useEffect, useId, useRef, useState } from "react";
import { lineGeometry, nearestIndex, type ChartPoint } from "@finx/ui-kit";

/**
 * A smooth line chart you can read by moving the pointer across it, or with the left and right arrow keys.
 * The numbers come from @finx/ui-kit (shared with the phone app); this only draws them. A text summary is available to screen readers.
 */
export function LineChart({ data, height = 150, format, label, tone = "accent" }: { data: ChartPoint[]; height?: number; format: (p: ChartPoint) => string; label: string; tone?: "accent" | "light" }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const [at, setAt] = useState<number | null>(null);
  const id = useId().replace(/:/g, "");
  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el); setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  if (data.length < 2) return <div className="fx-chart" ref={box} style={{ blockSize: height }} />;
  const idx = Math.min(data.length - 1, Math.max(0, at ?? data.length - 1));
  const g = lineGeometry(data, w, height);
  const sel = g.pts[idx];
  const first = data[0]!, last = data[data.length - 1]!;
  const hi = data.reduce((m, p) => (p.value > m.value ? p : m)), lo = data.reduce((m, p) => (p.value < m.value ? p : m));
  const move = (clientX: number) => {
    const r = box.current!.getBoundingClientRect();
    const dir = getComputedStyle(box.current!).direction === "rtl";
    setAt(nearestIndex(dir ? r.right - clientX : clientX - r.left, w, data.length));
  };
  return (
    <div className={`fx-chart fx-chart-${tone}`} ref={box} style={{ blockSize: height }} tabIndex={0} role="group" aria-roledescription="chart" aria-label={`${label}. ${format(first)} to ${format(last)}. Highest ${format(hi)} (${hi.label}), lowest ${format(lo)} (${lo.label}). Use the arrow keys to read each point.`}
      onPointerMove={(e) => move(e.clientX)} onPointerDown={(e) => move(e.clientX)} onPointerLeave={() => setAt(null)} onBlur={() => setAt(null)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); const dir = e.key === "ArrowRight" ? 1 : -1; const rtl = getComputedStyle(box.current!).direction === "rtl"; setAt(Math.min(data.length - 1, Math.max(0, idx + (rtl ? -dir : dir)))); }
        if (e.key === "Home") setAt(0); if (e.key === "End") setAt(data.length - 1);
      }}>
      {w > 0 ? (
        <svg width={w} height={height} aria-hidden focusable="false">
          <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity={0.28} /><stop offset="1" stopColor="currentColor" stopOpacity={0} /></linearGradient></defs>
          <path d={g.area} fill={`url(#${id})`} />
          <path d={g.line} stroke="currentColor" strokeWidth={2.5} fill="none" strokeLinecap="round" />
          {sel ? <g><line x1={sel.x} x2={sel.x} y1={0} y2={height} stroke="currentColor" strokeOpacity={0.25} strokeWidth={1} strokeDasharray="3 4" /><circle cx={sel.x} cy={sel.y} r={9} fill="currentColor" fillOpacity={0.18} /><circle cx={sel.x} cy={sel.y} r={5} className="fx-chart-dot" strokeWidth={3} stroke="currentColor" /></g> : null}
        </svg>
      ) : null}
      {sel ? <div className="fx-chart-tip" aria-live="polite" style={{ insetBlockStart: Math.max(0, sel.y - 48), insetInlineStart: `clamp(0px, ${sel.x - 56}px, ${Math.max(0, w - 112)}px)` }}><small>{data[idx]!.label}</small><b>{format(data[idx]!)}</b></div> : null}
    </div>
  );
}
