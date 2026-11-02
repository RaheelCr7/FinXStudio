import { Journey, bankworkxJourneys, localTransfer, payBill } from "@finx/journey-schema";
import { lintAll } from "@finx/renderer-core";
import { BRAND } from "./brand";

export type Live = { journey: Journey; source: "studio" | "bundled" };
export type Entry = { slug: string; name: any; version: number };

/** Over-the-air journeys: the app asks Studio what is published, and never trusts a journey blindly. */
const ALL_BUNDLED: Journey[] = [localTransfer, payBill, ...bankworkxJourneys];
/** A journey with no apps listed belongs to the original Meezan app; anything else lists the apps that show it. */
const forThisApp = (j: { apps?: string[] }) => (j.apps?.length ? j.apps : ["meezan"]).includes(BRAND);
const BUNDLED: Record<string, Journey> = Object.fromEntries(ALL_BUNDLED.filter(forThisApp).map((j) => [j.slug, j]));
export const bundledEntries = (): Entry[] => Object.values(BUNDLED).map((j) => ({ slug: j.slug, name: j.name, version: j.version }));

async function timedFetch(url: string) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 2500);
  try { const res = await fetch(url, { signal: ctl.signal }); if (!res.ok) throw new Error(String(res.status)); return await res.json(); }
  finally { clearTimeout(t); }
}

export async function loadCatalog(studio: string): Promise<{ entries: Entry[]; source: "studio" | "bundled" }> {
  try {
    const list = await timedFetch(`${studio}/api/journeys`);
    const entries = (list as any[]).filter((j) => j.publishedVersion != null && forThisApp(j)).map((j) => ({ slug: j.slug, name: j.name, version: j.publishedVersion }));
    return { entries, source: "studio" };
  } catch { return { entries: bundledEntries(), source: "bundled" }; }
}

export async function loadJourney(studio: string, slug: string): Promise<Live | null> {
  try {
    const parsed = Journey.safeParse(await timedFetch(`${studio}/api/journeys/${slug}?env=published`));
    if (!parsed.success || lintAll(parsed.data).length) throw new Error("invalid journey");
    return { journey: parsed.data, source: "studio" };
  } catch {
    const fallback = BUNDLED[slug];
    return fallback ? { journey: fallback, source: "bundled" } : null;
  }
}

/** A journey copied into another bank keeps its name with the bank appended (add-money-acme-bank), so match by the original name too. */
export const slugIs = (slug: string, base: string) => slug === base || slug.startsWith(`${base}-`);
