import { describe, it, expect } from "vitest";
import { MockBank, type SandboxConditions } from "../index";
import { BANKWORKX_BILLERS, BILLER_CATEGORIES, autopayPlan, billCase, billOf, choicesOf, limitsOf, minimumCents, normaliseRef, validRef } from "./bills";

const NOW = Date.parse("2026-11-03T10:00:00Z");
const bank = async (persona = "alexbills", conditions?: SandboxConditions) => {
  const b = new MockBank(persona, { conditions });
  b.now = () => NOW;
  return b;
};
const verified = async (conditions?: SandboxConditions) => {
  const b = await bank("alexbills", conditions);
  await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" });
  return b;
};
const balance = async (b: MockBank, id: string) => (await b.call("bank.accounts.list"))[id].balance;
const power = { billerId: "city_power", reference: "4400123456" };

describe("the directory of billers", () => {
  it("has every sample reference valid for its own biller, in the categories of the spec", () => {
    expect(BANKWORKX_BILLERS).toHaveLength(16);
    for (const b of BANKWORKX_BILLERS) { expect(validRef(b, normaliseRef(b.sample)), b.id).toBe(true); expect(BILLER_CATEGORIES, b.id).toContain(b.category); }
  });
  it("ignores spaces and hyphens, and takes HI in any case", () => {
    const hi = BANKWORKX_BILLERS.find((b) => b.id === "harbor_insurance")!, city = BANKWORKX_BILLERS.find((b) => b.id === "city_power")!;
    expect(validRef(hi, normaliseRef("hi 1234-5678"))).toBe(true);
    expect(validRef(hi, normaliseRef("12345678"))).toBe(false);
    expect(validRef(city, normaliseRef("4400 1234-56"))).toBe(true);
    expect(validRef(city, normaliseRef("440012345"))).toBe(false);
  });
  it("lists by category and by search, and only for BankWorkx customers", async () => {
    const b = await bank();
    expect(Object.keys(await b.call("bank.billers.list", { category: "Insurance" }))).toEqual(["harbor_insurance", "pioneer_life"]);
    expect(Object.keys(await b.call("bank.billers.list", { q: "WATER" }))).toEqual(["metro_water"]);
    expect(Object.keys(await b.call("bank.billers.list", { category: "all" }))).toHaveLength(16);
    expect(Object.keys(await b.call("bank.billers.list", { q: "zzz" }))).toEqual([]);
    // Meezan keeps its own billers
    expect(Object.keys(await (await bank("ayesha")).call("bank.billers.list"))).toEqual(["k_electric", "lesco", "ssgc", "ptcl"]);
  });
  it("keeps the saved billers and the quote for BankWorkx customers", async () => {
    await expect((await bank("ayesha")).call("bank.bills.saved")).rejects.toMatchObject({ code: "NOT_SUPPORTED" });
    await expect((await bank("ayesha")).call("bank.bills.quote", {})).rejects.toMatchObject({ code: "NOT_SUPPORTED" });
  });
});

