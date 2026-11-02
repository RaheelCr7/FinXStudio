import { brands, brandDefs, type Brand, type BrandDef } from "@finx/ui-kit";

export type Project = { id: string; brand: Brand; def: BrandDef; /** Which set of screens the project uses. */ shell: "meezan" | "bankworkx" };

/** Names that cannot be project ids because they are used by the app's own addresses. */
export const RESERVED = new Set(["api", "assets", "_next", "theme", "favicon.ico"]);

const toProject = (id: string): Project => ({ id, brand: brands[id]!, def: brandDefs[id]!, shell: brands[id]!.preset === "bankworkx" ? "bankworkx" : "meezan" });

/** The projects this deployment serves. Today they come from the design system's list of banks. */
export const listProjects = (): Project[] => Object.keys(brands).filter((id) => !RESERVED.has(id)).map(toProject);
export const getProject = (id: string): Project | undefined => (id in brands && !RESERVED.has(id) ? toProject(id) : undefined);
/** The project served at the root address: set FINX_WEB_DEFAULT_PROJECT, else the first one. */
export const defaultProjectId = () => (process.env.FINX_WEB_DEFAULT_PROJECT && getProject(process.env.FINX_WEB_DEFAULT_PROJECT) ? process.env.FINX_WEB_DEFAULT_PROJECT : listProjects()[0]!.id);
