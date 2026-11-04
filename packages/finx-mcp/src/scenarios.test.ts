import { describe, expect, it } from "vitest";
import { bulkPayment, catalog, corporateApproval, corporatePayment, Journey, withdrawPayment, payrollRun, ownTransfer, manageBeneficiary, personalTransfer, internalTransfer } from "@finx/journey-schema";
import { lintAll } from "@finx/renderer-core";
import { mutationCheck, runScenarios } from "./scenarios";

const journeys = [corporatePayment, corporateApproval, withdrawPayment, bulkPayment, payrollRun].map((j) => Journey.parse(j));

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
  "withdraw-a-payment": {
    "no-error-path-3": "The company lookup never fails for the company customer: someone unknown is sent to 'not allowed', and a customer that is not a company is stopped one step earlier",
    "no-error-path-5": "The waiting list only loads for someone already confirmed as an initiator, and it never fails for them",
    "no-error-path-10": NEVER_FAILS, "no-error-path-12": NEVER_FAILS,
    "no-error-path-17": "The company lookup after withdrawing cannot fail: the same call has just succeeded for the same person",
  },
  "bulk-payment": {
    "no-error-path-3": "The company lookup never fails for the company customer: someone unknown is sent to 'not allowed', and a customer that is not a company is stopped one step earlier",
    "no-error-path-20": NEVER_FAILS, "no-error-path-24": NEVER_FAILS,
    "bank-roles": OTHER_LAYER("The journey's own role check already sends a person without the role to the denied screen"),
    "bank-companyLimit": OTHER_LAYER("The demo company's limit (8,000,000) is above everything the initiators can send (4,000,000)"),
  },
  "payroll-run": {
    "no-error-path-3": "The company lookup never fails for the company customer: someone unknown is sent to 'not allowed', and a customer that is not a company is stopped one step earlier",
    "no-error-path-22": NEVER_FAILS, "no-error-path-26": NEVER_FAILS,
    "bank-roles": OTHER_LAYER("The journey's own role check already sends a person without the role to the denied screen"),
    "bank-whitelist": "A payroll run pays employees on the payroll register, not the approved beneficiaries, so this rule does not apply to it (the employee checks have their own mutants)",
    "bank-companyLimit": OTHER_LAYER("The demo company's limit (8,000,000) is above everything the initiators can send (4,000,000)"),
    "bank-cutoff": "The brief sets no cut-off rule for payroll: a late run only gets the next working day's value date",
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

/**
 * Between my accounts is a retail journey: it has no second bank API, so the "second API" run of the company journeys does not apply.
 * Survivors of the mutation check are listed with the reason each cannot be reached from a screen.
 */
describe("own-transfer: Between my accounts", () => {
  const j = Journey.parse(ownTransfer);
  const OWN_ACCEPTED: Record<string, string> = {
    "no-error-path-28": "'Get a new rate' fails only if the rate service fails on the second request after answering the first; the same error path is proved on the first request (T-10)",
    "no-error-path-47": "The renewal after a rate ran out fails only if the rate service fails on the second request after answering the first; the same error path is proved on the first request (T-10)",
    "no-error-path-34": "Resending the code is a button of the code field that a scenario cannot press; the first send has the same error path and is proved (T-19)",
    "bank-sameAccount": OTHER_LAYER("The journey's own rule on the accounts screen already refuses the same account twice (T-6)"),
    "bank-canDebit": OTHER_LAYER("The journey's own rule on the accounts screen already refuses an account that cannot send (T-6)"),
    "bank-quoteReplay": "A rate can only be used once because the journey never offers the same rate twice; the bank's unit test replays one (QUOTE_USED, QUOTE_NOT_FOUND), a screen cannot",
  };

  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([21, 21, 10]);
    expect(r.ok).toBe(true);
  });

  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, OWN_ACCEPTED);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([33, 27, 6]);
    expect(m.ok).toBe(true);
  }, 120_000);

  it("the bank rules the journey leans on are each checked by a mutant", async () => {
    const m = await mutationCheck(j, OWN_ACCEPTED);
    const bank = m.results.filter((x) => x.kind === "bank");
    expect(bank.map((x) => x.id).sort()).toEqual(["bank-canDebit", "bank-funds", "bank-quoteExpiry", "bank-quoteReplay", "bank-sameAccount"]);
    expect(bank.filter((x) => x.killed).map((x) => x.id).sort()).toEqual(["bank-funds", "bank-quoteExpiry"]);
  }, 120_000);
});

