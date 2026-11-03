"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, MessageCircleQuestion, Plus, Trash2 } from "lucide-react";
import { EDITABLE, RULE_KINDS, type Requirement } from "@finx/journey-schema";
import { useWho } from "./Who";
import { STATUS_CHIP } from "./RequirementsView";

type Full = Requirement & { blockers: string[] };
type Content = Pick<Requirement, (typeof EDITABLE)[number]>;
type Col = { key: string; label: string; options?: readonly string[]; wide?: boolean };

/** The lists of a requirement, each with the columns a person fills in. Ids are given on save. */
const LISTS: { key: "actors" | "steps" | "rules" | "fields" | "operations" | "failures" | "criteria"; title: string; hint: string; cols: Col[] }[] = [
  { key: "actors", title: "Who is involved", hint: "The initiator, the approver, whoever releases.", cols: [{ key: "name", label: "Name" }, { key: "role", label: "Role" }] },
  { key: "steps", title: "Steps", hint: "What happens, in order.", cols: [{ key: "text", label: "Step", wide: true }] },
  { key: "rules", title: "Business rules", hint: "Limits, cut-off times, whitelists, approval thresholds.", cols: [{ key: "kind", label: "Kind", options: RULE_KINDS }, { key: "text", label: "Rule", wide: true }] },
  { key: "fields", title: "Data", hint: "What is collected or shown.", cols: [{ key: "name", label: "Field" }, { key: "type", label: "Type" }, { key: "note", label: "Note", wide: true }] },
  { key: "operations", title: "What the bank's system must do", hint: "The operations the journey calls.", cols: [{ key: "name", label: "Operation" }, { key: "note", label: "Note", wide: true }] },
  { key: "failures", title: "What can go wrong", hint: "And what should happen then.", cols: [{ key: "text", label: "Failure", wide: true }] },
  { key: "criteria", title: "Acceptance criteria", hint: "What must be true. Each one gets tests when the journey is generated.", cols: [{ key: "text", label: "Criterion", wide: true }] },
];

const contentOf = (r: Requirement): Content => Object.fromEntries(EDITABLE.map((k) => [k, (r as any)[k]])) as Content;
const same = (a: Content, b: Content) => JSON.stringify(a) === JSON.stringify(b);

