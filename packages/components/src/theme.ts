import { completeColors, componentCssVars, resolveComponentTokens, type Brand } from "@finx/ui-kit";

const kebab = (k: string) => k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());

/** Every CSS variable the components read, for one bank and mode, as an inline style object. */
export function brandVars(brand: Brand, mode: "light" | "dark" = "light"): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(completeColors((mode === "dark" ? brand.dark : brand.light).colors))) vars[`--c-${kebab(k)}`] = v;
  for (const [k, v] of Object.entries(brand.radius)) vars[`--r-${k}`] = `${v}px`;
  if (brand.look?.bar) vars["--bar-bg"] = brand.look.bar;
  return { ...vars, ...componentCssVars(resolveComponentTokens(brand.components)) };
}
