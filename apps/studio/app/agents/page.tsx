import Link from "next/link";
import { listJourneys, listRuns, type RunStatus } from "@/lib/store";
import { AGENT_LABEL, fmtTime, STATUS } from "@/lib/runs-ui";
import { ageOf, isStale, outcomeOf } from "@/lib/ai-brief";
import { NewAiTask } from "@/components/NewAiTask";
import { AutoRefresh } from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";
const COLUMNS: RunStatus[] = ["needs_review", "running", "done", "failed"];
const text = (t: unknown) => (typeof t === "string" ? t : (t as { en?: string } | undefined)?.en ?? "");

/** Build and check journeys with AI, and see what the runs left for you. */
export default async function AgentsPage() {
  const [runs, journeys] = await Promise.all([listRuns(), listJourneys()]);
  const now = Date.now();
  const anyRunning = runs.some((r) => r.status === "running" && !isStale(r.status, r.updatedAt, now));
  const picks = journeys.map((j) => ({ slug: j.slug, name: text(j.name) || j.slug })).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <main className="page">
      {anyRunning ? <AutoRefresh /> : null}
      <div className="row" style={{ alignItems: "flex-end" }}>
        <div>
          <h1>AI assistant</h1>
          <p className="sub">Say what you want in plain words. Claude builds the draft here for you to review.</p>
        </div>
      </div>
      <div style={{ marginTop: 24 }}><NewAiTask journeys={picks} /></div>

      {runs.length === 0 ? (
        <div className="card" style={{ marginTop: 24, alignItems: "flex-start" }}>
          <h3>Nothing yet</h3>
          <p className="muted" style={{ margin: 0 }}>Describe a journey above and run the command. Its progress and result appear here.</p>
        </div>
      ) : (
        <div className="board" style={{ marginTop: 24 }}>
          {COLUMNS.map((status) => {
            const items = runs.filter((r) => r.status === status);
            if (items.length === 0) return null;
            return (
              <section key={status} aria-label={STATUS[status].label}>
                <div className="row" style={{ marginBottom: 10 }}><span className={STATUS[status].chip}>{STATUS[status].label}</span><span className="faint">{items.length}</span></div>
                <div className="stack">
                  {items.map((r) => {
                    const stale = isStale(r.status, r.updatedAt, now);
                    const outcome = outcomeOf(r.summary) || r.steps.at(-1)?.text || "";
                    return (
                      <article key={r.id} className="card run" aria-label={r.title}>
                        <div className="row"><span className="chip">{AGENT_LABEL[r.agent] ?? r.agent}</span><div className="spacer" /><span className="faint" title={fmtTime(r.updatedAt)}>{ageOf(r.updatedAt, now)}</span></div>
                        <h3 style={{ fontSize: 15 }}><Link href={`/agents/${r.id}`}>{r.title}</Link></h3>
                        {outcome ? <p className="muted clamp" style={{ margin: 0, fontSize: 13 }}>{outcome}</p> : null}
                        {stale ? <p className="faint" style={{ margin: 0 }}>No news for {ageOf(r.updatedAt, now).replace(" ago", "")}. The command has probably stopped; check the terminal or run it again.</p> : null}
                        <div className="row wrap">
                          {r.journeySlug ? <Link href={`/journeys/${r.journeySlug}`} className="btn sm primary">{status === "needs_review" ? "Review the draft" : "Open the journey"}</Link> : null}
                          <Link href={`/agents/${r.id}`} className="btn sm">{status === "needs_review" ? "What to check" : "Details"}</Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
