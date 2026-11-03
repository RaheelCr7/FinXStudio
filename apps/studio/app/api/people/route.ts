import { actorOf, addPerson, listPeople, requireCan } from "@/lib/people";
import { listRoles } from "@/lib/access";
import { record } from "@/lib/activity";
import { roleLabel } from "@/lib/roles";
import { fail, guardWrite, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** The people, and who is acting right now. */
export async function GET(req: Request) {
  try { return json(req, { people: await listPeople(), you: await actorOf(req) }); } catch (e) { return fail(e, req); }
}
/** Body: { name, role, access? }. Needs the people permission. */
export async function POST(req: Request) {
  const blocked = guardWrite(req); if (blocked) return blocked;
  try {
    const who = await requireCan(req, "people");
    const person = await addPerson(await req.json());
    await record({ actor: { id: who.id, name: who.name }, action: "person.add", target: person.name, detail: `Role: ${roleLabel(person.role, await listRoles())}` });
    return json(req, person, 201);
  } catch (e) { return fail(e, req); }
}
