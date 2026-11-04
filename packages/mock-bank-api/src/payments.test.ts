import { describe, it, expect } from "vitest";
import { MockBank } from "./index";
import { abaValid, ibanValid, arrival, railOf } from "./rails";

// Wednesday 4 November 2026, ten in the morning (UTC)
const NOW = Date.parse("2026-11-04T10:00:00Z");
const make = (opts: ConstructorParameters<typeof MockBank>[1] = {}) => { const b = new MockBank("alex", opts); let t = NOW; b.now = () => t; return { b, tick: (ms: number) => { t += ms; } }; };
const code = async (p: Promise<unknown>) => p.then(() => "no error", (e) => e.code as string);
const verify = async (b: MockBank) => { await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" }); };
const main = async (b: MockBank) => (await b.call("bank.accounts.list")).acc_main;
const priya = { country: "US", name: "Priya Raman", routingNumber: "021000021", accountNumber: "987654321" };

describe("payee validation, name check and save", () => {
  it("the sample numbers are valid", () => {
    expect(abaValid("021000021")).toBe(true);
    expect(abaValid("021000022")).toBe(false);
    for (const i of ["DE89 3704 0044 0532 0130 00", "FR14 2004 1010 0505 0001 3M02 606", "AE07 0331 2345 6789 0123 456", "SA03 8000 0000 6080 1016 7519", "JO94 CBJO 0010 0000 0000 0131 0003 02"]) expect(ibanValid(i), i).toBe(true);
    expect(ibanValid("DE89 3704 0044 0532 0130 01")).toBe(false);
  });
  it("US: routing checksum and account length, with the bank's name", async () => {
    const { b } = make();
    expect(await b.call("bank.payees.validate", priya)).toMatchObject({ valid: true, market: "us", currency: "USD", bank: "JPMorgan Chase", masked: "ABA 021000021 · ••4321" });
    const bad = await b.call("bank.payees.validate", { ...priya, routingNumber: "123456789", accountNumber: "12" });
    expect(bad.valid).toBe(false);
    expect(bad.errors.routingNumber.code).toBe("INVALID_ROUTING");
    expect(bad.errors.accountNumber.code).toBe("INVALID_ACCOUNT");
  });
  it("Europe: IBAN check, SEPA list, country must match", async () => {
    const { b } = make();
    expect((await b.call("bank.payees.validate", { country: "DE", name: "Lena Fischer", iban: "DE89 3704 0044 0532 0130 00" })).valid).toBe(true);
    expect((await b.call("bank.payees.validate", { country: "DE", name: "x y", iban: "DE89 3704 0044 0532 0130 01" })).errors.iban.code).toBe("INVALID_IBAN");
    expect((await b.call("bank.payees.validate", { country: "DE", name: "x y", iban: "AE07 0331 2345 6789 0123 456" })).errors.iban.code).toBe("NOT_SEPA");
    expect((await b.call("bank.payees.validate", { country: "FR", name: "x y", iban: "DE89 3704 0044 0532 0130 00" })).errors.iban.code).toBe("COUNTRY_MISMATCH");
  });
  it("UK, Middle East and SWIFT fields", async () => {
    const { b } = make();
    expect((await b.call("bank.payees.validate", { country: "GB", name: "James Whitfield", sortCode: "20-00-00", accountNumber: "55779911" })).masked).toBe("20-00-00 · ••9911");
    expect((await b.call("bank.payees.validate", { country: "GB", name: "James Whitfield", sortCode: "2000", accountNumber: "5577" })).errors).toMatchObject({ sortCode: { code: "INVALID_SORT_CODE" }, accountNumber: { code: "INVALID_ACCOUNT" } });
    expect((await b.call("bank.payees.validate", { country: "SA", name: "x y", iban: "AE07 0331 2345 6789 0123 456" })).errors.iban.code).toBe("COUNTRY_MISMATCH");
    expect((await b.call("bank.payees.validate", { country: "JP", name: "Aiko Tanaka", bic: "BOTKJPJT", accountNumber: "1234567890" }))).toMatchObject({ valid: true, market: "intl", currency: "JPY", masked: "BOTKJPJT · ••7890" });
    expect((await b.call("bank.payees.validate", { country: "JP", name: "x y", bic: "BOT", accountNumber: "1234567890" })).errors.bic.code).toBe("INVALID_BIC");
    expect(await code(b.call("bank.payees.validate", { country: "ZZ", name: "x y" }))).toBe("COUNTRY_NOT_SUPPORTED");
  });
  it("the bank's home market decides which identifiers an unnamed country asks for", async () => {
    const uk = make({ config: { homeMarket: "uk" } }).b;
    expect((await uk.call("bank.payees.validate", { name: "James Whitfield", sortCode: "20-00-00", accountNumber: "55779911" }))).toMatchObject({ valid: true, country: "GB", currency: "GBP" });
    expect((await make().b.call("bank.payees.validate", { name: "x y" })).errors).toHaveProperty("routingNumber");
  });
  it("name check: match, close, none, na", async () => {
    const { b } = make();
    const lena = { country: "DE", iban: "DE89 3704 0044 0532 0130 00" };
    expect(await b.call("bank.payees.check", { ...lena, name: "lena  fischer" })).toMatchObject({ result: "match", registeredName: "Lena Fischer" });
    expect((await b.call("bank.payees.check", { ...lena, name: "Lena Fisher" })).result).toBe("close");
    expect((await b.call("bank.payees.check", { ...lena, name: "Bob Smith" })).result).toBe("none");
    expect((await b.call("bank.payees.check", { country: "DE", name: "Anna Weber", iban: "DE02 1203 0000 0000 2020 51" })).result).toBe("na");
    expect((await b.call("bank.payees.check", { country: "JP", name: "Aiko Tanaka", bic: "BOTKJPJT", accountNumber: "1234567890" })).result).toBe("na");
    expect(await code(b.call("bank.payees.check", { country: "US", name: "x y", routingNumber: "1" }))).toBe("INVALID_ROUTING");
  });
  it("saving needs an acknowledgement unless the name matches, and refuses a duplicate", async () => {
    const { b } = make();
    expect(await code(b.call("bank.payees.save", { ...priya, name: "Pria Raman" }))).toBe("PAYEE_NOT_CHECKED");
    const saved = await b.call("bank.payees.save", { ...priya, name: "Pria Raman", acknowledged: true });
    expect(saved).toMatchObject({ name: "Pria Raman", check: "close" });
    expect(Object.keys(await b.call("bank.beneficiaries.list"))).toContain(saved.payeeId);
    expect((await b.call("bank.payees.list"))[saved.payeeId].check).toBe("close");
    expect(await code(b.call("bank.payees.save", { ...priya, acknowledged: true }))).toBe("PAYEE_EXISTS");
    expect((await b.call("bank.payees.save", { country: "US", name: "Maya Chen", routingNumber: "021000021", accountNumber: "123450000" }).catch((e) => e)).code).toBe("PAYEE_NOT_CHECKED");
  });
});

describe("pricing and sending a payment", () => {
  it("US standard to a saved payee: free, 2 business days, balance falls by the amount", async () => {
    const { b } = make();
    const q = await b.call("bank.payments.quote", { fromAccountId: "acc_main", payeeId: "pay_maya", amount: 100, speed: "standard" });
    expect(q).toMatchObject({ speed: "standard", rail: { id: "ach" }, fee: 0, total: 100, receive: { amount: 100, currency: "USD" }, arrivesOn: "2026-11-06", ttlSeconds: 60 });
    expect(q.options.map((o: any) => o.speed)).toEqual(["standard", "sameDay", "instant"]);
    await verify(b);
    const r = await b.call("bank.payments.create", { quoteId: q.quoteId });
    expect(r).toMatchObject({ status: "sent", reference: expect.stringMatching(/^BWX-\d{6}$/), youPay: 100, newBalance: 8620.76, availableBalance: 8502.36, rail: { id: "ach", referenceLabel: "ACH trace number" } });
    expect(r.railReference).toMatch(/^\d{15}$/);
    expect((await b.call("bank.limits.get")).usedToday).toBe(100);
    const tx = Object.values(await b.call("bank.transactions.list", { limit: 1 }))[0] as any;
    expect(tx).toMatchObject({ title: "Maya Chen", amount: -100, reference: r.reference });
  });
  it("the default speed is the region's default rail", async () => {
    const { b } = make();
    const lena = await b.call("bank.payments.quote", { fromAccountId: "acc_main", payeeId: "pay_lena", amount: 200 });
    expect(lena).toMatchObject({ speed: "standard", rail: { id: "sct" }, rate: 0.926, converted: 215.98, fee: 0, total: 215.98 });
    const james = await b.call("bank.payments.quote", { fromAccountId: "acc_main", payeeId: "pay_james", amount: 100 });
    expect(james).toMatchObject({ speed: "instant", rail: { id: "fps" }, converted: 128.04 });
  });
  it("the speed classes map to rails per market", async () => {
    const { b } = make();
    const rails = async (payeeId: string, amount = 100) => (await b.call("bank.payments.quote", { fromAccountId: "acc_main", payeeId, amount, purpose: "Goods or services" })).options.map((o: any) => `${o.speed}:${o.railId}`);
    expect(await rails("pay_maya")).toEqual(["standard:ach", "sameDay:sach", "instant:rtp"]);
    expect(await rails("pay_lena")).toEqual(["standard:sct", "instant:sinst"]);
    expect(await rails("pay_james")).toEqual(["standard:bacs", "sameDay:chaps", "instant:fps"]);
    expect(await rails("pay_omar")).toEqual(["standard:uaefts", "sameDay:uaefts", "instant:aani"]);
  });
  it("a bank can map the classes to other rails", async () => {
    const { b } = make({ config: { speedMap: { us: { standard: ["sach"] } } } });
    expect((await b.call("bank.payments.quote", { fromAccountId: "acc_main", payeeId: "pay_maya", amount: 100, speed: "standard" })).rail.id).toBe("sach");
  });
  it("above a rail's maximum: the default moves on, a forced choice is RAIL_LIMIT", async () => {
    const { b } = make();
    const acc = b.persona.accounts.find((x) => x.id === "acc_save")!; acc.balance = 100_000; acc.available = 100_000;
    const big = { fromAccountId: "acc_save", payeeId: "pay_maya", amount: 30_000 };
    const q = await b.call("bank.payments.quote", big);
    expect(q.options.find((o: any) => o.speed === "standard")).toMatchObject({ available: false, reason: "RAIL_LIMIT" });
    expect(q).toMatchObject({ speed: "sameDay", rail: { id: "sach" }, fee: 1 });
    expect(await code(b.call("bank.payments.quote", { ...big, speed: "standard" }))).toBe("RAIL_LIMIT");
    expect(await code(b.call("bank.payments.quote", { ...big, amount: 600_000, speed: "instant" }))).toBe("RAIL_LIMIT");
  });
  it("a rail that is down is dimmed and the quote offers the next speed; forcing it is RAIL_NOT_AVAILABLE", async () => {
    const { b } = make({ conditions: { unavailable: ["rail:sinst"] } });
    const q = await b.call("bank.payments.quote", { fromAccountId: "acc_main", payeeId: "pay_lena", amount: 50, speed: "standard" });
    expect(q.options.find((o: any) => o.speed === "instant")).toMatchObject({ available: false, reason: "RAIL_NOT_AVAILABLE" });
    expect(await code(b.call("bank.payments.quote", { fromAccountId: "acc_main", payeeId: "pay_lena", amount: 50, speed: "instant" }))).toBe("RAIL_NOT_AVAILABLE");
    // the rail goes down between the quote and the send
    const ok = make();
    const q2 = await ok.b.call("bank.payments.quote", { fromAccountId: "acc_main", payeeId: "pay_lena", amount: 50, speed: "instant" });
    ok.b.conditions = { unavailable: ["rail:sinst"] };
    await verify(ok.b);
    expect(await code(ok.b.call("bank.payments.create", { quoteId: q2.quoteId }))).toBe("RAIL_NOT_AVAILABLE");
  });
  it("same day after the cut-off goes out the next business day", async () => {
    const late = Date.parse("2026-11-04T20:30:00Z");
    expect(arrival(railOf("sach")!, NOW)).toEqual({ arrivesOn: "2026-11-04", afterCutoff: false });
    expect(arrival(railOf("sach")!, late)).toEqual({ arrivesOn: "2026-11-05", afterCutoff: true });
    expect(arrival(railOf("rtp")!, late)).toEqual({ arrivesOn: "2026-11-04", afterCutoff: false });
    expect(arrival(railOf("ach")!, Date.parse("2026-11-06T10:00:00Z")).arrivesOn).toBe("2026-11-10");
  });
  it("SWIFT: conversion, charges, purpose required", async () => {
    const { b } = make();
    const tanaka = { country: "JP", name: "Aiko Tanaka", bic: "BOTKJPJT", accountNumber: "1234567890" };
    expect(await code(b.call("bank.payments.quote", { fromAccountId: "acc_main", payee: tanaka, amount: 15_100, acknowledged: true }))).toBe("PURPOSE_REQUIRED");
    const sha = await b.call("bank.payments.quote", { fromAccountId: "acc_main", payee: tanaka, amount: 15_100, purpose: "Family support", acknowledged: true });
    expect(sha).toMatchObject({ rail: { id: "swift" }, receive: { amount: 15_100, currency: "JPY" }, converted: 100, fee: 25, total: 125, charges: "SHA" });
    const our = await b.call("bank.payments.quote", { fromAccountId: "acc_main", payee: tanaka, amount: 15_100, purpose: "Family support", charges: "OUR", acknowledged: true });
    expect(our).toMatchObject({ fee: 40, total: 140 });
    expect(await code(b.call("bank.payments.quote", { fromAccountId: "acc_main", payee: tanaka, amount: 15_100, purpose: "Family support" }))).toBe("PAYEE_NOT_CHECKED");
    expect(await code(b.call("bank.payments.quote", { fromAccountId: "acc_main", payee: tanaka, amount: 100.5, purpose: "Family support", acknowledged: true }))).toBe("INVALID_AMOUNT");
  });
  it("a new payee is paid and saved when asked; the acknowledgement is recorded", async () => {
    const { b } = make();
    const q = await b.call("bank.payments.quote", { fromAccountId: "acc_main", payee: { ...priya, name: "Pria Raman" }, amount: 40, acknowledged: true, savePayee: true });
    await verify(b);
    const r = await b.call("bank.payments.create", { quoteId: q.quoteId });
    expect(r).toMatchObject({ payeeCheck: "close", acknowledged: true });
    expect(Object.values(await b.call("bank.payees.list")).map((p: any) => p.name)).toContain("Pria Raman");
  });
  it("funds, daily limit and reference are checked", async () => {
    const { b } = make();
    expect(await code(b.call("bank.payments.quote", { fromAccountId: "acc_main", payeeId: "pay_maya", amount: 8_700 }))).toBe("INSUFFICIENT_FUNDS");
    expect(await code(b.call("bank.payments.quote", { fromAccountId: "acc_save", payeeId: "pay_maya", amount: 51_000, speed: "sameDay" }))).toBe("INSUFFICIENT_FUNDS");
    expect(await code(b.call("bank.payments.quote", { fromAccountId: "acc_main", payeeId: "pay_james", amount: 10, reference: "x".repeat(19) }))).toBe("REFERENCE_TOO_LONG");
    expect(await code(b.call("bank.payments.quote", { fromAccountId: "acc_main", payeeId: "pay_maya", amount: 10, reference: "a<b" }))).toBe("INVALID_REFERENCE");
    expect(await code(b.call("bank.payments.quote", { fromAccountId: "acc_eur", payeeId: "pay_maya", amount: 10 }))).toBe("CURRENCY_NOT_SUPPORTED");
    expect(await code(b.call("bank.payments.quote", { fromAccountId: "acc_main", payeeId: "nobody", amount: 10 }))).toBe("PAYEE_NOT_FOUND");
    const limited = new MockBank("alex"); limited.persona.limits.usedToday = 49_950;
    expect(await code(limited.call("bank.payments.quote", { fromAccountId: "acc_main", payeeId: "pay_maya", amount: 100 }))).toBe("DAILY_LIMIT_EXCEEDED");
  });
  it("the rate is held for 60 seconds, a quote is used once", async () => {
    const { b, tick } = make();
    const q = await b.call("bank.payments.quote", { fromAccountId: "acc_main", payeeId: "pay_lena", amount: 100 });
    tick(61_000);
    await verify(b);
    expect(await code(b.call("bank.payments.create", { quoteId: q.quoteId }))).toBe("QUOTE_EXPIRED");
    const q2 = await b.call("bank.payments.quote", { fromAccountId: "acc_main", payeeId: "pay_lena", amount: 100 });
    await b.call("bank.payments.create", { quoteId: q2.quoteId });
    await verify(b);
    expect(await code(b.call("bank.payments.create", { quoteId: q2.quoteId }))).toBe("QUOTE_USED");
    expect(await code(b.call("bank.payments.create", { quoteId: "nope" }))).toBe("QUOTE_NOT_FOUND");
  });
  it("needs the one-time code; three wrong codes is STEP_UP_FAILED and nothing is sent", async () => {
    const { b } = make();
    const q = await b.call("bank.payments.quote", { fromAccountId: "acc_main", payeeId: "pay_maya", amount: 10 });
    expect(await code(b.call("bank.payments.create", { quoteId: q.quoteId }))).toBe("OTP_REQUIRED");
    await b.call("bank.otp.send");
    for (let i = 0; i < 3; i++) await b.call("bank.otp.verify", { code: "999999" }).catch(() => undefined);
    expect(await code(b.call("bank.payments.create", { quoteId: q.quoteId }))).toBe("STEP_UP_FAILED");
    expect((await main(b)).balance).toBe(8720.76);
  });
  it("a payee named Test Sanctions is held: the available balance falls, the ledger balance does not", async () => {
    const { b } = make();
    const q = await b.call("bank.payments.quote", { fromAccountId: "acc_main", payee: { ...priya, name: "Test Sanctions" }, amount: 50, acknowledged: true });
    await verify(b);
    const r = await b.call("bank.payments.create", { quoteId: q.quoteId });
    expect(r).toMatchObject({ status: "held", code: "PAYMENT_HELD", newBalance: 8720.76, availableBalance: 8552.36 });
  });
  it("a payment for a later date takes nothing now and appears in the schedules", async () => {
    const { b } = make();
    await expect(b.call("bank.payments.quote", { fromAccountId: "acc_main", payeeId: "pay_maya", amount: 10, scheduleDate: "2026-11-07" })).rejects.toMatchObject({ code: "INVALID_DATE" });
    const q = await b.call("bank.payments.quote", { fromAccountId: "acc_main", payeeId: "pay_maya", amount: 70, scheduleDate: "2026-11-10" });
    expect(q).toMatchObject({ scheduled: true, arrivesOn: "2026-11-10" });
    await verify(b);
    const r = await b.call("bank.payments.create", { quoteId: q.quoteId });
    expect(r).toMatchObject({ status: "scheduled", newBalance: 8720.76 });
    expect((await b.call("bank.limits.get")).usedToday).toBe(0);
    expect(Object.values(await b.call("bank.schedules.list")).map((s: any) => s.payeeName)).toContain("Maya Chen");
  });
  it("a saved payee under 24 hours old can receive at most 500 in 24 hours", async () => {
    const { b } = make();
    await b.call("bank.payees.save", { ...priya, acknowledged: true });
    const id = Object.keys(await b.call("bank.payees.list")).at(-1)!;
    expect(await code(b.call("bank.payments.quote", { fromAccountId: "acc_main", payeeId: id, amount: 600 }))).toBe("BENEFICIARY_COOLING_OFF");
    expect(await code(b.call("bank.payments.quote", { fromAccountId: "acc_main", payeeId: id, amount: 400 }))).toBe("no error");
  });
  it("timeout and unavailable on create send nothing", async () => {
    const { b } = make();
    const q = await b.call("bank.payments.quote", { fromAccountId: "acc_main", payeeId: "pay_maya", amount: 10 });
    await verify(b);
    b.conditions = { timeout: ["bank.payments.create"] };
    expect(await code(b.call("bank.payments.create", { quoteId: q.quoteId }))).toBe("TIMEOUT");
    b.conditions = { unavailable: ["bank.payments."] };
    expect(await code(b.call("bank.payments.create", { quoteId: q.quoteId }))).toBe("SERVICE_UNAVAILABLE");
    expect((await main(b)).balance).toBe(8720.76);
    b.conditions = {};
    expect((await b.call("bank.payments.create", { quoteId: q.quoteId })).status).toBe("sent");
  });
});

describe("company payments: corp.payments.quote and corp.payments.create", () => {
  const enter = async (b: MockBank, id: string) => { await b.call("bank.session.stepUp", { method: "password", secret: "Bwx!Demo2026" }).catch(() => undefined); await verify(b); await b.call("bank.session.stepUp", { method: "password" }); await b.call("bank.session.switch", { contextId: id }); };
  const pay = { fromAccountId: "alpha_ops", beneficiaryId: "harb", purpose: "Goods or services", reference: "INV-1042" };

  it("12,500 to a US supplier: no code, one approver, waits for approval and moves no money", async () => {
    const { b } = make();
    await enter(b, "alpha");
    const q = await b.call("corp.payments.quote", { ...pay, amount: 12_500 });
    expect(q).toMatchObject({ total: 12_500, currency: "USD", codeRequired: false, requiredApprovers: 1, rail: { id: "ach" }, ttlSeconds: 60 });
    const p = await b.call("corp.payments.create", { quoteId: q.quoteId });
    expect(p).toMatchObject({ status: "pending_approval", initiatedBy: "alex", required: 1, payee: "Harbour Packaging", amount: 12_500, speed: "standard", rail: { id: "ach" }, purpose: "Goods or services" });
    expect(p.id).toBe("PAY-2042");
    expect((await b.call("corp.company.get")).accounts.alpha_ops.balance).toBe(480_000);
    expect((await b.call("corp.payments.get", { paymentId: p.id })).railReference).toMatch(/^\d{15}$/);
  });
  it("60,000: sent over a rail that fits, two approvers, and a code is asked from 25,000", async () => {
    const { b } = make();
    await enter(b, "alpha");
    const q = await b.call("corp.payments.quote", { ...pay, amount: 60_000 });
    expect(q).toMatchObject({ speed: "sameDay", rail: { id: "sach" }, requiredApprovers: 2, codeRequired: true, fee: 1, total: 60_001 });
    expect(await code(b.call("corp.payments.create", { quoteId: q.quoteId }))).toBe("OTP_REQUIRED");
    await verify(b);
    expect((await b.call("corp.payments.create", { quoteId: q.quoteId })).required).toBe(2);
  });
  it("a euro supplier: the conversion is in the quote and the limits are tested on the dollar amount", async () => {
    const { b } = make();
    await enter(b, "alpha");
    const q = await b.call("corp.payments.quote", { fromAccountId: "alpha_ops", beneficiaryId: "nord", amount: 30_000, purpose: "Goods or services", reference: "INV-7" });
    expect(q).toMatchObject({ receive: { amount: 30_000, currency: "EUR" }, rate: 0.926, converted: 32_397.41, total: 32_397.41, codeRequired: true, rail: { id: "sct" } });
  });
  it("purpose and reference are always required; limits and funds are checked", async () => {
    const { b } = make();
    await enter(b, "alpha");
    expect(await code(b.call("corp.payments.quote", { ...pay, amount: 10, purpose: undefined }))).toBe("PURPOSE_REQUIRED");
    expect(await code(b.call("corp.payments.quote", { ...pay, amount: 10, reference: " " }))).toBe("REFERENCE_REQUIRED");
    expect(await code(b.call("corp.payments.quote", { ...pay, amount: 600_000 }))).toBe("INSUFFICIENT_FUNDS");
    expect(await code(b.call("corp.payments.quote", { ...pay, amount: 240_000 }))).toBe("LIMIT_USER_EXCEEDED"); // 18,900 already used today
    expect(await code(b.call("corp.payments.quote", { ...pay, beneficiaryId: "someone-new", amount: 10 }))).toBe("BENEFICIARY_NOT_WHITELISTED");
    expect(await code(b.call("corp.payments.quote", { ...pay, fromAccountId: "alpha_res", amount: 10 }))).toBe("CURRENCY_NOT_SUPPORTED");
  });
  it("a quote cannot be used by someone else, twice, or late; a rail that is down refuses", async () => {
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
  });
  it("another context's quote is not Alex's to use", async () => {
    const { b } = make();
    await enter(b, "alpha");
    const q = await b.call("corp.payments.quote", { ...pay, amount: 100 });
    await b.call("bank.session.switch", { contextId: "beta" });
    expect(await code(b.call("corp.payments.create", { quoteId: q.quoteId }))).toBe("PERMISSION_DENIED");
  });
});
