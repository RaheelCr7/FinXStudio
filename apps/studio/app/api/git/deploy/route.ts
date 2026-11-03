import { deploy } from "@/lib/gitsync";
import { requireCan } from "@/lib/people";
import { fail, guardWrite, json, preflight } from "@/lib/http";
import { record } from "@/lib/activity";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** Deploys the project's published journeys: { project, note? }. Writes them to git, tags the commit and pushes the tag. */
export async function POST(req: Request) {
  const denied = guardWrite(req); if (denied) return denied;
  try {
    const b = await req.json().catch(() => ({})) as { project?: string; note?: string };
    const project = String(b.project ?? "");
    const who = await requireCan(req, "publish", [project]);
    const result = await deploy(project, { id: who.id, name: who.name }, typeof b.note === "string" ? b.note.slice(0, 200) : "");
    await record({ actor: { id: who.id, name: who.name }, action: "project.deploy", target: project, detail: `Deploy tag ${result.tag} (${result.journeys.length} journeys)`, projectIds: [project] });
    return json(req, result);
  } catch (e) { return fail(e, req); }
}
