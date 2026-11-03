"use client";
import { donutArcs, type DonutSegment } from "@finx/ui-kit";

/** A ring chart, with the selected arc raised and the others dimmed. Selection is made from the legend (buttons) or by clicking the ring. */
export function Donut({ segments, size = 168, thickness = 20, centerTop, centerSub, selected, onSelect, label }: { segments: DonutSegment[]; size?: number; thickness?: number; centerTop: string; centerSub?: string; selected: number | null; onSelect: (i: number | null) => void; label: string }) {
  const ring = donutArcs(segments, size, thickness);
  return (
    <div className="fx-donut" style={{ inlineSize: size, blockSize: size }}>
      <svg width={size} height={size} role="img" aria-label={`${label}. ${centerTop} ${centerSub ?? ""}. ${segments.map((s) => `${s.label} ${s.value}`).join(", ")}`}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={ring.R} className="fx-donut-track" strokeWidth={thickness} fill="none" />
          {ring.arcs.map(({ segment: s, index: i, dasharray, offset }) => (
            <circle key={i} cx={size / 2} cy={size / 2} r={ring.R} stroke={s.color} strokeWidth={selected === i ? thickness + 6 : thickness} fill="none" strokeLinecap="round" strokeDasharray={dasharray} strokeDashoffset={offset}
              opacity={selected == null || selected === i ? 1 : 0.35} onClick={() => onSelect(selected === i ? null : i)} style={{ cursor: "pointer" }} />
          ))}
        </g>
      </svg>
      <div className="fx-donut-center" aria-hidden><b style={{ fontSize: size / 6.2 }}>{centerTop}</b>{centerSub ? <small>{centerSub}</small> : null}</div>
    </div>
  );
}
