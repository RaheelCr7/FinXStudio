import { promises as fs } from "node:fs";
import path from "node:path";
import { appendAudit } from "./audit";
import { isProduction } from "./profile";

/** One thing someone did in Studio. The log only ever grows (the oldest entries are dropped past the cap). */
export type Activity = {
  id: string; at: string;
  actor: { id: string; name: string };
  /** what happened, as "kind.verb", for example journey.publish or person.role */
  action: string;
  /** what it happened to, in words */
  target: string;
  projectIds?: string[];
  detail?: string;
};
const CAP = 2000;
const file = () => path.join(process.env.FINX_DATA_DIR ?? path.join(process.cwd(), ".data"), "activity.json");

async function read(): Promise<Activity[]> {
  try { const a = JSON.parse(await fs.readFile(file(), "utf8")); return Array.isArray(a) ? a : []; } catch { return []; }
}

/** Writes are serialised so two requests at once cannot drop each other's entry. */
let chain: Promise<unknown> = Promise.resolve();

/** Adds an entry. It never throws: a log that fails must not stop the work it describes. */
export function record(entry: Omit<Activity, "id" | "at"> & { at?: string }): Promise<void> {
  if (isProduction()) void appendAudit({ actor: entry.actor.id, action: entry.action, target: entry.target, detail: entry.detail, at: entry.at });
  chain = chain.then(async () => {
    try {
      const all = await read();
      const at = entry.at ?? new Date().toISOString();
      // saving a draft happens every few seconds while someone edits: one entry per person, journey and 10 minutes
      if (entry.action === "journey.edit") {
        const last = [...all].reverse().find((a) => a.action === "journey.edit" && a.actor.id === entry.actor.id && a.target === entry.target);
        if (last && Date.parse(at) - Date.parse(last.at) < 10 * 60_000) return;
      }
      all.push({ id: `${Date.parse(at).toString(36)}${Math.random().toString(36).slice(2, 6)}`, at, ...entry });
      await fs.mkdir(path.dirname(file()), { recursive: true });
      await fs.writeFile(file(), JSON.stringify(all.slice(-CAP), null, 1));
    } catch { /* logging is best effort */ }
  });
  return chain as Promise<void>;
}

export type ActivityFilter = { person?: string; project?: string; kind?: string; before?: string; limit?: number };

/** Newest first. `kind` matches the part before the dot (journey, person, role, project, policy, workspace). */
export async function listActivity(f: ActivityFilter = {}): Promise<Activity[]> {
  const limit = Math.min(Math.max(f.limit ?? 100, 1), 500);
  const all = await read();
  return all.reverse().filter((a) =>
    (!f.person || a.actor.id === f.person) &&
    (!f.project || a.projectIds?.includes(f.project)) &&
    (!f.kind || a.action.split(".")[0] === f.kind) &&
    (!f.before || a.at < f.before)).slice(0, limit);
}

/** The English words of a name that may be translated (a string, or { en, ur }). */
export const nameOf = (t: unknown): string => (typeof t === "string" ? t : (t as { en?: string } | undefined)?.en ?? "");
