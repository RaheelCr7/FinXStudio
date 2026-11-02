import { listVersions } from "@/lib/store";
import { fail, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try { const { slug } = await params; return json(req, { versions: await listVersions(slug) }); }
  catch (e) { return fail(e, req); }
}
