import { NextResponse } from "next/server";
import { StoreError } from "./store";
import { originAllowed } from "./origin";

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
  return originAllowed(req.headers.get("origin")) ? null : json(req, { error: "Origin not allowed" }, 403);
}

export function fail(e: unknown, req?: Request) {
  if (e instanceof StoreError) return json(req, { error: e.message, issues: e.issues }, e.status);
  console.error(e);
  return json(req, { error: "Internal error" }, 500);
}
