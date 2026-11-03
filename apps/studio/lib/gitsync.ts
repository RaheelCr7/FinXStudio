import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import type { Journey } from "@finx/journey-schema";
import { lintAll } from "@finx/renderer-core";
import { StoreError, assertSlug, getRecord, importDraft, listJourneys, saveDraft } from "./store";
import { appsOfJourney } from "./project-utils";

/**
 * Two-way sync between a project's drafts and a git working tree.
 *
 * What is synced: each journey's DRAFT, as `finx/<project>/<slug>.json` (key order fixed, so a diff shows only real changes).
 * Published versions are Studio's release state: they go to git only when someone deploys, as `finx/<project>/published/`.
 *
 * The conflict rule (three-way, never silent): Studio remembers a fingerprint of each journey as it was at the last sync (the base).
 *   - Studio and git hold the same content: in sync.
 *   - Only Studio changed since the base: push it. Only git changed: pull it into the draft.
 *   - Both changed (or both exist and never synced and differ): a conflict. Nothing is overwritten until a person says
 *     "keep Studio's" or "take git's"; before git's version replaces a draft, the draft is saved under .data/git-backups.
 *   - A file that is gone in git never deletes a journey in Studio, and Studio never deletes a file.
 * Studio never switches branches, never force-pushes and never publishes: a pull only changes a draft.
 */
export type GitConfig = { dir: string; branch: string };
export type Entry = { slug: string; name: string; state: "in_sync" | "push" | "pull" | "conflict" | "new_here" | "new_in_git"; detail: string };
export type Plan = { config: GitConfig; branch: string; remote: boolean; clean: boolean; entries: Entry[]; fetched?: string };
export type Resolution = "studio" | "git";

const PROJECT = /^[a-z0-9][a-z0-9-]{0,40}$/;
const dataDir = () => process.env.FINX_DATA_DIR ?? path.join(process.cwd(), ".data");
const stateFile = () => path.join(dataDir(), "git-sync.json");
type State = { configs: Record<string, GitConfig>; bases: Record<string, Record<string, string>> };

const readState = async (): Promise<State> => { try { const s = JSON.parse(await fs.readFile(stateFile(), "utf8")); return { configs: s.configs ?? {}, bases: s.bases ?? {} }; } catch { return { configs: {}, bases: {} }; } };
let chain: Promise<unknown> = Promise.resolve();
const withState = <T,>(fn: (s: State) => Promise<T>): Promise<T> => { const done = chain.then(async () => { const s = await readState(); const r = await fn(s); await fs.mkdir(dataDir(), { recursive: true }); await fs.writeFile(stateFile(), JSON.stringify(s, null, 1)); return r; }); chain = done.catch(() => undefined); return done; };

/* ---- the content fingerprint ---- */
const sortKeys = (v: any): any => Array.isArray(v) ? v.map(sortKeys) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v;
/** The file text of a journey: sorted keys, two-space indent, a final newline. */
export const fileText = (j: Journey) => JSON.stringify(sortKeys({ ...j, status: "draft" }), null, 2) + "\n";
export const fingerprint = (text: string) => createHash("sha1").update(text).digest("hex");

/** What to do with one journey, from three fingerprints: Studio's now, the file's now, and the one at the last sync. */
export function classify(studio: string | null, file: string | null, base: string | null): Entry["state"] {
  if (studio && file) {
    if (studio === file) return "in_sync";
    if (!base) return "conflict";
    if (studio === base) return "pull";
    if (file === base) return "push";
    return "conflict";
  }
  if (studio) return "new_here";
  if (file) return "new_in_git";
  return "in_sync";
}

