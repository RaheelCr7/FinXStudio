import { removePerson, requireCan, updatePerson } from "@/lib/people";
import { fail, guardWrite, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
type Ctx = { params: Promise<{ id: string }> };

/** Body: { name?, role? }. Admin only. */
export async function PATCH(req: Request, { params }: Ctx) {
  const blocked = guardWrite(req); if (blocked) return blocked;
  try { await requireCan(req, "people"); return json(req, await updatePerson((await params).id, await req.json())); } catch (e) { return fail(e, req); }
}
export async function DELETE(req: Request, { params }: Ctx) {
  const blocked = guardWrite(req); if (blocked) return blocked;
  try { await requireCan(req, "people"); await removePerson((await params).id); return json(req, { removed: true }); } catch (e) { return fail(e, req); }
}
