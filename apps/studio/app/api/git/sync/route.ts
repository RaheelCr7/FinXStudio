import { sync, type Resolution } from "@/lib/gitsync";
import { requireCan } from "@/lib/people";
import { fail, guardWrite, json, preflight } from "@/lib/http";
import { record } from "@/lib/activity";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** Syncs a project's drafts with git: { project, resolutions?: { slug: "studio" | "git" }, push?: boolean }. Conflicts stay untouched unless resolved here. */
export async function POST(req: Request) {
  const denied = guardWrite(req); if (denied) return denied;
  try {
    const b = await req.json().catch(() => ({})) as { project?: string; resolutions?: Record<string, Resolution>; push?: boolean };
    const project = String(b.project ?? "");
    const who = await requireCan(req, "edit", [project]);
    const resolutions = Object.fromEntries(Object.entries(b.resolutions ?? {}).filter(([, v]) => v === "studio" || v === "git")) as Record<string, Resolution>;
    const result = await sync(project, { id: who.id, name: who.name }, { resolutions, push: b.push });
    await record({ actor: { id: who.id, name: who.name }, action: "project.git", target: project, detail: `Git sync: ${result.pushed.length} pushed, ${result.pulled.length + result.created.length} pulled`, projectIds: [project] });
    return json(req, result);
  } catch (e) { return fail(e, req); }
}
