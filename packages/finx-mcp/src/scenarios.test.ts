import { describe, expect, it } from "vitest";
import { bankworkxJourneys, chainTargets, chainWarnings, bulkPayment, catalog, corporateApproval, corporatePayment, Journey, withdrawPayment, payrollRun, ownTransfer, manageBeneficiary, personalTransfer, internalTransfer, internationalTransfer, payBillBankworkx, mobileTopup, schedulePayment, cancelStandingOrder, supplierPayment, approvePayments, signIn, forgotUsername, resetPassword, forgotPassword, unlockAccount, changePassword, trustedDevices, setupQuickLogin, changeQuickPin, accounts, accountDetails, statement, accountNickname, openAnotherAccount, budgets, createBudget, transferTypes, singleTransfer, cardPin, cardsView, activateCard, cardControls, freezeCard, virtualCard, replaceCard, disputeTransaction, addCard, termDeposit, savingsGoal, saveBorrow, applyLoan, repayLoan, invest, sellInvestment, addMoney, updateProfile, newMessage, messagesView, serviceRequest, myRequests, connectAccount, loanCalculator, depositCalculator, findBranchAtm, contactSupport, openAccount, trackApplication, registerDigitalBanking, businessAccounts, businessStatement, addSupplier, paymentTemplate, templates, scheduleBusinessPayment, businessSchedules, businessWithdraw, paymentTracker } from "@finx/journey-schema";
import { lintAll } from "@finx/renderer-core";
import { MockBank } from "@finx/mock-bank-api";
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
const SUPPLIER_RULES_SP = ["bank-bankCode", "bank-ibanChecksum", "bank-sepa", "bank-countryMatch", "bank-routingChecksum", "bank-sortCode", "bank-bic", "bank-nameCheck", "bank-supName", "bank-supDuplicate", "bank-supPending", "bank-supCheck", "bank-supCode"];

describe("supplier-payment: Pay a supplier", () => {
  const j = Journey.parse(supplierPayment);
  const SUP_ACCEPTED: Record<string, string> = {
    "no-error-path-65": "Resending the code is a button of the code field that a scenario cannot press; the first send has the same error path and is proved (T-25)",
    "bank-roles": OTHER_LAYER("The context's permissions are checked before the company's own roles, and only a Maker holds the permission to price or start a payment"),
    "bank-whitelist": OTHER_LAYER("The price (quote) already refuses a supplier that is not on the company's list before the payment is started, and the bank's unit tests start one directly"),
    "bank-userLimit": OTHER_LAYER("The price (quote) already refuses an amount over the person's day before the payment is started (T-6, T-7)"),
    "bank-companyLimit": "The company's limit (1,000,000.00) is above everything a Maker can send in a day (250,000.00 each), and the company's count only moves when a payment is released, which this journey never does",
    ...linked(SUPPLIER_RULES_SP, "add-supplier (which Request a new supplier opens)"),
  };

  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([39, 39, 10]);
    expect(r.ok).toBe(true);
  });

  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, SUP_ACCEPTED);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([51, 33, 18]);
    expect(m.ok).toBe(true);
  }, 240_000);

  it("the permission and approval rules of the bank are each checked by a mutant, and the permissions one is caught by a screen", async () => {
    const m = await mutationCheck(j, SUP_ACCEPTED);
    const bank = m.results.filter((x) => x.kind === "bank");
    expect(bank.map((x) => x.id).sort()).toEqual(["bank-companyLimit", "bank-cutoff", "bank-dualApproval", "bank-permissions", "bank-roles", "bank-userLimit", "bank-whitelist", ...SUPPLIER_RULES_SP].sort());
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
  // the recovery rules it meets through the "Forgot username?" link
  const SI_ACCEPTED = linked(["bank-recoveryLock", "bank-tokenExpiry", "bank-resetNeedsCode"], "forgot-username");
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([64, 64, 16]);
    expect(r.ok).toBe(true);
  });

  it("the tests notice when the journey or the bank's rules are broken (mutation check): every mutant of the journey and of its own rules is killed", async () => {
    const m = await mutationCheck(j, SI_ACCEPTED);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([60, 57, 3]);
    expect(m.results.filter((x) => x.kind === "journey" && !x.killed)).toEqual([]);
    expect(m.ok).toBe(true);
  }, 240_000);

  it("every sign-in rule of the bank is checked by a mutant and caught by a screen", async () => {
    const m = await mutationCheck(j, SI_ACCEPTED);
    const bank = m.results.filter((x) => x.kind === "bank").map((x) => x.id).sort();
    expect(bank).toEqual(["bank-codeExpiry", "bank-codeLock", "bank-credentials", "bank-deviceLimit", "bank-expiredPassword", "bank-newDeviceCode", "bank-passwordBreach", "bank-passwordCommon", "bank-passwordLength", "bank-passwordReuse", "bank-passwordUsername", "bank-pinRules", "bank-recoveryLock", "bank-resendLimit", "bank-resetNeedsCode", "bank-signInLock", "bank-tokenExpiry", "bank-usernameHiding"]);
    expect(m.results.filter((x) => x.kind === "bank" && !x.killed).map((x) => x.id).sort()).toEqual(["bank-recoveryLock", "bank-resetNeedsCode", "bank-tokenExpiry"]);
  }, 240_000);

  it("is for BankWorkx only, for the web and the phone, and opens the recovery journeys and the unlock", () => {
    // the Cairo Amman Bank journey of the same name is another journey for another app: the catalog has one id per slug, so this one keeps the name with the bank appended
    expect(catalog.filter((c) => c.id === "sign-in-bankworkx").map((c) => [c.madeFor, c.category])).toEqual([["bankworkx", "Access"]]);
    expect(catalog.filter((c) => c.id === "sign-in").map((c) => c.madeFor)).toEqual(["cab"]);
    expect([signIn.apps, signIn.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(bankworkxJourneys.map((x) => x.slug)).toEqual(expect.arrayContaining(["sign-in-bankworkx", "forgot-username", "reset-password", "forgot-password", "unlock-account"]));
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

/**
 * The Security journeys (Settings > Security): Change password, Trusted devices, Set up quick sign-in and Change quick PIN. They run for a signed-in customer
 * (Alex Morgan) who has stepped up (the shell does that before it opens one: `context: "personal"`), against the credential model of the sandbox bank. The
 * sandbox clock is pinned. A rule of the bank that a journey only meets through another one it opens is proved where it lives: each such survivor says where.
 */
const NO_RESEND = "This journey never asks for a second code in one attempt (a new attempt starts again from the first code); the resend limit is caught by Change password, which has a Resend code button";

describe("change-password: Change password", () => {
  const j = Journey.parse(changePassword);
  const ACC: Record<string, string> = {};
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([25, 25, 9]);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([33, 33, 0]);
    expect(m.results.filter((x) => x.kind === "journey" && !x.killed)).toEqual([]);
    for (const id of ["bank-stepUpGate", "bank-changeNeedsCode", "bank-currentPassword", "bank-passwordSame", "bank-signInLock", "bank-passwordLength", "bank-passwordReuse", "bank-codeLock", "bank-codeExpiry", "bank-resendLimit"]) expect(m.results.find((x) => x.id === id)?.killed, id).toBe(true);
  }, 240_000);
  it("is for BankWorkx only, for the web and the phone, and opens the reset", () => {
    expect([changePassword.apps, changePassword.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(catalog.filter((c) => c.id === "change-password").map((c) => [c.madeFor, c.category])).toEqual([["bankworkx", "Access"]]);
    expect(bankworkxJourneys.map((x) => x.slug)).toEqual(expect.arrayContaining(["change-password", "trusted-devices", "setup-quick-login", "change-quick-pin"]));
    expect(chainTargets(changePassword)).toEqual(["forgot-password"]);
  });
});

describe("trusted-devices: Trusted devices", () => {
  const j = Journey.parse(trustedDevices);
  const ACC: Record<string, string> = { "bank-resendLimit": NO_RESEND };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([21, 21, 8]);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([22, 21, 1]);
    expect(m.results.filter((x) => x.kind === "journey" && !x.killed)).toEqual([]);
    for (const id of ["bank-stepUpGate", "bank-removeNeedsCode", "bank-currentDeviceKept", "bank-codeLock", "bank-codeExpiry"]) expect(m.results.find((x) => x.id === id)?.killed, id).toBe(true);
  }, 240_000);
  it("is for BankWorkx only, for the web and the phone", () => {
    expect([trustedDevices.apps, trustedDevices.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(catalog.filter((c) => c.id === "trusted-devices").map((c) => c.madeFor)).toEqual(["bankworkx"]);
  });
});

describe("setup-quick-login: Set up quick sign-in", () => {
  const j = Journey.parse(setupQuickLogin);
  const ACC: Record<string, string> = {
    ...linked(["bank-pinLockOff", "bank-currentPin", "bank-pinSame"], "change-quick-pin"),
    "bank-resendLimit": NO_RESEND,
    "no-error-path-25": "Turning off is the one call a scenario cannot fail on its own: it would have to turn a method on first with the same adapter down. The error path of turning on is caught (T-14, T-15)",
  };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([25, 25, 10]);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([31, 26, 5]);
    expect(m.results.filter((x) => x.kind === "journey" && !x.killed).map((x) => x.id)).toEqual(["no-error-path-25"]);
    for (const id of ["bank-stepUpGate", "bank-quickNeedsCode", "bank-pinRules", "bank-codeLock", "bank-codeExpiry"]) expect(m.results.find((x) => x.id === id)?.killed, id).toBe(true);
  }, 240_000);
  it("is for BankWorkx only, for the web and the phone, and opens Change quick PIN", () => {
    expect([setupQuickLogin.apps, setupQuickLogin.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(catalog.filter((c) => c.id === "setup-quick-login").map((c) => c.madeFor)).toEqual(["bankworkx"]);
    expect(chainTargets(setupQuickLogin)).toEqual(["change-quick-pin"]);
  });
});

describe("change-quick-pin: Change quick PIN", () => {
  const j = Journey.parse(changeQuickPin);
  const ACC: Record<string, string> = linked(["bank-codeExpiry", "bank-codeLock", "bank-resendLimit", "bank-quickNeedsCode"], "setup-quick-login");
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([17, 17, 7]);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([24, 20, 4]);
    expect(m.results.filter((x) => x.kind === "journey" && !x.killed)).toEqual([]);
    for (const id of ["bank-stepUpGate", "bank-pinLockOff", "bank-currentPin", "bank-pinSame", "bank-pinRules"]) expect(m.results.find((x) => x.id === id)?.killed, id).toBe(true);
  }, 240_000);
  it("is for BankWorkx only, for the web and the phone, and opens the set-up", () => {
    expect([changeQuickPin.apps, changeQuickPin.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(catalog.filter((c) => c.id === "change-quick-pin").map((c) => c.madeFor)).toEqual(["bankworkx"]);
    expect(chainTargets(changeQuickPin)).toEqual(["setup-quick-login"]);
    expect(chainWarnings(changeQuickPin, bankworkxJourneys.map((x) => x.slug))).toEqual([]);
  });
});

/**
 * The Accounts journeys (Personal: Accounts) and the two ways to send money that are a view or an alias. They run for Alex Morgan, whose account states are the
 * sandbox's (Main with a card payment on hold; the dormant, overdrawn and closing accounts of the customer "alexaccounts"). The sandbox clock is pinned to
 * Tuesday 3 November 2026. A rule of the bank that a journey only meets through another one it opens is proved where it lives: each such survivor says where.
 * A scenario cannot set the bank's home market, so the numbers of the other markets are proved by the sandbox's own tests (accounts.test.ts).
 */
const RESEND = "Resending the code is a button of the code field that a scenario cannot press; the first send has the same error path and is proved";
const ACCOUNT_RULES = ["bank-totalHidden", "bank-totalFx", "bank-lastVisible", "bank-nameRules", "bank-nameTaken", "bank-closeHolds", "bank-closeOverdrawn", "bank-closeNeedsCode", "bank-reportPending", "bank-reportDuplicate", "bank-reportOutgoing", "bank-txFilter", "bank-pendingFirst", "bank-accountLimit", "bank-openNeedsCode"];
const except = (ids: string[], ...not: string[]) => ids.filter((id) => !not.includes(id));
const STATEMENT_RULES = ["bank-statementDates", "bank-statementEmpty", "bank-feeFunds", "bank-feeConvert", "bank-issueNeedsCode", "bank-letterDormant"];
/** The bank rules of sending money to someone else and between a person's own accounts: Send money, Between my accounts and Add a payee prove them. */
const SEND_RULES = ["bank-sameAccount", "bank-canDebit", "bank-funds", "bank-quoteExpiry", "bank-quoteReplay", "bank-railLimit", "bank-dailyLimit", "bank-coolingOff", "bank-sanctions", "bank-purposeRule", "bank-addressRule", "bank-bankCode", "bank-payeeLimit", "bank-payeeDuplicate", "bank-ibanChecksum", "bank-sepa", "bank-countryMatch", "bank-routingChecksum", "bank-sortCode", "bank-bic"];

describe("accounts: Accounts", () => {
  const j = Journey.parse(accounts);
  const ACC: Record<string, string> = {
    ...linked(except(ACCOUNT_RULES, "bank-totalHidden", "bank-totalFx"), "account-details or open-another-account"),
    "no-error-path-14": "A refresh that fails after the list has loaded cannot be arranged: a sandbox condition applies to the whole walk, so the first load fails first (the first load's error path is proved)",
  };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([19, 19, 10]);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([36, 22, 14]);
    for (const id of ["bank-totalHidden", "bank-totalFx"]) expect(m.results.find((x) => x.id === id)?.killed, id).toBe(true);
  }, 240_000);
  it("is for BankWorkx only, for the web and the phone", () => {
    expect([accounts.apps, accounts.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(catalog.filter((c) => c.id === "accounts").map((c) => [c.madeFor, c.category])).toEqual([["bankworkx", "Accounts"]]);
    expect(chainTargets(accounts).sort()).toEqual(["account-details", "open-another-account"]);
    expect(chainWarnings(accounts, bankworkxJourneys.map((x) => x.slug))).toEqual([]);
  });
});

describe("account-details: Account details", () => {
  const j = Journey.parse(accountDetails);
  const ACC: Record<string, string> = {
    ...linked(["bank-totalFx"], "accounts"),
    ...linked(STATEMENT_RULES, "statement"),
    "no-error-path-38": "Showing an account again can only fail if the adapter that hid it fails: the hidden account is arranged with that adapter, so a condition on it stops the set-up too",
    "no-error-path-90": "Putting the original name back can only fail if the adapter that gave the account its name fails: the name is arranged with that adapter, so a condition on it stops the set-up too",
    "no-error-path-106": RESEND,
    "no-rule-fail-1": "The screen checks the holds and the overdraft first (closeStart), so the bank's own refusal after the code is reached only by an account whose holds appeared in between; the bank's refusal is proved by T-35",
  };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([43, 43, 14]);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([52, 41, 11]);
    for (const id of ["bank-lastVisible", "bank-nameRules", "bank-nameTaken", "bank-closeHolds", "bank-closeOverdrawn", "bank-closeNeedsCode", "bank-reportPending", "bank-reportDuplicate", "bank-reportOutgoing", "bank-txFilter", "bank-pendingFirst"]) expect(m.results.find((x) => x.id === id)?.killed, id).toBe(true);
  }, 240_000);
  it("is for BankWorkx only, for the web and the phone, and opens the list and the statement", () => {
    expect([accountDetails.apps, accountDetails.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(catalog.filter((c) => c.id === "account-details").map((c) => [c.madeFor, c.category])).toEqual([["bankworkx", "Accounts"]]);
    expect(chainTargets(accountDetails).sort()).toEqual(["accounts", "statement"]);
    expect(chainWarnings(accountDetails, bankworkxJourneys.map((x) => x.slug))).toEqual([]);
  });
});

describe("statement: Statement", () => {
  const j = Journey.parse(statement);
  const ACC: Record<string, string> = {
    ...linked(ACCOUNT_RULES, "accounts or account-details"),
    "no-error-path-44": RESEND,
    "no-rule-fail-3": "A refusal of the code or the door after the bank accepted the code (OTP_REQUIRED, NOT_OFFICIAL, PERMISSION_DENIED) cannot be arranged from the screens, which use the right door and the code just checked; the bank's refusals are proved by T-26 and T-28",
  };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([35, 35, 12]);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([41, 26, 15]);
    // the rules of the document itself are caught by its own screens and by the sandbox asked directly
    for (const id of ["bank-statementDates", "bank-statementEmpty", "bank-feeFunds", "bank-feeConvert", "bank-issueNeedsCode", "bank-letterDormant"]) expect(m.results.find((x) => x.id === id)?.killed, id).toBe(true);
  }, 240_000);
  it("is for BankWorkx only, for the web and the phone, and takes a fee only through the official door", () => {
    expect([statement.apps, statement.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(catalog.filter((c) => c.id === "statement").map((c) => [c.madeFor, c.category])).toEqual([["bankworkx", "Accounts"]]);
    expect(statement.integrations.filter((i) => /statements\.(issue|deliver)/.test(i.adapter)).map((i) => i.adapter)).toEqual(["bank.statements.deliver", "bank.statements.issue"]);
    expect(chainTargets(statement).sort()).toEqual(["account-details", "accounts"]);
  });
});

describe("account-nickname: Rename an account (opens Account details)", () => {
  const j = Journey.parse(accountNickname);
  const ACC = linked(except(ACCOUNT_RULES, "bank-nameTaken"), "account-details");
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([4, 4, 3]);
  });
  it("is a thin entry: no bank calls and two screens of its own, and it opens Account details", () => {
    expect(j.integrations).toEqual([]);
    expect(j.screens.map((s) => s.id)).toEqual(["start", "off"]);
    expect(chainTargets(j)).toEqual(["account-details"]);
    expect([j.apps, catalog.find((c) => c.id === "account-nickname")?.madeFor]).toEqual([["bankworkx"], "bankworkx"]);
  });
  it("the tests notice when the entry is broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([15, 5, 10]);
    expect(m.results.filter((x) => x.kind === "journey" && !x.killed)).toEqual([]);
  }, 240_000);
});

describe("open-another-account: Open another account", () => {
  const j = Journey.parse(openAnotherAccount);
  const ACC: Record<string, string> = {
    ...linked(["bank-totalHidden", "bank-totalFx"], "accounts"),
    "no-error-path-29": RESEND,
    "no-rule-fail-3": "The currency step asks for a choice before it goes on, so the bank's CURRENCY_REQUIRED is reached only by a forged call (T-8)",
  };
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
    expect([m.total, m.killed, m.accepted.length]).toEqual([27, 23, 4]);
    for (const id of ["bank-accountLimit", "bank-openNeedsCode", "bank-nameRules", "bank-nameTaken"]) expect(m.results.find((x) => x.id === id)?.killed, id).toBe(true);
  }, 240_000);
  it("is for BankWorkx only, for the web and the phone, and ends on the list of accounts", () => {
    expect([openAnotherAccount.apps, openAnotherAccount.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(catalog.filter((c) => c.id === "open-another-account").map((c) => [c.madeFor, c.category])).toEqual([["bankworkx", "Accounts"]]);
    expect(chainTargets(openAnotherAccount)).toEqual(["accounts"]);
  });
});

describe("create-budget: Create a budget", () => {
  const j = Journey.parse(createBudget);
  const ACC: Record<string, string> = {
    "bank-budgetChips": LINKED("budgets"),
    "no-rule-fail-3": "The amount is checked on the screen before it is sent (the engine's own rule), so the bank's INVALID_AMOUNT is reached only by a forged call (T-22)",
    "no-rule-fail-4": "A category comes from the cards, never typed, so the bank's CATEGORY_REQUIRED is reached only by a forged call (T-22)",
  };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([26, 26, 10]);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([23, 20, 3]);
    for (const id of ["bank-budgetAmount", "bank-budgetDuplicate"]) expect(m.results.find((x) => x.id === id)?.killed, id).toBe(true);
  }, 240_000);
  it("is for BankWorkx only, never asks for a code or a tick, and opens the budgets view", () => {
    expect([createBudget.apps, createBudget.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(catalog.filter((c) => c.id === "create-budget").map((c) => [c.madeFor, c.category])).toEqual([["bankworkx", "Budgeting"]]);
    expect(createBudget.integrations.some((i) => /otp/.test(i.adapter))).toBe(false);
    expect(createBudget.screens.some((s) => s.blocks.some((b: any) => b.type === "otp" || b.type === "consent"))).toBe(false);
    expect(chainTargets(createBudget)).toEqual(["budgets"]);
  });
});

describe("budgets: Budgets", () => {
  const j = Journey.parse(budgets);
  const ACC = linked(["bank-budgetAmount", "bank-budgetDuplicate"], "create-budget");
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([13, 13, 7]);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([13, 11, 2]);
    expect(m.results.find((x) => x.id === "bank-budgetChips")?.killed).toBe(true);
  }, 240_000);
  it("is a view for BankWorkx only: it changes nothing itself and opens Create a budget", () => {
    expect([budgets.apps, budgets.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(catalog.filter((c) => c.id === "budgets").map((c) => [c.madeFor, c.category])).toEqual([["bankworkx", "Budgeting"]]);
    expect(budgets.integrations.map((i) => i.adapter)).toEqual(["bank.budgets.list"]);
    expect(chainTargets(budgets)).toEqual(["create-budget"]);
  });
});

describe("transfer-types: Ways to send money", () => {
  const j = Journey.parse(transferTypes);
  const ACC = linked(SEND_RULES, "personal-transfer or own-transfer");
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([15, 15, 8]);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([30, 10, 20]);
    expect(m.results.filter((x) => x.kind === "journey" && !x.killed)).toEqual([]);
  }, 240_000);
  it("is for BankWorkx only, moves no money and asks for no code, and opens the journeys that send", () => {
    expect([transferTypes.apps, transferTypes.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(catalog.filter((c) => c.id === "transfer-types").map((c) => [c.madeFor, c.category])).toEqual([["bankworkx", "Payments"]]);
    expect(transferTypes.integrations.map((i) => i.adapter)).toEqual(["bank.payments.speeds"]);
    expect(chainTargets(transferTypes).sort()).toEqual(["own-transfer", "personal-transfer"]);
    expect(chainWarnings(transferTypes, bankworkxJourneys.map((x) => x.slug))).toEqual([]);
  });
});

describe("single-transfer: Quick transfer (opens Send money)", () => {
  const j = Journey.parse(singleTransfer);
  const ACC = linked(["bank-canDebit", "bank-quoteExpiry", "bank-quoteReplay", "bank-railLimit", "bank-dailyLimit", "bank-sanctions", "bank-addressRule", "bank-bankCode", "bank-payeeLimit", "bank-payeeDuplicate", "bank-ibanChecksum", "bank-sepa", "bank-countryMatch", "bank-routingChecksum", "bank-sortCode", "bank-bic"], "personal-transfer");
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([16, 16, 7]);
  });
  it("is a thin entry: no bank calls and three screens of its own, and it opens Send money", () => {
    expect(j.integrations).toEqual([]);
    expect(j.screens.map((s) => s.id)).toEqual(["start", "choose", "off"]);
    expect(chainTargets(j)).toEqual(["personal-transfer"]);
    expect([j.apps, catalog.find((c) => c.id === "single-transfer")?.madeFor]).toEqual([["bankworkx"], "bankworkx"]);
    expect(chainWarnings(j, bankworkxJourneys.map((x) => x.slug))).toEqual([]);
  });
  it("the tests notice when the entry is broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([26, 10, 16]);
    expect(m.results.filter((x) => x.kind === "journey" && !x.killed)).toEqual([]);
  }, 240_000);
});

