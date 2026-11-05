import { describe, expect, it } from "vitest";
import { bankworkxJourneys, chainTargets, chainWarnings, bulkPayment, catalog, corporateApproval, corporatePayment, Journey, withdrawPayment, payrollRun, ownTransfer, manageBeneficiary, personalTransfer, internalTransfer, internationalTransfer, payBillBankworkx, mobileTopup, schedulePayment, cancelStandingOrder, supplierPayment, approvePayments, signIn, forgotUsername, resetPassword, forgotPassword, unlockAccount } from "@finx/journey-schema";
import { lintAll } from "@finx/renderer-core";
import { mutationCheck, runScenarios } from "./scenarios";
import { simulate } from "./simulate";

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
    expect([r.passed, r.total, r.coverage.length]).toEqual([54, 54, 14]);
    expect(r.ok).toBe(true);
  });

  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, PT_ACCEPTED);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([62, 54, 8]);
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
 * To a BankWorkx customer is a thin entry: it opens Send money (personal-transfer) with the launch value launch.type, so it carries none of
 * its screens or bank calls. Its scenarios follow the chain into Send money, so the rules are proved there, by the journey they belong to.
 */
describe("internal-transfer: To a BankWorkx customer (opens Send money)", () => {
  const j = Journey.parse(internalTransfer);
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([7, 7, 2]);
    expect(r.ok).toBe(true);
  });

  it("is a thin entry: no bank calls and two screens of its own, and it opens Send money with the type", async () => {
    expect(j.integrations).toEqual([]);
    expect(j.screens.map((s) => s.id)).toEqual(["start", "off"]);
    expect(j.slug).not.toBe(personalTransfer.slug);
    expect(chainTargets(j)).toEqual(["personal-transfer"]);
    expect(chainWarnings(j, bankworkxJourneys.map((x) => x.slug))).toEqual([]);
    const r = await simulate({ journey: j, persona: "alexpayees", lang: "en", steps: [] });
    expect(r.opened).toEqual([{ journey: "personal-transfer", launch: { "launch.type": "internal" }, followed: true }]);
    expect(r.endedIn).toBe("personal-transfer");
  });
});

/**
 * Abroad is a thin entry: it opens Send money (personal-transfer) with the launch value launch.type "international". Its scenarios follow
 * the chain into Send money, so the bank rules a payment abroad meets are still caught (mutants of the bank), and the entry's own few
 * parts are mutated here.
 */
