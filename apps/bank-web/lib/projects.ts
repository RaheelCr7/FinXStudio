import { PRESETS, accentProblem, brandDefs, resolveBrand, type Brand, type BrandDef } from "@finx/ui-kit";

export type Project = { id: string; brand: Brand; def: BrandDef; /** Which set of screens the project uses. */ shell: "meezan" | "bankworkx" };

/** Names that cannot be project ids because they are used by the app's own addresses. */
export const RESERVED = new Set(["api", "assets", "_next", "theme", "favicon.ico", "manifest.webmanifest", "sw.js"]);
const ID = /^[a-z0-9][a-z0-9-]{0,62}$/;
const STUDIO = () => (process.env.FINX_STUDIO_URL ?? "http://127.0.0.1:3100").replace(/\/+$/, "");
const TTL = () => Number(process.env.FINX_WEB_PROJECTS_TTL_MS ?? 30_000);

const toProject = (id: string, def: BrandDef): Project => {
  const brand = resolveBrand(id, def);
  return { id, brand, def, shell: brand.preset === "bankworkx" ? "bankworkx" : "meezan" };
};
const bundled = (): Project[] => Object.entries(brandDefs).filter(([id]) => !RESERVED.has(id)).map(([id, def]) => toProject(id, def));

const str = (v: unknown, max = 80) => (typeof v === "string" && v.length > 0 && v.length <= max ? v : null);
/**
 * One project as Studio reports it, or null if it is not trustworthy. Only plain fields are taken and the theme is worked out again
 * here from them, so nothing in the answer can put its own styles or scripts on the page.
 */
export function readProject(raw: any): Project | null {
  try {
    const id = str(raw?.id, 63);
    if (!id || !ID.test(id) || RESERVED.has(id) || !Object.hasOwn(PRESETS, raw.preset) || accentProblem(String(raw.accent))) return null;
    const name = str(raw.name, 60), currency = str(raw.currency, 3), locale = str(raw.locale, 20);
    if (!name || !currency || !locale) return null;
    const hex = (v: unknown, fallback: string) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback);
    const def: BrandDef = {
      name, shortName: str(raw.shortName, 30) ?? name, slug: id, bundleId: str(raw.bundleId, 120) ?? `com.${id.replace(/-/g, "")}.app`, scheme: str(raw.scheme, 40) ?? id.replace(/-/g, ""),
      preset: raw.preset, accent: String(raw.accent).toUpperCase(), currency, locale, assets: `./assets/${id}`, background: hex(raw.background, "#F6F7F9"), splashDark: hex(raw.splashDark, "#0A0D12"),
    };
    return toProject(id, def);
  } catch { return null; }
}

let cache: { at: number; list: Project[] } | null = null;
/** The projects this deployment serves: the ones in Studio, so a project added there appears here without a new build; the bundled banks if Studio cannot be reached. */
export async function listProjects(): Promise<Project[]> {
  if (cache && Date.now() - cache.at < TTL()) return cache.list;
  let list: Project[];
  try {
    const res = await fetch(`${STUDIO()}/api/projects`, { cache: "no-store", signal: AbortSignal.timeout(2000) });
    const body = await res.json();
    const seen = new Set<string>();
    list = (Array.isArray(body?.projects) ? body.projects : []).map(readProject).filter((p: Project | null): p is Project => !!p && !seen.has(p.id) && !!seen.add(p.id));
    if (list.length === 0) list = bundled();
  } catch { list = bundled(); }
  cache = { at: Date.now(), list };
  return list;
}
export const resetProjectsCache = () => { cache = null; };
export async function getProject(id: string): Promise<Project | undefined> {
  if (!ID.test(id) || RESERVED.has(id)) return undefined;
  return (await listProjects()).find((p) => p.id === id);
}
/** The project served at the root address: set FINX_WEB_DEFAULT_PROJECT, else the first one. */
export async function defaultProjectId() {
  const list = await listProjects();
  const want = process.env.FINX_WEB_DEFAULT_PROJECT;
  return want && list.some((p) => p.id === want) ? want : list[0]!.id;
}