/**
 * The Cards journeys (Personal: Cards). They run for Alex Morgan, whose cards are the sandbox's (Everyday debit ••9021, Aurora credit ••3318, Spare debit ••7745 not
 * yet activated, a virtual card ••6150) on Tuesday 3 November 2026. A rule of the bank that a journey only meets through another one it opens is proved where it
 * lives: each such survivor says where. The numbers of the other home markets are set by a scenario with `config: { homeMarket }`.
 */
describe("card-pin: Set or change a card PIN", () => {
  const j = Journey.parse(cardPin);
  const ACC: Record<string, string> = {
    "no-error-path-20": RESEND,
    "no-rule-fail-4": "The bank asks for the code again only if the code it accepted was used in between, which one session cannot arrange; the bank's own refusal is proved by T-23",
  };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([24, 24, 9]);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([23, 21, 2]);
    for (const id of ["bank-pinCode", "bank-pinStrength", "bank-cardState"]) expect(m.results.find((x) => x.id === id)?.killed, id).toBe(true);
  }, 240_000);
  it("is for BankWorkx only, asks for a code before the PIN and never keeps the PIN or the code after the bank has them", async () => {
    expect([cardPin.apps, cardPin.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(catalog.filter((c) => c.id === "card-pin").map((c) => [c.madeFor, c.category])).toEqual([["bankworkx", "Cards"]]);
    expect(bankworkxJourneys.map((x) => x.slug)).toContain("card-pin");
    const save = cardPin.screens.find((s) => s.id === "save")!;
    expect(JSON.stringify(save.onEnter)).toContain('"path":"pin.new","value":""');
    const verify = cardPin.screens.find((s) => s.id === "code")!.blocks.flatMap((b: any) => (b.type === "button" ? b.actions : [])).filter((a: any) => a.type === "callApi").map((a: any) => a.integration);
    expect(verify[0]).toBe("otpVerify");
    // a run to the end leaves no PIN and no code in what the journey holds, in any screen it showed, nor in the bank's own dump
    const r = await simulate({
      journey: j, persona: "alex", lang: "en", now: Date.parse("2026-11-03T10:00:00Z"), launch: { "launch.cardId": "card_9021" },
      steps: [{ set: { "otp.code": "482100" } }, { press: "Continue" }, { set: { "pin.new": "2580", "pin.confirm": "2580" } }, { press: "Save PIN" }],
    });
    expect(r.finalScreen).toBe("done");
    expect(JSON.stringify([r.data, r.frames])).not.toContain("2580");
    expect(JSON.stringify(r.data)).not.toContain("482100");
  });
});

describe("cards: Cards", () => {
  const j = Journey.parse(cardsView);
  const ACC: Record<string, string> = {
    "no-error-path-14": "The reload after a freeze can only fail if the call that has just worked fails: a sandbox condition applies to the whole walk, so the first load fails first (the error path of the first load is proved)",
    "no-error-path-25": "A refresh of the cards can only fail if the first load fails: a sandbox condition applies to the whole walk (the error path of the first load is proved)",
    ...linked(["bank-lastVisible", "bank-nameRules", "bank-nameTaken", "bank-closeHolds", "bank-closeOverdrawn", "bank-closeNeedsCode", "bank-reportPending", "bank-reportDuplicate", "bank-reportOutgoing", "bank-txFilter", "bank-pendingFirst"], "account-details"),
    ...linked(["bank-loosenCode", "bank-limitRules", "bank-limitCeiling", "bank-tripRules", "bank-alertRules"], "card-controls"),
    ...linked(["bank-activateLock"], "activate-card"),
    ...linked(["bank-lostBlocked", "bank-replaceFee", "bank-replaceCode", "bank-replaceFunds", "bank-replaceOnce", "bank-replaceEligible", "bank-replaceExpired", "bank-replaceAddress"], "replace-card"),
    ...linked(["bank-pinCode", "bank-pinStrength"], "card-pin"),
    ...linked(["bank-cardNumber", "bank-cardExpiry", "bank-cardCvv", "bank-cardPostcode", "bank-cardDuplicate", "bank-cardLimit", "bank-cardVerify", "bank-cardDecline"], "add-card"),
  };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([30, 30, 12]);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([62, 25, 37]);
  }, 240_000);
  it("is a view for BankWorkx only: it changes nothing itself but a freeze, and opens the card journeys", () => {
    expect([cardsView.apps, cardsView.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(catalog.filter((c) => c.id === "cards").map((c) => [c.madeFor, c.category])).toEqual([["bankworkx", "Cards"]]);
    expect(cardsView.integrations.map((i) => i.adapter)).toEqual(["bank.cards.eligible", "bank.cards.freeze", "bank.cards.transactions"]);
    expect(chainTargets(cardsView).sort()).toEqual(["account-details", "activate-card", "add-card", "card-controls", "card-pin", "replace-card"]);
    expect(chainWarnings(cardsView, bankworkxJourneys.map((x) => x.slug))).toEqual([]);
  });
});

