import { deleteRequirement, getRequirement, updateRequirement, withReadiness } from "@/lib/requirements";
import { requireCan } from "@/lib/people";
import { record } from "@/lib/activity";
import { fail, guardWrite, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try { return json(req, withReadiness(await getRequirement((await params).id))); } catch (e) { return fail(e, req); }
}

/** Body: any of the editable parts (title, intent, actors, steps, rules, fields, operations, compliance, failures, criteria, projectId). Changing an approved requirement takes it back to a draft. */
export async function PATCH(req: Request, { params }: Ctx) {
  const blocked = guardWrite(req); if (blocked) return blocked;
  try {
    const { id } = await params;
    const cur = await getRequirement(id);
    const who = await requireCan(req, "edit", cur.projectId ? [cur.projectId] : undefined);
    const { requirement, resetApproval } = await updateRequirement(id, await req.json().catch(() => ({})));
    await record({ actor: { id: who.id, name: who.name }, action: "requirement.edit", target: requirement.title, detail: resetApproval ? `Changed after approval: back to draft, now version ${requirement.version}` : undefined, projectIds: requirement.projectId ? [requirement.projectId] : undefined });
    return json(req, { ...withReadiness(requirement), resetApproval });
  } catch (e) { return fail(e, req); }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const blocked = guardWrite(req); if (blocked) return blocked;
  try {
    const { id } = await params;
    const cur = await getRequirement(id);
    const who = await requireCan(req, "edit", cur.projectId ? [cur.projectId] : undefined);
    await deleteRequirement(id);
    await record({ actor: { id: who.id, name: who.name }, action: "requirement.delete", target: cur.title, projectIds: cur.projectId ? [cur.projectId] : undefined });
    return json(req, { ok: true });
  } catch (e) { return fail(e, req); }
}
