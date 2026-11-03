import brandData from "./brands.json";
import type { ComponentTokenOverrides } from "./components";
import type { Channel, Entity, ProjectLanguage } from "./project";

/** FinX Design System (FDS) tokens. Single source of truth for Studio and the bank apps. */

export type Theme = {
  name: string;
  colors: Record<string, string>;
};

const neutralLight = {
  bg: "#F6F7F9", surface: "#FFFFFF", surfaceMuted: "#F1F3F6", border: "#E3E6EA", borderStrong: "#D0D5DC",
  text: "#0E1217", textMuted: "#5B6472", textFaint: "#8A93A0",
};
const neutralDark = {
  bg: "#0A0D12", surface: "#12161D", surfaceMuted: "#1A2029", border: "#252C37", borderStrong: "#323B49",
  text: "#F2F4F7", textMuted: "#A3ACB9", textFaint: "#6F7886",
};
const semanticLight = { positive: "#0F7B5C", positiveBg: "#E3F5EE", negative: "#B42318", negativeBg: "#FDECEA", warning: "#9A6200", warningBg: "#FFF4DB", info: "#175CD3", infoBg: "#E8F0FE" };
const semanticDark = { positive: "#4FD1A5", positiveBg: "#0F2E25", negative: "#FF8A80", negativeBg: "#3A1512", warning: "#F5C066", warningBg: "#35260A", info: "#7AA7FF", infoBg: "#12254A" };

/** Per-bank brand accent. Everything else is fixed so every bank gets the same polish. */
export function makeTheme(opts: { name: string; accent: string; accentOn?: string; accentSoftLight: string; accentSoftDark: string; mode: "light" | "dark" }): Theme {
  const dark = opts.mode === "dark";
  return {
    name: `${opts.name}-${opts.mode}`,
    colors: {
      ...(dark ? neutralDark : neutralLight),
      ...(dark ? semanticDark : semanticLight),
      accent: opts.accent,
      accentOn: opts.accentOn ?? "#FFFFFF",
      accentSoft: dark ? opts.accentSoftDark : opts.accentSoftLight,
    },
  };
}

export const themes = {
  meezanLight: makeTheme({ name: "meezan", accent: "#0F6E56", accentSoftLight: "#E1F5EE", accentSoftDark: "#0E2F27", mode: "light" }),
  meezanDark: makeTheme({ name: "meezan", accent: "#2DBE96", accentOn: "#04130E", accentSoftLight: "#E1F5EE", accentSoftDark: "#0E2F27", mode: "dark" }),
};

export const type = {
  family: { display: "'Inter Tight','Inter',system-ui,sans-serif", body: "'Inter',system-ui,sans-serif", urdu: "'Noto Nastaliq Urdu','Noto Naskh Arabic',serif", arabic: "'Noto Sans Arabic',system-ui,sans-serif", mono: "ui-monospace,Menlo,monospace" },
  /** size / line-height / weight / tracking */
  scale: {
    display: { size: 40, line: 44, weight: 600, tracking: -0.02 },
    title: { size: 24, line: 30, weight: 600, tracking: -0.01 },
    headline: { size: 18, line: 24, weight: 600, tracking: -0.005 },
    body: { size: 15, line: 22, weight: 400, tracking: 0 },
    label: { size: 13, line: 18, weight: 500, tracking: 0 },
    caption: { size: 12, line: 16, weight: 400, tracking: 0.005 },
    money: { size: 32, line: 36, weight: 600, tracking: -0.02, tabular: true },
  },
} as const;

export const space = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;
export const shadow = {
  sm: "0 1px 2px rgba(14,18,23,.06)",
  md: "0 4px 14px rgba(14,18,23,.08)",
  lg: "0 12px 32px rgba(14,18,23,.12)",
} as const;
/** Motion: durations in ms, easings as cubic-bezier. Reduced motion collapses durations to 0. */
export const motion = {
  duration: { instant: 80, fast: 150, base: 220, slow: 320 },
  easing: { standard: [0.2, 0, 0, 1], enter: [0, 0, 0, 1], exit: [0.4, 0, 1, 1], spring: [0.34, 1.56, 0.64, 1] },
} as const;