describe("international-transfer: Abroad (opens Send money)", () => {
  const j = Journey.parse(internationalTransfer);
  // the bank rules a payment abroad cannot reach (the entry's own parts are all caught)
  const IT_ACCEPTED: Record<string, string> = {
    "bank-quoteReplay": "A price can only be used once because the journey never offers the same price twice; the bank's unit test replays one (QUOTE_USED), a screen cannot",
    "bank-railLimit": "The international speeds (Standard, Priority) have no limit in the sandbox, so no payment abroad is over the limit of its speed (the bank's unit test sets one for the other types)",
    "bank-bankCode": OTHER_LAYER("The journey's own pattern on the field already refuses a transit number, IFSC or BSB in the wrong format (T-3)"),
    "bank-routingChecksum": "The routing number is the identifier of a payee at another bank, a type this journey never offers (Send money proves it)",
    "bank-sepa": "The journey adds payees abroad by country, IBAN or account and SWIFT/BIC; the Europe region of the payee checks is not offered here (manage-beneficiary proves it)",
    "bank-countryMatch": "The journey adds payees abroad by country, IBAN or account and SWIFT/BIC; the Middle East region of the payee checks is not offered here (manage-beneficiary proves it)",
    "bank-sortCode": "The journey adds payees abroad by country, IBAN or account and SWIFT/BIC; the United Kingdom region of the payee checks is not offered here (manage-beneficiary proves it)",
  };

  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([33, 33, 11]);
    expect(r.ok).toBe(true);
  });

  it("is a thin entry: no bank calls and two screens of its own, and it opens Send money with the type", () => {
    expect(j.integrations).toEqual([]);
    expect(j.screens.map((s) => s.id)).toEqual(["start", "off"]);
    expect(j.slug).not.toBe(personalTransfer.slug);
    expect(j.apps).toEqual(["bankworkx"]);
    expect(catalog.find((c) => c.id === "international-transfer")?.madeFor).toBe("bankworkx");
  });

  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, IT_ACCEPTED);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([22, 15, 7]);
    expect(m.ok).toBe(true);
  }, 240_000);

  it("the bank rules the journey leans on are each checked by a mutant, and the ones a payment abroad can reach are caught", async () => {
    const m = await mutationCheck(j, IT_ACCEPTED);
    const bank = m.results.filter((x) => x.kind === "bank");
    expect(bank.filter((x) => !x.killed).map((x) => x.id).sort()).toEqual(["bank-bankCode", "bank-countryMatch", "bank-quoteReplay", "bank-railLimit", "bank-routingChecksum", "bank-sepa", "bank-sortCode"]);
    for (const id of ["bank-addressRule", "bank-purposeRule", "bank-quoteExpiry", "bank-sanctions", "bank-coolingOff", "bank-funds", "bank-dailyLimit", "bank-canDebit", "bank-bic", "bank-ibanChecksum", "bank-payeeLimit", "bank-payeeDuplicate"]) {
      expect(bank.find((x) => x.id === id)?.killed, id).toBe(true);
    }
  }, 240_000);
});

/**
 * Pay a bill is a retail journey: it has no second bank API, so the "second API" run of the company journeys does not apply.
 * Survivors of the mutation check are listed with the reason each cannot be reached from a screen.
 */
describe("pay-bill: Pay a bill", () => {
  const j = Journey.parse(payBillBankworkx);
  const PB_ACCEPTED: Record<string, string> = {
    "no-error-path-67": "Resending the code is a button of the code field that a scenario cannot press; the first send has the same error path and is proved (T-40)",
    "no-error-path-76": "The new amount after the amount due changed at the bank is asked a second time; the same error path is proved on the first price (T-39)",
    "no-rule-route-3": "The amount due changes between the review and the payment only if the bank changes it a second time; the sandbox changes it once, at the review (T-18, T-19), so no screen reaches the screen for it (the bank's unit test proves BILL_CHANGED)",
    "bank-billChanged": "The sandbox changes the amount due once, when the price is asked, so the amount the person confirms is always the one the bank has at payment (the bank's unit test pays an old amount and is refused)",
    "bank-billMinimum": OTHER_LAYER("The journey's own minimum on the amount field already refuses an amount below the minimum (T-8, T-9)"),
    "bank-billMaximum": OTHER_LAYER("The journey's own maximum on the amount field already refuses an amount above the amount due or above 1.8 times it for a card (T-8, T-10)"),
  };

  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([40, 40, 12]);
    expect(r.ok).toBe(true);
  });

  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, PB_ACCEPTED);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([37, 31, 6]);
    expect(m.ok).toBe(true);
  }, 240_000);

  it("the bank rules the journey leans on are each checked by a mutant, and the ones a screen can reach are caught", async () => {
    const m = await mutationCheck(j, PB_ACCEPTED);
    const bank = m.results.filter((x) => x.kind === "bank");
    expect(bank.map((x) => x.id).sort()).toEqual(["bank-billChanged", "bank-billCurrency", "bank-billMaximum", "bank-billMemory", "bank-billMinimum", "bank-canDebit", "bank-dailyLimit", "bank-funds"]);
    expect(bank.filter((x) => !x.killed).map((x) => x.id).sort()).toEqual(["bank-billChanged", "bank-billMaximum", "bank-billMinimum"]);
  }, 240_000);

  it("sits beside the Meezan journey \"pay-a-bill\", which keeps its slug, its look and its billers", () => {
    expect(catalog.filter((c) => c.id === "pay-a-bill" || c.id === "pay-bill").map((c) => [c.id, c.madeFor])).toEqual([["pay-a-bill", "meezan"], ["pay-bill", "bankworkx"]]);
    expect(payBillBankworkx.apps).toEqual(["bankworkx"]);
  });
});

