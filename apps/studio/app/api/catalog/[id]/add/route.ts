import { addFromCatalog } from "@/lib/catalog";
import { fail, guardWrite, json, preflight } from "@/lib/http";
import { requireCan } from "@/lib/people";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** Body: { project, publish? }. Adds a copy of the catalog journey to that project; publish makes it live at once. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = guardWrite(req); if (blocked) return blocked;
  try {
    await requireCan(req, "edit");
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    if (body.publish === true) await requireCan(req, "publish");
    const rec = await addFromCatalog(id, String(body.project ?? ""), { publishNow: body.publish === true });
    return json(req, { slug: rec.slug, published: rec.published?.version ?? null }, 201);
  } catch (e) { return fail(e, req); }
}
