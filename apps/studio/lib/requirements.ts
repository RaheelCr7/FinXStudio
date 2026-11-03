import { promises as fs } from "node:fs";
import path from "node:path";
import { EDITABLE, Requirement, duplicateIds, nextId, readiness, type RequirementContent } from "@finx/journey-schema";
import { StoreError } from "./store";

type Db = { requirements: Record<string, Requirement> };
const file = () => path.join(process.env.FINX_DATA_DIR ?? path.join(process.cwd(), ".data"), "requirements.json");

async function read(): Promise<Db> {
  try { const db = JSON.parse(await fs.readFile(file(), "utf8")) as Db; db.requirements ??= {}; return db; } catch { return { requirements: {} }; }
}
async function write(db: Db) {
  await fs.mkdir(path.dirname(file()), { recursive: true });
  const tmp = `${file()}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2) + "\n");
  await fs.rename(tmp, file());
}

const slugOf = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "requirement";
const now = () => new Date().toISOString();
const say = (e: { issues: { path: PropertyKey[]; message: string }[] }) => e.issues.map((i) => `${i.path.map(String).join(".") || "requirement"}: ${i.message}`).join("; ");

/** The prefix each editable list uses for its ids. */
const PREFIX = { actors: "A", steps: "S", rules: "R", fields: "F", operations: "O", failures: "X", criteria: "AC" } as const;

/** Gives every new item in the lists an id (A-1, S-2, AC-3 …), so people and Claude only have to write the words. */
function withIds(input: Record<string, unknown>): Record<string, unknown> {
  const out = { ...input };
  for (const [key, prefix] of Object.entries(PREFIX)) {
    const list = out[key];
    if (!Array.isArray(list)) continue;
    const given = list.filter((x) => x && typeof x === "object" && typeof (x as any).id === "string").map((x) => ({ id: (x as any).id as string }));
    const taken = [...given];
    out[key] = list.map((x) => {
      if (!x || typeof x !== "object" || typeof (x as any).id === "string") return x;
      const id = nextId(prefix, taken); taken.push({ id });
      return { ...(x as object), id };
    });
  }
  return out;
}

const sameContent = (a: RequirementContent, b: RequirementContent) => JSON.stringify(EDITABLE.map((k) => a[k])) === JSON.stringify(EDITABLE.map((k) => b[k]));

export async function listRequirements(projectId?: string): Promise<Requirement[]> {
  // newest change first; two changes in the same millisecond keep the later-created one first
  const all = Object.values((await read()).requirements).map((r, i) => ({ r, i })).sort((a, b) => b.r.updatedAt.localeCompare(a.r.updatedAt) || b.i - a.i).map((x) => x.r);
  return projectId ? all.filter((r) => r.projectId === projectId) : all;
}

export async function getRequirement(id: string): Promise<Requirement> {
  const r = (await read()).requirements[id];
  if (!r) throw new StoreError(404, `No requirement called ${id}`);
  return r;
}

/** A requirement with its blockers: what has to be done before it can be approved. */
export const withReadiness = (r: Requirement) => ({ ...r, blockers: r.status === "approved" ? [] : readiness(r) });

export async function createRequirement(input: unknown): Promise<Requirement> {
  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const db = await read();
  const base = slugOf(String(body.title ?? ""));
  let id = typeof body.id === "string" && body.id ? body.id : base;
  if (typeof body.id !== "string") for (let n = 2; db.requirements[id]; n++) id = `${base}-${n}`;
  if (db.requirements[id]) throw new StoreError(409, `A requirement called ${id} already exists`);
  const t = now();
  const parsed = Requirement.safeParse({ ...withIds(body), id, status: "draft", questions: [], version: 1, createdAt: t, updatedAt: t });
  if (!parsed.success) throw new StoreError(400, say(parsed.error));
  const dup = duplicateIds(parsed.data);
  if (dup.length) throw new StoreError(400, dup.join("; "));
  db.requirements[id] = parsed.data;
  await write(db);
  return parsed.data;
}

/**
 * Changes the content of a requirement. A change to an approved one takes it back to draft, clears the approval and counts the
 * version up, so a journey built from the old version can see it is out of date.
 */
export async function updateRequirement(id: string, input: unknown): Promise<{ requirement: Requirement; resetApproval: boolean }> {
  const db = await read();
  const cur = db.requirements[id];
  if (!cur) throw new StoreError(404, `No requirement called ${id}`);
  const body = withIds((input && typeof input === "object" ? input : {}) as Record<string, unknown>);
  const patch: Record<string, unknown> = {};
  for (const k of EDITABLE) if (k in body) patch[k] = body[k];
  if ("projectId" in body) patch.projectId = body.projectId || undefined;
  const parsed = Requirement.safeParse({ ...cur, ...patch, updatedAt: now() });
  if (!parsed.success) throw new StoreError(400, say(parsed.error));
  const dup = duplicateIds(parsed.data);
  if (dup.length) throw new StoreError(400, dup.join("; "));
  const changed = !sameContent(cur, parsed.data);
  let next = parsed.data;
  const resetApproval = changed && cur.status === "approved";
  if (resetApproval) next = { ...next, status: "draft", version: cur.version + 1, approvedBy: undefined, approvedAt: undefined };
  db.requirements[id] = next;
  await write(db);
  return { requirement: next, resetApproval };
}

/** A reviewer (a person or Claude Code) asks about something missing. The requirement waits for the answer. */
export async function askQuestion(id: string, text: unknown, by: string): Promise<Requirement> {
  const q = typeof text === "string" ? text.trim() : "";
  if (!q) throw new StoreError(400, "Write the question");
  if (q.length > 2000) throw new StoreError(400, "The question is too long (2000 characters at most)");
  const db = await read();
  const cur = db.requirements[id];
  if (!cur) throw new StoreError(404, `No requirement called ${id}`);
  const next: Requirement = { ...cur, questions: [...cur.questions, { id: nextId("Q", cur.questions), text: q, by, at: now() }], status: "questions", updatedAt: now() };
  if (cur.status === "approved") { next.version = cur.version + 1; next.approvedBy = undefined; next.approvedAt = undefined; }
  db.requirements[id] = next;
  await write(db);
  return next;
}

export async function answerQuestion(id: string, questionId: string, answer: unknown, by: string): Promise<Requirement> {
  const a = typeof answer === "string" ? answer.trim() : "";
  if (!a) throw new StoreError(400, "Write the answer");
  if (a.length > 2000) throw new StoreError(400, "The answer is too long (2000 characters at most)");
  const db = await read();
  const cur = db.requirements[id];
  if (!cur) throw new StoreError(404, `No requirement called ${id}`);
  const q = cur.questions.find((x) => x.id === questionId);
  if (!q) throw new StoreError(404, `No question ${questionId} on ${id}`);
  const questions = cur.questions.map((x) => (x.id === questionId ? { ...x, answer: a, answeredBy: by, answeredAt: now() } : x));
  const stillOpen = questions.some((x) => !x.answer?.trim());
  const next: Requirement = { ...cur, questions, status: stillOpen ? "questions" : cur.status === "questions" ? "draft" : cur.status, updatedAt: now() };
  db.requirements[id] = next;
  await write(db);
  return next;
}

/** Approves a requirement that has everything it needs. Only then may a journey be generated from it. */
export async function approveRequirement(id: string, by: string): Promise<Requirement> {
  const db = await read();
  const cur = db.requirements[id];
  if (!cur) throw new StoreError(404, `No requirement called ${id}`);
  if (cur.status === "approved") throw new StoreError(409, `${id} is already approved (version ${cur.version})`);
  const blockers = readiness(cur);
  if (blockers.length) throw new StoreError(409, `Not ready to approve: ${blockers.join(" ")}`);
  const next: Requirement = { ...cur, status: "approved", approvedBy: by, approvedAt: now(), updatedAt: now() };
  db.requirements[id] = next;
  await write(db);
  return next;
}

export async function deleteRequirement(id: string): Promise<void> {
  const db = await read();
  const cur = db.requirements[id];
  if (!cur) throw new StoreError(404, `No requirement called ${id}`);
  if (cur.status === "approved") throw new StoreError(409, "An approved requirement cannot be deleted: change it back to a draft first by editing it");
  delete db.requirements[id];
  await write(db);
}