describe("the bill a reference stands for", () => {
  it("is chosen by the last four digits", () => {
    expect(["1111", "0000", "9999", "5555", "7777", "3333", "1234"].map((d) => billCase(`440012${d}`))).toEqual(["unavailable", "notFound", "paid", "none", "overdue", "changing", "normal"]);
  });
  it("is (1000 + number mod 9000) / 20 dollars, due (number mod 20) + 3 days ahead", () => {
    const n = 4400123456 % 9000;
    expect(billOf("4400123456", NOW)).toMatchObject({ dueCents: (1000 + n) * 5, lateFeeCents: 0, late: false, dueDate: Date.UTC(2026, 10, 3) + ((4400123456 % 20) + 3) * 86_400_000 });
  });
  it("is late with 5% added and a due date 9 days ago when the reference ends 7777", () => {
    const base = (1000 + (4400127777 % 9000)) * 5, late = billOf("4400127777", NOW);
    expect(late).toMatchObject({ late: true, lateFeeCents: Math.round(base * 0.05), dueCents: base + Math.round(base * 0.05), dueDate: Date.UTC(2026, 10, 3) - 9 * 86_400_000 });
  });
  it("reads a card number of 16 digits without losing digits", () => {
    expect(billOf("1234567890123456", NOW).dueCents).toBe((1000 + Number(1234567890123456n % 9000n)) * 5);
  });
  it("has a minimum of the smaller of the amount due and the larger of 10% and 10.00", () => {
    expect([minimumCents(50_000), minimumCents(5_000), minimumCents(800), minimumCents(1_000)]).toEqual([5_000, 1_000, 800, 1_000]);
  });
  it("offers the minimum and another amount only where the biller takes them, and the card's most is 1.8 times the amount due", () => {
    const get = (id: string) => BANKWORKX_BILLERS.find((b) => b.id === id)!;
    expect(Object.keys(choicesOf(get("northwind_card"), 37_280, true))).toEqual(["full", "min", "other"]);
    expect(Object.keys(choicesOf(get("northwind_card"), 37_280, false))).toEqual(["full"]);
    expect(Object.keys(choicesOf(get("city_power"), 32_280, true))).toEqual(["full", "other"]);
    expect(Object.keys(choicesOf(get("harbor_insurance"), 38_390, true))).toEqual(["full"]);
    expect(limitsOf(get("northwind_card"), 37_280)).toEqual({ min: 3_728, max: 67_104 });
    expect(limitsOf(get("lakeside_home_loans"), 17_280)).toEqual({ min: 1_728, max: 17_280 });
    expect(limitsOf(get("harbor_insurance"), 38_390)).toEqual({ min: 38_390, max: 38_390 });
  });
  it("makes the automatic payment a month after the due date, on a business day, never above 1.5 times the amount due rounded up to 10", () => {
    // Mon 23 Nov 2026 -> Wed 23 Dec; 31 Oct has no 31 Nov, so it is 30 Nov (a Monday)
    expect(autopayPlan(Date.UTC(2026, 10, 23), 32_285)).toMatchObject({ firstText: "Wed 23 Dec", cap: 490 });
    expect(autopayPlan(Date.UTC(2026, 9, 31), 10_000)).toMatchObject({ firstText: "Mon 30 Nov", cap: 150 });
    // a Saturday moves to the next Monday: 21 Nov 2026 is a Saturday
    expect(autopayPlan(Date.UTC(2026, 9, 21), 10_001)).toMatchObject({ firstText: "Mon 23 Nov", cap: 160 });
  });
});

describe("looking a bill up", () => {
  it("answers with what is due, the limits and the choices", async () => {
    const r = await (await bank()).call("bank.bills.lookup", { ...power, reference: "4400 1234-56" });
    expect(r).toMatchObject({ billerName: "City Power", reference: "4400123456", due: 322.8, min: 0.01, max: 322.8, date: "2026-11-22", dateText: "Sun 22 Nov", late: false, lateFee: 0, holder: "Alex Morgan" });
    expect(Object.keys(r.choices)).toEqual(["full", "other"]);
  });
  it("says why there is no bill, in the words of the spec", async () => {
    const b = await bank();
    const look = (reference: string, billerId = "city_power") => b.call("bank.bills.lookup", { billerId, reference });
    await expect(look("4400121111")).rejects.toMatchObject({ code: "BILLER_UNAVAILABLE", message: "Biller unavailable. Try again later." });
    await expect(look("4400120000")).rejects.toMatchObject({ code: "BILL_NOT_FOUND", message: "No bill found. Check the reference and try again." });
    await expect(look("4400129999")).rejects.toMatchObject({ code: "BILL_ALREADY_PAID", message: "This bill is already paid." });
    await expect(look("4400125555")).rejects.toMatchObject({ code: "NO_AMOUNT_DUE", message: "No bill due." });
    await expect(look("12345")).rejects.toMatchObject({ code: "INVALID_REFERENCE", message: "Check the reference." });
    await expect(look("4400123456", "nobody")).rejects.toMatchObject({ code: "BILLER_NOT_FOUND", message: "Choose a biller." });
  });
});

describe("saved billers", () => {
  it("starts with two, filters them, and saves another once", async () => {
    const b = await bank();
    expect(Object.values(await b.call("bank.bills.saved")).map((x: any) => x.nickname)).toEqual(["Home electricity", "Home internet"]);
    expect(Object.values(await b.call("bank.bills.saved", { category: "Water" }))).toEqual([]);
    await b.call("bank.bills.saved", { billerId: "metro_water", reference: "3300456712", nickname: "Flat water" });
    const again = await b.call("bank.bills.saved", { billerId: "metro_water", reference: "3300 4567-12" });
    expect(Object.values(again).map((x: any) => x.nickname)).toEqual(["Home electricity", "Home internet", "Flat water"]);
    await expect(b.call("bank.bills.saved", { billerId: "metro_water", reference: "12" })).rejects.toMatchObject({ code: "INVALID_REFERENCE" });
  });
});

