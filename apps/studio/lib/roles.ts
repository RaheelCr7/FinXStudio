/** Who may do what in Studio. Pure data and rules, shared by the server and the pages. */
export const ACTIONS = ["edit", "publish", "projects", "agents", "people"] as const;
export type Action = (typeof ACTIONS)[number];
/** A role is a name (an id) that stands for a set of actions. The four built-in roles are below; people can add their own. */
export type Role = string;

export type RoleDef = { id: Role; label: string; blurb: string; actions: Action[]; builtin?: boolean };

/** Actions that belong to one project's work (its journeys). A person can hold a different role in each project. */
export const PROJECT_ACTIONS: Action[] = ["edit", "publish", "agents"];
/** Actions about Studio as a whole. They always follow the person's main role, whatever project they work in. */
export const WORKSPACE_ACTIONS: Action[] = ["projects", "people"];

export const ACTION_INFO: Record<Action, string> = {
  edit: "Create and edit journeys, restore versions, add from the catalog",
  publish: "Publish a journey to UAT",
  projects: "Create projects (bank apps)",
  agents: "Report and update AI agent runs",
  people: "Add people, change roles and access, set approval rules",
};

/** Short names for the actions, for lists and the activity log. */
export const ACTION_LABEL: Record<Action, string> = { edit: "Edit journeys", publish: "Publish", projects: "Create projects", agents: "AI agents", people: "Manage people" };

export const BUILTIN_ROLES: RoleDef[] = [
  { id: "admin", label: "Admin", blurb: "Everything, including people and publishing.", actions: ["edit", "publish", "projects", "agents", "people"], builtin: true },
  { id: "designer", label: "Designer", blurb: "Builds journeys and sets up projects and their look. Cannot publish.", actions: ["edit", "projects"], builtin: true },
  { id: "developer", label: "Developer", blurb: "Builds journeys and runs AI agents. Cannot publish.", actions: ["edit", "agents"], builtin: true },
  { id: "reviewer", label: "Reviewer", blurb: "Reads everything and publishes what is ready. Cannot edit.", actions: ["publish"], builtin: true },
];

/** The built-in role ids, in the order shown. */
export const ROLES = BUILTIN_ROLES.map((r) => r.id);
export const ROLE_INFO: Record<string, { label: string; blurb: string }> = Object.fromEntries(BUILTIN_ROLES.map((r) => [r.id, { label: r.label, blurb: r.blurb }]));

/** The words for a role that may be a custom one: its label, or the id when the role no longer exists. */
export const roleLabel = (id: Role, defs: RoleDef[] = BUILTIN_ROLES) => defs.find((r) => r.id === id)?.label ?? id;

export const can = (role: Role | undefined, action: Action, defs: RoleDef[] = BUILTIN_ROLES) => !!role && !!defs.find((r) => r.id === role)?.actions.includes(action);
export const isRole = (v: unknown, defs: RoleDef[] = BUILTIN_ROLES): v is Role => typeof v === "string" && defs.some((r) => r.id === v);
export const isAction = (v: unknown): v is Action => typeof v === "string" && (ACTIONS as readonly string[]).includes(v);

/** A person's role in one project: the one given for that project, else their main role. */
export type Access = Record<string, Role>;
export const roleIn = (person: { role: Role; access?: Access }, projectId?: string) => (projectId && person.access?.[projectId]) || person.role;

/**
 * Whether a person may do an action. Studio-wide actions follow their main role. Project actions follow their role in the
 * projects named; when several are named (a journey shared by two apps) one project that allows it is enough, and when none
 * are named the main role decides.
 */
export function canDo(person: { role: Role; access?: Access } | undefined, action: Action, projectIds: string[] | undefined, defs: RoleDef[] = BUILTIN_ROLES): boolean {
  if (!person) return false;
  if (WORKSPACE_ACTIONS.includes(action) || !projectIds?.length) return can(person.role, action, defs);
  return projectIds.some((p) => can(roleIn(person, p), action, defs));
}

export const COOKIE_USER = "finx.user";

/** Who may publish a change they made themselves, per project. */
export const SELF_PUBLISH = ["admin", "anyone", "never"] as const;
export type SelfPublish = (typeof SELF_PUBLISH)[number];
export const SELF_PUBLISH_INFO: Record<SelfPublish, { label: string; help: string }> = {
  admin: { label: "Only Admins", help: "Anyone who can publish may publish other people's changes. Only an Admin may publish a change they made themselves." },
  never: { label: "Never", help: "Nobody publishes a change they made themselves, Admins included. A second person always approves." },
  anyone: { label: "Anyone who can publish", help: "No second person is needed. Fine for a small team or a sandbox project." },
};
export const DEFAULT_SELF_PUBLISH: SelfPublish = "admin";

/**
 * The approval rule at work: null when the person may publish, or the reason they may not. Only a change they made
 * themselves is held back; a journey nobody has edited since it was published is not.
 */
export function selfPublishBlock(rule: SelfPublish, person: { id: string; role: Role; access?: Access }, editedBy: { id: string } | undefined, changed: boolean, defs: RoleDef[] = BUILTIN_ROLES): string | null {
  if (!changed || !editedBy || editedBy.id !== person.id || rule === "anyone") return null;
  if (rule === "never") return "You made the latest change to this journey, and this project needs a second person to publish it. Ask someone else who can publish.";
  return canDo(person, "people", undefined, defs) ? null : "You made the latest change to this journey, and only an Admin may publish their own change in this project. Ask someone else who can publish.";
}
