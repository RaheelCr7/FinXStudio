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

/** Format money with tabular-friendly grouping. */
export function formatMoney(amount: number, currency = "PKR", locale = "en-US"): string {
  return `${currency} ${amount.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
