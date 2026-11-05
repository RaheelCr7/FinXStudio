import { describe, it, expect } from "vitest";
import { MockBank, type SandboxConditions } from "../index";
import { MARKETS, OPERATORS, TOPUP_NUMBER_DAILY, amountChoices, dayKey, normaliseNumber, numberCase, receiptDate, validNumber } from "./topup";

const NOW = Date.parse("2026-11-03T10:00:00Z");
const bank = async (persona = "alextopup", conditions?: SandboxConditions) => {
  const b = new MockBank(persona, { conditions });
  b.now = () => NOW;
  return b;
};
const verified = async (conditions?: SandboxConditions) => {
  const b = await bank("alextopup", conditions);
  await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" });
  return b;
};
const balance = async (b: MockBank, id: string) => (await b.call("bank.accounts.list"))[id].balance;
const top = (over: Record<string, unknown> = {}) => ({ operatorId: "aster", number: "5550123456", amount: 20, fromAccountId: "acc_main", ...over });

describe("the operators and the number rules", () => {
  it("offers three operators with the fixed amounts of the spec", () => {
    expect(OPERATORS.map((o) => [o.id, o.amounts])).toEqual([["aster", [5, 10, 20, 50]], ["bright", [10, 20, 30, 50]], ["cobalt", [5, 10, 25, 100]]]);
    expect(Object.values(amountChoices(OPERATORS[0]!)).map((c) => c.name)).toEqual(["$5.00", "$10.00", "$20.00", "$50.00"]);
  });
  it("checks a number against the market rule after taking away spaces, brackets and hyphens", () => {
    expect(normaliseNumber("(555) 012-3456")).toBe("5550123456");
    for (const [m, ok, bad] of [["A", "5550123456", "12345"], ["B", "07700900123", "0712345678"], ["C", "15112345678", "1234567"], ["D", "0501234567", "0601234567"]] as const) {
      expect(validNumber(m, ok), m).toBe(true);
      expect(validNumber(m, bad), m).toBe(false);
      expect(validNumber(m, MARKETS[m]!.sample), m).toBe(true);
    }
    expect(validNumber("C", "12345678")).toBe(true);
    expect(validNumber("C", "123456789012")).toBe(true);
    expect(validNumber("C", "1234567890123")).toBe(false);
  });
  it("lets the last four digits choose the outcome and writes the date as on a receipt", () => {
    expect([numberCase("5550120000"), numberCase("5550121111"), numberCase("5550123456")]).toEqual(["notFound", "unavailable", "normal"]);
    expect(receiptDate(NOW)).toBe("3 Nov 2026");
    expect(dayKey(NOW)).toBe("2026-11-03");
  });
});

describe("carriers and saved numbers", () => {
  it("lists the operators with their amounts, and one operator's amounts, for BankWorkx; Meezan keeps its carriers", async () => {
    const b = await bank();
    const all = await b.call("bank.carriers.list");
    expect(Object.keys(all)).toEqual(["aster", "bright", "cobalt"]);
    expect(Object.keys(all.cobalt.amounts)).toEqual(["5", "10", "25", "100"]);
    expect(Object.values(await b.call("bank.topup.amounts", { operatorId: "bright" })).map((c: any) => c.amount)).toEqual([10, 20, 30, 50]);
    await expect(b.call("bank.topup.amounts", { operatorId: "nope" })).rejects.toMatchObject({ code: "OPERATOR_NOT_FOUND" });
    expect(Object.keys(await (await bank("ayesha")).call("bank.carriers.list"))).toEqual(["jazz", "zong", "telenor", "ufone"]);
  });
  it("offers the saved numbers of the operator whose format fits the market", async () => {
    const b = await bank();
    expect(Object.values(await b.call("bank.topup.numbers", { operatorId: "aster" })).map((n: any) => [n.name, n.sub])).toEqual([["My phone", "•••• 3456"], ["Maya", "•••• 7654"]]);
    expect(Object.values(await b.call("bank.topup.numbers", { operatorId: "bright" })).map((n: any) => n.name)).toEqual(["Lena"]);
    expect(Object.keys(await b.call("bank.topup.numbers", { operatorId: "aster", market: "B" }))).toEqual([]);
  });
  it("saves a number under a name, once, and refuses one that does not fit the market", async () => {
    const b = await bank();
    await b.call("bank.topup.numbers", { operatorId: "cobalt", number: "(555) 000-2222", name: "Family" });
    await b.call("bank.topup.numbers", { operatorId: "cobalt", number: "5550002222", name: "Again" });
    expect(Object.values(await b.call("bank.topup.numbers", { operatorId: "cobalt" })).map((n: any) => [n.name, n.number])).toEqual([["Family", "5550002222"]]);
    await expect(b.call("bank.topup.numbers", { operatorId: "cobalt", number: "12345", name: "x" })).rejects.toMatchObject({ code: "NUMBER_INVALID", message: "Enter the 10-digit number." });
  });
  it("is for BankWorkx customers only", async () => {
    const m = await bank("ayesha");
    await expect(m.call("bank.topup.numbers", {})).rejects.toMatchObject({ code: "NOT_SUPPORTED" });
    await expect(m.call("bank.topup.check", top())).rejects.toMatchObject({ code: "NOT_SUPPORTED" });
    await expect(m.call("bank.topup.amounts", { operatorId: "aster" })).rejects.toMatchObject({ code: "NOT_SUPPORTED" });
  });
});

