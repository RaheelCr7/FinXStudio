import { publish } from "@/lib/store";
import { fail, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
export async function POST(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try { const { slug } = await params; const rec = await publish(slug); return json({ version: rec.published!.version, history: rec.history }); }
  catch (e) { return fail(e); }
}
