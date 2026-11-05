import { promises as fs } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PRESETS, accentProblem, applyLook, countryByCode, knownCurrency, lookById, checkWorkspaceTheme, projectShape, resolveBrand, resolveComponentTokens, validateShape, WORKSPACES, type ProjectShape, type Brand, type BrandDef, type ComponentTokenOverrides, type WorkspaceId, type WorkspaceTheme } from "@finx/ui-kit";
import { PROVIDERS, isProviderId } from "@finx/mock-bank-api";
import { StoreError } from "./store";
import { brandsFile } from "./brand-ids";

/**
 * Projects are the bank apps in packages/ui-kit/src/brands.json. Studio reads and writes that file, so a project made here is a
 * real, buildable app: `pnpm ios:sim --brand <id>`. The file is read on every call so a new project shows up straight away.
 */
export { brandsFile };

export type Project = BrandDef & { id: string; brand: Brand };
export type NewProject = {
  name: string; bundleId?: string; preset: string; accent: string; currency: string;
  /** A ready look from the library (sets the preset, accent, bar, fields, corners and sizes unless given here). */
  look?: string;
  /** Corner radii and component sizes from the look step's sliders. */
  radius?: unknown; components?: unknown;
  /** Country profile code (JO, PK...): fills currency, locale, languages and the first entity. */
  country?: string;
  channels?: unknown; languages?: unknown; customLanguages?: unknown; entities?: unknown;
};

const read = async (): Promise<Record<string, BrandDef>> => JSON.parse(await fs.readFile(brandsFile(), "utf8"));
const toProject = (id: string, def: BrandDef): Project => ({ id, ...def, brand: resolveBrand(id, def) });

export async function listProjects(): Promise<Project[]> {
  return Object.entries(await read()).map(([id, def]) => toProject(id, def));
}
export async function getProject(id: string): Promise<Project | undefined> {
  const def = (await read())[id];
  return def ? toProject(id, def) : undefined;
}

export const CURRENCIES: Record<string, string> = { USD: "en-US", EUR: "en-IE", GBP: "en-GB", PKR: "en-PK", INR: "en-IN", AED: "en-AE", SAR: "en-SA", CAD: "en-CA", AUD: "en-AU", JOD: "en-JO", EGP: "en-EG", KWD: "en-KW", QAR: "en-QA", BHD: "en-BH", OMR: "en-OM" };
const RESERVED = new Set(["all", "new", "api", "projects", "journeys", "agents"]);
const PRESET_LOOK: Record<string, { background: string; splashDark: string }> = {
  meezan: { background: "#F6F7F9", splashDark: "#0A0D12" },
  bankworkx: { background: "#F6F4FC", splashDark: "#0D1022" },
};

export const slugOf = (name: string) => name.toLowerCase().trim().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30).replace(/-+$/, "");
/** A reverse-domain app id such as com.acmebank.app, from the name. */
export const suggestBundleId = (name: string) => `com.${slugOf(name).replace(/-/g, "") || "bank"}.app`;
const BUNDLE_ID = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/;

export type Created = { project: Project; iconsMade: boolean; iconWarning?: string };

/** An entity may only use languages the project offers. */
function checkEntityLanguages(shape: ProjectShape) {
  for (const e of shape.entities) {
    const missing = e.languages.filter((l) => !shape.languages.includes(l));
    if (missing.length) throw new StoreError(400, `Entity ${e.id} uses ${missing.join(", ")}, which the project does not offer. Add it to the project's languages first.`);
  }
}

/** The currencies a project offers must include its base currency and every entity's, and a currency it added cannot be dropped while something uses it. */
function checkCurrencies(shape: ProjectShape) {
  const used = new Set([shape.baseCurrency, ...shape.entities.flatMap((e) => [e.currency, ...(e.currencies ?? [])])]);
  const missing = [...used].filter((c) => !shape.currencies.includes(c));
  const unknown = [...used, ...shape.currencies].filter((c) => !knownCurrency(c, shape.customCurrencies));
  if (unknown.length) throw new StoreError(400, `${[...new Set(unknown)].join(", ")} is still in use but no longer defined. Keep the custom currency, or stop using it first.`);
  if (missing.length) throw new StoreError(400, `${missing.join(", ")} is the base currency or used by an entity, so the project must offer it. Add it to the currencies first.`);
}

