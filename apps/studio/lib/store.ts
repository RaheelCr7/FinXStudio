import { promises as fs } from "node:fs";
import path from "node:path";
import { localTransfer, validateJourney, type Journey, type LintIssue } from "@finx/journey-schema";
import { lintAll } from "@finx/renderer-core";
import { sameContent } from "./edit";
import { shapeOf } from "./graph";
import { appIds } from "./brand-ids";

export type HistoryEntry = { version: number; publishedAt: string; by: string };
export type JourneyRecord = { slug: string; draft: Journey; published?: Journey; history: HistoryEntry[]; updatedAt: string };
export type RunStatus = "running" | "needs_review" | "done" | "failed";
export type RunStep = { at: string; text: string };
/** One piece of work an AI agent (a Claude Code skill) did, reported back through the FinX MCP server. */
export type AgentRun = { id: string; agent: string; title: string; brief?: string; status: RunStatus; summary?: string; journeySlug?: string; steps: RunStep[]; startedAt: string; updatedAt: string };
type Db = { journeys: Record<string, JourneyRecord>; runs?: Record<string, AgentRun> };

const file = () => path.join(process.env.FINX_DATA_DIR ?? path.join(process.cwd(), ".data"), "journeys.json");
const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;

async function read(): Promise<Db> {
  try {
    const db = JSON.parse(await fs.readFile(file(), "utf8")) as Db;
    db.runs ??= {};
    return db;
  } catch {
    const now = new Date().toISOString();
    const db: Db = {
      runs: {},
      journeys: {
        [localTransfer.slug]: {
          slug: localTransfer.slug,
          draft: structuredClone(localTransfer),
          published: structuredClone(localTransfer),
          history: [{ version: localTransfer.version, publishedAt: now, by: "seed" }],
          updatedAt: now,
        },
      },
    };
    await write(db);
    return db;
  }
}
async function write(db: Db) {
  await fs.mkdir(path.dirname(file()), { recursive: true });
  await fs.writeFile(file(), JSON.stringify(db, null, 2));
}

export class StoreError extends Error {
  constructor(public status: number, message: string, public issues?: LintIssue[]) { super(message); }
}
export const assertSlug = (slug: string) => { if (!SLUG.test(slug)) throw new StoreError(400, "Invalid journey slug"); };

