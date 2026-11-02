import Link from "next/link";
import { listRuns, type RunStatus } from "@/lib/store";
import { AGENT_LABEL, fmtTime, STATUS } from "@/lib/runs-ui";
import { NewAiTask } from "@/components/NewAiTask";
import { AutoRefresh } from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";
const COLUMNS: RunStatus[] = ["running", "needs_review", "done", "failed"];

export default async function AgentsPage() {
  const runs = await listRuns();
  const anyRunning = runs.some((r) => r.status === "running");
  return (
    <main className="page">
      {anyRunning ? <AutoRefresh /> : null}
      <div className="row" style={{ alignItems: "flex-end" }}>
        <div>
          <h1>Agents</h1>
          <p className="sub">AI work in progress and waiting for you. Nothing an agent builds goes live until a person publishes it.</p>
        </div>
      </div>
      <div style={{ marginTop: 24 }}><NewAiTask /></div>

      {runs.length === 0 ? (
        <div className="card" style={{ marginTop: 24, alignItems: "flex-start" }}>
          <h3>Start your first AI task</h3>
          <p className="muted" style={{ margin: 0 }}>Describe a journey above and run the command. Its progress and result appear here.</p>
        </div>
      ) : (
        <div className="board" style={{ marginTop: 24 }}>
          {COLUMNS.map((status) => {
            const items = runs.filter((r) => r.status === status);
            return (
              <section key={status} aria-label={STATUS[status].label}>
                <div className="row" style={{ marginBottom: 10 }}><span className={STATUS[status].chip}>{STATUS[status].label}</span><span className="faint">{items.length}</span></div>
                <div className="stack">
                  {items.map((r) => (
                    <Link key={r.id} href={`/agents/${r.id}`} className="card">
                      <div className="row"><span className="chip">{AGENT_LABEL[r.agent] ?? r.agent}</span><div className="spacer" /><span className="faint">{fmtTime(r.updatedAt)}</span></div>
                      <h3 style={{ fontSize: 15 }}>{r.title}</h3>
                      <p className="muted clamp" style={{ margin: 0, fontSize: 13 }}>{r.summary ?? r.steps.at(-1)?.text}</p>
                      {r.journeySlug ? <div><span className="chip">/{r.journeySlug}</span></div> : null}
                    </Link>
                  ))}
                  {items.length === 0 ? <div className="faint">Nothing here</div> : null}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
