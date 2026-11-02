import { getRun } from "@/lib/store";
import { fail, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; return json(req, await getRun(id)); } catch (e) { return fail(e, req); }
}
