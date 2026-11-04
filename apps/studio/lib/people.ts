import { promises as fs } from "node:fs";
import path from "node:path";
import { StoreError } from "./store";
import { listRoles } from "./access";
import { listProjects } from "./projects";
import { isProduction, COOKIE_SESSION } from "./profile";
import { cookieValue, isServiceRequest, verifySession } from "./session";
import { canDo, COOKIE_USER, roleLabel, type Access, type Action, type Role, type RoleDef } from "./roles";

export type Person = { id: string; name: string; /** the main role: applies everywhere unless a project below says otherwise */ role: Role; /** a different role in some projects, by project id */ access?: Access };

const file = () => path.join(process.env.FINX_DATA_DIR ?? path.join(process.cwd(), ".data"), "people.json");
const SEED: Person[] = [
  { id: "alex", name: "Alex Morgan", role: "admin" },
  { id: "dana", name: "Dana Lee", role: "designer" },
  { id: "sam", name: "Sam Patel", role: "developer" },
  { id: "riya", name: "Riya Khan", role: "reviewer" },
];

async function write(people: Person[]) {
  await fs.mkdir(path.dirname(file()), { recursive: true });
  await fs.writeFile(file(), JSON.stringify(people, null, 2));
}

export async function listPeople(): Promise<Person[]> {
  try {
    const people = JSON.parse(await fs.readFile(file(), "utf8")) as Person[];
    if (Array.isArray(people) && people.length) return people;
  } catch { /* first run */ }
  await write(SEED);
  return structuredClone(SEED);
}

const slugOf = (name: string) => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
const cleanName = (v: unknown) => {
  if (typeof v !== "string" || v.trim().length < 2 || v.trim().length > 60) throw new StoreError(400, "Name must be 2 to 60 characters");
  return v.trim();
};
const cleanRole = (v: unknown, defs: RoleDef[]): Role => {
  if (typeof v !== "string" || !defs.some((r) => r.id === v)) throw new StoreError(400, `Role must be one of: ${defs.map((r) => r.id).join(", ")}`);
  return v;
};
/** Project access: { projectId: roleId } to set, a null or empty value to clear it. Only known projects and roles are accepted. */
async function cleanAccess(v: unknown, defs: RoleDef[], current: Access = {}): Promise<Access | undefined> {
  if (v === undefined) return current;
  if (v === null || typeof v !== "object" || Array.isArray(v)) throw new StoreError(400, "access must be an object of project ids to role ids");
  const known = (await listProjects()).map((p) => p.id);
  const next: Access = { ...current };
  for (const [project, role] of Object.entries(v as Record<string, unknown>)) {
    if (!known.includes(project)) throw new StoreError(400, `Unknown project ${project}`);
    if (role === null || role === "") delete next[project]; else next[project] = cleanRole(role, defs);
  }
  return Object.keys(next).length ? next : undefined;
}
/** Studio always needs someone who can manage people. */
export const managers = (people: Person[], defs: RoleDef[]) => people.filter((p) => canDo(p, "people", undefined, defs));

export async function addPerson(input: { name: unknown; role: unknown; access?: unknown }): Promise<Person> {
  const defs = await listRoles();
  const name = cleanName(input.name), role = cleanRole(input.role, defs);
  const access = await cleanAccess(input.access, defs);
  const people = await listPeople();
  let id = slugOf(name) || "person"; const base = id; let n = 2;
  while (people.some((p) => p.id === id)) id = `${base}-${n++}`;
  const person: Person = { id, name, role, ...(access ? { access } : {}) };
  await write([...people, person]);
  return person;
}

export async function updatePerson(id: string, patch: { name?: unknown; role?: unknown; access?: unknown }): Promise<Person> {
  const defs = await listRoles();
  const people = await listPeople();
  const p = people.find((x) => x.id === id);
  if (!p) throw new StoreError(404, "Person not found");
  if (patch.name !== undefined) p.name = cleanName(patch.name);
  if (patch.role !== undefined) {
    const role = cleanRole(patch.role, defs);
    const after = people.map((x) => (x.id === id ? { ...x, role } : x));
    if (!managers(after, defs).length) throw new StoreError(409, "Studio needs at least one Admin. Make someone else an Admin first.");
    p.role = role;
  }
  if (patch.access !== undefined) {
    const access = await cleanAccess(patch.access, defs, p.access);
    if (access) p.access = access; else delete p.access;
  }
  await write(people);
  return p;
}

export async function removePerson(id: string) {
  const people = await listPeople();
  const p = people.find((x) => x.id === id);
  if (!p) throw new StoreError(404, "Person not found");
  const rest = people.filter((x) => x.id !== id);
  if (!managers(rest, await listRoles()).length) throw new StoreError(409, "Studio needs at least one Admin. Make someone else an Admin first.");
  await write(rest);
}

/**
 * Who is acting: the person chosen in the sidebar (cookie), or the first Admin when no one chose.
 * Tools without a browser (the MCP server, scripts) therefore act as an Admin, as they always have.
 * This is a demo identity, not a sign-in: anyone who can reach Studio can pick anyone. Real sign-in comes later.
 */
export async function actorFromId(id: string | undefined): Promise<Person> {
  const people = await listPeople();
  return people.find((p) => p.id === id) ?? people.find((p) => p.role === "admin") ?? people[0]!;
}
export { isServiceRequest };

export async function actorOf(req: Request): Promise<Person> {
  if (isProduction()) {
    const people = await listPeople();
    if (isServiceRequest(req)) {
      const who = people.find((p) => p.id === process.env.FINX_SERVICE_PERSON);
      if (!who) throw new StoreError(401, "The service token has no person to act as (FINX_SERVICE_PERSON)");
      return who;
    }
    const id = verifySession(cookieValue(req.headers.get("cookie"), COOKIE_SESSION));
    const who = id ? people.find((p) => p.id === id) : undefined;
    if (!who) throw new StoreError(401, "Sign in to use Studio");
    return who;
  }
  const jar = req.headers.get("cookie") ?? "";
  const id = jar.split(/;\s*/).find((c) => c.startsWith(`${COOKIE_USER}=`))?.slice(COOKIE_USER.length + 1);
  return actorFromId(id ? decodeURIComponent(id) : undefined);
}

/**
 * Returns who is acting, or refuses with a message that says what to do. `projects` names the projects the work belongs to
 * (a journey's apps); the person's role in those decides, and their main role when none are named.
 */
export async function requireCan(req: Request, action: Action, projects?: string[]): Promise<Person> {
  const who = await actorOf(req);
  const defs = await listRoles();
  if (action === "publish" && isProduction() && isServiceRequest(req)) throw new StoreError(403, "Agents never publish. A person publishes in Studio.");
  if (!canDo(who, action, projects, defs)) {
    const names = projects?.length && !["people", "projects"].includes(action) ? ` in ${projects.join(" and ")}` : "";
    const have = roleLabel(projects?.length && who.access?.[projects[0]!] ? who.access[projects[0]!]! : who.role, defs);
    const verb: Record<Action, string> = { edit: "edit journeys", publish: "publish", projects: "create or restyle projects", agents: "update agent runs", people: "manage people" };
    const holders = defs.filter((r) => r.actions.includes(action)).map((r) => r.label);
    const need = holders.length > 1 ? `${holders.slice(0, -1).join(", ")} or ${holders.at(-1)}` : holders[0] ?? "someone with that role";
    throw new StoreError(403, `${who.name} is a ${have}${names} and cannot ${verb[action]}. Ask ${/^[AEIOU]/i.test(need) ? "an" : "a"} ${need}.`);
  }
  return who;
}
