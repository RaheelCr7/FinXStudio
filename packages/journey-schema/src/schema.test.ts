import { describe, it, expect } from "vitest";
import { Journey, lintJourney, localTransfer } from "./index";

describe("journey schema", () => {
  it("accepts the Local transfer fixture", () => {
    expect(() => Journey.parse(localTransfer)).not.toThrow();
  });
  it("rejects a journey with an unknown block type", () => {
    const bad = structuredClone(localTransfer) as any;
    bad.screens[0].blocks.push({ type: "nope" });
    expect(Journey.safeParse(bad).success).toBe(false);
  });
});

describe("lint", () => {
  it("passes the Local transfer fixture with no issues", () => {
    expect(lintJourney(localTransfer)).toEqual([]);
  });
  it("flags an unreachable screen", () => {
    const j = structuredClone(localTransfer);
    j.screens.push({ id: "orphan", title: { en: "x", ur: "x" }, blocks: [] });
    expect(lintJourney(j).map((i) => i.code)).toContain("unreachable");
  });
  it("flags missing consent on a money-moving journey", () => {
    const j = structuredClone(localTransfer);
    const review = j.screens.find((s) => s.id === "review")!;
    review.blocks = review.blocks.filter((b) => b.type !== "consent");
    expect(lintJourney(j).map((i) => i.code)).toContain("consent_before_submit");
  });
  it("flags OTP verified after the transfer call", () => {
    const j = structuredClone(localTransfer);
    const otp = j.screens.find((s) => s.id === "otp")!;
    const btn: any = otp.blocks.find((b) => b.type === "button");
    btn.actions = [btn.actions[0], btn.actions[2], btn.actions[1], btn.actions[3]];
    expect(lintJourney(j).map((i) => i.code)).toContain("otp_before_money");
  });
  it("flags a missing Urdu translation", () => {
    const j = structuredClone(localTransfer);
    (j.screens[0] as any).title = { en: "From account" };
    expect(lintJourney(j).map((i) => i.code)).toContain("translation_gap");
  });
  it("flags a dangling navigation target", () => {
    const j = structuredClone(localTransfer);
    (j.screens[1] as any).blocks[1].actions[1].to = "nowhere";
    expect(lintJourney(j).map((i) => i.code)).toContain("dangling_target");
  });
});
