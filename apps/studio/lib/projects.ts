import { promises as fs } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PRESETS, accentProblem, projectShape, resolveBrand, resolveComponentTokens, validateShape, type ProjectShape, type Brand, type BrandDef, type ComponentTokenOverrides } from "@finx/ui-kit";
import { StoreError } from "./store";
import { brandsFile } from "./brand-ids";

/**
 * Projects are the bank apps in packages/ui-kit/src/brands.json. Studio reads and writes that file, so a project made here is a
 * real, buildable app: `pnpm ios:sim --brand <id>`. The file is read on every call so a new project shows up straight away.
 */
export { brandsFile };

export type Project = BrandDef & { id: string; brand: Brand };
export type NewProject = { name: string; bundleId?: string; preset: string; accent: string; currency: string };

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

  if (!(input.preset in PRESETS)) throw new StoreError(400, `Choose a look: ${Object.keys(PRESETS).join(" or ")}`);
  const accent = String(input.accent ?? "").toUpperCase();
  const bad = accentProblem(accent);
  if (bad) throw new StoreError(400, bad);
  const currency = String(input.currency ?? "").toUpperCase();
  if (!(currency in CURRENCIES)) throw new StoreError(400, `Choose a currency: ${Object.keys(CURRENCIES).join(", ")}`);

  const scheme = id.replace(/-/g, "");
  if (Object.values(all).some((d) => d.scheme === scheme)) throw new StoreError(409, "A project with a very similar name already exists");
  const preset = input.preset as keyof typeof PRESETS;
  const def: BrandDef = {
    name, shortName: name.length > 16 ? name.split(/\s+/)[0]!.slice(0, 16) : name, slug: id, bundleId, scheme,
    preset, accent, currency, locale: CURRENCIES[currency]!, assets: `./assets/${id}`, ...PRESET_LOOK[preset]!,
  };

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
  const checked = validateShape(input, def.customLanguages ?? []);
  if (!checked.ok) throw new StoreError(400, checked.errors.join(". "));
  const previous = projectShape(def);
  const updated: BrandDef = { ...def, ...checked.shape };
  // an entity may only use languages the project offers
  const next = projectShape(updated);
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
  const overrides: Record<string, Record<string, number>> = {};
  const defaultsFor = resolveComponentTokens(undefined, resolveBrand(id, def).radius);
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
  const { components: previous, ...rest } = def;
  const updated: BrandDef = Object.keys(overrides).length ? { ...rest, components: overrides as ComponentTokenOverrides } : rest;
  const file = brandsFile();
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify({ ...all, [id]: updated }, null, 2) + "\n");
  await fs.rename(tmp, file);
  return { project: toProject(id, updated), previous };
}

/** The app icons come from the accent colour. If Python or Pillow is missing, the build script makes them later. */
function makeIcons(id: string, accent: string): { ok: boolean; warning?: string } {
  if (process.env.FINX_SKIP_ICONS === "1") return { ok: false, warning: "Icons are made the first time the app is built." };
  const app = path.resolve(path.dirname(brandsFile()), "../../../apps/bank-app");
  const r = spawnSync("python3", [path.join(app, "scripts", "generate-brand-assets.py"), "--accent", accent, "--out", path.join(app, "assets", id)], { encoding: "utf8", timeout: 30_000 });
  return r.status === 0 ? { ok: true } : { ok: false, warning: "The app icons could not be made now (needs Python with Pillow). They are made the first time the app is built." };
}
