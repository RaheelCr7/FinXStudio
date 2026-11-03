import { accentProblem, mix } from "@finx/ui-kit";

/** A colour found in a picture: how much of the picture it covers, and whether it is a real colour rather than a grey. */
export type Swatch = { hex: string; share: number; chroma: boolean };

const hex = (r: number, g: number, b: number) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();

function hsl(r: number, g: number, b: number): [number, number, number] {
  const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, l = (mx + mn) / 2, d = mx - mn;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  return [0, s, l];
}

/**
 * The main colours of a picture, from its RGBA pixels (as `getImageData` gives them). Pixels are grouped into coarse colour buckets,
 * near-identical buckets are merged, and colours that are really greys are marked so a brand colour can be chosen from the rest.
 * Strong, common colours come first; the picture never leaves the browser.
 */
export function extractPalette(data: ArrayLike<number>, max = 6): Swatch[] {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  let total = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3]! < 128) continue;
    const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!;
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const e = buckets.get(key);
    if (e) { e.n++; e.r += r; e.g += g; e.b += b; } else buckets.set(key, { n: 1, r, g, b });
    total++;
  }
  if (total === 0) return [];
  const colours = [...buckets.values()].map((e) => {
    const r = e.r / e.n, g = e.g / e.n, b = e.b / e.n, [, s, l] = hsl(r, g, b);
    const chroma = s > 0.25 && l > 0.12 && l < 0.9;
    // vivid colours matter more to a brand than a big area of grey, so they are weighed up
    return { r, g, b, n: e.n, chroma, score: e.n * (chroma ? 1 + s * 2 : 1) };
  }).sort((a, b) => b.score - a.score);

  const kept: typeof colours = [];
  for (const c of colours) {
    const near = kept.find((k) => (k.r - c.r) ** 2 + (k.g - c.g) ** 2 + (k.b - c.b) ** 2 < 48 ** 2);
    if (near) { const n = near.n + c.n; near.r = (near.r * near.n + c.r * c.n) / n; near.g = (near.g * near.n + c.g * c.n) / n; near.b = (near.b * near.n + c.b * c.n) / n; near.n = n; near.score += c.score; }
    else kept.push({ ...c });
  }
  return kept.sort((a, b) => b.score - a.score).slice(0, max).map((c) => ({ hex: hex(c.r, c.g, c.b), share: c.n / total, chroma: c.chroma }));
}

/** The colour to suggest as the brand colour: the strongest real colour in the picture, or null for a picture with only greys. */
export const suggestAccent = (palette: Swatch[]): string | null => palette.find((s) => s.chroma)?.hex ?? null;

/** Darkens a colour just enough for white text on it to be readable, which the apps need for buttons. Colours that already work are returned unchanged. */
export function readableAccent(color: string): string {
  let c = color.toUpperCase();
  for (let i = 0; i < 40 && accentProblem(c); i++) c = mix(c, "#000000", 0.06);
  return c;
}