describe("activate-card: Activate a card", () => {
  const j = Journey.parse(activateCard);
  const ACC: Record<string, string> = {
    ...linked(["bank-cardState", "bank-pinCode"], "card-pin"),
    "no-rule-fail-2": "The bank answers ACTIVATION_LOCKED as an error only when the card was locked after its details were checked, which one session cannot arrange (a locked card is caught by the answer of the check itself, T-2); the bank's refusal is proved by T-24",
  };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([26, 26, 11]);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([28, 25, 3]);
    for (const id of ["bank-activateMatch", "bank-activateLock", "bank-pinStrength"]) expect(m.results.find((x) => x.id === id)?.killed, id).toBe(true);
  }, 240_000);
  it("is for BankWorkx only, asks for no code (holding the card is the proof), opens card-pin and never keeps the security code or the PIN once the bank has them", async () => {
    expect([activateCard.apps, activateCard.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(catalog.filter((c) => c.id === "activate-card").map((c) => [c.madeFor, c.category])).toEqual([["bankworkx", "Cards"]]);
    expect(activateCard.integrations.some((i) => /otp/.test(i.adapter))).toBe(false);
    expect(chainTargets(activateCard)).toEqual(["card-pin"]);
    // the security code is cleared right after the call that sends it, the PIN in the screen that sends it
    const details = activateCard.screens.find((s) => s.id === "details")!.blocks.flatMap((b: any) => (b.type === "button" ? b.actions : [])) as any[];
    const sent = details.filter((a) => a.type === "callApi" || (a.type === "setData" && a.path === "act.cvv")).map((a) => a.integration ?? a.path);
    expect(sent.slice(0, 2)).toEqual(["verify", "act.cvv"]);
    expect(JSON.stringify(activateCard.screens.find((s) => s.id === "activate")!.onEnter)).toContain('"path":"act.pin","value":""');
    // a run to the end leaves neither in what the journey holds nor in any screen it showed
    const r = await simulate({
      journey: j, persona: "alex", lang: "en", now: Date.parse("2026-11-03T10:00:00Z"), launch: { "launch.cardId": "card_7745" },
      steps: [{ set: { "act.last4": "7745", "act.expiry": "11/29", "act.cvv": "123" } }, { press: "Continue" }, { set: { "act.pin": "7391", "act.repeat": "7391" } }, { press: "Activate card" }],
    });
    expect(r.finalScreen).toBe("done");
    expect(JSON.stringify([r.data, r.frames])).not.toContain("7391");
    expect(JSON.stringify(r.data)).not.toContain("\"cvv\":\"1");
    expect(JSON.stringify(r.data.act)).not.toContain("123");
  });
});

describe("replace-card: Replace a card", () => {
  const j = Journey.parse(replaceCard);
  const ACC: Record<string, string> = {
    "no-validate-25": "The button is drawn only while Lost or Stolen is chosen, so the reason is never empty there; the validation of the Continue button, which is drawn for the other reasons and for none, is proved by T-33",
    "no-error-path-49": RESEND,
    "no-rule-fail-3": "The bank asks for the code again only if the code it accepted was used in between, which one session cannot arrange; the bank's own refusal is proved by T-27",
  };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([35, 35, 10]);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([38, 35, 3]);
    for (const id of ["bank-lostBlocked", "bank-replaceFee", "bank-replaceCode", "bank-replaceFunds", "bank-replaceOnce", "bank-replaceEligible", "bank-replaceExpired", "bank-replaceAddress", "bank-cardState"]) expect(m.results.find((x) => x.id === id)?.killed, id).toBe(true);
  }, 240_000);
  it("is for BankWorkx only, orders only after the confirmation and a verified one-time code, and blocks a lost or stolen card before the delivery is chosen", () => {
    expect([replaceCard.apps, replaceCard.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(catalog.filter((c) => c.id === "replace-card").map((c) => [c.madeFor, c.category])).toEqual([["bankworkx", "Cards"]]);
    expect(replaceCard.screens.some((s) => s.blocks.some((b: any) => b.type === "consent" && b.validation?.mustBeTrue))).toBe(true);
    const calls = replaceCard.screens.find((s) => s.id === "code")!.blocks.flatMap((b: any) => (b.type === "button" ? b.actions : [])).filter((a: any) => a.type === "callApi").map((a: any) => a.integration);
    expect(calls).toEqual(["otpVerify", "replace"]);
    // the block of a lost or stolen card asks for no code (it only protects) and comes before the delivery step
    const block = replaceCard.screens.find((s) => s.id === "blockCard")!;
    expect(JSON.stringify(block.onEnter)).toContain('"integration":"block"');
    expect(JSON.stringify(block.onEnter)).not.toContain("otp");
    expect(JSON.stringify(block.onEnter)).toContain('"navigate","to":"delivery"');
  });
});

const CONTROL_RULES = ["bank-cardState", "bank-loosenCode", "bank-limitRules", "bank-limitCeiling", "bank-tripRules", "bank-alertRules"];
describe("card-controls: Card limits and controls", () => {
  const j = Journey.parse(cardControls);
  const ACC: Record<string, string> = {
    "no-error-path-61": RESEND,
    "no-rule-fail-4": "The screen stops an alert amount below 1.00 or above 100,000.00 before the bank is asked, so the bank's ALERT_INVALID is reached only by a forged call (T-54)",
  };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([56, 56, 13]);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([51, 49, 2]);
    for (const id of CONTROL_RULES) expect(m.results.find((x) => x.id === id)?.killed, id).toBe(true);
  }, 240_000);
  it("is for BankWorkx only, for the web and the phone, and asks for a code before it loosens a card", async () => {
    expect([cardControls.apps, cardControls.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(catalog.filter((c) => c.id === "card-controls").map((c) => [c.madeFor, c.category])).toEqual([["bankworkx", "Cards"]]);
    expect(bankworkxJourneys.map((x) => x.slug)).toContain("card-controls");
    expect(cardControls.integrations.filter((i) => /otp/.test(i.adapter)).map((i) => i.id)).toEqual(["otpSend", "otpVerify"]);
    // the save that follows the code comes after otpVerify in the same button
    const code = cardControls.screens.find((s) => s.id === "code")!.blocks.flatMap((b: any) => (b.type === "button" ? b.actions : [])).filter((a: any) => a.type === "callApi").map((a: any) => a.integration);
    expect(code.slice(0, 2)).toEqual(["otpVerify", "save"]);
    // the review that saves without a code is only offered when the bank said no code is needed
    const review = cardControls.screens.find((s) => s.id === "review")!.blocks.filter((b: any) => b.type === "button" && b.label === "Save changes");
    expect(review.map((b: any) => b.visibleWhen)).toEqual(["ctx.prev.changed && !ctx.prev.needsCode"]);
    expect(chainTargets(cardControls)).toEqual([]);
  });
  it("keeps no code after the bank has it and sends no card number, PIN or code to a log", async () => {
    const r = await simulate({
      journey: j, persona: "alex", lang: "en", now: Date.parse("2026-11-03T10:00:00Z"), launch: { "launch.cardId": "card_9021", "launch.mode": "limits" },
      steps: [{ set: { "cc.lim.daily": 4000 } }, { press: "Continue" }, { press: "Continue" }, { set: { "otp.code": "482100" } }, { press: "Save changes" }],
    });
    expect(r.finalScreen).toBe("done");
    expect(JSON.stringify(r.data)).not.toContain("482100");
    expect((r.data as any).otp?.code).toBe("");
  });
});

describe("freeze-card: Freeze a card (opens card-controls)", () => {
  const j = Journey.parse(freezeCard);
  const ACC = linked(CONTROL_RULES, "card-controls");
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([5, 5, 4]);
  });
  it("is a thin entry: no bank calls and two screens of its own, and it opens card-controls", () => {
    expect(j.integrations).toEqual([]);
    expect(j.screens.map((s) => s.id)).toEqual(["start", "off"]);
    expect(chainTargets(j)).toEqual(["card-controls"]);
    expect(chainWarnings(j, bankworkxJourneys.map((x) => x.slug))).toEqual([]);
    expect([j.apps, catalog.find((c) => c.id === "freeze-card")?.madeFor]).toEqual([["bankworkx"], "bankworkx"]);
  });
  it("the tests notice when the entry is broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([10, 4, 6]);
    expect(m.results.filter((x) => x.kind === "journey" && !x.killed)).toEqual([]);
  }, 240_000);
});

describe("virtual-card: Virtual card", () => {
  const j = Journey.parse(virtualCard);
  const SCREEN_FIRST = "The screen checks the limit and offers only the purposes first, so the bank's own refusal of it is reached only by a forged call (T-21)";
  const ACC: Record<string, string> = {
    "no-error-path-36": RESEND,
    "no-rule-fail-3": SCREEN_FIRST,
    "no-rule-fail-4": SCREEN_FIRST,
  };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([26, 26, 10]);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([28, 25, 3]);
    for (const id of ["bank-virtualCap", "bank-virtualRange", "bank-virtualCode", "bank-virtualParent"]) expect(m.results.find((x) => x.id === id)?.killed, id).toBe(true);
  }, 240_000);
  it("is for BankWorkx only, asks for a code before the card is made and keeps neither the number nor the security code after the person leaves", async () => {
    expect([virtualCard.apps, virtualCard.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(catalog.filter((c) => c.id === "virtual-card").map((c) => [c.madeFor, c.category])).toEqual([["bankworkx", "Cards"]]);
    expect(chainTargets(virtualCard)).toEqual([]);
    const code = virtualCard.screens.find((s) => s.id === "code")!.blocks.flatMap((b: any) => (b.type === "button" ? b.actions : [])).filter((a: any) => a.type === "callApi").map((a: any) => a.integration);
    expect(code.slice(0, 2)).toEqual(["otpVerify", "create"]);
    // a run to the end and out: the details were on the result, and are in neither the journey's data nor the bank's dump afterwards
    const bank = new MockBank("alex", { now: Date.parse("2026-11-03T10:00:00Z") });
    const steps = [{ set: { "vc.purpose": "Online shopping" } }, { press: "Continue" }, { set: { "vc.limit": 200 } }, { press: "Continue" }, { set: { "vc.life": "3y" } }, { press: "Continue" }, { press: "Continue" }, { set: { "otp.code": "482100" } }, { press: "Create card" }];
    const shown = await simulate({ journey: j, persona: "alex", lang: "en", now: Date.parse("2026-11-03T10:00:00Z"), launch: { "launch.cardId": "card_9021" }, steps });
    expect(shown.finalScreen).toBe("done");
    expect(JSON.stringify(shown.data)).toContain("4000 0010 0007 9194");
    const out = await simulate({ journey: j, persona: "alex", lang: "en", now: Date.parse("2026-11-03T10:00:00Z"), launch: { "launch.cardId": "card_9021" }, steps: [...steps, { press: "Go to cards" }] });
    expect(out.exited).toBe(true);
    const left = JSON.stringify(out.data);
    for (const secret of ["4000 0010 0007 9194", "4000001000079194", "137"]) expect(left, secret).not.toContain(secret);
    expect(out.frames.filter((f) => f.step < steps.length).length).toBeGreaterThan(0);
    // the bank: only the last four digits, the expiry and what the card is for
    await bank.call("bank.otp.send", {});
    await bank.call("bank.otp.verify", { code: "482100" });
    const made = await bank.call("bank.cards.virtual.create", { cardId: "card_9021", purpose: "Online shopping", limit: 200 });
    const dump = JSON.stringify([bank.persona.cards, await bank.call("bank.cards.issued")]);
    expect(dump).not.toContain(made.number);
    expect(dump).not.toContain(made.number.replace(/ /g, ""));
    expect(dump).not.toContain(`"cvv"`);
    expect(dump).toContain("•••• •••• •••• 9194");
  });
});

describe("dispute-transaction: Report a problem with a payment", () => {
  const j = Journey.parse(disputeTransaction);
  const ACC: Record<string, string> = {};
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([30, 30, 10]);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([24, 24, 0]);
    for (const id of ["bank-disputeWindow", "bank-disputeOnce", "bank-disputeEligible", "bank-disputeDetails", "bank-disputeBlock"]) expect(m.results.find((x) => x.id === id)?.killed, id).toBe(true);
  }, 240_000);
  it("is for BankWorkx only, asks for no code and moves no money, and keeps no card number", async () => {
    expect([disputeTransaction.apps, disputeTransaction.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(catalog.filter((c) => c.id === "dispute-transaction").map((c) => [c.madeFor, c.category])).toEqual([["bankworkx", "Cards"]]);
    expect(disputeTransaction.integrations.some((i) => /otp/.test(i.adapter))).toBe(false);
    expect(disputeTransaction.screens.some((s) => s.blocks.some((b: any) => b.type === "otp"))).toBe(false);
    expect(disputeTransaction.integrations.map((i) => i.adapter).sort()).toEqual(["bank.cards.transactions", "bank.disputes.check", "bank.disputes.create", "bank.disputes.reasons"]);
    expect(chainTargets(disputeTransaction)).toEqual([]);
    expect(disputeTransaction.screens.some((s) => s.blocks.some((b: any) => b.type === "consent" && b.validation?.mustBeTrue))).toBe(true);
  });
});

describe("add-card: Add a card", () => {
  const j = Journey.parse(addCard);
  const ACC: Record<string, string> = {
    "no-rule-fail-4": "The screen stops a nickname of one character first, so the bank's NICKNAME_INVALID is reached only by a forged call (T-33)",
    "no-rule-fail-5": "The screens always verify the card they save, so the bank's VERIFY_REQUIRED at the end is reached only by a forged call (T-32)",
  };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([33, 33, 10]);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([24, 22, 2]);
  }, 240_000);
  it("is for BankWorkx only, saves a card only after a code and never keeps the number or the security code once the bank has them", async () => {
    expect([addCard.apps, addCard.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(catalog.filter((c) => c.id === "add-card").map((c) => [c.madeFor, c.category])).toEqual([["bankworkx", "Cards"]]);
    expect(bankworkxJourneys.map((x) => x.slug)).toContain("add-card");
    expect(addCard.integrations.map((i) => i.adapter)).toEqual(["bank.app.config", "bank.cards.check", "bank.otp.send", "bank.cards.verify", "bank.cards.add"]);
    const r = await simulate({
      journey: j, persona: "alex", lang: "en", now: Date.parse("2026-11-03T10:00:00Z"),
      steps: [
        { set: { "ac.number": "4242 4242 4242 4242", "ac.expiry": "12/29", "ac.cvv": "123", "ac.holder": "Alex Morgan", "ac.postcode": "62704" } }, { press: "Continue" },
        { set: { "ac.code": "482100" } }, { press: "Continue" }, { set: { "ac.consent": true } }, { press: "Save card" },
      ],
    });
    expect(r.finalScreen).toBe("done");
    const data = r.data as { ac: Record<string, unknown> };
    expect([data.ac.number, data.ac.cvv, data.ac.code]).toEqual(["", "", ""]);
    expect(JSON.stringify(r.data)).not.toContain("4242 4242 4242 4242");
    expect(JSON.stringify(r.data)).not.toContain("4242424242424242");
    expect(JSON.stringify(r.data)).not.toContain("482100");
    expect(JSON.stringify(r.frames)).not.toContain("123");
  });
});

