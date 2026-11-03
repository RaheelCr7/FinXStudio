import { createRequirement, listRequirements, withReadiness } from "@/lib/requirements";
import { requireCan } from "@/lib/people";
import { record } from "@/lib/activity";
import { fail, guardWrite, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** GET ?project=<id> lists requirements, newest change first, each with what still blocks its approval. */
export async function GET(req: Request) {
  try {
    const project = new URL(req.url).searchParams.get("project") ?? undefined;
    return json(req, (await listRequirements(project)).map(withReadiness));
  } catch (e) { return fail(e, req); }
}

/** Body: { title, intent, projectId?, actors?, steps?, rules?, fields?, operations?, compliance?, failures?, criteria? }. New list items get their ids (A-1, S-1, AC-1 …). */
export async function POST(req: Request) {
  const blocked = guardWrite(req); if (blocked) return blocked;
  try {
    const body = await req.json().catch(() => ({}));
    const who = await requireCan(req, "edit", typeof body?.projectId === "string" ? [body.projectId] : undefined);
    const r = await createRequirement(body);
    await record({ actor: { id: who.id, name: who.name }, action: "requirement.create", target: r.title, detail: `Requirement ${r.id} started as a draft`, projectIds: r.projectId ? [r.projectId] : undefined });
    return json(req, withReadiness(r), 201);
  } catch (e) { return fail(e, req); }
}
