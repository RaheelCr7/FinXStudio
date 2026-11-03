import { describe, expect, it } from "vitest";
import { localTransfer } from "@finx/journey-schema";
import { shapeOf } from "./graph";

describe("shapeOf", () => {
  const shape = shapeOf(localTransfer);

  it("has one node per screen and marks the start", () => {
    expect(shape.nodes).toHaveLength(localTransfer.screens.length);
    expect(shape.nodes.filter((n) => n.entry).map((n) => n.id)).toEqual([localTransfer.entryScreen]);
  });

  it("lays out left to right: the start is first and later screens sit further right", () => {
    const start = shape.nodes.find((n) => n.entry)!;
    expect(start.x).toBe(0);
    expect(Math.max(...shape.nodes.map((n) => n.x))).toBeGreaterThan(start.x);
  });

  it("only joins screens that exist", () => {
    const ids = new Set(shape.nodes.map((n) => n.id));
    expect(shape.edges.length).toBeGreaterThan(0);
    for (const e of shape.edges) { expect(ids.has(e.from)).toBe(true); expect(ids.has(e.to)).toBe(true); }
  });
});
