import { describe, it, expect } from "vitest";
import { localTransfer, payBill } from "@finx/journey-schema";
import { slidesOf, stepIndex } from "./slides";

describe("slides of a journey", () => {
  it("lists the screens a customer sees, in order, without branch screens", () => {
    const slides = slidesOf(localTransfer);
    const ids = localTransfer.screens.filter((s) => s.kind !== "branch").map((s) => s.id);
    expect(slides.map((s) => s.id)).toEqual(ids);
    expect(slides.length).toBeLessThan(localTransfer.screens.length); // limitExceeded is a branch
    expect(slides[0]).toMatchObject({ kind: "screen" });
    expect(slides.every((s) => s.title.length > 0)).toBe(true);
  });
  it("marks end screens as success or failure from their result", () => {
    const ends = slidesOf(localTransfer).filter((s) => s.kind === "terminal");
    expect(ends.length).toBeGreaterThanOrEqual(2);
    expect(ends.some((s) => s.ending === "success")).toBe(true);
    expect(ends.some((s) => s.ending === "failure")).toBe(true);
    expect(slidesOf(payBill).filter((s) => s.kind === "screen").every((s) => s.ending === undefined)).toBe(true);
  });
  it("uses the English title of a translated screen", () => {
    expect(slidesOf(localTransfer)[0]!.title).not.toMatch(/^\{/);
  });
});

describe("stepping around the slides", () => {
  it("wraps forward and backward", () => {
    expect(stepIndex(0, 4)).toBe(1);
    expect(stepIndex(3, 4)).toBe(0);
    expect(stepIndex(0, 4, -1)).toBe(3);
    expect(stepIndex(2, 4, -1)).toBe(1);
  });
  it("copes with no slides", () => { expect(stepIndex(0, 0)).toBe(0); });
});

import { sampleAnswers } from "./slides";
describe("sample answers for placeholders", () => {
  const j = { screens: [{ blocks: [
    { text: "You sent {{transfer.amount | money}} to {{transfer.beneficiary.name}} ref {{result.reference}} on {{result.date}}" },
    { text: "{{ctx.accounts}} and {{sell.shares}} of {{sell.symbol}}" },
    { actions: [{ type: "callApi", saveAs: "ctx.accounts" }] },
  ] }] } as any;
  it("fills each placeholder with a believable value by the last word of its name", () => {
    const a = sampleAnswers(j);
    expect(a["transfer.amount"]).toBe(250);
    expect(a["transfer.beneficiary.name"]).toBe("Sample name");
    expect(a["result.reference"]).toBe("FX-20481");
    expect(a["sell.shares"]).toBe(5);
    expect(a["sell.symbol"]).toBe("LMRB");
    expect(String(a["result.date"])).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("leaves alone what the journey fills in itself", () => { expect(sampleAnswers(j)["ctx.accounts"]).toBeUndefined(); });
});
