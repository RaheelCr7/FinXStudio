import { updateProjectComponents } from "@/lib/projects";
import { requireCan } from "@/lib/people";
import { record } from "@/lib/activity";
import { fail, guardWrite, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** Body: { components }, the sizes of the shared components (needs the projects permission). The answer includes the previous overrides, to undo. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = guardWrite(req); if (blocked) return blocked;
  try {
    const who = await requireCan(req, "projects");
    const { id } = await params;
    const body = await req.json();
    const { project, previous } = await updateProjectComponents(id, body.components);
    await record({ actor: { id: who.id, name: who.name }, action: "project.update", target: project.name, detail: "Component sizes changed", projectIds: [project.id] });
    return json(req, { id: project.id, components: project.components ?? {}, previous: previous ?? {} });
  } catch (e) { return fail(e, req); }
}