describe("pricing a bill payment", () => {
  const quote = async (b: MockBank, o: Record<string, unknown> = {}) => b.call("bank.bills.quote", { ...power, choice: "full", fromAccountId: "acc_main", ...o });
  it("prices the full bill, the minimum and another amount, with the biller's fee kept separate", async () => {
    const b = await bank();
    expect(await quote(b)).toMatchObject({ amount: 322.8, fee: 0, rate: null, youPay: 322.8, currency: "USD", due: 322.8, changed: false, lateFee: 0, autopayOk: true, saved: true });
    expect(await quote(b, { billerId: "northwind_card", reference: "1234567890123456", choice: "min" })).toMatchObject({ amount: 37.28, autopayOk: true });
    expect(await quote(b, { choice: "other", amount: 100 })).toMatchObject({ amount: 100 });
    expect(await quote(b, { billerId: "clearwave_telecom", reference: "5550987654" })).toMatchObject({ amount: 232.7, fee: 1, youPay: 233.7 });
    expect(await quote(b, { billerId: "county_revenue", reference: "123456781234" })).toMatchObject({ autopayOk: false });
  });
  it("names the late fee only in a full payment", async () => {
    const b = await bank();
    expect(await quote(b, { reference: "4400127777" })).toMatchObject({ late: true, due: 93.29, lateFee: 4.44 });
    expect(await quote(b, { reference: "4400127777", choice: "other", amount: 50 })).toMatchObject({ late: true, lateFee: 0 });
  });
  it("refuses an amount outside what the biller takes", async () => {
    const b = await bank();
    await expect(quote(b, { billerId: "northwind_card", reference: "1234567890123456", choice: "other", amount: 37.27 })).rejects.toMatchObject({ code: "AMOUNT_BELOW_MINIMUM", message: "That is below the minimum." });
    await expect(quote(b, { billerId: "northwind_card", reference: "1234567890123456", choice: "other", amount: 671.05 })).rejects.toMatchObject({ code: "AMOUNT_ABOVE_DUE", message: "That is more than the amount due." });
    await expect(quote(b, { billerId: "northwind_card", reference: "1234567890123456", choice: "other", amount: 671.04 })).resolves.toMatchObject({ amount: 671.04 });
    await expect(quote(b, { choice: "other", amount: 322.81 })).rejects.toMatchObject({ code: "AMOUNT_ABOVE_DUE" });
    await expect(quote(b, { billerId: "harbor_insurance", reference: "HI12345678", choice: "other", amount: 100 })).rejects.toMatchObject({ code: "AMOUNT_BELOW_MINIMUM" });
    await expect(quote(b, { choice: "min" })).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
    await expect(quote(b, { choice: "other", amount: 0 })).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
    await expect(quote(b, { choice: "other", amount: 10.005 })).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
    await expect(quote(b, { choice: "other", amount: -5 })).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
  });
  it("takes any amount when the bill is not looked up, and still checks the reference", async () => {
    const b = await bank();
    await expect(quote(b, { fetched: false, choice: "other", amount: 5000 })).resolves.toMatchObject({ amount: 5000, due: null, autopayOk: false });
    await expect(quote(b, { fetched: false, reference: "12", choice: "other", amount: 5 })).rejects.toMatchObject({ code: "INVALID_REFERENCE" });
  });
  it("prices a payment from another currency at the mid rate and rounds what they pay up", async () => {
    const b = await bank();
    expect(await quote(b, { fromAccountId: "acc_eur" })).toMatchObject({ rate: 0.926, youPay: 298.92, currency: "EUR", billCurrency: "USD" });
    expect(await quote(b, { fromAccountId: "acc_aed", billerId: "clearwave_telecom", reference: "5550987654" })).toMatchObject({ rate: 3.672, youPay: 858.15, currency: "AED" });
    await expect(quote(b, { fromAccountId: "acc_eur", allowCrossCurrency: false })).rejects.toMatchObject({ code: "BILL_CURRENCY_MISMATCH", message: "Choose an account in the same currency as the bill." });
  });
  it("refuses a missing, a frozen and an over-spent account, and the daily limit, with the words of the spec", async () => {
    await expect(quote(await bank(), { fromAccountId: "nope" })).rejects.toMatchObject({ code: "ACCOUNT_NOT_FOUND", message: "Choose an account to pay from." });
    await expect(quote(await bank("alexbills", { frozen: ["acc_main"] }))).rejects.toMatchObject({ code: "ACCOUNT_CANNOT_DEBIT" });
    const poor = await verified();
    await poor.call("bank.transfers.own", { fromAccountId: "acc_main", toAccountId: "acc_save", amount: 8700 });
    await expect(quote(poor)).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS", message: "Not enough in this account." });
    await expect(quote(poor, { choice: "other", amount: 20.76 })).resolves.toMatchObject({ youPay: 20.76 });
    const limited = await bank("alexbills", { limitUsed: 49900 });
    await expect(quote(limited, { choice: "other", amount: 100.01 })).rejects.toMatchObject({ code: "DAILY_LIMIT_EXCEEDED", message: "That is over your daily limit." });
    await expect(quote(limited, { choice: "other", amount: 100 })).resolves.toMatchObject({ youPay: 100 });
  });
  it("raises the amount due by 12.00 once for a reference ending 3333", async () => {
    const b = await bank();
    const ref = { reference: "4400123333" };
    expect((await b.call("bank.bills.lookup", { ...power, ...ref })).due).toBe(316.65);
    expect(await quote(b, ref)).toMatchObject({ amount: 328.65, due: 328.65, changed: true });
    expect(await quote(b, ref)).toMatchObject({ amount: 328.65, changed: false });
    expect((await b.call("bank.bills.lookup", { ...power, ...ref })).due).toBe(328.65);
  });
});

