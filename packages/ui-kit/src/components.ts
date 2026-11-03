/** Sizes of the shared components, in px. Each bank can override any of them in brands.json under "components". */
export type ComponentTokens = {
  field: { height: number; radius: number; border: number };
  button: { height: number; radius: number; border: number };
  bar: { height: number; icon: number };
  row: { height: number; radius: number };
  keypad: { key: number; keyHeight: number; gapX: number; gapY: number };
};
export type ComponentTokenOverrides = { [K in keyof ComponentTokens]?: Partial<ComponentTokens[K]> };

export const defaultComponentTokens: ComponentTokens = {
  field: { height: 52, radius: 12, border: 1 },
  button: { height: 54, radius: 16, border: 1 },
  bar: { height: 56, icon: 24 },
  row: { height: 54, radius: 10 },
  keypad: { key: 84, keyHeight: 40, gapX: 14, gapY: 10 },
};

/**
 * The defaults with a bank's overrides applied. Unknown or non-numeric values are ignored. Field and button corners follow the bank's
 * corner radii (medium and large) unless the bank overrides them, so a bank with rounder cards also gets rounder fields.
 */
export function resolveComponentTokens(overrides?: ComponentTokenOverrides, radii?: { md: number; lg: number }): ComponentTokens {
  const out = structuredClone(defaultComponentTokens) as Record<string, Record<string, number>>;
  if (radii) { out.field!.radius = radii.md; out.button!.radius = radii.lg; }
  for (const [group, values] of Object.entries(overrides ?? {})) {
    if (!out[group] || !values) continue;
    for (const [k, v] of Object.entries(values)) if (k in out[group]! && typeof v === "number" && Number.isFinite(v) && v >= 0) out[group]![k] = v;
  }
  return out as unknown as ComponentTokens;
}

/** CSS custom properties (--fxc-field-height…) the shared components read their sizes from. */
export function componentCssVars(t: ComponentTokens): Record<string, string> {
  const kebab = (k: string) => k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
  const vars: Record<string, string> = {};
  for (const [group, values] of Object.entries(t)) for (const [k, v] of Object.entries(values as Record<string, number>)) vars[`--fxc-${group}-${kebab(k)}`] = `${v}px`;
  return vars;
}
