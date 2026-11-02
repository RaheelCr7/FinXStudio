import { publish } from "@/lib/store";
import { fail, guardWrite, json, preflight } from "@/lib/http";
import { requireCan } from "@/lib/people";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const blocked = guardWrite(req); if (blocked) return blocked;
  try { const who = await requireCan(req, "publish"); const { slug } = await params; const rec = await publish(slug, who.name); return json(req, { version: rec.published!.version, history: rec.history }); }
  catch (e) { return fail(e, req); }
}
