import { describe, it, expect } from "vitest";
import { MockBank, type SandboxConditions } from "./index";
import { businessDays, money, speedsFor, type Offer } from "./payments";

const NOW = Date.parse("2026-11-02T09:31:00Z"); // a Monday
const bank = async (conditions?: SandboxConditions, persona = "alexpayees") => {
  const b = new MockBank(persona, { conditions });
  b.now = () => NOW;
  return b;
};
const code = async (b: MockBank) => { await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" }); };
const balance = async (b: MockBank, id = "acc_main") => (await b.call("bank.accounts.list"))[id].balance;
const quote = (b: MockBank, o: Record<string, unknown>) => b.call("bank.payments.quote", { fromAccountId: "acc_main", ...o });
const OFFER: Offer = { standard: true, sameDay: true, instant: true, priority: false };
/** A payee typed in the payment (not saved), at the home bank. */
const newPayee = { sendType: "domestic", payeeKey: "us:021000021:987654321", payeeName: "Priya Raman" };

describe("the rails: speeds, fees, limits", () => {
  it("offers the speeds a bank has on, within their limits, and takes one down", () => {
    expect(speedsFor("domestic", 100, OFFER).map((s) => [s.speed, s.fits, s.fee])).toEqual([["standard", true, 0], ["sameDay", true, 1], ["instant", true, 0.25]]);
    expect(speedsFor("domestic", 30_000, OFFER).map((s) => [s.speed, s.fits, s.reason])).toEqual([["standard", false, "Over the limit"], ["sameDay", true, undefined], ["instant", true, undefined]]);
    expect(speedsFor("domestic", 600_000, OFFER).filter((s) => s.fits).map((s) => s.speed)).toEqual(["sameDay"]);
    expect(speedsFor("domestic", 100, { ...OFFER, instant: false }).map((s) => s.speed)).toEqual(["standard", "sameDay"]);
    expect(speedsFor("domestic", 100, OFFER, ["rtp"]).find((s) => s.speed === "instant")).toMatchObject({ available: false, reason: "Not available right now" });
    expect(speedsFor("international", 100, OFFER).map((s) => s.speed)).toEqual(["standard"]);
    expect(speedsFor("international", 100, { ...OFFER, priority: true }).map((s) => [s.speed, s.fee])).toEqual([["standard", 25], ["priority", 40]]);
    expect(speedsFor("internal", 100, OFFER).map((s) => [s.speed, s.limit])).toEqual([["instant", 25_000]]);
  });
  it("lists business days only, starting the day after the clock", () => {
    const days = Object.keys(businessDays(NOW));
    expect(days).toHaveLength(30);
    expect(days[0]).toBe("2026-11-03");
    expect(days.every((d) => ![0, 6].includes(new Date(d).getUTCDay()))).toBe(true);
    expect(Object.keys(businessDays(Date.parse("2026-11-06T10:00:00Z")))[0]).toBe("2026-11-09"); // Friday: the next one is Monday
    expect(businessDays(NOW)["2026-11-03"]).toEqual({ id: "2026-11-03", name: "Tue 3 Nov" });
  });
  it("writes money in full for the words of an error", () => {
    expect([money(500, "USD"), money(25000, "USD"), money(1000, "JPY"), money(1.5, "JOD")]).toEqual(["$500.00", "$25,000.00", "¥1,000", "JOD 1.500"]);
  });
});

describe("finding a BankWorkx customer", () => {
  it("by mobile number, email or ID, however it is written", async () => {
    const b = await bank(undefined, "alexglobal");
    expect(await b.call("bank.payees.lookup", { by: "mobile", value: "+1 (202) 555-0142" })).toMatchObject({ name: "Taylor Brooks", maskedAccount: "••3308", key: "bw:3301123308" });
    expect(await b.call("bank.payees.lookup", { by: "email", value: "Jordan.Keller@example.com" })).toMatchObject({ name: "Jordan Keller" });
    expect(await b.call("bank.payees.lookup", { by: "id", value: "JKELLER" })).toMatchObject({ name: "Jordan Keller" });
  });
  it("refuses an unknown customer and one already saved, with the words of the screen", async () => {
    const b = await bank();
    await expect(b.call("bank.payees.lookup", { by: "email", value: "nobody@example.com" })).rejects.toMatchObject({ code: "CUSTOMER_NOT_FOUND", message: "We can’t find a BankWorkx® customer with those details. Check them and try again." });
    await expect(b.call("bank.payees.lookup", { by: "mobile", value: "" })).rejects.toMatchObject({ code: "CUSTOMER_NOT_FOUND" });
    await expect(b.call("bank.payees.lookup", { by: "id", value: "taylorb" })).rejects.toMatchObject({ code: "BENEFICIARY_EXISTS", message: "You’ve already saved this payee. Choose them from your saved payees." });
    expect(await b.call("bank.payees.lookup", { by: "id", value: "jkeller" })).toMatchObject({ name: "Jordan Keller" });
  });
});

describe("lists for sending money", () => {
  it("only the accounts that can pay someone else, and the payees of one kind of payment", async () => {
    const b = await bank();
    expect(Object.keys(await b.call("bank.accounts.list", { homeOnly: true }))).toEqual(["acc_main", "acc_save"]);
    expect(Object.keys(await b.call("bank.accounts.list"))).toHaveLength(4);
    const kinds = async (sendType: string) => Object.keys(await b.call("bank.beneficiaries.list", { sendType }));
    expect(await kinds("internal")).toEqual(["ben_taylor"]);
    expect(await kinds("domestic")).toEqual(["ben_jamie", "ben_casey"]);
    expect(await kinds("international")).toEqual(["ben_marco", "ben_lena", "ben_james"]);
    expect(Object.keys(await b.call("bank.beneficiaries.list"))).toHaveLength(6);
  });
});

describe("quoting a payment", () => {
  it("prices a payment to a saved payee: the first speed that fits, with every speed listed", async () => {
    const b = await bank();
    const q = await quote(b, { payeeId: "ben_jamie", receiveAmount: 100 });
    expect(q).toMatchObject({ type: "domestic", speed: "standard", speedName: "Standard", arrives: "1 to 2 business days", pay: 100, fee: 0, feeText: "Free", total: 100, currency: "USD", rate: null, converted: false });
    expect(q.speeds.standard.sub).toBe("1 to 2 business days · up to $25,000.00 · Free");
    expect(q.speeds.instant).toMatchObject({ name: "Instant", usable: true, sub: "In seconds · up to $500,000.00 · $0.25" });
    const big = await quote(b, { payeeId: "ben_jamie", receiveAmount: 8000, sameDay: true });
    expect(big.speeds.standard.usable).toBe(true);
    expect(await balance(b)).toBe(8720.76); // nothing moved
  });
  it("picks the speed asked for, adds its fee, and refuses a speed that is over its limit or down", async () => {
    const b = await bank();
    expect(await quote(b, { payeeId: "ben_jamie", receiveAmount: 100, speed: "instant" })).toMatchObject({ speed: "instant", fee: 0.25, total: 100.25 });
    await expect(quote(b, { payeeId: "ben_jamie", receiveAmount: 100, speed: "priority" })).rejects.toMatchObject({ code: "RAIL_NOT_AVAILABLE" });
    const rich = await bank(undefined, "alexpayees");
    await expect(quote(rich, { payeeId: "ben_jamie", receiveAmount: 26_000, speed: "standard" })).rejects.toMatchObject({ code: "RAIL_LIMIT", message: "That speed is limited to $25,000.00 a payment. Choose another speed or send less." });
    const down = await bank({ unavailable: ["rail:rtp"] });
    expect((await quote(down, { payeeId: "ben_jamie", receiveAmount: 100 })).speeds.instant).toMatchObject({ usable: false, sub: expect.stringContaining("Not available right now") });
    await expect(quote(down, { payeeId: "ben_jamie", receiveAmount: 100, speed: "instant" })).rejects.toMatchObject({ code: "RAIL_NOT_AVAILABLE" });
  });
  it("refuses an amount over the largest limit, and nothing offered", async () => {
    const b = await bank();
    await expect(quote(b, { payeeId: "ben_jamie", receiveAmount: 30_000, sameDay: false, instant: false })).rejects.toMatchObject({ code: "RAIL_LIMIT", message: "That is over the limit of $25,000.00. Try a smaller amount." });
    await expect(quote(b, { payeeId: "ben_jamie", receiveAmount: 100, standard: false, sameDay: false, instant: false })).rejects.toMatchObject({ code: "RAIL_NOT_AVAILABLE", message: "Sending isn’t available right now. Try again later." });
    await expect(quote(b, { payeeId: "ben_taylor", receiveAmount: 30_000 })).rejects.toMatchObject({ code: "RAIL_LIMIT", message: "You can send up to $25,000.00 at a time." });
  });
  it("a BankWorkx customer is instant and free, and has no speed to choose", async () => {
    const b = await bank();
    const q = await quote(b, { payeeId: "ben_taylor", receiveAmount: 100 });
    expect(q).toMatchObject({ type: "internal", speed: "instant", fee: 0, feeText: "Free", arrives: "In seconds", total: 100 });
    expect(Object.keys(q.speeds)).toEqual(["instant"]);
  });
  it("refuses amounts that are not an amount for the currency, in the words of the screen", async () => {
    const b = await bank();
    for (const bad of [0, -5, "x"]) await expect(quote(b, { payeeId: "ben_jamie", receiveAmount: bad })).rejects.toMatchObject({ code: "INVALID_AMOUNT", message: "Enter an amount above zero." });
    await expect(quote(b, { payeeId: "ben_jamie", receiveAmount: 10.123 })).rejects.toMatchObject({ code: "INVALID_AMOUNT", message: "Enter an amount with at most 2 decimal places." });
    await expect(quote(b, { sendType: "international", currency: "JPY", payeeKey: "k", payeeName: "A B", country: "JP", receiveAmount: 1000.5, purpose: "Rent" })).rejects.toMatchObject({ code: "INVALID_AMOUNT", message: "Enter a whole number." });
  });
  it("refuses an account that is frozen or not in the home currency, a payee that is not there and one that was not checked", async () => {
    const b = await bank({ frozen: ["acc_save"] });
    await expect(quote(b, { fromAccountId: "acc_save", payeeId: "ben_jamie", receiveAmount: 5 })).rejects.toMatchObject({ code: "ACCOUNT_CANNOT_DEBIT", message: "You can’t send money from this account right now." });
    await expect(quote(b, { fromAccountId: "acc_eur", payeeId: "ben_jamie", receiveAmount: 5 })).rejects.toMatchObject({ code: "ACCOUNT_CANNOT_DEBIT" });
    await expect(quote(b, { fromAccountId: "nope", payeeId: "ben_jamie", receiveAmount: 5 })).rejects.toMatchObject({ code: "ACCOUNT_NOT_FOUND" });
    await expect(quote(b, { payeeId: "ben_nobody", receiveAmount: 5 })).rejects.toMatchObject({ code: "BENEFICIARY_NOT_FOUND" });
    await expect(quote(b, { sendType: "domestic", receiveAmount: 5 })).rejects.toMatchObject({ code: "PAYEE_NOT_CHECKED" });
  });
  it("checks the money: the total against the balance, the amount against what is left of the daily limit", async () => {
    const b = await bank();
    await expect(quote(b, { payeeId: "ben_jamie", receiveAmount: 9000 })).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS", message: "Not enough in the account: you’d pay $9,000.00 but $8,720.76 is available." });
    // the fee counts: everything they have, with a fee to add
    await expect(quote(b, { payeeId: "ben_jamie", receiveAmount: 8720.76, speed: "sameDay" })).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" });
    expect(await quote(b, { payeeId: "ben_jamie", receiveAmount: 8720.76 })).toMatchObject({ total: 8720.76 });
    const capped = await bank({ limitUsed: 45_000 });
    await expect(quote(capped, { payeeId: "ben_jamie", receiveAmount: 6000 })).rejects.toMatchObject({ code: "DAILY_LIMIT_EXCEEDED", message: "That is over your remaining daily limit of $5,000.00." });
    expect(await quote(capped, { payeeId: "ben_jamie", receiveAmount: 5000 })).toMatchObject({ pay: 5000 });
  });
  it("holds a payee added in the last 24 hours to its allowance, counting the payment being made", async () => {
    const b = await bank();
    await expect(quote(b, { payeeId: "ben_casey", receiveAmount: 600 })).rejects.toMatchObject({ code: "BENEFICIARY_COOLING_OFF", message: expect.stringContaining("Casey Nguyen was added 3 hours ago") });
    expect(await quote(b, { payeeId: "ben_casey", receiveAmount: 500 })).toMatchObject({ total: 500 });
    expect(await quote(b, { payeeId: "ben_casey", receiveAmount: 600, coolingOff: false })).toMatchObject({ total: 600 }); // the bank switched the rule off
    // one typed in this payment is new as well
    await expect(quote(b, { ...newPayee, receiveAmount: 600 })).rejects.toMatchObject({ code: "BENEFICIARY_COOLING_OFF" });
  });
});

describe("payments abroad", () => {
  const marco = { payeeId: "ben_marco", purpose: "Family support" };
  it("prices a payment in another currency at the mid rate with no margin: what they get is fixed, what you pay is worked out", async () => {
    const b = await bank();
    const q = await quote(b, { ...marco, receiveAmount: 100 });
    expect(q).toMatchObject({ type: "international", speed: "standard", converted: true, rate: 0.926, pay: 108, fee: 25, feeText: "$25.00", total: 133, receive: { currency: "EUR", amount: 100 } });
    expect(await balance(b)).toBe(8720.76);
  });
  it("keeps the rate for 60 seconds, then the market has moved a little", async () => {
    const b = await bank();
    const first = await quote(b, { ...marco, receiveAmount: 100 });
    b.now = () => NOW + 30_000;
    expect((await quote(b, { ...marco, receiveAmount: 100 })).rate).toBe(first.rate); // asking again inside the 60 seconds
    b.now = () => NOW + 61_000;
    expect((await quote(b, { ...marco, receiveAmount: 100 })).rate).toBe(0.926185);
  });
  it("needs a purpose, and for some countries or large amounts the address and who the payee is to the customer", async () => {
    const b = await bank();
    await expect(quote(b, { payeeId: "ben_marco", receiveAmount: 100 })).rejects.toMatchObject({ code: "PURPOSE_REQUIRED", message: "Choose a purpose for this payment." });
    await expect(quote(b, { payeeId: "ben_marco", receiveAmount: 100, purpose: "Gifts" })).rejects.toMatchObject({ code: "PURPOSE_REQUIRED" });
    const india = { sendType: "international", currency: "INR", country: "IN", payeeKey: "swift:HDFCINBB:123456", payeeName: "Asha Rao", purpose: "Rent" };
    await expect(quote(b, { ...india, receiveAmount: 5000 })).rejects.toMatchObject({ code: "ADDRESS_REQUIRED", message: "We need the payee’s address for this payment." });
    expect(await quote(b, { ...india, receiveAmount: 5000, street: "1 Main Road", city: "Pune", relationship: "Friend" })).toMatchObject({ converted: true });
    await expect(quote(b, { ...india, receiveAmount: 5000, street: "1 Main Road", city: "Pune" })).rejects.toMatchObject({ code: "ADDRESS_REQUIRED" }); // who they are to you
  });
  it("asks for the address at 10,000 US dollars whatever the country (the big-payment rule)", async () => {
    const b = await bank();
    // Germany is not on the address list: 8,000 EUR is 8,639.31 US dollars, 9,500 EUR is 10,259.18
    await expect(quote(b, { ...marco, receiveAmount: 8000 })).resolves.toMatchObject({ pay: 8639.31 });
    await expect(quote(b, { ...marco, receiveAmount: 9500, fromAccountId: "acc_save" })).rejects.toMatchObject({ code: "ADDRESS_REQUIRED" });
    expect(await quote(b, { ...marco, receiveAmount: 9500, fromAccountId: "acc_save", street: "Hauptstrasse 1", city: "Berlin", relationship: "Supplier or business" })).toMatchObject({ pay: 10259.18 });
  });
  it("the sender can pay all the charges when the bank lets them", async () => {
    const b = await bank();
    expect(await quote(b, { ...marco, receiveAmount: 100, chargeChoice: true, chargeBearer: "ours" })).toMatchObject({ fee: 40, total: 148 });
    expect(await quote(b, { ...marco, receiveAmount: 100, chargeBearer: "ours" })).toMatchObject({ fee: 25 }); // not offered: ignored
    expect(await quote(b, { ...marco, receiveAmount: 100, priority: true, speed: "priority" })).toMatchObject({ speed: "priority", fee: 40, arrives: "Next business day" });
  });
  it("sends no more than a currency without decimals can hold, in the payee's currency", async () => {
    const b = await bank();
    const jp = { sendType: "international", currency: "JPY", country: "JP", payeeKey: "swift:MHCBJPJT:123456", payeeName: "Kenji Sato", purpose: "Rent", street: "1-1 Chome", city: "Tokyo", relationship: "Friend" };
    expect(await quote(b, { ...jp, receiveAmount: 15100 })).toMatchObject({ rate: 151, pay: 100, receive: { currency: "JPY", amount: 15100 } });
  });
});

describe("paying", () => {
  it("needs the one-time code and uses it up; the money moves once", async () => {
    const b = await bank();
    const q = await quote(b, { payeeId: "ben_jamie", receiveAmount: 100 });
    await expect(b.call("bank.payments.create", { quoteId: q.quoteId })).rejects.toMatchObject({ code: "OTP_REQUIRED" });
    await code(b);
    const r = await b.call("bank.payments.create", { quoteId: q.quoteId, when: "now" });
    expect(r).toMatchObject({ status: "processing", reference: expect.stringMatching(/^TRX-/), railReference: expect.stringMatching(/^RR-/), pay: 100, total: 100, newBalance: 8620.76, payeeName: "Jamie Lee" });
    expect(await balance(b)).toBe(8620.76);
    expect((await b.call("bank.limits.get")).usedToday).toBe(100);
    await code(b);
    await expect(b.call("bank.payments.create", { quoteId: q.quoteId })).rejects.toMatchObject({ code: "QUOTE_USED" });
    await expect(b.call("bank.payments.create", { quoteId: "payq_999" })).rejects.toMatchObject({ code: "QUOTE_NOT_FOUND" });
    expect(await balance(b)).toBe(8620.76);
  });
  it("takes the fee as well, and an instant payment or a BankWorkx customer is settled at once", async () => {
    const b = await bank();
    await code(b);
    const q = await quote(b, { payeeId: "ben_jamie", receiveAmount: 100, speed: "instant" });
    expect(await b.call("bank.payments.create", { quoteId: q.quoteId })).toMatchObject({ status: "settled", fee: 0.25, total: 100.25, newBalance: 8620.51 });
    expect((await b.call("bank.limits.get")).usedToday).toBe(100); // the fee is not part of the daily limit
    await code(b);
    const t = await quote(b, { payeeId: "ben_taylor", receiveAmount: 20 });
    expect(await b.call("bank.payments.create", { quoteId: t.quoteId })).toMatchObject({ status: "settled", newBalance: 8600.51 });
  });
  it("pays abroad in the payee's currency at the rate quoted", async () => {
    const b = await bank();
    const q = await quote(b, { payeeId: "ben_marco", purpose: "Rent", receiveAmount: 100 });
    await code(b);
    expect(await b.call("bank.payments.create", { quoteId: q.quoteId })).toMatchObject({ status: "processing", receive: { currency: "EUR", amount: 100 }, rate: 0.926, pay: 108, total: 133, newBalance: 8587.76 });
  });
  it("asks again for a new quote when the rate ran out, and takes nothing", async () => {
    const b = await bank();
    const q = await quote(b, { payeeId: "ben_marco", purpose: "Rent", receiveAmount: 100 });
    await code(b);
    b.now = () => NOW + 61_000;
    await expect(b.call("bank.payments.create", { quoteId: q.quoteId })).rejects.toMatchObject({ code: "QUOTE_EXPIRED", message: "The exchange rate changed. Check the new amount and confirm again." });
    expect(await balance(b)).toBe(8720.76);
    // in the same currency there is no rate to go stale
    const same = await quote(b, { payeeId: "ben_jamie", receiveAmount: 100 });
    b.now = () => NOW + 600_000;
    expect(await b.call("bank.payments.create", { quoteId: same.quoteId })).toMatchObject({ status: "processing" });
  });
  it("checks the money again when it is paid", async () => {
    const b = await bank();
    const a = await quote(b, { payeeId: "ben_jamie", receiveAmount: 8000 }), c = await quote(b, { payeeId: "ben_jamie", receiveAmount: 8000 });
    await code(b);
    await b.call("bank.payments.create", { quoteId: a.quoteId });
    await code(b);
    await expect(b.call("bank.payments.create", { quoteId: c.quoteId })).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" });
    expect(await balance(b)).toBe(720.76);
  });
  it("refuses everything when the core is down, after the code", async () => {
    const b = await bank({ transferFails: true });
    const q = await quote(b, { payeeId: "ben_jamie", receiveAmount: 100 });
    await code(b);
    await expect(b.call("bank.payments.create", { quoteId: q.quoteId })).rejects.toMatchObject({ code: "CORE_UNAVAILABLE" });
    expect(await balance(b)).toBe(8720.76);
  });
  it("a payee added in the last 24 hours gets its allowance over several payments, one typed in a payment included", async () => {
    const b = await bank();
    const pay = async (o: Record<string, unknown>) => { const q = await quote(b, o); await code(b); return b.call("bank.payments.create", { quoteId: q.quoteId, ...o }); };
    await pay({ payeeId: "ben_casey", receiveAmount: 300 });
    await expect(quote(b, { payeeId: "ben_casey", receiveAmount: 300 })).rejects.toMatchObject({ code: "BENEFICIARY_COOLING_OFF", message: expect.stringContaining("up to $200.00 more now") });
    await pay({ payeeId: "ben_casey", receiveAmount: 200 });
    await expect(quote(b, { payeeId: "ben_casey", receiveAmount: 1 })).rejects.toMatchObject({ message: expect.stringContaining("You can send more after 3 Nov 2026 06:31 UTC") });
    // a payee that is not saved is counted by its account
    await pay({ ...newPayee, receiveAmount: 400 });
    await expect(quote(b, { ...newPayee, receiveAmount: 101 })).rejects.toMatchObject({ code: "BENEFICIARY_COOLING_OFF" });
    // and the existing transfer of the older journeys is held to the same allowance
    await code(b);
    await expect(b.call("bank.transfers.create", { fromAccountId: "acc_main", beneficiaryId: "ben_casey", amount: 1 })).rejects.toMatchObject({ code: "BENEFICIARY_COOLING_OFF" });
  });
  it("saves the payee typed in the payment when asked: new for 24 hours, with what was sent still counted", async () => {
    const b = await bank();
    const typed = { region: "us", name: "Priya Raman", routing: "021000021", account: "987654321", accountType: "checking" };
    const v = await b.call("bank.payees.validate", typed);
    expect(v).toMatchObject({ key: "us:021000021:987654321", currency: "USD", sendType: "domestic" });
    const q = await quote(b, { sendType: v.sendType, currency: v.currency, payeeKey: v.key, payeeName: "Priya Raman", receiveAmount: 300 });
    await code(b);
    const r = await b.call("bank.payments.create", { quoteId: q.quoteId, save: true, ...typed });
    expect(r.payeeId).toMatch(/^ben_new/);
    const saved = (await b.call("bank.beneficiaries.list"))[r.payeeId];
    expect(saved).toMatchObject({ displayName: "Priya Raman", sendType: "domestic", ageHours: 0, allowanceLeft: 200 });
    await expect(quote(b, { payeeId: r.payeeId, receiveAmount: 201 })).rejects.toMatchObject({ code: "BENEFICIARY_COOLING_OFF" });
    // not ticked: not saved
    const again = new MockBank("alexpayees"); again.now = () => NOW;
    const q2 = await quote(again, { ...newPayee, receiveAmount: 50 });
    await code(again);
    expect((await again.call("bank.payments.create", { quoteId: q2.quoteId })).payeeId).toBeNull();
    expect(Object.keys(await again.call("bank.beneficiaries.list"))).toHaveLength(6);
  });
  it("refuses to save a copy of a payee already saved, before any money moves", async () => {
    const b = await bank();
    const q = await quote(b, { sendType: "domestic", payeeKey: "us:031201360:100006620", payeeName: "Jamie Lee", receiveAmount: 50 });
    await code(b);
    await expect(b.call("bank.payments.create", { quoteId: q.quoteId, save: true, region: "us", name: "Jamie Lee", routing: "031201360", account: "100006620" })).rejects.toMatchObject({ code: "BENEFICIARY_EXISTS" });
    expect(await balance(b)).toBe(8720.76);
  });
  it("holds a payment to a payee that screening stops: nothing moves, nothing is saved", async () => {
    const b = await bank();
    const typed = { region: "us", name: "Test Sanctions", routing: "021000021", account: "555566667" };
    const q = await quote(b, { sendType: "domestic", payeeKey: "us:021000021:555566667", payeeName: "Test Sanctions", receiveAmount: 100 });
    await code(b);
    const r = await b.call("bank.payments.create", { quoteId: q.quoteId, save: true, ...typed });
    expect(r).toMatchObject({ status: "held", payeeId: null });
    expect(r.newBalance).toBeUndefined();
    expect(await balance(b)).toBe(8720.76);
    expect((await b.call("bank.limits.get")).usedToday).toBe(0);
    expect(Object.keys(await b.call("bank.beneficiaries.list"))).toHaveLength(6);
  });
  it("sets a payment up for a later business day: nothing moves now, and it is listed with the payee's scheduled payments", async () => {
    const b = await bank();
    const q = await quote(b, { payeeId: "ben_jamie", receiveAmount: 100 });
    await code(b);
    await expect(b.call("bank.payments.create", { quoteId: q.quoteId, when: "later", sendOn: "2026-11-07" })).rejects.toMatchObject({ code: "INVALID_DATE" }); // a Saturday
    const r = await b.call("bank.payments.create", { quoteId: q.quoteId, when: "later", sendOn: "2026-11-09", repeat: "monthly" });
    expect(r).toMatchObject({ status: "scheduled", sendOn: "2026-11-09", repeat: "monthly" });
    expect(r.newBalance).toBeUndefined();
    expect(await balance(b)).toBe(8720.76);
    expect((await b.call("bank.limits.get")).usedToday).toBe(0);
    const list = Object.values(await b.call("bank.schedules.list")) as { text: string; beneficiaryId: string }[];
    expect(list.map((x) => x.text)).toEqual(["Rent · Monthly, 1 Dec, $1,450.00", "Jamie Lee · Every month, Mon 9 Nov, $100.00"]);
    // a payee with a scheduled payment cannot be deleted
    await expect(b.call("bank.payees.delete", { payeeId: "ben_jamie" })).rejects.toMatchObject({ code: "BENEFICIARY_IN_USE" });
  });
});

describe("a payee abroad: the checks of its country", () => {
  const w = (o: Record<string, unknown>) => ({ region: "world", strict: true, name: "Someone Real", ...o });
  const check = async (o: Record<string, unknown>) => (await bank()).call("bank.payees.validate", w(o));
  it("an IBAN must be the country's, the right length and have good check digits", async () => {
    const good = { country: "DE", account: "DE89 3704 0044 0532 0130 00", swift: "COBADEFFXXX" };
    expect(await check(good)).toMatchObject({ ok: true, currency: "EUR", country: "DE", sendType: "international", key: "swift:COBADEFFXXX:DE89370400440532013000" });
    for (const bad of ["FR1420041010050500013M02606", "DE89 3704 0044 0532 0130 01", "DE89 3704 0044 0532 0130", "not an iban"]) await expect(check({ ...good, account: bad })).rejects.toMatchObject({ code: "INVALID_IBAN", message: "That IBAN doesn’t look right. Check each character." });
    expect(await check({ country: "GB", account: "GB29 NWBK 6016 1331 9268 19", swift: "NWBKGB2LXXX" })).toMatchObject({ currency: "GBP" });
  });
  it("some countries ask for a bank code, and Mexico for an 18-digit account", async () => {
    expect(await check({ country: "CA", account: "1234567", bankCode: "00012-003", swift: "ROYCCAT2" })).toMatchObject({ currency: "CAD" });
    await expect(check({ country: "CA", account: "1234567", bankCode: "12-3", swift: "ROYCCAT2" })).rejects.toMatchObject({ code: "INVALID_BANK_CODE", message: "Use the 5-digit transit number and 3-digit institution number, like 00012-003." });
    expect(await check({ country: "IN", account: "123456789012", bankCode: "HDFC0000001", swift: "HDFCINBB" })).toMatchObject({ currency: "INR" });
    await expect(check({ country: "IN", account: "123456789012", bankCode: "HDFC1000001", swift: "HDFCINBB" })).rejects.toMatchObject({ message: "An IFSC has 11 characters: 4 letters, a zero, then 6 letters or numbers." });
    expect(await check({ country: "AU", account: "12345678", bankCode: "062-000", swift: "CTBAAU2S" })).toMatchObject({ currency: "AUD" });
    await expect(check({ country: "AU", account: "12345678", bankCode: "0620", swift: "CTBAAU2S" })).rejects.toMatchObject({ message: "A BSB has 6 digits, like 062-000." });
    expect(await check({ country: "MX", account: "123456789012345678", swift: "BNMXMXMM" })).toMatchObject({ currency: "MXN" });
    await expect(check({ country: "MX", account: "12345678901234567", swift: "BNMXMXMM" })).rejects.toMatchObject({ message: "An account number has 18 digits." });
    await expect(check({ country: "SG", account: "123", swift: "DBSSSGSG" })).rejects.toMatchObject({ message: "That account number looks too short or too long." });
  });
  it("the SWIFT/BIC must be the right shape, and its country letters must be the country", async () => {
    await expect(check({ country: "SG", account: "1234567", swift: "DBSS" })).rejects.toMatchObject({ code: "INVALID_BIC", message: "A SWIFT/BIC has 8 or 11 letters and numbers." });
    await expect(check({ country: "SG", account: "1234567", swift: "DBSSGBSG" })).rejects.toMatchObject({ code: "INVALID_BIC", message: "That bank code doesn’t match the country." });
    expect(await check({ country: "SG", account: "1234567", swift: "dbssSGSG" })).toMatchObject({ ok: true });
  });
  it("keeps the plain checks for the payee journeys that do not ask for the strict ones", async () => {
    const b = await bank();
    expect(await b.call("bank.payees.validate", { region: "world", name: "Someone Real", country: "CA", account: "1234567", swift: "ROYCUS33" })).toMatchObject({ ok: true });
  });
});
