import { describe, it, expect } from "vitest";
import { MockBank, customerRate, midRate, FX_SPREAD } from "../index";

const verified = async (clock?: () => number) => {
  const b = new MockBank("hina"); if (clock) b.now = clock;
  await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" });
  return b;
};

describe("exchange rates", () => {
  it("gives the mid rate, and the customer's rate a little worse than it", () => {
    expect(midRate("USD", "PKR")).toBeCloseTo(278.5, 6);
    expect(midRate("PKR", "USD")).toBeCloseTo(1 / 278.5, 9);
    expect(customerRate("USD", "PKR")).toBe(277.1075); // 278.5 less 0.5%
    expect(customerRate("USD", "XYZ")).toBeUndefined();
    expect(FX_SPREAD).toBe(0.005);
  });
  it("answers a rate request, and refuses a pair it does not convert", async () => {
    const b = new MockBank("hina");
    const r = await b.call("bank.fx.rate", { from: "USD", to: "AED" });
    expect(r).toMatchObject({ from: "USD", to: "AED", spreadPercent: 0.5 });
    expect(r.rate).toBeCloseTo(3.654138, 6);
    expect(r.midRate).toBeCloseTo(3.6725, 6);
    await expect(b.call("bank.fx.rate", { from: "USD", to: "XYZ" })).rejects.toMatchObject({ code: "CURRENCY_NOT_SUPPORTED" });
  });
});

describe("quotes", () => {
  it("prices an amount to each currency's own decimals, with the fee in the currency sent", async () => {
    const b = new MockBank("hina");
    const q = await b.call("bank.fx.quote", { fromAccountId: "acc_usd", toAccountId: "acc_pkr", amount: 100 });
    expect(q).toMatchObject({ from: { currency: "USD", amount: 100 }, to: { currency: "PKR", amount: 27710.75 }, rate: 277.1075, fee: 0.2, feeCurrency: "USD", total: 100.2, ttlSeconds: 30 });
    const k = await b.call("bank.fx.quote", { fromAccountId: "acc_pkr", toAccountId: "acc_kwd", amount: 10000 });
    expect(k.to.currency).toBe("KWD");
    expect(Number.isInteger(k.to.amount * 1000)).toBe(true); // three decimals for dinars
    expect(k.fee).toBe(20);
  });
  it("is valid for thirty seconds", async () => {
    let t = Date.parse("2026-11-03T10:00:00Z");
    const b = new MockBank("hina"); b.now = () => t;
    const q = await b.call("bank.fx.quote", { fromAccountId: "acc_usd", toAccountId: "acc_pkr", amount: 10 });
    expect(q.expiresAt).toBe("2026-11-03T10:00:30.000Z");
  });
  it("refuses the same currency, a bad amount, an unknown account and too little money", async () => {
    const b = new MockBank("hina");
    await expect(b.call("bank.fx.quote", { fromAccountId: "acc_usd", toAccountId: "acc_usd", amount: 5 })).rejects.toMatchObject({ code: "SAME_CURRENCY" });
    await expect(b.call("bank.fx.quote", { fromAccountId: "acc_usd", toAccountId: "acc_pkr", amount: 0 })).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
    await expect(b.call("bank.fx.quote", { fromAccountId: "acc_usd", toAccountId: "acc_pkr", amount: 10.005 })).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
    await expect(b.call("bank.fx.quote", { fromAccountId: "nope", toAccountId: "acc_pkr", amount: 5 })).rejects.toMatchObject({ code: "ACCOUNT_NOT_FOUND" });
    await expect(b.call("bank.fx.quote", { fromAccountId: "acc_kwd", toAccountId: "acc_pkr", amount: 120.75 })).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" }); // the fee would take it over
  });
});

describe("converting", () => {
  it("needs the one-time code first", async () => {
    const b = new MockBank("hina");
    const q = await b.call("bank.fx.quote", { fromAccountId: "acc_usd", toAccountId: "acc_pkr", amount: 100 });
    await expect(b.call("bank.fx.convert", { quoteId: q.quoteId })).rejects.toMatchObject({ code: "OTP_REQUIRED" });
  });
  it("debits the amount and fee, credits the converted amount, and the quote works once", async () => {
    const b = await verified();
    const q = await b.call("bank.fx.quote", { fromAccountId: "acc_usd", toAccountId: "acc_pkr", amount: 100 });
    const r = await b.call("bank.fx.convert", { quoteId: q.quoteId });
    expect(r).toMatchObject({ from: { currency: "USD", newBalance: 4100.3 }, to: { currency: "PKR", newBalance: 347710.75 } });
    expect(r.reference).toMatch(/^FX-/);
    await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" });
    await expect(b.call("bank.fx.convert", { quoteId: q.quoteId })).rejects.toMatchObject({ code: "QUOTE_USED" });
    await expect(b.call("bank.fx.convert", { quoteId: "fxq_999" })).rejects.toMatchObject({ code: "QUOTE_NOT_FOUND" });
  });
  it("refuses a quote that has expired, and a fresh one works", async () => {
    let t = Date.parse("2026-11-03T10:00:00Z");
    const b = await verified(() => t);
    const q = await b.call("bank.fx.quote", { fromAccountId: "acc_usd", toAccountId: "acc_aed", amount: 50 });
    t += 31_000;
    await expect(b.call("bank.fx.convert", { quoteId: q.quoteId })).rejects.toMatchObject({ code: "QUOTE_EXPIRED" });
    const fresh = await b.call("bank.fx.quote", { fromAccountId: "acc_usd", toAccountId: "acc_aed", amount: 50 });
    expect(await b.call("bank.fx.convert", { quoteId: fresh.quoteId })).toMatchObject({ to: { currency: "AED" } });
  });
  it("does not touch the daily limits, which are for payments out", async () => {
    const b = await verified();
    const q = await b.call("bank.fx.quote", { fromAccountId: "acc_pkr", toAccountId: "acc_usd", amount: 5000 });
    await b.call("bank.fx.convert", { quoteId: q.quoteId });
    expect((await b.call("bank.limits.get")).usedToday).toBe(0);
  });
});
