import { z } from "zod";

/**
 * A banking requirement, captured and approved before anything is generated from it (plan, Stage 1).
 * Nothing is generated from a requirement that is not approved; every acceptance criterion carries an id (AC-1, AC-2 …)
 * so journeys, rules and tests can say which one they satisfy.
 */
const Id = (prefix: string) => z.string().regex(new RegExp(`^${prefix}-[0-9]{1,4}$`), `must look like ${prefix}-1`);
const Text = z.string().trim().min(1).max(2000);

export const RULE_KINDS = ["limit", "cutoff", "whitelist", "approval", "other"] as const;
export const REQUIREMENT_STATUSES = ["draft", "questions", "approved"] as const;
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

export const Requirement = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/, "use lowercase letters, numbers and dashes"),
  /** The project (bank app) the requirement is for. */
  projectId: z.string().min(1).optional(),
  title: Text.max(120),
  /** What the bank wants and why, in a few sentences. */
  intent: Text,
  status: z.enum(REQUIREMENT_STATUSES),
  /** Who is involved: initiator, approver, releaser … */
  actors: z.array(z.object({ id: Id("A"), name: Text.max(80), role: z.string().max(80).optional() })).default([]),
  /** What happens, in order. */
  steps: z.array(z.object({ id: Id("S"), text: Text })).default([]),
  /** Business rules: limits, cut-off times, whitelists, approval thresholds. */
  rules: z.array(z.object({ id: Id("R"), kind: z.enum(RULE_KINDS).default("other"), text: Text })).default([]),
  /** The data collected or shown. */
  fields: z.array(z.object({ id: Id("F"), name: Text.max(80), type: z.string().max(40).default("text"), note: z.string().max(500).optional() })).default([]),
  /** What the bank's system has to do (the operations the journey calls). */
  operations: z.array(z.object({ id: Id("O"), name: Text.max(120), note: z.string().max(500).optional() })).default([]),
  /** Compliance needs, in words (for example "four eyes on payments above 1,000,000"). */
  compliance: z.array(Text).default([]),
  /** What can go wrong, and what should happen. */
  failures: z.array(z.object({ id: Id("X"), text: Text })).default([]),
  /** What must be true for the requirement to be met. Each gets tests later. */
  criteria: z.array(z.object({ id: Id("AC"), text: Text, /** ids of the generated tests that prove it, filled in by the generator */ tests: z.array(z.string()).default([]) })).default([]),
  /** Gaps the reviewer (a person or Claude Code) asked about, and the answers. */
  questions: z.array(z.object({
    id: Id("Q"), text: Text, by: z.string().max(80), at: z.string(),
    answer: z.string().max(2000).optional(), answeredBy: z.string().max(80).optional(), answeredAt: z.string().optional(),
  })).default([]),
  /** Counts up with every change after approval, so a journey can say which version it was built from. */
  version: z.number().int().min(1),
  approvedBy: z.string().max(80).optional(),
  approvedAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Requirement = z.infer<typeof Requirement>;

/** The parts of a requirement a person edits. Everything else (status, questions, approval, version, dates) is managed. */
export const EDITABLE = ["title", "intent", "actors", "steps", "rules", "fields", "operations", "compliance", "failures", "criteria"] as const;
export type RequirementContent = Pick<Requirement, (typeof EDITABLE)[number]>;

/** Everything that stops a requirement being approved, in words. Empty means it can be approved. */
export function readiness(r: Pick<Requirement, "intent" | "actors" | "steps" | "criteria" | "questions" | "rules">): string[] {
  const out: string[] = [];
  if (r.intent.trim().length < 20) out.push("Describe what the bank wants and why (at least a sentence).");
  if (r.actors.length === 0) out.push("Name who is involved (for example the initiator and the approver).");
  if (r.steps.length === 0) out.push("List the steps, in order.");
  if (r.criteria.length === 0) out.push("Write at least one acceptance criterion (AC-1 …).");
  const open = r.questions.filter((q) => !q.answer?.trim());
  if (open.length) out.push(`Answer the open question${open.length === 1 ? "" : "s"}: ${open.map((q) => q.id).join(", ")}.`);
  return out;
}

/** Duplicate ids inside one list of a requirement, in words. */
export function duplicateIds(r: Partial<RequirementContent>): string[] {
  const out: string[] = [];
  for (const key of ["actors", "steps", "rules", "fields", "operations", "failures", "criteria"] as const) {
    const ids = ((r[key] as { id: string }[] | undefined) ?? []).map((x) => x.id);
    for (const id of new Set(ids.filter((v, i) => ids.indexOf(v) !== i))) out.push(`${id} is used twice in ${key}`);
  }
  return out;
}

/** Which acceptance criteria have no test yet. Used by the coverage view and the generator's gate. */
export const uncovered = (r: Pick<Requirement, "criteria">): string[] => r.criteria.filter((c) => c.tests.length === 0).map((c) => c.id);

/** A requirement may only be built from when it is approved. Throws with the reason otherwise. */
export function assertApproved(r: Pick<Requirement, "id" | "status">) {
  if (r.status !== "approved") throw new Error(`Requirement ${r.id} is ${r.status}: it must be approved before anything is generated from it`);
}

/** The next free id with a prefix: AC-1, AC-2 … */
export function nextId(prefix: string, existing: { id: string }[]): string {
  const used = existing.map((e) => Number(e.id.split("-")[1])).filter((n) => Number.isFinite(n));
  return `${prefix}-${(used.length ? Math.max(...used) : 0) + 1}`;
}
