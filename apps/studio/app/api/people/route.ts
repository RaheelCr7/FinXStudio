import { actorOf, addPerson, listPeople, requireCan } from "@/lib/people";
import { fail, guardWrite, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** The people, and who is acting right now. */
export async function GET(req: Request) {
  try { return json(req, { people: await listPeople(), you: await actorOf(req) }); } catch (e) { return fail(e, req); }
}
/** Body: { name, role }. Admin only. */
export async function POST(req: Request) {
  const blocked = guardWrite(req); if (blocked) return blocked;
  try { await requireCan(req, "people"); return json(req, await addPerson(await req.json()), 201); } catch (e) { return fail(e, req); }
}
