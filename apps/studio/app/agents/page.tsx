import Link from "next/link";
import { listJourneys, listRuns } from "@/lib/store";
import { AGENT_LABEL, fmtTime, STATUS } from "@/lib/runs-ui";
import { ageOf, isStale, outcomeOf } from "@/lib/ai-brief";
import { NewAiTask } from "@/components/NewAiTask";
import { AutoRefresh } from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";
const ORDER = { needs_review: 0, running: 1, failed: 2, done: 3 } as const;
const SHOWN = 6;
const text = (t: unknown) => (typeof t === "string" ? t : (t as { en?: string } | undefined)?.en ?? "");

/** One prompt: say what you want, Claude drafts it. Below, what the recent runs left for you. */
export default async function AgentsPage() {
  const [runs, journeys] = await Promise.all([listRuns(), listJourneys()]);
  const now = Date.now();
  const anyRunning = runs.some((r) => r.status === "running" && !isStale(r.status, r.updatedAt, now));
  const picks = journeys.map((j) => ({ slug: j.slug, name: text(j.name) || j.slug })).sort((a, b) => a.name.localeCompare(b.name));
  const sorted = [...runs].sort((a, b) => ORDER[a.status] - ORDER[b.status] || b.updatedAt.localeCompare(a.updatedAt));
  const waiting = runs.filter((r) => r.status === "needs_review").length;
  const row = (r: (typeof runs)[number]) => {
    const stale = isStale(r.status, r.updatedAt, now);
    const status = stale ? "Stopped?" : STATUS[r.status].label;
    return (
      <li key={r.id} className="ai-run">
        <span className={stale ? "chip" : STATUS[r.status].chip}>{status}</span>
        <div className="ai-run-t">
          <Link href={`/agents/${r.id}`}>{r.title}</Link>
          <span className="faint">{AGENT_LABEL[r.agent] ?? r.agent} · <span title={fmtTime(r.updatedAt)}>{ageOf(r.updatedAt, now)}</span>{outcomeOf(r.summary, 90) ? <> · {outcomeOf(r.summary, 90)}</> : null}</span>
        </div>
        {r.journeySlug && r.status === "needs_review" ? <Link href={`/journeys/${r.journeySlug}`} className="btn sm primary">Review the draft</Link> : r.journeySlug ? <Link href={`/journeys/${r.journeySlug}`} className="btn sm">Open</Link> : null}
      </li>
    );
  };
  return (
    <main className="page ai-page">
      {anyRunning ? <AutoRefresh /> : null}
      <div className="ai-hero">
        <h1>What do you want to build?</h1>
        <p className="sub">Say it in plain words. Claude drafts it for you to review.</p>
      </div>
      <NewAiTask journeys={picks} />

      {sorted.length > 0 ? (
        <section className="ai-recent" aria-label="Recent runs">
          <div className="row"><h3>Recent</h3>{waiting ? <span className="chip warn">{waiting} waiting for you</span> : null}</div>
          <ul>{sorted.slice(0, SHOWN).map(row)}</ul>
          {sorted.length > SHOWN ? <details><summary className="link-btn">Show {sorted.length - SHOWN} older</summary><ul>{sorted.slice(SHOWN).map(row)}</ul></details> : null}
        </section>
      ) : null}
    </main>
  );
}
