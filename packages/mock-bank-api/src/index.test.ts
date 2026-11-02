import { describe, it, expect } from "vitest";
import { MockBank, BankError } from "./index";

describe("mock bank sandbox", () => {
  it("lists accounts and limits for Ayesha", async () => {
    const b = new MockBank("ayesha");
    const accs = await b.call("bank.accounts.list");
    expect(Object.keys(accs)).toEqual(["acc_current", "acc_savings"]);
    expect((await b.call("bank.limits.get")).daily).toBe(50000);
  });
  it("requires OTP before a transfer", async () => {
    const b = new MockBank("ayesha");
    await expect(b.call("bank.transfers.create", { fromAccountId: "acc_current", amount: 100 })).rejects.toMatchObject({ code: "OTP_REQUIRED" });
  });
  it("moves money and consumes limit after OTP", async () => {
    const b = new MockBank("ayesha");
    await b.call("bank.otp.send");
    await b.call("bank.otp.verify", { code: "482100" });
    const r = await b.call("bank.transfers.create", { fromAccountId: "acc_current", amount: 25000 });
    expect(r.newBalance).toBe(159250);
    expect((await b.call("bank.limits.get")).usedToday).toBe(25000);
  });
  it("rejects a wrong OTP", async () => {
    const b = new MockBank("ayesha");
    await b.call("bank.otp.send");
    await expect(b.call("bank.otp.verify", { code: "999999" })).rejects.toBeInstanceOf(BankError);
  });
  it("Bilal's transfer fails at the core", async () => {
    const b = new MockBank("bilal");
    await b.call("bank.otp.send");
    await b.call("bank.otp.verify", { code: "111111" });
    await expect(b.call("bank.transfers.create", { fromAccountId: "acc_current", amount: 1000 })).rejects.toMatchObject({ code: "CORE_UNAVAILABLE" });
  });

  it("looks up a bill by reference and rejects a malformed one", async () => {
    const b = new MockBank("ayesha");
    const bill = await b.call("bank.bills.lookup", { billerId: "k_electric", reference: "0123456789" });
    expect(bill).toMatchObject({ billerName: "K-Electric", payerName: "Ayesha Rahman", amount: 1000 + (6789 % 9000) });
    await expect(b.call("bank.bills.lookup", { billerId: "k_electric", reference: "12" })).rejects.toMatchObject({ code: "BILL_NOT_FOUND" });
  });
  it("pays a bill only after OTP and uses the daily limit", async () => {
    const b = new MockBank("ayesha");
    await expect(b.call("bank.bills.pay", { fromAccountId: "acc_current", amount: 5000 })).rejects.toMatchObject({ code: "OTP_REQUIRED" });
    await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" });
    const r = await b.call("bank.bills.pay", { fromAccountId: "acc_current", amount: 7789 });
    expect(r.reference).toMatch(/^BILL-/);
    expect((await b.call("bank.limits.get")).usedToday).toBe(7789);
  });
  it("top-up enforces the 50 to 5,000 range", async () => {
    const b = new MockBank("ayesha");
    await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" });
    await expect(b.call("bank.topup.create", { fromAccountId: "acc_current", amount: 9000 })).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
    expect((await b.call("bank.topup.create", { fromAccountId: "acc_current", amount: 500 })).reference).toMatch(/^TOP-/);
  });
});
