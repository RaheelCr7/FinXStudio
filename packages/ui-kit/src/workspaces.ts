import { PRESETS, WORKSPACES, accentProblem, type BrandDef, type BrandLook, type WorkspaceId, type WorkspaceTheme } from "./tokens";
import { defaultComponentTokens, type ComponentTokenOverrides } from "./components";

/**
 * Workspace themes arrive from outside the code (Studio's form, Studio's answer to the web app), so they are rebuilt from plain,
 * checked fields: colours are #RRGGBB, sizes are small numbers, and nothing else is carried over (no logo, font or free text beyond a name).
 */
const hex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
const num = (v: unknown, max: number): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max;

/** The theme as stored, or what is wrong with it. */
export function checkWorkspaceTheme(input: unknown): { ok: true; theme: WorkspaceTheme } | { ok: false; errors: string[] } {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, errors: ["Send the workspace look as an object"] };
  const t = input as Record<string, unknown>;
  const errors: string[] = [];
  const out: WorkspaceTheme = {};
  if (t.name !== undefined) { if (typeof t.name === "string" && t.name.trim().length >= 1 && t.name.length <= 30) out.name = t.name.trim(); else errors.push("The look's name must be 1 to 30 characters"); }
  if (t.accent !== undefined) { const bad = typeof t.accent === "string" ? accentProblem(t.accent) : "Enter a colour like #3155CE"; if (bad) errors.push(bad); else out.accent = String(t.accent).toUpperCase(); }
  if (t.preset !== undefined) { if (typeof t.preset === "string" && Object.hasOwn(PRESETS, t.preset)) out.preset = t.preset as WorkspaceTheme["preset"]; else errors.push(`The base look must be one of: ${Object.keys(PRESETS).join(", ")}`); }
  if (t.mode !== undefined) { if (t.mode === "light" || t.mode === "dark") out.mode = t.mode; else errors.push("The appearance must be light or dark"); }
  if (t.look !== undefined) {
    const l = t.look && typeof t.look === "object" ? (t.look as Record<string, unknown>) : null;
    if (!l) errors.push("The look details must be an object");
    else {
      const look: BrandLook = {};
      if (l.chrome === "bar") look.chrome = "bar";
      if (l.fields === "outlined") look.fields = "outlined";
      for (const k of ["bar", "pageBg", "ink"] as const) if (l[k] !== undefined) { if (hex(l[k])) look[k] = (l[k] as string).toUpperCase(); else errors.push(`${k} must be a colour like #18211E`); }
      if (l.hero !== undefined) {
        const h = l.hero as { from?: unknown; to?: unknown } | null;
        if (h && hex(h.from) && hex(h.to)) look.hero = { from: h.from.toUpperCase(), to: h.to.toUpperCase() }; else errors.push("The balance card gradient needs a start and an end colour like #18211E");
      }
      if (Object.keys(look).length) out.look = look;
    }
  }
  if (t.radius !== undefined) {
    const r = t.radius && typeof t.radius === "object" ? (t.radius as Record<string, unknown>) : null;
    if (!r) errors.push("The corner radii must be an object");
    else {
      const radius: NonNullable<WorkspaceTheme["radius"]> = {};
      for (const k of ["sm", "md", "lg", "xl"] as const) if (r[k] !== undefined) { if (num(r[k], 60)) radius[k] = r[k] as number; else errors.push(`radius.${k} must be a number from 0 to 60`); }
      if (Object.keys(radius).length) out.radius = radius;
    }
  }
  if (t.components !== undefined) {
    const c = t.components && typeof t.components === "object" ? (t.components as Record<string, unknown>) : null;
    if (!c) errors.push("The component sizes must be an object");
    else {
      const components: Record<string, Record<string, number>> = {};
      for (const [group, defaults] of Object.entries(defaultComponentTokens)) {
        const given = c[group];
        if (given === undefined) continue;
        if (!given || typeof given !== "object") { errors.push(`${group} must be an object`); continue; }
        for (const key of Object.keys(defaults)) {
          const v = (given as Record<string, unknown>)[key];
          if (v === undefined) continue;
          if (num(v, 200)) (components[group] ??= {})[key] = v; else errors.push(`${group}.${key} must be a number from 0 to 200`);
        }
      }
      if (Object.keys(components).length) out.components = components as ComponentTokenOverrides;
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, theme: out };
}

/** The workspace themes in untrusted data, keeping the valid ones and dropping the rest. Undefined when none is left. */
export function readWorkspaces(raw: unknown): BrandDef["workspaces"] | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Partial<Record<WorkspaceId, WorkspaceTheme>> = {};
  for (const w of WORKSPACES) {
    const r = checkWorkspaceTheme((raw as Record<string, unknown>)[w]);
    if (r.ok) out[w] = r.theme;
  }
  return Object.keys(out).length ? out : undefined;
}
