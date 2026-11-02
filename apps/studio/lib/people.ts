import { promises as fs } from "node:fs";
import path from "node:path";
import { StoreError } from "./store";
import { can, COOKIE_USER, isRole, ROLE_INFO, type Action, type Role } from "./roles";

export type Person = { id: string; name: string; role: Role };

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
const cleanRole = (v: unknown): Role => { if (!isRole(v)) throw new StoreError(400, "Role must be admin, designer, developer or reviewer"); return v; };

export async function addPerson(input: { name: unknown; role: unknown }): Promise<Person> {
  const name = cleanName(input.name), role = cleanRole(input.role);
  const people = await listPeople();
  let id = slugOf(name) || "person"; const base = id; let n = 2;
  while (people.some((p) => p.id === id)) id = `${base}-${n++}`;
  const person = { id, name, role };
  await write([...people, person]);
  return person;
}

export async function updatePerson(id: string, patch: { name?: unknown; role?: unknown }): Promise<Person> {
  const people = await listPeople();
  const p = people.find((x) => x.id === id);
  if (!p) throw new StoreError(404, "Person not found");
  if (patch.name !== undefined) p.name = cleanName(patch.name);
  if (patch.role !== undefined) {
    const role = cleanRole(patch.role);
    if (p.role === "admin" && role !== "admin" && people.filter((x) => x.role === "admin").length === 1) throw new StoreError(409, "Studio needs at least one Admin. Make someone else an Admin first.");
    p.role = role;
  }
  await write(people);
  return p;
}

export async function removePerson(id: string) {
  const people = await listPeople();
  const p = people.find((x) => x.id === id);
  if (!p) throw new StoreError(404, "Person not found");
  if (p.role === "admin" && people.filter((x) => x.role === "admin").length === 1) throw new StoreError(409, "Studio needs at least one Admin. Make someone else an Admin first.");
  await write(people.filter((x) => x.id !== id));
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
export async function actorOf(req: Request): Promise<Person> {
  const jar = req.headers.get("cookie") ?? "";
  const id = jar.split(/;\s*/).find((c) => c.startsWith(`${COOKIE_USER}=`))?.slice(COOKIE_USER.length + 1);
  return actorFromId(id ? decodeURIComponent(id) : undefined);
}

/** Returns who is acting, or refuses with a message that says what to do. */
export async function requireCan(req: Request, action: Action): Promise<Person> {
  const who = await actorOf(req);
  if (!can(who.role, action)) {
    const need = action === "publish" ? "a Reviewer or Admin" : action === "edit" ? "a Designer, Developer or Admin" : action === "agents" ? "a Developer or Admin" : action === "projects" ? "a Designer or Admin" : "an Admin";
    const verb: Record<Action, string> = { edit: "edit journeys", publish: "publish", projects: "create or restyle projects", agents: "update agent runs", people: "manage people" };
    throw new StoreError(403, `${who.name} is a ${ROLE_INFO[who.role].label} and cannot ${verb[action]}. Ask ${need}.`);
  }
  return who;
}
