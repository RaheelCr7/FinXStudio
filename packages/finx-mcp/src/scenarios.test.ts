import { describe, expect, it } from "vitest";
import { catalog, corporateApproval, corporatePayment, Journey } from "@finx/journey-schema";
import { lintAll } from "@finx/renderer-core";
import { mutationCheck, runScenarios } from "./scenarios";

const journeys = [corporatePayment, corporateApproval].map((j) => Journey.parse(j));

/**
 * Mutants the scenarios do not catch, each with the reason. These are not gaps in the tests: another layer already stops the
 * case, or no screen (and no sandbox answer) can reach it. A new survivor that is not listed here fails the check.
 */
const NEVER_FAILS = "The sandbox never fails here: it answers the people list, the company and the code sender, so no scenario can reach this error path";
const OTHER_LAYER = (what: string) => `${what}, so a screen never reaches the bank's own check (the bank's unit tests cover it)`;
const ACCEPTED: Record<string, Record<string, string>> = {
  "corporate-payment": {
    "no-error-path-3": NEVER_FAILS, "no-error-path-8": NEVER_FAILS, "no-error-path-10": NEVER_FAILS,
    "bank-roles": OTHER_LAYER("The journey's own role check already sends a person without the role to the denied screen"),
    "bank-userLimit": OTHER_LAYER("The journey stops an amount above the person's remaining limit before it is sent"),
    "bank-companyLimit": OTHER_LAYER("The demo company's limit (8,000,000) is above the sum of every initiator's daily limit (4,000,000), so no screen can reach it"),
  },
  "corporate-approval": {
    "no-error-path-3": NEVER_FAILS, "no-error-path-5": NEVER_FAILS, "no-error-path-7": NEVER_FAILS, "no-error-path-11": NEVER_FAILS, "no-error-path-14": NEVER_FAILS,
    "no-error-path-16": "A refusal after a right code (a payment someone else already released) cannot be arranged from one session",
    "no-error-path-20": "A refusal when rejecting (the payment already closed) cannot be arranged from one session",
    "bank-roles": OTHER_LAYER("The journey's own role check already sends a person without the role to the denied screen"),
    "bank-companyLimit": OTHER_LAYER("The demo company's limit (8,000,000) is above everything the initiators can send (4,000,000)"),
    "bank-fourEyes": OTHER_LAYER("The pending list never offers a person their own payment"),
  },
};

describe("the tests that travel with a journey", () => {
  for (const j of journeys) {
    it(`${j.slug}: every scenario passes and every acceptance criterion is proved`, async () => {
      const r = await runScenarios(j);
      expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
      expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
      expect(r.ok).toBe(true);
    });

    it(`${j.slug}: is lint clean, with every criterion covered`, () => { expect(lintAll(j)).toEqual([]); });

    it(`${j.slug}: the scenarios also pass on the second bank API`, async () => {
      const r = await runScenarios(j, { provider: "bank-b" });
      expect(r.results.filter((x) => !x.ok).map((x) => `${x.id}: ${x.failures.join(" | ")}`)).toEqual([]);
    });

    it(`${j.slug}: the tests notice when the journey or the bank's rules are broken (mutation check)`, async () => {
      const m = await mutationCheck(j, ACCEPTED[j.slug]);
      expect(m.total).toBeGreaterThan(10);
      expect(m.killed + m.accepted.length).toBe(m.total);
      expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
      expect(m.ok).toBe(true);
    }, 120_000);
  }

  it("every catalog journey that declares acceptance criteria keeps its scenarios green", async () => {
    for (const c of catalog.filter((x) => x.journey.acceptance?.length)) {
      const r = await runScenarios(Journey.parse(c.journey));
      expect(r.ok, c.id).toBe(true);
    }
  });

  it("reports an uncovered criterion, a failing scenario and a broken scenario", async () => {
    const j: any = structuredClone(journeys[0]);
    j.acceptance.push({ id: "AC-99", text: "Something nobody tests" });
    j.scenarios = [{ ...j.scenarios[0], steps: [...j.scenarios[0].steps, { expectText: "this text is not on the screen" }] }, { id: "T-50", name: "Unknown customer", covers: ["AC-2"], persona: "nobody", steps: [{ expectScreen: "who" }] }];
    const r = await runScenarios(Journey.parse(j));
    expect(r.ok).toBe(false);
    expect(r.results.map((x) => [x.id, x.ok])).toEqual([["T-1", false], ["T-50", false]]);
    expect(r.results[1]!.failures[0]).toMatch(/Unknown persona "nobody"/);
    expect(r.coverage.find((c) => c.id === "AC-1")!.status).toBe("failing");
    expect(r.coverage.find((c) => c.id === "AC-99")!.status).toBe("uncovered");
    expect(lintAll(Journey.parse(j)).map((i) => i.code)).toContain("criterion_uncovered");
  });

  it("a mutation check names what survived when the tests are too weak", async () => {
    const j: any = structuredClone(journeys[0]);
    j.scenarios = [j.scenarios[3]]; // a single happy path
    j.acceptance = [{ id: "AC-4", text: "A payment above the threshold needs two approvers" }];
    const m = await mutationCheck(Journey.parse(j));
    expect(m.ok).toBe(false);
    expect(m.survived.length).toBeGreaterThan(0);
    expect(m.survived.map((s) => s.id)).toContain("bank-whitelist"); // nothing in that one test needs the approved list
  }, 120_000);
});
