import { describe, expect, it } from "vitest";
import { Requirement, assertApproved, duplicateIds, nextId, readiness, uncovered } from "./requirement";

const base = {
  id: "corporate-payment", title: "Corporate payment", intent: "A company initiator sends a payment that an approver must release.",
  status: "draft" as const, actors: [{ id: "A-1", name: "Initiator" }, { id: "A-2", name: "Approver" }], steps: [{ id: "S-1", text: "Initiator enters the payment" }],
  rules: [{ id: "R-1", kind: "limit" as const, text: "Daily limit 1,000,000" }], criteria: [{ id: "AC-1", text: "A payment above the limit is refused", tests: [] }],
  version: 1, createdAt: "2026-11-03T10:00:00Z", updatedAt: "2026-11-03T10:00:00Z",
};

describe("requirement", () => {
  it("accepts a good one and fills the lists it was not given", () => {
    const r = Requirement.parse(base);
    expect(r.fields).toEqual([]); expect(r.questions).toEqual([]); expect(r.compliance).toEqual([]);
  });
  it("refuses empty text, a bad id and a bad prefix", () => {
    expect(Requirement.safeParse({ ...base, title: "  " }).success).toBe(false);
    expect(Requirement.safeParse({ ...base, id: "Corporate Payment" }).success).toBe(false);
    expect(Requirement.safeParse({ ...base, criteria: [{ id: "C-1", text: "x" }] }).success).toBe(false);
    expect(Requirement.safeParse({ ...base, rules: [{ id: "R-1", kind: "nonsense", text: "x" }] }).success).toBe(false);
  });
  it("says what blocks approval, in words", () => {
    expect(readiness(Requirement.parse(base))).toEqual([]);
    const empty = Requirement.parse({ ...base, intent: "Short", actors: [], steps: [], criteria: [] });
    expect(readiness(empty)).toHaveLength(4);
    const asked = Requirement.parse({ ...base, questions: [{ id: "Q-1", text: "Who approves above 1M?", by: "Claude", at: "2026-11-03T10:00:00Z" }] });
    expect(readiness(asked)).toEqual(["Answer the open question: Q-1."]);
    const answered = Requirement.parse({ ...base, questions: [{ id: "Q-1", text: "Who approves above 1M?", by: "Claude", at: "x", answer: "The CFO", answeredBy: "Sam", answeredAt: "y" }] });
    expect(readiness(answered)).toEqual([]);
  });
  it("finds duplicate ids, free ids and criteria without a test", () => {
    expect(duplicateIds({ steps: [{ id: "S-1", text: "a" }, { id: "S-1", text: "b" }] })).toEqual(["S-1 is used twice in steps"]);
    expect(nextId("AC", [{ id: "AC-1" }, { id: "AC-4" }])).toBe("AC-5");
    expect(nextId("A", [])).toBe("A-1");
    expect(uncovered(Requirement.parse({ ...base, criteria: [{ id: "AC-1", text: "a", tests: ["t1"] }, { id: "AC-2", text: "b" }] }))).toEqual(["AC-2"]);
  });
  it("lets only an approved requirement be built from", () => {
    expect(() => assertApproved({ id: "x", status: "draft" })).toThrow(/must be approved/);
    expect(() => assertApproved({ id: "x", status: "questions" })).toThrow(/questions/);
    expect(() => assertApproved({ id: "x", status: "approved" })).not.toThrow();
  });
});
