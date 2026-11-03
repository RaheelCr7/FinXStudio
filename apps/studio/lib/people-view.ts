import { ACTIONS, canDo, roleIn, type Action, type RoleDef } from "./roles";
import type { Activity } from "./activity";

type P = { id: string; name: string; role: string; access?: Record<string, string> };

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";

/** One of six avatar colours, the same for a person every time. */
export function avatarTone(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 6;
}

/** What a person can do in one project (or everywhere, with no project), by their role there. */
export function effectiveActions(person: P, projectId: string | undefined, defs: RoleDef[]): Action[] {
  return ACTIONS.filter((a) => canDo(person, a, projectId ? [projectId] : undefined, defs));
}

/** The role a person holds in a project, and whether it differs from their main role. */
export function roleHeld(person: P, projectId: string): { role: string; special: boolean } {
  const role = roleIn(person, projectId);
  return { role, special: role !== person.role };
}

export type Summary = { people: number; publishers: number; managers: number; special: number };

/** The numbers at the top of the page. A publisher is anyone who may publish in at least one project. */
export function summarise(people: P[], projects: { id: string }[], defs: RoleDef[]): Summary {
  const ids = projects.map((p) => p.id);
  return {
    people: people.length,
    publishers: people.filter((p) => canDo(p, "publish", ids.length ? ids : undefined, defs)).length,
    managers: people.filter((p) => canDo(p, "people", undefined, defs)).length,
    special: people.filter((p) => Object.keys(p.access ?? {}).length > 0).length,
  };
}

/** The newest entries by one person, from a newest-first log. */
export const recentBy = (personId: string, log: Activity[], n = 5) => log.filter((a) => a.actor.id === personId).slice(0, n);
