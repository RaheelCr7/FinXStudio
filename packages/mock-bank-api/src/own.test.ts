import { describe, it, expect } from "vitest";
import { MockBank, defaultPersonaFor, personasFor, type SandboxConditions } from "./index";

describe("choosing a customer to preview a conversion with", () => {
  it("picks one with accounts in more than one currency", () => {
    expect(defaultPersonaFor(personasFor("bankworkx"), [{ adapter: "bank.fx.quote" }]).id).toBe("alexglobal");
    expect(defaultPersonaFor(personasFor("meezan"), [{ adapter: "bank.fx.quote" }]).id).toBe("hina");
  });
});

const verified = async (conditions?: SandboxConditions) => {
  const b = new MockBank("alexglobal", { conditions });
  await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" });
  return b;
};
const balance = async (b: MockBank, id: string) => (await b.call("bank.accounts.list"))[id].balance;

describe("between my accounts, same currency", () => {
  it("needs the one-time code, and uses it up", async () => {
    const b = new MockBank("alexglobal");
    await expect(b.call("bank.transfers.own", { fromAccountId: "acc_main", toAccountId: "acc_save", amount: 10 })).rejects.toMatchObject({ code: "OTP_REQUIRED" });
    await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" });
    const r = await b.call("bank.transfers.own", { fromAccountId: "acc_main", toAccountId: "acc_save", amount: 10 });
    expect(r.reference).toMatch(/^TRX-/);
    await expect(b.call("bank.transfers.own", { fromAccountId: "acc_main", toAccountId: "acc_save", amount: 10 })).rejects.toMatchObject({ code: "OTP_REQUIRED" });
  });
  it("moves the exact amount with no fee and leaves the daily limit alone", async () => {
    const b = await verified();
    const r = await b.call("bank.transfers.own", { fromAccountId: "acc_main", toAccountId: "acc_save", amount: 200 });
    expect(r).toMatchObject({ from: { currency: "USD", newBalance: 8520.76 }, to: { currency: "USD", newBalance: 15454.37 } });
    expect((await b.call("bank.limits.get")).usedToday).toBe(0);
  });
  it("refuses the same account, an account that cannot send, other currencies, bad amounts and too little money", async () => {
    const b = await verified({ frozen: ["acc_save"] });
    const move = (o: Record<string, unknown>) => b.call("bank.transfers.own", { fromAccountId: "acc_main", toAccountId: "acc_save", amount: 5, ...o });
    await expect(move({ toAccountId: "acc_main" })).rejects.toMatchObject({ code: "SAME_ACCOUNT" });
    await expect(move({ fromAccountId: "acc_save", toAccountId: "acc_main" })).rejects.toMatchObject({ code: "ACCOUNT_CANNOT_DEBIT" });
    await expect(move({ toAccountId: "acc_eur" })).rejects.toMatchObject({ code: "CURRENCY_MISMATCH" });
    await expect(move({ toAccountId: "nope" })).rejects.toMatchObject({ code: "ACCOUNT_NOT_FOUND" });
    await expect(move({ amount: 0 })).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
    await expect(move({ amount: 1.005 })).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
    await expect(move({ amount: 9000 })).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" });
    await expect(move({ amount: 5 })).resolves.toMatchObject({ to: { newBalance: 15259.37 } }); // a frozen account can still receive
  });
  it("fails with CORE_UNAVAILABLE after the code when the core is down", async () => {
    const b = await verified({ transferFails: true });
    await expect(b.call("bank.transfers.own", { fromAccountId: "acc_main", toAccountId: "acc_save", amount: 5 })).rejects.toMatchObject({ code: "CORE_UNAVAILABLE" });
  });
});

describe("test conditions", () => {
  it("a timeout and an unavailable service apply nothing", async () => {
    const b = await verified({ timeout: ["bank.transfers.own"], latencyMs: 10000, unavailable: ["bank.fx.quote"] });
    await expect(b.call("bank.transfers.own", { fromAccountId: "acc_main", toAccountId: "acc_save", amount: 5 })).rejects.toMatchObject({ code: "TIMEOUT" });
    await expect(b.call("bank.fx.quote", { fromAccountId: "acc_main", toAccountId: "acc_eur", amount: 5 })).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    expect(await balance(b, "acc_main")).toBe(8720.76);
  });
  it("a slow answer inside the limit still arrives, and time moves on", async () => {
    const b = await verified({ timeout: ["bank.transfers.own"], latencyMs: 4000 });
    const t = b.now();
    await b.call("bank.transfers.own", { fromAccountId: "acc_main", toAccountId: "acc_save", amount: 5 });
    expect(b.now() - t).toBe(4000);
  });
});

describe("BankWorkx conversions", () => {
  const quote = (b: MockBank, o: Record<string, unknown>) => b.call("bank.fx.quote", { fromAccountId: "acc_main", toAccountId: "acc_eur", ...o });
  it("quotes the mid-market rate with no margin and a 0.20% fee", async () => {
    const b = new MockBank("alexglobal");
    expect(await quote(b, { amount: 500 })).toMatchObject({ midRate: 0.926, rate: 0.926, fee: 1, total: 501, from: { amount: 500 }, to: { amount: 463 } });
    expect(await b.call("bank.fx.rate", { from: "USD", to: "AED" })).toMatchObject({ spreadPercent: 0, rate: 3.672 });
    expect(await b.call("bank.fx.quote", { fromAccountId: "acc_eur", toAccountId: "acc_aed", amount: 100 })).toMatchObject({ rate: 3.965443, fee: 0.2, total: 100.2, to: { amount: 396.54 } });
  });
  it("works out the amount to send when the person types what they get, rounding up to the next cent", async () => {
    const b = new MockBank("alexglobal");
    expect(await quote(b, { amount: 463, direction: "get" })).toMatchObject({ from: { amount: 500 }, to: { amount: 463 }, fee: 1 });
    expect(await quote(new MockBank("alexglobal"), { amount: 100, direction: "get" })).toMatchObject({ from: { amount: 108 }, to: { amount: 100 }, fee: 0.22, total: 108.22 });
  });
  it("can leave the fee out when the bank option says so", async () => {
    expect(await quote(new MockBank("alexglobal"), { amount: 500, feeWaived: true })).toMatchObject({ fee: 0, total: 500 });
  });
  it("a renewed quote of the same pair shows the market a little moved, within 0.04%", async () => {
    const b = new MockBank("alexglobal");
    const first = await quote(b, { amount: 500 }), second = await quote(b, { amount: 500 });
    expect(second.rate).not.toBe(first.rate);
    expect(Math.abs(second.rate / first.rate - 1)).toBeLessThanOrEqual(0.0004);
  });
  it("refuses an account that cannot send", async () => {
    await expect(quote(new MockBank("alexglobal", { conditions: { frozen: ["acc_main"] } }), { amount: 5 })).rejects.toMatchObject({ code: "ACCOUNT_CANNOT_DEBIT" });
  });
  it("keeps the reference bank's 0.5% spread for other customers", async () => {
    const b = new MockBank("hina");
    expect(await b.call("bank.fx.rate", { from: "USD", to: "AED" })).toMatchObject({ spreadPercent: 0.5 });
  });
});