describe("paying a bill", () => {
  const payload = (o: Record<string, unknown> = {}) => ({ ...power, amount: 322.8, due: 322.8, fromAccountId: "acc_main", ...o });
  it("needs the one-time code first and uses it up", async () => {
    const b = await bank();
    await expect(b.call("bank.bills.pay", payload())).rejects.toMatchObject({ code: "OTP_REQUIRED" });
    const v = await verified();
    await v.call("bank.bills.pay", payload());
    await expect(v.call("bank.bills.pay", payload({ amount: 1, due: 322.8 }))).rejects.toMatchObject({ code: "OTP_REQUIRED" });
  });
  it("takes the amount and the fee from the account and the daily limit, and keeps what is left", async () => {
    const b = await verified();
    const r = await b.call("bank.bills.pay", payload({ amount: 100 }));
    expect(r).toMatchObject({ paid: 100, left: 222.8, fee: 0, youPay: 100, currency: "USD", newBalance: 8620.76, saved: false, nextAutopay: null });
    expect(r.reference).toMatch(/^BILL-\d{8}-\d{4}$/);
    expect(await balance(b, "acc_main")).toBe(8620.76);
    expect((await b.call("bank.limits.get")).usedToday).toBe(100);
    expect((await b.call("bank.bills.lookup", power)).due).toBe(222.8);
  });
  it("says a bill paid in full is already paid", async () => {
    const b = await verified();
    await b.call("bank.bills.pay", payload());
    await expect(b.call("bank.bills.lookup", power)).rejects.toMatchObject({ code: "BILL_ALREADY_PAID" });
  });
  it("charges the euro account in euros and the daily limit of euros", async () => {
    const b = await verified();
    const r = await b.call("bank.bills.pay", payload({ fromAccountId: "acc_eur" }));
    expect(r).toMatchObject({ youPay: 298.92, rate: 0.926, currency: "EUR", newBalance: 2101.08 });
    expect(await balance(b, "acc_main")).toBe(8720.76);
    expect((await b.call("bank.limits.get", { currency: "EUR" })).usedToday).toBe(298.92);
  });
  it("refuses an amount due that changed since the person saw it, and pays nothing", async () => {
    const b = await verified();
    await expect(b.call("bank.bills.pay", payload({ due: 300 }))).rejects.toMatchObject({ code: "BILL_CHANGED", message: "The amount due changed. Check it and confirm again." });
    expect(await balance(b, "acc_main")).toBe(8720.76);
  });
  it("checks the money again when paying", async () => {
    const b = await verified();
    await expect(b.call("bank.bills.pay", payload({ amount: 9000, due: 322.8 }))).rejects.toMatchObject({ code: "AMOUNT_ABOVE_DUE" });
    await expect(b.call("bank.bills.pay", payload({ amount: 0 }))).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
    const limited = await verified({ limitUsed: 49900 });
    await expect(limited.call("bank.bills.pay", payload())).rejects.toMatchObject({ code: "DAILY_LIMIT_EXCEEDED" });
    expect(await balance(limited, "acc_main")).toBe(8720.76);
  });
  it("fails with CORE_UNAVAILABLE after the code when the core is down, and a timeout or an unavailable service applies nothing", async () => {
    await expect((await verified({ transferFails: true })).call("bank.bills.pay", payload())).rejects.toMatchObject({ code: "CORE_UNAVAILABLE" });
    const slow = await verified({ timeout: ["bank.bills.pay"], latencyMs: 10000 });
    await expect(slow.call("bank.bills.pay", payload())).rejects.toMatchObject({ code: "TIMEOUT" });
    const down = await verified({ unavailable: ["bank.bills.pay"] });
    await expect(down.call("bank.bills.pay", payload())).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    expect(await balance(slow, "acc_main")).toBe(8720.76);
    expect(await balance(down, "acc_main")).toBe(8720.76);
  });
  it("saves the biller and makes a monthly entry when asked, once, and only for the categories that come back", async () => {
    const b = await verified();
    const ref = "4400123457";
    const r = await b.call("bank.bills.pay", payload({ reference: ref, amount: 322.85, due: 322.85, save: true, autopay: true }));
    expect(r).toMatchObject({ saved: true, nextAutopay: "Wed 23 Dec" });
    expect((await b.call("bank.bills.saved", { q: "city" }))["sb_new1"]).toMatchObject({ nickname: "City Power", reference: ref, last4: "3457" });
    expect((await b.call("bank.schedules.list"))["sch_bill1"].text).toBe("City Power · Monthly, Wed 23 Dec, full bill, up to $490.00");
    const c = await verified();
    const tax = await c.call("bank.bills.pay", { billerId: "county_revenue", reference: "123456781234", amount: 111.7, due: 111.7, fromAccountId: "acc_main", save: false, autopay: true });
    expect(tax).toMatchObject({ saved: false, nextAutopay: null });
    expect(await c.call("bank.schedules.list")).toEqual({});
  });
  it("pays a bill that was not looked up, without checking it against an amount due", async () => {
    const b = await verified();
    const r = await b.call("bank.bills.pay", { ...power, amount: 25.5, fromAccountId: "acc_main", fetched: false });
    expect(r).toMatchObject({ paid: 25.5, youPay: 25.5, nextAutopay: null });
  });
  it("shows the payment in Activity under the biller's name, as a bill", async () => {
    const b = await verified();
    await b.call("bank.bills.pay", payload({ billerId: "clearwave_telecom", reference: "5550987654", amount: 232.7, due: 232.7 }));
    expect(b.persona.finance!.transactions[0]).toMatchObject({ title: "ClearWave Telecom", category: "bills", amount: -233.7 });
  });
  it("leaves the Meezan bill payment as it was", async () => {
    const b = new MockBank("ayesha");
    await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" });
    expect((await b.call("bank.bills.pay", { fromAccountId: "acc_current", amount: 7789 })).reference).toMatch(/^BILL-/);
  });
});

describe("the rules a mutation check can switch off", () => {
  it.each([
    ["billMinimum", { billerId: "northwind_card", reference: "1234567890123456", choice: "other", amount: 1 }],
    ["billMaximum", { choice: "other", amount: 400 }],
    ["billCurrency", { fromAccountId: "acc_eur", allowCrossCurrency: false }],
  ] as const)("%s", async (flaw, o) => {
    const b = new MockBank("alexbills", { corpFlaws: { [flaw]: false } });
    b.now = () => NOW;
    await expect(b.call("bank.bills.quote", { ...power, choice: "full", fromAccountId: "acc_main", ...o })).resolves.toBeTruthy();
  });
  it("billMemory forgets what was paid, and billChanged pays an amount due that changed", async () => {
    const b = new MockBank("alexbills", { corpFlaws: { billMemory: false, billChanged: false } });
    b.now = () => NOW;
    await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" });
    await b.call("bank.bills.pay", { ...power, amount: 100, due: 300, fromAccountId: "acc_main" });
    expect((await b.call("bank.bills.lookup", power)).due).toBe(322.8);
  });
});
