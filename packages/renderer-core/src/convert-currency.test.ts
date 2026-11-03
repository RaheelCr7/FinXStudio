import { describe, it, expect } from "vitest";
import { convertCurrency, Journey } from "@finx/journey-schema";
import { MockBank } from "@finx/mock-bank-api";
import { JourneyRunner } from "./runner";
import { lintAll } from "./lint-expr";

const mk = (lang = "en") => {
  const bank = new MockBank("hina");
  const r = new JourneyRunner(Journey.parse(convertCurrency), { adapter: (id, input) => bank.call(id, input), lang });
  return { r, bank };
};
const press = async (r: JourneyRunner, label: string) => r.press((r.view().blocks.find((b) => b.type === "button" && b.label === label) as any).actions);
const rows = (r: JourneyRunner) => (r.view().blocks.find((b) => b.type === "reviewSummary") as any).rows as { label: string; value: string }[];
const upToReview = async (from = "acc_usd", to = "acc_pkr", amount = 100) => {
  const x = mk(); await x.r.start();
  x.r.set("conv.from", from); await press(x.r, "Continue");
  x.r.set("conv.to", to); await press(x.r, "Continue");
  x.r.set("conv.amount", amount); await press(x.r, "See the rate");
  return x;
};
const confirm = async (r: JourneyRunner, code = "482100") => {
  r.set("conv.consent", true); await press(r, "Confirm and send OTP");
  r.set("otp.code", code); await press(r, "Verify and convert");
};

describe("Convert between my accounts", () => {
  it("is lint clean", () => { expect(lintAll(Journey.parse(convertCurrency))).toEqual([]); });

  it("takes the amount in the currency of the account it leaves and shows the rate and fee before confirming", async () => {
    const x = mk(); await x.r.start();
    x.r.set("conv.from", "acc_kwd"); await press(x.r, "Continue");
    x.r.set("conv.to", "acc_usd"); await press(x.r, "Continue");
    const amount = x.r.view().blocks.find((b) => b.type === "amountInput") as any;
    expect([amount.currency, amount.decimals]).toEqual(["KWD", 3]);
    expect(amount.helper).toBe("Available: KWD 120.750");
    x.r.set("conv.amount", 50); await press(x.r, "See the rate");
    expect(x.r.current).toBe("review");
    expect(rows(x.r).map((r) => r.label)).toEqual(["From", "To", "You convert", "Rate", "Fee", "You get"]);
    expect(rows(x.r)[2]!.value).toBe("KWD 50");
    expect(rows(x.r)[4]!.value).toBe("KWD 0.100");
    expect(rows(x.r)[5]!.value).toMatch(/^\$\d/);
  });

  it("converts after the one-time code, moves the money and shows the receipt", async () => {
    const { r, bank } = await upToReview();
    expect(rows(r)).toContainEqual({ label: "You convert", value: "$100" });
    expect(rows(r)).toContainEqual({ label: "Rate", value: "1 USD = 277.1075 PKR" });
    expect(rows(r)).toContainEqual({ label: "Fee", value: "$0.20" });
    expect(rows(r)).toContainEqual({ label: "You get", value: "PKR 27,710.75" });
    await confirm(r);
    expect(r.current).toBe("success");
    const res = r.view().blocks.find((b) => b.type === "result") as any;
    expect(res.text).toBe("$100 became PKR 27,710.75.");
    expect(res.meta).toMatch(/^Ref FX-/);
    const accs = await bank.call("bank.accounts.list");
    expect([accs.acc_usd.balance, accs.acc_pkr.balance]).toEqual([4100.3, 347710.75]);
  });

  it("needs the confirmation ticked, and a right code", async () => {
    const { r } = await upToReview();
    await press(r, "Confirm and send OTP"); expect(r.current).toBe("review");
    r.set("conv.consent", true); await press(r, "Confirm and send OTP");
    r.set("otp.code", "999999"); await press(r, "Verify and convert");
    expect(r.current).toBe("otp"); expect(r.view().toast).toBe("Incorrect code");
  });

  it("ends with nothing converted when the rate has run out, and a new rate works", async () => {
    let t = Date.parse("2026-11-03T10:00:00Z");
    const x = mk(); x.bank.now = () => t; await x.r.start();
    x.r.set("conv.from", "acc_usd"); await press(x.r, "Continue"); x.r.set("conv.to", "acc_aed"); await press(x.r, "Continue");
    x.r.set("conv.amount", 50); await press(x.r, "See the rate");
    t += 31_000; // the customer took too long
    await confirm(x.r);
    expect(x.r.current).toBe("failed");
    expect((await x.bank.call("bank.accounts.list")).acc_usd.balance).toBe(4200.5);
    await press(x.r, "Try again"); expect(x.r.current).toBe("amount");
    await press(x.r, "See the rate"); expect(x.r.current).toBe("review");
    await confirm(x.r); expect(x.r.current).toBe("success");
  });

  it("stays on the amount with a message when the accounts are in the same currency, or the amount has too many places", async () => {
    const same = await upToReview("acc_usd", "acc_usd", 10);
    expect(same.r.current).toBe("amount"); expect(same.r.view().toast).toMatch(/different currencies/);
    const dec = mk(); await dec.r.start();
    dec.r.set("conv.from", "acc_kwd"); await press(dec.r, "Continue"); dec.r.set("conv.to", "acc_usd"); await press(dec.r, "Continue");
    dec.r.set("conv.amount", 12.5555); await press(dec.r, "See the rate");
    expect(dec.r.current).toBe("amount");
    expect(dec.r.errors["conv.amount"]).toBe("Use at most 3 decimal places");
  });

  it("reads in Urdu", async () => {
    const x = mk("ur"); await x.r.start();
    expect(x.r.view().title).toBe("کس اکاؤنٹ سے");
  });
});
