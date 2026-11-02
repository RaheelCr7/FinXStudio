import { generateProject, type GeneratedFile } from "@finx/codegen";
import { getRecord, listJourneys, StoreError } from "./store";
import { getProject } from "./projects";
import { appsOfJourney } from "./project-utils";

/** The files of a project's source, generated from what is in Studio now: live journeys where there are any, drafts otherwise. */
export async function projectFiles(projectId: string, studioUrl: string): Promise<GeneratedFile[]> {
  const project = await getProject(projectId);
  if (!project) throw new StoreError(404, `No project called ${projectId}`);
  const mine = (await listJourneys()).filter((j) => appsOfJourney(j).includes(projectId));
  const records = await Promise.all(mine.map((j) => getRecord(j.slug)));
  const { brand, ...def } = project;
  return generateProject({
    project: def, brand, studioUrl,
    journeys: records.map((r) => ({ journey: r.published ?? r.draft, live: !!r.published })),
  });
}
