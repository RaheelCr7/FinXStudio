import { listRuns, upsertRun } from "@/lib/store";
import { fail, guardWrite, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
export async function GET(req: Request) { try { return json(req, await listRuns()); } catch (e) { return fail(e, req); } }
/** Create or update an agent run. Used by the FinX MCP server to report what an AI agent is doing. */
export async function POST(req: Request) {
  const blocked = guardWrite(req); if (blocked) return blocked;
  try { const body = await req.json(); return json(req, await upsertRun(body ?? {}), body?.id ? 200 : 201); } catch (e) { return fail(e, req); }
}
