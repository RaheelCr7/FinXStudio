import { describe, it, expect } from "vitest";
import { Journey, lintJourney, localTransfer, payBill } from "./index";

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

describe("Pay a bill fixture", () => {
  it("is valid and passes lint", () => {
    expect(() => Journey.parse(payBill)).not.toThrow();
    expect(lintJourney(payBill)).toEqual([]);
  });
  it("lint requires consent and OTP for a bill payment", () => {
    const j = structuredClone(payBill);
    j.screens.find((s) => s.id === "review")!.blocks = j.screens.find((s) => s.id === "review")!.blocks.filter((b) => b.type !== "consent");
    expect(lintJourney(j).map((i) => i.code)).toContain("consent_before_submit");
  });
});

import { validateJourney } from "./index";

describe("validateJourney", () => {
  it("accepts a valid journey with no warnings", () => {
    const r = validateJourney(structuredClone(localTransfer));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warnings).toEqual([]);
  });
  it("reports every error with a readable path", () => {
    const bad = structuredClone(localTransfer) as any;
    delete bad.screens[0].blocks[1].bind;
    bad.screens[1].blocks[0].type = "nope";
    const r = validateJourney(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.startsWith("screens[0].blocks[1].bind"))).toBe(true);
      expect(r.errors.some((e) => e.startsWith("screens[1].blocks[0].type"))).toBe(true);
    }
  });
  it("warns about misspelled optional fields that would be silently dropped", () => {
    const j = structuredClone(payBill) as any;
    j.screens[0].blocks[2].placeholdr = "oops";
    j.screens[0].blocks[1].labell = "x";
    const r = validateJourney(j);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warnings.join(" ")).toContain("screens[0].blocks[2].placeholdr");
    if (r.ok) expect(r.warnings.join(" ")).toContain("screens[0].blocks[1].labell");
  });
});

describe("duplicate ids", () => {
  it("flags duplicate screen and integration ids", () => {
    const j = structuredClone(localTransfer);
    j.screens.push({ ...structuredClone(j.screens[1]!) });
    j.integrations.push({ ...j.integrations[0]! });
    const codes = lintJourney(j).map((i) => i.code);
    expect(codes).toContain("duplicate_screen_id");
    expect(codes).toContain("duplicate_integration_id");
  });
});