/**
 * Mobile top-up is a retail journey: it has no second bank API, so the "second API" run of the company journeys does not apply.
 * Survivors of the mutation check are listed with the reason each cannot be reached from a screen.
 */
describe("mobile-topup: Mobile top-up", () => {
  const j = Journey.parse(mobileTopup);
  const MT_ACCEPTED: Record<string, string> = {
    "no-error-path-54": "Resending the code is a button of the code field that a scenario cannot press; the first send has the same error path and is proved (T-33)",
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
    const m = await mutationCheck(j, MT_ACCEPTED);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([30, 29, 1]);
    expect(m.ok).toBe(true);
  }, 240_000);

  it("every bank rule the journey leans on is checked by a mutant, and every one of them is caught by a screen", async () => {
    const m = await mutationCheck(j, MT_ACCEPTED);
    const bank = m.results.filter((x) => x.kind === "bank");
    expect(bank.map((x) => x.id).sort()).toEqual(["bank-canDebit", "bank-dailyLimit", "bank-funds", "bank-topupAmount", "bank-topupLimit", "bank-topupNumber"]);
    expect(bank.filter((x) => !x.killed)).toEqual([]);
  }, 240_000);

  it("is for BankWorkx only: the Meezan app and its carriers are not touched", () => {
    expect(catalog.filter((c) => c.id === "mobile-topup").map((c) => [c.madeFor, c.category])).toEqual([["bankworkx", "Payments"]]);
    expect(mobileTopup.apps).toEqual(["bankworkx"]);
    expect(mobileTopup.channels).toEqual(["web", "mobile"]);
  });
});

/**
 * Schedule a payment is a retail journey: it has no second bank API, so the "second API" run of the company journeys does not apply.
 * Survivors of the mutation check are listed with the reason each cannot be reached from a screen.
 */
describe("schedule-payment: Schedule a payment", () => {
  const j = Journey.parse(schedulePayment);
  const SP_ACCEPTED: Record<string, string> = {
    "no-error-path-88": "Resending the code is a button of the code field that a scenario cannot press; the first send has the same error path and is proved (T-46)",
  };

  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([52, 52, 11]);
    expect(r.ok).toBe(true);
  });

  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, SP_ACCEPTED);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([42, 41, 1]);
    expect(m.ok).toBe(true);
  }, 240_000);

  it("every bank rule the journey leans on is checked by a mutant, and every one of them is caught by a screen", async () => {
    const m = await mutationCheck(j, SP_ACCEPTED);
    const bank = m.results.filter((x) => x.kind === "bank");
    expect(bank.map((x) => x.id).sort()).toEqual(["bank-canDebit", "bank-coolingOff", "bank-dailyLimit", "bank-sameAccount", "bank-scheduleCutoff", "bank-scheduleDates", "bank-scheduleEnd", "bank-scheduleLimit", "bank-scheduleRunning"]);
    expect(bank.filter((x) => !x.killed)).toEqual([]);
  }, 240_000);

  it("is for BankWorkx only, for the web and the phone, and a code is asked before anything is saved", () => {
    expect(catalog.filter((c) => c.id === "schedule-payment").map((c) => [c.madeFor, c.category])).toEqual([["bankworkx", "Payments"]]);
    expect([schedulePayment.apps, schedulePayment.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
    const otp = schedulePayment.screens.find((s) => s.id === "otp")!;
    const calls = otp.blocks.flatMap((b: any) => (b.type === "button" ? b.actions : [])).filter((a: any) => a.type === "callApi").map((a: any) => a.integration);
    expect(calls).toEqual(["otpVerify", "scheduleCreate", "otpVerify", "scheduleUpdate"]);
  });
});

