import { NextResponse } from "next/server";
import { StoreError } from "./store";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,PUT,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
export const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: CORS });
export const preflight = () => new NextResponse(null, { status: 204, headers: CORS });
export function fail(e: unknown) {
  if (e instanceof StoreError) return json({ error: e.message, issues: e.issues }, e.status);
  console.error(e);
  return json({ error: "Internal error" }, 500);
}
