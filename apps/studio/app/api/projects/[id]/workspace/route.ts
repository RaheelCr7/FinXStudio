import { projectFiles } from "@/lib/code";
import { fail, guardWrite, json, preflight } from "@/lib/http";
import { requireCan } from "@/lib/people";
import { assertLocal, commitWorkspace, exportToFolder, pushCommand, setRemote, workspaceStatus } from "@/lib/workspace";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

const status = async (id: string) => {
  const s = await workspaceStatus(id);
  return { ...s, push: s.git.remote ? pushCommand(s.dir, s.git.branch) : undefined };
};

/** Where the project's folder is, and its Git state. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertLocal(req);
    return json(req, await status((await params).id));
  } catch (e) { return fail(e, req); }
}

/**
 * Works on the project's folder on this computer. Body: { action: "export" } writes the files, { action: "commit", message }
 * commits them (starting a repository first), { action: "remote", url } connects a remote. Studio never pushes.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const blocked = guardWrite(req); if (blocked) return blocked;
    assertLocal(req);
    const who = await requireCan(req, "edit");
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { action?: string; message?: unknown; url?: unknown };
    let result: unknown;
    if (body.action === "export") {
      result = await exportToFolder(id, await projectFiles(id, process.env.FINX_STUDIO_URL ?? new URL(req.url).origin));
    } else if (body.action === "commit") {
      result = await commitWorkspace(id, typeof body.message === "string" ? body.message : "", who) ?? { nothingToCommit: true };
    } else if (body.action === "remote") {
      await setRemote(id, typeof body.url === "string" ? body.url : "");
      result = { ok: true };
    } else return json(req, { error: "action must be export, commit or remote" }, 400);
    return json(req, { result, ...(await status(id)) });
  } catch (e) { return fail(e, req); }
}
