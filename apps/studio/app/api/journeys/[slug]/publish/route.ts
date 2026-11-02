import { publish } from "@/lib/store";
import { fail, guardWrite, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const blocked = guardWrite(req); if (blocked) return blocked;
  try { const { slug } = await params; const rec = await publish(slug); return json(req, { version: rec.published!.version, history: rec.history }); }
  catch (e) { return fail(e, req); }
}
