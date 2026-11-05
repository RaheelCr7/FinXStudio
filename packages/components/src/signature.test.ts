import { describe, expect, it } from "vitest";
import { reachedEnd } from "./signature";

describe("reachedEnd", () => {
  it("is true at the bottom and for a text that fits", () => {
    expect(reachedEnd(900, 100, 1000)).toBe(true);
    expect(reachedEnd(0, 240, 100)).toBe(true);
  });
  it("is false in the middle of a long text", () => expect(reachedEnd(300, 100, 1000)).toBe(false));
  it("is never true for a box that has no size (hidden or not laid out), so nothing counts as read", () => {
    expect(reachedEnd(0, 0, 0)).toBe(false);
    expect(reachedEnd(0, 0, 500)).toBe(false);
    expect(reachedEnd(0, 100, 0)).toBe(false);
  });
});