/**
 * Add, edit or delete a payee is a retail journey: it has no second bank API, so the "second API" run of the company journeys does not apply.
 * Survivors of the mutation check are listed with the reason each cannot be reached from a screen.
 */
describe("manage-beneficiary: Add, edit or delete a payee", () => {
  const j = Journey.parse(manageBeneficiary);
  const BEN_ACCEPTED: Record<string, string> = {
    "no-error-path-69": "Resending the code is a button of the code field that a scenario cannot press; the first send has the same error path and is proved (T-30)",
  };

  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([35, 35, 10]);
    expect(r.ok).toBe(true);
  });

  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, BEN_ACCEPTED);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([47, 46, 1]);
    expect(m.ok).toBe(true);
  }, 240_000);

  it("the bank rules the journey leans on are each checked by a mutant, and each is caught", async () => {
    const m = await mutationCheck(j, BEN_ACCEPTED);
    const bank = m.results.filter((x) => x.kind === "bank");
    expect(bank.map((x) => x.id).sort()).toEqual(["bank-bic", "bank-clockOnDetails", "bank-countryMatch", "bank-ibanChecksum", "bank-nameCheck", "bank-nameKeepsClock", "bank-payeeDuplicate", "bank-payeeInUse", "bank-payeeLimit", "bank-routingChecksum", "bank-sepa", "bank-sortCode", "bank-verifiedOnMatch"]);
    expect(bank.filter((x) => !x.killed)).toEqual([]);
  }, 240_000);

  it("keeps the scenarios of a payee journey off the clock of the machine: the same walk at another time gives the same answers", async () => {
    const later = Journey.parse({ ...manageBeneficiary, scenarios: manageBeneficiary.scenarios!.map((t) => ({ ...t, now: "2027-03-15T22:05:00Z" })) });
    const r = await runScenarios(later);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id}: ${x.failures.join(" | ")}`)).toEqual([]);
  });
});

/**
 * Send money is a retail journey: it has no second bank API, so the "second API" run of the company journeys does not apply.
 * Survivors of the mutation check are listed with the reason each cannot be reached from a screen.
 */
describe("personal-transfer: Send money", () => {
  const j = Journey.parse(personalTransfer);
  const PT_ACCEPTED: Record<string, string> = {
    "no-error-path-107": "The address step asks for the price a second time, with the same answer the first time had; the same error path is proved on the first price (T-42, T-43)",
    "no-error-path-136": "The new price after a rate ran out is asked a second time; the same error path is proved on the first price (T-42, T-43)",
    "no-error-path-123": "Resending the code is a button of the code field that a scenario cannot press; the first send has the same error path and is proved (T-47)",
    "bank-quoteReplay": "A price can only be used once because the journey never offers the same price twice; the bank's unit test replays one (QUOTE_USED), a screen cannot",
    "bank-bankCode": OTHER_LAYER("The journey's own pattern on the field already refuses a transit number, IFSC or BSB in the wrong format (T-12)"),
    "bank-sepa": "The journey adds payees at the home bank or abroad only; the Europe region of the payee checks is not offered here (manage-beneficiary proves it)",
    "bank-countryMatch": "The journey adds payees at the home bank or abroad only; the Middle East region of the payee checks is not offered here (manage-beneficiary proves it)",
    "bank-sortCode": "The journey adds payees at the home bank or abroad only; the United Kingdom region of the payee checks is not offered here (manage-beneficiary proves it)",
  };

  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([49, 49, 13]);
    expect(r.ok).toBe(true);
  });

  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, PT_ACCEPTED);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([58, 50, 8]);
    expect(m.ok).toBe(true);
  }, 240_000);

  it("the bank rules the journey leans on are each checked by a mutant, and the ones a screen can reach are caught", async () => {
    const m = await mutationCheck(j, PT_ACCEPTED);
    const bank = m.results.filter((x) => x.kind === "bank");
    expect(bank.map((x) => x.id).sort()).toEqual([
      "bank-addressRule", "bank-bankCode", "bank-bic", "bank-canDebit", "bank-coolingOff", "bank-countryMatch", "bank-dailyLimit", "bank-funds", "bank-ibanChecksum", "bank-payeeDuplicate", "bank-payeeLimit",
      "bank-purposeRule", "bank-quoteExpiry", "bank-quoteReplay", "bank-railLimit", "bank-routingChecksum", "bank-sanctions", "bank-sepa", "bank-sortCode",
    ]);
    expect(bank.filter((x) => !x.killed).map((x) => x.id).sort()).toEqual(["bank-bankCode", "bank-countryMatch", "bank-quoteReplay", "bank-sepa", "bank-sortCode"]);
  }, 240_000);

  it("keeps the scenarios off the clock of the machine: the same walk at another time gives the same answers", async () => {
    const later = Journey.parse({ ...personalTransfer, scenarios: personalTransfer.scenarios!.map((t) => ({ ...t, now: "2027-03-15T22:05:00Z" })).filter((t) => !["T-21", "T-27", "T-49"].includes(t.id)) });
    const r = await runScenarios(later);
    // T-21 (the date the allowance ends), T-27 and T-49 (the business days offered) name dates on purpose; every other one follows the clock it is given
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id}: ${x.failures.join(" | ")}`)).toEqual([]);
  });
});

