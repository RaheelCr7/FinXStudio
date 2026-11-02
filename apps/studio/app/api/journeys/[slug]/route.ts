import { getRecord, saveDraft } from "@/lib/store";
import { fail, json, preflight } from "@/lib/http";
import { lintJourney } from "@finx/journey-schema";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
type Ctx = { params: Promise<{ slug: string }> };

/** GET ?env=published (default) returns just the journey for apps; ?env=draft returns the record for Studio. */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const { slug } = await params;
    const rec = await getRecord(slug);
    const env = new URL(req.url).searchParams.get("env") ?? "published";
    if (env === "draft") return json({ ...rec, issues: lintJourney(rec.draft) });
    if (!rec.published) return json({ error: "Journey is not published yet" }, 404);
    return json(rec.published);
  } catch (e) { return fail(e); }
}
export async function PUT(req: Request, { params }: Ctx) {
  try {
    const { slug } = await params;
    const { record, issues } = await saveDraft(slug, await req.json());
    return json({ ...record, issues });
  } catch (e) { return fail(e); }
}
