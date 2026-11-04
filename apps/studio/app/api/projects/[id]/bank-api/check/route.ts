import { runScenarios } from "@finx/mcp/proof";
import { isProviderId, PROVIDERS } from "@finx/mock-bank-api";
import { listJourneys, getRecord, StoreError } from "@/lib/store";
import { getProject } from "@/lib/projects";
import { appsOfJourney } from "@/lib/project-utils";
import { fail, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/**
 * Runs the tests of every journey in the project that carries scenarios against a bank API (the chosen one by default) and says
 * which still pass. Nothing is saved: it answers "would my journeys still work if I switched to that API?".
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const project = await getProject(id);
    if (!project) throw new StoreError(404, "No such project");
    const body = await req.json().catch(() => ({})) as { bankApi?: string };
    const provider = isProviderId(body.bankApi) ? body.bankApi : isProviderId(project.bankApi) ? project.bankApi : PROVIDERS[0]!;
    const journeys = [];
    for (const row of await listJourneys()) {
      const { draft } = await getRecord(row.slug);
      if (!appsOfJourney(draft).includes(id) || !draft.scenarios?.length) continue;
      const r = await runScenarios(draft, { provider });
      journeys.push({ slug: draft.slug, name: typeof draft.name === "string" ? draft.name : draft.name.en ?? draft.slug, total: r.total, passed: r.passed, failing: r.results.filter((x) => !x.ok).map((x) => ({ id: x.id, name: x.name, failures: x.failures.slice(0, 2) })), uncovered: r.uncovered });
    }
    return json(req, { bankApi: provider, journeys });
  } catch (e) { return fail(e, req); }
}
