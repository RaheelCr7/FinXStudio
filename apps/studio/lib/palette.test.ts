import { describe, it, expect } from "vitest";
import { accentProblem } from "@finx/ui-kit";
import { extractPalette, readableAccent, suggestAccent } from "./palette";

/** RGBA pixels from [colour, count] pairs. */
const pixels = (parts: [number[], number][]) => {
  const out: number[] = [];
  for (const [[r, g, b], n] of parts) for (let i = 0; i < n; i++) out.push(r!, g!, b!, 255);
  return Uint8ClampedArray.from(out);
};

describe("palette from a picture", () => {
  it("finds the brand colour even when white covers most of the picture", () => {
    const p = extractPalette(pixels([[[255, 255, 255], 700], [[49, 85, 206], 200], [[232, 135, 43], 100]]));
    expect(suggestAccent(p)).toBe("#3155CE");
    expect(p.find((s) => s.hex === "#FFFFFF")!.chroma).toBe(false);
    expect(p.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1, 5);
  });

  it("merges near-identical shades into one swatch", () => {
    const p = extractPalette(pixels([[[49, 85, 206], 100], [[52, 88, 204], 100], [[47, 83, 209], 100], [[20, 160, 90], 60]]));
    expect(p).toHaveLength(2);
    expect(p[0]!.share).toBeCloseTo(300 / 360, 5);
  });

  it("ignores see-through pixels, and has no suggestion for a grey picture or an empty one", () => {
    const clear = Uint8ClampedArray.from([200, 30, 30, 0, 200, 30, 30, 0]);
    expect(extractPalette(clear)).toEqual([]);
    expect(suggestAccent(extractPalette(pixels([[[128, 128, 128], 50], [[250, 250, 250], 50]])))).toBeNull();
    expect(extractPalette([])).toEqual([]);
  });

  it("limits the number of swatches", () => {
    const parts: [number[], number][] = Array.from({ length: 12 }, (_, i) => [[i * 20, 255 - i * 20, (i * 70) % 255], 10]);
    expect(extractPalette(pixels(parts), 4).length).toBeLessThanOrEqual(4);
  });

  it("darkens a pale colour until white text is readable, and leaves a good one alone", () => {
    const fixed = readableAccent("#FFD166");
    expect(accentProblem(fixed)).toBeNull();
    expect(fixed).not.toBe("#FFD166");
    expect(readableAccent("#3155ce")).toBe("#3155CE");
  });
});