/**
 * Cancel a standing order is the cancel mode of Schedule a payment, as a journey of its own. It asks for no code, so the "code before money" rule
 * of lint does not apply to it; the bank calls it makes only reduce what leaves the account.
 */
describe("cancel-standing-order: Cancel a standing order", () => {
  const j = Journey.parse(cancelStandingOrder);

  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([20, 20, 6]);
    expect(r.ok).toBe(true);
  });

  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([12, 12, 0]);
    const bank = m.results.filter((x) => x.kind === "bank");
    expect(bank.map((x) => x.id).sort()).toEqual(["bank-scheduleCutoff", "bank-scheduleRunning"]);
    expect(bank.filter((x) => !x.killed)).toEqual([]);
    expect(m.ok).toBe(true);
  }, 240_000);

  it("asks for no code and calls nothing that moves money", () => {
    expect(j.integrations.map((i) => i.adapter)).toEqual(["bank.schedules.list", "bank.schedules.get", "bank.schedules.cancel"]);
    expect(j.screens.some((s) => s.blocks.some((b) => b.type === "otp" || b.type === "consent"))).toBe(false);
    expect(catalog.filter((c) => c.id === "cancel-standing-order").map((c) => [c.madeFor, c.category])).toEqual([["bankworkx", "Payments"]]);
    expect([cancelStandingOrder.apps, cancelStandingOrder.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
  });
});

/**
 * Pay a supplier and Approve payments are the two Business journeys of the combined demo. They run as Alex Morgan, signed in once and switched into a
 * company (the scenario's `context`), against the sandbox of that company; the company journeys' "second bank API" run does not apply, because a
 * customer with several places is always served by the reference bank. Survivors of the mutation check are listed with the reason each cannot be
 * reached from a screen.
 */
describe("supplier-payment: Pay a supplier", () => {
  const j = Journey.parse(supplierPayment);
  const SUP_ACCEPTED: Record<string, string> = {
    "no-error-path-55": "Resending the code is a button of the code field that a scenario cannot press; the first send has the same error path and is proved (T-25)",
    "bank-roles": OTHER_LAYER("The context's permissions are checked before the company's own roles, and only a Maker holds the permission to price or start a payment"),
    "bank-whitelist": OTHER_LAYER("The price (quote) already refuses a supplier that is not on the company's list before the payment is started, and the bank's unit tests start one directly"),
    "bank-userLimit": OTHER_LAYER("The price (quote) already refuses an amount over the person's day before the payment is started (T-6, T-7)"),
    "bank-companyLimit": "The company's limit (1,000,000.00) is above everything a Maker can send in a day (250,000.00 each), and the company's count only moves when a payment is released, which this journey never does",
  };

  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([33, 33, 9]);
    expect(r.ok).toBe(true);
  });

  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, SUP_ACCEPTED);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([35, 30, 5]);
    expect(m.ok).toBe(true);
  }, 240_000);

  it("the permission and approval rules of the bank are each checked by a mutant, and the permissions one is caught by a screen", async () => {
    const m = await mutationCheck(j, SUP_ACCEPTED);
    const bank = m.results.filter((x) => x.kind === "bank");
    expect(bank.map((x) => x.id).sort()).toEqual(["bank-companyLimit", "bank-cutoff", "bank-dualApproval", "bank-permissions", "bank-roles", "bank-userLimit", "bank-whitelist"]);
    expect(bank.filter((x) => x.killed).map((x) => x.id).sort()).toEqual(["bank-cutoff", "bank-dualApproval", "bank-permissions"]);
  }, 240_000);

  it("is for BankWorkx only, for the web and the phone; it asks for the confirmation and for the code before it starts the payment", () => {
    expect(catalog.filter((c) => c.id === "supplier-payment").map((c) => [c.madeFor, c.category])).toEqual([["bankworkx", "Payments"]]);
    expect([supplierPayment.apps, supplierPayment.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(bankworkxJourneys.map((x) => x.slug)).toContain("supplier-payment");
    const otp = supplierPayment.screens.find((s) => s.id === "otp")!;
    expect(otp.blocks.flatMap((b: any) => (b.type === "button" ? b.actions : [])).filter((a: any) => a.type === "callApi").map((a: any) => a.integration)).toEqual(["otpVerify", "create"]);
    expect(supplierPayment.screens.some((s) => s.blocks.some((b: any) => b.type === "consent" && b.validation?.mustBeTrue))).toBe(true);
  });
});

