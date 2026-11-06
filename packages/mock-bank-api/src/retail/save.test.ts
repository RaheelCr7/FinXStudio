import { describe, expect, it } from "vitest";
import { MockBank, type SandboxConditions } from "../index";
import type { Flaws } from "../business/corporate";

// Alex Morgan on Tuesday 3 November 2026. The clock is pinned, so interest, maturity, instalment and settlement dates do not depend on today.
const NOW = Date.parse("2026-11-03T10:00:00Z");
const bank = (flaws?: Flaws, over: { persona?: string; conditions?: SandboxConditions; now?: number } = {}) => new MockBank(over.persona ?? "alex", { now: over.now ?? NOW, corpFlaws: flaws, conditions: over.conditions });
const code = (p: Promise<unknown>) => p.then(() => "ok", (e) => (e as { code?: string }).code ?? String(e));
const msg = (p: Promise<unknown>) => p.then(() => "ok", (e) => (e as Error).message);
const otp = async (b: MockBank) => { await b.call("bank.otp.send", {}); await b.call("bank.otp.verify", { code: "482100" }); };
const main = (b: MockBank) => b.persona.accounts.find((a) => a.id === "acc_main")!;

describe("accounts that can pay", () => {
  it("lists the accounts in the home currency with what is available, and the one to start with", async () => {
    const r = await bank().call("bank.accounts.payFrom");
    expect(r).toMatchObject({ count: 2, firstId: "acc_main", defaultId: "acc_main" });
    expect(r.accounts.acc_main).toMatchObject({ name: "Main ••4410", sub: "$8,602.36 available", available: 8602.36 });
    expect(r.accounts.acc_save).toMatchObject({ name: "Savings ••7731", sub: "$15,254.37 available" });
    expect((await bank(undefined, { conditions: { frozen: ["acc_main"] } }).call("bank.accounts.payFrom")).accounts.acc_main.sub).toBe("Frozen");
    expect((await bank(undefined, { persona: "alexglobal" }).call("bank.accounts.payFrom")).count).toBe(2);
  });
  it("is for customers with a savings seed; the others keep the older records", async () => {
    expect(await new MockBank("sam").call("bank.deposits.list")).toEqual({});
    expect(await code(new MockBank("ayesha").call("bank.goals.contribute", { goalId: "g1", amount: 10, fromAccountId: "acc_current" }))).toBe("NOT_SUPPORTED");
  });
});

