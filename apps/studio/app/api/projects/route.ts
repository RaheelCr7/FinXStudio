import { cloneJourney, listJourneys } from "@/lib/store";
import { createProject, listProjects } from "@/lib/projects";
import { fail, guardWrite, json, preflight } from "@/lib/http";
import { actorOf, requireCan } from "@/lib/people";
import { can } from "@/lib/roles";
import { PRESETS } from "@finx/ui-kit";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

const appsOf = (j: { apps?: string[] }) => (j.apps?.length ? j.apps : ["meezan"]);

/** The projects, how many journeys each has, and the published journeys a new project could start from. */
export async function GET(req: Request) {
  try {
    const [projects, journeys] = await Promise.all([listProjects(), listJourneys()]);
    return json(req, {
      projects: projects.map((p) => ({
        ...p, journeys: journeys.filter((j) => appsOf(j).includes(p.id)).length,
        live: journeys.filter((j) => appsOf(j).includes(p.id) && j.publishedVersion != null).length,
      })),
      presets: PRESETS,
      starters: journeys.filter((j) => j.publishedVersion != null).map((j) => ({ slug: j.slug, name: j.name, apps: appsOf(j), screens: j.screens })),
    });
  } catch (e) { return fail(e, req); }
}

export async function POST(req: Request) {
  const blocked = guardWrite(req); if (blocked) return blocked;
  try {
    await requireCan(req, "projects");
    const who = await actorOf(req);
    // starters go live only when the person is allowed to publish; otherwise they arrive as drafts to be reviewed
    const body = await req.json();
    const goLive = can(who.role, "publish") && body.publishStarters !== false;
    const created = await createProject({ name: body.name, bundleId: body.bundleId, preset: body.preset, accent: body.accent, currency: body.currency });
    const started: string[] = [], failed: { slug: string; error: string }[] = [];
    for (const slug of Array.isArray(body.starters) ? body.starters.slice(0, 20) : []) {
      try { await cloneJourney(String(slug), created.project.id, { publishNow: goLive }); started.push(`${slug}-${created.project.id}`); }
      catch (e: any) { failed.push({ slug: String(slug), error: e?.message ?? "Could not copy" }); }
    }
    return json(req, { ...created, started, failed, startersPublished: goLive }, 201);
  } catch (e) { return fail(e, req); }
}