export function RequirementEditor({ id }: { id: string }) {
  const router = useRouter();
  const { can } = useWho();
  const [r, setR] = useState<Full | null>(null);
  const [draft, setDraft] = useState<Content | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false), [saving, setSaving] = useState(false), [err, setErr] = useState(""), [note, setNote] = useState("");
  const [ask, setAsk] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const load = async () => {
    const res = await fetch(`/api/requirements/${id}`);
    if (!res.ok) { setMissing(true); return; }
    const d: Full = await res.json();
    setR(d); setDraft(contentOf(d));
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const dirty = useMemo(() => !!r && !!draft && !same(contentOf(r), draft), [r, draft]);
  if (missing) return <div className="page"><Link href="/requirements" className="btn sm">← Requirements</Link><p className="muted" style={{ marginTop: 16 }}>There is no requirement called {id}.</p></div>;
  if (!r || !draft) return <div className="page"><p className="faint" role="status">Loading…</p></div>;
  const mayEdit = can("edit");

  async function call(path: string, method: string, body?: object, done?: (d: any) => void) {
    setBusy(true); setErr(""); setNote("");
    const res = await fetch(`/api/requirements/${id}${path}`, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(data.error ?? "That did not work"); return false; }
    done?.(data);
    return true;
  }
  const save = async () => { setSaving(true); await call("", "PATCH", draft, (d) => { setR(d); setDraft(contentOf(d)); setNote(d.resetApproval ? `Changed after approval: it is a draft again (version ${d.version}) and needs approving again.` : "Saved."); }); setSaving(false); };
  const set = <K extends keyof Content>(k: K, v: Content[K]) => setDraft({ ...draft, [k]: v });
  const edit = (key: (typeof LISTS)[number]["key"], i: number, col: string, v: string) => set(key, (draft[key] as any[]).map((x, n) => (n === i ? { ...x, [col]: v || undefined } : x)) as any);
  const add = (key: (typeof LISTS)[number]["key"]) => set(key, [...(draft[key] as any[]), key === "rules" ? { kind: "other", text: "" } : key === "fields" ? { name: "", type: "text" } : key === "actors" || key === "operations" ? { name: "" } : { text: "" }] as any);
  const remove = (key: (typeof LISTS)[number]["key"], i: number) => set(key, (draft[key] as any[]).filter((_, n) => n !== i) as any);
  const open = r.questions.filter((q) => !q.answer);

  return (
    <div className="page" style={{ maxWidth: 980 }}>
      <Link href="/requirements" className="btn sm">← Requirements</Link>
      <div className="row wrap" style={{ marginTop: 16, gap: 10 }}>
        <input className="input" style={{ flex: 1, minWidth: 260, fontSize: 20, fontWeight: 600, height: 42 }} value={draft.title} onChange={(e) => set("title", e.target.value)} disabled={!mayEdit} aria-label="Title" />
        <span className={STATUS_CHIP[r.status]!.chip}>{STATUS_CHIP[r.status]!.label}</span>
        <span className="faint">v{r.version}</span>
      </div>
      <p className="sub">{r.id}{r.approvedBy ? ` · approved by ${r.approvedBy}` : ""}</p>

      <div className="card" style={{ gap: 8, marginTop: 16 }}>
        <h3>What does the bank want, and why?</h3>
        <textarea className="textarea" value={draft.intent} onChange={(e) => set("intent", e.target.value)} disabled={!mayEdit} aria-label="Intent" />
      </div>

      {LISTS.map((L) => (
        <section key={L.key} className="card" style={{ gap: 8, marginTop: 14 }} aria-label={L.title}>
          <div className="row"><div><h3>{L.title}</h3><div className="faint" style={{ fontSize: 12 }}>{L.hint}</div></div><div className="spacer" /><button className="btn sm" onClick={() => add(L.key)} disabled={!mayEdit}><Plus size={13} aria-hidden />Add</button></div>
          {(draft[L.key] as any[]).length === 0 ? <div className="faint" style={{ fontSize: 13 }}>Nothing yet.</div> : null}
          {(draft[L.key] as any[]).map((item, i) => (
            <div key={i} className="row" style={{ gap: 8, alignItems: "center" }}>
              <span className="mono faint" style={{ width: 44 }}>{item.id ?? "new"}</span>
              {L.cols.map((c) => c.options ? (
                <select key={c.key} className="select" style={{ width: 120, flex: "none" }} value={item[c.key] ?? c.options[0]} onChange={(e) => edit(L.key, i, c.key, e.target.value)} disabled={!mayEdit} aria-label={`${L.title}: ${c.label} ${i + 1}`}>{c.options.map((o) => <option key={o} value={o}>{o}</option>)}</select>
              ) : (
                <input key={c.key} className="input" style={{ flex: c.wide ? 3 : 1, minWidth: 100 }} value={item[c.key] ?? ""} placeholder={c.label} onChange={(e) => edit(L.key, i, c.key, e.target.value)} disabled={!mayEdit} aria-label={`${L.title}: ${c.label} ${i + 1}`} />
              ))}
              {L.key === "criteria" && item.tests?.length ? <span className="chip pos">{item.tests.length} test{item.tests.length === 1 ? "" : "s"}</span> : null}
              <button className="btn sm icon ghost" onClick={() => remove(L.key, i)} disabled={!mayEdit} aria-label={`Remove ${L.title} ${i + 1}`}><Trash2 size={13} aria-hidden /></button>
            </div>
          ))}
        </section>
      ))}

      <section className="card" style={{ gap: 8, marginTop: 14 }} aria-label="Compliance">
        <div className="row"><div><h3>Compliance</h3><div className="faint" style={{ fontSize: 12 }}>What a regulator or the bank's policy requires, in words.</div></div><div className="spacer" /><button className="btn sm" onClick={() => set("compliance", [...draft.compliance, ""])} disabled={!mayEdit}><Plus size={13} aria-hidden />Add</button></div>
        {draft.compliance.length === 0 ? <div className="faint" style={{ fontSize: 13 }}>Nothing yet.</div> : null}
        {draft.compliance.map((c, i) => (
          <div key={i} className="row" style={{ gap: 8 }}>
            <input className="input" style={{ flex: 1 }} value={c} onChange={(e) => set("compliance", draft.compliance.map((x, n) => (n === i ? e.target.value : x)))} disabled={!mayEdit} aria-label={`Compliance ${i + 1}`} />
            <button className="btn sm icon ghost" onClick={() => set("compliance", draft.compliance.filter((_, n) => n !== i))} disabled={!mayEdit} aria-label={`Remove compliance ${i + 1}`}><Trash2 size={13} aria-hidden /></button>
          </div>
        ))}
      </section>

      <div className="card" style={{ gap: 8, marginTop: 14 }}>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className="btn primary" disabled={!dirty || busy || !mayEdit} onClick={save}>{saving ? "Saving…" : "Save changes"}</button>
          {dirty ? <button className="btn" onClick={() => setDraft(contentOf(r))}>Discard changes</button> : null}
          {r.status === "approved" ? <span className="faint">Saving a change to an approved requirement takes it back to a draft.</span> : null}
        </div>
        {err ? <div role="alert" style={{ color: "var(--negative)", fontSize: 13 }}>{err}</div> : null}
        {note ? <div role="status" className="faint">{note}</div> : null}
      </div>

      <section className="card" style={{ gap: 10, marginTop: 14 }} aria-label="Questions">
        <h3><MessageCircleQuestion size={16} aria-hidden style={{ verticalAlign: "-3px" }} /> Questions</h3>
        <div className="faint" style={{ fontSize: 12 }}>Gaps asked about by Claude Code or a person. The requirement waits for the answers.</div>
        {r.questions.length === 0 ? <div className="faint" style={{ fontSize: 13 }}>No questions.</div> : null}
        {r.questions.map((q) => (
          <div key={q.id} className="stack" style={{ gap: 6, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
            <div className="row" style={{ gap: 8 }}><span className="mono faint">{q.id}</span><b>{q.text}</b><div className="spacer" /><span className="faint">{q.by}</span></div>
            {q.answer ? <div style={{ marginInlineStart: 52 }}>{q.answer} <span className="faint">· {q.answeredBy}</span></div> : (
              <div className="row" style={{ gap: 8, marginInlineStart: 52 }}>
                <input className="input" style={{ flex: 1 }} value={answers[q.id] ?? ""} placeholder="Your answer" onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} disabled={!mayEdit} aria-label={`Answer ${q.id}`} />
                <button className="btn" disabled={busy || !mayEdit || !(answers[q.id] ?? "").trim()} onClick={() => call("/questions", "PATCH", { questionId: q.id, answer: answers[q.id] }, (d) => { setR(d); setAnswers({ ...answers, [q.id]: "" }); })}>Answer</button>
              </div>
            )}
          </div>
        ))}
        <div className="row" style={{ gap: 8 }}>
          <input className="input" style={{ flex: 1 }} value={ask} placeholder="Ask about something missing" onChange={(e) => setAsk(e.target.value)} disabled={!mayEdit} aria-label="New question" />
          <button className="btn" disabled={busy || !mayEdit || !ask.trim()} onClick={() => call("/questions", "POST", { text: ask }, (d) => { setR(d); setAsk(""); })}>Ask</button>
        </div>
      </section>

      <section className="card" style={{ gap: 8, marginTop: 14, marginBottom: 40 }} aria-label="Approval">
        <h3><CheckCircle2 size={16} aria-hidden style={{ verticalAlign: "-3px" }} /> Approval</h3>
        {r.status === "approved" ? (
          <div className="faint">Approved by {r.approvedBy} as version {r.version}. A journey can now be generated from it.</div>
        ) : (
          <>
            {dirty ? <div className="faint">Save your changes first: approval is for what is saved.</div> : null}
            {r.blockers.length ? <ul style={{ margin: 0, paddingInlineStart: 18 }}>{r.blockers.map((b) => <li key={b}>{b}</li>)}</ul> : <div className="faint">Everything needed is here.</div>}
            <div><button className="btn primary" disabled={busy || dirty || r.blockers.length > 0 || open.length > 0 || !can("publish")} title={can("publish") ? undefined : "Your role cannot approve. Ask a Reviewer or Admin."} onClick={async () => { if (await call("/approve", "POST", undefined, (d) => setR(d))) router.refresh(); }}>Approve</button></div>
          </>
        )}
      </section>
    </div>
  );
}
