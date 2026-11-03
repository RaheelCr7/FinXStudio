import { approveRequirement, getRequirement, withReadiness } from "@/lib/requirements";
import { requireCan } from "@/lib/people";
import { record } from "@/lib/activity";
import { fail, guardWrite, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** Approves a requirement that has what it needs (needs the publish permission). Nothing is generated from a requirement that is not approved. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = guardWrite(req); if (blocked) return blocked;
  try {
    const { id } = await params;
    const cur = await getRequirement(id);
    const who = await requireCan(req, "publish", cur.projectId ? [cur.projectId] : undefined);
    const r = await approveRequirement(id, who.name);
    await record({ actor: { id: who.id, name: who.name }, action: "requirement.approve", target: r.title, detail: `Approved as version ${r.version}`, projectIds: r.projectId ? [r.projectId] : undefined });
    return json(req, withReadiness(r));
  } catch (e) { return fail(e, req); }
}
