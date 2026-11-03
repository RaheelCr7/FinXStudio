import { addFromCatalog } from "@/lib/catalog";
import { fail, guardWrite, json, preflight, runIdOf } from "@/lib/http";
import { requireCan } from "@/lib/people";
import { nameOf, record } from "@/lib/activity";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** Body: { project, publish? }. Adds a copy of the catalog journey to that project; publish makes it live at once. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = guardWrite(req); if (blocked) return blocked;
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const project = String(body.project ?? "");
    const who = await requireCan(req, "edit", project ? [project] : undefined);
    if (body.publish === true) await requireCan(req, "publish", project ? [project] : undefined);
    const rec = await addFromCatalog(id, project, { publishNow: body.publish === true, runId: runIdOf(req) });
    await record({ actor: { id: who.id, name: who.name }, action: "journey.add", target: nameOf(rec.draft.name), detail: body.publish === true ? "Added from the catalog and published" : "Added from the catalog as a draft", projectIds: [project] });
    return json(req, { slug: rec.slug, published: rec.published?.version ?? null }, 201);
  } catch (e) { return fail(e, req); }
}
