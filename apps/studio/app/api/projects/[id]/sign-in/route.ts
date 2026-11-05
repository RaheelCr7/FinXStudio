import { getProject, SIGN_IN_STYLES, updateProjectSignIn } from "@/lib/projects";
import { requireCan } from "@/lib/people";
import { record } from "@/lib/activity";
import { fail, guardWrite, json, preflight } from "@/lib/http";
import { StoreError } from "@/lib/store";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** How the web app's sign-in page looks for this project, and the styles to choose from. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const p = await getProject((await params).id);
    if (!p) throw new StoreError(404, "No such project");
    return json(req, { signIn: p.look?.signIn === "stage" ? "stage" : "standard", options: SIGN_IN_STYLES });
  } catch (e) { return fail(e, req); }
}

/** Body: { signIn: "standard" | "stage" } (needs the projects permission). The answer includes the previous value, to undo. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = guardWrite(req); if (blocked) return blocked;
  try {
    const who = await requireCan(req, "projects");
    const { id } = await params;
    const { project, previous } = await updateProjectSignIn(id, await req.json().catch(() => null));
    const now = project.look?.signIn === "stage" ? "stage" : "standard";
    await record({ actor: { id: who.id, name: who.name }, action: "project.update", target: project.name, detail: `Sign-in page changed from ${previous} to ${now}`, projectIds: [project.id] });
    return json(req, { id: project.id, signIn: now, previous });
  } catch (e) { return fail(e, req); }
}
