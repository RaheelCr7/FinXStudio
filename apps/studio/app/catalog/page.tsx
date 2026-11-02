import { cookies } from "next/headers";
import { listProjects } from "@/lib/projects";
import { listCatalog } from "@/lib/catalog";
import { shapeOf } from "@/lib/graph";
import { COOKIE } from "@/lib/project-utils";
import { CATEGORIES } from "@finx/journey-schema";
import { CatalogView } from "@/components/CatalogView";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const [projects, jar] = await Promise.all([listProjects(), cookies()]);
  const saved = jar.get(COOKIE)?.value;
  const currentId = projects.some((p) => p.id === saved) ? saved! : projects[0]!.id;
  const entries = (await listCatalog(currentId)).map((e) => ({ ...e, shape: shapeOf(e.journey) }));
  return <CatalogView entries={entries} categories={[...CATEGORIES]} />;
}
