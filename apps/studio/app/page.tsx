import { cookies } from "next/headers";
import { getRecord, listJourneys } from "@/lib/store";
import { listProjects } from "@/lib/projects";
import { COOKIE, appsOfJourney } from "@/lib/project-utils";
import { JourneyList } from "@/components/JourneyList";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ new?: string; scope?: string }> }) {
  const [journeys, projects, sp, jar] = await Promise.all([listJourneys(), listProjects(), searchParams, cookies()]);
  const saved = jar.get(COOKIE)?.value;
  const currentId = projects.some((p) => p.id === saved) ? saved! : projects[0]!.id;
  const showAll = sp.scope === "all";
  const shown = showAll ? journeys : journeys.filter((j) => appsOfJourney(j).includes(currentId));
  // what each journey looks like to customers: the live version, or the draft when it was never published
  const docs = Object.fromEntries(await Promise.all(shown.map(async (j) => { const r = await getRecord(j.slug); return [j.slug, r.published ?? r.draft] as const; })));
  return <JourneyList journeys={shown} docs={docs} defaultNew={sp.new === "1"} showAll={showAll} />;
}
