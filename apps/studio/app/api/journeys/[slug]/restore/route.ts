import { restoreVersion } from "@/lib/store";
import { fail, guardWrite, json, preflight } from "@/lib/http";
import { requireCan } from "@/lib/people";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
/** Body: { version }. Puts that published version back as the draft. */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const blocked = guardWrite(req); if (blocked) return blocked;
  try {
    await requireCan(req, "edit");
    const { slug } = await params;
    const { version } = await req.json();
    const rec = await restoreVersion(slug, Number(version));
    return json(req, { restored: Number(version), draft: rec.draft });
  } catch (e) { return fail(e, req); }
}