describe("checking a top-up", () => {
  it("accepts a good one and says what the review needs, without changing anything", async () => {
    const b = await bank();
    expect(await b.call("bank.topup.check", top({ number: "(555) 012-3456" }))).toMatchObject({ ok: true, operatorName: "Aster Mobile", last4: "3456", amount: 20, saved: true, left: 280 });
    expect(await b.call("bank.topup.check", top({ number: "5550001234" }))).toMatchObject({ saved: false });
    expect(await balance(b, "acc_main")).toBe(8720.76);
  });
  it("takes only the operator's own amounts", async () => {
    const b = await bank();
    for (const amount of [0, -5, 7, 100, 20.5, "x"]) await expect(b.call("bank.topup.check", top({ amount })), String(amount)).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
    await expect(b.call("bank.topup.check", top({ operatorId: "cobalt", amount: 100 }))).resolves.toMatchObject({ ok: true });
    await expect(b.call("bank.topup.check", top({ operatorId: "aster", amount: 100 }))).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
    await expect(b.call("bank.topup.check", top({ operatorId: "nope" }))).rejects.toMatchObject({ code: "OPERATOR_NOT_FOUND" });
  });
  it("refuses a number in the wrong format with the market's message, and one the operator cannot top up", async () => {
    const b = await bank();
    await expect(b.call("bank.topup.check", top({ number: "12345" }))).rejects.toMatchObject({ code: "NUMBER_INVALID", message: "Enter the 10-digit number." });
    await expect(b.call("bank.topup.check", top({ number: "0712345678", market: "B" }))).rejects.toMatchObject({ message: "Enter 11 digits, starting 07." });
    await expect(b.call("bank.topup.check", top({ number: "5550120000" }))).rejects.toMatchObject({ code: "NUMBER_NOT_FOUND", message: "We can’t top up this number. Check it and try again." });
    await expect(b.call("bank.topup.check", top({ number: "5550121111" }))).rejects.toMatchObject({ code: "OPERATOR_UNAVAILABLE", message: "The operator isn’t available right now. Try again later." });
  });
  it("refuses the account that cannot pay, a dollar-less account and not enough money", async () => {
    const b = await bank("alextopup", { frozen: ["acc_save"] });
    await expect(b.call("bank.topup.check", top({ fromAccountId: "nope" }))).rejects.toMatchObject({ code: "ACCOUNT_NOT_FOUND" });
    await expect(b.call("bank.topup.check", top({ fromAccountId: "acc_save" }))).rejects.toMatchObject({ code: "ACCOUNT_CANNOT_DEBIT" });
    await expect(b.call("bank.topup.check", top({ fromAccountId: "acc_eur" }))).rejects.toMatchObject({ code: "CURRENCY_NOT_SUPPORTED" });
    await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" });
    await b.call("bank.transfers.own", { fromAccountId: "acc_main", toAccountId: "acc_save", amount: 8715 });
    await expect(b.call("bank.topup.check", top({ amount: 5 }))).resolves.toMatchObject({ ok: true });
    await expect(b.call("bank.topup.check", top({ amount: 10 }))).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS", message: "Not enough in this account." });
  });
  it("refuses an amount over the daily limit of the account", async () => {
    const b = await bank("alextopup", { limitUsed: 49990 });
    await expect(b.call("bank.topup.check", top({ amount: 10 }))).resolves.toMatchObject({ ok: true });
    await expect(b.call("bank.topup.check", top({ amount: 20 }))).rejects.toMatchObject({ code: "LIMIT_EXCEEDED" });
  });
});

