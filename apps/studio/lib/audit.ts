import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

/**
 * The audit log of the production profile: one JSON line per event, each carrying the hash of the line before it, so removing or
 * editing an earlier line breaks the chain and verifyAudit() says where. It only ever appends and has no cap. (The activity log
 * people read in Studio is capped and editable by the app; this one is the evidence.)
 */
export type AuditEntry = { at: string; actor: string; action: string; target: string; detail?: string; prev: string; hash: string };
const file = () => path.join(process.env.FINX_DATA_DIR ?? path.join(process.cwd(), ".data"), "audit.log");
const GENESIS = "0".repeat(64);
const hashOf = (e: Omit<AuditEntry, "hash">) => createHash("sha256").update(JSON.stringify([e.at, e.actor, e.action, e.target, e.detail ?? "", e.prev])).digest("hex");

let chain: Promise<unknown> = Promise.resolve();
async function lastHash(): Promise<string> {
  try { const lines = (await fs.readFile(file(), "utf8")).trimEnd().split("\n"); return (JSON.parse(lines.at(-1)!) as AuditEntry).hash; } catch { return GENESIS; }
}

export function appendAudit(e: { actor: string; action: string; target: string; detail?: string; at?: string }): Promise<void> {
  chain = chain.then(async () => {
    try {
      const base = { at: e.at ?? new Date().toISOString(), actor: e.actor, action: e.action, target: e.target, ...(e.detail ? { detail: e.detail } : {}), prev: await lastHash() };
      await fs.mkdir(path.dirname(file()), { recursive: true });
      await fs.appendFile(file(), JSON.stringify({ ...base, hash: hashOf(base) }) + "\n", { mode: 0o600 });
    } catch (err) { console.error("audit log write failed", err); }
  });
  return chain as Promise<void>;
}

/** { ok: true, entries } when the chain is intact, else { ok: false, brokenAt } with the 1-based line that does not fit. */
export async function verifyAudit(): Promise<{ ok: true; entries: number } | { ok: false; brokenAt: number }> {
  let text = ""; try { text = await fs.readFile(file(), "utf8"); } catch { return { ok: true, entries: 0 }; }
  let prev = GENESIS, n = 0;
  for (const line of text.split("\n").filter(Boolean)) {
    n++;
    try { const { hash, ...rest } = JSON.parse(line) as AuditEntry; if (rest.prev !== prev || hash !== hashOf(rest)) return { ok: false, brokenAt: n }; prev = hash; } catch { return { ok: false, brokenAt: n }; }
  }
  return { ok: true, entries: n };
}
export async function listAudit(limit = 200): Promise<AuditEntry[]> {
  try { return (await fs.readFile(file(), "utf8")).trimEnd().split("\n").filter(Boolean).slice(-limit).reverse().map((l) => JSON.parse(l)); } catch { return []; }
}
