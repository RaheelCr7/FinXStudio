import { fail, guardWrite, json, preflight } from "@/lib/http";
import { actorOf, requireCan } from "@/lib/people";
import { setPassword } from "@/lib/credentials";
import { appendAudit } from "@/lib/audit";
import { isProduction } from "@/lib/profile";
import { StoreError } from "@/lib/store";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** Sets a password: your own, or anyone's if you may manage people. The password is never stored or returned in clear. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = guardWrite(req); if (blocked) return blocked;
  try {
    if (!isProduction()) throw new StoreError(404, "Passwords are only used in the production profile");
    const { id } = await params;
    const me = await actorOf(req);
    const who = me.id === id ? me : await requireCan(req, "people");
    const body = await req.json().catch(() => ({})) as { password?: unknown };
    await setPassword(id, body.password);
    await appendAudit({ actor: who.id, action: "auth.password", target: id });
    return json(req, { ok: true });
  } catch (e) { return fail(e, req); }
}
