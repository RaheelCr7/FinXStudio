import { listCatalog } from "@/lib/catalog";
import { listProjects } from "@/lib/projects";
import { CATEGORIES } from "@finx/journey-schema";
import { fail, json, preflight } from "@/lib/http";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** The catalog. With ?project=<id>, each entry says whether that project already has it (`added` is the slug of its copy). */
export async function GET(req: Request) {
  try {
    const projects = await listProjects();
    const asked = new URL(req.url).searchParams.get("project") ?? projects[0]!.id;
    const project = projects.find((p) => p.id === asked);
    if (!project) return json(req, { error: `Unknown project ${asked}. Use one of: ${projects.map((p) => p.id).join(", ")}` }, 404);
    const entries = (await listCatalog(project.id)).map(({ journey: _j, ...rest }) => rest);
    return json(req, { project: project.id, categories: CATEGORIES, entries });
  } catch (e) { return fail(e, req); }
}