/** WCAG relative luminance contrast ratio between two #RRGGBB colours. */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const [r, g, bl] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [hi, lo] = [Math.max(lum(a), lum(b)), Math.min(lum(a), lum(b))];
  return (hi + 0.05) / (lo + 0.05);
}

/** Emit CSS custom properties for web (and Studio previews). */
export function toCssVars(theme: Theme): string {
  return Object.entries(theme.colors).map(([k, v]) => `--fds-${k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())}:${v};`).join("");
}

/** BankWorkx: a fintech look with a lavender canvas, a blue hero gradient, cyan highlights and a mint action button. */
const bankworkxLight = {
  bg: "#F6F4FC", surface: "#FFFFFF", surfaceMuted: "#EFEDF8", border: "#E7E4F3", borderStrong: "#D6D2E8",
  text: "#151A3D", textMuted: "#646A90", textFaint: "#979CBA",
  positive: "#0A7A60", positiveBg: "#DDF7F0", negative: "#C92A30", negativeBg: "#FDECEC", warning: "#9A5F00", warningBg: "#FFF3DC", info: "#3155CE", infoBg: "#E8EDFB",
  accent: "#3155CE", accentOn: "#FFFFFF", accentSoft: "#E8EDFB",
  accent2: "#0BB5E3", accent2Soft: "#DDF4FB", fab: "#25D0A6", fabOn: "#FFFFFF",
  heroFrom: "#2B88DA", heroTo: "#14489F", ink: "#181818", inkText: "#FFFFFF", inkMuted: "#A7A7B3",
  chart1: "#3155CE", chart2: "#0BB5E3", chart3: "#25D0A6", chart4: "#F5A23A", chart5: "#8B5CF6", chart6: "#EF6B8A",
};
const bankworkxDark = {
  bg: "#0D1022", surface: "#171B35", surfaceMuted: "#1F2445", border: "#2A3059", borderStrong: "#3A4274",
  text: "#F2F3FF", textMuted: "#A5ABD3", textFaint: "#7078A6",
  positive: "#3FD9B3", positiveBg: "#10332C", negative: "#FF7A80", negativeBg: "#3A1A22", warning: "#F5C066", warningBg: "#35260A", info: "#8DA6FF", infoBg: "#1B2450",
  accent: "#7C9BFF", accentOn: "#0B1130", accentSoft: "#1D2552",
  accent2: "#2DC8F0", accent2Soft: "#0F3340", fab: "#2ED8AE", fabOn: "#06231C",
  heroFrom: "#2B88DA", heroTo: "#14489F", ink: "#05060F", inkText: "#FFFFFF", inkMuted: "#A7A7B3",
  chart1: "#7C9BFF", chart2: "#2DC8F0", chart3: "#2ED8AE", chart4: "#F5B25A", chart5: "#A98BFF", chart6: "#FF8CA6",
};

/** The two looks a bank can start from. A project picks one and then sets its own accent colour. */
export type Preset = "meezan" | "bankworkx";
export const PRESETS: Record<Preset, { name: string; description: string }> = {
  meezan: { name: "Classic", description: "Calm and clean: white cards on a pale canvas, compact corners, a single accent colour." },
  bankworkx: { name: "Fintech", description: "Lavender canvas, a gradient balance card, rounded cards, charts and a bottom tab bar." },
};

/**
 * How a bank's screens are drawn beyond colour, for banks whose design differs from the standard look.
 * Every field is optional; a bank with no `look` gets the standard screens.
 */