describe("term deposits", () => {
  const quote = (b: MockBank, over: Record<string, unknown> = {}) => b.call("bank.deposits.quote", { amount: 5000, term: 12, fromAccountId: "acc_main", ...over });
  it("lists the deposit with what the Save tab shows", async () => {
    const d = (await bank().call("bank.deposits.list")).td1;
    expect(d).toMatchObject({ title: "Term deposit", name: "$10,000.00", sub: "4.20% · matures 12 Aug 2027", line: "4.20% · matures 12 Aug 2027", rateText: "4.20%", maturesText: "12 Aug 2027", renewalText: "", ratePercent: 4.2, status: "active" });
  });
  it("offers four terms with their rate and the day they mature", async () => {
    const t = (await bank().call("bank.deposits.terms", {})).terms;
    expect(Object.values<any>(t).map((x) => [x.name, x.sub])).toEqual([["3 months", "Matures 3 Feb 2027 · 3.40% a year"], ["6 months", "Matures 3 May 2027 · 3.80% a year"], ["12 months", "Matures 3 Nov 2027 · 4.20% a year"], ["24 months", "Matures 3 Nov 2028 · 4.50% a year"]]);
  });
  it("prices 5,000 for 12 months: 210.00 of interest, 5,210.00 at maturity; paid every month it is the 5,000 alone", async () => {
    expect(await quote(bank())).toMatchObject({ rateText: "4.20% a year", interestText: "$210.00", maturesText: "3 Nov 2027", receiveText: "$5,210.00", payoutText: "At maturity", from: "Main ••4410" });
    expect(await quote(bank(), { payout: "monthly" })).toMatchObject({ receiveText: "$5,000.00", interestText: "$210.00", payoutText: "Every month" });
    expect((await quote(bank(), { term: 24 })).interestText).toBe("$450.00");
  });
  it("takes 1,000.00 to 250,000.00 with at most two decimals", async () => {
    expect(await msg(quote(bank(), { amount: 500 }))).toBe("The smallest deposit is $1,000.00.");
    expect(await msg(quote(bank(), { amount: 300000 }))).toBe("The largest deposit is $250,000.00.");
    expect(await code(quote(bank(), { amount: 1000.5 }))).toBe("ok");
    expect(await code(quote(bank(), { amount: 1000.555 }))).toBe("AMOUNT_DECIMALS");
    expect(await code(quote(bank({ depositRange: false }), { amount: 500 }))).toBe("ok");
    expect(await code(quote(bank({ depositRange: false, saveFunds: false }), { amount: 300000 }))).toBe("ok");
  });
  it("checks the account that pays: not enough, and not one that cannot pay", async () => {
    expect(await msg(quote(bank(), { amount: 9000 }))).toBe("Not enough money in Main. Available: $8,602.36.");
    expect(await code(quote(bank({ saveFunds: false }), { amount: 9000 }))).toBe("ok");
    expect(await code(quote(bank(undefined, { conditions: { frozen: ["acc_main"] } })))).toBe("ACCOUNT_CANNOT_DEBIT");
    expect(await code(quote(bank({ saveDebit: false }, { conditions: { frozen: ["acc_main"] } })))).toBe("ok");
    expect(await code(quote(bank(), { fromAccountId: "nope" }))).toBe("ACCOUNT_NOT_FOUND");
  });
  it("takes the four terms, and the monthly payout only when it is offered", async () => {
    expect(await code(quote(bank(), { term: 5 }))).toBe("TERM_INVALID");
    expect(await code(quote(bank({ depositTerm: false }), { term: 5 }))).toBe("ok");
    expect(await code(quote(bank(), { payout: "monthly", allowMonthly: false }))).toBe("PAYOUT_OFF");
    expect(await code(quote(bank({ depositTerm: false }), { payout: "monthly", allowMonthly: false }))).toBe("ok");
    expect(await code(quote(bank(), { payout: "weekly" }))).toBe("PAYOUT_INVALID");
  });
  it("opens only after the code: the amount leaves the account, the deposit is listed and Activity shows it", async () => {
    const b = bank(), open = { amount: 5000, term: 12, payout: "maturity", fromAccountId: "acc_main" };
    expect(await code(b.call("bank.deposits.open", open))).toBe("OTP_REQUIRED");
    expect(main(b).balance).toBe(8720.76);
    expect(await b.call("bank.deposits.open", { ...open, dryRun: true })).toMatchObject({ receiveText: "$5,210.00" });
    expect(await code(b.call("bank.deposits.open", open))).toBe("OTP_REQUIRED");
    await otp(b);
    const r = await b.call("bank.deposits.open", open);
    expect(r).toMatchObject({ depositId: "td2", amountText: "$5,000.00", maturesText: "3 Nov 2027" });
    expect(r.reference).toMatch(/^TD-20261103-/);
    expect([main(b).balance, main(b).available]).toEqual([3720.76, 3602.36]);
    expect(Object.keys(await b.call("bank.deposits.list"))).toEqual(["td1", "td2"]);
    expect(b.persona.retail!.transactions[0]).toMatchObject({ accountId: "acc_main", title: "Term deposit", category: "Savings", amount: -5000, date: "2026-11-03" });
    expect(b.persona.finance!.transactions[0]).toMatchObject({ title: "Term deposit", amount: -5000 });
    // the code is spent
    expect(await code(b.call("bank.deposits.open", { ...open, amount: 1000 }))).toBe("OTP_REQUIRED");
    const loose = bank({ depositCode: false });
    expect(await code(loose.call("bank.deposits.open", open))).toBe("ok");
  });
  it("renews: the term and what happens at maturity change, no money moves, the Save tab says Renews for", async () => {
    const b = bank(), renew = { depositId: "td1", term: 24, instruction: "renew-payout" };
    expect(await b.call("bank.deposits.renew", { ...renew, dryRun: true })).toMatchObject({ termText: "24 months", rateText: "4.50% a year", instructionText: "Renew, pay interest out", effectText: "12 Aug 2027" });
    expect(await code(b.call("bank.deposits.renew", renew))).toBe("OTP_REQUIRED");
    await otp(b);
    const before = main(b).balance;
    expect(await b.call("bank.deposits.renew", renew)).toMatchObject({ renewsText: "It renews for 24 months on 12 Aug 2027." });
    expect(main(b).balance).toBe(before);
    expect((await b.call("bank.deposits.list")).td1).toMatchObject({ renewalText: "Renews for 24 months", renewalMonths: 24, autoRenew: true });
    await otp(b);
    expect(await b.call("bank.deposits.renew", { depositId: "td1", term: 12, instruction: "payout" })).toMatchObject({ renewsText: "It will be paid out on 12 Aug 2027." });
    expect((await b.call("bank.deposits.list")).td1.renewalText).toBe("");
    expect(await code(b.call("bank.deposits.renew", { depositId: "nope", term: 12, instruction: "renew", dryRun: true }))).toBe("DEPOSIT_NOT_FOUND");
    expect(await code(b.call("bank.deposits.renew", { depositId: "td1", term: 7, instruction: "renew", dryRun: true }))).toBe("TERM_INVALID");
    expect(await code(b.call("bank.deposits.renew", { depositId: "td1", term: 12, instruction: "x", dryRun: true }))).toBe("INSTRUCTION_INVALID");
    expect(await code(bank({ depositCode: false }).call("bank.deposits.renew", renew))).toBe("ok");
  });
  it("closes early: 83 days of interest is 95.51, the charge is half of it (47.76), the 10,000.00 is never touched", async () => {
    const b = bank(), q = await b.call("bank.deposits.close.quote", { depositId: "td1" });
    expect(q).toMatchObject({ depositText: "$10,000.00", days: 83, earnedText: "$95.51", chargeText: "-$47.76", netText: "$10,047.75" });
    expect(q.net).toBeGreaterThan(q.principal);
    expect(await code(b.call("bank.deposits.close", { depositId: "td1", toAccountId: "acc_main" }))).toBe("OTP_REQUIRED");
    await otp(b);
    const before = main(b).balance, r = await b.call("bank.deposits.close", { depositId: "td1", toAccountId: "acc_main" });
    expect(r).toMatchObject({ netText: "$10,047.75", paidInto: "Main ••4410" });
    expect(main(b).balance).toBeCloseTo(before + 10047.75, 2);
    expect(await b.call("bank.deposits.list")).toEqual({});
    expect(b.persona.retail!.transactions[0]).toMatchObject({ title: "Term deposit closed", amount: 10047.75 });
    expect((await bank({ depositCharge: false }).call("bank.deposits.close.quote", { depositId: "td1" })).chargeText).toBe("-$0.00");
    expect(await code(bank({ depositCode: false }).call("bank.deposits.close", { depositId: "td1", toAccountId: "acc_main" }))).toBe("ok");
    // the money cannot go into an account that cannot receive it
    expect(await code(bank(undefined, { conditions: { frozen: ["acc_main"] } }).call("bank.deposits.close", { depositId: "td1", toAccountId: "acc_main" }))).toBe("ACCOUNT_CANNOT_CREDIT");
    expect(await code(bank({ saveCredit: false }, { conditions: { frozen: ["acc_main"] } }).call("bank.deposits.close", { depositId: "td1", toAccountId: "acc_main" }))).toBe("OTP_REQUIRED");
  });
  it("closes the deposit on the day it opened with no interest and no charge; refuses it when early closure is off", async () => {
    const b = bank(); await otp(b);
    await b.call("bank.deposits.open", { amount: 1000, term: 3, payout: "maturity", fromAccountId: "acc_main" });
    expect(await b.call("bank.deposits.close.quote", { depositId: "td2" })).toMatchObject({ earnedText: "$0.00", chargeText: "-$0.00", netText: "$1,000.00" });
    expect(await code(b.call("bank.deposits.close.quote", { depositId: "td1", earlyClose: false }))).toBe("EARLY_CLOSE_OFF");
    expect(await code(bank({ depositEarly: false }).call("bank.deposits.close.quote", { depositId: "td1", earlyClose: false }))).toBe("ok");
    expect(await code(b.call("bank.deposits.close.quote", { depositId: "nope" }))).toBe("DEPOSIT_NOT_FOUND");
  });
});

