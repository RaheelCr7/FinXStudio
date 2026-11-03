import { getRecord, publish } from "@/lib/store";
import { fail, guardWrite, json, preflight } from "@/lib/http";
import { requireCan } from "@/lib/people";
import { assertMayPublish } from "@/lib/publish-rule";
import { nameOf, record } from "@/lib/activity";
import { appsOfJourney } from "@/lib/project-utils";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const blocked = guardWrite(req); if (blocked) return blocked;
  try {
    const { slug } = await params;
    const before = await getRecord(slug);
    const projects = appsOfJourney(before.draft);
    const who = await requireCan(req, "publish", projects);
    // the project's approval rule: a change you made yourself may need someone else to publish it
    await assertMayPublish(before, who);
    const rec = await publish(slug, who.name);
    await record({ actor: { id: who.id, name: who.name }, action: "journey.publish", target: nameOf(rec.draft.name), detail: `Published v${rec.published!.version} to UAT`, projectIds: projects });
    return json(req, { version: rec.published!.version, history: rec.history });
  } catch (e) { return fail(e, req); }
}