export type BrandLook = {
  /** "bar": a solid app bar in the accent colour with the title centred and white back and close icons. */
  chrome?: "bar";
  /** "outlined": white boxed fields with the label as placeholder and an eye icon on passwords. */
  fields?: "outlined";
  /** The exact colour of the app bar and banner, when it must match the bank's design to the pixel (the theme's accent may be nudged for contrast). */
  bar?: string;
  /** Page colour behind the screens (the standard look uses the theme's). */
  pageBg?: string;
  /** The bank's logo (white on transparent) as a data: address, drawn by the hero block. */
  logo?: string;
  /** Font name, when the bank's font is installed or loaded; the standard font is used otherwise. */
  font?: string;
};

/** What a bank is, as stored in brands.json (and edited in Studio). Everything else about its look is derived from this. */
export type BrandDef = {
  name: string; shortName: string; slug: string; bundleId: string; scheme: string;
  preset: Preset; accent: string; currency: string; locale: string;
  /** Folder with the app icons, relative to apps/bank-app. */
  assets: string; background: string; splashDark: string;
  look?: BrandLook;
  /** Corner radii that differ from the look's own (small, medium, large, extra large, in px). */
  radius?: Partial<Record<"sm" | "md" | "lg" | "xl", number>>;
  /** Sizes of the shared components (field, button, bar, row, keypad) when the bank's design differs from the defaults. */
  components?: ComponentTokenOverrides;
  /** Where the project runs, the languages it offers and the legal entities it covers. Anything unset follows the bank's currency and locale (see projectShape). */
  channels?: Channel[];
  languages?: string[];
  customLanguages?: ProjectLanguage[];
  entities?: Entity[];
};
export type BrandId = string;
export type Brand = { id: BrandId; name: string; preset: Preset; light: Theme; dark: Theme; radius: Record<keyof typeof radius, number>; currency: string; locale: string; look?: BrandLook; components?: ComponentTokenOverrides };

// ---- colour helpers ---------------------------------------------------------------------------------------------------
const toRgb = (hex: string): [number, number, number] => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = (c: number[]) => "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("").toUpperCase();
/** t = 0 gives a, t = 1 gives b. */
export const mix = (a: string, b: string, t: number) => { const x = toRgb(a), y = toRgb(b); return toHex(x.map((v, i) => v + (y[i]! - v) * t)); };
const WHITE = "#FFFFFF", BLACK = "#0B0F19";

/** Moves `fg` toward white or black (whichever helps) until it reads on `bg` at the given ratio. */
export function ensureContrast(fg: string, bg: string, min = 4.5): string {
  const toward = contrast(WHITE, bg) > contrast(BLACK, bg) ? WHITE : BLACK;
  let c = fg;
  for (let t = 0; t <= 1.0001 && contrast(c, bg) < min; t += 0.04) c = mix(fg, toward, t);
  return c;
}
/** White or near-black text, whichever is more readable on this fill. */
export const readableOn = (fill: string) => (contrast(WHITE, fill) >= contrast(BLACK, fill) ? WHITE : BLACK);

/** A hex colour like #3155CE, and readable: white text on it and it on white both need to reach 4.5:1. Returns an error message or null. */
export function accentProblem(hex: string): string | null {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return "Enter a colour like #3155CE";
  if (contrast(hex, WHITE) < 4.5) return "This colour is too light: white text on it would be hard to read. Pick a darker one.";
  return null;
}

const PRESET_BASE: Record<Preset, { light: Record<string, string>; dark: Record<string, string>; radius: Brand["radius"] }> = {
  meezan: {
    light: { ...neutralLight, ...semanticLight, accent: "#0F6E56", accentOn: "#FFFFFF", accentSoft: "#E1F5EE" },
    dark: { ...neutralDark, ...semanticDark, accent: "#2DBE96", accentOn: "#04130E", accentSoft: "#0E2F27" },
    radius,
  },
  bankworkx: { light: bankworkxLight, dark: bankworkxDark, radius: { sm: 10, md: 14, lg: 20, xl: 26, pill: 999 } },
};
const PRESET_ACCENT: Record<Preset, string> = { meezan: "#0F6E56", bankworkx: "#3155CE" };