export async function listJourneys() {
  const db = await read();
  return Object.values(db.journeys).map((r) => ({
    slug: r.slug,
    name: r.draft.name,
    publishedVersion: r.published?.version ?? null,
    draftDiffers: !sameContent(r.draft, r.published),
    screens: r.draft.screens.length,
    channels: r.draft.channels,
    apps: r.draft.apps ?? [],
    updatedAt: r.updatedAt,
    issues: lintAll(r.draft).length,
    languages: r.draft.locale.supported,
    shape: shapeOf(r.draft),
  })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getRecord(slug: string): Promise<JourneyRecord> {
  assertSlug(slug);
  const r = (await read()).journeys[slug];
  if (!r) throw new StoreError(404, "Journey not found");
  return r;
}

export async function saveDraft(slug: string, body: unknown) {
  assertSlug(slug);
  const v = validateJourney(body);
  if (!v.ok) throw new StoreError(422, "Journey does not match the schema: " + v.errors.slice(0, 5).join("; "));
  if (v.journey.slug !== slug) throw new StoreError(422, "Slug cannot be changed");
  const db = await read();
  const rec = db.journeys[slug];
  if (!rec) throw new StoreError(404, "Journey not found");
  rec.draft = { ...v.journey, status: "draft" };
  rec.updatedAt = new Date().toISOString();
  await write(db);
  return { record: rec, issues: lintAll(rec.draft), warnings: v.warnings };
}

export async function publish(slug: string, by = "studio") {
  assertSlug(slug);
  const db = await read();
  const rec = db.journeys[slug];
  if (!rec) throw new StoreError(404, "Journey not found");
  const issues = lintAll(rec.draft);
  if (issues.length) throw new StoreError(422, `Cannot publish: ${issues.length} lint issue(s)`, issues);
  const version = (rec.published?.version ?? 0) + 1;
  rec.published = { ...structuredClone(rec.draft), version, status: "published" };
  rec.draft = structuredClone(rec.published);
  rec.history.push({ version, publishedAt: new Date().toISOString(), by });
  rec.updatedAt = new Date().toISOString();
  // a human publishing the reviewed draft completes the agent run that produced it
  for (const run of Object.values(db.runs ?? {})) {
    if (run.journeySlug === slug && run.status === "needs_review") {
      run.status = "done";
      run.steps.push({ at: rec.updatedAt, text: `Published v${version} to UAT by ${by}` });
      run.updatedAt = rec.updatedAt;
    }
  }
  await write(db);
  return rec;
}

/** Keeps only known app ids. No apps means the original Meezan app. */
export async function cleanApps(apps: unknown): Promise<string[] | undefined> {
  if (apps == null) return undefined;
  if (!Array.isArray(apps) || apps.some((a) => typeof a !== "string")) throw new StoreError(400, "apps must be a list of app ids");
  const known = await appIds();
  const bad = apps.filter((a) => !known.includes(a));
  if (bad.length) throw new StoreError(400, `Unknown app ${bad.join(", ")}. Use one of: ${known.join(", ")}`);
  return apps.length ? [...new Set(apps as string[])] : undefined;
}

export async function createJourney(name: string, appsInput?: unknown) {
  const apps = await cleanApps(appsInput);
  // Meezan journeys start in English and Urdu. Another app's journeys start in English only, so nothing is flagged as untranslated.
  const english = !!apps && !apps.includes("meezan");
  const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  assertSlug(slug || "x");
  const db = await read();
  if (db.journeys[slug]) throw new StoreError(409, "A journey with this name already exists");
  const j: Journey = {
    id: `jrn_${slug.replace(/-/g, "_")}`, slug, name, version: 0, status: "draft", channels: ["web", "mobile"],
    ...(apps ? { apps } : {}),
    locale: english ? { default: "en", supported: ["en"] } : { default: "en", supported: ["en", "ur"], rtl: ["ur"] }, entryScreen: "welcome", integrations: [],
    screens: [
      { id: "welcome", title: name, blocks: [
        { type: "text", variant: "title", text: name },
        { type: "text", text: "Describe this step for your customer." },
        { type: "button", label: "Continue", variant: "primary", actions: [{ type: "navigate", to: "done" }] },
      ] },
      { id: "done", title: "Done", kind: "terminal", blocks: [
        { type: "result", tone: "success", title: "All done" },
        { type: "button", label: "Close", variant: "primary", actions: [{ type: "exit" }] },
      ] },
    ],
  };
  const now = new Date().toISOString();
  db.journeys[slug] = { slug, draft: j, history: [], updatedAt: now };
  await write(db);
  return db.journeys[slug]!;
}

/**
 * Copies a journey into another project (a bank app), as a new journey of its own, so a new bank can start from working journeys.
 * The copy gets a slug of its own, belongs only to that project, and can be published straight away.
 */
export async function cloneJourney(sourceSlug: string, projectId: string, opts: { publishNow?: boolean } = {}) {
  assertSlug(sourceSlug);
  const apps = (await cleanApps([projectId]))!;
  const db = await read();
  const src = db.journeys[sourceSlug];
  if (!src) throw new StoreError(404, "Journey not found");
  const slug = `${sourceSlug}-${projectId}`.slice(0, 62).replace(/-+$/, "");
  assertSlug(slug);
  if (db.journeys[slug]) throw new StoreError(409, `A journey called ${slug} already exists`);
  const base = structuredClone(src.published ?? src.draft);
  const j: Journey = { ...base, id: `jrn_${slug.replace(/-/g, "_")}`, slug, version: 0, status: "draft", apps };
  const now = new Date().toISOString();
  db.journeys[slug] = { slug, draft: j, history: [], updatedAt: now };
  await write(db);
  return opts.publishNow ? publish(slug, "new project") : db.journeys[slug]!;
}

// ---- agent runs -----------------------------------------------------------------------------------------------

const STATUSES: RunStatus[] = ["running", "needs_review", "done", "failed"];
const MAX_STEPS = 100;
const STATUS_STEP: Record<RunStatus, string> = { running: "Back to running", needs_review: "Ready for your review", done: "Marked done", failed: "Marked failed" };
export type RunInput = { id?: string; agent?: string; title?: string; brief?: string; status?: string; summary?: string; journeySlug?: string; note?: string };

const text = (v: unknown, name: string, max: number): string | undefined => {
  if (v == null) return undefined;
  if (typeof v !== "string") throw new StoreError(400, `${name} must be text`);
  if (v.length > max) throw new StoreError(400, `${name} is too long (max ${max} characters)`);
  return v;
};

/** Create a run (no id) or update one (with id). Notes become timeline steps. */
export async function upsertRun(input: RunInput): Promise<AgentRun> {
  const title = text(input.title, "title", 120), brief = text(input.brief, "brief", 2000), summary = text(input.summary, "summary", 4000), note = text(input.note, "note", 500);
  const agent = text(input.agent, "agent", 24);
  if (agent !== undefined && !/^[a-z][a-z-]{1,23}$/.test(agent)) throw new StoreError(400, "agent must be lowercase letters, e.g. journey");
  if (input.status !== undefined && !STATUSES.includes(input.status as RunStatus)) throw new StoreError(400, `status must be one of ${STATUSES.join(", ")}`);
  if (input.journeySlug !== undefined) assertSlug(input.journeySlug);
  const db = await read();
  db.runs ??= {};
  const now = new Date().toISOString();
  let run: AgentRun;
  if (input.id) {
    const existing = db.runs[input.id];
    if (!existing) throw new StoreError(404, "Run not found");
    run = existing;
  } else {
    if (!title) throw new StoreError(400, "title is required to start a run");
    run = { id: `run_${crypto.randomUUID().slice(0, 8)}`, agent: agent ?? "journey", title, status: "running", steps: [], startedAt: now, updatedAt: now };
    db.runs[run.id] = run;
  }
  if (title && input.id) run.title = title;
  if (brief !== undefined) run.brief = brief;
  if (summary !== undefined) run.summary = summary;
  if (input.journeySlug !== undefined) run.journeySlug = input.journeySlug;
  const statusChanged = input.status !== undefined && input.status !== run.status;
  if (input.status !== undefined) run.status = input.status as RunStatus;
  if (note) run.steps.push({ at: now, text: note });
  else if (statusChanged && input.id) run.steps.push({ at: now, text: STATUS_STEP[run.status] });
  if (!input.id && run.steps.length === 0) run.steps.push({ at: now, text: "Started" });
  run.steps = run.steps.slice(-MAX_STEPS);
  run.updatedAt = now;
  await write(db);
  return run;
}

export async function listRuns(): Promise<AgentRun[]> {
  const db = await read();
  // newest update first; runs touched in the same millisecond keep reverse insertion order
  return Object.values(db.runs ?? {})
    .map((run, i) => ({ run, i }))
    .sort((a, b) => b.run.updatedAt.localeCompare(a.run.updatedAt) || b.i - a.i)
    .map((x) => x.run)
    .slice(0, 100);
}

export async function getRun(id: string): Promise<AgentRun> {
  const run = (await read()).runs?.[id];
  if (!run) throw new StoreError(404, "Run not found");
  return run;
}

export async function latestRunForJourney(slug: string): Promise<AgentRun | undefined> {
  return (await listRuns()).find((r) => r.journeySlug === slug && r.agent === "journey");
}