describe("term-deposit: Term deposit", () => {
  const j = Journey.parse(termDeposit);
  const ACC: Record<string, string> = {
    "no-error-path-51": RESEND,
    "no-rule-fail-2": "A deposit that disappears between the list and the last step cannot be arranged in one walk; the bank's own refusal (DEPOSIT_NOT_FOUND) is proved by T-37",
    "no-rule-fail-8": "A code that was just verified cannot be spent in between, so the bank's own OTP_REQUIRED at the last step is reached only by a forged call (T-37)",
    ...linked(["bank-totalHidden", "bank-totalFx"], "accounts"),
  };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([47, 47, 11]);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([56, 51, 5]);
    for (const id of ["bank-depositRange", "bank-depositCharge", "bank-depositCode", "bank-depositEarly", "bank-saveFunds", "bank-depositTerm"]) expect(m.results.find((x) => x.id === id)?.killed, id).toBe(true);
  }, 240_000);
  it("is for BankWorkx only, asks for a tick and a code before it opens or closes and never keeps the code", async () => {
    expect([termDeposit.apps, termDeposit.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(catalog.filter((c) => c.id === "term-deposit").map((c) => [c.madeFor, c.category])).toEqual([["bankworkx", "Save & Borrow"]]);
    expect(bankworkxJourneys.map((x) => x.slug)).toContain("term-deposit");
    expect(chainTargets(termDeposit).sort()).toEqual(["accounts", "save-borrow"]);
    expect(chainWarnings(termDeposit, bankworkxJourneys.map((x) => x.slug))).toEqual([]);
    const verify = termDeposit.screens.find((s) => s.id === "code")!.blocks.flatMap((b: any) => (b.type === "button" ? b.actions : [])).filter((a: any) => a.type === "callApi").map((a: any) => a.integration);
    expect(verify[0]).toBe("otpVerify");
    const r = await simulate({
      journey: j, persona: "alex", lang: "en", now: Date.parse("2026-11-03T10:00:00Z"), launch: { "launch.mode": "open" },
      steps: [{ set: { "td.amount": 5000 } }, { press: "Continue" }, { press: "Continue" }, { set: { "td.consent": true } }, { press: "Confirm" }, { set: { "otp.code": "482100" } }, { press: "Confirm" }],
    });
    expect(r.finalScreen).toBe("doneOpen");
    expect(JSON.stringify(r.data)).not.toContain("482100");
  });
});

describe("savings-goal: Savings goal", () => {
  const j = Journey.parse(savingsGoal);
  const ACC: Record<string, string> = {
    "no-min-fund": "The bank refuses a monthly amount below 5.00 with the same words when Save goal is pressed (AUTO_BELOW, T-13), so removing the screen's own minimum changes nothing a person sees",
    "no-min-move": "The bank refuses an amount below 1.00 with the same words when the money is sent (AMOUNT_BELOW, T-39), so removing the screen's own minimum changes nothing a person sees",
    "no-min-out": "The bank refuses an amount below 1.00 with the same words when the money is sent (AMOUNT_BELOW, T-39), so removing the screen's own minimum changes nothing a person sees",
    "no-rule-fail-2": "A goal that disappears between the list and the last step cannot be arranged in one walk; the bank's own refusal (GOAL_NOT_FOUND) is proved by T-39",
    "no-rule-fail-3": "The goal screen stops an eleventh goal first, so the bank's GOAL_LIMIT at the end is reached only by a forged call (T-12)",
  };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([48, 48, 11]);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([49, 44, 5]);
    for (const id of ["bank-goalLimit", "bank-goalRules", "bank-goalAmounts", "bank-withdrawOff", "bank-saveFunds", "bank-saveDebit", "bank-saveCredit"]) expect(m.results.find((x) => x.id === id)?.killed, id).toBe(true);
  }, 240_000);
  it("is for BankWorkx only and never asks for a code: no code screen, no code call, no money-moving adapter", () => {
    expect([savingsGoal.apps, savingsGoal.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(catalog.filter((c) => c.id === "savings-goal").map((c) => [c.madeFor, c.category])).toEqual([["bankworkx", "Save & Borrow"]]);
    expect(bankworkxJourneys.map((x) => x.slug)).toContain("savings-goal");
    expect(savingsGoal.integrations.map((i) => i.adapter).filter((a) => /otp/.test(a))).toEqual([]);
    expect(savingsGoal.screens.some((s) => s.blocks.some((b: any) => b.type === "otp"))).toBe(false);
    expect(chainTargets(savingsGoal).sort()).toEqual(["save-borrow", "savings-goal"]);
    expect(chainWarnings(savingsGoal, bankworkxJourneys.map((x) => x.slug))).toEqual([]);
  });
});

describe("save-borrow: Save", () => {
  const j = Journey.parse(saveBorrow);
  // a view opens six journeys, so the bank's rules of every one of them are mutated too; each is proved by the mutation check of the journey that owns it
  const ACC: Record<string, string> = {
    ...linked(["bank-saveFunds", "bank-saveDebit", "bank-saveCredit"], "the journeys it opens (term-deposit, savings-goal, repay-loan and the others)"),
    ...linked(["bank-depositRange", "bank-depositTerm", "bank-depositCode", "bank-depositCharge", "bank-depositEarly"], "term-deposit"),
    ...linked(["bank-goalLimit", "bank-goalRules", "bank-goalAmounts", "bank-withdrawOff"], "savings-goal"),
    ...linked(["bank-loanLimit", "bank-loanRange", "bank-loanIncome", "bank-loanAffordability", "bank-loanReferral", "bank-loanRateRise", "bank-loanCode", "bank-loanOffer"], "apply-loan"),
    ...linked(["bank-repayRange", "bank-repayPrincipal", "bank-repayDate", "bank-settleFee", "bank-settleInterest", "bank-repayCode"], "repay-loan"),
    ...linked(["bank-fundMinimum", "bank-fundHigh", "bank-investCode"], "invest"),
    ...linked(["bank-sellRange", "bank-sellFee", "bank-sellCode", "bank-sellSettle"], "sell-investment"),
  };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([41, 41, 11]);
  });
  it("the tests notice when the journey is broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([66, 34, 32]);
  }, 240_000);
  it("is a view for BankWorkx only that changes nothing itself and opens the journeys, with the sections in a fixed order", () => {
    expect([saveBorrow.apps, saveBorrow.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(catalog.filter((c) => c.id === "save-borrow").map((c) => [c.madeFor, c.category])).toEqual([["bankworkx", "Save & Borrow"]]);
    expect(bankworkxJourneys.map((x) => x.slug)).toContain("save-borrow");
    expect(saveBorrow.integrations.map((i) => i.adapter)).toEqual(["bank.app.config", "bank.goals.list", "bank.deposits.list", "bank.loans.list", "bank.funds.portfolio"]);
    expect(chainTargets(saveBorrow).sort()).toEqual(["apply-loan", "invest", "repay-loan", "savings-goal", "sell-investment", "term-deposit"]);
    expect(chainWarnings(saveBorrow, bankworkxJourneys.map((x) => x.slug))).toEqual([]);
    const headings = (saveBorrow.screens.find((s) => s.id === "list")!.blocks as any[]).filter((b) => b.type === "sectionHeader").map((b) => b.title);
    expect(headings).toEqual(["Savings goals", "Term deposits", "Loans", "Investments"]);
  });
});

describe("apply-loan: Apply for a loan", () => {
  const j = Journey.parse(applyLoan);
  const ACC: Record<string, string> = {
    "no-error-path-33": RESEND,
    "no-min-work": "The amount field itself refuses an amount of nothing (\"Enter an amount\") before the minimum of 0.01 is looked at, so the minimum can never be the one that stops it; the bank's own refusal of an income of nothing is proved by T-31's forced calls and the unit tests",
  };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([39, 39, 12]);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([38, 36, 2]);
    for (const id of ["bank-loanLimit", "bank-loanRange", "bank-loanIncome", "bank-loanAffordability", "bank-loanReferral", "bank-loanRateRise", "bank-loanCode", "bank-loanOffer", "bank-saveCredit"]) expect(m.results.find((x) => x.id === id)?.killed, id).toBe(true);
  }, 240_000);
  it("is for BankWorkx only, asks for a tick and a code only for an approved offer and never keeps the code", async () => {
    expect([applyLoan.apps, applyLoan.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(catalog.filter((c) => c.id === "apply-loan").map((c) => [c.madeFor, c.category])).toEqual([["bankworkx", "Save & Borrow"]]);
    expect(bankworkxJourneys.map((x) => x.slug)).toContain("apply-loan");
    expect(chainTargets(applyLoan).sort()).toEqual(["save-borrow"]);
    expect(chainWarnings(applyLoan, bankworkxJourneys.map((x) => x.slug))).toEqual([]);
    // the code is asked on one screen, reached only from an approved offer; the loan is made after the code was verified
    const codeScreens = applyLoan.screens.filter((s) => s.blocks.some((b: any) => b.type === "otp")).map((s) => s.id);
    expect(codeScreens).toEqual(["code"]);
    const verify = applyLoan.screens.find((s) => s.id === "code")!.blocks.flatMap((b: any) => (b.type === "button" ? b.actions : [])).filter((a: any) => a.type === "callApi").map((a: any) => a.integration);
    expect(verify[0]).toBe("otpVerify");
    expect(applyLoan.screens.find((s) => s.id === "outcome")!.blocks.some((b: any) => b.type === "otp")).toBe(false);
    const r = await simulate({
      journey: j, persona: "alex", lang: "en", now: Date.parse("2026-11-03T10:00:00Z"),
      steps: [
        { set: { "loan.amount": 5000, "loan.term": "36", "loan.purpose": "Car" } }, { press: "Continue" },
        { set: { "loan.employment": "Employed", "loan.income": 5000, "loan.commitments": "300" } }, { press: "Check my application" },
        { set: { "loan.consent": true } }, { press: "Accept offer" }, { set: { "otp.code": "482100" } }, { press: "Confirm" },
      ],
    });
    expect(r.finalScreen).toBe("doneApproved");
    expect(JSON.stringify(r.data)).not.toContain("482100");
  });
});

describe("repay-loan: Repay a loan", () => {
  const j = Journey.parse(repayLoan);
  const ACC: Record<string, string> = {
    "no-error-path-36": RESEND,
    "no-error-path-47": "The check before the code (bank.loans.repay with dryRun) fails first for the same adapter, since a sandbox condition covers the whole walk; the refusal of the payment itself is proved by T-30 and the unit tests",
    "no-error-path-50": "The check before the code (bank.loans.settle with dryRun) fails first for the same adapter, since a sandbox condition covers the whole walk; the refusal of the settlement itself is proved by T-30 and the unit tests",
    "no-rule-fail-2": "A loan that disappears between the list and the last step cannot be arranged in one walk; the bank's own refusal (LOAN_NOT_FOUND) is proved by T-30",
    ...linked(["bank-saveCredit", "bank-loanLimit", "bank-loanRange", "bank-loanIncome", "bank-loanAffordability", "bank-loanReferral", "bank-loanRateRise", "bank-loanCode", "bank-loanOffer"], "apply-loan"),
  };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([35, 35, 11]);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([47, 34, 13]);
    for (const id of ["bank-repayRange", "bank-repayPrincipal", "bank-repayDate", "bank-settleFee", "bank-settleInterest", "bank-repayCode", "bank-saveFunds", "bank-saveDebit"]) expect(m.results.find((x) => x.id === id)?.killed, id).toBe(true);
  }, 240_000);
  it("is for BankWorkx only, asks for a tick and a code before it pays or settles and never keeps the code", async () => {
    expect([repayLoan.apps, repayLoan.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(catalog.filter((c) => c.id === "repay-loan").map((c) => [c.madeFor, c.category])).toEqual([["bankworkx", "Save & Borrow"]]);
    expect(bankworkxJourneys.map((x) => x.slug)).toContain("repay-loan");
    expect(chainTargets(repayLoan).sort()).toEqual(["apply-loan", "save-borrow"]);
    expect(chainWarnings(repayLoan, bankworkxJourneys.map((x) => x.slug))).toEqual([]);
    const verify = repayLoan.screens.find((s) => s.id === "code")!.blocks.flatMap((b: any) => (b.type === "button" ? b.actions : [])).filter((a: any) => a.type === "callApi").map((a: any) => a.integration);
    expect(verify[0]).toBe("otpVerify");
    const r = await simulate({
      journey: j, persona: "alex", lang: "en", now: Date.parse("2026-11-03T10:00:00Z"), launch: { "launch.loanId": "ln1" },
      steps: [{ press: "Continue" }, { press: "Review" }, { set: { "rp.consent": true } }, { press: "Pay" }, { set: { "otp.code": "482100" } }, { press: "Confirm" }],
    });
    expect(r.finalScreen).toBe("doneRepay");
    expect(JSON.stringify(r.data)).not.toContain("482100");
  });
});

describe("invest: Invest", () => {
  const j = Journey.parse(invest);
  const ACC: Record<string, string> = {
    "no-error-path-44": RESEND,
    "no-rule-fail-2": "A stock the bank does not know is stopped when the stocks are read (T-33); the bank's own INSTRUMENT_NOT_FOUND at the last step is reached only by a forged call",
    "no-rule-fail-3": "A fund that closes between the amount and the last step cannot be arranged in one walk; the bank's own FUND_CLOSED is proved by T-28",
    "no-rule-fail-6": "A code that was just verified cannot be spent in between, so the bank's own OTP_REQUIRED at the last step is reached only by a forged call (T-28)",
  };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([39, 39, 10]);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([41, 37, 4]);
    for (const id of ["bank-fundMinimum", "bank-fundHigh", "bank-investCode", "bank-saveFunds", "bank-saveDebit"]) expect(m.results.find((x) => x.id === id)?.killed, id).toBe(true);
  }, 240_000);
  it("is for BankWorkx only, asks for a tick and a code before it buys, on both roads, and never keeps the code", async () => {
    expect([invest.apps, invest.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(catalog.filter((c) => c.id === "invest").map((c) => [c.madeFor, c.category])).toEqual([["bankworkx", "Investing"]]);
    expect(bankworkxJourneys.map((x) => x.slug)).toContain("invest");
    expect(chainTargets(invest)).toEqual(["save-borrow"]);
    expect(chainWarnings(invest, bankworkxJourneys.map((x) => x.slug))).toEqual([]);
    expect(invest.integrations.map((i) => i.adapter)).toEqual(["bank.accounts.payFrom", "bank.funds.list", "bank.invest.instruments", "bank.funds.get", "bank.otp.send", "bank.otp.verify", "bank.funds.buy", "bank.invest.buy"]);
    const verify = invest.screens.find((s) => s.id === "code")!.blocks.flatMap((b: any) => (b.type === "button" ? b.actions : [])).filter((a: any) => a.type === "callApi").map((a: any) => a.integration);
    expect(verify[0]).toBe("otpVerify");
    for (const launch of [{ "launch.fundId": "bal" }, { "launch.symbol": "APXC" }]) {
      const stock = "launch.symbol" in launch;
      const r = await simulate({
        journey: j, persona: "alex", lang: "en", now: Date.parse("2026-11-03T10:00:00Z"), launch,
        steps: [{ set: { "inv.amount": 100 } }, { press: "Continue" }, { set: { "inv.consent": true } }, { press: "Invest" }, { set: { "otp.code": "482100" } }, { press: "Confirm" }],
      });
      expect(r.finalScreen).toBe(stock ? "doneStock" : "done");
      expect(JSON.stringify(r.data)).not.toContain("482100");
    }
  });
});