describe("savings goals", () => {
  const goal = { name: "New laptop", target: 2000, date: "2027-06-30", auto: { on: true, fromAccountId: "acc_main", amount: 250 } };
  it("lists the Holiday fund with what the Save tab shows", async () => {
    const g = (await bank().call("bank.goals.list")).g1;
    expect(g).toMatchObject({ name: "Holiday fund", sub: "$3,200.00 of $5,000.00", savedText: "$3,200.00", ofText: "of $5,000.00", pct: 64, byText: "By 30 Jun 2027", line: "By 30 Jun 2027 · $200.00 a month", autoText: "$200.00 a month", reached: false });
  });
  it("offers the next 36 month ends and plans what it takes: 2,000 by June 2027 is 8 months of 250.00", async () => {
    const m = Object.values<any>((await bank().call("bank.goals.months")).months);
    expect([m.length, m[0], m.at(-1)]).toEqual([36, { id: "2026-12-31", name: "December 2026" }, { id: "2029-11-30", name: "November 2029" }]);
    expect(await bank().call("bank.goals.plan", { target: 2000, date: "2027-06-30" })).toMatchObject({ months: 8, monthly: 250, monthlyText: "$250.00 a month", line: "To get there by 30 Jun 2027", suggested: 250 });
    // rounded up; the amount already saved is taken off; a target already reached needs nothing, and the smallest top-up is the one suggested
    expect((await bank().call("bank.goals.plan", { target: 2001, date: "2027-06-30" })).monthly).toBe(250.13);
    expect(await bank().call("bank.goals.plan", { target: 5000, date: "2027-06-30", saved: 3200 })).toMatchObject({ monthly: 225, remaining: 1800 });
    expect(await bank().call("bank.goals.plan", { target: 5000, date: "2027-06-30", saved: 5000 })).toMatchObject({ monthly: 0, suggested: 5, reachedAlready: true });
  });
  it("creates a goal with a monthly top-up that shows in the scheduled payments as Goal: New laptop; no code", async () => {
    const b = bank();
    const r = await b.call("bank.goals.create", goal);
    expect(r).toMatchObject({ goalId: "g2", name: "New laptop", targetText: "$2,000.00", byText: "30 Jun 2027", autoText: "$250.00 from Main" });
    expect(Object.keys(await b.call("bank.goals.list"))).toEqual(["g1", "g2"]);
    const s = Object.values<any>(await b.call("bank.schedule.list"));
    expect(s.map((x) => [x.name, x.sub, x.amountText, x.nextText])).toEqual([["Goal: Holiday fund", "Monthly · 1 Dec", "$200.00", "1 Dec 2026"], ["Goal: New laptop", "Monthly · 1 Dec", "$250.00", "1 Dec 2026"]]);
    // flat values work the same, and a goal with no top-up is not scheduled
    const c = await b.call("bank.goals.create", { name: "Bike", target: 300, date: "2027-01-31", autoOn: false });
    expect(c.autoText).toBe("Off");
    expect(Object.keys(await b.call("bank.schedule.list"))).toEqual(["goal:g1", "goal:g2"]);
  });
  it("checks the name, the target, the month, and the top-up", async () => {
    const b = bank(), make = (over: Record<string, unknown>) => b.call("bank.goals.create", { ...goal, dryRun: true, ...over });
    expect(await msg(make({ name: "A" }))).toBe("Use 2 to 30 characters.");
    expect(await msg(make({ name: "x".repeat(31) }))).toBe("Use 2 to 30 characters.");
    expect(await msg(make({ target: 20 }))).toBe("The smallest target is $50.00.");
    expect(await msg(make({ target: 2_000_000 }))).toBe("The largest target is $1,000,000.00.");
    expect(await code(make({ date: "" }))).toBe("DATE_REQUIRED");
    expect(await code(make({ date: "2027-06-15" }))).toBe("DATE_INVALID");
    expect(await code(make({ target: "" }))).toBe("AMOUNT_REQUIRED");
    expect(await msg(make({ auto: { on: true, fromAccountId: "acc_main", amount: 3 } }))).toBe("The smallest amount is $5.00.");
    expect(await msg(make({ auto: { on: true, fromAccountId: "acc_main", amount: "" } }))).toBe("Enter a monthly amount.");
    expect(await code(make({ auto: { on: true, fromAccountId: "", amount: 50 } }))).toBe("ACCOUNT_NOT_FOUND");
    expect(await code(make({ allowAuto: false }))).toBe("AUTO_OFF");
    expect(await code(make({ allowAuto: false, auto: { on: false } }))).toBe("ok");
    for (const over of [{ name: "A" }, { target: 20 }, { date: "" }, { auto: { on: true, fromAccountId: "acc_main", amount: 3 } }]) expect(await code(bank({ goalRules: false }).call("bank.goals.create", { ...goal, dryRun: true, ...over }))).toBe("ok");
  });
  it("refuses an eleventh goal", async () => {
    const b = bank();
    for (let i = 2; i <= 10; i++) await b.call("bank.goals.create", { name: `Goal ${i}`, target: 100, date: "2027-01-31" });
    expect(Object.keys(await b.call("bank.goals.list"))).toHaveLength(10);
    expect(await msg(b.call("bank.goals.create", { ...goal, dryRun: true }))).toBe("You can have up to 10 goals. Close one to add another.");
    expect(await code(b.call("bank.goals.create", goal))).toBe("GOAL_LIMIT");
    expect(await code(bank({ goalLimit: false }).call("bank.goals.create", goal))).toBe("ok");
    // editing is not limited
    expect(await code(b.call("bank.goals.update", { ...goal, goalId: "g1" }))).toBe("ok");
  });
  it("edits: the top-up is replaced, and switched off it is removed from the scheduled payments", async () => {
    const b = bank();
    await b.call("bank.goals.update", { goalId: "g1", name: "Holiday fund", target: 5000, date: "2027-06-30", auto: { on: true, fromAccountId: "acc_save", amount: 300 } });
    expect(Object.values<any>(await b.call("bank.schedule.list"))[0]).toMatchObject({ amountText: "$300.00", fromAccountId: "acc_save" });
    expect((await b.call("bank.goals.list")).g1.saved).toBe(3200);
    await b.call("bank.goals.update", { goalId: "g1", name: "Holiday fund", target: 5000, date: "2027-06-30", auto: { on: false } });
    expect(await b.call("bank.schedule.list")).toEqual({});
    expect(await code(b.call("bank.goals.update", { goalId: "nope", name: "Holiday fund", target: 5000, date: "2027-06-30" }))).toBe("GOAL_NOT_FOUND");
  });
  it("adds money from an account: saved rises, Activity shows To goal, no code; reaching the target says so; a goal can go above it", async () => {
    const b = bank(), r = await b.call("bank.goals.contribute", { goalId: "g1", amount: 100, fromAccountId: "acc_main" });
    expect(r).toMatchObject({ savedText: "$3,300.00 of $5,000.00", amountText: "$100.00", fromName: "Main ••4410", reached: false, reachedText: "" });
    expect([main(b).balance, main(b).available]).toEqual([8620.76, 8502.36]);
    expect(b.persona.retail!.transactions[0]).toMatchObject({ title: "To goal: Holiday fund", category: "Savings", amount: -100 });
    const full = await b.call("bank.goals.contribute", { goalId: "g1", amount: 1800, fromAccountId: "acc_main" });
    expect(full).toMatchObject({ reached: true, reachedText: "Holiday fund has reached its target." });
    expect(await b.call("bank.goals.contribute", { goalId: "g1", amount: 10, fromAccountId: "acc_save" })).toMatchObject({ savedText: "$5,110.00 of $5,000.00" });
    expect((await b.call("bank.goals.list")).g1).toMatchObject({ pct: 100, byText: "Goal reached" });
  });
  it("checks an amount to add: at least 1.00, covered by the account, an account that can pay", async () => {
    const add = (b: MockBank, over: Record<string, unknown>) => b.call("bank.goals.contribute", { goalId: "g1", amount: 100, fromAccountId: "acc_main", ...over });
    expect(await msg(add(bank(), { amount: 0.5 }))).toBe("The smallest amount is $1.00.");
    expect(await code(add(bank({ goalAmounts: false }), { amount: 0.5 }))).toBe("ok");
    expect(await msg(add(bank(), { amount: 9000 }))).toBe("Not enough money in Main. Available: $8,602.36.");
    expect(await code(add(bank(undefined, { conditions: { frozen: ["acc_main"] } }), {}))).toBe("ACCOUNT_CANNOT_DEBIT");
    expect(await code(add(bank(), { goalId: "nope" }))).toBe("GOAL_NOT_FOUND");
    expect(await code(add(bank(), { amount: "" }))).toBe("AMOUNT_REQUIRED");
  });
  it("takes money out up to what is saved, into an account; refused when it is off", async () => {
    const b = bank(), out = (over: Record<string, unknown>) => b.call("bank.goals.withdraw", { goalId: "g1", amount: 50, toAccountId: "acc_main", ...over });
    expect(await msg(out({ amount: 5000 }))).toBe("You only have $3,200.00 in this goal.");
    expect(await msg(out({ amount: 0.5 }))).toBe("The smallest amount is $1.00.");
    expect(await out({})).toMatchObject({ savedText: "$3,150.00 of $5,000.00", intoName: "Main ••4410" });
    expect(main(b).balance).toBe(8770.76);
    expect(b.persona.retail!.transactions[0]).toMatchObject({ title: "From goal: Holiday fund", amount: 50 });
    expect(await code(out({ allowWithdraw: false }))).toBe("WITHDRAW_OFF");
    expect(await code(bank({ withdrawOff: false }).call("bank.goals.withdraw", { goalId: "g1", amount: 50, toAccountId: "acc_main", allowWithdraw: false }))).toBe("ok");
    expect(await code(bank({ goalAmounts: false }).call("bank.goals.withdraw", { goalId: "g1", amount: 5000, toAccountId: "acc_main" }))).toBe("ok");
    expect(await code(bank(undefined, { conditions: { frozen: ["acc_main"] } }).call("bank.goals.withdraw", { goalId: "g1", amount: 50, toAccountId: "acc_main" }))).toBe("ACCOUNT_CANNOT_CREDIT");
    expect(await code(bank({ saveCredit: false }, { conditions: { frozen: ["acc_main"] } }).call("bank.goals.withdraw", { goalId: "g1", amount: 50, toAccountId: "acc_main" }))).toBe("ok");
  });
});

