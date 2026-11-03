import { listPeople, removePerson, requireCan, updatePerson } from "@/lib/people";
import { listRoles } from "@/lib/access";
import { record } from "@/lib/activity";
import { roleLabel } from "@/lib/roles";
import { fail, guardWrite, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
type Ctx = { params: Promise<{ id: string }> };

/** Body: { name?, role?, access? }. access is { projectId: roleId } to set a role in one project, or null for a project to clear it. Needs the people permission. */
export async function PATCH(req: Request, { params }: Ctx) {
  const blocked = guardWrite(req); if (blocked) return blocked;
  try {
    const who = await requireCan(req, "people");
    const { id } = await params;
    const body = await req.json();
    const before = (await listPeople()).find((p) => p.id === id);
    const after = await updatePerson(id, body);
    const defs = await listRoles();
    const actor = { id: who.id, name: who.name };
    if (before && before.role !== after.role) await record({ actor, action: "person.role", target: after.name, detail: `${roleLabel(before.role, defs)} to ${roleLabel(after.role, defs)}` });
    if (body.access !== undefined) {
      for (const [project, role] of Object.entries(after.access ?? {})) if (before?.access?.[project] !== role) await record({ actor, action: "person.access", target: after.name, detail: `${roleLabel(role, defs)} in ${project}`, projectIds: [project] });
      for (const project of Object.keys(before?.access ?? {})) if (!after.access?.[project]) await record({ actor, action: "person.access", target: after.name, detail: `Back to ${roleLabel(after.role, defs)} in ${project}`, projectIds: [project] });
    }
    if (before && before.name !== after.name) await record({ actor, action: "person.rename", target: after.name, detail: `Was ${before.name}` });
    return json(req, after);
  } catch (e) { return fail(e, req); }
}
export async function DELETE(req: Request, { params }: Ctx) {
  const blocked = guardWrite(req); if (blocked) return blocked;
  try {
    const who = await requireCan(req, "people");
    const { id } = await params;
    const name = (await listPeople()).find((p) => p.id === id)?.name ?? id;
    await removePerson(id);
    await record({ actor: { id: who.id, name: who.name }, action: "person.remove", target: name });
    return json(req, { removed: true });
  } catch (e) { return fail(e, req); }
}
