import { listPolicies, setPolicy } from "@/lib/access";
import { record } from "@/lib/activity";
import { fail, guardWrite, json, preflight } from "@/lib/http";
import { requireCan } from "@/lib/people";
import { getProject } from "@/lib/projects";
import { DEFAULT_SELF_PUBLISH, SELF_PUBLISH_INFO } from "@/lib/roles";
import { StoreError } from "@/lib/store";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try { const { id } = await params; return json(req, { selfPublish: (await listPolicies())[id] ?? DEFAULT_SELF_PUBLISH }); } catch (e) { return fail(e, req); }
}

/** Body: { selfPublish: "admin" | "never" | "anyone" }. Who may publish a change they made themselves, in this project. */
export async function PATCH(req: Request, { params }: Ctx) {
  const blocked = guardWrite(req); if (blocked) return blocked;
  try {
    const who = await requireCan(req, "people");
    const { id } = await params;
    const project = await getProject(id);
    if (!project) throw new StoreError(404, "Project not found");
    const rule = await setPolicy(id, (await req.json()).selfPublish);
    await record({ actor: { id: who.id, name: who.name }, action: "policy.update", target: project.name, detail: `Publishing your own change: ${SELF_PUBLISH_INFO[rule].label}`, projectIds: [id] });
    return json(req, { selfPublish: rule });
  } catch (e) { return fail(e, req); }
}
