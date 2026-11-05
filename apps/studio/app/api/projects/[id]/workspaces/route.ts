import { updateProjectWorkspace } from "@/lib/projects";
import { requireCan } from "@/lib/people";
import { record } from "@/lib/activity";
import { fail, guardWrite, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** Body: { workspace: "personal" | "business", theme }, the look of that workspace, or theme null to follow the bank's own look (needs the projects permission). The answer includes the previous theme, to undo. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = guardWrite(req); if (blocked) return blocked;
  try {
    const who = await requireCan(req, "projects");
    const { id } = await params;
    const body = await req.json();
    const { project, previous } = await updateProjectWorkspace(id, body.workspace, body.theme ?? null);
    await record({ actor: { id: who.id, name: who.name }, action: "project.update", target: project.name, detail: `${body.workspace} workspace look ${body.theme ? "changed" : "reset"}`, projectIds: [project.id] });
    return json(req, { id: project.id, workspace: body.workspace, theme: project.workspaces?.[body.workspace as "personal" | "business"] ?? null, previous: previous ?? null });
  } catch (e) { return fail(e, req); }
}
