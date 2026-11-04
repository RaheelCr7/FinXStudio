import { describe, it, expect } from "vitest";
import { MockBank, defaultPersonaFor, personasFor, type SandboxConditions } from "./index";

const NOW = Date.parse("2026-11-02T09:31:00Z");
const hours = (n: number) => n * 3_600_000;
const bank = (persona = "alexpayees", conditions?: SandboxConditions) => { const b = new MockBank(persona, { conditions }); b.now = () => NOW; return b; };
const code = async (b: MockBank) => { await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" }); };
const list = (b: MockBank) => b.call("bank.beneficiaries.list");
const CAMILLE = { region: "eu", name: "Camille Dubois", iban: "FR14 2004 1010 0505 0001 3M02 606" };
const LENA = { region: "eu", name: "Lena Fischer", iban: "DE44 5001 0517 5407 3249 31" };
const OTHER_DE = "DE02 1203 0000 0000 2020 51";

describe("the Payments cast", () => {
  it("is chosen to preview a journey that saves payees", () => {
    expect(defaultPersonaFor(personasFor("bankworkx"), [{ adapter: "bank.payees.save" }]).id).toBe("alexpayees");
  });
  it("has one payee of each kind, ages that follow the sandbox clock, and keeps the shape of the list", async () => {
    const l = await list(bank());
    expect(Object.keys(l)).toEqual(["ben_taylor", "ben_jamie", "ben_marco", "ben_casey", "ben_lena", "ben_james"]);
    expect(l.ben_taylor).toMatchObject({ displayName: "Taylor Brooks", bank: "BankWorkx", maskedNumber: "••3308", ageHours: 90 * 24, kind: "internal", coolingOffUntil: null, allowanceLeft: null });
    expect(l.ben_jamie).toMatchObject({ kind: "domestic", bank: "Northwind Bank", maskedNumber: "••6620" });
    expect(l.ben_marco).toMatchObject({ kind: "international", country: "DE", currency: "EUR", swift: "NRWDDEFFXXX" });
    expect(l.ben_casey).toMatchObject({ ageHours: 3, coolingOffHoursLeft: 21, allowanceLeft: 500, coolingOffUntil: new Date(NOW + hours(21)).toISOString() });
    expect(l.ben_james).toMatchObject({ scheduledCount: 1, scheduledText: "Rent · Monthly, 1 Dec, $1,450.00" });
    expect(l.ben_taylor.addedAgoMs).toBeUndefined();
  });
  it("leaves the payees of the existing customers as they were", async () => {
    const l = await new MockBank("ayesha").call("bank.beneficiaries.list");
    expect(Object.keys(l)).toEqual(["ben_4821", "ben_1190"]);
    expect(l.ben_4821).toMatchObject({ displayName: "Ahmed Khan", bank: "HBL", maskedNumber: "••4821", coolingOffUntil: null, allowanceLeft: null });
    expect(l.ben_4821.ageHours).toBeGreaterThanOrEqual(90 * 24 - 1);
  });
});

describe("checking the details of a payee", () => {
  const v = (o: Record<string, unknown>) => bank().call("bank.payees.validate", o);
  it("accepts a good payee of each region and says which bank it is", async () => {
    expect(await v({ region: "us", name: "Priya Raman", routing: "021000021", account: "987654321" })).toMatchObject({ ok: true, bankName: "JPMorgan Chase", maskedNumber: "••4321", sensitive: false });
    expect(await v(CAMILLE)).toMatchObject({ ok: true, maskedNumber: "••2606" });
    expect(await v({ region: "uk", name: "A B", sort: "40-47-84", account: "70872490" })).toMatchObject({ ok: true });
    expect(await v({ region: "me", country: "AE", name: "Omar Haddad", iban: "AE07 0331 2345 6789 0123 456" })).toMatchObject({ ok: true });
    expect(await v({ region: "world", country: "JP", name: "Aiko Tanaka", swift: "BOTKJPJT", account: "1234567890" })).toMatchObject({ ok: true });
    expect(await v({ region: "bw", customerNo: "3301554412" })).toMatchObject({ ok: true, registeredName: "Jordan Keller", found: "Jordan K. · ••4412" });
  });
  it.each([
    [{ region: "us", name: "Priya", routing: "123456789", account: "987654321" }, "INVALID_ROUTING", "That routing number isn't valid. Check the 9 digits."],
    [{ region: "us", name: "Priya", routing: "", account: "987654321" }, "INVALID_ROUTING", "Enter the 9-digit routing number."],
    [{ region: "us", name: "Priya", routing: "021000021", account: "123" }, "INVALID_ACCOUNT", "An account number has 4 to 17 digits."],
    [{ region: "eu", name: "Marco", iban: "DE89 3704 0044 0532 0130 01" }, "INVALID_IBAN", "That IBAN isn't valid. Check the characters and the length."],
    [{ region: "eu", name: "Marco", iban: "" }, "INVALID_IBAN", "Enter the IBAN."],
    [{ region: "eu", name: "Marco", iban: "GB82 WEST 1234 5698 7654 32" }, "NOT_SEPA", "That IBAN isn't in the SEPA area. Use “Other countries (SWIFT)”."],
    [{ region: "me", country: "SA", name: "Faisal", iban: "AE07 0331 2345 6789 0123 456" }, "COUNTRY_MISMATCH", "That IBAN starts with AE, but you chose Saudi Arabia."],
    [{ region: "uk", name: "James", sort: "20-00", account: "55779911" }, "INVALID_SORT_CODE", "A sort code has 6 digits, like 20-00-00."],
    [{ region: "uk", name: "James", sort: "20-00-00", account: "5577" }, "INVALID_ACCOUNT", "A UK account number has 8 digits."],
    [{ region: "world", country: "JP", name: "Aiko", swift: "ABC", account: "1234567890" }, "INVALID_BIC", "A SWIFT/BIC has 8 or 11 letters and numbers."],
    [{ region: "world", country: "JP", name: "Aiko", swift: "BOTKJPJT", account: "12" }, "INVALID_ACCOUNT", "That account number looks too short or too long."],
    [{ region: "bw", customerNo: "0000000000" }, "CUSTOMER_NOT_FOUND", "We can't find a BankWorkx® account with that number. Check it and try again."],
    [{ region: "bw", customerNo: "123" }, "INVALID_ACCOUNT", "Enter the 10-digit BankWorkx® account number."],
    [{ ...CAMILLE, name: "C" }, "PAYEE_NAME_REQUIRED", "Enter the name on the account."],
    [{ ...CAMILLE, nickname: "x".repeat(25) }, "NICKNAME_TOO_LONG", "Use 24 characters or fewer."],
  ])("refuses %j with %s", async (input, code, message) => {
    await expect(v(input)).rejects.toMatchObject({ code, message });
  });
  it("refuses a payee saved twice, whatever the spaces and the case, and a 51st payee", async () => {
    await expect(v({ ...LENA, iban: "de44 5001 0517 5407 3249 31" })).rejects.toMatchObject({ code: "BENEFICIARY_EXISTS", message: "You already saved this payee with these details." });
    await expect(v({ region: "uk", name: "James Whitfield", sort: "200000", account: "55779911" })).rejects.toMatchObject({ code: "BENEFICIARY_EXISTS" });
    await expect(v({ region: "bw", customerNo: "3301123308" })).rejects.toMatchObject({ code: "BENEFICIARY_EXISTS" });
    const full = bank("alexfull");
    expect(Object.keys(await list(full))).toHaveLength(50);
    await expect(full.call("bank.payees.validate", CAMILLE)).rejects.toMatchObject({ code: "BENEFICIARY_LIMIT", message: "You can save up to 50 payees. Delete one to add another." });
  });
  it("lets a payee being changed keep its own details, and tells what the change touches", async () => {
    const b = bank();
    expect(await b.call("bank.payees.validate", { ...LENA, payeeId: "ben_lena" })).toMatchObject({ ok: true, sensitive: false, restartsClock: false });
    expect(await b.call("bank.payees.validate", { ...LENA, payeeId: "ben_lena", name: "Lena Fischer-Braun" })).toMatchObject({ sensitive: true, restartsClock: false });
    expect(await b.call("bank.payees.validate", { ...LENA, payeeId: "ben_lena", iban: OTHER_DE })).toMatchObject({ sensitive: true, restartsClock: true });
    await expect(b.call("bank.payees.validate", { ...LENA, payeeId: "ben_nobody" })).rejects.toMatchObject({ code: "BENEFICIARY_NOT_FOUND" });
  });
});

describe("the name check", () => {
  const c = (o: Record<string, unknown>) => bank().call("bank.payees.check", o);
  it("matches, nearly matches, does not match, or cannot check", async () => {
    expect(await c(CAMILLE)).toMatchObject({ result: "match", registeredName: "Camille Dubois", label: "Verification of Payee" });
    expect(await c({ ...CAMILLE, name: "camille  DUBOIS" })).toMatchObject({ result: "match" });
    expect(await c({ ...LENA, name: "Lena Fisher" })).toMatchObject({ result: "close", registeredName: "Lena Fischer" });
    expect(await c({ ...LENA, name: "Bob Smith" })).toMatchObject({ result: "none", registeredName: "Lena Fischer" });
    expect(await c({ region: "uk", name: "James Whitfield", sort: "20-00-00", account: "55779911" })).toMatchObject({ result: "match", label: "Confirmation of Payee" });
    expect(await c({ region: "eu", name: "Nobody Known", iban: OTHER_DE })).toMatchObject({ result: "na" });
    expect(await c({ region: "world", country: "JP", name: "Aiko Tanaka", swift: "BOTKJPJT", account: "1234567890" })).toMatchObject({ result: "na" });
    expect(await c({ region: "bw", customerNo: "3301123308" })).toMatchObject({ result: "match", registeredName: "Taylor Brooks", label: "BankWorkx® customer record" });
  });
  it("is switched off by the bank for every bank payee, but not for a customer", async () => {
    expect(await c({ ...CAMILLE, skip: true })).toMatchObject({ result: "na" });
    expect(await c({ region: "bw", customerNo: "3301123308", skip: true })).toMatchObject({ result: "match" });
  });
});

describe("saving a payee", () => {
  it("needs the one-time code, uses it up, and keeps the answer in the list", async () => {
    const b = bank();
    await expect(b.call("bank.payees.save", CAMILLE)).rejects.toMatchObject({ code: "OTP_REQUIRED" });
    await code(b);
    const r = await b.call("bank.payees.save", { ...CAMILLE, nickname: "Cam" });
    expect(r).toMatchObject({ verified: true, nameCheck: "match", displayName: "Camille Dubois", maskedNumber: "••2606", allowanceUsd: 500, coolingOffUntil: new Date(NOW + hours(24)).toISOString() });
    await expect(b.call("bank.payees.save", { ...LENA, iban: OTHER_DE })).rejects.toMatchObject({ code: "OTP_REQUIRED" });
    expect((await list(b))[r.payeeId]).toMatchObject({ kind: "domestic", region: "eu", country: "FR", nickname: "Cam", verified: true, ageHours: 0, coolingOffHoursLeft: 24, allowanceLeft: 500 });
  });
  it("saves a payee that did not match only when the person acknowledged it, and then calls it Saved", async () => {
    const b = bank();
    await code(b);
    await expect(b.call("bank.payees.save", { ...CAMILLE, name: "Bob Smith" })).rejects.toMatchObject({ code: "PAYEE_NOT_CHECKED", message: "Check the payee before you continue." });
    expect(await b.call("bank.payees.save", { ...CAMILLE, name: "Bob Smith", acknowledged: true })).toMatchObject({ verified: false, nameCheck: "none" });
  });
  it("never calls an abroad payee Verified, and a BankWorkx customer needs no acknowledgement", async () => {
    const b = bank();
    await code(b);
    const world = await b.call("bank.payees.save", { region: "world", country: "JP", name: "Aiko Tanaka", swift: "BOTKJPJT", account: "1234567890", acknowledged: true });
    expect(world.verified).toBe(false);
    await code(b);
    expect(await b.call("bank.payees.save", { region: "bw", customerNo: "3301554412" })).toMatchObject({ verified: true, displayName: "Jordan Keller", bank: "BankWorkx", maskedNumber: "••4412" });
  });
  it("with the name check off, saves a bank payee only when acknowledged and calls it Saved", async () => {
    const b = bank();
    await code(b);
    await expect(b.call("bank.payees.save", { ...CAMILLE, skip: true })).rejects.toMatchObject({ code: "PAYEE_NOT_CHECKED" });
    expect(await b.call("bank.payees.save", { ...CAMILLE, skip: true, acknowledged: true })).toMatchObject({ verified: false, nameCheck: "na" });
  });
  it("does not save a second copy, and keeps the list at 50", async () => {
    const b = bank("alexfull");
    await code(b);
    await expect(b.call("bank.payees.save", CAMILLE)).rejects.toMatchObject({ code: "BENEFICIARY_LIMIT" });
    expect(Object.keys(await list(b))).toHaveLength(50);
  });
});

describe("changing a payee", () => {
  it("changes only the nickname or the label with no code and no new 24 hours", async () => {
    const b = bank();
    const r = await b.call("bank.payees.update", { ...LENA, payeeId: "ben_lena", nickname: "Lena F", label: "Business" });
    expect(r).toMatchObject({ sensitive: false, restarted: false, coolingOffUntil: null, verified: true });
    expect((await list(b)).ben_lena).toMatchObject({ nickname: "Lena F", label: "Business", ageHours: 30 * 24, verified: true });
  });
  it("changing the bank details needs the code and the check again, and starts the 24 hours again", async () => {
    const b = bank();
    const change = { ...LENA, payeeId: "ben_lena", iban: OTHER_DE };
    await expect(b.call("bank.payees.update", change)).rejects.toMatchObject({ code: "OTP_REQUIRED" });
    await code(b);
    // the account is not one the name check knows, so the person must acknowledge it
    await expect(b.call("bank.payees.update", change)).rejects.toMatchObject({ code: "PAYEE_NOT_CHECKED" });
    expect(await b.call("bank.payees.update", { ...change, acknowledged: true })).toMatchObject({ sensitive: true, restarted: true, verified: false, nameCheck: "na", coolingOffUntil: new Date(NOW + hours(24)).toISOString() });
    expect((await list(b)).ben_lena).toMatchObject({ ageHours: 0, coolingOffHoursLeft: 24, allowanceLeft: 500, verified: false, maskedNumber: "••2051" });
    // the code was used up by the change
    await expect(b.call("bank.payees.update", { ...change, iban: "DE89 3704 0044 0532 0130 00", acknowledged: true })).rejects.toMatchObject({ code: "OTP_REQUIRED" });
  });
  it("changing only the name needs the code and the check but does not start the 24 hours again", async () => {
    const b = bank();
    await code(b);
    expect(await b.call("bank.payees.update", { ...LENA, payeeId: "ben_lena", name: "Lena Fisher", acknowledged: true })).toMatchObject({ sensitive: true, restarted: false, verified: false, nameCheck: "close" });
    expect((await list(b)).ben_lena).toMatchObject({ displayName: "Lena Fisher", ageHours: 30 * 24, coolingOffUntil: null });
  });
  it("cannot change the region, and refuses a payee that is not there or details that another payee has", async () => {
    const b = bank();
    await expect(b.call("bank.payees.update", { ...CAMILLE, payeeId: "ben_nobody" })).rejects.toMatchObject({ code: "BENEFICIARY_NOT_FOUND" });
    // sent as a UK payee, it is still checked as the European payee it is
    await expect(b.call("bank.payees.update", { region: "uk", name: "Lena", sort: "20-00-00", account: "55779911", payeeId: "ben_lena" })).rejects.toMatchObject({ code: "INVALID_IBAN" });
  });
  it("refuses the details of another saved payee", async () => {
    const b = bank();
    await code(b);
    await b.call("bank.payees.save", CAMILLE);
    await expect(b.call("bank.payees.update", { ...LENA, payeeId: "ben_lena", iban: CAMILLE.iban })).rejects.toMatchObject({ code: "BENEFICIARY_EXISTS" });
  });
});

describe("deleting a payee", () => {
  it("needs no code, and takes the payee out of the list", async () => {
    const b = bank();
    expect(await b.call("bank.payees.delete", { payeeId: "ben_jamie" })).toMatchObject({ removed: true, schedulesCancelled: 0, displayName: "Jamie Lee" });
    expect(Object.keys(await list(b))).not.toContain("ben_jamie");
    await expect(b.call("bank.payees.delete", { payeeId: "ben_jamie" })).rejects.toMatchObject({ code: "BENEFICIARY_NOT_FOUND", message: "We can't find that payee." });
  });
  it("refuses a payee a scheduled payment uses, unless the schedules are cancelled with it", async () => {
    const b = bank();
    await expect(b.call("bank.payees.delete", { payeeId: "ben_james" })).rejects.toMatchObject({ code: "BENEFICIARY_IN_USE", message: "James Whitfield is used by 1 scheduled payment. Cancel it first." });
    expect((await list(b)).ben_james).toBeDefined();
    expect(await b.call("bank.payees.delete", { payeeId: "ben_james", cancelSchedules: true })).toMatchObject({ removed: true, schedulesCancelled: 1 });
  });
});

describe("a new payee and the 24-hour allowance", () => {
  const send = async (b: MockBank, amount: number, beneficiaryId = "ben_casey", fromAccountId = "acc_main") => { await code(b); return b.call("bank.transfers.create", { fromAccountId, beneficiaryId, amount }); };
  it("may be sent 500.00 USD in total in the first 24 hours, counting the payment being made", async () => {
    const b = bank();
    await send(b, 300);
    expect((await list(b)).ben_casey.allowanceLeft).toBe(200);
    await expect(send(b, 200.01)).rejects.toMatchObject({ code: "BENEFICIARY_COOLING_OFF", message: "Casey Nguyen was added 3 hours ago. For your security you can send up to $500.00 to a new beneficiary in the first 24 hours. You can send up to $200.00 more now, or the full amount after 3 Nov 2026 06:31 UTC." });
    await send(b, 200);
    expect((await list(b)).ben_casey.allowanceLeft).toBe(0);
    await expect(send(b, 1)).rejects.toMatchObject({ code: "BENEFICIARY_COOLING_OFF", message: expect.stringMatching(/ago\. For your security.* You can send more after 3 Nov 2026 06:31 UTC\.$/) });
  });
  it("counts the same value in the account's currency at the mid rate", async () => {
    const b = bank();
    // the sandbox rate is 0.926 EUR to the dollar, so 500.00 USD is 463.00 EUR
    await expect(send(b, 463.01, "ben_casey", "acc_eur")).rejects.toMatchObject({ code: "BENEFICIARY_COOLING_OFF" });
    await send(b, 463, "ben_casey", "acc_eur");
    expect((await list(b)).ben_casey.allowanceLeft).toBe(0);
  });
  it("no longer applies after 24 hours, and does not apply to an older payee", async () => {
    const b = bank();
    await send(b, 900, "ben_taylor", "acc_save");
    b.now = () => NOW + hours(20);
    await expect(send(b, 600)).rejects.toMatchObject({ code: "BENEFICIARY_COOLING_OFF" });
    b.now = () => NOW + hours(21);
    await send(b, 600);
    expect((await list(b)).ben_casey).toMatchObject({ ageHours: 24, allowanceLeft: null, coolingOffUntil: null });
  });
  it("holds a payee added now to it, and a payee whose bank details just changed", async () => {
    const b = bank();
    await code(b);
    const added = await b.call("bank.payees.save", CAMILLE);
    await expect(send(b, 500.01, added.payeeId)).rejects.toMatchObject({ code: "BENEFICIARY_COOLING_OFF" });
    await code(b);
    await b.call("bank.payees.update", { ...LENA, payeeId: "ben_lena", iban: OTHER_DE, acknowledged: true });
    await expect(send(b, 500.01, "ben_lena")).rejects.toMatchObject({ code: "BENEFICIARY_COOLING_OFF" });
    await send(b, 500, "ben_lena");
  });
});
