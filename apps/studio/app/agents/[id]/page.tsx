import Link from "next/link";
import { notFound } from "next/navigation";
import { getRecord, getRun, StoreError } from "@/lib/store";
import { AGENT_LABEL, fmtTime, STATUS } from "@/lib/runs-ui";
import { AutoRefresh } from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let run;
  try { run = await getRun(id); } catch (e) { if (e instanceof StoreError) notFound(); throw e; }
  const rec = run.journeySlug ? await getRecord(run.journeySlug).catch(() => null) : null;
  const text = (t: any) => (typeof t === "string" ? t : t?.en ?? "");
  return (
    <main className="page" style={{ maxWidth: 860 }}>
      {run.status === "running" ? <AutoRefresh /> : null}
      <Link href="/agents" className="btn sm">← Agents</Link>
      <div className="row wrap" style={{ marginTop: 16 }}>
        <h1 style={{ fontSize: 24 }}>{run.title}</h1>
        <span className={STATUS[run.status].chip}>{STATUS[run.status].label}</span>
      </div>
      <p className="sub">{AGENT_LABEL[run.agent] ?? run.agent} · started {fmtTime(run.startedAt)} · updated {fmtTime(run.updatedAt)} · {run.id}</p>

      {rec ? (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="row wrap">
            <div><div className="faint">Journey</div><h3>{text(rec.draft.name)}</h3></div>
            <div className="spacer" />
            {rec.published ? <span className="chip pos">Published v{rec.published.version}</span> : <span className="chip">Not published</span>}
            <Link href={`/journeys/${rec.slug}`} className="btn primary">{run.status === "needs_review" ? "Review in builder" : "Open in builder"}</Link>
          </div>
          <div className="muted" style={{ fontSize: 13 }}>{rec.draft.screens.length} screens · /{rec.slug}</div>
        </div>
      ) : null}

      {run.summary ? (<><div className="label-section">Summary</div><div className="card" style={{ whiteSpace: "pre-wrap" }}>{run.summary}</div></>) : null}
      {run.brief ? (<><div className="label-section">Brief</div><div className="card muted" style={{ whiteSpace: "pre-wrap" }}>{run.brief}</div></>) : null}

      <div className="label-section">Progress</div>
      <ol className="timeline">
        {run.steps.map((s, i) => (<li key={i}><span className="faint">{fmtTime(s.at)}</span><span>{s.text}</span></li>))}
      </ol>
    </main>
  );
}
