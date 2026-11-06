import { describe, expect, it } from "vitest";
import { MockBank } from "../index";

// Alex Morgan on Tuesday 3 November 2026. What Invest and Sell investment need beyond save.test.ts: the check of a purchase or a sale through bank.funds.get, the holdings as a choice, and the one-time code on the older stock calls.
const NOW = Date.parse("2026-11-03T10:00:00Z");
const alex = () => new MockBank("alex", { now: NOW });
const code = (p: Promise<unknown>) => p.then(() => "ok", (e) => (e as { code?: string }).code ?? String(e));
const otp = async (b: MockBank) => { await b.call("bank.otp.send", {}); await b.call("bank.otp.verify", { code: "482100" }); };

describe("checking a purchase or a sale before the code", () => {
  it("bank.funds.get with an amount applies every rule of a purchase and buys nothing, with no code", async () => {
    const b = alex();
    expect(await b.call("bank.funds.get", { fundId: "geq", amount: 200, fromAccountId: "acc_main" })).toMatchObject({ unitsText: "7.273", amountText: "$200.00", chargeAbout: "about $1.70" });
    expect(await code(b.call("bank.funds.get", { fundId: "geq", amount: 50, fromAccountId: "acc_main" }))).toBe("BELOW_MINIMUM");
    expect(await code(b.call("bank.funds.get", { fundId: "geq", amount: 9000, fromAccountId: "acc_main" }))).toBe("INSUFFICIENT_FUNDS");
    expect(await code(b.call("bank.funds.get", { fundId: "geq", amount: 200, fromAccountId: "acc_main", allowHigh: false }))).toBe("FUND_CLOSED");
    expect(b.persona.accounts[0]!.balance).toBe(8720.76);
    // without an amount it is the fund itself
    expect(await b.call("bank.funds.get", { fundId: "geq" })).toMatchObject({ name: "Global Equity Fund", minText: "$100.00" });
  });
  it("bank.funds.get with sell: true applies every rule of a sale and sells nothing, with no code", async () => {
    const b = alex();
    expect(await b.call("bank.funds.get", { sell: true, fundId: "bal", all: true, toAccountId: "acc_main" })).toMatchObject({ soldText: "$2,400.00", feeText: "-$6.00", proceedsText: "$2,394.00", settlesText: "5 Nov 2026" });
    expect(await code(b.call("bank.funds.get", { sell: true, fundId: "gov", all: true, toAccountId: "acc_main" }))).toBe("NOTHING_TO_SELL");
    expect(await code(b.call("bank.funds.get", { sell: true, fundId: "geq", amount: 5, toAccountId: "acc_main" }))).toBe("SELL_BELOW");
    expect(await code(b.call("bank.funds.get", { sell: true, fundId: "geq", amount: 3000, toAccountId: "acc_main" }))).toBe("ABOVE_HOLDING");
    expect(Object.keys(await b.call("bank.funds.holdings"))).toEqual(["bal", "geq"]);
  });
  it("the holdings come as a choice with a count and the first, and the older stock calls need the code after their own checks", async () => {
    const b = alex();
    expect(await b.call("bank.funds.holdings", { pick: true })).toMatchObject({ count: 2, firstId: "bal" });
    expect((await new MockBank("sam").call("bank.funds.holdings", { pick: true }))).toEqual({ items: {}, count: 0, firstId: "" });
    expect(await code(b.call("bank.invest.buy", { symbol: "APXC", amount: 100, fromAccountId: "acc_main" }))).toBe("OTP_REQUIRED");
    expect(await code(b.call("bank.invest.buy", { symbol: "NOPE", amount: 100, fromAccountId: "acc_main" }))).toBe("INSTRUMENT_NOT_FOUND");
    await otp(b);
    expect(await code(b.call("bank.invest.buy", { symbol: "APXC", amount: 100, fromAccountId: "acc_main" }))).toBe("ok");
    // the code is spent
    expect(await code(b.call("bank.invest.buy", { symbol: "APXC", amount: 100, fromAccountId: "acc_main" }))).toBe("OTP_REQUIRED");
    expect(await code(b.call("bank.invest.sell", { symbol: "LMRB", amount: 10, toAccountId: "acc_main" }))).toBe("OTP_REQUIRED");
  });
});
