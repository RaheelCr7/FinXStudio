import { clearEvents, eventsFor, funnel } from "@/lib/analytics";
import { getRecord } from "@/lib/store";
import { fail, guardWrite, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** The funnel of a journey over its recorded runs. Query: source (default all), version (default all). */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const q = new URL(req.url).searchParams;
    const { draft } = await getRecord(slug);
    const events = await eventsFor(slug, { source: q.get("source") ?? undefined, version: q.get("version") ? Number(q.get("version")) : undefined });
    return json(req, { funnel: funnel(draft, events), sources: [...new Set((await eventsFor(slug)).map((e) => e.source))] });
  } catch (e) { return fail(e, req); }
}

/** Clears the recorded runs of this journey. */
export async function DELETE(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const denied = guardWrite(req); if (denied) return denied;
  try { const { slug } = await params; await clearEvents(slug); return json(req, { ok: true }); } catch (e) { return fail(e, req); }
}
