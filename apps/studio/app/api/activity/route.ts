import { listActivity } from "@/lib/activity";
import { fail, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** The activity log, newest first. Query: person, project, kind (journey, person, role, project, policy, workspace), before (a time), limit. */
export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams;
    return json(req, { activity: await listActivity({ person: q.get("person") ?? undefined, project: q.get("project") ?? undefined, kind: q.get("kind") ?? undefined, before: q.get("before") ?? undefined, limit: q.get("limit") ? Number(q.get("limit")) : undefined }) });
  } catch (e) { return fail(e, req); }
}
