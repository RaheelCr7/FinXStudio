"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CircleAlert, Moon, Plus, Rocket, Sun, Trash2 } from "lucide-react";
import { COUNTRIES, LANGUAGES, LOOKS, accentProblem, applyLook, brandDefs, countryByCode, languageInfo, lookById, lookReport, moodTokens, type BrandDef, type Channel, type Entity, type ProjectLanguage } from "@finx/ui-kit";
import { useProjects } from "./Projects";
import { buildCommands } from "./ProjectList";
import { LookPreview, type PreviewMode } from "./design/LookPreview";

export type Starter = { slug: string; name: string; apps: string[]; screens: number };
const SWATCHES = ["#3155CE", "#0F6E56", "#7C3AED", "#BE185D", "#B45309", "#0E7490", "#1D4ED8", "#9F1239"];
const slugOf = (n: string) => n.toLowerCase().trim().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
const suggestId = (n: string) => `com.${slugOf(n).replace(/-/g, "") || "yourbank"}.app`;
const CHANNEL_INFO: { id: Channel; name: string; help: string; built: boolean }[] = [
  { id: "mobile", name: "Mobile", help: "iPhone and Android app", built: true },
  { id: "web", name: "Web", help: "Banking in the browser", built: true },
  { id: "tablet", name: "Tablet", help: "Coming later", built: false },
  { id: "watch", name: "Watch", help: "Coming later", built: false },
];
const TITLES = ["Basics", "Channels", "Country and languages", "Entities", "Look", "Starting journeys", "Review"];
const HEADINGS = ["Name your bank app", "Where does it run?", "Country and languages", "Legal entities", "Choose the look", "Start with some journeys", "Ready to create?"];

