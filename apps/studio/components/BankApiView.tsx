"use client";
import { useCallback, useEffect, useState } from "react";
import { Check, LoaderCircle, Plug, X } from "lucide-react";
import { useProjects } from "./Projects";

type Option = { id: string; name: string; description: string };
type Check = { bankApi: string; journeys: { slug: string; name: string; total: number; passed: number; failing: { id: string; name: string; failures: string[] }[]; uncovered: string[] }[] };
const PLANNED = [
  { name: "Direct to the bank's own API", note: "A real bank's test system, through a mapping file like Bank B's." },
  { name: "Through Quantum Fabric", note: "Temenos' integration layer, when a sandbox is available." },
  { name: "Middleware X", note: "FinX's own middleware: planned as the future default." },
];

/** Which bank API a project runs against: the sandbox its preview, its web app and its tests talk to. */
export function BankApiView() {
  const { current } = useProjects();
  const project = current.id;
  const [options, setOptions] = useState<Option[]>([]);
  const [chosen, setChosen] = useState("reference");
  const [saved, setSaved] = useState("reference");
  const [busy, setBusy] = useState<string | null>("load");
  const [err, setErr] = useState(""); const [msg, setMsg] = useState("");
  const [result, setResult] = useState<Check | null>(null);

  const call = async (url: string, init?: RequestInit) => { const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } }); const d = await r.json(); if (!r.ok) throw new Error(d.error ?? "Failed"); return d; };
  useEffect(() => {
    setBusy("load"); setErr(""); setMsg(""); setResult(null);
    call(`/api/projects/${project}/bank-api`).then((d) => { setOptions(d.options); setChosen(d.bankApi); setSaved(d.bankApi); }).catch((e) => setErr(e.message)).finally(() => setBusy(null));
  }, [project]);

  const save = async () => { setBusy("save"); setErr(""); setMsg(""); try { const d = await call(`/api/projects/${project}/bank-api`, { method: "PATCH", body: JSON.stringify({ bankApi: chosen }) }); setSaved(d.bankApi); setMsg("Saved. Previews, the web app and tests of this project now use it."); } catch (e) { setErr((e as Error).message); } setBusy(null); };
  const check = async () => { setBusy("check"); setErr(""); try { setResult(await call(`/api/projects/${project}/bank-api/check`, { method: "POST", body: JSON.stringify({ bankApi: chosen }) })); } catch (e) { setErr((e as Error).message); } setBusy(null); };

  return (
    <div className="page">
      <div className="page-head">
        <div><h1><Plug size={20} aria-hidden style={{ verticalAlign: "-3px" }} /> Bank API</h1><p className="faint" style={{ margin: "4px 0 0" }}>Which bank API {current.name ?? project} runs against. Its journeys are written once and work on any of them.</p></div>
        <div className="spacer" />
        <button className="btn primary" onClick={save} disabled={!!busy || chosen === saved}>{busy === "save" ? <LoaderCircle size={15} className="spin" aria-hidden /> : null}Save</button>
      </div>
      {err ? <p role="alert" style={{ color: "var(--negative)" }}>{err}</p> : null}
      {msg ? <p role="status" className="faint">{msg}</p> : null}

      <section style={{ marginTop: 20, display: "grid", gap: 10 }} role="radiogroup" aria-label="Bank API">
        {options.map((o) => (
          <label key={o.id} className="card" style={{ cursor: "pointer", borderColor: chosen === o.id ? "var(--accent, #3b82f6)" : undefined, display: "grid", gridTemplateColumns: "auto 1fr", gap: 12, alignItems: "start" }}>
            <input type="radio" name="bankapi" value={o.id} checked={chosen === o.id} onChange={() => { setChosen(o.id); setResult(null); }} style={{ marginTop: 4 }} />
            <span><strong>{o.name}</strong>{o.id === saved ? <span className="chip pos" style={{ marginInlineStart: 8 }}>in use</span> : null}<br /><span className="faint">{o.description}</span></span>
          </label>
        ))}
        {PLANNED.map((p) => (
          <div key={p.name} className="card" style={{ opacity: 0.55, display: "grid", gridTemplateColumns: "auto 1fr", gap: 12, alignItems: "start" }} aria-disabled="true">
            <input type="radio" disabled style={{ marginTop: 4 }} aria-label={`${p.name}, coming later`} />
            <span><strong>{p.name}</strong><span className="chip" style={{ marginInlineStart: 8 }}>coming later</span><br /><span className="faint">{p.note}</span></span>
          </div>
        ))}
      </section>

      <section className="card" style={{ marginTop: 20 }} aria-label="Check the journeys">
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <strong>Would the journeys still work?</strong><div className="spacer" />
          <button className="btn" onClick={check} disabled={!!busy}>{busy === "check" ? <LoaderCircle size={15} className="spin" aria-hidden /> : null}Run their tests on {options.find((o) => o.id === chosen)?.name ?? chosen}</button>
        </div>
        <p className="faint" style={{ margin: 0 }}>Runs the tests that travel with each journey of this project against the API you picked. Nothing is saved.</p>
        {result ? (result.journeys.length === 0 ? <p className="faint" style={{ margin: 0 }}>No journey in this project carries tests yet. Generate one with <code>/finx-generate</code>.</p> : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
            {result.journeys.map((j) => (
              <li key={j.slug}>
                <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                  {j.passed === j.total ? <Check size={15} aria-hidden style={{ color: "var(--positive)" }} /> : <X size={15} aria-hidden style={{ color: "var(--negative)" }} />}
                  <strong>{j.name}</strong><span className="faint">{j.passed} of {j.total} tests pass</span>
                </div>
                {j.failing.map((f) => <div key={f.id} className="faint" style={{ marginInlineStart: 23, color: "var(--negative)" }}>{f.id} {f.name}: {f.failures[0]}</div>)}
              </li>
            ))}
          </ul>
        )) : null}
      </section>
    </div>
  );
}
