import { Journey, bankworkxJourneys, corporateJourneys, localTransfer, payBill } from "@finx/journey-schema";
import { lintAll } from "@finx/renderer-core";

export type Live = { journey: Journey; source: "studio" | "bundled" };
export type Entry = { slug: string; name: any; version: number };
export type CatalogResult = { entries: Entry[]; source: "studio" | "bundled" };

/** A journey copied into another bank keeps its name with the bank appended (add-money-acme-bank), so match by the original name too. */
export const slugIs = (slug: string, base: string) => slug === base || slug.startsWith(`${base}-`);

/** A journey with no apps listed belongs to the original Meezan app; anything else lists the apps that show it. */
export const forBrand = (brand: string) => (j: { apps?: string[] }) => (j.apps?.length ? j.apps : ["meezan"]).includes(brand);

export const ALL_BUNDLED: Journey[] = [localTransfer, payBill, ...bankworkxJourneys, ...corporateJourneys];

export type LiveOptions = {
  /** Which bank's journeys to show. */
  brand: string;
  /** How long to wait for Studio before using the bundled copies. */
  timeoutMs?: number;
  /** Replaces the global `fetch`, for tests and for servers. */
  fetch?: typeof fetch;
};

/**
 * Over-the-air journeys: asks Studio what is published, and never trusts a journey blindly.
 * Anything wrong with Studio (down, slow, a journey that does not validate or lint) falls back to the copies bundled with the app.
 */
export function createLive(opts: LiveOptions) {
  const forThisApp = forBrand(opts.brand);
  const bundled: Record<string, Journey> = Object.fromEntries(ALL_BUNDLED.filter(forThisApp).map((j) => [j.slug, j]));
  const timeoutMs = opts.timeoutMs ?? 2500;
  const doFetch = () => opts.fetch ?? fetch;

  async function timedFetch(url: string) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try { const res = await doFetch()(url, { signal: ctl.signal }); if (!res.ok) throw new Error(String(res.status)); return await res.json(); }
    finally { clearTimeout(t); }
  }

  const bundledEntries = (): Entry[] => Object.values(bundled).map((j) => ({ slug: j.slug, name: j.name, version: j.version }));

  async function loadCatalog(studio: string): Promise<CatalogResult> {
    try {
      const list = await timedFetch(`${studio}/api/journeys`);
      const entries = (list as any[]).filter((j) => j.publishedVersion != null && forThisApp(j)).map((j) => ({ slug: j.slug, name: j.name, version: j.publishedVersion }));
      return { entries, source: "studio" };
    } catch { return { entries: bundledEntries(), source: "bundled" }; }
  }

  async function loadJourney(studio: string, slug: string): Promise<Live | null> {
    try {
      const parsed = Journey.safeParse(await timedFetch(`${studio}/api/journeys/${slug}?env=published`));
      if (!parsed.success || lintAll(parsed.data).length) throw new Error("invalid journey");
      return { journey: parsed.data, source: "studio" };
    } catch {
      const fallback = bundled[slug];
      return fallback ? { journey: fallback, source: "bundled" } : null;
    }
  }

  return { bundledEntries, loadCatalog, loadJourney };
}
