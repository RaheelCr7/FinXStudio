/** Who may do what in Studio. Pure data, shared by the server and the pages. */
export const ROLES = ["admin", "designer", "developer", "reviewer"] as const;
export type Role = (typeof ROLES)[number];
export type Action = "edit" | "publish" | "projects" | "agents" | "people";

export const ROLE_INFO: Record<Role, { label: string; blurb: string }> = {
  admin: { label: "Admin", blurb: "Everything, including people and publishing." },
  designer: { label: "Designer", blurb: "Builds journeys and sets up projects and their look. Cannot publish." },
  developer: { label: "Developer", blurb: "Builds journeys and runs AI agents. Cannot publish." },
  reviewer: { label: "Reviewer", blurb: "Reads everything and publishes what is ready. Cannot edit." },
};

export const ACTION_INFO: Record<Action, string> = {
  edit: "Create and edit journeys, restore versions, add from the catalog",
  publish: "Publish a journey to UAT",
  projects: "Create projects (bank apps)",
  agents: "Report and update AI agent runs",
  people: "Add people and change their roles",
};

const MATRIX: Record<Role, Action[]> = {
  admin: ["edit", "publish", "projects", "agents", "people"],
  designer: ["edit", "projects"],
  developer: ["edit", "agents"],
  reviewer: ["publish"],
};

export const can = (role: Role | undefined, action: Action) => !!role && MATRIX[role].includes(action);
export const isRole = (v: unknown): v is Role => typeof v === "string" && (ROLES as readonly string[]).includes(v);
export const COOKIE_USER = "finx.user";
