import { guardWrite, json, preflight } from "@/lib/http";
import { clearedSessionCookie, cookieValue, verifySession } from "@/lib/session";
import { appendAudit } from "@/lib/audit";
import { COOKIE_SESSION, isProduction } from "@/lib/profile";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
export async function POST(req: Request) {
  const blocked = guardWrite(req); if (blocked) return blocked;
  if (isProduction()) {
    const who = verifySession(cookieValue(req.headers.get("cookie"), COOKIE_SESSION));
    if (who) await appendAudit({ actor: who, action: "auth.logout", target: "sign-in" });
  }
  const res = json(req, { ok: true });
  res.headers.append("Set-Cookie", clearedSessionCookie());
  return res;
}
