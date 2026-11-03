"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LoaderCircle, RefreshCw, Trash2 } from "lucide-react";
import type { Funnel } from "@/lib/analytics";

const SOURCE: Record<string, string> = { preview: "Studio preview (sandbox)" };

/** How people move through a journey: who reached each screen, where they left, which fields trip them up and which bank calls fail. */
export function AnalyticsView({ slug, name }: { slug: string; name: string }) {
  const [data, setData] = useState<{ funnel: Funnel; sources: string[] } | null>(null);
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/journeys/${slug}/analytics${source ? `?source=${encodeURIComponent(source)}` : ""}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Could not load the analytics");
      setData(d);
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }, [slug, source]);
  useEffect(() => { load(); }, [load]);
  const clear = async () => { if (!confirm("Clear every recorded run of this journey?")) return; await fetch(`/api/journeys/${slug}/analytics`, { method: "DELETE" }); load(); };

  const f = data?.funnel;
  return (
    <div className="page">
      <Link href={`/journeys/${slug}`} className="btn ghost"><ArrowLeft size={15} aria-hidden />Back to the journey</Link>
      <div className="page-head" style={{ marginTop: 16 }}>
        <div><h1>{name}</h1><p className="faint" style={{ margin: "4px 0 0" }}>Analytics: where people go, where they leave, what trips them up.</p></div>
        <div className="spacer" />
        {data && data.sources.length > 1 ? (
          <select className="select" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Where it was played" style={{ height: 32 }}>
            <option value="">All sources</option>{data.sources.map((s) => <option key={s} value={s}>{SOURCE[s] ?? s}</option>)}
          </select>
        ) : null}
        <button className="btn" onClick={load} disabled={busy}>{busy ? <LoaderCircle size={15} className="spin" aria-hidden /> : <RefreshCw size={15} aria-hidden />}Refresh</button>
        <button className="btn" onClick={clear} disabled={!f?.starts}><Trash2 size={15} aria-hidden />Clear</button>
      </div>
      {err ? <p role="alert" style={{ color: "var(--negative)" }}>{err}</p> : null}

      {f && f.starts === 0 ? (
        <p className="faint" style={{ marginTop: 20 }}>No runs recorded yet. Play the journey in the Studio preview (Preview button in the builder) and the runs appear here. Screens viewed, mistakes, bank failures and exits are recorded; answers never are.</p>
      ) : null}

      {f && f.starts > 0 ? (
        <>
          <section style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }} aria-label="Summary">
            <div className="card"><span className="faint">Runs</span><strong style={{ fontSize: 24 }}>{f.starts}</strong></div>
            <div className="card"><span className="faint">Finished</span><strong style={{ fontSize: 24 }}>{f.finishedPct}%</strong><span className="faint">{f.finished} reached an end screen</span></div>
            <div className="card"><span className="faint">Left early</span><strong style={{ fontSize: 24 }}>{f.leftPct}%</strong><span className="faint">{f.left} stopped before the end</span></div>
            <div className="card"><span className="faint">Biggest leak</span><strong style={{ fontSize: 18 }}>{f.biggestLeak ? f.biggestLeak.title : "None"}</strong>{f.biggestLeak ? <span className="faint">{f.biggestLeak.leftHere} left here</span> : null}</div>
          </section>

          <section className="card" style={{ marginTop: 20 }} aria-label="Funnel">
            <strong>Screens</strong>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
              {f.steps.filter((s) => s.reached > 0).map((s) => (
                <li key={s.screen}>
                  <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                    <strong style={{ minWidth: 180 }}>{s.title}</strong>
                    <span className="faint">{s.reached} reached · {s.pct}%</span>
                    {s.kind === "terminal" ? <span className="chip pos">end</span> : null}
                    {s.leftHere ? <span className="chip warn">{s.leftHere} left here ({s.leftPct}%)</span> : null}
                    {s.mistakes ? <span className="chip neg">{s.mistakes} mistake{s.mistakes === 1 ? "" : "s"}{s.topFields.length ? `: ${s.topFields.map((t) => `${t.field} ×${t.count}`).join(", ")}` : ""}</span> : null}
                    {s.backs ? <span className="chip">{s.backs} stepped back</span> : null}
                    {s.failures.map((x) => <span key={x.integration + x.code} className="chip neg">{x.integration} failed {x.code} ×{x.count}</span>)}
                  </div>
                  <div role="img" aria-label={`${s.pct}% reached ${s.title}`} style={{ height: 8, borderRadius: 4, background: "var(--surface-2, rgba(128,128,128,.18))", marginTop: 6 }}>
                    <div style={{ width: `${s.pct}%`, height: "100%", borderRadius: 4, background: s.kind === "terminal" ? "var(--positive)" : "var(--accent, #3b82f6)" }} />
                  </div>
                </li>
              ))}
            </ul>
            {f.steps.some((s) => s.reached === 0) ? <p className="faint" style={{ margin: 0 }}>Never reached: {f.steps.filter((s) => s.reached === 0).map((s) => s.title).join(", ")}.</p> : null}
          </section>

          {f.endings.length ? (
            <section className="card" style={{ marginTop: 20 }} aria-label="How runs ended">
              <strong>How runs ended</strong>
              <ul style={{ margin: 0, paddingLeft: 18 }}>{f.endings.map((e) => <li key={e.screen}>{e.title}: {e.count}</li>)}</ul>
            </section>
          ) : null}
          <p className="faint">Versions seen: {f.versions.map((v) => `v${v}`).join(", ")}. "Left here" means the run's last screen was not an end screen.</p>
        </>
      ) : null}
    </div>
  );
}