/** A full light and dark theme for a bank: the preset's palette with the bank's own accent colour applied. */
export function resolveBrand(id: BrandId, def: BrandDef): Brand {
  const base = PRESET_BASE[def.preset];
  const make = (mode: "light" | "dark"): Theme => {
    const c: Record<string, string> = { ...base[mode] };
    if (def.accent.toUpperCase() !== PRESET_ACCENT[def.preset]) {
      const surface = c.surface!;
      // Dark mode needs a lighter version of the accent so it still reads on dark surfaces.
      const soft = (a: string) => mix(a, surface, mode === "dark" ? 0.78 : 0.88);
      let accent = mode === "dark" ? ensureContrast(mix(def.accent, WHITE, 0.35), surface, 4.5) : def.accent;
      // the accent also has to read on its own soft background, which itself follows the accent, so nudge until both hold
      for (let i = 0; i < 12 && contrast(accent, soft(accent)) < 4.5; i++) accent = mix(accent, mode === "dark" ? WHITE : BLACK, 0.06);
      c.accent = accent;
      c.accentOn = readableOn(accent);
      c.accentSoft = soft(accent);
      if (def.preset === "bankworkx") { c.heroFrom = mix(def.accent, WHITE, 0.16); c.heroTo = mix(def.accent, BLACK, 0.42); c.info = accent; c.infoBg = c.accentSoft; c.chart1 = accent; }
    }
    return { name: `${id}-${mode}`, colors: c };
  };
  return { id, name: def.name, preset: def.preset, light: make("light"), dark: make("dark"), radius: { ...base.radius, ...(def.radius ?? {}) }, currency: def.currency, locale: def.locale, ...(def.look ? { look: def.look } : {}), ...(def.components ? { components: def.components } : {}) };
}

/** Every bank in brands.json. Journeys and the engine never change per bank; only this does. */
export const brandDefs = brandData as Record<BrandId, BrandDef>;
export const brands: Record<BrandId, Brand> = Object.fromEntries(Object.entries(brandDefs).map(([id, def]) => [id, resolveBrand(id, def)]));

/** Every colour a component may use. Brands that do not define an extra one fall back through completeColors. */
export type ColorKey =
  | "bg" | "surface" | "surfaceMuted" | "border" | "borderStrong" | "text" | "textMuted" | "textFaint"
  | "positive" | "positiveBg" | "negative" | "negativeBg" | "warning" | "warningBg" | "info" | "infoBg"
  | "accent" | "accentOn" | "accentSoft" | "accent2" | "accent2Soft" | "fab" | "fabOn" | "heroFrom" | "heroTo" | "ink" | "inkText" | "inkMuted"
  | "chart1" | "chart2" | "chart3" | "chart4" | "chart5" | "chart6";
export type Colors = Record<ColorKey, string>;

export function completeColors(c: Record<string, string>): Colors {
  const g = (k: string, fb: string) => c[k] ?? fb;
  const accent = g("accent", "#0F6E56");
  return {
    ...c,
    accent2: g("accent2", accent), accent2Soft: g("accent2Soft", g("accentSoft", "#E1F5EE")), fab: g("fab", accent), fabOn: g("fabOn", g("accentOn", "#FFFFFF")),
    heroFrom: g("heroFrom", accent), heroTo: g("heroTo", accent), ink: g("ink", "#0E1217"), inkText: g("inkText", "#FFFFFF"), inkMuted: g("inkMuted", "#A3ACB9"),
    chart1: g("chart1", accent), chart2: g("chart2", "#2563EB"), chart3: g("chart3", "#16A34A"), chart4: g("chart4", "#F59E0B"), chart5: g("chart5", "#8B5CF6"), chart6: g("chart6", "#EF4444"),
  } as Colors;
}
