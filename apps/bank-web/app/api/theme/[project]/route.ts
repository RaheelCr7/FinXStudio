import { themeCss } from "@finx/renderer-web";
import { getProject } from "@/lib/projects";

/** The bank's colours as a stylesheet. Served from the app's own address so a strict Content Security Policy can allow it. */
export async function GET(_req: Request, { params }: { params: Promise<{ project: string }> }) {
  const project = await getProject((await params).project);
  if (!project) return new Response("Unknown project", { status: 404 });
  return new Response(themeCss(project.brand), { headers: { "Content-Type": "text/css; charset=utf-8", "Cache-Control": "public, max-age=60" } });
}
