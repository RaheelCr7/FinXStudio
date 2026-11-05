import { describe, it, expect } from "vitest";
import { ageOf, composeJourneyBrief, EMPTY_BRIEF, isStale, languageNames, outcomeOf, TEMPLATES } from "./ai-brief";

describe("the guided brief", () => {
  it("needs a goal and leaves empty parts out", () => {
    expect(composeJourneyBrief(EMPTY_BRIEF)).toBe("");
    expect(composeJourneyBrief({ ...EMPTY_BRIEF, goal: "Pay a bill" })).toBe("Pay a bill. Prove it in the sandbox: the happy path, a blocked input, a failure path, and the whole flow in each language.");
  });
  it("puts every part in the order the skill reads, as sentences", () => {
    const b = composeJourneyBrief({ goal: " sign in with username and password ", steps: "username, password, dashboard.", rules: "lock after five tries!", fails: "locked and expired get own screens", languages: "English and Arabic" });
    expect(b).toBe("Sign in with username and password. Steps: Username, password, dashboard. Rules: Lock after five tries! If it fails: Locked and expired get own screens. Languages: English and Arabic. Prove it in the sandbox: the happy path, a blocked input, a failure path, and the whole flow in each language.");
  });
  it("has templates that each compose to a full brief without languages", () => {
    for (const t of TEMPLATES) {
      const b = composeJourneyBrief({ ...t.brief, languages: "" });
      expect(b, t.id).toMatch(/Steps: .* Rules: .* If it fails: /);
      expect(b, t.id).not.toContain("Languages:");
    }
  });
  it("names languages from codes", () => {
    expect(languageNames(["en"])).toBe("English");
    expect(languageNames(["ar", "en"])).toBe("Arabic and English");
    expect(languageNames(["en", "ur", "xx"])).toBe("English, Urdu and xx");
    expect(languageNames(undefined)).toBe("");
  });
});

describe("run cards", () => {
  const now = Date.parse("2026-11-05T12:00:00Z");
  it("says how old a run is in words", () => {
    expect(ageOf("2026-11-05T11:59:30Z", now)).toBe("just now");
    expect(ageOf("2026-11-05T11:48:00Z", now)).toBe("12 min ago");
    expect(ageOf("2026-11-05T09:00:00Z", now)).toBe("3 h ago");
    expect(ageOf("2026-11-04T11:00:00Z", now)).toBe("1 day ago");
    expect(ageOf("2026-11-03T11:00:00Z", now)).toBe("2 days ago");
    expect(ageOf("2026-09-01T11:00:00Z", now)).toBe("2026-09-01");
    expect(ageOf("not a date", now)).toBe("just now");
  });
  it("marks a running run with no news for an hour as stale", () => {
    expect(isStale("running", "2026-11-05T11:30:00Z", now)).toBe(false);
    expect(isStale("running", "2026-11-05T10:30:00Z", now)).toBe(true);
    expect(isStale("done", "2026-11-05T10:30:00Z", now)).toBe(false);
  });
  it("takes the first sentence of a summary for the card", () => {
    expect(outcomeOf("Journey: Payroll run (payroll-run), draft, Meezan Digital. Criteria: 13 proved, 0 not. Scenarios: 28/28")).toBe("Journey: Payroll run (payroll-run), draft, Meezan Digital.");
    expect(outcomeOf("Undone: removed checkpoint-demo-journey\nmore")).toBe("Undone: removed checkpoint-demo-journey");
    expect(outcomeOf(undefined)).toBe("");
    expect(outcomeOf("x".repeat(200))).toBe("x".repeat(159) + "…");
  });
});
