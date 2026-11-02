import { describe, expect, it } from "vitest";
import { ICON_SHAPES, donutArcs, donutHit, lineGeometry, nearestIndex, smoothPath } from "./index";

describe("line chart geometry", () => {
  const data = [{ label: "a", value: 10 }, { label: "b", value: 30 }, { label: "c", value: 20 }];
  it("places the lowest value at the bottom and the highest at the top, inside the padding", () => {
    const g = lineGeometry(data, 300, 100);
    expect(g.pts[0]).toEqual({ x: 14, y: 16 + (1 - 0) * 68 });
    expect(g.pts[1]).toEqual({ x: 150, y: 16 });
    expect(g.pts[2]!.x).toBe(286);
    expect(g.line.startsWith("M14 84 C")).toBe(true);
    expect(g.area.endsWith("L286 100 L14 100 Z")).toBe(true);
  });
  it("copes with one point, no points and a flat line", () => {
    expect(lineGeometry([{ label: "a", value: 5 }], 200, 100).pts).toEqual([{ x: 100, y: 16 + 68 }]);
    expect(lineGeometry([], 200, 100)).toEqual({ pts: [], line: "", area: "" });
    expect(lineGeometry([{ label: "a", value: 5 }, { label: "b", value: 5 }], 200, 100).pts.map((p) => p.y)).toEqual([84, 84]);
    expect(smoothPath([{ x: 0, y: 0 }])).toBe("");
  });
  it("finds the point nearest a touch", () => {
    expect([nearestIndex(0, 300, 3), nearestIndex(150, 300, 3), nearestIndex(299, 300, 3), nearestIndex(9999, 300, 3)]).toEqual([0, 1, 2, 2]);
  });
});

describe("donut geometry", () => {
  const segs = [{ label: "a", value: 1, color: "#000" }, { label: "b", value: 3, color: "#111" }];
  it("shares the ring by value with a gap between arcs", () => {
    const ring = donutArcs(segs, 168, 20);
    expect(ring.total).toBe(4);
    expect(ring.R).toBe(74);
    expect(ring.arcs[0]!.len / ring.C).toBeCloseTo(0.25, 6);
    expect(ring.arcs[0]!.dash).toBeCloseTo(ring.arcs[0]!.len - 20, 6);
    expect(ring.arcs[1]!.offset).toBeCloseTo(-ring.arcs[0]!.len, 6);
    expect(donutArcs([segs[0]!], 168, 20).arcs[0]!.dash).toBeCloseTo(donutArcs([segs[0]!], 168, 20).C, 6);
  });
  it("tells which arc a touch lands on", () => {
    const ring = donutArcs(segs, 168, 20);
    expect(donutHit(84 + 74 * Math.SQRT1_2, 84 - 74 * Math.SQRT1_2, 168, 20, ring)).toBe(0); // 45 degrees clockwise from the top: inside the first quarter
    expect(donutHit(84 - 74, 84, 168, 20, ring)).toBe(1);
    expect(donutHit(84, 84, 168, 20, ring)).toBeNull(); // the hole
    expect(donutHit(0, 0, 168, 20, ring)).toBeNull();
  });
});

describe("icon drawings", () => {
  it("every icon has at least one shape, and paths are non-empty", () => {
    for (const [name, shapes] of Object.entries(ICON_SHAPES)) {
      expect(shapes.length, name).toBeGreaterThan(0);
      for (const s of shapes) if ("d" in s) expect(s.d.length, name).toBeGreaterThan(3);
    }
    expect(Object.keys(ICON_SHAPES)).toEqual(expect.arrayContaining(["home", "wallet", "trend", "star", "search", "card", "lock", "briefcase"]));
  });
});
