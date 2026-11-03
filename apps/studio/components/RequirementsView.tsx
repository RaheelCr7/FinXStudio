"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { Requirement } from "@finx/journey-schema";
import { useProjects } from "./Projects";
import { useWho } from "./Who";

type Row = Requirement & { blockers: string[] };
export const STATUS_CHIP: Record<string, { label: string; chip: string }> = {
  draft: { label: "Draft", chip: "chip" }, questions: { label: "Waiting for answers", chip: "chip warn dot" }, approved: { label: "Approved", chip: "chip pos dot" },
};

/** The requirements of the current project: what each bank wants built, and whether it is ready to build from. */
export function RequirementsView() {
  const router = useRouter();
  const { current } = useProjects();
  const { can } = useWho();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState(""), [intent, setIntent] = useState("");
  const [busy, setBusy] = useState(false), [err, setErr] = useState("");

  useEffect(() => {
    let live = true;
    setRows(null);
    fetch(`/api/requirements?project=${current.id}`).then((r) => r.json()).then((d) => live && setRows(Array.isArray(d) ? d : [])).catch(() => live && setRows([]));
    return () => { live = false; };
  }, [current.id]);

  async function create() {
    setBusy(true); setErr("");
    const res = await fetch("/api/requirements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, intent, projectId: current.id }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(data.error ?? "Could not create the requirement"); return; }
    router.push(`/requirements/${data.id}`);
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Requirements</h1>
          <p className="sub">What <b>{current.name}</b> wants built, written down and approved before anything is generated. Nothing is built from a requirement that is not approved.</p>
        </div>
        <button className="btn primary" onClick={() => setAdding(!adding)} disabled={!can("edit")} title={can("edit") ? undefined : "Your role cannot edit"}><Plus size={14} aria-hidden />New requirement</button>
      </div>

      {adding ? (
        <div className="card" style={{ gap: 10, maxWidth: 640 }}>
          <label className="stack" style={{ gap: 4 }}><span>Title</span><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Corporate payment with approval" aria-label="Title" /></label>
          <label className="stack" style={{ gap: 4 }}><span>What does the bank want, and why?</span><textarea className="textarea" value={intent} onChange={(e) => setIntent(e.target.value)} placeholder="A company initiator sends a payment that an approver must release before it leaves." aria-label="Intent" /></label>
          {err ? <div role="alert" style={{ color: "var(--negative)", fontSize: 13 }}>{err}</div> : null}
          <div className="row" style={{ gap: 8 }}><button className="btn primary" disabled={busy || !title.trim() || intent.trim().length < 3} onClick={create}>{busy ? "Creating…" : "Create draft"}</button><button className="btn" onClick={() => setAdding(false)}>Cancel</button></div>
        </div>
      ) : null}

      {rows === null ? <p className="faint" role="status">Loading…</p> : rows.length === 0 ? (
        <div className="card" style={{ alignItems: "flex-start" }}>
          <h3>No requirements yet</h3>
          <p className="muted" style={{ margin: 0 }}>Start with one sentence about what the bank wants. Claude Code can then ask about what is missing, and you approve it when it is complete.</p>
        </div>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          {rows.map((r) => (
            <Link key={r.id} href={`/requirements/${r.id}`} className="card" style={{ gap: 8 }}>
              <div className="row" style={{ gap: 8 }}>
                <span className={STATUS_CHIP[r.status]!.chip}>{STATUS_CHIP[r.status]!.label}</span>
                <span className="faint">v{r.version}</span>
                <div className="spacer" />
                <span className="faint">{r.criteria.length} criteria · {r.questions.filter((q) => !q.answer).length} open questions</span>
              </div>
              <h3 style={{ fontSize: 16 }}>{r.title}</h3>
              <p className="muted clamp" style={{ margin: 0, fontSize: 13 }}>{r.intent}</p>
              {r.status !== "approved" && r.blockers.length ? <div className="faint" style={{ fontSize: 12 }}>To approve: {r.blockers[0]}{r.blockers.length > 1 ? ` (+${r.blockers.length - 1} more)` : ""}</div> : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