/**
 * To a BankWorkx customer is Send money opened at its first step (the engine cannot open one journey from another with a value), so the
 * rules and their mutants are those of Send money; here the alias is proved to open where it says and to keep the rules of its type.
 */
describe("internal-transfer: To a BankWorkx customer (alias of Send money)", () => {
  const j = Journey.parse(internalTransfer);
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([7, 7, 2]);
    expect(r.ok).toBe(true);
  });

  it("is the same flow as Send money: the same bank calls, and no screen of its own other than the empty state of the type", () => {
    expect(j.integrations).toEqual(personalTransfer.integrations);
    expect(j.screens.map((s) => s.id)).toEqual(personalTransfer.screens.map((s) => s.id));
    expect(j.slug).not.toBe(personalTransfer.slug);
  });
});

describe("scenario setup can keep what the bank answered", () => {
  it.each(["reference", "bank-b"] as const)("a later step reads the id of a payment made in setup, on the %s API", async (provider) => {
    const j = structuredClone(journeys[1]!) as any;
    j.acceptance = [{ id: "AC-1", text: "x" }];
    j.scenarios = [{
      id: "T-1", name: "reads a saved id", covers: ["AC-1"], persona: "acme", now: "2026-11-03T10:00:00Z",
      setup: [
        { adapter: "bank.otp.send" }, { adapter: "bank.otp.verify", input: { code: "482100" } },
        { adapter: "corp.payments.initiate", input: { userId: "sara", fromAccountId: "acme_ops", beneficiaryId: "sup_textile", amount: 1000, reference: "S" }, saveAs: "p" },
        { adapter: "corp.payments.withdraw", input: { userId: "sara", paymentId: "{{setup.p.id}}" } },
      ],
      steps: [{ expectBank: { adapter: "corp.payments.get", input: { paymentId: "{{setup.p.id}}" }, path: "status", equals: "rejected" } }],
    }];
    const r = await runScenarios(Journey.parse(j), { provider });
    expect(r.results.map((x) => x.failures)).toEqual([[]]);
  });
});
