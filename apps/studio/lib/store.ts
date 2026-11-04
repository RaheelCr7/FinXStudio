import { promises as fs } from "node:fs";
import path from "node:path";
import { localTransfer, signJourney, validateJourney, type Journey, type JourneySignature, type LintIssue } from "@finx/journey-schema";
import { isProduction } from "./profile";
import { lintAll } from "@finx/renderer-core";
import { sameContent } from "./edit";
import { shapeOf } from "./graph";
import { describeChanges } from "./diff";
import { appIds } from "./brand-ids";
import { createHash } from "node:crypto";

export type HistoryEntry = { version: number; publishedAt: string; by: string };
/** Published copies kept for rolling back. Older versions than this are dropped. */
export const KEEP_VERSIONS = 20;
export type JourneyRecord = { slug: string; draft: Journey; published?: Journey; /** the signature made when a person published it (when a signing key is set) */ publishedSignature?: JourneySignature; history: HistoryEntry[]; updatedAt: string; /** who last changed the draft, for the approval rule */ editedBy?: { id: string; name: string }; /** the published journey as it was at each version number */ versions?: Record<string, Journey> };
export type RunStatus = "running" | "needs_review" | "done" | "failed";
export type RunStep = { at: string; text: string };
/** One piece of work an AI agent (a Claude Code skill) did, reported back through the FinX MCP server. */
/** A journey as it was before a run first wrote to it, and a fingerprint of what the run left, so undo can tell whether a person edited it since. */
export type Checkpoint = { at: string; existed: boolean; before?: Journey; after: string };
export type AgentRun = { id: string; agent: string; title: string; brief?: string; status: RunStatus; summary?: string; journeySlug?: string; steps: RunStep[]; startedAt: string; updatedAt: string; checkpoints?: Record<string, Checkpoint>; undoneAt?: string };
const fingerprint = (j: Journey) => createHash("sha1").update(JSON.stringify(j)).digest("hex");
/** Called inside a write, before it is saved: remembers how the journey was before this run's first write, and what the run left. */
function track(db: Db, runId: string | undefined, slug: string, before: Journey | undefined, after: Journey) {
  const run = runId ? db.runs?.[runId] : undefined;
  if (!run) return;
  run.checkpoints ??= {};
  run.checkpoints[slug] ??= { at: new Date().toISOString(), existed: !!before, ...(before ? { before: structuredClone(before) } : {}), after: "" };
  run.checkpoints[slug]!.after = fingerprint(after);
}
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

