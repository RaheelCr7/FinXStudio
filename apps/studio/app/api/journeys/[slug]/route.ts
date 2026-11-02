import { getRecord, saveDraft } from "@/lib/store";
import { fail, guardWrite, json, preflight } from "@/lib/http";
import { lintAll } from "@finx/renderer-core";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
type Ctx = { params: Promise<{ slug: string }> };

/** GET ?env=published (default) returns just the journey for apps; ?env=draft returns the record for Studio. */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const { slug } = await params;
    const rec = await getRecord(slug);
    const env = new URL(req.url).searchParams.get("env") ?? "published";
    if (env === "draft") return json(req, { ...rec, issues: lintAll(rec.draft) });
    if (!rec.published) return json(req, { error: "Journey is not published yet" }, 404);
    return json(req, rec.published);
  } catch (e) { return fail(e, req); }
}
export async function PUT(req: Request, { params }: Ctx) {
  const blocked = guardWrite(req); if (blocked) return blocked;
  try {
    const { slug } = await params;
    const { record, issues, warnings } = await saveDraft(slug, await req.json());
    return json(req, { ...record, issues, warnings });
  } catch (e) { return fail(e, req); }
}