describe("approve-payments: Approve payments", () => {
  const j = Journey.parse(approvePayments);
  const SAME_ADAPTER = (what: string) => `${what} reads the same list as the inbox, which is read first, so a scenario (which makes a whole adapter fail) cannot make only this call fail; the inbox's own error path is proved (T-37)`;
  const AP_ACCEPTED: Record<string, string> = {
    "no-error-path-15": SAME_ADAPTER("The list of what can be approved together"),
    "no-error-path-21": SAME_ADAPTER("The history"),
    "no-error-path-71": SAME_ADAPTER("The list of what can be approved together on Approve several"),
    "no-error-path-49": "Resending the code is a button of the code field that a scenario cannot press; the first send has the same error path and is proved (T-19)",
    "no-error-path-80": "Resending the code is a button of the code field that a scenario cannot press; the first send has the same error path and is proved (T-32)",
    "no-rule-start-0": "The journey's authorisation sends the same person to the same no-access card once their roles are read, so the permission rule on the first screen is a second line that shows the card sooner (T-11)",
    "no-authorisation": "The permission rule on the first screen sends the same person to the same no-access card, and the screen is only reached for the permissions the apps provide; a customer with no session is stopped by the bank (T-11)",
    "bank-roles": OTHER_LAYER("The context's permissions are checked before the company's own roles, and only an Approver holds the permission to approve"),
    "bank-companyLimit": "The company's limit (1,000,000.00) is above everything the account holds (310,000.00) and the waiting payments, so no screen can reach it; the bank's unit tests cover it",
    "bank-dualApproval": "How many approvers a payment needs is fixed when it is started, and every waiting payment was started in the seed; the Maker's journey proves the rule (supplier-payment T-3)",
  };

  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([49, 49, 12]);
    expect(r.ok).toBe(true);
  });

  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, AP_ACCEPTED);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([55, 45, 10]);
    expect(m.ok).toBe(true);
  }, 240_000);

  it("the approval rules of the bank are each checked by a mutant and caught by a screen: the order, the cut-off, the name tick, four eyes, passing on, the permissions", async () => {
    const m = await mutationCheck(j, AP_ACCEPTED);
    const bank = m.results.filter((x) => x.kind === "bank");
    expect(bank.map((x) => x.id).sort()).toEqual(["bank-approvalCutoff", "bank-companyLimit", "bank-delegation", "bank-dualApproval", "bank-fourEyes", "bank-nameAck", "bank-permissions", "bank-roles", "bank-sequence"]);
    expect(bank.filter((x) => x.killed).map((x) => x.id).sort()).toEqual(["bank-approvalCutoff", "bank-delegation", "bank-fourEyes", "bank-nameAck", "bank-permissions", "bank-sequence"]);
  }, 240_000);

  it("is for BankWorkx only, for the web and the phone, only for the role that approves; a code is asked before an approval and the tick is required", () => {
    expect(catalog.filter((c) => c.id === "approve-payments").map((c) => [c.madeFor, c.category])).toEqual([["bankworkx", "Payments"]]);
    expect([approvePayments.apps, approvePayments.channels, approvePayments.authorisation?.role]).toEqual([["bankworkx"], ["web", "mobile"], "approver"]);
    expect(bankworkxJourneys.map((x) => x.slug)).toContain("approve-payments");
    for (const id of ["otp", "otpMany"]) {
      const calls = approvePayments.screens.find((s) => s.id === id)!.blocks.flatMap((b: any) => (b.type === "button" ? b.actions : [])).filter((a: any) => a.type === "callApi").map((a: any) => a.integration);
      expect(calls[0]).toBe("otpVerify");
    }
    expect(approvePayments.screens.some((s) => s.blocks.some((b: any) => b.type === "consent" && b.validation?.mustBeTrue))).toBe(true);
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

describe("scenario conditions: empty lists", () => {
  it("a list that comes back empty is an empty list for the journey", async () => {
    const j = structuredClone(journeys[0]!) as any;
    j.acceptance = [{ id: "AC-1", text: "x" }];
    j.scenarios = [{ id: "T-1", name: "nobody to choose", covers: ["AC-1"], persona: "acme", conditions: { empty: ["corp.users.list"] }, steps: [{ expectScreen: "who" }, { expectNoText: "Sara Qureshi" }] }];
    const r = await runScenarios(Journey.parse(j));
    expect(r.results.map((x) => x.failures)).toEqual([[]]);
  });
});

/**
 * The access journeys (Signing in and security): Sign in, Forgot username, Reset password and the two thin entries Forgot password and Unlock account.
 * They run before anyone is signed in (persona "signed-out"), against the credentials of the sandbox bank (usernames, hashed passwords, devices, locks,
 * one-time codes, recovery tokens); there is no second bank API. A journey that only links to another one (the buttons Sign in and Reset password, the
 * entries) meets the bank rules of the journeys it opens, and those are proved where they live: each such survivor says where.
 */
const LINKED = (where: string) => `A rule of ${where}, which this journey only links to or opens; the mutation check of ${where} catches it with its own scenarios`;
const SIGN_IN_RULES = ["bank-credentials", "bank-signInLock", "bank-usernameHiding", "bank-newDeviceCode", "bank-expiredPassword", "bank-codeLock", "bank-deviceLimit", "bank-pinRules"];
const RESET_RULES = ["bank-resetClearsLock", "bank-passwordLength", "bank-passwordUsername", "bank-passwordCommon", "bank-passwordBreach", "bank-passwordReuse", "bank-codeExpiry", "bank-resendLimit", "bank-recoveryLock", "bank-tokenExpiry", "bank-resetNeedsCode"];
const linked = (ids: string[], where: string) => Object.fromEntries(ids.map((id) => [id, LINKED(where)]));

describe("sign-in: Sign in", () => {
  const j = Journey.parse(signIn);
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([64, 64, 16]);
    expect(r.ok).toBe(true);
  });

  it("the tests notice when the journey or the bank's rules are broken (mutation check): every mutant is killed", async () => {
    const m = await mutationCheck(j, {});
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([60, 60, 0]);
    expect(m.ok).toBe(true);
  }, 240_000);

  it("every sign-in rule of the bank is checked by a mutant and caught by a screen", async () => {
    const m = await mutationCheck(j, {});
    const bank = m.results.filter((x) => x.kind === "bank").map((x) => x.id).sort();
    expect(bank).toEqual(["bank-codeExpiry", "bank-codeLock", "bank-credentials", "bank-deviceLimit", "bank-expiredPassword", "bank-newDeviceCode", "bank-passwordBreach", "bank-passwordCommon", "bank-passwordLength", "bank-passwordReuse", "bank-passwordUsername", "bank-pinRules", "bank-recoveryLock", "bank-resendLimit", "bank-resetNeedsCode", "bank-signInLock", "bank-tokenExpiry", "bank-usernameHiding"]);
    expect(m.results.filter((x) => x.kind === "bank" && !x.killed)).toEqual([]);
  }, 240_000);

  it("is for BankWorkx only, for the web and the phone, and opens the recovery journeys and the unlock", () => {
    // the Cairo Amman Bank journey of the same name is another journey for another app
    expect(catalog.filter((c) => c.id === "sign-in").map((c) => c.madeFor).sort()).toEqual(["bankworkx", "cab"]);
    expect([signIn.apps, signIn.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(bankworkxJourneys.map((x) => x.slug)).toEqual(expect.arrayContaining(["sign-in", "forgot-username", "reset-password", "forgot-password", "unlock-account"]));
    expect(chainTargets(signIn).sort()).toEqual(["forgot-password", "forgot-username", "unlock-account"]);
    expect(chainWarnings(signIn, bankworkxJourneys.map((x) => x.slug))).toEqual([]);
  });
});

describe("forgot-username: Forgot username", () => {
  const j = Journey.parse(forgotUsername);
  const ACC: Record<string, string> = { ...linked(SIGN_IN_RULES, "sign-in"), ...linked(RESET_RULES.filter((id) => !["bank-codeExpiry", "bank-resendLimit", "bank-recoveryLock", "bank-tokenExpiry", "bank-resetNeedsCode"].includes(id)), "reset-password") };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([18, 18, 9]);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([34, 20, 14]);
    // the rules of the recovery it owns are caught by its own screens
    for (const id of ["bank-codeExpiry", "bank-resendLimit", "bank-recoveryLock", "bank-tokenExpiry", "bank-resetNeedsCode"]) expect(m.results.find((x) => x.id === id)?.killed, id).toBe(true);
  }, 240_000);
  it("is for BankWorkx only, for the web and the phone", () => {
    expect([forgotUsername.apps, forgotUsername.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(catalog.filter((c) => c.id === "forgot-username").map((c) => c.madeFor)).toEqual(["bankworkx"]);
  });
});

describe("reset-password: Reset password", () => {
  const j = Journey.parse(resetPassword);
  const ACC: Record<string, string> = linked(SIGN_IN_RULES.filter((id) => id !== "bank-credentials"), "sign-in");
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([23, 23, 10]);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([40, 33, 7]);
    for (const id of RESET_RULES) expect(m.results.find((x) => x.id === id)?.killed, id).toBe(true);
  }, 240_000);
  it("is for BankWorkx only, for the web and the phone", () => {
    expect([resetPassword.apps, resetPassword.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(catalog.filter((c) => c.id === "reset-password").map((c) => c.madeFor)).toEqual(["bankworkx"]);
  });
});

/**
 * Forgot password and Unlock account are thin entries: no bank calls and two screens of their own, and they open Reset password with the mode.
 * Their scenarios follow the chain into Reset password, so the entry's own parts are all caught; the bank rules of the reset are proved there.
 */
describe.each([
  ["forgot-password", forgotPassword, [4, 4, 3], [15, 4, 11]],
  ["unlock-account", unlockAccount, [5, 5, 4], [17, 6, 11]],
] as const)("%s (opens Reset password)", (slug, journey, proof, mutants) => {
  const j = Journey.parse(journey);
  const ACC = linked([...SIGN_IN_RULES.filter(() => false), ...RESET_RULES], "reset-password");
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual(proof);
  });
  it("is a thin entry: no bank calls and two screens of its own, and it opens Reset password", () => {
    expect(j.integrations).toEqual([]);
    expect(j.screens.map((s) => s.id)).toEqual(["start", "off"]);
    expect(j.slug).toBe(slug);
    expect(chainTargets(j).filter((t) => t === "reset-password")).toEqual(["reset-password"]);
    expect(j.apps).toEqual(["bankworkx"]);
    expect(catalog.find((c) => c.id === slug)?.madeFor).toBe("bankworkx");
  });
  it("the tests notice when the entry is broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual(mutants);
    expect(m.results.filter((x) => x.kind === "journey" && !x.killed)).toEqual([]);
  }, 240_000);
});
