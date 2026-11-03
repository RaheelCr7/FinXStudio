import { getProject } from "@/lib/projects";

/** The web app manifest of one bank, so the app can be installed to a phone's or computer's home screen with the bank's name and colour. */
export async function GET(_req: Request, { params }: { params: Promise<{ project: string }> }) {
  const project = await getProject((await params).project);
  if (!project) return new Response("Unknown project", { status: 404 });
  const { id, def, brand } = project;
  return new Response(JSON.stringify({
    name: `${def.name} web banking`, short_name: def.shortName, id: `/${id}/`, start_url: `/${id}/login`, scope: `/${id}/`, display: "standalone", orientation: "any",
    lang: "en", theme_color: def.accent, background_color: brand.light.colors.bg,
    icons: [{ src: `/api/icon/${id}`, sizes: "any", type: "image/svg+xml", purpose: "any" }, { src: `/api/icon/${id}?maskable=1`, sizes: "any", type: "image/svg+xml", purpose: "maskable" }],
  }), { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=300" } });
}
