"use client";
import { useMemo } from "react";
import { accentProblem, brandDefs, resolveBrand, type Preset } from "@finx/ui-kit";

/** What the app will look like, drawn from the real theme the choices produce. */
export function MockPhone({ name, preset, accent, dark }: { name: string; preset: Preset; accent: string; dark?: boolean }) {
  const ok = !accentProblem(accent);
  const brand = useMemo(() => resolveBrand("preview", { ...brandDefs[preset]!, name: name || "Your bank", accent: ok ? accent : brandDefs[preset]!.accent }), [preset, accent, ok, name]);
  const c = (dark ? brand.dark : brand.light).colors as Record<string, string>;
  const r = brand.radius;
  const fx = preset === "bankworkx";
  return (
    <div className="mock" aria-label="Preview of the app">
      <div className="scr" style={{ background: c.bg, color: c.text, fontFamily: "var(--font)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 28, height: 28, borderRadius: 14, background: c.accent, color: c.accentOn, display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700 }}>{(name || "Y").slice(0, 1).toUpperCase()}</span>
          <div style={{ fontSize: 11, lineHeight: 1.2 }}><div style={{ color: c.textMuted }}>Welcome back</div><b style={{ fontSize: 13 }}>{name || "Your bank"}</b></div>
        </div>
        <div style={{ borderRadius: r.xl - 8, padding: 14, color: fx ? "#fff" : c.accentOn, background: fx ? `linear-gradient(135deg, ${c.heroFrom}, ${c.heroTo})` : c.accent }}>
          <div style={{ fontSize: 10, opacity: 0.85 }}>Total balance</div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>{brand.currency === "PKR" ? "PKR " : "$"}12,480.00</div>
          <div style={{ display: "flex", gap: 4, marginTop: 8 }}>{["1W", "1M", "3M"].map((x, i) => <span key={x} style={{ fontSize: 9, padding: "2px 7px", borderRadius: 99, background: i === 1 ? "#fff" : "rgba(255,255,255,.2)", color: i === 1 ? c.accent : "inherit", fontWeight: 700 }}>{x}</span>)}</div>
        </div>
        {[["Groceries", "-$86.50", c.negative], ["Salary", "+$3,200", c.positive]].map(([t, a, col]) => (
          <div key={t} style={{ display: "flex", alignItems: "center", gap: 8, background: c.surface, borderRadius: r.md, padding: 8, boxShadow: "0 1px 2px rgba(0,0,0,.06)" }}>
            <span style={{ width: 24, height: 24, borderRadius: 8, background: c.accentSoft }} />
            <span style={{ flex: 1, fontSize: 11, fontWeight: 600 }}>{t}</span><span style={{ fontSize: 11, fontWeight: 700, color: col }}>{a}</span>
          </div>
        ))}
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ flex: 1, textAlign: "center", padding: "9px 0", borderRadius: r.md, background: c.accent, color: c.accentOn, fontSize: 12, fontWeight: 700 }}>Add money</span>
          {fx ? <span style={{ width: 34, height: 34, borderRadius: 17, background: c.fab, color: c.fabOn, display: "grid", placeItems: "center", fontWeight: 800 }}>+</span> : null}
        </div>
      </div>
    </div>
  );
}