/** Corner radii from the sliders: sm, md, lg and xl, each 0 to 40 px. */
function cleanRadius(input: unknown): BrandDef["radius"] | undefined {
  if (input === undefined || input === null) return undefined;
  if (typeof input !== "object") throw new StoreError(400, "radius must be an object");
  const out: NonNullable<BrandDef["radius"]> = {};
  for (const k of ["sm", "md", "lg", "xl"] as const) {
    const v = (input as Record<string, unknown>)[k];
    if (v === undefined) continue;
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 40) throw new StoreError(400, `radius.${k} must be a number from 0 to 40`);
    out[k] = v;
  }
  return out;
}

/** Component sizes that differ from the defaults for these corner radii; throws on a bad value. */
function cleanComponents(input: unknown, radii: { md: number; lg: number }): ComponentTokenOverrides | undefined {
  if (input === undefined || input === null) return undefined;
  if (typeof input !== "object") throw new StoreError(400, "Send the component sizes as an object");
  const overrides: Record<string, Record<string, number>> = {};
  const defaultsFor = resolveComponentTokens(undefined, radii);
  for (const [group, defaults] of Object.entries(defaultsFor)) {
    const given = (input as Record<string, unknown>)[group];
    if (given === undefined) continue;
    if (!given || typeof given !== "object") throw new StoreError(400, `${group} must be an object`);
    for (const key of Object.keys(defaults)) {
      const v = (given as Record<string, unknown>)[key];
      if (v === undefined) continue;
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 200) throw new StoreError(400, `${group}.${key} must be a number from 0 to 200`);
      if (v !== (defaults as Record<string, number>)[key]) (overrides[group] ??= {})[key] = v;
    }
  }
  return Object.keys(overrides).length ? (overrides as ComponentTokenOverrides) : undefined;
}

/** Adds a project (bank app). Throws StoreError with a message a person can act on. */
export async function createProject(input: NewProject): Promise<Created> {
  const name = String(input.name ?? "").trim();
  if (name.length < 2 || name.length > 40) throw new StoreError(400, "Name the project with 2 to 40 characters");
  const id = slugOf(name);
  if (id.length < 2) throw new StoreError(400, "The name needs letters or numbers");
  if (RESERVED.has(id)) throw new StoreError(400, `"${id}" is reserved. Choose another name`);
  const all = await read();
  if (id in all || Object.values(all).some((d) => d.slug === id)) throw new StoreError(409, "A project with this name already exists");

  const bundleId = String(input.bundleId ?? "").trim() || suggestBundleId(name);
  if (!BUNDLE_ID.test(bundleId) || bundleId.length > 80) throw new StoreError(400, "The app id must look like com.yourbank.app: lowercase letters and numbers in dot-separated parts");
  if (Object.values(all).some((d) => d.bundleId === bundleId)) throw new StoreError(409, `Another project already uses ${bundleId}`);

  const library = input.look ? lookById(String(input.look)) : undefined;
  if (input.look && !library) throw new StoreError(400, "Choose a look from the library");
  if (!(input.preset in PRESETS)) throw new StoreError(400, `Choose a look: ${Object.keys(PRESETS).join(" or ")}`);
  const accent = String(input.accent ?? "").toUpperCase();
  const bad = accentProblem(accent);
  if (bad) throw new StoreError(400, bad);
  const country = input.country ? countryByCode(String(input.country)) : undefined;
  if (input.country && !country) throw new StoreError(400, `Choose a country from the list of profiles`);
  const currency = String(input.currency || country?.currency || "").toUpperCase();
  if (country ? !/^[A-Z]{3}$/.test(currency) : !(currency in CURRENCIES)) throw new StoreError(400, country ? "The currency must be a 3-letter code like JOD" : `Choose a currency: ${Object.keys(CURRENCIES).join(", ")}`);
  const locale = country && currency === country.currency ? country.locale : CURRENCIES[currency] ?? (country ? country.locale : "en-US");

  const scheme = id.replace(/-/g, "");
  if (Object.values(all).some((d) => d.scheme === scheme)) throw new StoreError(409, "A project with a very similar name already exists");
  const preset = input.preset as keyof typeof PRESETS;
  const def: BrandDef = {
    name, shortName: name.length > 16 ? name.split(/\s+/)[0]!.slice(0, 16) : name, slug: id, bundleId, scheme,
    preset, accent, currency, locale, assets: `./assets/${id}`, ...PRESET_LOOK[preset]!,
  };
  // a library look sets the screens' style; the sliders (radius, components) and an explicit shape come on top
  if (library) { const l = applyLook(library); if (l.look) def.look = l.look; if (l.radius) def.radius = l.radius; if (l.components) def.components = l.components; }
  const radius = cleanRadius(input.radius);
  if (radius) def.radius = { ...(def.radius ?? {}), ...radius };
  const components = cleanComponents(input.components, { md: resolveBrand(id, def).radius.md, lg: resolveBrand(id, def).radius.lg });
  if (components) def.components = { ...(def.components ?? {}), ...components };
  const wantsShape = [input.channels, input.languages, input.customLanguages, input.entities].some((v) => v !== undefined) || !!country;
  if (wantsShape) {
    const given = { channels: input.channels, languages: input.languages, customLanguages: input.customLanguages, entities: input.entities };
    const checked = validateShape(Object.fromEntries(Object.entries(given).filter(([, v]) => v !== undefined)));
    if (!checked.ok) throw new StoreError(400, checked.errors.join(". "));
    Object.assign(def, checked.shape);
    if (country) {
      def.languages ??= country.languages;
      def.entities ??= [{ id: "main", name, country: country.code, currency, languages: def.languages }];
    }
    checkEntityLanguages(projectShape(def));
  }

  const file = brandsFile();
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify({ ...all, [id]: def }, null, 2) + "\n");
  await fs.rename(tmp, file);

  const icons = makeIcons(id, accent);
  return { project: toProject(id, def), iconsMade: icons.ok, iconWarning: icons.warning };
}

