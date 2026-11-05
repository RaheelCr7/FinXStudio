"use client";
import { LOOKS, type LookCheck } from "@finx/ui-kit";

export type Mood = { roundness: number; density: number };
export const SWATCHES = ["#3155CE", "#0F6E56", "#7C3AED", "#BE185D", "#B45309", "#0E7490", "#1D4ED8", "#9F1239"];

/**
 * The look step: pick a ready-made look, set the brand colour, tune roundness and density, and read the accessibility report.
 * A controlled component; the new-project wizard and the Design area's Personal and Business tabs both draw it, each keeping their own draft.
 */
export function LookEditor({ lookId, accent, accentErr, mood, defaultRoundness, checks, onLook, onAccent, onMood }: {
  /** The ready-made look that is picked, or null when the look has been tuned by hand or came from elsewhere. */
  lookId: string | null; accent: string; accentErr: string | null; mood: Mood | null; defaultRoundness: number; checks: LookCheck[];
  onLook: (id: string) => void; onAccent: (hex: string) => void; onMood: (m: Mood | null) => void;
}) {
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="looks">
        {LOOKS.map((l) => (
          <button key={l.id} className="preset-card" aria-pressed={lookId === l.id} onClick={() => onLook(l.id)}>
            <span style={{ display: "flex", gap: 4 }}><i style={{ width: 22, height: 10, borderRadius: Math.min(l.radius?.md ?? 12, 6), background: l.accent }} /><i style={{ width: 14, height: 10, borderRadius: Math.min(l.radius?.md ?? 12, 6), background: l.look?.pageBg ?? "var(--border-strong)" }} /></span>
            <b>{l.name}</b><span className="muted" style={{ fontSize: 12.5 }}>{l.description}</span>
          </button>
        ))}
      </div>
      <div className="field">Brand colour
        <div className="row" style={{ marginTop: 6 }}>
          <input aria-label="Pick a colour" type="color" value={/^#[0-9a-fA-F]{6}$/.test(accent) ? accent : "#3155CE"} onChange={(e) => onAccent(e.target.value.toUpperCase())} style={{ width: 44, height: 38, border: 0, background: "none", padding: 0 }} />
          <input aria-label="Colour code" className="input mono" style={{ width: 120 }} value={accent} onChange={(e) => onAccent(e.target.value.toUpperCase())} />
        </div>
        <div className="swatches" style={{ marginTop: 8 }}>{SWATCHES.map((sw) => <button key={sw} className="swatch" aria-label={`Use ${sw}`} aria-pressed={accent.toUpperCase() === sw} style={{ background: sw }} onClick={() => onAccent(sw)} />)}</div>
        {accentErr ? <div role="alert" style={{ color: "var(--negative)", fontSize: 13, marginTop: 6 }}>{accentErr}</div> : null}
      </div>
      <div className="field">Feel
        <label className="row" style={{ gap: 10, marginTop: 6 }}><span style={{ width: 90 }}>Roundness</span>
          <input type="range" min={0} max={28} value={mood?.roundness ?? defaultRoundness} aria-label="Roundness" onChange={(e) => onMood({ roundness: +e.target.value, density: mood?.density ?? 50 })} style={{ flex: 1 }} /><span className="faint mono">{mood?.roundness ?? defaultRoundness}px</span></label>
        <label className="row" style={{ gap: 10 }}><span style={{ width: 90 }}>Density</span>
          <input type="range" min={0} max={100} value={mood?.density ?? 50} aria-label="Density" onChange={(e) => onMood({ roundness: mood?.roundness ?? defaultRoundness, density: +e.target.value })} style={{ flex: 1 }} /><span className="faint">{(mood?.density ?? 50) < 35 ? "Compact" : (mood?.density ?? 50) > 65 ? "Comfortable" : "Balanced"}</span></label>
        {mood ? <button className="btn sm" style={{ alignSelf: "flex-start", marginTop: 4 }} onClick={() => onMood(null)}>Back to this look&rsquo;s own sizes</button> : null}
      </div>
      <div className="card" style={{ gap: 6, boxShadow: "none" }}>
        <b>Accessibility</b>
        {checks.map((c) => <div key={c.id} className="row" style={{ gap: 8, fontSize: 13 }}><span className={`chip ${c.ok ? "pos" : "neg"}`}>{c.ok ? "Pass" : "Fix"}</span><span style={{ flex: 1 }}>{c.label}</span><span className="faint mono">{c.value}</span></div>)}
        {checks.filter((c) => !c.ok).map((c) => <div key={c.id} className="faint">{c.label}: {c.fix}</div>)}
      </div>
    </div>
  );
}
