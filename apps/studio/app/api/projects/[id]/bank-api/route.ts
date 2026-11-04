import { PROVIDER_INFO, PROVIDERS } from "@finx/mock-bank-api";
import { getProject, updateProjectBankApi } from "@/lib/projects";
import { requireCan } from "@/lib/people";
import { record } from "@/lib/activity";
import { fail, guardWrite, json, preflight } from "@/lib/http";
import { StoreError } from "@/lib/store";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** Which bank API the project runs against, and the ones to choose from. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const p = await getProject((await params).id);
    if (!p) throw new StoreError(404, "No such project");
    return json(req, { bankApi: p.bankApi ?? "reference", options: PROVIDERS.map((id) => ({ id, ...PROVIDER_INFO[id] })) });
  } catch (e) { return fail(e, req); }
}

/** Body: { bankApi } (needs the projects permission). The answer includes the previous value, to undo. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = guardWrite(req); if (blocked) return blocked;
  try {
    const who = await requireCan(req, "projects");
    const { id } = await params;
    const { project, previous } = await updateProjectBankApi(id, await req.json().catch(() => null));
    const now = project.bankApi ?? "reference";
    await record({ actor: { id: who.id, name: who.name }, action: "project.update", target: project.name, detail: `Bank API changed from ${previous} to ${now}`, projectIds: [project.id] });
    return json(req, { id: project.id, bankApi: now, previous });
  } catch (e) { return fail(e, req); }
}
