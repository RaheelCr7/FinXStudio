import { NextResponse, type NextRequest } from "next/server";
import { contentSecurityPolicy, newNonce, securityHeaders } from "@/lib/security";

/** Runs before every page and API request: sets the Content Security Policy (with a nonce for this request) and the other security headers. */
export function proxy(request: NextRequest) {
  const https = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  const headers = new Headers(request.headers);
  const isPage = !request.nextUrl.pathname.startsWith("/api/");
  let csp: string | null = null;
  if (isPage) {
    csp = contentSecurityPolicy({ nonce: newNonce(), dev: process.env.NODE_ENV === "development", https });
    // Next reads the nonce out of the request's policy and puts it on the scripts and styles it makes
    headers.set("Content-Security-Policy", csp);
  }
  const response = NextResponse.next({ request: { headers } });
  if (csp) response.headers.set("Content-Security-Policy", csp);
  for (const [k, v] of Object.entries(securityHeaders({ https }))) response.headers.set(k, v);
  return response;
}

export const config = {
  matcher: [{ source: "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest).*)", missing: [{ type: "header", key: "next-router-prefetch" }, { type: "header", key: "purpose", value: "prefetch" }] }],
};
