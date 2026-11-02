"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CircleAlert, Rocket } from "lucide-react";
import { PRESETS, accentProblem, brandDefs, resolveBrand, type Preset } from "@finx/ui-kit";
import { useProjects } from "./Projects";
import { buildCommands } from "./ProjectList";

export type Starter = { slug: string; name: string; apps: string[]; screens: number };
const CURRENCIES = ["USD", "EUR", "GBP", "PKR", "INR", "AED", "SAR", "CAD", "AUD"];
const SWATCHES = ["#3155CE", "#0F6E56", "#7C3AED", "#BE185D", "#B45309", "#0E7490", "#1D4ED8", "#9F1239"];
const slugOf = (n: string) => n.toLowerCase().trim().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
const suggestId = (n: string) => `com.${slugOf(n).replace(/-/g, "") || "yourbank"}.app`;

/** What the app will look like, drawn from the real theme the choices produce. */
function MockPhone({ name, preset, accent }: { name: string; preset: Preset; accent: string }) {
  const ok = !accentProblem(accent);
  const brand = useMemo(() => resolveBrand("preview", { ...brandDefs[preset]!, name: name || "Your bank", accent: ok ? accent : brandDefs[preset]!.accent }), [preset, accent, ok, name]);
  const c = brand.light.colors as Record<string, string>;
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

export function NewProjectWizard({ starters, onClose }: { starters: Starter[]; onClose: () => void }) {
  const router = useRouter();
  const { byId, setCurrent } = useProjects();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [bundleId, setBundleId] = useState("");
  const [idEdited, setIdEdited] = useState(false);
  const [currency, setCurrency] = useState("USD");
  const [preset, setPreset] = useState<Preset>("bankworkx");
  const [accent, setAccent] = useState(brandDefs.bankworkx!.accent);
  const [picked, setPicked] = useState<Record<string, boolean> | null>(null);
  const [publishNow, setPublishNow] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<null | { id: string; name: string; iconWarning?: string; started: string[]; failed: { slug: string; error: string }[] }>(null);
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => { first.current?.focus(); }, []);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [busy, onClose]);

  const id = slugOf(name);
  const appId = idEdited ? bundleId : suggestId(name);
  const accentErr = accentProblem(accent.toUpperCase());
  const candidates = useMemo(() => starters.filter((s) => s.apps.some((a) => byId(a)?.brand.preset === preset)), [starters, byId, preset]);
  const chosen = candidates.filter((s) => (picked ?? Object.fromEntries(candidates.map((c) => [c.slug, true])))[s.slug] !== false);

  const basicsErr = name.trim().length < 2 ? "Give the project a name" : byId(id) ? "A project with this name already exists" : !/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/.test(appId) ? "The app id must look like com.yourbank.app" : "";
  const canNext = step === 0 ? !basicsErr : step === 1 ? !accentErr : true;
  const choosePreset = (p: Preset) => { setPreset(p); if (accent.toUpperCase() === brandDefs[preset]!.accent.toUpperCase()) setAccent(brandDefs[p]!.accent); setPicked(null); };

  async function create() {
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), bundleId: appId, preset, accent: accent.toUpperCase(), currency, starters: chosen.map((s) => s.slug), publishStarters: publishNow }) });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? "Could not create the project"); setBusy(false); return; }
      setDone({ id: data.project.id, name: data.project.name, iconWarning: data.iconWarning, started: data.started, failed: data.failed });
    } catch { setErr("Cannot reach the server"); }
    setBusy(false);
  }

  const titles = ["Basics", "Look", "Starting journeys", "Review"];
  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy && !done) onClose(); }}>
      <div className="modal wiz" role="dialog" aria-label="New project">
        <div className="main">
          {done ? (
            <div className="stack" style={{ gap: 14 }}>
              <div className="row"><span className="chip pos"><Check size={13} aria-hidden />Created</span></div>
              <h2 style={{ margin: 0 }}>{done.name} is ready</h2>
              <p className="muted" style={{ margin: 0 }}>{done.started.length ? `${done.started.length} starting journey${done.started.length === 1 ? "" : "s"} copied${publishNow ? " and published" : " as drafts"}.` : "It starts empty. Add journeys in the Builder."}</p>
              {done.failed.length ? <div className="issue"><CircleAlert size={15} aria-hidden />{done.failed.length} could not be copied: {done.failed.map((f) => `${f.slug} (${f.error})`).join("; ")}</div> : null}
              {done.iconWarning ? <div className="faint">{done.iconWarning}</div> : null}
              <div className="label-section" style={{ margin: "4px 0" }}>Build the app</div>
              {buildCommands(done.id).map((c) => <div key={c.cmd}><div className="faint" style={{ marginBottom: 4 }}>{c.label}</div><div className="cmd"><code>{c.cmd}</code></div></div>)}
              <div className="row" style={{ marginTop: 8 }}>
                <div className="spacer" /><button className="btn" onClick={() => { onClose(); router.refresh(); }}>Close</button>
                <button className="btn primary" onClick={() => { setCurrent(done.id); router.push("/"); onClose(); }}>Open its journeys</button>
              </div>
            </div>
          ) : (
            <>
              <div className="steps" aria-hidden>{titles.map((_, i) => <i key={i} className={i <= step ? "on" : ""} />)}</div>
              <div className="faint" style={{ fontWeight: 600 }}>Step {step + 1} of 4 · {titles[step]}</div>
              <h2 style={{ margin: "2px 0 14px" }}>{["Name your bank app", "Choose the look", "Start with some journeys", "Ready to create?"][step]}</h2>

              {step === 0 ? (
                <div className="stack">
                  <label className="field">Project name<input ref={first} className="input" style={{ height: 40 }} placeholder="e.g. Acme Bank" value={name} onChange={(e) => setName(e.target.value)} /></label>
                  <label className="field">App id <span className="faint" style={{ fontWeight: 400 }}>(used by the App Store and Google Play; cannot change later)</span>
                    <input className="input mono" value={appId} onChange={(e) => { setIdEdited(true); setBundleId(e.target.value.toLowerCase()); }} /></label>
                  <label className="field">Currency<select className="select" value={currency} onChange={(e) => setCurrency(e.target.value)}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></label>
                  {name && basicsErr ? <div role="alert" style={{ color: "var(--negative)", fontSize: 13 }}>{basicsErr}</div> : null}
                </div>
              ) : null}

              {step === 1 ? (
                <div className="stack" style={{ gap: 16 }}>
                  <div className="row" style={{ alignItems: "stretch" }}>
                    {(Object.keys(PRESETS) as Preset[]).map((p) => (
                      <button key={p} className="preset-card" aria-pressed={preset === p} onClick={() => choosePreset(p)}>
                        <b>{PRESETS[p].name}</b><span className="muted" style={{ fontSize: 12.5 }}>{PRESETS[p].description}</span>
                      </button>
                    ))}
                  </div>
                  <div className="field">Brand colour
                    <div className="row" style={{ marginTop: 6 }}>
                      <input aria-label="Pick a colour" type="color" value={/^#[0-9a-fA-F]{6}$/.test(accent) ? accent : "#3155CE"} onChange={(e) => setAccent(e.target.value.toUpperCase())} style={{ width: 44, height: 38, border: 0, background: "none", padding: 0 }} />
                      <input aria-label="Colour code" className="input mono" style={{ width: 120 }} value={accent} onChange={(e) => setAccent(e.target.value.toUpperCase())} />
                    </div>
                    <div className="swatches" style={{ marginTop: 8 }}>{SWATCHES.map((s) => <button key={s} className="swatch" aria-label={`Use ${s}`} aria-pressed={accent.toUpperCase() === s} style={{ background: s }} onClick={() => setAccent(s)} />)}</div>
                    {accentErr ? <div role="alert" style={{ color: "var(--negative)", fontSize: 13, marginTop: 6 }}>{accentErr}</div> : <div className="faint" style={{ marginTop: 6 }}>Buttons, links and highlights use this. Dark mode gets a lighter version automatically.</div>}
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="stack" style={{ gap: 8 }}>
                  {candidates.length === 0 ? <div className="muted">There are no ready-made journeys for this look yet. You will start empty and build your own.</div> : (
                    <>
                      <div className="muted" style={{ fontSize: 13 }}>Copies of working journeys from another bank with the {PRESETS[preset].name.toLowerCase()} look. Edit them freely: the originals are not changed. Text and amounts keep the original currency until you edit them.</div>
                      {candidates.map((s) => {
                        const on = chosen.some((c) => c.slug === s.slug);
                        return (
                          <label key={s.slug} className="row" style={{ gap: 10, padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 10 }}>
                            <input type="checkbox" checked={on} onChange={(e) => setPicked({ ...Object.fromEntries(candidates.map((c) => [c.slug, true])), ...(picked ?? {}), [s.slug]: e.target.checked })} />
                            <span style={{ flex: 1, fontWeight: 600 }}>{s.name}</span><span className="faint">{s.screens} screens</span>
                          </label>
                        );
                      })}
                      <label className="row" style={{ gap: 8, fontSize: 13.5, marginTop: 4 }}><input type="checkbox" checked={publishNow} onChange={(e) => setPublishNow(e.target.checked)} />Publish them right away so the app shows them</label>
                    </>
                  )}
                </div>
              ) : null}

              {step === 3 ? (
                <div className="stack" style={{ gap: 10 }}>
                  <div className="card" style={{ gap: 8, boxShadow: "none" }}>
                    {[["Name", name.trim()], ["App id", appId], ["Look", `${PRESETS[preset].name} · ${accent.toUpperCase()}`], ["Currency", currency], ["Starting journeys", chosen.length ? chosen.map((s) => s.name).join(", ") : "None"]].map(([k, v]) => (
                      <div key={k} className="row" style={{ alignItems: "flex-start" }}><span className="muted" style={{ width: 130, flex: "none" }}>{k}</span><b style={{ fontWeight: 600, wordBreak: "break-word" }}>{v}</b></div>
                    ))}
                  </div>
                  <div className="faint">This adds the project to <code>packages/ui-kit/src/brands.json</code>, which the apps build from.</div>
                  {err ? <div role="alert" className="issue"><CircleAlert size={15} aria-hidden />{err}</div> : null}
                </div>
              ) : null}

              <div className="row" style={{ marginTop: 20 }}>
                {step > 0 ? <button className="btn" onClick={() => setStep(step - 1)} disabled={busy}><ArrowLeft size={15} aria-hidden />Back</button> : <button className="btn ghost" onClick={onClose}>Cancel</button>}
                <div className="spacer" />
                {step < 3 ? <button className="btn primary" disabled={!canNext} onClick={() => setStep(step + 1)}>Next<ArrowRight size={15} aria-hidden /></button>
                  : <button className="btn primary" disabled={busy} onClick={create}>{busy ? "Creating…" : <><Rocket size={15} aria-hidden />Create project</>}</button>}
              </div>
            </>
          )}
        </div>
        <div className="side"><div className="faint" style={{ fontWeight: 600 }}>Preview</div><MockPhone name={name.trim()} preset={preset} accent={accent} /></div>
      </div>
    </div>
  );
}
