import { contrast, readableOn, resolveBrand, type BrandDef, type BrandLook, type Preset } from "./tokens";
import { defaultComponentTokens, resolveComponentTokens, type ComponentTokenOverrides } from "./components";

/** A ready-made look a new project can start from, then tweak. */
export type LookPreset = {
  id: string; name: string; description: string;
  preset: Preset; accent: string;
  look?: BrandLook;
  radius?: BrandDef["radius"];
  components?: ComponentTokenOverrides;
};

export const LOOKS: LookPreset[] = [
  { id: "classic", name: "Classic", description: "Calm and clean: white cards on a pale canvas, a single accent colour.", preset: "meezan", accent: "#0F6E56" },
  { id: "fintech", name: "Fintech", description: "Lavender canvas, a gradient balance card, rounded cards and charts.", preset: "bankworkx", accent: "#3155CE" },
  { id: "bar", name: "Coloured bar", description: "A solid app bar in the brand colour, outlined fields, compact corners.", preset: "meezan", accent: "#00853E",
    look: { chrome: "bar", fields: "outlined", pageBg: "#F1F5F8" }, radius: { md: 8, lg: 12 }, components: { button: { height: 56 }, field: { height: 54 }, row: { height: 68, radius: 16 }, bar: { height: 58 } } },
  { id: "pill", name: "Pill buttons", description: "Blue with full-round buttons and 48px bordered fields. Measured from a corporate bank's design.", preset: "meezan", accent: "#254EA2",
    radius: { sm: 6, md: 8, lg: 28 }, components: { button: { height: 56 }, field: { height: 48 }, row: { height: 56 }, bar: { height: 56 } } },
  { id: "islamic", name: "Islamic bank", description: "Deep green with a coloured bar and generous spacing.", preset: "meezan", accent: "#0B5D4B",
    look: { chrome: "bar", pageBg: "#F4F7F5" }, radius: { md: 14, lg: 14 } },
  { id: "neobank", name: "Neobank", description: "Violet, very round, airy. Made for phones first.", preset: "bankworkx", accent: "#6D4AFF", radius: { sm: 12, md: 18, lg: 24, xl: 30 } },
  { id: "lifestyle", name: "Lifestyle", description: "Magenta with full-round buttons, white rounded cards and roomy rows. Measured from a UAE neo bank's app.", preset: "bankworkx", accent: "#B42871",
    look: { pageBg: "#F4F5F4" }, radius: { sm: 14, md: 16, lg: 24, xl: 28 }, components: { button: { height: 48 }, field: { height: 50 }, row: { height: 64, radius: 16 }, bar: { height: 56 } } },
  { id: "corporate", name: "Corporate", description: "Navy with a bar, outlined fields and tighter corners for dense screens.", preset: "meezan", accent: "#1F3A5F",
    look: { chrome: "bar", fields: "outlined", pageBg: "#F2F4F7" }, radius: { sm: 4, md: 6, lg: 6 }, components: { button: { height: 46 }, field: { height: 46 }, row: { height: 50 } } },
  { id: "contrast", name: "High contrast", description: "Near-black on white, strong borders, large targets. Built for readability.", preset: "meezan", accent: "#003D8F",
    look: { fields: "outlined" }, radius: { sm: 4, md: 6, lg: 8 }, components: { button: { height: 58, border: 2 }, field: { height: 58, border: 2 }, row: { height: 60 } } },
];

export const lookById = (id: string) => LOOKS.find((l) => l.id === id);

/** The parts of a BrandDef a look sets. */
export function applyLook(look: LookPreset): Pick<BrandDef, "preset" | "accent" | "look" | "radius" | "components"> {
  return { preset: look.preset, accent: look.accent, ...(look.look ? { look: look.look } : {}), ...(look.radius ? { radius: look.radius } : {}), ...(look.components ? { components: look.components } : {}) };
}

/**
 * Roundness (the medium corner, 0 to 28 px) and density (0 compact to 100 comfortable) as the radii and component sizes they mean.
 * The two sliders in the look step set these.
 */
export function moodTokens(roundness: number, density: number): { radius: NonNullable<BrandDef["radius"]>; components: ComponentTokenOverrides } {
  const md = Math.max(0, Math.min(28, Math.round(roundness)));
  const d = Math.max(0, Math.min(100, density)) / 100;
  const px = (lo: number, hi: number) => Math.round(lo + (hi - lo) * d);
  return {
    radius: { sm: Math.max(2, Math.round(md * 0.66)), md, lg: Math.round(md * 1.33), xl: Math.round(md * 1.66) },
    components: { field: { height: px(44, 56) }, button: { height: px(44, 58) }, row: { height: px(46, 58) }, bar: { height: px(52, 62) }, keypad: { keyHeight: px(36, 46) } },
  };
}

export type LookCheck = { id: string; label: string; ok: boolean; value: string; fix?: string };

/** Reads a bank's look the way an accessibility reviewer would: contrast of the things people must read, and the size of what they must tap. */
export function lookReport(def: BrandDef): LookCheck[] {
  const brand = resolveBrand("draft", def);
  const light = brand.light.colors, dark = brand.dark.colors;
  const fill = def.look?.bar ?? light.accent!;
  const ratio = (a: string, b: string) => Math.round(contrast(a, b) * 10) / 10;
  const checks: LookCheck[] = [];
  const add = (id: string, label: string, r: number, need: number, fix: string) => checks.push({ id, label, ok: r >= need, value: `${r}:1 (needs ${need})`, ...(r >= need ? {} : { fix }) });
  add("button", "Button text on the brand colour", ratio(def.look?.bar ? "#FFFFFF" : readableOn(light.accent!), fill), 4.5, "Use a darker brand colour.");
  add("link", "Brand colour as a link on the page", ratio(light.accent!, light.bg!), 4.5, "Use a darker brand colour.");
  add("text", "Body text on the page (light)", ratio(light.text!, light.bg!), 4.5, "Use darker text.");
  add("textDark", "Body text on the page (dark)", ratio(dark.text!, dark.bg!), 4.5, "Use lighter text in dark mode.");
  add("muted", "Secondary text on cards", ratio(light.textMuted!, light.surface!), 4.5, "Use darker secondary text.");
  const t = resolveComponentTokens(def.components, brand.radius);
  const smallest = Math.min(t.field.height, t.button.height, t.row.height);
  checks.push({ id: "target", label: "Smallest tap target", ok: smallest >= 44, value: `${smallest}px (needs 44)`, ...(smallest >= 44 ? {} : { fix: "Make fields, buttons and rows at least 44px tall." }) });
  return checks;
}

