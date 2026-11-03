import { getRecord, restoreVersion } from "@/lib/store";
import { fail, guardWrite, json, preflight } from "@/lib/http";
import { requireCan } from "@/lib/people";
import { nameOf, record } from "@/lib/activity";
import { appsOfJourney } from "@/lib/project-utils";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
/** Body: { version }. Puts that published version back as the draft. */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const blocked = guardWrite(req); if (blocked) return blocked;
  try {
    const { slug } = await params;
    const who = await requireCan(req, "edit", appsOfJourney((await getRecord(slug)).draft));
    const { version } = await req.json();
    const rec = await restoreVersion(slug, Number(version), { id: who.id, name: who.name });
    await record({ actor: { id: who.id, name: who.name }, action: "journey.restore", target: nameOf(rec.draft.name), detail: `Put v${Number(version)} back as the draft`, projectIds: appsOfJourney(rec.draft) });
    return json(req, { restored: Number(version), draft: rec.draft });
  } catch (e) { return fail(e, req); }
}
