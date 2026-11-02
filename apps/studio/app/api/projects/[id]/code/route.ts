import { projectFiles } from "@/lib/code";
import { fail, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** The generated source of a project: every file with its path, tag and content. Read only. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return json(req, { project: id, files: await projectFiles(id, process.env.FINX_STUDIO_URL ?? new URL(req.url).origin) });
  } catch (e) { return fail(e, req); }
}