describe("topping up", () => {
  it("needs the one-time code first, and uses it up", async () => {
    const b = await bank();
    await expect(b.call("bank.topup.create", top())).rejects.toMatchObject({ code: "OTP_REQUIRED" });
    await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" });
    await b.call("bank.topup.create", top());
    await expect(b.call("bank.topup.create", top())).rejects.toMatchObject({ code: "OTP_REQUIRED" });
  });
  it("takes the amount once, moves the daily limit and writes it to Activity as a bill", async () => {
    const b = await verified();
    const r = await b.call("bank.topup.create", top());
    expect(r).toMatchObject({ reference: expect.stringMatching(/^TOP-\d{8}-09\d\d$/), newBalance: 8700.76, operatorName: "Aster Mobile", last4: "3456", amount: 20, date: "3 Nov 2026", saved: false });
    expect(await balance(b, "acc_main")).toBe(8700.76);
    expect((await b.call("bank.limits.get")).usedToday).toBe(20);
    const first: any = Object.values(await b.call("bank.activity.list"))[0];
    expect(first).toMatchObject({ title: "Aster Mobile top-up", category: "bills", amount: -20 });
  });
  it("does nothing when the core fails, the bank is unavailable or the call times out", async () => {
    const down = await verified({ transferFails: true });
    await expect(down.call("bank.topup.create", top())).rejects.toMatchObject({ code: "CORE_UNAVAILABLE" });
    expect(await balance(down, "acc_main")).toBe(8720.76);
    for (const c of [{ unavailable: ["bank.topup.create"] }, { timeout: ["bank.topup.create"], latencyMs: 10000 }]) {
      const b = await verified(c);
      await expect(b.call("bank.topup.create", top())).rejects.toMatchObject({ code: c.unavailable ? "SERVICE_UNAVAILABLE" : "TIMEOUT" });
      expect(await balance(b, "acc_main")).toBe(8720.76);
    }
  });
  it("refuses what the check refuses, at the payment too, and takes nothing", async () => {
    const b = await verified();
    await expect(b.call("bank.topup.create", top({ amount: 7 }))).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
    await expect(b.call("bank.topup.create", top({ number: "5550120000" }))).rejects.toMatchObject({ code: "NUMBER_NOT_FOUND" });
    expect(await balance(b, "acc_main")).toBe(8720.76);
  });
  it("keeps one number to $300.00 a day, and counts another day and another number separately", async () => {
    const b = new MockBank("alextopup");
    let t = NOW; b.now = () => t;
    const pay = async (over: Record<string, unknown> = {}) => { await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" }); return b.call("bank.topup.create", top({ amount: 50, ...over })); };
    for (let i = 0; i < TOPUP_NUMBER_DAILY / 50; i++) await pay();
    await expect(b.call("bank.topup.check", top({ amount: 50 }))).rejects.toMatchObject({ code: "TOPUP_LIMIT", message: "You’ve reached today’s top-up limit for this number." });
    await expect(pay()).rejects.toMatchObject({ code: "TOPUP_LIMIT" });
    expect(await balance(b, "acc_main")).toBe(8420.76);
    await expect(pay({ number: "5550987654" })).resolves.toMatchObject({ last4: "7654" });
    t += 24 * 3600 * 1000;
    await expect(pay()).resolves.toMatchObject({ amount: 50 });
  });
  it("saves the number under the name given, only when asked and only once", async () => {
    const b = await verified();
    expect(await b.call("bank.topup.create", top({ number: "5550002222", save: true, name: " Family " }))).toMatchObject({ saved: true });
    expect(Object.values(await b.call("bank.topup.numbers", { operatorId: "aster" })).map((n: any) => n.name)).toEqual(["My phone", "Maya", "Family"]);
    await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" });
    expect(await b.call("bank.topup.create", top({ number: "5550002222", save: true, name: "Again" }))).toMatchObject({ saved: false });
    await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" });
    expect(await b.call("bank.topup.create", top({ number: "5550003333" }))).toMatchObject({ saved: false });
    expect(Object.keys(await b.call("bank.topup.numbers", { operatorId: "aster" }))).toHaveLength(3);
  });
  it("leaves the Meezan top-up as it was: PKR 50 to 5,000 from any amount in that range", async () => {
    const m = await bank("ayesha");
    await m.call("bank.otp.send"); await m.call("bank.otp.verify", { code: "482100" });
    await expect(m.call("bank.topup.create", { fromAccountId: "acc_current", amount: 9000 })).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
    expect((await m.call("bank.topup.create", { fromAccountId: "acc_current", amount: 777 })).reference).toMatch(/^TOP-/);
  });
});

describe("the sandbox customer for top-ups", () => {
  it("has the Payments cast's four accounts and three saved numbers, and Activity is for BankWorkx only", async () => {
    const b = await bank();
    expect(Object.values(await b.call("bank.accounts.list")).map((a: any) => a.id)).toEqual(["acc_main", "acc_save", "acc_eur", "acc_aed"]);
    expect(Object.keys(await b.call("bank.topup.numbers"))).toEqual(["sn_phone", "sn_maya", "sn_lena"]);
    await expect((await bank("zara")).call("bank.activity.list")).rejects.toMatchObject({ code: "NOT_SUPPORTED" });
  });
});