export async function saveDraft(slug: string, body: unknown, by?: { id: string; name: string }, runId?: string) {
  assertSlug(slug);
  const v = validateJourney(body);
  if (!v.ok) throw new StoreError(422, "Journey does not match the schema: " + v.errors.slice(0, 5).join("; "));
  if (v.journey.slug !== slug) throw new StoreError(422, "Slug cannot be changed");
  const db = await read();
  const rec = db.journeys[slug];
  if (!rec) throw new StoreError(404, "Journey not found");
  const before = rec.draft;
  rec.draft = { ...v.journey, status: "draft" };
  track(db, runId, slug, before, rec.draft);
  if (by) rec.editedBy = by;
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
  // production never serves an unsigned journey: refuse to publish without a key, before anything changes
  const key = process.env.FINX_SIGNING_KEY?.trim();
  if (!key && isProduction()) throw new StoreError(409, "Cannot publish: FINX_SIGNING_KEY is not set, so the journey could not be signed");
  const version = (rec.published?.version ?? 0) + 1;
  // the version being replaced may predate version copies: keep it now so it can still be restored
  if (rec.published && !rec.versions?.[String(rec.published.version)]) rec.versions = { ...(rec.versions ?? {}), [String(rec.published.version)]: structuredClone(rec.published) };
  rec.published = { ...structuredClone(rec.draft), version, status: "published" };
  if (key) { try { rec.publishedSignature = signJourney(rec.published, key); } catch { throw new StoreError(409, "Cannot publish: FINX_SIGNING_KEY is not a valid key (64 hex characters)"); } }
  else delete rec.publishedSignature;
  rec.draft = structuredClone(rec.published);
  rec.history.push({ version, publishedAt: new Date().toISOString(), by });
  rec.versions = { ...(rec.versions ?? {}), [String(version)]: structuredClone(rec.published) };
  for (const old of Object.keys(rec.versions).map(Number).sort((x, y) => y - x).slice(KEEP_VERSIONS)) delete rec.versions[String(old)];
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

/** The published journey as it was at a version: kept copy, or the live one when that is the version asked for. */
function snapshotOf(rec: JourneyRecord, version: number): Journey | undefined {
  return rec.versions?.[String(version)] ?? (rec.published?.version === version ? rec.published : undefined);
}

/** Every publish of a journey, newest first, with what differs from the current draft and whether it can be restored. */
export async function listVersions(slug: string) {
  const rec = await getRecord(slug);
  return [...rec.history].reverse().map((h) => {
    const snap = snapshotOf(rec, h.version);
    return { ...h, restorable: !!snap, live: rec.published?.version === h.version, changes: snap ? describeChanges(snap, rec.draft) : [] };
  });
}

/** Puts an earlier published version back as the draft. Nothing changes for customers until a person publishes it again. */
export async function restoreVersion(slug: string, version: number, by?: { id: string; name: string }) {
  assertSlug(slug);
  const db = await read();
  const rec = db.journeys[slug];
  if (!rec) throw new StoreError(404, "Journey not found");
  if (!Number.isInteger(version)) throw new StoreError(400, "version must be a whole number");
  const snap = snapshotOf(rec, version);
  if (!snap) throw new StoreError(409, `There is no saved copy of v${version}. Copies are kept for the last ${KEEP_VERSIONS} publishes.`);
  rec.draft = { ...structuredClone(snap), status: "draft" };
  if (by) rec.editedBy = by;
  rec.updatedAt = new Date().toISOString();
  await write(db);
  return rec;
}

export async function createJourney(name: string, appsInput?: unknown, by?: { id: string; name: string }, runId?: string) {
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
  db.journeys[slug] = { slug, draft: j, history: [], updatedAt: now, ...(by ? { editedBy: by } : {}) };
  track(db, runId, slug, undefined, j);
  await write(db);
  return db.journeys[slug]!;
}

/**
 * Copies a journey into another project (a bank app), as a new journey of its own, so a new bank can start from working journeys.
 * The copy gets a slug of its own, belongs only to that project, and can be published straight away.
 */
export async function cloneJourney(sourceSlug: string, projectId: string, opts: { publishNow?: boolean } = {}) {
  assertSlug(sourceSlug);
  const db = await read();
  const src = db.journeys[sourceSlug];
  if (!src) throw new StoreError(404, "Journey not found");
  return insertCopy(db, src.published ?? src.draft, sourceSlug, projectId, opts.publishNow ? "new project" : undefined);
}

/** Adds a copy of any journey (a catalog entry, say) to a project, as a journey of its own. */
export async function addJourneyCopy(template: Journey, projectId: string, opts: { publishNow?: boolean; runId?: string } = {}) {
  return insertCopy(await read(), template, template.slug, projectId, opts.publishNow ? "catalog" : undefined, opts.runId);
}

async function insertCopy(db: Db, base: Journey, sourceSlug: string, projectId: string, publishBy?: string, runId?: string) {
  const apps = (await cleanApps([projectId]))!;
  const slug = `${sourceSlug}-${projectId}`.slice(0, 62).replace(/-+$/, "");
  assertSlug(slug);
  if (db.journeys[slug]) throw new StoreError(409, `A journey called ${slug} already exists`);
  const j: Journey = { ...structuredClone(base), id: `jrn_${slug.replace(/-/g, "_")}`, slug, version: 0, status: "draft", apps };
  const now = new Date().toISOString();
  db.journeys[slug] = { slug, draft: j, history: [], updatedAt: now };
  track(db, runId, slug, undefined, j);
  await write(db);
  return publishBy ? publish(slug, publishBy) : db.journeys[slug]!;
}

/** Adds a journey that came from outside (a git file) as a draft of its own. The slug must be free. */
export async function importDraft(body: unknown, by?: { id: string; name: string }) {
  const v = validateJourney(body);
  if (!v.ok) throw new StoreError(422, "Journey does not match the schema: " + v.errors.slice(0, 5).join("; "));
  assertSlug(v.journey.slug);
  const db = await read();
  if (db.journeys[v.journey.slug]) throw new StoreError(409, `A journey called ${v.journey.slug} already exists`);
  const j: Journey = { ...v.journey, status: "draft" };
  db.journeys[j.slug] = { slug: j.slug, draft: j, history: [], updatedAt: new Date().toISOString(), ...(by ? { editedBy: by } : {}) };
  await write(db);
  return db.journeys[j.slug]!;
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

/** What undoing a run would do, journey by journey, and whether a person has edited any of them since the run. */
export async function checkpointOf(id: string) {
  const db = await read();
  const run = db.runs?.[id];
  if (!run) throw new StoreError(404, "Run not found");
  return Object.entries(run.checkpoints ?? {}).map(([slug, cp]) => {
    const rec = db.journeys[slug];
    return { slug, name: rec ? (typeof rec.draft.name === "string" ? rec.draft.name : rec.draft.name.en ?? slug) : slug, created: !cp.existed, gone: !rec, editedSince: !!rec && fingerprint(rec.draft) !== cp.after, published: !!rec && (!!rec.published || rec.history.length > 0) };
  });
}

/**
 * Puts every journey the run touched back as it was: a journey the run changed gets its old draft, a journey the run created is
 * removed (unless it has been published). A journey a person has edited since is left alone unless `force` says to overwrite it.
 */
export async function undoRun(id: string, opts: { force?: boolean } = {}) {
  const db = await read();
  const run = db.runs?.[id];
  if (!run) throw new StoreError(404, "Run not found");
  if (!Object.keys(run.checkpoints ?? {}).length) throw new StoreError(409, run.undoneAt ? "This run was already undone" : "This run changed no journey, so there is nothing to undo");
  const plan = Object.entries(run.checkpoints!).map(([slug, cp]) => ({ slug, cp, rec: db.journeys[slug] }));
  if (!opts.force) {
    const edited = plan.filter((p) => p.rec && fingerprint(p.rec.draft) !== p.cp.after).map((p) => p.slug);
    if (edited.length) throw new StoreError(409, `${edited.join(", ")} ${edited.length > 1 ? "were" : "was"} edited after this run. Undo anyway to overwrite those edits.`);
  }
  const blocked = plan.filter((p) => p.rec && !p.cp.existed && (p.rec.published || p.rec.history.length)).map((p) => p.slug);
  if (blocked.length) throw new StoreError(409, `${blocked.join(", ")} ${blocked.length > 1 ? "have" : "has"} been published, so the run's own journey cannot be removed. Restore an older version instead.`);
  const restored: string[] = [], removed: string[] = [];
  const now = new Date().toISOString();
  for (const { slug, cp, rec } of plan) {
    if (!rec) continue;
    if (cp.existed && cp.before) { rec.draft = structuredClone(cp.before); rec.updatedAt = now; restored.push(slug); }
    else { delete db.journeys[slug]; removed.push(slug); }
  }
  run.undoneAt = now; delete run.checkpoints;
  run.steps.push({ at: now, text: `Undone: ${[restored.length ? `restored ${restored.join(", ")}` : "", removed.length ? `removed ${removed.join(", ")}` : ""].filter(Boolean).join("; ") || "nothing left to change"}` });
  run.updatedAt = now;
  await write(db);
  return { restored, removed };
}
