"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, LoaderCircle, Play, X } from "lucide-react";

type Criterion = { id: string; text: string };
type Scenario = { id: string; name: string; covers: string[]; persona: string };
type Report = { total: number; passed: number; results: { id: string; ok: boolean; failures: string[] }[]; coverage: { id: string; status: "proved" | "failing" | "uncovered" }[] };
type Mutation = { total: number; killed: number; survived: { id: string; what: string }[]; results: { id: string; what: string; killed: boolean; caughtBy: string[] }[] };
type Proof = { banks: Record<string, Report>; mutation: Mutation | null };

const BANK_NAME: Record<string, string> = { reference: "Reference bank", "bank-b": "Bank B" };

/** What the journey's tests prove: each acceptance criterion, the scenarios that cover it, on every bank API, and whether the tests notice a broken journey. */
export function ProofView({ slug, name, acceptance, scenarios }: { slug: string; name: string; acceptance: Criterion[]; scenarios: Scenario[] }) {
  const [proof, setProof] = useState<Proof | null>(null);
  const [busy, setBusy] = useState<"run" | "mutation" | null>("run");
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const run = useCallback(async (mutation: boolean) => {
    setBusy(mutation ? "mutation" : "run"); setErr("");
    try {
      const r = await fetch(`/api/journeys/${slug}/proof`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mutation }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "The tests could not run");
      setProof((old) => ({ banks: d.banks, mutation: d.mutation ?? old?.mutation ?? null }));
    } catch (e) { setErr((e as Error).message); }
    setBusy(null);
  }, [slug]);
  useEffect(() => { run(false); }, [run]);

  const banks = proof ? Object.keys(proof.banks) : [];
  const result = (bank: string, id: string) => proof?.banks[bank]?.results.find((r) => r.id === id);
  const status = (bank: string, id: string) => proof?.banks[bank]?.coverage.find((c) => c.id === id)?.status;
  const allOk = !!proof && banks.every((b) => proof.banks[b]!.passed === proof.banks[b]!.total && proof.banks[b]!.coverage.every((c) => c.status === "proved"));

  if (!acceptance.length && !scenarios.length) return (
    <div className="page"><Link href={`/journeys/${slug}`} className="btn ghost"><ArrowLeft size={15} aria-hidden />Back to the journey</Link>
      <h1 style={{ marginTop: 16 }}>{name}</h1><p className="faint">This journey carries no acceptance criteria or tests. Ask Claude to generate it with <code>/finx-generate</code> and they appear here.</p></div>
  );

  return (
    <div className="page">
      <Link href={`/journeys/${slug}`} className="btn ghost"><ArrowLeft size={15} aria-hidden />Back to the journey</Link>
      <div className="page-head" style={{ marginTop: 16 }}>
        <div><h1>{name}</h1><p className="faint" style={{ margin: "4px 0 0" }}>Proof: what the journey must do, and the tests that show it does.</p></div>
        <div className="spacer" />
        {proof ? <span className={`chip ${allOk ? "pos" : "neg"}`}>{allOk ? "All criteria proved" : "Something fails"}</span> : null}
        <button className="btn" onClick={() => run(false)} disabled={!!busy}>{busy === "run" ? <LoaderCircle size={15} className="spin" aria-hidden /> : <Play size={15} aria-hidden />}Run tests</button>
      </div>
      {err ? <p role="alert" style={{ color: "var(--negative)" }}>{err}</p> : null}

      <section aria-label="Acceptance criteria" style={{ marginTop: 20, display: "grid", gap: 10 }}>
        {acceptance.map((a) => {
          const mine = scenarios.filter((s) => s.covers.includes(a.id));
          return (
            <div key={a.id} className="card">
              <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                <strong>{a.id}</strong><span style={{ flex: 1, minWidth: 220 }}>{a.text}</span>
                {banks.map((b) => { const s = status(b, a.id); return <span key={b} className={`chip ${s === "proved" ? "pos" : s === "failing" ? "neg" : "warn"}`}>{BANK_NAME[b] ?? b}: {s ?? "…"}</span>; })}
                {!proof ? <span className="chip">running…</span> : null}
              </div>
              {mine.length === 0 ? <p className="faint" style={{ margin: 0 }}>No scenario covers this yet.</p> : (
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 4 }}>
                  {mine.map((s) => {
                    const fails = banks.flatMap((b) => result(b, s.id)?.failures.map((f) => `${BANK_NAME[b] ?? b}: ${f}`) ?? []);
                    return (
                      <li key={s.id}>
                        <button className="issue" style={{ border: 0, textAlign: "left", cursor: "pointer", width: "100%", marginBottom: 0 }} onClick={() => setOpen(open === `${a.id}${s.id}` ? null : `${a.id}${s.id}`)} aria-expanded={open === `${a.id}${s.id}`}>
                          {proof ? (fails.length ? <X size={15} aria-hidden style={{ color: "var(--negative)" }} /> : <Check size={15} aria-hidden style={{ color: "var(--positive)" }} />) : <LoaderCircle size={15} className="spin" aria-hidden />}
                          <span><strong>{s.id}</strong> {s.name} <span style={{ opacity: 0.6 }}>· as {s.persona}</span></span>
                        </button>
                        {open === `${a.id}${s.id}` && fails.length ? <pre style={{ margin: "4px 0 6px 24px", whiteSpace: "pre-wrap", fontSize: 12, color: "var(--negative)" }}>{fails.join("\n")}</pre> : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </section>

      <section className="card" aria-label="Mutation check" style={{ marginTop: 20 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <strong>Would the tests notice a broken journey?</strong><div className="spacer" />
          <button className="btn" onClick={() => run(true)} disabled={!!busy}>{busy === "mutation" ? <><LoaderCircle size={15} className="spin" aria-hidden />Breaking it on purpose…</> : "Run mutation check"}</button>
        </div>
        <p className="faint" style={{ margin: 0 }}>It removes one check or one bank rule at a time and expects at least one scenario to fail each time. It takes a little while.</p>
        {proof?.mutation ? (
          <>
            <p style={{ margin: 0 }}><strong>{proof.mutation.killed} of {proof.mutation.total}</strong> deliberate breaks were caught.{proof.mutation.survived.length ? " These were not:" : ""}</p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>{proof.mutation.survived.map((m) => <li key={m.id}>{m.what} <span className="faint">({m.id})</span></li>)}</ul>
            {proof.mutation.survived.length ? <p className="faint" style={{ margin: 0 }}>A break that gets through is either a gap in the tests or a case no screen can reach in the sandbox. Decide which, and say so in the generator's report.</p> : null}
          </>
        ) : null}
      </section>
    </div>
  );
}
