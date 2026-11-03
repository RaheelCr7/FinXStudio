import { completeColors, componentCssVars, resolveComponentTokens, type Brand } from "@finx/ui-kit";

const kebab = (k: string) => k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,62}$/;

function declarations(brand: Brand, mode: "light" | "dark"): string {
  const colors = completeColors((mode === "dark" ? brand.dark : brand.light).colors) as Record<string, string>;
  const lines = Object.entries(colors).map(([k, v]) => `--c-${kebab(k)}:${v};`);
  for (const [k, v] of Object.entries(brand.radius)) lines.push(`--r-${k}:${v}px;`);
  for (const [k, v] of Object.entries(componentCssVars(resolveComponentTokens(brand.components, brand.radius)))) lines.push(`${k}:${v};`);
  lines.push(`color-scheme:${mode};`);
  return lines.join("");
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
