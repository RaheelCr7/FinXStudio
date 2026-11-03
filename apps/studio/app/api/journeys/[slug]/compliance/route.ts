import { complianceReport } from "@finx/mcp/proof";
import { getRecord } from "@/lib/store";
import { actorOf } from "@/lib/people";
import { hashOf, listSnapshots, saveSnapshot } from "@/lib/compliance-store";
import { fail, guardWrite, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** The compliance evidence for the draft as it is now (runs its tests), and the snapshots saved earlier. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { draft } = await getRecord(slug);
    const [report, snapshots] = await Promise.all([complianceReport(draft), listSnapshots(slug)]);
    return json(req, { report, hash: hashOf(draft), snapshots: snapshots.map(({ report: r, ...s }) => ({ ...s, summary: r.summary })) });
  } catch (e) { return fail(e, req); }
}

/** Saves a snapshot of the evidence for this version. Body: { note? }. */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const denied = guardWrite(req); if (denied) return denied;
  try {
    const { slug } = await params;
    const who = await actorOf(req);
    const body = await req.json().catch(() => ({})) as { note?: string };
    const { draft } = await getRecord(slug);
    const snap = await saveSnapshot(draft, await complianceReport(draft), who.name, typeof body.note === "string" ? body.note : "");
    const { report, ...rest } = snap;
    return json(req, { snapshot: { ...rest, summary: report.summary } });
  } catch (e) { return fail(e, req); }
}