describe("loans", () => {
  const ask = { amount: 5000, term: 36, purpose: "Car", employment: "Employed", income: 5000, commitments: 300 };
  const decide = (b: MockBank, over: Record<string, unknown> = {}) => b.call("bank.loans.eligibility", { ...ask, ...over });
  it("lists the loan with what the Save tab shows: left, the share repaid, the next payment and its date", async () => {
    const l = (await bank().call("bank.loans.list")).ln1;
    expect(l).toMatchObject({ name: "Personal loan", leftText: "$9,600.00 left", pct: 40, pctText: "40% repaid", nextText: "Next payment $412.50 on 1 Dec 2026", sub: "$9,600.00 left · next payment 1 Dec 2026", outstanding: 9600, nextDue: "2026-12-01", paymentsLeft: 24 });
  });
  it("gives the table of rates, and with an amount and a term the checks of the first screen and the monthly payment (161.10 for 5,000 over 36 months)", async () => {
    const t = await bank().call("bank.loans.quote", {});
    expect(Object.values<any>(t.rates).map((r) => [r.term, r.rate])).toEqual([[12, 8.9], [24, 9.4], [36, 9.9], [48, 10.4], [60, 10.9]]);
    expect(Math.round(5000 * t.rates["36"].factor * 100) / 100).toBe(161.1);
    expect(await bank().call("bank.loans.quote", { amount: 5000, term: 36 })).toMatchObject({ rateText: "9.9% a year", paymentText: "$161.10", payment: 161.1 });
    expect(await code(bank().call("bank.loans.quote", { amount: 500, term: 36 }))).toBe("AMOUNT_RANGE");
    expect(await code(bank().call("bank.loans.quote", { amount: 60000, term: 36 }))).toBe("AMOUNT_RANGE");
    expect(await code(bank().call("bank.loans.quote", { amount: 5250, term: 36 }))).toBe("AMOUNT_STEP");
    expect(await code(bank().call("bank.loans.quote", { amount: 5000, term: 30 }))).toBe("TERM_INVALID");
    expect(await code(bank({ loanRange: false }).call("bank.loans.quote", { amount: 5250, term: 30 }))).toBe("ok");
  });
  it("approves 5,000 over 36 months at 9.9%: payment 161.10, interest 799.60, fee 50.00, total 5,849.60, first payment 3 Dec 2026", async () => {
    const r = await decide(bank());
    expect(r).toMatchObject({ decision: "approved", rate: 9.9, payment: 161.1, reason: "" });
    expect(r.offer).toEqual({ loanText: "$5,000.00", termText: "36 months", rateText: "9.9% a year", paymentText: "$161.10", interestText: "$799.60", fee: 50, feeText: "$50.00", totalText: "$5,849.60", firstText: "3 Dec 2026", payoutText: "$4,950.00" });
    expect((await decide(bank(), { arrFee: false })).offer).toMatchObject({ fee: 0, totalText: "$5,799.60", payoutText: "$5,000.00" });
    expect(r.reference).toMatch(/^LA-20261103-/);
  });
  it("declines a student, someone not working, or income below 1,000.00, with the income reason", async () => {
    for (const over of [{ employment: "Student" }, { employment: "Not working" }, { income: 800 }]) expect(await decide(bank(), over)).toMatchObject({ decision: "declined", reason: "income" });
    for (const over of [{ employment: "Student" }, { income: 800, commitments: 0 }]) expect((await decide(bank({ loanIncome: false }), over)).decision).toBe("approved");
  });
  it("declines payments above 50% of income with the affordability reason", async () => {
    expect(await decide(bank(), { amount: 50000, term: 12 })).toMatchObject({ decision: "declined", reason: "affordability" });
    expect((await decide(bank({ loanAffordability: false }), { amount: 50000, term: 12 })).decision).not.toBe("declined");
  });
  it("sends to review a request over 12 times the income, self-employed above 15,000, retired above 20,000 or payments above 40%; with referral off it is declined", async () => {
    expect(await decide(bank(), { employment: "Self-employed", amount: 20000, term: 60, income: 8000, commitments: 0 })).toMatchObject({ decision: "referred", reason: "review" });
    expect((await decide(bank(), { employment: "Self-employed", amount: 15000, term: 60, income: 8000, commitments: 0 })).decision).toBe("approved");
    expect((await decide(bank(), { employment: "Retired", amount: 20500, term: 60, income: 8000, commitments: 0 })).decision).toBe("referred");
    expect((await decide(bank(), { employment: "Retired", amount: 20000, term: 60, income: 8000, commitments: 0 })).decision).toBe("approved");
    // 12 times the income is allowed, 13 times is reviewed (the payment is small against the income, so only the multiple does it); payments over 40% of income are reviewed too
    expect((await decide(bank(), { amount: 12000, term: 60, income: 1000, commitments: 0 })).decision).toBe("approved");
    expect((await decide(bank(), { amount: 13000, term: 60, income: 1000, commitments: 0 })).decision).toBe("referred");
    expect((await decide(bank(), { amount: 5000, term: 36, income: 1000, commitments: 300 })).decision).toBe("referred");
    const off = await decide(bank(), { employment: "Self-employed", amount: 20000, term: 60, income: 8000, commitments: 0, allowReferral: false });
    expect([off.decision, off.reason]).toEqual(["declined", "affordability"]);
    for (const over of [{ employment: "Self-employed", amount: 20000, term: 60, income: 8000, commitments: 0 }, { amount: 13000, term: 60, income: 1000, commitments: 0 }]) expect((await decide(bank({ loanReferral: false }), over)).decision).toBe("approved");
  });
  it("adds a point to the rate when payments are above 35% of income: 10,000 over 12 months with 2,500 income is 9.9% and 878.69", async () => {
    expect(await decide(bank(), { amount: 10000, term: 12, income: 2500, commitments: 100 })).toMatchObject({ decision: "approved", rate: 9.9, payment: 878.69 });
    expect(await decide(bank({ loanRateRise: false }), { amount: 10000, term: 12, income: 2500, commitments: 100 })).toMatchObject({ rate: 8.9 });
  });
  it("checks what was typed on the work screen", async () => {
    expect(await code(decide(bank(), { purpose: "Holiday" }))).toBe("PURPOSE_INVALID");
    expect(await code(decide(bank(), { employment: "Pirate" }))).toBe("EMPLOYMENT_INVALID");
    expect(await msg(decide(bank(), { income: 0 }))).toBe("Enter your monthly income.");
    expect(await msg(decide(bank(), { income: 2_000_000 }))).toBe("Check this amount.");
    expect(await msg(decide(bank(), { commitments: -1 }))).toBe("Enter 0 or more.");
    expect(await msg(decide(bank(), { commitments: 2_000_000 }))).toBe("Check this amount.");
  });
  it("makes a loan only from the offer the bank approved, after the code: Car loan, the account credited with the loan less the fee", async () => {
    const b = bank(), apply = { amount: 5000, term: 36, rate: 9.9, accountId: "acc_main" };
    expect(await code(b.call("bank.loans.apply", apply))).toBe("OFFER_NOT_FOUND");
    await decide(b);
    expect(await code(b.call("bank.loans.apply", { ...apply, rate: 5 }))).toBe("OFFER_NOT_FOUND");
    expect(await code(b.call("bank.loans.apply", apply))).toBe("OTP_REQUIRED");
    await otp(b);
    const r = await b.call("bank.loans.apply", apply);
    expect(r).toMatchObject({ loanId: "ln2", name: "Car loan", paidIntoText: "Main ••4410", paymentText: "$161.10", feeText: "$50.00", firstText: "3 Dec 2026", paidOutText: "$4,950.00" });
    expect([main(b).balance, main(b).available]).toEqual([13670.76, 13552.36]);
    expect((await b.call("bank.loans.list")).ln2).toMatchObject({ name: "Car loan", outstanding: 5000, paymentsLeft: 36, nextDue: "2026-12-03", nextText: "Next payment $161.10 on 3 Dec 2026" });
    expect(b.persona.retail!.transactions[0]).toMatchObject({ title: "Loan paid out", amount: 4950 });
    // the offer is used once
    expect(await code(b.call("bank.loans.apply", apply))).toBe("OFFER_NOT_FOUND");
    // without the fee
    const c = bank(); await decide(c, { arrFee: false }); await otp(c);
    await c.call("bank.loans.apply", apply);
    expect(main(c).balance).toBe(13720.76);
    expect(await code(bank({ loanOffer: false }).call("bank.loans.apply", { ...apply, rate: 9.9, purpose: "Car", arrFee: false }))).toBe("OTP_REQUIRED");
    const d = bank({ loanCode: false }); await decide(d);
    expect(await code(d.call("bank.loans.apply", apply))).toBe("ok");
    expect(await code(bank(undefined, { conditions: { frozen: ["acc_main"] } }).call("bank.loans.apply", apply))).toBe("OFFER_NOT_FOUND");
  });
  it("a review or a decline creates no loan and moves no money, and a fourth loan is refused", async () => {
    const b = bank(), before = main(b).balance;
    await decide(b, { employment: "Student" }); await decide(b, { employment: "Self-employed", amount: 20000, term: 60, income: 8000, commitments: 0 });
    expect(Object.keys(await b.call("bank.loans.list"))).toEqual(["ln1"]);
    expect(main(b).balance).toBe(before);
    for (const n of [2, 3]) { await decide(b); await otp(b); await b.call("bank.loans.apply", { amount: 5000, term: 36, rate: 9.9, accountId: "acc_save" }); expect(Object.keys(await b.call("bank.loans.list"))).toHaveLength(n); }
    expect(await msg(b.call("bank.loans.quote", { amount: 5000, term: 36 }))).toBe("You already have the maximum number of loans.");
    expect(await code(decide(b))).toBe("LOAN_LIMIT");
    expect(await code(b.call("bank.loans.apply", { amount: 5000, term: 36, rate: 9.9, accountId: "acc_main" }))).toBe("LOAN_LIMIT");
    expect(await code(decide(bank({ loanLimit: false }), ask))).toBe("ok");
    const open = bank({ loanLimit: false }); for (const n of [2, 3, 4]) { await decide(open); await otp(open); expect(await code(open.call("bank.loans.apply", { amount: 5000, term: 36, rate: 9.9, accountId: "acc_save" }))).toBe("ok"); expect(Object.keys(await open.call("bank.loans.list"))).toHaveLength(n); }
  });
});

