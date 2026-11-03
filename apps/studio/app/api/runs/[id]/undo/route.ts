import { checkpointOf, getRecord, undoRun } from "@/lib/store";
import { fail, guardWrite, json, preflight } from "@/lib/http";
import { requireCan } from "@/lib/people";
import { appsOfJourney } from "@/lib/project-utils";
import { record } from "@/lib/activity";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** What undoing the run would change. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; return json(req, { journeys: await checkpointOf(id) }); } catch (e) { return fail(e, req); }
}

/** Body: { force? }. Puts every journey the run touched back as it was before the run. Needs permission to edit each of them. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = guardWrite(req); if (blocked) return blocked;
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    let who: Awaited<ReturnType<typeof requireCan>> | undefined;
    for (const j of await checkpointOf(id)) {
      if (j.gone) continue;
      who = await requireCan(req, "edit", appsOfJourney((await getRecord(j.slug)).draft));
    }
    const done = await undoRun(id, { force: body.force === true });
    if (who) await record({ actor: { id: who.id, name: who.name }, action: "journey.edit", target: [...done.restored, ...done.removed].join(", "), detail: `Undid agent run ${id}` });
    return json(req, done);
  } catch (e) { return fail(e, req); }
}
