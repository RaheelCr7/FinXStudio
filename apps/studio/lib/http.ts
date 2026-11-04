import { NextResponse } from "next/server";
import { StoreError } from "./store";
import { originAllowed } from "./origin";
import { isProduction } from "./profile";

function corsHeaders(req?: Request): Record<string, string> {
  const h: Record<string, string> = { Vary: "Origin", "Access-Control-Allow-Methods": "GET,PUT,POST,PATCH,DELETE,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
  const origin = req?.headers.get("origin");
  if (origin && originAllowed(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

export const json = (req: Request | undefined, data: unknown, status = 200) => NextResponse.json(data, { status, headers: corsHeaders(req) });

export function preflight(req: Request) {
  if (!originAllowed(req.headers.get("origin"))) return new NextResponse(null, { status: 403 });
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

/** Returns a 403 response when a write comes from a browser origin that is not allowed; otherwise null. */
export function guardWrite(req: Request): NextResponse | null {
  // Production: the session cookie is SameSite=Strict, and a browser write must also say where it comes from (CSRF defence by
  // origin check). Calls without a session cookie (the MCP server with its token) have no browser origin to check.
  const browser = isProduction() && /(^|;\s*)finx\.session=/.test(req.headers.get("cookie") ?? "");
  if (browser && !req.headers.get("origin")) return json(req, { error: "Origin required" }, 403);
  return originAllowed(req.headers.get("origin")) ? null : json(req, { error: "Origin not allowed" }, 403);
}

/** The agent run a write belongs to, sent by the FinX MCP server, so Studio can checkpoint what the run changes. */
export const runIdOf = (req: Request) => req.headers.get("x-finx-run") ?? undefined;

export function fail(e: unknown, req?: Request) {
  if (e instanceof StoreError) return json(req, { error: e.message, issues: e.issues }, e.status);
  console.error(e);
  return json(req, { error: "Internal error" }, 500);
}
