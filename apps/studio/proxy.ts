import { NextResponse, type NextRequest } from "next/server";
import { isProduction } from "@/lib/profile";
import { securityHeaders } from "@/lib/security-headers";
import { apiRate, bodyTooLarge } from "@/lib/limits";
import { anonymousMayCall, cookieValue, isServiceRequest, verifySession } from "@/lib/session";

/**
 * Production profile only (demo passes straight through): security headers, a request size limit and a per-address rate limit
 * on the API, and a redirect to /login for pages when there is no session cookie. The cookie is verified where it is used
 * (people.ts actorOf and the layout); this only keeps anonymous visitors off the pages.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const headers = new Headers(req.headers);
  if (pathname === "/login") headers.set("x-finx-bare", "1"); // the sign-in page is drawn without the workspace in both profiles
  if (!isProduction()) return NextResponse.next({ request: { headers } });
  const isApi = pathname.startsWith("/api/");
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const add = (res: NextResponse) => { for (const [k, v] of Object.entries(securityHeaders())) res.headers.set(k, v); return res; };

  if (isApi) {
    if (!apiRate.take(ip)) return add(NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "60" } }));
    if (bodyTooLarge(req.headers.get("content-length"))) return add(NextResponse.json({ error: "Request too large" }, { status: 413 }));
    const signedIn = verifySession(cookieValue(req.headers.get("cookie"), "finx.session")) !== null || isServiceRequest(req);
    if (!signedIn && !anonymousMayCall(req.method, pathname, req.nextUrl.searchParams)) return add(NextResponse.json({ error: "Sign in to use Studio" }, { status: 401 }));
  } else if (pathname !== "/login" && !req.cookies.get("finx.session")) {
    return add(NextResponse.redirect(new URL("/login", req.url)));
  }
  return add(NextResponse.next({ request: { headers } }));
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
