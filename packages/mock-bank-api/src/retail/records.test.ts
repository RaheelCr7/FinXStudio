import { describe, it, expect } from "vitest";
import { MockBank } from "../index";
import { loanSchedule } from "./alex";

const code = async (p: Promise<unknown>) => p.then(() => "no error", (e) => e.code as string);
const alex = () => { const b = new MockBank("alex"); b.now = () => Date.parse("2026-11-04T10:00:00Z"); return b; };

describe("Alex's accounts", () => {
  it("has USD current and savings, EUR and AED, each with a ledger balance and an available balance", async () => {
    const accs = Object.values(await alex().call("bank.accounts.list")) as any[];
    expect(accs.map((a) => [a.id, a.currency, a.balance, a.available])).toEqual([
      ["acc_main", "USD", 8720.76, 8602.36], ["acc_save", "USD", 15254.37, 15254.37], ["acc_eur", "EUR", 2400, 2400], ["acc_aed", "AED", 11000, 11000],
    ]);
    expect(accs.map((a) => a.kind)).toEqual(["current", "savings", "current", "current"]);
  });
  it("the pending item is the difference between available and ledger", async () => {
    const b = alex();
    const pending = Object.values(await b.call("bank.transactions.list", { accountId: "acc_main", status: "pending" })) as any[];
    expect(pending).toHaveLength(1);
    const main = await b.call("bank.accounts.get", { accountId: "acc_main" });
    expect(Math.round((main.balance - main.available) * 100) / 100).toBe(-pending[0].amount);
  });
  it("money out lowers both balances; a nickname can be set", async () => {
    const b = alex();
    await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" });
    await b.call("bank.transfers.create", { fromAccountId: "acc_main", amount: 20 });
    expect(await b.call("bank.accounts.get", { accountId: "acc_main" })).toMatchObject({ balance: 8700.76, available: 8582.36 });
    expect(await b.call("bank.accounts.rename", { accountId: "acc_main", nickname: "Everyday" })).toEqual({ accountId: "acc_main", nickname: "Everyday" });
    expect((await b.call("bank.accounts.list")).acc_main.nickname).toBe("Everyday");
    expect(await code(b.call("bank.accounts.rename", { accountId: "acc_main", nickname: "" }))).toBe("INVALID_NICKNAME");
    expect(await code(b.call("bank.accounts.rename", { accountId: "nope", nickname: "x" }))).toBe("ACCOUNT_NOT_FOUND");
  });
  it("a payment cannot spend what is on hold", async () => {
    const b = alex();
    await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" });
    expect(await code(b.call("bank.transfers.create", { fromAccountId: "acc_main", amount: 8650 }))).toBe("INSUFFICIENT_FUNDS");
  });
});

describe("transactions and statements", () => {
  it("lists newest first and filters by account, dates, direction, category, text and amount", async () => {
    const b = alex();
    const all = Object.values(await b.call("bank.transactions.list", { accountId: "acc_main" })) as any[];
    expect(all[0].date >= all[1].date).toBe(true);
    const inOct = Object.values(await b.call("bank.transactions.list", { accountId: "acc_main", from: "2026-10-01", to: "2026-10-31" })) as any[];
    expect(inOct.every((t) => t.date.startsWith("2026-10"))).toBe(true);
    expect((Object.values(await b.call("bank.transactions.list", { direction: "in" })) as any[]).every((t) => t.amount > 0)).toBe(true);
    expect((Object.values(await b.call("bank.transactions.list", { category: "Food" })) as any[]).map((t) => t.title)).toEqual(["Blue Bottle Café", "Green Grocer", "Café Central, Vienna", "Green Grocer"]);
    expect(Object.keys(await b.call("bank.transactions.list", { q: "salary" }))).toHaveLength(3);
    expect((Object.values(await b.call("bank.transactions.list", { minAmount: 1000 })) as any[]).every((t) => Math.abs(t.amount) >= 1000)).toBe(true);
    expect(Object.keys(await b.call("bank.transactions.list", { limit: 2 }))).toHaveLength(2);
    expect(await code(b.call("bank.transactions.list", { accountId: "nope" }))).toBe("ACCOUNT_NOT_FOUND");
  });
  it("a statement adds up: opening plus credits and debits is the closing balance, and the closing is the ledger balance for a period to today", async () => {
    const s = await alex().call("bank.statements.get", { accountId: "acc_main", from: "2026-10-01", to: "2026-10-31" });
    expect(s.opening + s.credits + s.debits).toBeCloseTo(s.closing, 2);
    expect(s).toMatchObject({ credits: 4212.4, count: 11 });
    const upToNow = await alex().call("bank.statements.get", { accountId: "acc_main", from: "2026-11-01", to: "2026-11-04" });
    expect(upToNow.closing).toBe(8720.76);
    expect(await code(alex().call("bank.statements.get", { accountId: "acc_main", from: "2026-11-05", to: "2026-11-01" }))).toBe("INVALID_DATE");
  });
});

