import { updateProjectAccent } from "@/lib/projects";
import { requireCan } from "@/lib/people";
import { fail, guardWrite, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** Body: { accent }. Changes the project's brand colour (needs the projects permission). The answer includes the previous colour, to undo. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = guardWrite(req); if (blocked) return blocked;
  try {
    await requireCan(req, "projects");
    const { id } = await params;
    const body = await req.json();
    const { project, previous, iconsMade, iconWarning } = await updateProjectAccent(id, body.accent);
    return json(req, { id: project.id, accent: project.accent, previous, iconsMade, iconWarning });
  } catch (e) { return fail(e, req); }
}