describe("paying a loan back", () => {
  const next = { loanId: "ln1", option: "next", fromAccountId: "acc_main" };
  it("shows what each way of paying costs: the next instalment, and settling with interest to date and the fee", async () => {
    const l = await bank().call("bank.loans.get", { loanId: "ln1" });
    expect(l).toMatchObject({ nextSub: "Due 1 Dec 2026", nextAmountText: "$412.50", interestText: "$79.20", principalText: "$333.30" });
    expect(l.settle).toMatchObject({ balanceText: "$9,600.00", interestText: "$5.21", feeText: "$96.00", totalText: "$9,701.21", sub: "Includes a $96.00 early settlement fee" });
    expect(await bank().call("bank.loans.settlement.quote", { loanId: "ln1" })).toMatchObject({ totalText: "$9,701.21" });
    expect((await bank().call("bank.loans.get", { loanId: "ln1", settleFee: false })).settle).toMatchObject({ feeText: "$0.00", totalText: "$9,605.21", sub: "No early settlement fee" });
    expect(await code(bank().call("bank.loans.get", { loanId: "x" }))).toBe("LOAN_NOT_FOUND");
  });
  it("pays the next instalment: 412.50 of which 333.30 is principal, so the balance is 9,266.70 and the next payment is 1 Jan 2027", async () => {
    const b = bank();
    expect(await b.call("bank.loans.repay", { ...next, dryRun: true })).toMatchObject({ paidText: "$412.50", balanceText: "$9,266.70", next: "1 Jan 2027" });
    expect(await code(b.call("bank.loans.repay", next))).toBe("OTP_REQUIRED");
    await otp(b);
    const r = await b.call("bank.loans.repay", next);
    expect(r).toMatchObject({ paidText: "$412.50", balanceText: "$9,266.70", next: "1 Jan 2027", resultText: "Your next payment is 1 Jan 2027.", fromName: "Main ••4410" });
    expect(main(b).balance).toBe(8308.26);
    expect((await b.call("bank.loans.list")).ln1).toMatchObject({ outstanding: 9266.7, nextDue: "2027-01-01", paymentsLeft: 23, lastPaid: "2026-11-03" });
    expect(b.persona.retail!.transactions[0]).toMatchObject({ title: "Loan payment: Personal loan", category: "Loans", amount: -412.5 });
    const f = bank({ repayPrincipal: false }); await otp(f); await f.call("bank.loans.repay", next);
    expect((await f.call("bank.loans.list")).ln1.outstanding).toBe(9187.5);
    expect(await code(bank({ repayCode: false }).call("bank.loans.repay", next))).toBe("ok");
  });
  it("pays another amount: the whole of it comes off the balance, and the date moves only from one instalment", async () => {
    const pay = (b: MockBank, amount: number) => b.call("bank.loans.repay", { loanId: "ln1", option: "custom", amount, fromAccountId: "acc_main" });
    const b = bank(); await otp(b);
    expect(await pay(b, 200)).toMatchObject({ balanceText: "$9,400.00", next: "1 Dec 2026", resultText: "$9,400.00 left to pay." });
    expect((await b.call("bank.loans.list")).ln1).toMatchObject({ outstanding: 9400, nextDue: "2026-12-01", paymentsLeft: 24 });
    await otp(b);
    expect(await pay(b, 450)).toMatchObject({ balanceText: "$8,950.00", next: "1 Jan 2027" });
    expect((await b.call("bank.loans.list")).ln1).toMatchObject({ nextDue: "2027-01-01", paymentsLeft: 23 });
    const c = bank({ repayDate: false }); await otp(c); await pay(c, 200);
    expect((await c.call("bank.loans.list")).ln1.nextDue).toBe("2027-01-01");
    const d = bank({ repayDate: false }); await otp(d); await d.call("bank.loans.repay", next);
    expect((await d.call("bank.loans.list")).ln1.nextDue).toBe("2027-01-01");
  });
  it("takes another amount from 10.00 to just below the balance", async () => {
    const pay = (b: MockBank, amount: unknown) => b.call("bank.loans.repay", { loanId: "ln1", option: "custom", amount, fromAccountId: "acc_main", dryRun: true });
    expect(await msg(pay(bank(), 5))).toBe("The smallest payment is $10.00.");
    expect(await msg(pay(bank(), 9600))).toBe("To pay everything off, choose Settle in full.");
    expect(await code(pay(bank(), 9599.99))).toBe("INSUFFICIENT_FUNDS");
    expect(await code(pay(bank(), ""))).toBe("AMOUNT_REQUIRED");
    expect(await code(pay(bank({ repayRange: false }), 5))).toBe("ok");
    expect(await code(pay(bank({ repayRange: false, saveFunds: false }), 9600))).toBe("ok");
    expect(await code(bank().call("bank.loans.repay", { loanId: "ln1", option: "weekly", fromAccountId: "acc_main" }))).toBe("OPTION_INVALID");
    expect(await code(bank().call("bank.loans.repay", { loanId: "nope", option: "next", fromAccountId: "acc_main" }))).toBe("LOAN_NOT_FOUND");
  });
  it("needs an account that can pay and holds the amount", async () => {
    expect(await msg(bank().call("bank.loans.settle", { loanId: "ln1", fromAccountId: "acc_main", dryRun: true }))).toBe("Not enough money in Main. Available: $8,602.36.");
    expect(await bank().call("bank.loans.settle", { loanId: "ln1", fromAccountId: "acc_save", dryRun: true })).toMatchObject({ paidText: "$9,701.21", balanceText: "$0.00", fromName: "Savings ••7731" });
    expect(await code(bank(undefined, { conditions: { frozen: ["acc_main"] } }).call("bank.loans.repay", next))).toBe("ACCOUNT_CANNOT_DEBIT");
  });
  it("settles: balance, interest since the last payment and the 1% fee when more than 12 payments are left; the loan is gone", async () => {
    const b = bank(), s = { loanId: "ln1", fromAccountId: "acc_save" };
    expect(await code(b.call("bank.loans.settle", s))).toBe("OTP_REQUIRED");
    await otp(b);
    const r = await b.call("bank.loans.settle", s);
    expect(r).toMatchObject({ paidText: "$9,701.21", feeText: "$96.00", interestText: "$5.21" });
    expect(b.persona.accounts.find((a) => a.id === "acc_save")!.balance).toBe(5553.16);
    expect(await b.call("bank.loans.list")).toEqual({});
    expect(b.persona.retail!.transactions[0]).toMatchObject({ title: "Loan payment: Personal loan", amount: -9701.21 });
    expect(await code(bank({ repayCode: false }).call("bank.loans.settle", s))).toBe("ok");
    expect((await bank({ settleInterest: false }).call("bank.loans.settlement.quote", { loanId: "ln1" })).total).toBe(9696);
  });
  it("has no early settlement fee with 12 payments left or the fee off; and the interest is of the days since the last payment", async () => {
    const b = bank(); await decideAndApply(b, 1000, 12);
    expect((await b.call("bank.loans.get", { loanId: "ln2" })).settle).toMatchObject({ feeText: "$0.00", sub: "No early settlement fee", interestText: "$0.00" });
    expect((await bank().call("bank.loans.get", { loanId: "ln1", settleFee: false })).settle.feeText).toBe("$0.00");
    expect((await bank({ settleFee: false }).call("bank.loans.get", { loanId: "ln1", settleFee: false })).settle.feeText).toBe("$96.00");
    expect((await bank({ settleFee: false }).call("bank.loans.get", { loanId: "ln2" }).catch(() => ({ settle: { feeText: "n/a" } }))).settle.feeText).toBe("n/a");
    const later = bank(undefined, { now: Date.parse("2026-11-21T10:00:00Z") });
    expect((await later.call("bank.loans.settlement.quote", { loanId: "ln1" })).interestText).toBe("$52.08");
  });
  it("pays a loan off with the last instalment, and a payment never takes more than what is owed", async () => {
    const b = bank(); await decideAndApply(b, 1000, 12);
    const l = b.persona.save!.loans.find((x) => x.id === "ln2")!; l.outstanding = 50; l.paymentsLeft = 1;
    await otp(b);
    // the instalment is 87.41, but what is owed is 50.00 and 0.37 of interest
    expect(await b.call("bank.loans.repay", { loanId: "ln2", option: "next", fromAccountId: "acc_main" })).toMatchObject({ paidText: "$50.37", balanceText: "$0.00", next: "" });
    expect(await b.call("bank.loans.list")).not.toHaveProperty("ln2");
  });
});

