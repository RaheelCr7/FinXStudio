import { cookies, headers } from "next/headers";
import { listProjects } from "@/lib/projects";
import { projectFiles } from "@/lib/code";
import { COOKIE } from "@/lib/project-utils";
import { CodeView } from "@/components/CodeView";

export const dynamic = "force-dynamic";

export default async function CodePage() {
  const [projects, jar, h] = await Promise.all([listProjects(), cookies(), headers()]);
  const saved = jar.get(COOKIE)?.value;
  const id = projects.some((p) => p.id === saved) ? saved! : projects[0]!.id;
  const studioUrl = process.env.FINX_STUDIO_URL ?? `http://${h.get("host") ?? "localhost:3100"}`;
  return <CodeView projectId={id} files={await projectFiles(id, studioUrl)} />;
}