/** Changes a project's brand colour, for example to one taken from a design. The app icons are remade from it. */
export async function updateProjectAccent(id: string, accentInput: unknown): Promise<Created & { previous: string }> {
  const all = await read();
  const def = all[id];
  if (!def) throw new StoreError(404, `No project called ${id}`);
  const accent = String(accentInput ?? "").toUpperCase();
  const bad = accentProblem(accent);
  if (bad) throw new StoreError(400, bad);
  const updated: BrandDef = { ...def, accent };
  const file = brandsFile();
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify({ ...all, [id]: updated }, null, 2) + "\n");
  await fs.rename(tmp, file);
  const icons = makeIcons(id, accent);
  return { project: toProject(id, updated), iconsMade: icons.ok, iconWarning: icons.warning, previous: def.accent };
}

/** What a project covers: its channels, languages and legal entities, with today's single-bank settings filling anything unset. */
export async function getProjectShape(id: string): Promise<ProjectShape> {
  const def = (await read())[id];
  if (!def) throw new StoreError(404, `No project called ${id}`);
  return projectShape(def);
}

/** Changes a project's channels, languages (built in or added), and entities. Every problem found is reported at once. */
export async function updateProjectShape(id: string, input: unknown): Promise<{ project: Project; shape: ProjectShape; previous: ProjectShape }> {
  const all = await read();
  const def = all[id];
  if (!def) throw new StoreError(404, `No project called ${id}`);
  const checked = validateShape(input, def.customLanguages ?? [], def.customCurrencies ?? []);
  if (!checked.ok) throw new StoreError(400, checked.errors.join(". "));
  const previous = projectShape(def);
  const { baseCurrency, ...rest } = checked.shape;
  if (baseCurrency && !(checked.shape.currencies ?? previous.currencies).includes(baseCurrency)) throw new StoreError(400, `${baseCurrency} is not one of the project's currencies. Add it to the currencies first.`);
  const updated: BrandDef = { ...def, ...rest, ...(baseCurrency ? { currency: baseCurrency } : {}) };
  // the base currency leads the offered list, so "offers" reads naturally
  if (updated.currencies) updated.currencies = [updated.currency, ...updated.currencies.filter((c) => c !== updated.currency)];
  const next = projectShape(updated);
  checkCurrencies(next);
  // an entity may only use languages the project offers
  for (const e of next.entities) {
    const missing = e.languages.filter((l) => !next.languages.includes(l));
    if (missing.length) throw new StoreError(400, `Entity ${e.id} uses ${missing.join(", ")}, which the project does not offer. Add it to the project's languages first.`);
  }
  const file = brandsFile();
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify({ ...all, [id]: updated }, null, 2) + "\n");
  await fs.rename(tmp, file);
  return { project: toProject(id, updated), shape: next, previous };
}

