import { catalog, catalogEntry, type CatalogEntry, type Journey } from "@finx/journey-schema";
import { addJourneyCopy, listJourneys, StoreError } from "./store";
import { getProject } from "./projects";
import { appsOfJourney } from "./project-utils";

const en = (t: any): string => (typeof t === "string" ? t : t?.en ?? "");

/** What a catalog card shows, worked out from the journey so it can never disagree with it. */
export function describeEntry(e: CatalogEntry) {
  const j = e.journey;
  const currencies = [...new Set(Object.values(j.dataModel ?? {}).map((d) => d.currency).filter((c): c is string => !!c))];
  return {
    id: e.id, name: en(j.name), category: e.category, summary: e.summary, highlights: e.highlights, madeFor: e.madeFor,
    screens: j.screens.length, languages: j.locale.supported, channels: j.channels, currencies, journey: j,
  };
}
export type CatalogCard = ReturnType<typeof describeEntry> & { journey: Journey; added: string | null };

/** The whole catalog, and for one project which entries it already has (the slug of its copy), so nothing is added twice. */
export async function listCatalog(projectId: string): Promise<CatalogCard[]> {
  const mine = (await listJourneys()).filter((j) => appsOfJourney(j).includes(projectId));
  return catalog.map((e) => {
    const have = mine.find((j) => j.slug === e.id || j.slug === `${e.id}-${projectId}`);
    return { ...describeEntry(e), added: have?.slug ?? null };
  });
}

/** Copies a catalog journey into a project. It starts as a draft unless publishNow is set. */
export async function addFromCatalog(id: string, projectId: string, opts: { publishNow?: boolean; runId?: string } = {}) {
  const entry = catalogEntry(id);
  if (!entry) throw new StoreError(404, `No catalog journey called ${id}`);
  if (!(await getProject(projectId))) throw new StoreError(404, `No project called ${projectId}`);
  const already = (await listCatalog(projectId)).find((c) => c.id === id)?.added;
  if (already) throw new StoreError(409, `This project already has it: ${already}`);
  return addJourneyCopy(entry.journey, projectId, opts);
}
