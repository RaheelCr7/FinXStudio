import { fail, json, preflight } from "@/lib/http";
import { requireCan } from "@/lib/people";
import { listAudit, verifyAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** The tamper-evident log and whether its chain is intact. Admins (people managers) only. */
export async function GET(req: Request) {
  try {
    await requireCan(req, "people");
    return json(req, { verify: await verifyAudit(), entries: await listAudit() });
  } catch (e) { return fail(e, req); }
}