/* ---- git, with fixed arguments and no shell ---- */
const git = (dir: string, ...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8", timeout: 60_000, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } }).trim();
const tryGit = (dir: string, ...args: string[]) => { try { return { ok: true as const, out: git(dir, ...args) }; } catch (e: any) { return { ok: false as const, out: String(e.stderr || e.message || e).trim() }; } };

export async function getConfig(project: string): Promise<GitConfig | undefined> { return (await readState()).configs[project]; }

/** Saves where a project's git working tree is. It must exist, be a git work tree, and be on the branch named. */
export async function setConfig(project: string, input: { dir?: unknown; branch?: unknown }): Promise<GitConfig> {
  if (!PROJECT.test(project)) throw new StoreError(400, "Invalid project");
  const dir = typeof input.dir === "string" ? input.dir.trim() : "";
  if (!path.isAbsolute(dir)) throw new StoreError(400, "Give the full path of a folder that is a git clone");
  const real = await fs.realpath(dir).catch(() => { throw new StoreError(400, "That folder does not exist"); });
  if (!tryGit(real, "rev-parse", "--is-inside-work-tree").ok) throw new StoreError(400, "That folder is not inside a git working tree");
  const top = git(real, "rev-parse", "--show-toplevel");
  const branch = typeof input.branch === "string" && input.branch.trim() ? input.branch.trim() : git(top, "rev-parse", "--abbrev-ref", "HEAD");
  if (!/^[A-Za-z0-9._/-]{1,80}$/.test(branch) || branch.startsWith("-")) throw new StoreError(400, "Invalid branch name");
  const cfg = { dir: top, branch };
  await withState(async (s) => { s.configs[project] = cfg; });
  return cfg;
}

const folder = (cfg: GitConfig, project: string, ...more: string[]) => {
  const p = path.resolve(cfg.dir, "finx", project, ...more);
  if (!p.startsWith(path.resolve(cfg.dir, "finx", project))) throw new StoreError(400, "Invalid path");
  return p;
};
const nameOf = (j: Journey) => (typeof j.name === "string" ? j.name : (j.name as any).en ?? j.slug);

async function studioJourneys(project: string): Promise<Journey[]> {
  const out: Journey[] = [];
  for (const row of await listJourneys()) { const { draft } = await getRecord(row.slug); if (appsOfJourney(draft).includes(project)) out.push(draft); }
  return out;
}
async function filesOf(cfg: GitConfig, project: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const dir = folder(cfg, project);
  for (const f of await fs.readdir(dir).catch(() => [] as string[])) {
    if (!f.endsWith(".json")) continue;
    const slug = f.slice(0, -5);
    try { assertSlug(slug); out[slug] = await fs.readFile(path.join(dir, f), "utf8"); } catch { /* ignore stray files */ }
  }
  return out;
}

export async function plan(project: string, opts: { pull?: boolean } = {}): Promise<Plan> {
  const state = await readState();
  const cfg = state.configs[project];
  if (!cfg) throw new StoreError(404, "This project has no git folder yet");
  const branch = git(cfg.dir, "rev-parse", "--abbrev-ref", "HEAD");
  const remote = !!tryGit(cfg.dir, "remote").out;
  let fetched: string | undefined;
  if (opts.pull && remote && branch === cfg.branch) { const r = tryGit(cfg.dir, "pull", "--ff-only"); fetched = r.ok ? (r.out.split("\n").pop() ?? "") : `Could not pull: ${r.out.split("\n")[0]}`; }
  const studio = Object.fromEntries((await studioJourneys(project)).map((j) => [j.slug, j]));
  const files = await filesOf(cfg, project);
  const bases = state.bases[project] ?? {};
  const entries: Entry[] = [];
  for (const slug of [...new Set([...Object.keys(studio), ...Object.keys(files)])].sort()) {
    const s = studio[slug] ? fingerprint(fileText(studio[slug]!)) : null;
    const f = slug in files ? fingerprint(files[slug]!) : null;
    const state_ = classify(s, f, bases[slug] ?? null);
    const detail = { in_sync: "Same in Studio and git", push: "Changed in Studio since the last sync", pull: "Changed in git since the last sync", conflict: "Changed in both places", new_here: "In Studio but not in git (never pushed, or deleted there)", new_in_git: "Only in git: not in Studio yet" }[state_];
    entries.push({ slug, name: studio[slug] ? nameOf(studio[slug]!) : slug, state: state_, detail });
  }
  const clean = !tryGit(cfg.dir, "status", "--porcelain", "--", `finx/${project}`).out;
  return { config: cfg, branch, remote, clean, entries, ...(fetched ? { fetched } : {}) };
}

export type SyncResult = { pushed: string[]; pulled: string[]; created: string[]; skipped: { slug: string; why: string }[]; committed?: string; pushedToRemote: boolean; warnings: string[] };

/** Applies the plan: pushes what only Studio changed, pulls what only git changed, and settles each conflict the way the person said. */
export async function sync(project: string, by: { id: string; name: string }, opts: { resolutions?: Record<string, Resolution>; push?: boolean } = {}): Promise<SyncResult> {
  const p = await plan(project, { pull: true });
  const cfg = p.config;
  if (p.branch !== cfg.branch) throw new StoreError(409, `The folder is on branch ${p.branch}, not ${cfg.branch}. Check out ${cfg.branch} there first: Studio never switches branches.`);
  const res: SyncResult = { pushed: [], pulled: [], created: [], skipped: [], pushedToRemote: false, warnings: [] };
  const files = await filesOf(cfg, project);
  const bases: Record<string, string> = {};
  const toWrite: Journey[] = [];
  const backup = async (j: Journey) => { const d = path.join(dataDir(), "git-backups"); await fs.mkdir(d, { recursive: true }); await fs.writeFile(path.join(d, `${j.slug}-${Date.now()}.json`), fileText(j)); };
  const pull = async (slug: string, exists: boolean) => {
    let parsed: any; try { parsed = JSON.parse(files[slug]!); } catch { res.skipped.push({ slug, why: "The file is not valid JSON" }); return; }
    try {
      if (exists) { const cur = (await getRecord(slug)).draft; await backup(cur); await saveDraft(slug, parsed, by); res.pulled.push(slug); }
      else { await importDraft(parsed, by); res.created.push(slug); }
      const now = (await getRecord(slug)).draft;
      const issues = lintAll(now); if (issues.length) res.warnings.push(`${slug}: ${issues.length} lint finding(s) after the pull`);
      bases[slug] = fingerprint(fileText(now));
    } catch (e: any) { res.skipped.push({ slug, why: e.message ?? "Could not import" }); }
  };
  for (const e of p.entries) {
    const choice = opts.resolutions?.[e.slug];
    if (e.state === "in_sync") { bases[e.slug] = fingerprint(files[e.slug]!); continue; }
    if (e.state === "push" || e.state === "new_here" || (e.state === "conflict" && choice === "studio")) { toWrite.push((await getRecord(e.slug)).draft); continue; }
    if (e.state === "pull" || (e.state === "conflict" && choice === "git")) { await pull(e.slug, true); continue; }
    if (e.state === "new_in_git") { await pull(e.slug, false); continue; }
    res.skipped.push({ slug: e.slug, why: "A conflict: choose Keep Studio's or Take git's" });
  }
  if (toWrite.length) {
    await fs.mkdir(folder(cfg, project), { recursive: true });
    for (const j of toWrite) { const text = fileText(j); await fs.writeFile(path.join(folder(cfg, project), `${j.slug}.json`), text); bases[j.slug] = fingerprint(text); res.pushed.push(j.slug); }
    git(cfg.dir, "add", "--", `finx/${project}`);
    if (tryGit(cfg.dir, "diff", "--cached", "--quiet", "--", `finx/${project}`).ok === false) {
      git(cfg.dir, "commit", "-m", `Studio: sync ${project} drafts (${res.pushed.length} journey${res.pushed.length === 1 ? "" : "s"}) by ${by.name}`, "--", `finx/${project}`);
      res.committed = git(cfg.dir, "rev-parse", "--short", "HEAD");
    }
  }
  if (opts.push !== false && p.remote && (res.committed || res.pushed.length)) {
    const r = tryGit(cfg.dir, "push", "origin", cfg.branch);
    if (r.ok) res.pushedToRemote = true; else res.warnings.push(`Committed here, but the push failed: ${r.out.split("\n")[0]}`);
  }
  await withState(async (s) => { s.bases[project] = { ...(s.bases[project] ?? {}), ...bases }; });
  return res;
}

/* ---- deploy ---- */

export type DeployResult = { tag: string; journeys: string[]; commit?: string; pushedToRemote: boolean; warnings: string[] };

/**
 * Deploys a project's PUBLISHED journeys for the web app: refuses if any has lint findings or if nothing is published, writes them to
 * finx/<project>/published/, commits, tags `deploy/<project>/<time>` and pushes the tag. The repository's deploy workflow
 * (.github/workflows/deploy-web.yml) builds the web app from that tag. Studio never switches branches or force-pushes.
 */
export async function deploy(project: string, by: { id: string; name: string }, note = ""): Promise<DeployResult> {
  const cfg = await getConfig(project);
  if (!cfg) throw new StoreError(404, "This project has no git folder yet");
  const branch = git(cfg.dir, "rev-parse", "--abbrev-ref", "HEAD");
  if (branch !== cfg.branch) throw new StoreError(409, `The folder is on branch ${branch}, not ${cfg.branch}. Check out ${cfg.branch} there first.`);
  const published: Journey[] = [];
  for (const row of await listJourneys()) { const r = await getRecord(row.slug); if (r.published && appsOfJourney(r.draft).includes(project)) published.push(r.published); }
  if (!published.length) throw new StoreError(422, "Nothing is published in this project yet. Publish a journey to UAT first.");
  const bad = published.map((j) => ({ j, issues: lintAll(j) })).filter((x) => x.issues.length);
  if (bad.length) throw new StoreError(422, `Cannot deploy: ${bad.map((b) => `${b.j.slug} has ${b.issues.length} lint finding(s)`).join("; ")}`);
  const dir = folder(cfg, project, "published");
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
  for (const j of published) await fs.writeFile(path.join(dir, `${j.slug}.json`), JSON.stringify(sortKeys(j), null, 2) + "\n");
  git(cfg.dir, "add", "-A", "--", `finx/${project}/published`);
  const res: DeployResult = { tag: "", journeys: published.map((j) => `${j.slug}@v${j.version}`), pushedToRemote: false, warnings: [] };
  if (!tryGit(cfg.dir, "diff", "--cached", "--quiet", "--", `finx/${project}/published`).ok) {
    git(cfg.dir, "commit", "-m", `Studio: deploy ${project} (${published.length} published journey${published.length === 1 ? "" : "s"}) by ${by.name}`, "--", `finx/${project}/published`);
    res.commit = git(cfg.dir, "rev-parse", "--short", "HEAD");
  }
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..*$/, "").replace("T", "-");
  res.tag = `deploy/${project}/${stamp}`;
  git(cfg.dir, "tag", "-a", res.tag, "-m", note.trim() || `Deploy ${project} by ${by.name}`);
  if (tryGit(cfg.dir, "remote").out) {
    const r = tryGit(cfg.dir, "push", "origin", cfg.branch, res.tag);
    if (r.ok) res.pushedToRemote = true; else res.warnings.push(`Tagged here, but the push failed: ${r.out.split("\n")[0]}`);
  } else res.warnings.push("This clone has no remote, so nothing was pushed: the tag exists only here.");
  return res;
}
