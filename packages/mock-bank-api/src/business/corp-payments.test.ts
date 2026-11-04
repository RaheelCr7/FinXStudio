import { describe, it, expect } from "vitest";
import { MockBank } from "../index";
import { DOMESTIC_RAILS, railsFor, speedsFor, type Offer } from "../retail/payments";

// Wednesday 4 November 2026, ten in the morning (UTC)
const NOW = Date.parse("2026-11-04T10:00:00Z");
const make = (opts: ConstructorParameters<typeof MockBank>[1] = {}) => { const b = new MockBank("alex", opts); let t = NOW; b.now = () => t; return { b, tick: (ms: number) => { t += ms; } }; };
const code = async (p: Promise<unknown>) => p.then(() => "no error", (e) => e.code as string);
const verify = async (b: MockBank) => { await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" }); };
const enter = async (b: MockBank, id: string) => { await b.call("bank.session.stepUp", { method: "password", secret: "Bwx!Demo2026" }).catch(() => undefined); await verify(b); await b.call("bank.session.stepUp", { method: "password" }); await b.call("bank.session.switch", { contextId: id }); };
const pay = { fromAccountId: "alpha_ops", beneficiaryId: "harb", purpose: "Goods or services", reference: "INV-1042" };

describe("corp.payments.quote and corp.payments.create", () => {
  it("12,500 to a US supplier: no code, one approver, waits for approval and moves no money", async () => {
    const { b } = make();
    await enter(b, "alpha");
    const q = await b.call("corp.payments.quote", { ...pay, amount: 12_500 });
    expect(q).toMatchObject({ type: "domestic", speed: "standard", total: 12_500, fee: 0, currency: "USD", codeRequired: false, requiredApprovers: 1, ttlSeconds: 60, converted: false });
    const p = await b.call("corp.payments.create", { quoteId: q.quoteId });
    expect(p).toMatchObject({ status: "pending_approval", initiatedBy: "alex", required: 1, payee: "Harbour Packaging", amount: 12_500, speed: "standard", rail: { id: "ach" }, purpose: "Goods or services", arrives: "1 to 2 business days" });
    expect(p.id).toBe("PAY-2042");
    expect((await b.call("corp.company.get")).accounts.alpha_ops.balance).toBe(480_000);
    expect((await b.call("corp.payments.get", { paymentId: p.id })).railReference).toBe("ACH-00002042");
  });
  it("60,000: standard is over its limit so the first speed that fits is used; two approvers; a code is asked from 25,000", async () => {
    const { b } = make();
    await enter(b, "alpha");
    const q = await b.call("corp.payments.quote", { ...pay, amount: 60_000 });
    expect(q).toMatchObject({ speed: "sameDay", fee: 1, total: 60_001, requiredApprovers: 2, codeRequired: true });
    expect(q.speeds.standard).toMatchObject({ usable: false, reason: "Over the limit" });
    expect(await code(b.call("corp.payments.create", { quoteId: q.quoteId }))).toBe("OTP_REQUIRED");
    await verify(b);
    expect((await b.call("corp.payments.create", { quoteId: q.quoteId })).required).toBe(2);
    expect(await code(b.call("corp.payments.quote", { ...pay, amount: 60_000, speed: "standard" }))).toBe("RAIL_LIMIT");
  });
  it("a euro supplier is paid abroad: the conversion is in the quote and the limits are tested on the dollar total", async () => {
    const { b } = make();
    await enter(b, "alpha");
    const q = await b.call("corp.payments.quote", { fromAccountId: "alpha_ops", beneficiaryId: "nord", amount: 30_000, purpose: "Goods or services", reference: "INV-7" });
    expect(q).toMatchObject({ type: "international", receive: { amount: 30_000, currency: "EUR" }, rate: 0.926, converted: true, pay: 32_397.41, fee: 25, total: 32_422.41, codeRequired: true });
    expect(await code(b.call("corp.payments.quote", { fromAccountId: "alpha_ops", beneficiaryId: "nord", amount: 30_000, purpose: "Goods or services", reference: "x", chargeBearer: "ours" }))).toBe("no error");
  });
  it("purpose and reference are always required; limits, funds and the approved list are checked", async () => {
    const { b } = make();
    await enter(b, "alpha");
    expect(await code(b.call("corp.payments.quote", { ...pay, amount: 10, purpose: undefined }))).toBe("PURPOSE_REQUIRED");
    expect(await code(b.call("corp.payments.quote", { ...pay, amount: 10, reference: " " }))).toBe("REFERENCE_REQUIRED");
    expect(await code(b.call("corp.payments.quote", { ...pay, amount: 0.001 }))).toBe("INVALID_AMOUNT");
    expect(await code(b.call("corp.payments.quote", { ...pay, amount: 600_000 }))).toBe("INSUFFICIENT_FUNDS");
    expect(await code(b.call("corp.payments.quote", { ...pay, amount: 240_000 }))).toBe("LIMIT_USER_EXCEEDED"); // 18,900 already used today
    expect(await code(b.call("corp.payments.quote", { ...pay, beneficiaryId: "someone-new", amount: 10 }))).toBe("BENEFICIARY_NOT_WHITELISTED");
    expect(await code(b.call("corp.payments.quote", { ...pay, fromAccountId: "alpha_res", amount: 10 }))).toBe("CURRENCY_NOT_SUPPORTED");
  });
  it("a quote cannot be used late or twice; a rail that is down refuses at the quote and at the send", async () => {
    const { b, tick } = make();
    await enter(b, "alpha");
    const q = await b.call("corp.payments.quote", { ...pay, amount: 100 });
    tick(61_000);
    expect(await code(b.call("corp.payments.create", { quoteId: q.quoteId }))).toBe("QUOTE_EXPIRED");
    const q2 = await b.call("corp.payments.quote", { ...pay, amount: 100 });
    await b.call("corp.payments.create", { quoteId: q2.quoteId });
    expect(await code(b.call("corp.payments.create", { quoteId: q2.quoteId }))).toBe("QUOTE_USED");
    const q3 = await b.call("corp.payments.quote", { ...pay, amount: 100 });
    b.conditions = { unavailable: ["rail:ach"] };
    expect(await code(b.call("corp.payments.create", { quoteId: q3.quoteId }))).toBe("RAIL_NOT_AVAILABLE");
    expect(await code(b.call("corp.payments.quote", { ...pay, amount: 100, speed: "standard" }))).toBe("RAIL_NOT_AVAILABLE");
  });
  it("another context's quote is not Alex's to use; the timeout condition sends nothing", async () => {
    const { b } = make();
    await enter(b, "alpha");
    const q = await b.call("corp.payments.quote", { ...pay, amount: 100 });
    b.conditions = { timeout: ["corp.payments.create"] };
    expect(await code(b.call("corp.payments.create", { quoteId: q.quoteId }))).toBe("TIMEOUT");
    expect(Object.keys(await b.call("corp.payments.pending", { as: "initiator" }))).toEqual(["PAY-2040"]);
    b.conditions = {};
    await b.call("bank.session.switch", { contextId: "beta" });
    expect(await code(b.call("corp.payments.create", { quoteId: q.quoteId }))).toBe("PERMISSION_DENIED");
  });
});

describe("the bank's home market decides the rails behind the speed classes", () => {
  const OFFER: Offer = { standard: true, sameDay: true, instant: true, priority: false };
  it("each home market maps Standard, Same day and Instant to its own rails", () => {
    const ids = (m: Parameters<typeof railsFor>[0]) => speedsFor("domestic", 100, OFFER, [], false, railsFor(m)).map((s) => `${s.speed}:${s.id}`);
    expect(ids("us")).toEqual(["standard:ach", "sameDay:sach", "instant:rtp"]);
    expect(ids("uk")).toEqual(["standard:bacs", "sameDay:chaps", "instant:fps"]);
    expect(ids("eu")).toEqual(["standard:sct", "instant:sinst"]);
    expect(ids("ae")).toEqual(["standard:uaefts", "instant:aani"]);
    expect(Object.keys(DOMESTIC_RAILS)).toEqual(["us", "uk", "eu", "ae", "sa", "jo"]);
    expect(railsFor("uk").international).toBe(railsFor("us").international);
  });
  it("a supplier in the home market is paid over its rails, one elsewhere abroad", async () => {
    const whit = { fromAccountId: "alpha_ops", beneficiaryId: "whit", purpose: "Goods or services", reference: "F-1", amount: 1000 };
    const us = make(); await enter(us.b, "alpha");
    expect(await us.b.call("corp.payments.quote", whit)).toMatchObject({ type: "international", speed: "standard", fee: 25 });
    const uk = make({ config: { homeMarket: "uk" } }); await enter(uk.b, "alpha");
    expect(await uk.b.call("corp.payments.quote", whit)).toMatchObject({ type: "domestic", speed: "standard", fee: 0, arrives: "3 business days", receive: { currency: "GBP" } });
    const harb = await uk.b.call("corp.payments.quote", { ...whit, beneficiaryId: "harb" });
    expect(harb.type).toBe("international");
  });
  it("a personal payment follows the home market too", async () => {
    const { b } = make({ config: { homeMarket: "uk" } });
    const q = await b.call("bank.payments.quote", { fromAccountId: "acc_main", payeeId: "ben_jamie", receiveAmount: 100, sendType: "domestic" });
    expect(q.speeds).toHaveProperty("instant");
    expect(q.speeds.standard.sub).toContain("3 business days");
  });
});

describe("payments from an account with money on hold", () => {
  it("a payment to someone else lowers the ledger and the available balance together", async () => {
    const { b } = make();
    const q = await b.call("bank.payments.quote", { fromAccountId: "acc_main", payeeId: "ben_jamie", receiveAmount: 100, sendType: "domestic", speed: "standard" });
    await verify(b);
    await b.call("bank.payments.create", { quoteId: q.quoteId });
    expect(await b.call("bank.accounts.get", { accountId: "acc_main" })).toMatchObject({ balance: 8620.76, available: 8502.36 });
  });
});
