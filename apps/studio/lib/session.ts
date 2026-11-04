import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * A signed session: "<payload>.<signature>", the payload being base64url JSON {sub, exp}. The signature is HMAC-SHA256 with
 * FINX_SESSION_SECRET, so a cookie cannot be forged or its expiry changed. Production refuses to run without a long secret.
 */
export const SESSION_HOURS = 8;

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");
function secret(env: Record<string, string | undefined> = process.env): string {
  const s = env.FINX_SESSION_SECRET ?? "";
  if (s.length < 32) throw new Error("FINX_SESSION_SECRET must be set to at least 32 characters in the production profile");
  return s;
}
const sign = (payload: string, key: string) => createHmac("sha256", key).update(payload).digest();

export function signSession(sub: string, nowMs: number = Date.now(), env: Record<string, string | undefined> = process.env): string {
  const payload = b64(JSON.stringify({ sub, exp: nowMs + SESSION_HOURS * 3_600_000 }));
  return `${payload}.${b64(sign(payload, secret(env)))}`;
}

/** The person id the token was issued to, or null when it is missing, forged, malformed or expired. */
export function verifySession(token: string | undefined | null, nowMs: number = Date.now(), env: Record<string, string | undefined> = process.env): string | null {
  if (!token) return null;
  const [payload, sig, ...rest] = token.split(".");
  if (!payload || !sig || rest.length) return null;
  const want = sign(payload, secret(env)), got = Buffer.from(sig, "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const { sub, exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof sub === "string" && typeof exp === "number" && exp > nowMs ? sub : null;
  } catch { return null; }
}

export const sessionCookie = (token: string, maxAge = SESSION_HOURS * 3600) =>
  `finx.session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
export const clearedSessionCookie = () => "finx.session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0";

export function cookieValue(jar: string | null | undefined, name: string): string | undefined {
  const hit = (jar ?? "").split(/;\s*/).find((c) => c.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : undefined;
}

/** In production an agent (the FinX MCP server) authenticates with FINX_SERVICE_TOKEN and acts as the person FINX_SERVICE_PERSON. */
export function isServiceRequest(req: Request, env: Record<string, string | undefined> = process.env): boolean {
  const want = env.FINX_SERVICE_TOKEN ?? "", got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  return want.length >= 32 && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

/**
 * What a visitor with no session may do in production: sign in, and what the phone and web apps need, which is reading
 * published journeys and the project list. Everything else needs a session or the service token.
 */
export function anonymousMayCall(method: string, pathname: string, search: URLSearchParams): boolean {
  if (pathname === "/api/auth/login" && method === "POST") return true;
  if (pathname === "/api/auth/logout" && method === "POST") return true;
  if (method !== "GET") return false;
  if (pathname === "/api/projects") return true;
  if (pathname === "/api/journeys") return true; // the list is cut down to published journeys for anonymous callers
  return /^\/api\/journeys\/[a-z0-9][a-z0-9-]{0,62}$/.test(pathname) && (search.get("env") ?? "published") === "published";
}