describe("sell-investment: Sell investment", () => {
  const j = Journey.parse(sellInvestment);
  const ACC: Record<string, string> = {
    "no-error-path-42": RESEND,
    "no-rule-fail-2": "A holding that disappears between the list and the last step cannot be arranged in one walk; the bank's own NOTHING_TO_SELL is proved by T-22",
    "no-rule-fail-5": "A code that was just verified cannot be spent in between, so the bank's own OTP_REQUIRED at the last step is reached only by a forged call (T-22)",
  };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([34, 34, 10]);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([38, 35, 3]);
    for (const id of ["bank-sellRange", "bank-sellFee", "bank-sellCode", "bank-sellSettle", "bank-saveCredit"]) expect(m.results.find((x) => x.id === id)?.killed, id).toBe(true);
  }, 240_000);
  it("is for BankWorkx only, asks for a tick and a code before it sells, on both roads, and never keeps the code", async () => {
    expect([sellInvestment.apps, sellInvestment.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(catalog.filter((c) => c.id === "sell-investment").map((c) => [c.madeFor, c.category])).toEqual([["bankworkx", "Investing"]]);
    expect(bankworkxJourneys.map((x) => x.slug)).toContain("sell-investment");
    expect(chainTargets(sellInvestment)).toEqual(["save-borrow"]);
    expect(chainWarnings(sellInvestment, bankworkxJourneys.map((x) => x.slug))).toEqual([]);
    expect(sellInvestment.integrations.map((i) => i.adapter)).toEqual(["bank.accounts.payFrom", "bank.funds.holdings", "bank.invest.holdings", "bank.funds.get", "bank.otp.send", "bank.otp.verify", "bank.funds.sell", "bank.invest.sell"]);
    const verify = sellInvestment.screens.find((s) => s.id === "code")!.blocks.flatMap((b: any) => (b.type === "button" ? b.actions : [])).filter((a: any) => a.type === "callApi").map((a: any) => a.integration);
    expect(verify[0]).toBe("otpVerify");
    for (const launch of [{ "launch.holdId": "geq" }, { "launch.symbol": "LMRB" }]) {
      const stock = "launch.symbol" in launch;
      const r = await simulate({
        journey: j, persona: "alex", lang: "en", now: Date.parse("2026-11-03T10:00:00Z"), launch,
        steps: [{ set: { "sl.amount": 100 } }, { press: "Continue" }, { set: { "sl.consent": true } }, { press: "Sell" }, { set: { "otp.code": "482100" } }, { press: "Confirm" }],
      });
      expect(r.finalScreen).toBe(stock ? "doneStock" : "done");
      expect(JSON.stringify(r.data)).not.toContain("482100");
    }
  });
});

describe("add-money: Add money", () => {
  const j = Journey.parse(addMoney);
  const ACC: Record<string, string> = {
    "no-error-path-26": RESEND,
    "no-error-path-31": "The check before the code is the same call of the same adapter (a dry run) and fails first, so the call after the code can only fail if the call that has just worked fails; its error path is the one the check proves",
    "no-rule-fail-4": "A code that was just verified cannot be spent in between, so the bank's own OTP_REQUIRED at the last step is reached only by a forged call (T-28)",
    ...linked(["bank-totalHidden", "bank-totalFx"], "accounts"),
    ...linked(["bank-cardNumber", "bank-cardExpiry", "bank-cardCvv", "bank-cardPostcode", "bank-cardDuplicate", "bank-cardLimit", "bank-cardVerify", "bank-cardDecline"], "add-card"),
  };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([32, 32, 10]);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([42, 29, 13]);
    for (const id of ["bank-topupRange", "bank-topupCard", "bank-topupFee", "bank-topupCode", "bank-topupCvv", "bank-saveCredit"]) expect(m.results.find((x) => x.id === id)?.killed, id).toBe(true);
  }, 240_000);
  it("is for BankWorkx only, asks for a tick and a code before a card is charged, and never keeps the security code or the code", async () => {
    expect([addMoney.apps, addMoney.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(catalog.filter((c) => c.id === "add-money").map((c) => [c.madeFor, c.category])).toEqual([["bankworkx", "Accounts"]]);
    expect(bankworkxJourneys.map((x) => x.slug)).toContain("add-money");
    expect(chainTargets(addMoney).sort()).toEqual(["accounts", "add-card"]);
    expect(chainWarnings(addMoney, bankworkxJourneys.map((x) => x.slug))).toEqual([]);
    const verify = addMoney.screens.find((s) => s.id === "code")!.blocks.flatMap((b: any) => (b.type === "button" ? b.actions : [])).filter((a: any) => a.type === "callApi").map((a: any) => a.integration);
    expect(verify).toEqual(["otpVerify", "add"]);
    // bank transfer details move no money and ask for no code: the journey never calls the bank's top-up on that path
    expect(addMoney.screens.find((s) => s.id === "bank")!.blocks.flatMap((b: any) => (b.type === "button" ? b.actions : [])).filter((a: any) => a.type === "callApi").map((a: any) => a.integration)).toEqual(["details", "profile"]);
    const r = await simulate({
      journey: j, persona: "alexsave", lang: "en", now: Date.parse("2026-11-03T10:00:00Z"),
      steps: [{ press: "Continue" }, { set: { "am.amount": 200, "am.cardId": "c_4242", "am.cvv": "123" } }, { press: "Continue" }, { set: { "am.consent": true } }, { press: "Confirm" }, { set: { "otp.code": "482100" } }, { press: "Add money" }],
    });
    expect(r.finalScreen).toBe("done");
    const data = r.data as { am: Record<string, unknown> };
    expect([data.am.cvv, data.am.consent]).toEqual(["", false]);
    expect(JSON.stringify(r.data)).not.toContain("482100");
    expect(JSON.stringify(r.frames)).not.toContain('"123"');
  });
});

