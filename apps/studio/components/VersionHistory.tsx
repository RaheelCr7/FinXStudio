"use client";
import { useEffect, useState } from "react";
import { History, LoaderCircle, RotateCcw } from "lucide-react";

type Row = { version: number; publishedAt: string; by: string; live: boolean; restorable: boolean; changes: string[] };

/** Every publish of this journey, what differs from the current draft, and a way back to an earlier one. */
export function VersionHistory({ slug, liveVersion }: { slug: string; liveVersion?: number }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/journeys/${slug}/versions`).then((r) => r.json()).then((d) => { if (alive) setRows(d.versions ?? []); }).catch(() => { if (alive) setErr("Could not load the history"); });
    return () => { alive = false; };
  }, [slug, liveVersion]);

  async function restore(v: Row) {
    const ok = window.confirm(`Put v${v.version} back as your draft?\n\nYour current draft is replaced by v${v.version}. Customers keep seeing ${liveVersion ? `v${liveVersion}` : "the live version"} until you publish.`);
    if (!ok) return;
    setBusy(v.version); setErr("");
    const res = await fetch(`/api/journeys/${slug}/restore`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: v.version }) });
    if (!res.ok) { setErr((await res.json().catch(() => ({}))).error ?? "Could not restore"); setBusy(null); return; }
    window.location.reload(); // the Builder starts again from the restored draft
  }

  return (
    <>
      <div className="label-section"><History size={13} aria-hidden />Publish history</div>
      {rows === null && !err ? <div className="faint"><LoaderCircle size={13} className="spin" aria-hidden style={{ verticalAlign: -2 }} /> Loading…</div> : null}
      {rows?.length === 0 ? <div className="faint">Not published yet. Each publish is kept here so you can go back.</div> : null}
      {rows?.slice(0, 8).map((v) => (
        <div key={v.version} style={{ padding: "8px 0", borderTop: "1px solid var(--border)" }}>
          <div className="row" style={{ gap: 6 }}>
            <span className={`chip ${v.live ? "pos" : ""}`}>v{v.version}{v.live ? " · live" : ""}</span>
            <span className="faint" style={{ flex: 1 }}>{new Date(v.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · {v.by}</span>
            {v.restorable && v.changes.length ? (
              <button className="btn sm" disabled={busy !== null} onClick={() => restore(v)} title={`Put v${v.version} back as the draft`}>
                {busy === v.version ? <LoaderCircle size={13} className="spin" aria-hidden /> : <RotateCcw size={13} aria-hidden />}Restore
              </button>
            ) : null}
          </div>
          <div className="faint" style={{ marginTop: 4 }}>
            {!v.restorable ? "No saved copy of this version" : v.changes.length === 0 ? "Same as your draft" : <>{v.changes.slice(0, 2).join(" · ")}{v.changes.length > 2 ? ` · +${v.changes.length - 2} more` : ""}</>}
          </div>
        </div>
      ))}
      {rows && rows.length > 8 ? <div className="faint" style={{ marginTop: 6 }}>Showing the last 8 of {rows.length}.</div> : null}
      {err ? <div className="issue" role="alert">{err}</div> : null}
    </>
  );
}