export function NewProjectWizard({ starters, onClose, initialAccent }: { starters: Starter[]; onClose: () => void; initialAccent?: string }) {
  const router = useRouter();
  const { byId, setCurrent } = useProjects();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [bundleId, setBundleId] = useState("");
  const [idEdited, setIdEdited] = useState(false);
  const [channels, setChannels] = useState<Channel[]>(["mobile", "web"]);
  const [country, setCountry] = useState("US");
  const [currency, setCurrency] = useState("USD");
  const [languages, setLanguages] = useState<string[]>(["en", "es"]);
  const [custom, setCustom] = useState<ProjectLanguage[]>([]);
  const [newLang, setNewLang] = useState({ code: "", name: "", dir: "ltr" as "ltr" | "rtl" });
  const [multi, setMulti] = useState(false);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [lookId, setLookId] = useState("fintech");
  const [accent, setAccent] = useState(initialAccent ?? brandDefs.bankworkx!.accent);
  const [mood, setMood] = useState<{ roundness: number; density: number } | null>(null);
  const [mode, setMode] = useState<PreviewMode>("light");
  const [rtlPreview, setRtlPreview] = useState(false);
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
  const look = lookById(lookId)!;
  const profile = countryByCode(country);
  const allLanguages = [...LANGUAGES.map((l) => ({ code: l.code, name: l.name })), ...custom.map((l) => ({ code: l.code, name: l.name }))];
  const nameOf = (c: string) => allLanguages.find((l) => l.code === c)?.name ?? c;
  const dirOf = (c: string) => custom.find((l) => l.code === c)?.dir ?? languageInfo(c)?.dir ?? "ltr";
  const entityList: Entity[] = multi && entities.length ? entities : [{ id: "main", name: name.trim() || "Main entity", country, currency, languages }];

  // the look, as the wizard builds it: the library look, the brand colour, then the sliders on top
  const draft: BrandDef = useMemo(() => {
    const m = mood ? moodTokens(mood.roundness, mood.density) : null;
    const l = applyLook(look);
    return {
      name: name.trim() || "Your Bank", shortName: "Bank", slug: id || "draft", bundleId: appId, scheme: "draft", currency, locale: profile?.locale ?? "en-US", assets: "", background: "#F6F7F9", splashDark: "#0A0D12",
      preset: l.preset, accent: accent.toUpperCase(), ...(l.look ? { look: l.look } : {}),
      radius: { ...(l.radius ?? {}), ...(m?.radius ?? {}) }, components: { ...(l.components ?? {}), ...(m?.components ?? {}) },
    };
  }, [look, accent, mood, name, id, appId, currency, profile]);
  const checks = useMemo(() => lookReport(draft), [draft]);
  const candidates = useMemo(() => starters.filter((s) => s.apps.some((a) => byId(a)?.brand.preset === draft.preset)), [starters, byId, draft.preset]);
  const chosen = candidates.filter((s) => (picked ?? Object.fromEntries(candidates.map((c) => [c.slug, true])))[s.slug] !== false);

  const basicsErr = name.trim().length < 2 ? "Give the project a name" : byId(id) ? "A project with this name already exists" : !/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/.test(appId) ? "The app id must look like com.yourbank.app" : "";
  const entityErr = multi ? (entities.length < 2 ? "Add at least two entities, or turn this off" : entities.some((e) => e.languages.some((l) => !languages.includes(l))) ? "An entity uses a language the project does not offer" : "") : "";
  const canNext = [!basicsErr, channels.some((c) => c === "mobile" || c === "web"), languages.length > 0, !entityErr, !accentErr, true, true][step]!;

  const chooseCountry = (code: string) => {
    const c = countryByCode(code)!;
    setCountry(code); setCurrency(c.currency); setLanguages(c.languages);
  };
  const chooseLook = (lid: string) => { const l = lookById(lid)!; setLookId(lid); setAccent(l.accent); setMood(null); setPicked(null); };
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const addLanguage = () => {
    const code = newLang.code.trim();
    if (!/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(code) || languageInfo(code) || custom.some((l) => l.code === code) || newLang.name.trim().length < 2) { setErr("Give the language a code like pt or pt-BR that is not already listed, and a name"); return; }
    setErr(""); setCustom([...custom, { code, name: newLang.name.trim(), dir: newLang.dir }]); setLanguages([...languages, code]); setNewLang({ code: "", name: "", dir: "ltr" });
  };
  const addEntity = () => {
    const base = entities.length ? "entity" : "main";
    let n = entities.length + 1, eid = `${base}${n}`;
    while (entities.some((e) => e.id === eid)) eid = `${base}${++n}`;
    setEntities([...entities, { id: eid, name: `${name.trim() || "Bank"} ${profile?.name ?? ""}`.trim(), country, currency, languages: [...languages] }]);
  };
  const patchEntity = (eid: string, patch: Partial<Entity>) => setEntities(entities.map((e) => (e.id === eid ? { ...e, ...patch } : e)));

  async function create() {
    setBusy(true); setErr("");
    try {
      const m = mood ? moodTokens(mood.roundness, mood.density) : null;
      const body = {
        name: name.trim(), bundleId: appId, preset: look.preset, accent: accent.toUpperCase(), currency, country, look: lookId, channels, languages, customLanguages: custom,
        ...(multi ? { entities } : {}), ...(m ? { radius: m.radius, components: m.components } : {}), starters: chosen.map((s) => s.slug), publishStarters: publishNow,
      };
      const res = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? "Could not create the project"); setBusy(false); return; }
      setDone({ id: data.project.id, name: data.project.name, iconWarning: data.iconWarning, started: data.started, failed: data.failed });
    } catch { setErr("Cannot reach the server"); }
    setBusy(false);
  }

  const hasRtl = languages.some((l) => dirOf(l) === "rtl");
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
              <div className="steps" aria-hidden>{TITLES.map((_, i) => <i key={i} className={i <= step ? "on" : ""} />)}</div>
              <div className="faint" style={{ fontWeight: 600 }}>Step {step + 1} of {TITLES.length} · {TITLES[step]}</div>
              <h2 style={{ margin: "2px 0 14px" }}>{HEADINGS[step]}</h2>

              {step === 0 ? (
                <div className="stack">
                  <label className="field">Project name<input ref={first} className="input" style={{ height: 40 }} placeholder="e.g. Acme Bank" value={name} onChange={(e) => setName(e.target.value)} /></label>
                  <label className="field">App id <span className="faint" style={{ fontWeight: 400 }}>(used by the App Store and Google Play; cannot change later)</span>
                    <input className="input mono" value={appId} onChange={(e) => { setIdEdited(true); setBundleId(e.target.value.toLowerCase()); }} /></label>
                  {name && basicsErr ? <div role="alert" style={{ color: "var(--negative)", fontSize: 13 }}>{basicsErr}</div> : null}
                </div>
              ) : null}

              {step === 1 ? (
                <div className="stack" style={{ gap: 8 }}>
                  <div className="muted" style={{ fontSize: 13 }}>Choose where the bank&rsquo;s journeys run. Tablet and watch are planned and are saved with the project, but nothing is built for them yet.</div>
                  {CHANNEL_INFO.map((c) => (
                    <label key={c.id} className="row" style={{ gap: 10, padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, opacity: c.built ? 1 : 0.6 }}>
                      <input type="checkbox" checked={channels.includes(c.id)} disabled={!c.built} onChange={() => setChannels(toggle(channels, c.id))} />
                      <span style={{ flex: 1, fontWeight: 600 }}>{c.name}</span><span className="faint">{c.help}</span>
                    </label>
                  ))}
                  {!channels.some((c) => c === "mobile" || c === "web") ? <div role="alert" style={{ color: "var(--negative)", fontSize: 13 }}>Choose mobile or web.</div> : null}
                </div>
              ) : null}

              {step === 2 ? (
                <div className="stack" style={{ gap: 14 }}>
                  <label className="field">Country
                    <select className="select" value={country} onChange={(e) => chooseCountry(e.target.value)}>{COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></label>
                  {profile ? (
                    <div className="card" style={{ gap: 4, boxShadow: "none" }}>
                      <div className="row" style={{ gap: 8 }}><b>{profile.name}</b><span className="chip">Draft profile</span></div>
                      <div className="faint">Regulator: <a href={profile.regulator.url} target="_blank" rel="noreferrer">{profile.regulator.name}</a> · National ID: {profile.nationalId} · Banks closed: {profile.weekend.join(", ")} · Dial code {profile.dialCode}</div>
                      <div className="faint">A starting point to confirm with the bank&rsquo;s own compliance team. It is not legal or regulatory guidance.</div>
                    </div>
                  ) : null}
                  <label className="field">Currency<input className="input mono" style={{ width: 100 }} maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} /></label>
                  <div className="field">Languages <span className="faint" style={{ fontWeight: 400 }}>(the first one is the default)</span>
                    <div className="row" style={{ flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                      {allLanguages.map((l) => (
                        <button key={l.code} className="chip" aria-pressed={languages.includes(l.code)} style={{ cursor: "pointer", borderColor: languages.includes(l.code) ? "var(--accent)" : undefined }} onClick={() => setLanguages(toggle(languages, l.code))}>
                          {languages.includes(l.code) ? <Check size={12} aria-hidden /> : null}{l.name}{dirOf(l.code) === "rtl" ? " · RTL" : ""}
                        </button>
                      ))}
                    </div>
                    <div className="faint" style={{ marginTop: 6 }}>Default: {languages[0] ? nameOf(languages[0]) : "none"}. Selected: {languages.map(nameOf).join(", ") || "none"}.</div>
                  </div>
                  <div className="field">Add another language
                    <div className="row" style={{ gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                      <input className="input mono" style={{ width: 80 }} placeholder="pt-BR" aria-label="Language code" value={newLang.code} onChange={(e) => setNewLang({ ...newLang, code: e.target.value })} />
                      <input className="input" style={{ width: 150 }} placeholder="Portuguese" aria-label="Language name" value={newLang.name} onChange={(e) => setNewLang({ ...newLang, name: e.target.value })} />
                      <select className="select" aria-label="Direction" value={newLang.dir} onChange={(e) => setNewLang({ ...newLang, dir: e.target.value as "ltr" | "rtl" })}><option value="ltr">Left to right</option><option value="rtl">Right to left</option></select>
                      <button className="btn" onClick={addLanguage}><Plus size={14} aria-hidden />Add</button>
                    </div>
                  </div>
                  {err ? <div role="alert" style={{ color: "var(--negative)", fontSize: 13 }}>{err}</div> : null}
                </div>
              ) : null}

              {step === 3 ? (
                <div className="stack" style={{ gap: 12 }}>
                  <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={multi} onChange={(e) => { setMulti(e.target.checked); if (e.target.checked && entities.length === 0) setEntities([{ id: "main", name: name.trim() || "Main entity", country, currency, languages: [...languages] }]); }} />
                    <span><b>This bank is a group with more than one legal entity</b><div className="faint">For example a Jordan entity and an Egypt entity. Each has its own country, currency and languages, and customers choose their entity in the app.</div></span></label>
                  {!multi ? <div className="card" style={{ boxShadow: "none" }}><b>{entityList[0]!.name}</b><div className="faint">{profile?.name} · {currency} · {languages.map(nameOf).join(", ")}</div><div className="faint">A single bank is one entity. You can add more later.</div></div> : (
                    <>
                      {entities.map((e) => (
                        <div key={e.id} className="card" style={{ gap: 8, boxShadow: "none" }}>
                          <div className="row" style={{ gap: 8 }}>
                            <input className="input" style={{ flex: 1 }} aria-label="Entity name" value={e.name} onChange={(ev) => patchEntity(e.id, { name: ev.target.value })} />
                            <button className="btn sm" aria-label={`Remove ${e.name}`} disabled={entities.length <= 1} onClick={() => setEntities(entities.filter((x) => x.id !== e.id))}><Trash2 size={13} aria-hidden /></button>
                          </div>
                          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                            <select className="select" aria-label="Entity country" value={e.country} onChange={(ev) => { const c = countryByCode(ev.target.value)!; patchEntity(e.id, { country: c.code, currency: c.currency, languages: c.languages.filter((l) => languages.includes(l)).length ? c.languages.filter((l) => languages.includes(l)) : [languages[0]!] }); }}>{COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select>
                            <input className="input mono" style={{ width: 80 }} aria-label="Entity currency" maxLength={3} value={e.currency} onChange={(ev) => patchEntity(e.id, { currency: ev.target.value.toUpperCase() })} />
                          </div>
                          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                            {languages.map((l) => <button key={l} className="chip" aria-pressed={e.languages.includes(l)} style={{ cursor: "pointer", borderColor: e.languages.includes(l) ? "var(--accent)" : undefined }} onClick={() => patchEntity(e.id, { languages: toggle(e.languages, l) })}>{nameOf(l)}</button>)}
                          </div>
                        </div>
                      ))}
                      <button className="btn" onClick={addEntity}><Plus size={14} aria-hidden />Add an entity</button>
                      {entityErr ? <div role="alert" style={{ color: "var(--negative)", fontSize: 13 }}>{entityErr}</div> : null}
                    </>
                  )}
                </div>
              ) : null}

              {step === 4 ? (
                <div className="stack" style={{ gap: 16 }}>
                  <div className="looks">
                    {LOOKS.map((l) => (
                      <button key={l.id} className="preset-card" aria-pressed={lookId === l.id} onClick={() => chooseLook(l.id)}>
                        <span style={{ display: "flex", gap: 4 }}><i style={{ width: 22, height: 10, borderRadius: Math.min(l.radius?.md ?? 12, 6), background: l.accent }} /><i style={{ width: 14, height: 10, borderRadius: Math.min(l.radius?.md ?? 12, 6), background: l.look?.pageBg ?? "var(--border-strong)" }} /></span>
                        <b>{l.name}</b><span className="muted" style={{ fontSize: 12.5 }}>{l.description}</span>
                      </button>
                    ))}
                  </div>
                  <div className="field">Brand colour
                    <div className="row" style={{ marginTop: 6 }}>
                      <input aria-label="Pick a colour" type="color" value={/^#[0-9a-fA-F]{6}$/.test(accent) ? accent : "#3155CE"} onChange={(e) => setAccent(e.target.value.toUpperCase())} style={{ width: 44, height: 38, border: 0, background: "none", padding: 0 }} />
                      <input aria-label="Colour code" className="input mono" style={{ width: 120 }} value={accent} onChange={(e) => setAccent(e.target.value.toUpperCase())} />
                    </div>
                    <div className="swatches" style={{ marginTop: 8 }}>{SWATCHES.map((sw) => <button key={sw} className="swatch" aria-label={`Use ${sw}`} aria-pressed={accent.toUpperCase() === sw} style={{ background: sw }} onClick={() => setAccent(sw)} />)}</div>
                    {accentErr ? <div role="alert" style={{ color: "var(--negative)", fontSize: 13, marginTop: 6 }}>{accentErr}</div> : null}
                  </div>
                  <div className="field">Feel
                    <label className="row" style={{ gap: 10, marginTop: 6 }}><span style={{ width: 90 }}>Roundness</span>
                      <input type="range" min={0} max={28} value={mood?.roundness ?? (draft.radius?.md ?? 12)} aria-label="Roundness" onChange={(e) => setMood({ roundness: +e.target.value, density: mood?.density ?? 50 })} style={{ flex: 1 }} /><span className="faint mono">{mood?.roundness ?? (draft.radius?.md ?? 12)}px</span></label>
                    <label className="row" style={{ gap: 10 }}><span style={{ width: 90 }}>Density</span>
                      <input type="range" min={0} max={100} value={mood?.density ?? 50} aria-label="Density" onChange={(e) => setMood({ roundness: mood?.roundness ?? (draft.radius?.md ?? 12), density: +e.target.value })} style={{ flex: 1 }} /><span className="faint">{(mood?.density ?? 50) < 35 ? "Compact" : (mood?.density ?? 50) > 65 ? "Comfortable" : "Balanced"}</span></label>
                    {mood ? <button className="btn sm" style={{ alignSelf: "flex-start", marginTop: 4 }} onClick={() => setMood(null)}>Back to this look&rsquo;s own sizes</button> : null}
                  </div>
                  <div className="card" style={{ gap: 6, boxShadow: "none" }}>
                    <b>Accessibility</b>
                    {checks.map((c) => <div key={c.id} className="row" style={{ gap: 8, fontSize: 13 }}><span className={`chip ${c.ok ? "pos" : "neg"}`}>{c.ok ? "Pass" : "Fix"}</span><span style={{ flex: 1 }}>{c.label}</span><span className="faint mono">{c.value}</span></div>)}
                    {checks.filter((c) => !c.ok).map((c) => <div key={c.id} className="faint">{c.label}: {c.fix}</div>)}
                  </div>
                </div>
              ) : null}

              {step === 5 ? (
                <div className="stack" style={{ gap: 8 }}>
                  {candidates.length === 0 ? <div className="muted">There are no ready-made journeys for this look yet. You will start empty and build your own.</div> : (
                    <>
                      <div className="muted" style={{ fontSize: 13 }}>Copies of working journeys from another bank with the same base look. Edit them freely: the originals are not changed. Text and amounts keep the original currency until you edit them.</div>
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

              {step === 6 ? (
                <div className="stack" style={{ gap: 10 }}>
                  <div className="card" style={{ gap: 8, boxShadow: "none" }}>
                    {[["Name", name.trim()], ["App id", appId], ["Channels", channels.join(", ")], ["Country", `${profile?.name} · ${currency}`], ["Languages", languages.map(nameOf).join(", ")],
                      ["Entities", entityList.map((e) => `${e.name} (${e.country})`).join(", ")], ["Look", `${look.name} · ${accent.toUpperCase()}${mood ? " · adjusted" : ""}`], ["Starting journeys", chosen.length ? chosen.map((s) => s.name).join(", ") : "None"]].map(([k, v]) => (
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
                {step < TITLES.length - 1 ? <button className="btn primary" disabled={!canNext} onClick={() => { setErr(""); setStep(step + 1); }}>Next<ArrowRight size={15} aria-hidden /></button>
                  : <button className="btn primary" disabled={busy} onClick={create}>{busy ? "Creating…" : <><Rocket size={15} aria-hidden />Create project</>}</button>}
              </div>
            </>
          )}
        </div>
        <div className="side">
          <div className="faint" style={{ fontWeight: 600 }}>Preview</div>
          <LookPreview def={draft} mode={mode} rtl={rtlPreview} />
          <div className="row" style={{ gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
            <div className="seg" role="group" aria-label="Appearance">
              <button aria-pressed={mode === "light"} onClick={() => setMode("light")}><Sun size={13} aria-hidden />Light</button>
              <button aria-pressed={mode === "dark"} onClick={() => setMode("dark")}><Moon size={13} aria-hidden />Dark</button>
              <button aria-pressed={mode === "contrast"} onClick={() => setMode("contrast")}>High contrast</button>
            </div>
            <div className="seg" role="group" aria-label="Direction">
              <button aria-pressed={!rtlPreview} onClick={() => setRtlPreview(false)}>LTR</button>
              <button aria-pressed={rtlPreview} onClick={() => setRtlPreview(true)}>RTL{hasRtl ? "" : " (preview)"}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
