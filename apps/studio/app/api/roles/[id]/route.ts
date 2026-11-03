import { deleteRole, listRoles, updateRole } from "@/lib/access";
import { record } from "@/lib/activity";
import { fail, guardWrite, json, preflight } from "@/lib/http";
import { ACTION_LABEL } from "@/lib/roles";
import { listPeople, managers, requireCan } from "@/lib/people";
import { StoreError } from "@/lib/store";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
type Ctx = { params: Promise<{ id: string }> };

/** Body: { label?, blurb?, actions? }. Changes a role of your own; the built-in four cannot be changed. */
export async function PATCH(req: Request, { params }: Ctx) {
  const blocked = guardWrite(req); if (blocked) return blocked;
  try {
    const who = await requireCan(req, "people");
    const { id } = await params;
    const body = await req.json();
    const before = await listRoles();
    const role = await updateRole(id, body);
    // changing what a role can do must not leave Studio without anyone who can manage people
    const after = before.map((r) => (r.id === id ? role : r));
    if (!managers(await listPeople(), after).length) {
      await updateRole(id, before.find((r) => r.id === id)!);
      throw new StoreError(409, "That would leave nobody able to manage people. Keep that permission on a role someone holds.");
    }
    await record({ actor: { id: who.id, name: who.name }, action: "role.update", target: role.label, detail: `Can: ${role.actions.map((a) => ACTION_LABEL[a]).join(", ")}` });
    return json(req, role);
  } catch (e) { return fail(e, req); }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const blocked = guardWrite(req); if (blocked) return blocked;
  try {
    const who = await requireCan(req, "people");
    const { id } = await params;
    const label = (await listRoles()).find((r) => r.id === id)?.label ?? id;
    const users = (await listPeople()).filter((p) => p.role === id || Object.values(p.access ?? {}).includes(id)).map((p) => p.name);
    await deleteRole(id, users);
    await record({ actor: { id: who.id, name: who.name }, action: "role.delete", target: label });
    return json(req, { removed: true });
  } catch (e) { return fail(e, req); }
}
