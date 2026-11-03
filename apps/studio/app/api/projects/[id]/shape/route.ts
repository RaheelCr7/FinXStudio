import { getProjectShape, updateProjectShape } from "@/lib/projects";
import { requireCan } from "@/lib/people";
import { record } from "@/lib/activity";
import { fail, guardWrite, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** The project's channels, languages and entities (with today's single-bank settings filling anything unset). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return json(req, await getProjectShape((await params).id)); } catch (e) { return fail(e, req); }
}

/** Body: any of { channels, languages, customLanguages, entities } (needs the projects permission). The answer includes the previous shape, to undo. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = guardWrite(req); if (blocked) return blocked;
  try {
    const who = await requireCan(req, "projects");
    const { id } = await params;
    const { project, shape, previous } = await updateProjectShape(id, await req.json());
    await record({ actor: { id: who.id, name: who.name }, action: "project.update", target: project.name, detail: `Channels, languages or entities changed (${shape.entities.length} ${shape.entities.length === 1 ? "entity" : "entities"}, ${shape.languages.join("/")})`, projectIds: [project.id] });
    return json(req, { id: project.id, shape, previous });
  } catch (e) { return fail(e, req); }
}
