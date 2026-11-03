// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { blockAt } from "./pick";

describe("clicking a block in the phone preview", () => {
  it("finds the block's screen and place in the screen, from anything inside it", () => {
    document.body.innerHTML = `<div data-testid="fxblock:review-screen:3"><span id="in">Continue</span></div><p id="out">x</p>`;
    expect(blockAt(document.getElementById("in"))).toEqual({ screen: "review-screen", index: 3 });
    expect(blockAt(document.getElementById("out"))).toBeNull();
    expect(blockAt(null)).toBeNull();
  });
});
