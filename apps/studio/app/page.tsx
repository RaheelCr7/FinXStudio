import { cookies } from "next/headers";
import { listJourneys } from "@/lib/store";
import { listProjects } from "@/lib/projects";
import { COOKIE, appsOfJourney } from "@/lib/project-utils";
import { JourneyList } from "@/components/JourneyList";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ new?: string; scope?: string }> }) {
  const [journeys, projects, sp, jar] = await Promise.all([listJourneys(), listProjects(), searchParams, cookies()]);
  const saved = jar.get(COOKIE)?.value;
  const currentId = projects.some((p) => p.id === saved) ? saved! : projects[0]!.id;
  const showAll = sp.scope === "all";
  return <JourneyList journeys={showAll ? journeys : journeys.filter((j) => appsOfJourney(j).includes(currentId))} defaultNew={sp.new === "1"} showAll={showAll} />;
}