async function decideAndApply(b: MockBank, amount: number, term: number) {
  await b.call("bank.loans.eligibility", { amount, term, purpose: "Other", employment: "Employed", income: 5000, commitments: 0 });
  await b.call("bank.otp.send", {}); await b.call("bank.otp.verify", { code: "482100" });
  await b.call("bank.loans.apply", { amount, term, rate: term === 12 ? 8.9 : 9.9, accountId: "acc_main" });
}

describe("the funds and what is held", () => {
  const buy = (b: MockBank, over: Record<string, unknown> = {}) => b.call("bank.funds.buy", { fundId: "geq", amount: 200, fromAccountId: "acc_main", ...over });
  it("lists the four funds, by risk, and without the high-risk ones when they are off", async () => {
    const l = await bank().call("bank.funds.list", {});
    expect(Object.keys(l.funds.all)).toEqual(["gov", "bal", "geq", "tech"]);
    expect([Object.keys(l.funds.low), Object.keys(l.funds.medium), Object.keys(l.funds.high)]).toEqual([["gov"], ["bal"], ["geq", "tech"]]);
    expect(l.funds.all.geq).toMatchObject({ name: "Global Equity Fund", riskText: "High risk", chargeText: "0.85% a year", minText: "$100.00", priceText: "$27.50 per unit", sub: "Shares in large companies worldwide · from $100.00 · 0.85% a year · High risk" });
    const off = await bank().call("bank.funds.list", { allowHigh: false });
    expect([Object.keys(off.funds.all), off.count, off.funds.high]).toEqual([["gov", "bal"], 2, {}]);
    expect(await code(bank().call("bank.funds.get", { fundId: "nope" }))).toBe("FUND_NOT_FOUND");
  });
  it("shows the holdings and the portfolio: 4,820.00, up 170.00 (3.7%) on what was paid", async () => {
    const h = await bank().call("bank.funds.holdings");
    expect(Object.values<any>(h).map((x) => [x.id, x.unitsText, x.valueText, x.sub])).toEqual([["bal", "150", "$2,400.00", "150 units · $2,400.00"], ["geq", "88", "$2,420.00", "88 units · $2,420.00"]]);
    expect(await bank().call("bank.funds.portfolio")).toMatchObject({ count: 2, valueText: "$4,820.00", gain: 170, up: true, gainText: "▲ $170.00 (3.7%) since you invested" });
    expect(await new MockBank("sam").call("bank.funds.portfolio")).toMatchObject({ count: 0, valueText: "$0.00", gainText: "▲ $0.00 (0.0%) since you invested" });
    expect(await bank(undefined, { conditions: { empty: ["bank.funds.holdings"] } }).call("bank.funds.holdings")).toEqual({});
  });
  it("buys 200.00 of the Global Equity Fund: 7.273 units, about 1.70 of charge a year, the holding grows and the portfolio reads 5,020.01", async () => {
    const b = bank();
    expect(await buy(b, { dryRun: true })).toMatchObject({ unitsText: "7.273", chargeAbout: "about $1.70", chargeText: "0.85% a year", priceText: "$27.50 per unit", riskText: "High risk", fromName: "Main ••4410" });
    expect(await code(buy(b))).toBe("OTP_REQUIRED");
    await otp(b);
    const r = await buy(b);
    expect(r).toMatchObject({ unitsText: "7.273", amountText: "$200.00", name: "Global Equity Fund" });
    expect(r.reference).toMatch(/^INV-20261103-/);
    expect(main(b).balance).toBe(8520.76);
    expect((await b.call("bank.funds.holdings")).geq).toMatchObject({ units: 95.273, cost: 2550, valueText: "$2,620.01" });
    expect((await b.call("bank.funds.portfolio")).valueText).toBe("$5,020.01");
    expect(b.persona.retail!.transactions[0]).toMatchObject({ title: "Invested: Global Equity Fund", category: "Investing", amount: -200 });
    expect(b.persona.finance!.transactions[0]).toMatchObject({ title: "Invested: Global Equity Fund", category: "investing" });
    expect(await code(buy(bank({ investCode: false })))).toBe("ok");
  });
  it("starts a new holding for a fund not held, and refuses less than its smallest amount", async () => {
    const b = bank(); await otp(b);
    await buy(b, { fundId: "gov", amount: 50 });
    expect((await b.call("bank.funds.holdings")).gov).toMatchObject({ units: 4.762, cost: 50, valueText: "$50.00" });
    expect(await msg(buy(bank(), { amount: 50 }))).toBe("The smallest amount for this fund is $100.00.");
    expect(await code(buy(bank(), { fundId: "gov", amount: 49 }))).toBe("BELOW_MINIMUM");
    expect(await code(buy(bank({ fundMinimum: false }), { amount: 50 }))).toBe("OTP_REQUIRED");
    expect(await code(buy(bank(), { amount: 9000 }))).toBe("INSUFFICIENT_FUNDS");
    expect(await code(buy(bank(undefined, { conditions: { frozen: ["acc_main"] } })))).toBe("ACCOUNT_CANNOT_DEBIT");
    expect(await code(buy(bank(), { amount: "" }))).toBe("AMOUNT_REQUIRED");
  });
  it("closes high-risk funds to new money when they are off", async () => {
    expect(await msg(buy(bank(), { allowHigh: false }))).toBe("This fund is closed to new money.");
    expect(await code(buy(bank({ fundHigh: false }), { allowHigh: false }))).toBe("OTP_REQUIRED");
    expect(await code(buy(bank(), { fundId: "bal", allowHigh: false }))).toBe("OTP_REQUIRED");
  });
});

