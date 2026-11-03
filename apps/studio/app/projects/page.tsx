import { listJourneys } from "@/lib/store";
import { listProjects } from "@/lib/projects";
import { appsOfJourney } from "@/lib/project-utils";
import { ProjectList } from "@/components/ProjectList";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const [projects, journeys, sp] = await Promise.all([listProjects(), listJourneys(), searchParams]);
  const rows = projects.map((p) => ({
    ...p,
    journeys: journeys.filter((j) => appsOfJourney(j).includes(p.id)).length,
    live: journeys.filter((j) => appsOfJourney(j).includes(p.id) && j.publishedVersion != null).length,
  }));
  const starters = journeys.filter((j) => j.publishedVersion != null).map((j) => ({ slug: j.slug, name: typeof j.name === "string" ? j.name : j.name?.en ?? j.slug, apps: appsOfJourney(j), screens: j.screens }));
  return <ProjectList projects={rows} starters={starters} defaultNew={sp.new === "1"} />;
}
