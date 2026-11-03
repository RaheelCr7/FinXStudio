import { completeColors, type Brand } from "@finx/ui-kit";

const kebab = (k: string) => k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,62}$/;

/** The CSS variables for one bank in one mode, as name to value. */
function variables(brand: Brand, mode: "light" | "dark"): Record<string, string> {
  const colors = completeColors((mode === "dark" ? brand.dark : brand.light).colors) as Record<string, string>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(colors)) out[`--c-${kebab(k)}`] = v;
  for (const [k, v] of Object.entries(brand.radius)) out[`--r-${k}`] = `${v}px`;
  out["color-scheme"] = mode;
  return out;
}

function declarations(brand: Brand, mode: "light" | "dark"): string {
  return Object.entries(variables(brand, mode)).map(([k, v]) => `${k}:${v};`).join("");
}

/**
 * The same variables for one element, to scope a bank's colours to a single box (for example a preview inside another
 * app) instead of the whole page. Pass it as `style` (React wants `colorScheme` in camel case, so that one key differs).
 */
export function themeVars(brand: Brand, mode: "light" | "dark"): Record<string, string> {
  const { "color-scheme": scheme, ...custom } = variables(brand, mode);
  return { ...custom, colorScheme: scheme as string };
}

/**
 * The stylesheet that gives one bank its colours: CSS variables (--c-accent, --c-surface, --r-lg…) for light and dark.
 * Dark applies when the page says data-mode="dark", or when the visitor's system is dark and the page has not chosen light.
 * The selectors only match `<html data-brand="<id>">`, so each bank's sheet colours only its own pages.
 */
export function themeCss(brand: Brand): string {
  if (!SAFE_ID.test(brand.id)) throw new Error(`Unsafe brand id: ${brand.id}`);
  const root = `:root[data-brand="${brand.id}"]`;
  return [
    `${root}{${declarations(brand, "light")}}`,
    `${root}[data-mode="dark"]{${declarations(brand, "dark")}}`,
    `@media (prefers-color-scheme:dark){${root}:not([data-mode="light"]){${declarations(brand, "dark")}}}`,
  ].join("\n") + "\n";
}
