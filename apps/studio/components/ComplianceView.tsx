"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, LoaderCircle, Minus, RefreshCw, Save, X } from "lucide-react";
import type { ComplianceReport } from "@finx/mcp/proof";

type SnapshotRow = { id: string; version: number; at: string; by: string; hash: string; note: string; summary: ComplianceReport["summary"] };
type Data = { report: ComplianceReport; hash: string; snapshots: SnapshotRow[] };
const BANK: Record<string, string> = { reference: "Reference bank", "bank-b": "Bank B" };

/** The evidence a reviewer asks for: rules about money, and the trace from each acceptance criterion to its tests and screens. Evidence to review, not a certificate. */
export function ComplianceView({ slug, name, version }: { slug: string; name: string; version: number }) {
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState<"load" | "save" | null>("load");
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setBusy("load"); setErr("");
    try { const r = await fetch(`/api/journeys/${slug}/compliance`); const d = await r.json(); if (!r.ok) throw new Error(d.error ?? "Could not build the report"); setData(d); }
    catch (e) { setErr((e as Error).message); }
    setBusy(null);
  }, [slug]);
  useEffect(() => { load(); }, [load]);
  const save = async () => {
    setBusy("save"); setErr("");
    try { const r = await fetch(`/api/journeys/${slug}/compliance`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error ?? "Could not save"); setNote(""); await load(); }
    catch (e) { setErr((e as Error).message); setBusy(null); }
  };

  const r = data?.report;
  const icon = (s: string) => s === "pass" ? <Check size={15} aria-hidden style={{ color: "var(--positive)" }} /> : s === "fail" ? <X size={15} aria-hidden style={{ color: "var(--negative)" }} /> : <Minus size={15} aria-hidden style={{ opacity: 0.5 }} />;
  const latest = data?.snapshots[0];
  return (
    <div className="page">
      <Link href={`/journeys/${slug}`} className="btn ghost"><ArrowLeft size={15} aria-hidden />Back to the journey</Link>
      <div className="page-head" style={{ marginTop: 16 }}>
        <div><h1>{name}</h1><p className="faint" style={{ margin: "4px 0 0" }}>Compliance: the rules about money, and what proves each requirement. Version {version} draft.</p></div>
        <div className="spacer" />
        {r ? <span className={`chip ${r.summary.fail ? "neg" : "pos"}`}>{r.summary.fail ? `${r.summary.fail} check${r.summary.fail === 1 ? "" : "s"} failing` : "All checks pass"}</span> : null}
        <button className="btn" onClick={load} disabled={!!busy}>{busy === "load" ? <LoaderCircle size={15} className="spin" aria-hidden /> : <RefreshCw size={15} aria-hidden />}Re-check</button>
      </div>
      {err ? <p role="alert" style={{ color: "var(--negative)" }}>{err}</p> : null}
      {!r ? <p className="faint">Building the report, running the journey's tests on each bank API…</p> : (
        <>
          <section className="card" style={{ marginTop: 20 }} aria-label="Checks">
            <strong>Checks</strong>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
              {r.checks.map((c) => (
                <li key={c.id} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                  {icon(c.status)}
                  <span><strong>{c.title}</strong><br /><span className="faint">{c.detail}{c.screens.length ? ` · on ${c.screens.join(", ")}` : ""}</span></span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card" style={{ marginTop: 20 }} aria-label="Traceability">
            <strong>From requirement to test to screen</strong>
            {r.trace.length === 0 ? <p className="faint" style={{ margin: 0 }}>This journey carries no acceptance criteria. Generate it with <code>/finx-generate</code> and the trace appears here.</p> : (
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 12 }}>
                {r.trace.map((t) => (
                  <li key={t.id}>
                    <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                      <strong>{t.id}</strong><span style={{ flex: 1, minWidth: 220 }}>{t.text}</span>
                      {Object.entries(t.banks).map(([b, s]) => <span key={b} className={`chip ${s === "proved" ? "pos" : s === "failing" ? "neg" : "warn"}`}>{BANK[b] ?? b}: {s}</span>)}
                    </div>
                    <div className="faint" style={{ marginTop: 2 }}>Tests: {t.scenarios.length ? t.scenarios.join(", ") : "none"} · Screens: {t.screens.length ? t.screens.map((s) => s.title).join(" → ") : "none"}</div>
                  </li>
                ))}
              </ul>
            )}
            {r.trace.length && r.untraced.length ? <p className="faint" style={{ margin: 0 }}>No criterion's tests reach: {r.untraced.map((s) => s.title).join(", ")}. Either a requirement is missing for them or nothing proves them.</p> : null}
          </section>

          <section className="card" style={{ marginTop: 20 }} aria-label="Snapshots">
            <strong>Saved snapshots</strong>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input className="input" style={{ flex: 1, minWidth: 220 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note, for example: sent to compliance review" aria-label="Snapshot note" maxLength={300} />
              <button className="btn primary" onClick={save} disabled={!!busy}>{busy === "save" ? <LoaderCircle size={15} className="spin" aria-hidden /> : <Save size={15} aria-hidden />}Save snapshot of v{version}</button>
            </div>
            {latest && latest.hash !== data!.hash ? <p className="faint" style={{ margin: 0 }}>The journey has changed since the last snapshot ({new Date(latest.at).toLocaleString()}).</p> : null}
            {data!.snapshots.length === 0 ? <p className="faint" style={{ margin: 0 }}>None yet. Save one when you hand the journey to a reviewer.</p> : (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {data!.snapshots.map((s) => (
                  <li key={s.id}>v{s.version} · {new Date(s.at).toLocaleString()} · {s.by} · {s.summary.fail ? `${s.summary.fail} failing` : "all checks pass"}, {s.summary.proved}/{s.summary.criteria} criteria proved{s.hash === data!.hash ? " · matches now" : ""}{s.note ? ` · ${s.note}` : ""}</li>
                ))}
              </ul>
            )}
          </section>
          <p className="faint">This is evidence for a person to review. It does not certify the journey against any regulation; each bank's compliance team decides what applies to it.</p>
        </>
      )}
    </div>
  );
}
