import { promises as fs } from "node:fs";
import path from "node:path";
import { StoreError } from "./store";
import { isProduction } from "./profile";
import { ACTIONS, BUILTIN_ROLES, DEFAULT_SELF_PUBLISH, SELF_PUBLISH, isAction, type Action, type RoleDef, type SelfPublish } from "./roles";

const dir = () => process.env.FINX_DATA_DIR ?? path.join(process.cwd(), ".data");

async function readJson<T>(name: string, fallback: T): Promise<T> {
  try { return JSON.parse(await fs.readFile(path.join(dir(), name), "utf8")) as T; } catch { return fallback; }
}
async function writeJson(name: string, value: unknown) {
  await fs.mkdir(dir(), { recursive: true });
  await fs.writeFile(path.join(dir(), name), JSON.stringify(value, null, 2));
}

/* ---- roles: the four built-in ones plus any a person added ---- */

export const listCustomRoles = () => readJson<RoleDef[]>("roles.json", []);
export async function listRoles(): Promise<RoleDef[]> { return [...BUILTIN_ROLES, ...(await listCustomRoles())]; }

const slugOf = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);

function clean(input: { label?: unknown; blurb?: unknown; actions?: unknown }) {
  const label = typeof input.label === "string" ? input.label.trim() : "";
  if (label.length < 2 || label.length > 40) throw new StoreError(400, "A role's name must be 2 to 40 characters");
  const blurb = typeof input.blurb === "string" ? input.blurb.trim() : "";
  if (blurb.length > 140) throw new StoreError(400, "The description must be 140 characters or fewer");
  if (!Array.isArray(input.actions) || !input.actions.every(isAction)) throw new StoreError(400, `Actions must be from: ${ACTIONS.join(", ")}`);
  const actions = ACTIONS.filter((a) => (input.actions as Action[]).includes(a));
  if (!actions.length) throw new StoreError(400, "Give the role at least one thing it can do");
  return { label, blurb, actions };
}

export async function createRole(input: { label?: unknown; blurb?: unknown; actions?: unknown }): Promise<RoleDef> {
  const v = clean(input);
  const all = await listRoles();
  if (all.some((r) => r.label.toLowerCase() === v.label.toLowerCase())) throw new StoreError(409, `There is already a role called ${v.label}`);
  let id = slugOf(v.label) || "role"; const base = id; let n = 2;
  while (all.some((r) => r.id === id)) id = `${base}-${n++}`;
  const role: RoleDef = { id, ...v };
  await writeJson("roles.json", [...(await listCustomRoles()), role]);
  return role;
}

export async function updateRole(id: string, input: { label?: unknown; blurb?: unknown; actions?: unknown }): Promise<RoleDef> {
  if (BUILTIN_ROLES.some((r) => r.id === id)) throw new StoreError(409, "The four built-in roles cannot be changed. Create your own role instead.");
  const custom = await listCustomRoles();
  const at = custom.findIndex((r) => r.id === id);
  if (at < 0) throw new StoreError(404, "Role not found");
  const v = clean({ label: input.label ?? custom[at]!.label, blurb: input.blurb ?? custom[at]!.blurb, actions: input.actions ?? custom[at]!.actions });
  const all = await listRoles();
  if (all.some((r) => r.id !== id && r.label.toLowerCase() === v.label.toLowerCase())) throw new StoreError(409, `There is already a role called ${v.label}`);
  custom[at] = { id, ...v };
  await writeJson("roles.json", custom);
  return custom[at]!;
}

export async function deleteRole(id: string, inUseBy: string[]): Promise<void> {
  if (BUILTIN_ROLES.some((r) => r.id === id)) throw new StoreError(409, "The four built-in roles cannot be removed.");
  const custom = await listCustomRoles();
  if (!custom.some((r) => r.id === id)) throw new StoreError(404, "Role not found");
  if (inUseBy.length) throw new StoreError(409, `${inUseBy.slice(0, 3).join(", ")}${inUseBy.length > 3 ? ` and ${inUseBy.length - 3} more` : ""} still ha${inUseBy.length === 1 ? "s" : "ve"} this role. Give them another role first.`);
  await writeJson("roles.json", custom.filter((r) => r.id !== id));
}

/* ---- approval rules: who may publish a change they made themselves, per project ---- */

type Policies = Record<string, { selfPublish: SelfPublish }>;
export const isSelfPublish = (v: unknown): v is SelfPublish => typeof v === "string" && (SELF_PUBLISH as readonly string[]).includes(v);

export async function listPolicies(): Promise<Record<string, SelfPublish>> {
  const p = await readJson<Policies>("policies.json", {});
  return Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v.selfPublish]));
}
export async function setPolicy(projectId: string, selfPublish: unknown): Promise<SelfPublish> {
  if (!isSelfPublish(selfPublish)) throw new StoreError(400, `Use one of: ${SELF_PUBLISH.join(", ")}`);
  const p = await readJson<Policies>("policies.json", {});
  p[projectId] = { selfPublish };
  await writeJson("policies.json", p);
  return selfPublish;
}
/** The rule for a journey that belongs to these projects: the strictest of them. */
export async function selfPublishFor(projectIds: string[]): Promise<SelfPublish> {
  const p = await listPolicies();
  const order: SelfPublish[] = ["never", "admin", "anyone"];
  // production: a project nobody has configured defaults to four-eyes (a change must be published by someone else)
  const rules = projectIds.map((id) => p[id] ?? (isProduction() ? "never" : DEFAULT_SELF_PUBLISH));
  return order.find((r) => rules.includes(r)) ?? DEFAULT_SELF_PUBLISH;
}