describe("selling", () => {
  const sell = (b: MockBank, over: Record<string, unknown> = {}) => b.call("bank.funds.sell", { fundId: "bal", all: true, toAccountId: "acc_main", ...over });
  it("sells everything: 2,400.00 less 6.00 is 2,394.00, arriving 5 Nov 2026; the holding is gone and the money is there at once", async () => {
    const b = bank();
    expect(await sell(b, { dryRun: true })).toMatchObject({ soldText: "$2,400.00", feeText: "-$6.00", proceedsText: "$2,394.00", settlesText: "5 Nov 2026", everything: true, intoName: "Main ••4410" });
    expect(await code(sell(b))).toBe("OTP_REQUIRED");
    await otp(b);
    const r = await sell(b);
    expect(r.reference).toMatch(/^SEL-20261103-/);
    expect(main(b).balance).toBe(11114.76);
    expect(Object.keys(await b.call("bank.funds.holdings"))).toEqual(["geq"]);
    expect(b.persona.retail!.transactions[0]).toMatchObject({ title: "Sold: Balanced Portfolio", category: "Investing", amount: 2394 });
    expect(await code(sell(bank({ sellCode: false })))).toBe("ok");
    expect((await sell(bank({ sellFee: false }), { dryRun: true })).feeText).toBe("-$0.00");
    expect(await sell(bank(), { dryRun: true, sellFee: false })).toMatchObject({ feeText: "-$0.00", proceedsText: "$2,400.00" });
    expect((await sell(bank({ sellSettle: false }), { dryRun: true })).settlesText).toBe("3 Nov 2026");
  });
  it("sells part: 100.00 of the Global Equity Fund pays 99.75 and leaves about 84.364 units, with the cost scaled down", async () => {
    const b = bank(); await otp(b);
    expect(await sell(b, { fundId: "geq", all: false, amount: 100 })).toMatchObject({ soldText: "$100.00", feeText: "-$0.25", proceedsText: "$99.75", everything: false });
    expect((await b.call("bank.funds.holdings")).geq).toMatchObject({ units: 84.364, cost: 2252.9 });
  });
  it("takes 10.00 up to the value of the holding", async () => {
    const part = (b: MockBank, amount: number) => sell(b, { fundId: "geq", all: false, amount, dryRun: true });
    expect(await msg(part(bank(), 5))).toBe("The smallest sale is $10.00.");
    expect(await msg(part(bank(), 3000))).toBe("You can’t sell more than $2,420.00.");
    expect(await code(part(bank(), 3000))).toBe("ABOVE_HOLDING");
    expect(await code(part(bank({ sellRange: false }), 5))).toBe("ok");
    expect(await code(part(bank({ sellRange: false }), 3000))).toBe("ok");
    expect((await part(bank(), 2420)).everything).toBe(true);
    expect(await code(sell(bank(), { fundId: "gov" }))).toBe("NOTHING_TO_SELL");
    expect(await code(sell(bank(), { fundId: "nope" }))).toBe("FUND_NOT_FOUND");
    expect(await code(sell(bank(undefined, { conditions: { frozen: ["acc_main"] } })))).toBe("ACCOUNT_CANNOT_CREDIT");
  });
  it("skips the weekend: a sale on Friday arrives on Tuesday", async () => {
    expect((await sell(bank(undefined, { now: Date.parse("2026-11-06T10:00:00Z") }), { dryRun: true })).settlesText).toBe("10 Nov 2026");
  });
});

