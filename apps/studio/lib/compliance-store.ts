import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { Journey } from "@finx/journey-schema";
import type { ComplianceReport } from "@finx/mcp/proof";

/** A saved copy of the compliance evidence for one version of a journey, so a reviewer can see what was true when it was signed off. */
export type ComplianceSnapshot = { id: string; slug: string; version: number; at: string; by: string; /** fingerprint of the journey content, so edits after the snapshot are visible */ hash: string; note: string; report: ComplianceReport };
const CAP = 300;
const file = () => path.join(process.env.FINX_DATA_DIR ?? path.join(process.cwd(), ".data"), "compliance.json");
export const hashOf = (j: Journey) => createHash("sha1").update(JSON.stringify(j)).digest("hex").slice(0, 12);

async function read(): Promise<ComplianceSnapshot[]> {
  try { const a = JSON.parse(await fs.readFile(file(), "utf8")); return Array.isArray(a) ? a : []; } catch { return []; }
}
let chain: Promise<unknown> = Promise.resolve();

export async function listSnapshots(slug: string): Promise<ComplianceSnapshot[]> {
  return (await read()).filter((s) => s.slug === slug).sort((a, b) => b.at.localeCompare(a.at));
}
export function saveSnapshot(journey: Journey, report: ComplianceReport, by: string, note = ""): Promise<ComplianceSnapshot> {
  const done = chain.then(async () => {
    const all = await read();
    const snap: ComplianceSnapshot = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, slug: journey.slug, version: journey.version, at: new Date().toISOString(), by, hash: hashOf(journey), note: note.slice(0, 300), report };
    all.push(snap);
    await fs.mkdir(path.dirname(file()), { recursive: true });
    await fs.writeFile(file(), JSON.stringify(all.slice(-CAP)));
    return snap;
  });
  chain = done.catch(() => undefined);
  return done;
}
