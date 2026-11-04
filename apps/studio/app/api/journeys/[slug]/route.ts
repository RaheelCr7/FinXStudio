import { getRecord, saveDraft } from "@/lib/store";
import { nameOf, record } from "@/lib/activity";
import { appsOfJourney } from "@/lib/project-utils";
import { fail, guardWrite, json, preflight, runIdOf } from "@/lib/http";
import { lintAll } from "@finx/renderer-core";
import { requireCan, actorOf } from "@/lib/people";
import { isProduction } from "@/lib/profile";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
type Ctx = { params: Promise<{ slug: string }> };

/** GET ?env=published (default) returns just the journey for apps; ?env=draft returns the record for Studio. */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const { slug } = await params;
    const rec = await getRecord(slug);
    const env = new URL(req.url).searchParams.get("env") ?? "published";
    if (env === "draft") { if (isProduction()) await actorOf(req); return json(req, { ...rec, issues: lintAll(rec.draft) }); }
    if (!rec.published) return json(req, { error: "Journey is not published yet" }, 404);
    return json(req, rec.published);
  } catch (e) { return fail(e, req); }
}
export async function PUT(req: Request, { params }: Ctx) {
  const blocked = guardWrite(req); if (blocked) return blocked;
  try {
    const { slug } = await params;
    const who = await requireCan(req, "edit", appsOfJourney((await getRecord(slug)).draft));
    const { record: rec, issues, warnings } = await saveDraft(slug, await req.json(), { id: who.id, name: who.name }, runIdOf(req));
    await record({ actor: { id: who.id, name: who.name }, action: "journey.edit", target: nameOf(rec.draft.name), projectIds: appsOfJourney(rec.draft) });
    return json(req, { ...rec, issues, warnings });
  } catch (e) { return fail(e, req); }
}
