import { getConfig, plan, setConfig } from "@/lib/gitsync";
import { actorOf, requireCan } from "@/lib/people";
import { fail, guardWrite, json, preflight } from "@/lib/http";
import { record } from "@/lib/activity";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** A project's git folder and what would happen if it were synced now. Query: project, pull=1 to pull from the remote first. */
export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams;
    const project = q.get("project") ?? "";
    const config = (await getConfig(project)) ?? null;
    return json(req, { config, plan: config ? await plan(project, { pull: q.get("pull") === "1" }) : null });
  } catch (e) { return fail(e, req); }
}

/** Sets the git folder of a project: { project, dir, branch? }. */
export async function PUT(req: Request) {
  const denied = guardWrite(req); if (denied) return denied;
  try {
    const who = await requireCan(req, "projects");
    const b = await req.json().catch(() => ({})) as { project?: string; dir?: string; branch?: string };
    const config = await setConfig(String(b.project ?? ""), b);
    await record({ actor: { id: who.id, name: who.name }, action: "project.git", target: String(b.project), detail: `Git folder set to ${config.dir} (${config.branch})`, projectIds: [String(b.project)] });
    return json(req, { config });
  } catch (e) { return fail(e, req); }
}
