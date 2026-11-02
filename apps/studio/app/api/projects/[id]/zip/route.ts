import { zip } from "@finx/codegen";
import { projectFiles } from "@/lib/code";
import { fail, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** The generated source of a project as a zip, for handing to a developer or committing to Git. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const files = await projectFiles(id, process.env.FINX_STUDIO_URL ?? new URL(req.url).origin);
    const body = zip(files);
    return new Response(body as BodyInit, { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${id}-source.zip"`, "Content-Length": String(body.length) } });
  } catch (e) { return fail(e, req); }
}
