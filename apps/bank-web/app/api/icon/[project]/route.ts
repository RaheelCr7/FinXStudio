import { getProject } from "@/lib/projects";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** The bank's icon: its colour with the first letter of its name. Drawn here so a new project has an icon without anyone preparing a file. */
export async function GET(req: Request, { params }: { params: Promise<{ project: string }> }) {
  const project = await getProject((await params).project);
  if (!project) return new Response("Unknown project", { status: 404 });
  const maskable = new URL(req.url).searchParams.get("maskable") === "1";
  const letter = esc([...project.def.name.trim()][0]?.toUpperCase() ?? "B");
  // a maskable icon is cropped by the phone, so the colour fills the whole square and the letter stays small and central
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="${maskable ? 0 : 112}" fill="${esc(project.def.accent)}"/><text x="256" y="${maskable ? 330 : 352}" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-weight="800" font-size="${maskable ? 220 : 280}" fill="#fff">${letter}</text></svg>`;
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=300" } });
}