describe("adding money from a card", () => {
  const top = { toAccountId: "acc_main", fromCardId: "c_4242", amount: 200, securityCode: "123" };
  const add = (b: MockBank, over: Record<string, unknown> = {}) => b.call("bank.deposit.create", { ...top, ...over });
  const saved = () => bank(undefined, { persona: "alexsave" });
  it("lists the cards that can be used, with their bank and expiry, and the expired ones apart", async () => {
    const c = await saved().call("bank.deposit.cards");
    expect(Object.values<any>(c.cards).map((x) => [x.id, x.name, x.sub])).toEqual([["c_4242", "Visa ••4242", "Harbor Bank · expires 09/28"], ["c_5100", "Mastercard ••5100", "Crest Bank · expires 03/29"]]);
    expect(c).toMatchObject({ count: 2, firstId: "c_4242", hasExpired: true, expired: ["Visa ••0019 · Expired"], expiredText: "Visa ••0019 · Expired" });
    expect(Object.values<any>((await bank().call("bank.deposit.cards")).cards)[0]).toMatchObject({ name: "Mastercard ••5832", sub: "Everyday · expires 11/28" });
    expect(await new MockBank("sam").call("bank.deposit.cards")).toMatchObject({ count: 0, hasExpired: false });
  });
  it("charges 203.00 for 200.00 (a 1.5% fee) and credits the 200.00 only, after the code; Activity says Card top-up", async () => {
    const b = saved();
    expect(await add(b, { dryRun: true })).toMatchObject({ amountText: "$200.00", feeText: "$3.00", chargedText: "$203.00", cardName: "Visa ••4242", toName: "Main ••4410" });
    expect(await code(add(b))).toBe("OTP_REQUIRED");
    await otp(b);
    const r = await add(b);
    expect(r).toMatchObject({ newBalance: 8920.76, chargedText: "$203.00" });
    expect(r.reference).toMatch(/^ADD-20261103-/);
    expect([main(b).balance, main(b).available]).toEqual([8920.76, 8802.36]);
    expect(b.persona.retail!.transactions[0]).toMatchObject({ title: "Card top-up", category: "Transfer", amount: 200 });
    expect(b.persona.finance!.transactions[0]).toMatchObject({ title: "Card top-up", amount: 200 });
    expect(await add(saved(), { dryRun: true, fee: false })).toMatchObject({ feeText: "$0.00", chargedText: "$200.00" });
    expect(await add(saved(), { dryRun: true }).then((x) => x.feeText)).toBe("$3.00");
    expect((await add(saved(), { dryRun: true, amount: 10 })).feeText).toBe("$0.15");
    expect((await add(bank({ topupFee: false }, { persona: "alexsave" }), { dryRun: true })).feeText).toBe("$0.00");
    expect(await code(add(bank({ topupCode: false }, { persona: "alexsave" })))).toBe("ok");
    // to another account
    const c = saved(); await otp(c);
    await add(c, { toAccountId: "acc_save" });
    expect(c.persona.accounts.find((a) => a.id === "acc_save")!.balance).toBe(15454.37);
  });
  it("takes 10.00 to 5,000.00, with at most two decimals", async () => {
    expect(await msg(add(saved(), { amount: 5, dryRun: true }))).toBe("The smallest amount is $10.00.");
    expect(await msg(add(saved(), { amount: 6000, dryRun: true }))).toBe("The most you can add at once is $5,000.00.");
    expect(await msg(add(saved(), { amount: 10.005, dryRun: true }))).toBe("Use up to 2 decimals.");
    expect(await code(add(bank({ topupRange: false }, { persona: "alexsave" }), { amount: 6000, dryRun: true }))).toBe("ok");
    expect(await code(add(bank({ topupRange: false }, { persona: "alexsave" }), { amount: 5, dryRun: true }))).toBe("ok");
    expect(await code(add(saved(), { amount: 5000, dryRun: true }))).toBe("ok");
  });
  it("refuses an expired card, a declined card, an unknown card and a wrong security code", async () => {
    expect(await msg(add(saved(), { fromCardId: "c_0019", dryRun: true }))).toBe("This card has expired. Choose another card.");
    expect(await code(add(bank({ topupCard: false }, { persona: "alexsave" }), { fromCardId: "c_0019", dryRun: true }))).toBe("ok");
    expect(await code(add(saved(), { fromCardId: "nope", dryRun: true }))).toBe("CARD_NOT_FOUND");
    const b = saved(); b.persona.finance!.cards.push({ id: "c_0000", network: "visa", last4: "0000", holder: "Alex Morgan", expiry: "12/29", nickname: "Visa", isDefault: false });
    expect(await msg(add(b, { fromCardId: "c_0000", dryRun: true }))).toBe("Your card was declined. Try another card.");
    expect(await code(add(bank({ topupCard: false }, { persona: "alexsave" }), { fromCardId: "c_0019", dryRun: true }))).toBe("ok");
    expect(await msg(add(saved(), { securityCode: "12", dryRun: true }))).toBe("Enter the 3 digits on the back of the card.");
    expect(await code(add(saved(), { securityCode: undefined, dryRun: true }))).toBe("CVV_INVALID");
    expect(await code(add(bank({ topupCvv: false }, { persona: "alexsave" }), { securityCode: "12", dryRun: true }))).toBe("ok");
    expect(await code(add(saved(), { allowCard: false, dryRun: true }))).toBe("CARD_OFF");
  });
  it("refuses an account that cannot receive money, and keeps no security code", async () => {
    expect(await msg(add(bank(undefined, { persona: "alexsave", conditions: { frozen: ["acc_main"] } }), { dryRun: true }))).toBe("This account can’t receive money right now. Choose another account.");
    expect(await code(add(bank({ saveCredit: false }, { persona: "alexsave", conditions: { frozen: ["acc_main"] } }), { dryRun: true }))).toBe("ok");
    expect(await code(add(saved(), { toAccountId: "nope", dryRun: true }))).toBe("ACCOUNT_NOT_FOUND");
    const b = saved(); await otp(b); await add(b);
    expect(JSON.stringify([b.persona.finance, b.persona.save])).not.toContain("123");
  });
});

describe("who may do it, and what is kept", () => {
  it("money-moving calls need payments.create, and a loan needs loans.apply; reading needs nothing", async () => {
    const b = bank(undefined, { conditions: { withoutPermissions: ["payments.create"] } });
    for (const [adapter, input] of [["bank.deposits.open", { amount: 1000, term: 12, fromAccountId: "acc_main" }], ["bank.goals.contribute", { goalId: "g1", amount: 10, fromAccountId: "acc_main" }], ["bank.goals.create", {}], ["bank.loans.repay", { loanId: "ln1", option: "next", fromAccountId: "acc_main" }], ["bank.funds.buy", { fundId: "bal", amount: 100, fromAccountId: "acc_main" }], ["bank.funds.sell", { fundId: "bal", all: true, toAccountId: "acc_main" }], ["bank.deposit.create", {}]] as [string, Record<string, unknown>][]) {
      expect(await code(b.call(adapter, input)), adapter).toBe("PERMISSION_DENIED");
    }
    expect(await code(b.call("bank.deposits.list"))).toBe("ok");
    expect(await code(b.call("bank.loans.list"))).toBe("ok");
    const c = bank(undefined, { conditions: { withoutPermissions: ["loans.apply"] } });
    expect(await code(c.call("bank.loans.eligibility", { amount: 5000, term: 36 }))).toBe("PERMISSION_DENIED");
    expect(await code(c.call("bank.loans.apply", {}))).toBe("PERMISSION_DENIED");
    expect(await code(c.call("bank.loans.quote", { amount: 5000, term: 36 }))).toBe("ok");
  });
  it("holds amounts in whole minor units: no sum drifts after many small payments", async () => {
    const b = bank();
    for (let i = 0; i < 30; i++) await b.call("bank.goals.contribute", { goalId: "g1", amount: 1.1, fromAccountId: "acc_main" });
    expect((await b.call("bank.goals.list")).g1.saved).toBe(3233);
    expect(main(b).balance).toBe(8687.76);
  });
  it("answers a deposit or goal for a customer with an interest of a different rounding the same way every time", async () => {
    const a = await bank().call("bank.deposits.quote", { amount: 1234.56, term: 6, fromAccountId: "acc_main" });
    expect(a.interestText).toBe("$23.46");
    expect(await bank().call("bank.deposits.quote", { amount: 1234.56, term: 6, fromAccountId: "acc_main" })).toEqual(a);
  });
});
