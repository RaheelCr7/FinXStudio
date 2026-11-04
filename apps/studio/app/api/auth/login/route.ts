import { NextResponse } from "next/server";
import { fail, guardWrite, json, preflight } from "@/lib/http";
import { hasAnyPassword, setPassword, verifyPassword } from "@/lib/credentials";
import { listPeople } from "@/lib/people";
import { isProduction } from "@/lib/profile";
import { loginFailures } from "@/lib/limits";
import { signSession, sessionCookie } from "@/lib/session";
import { appendAudit } from "@/lib/audit";
import { StoreError } from "@/lib/store";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** First start: if nobody has a password yet and FINX_BOOTSTRAP_ADMIN_PASSWORD is set, it becomes the first Admin's password. */
async function bootstrap() {
  const pw = process.env.FINX_BOOTSTRAP_ADMIN_PASSWORD;
  if (!pw || await hasAnyPassword()) return;
  const admin = (await listPeople()).find((p) => p.role === "admin");
  if (admin) await setPassword(admin.id, pw);
}

export async function POST(req: Request) {
  const blocked = guardWrite(req); if (blocked) return blocked;
  try {
    if (!isProduction()) throw new StoreError(404, "Sign-in is only used in the production profile");
    const body = await req.json().catch(() => ({})) as { person?: unknown; password?: unknown };
    const id = typeof body.person === "string" ? body.person.trim().toLowerCase() : "", pw = typeof body.password === "string" ? body.password : "";
    const key = `${req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local"}|${id}`;
    if (loginFailures.isBlocked(key)) { await appendAudit({ actor: id || "?", action: "auth.locked", target: "sign-in" }); return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429, headers: { "Retry-After": String(loginFailures.retryAfterSeconds(key)) } }); }
    await bootstrap();
    const person = (await listPeople()).find((p) => p.id === id);
    const ok = await verifyPassword(person?.id ?? "", pw);
    if (!ok || !person) { loginFailures.take(key); await appendAudit({ actor: id || "?", action: "auth.fail", target: "sign-in" }); return json(req, { error: "That name or password is not right" }, 401); }
    loginFailures.reset(key);
    await appendAudit({ actor: person.id, action: "auth.login", target: "sign-in" });
    const res = json(req, { id: person.id, name: person.name });
    res.headers.append("Set-Cookie", sessionCookie(signSession(person.id)));
    return res;
  } catch (e) { return fail(e, req); }
}