describe("the rest of Alex's relationship", () => {
  it("cards: a debit and a credit card are active, a new one waits to be activated", async () => {
    const cards = Object.values(await alex().call("bank.cards.issued")) as any[];
    expect(cards.map((c) => [c.kind, c.last4, c.status])).toEqual([["debit", "4410", "active"], ["credit", "0873", "active"], ["debit", "2290", "inactive"]]);
    expect((await alex().call("bank.cards.get", { cardId: "card_credit" })).creditLimit).toBe(12_000);
    expect(await code(alex().call("bank.cards.get", { cardId: "x" }))).toBe("CARD_NOT_FOUND");
  });
  it("deposits, goals, loans with a schedule that pays off, profile, messages, notifications, requests", async () => {
    const b = alex();
    expect(Object.values(await b.call("bank.deposits.list")).map((d: any) => d.status)).toEqual(["active", "matured"]);
    expect(Object.values(await b.call("bank.goals.list")).map((g: any) => g.name)).toEqual(["Holiday", "Emergency fund"]);
    const loans = await b.call("bank.loans.list");
    expect(loans.loan_personal.schedule).toBeUndefined();
    const loan = await b.call("bank.loans.get", { loanId: "loan_personal" });
    expect(loan.schedule).toHaveLength(20);
    expect(loan.schedule.at(-1).balance).toBe(0);
    expect(loan.schedule.reduce((s: number, x: any) => s + x.principal, 0)).toBeCloseTo(7480, 2);
    expect(await code(b.call("bank.loans.get", { loanId: "x" }))).toBe("LOAN_NOT_FOUND");
    expect(await b.call("bank.profile.get")).toMatchObject({ name: "Alex Morgan", email: "alex.morgan@example.com" });
    expect(Object.keys(await b.call("bank.messages.list"))).toHaveLength(3);
    expect(Object.values(await b.call("bank.notifications.list", { context: "beta" })).map((n: any) => n.id)).toEqual(["n_1"]);
    expect(Object.keys(await b.call("bank.requests.list"))).toEqual(["REQ-5001"]);
  });
  it("records are for customers that have them", async () => {
    expect(await code(new MockBank("ayesha").call("bank.cards.issued"))).toBe("NOT_SUPPORTED");
  });
  it("an onboarding application is saved, resumed, and locked once sent", async () => {
    const b = alex();
    expect((await b.call("bank.applications.get", { applicationId: "APP-1001" }))).toMatchObject({ status: "draft", step: "address" });
    const saved = await b.call("bank.applications.save", { applicationId: "APP-1001", step: "identity", data: { city: "Springfield" } });
    expect(saved).toMatchObject({ status: "draft", step: "identity" });
    expect((await b.call("bank.applications.get", { applicationId: "APP-1001" })).data).toMatchObject({ firstName: "Alex", city: "Springfield" });
    const fresh = await b.call("bank.applications.save", { step: "start", productId: "current", data: {} });
    expect(fresh.applicationId).toBe("APP-1003");
    await b.call("bank.applications.save", { applicationId: fresh.applicationId, step: "status", submit: true });
    expect(await code(b.call("bank.applications.save", { applicationId: fresh.applicationId, step: "start" }))).toBe("APPLICATION_LOCKED");
    expect(await code(b.call("bank.applications.save", { applicationId: "APP-1002", step: "start" }))).toBe("APPLICATION_LOCKED");
    expect(await code(b.call("bank.applications.get", { applicationId: "x" }))).toBe("APPLICATION_NOT_FOUND");
  });
  it("loan schedules use even instalments", () => {
    const s = loanSchedule(1200, 0, 12, "2026-12-01", "USD");
    expect(s.monthlyPayment).toBe(100);
    expect(s.schedule[11]!.balance).toBe(0);
  });
});

describe("payments the sandbox did not have an access check on", () => {
  it("corp.payments.get with a userId must be someone who works for the company; without one it still answers (existing journeys)", async () => {
    const b = new MockBank("acme");
    b.now = () => Date.parse("2026-11-03T10:00:00Z");
    await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" });
    const p = await b.call("corp.payments.initiate", { userId: "sara", fromAccountId: "acme_ops", beneficiaryId: "sup_textile", amount: 1000 });
    expect((await b.call("corp.payments.get", { paymentId: p.id, userId: "layla" })).id).toBe(p.id);
    expect(await code(b.call("corp.payments.get", { paymentId: p.id, userId: "stranger" }))).toBe("NOT_AUTHORISED");
    expect((await b.call("corp.payments.get", { paymentId: p.id })).id).toBe(p.id);
  });
});