/* --------------------------------------------------------------------------------------------------------------------------------------------------------------------- */
/* Step 7, slice D: the More tab. */
const MORE_MEMBERS = (j: Journey) => [j.apps, j.channels];
const MORE_CAT = (id: string) => catalog.filter((c) => c.id === id).map((c) => [c.madeFor, c.category]);
const REPORT = (r: Awaited<ReturnType<typeof runScenarios>>) => r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`);
const NOW_MORE = Date.parse("2026-11-03T10:00:00Z");
/** The reads and refreshes that run after the call that has just worked: a sandbox condition covers the whole walk, so the first call fails first and these can only fail if the call that worked fails. */
const AFTER_WORKED = (what: string) => `${what} can only fail if the call that has just worked fails: a sandbox condition applies to the whole walk, so the first load fails first (the error path of the first load is proved)`;

describe("update-profile: Update profile", () => {
  const j = Journey.parse(updateProfile);
  const ACC: Record<string, string> = {
    "no-error-path-102": "The check before the code is the same call of the same adapter (a dry run) and fails first, so the call after the codes can only fail if the call that has just worked fails; the error path of the check is proved on each of the three screens",
    "no-rule-fail-2": "A change that already waits is stopped on the first screen, so the bank's own ALREADY_PENDING is reached only by a change made in between or a forged call (T-42 proves the bank's refusal)",
  };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(REPORT(r)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([48, 48, 10]);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([39, 37, 2]);
    for (const id of ["bank-contactCode", "bank-contactRules", "bank-contactSame", "bank-contactPending", "bank-contactNewNumber", "bank-contactProof", "bank-contactNotify"]) expect(m.results.find((x) => x.id === id)?.killed, id).toBe(true);
  }, 240_000);
  it("is for BankWorkx only, asks for a code before any change, sends it to the number on file, and moves no money", () => {
    expect(MORE_MEMBERS(updateProfile)).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(MORE_CAT("update-profile")).toEqual([["bankworkx", "More"]]);
    expect(bankworkxJourneys.map((x) => x.slug)).toContain("update-profile");
    expect(updateProfile.integrations.map((i) => i.adapter).sort()).toEqual(["bank.otp.send", "bank.otp.verify", "bank.profile.contacts", "bank.profile.sendContactCode", "bank.profile.update", "bank.profile.verifyContact"]);
    expect(chainTargets(updateProfile)).toEqual([]);
    // the first code is asked from the bank without a number: it goes to the number on file, never to the new one
    const send = updateProfile.screens.find((s) => s.id === "sendCode")!.onEnter!.find((a: any) => a.type === "callApi" && a.integration === "otpSend") as any;
    expect(send.input).toEqual({ channel: "sms", strict: true });
    // the saving call is reached only after the code was checked, and the code screen checks it before it goes on
    const verify = updateProfile.screens.find((s) => s.id === "code")!.blocks.flatMap((b: any) => (b.type === "button" ? b.actions : [])).filter((a: any) => a.type === "callApi").map((a: any) => a.integration);
    expect(verify).toEqual(["otpVerify", "otpVerify"].slice(0, verify.length));
    expect(updateProfile.screens.find((s) => s.id === "save")!.onEnter!.some((a: any) => a.type === "callApi" && a.integration === "update")).toBe(true);
    expect(updateProfile.integrations.some((i) => /transfers|payments\.create|bills\.pay|topup\.create|schedules/.test(i.adapter))).toBe(false);
  });
  it("keeps no new value after the bank has it, and the result and the bank's record say masked values only", async () => {
    const r = await simulate({
      journey: j, persona: "alex", lang: "en", now: NOW_MORE, launch: { "opt.verifyNewMobile": false },
      steps: [{ set: { "up.what": "mobile" } }, { press: "Continue" }, { set: { "up.mobile": "5550100177" } }, { press: "Continue" }, { set: { "up.code": "482100" } }, { press: "Confirm" }],
    });
    expect(r.finalScreen).toBe("done");
    const up = (r.data as { up: Record<string, any> }).up;
    expect([up.mobile, up.code, up.code2, up.email, up.line1]).toEqual(["", "", "", "", ""]);
    expect(up.res).toMatchObject({ valueText: "•••• 0177", status: "updated" });
    expect(JSON.stringify(r.data)).not.toContain("5550100177");
    expect(JSON.stringify(r.data)).not.toContain("482100");
    // the last screens say nothing of the number but its last four digits
    for (const f of r.frames.filter((x) => x.screen === "done")) expect(JSON.stringify(f)).not.toContain("5550100177");
  });
  it("a change of the mobile number reaches the number the customer is asked for codes on next", async () => {
    const bank = new MockBank("alex", { now: NOW_MORE });
    await bank.call("bank.otp.send", { channel: "sms", strict: true }); await bank.call("bank.otp.verify", { code: "482100", strict: true });
    await bank.call("bank.profile.update", { field: "mobile", value: "5550100177", verifyNewMobile: false });
    expect(await bank.call("bank.otp.send", { channel: "sms", strict: true })).toMatchObject({ last4: "0177" });
  });
});

describe("new-message: New message", () => {
  const j = Journey.parse(newMessage);
  const ACC: Record<string, string> = { ...linked(["bank-replyRules"], "messages") };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(REPORT(r)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([23, 23, 8]);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([10, 9, 1]);
    for (const id of ["bank-messageRules", "bank-messageFile"]) expect(m.results.find((x) => x.id === id)?.killed, id).toBe(true);
  }, 240_000);
  it("is for BankWorkx only, asks for no code and moves no money, and opens Messages", () => {
    expect(MORE_MEMBERS(newMessage)).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(MORE_CAT("new-message")).toEqual([["bankworkx", "More"]]);
    expect(bankworkxJourneys.map((x) => x.slug)).toContain("new-message");
    expect(newMessage.integrations.map((i) => i.adapter)).toEqual(["bank.messages.send"]);
    expect(newMessage.screens.some((s) => s.blocks.some((b: any) => b.type === "otp"))).toBe(false);
    expect(chainTargets(newMessage)).toEqual(["messages"]);
    expect(chainWarnings(newMessage, bankworkxJourneys.map((x) => x.slug))).toEqual([]);
  });
  it("shows what was written as text: no block of the journey renders markup", async () => {
    const blocks = new Set(j.screens.flatMap((s) => s.blocks.map((b: any) => b.type)));
    expect([...blocks].filter((t) => /html|markdown|rich/i.test(t))).toEqual([]);
    expect(JSON.stringify(j)).not.toMatch(/dangerouslySetInnerHTML|innerHTML/);
  });
});

describe("messages: Messages", () => {
  const j = Journey.parse(messagesView);
  const ACC: Record<string, string> = {
    "no-error-path-15": AFTER_WORKED("The read of a conversation again after a reply"),
    "no-error-path-27": AFTER_WORKED("The read of a conversation the bank has just closed"),
    ...linked(["bank-messageRules", "bank-messageFile"], "new-message"),
  };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(REPORT(r)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([23, 23, 9]);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([18, 14, 4]);
    expect(m.results.find((x) => x.id === "bank-replyRules")?.killed).toBe(true);
  }, 240_000);
  it("is a view for BankWorkx only: it changes nothing but a reply and a read mark, and opens new-message", () => {
    expect(MORE_MEMBERS(messagesView)).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(MORE_CAT("messages")).toEqual([["bankworkx", "More"]]);
    expect(messagesView.integrations.map((i) => i.adapter)).toEqual(["bank.messages.list", "bank.messages.get", "bank.messages.markRead", "bank.messages.reply"]);
    expect(chainTargets(messagesView)).toEqual(["new-message"]);
    expect(chainWarnings(messagesView, bankworkxJourneys.map((x) => x.slug))).toEqual([]);
    expect(messagesView.screens.some((s) => s.blocks.some((b: any) => b.type === "otp"))).toBe(false);
  });
});

describe("service-request: Service request", () => {
  const j = Journey.parse(serviceRequest);
  const ACC: Record<string, string> = {
    "no-error-path-43": "The options of an account are asked for again when the account is chosen: that call is the same adapter as the first, which fails first under a sandbox condition (the error path of the first call is proved)",
    ...linked(["bank-cardState", "bank-loosenCode", "bank-limitRules", "bank-limitCeiling", "bank-tripRules", "bank-alertRules"], "card-controls"),
    ...linked(["bank-requestCancel"], "my-requests"),
  };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(REPORT(r)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([36, 36, 8]);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([39, 31, 8]);
    for (const id of ["bank-requestRules", "bank-requestDuplicate", "bank-requestTypeChange", "bank-requestOptions"]) expect(m.results.find((x) => x.id === id)?.killed, id).toBe(true);
  }, 240_000);
  it("is for BankWorkx only, asks for no code and moves no money, and a lost card is sent to the card controls and creates no request", async () => {
    expect(MORE_MEMBERS(serviceRequest)).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(MORE_CAT("service-request")).toEqual([["bankworkx", "More"]]);
    expect(serviceRequest.integrations.map((i) => i.adapter)).toEqual(["bank.requests.options", "bank.requests.create"]);
    expect(serviceRequest.screens.some((s) => s.blocks.some((b: any) => b.type === "otp"))).toBe(false);
    expect(chainTargets(serviceRequest).sort()).toEqual(["card-controls", "my-requests"]);
    expect(chainWarnings(serviceRequest, bankworkxJourneys.map((x) => x.slug))).toEqual([]);
    const lost = serviceRequest.screens.find((s) => s.id === "lost")!;
    expect(JSON.stringify(lost)).not.toContain("callApi");
    const r = await simulate({ journey: j, persona: "alex", lang: "en", now: NOW_MORE, steps: [{ set: { "sr.kind": "lost" } }, { press: "Continue" }, { press: "Continue" }] });
    expect(r.finalScreen).toBe("lost");
  });
});

describe("my-requests: My requests", () => {
  const j = Journey.parse(myRequests);
  const ACC: Record<string, string> = {
    "no-error-path-15": AFTER_WORKED("The read of a request again after it was cancelled"),
    "no-error-path-25": AFTER_WORKED("The read of a request the bank has already started"),
    ...linked(["bank-requestRules", "bank-requestDuplicate", "bank-requestTypeChange", "bank-requestOptions"], "service-request"),
  };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(REPORT(r)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([19, 19, 9]);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([15, 9, 6]);
    expect(m.results.find((x) => x.id === "bank-requestCancel")?.killed).toBe(true);
  }, 240_000);
  it("is a view for BankWorkx only: it changes nothing but a cancel, and opens service-request", () => {
    expect(MORE_MEMBERS(myRequests)).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(MORE_CAT("my-requests")).toEqual([["bankworkx", "More"]]);
    expect(myRequests.integrations.map((i) => i.adapter)).toEqual(["bank.requests.list", "bank.requests.get", "bank.requests.cancel"]);
    expect(chainTargets(myRequests)).toEqual(["service-request"]);
    expect(chainWarnings(myRequests, bankworkxJourneys.map((x) => x.slug))).toEqual([]);
    expect(myRequests.screens.some((s) => s.blocks.some((b: any) => b.type === "otp"))).toBe(false);
  });
});

describe("connect-account: Connect a bank", () => {
  const j = Journey.parse(connectAccount);
  const ACC: Record<string, string> = {
    "no-error-path-17": AFTER_WORKED("The read of the list of banks again after a disconnect"),
    "no-rule-fail-3": "A bank that is connected is not on the list, so the bank's ALREADY_CONNECTED reaches the screen only through a connection made in between or a forged call (T-28 proves the bank's refusal)",
    "no-rule-fail-4": "The agreement is a tick the screen requires before it goes on, so the bank's own CONSENT_REQUIRED is reached only by a forged call (T-27 proves it)",
    "no-rule-fail-5": "A connection that was started and not finished is replaced by the next one, so the bank's STATE_INVALID reaches the screen only through a second tab or a forged call (T-27 proves it)",
    ...linked(["bank-totalHidden", "bank-totalFx"], "accounts"),
  };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(REPORT(r)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([32, 32, 10]);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([24, 18, 6]);
    for (const id of ["bank-connectConsent", "bank-connectBank", "bank-connectPick", "bank-connectPeriod", "bank-connectReadOnly"]) expect(m.results.find((x) => x.id === id)?.killed, id).toBe(true);
  }, 240_000);
  it("is for BankWorkx only, never asks for the other bank's password, moves no money and opens the accounts", () => {
    expect(MORE_MEMBERS(connectAccount)).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(MORE_CAT("connect-account")).toEqual([["bankworkx", "More"]]);
    expect(bankworkxJourneys.map((x) => x.slug)).toContain("connect-account");
    expect(connectAccount.integrations.map((i) => i.adapter)).toEqual(["bank.connections.banks", "bank.connections.start", "bank.connections.finish", "bank.connections.remove"]);
    expect(connectAccount.screens.some((s) => s.blocks.some((b: any) => b.type === "textInput" || (b.type === "otp")))).toBe(false);
    expect(JSON.stringify(connectAccount.screens)).not.toContain('"secure":true');
    expect(Object.keys(connectAccount.dataModel ?? {}).filter((k) => /password|secret|username/i.test(k))).toEqual([]);
    expect(chainTargets(connectAccount)).toEqual(["accounts"]);
    expect(chainWarnings(connectAccount, bankworkxJourneys.map((x) => x.slug))).toEqual([]);
  });
  it("a connected account is read only: the customer cannot pay from it in any journey that lists accounts", async () => {
    const bank = new MockBank("alex", { now: NOW_MORE });
    const s = await bank.call("bank.connections.start", { bankId: "maple" });
    await bank.call("bank.connections.finish", { state: s.state, consent: true, pick1: true, pick2: true, pick3: true });
    for (const adapter of ["bank.accounts.list", "bank.accounts.payFrom"]) expect(JSON.stringify(await bank.call(adapter, {})), adapter).not.toContain("maple");
    for (const id of ["l_maple_current", "l_maple_savings", "l_maple_credit"]) await expect(bank.call("bank.transfers.own", { fromAccountId: id, toAccountId: "acc_main", amount: 1 })).rejects.toBeDefined();
  });
});

/* --------------------------------------------------------------------------------------------------------------------------------------------------------------------- */
/* Step 7, slice E: before sign-in (calculators, branch finder, contact, onboarding, tracking, registering). They run for the visitor (persona "signed-out") on Tuesday 3 November 2026, 18:45 UTC. */
const PUB_NOW = Date.parse("2026-11-03T18:45:00Z");
const PUB_MEMBERS = (j: Journey) => [j.apps, j.channels];
const SAME_FIRST = (what: string) => `${what}: the first call of the same adapter fails first under a sandbox condition (the condition covers the whole walk), so only that first error path can be proved`;
const NO_PIN = "A scenario cannot press a pin of the schematic map; the list of the same places below it has the same action and its error path is proved";
const RETRY_FIRST = "When the very first call is down, Try again asks again and fails again on the same screen the person is already on, so a scenario cannot tell the fallback rule from no rule";
const SIGN_IN_PUB = ["bank-credentials", "bank-signInLock", "bank-usernameHiding", "bank-newDeviceCode", "bank-expiredPassword", "bank-codeLock", "bank-deviceLimit", "bank-pinRules"];
const PASSWORD_PUB = ["bank-passwordLength", "bank-passwordUsername", "bank-passwordCommon", "bank-passwordBreach", "bank-passwordReuse"];
const SUPPORT_RULES = ["bank-pubSupportHours", "bank-pubSupportWays", "bank-pubSupportRules", "bank-pubSupportRate"];
const REG_RULES = ["bank-pubRegMatch", "bank-pubRegAlready", "bank-pubRegLock", "bank-pubRegCode", "bank-pubRegUsername", "bank-pubRegCard", "bank-pubRegTrust"];

describe("loan-calculator: Loan calculator", () => {
  const j = Journey.parse(loanCalculator);
  const ACC: Record<string, string> = {
    ...linked(["bank-saveCredit", "bank-loanLimit", "bank-loanRange", "bank-loanIncome", "bank-loanAffordability", "bank-loanReferral", "bank-loanRateRise", "bank-loanCode", "bank-loanOffer"], "apply-loan"),
  };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(REPORT(r)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([24, 24, 10]);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([27, 18, 9]);
    for (const id of ["bank-pubLoanRange", "bank-pubLoanFormula", "bank-pubSymbol", "bank-pubTermText"]) expect(m.results.find((x) => x.id === id)?.killed, id).toBe(true);
  }, 240_000);
  it("is for BankWorkx only, needs no permission and no code, asks for no personal data, moves no money and opens apply-loan", () => {
    expect(PUB_MEMBERS(loanCalculator)).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(MORE_CAT("loan-calculator")).toEqual([["bankworkx", "Public"]]);
    expect(bankworkxJourneys.map((x) => x.slug)).toContain("loan-calculator");
    expect(loanCalculator.integrations.map((i) => i.adapter)).toEqual(["bank.rates.loans", "bank.rates.loans"]);
    expect(JSON.stringify(loanCalculator.screens)).not.toMatch(/"otp"|"secure":true|textInput/);
    expect(JSON.stringify(loanCalculator)).not.toContain("session.permissions");
    expect(chainTargets(loanCalculator)).toEqual(["apply-loan"]);
    expect(chainWarnings(loanCalculator, bankworkxJourneys.map((x) => x.slug))).toEqual([]);
  });
  it("the figures are the bank's, in whole cents: the result holds integers and the money is never a float in the journey", async () => {
    const r = await simulate({ journey: j, persona: "signed-out", lang: "en", now: PUB_NOW, steps: [{ set: { "lc.amount": 35_000, "lc.term": "84" } }, { press: "Show summary" }] });
    expect(r.finalScreen).toBe("done");
    const q = (r.data as any).lc.res.quote;
    for (const k of ["amountCents", "paymentCents", "interestCents", "totalCents"]) expect(Number.isInteger(q[k]), k).toBe(true);
    expect(q).toMatchObject({ paymentText: "$579.23", interestText: "$13,655.71", totalText: "$48,655.71" });
  });
});

describe("deposit-calculator: Deposit calculator", () => {
  const j = Journey.parse(depositCalculator);
  const ACC: Record<string, string> = {
    ...linked(["bank-saveFunds", "bank-saveDebit", "bank-saveCredit", "bank-depositRange", "bank-depositTerm", "bank-depositCode", "bank-depositCharge", "bank-depositEarly"], "term-deposit"),
  };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(REPORT(r)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([25, 25, 10]);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([25, 17, 8]);
    for (const id of ["bank-pubDepositRate", "bank-pubDepositRange", "bank-pubDepositFormula", "bank-pubSymbol", "bank-pubTermText"]) expect(m.results.find((x) => x.id === id)?.killed, id).toBe(true);
  }, 240_000);
  it("is for BankWorkx only, needs no permission and no code, asks for no personal data, moves no money and opens term-deposit", () => {
    expect(PUB_MEMBERS(depositCalculator)).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(MORE_CAT("deposit-calculator")).toEqual([["bankworkx", "Public"]]);
    expect(bankworkxJourneys.map((x) => x.slug)).toContain("deposit-calculator");
    expect(depositCalculator.integrations.map((i) => i.adapter)).toEqual(["bank.rates.deposits", "bank.rates.deposits"]);
    expect(JSON.stringify(depositCalculator.screens)).not.toMatch(/"otp"|"secure":true|textInput/);
    expect(chainTargets(depositCalculator)).toEqual(["term-deposit"]);
    expect(chainWarnings(depositCalculator, bankworkxJourneys.map((x) => x.slug))).toEqual([]);
  });
});

describe("find-branch-atm: Find a branch or ATM", () => {
  const j = Journey.parse(findBranchAtm);
  const ACC: Record<string, string> = {
    "no-error-path-12": SAME_FIRST("The search of the Search button"),
    "no-error-path-23": SAME_FIRST("The search of the Show details button"),
    "no-error-path-16": NO_PIN,
  };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(REPORT(r)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([34, 34, 10]);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([18, 15, 3]);
    for (const id of ["bank-pubPlaceHours", "bank-pubPlaceSort", "bank-pubPlaceUnit", "bank-pubPlaceAtm", "bank-pubPlaceOpen", "bank-pubPlaceSearch"]) expect(m.results.find((x) => x.id === id)?.killed, id).toBe(true);
  }, 240_000);
  it("is for BankWorkx only, needs no permission, asks for no location or personal data and moves no money", () => {
    expect(PUB_MEMBERS(findBranchAtm)).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(MORE_CAT("find-branch-atm")).toEqual([["bankworkx", "Public"]]);
    expect(bankworkxJourneys.map((x) => x.slug)).toContain("find-branch-atm");
    expect(findBranchAtm.integrations.map((i) => i.adapter)).toEqual(["bank.locations.search", "bank.locations.details"]);
    expect(JSON.stringify(findBranchAtm)).not.toMatch(/geolocation|"otp"|"secure":true/);
    expect(chainTargets(findBranchAtm)).toEqual([]);
  });
});

describe("contact-support: Contact us", () => {
  const j = Journey.parse(contactSupport);
  const ACC: Record<string, string> = {
    "no-rule-timeout-2": RETRY_FIRST, "no-rule-unavailable-2": RETRY_FIRST,
    ...linked(["bank-messageRules", "bank-messageFile"], "new-message"),
  };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(REPORT(r)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([30, 30, 9]);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([25, 21, 4]);
    for (const id of SUPPORT_RULES) expect(m.results.find((x) => x.id === id)?.killed, id).toBe(true);
  }, 240_000);
  it("is for BankWorkx only, needs no permission, no code and moves no money; the secure-message button needs a signed-in person; what is written is cleared once sent", async () => {
    expect(PUB_MEMBERS(contactSupport)).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(MORE_CAT("contact-support")).toEqual([["bankworkx", "Public"]]);
    expect(bankworkxJourneys.map((x) => x.slug)).toContain("contact-support");
    expect(contactSupport.integrations.map((i) => i.adapter)).toEqual(["bank.support.hours", "bank.support.openChat", "bank.support.sendMessage"]);
    expect(chainTargets(contactSupport)).toEqual(["new-message"]);
    expect(JSON.stringify(contactSupport.screens.find((s) => s.id === "message")!.blocks.filter((b: any) => b.label === "Send us a message"))).toContain("session.permissions");
    const r = await simulate({
      journey: j, persona: "signed-out", lang: "en", now: PUB_NOW,
      steps: [{ set: { "cs.way": "message" } }, { press: "Continue" }, { set: { "cs.topic": "Accounts", "cs.email": "alex.morgan@example.com", "cs.text": "Please help me with my account number 4000 0000 0000 0002." } }, { press: "Send" }],
    });
    expect(r.finalScreen).toBe("messageDone");
    expect((r.data as any).cs.text).toBe("");
    expect(JSON.stringify((r.data as any).cs)).not.toContain("4000");
  });
  it("shows what was written as text: no block of the journey renders markup", () => {
    expect([...new Set(j.screens.flatMap((s) => s.blocks.map((b: any) => b.type)))].filter((t) => /html|markdown|rich/i.test(t))).toEqual([]);
    expect(JSON.stringify(j)).not.toMatch(/dangerouslySetInnerHTML|innerHTML/);
  });
});

describe("open-account: Open an account", () => {
  const j = Journey.parse(openAccount);
  const ACC: Record<string, string> = {
    "no-validate-158": "The account is always chosen (the first one is preselected), so the field can never be empty when Continue is pressed",
    "no-rule-stepFail-4": "An application the bank no longer knows, or one that was not verified, is reached only by a forged call or a second tab (T-57 proves the bank's refusal); no screen can send the journey there",
    "no-rule-back-6": "A failure at Work and money needs a call that fails there: the step is checked by the same adapter as the first step, which fails first under a sandbox condition; Address, the proof, the ID, Tax and the selfie each have their own scenario",
    ...linked(SIGN_IN_PUB.concat(PASSWORD_PUB.filter((x) => x !== "bank-passwordReuse")), "sign-in"),
    "bank-passwordReuse": LINKED("sign-in"),
    ...linked(SUPPORT_RULES, "contact-support"),
    ...linked(["bank-pubTrackMatch", "bank-pubTrackLock", "bank-pubTrackCode"], "track-application"),
  };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(REPORT(r)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([73, 73, 16]);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([101, 78, 23]);
    for (const id of ["bank-pubOnbContact", "bank-pubOnbDuplicate", "bank-pubOnbVerified", "bank-pubOnbAge", "bank-pubOnbId", "bank-pubOnbPoa", "bank-pubOnbPhotos", "bank-pubOnbMatch", "bank-pubOnbTax", "bank-pubOnbPostcode", "bank-pubOnbConsent", "bank-pubOnbReview", "bank-pubOnbKeep", "bank-pubOnbExpiry", "bank-pubOnbProduct", "bank-resendLimit", "bank-codeExpiry"]) expect(m.results.find((x) => x.id === id)?.killed, id).toBe(true);
  }, 600_000);
  it("is for BankWorkx only, needs no permission, moves no money, asks for the one-time code before anything is saved, and the terms are read and signed before it is sent", () => {
    expect(PUB_MEMBERS(openAccount)).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(MORE_CAT("open-account")).toEqual([["bankworkx", "Onboarding"]]);
    expect(bankworkxJourneys.map((x) => x.slug)).toContain("open-account");
    expect(openAccount.integrations.map((i) => i.adapter).sort()).toEqual(["bank.onboarding.begin", "bank.onboarding.check", "bank.onboarding.discard", "bank.onboarding.save", "bank.onboarding.start", "bank.onboarding.submit", "bank.onboarding.verifyIdentity", "bank.otp.send", "bank.otp.verify"]);
    expect(chainTargets(openAccount).sort()).toEqual(["contact-support", "open-account", "sign-in", "track-application"]);
    const blocks = openAccount.screens.find((s) => s.id === "sign")!.blocks.map((b: any) => b.type);
    expect(blocks).toEqual(expect.arrayContaining(["documentViewer", "signature"]));
    expect(JSON.stringify(openAccount.screens.find((s) => s.id === "sign")!.blocks.find((b: any) => b.type === "signature"))).toContain("oa.name");
    // the ID number and the tax ID are hidden fields everywhere they are typed
    for (const s of openAccount.screens) for (const b of s.blocks as any[]) if (b.bind === "oa.idNumber" || b.bind === "oa.taxId") expect(b.secure, `${s.id} ${b.bind}`).toBe(true);
    // the photos are never sent to the bank: no call carries them but the check (a reference to what was taken)
    expect(JSON.stringify(openAccount.screens.flatMap((s) => (s.onEnter ?? []).concat(s.blocks.flatMap((b: any) => (b.type === "button" ? b.actions : [])))).filter((a: any) => a.integration === "save" || a.integration === "submit"))).not.toMatch(/idPhotos|selfie|proof/);
  });
  it("keeps no ID number, tax ID, code or photo in the journey once the application is sent, and no ID number in any transcript", async () => {
    const steps: any[] = [
      { set: { "oa.mobile": "5550104410", "oa.email": "alex.morgan@example.org" } }, { press: "Continue" }, { set: { "oa.code": "482100" } }, { press: "Continue" },
      { set: { "oa.name": "Alex Morgan", "oa.dob": "14/03/1990", "oa.nationality": "United States", "oa.idNumber": "123456789" } }, { press: "Continue" },
      { set: { "oa.line1": "12 Harbour Road", "oa.city": "Springfield", "oa.postcode": "10001" } }, { press: "Continue" },
      { set: { "oa.idDocument": "national-id", "oa.idPhotos": { front: { ref: "SIM-FRONT-1" }, back: { ref: "SIM-BACK-1" } } } }, { press: "Continue" },
      { set: { "oa.selfie": { selfie: { ref: "SIM-SELFIE-1" } } } }, { press: "Continue" },
      { set: { "oa.employment": "Employed", "oa.income": "50-100", "oa.source": "Salary", "oa.deposits": "2-10" } }, { press: "Continue" }, { set: { "oa.taxOnly": "no", "oa.taxCountry": "Germany", "oa.taxId": "DE 4455" } }, { press: "Continue" },
      { press: "Continue" }, { set: { "oa.terms": true, "oa.taxConfirm": true } }, { press: "Continue" }, { set: { "oa.read": true, "oa.sig": { mode: "type", name: "Alex Morgan" } } }, { press: "Submit" },
    ];
    const r = await simulate({ journey: j, persona: "signed-out", lang: "en", now: PUB_NOW, steps });
    expect(r.finalScreen).toBe("status");
    const oa = (r.data as any).oa;
    expect([oa.idNumber, oa.taxId, oa.code, oa.idPhotos, oa.selfie, oa.proof, oa.sig, oa.mobile, oa.email, oa.dob, oa.line1]).toEqual(["", "", "", null, null, null, null, "", "", "", ""]);
    // a hidden field is never written into a transcript; what the journey holds after sending is the reference and the account, no number, code, contact or photo
    for (const secret of ["123456789", "DE 4455"]) expect(JSON.stringify(r.frames).includes(secret), secret).toBe(false);
    for (const secret of ["123456789", "DE 4455", "482100", "5550104410", "alex.morgan@example.org", "SIM-FRONT", "SIM-SELFIE"]) expect(JSON.stringify(r.data).includes(secret), secret).toBe(false);
    expect(oa.res).toMatchObject({ reference: "APP-100236", status: "checking" });
  });
});

describe("track-application: Track my application", () => {
  const j = Journey.parse(trackApplication);
  const ACC: Record<string, string> = {
    "bank-resendLimit": "The tracker has no Resend button (the spec's open point), so the limit of codes asked for again belongs to register-digital-banking, whose scenarios prove it",
    "bank-tokenExpiry": LINKED("register-digital-banking"),
    ...linked(PASSWORD_PUB, "register-digital-banking"), ...linked(REG_RULES, "register-digital-banking"), ...linked(SUPPORT_RULES, "contact-support"),
  };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(REPORT(r)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([29, 29, 9]);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([45, 27, 18]);
    for (const id of ["bank-pubTrackMatch", "bank-pubTrackLock", "bank-pubTrackCode", "bank-codeExpiry"]) expect(m.results.find((x) => x.id === id)?.killed, id).toBe(true);
  }, 240_000);
  it("is for BankWorkx only, needs no permission and moves no money; the status is asked for only after the code; it opens registration and contact", () => {
    expect(PUB_MEMBERS(trackApplication)).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(MORE_CAT("track-application")).toEqual([["bankworkx", "Public"]]);
    expect(bankworkxJourneys.map((x) => x.slug)).toContain("track-application");
    expect(trackApplication.integrations.map((i) => i.adapter)).toEqual(["bank.applications.find", "bank.otp.send", "bank.otp.verify", "bank.applications.status"]);
    expect(chainTargets(trackApplication).sort()).toEqual(["contact-support", "register-digital-banking"]);
    // the status is read only on the way out of the code screen (or straight after the details when the bank asks for no code)
    const readers = trackApplication.screens.filter((s) => JSON.stringify(s.onEnter ?? []).includes('"integration":"status"')).map((s) => s.id);
    expect(readers).toEqual(["show"]);
  });
  it("keeps neither the mobile number nor the code once the bank has them", async () => {
    const r = await simulate({ journey: j, persona: "signed-out", lang: "en", now: PUB_NOW, steps: [{ set: { "ta.reference": "APP-100234", "ta.mobile": "5550100123" } }, { press: "Continue" }, { set: { "ta.code": "482100" } }, { press: "Continue" }] });
    expect(r.finalScreen).toBe("checking");
    const ta = (r.data as any).ta;
    expect([ta.mobile, ta.code]).toEqual(["", ""]);
    expect(JSON.stringify(r.data)).not.toContain("5550100123");
  });
});

describe("register-digital-banking: Register for digital banking", () => {
  const j = Journey.parse(registerDigitalBanking);
  const ACC: Record<string, string> = {
    ...linked(SIGN_IN_PUB.filter((x) => x !== "bank-credentials"), "sign-in"),
    "bank-passwordReuse": "A customer who registers has no earlier password, so the used-before rule cannot be reached here; reset-password and change-password prove it",
    ...linked(SUPPORT_RULES, "contact-support"),
  };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(REPORT(r)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([39, 39, 12]);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([61, 49, 12]);
    for (const id of [...REG_RULES, "bank-codeExpiry", "bank-resendLimit", "bank-tokenExpiry", "bank-passwordLength", "bank-passwordUsername", "bank-passwordCommon", "bank-passwordBreach"]) expect(m.results.find((x) => x.id === id)?.killed, id).toBe(true);
  }, 240_000);
  it("is for BankWorkx only, needs no permission and moves no money, uses the sign-in's one-time code and password rules, and the profile is made only after the code", () => {
    expect(PUB_MEMBERS(registerDigitalBanking)).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(MORE_CAT("register-digital-banking")).toEqual([["bankworkx", "Onboarding"]]);
    expect(bankworkxJourneys.map((x) => x.slug)).toContain("register-digital-banking");
    expect(registerDigitalBanking.integrations.map((i) => i.adapter)).toEqual(["bank.registration.verify", "bank.otp.send", "bank.otp.verify", "bank.registration.complete", "bank.registration.complete"]);
    expect(registerDigitalBanking.integrations.find((i) => i.adapter === "bank.otp.verify")!.id).toBe("otpVerify");
    expect(chainTargets(registerDigitalBanking).sort()).toEqual(["contact-support", "sign-in"]);
    for (const s of registerDigitalBanking.screens) for (const b of s.blocks as any[]) if (b.bind === "rg.password" || b.bind === "rg.confirm" || b.bind === "rg.card") expect(b.secure, `${s.id} ${b.bind}`).toBe(true);
  });
  it("clears the password, the code and the token once the bank has them, and no secret is in any transcript or answer", async () => {
    const PW = "Granite-Lemon-92-River";
    const r = await simulate({
      journey: j, persona: "signed-out", lang: "en", now: PUB_NOW,
      steps: [
        { set: { "rg.customerId": "20481993", "rg.day": "1", "rg.month": "1", "rg.year": "1990" } }, { press: "Continue" }, { set: { "rg.code": "482100" } }, { press: "Continue" },
        { set: { "rg.username": "jordan.l.1990", "rg.password": PW, "rg.confirm": PW, "rg.terms": true } }, { press: "Continue" }, { press: "Finish" },
      ],
    });
    expect(r.finalScreen).toBe("registered");
    const rg = (r.data as any).rg;
    expect([rg.password, rg.confirm, rg.code, rg.customerId, rg.card]).toEqual(["", "", "", "", ""]);
    expect((r.data as any).found.registrationToken).toBe("");
    expect(JSON.stringify(r.frames).includes(PW)).toBe(false);
    for (const secret of [PW, "482100", "20481993"]) expect(JSON.stringify(r.data).includes(secret), secret).toBe(false);
  });
  it("a refused password is cleared on every way out: a failure, a token that ran out, a bank that did not answer", async () => {
    const PW = "Granite-Lemon-92-River";
    for (const conditions of [{ unavailable: ["bank.registration.complete"] }, { timeout: ["bank.registration.complete"], latencyMs: 10_000 }]) {
      const r = await simulate({
        journey: j, persona: "signed-out", lang: "en", now: PUB_NOW, conditions,
        steps: [{ set: { "rg.customerId": "20481993", "rg.day": "1", "rg.month": "1", "rg.year": "1990" } }, { press: "Continue" }, { set: { "rg.code": "482100" } }, { press: "Continue" }, { set: { "rg.username": "jordan.l.1990", "rg.password": PW, "rg.confirm": PW, "rg.terms": true } }, { press: "Continue" }],
      });
      expect([(r.data as any).rg.password, (r.data as any).rg.confirm]).toEqual(["", ""]);
    }
  });
});

/* ------------------------------------------------------------------------------------------ BankWorkx Business: Accounts and Payments (step 8, slice A) */

const PAY_RULES = ["bank-roles", "bank-whitelist", "bank-userLimit", "bank-companyLimit", "bank-dualApproval", "bank-cutoff"];
const SUPPLIER_RULES = ["bank-bankCode", "bank-ibanChecksum", "bank-sepa", "bank-countryMatch", "bank-routingChecksum", "bank-sortCode", "bank-bic", "bank-nameCheck", "bank-supName", "bank-supDuplicate", "bank-supPending", "bank-supCheck", "bank-supCode"];
const STATEMENT_BIZ_RULES = ["bank-stmtRange", "bank-stmtFormat", "bank-stmtRecipients", "bank-stmtExternal", "bank-stmtIntraday", "bank-stmtEmpty", "bank-stmtLimit"];
const TEMPLATE_RULES = ["bank-tplName", "bank-tplSupplier", "bank-tplAmount", "bank-tplLimit"];
const SCHEDULE_BIZ_RULES = ["bank-bschSupplier", "bank-bschAmount", "bank-bschDates", "bank-bschEnd", "bank-bschLimit", "bank-bschApprovals", "bank-bschCode", "bank-bschCutoff", "bank-bschRunning"];
const WITHDRAW_RULES = ["bank-wdOwner", "bank-wdState", "bank-wdReason"];
const SCREEN_RULE = (what: string) => `The screen's own permission rule sends a person without ${what} to the same no-access card, and no role of a company lacks it; the bank's refusal is proved by forced calls from Personal`;
const EVERY_ROLE = (permission: string) => `Every role of a company holds ${permission}, so no role can be refused here; the permission table is proved by the journeys whose permission only some roles hold (add-supplier, payment-template, schedule-business-payment)`;
const SAME_FIRST_BIZ = (what: string) => `${what}: the same adapter as the call before it, which fails first under a sandbox condition (a condition covers the whole walk), so only that first error path can be proved`;

describe("business-accounts: Business accounts", () => {
  const j = Journey.parse(businessAccounts);
  const ACC: Record<string, string> = {
    "no-rule-start-0": SCREEN_RULE("biz.accounts.view"),
    "bank-permissions": EVERY_ROLE("biz.accounts.view"),
    ...linked(PAY_RULES, "supplier-payment (which Pay from this account opens)"), ...linked(STATEMENT_BIZ_RULES, "business-statement (which Export opens)"),
  };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([20, 20, 8]);
    expect(r.ok).toBe(true);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, ACC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([35, 20, 15]);
    expect(m.ok).toBe(true);
  }, 240_000);
  it("what a person may do with each account is checked by the bank and caught by a screen: the rights, the available balance, the total, the numbers, the period and the search", async () => {
    const m = await mutationCheck(j, ACC);
    const killed = m.results.filter((x) => x.kind === "bank" && x.killed).map((x) => x.id).sort();
    expect(killed).toEqual(["bank-bizAvailable", "bank-bizDetails", "bank-bizPeriod", "bank-bizRights", "bank-bizSearch", "bank-bizTotal"]);
  }, 240_000);
  it("is for BankWorkx only, for the web and the phone, and asks for no code (it moves no money)", () => {
    expect(catalog.filter((c) => c.id === "business-accounts").map((c) => [c.madeFor, c.category])).toEqual([["bankworkx", "Accounts"]]);
    expect([businessAccounts.apps, businessAccounts.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(bankworkxJourneys.map((x) => x.slug)).toContain("business-accounts");
    expect(chainTargets(businessAccounts).sort()).toEqual(["business-statement", "supplier-payment"]);
    expect(businessAccounts.screens.some((s) => s.blocks.some((b: any) => b.type === "otp" || b.type === "consent"))).toBe(false);
  });
});

describe("business-statement: Statements and reports", () => {
  const j = Journey.parse(businessStatement);
  const ST: Record<string, string> = {
    "no-rule-start-0": SCREEN_RULE("biz.accounts.view"),
    "bank-permissions": EVERY_ROLE("biz.accounts.export"),
    "bank-bizAvailable": "This journey lists accounts by name and number; the available balance is not shown here (Business accounts proves it)",
  };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([29, 29, 9]);
    expect(r.ok).toBe(true);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, ST);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([26, 23, 3]);
    expect(m.ok).toBe(true);
  }, 240_000);
  it("each rule of the statement is checked by a mutant and caught by a screen: the dates, the formats, the recipients, outside addresses, today so far, an empty period, ten schedules", async () => {
    const m = await mutationCheck(j, ST);
    expect(m.results.filter((x) => x.kind === "bank" && x.killed).map((x) => x.id).sort()).toEqual(["bank-bizRights", ...STATEMENT_BIZ_RULES].sort());
  }, 240_000);
  it("is for BankWorkx only; it moves no money and asks for no code, and only writes to the company's addresses unless the bank allows others", () => {
    expect(catalog.filter((c) => c.id === "business-statement").map((c) => [c.madeFor, c.category])).toEqual([["bankworkx", "Accounts"]]);
    expect([businessStatement.apps, businessStatement.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(bankworkxJourneys.map((x) => x.slug)).toContain("business-statement");
    expect(businessStatement.screens.some((s) => s.blocks.some((b: any) => b.type === "otp"))).toBe(false);
    expect(businessStatement.integrations.map((i) => i.adapter).sort()).toEqual(["corp.accounts.list", "corp.statements.check", "corp.statements.generate", "corp.statements.list", "corp.statements.schedule"]);
  });
});

describe("add-supplier: Add a supplier", () => {
  const j = Journey.parse(addSupplier);
  const AS: Record<string, string> = {
    "no-error-path-61": "Resending the code is a button of the code field that a scenario cannot press; the first send has the same error path and is proved (T-19)",
    "no-rule-route-3": SCREEN_RULE("biz.suppliers.manage"),
    "no-rule-route-6": "The form stops it first: the address fields are required, so the bank never sees a request without an address (the spec says the same); the bank's refusal is ADDRESS_REQUIRED",
    "no-rule-route-7": "The name screen cannot be left without the Add anyway tick, so the bank never sees a request without it; the forced call is refused (T-13)",
  };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([30, 30, 8]);
    expect(r.ok).toBe(true);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, AS);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([46, 42, 4]);
    expect(m.ok).toBe(true);
  }, 240_000);
  it("the rules of a supplier request are each checked by a mutant and caught by a screen: the name, the details of every market, the name check, the code, ten waiting, the permissions", async () => {
    const m = await mutationCheck(j, AS);
    expect(m.results.filter((x) => x.kind === "bank").map((x) => x.id).sort()).toEqual(["bank-bankCode", "bank-bic", "bank-countryMatch", "bank-ibanChecksum", "bank-nameCheck", "bank-permissions", "bank-routingChecksum", "bank-sepa", "bank-sortCode", "bank-supCheck", "bank-supCode", "bank-supDuplicate", "bank-supName", "bank-supPending"]);
    expect(m.results.filter((x) => x.kind === "bank" && !x.killed)).toEqual([]);
  }, 240_000);
  it("is for BankWorkx only; the code is always asked, before the request, after the confirmation tick", () => {
    expect(catalog.filter((c) => c.id === "add-supplier").map((c) => [c.madeFor, c.category])).toEqual([["bankworkx", "Payments"]]);
    expect([addSupplier.apps, addSupplier.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(bankworkxJourneys.map((x) => x.slug)).toContain("add-supplier");
    const otp = addSupplier.screens.find((s) => s.id === "otp")!;
    expect(otp.blocks.flatMap((b: any) => (b.type === "button" ? b.actions : [])).filter((a: any) => a.type === "callApi").map((a: any) => a.integration)).toEqual(["otpVerify", "request"]);
    expect(addSupplier.screens.some((s) => s.blocks.some((b: any) => b.type === "consent" && b.validation?.mustBeTrue && b.bind === "as.consent"))).toBe(true);
  });
});

describe("payment-template: Payment templates", () => {
  const j = Journey.parse(paymentTemplate);
  const PT: Record<string, string> = {
    "no-rule-route-5": "A supplier taken off the list between choosing it and saving cannot be arranged within one walk; the bank's refusal is proved by a forced call (T-13)",
    "no-rule-route-6": "A supplier that is not approved is stopped when it is chosen (only approved suppliers are listed), so the bank's refusal never reaches the supplier step; proved by a forced call (T-13)",
    "no-rule-route-7": "A template deleted between reading the list and deleting it cannot be arranged within one walk; the bank's refusal is proved (T-9)",
    "no-rule-retry-1": SAME_FIRST_BIZ("The retry after the real save"),
    ...linked(PAY_RULES, "supplier-payment (which Use opens)"), ...linked(SUPPLIER_RULES, "add-supplier (which an empty list of suppliers opens)"),
  };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([27, 27, 8]);
    expect(r.ok).toBe(true);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, PT);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([53, 30, 23]);
    expect(m.ok).toBe(true);
  }, 240_000);
  it("the rules of a template are each checked by a mutant and caught by a screen: the name, the supplier, the amount, twenty at most", async () => {
    const m = await mutationCheck(j, PT);
    const killed = m.results.filter((x) => x.kind === "bank" && x.killed).map((x) => x.id).sort();
    expect(killed).toEqual(["bank-permissions", ...TEMPLATE_RULES].sort());
  }, 240_000);
  it("is for BankWorkx only; it moves no money and asks for no code, and Use hands the template to Pay a supplier", () => {
    expect(catalog.filter((c) => c.id === "payment-template").map((c) => [c.madeFor, c.category])).toEqual([["bankworkx", "Payments"]]);
    expect([paymentTemplate.apps, paymentTemplate.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(bankworkxJourneys.map((x) => x.slug)).toContain("payment-template");
    expect(chainTargets(paymentTemplate).sort()).toEqual(["add-supplier", "supplier-payment", "templates"]);
    expect(paymentTemplate.screens.some((s) => s.blocks.some((b: any) => b.type === "otp"))).toBe(false);
  });
});

describe("templates: Templates", () => {
  const j = Journey.parse(templates);
  const TP: Record<string, string> = {
    "no-rule-start-0": SCREEN_RULE("biz.accounts.view"),
    "bank-permissions": EVERY_ROLE("biz.accounts.view"),
    ...linked(PAY_RULES, "supplier-payment (which Use opens)"), ...linked(TEMPLATE_RULES, "payment-template (which Delete and Save a template open)"),
  };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([12, 12, 5]);
    expect(r.ok).toBe(true);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, TP);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([20, 8, 12]);
    expect(m.ok).toBe(true);
  }, 240_000);
  it("is for BankWorkx only; it moves no money, and Use, Delete and Save a template open the journeys that do the work", () => {
    expect(catalog.filter((c) => c.id === "templates").map((c) => [c.madeFor, c.category])).toEqual([["bankworkx", "Payments"]]);
    expect([templates.apps, templates.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(bankworkxJourneys.map((x) => x.slug)).toContain("templates");
    expect(chainTargets(templates).sort()).toEqual(["payment-template", "supplier-payment"]);
    expect(templates.screens.some((s) => s.blocks.some((b: any) => b.type === "otp"))).toBe(false);
  });
});

describe("schedule-business-payment: Schedule a supplier payment", () => {
  const j = Journey.parse(scheduleBusinessPayment);
  const SC: Record<string, string> = {
    "no-error-path-41": SAME_FIRST_BIZ("The check when the last payment is chosen"),
    "no-error-path-59": "Resending the code is a button of the code field that a scenario cannot press; the first send has the same error path and is proved (T-39)",
    "no-rule-route-7": "A supplier taken off the list between choosing it and sending cannot be arranged within one walk; the bank's refusal is proved by forced calls (T-13)",
  };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([46, 46, 9]);
    expect(r.ok).toBe(true);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, SC);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([56, 53, 3]);
    expect(m.ok).toBe(true);
  }, 240_000);
  it("the rules of a schedule are each checked by a mutant and caught by a screen: the supplier, the amount, the dates, the end, twenty at most, the approvers, the code, when changes close, a payment running now, the permissions", async () => {
    const m = await mutationCheck(j, SC);
    expect(m.results.filter((x) => x.kind === "bank").map((x) => x.id).sort()).toEqual(["bank-permissions", ...SCHEDULE_BIZ_RULES].sort());
    expect(m.results.filter((x) => x.kind === "bank" && !x.killed)).toEqual([]);
  }, 240_000);
  it("is for BankWorkx only; the confirmation tick is required and a code is verified before a schedule is made or changed (never to cancel)", () => {
    expect(catalog.filter((c) => c.id === "schedule-business-payment").map((c) => [c.madeFor, c.category])).toEqual([["bankworkx", "Payments"]]);
    expect([scheduleBusinessPayment.apps, scheduleBusinessPayment.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(bankworkxJourneys.map((x) => x.slug)).toContain("schedule-business-payment");
    const otp = scheduleBusinessPayment.screens.find((s) => s.id === "otp")!;
    const calls = otp.blocks.flatMap((b: any) => (b.type === "button" ? [b.actions.filter((a: any) => a.type === "callApi").map((a: any) => a.integration)] : []));
    expect(calls).toEqual([["otpVerify", "create"], ["otpVerify", "update"]]);
    expect(scheduleBusinessPayment.screens.find((s) => s.id === "cancelCard")!.blocks.some((b: any) => b.type === "otp")).toBe(false);
    expect(scheduleBusinessPayment.screens.some((s) => s.blocks.some((b: any) => b.type === "consent" && b.validation?.mustBeTrue))).toBe(true);
  });
});

describe("business-schedules: Scheduled supplier payments", () => {
  const j = Journey.parse(businessSchedules);
  const BS: Record<string, string> = {
    "no-rule-start-0": SCREEN_RULE("biz.accounts.view"),
    "bank-permissions": EVERY_ROLE("biz.accounts.view"),
    ...linked(SCHEDULE_BIZ_RULES, "schedule-business-payment (which Schedule a payment, Change and Cancel open)"),
  };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([13, 13, 6]);
    expect(r.ok).toBe(true);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, BS);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([20, 9, 11]);
    expect(m.ok).toBe(true);
  }, 240_000);
  it("is for BankWorkx only; it moves no money, and Change, Cancel and Schedule a payment open the schedule journey", () => {
    expect(catalog.filter((c) => c.id === "business-schedules").map((c) => [c.madeFor, c.category])).toEqual([["bankworkx", "Payments"]]);
    expect([businessSchedules.apps, businessSchedules.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(bankworkxJourneys.map((x) => x.slug)).toContain("business-schedules");
    expect(chainTargets(businessSchedules)).toEqual(["schedule-business-payment"]);
    expect(businessSchedules.screens.some((s) => s.blocks.some((b: any) => b.type === "otp"))).toBe(false);
  });
});

describe("withdraw-payment: Withdraw a payment", () => {
  const j = Journey.parse(businessWithdraw);
  const WD: Record<string, string> = linked(PAY_RULES, "supplier-payment (which New supplier payment opens)");
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([22, 22, 6]);
    expect(r.ok).toBe(true);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, WD);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([26, 20, 6]);
    expect(m.ok).toBe(true);
  }, 240_000);
  it("the rules of a withdrawal are each checked by a mutant and caught by a screen: only your own, only while it waits, the reason, the permissions", async () => {
    const m = await mutationCheck(j, WD);
    expect(m.results.filter((x) => x.kind === "bank" && x.killed).map((x) => x.id).sort()).toEqual(["bank-permissions", "bank-trkSettled", ...WITHDRAW_RULES].sort());
  }, 240_000);
  it("is for BankWorkx only, asks for no code (nothing is sent), and the old name opens it", () => {
    expect(catalog.filter((c) => c.id === "withdraw-payment").map((c) => [c.madeFor, c.category])).toEqual([["bankworkx", "Payments"]]);
    expect([businessWithdraw.apps, businessWithdraw.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(bankworkxJourneys.map((x) => x.slug)).toContain("withdraw-payment");
    expect(businessWithdraw.screens.some((s) => s.blocks.some((b: any) => b.type === "otp"))).toBe(false);
    expect(chainTargets(businessWithdraw).sort()).toEqual(["payment-tracker", "supplier-payment"]);
  });
});

describe("payment-tracker: Payment tracker", () => {
  const j = Journey.parse(paymentTracker);
  const PTR: Record<string, string> = {
    "no-rule-route-0": SCREEN_RULE("biz.accounts.view"),
    "bank-permissions": EVERY_ROLE("biz.accounts.view"),
    ...linked(PAY_RULES, "supplier-payment (which New supplier payment opens)"), ...linked(WITHDRAW_RULES, "withdraw-payment (which Withdraw opens)"),
  };
  it("is lint clean, every scenario passes and every acceptance criterion is proved", async () => {
    expect(lintAll(j)).toEqual([]);
    const r = await runScenarios(j);
    expect(r.results.filter((x) => !x.ok).map((x) => `${x.id} ${x.name}: ${x.failures.join(" | ")}`)).toEqual([]);
    expect(r.coverage.map((c) => [c.id, c.status])).toEqual((j.acceptance ?? []).map((a) => [a.id, "proved"]));
    expect([r.passed, r.total, r.coverage.length]).toEqual([17, 17, 8]);
    expect(r.ok).toBe(true);
  });
  it("the tests notice when the journey or the bank's rules are broken (mutation check)", async () => {
    const m = await mutationCheck(j, PTR);
    expect(m.survived.map((s) => `${s.id}: ${s.what}`)).toEqual([]);
    expect([m.total, m.killed, m.accepted.length]).toEqual([20, 9, 11]);
    expect(m.ok).toBe(true);
  }, 240_000);
  it("is for BankWorkx only; it moves no money, and Withdraw and New supplier payment open the journeys that do the work", () => {
    expect(catalog.filter((c) => c.id === "payment-tracker").map((c) => [c.madeFor, c.category])).toEqual([["bankworkx", "Payments"]]);
    expect([paymentTracker.apps, paymentTracker.channels]).toEqual([["bankworkx"], ["web", "mobile"]]);
    expect(bankworkxJourneys.map((x) => x.slug)).toContain("payment-tracker");
    expect(chainTargets(paymentTracker).sort()).toEqual(["supplier-payment", "withdraw-payment"]);
    expect(paymentTracker.screens.some((s) => s.blocks.some((b: any) => b.type === "otp"))).toBe(false);
  });
});