/** Sets the sizes of a project's shared components (field, button, bar, row, keypad). Only values that differ from the defaults are stored. */
export async function updateProjectComponents(id: string, input: unknown): Promise<{ project: Project; previous?: ComponentTokenOverrides }> {
  const all = await read();
  const def = all[id];
  if (!def) throw new StoreError(404, `No project called ${id}`);
  if (!input || typeof input !== "object") throw new StoreError(400, "Send the component sizes as an object");
  const overrides = cleanComponents(input, resolveBrand(id, def).radius);
  const { components: previous, ...rest } = def;
  const updated: BrandDef = overrides ? { ...rest, components: overrides } : rest;
  const file = brandsFile();
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify({ ...all, [id]: updated }, null, 2) + "\n");
  await fs.rename(tmp, file);
  return { project: toProject(id, updated), previous };
}

/**
 * Sets the look of one workspace (Personal or Business) of a project, as WorkspaceTheme. Pass null to give the workspace back to the bank's own
 * look. Every problem found is reported at once. The answer includes the previous theme, to undo.
 */
export async function updateProjectWorkspace(id: string, workspace: unknown, input: unknown): Promise<{ project: Project; previous?: WorkspaceTheme }> {
  const all = await read();
  const def = all[id];
  if (!def) throw new StoreError(404, `No project called ${id}`);
  if (typeof workspace !== "string" || !WORKSPACES.includes(workspace as WorkspaceId)) throw new StoreError(400, `Choose a workspace: ${WORKSPACES.join(" or ")}`);
  const w = workspace as WorkspaceId;
  let theme: WorkspaceTheme | undefined;
  if (input !== null) {
    const checked = checkWorkspaceTheme(input);
    if (!checked.ok) throw new StoreError(400, checked.errors.join(". "));
    theme = checked.theme;
  }
  const { workspaces: before, ...rest } = def;
  const next = { ...(before ?? {}) };
  if (theme) next[w] = theme; else delete next[w];
  const updated: BrandDef = Object.keys(next).length ? { ...rest, workspaces: next } : rest;
  const file = brandsFile();
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify({ ...all, [id]: updated }, null, 2) + "\n");
  await fs.rename(tmp, file);
  return { project: toProject(id, updated), previous: before?.[w] };
}

/** Sets which bank API a project runs against. "reference" (the default) is stored as nothing, so brands.json stays small. */
export async function updateProjectBankApi(id: string, input: unknown): Promise<{ project: Project; previous: string }> {
  const all = await read();
  const def = all[id];
  if (!def) throw new StoreError(404, `No project called ${id}`);
  const value = (input as { bankApi?: unknown } | null)?.bankApi;
  if (!isProviderId(value)) throw new StoreError(400, `Choose one of: ${PROVIDERS.join(", ")}`);
  const { bankApi: previous, ...rest } = def;
  const updated: BrandDef = value === "reference" ? rest : { ...rest, bankApi: value };
  const file = brandsFile();
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify({ ...all, [id]: updated }, null, 2) + "\n");
  await fs.rename(tmp, file);
  return { project: toProject(id, updated), previous: previous ?? "reference" };
}

/** The app icons come from the accent colour. If Python or Pillow is missing, the build script makes them later. */
function makeIcons(id: string, accent: string): { ok: boolean; warning?: string } {
  if (process.env.FINX_SKIP_ICONS === "1") return { ok: false, warning: "Icons are made the first time the app is built." };
  const app = path.resolve(path.dirname(brandsFile()), "../../../apps/bank-app");
  const r = spawnSync("python3", [path.join(app, "scripts", "generate-brand-assets.py"), "--accent", accent, "--out", path.join(app, "assets", id)], { encoding: "utf8", timeout: 30_000 });
  return r.status === 0 ? { ok: true } : { ok: false, warning: "The app icons could not be made now (needs Python with Pillow). They are made the first time the app is built." };
}
