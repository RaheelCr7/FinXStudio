import { describe, expect, it } from "vitest";
import { ADAPTER_CATALOG, AccessDirectory, MockBank, SIGNED_OUT, type SandboxConditions } from "../index";
import { loanFigures, depositInterest, distanceText, openStatus, HOURS } from "./public-data";

// Tuesday 3 November 2026, 18:45 UTC: the clock the spec pins for opening hours.
const TUE = Date.parse("2026-11-03T18:45:00Z");
const out = (opts: ConstructorParameters<typeof MockBank>[1] = {}) => new MockBank(SIGNED_OUT, { now: TUE, ...opts });
const code = (p: Promise<unknown>) => p.then(() => "ok", (e) => (e as { code?: string }).code ?? (e as Error).message);
const market = (homeMarket: "us" | "uk" | "eu" | "ae") => ({ config: { homeMarket } });

describe("public products", () => {
  it("lists the four groups in the bank's order and returns one product with all its facts", async () => {
    const b = out();
    expect(Object.keys(await b.call("bank.products.list", { type: "account" }))).toEqual(["acc_everyday", "acc_saver", "acc_student"]);
    expect(Object.keys(await b.call("bank.products.list", { type: "loan" }))).toEqual(["loan_personal", "loan_auto", "loan_home"]);
    expect(Object.keys(await b.call("bank.products.list", { type: "deposit" }))).toEqual(["dep_6m", "dep_12m", "dep_24m"]);
    expect(Object.keys(await b.call("bank.products.list", { type: "card" }))).toEqual(["card_debit", "card_credit"]);
    expect(Object.keys(await b.call("bank.products.list", {})).length).toBe(11);
    expect(await b.call("bank.products.get", { productId: "acc_saver" })).toMatchObject({ name: "Aurora Savings", headline: { label: "Rate", value: "3.10% a year" }, termsVersion: "2026-10", action: { journey: "open-account" } });
    expect(await code(b.call("bank.products.get", { productId: "nope" }))).toBe("PRODUCT_NOT_FOUND");
  });
  it("an empty list, a service that is down and a slow one are answered as the conditions say", async () => {
    expect(await out({ conditions: { empty: ["bank.products.list"] } }).call("bank.products.list", {})).toEqual({});
    expect(await code(out({ conditions: { unavailable: ["bank.products.list"] } }).call("bank.products.list", {}))).toBe("SERVICE_UNAVAILABLE");
    expect(await code(out({ conditions: { timeout: ["bank.products.get"], latencyMs: 10000 } }).call("bank.products.get", { productId: "acc_saver" }))).toBe("TIMEOUT");
  });
});

describe("loan figures are whole cents, worked as fractions of whole numbers", () => {
  it("match the spec: 10,000 at 9.9% over 36 months, a car loan and a home loan", () => {
    expect(loanFigures(1_000_000, 990, 36)).toMatchObject({ paymentCents: 32220, totalCents: 1159929, interestCents: 159929 });
    expect(loanFigures(1_500_000, 740, 48).paymentCents).toBe(36198);
    expect(loanFigures(20_000_000, 510, 240).paymentCents).toBe(133098);
    for (const v of Object.values(loanFigures(1_234_500, 990, 60))) expect(Number.isInteger(v)).toBe(true);
  });
  it("the factor a screen follows the amount with gives the same cents as the bank (within one cent)", () => {
    for (const [cents, apr, n] of [[1_000_000, 990, 36], [5_000_000, 740, 84], [75_000_000, 510, 360], [100_000, 990, 6]] as const) {
      const g = loanFigures(cents, apr, n), one = loanFigures(100, apr, n);
      expect(Math.abs(Math.round((cents * one.payFactor) / 1e12) - g.paymentCents)).toBeLessThanOrEqual(1);
      expect(Math.abs(Math.round((cents * one.totalFactor) / 1e12) - g.totalCents)).toBeLessThanOrEqual(1);
    }
  });
  it("simple interest for a deposit: amount x rate x months / 12, rounded half up", () => {
    expect(depositInterest(1_000_000, 390, 12)).toBe(39000);
    expect(depositInterest(1_000_000, 300, 3)).toBe(7500);
    expect(depositInterest(50_000, 330, 60)).toBe(8250);
    // 0.5 of a cent goes up: 500.50 at 3.40% over 6 months is 8.5085, and 100.50 at 3.00% over 6 months is exactly 1.5075
    expect(depositInterest(50_050, 340, 6)).toBe(851);
    expect(depositInterest(10_050, 300, 6)).toBe(151);
  });
});

describe("the loan table", () => {
  it("quotes the spec's figures with the market's symbol and refuses what is outside the table", async () => {
    const b = out();
    const r = await b.call("bank.rates.loans", { type: "personal", amount: 10000, term: 36 });
    expect(r.quote).toMatchObject({ paymentText: "$322.20", interestText: "$1,599.29", totalText: "$11,599.29", termText: "3 years", apr: "9.9%", amountText: "$10,000.00" });
    expect(r.quote.reference).toMatch(/^EST-20261103-/);
    expect((await b.call("bank.rates.loans", { type: "auto", amount: 15000, term: 48 })).quote.paymentText).toBe("$361.98");
    expect((await b.call("bank.rates.loans", { type: "home", amount: 200000, term: 240 })).quote.paymentText).toBe("$1,330.98");
    const q = (input: Record<string, unknown>) => code(b.call("bank.rates.loans", input));
    expect(await q({ type: "personal", amount: 500, term: 36 })).toBe("AMOUNT_RANGE");
    expect(await q({ type: "personal", amount: 60000, term: 36 })).toBe("AMOUNT_RANGE");
    expect(await q({ type: "personal", amount: 10250, term: 36 })).toBe("AMOUNT_STEP");
    expect(await q({ type: "personal", amount: 10000, term: 5 })).toBe("TERM_INVALID");
    expect(await q({ type: "personal", amount: 10000, term: 37 })).toBe("TERM_INVALID");
    expect(await q({ type: "auto", amount: 10000, term: 6 })).toBe("TERM_INVALID");
    expect(await q({ type: "boat", amount: 10000, term: 36 })).toBe("LOAN_TYPE_INVALID");
    expect(await q({ type: "personal", term: 36 })).toBe("AMOUNT_REQUIRED");
  });
  it("lists the table with the start values and a factor for every term; home loans only when the bank offers them", async () => {
    const t = await out().call("bank.rates.loans", {});
    expect(Object.keys(t.loans)).toEqual(["personal", "auto", "home"]);
    expect(t.loans.personal).toMatchObject({ startAmount: 10000, startTerm: 36, amountStep: 500, termMin: 6, termMax: 84 });
    expect(Object.keys(t.loans.home.factors).length).toBe(26);
    expect(Object.keys((await out({ config: { options: { "loan-calculator": { showHome: false } } } }).call("bank.rates.loans", {})).loans)).toEqual(["personal", "auto"]);
    expect(Object.keys((await out().call("bank.rates.loans", { showHome: false })).loans)).toEqual(["personal", "auto"]);
  });
  it("every amount uses the symbol of the home market", async () => {
    for (const [m, sym] of [["us", "$"], ["uk", "£"], ["eu", "€"], ["ae", "AED "]] as const) {
      const r = await out(market(m)).call("bank.rates.loans", { type: "personal", amount: 10000, term: 36 });
      expect([r.symbol, r.quote.paymentText.startsWith(sym)]).toEqual([sym, true]);
    }
  });
});

describe("the deposit table", () => {
  it("works out the interest for each term, at the end or every month", async () => {
    const b = out(), q = async (amount: number, term: number, pay = "end") => (await b.call("bank.rates.deposits", { amount, term, pay })).quote;
    expect(await q(10000, 12)).toMatchObject({ rateText: "3.90% a year", interestText: "$390.00", returnText: "$10,390.00" });
    expect(await q(10000, 12, "monthly")).toMatchObject({ monthlyText: "$32.50", payText: "Every month" });
    expect(await q(10000, 3)).toMatchObject({ rateText: "3.00% a year", interestText: "$75.00" });
    expect(await q(500, 60)).toMatchObject({ rateText: "3.30% a year", interestText: "$82.50", termText: "5 years" });
    expect((await b.call("bank.rates.deposits", {})).terms["24"]).toMatchObject({ rateH: 360, name: "2 years" });
  });
  it("refuses what the table does not have, and monthly interest when the bank does not offer it", async () => {
    const b = out(), q = (input: Record<string, unknown>) => code(b.call("bank.rates.deposits", input));
    expect(await q({ amount: 400, term: 12 })).toBe("AMOUNT_RANGE");
    expect(await q({ amount: 100500, term: 12 })).toBe("AMOUNT_RANGE");
    expect(await q({ amount: 10250, term: 12 })).toBe("AMOUNT_STEP");
    expect(await q({ amount: 10000, term: 7 })).toBe("TERM_INVALID");
    expect(await q({ amount: 10000, term: 12, pay: "daily" })).toBe("PAY_INVALID");
    const off = out({ config: { options: { "deposit-calculator": { allowMonthly: false } } } });
    expect(await code(off.call("bank.rates.deposits", { amount: 10000, term: 12, pay: "monthly" }))).toBe("PAY_UNAVAILABLE");
    expect((await off.call("bank.rates.deposits", {})).allowMonthly).toBe(false);
  });
});

describe("branches and cash machines", () => {
  it("lists them nearest first with the chip and the status worked out from the hours and the clock", async () => {
    const r = await out().call("bank.locations.search", {});
    const list = Object.values<any>(r.places);
    expect(list.map((p) => p.id)).toEqual(["a1", "b1", "a2", "b2", "a3", "b3", "a4", "b4"]);
    expect(list[0]).toMatchObject({ name: "Central Plaza cash machine", distanceText: "0.2 mi", chip: "Open", status: "Closes 24:00" });
    expect(r.places.b1).toMatchObject({ distanceText: "0.5 mi", chip: "Closed", status: "Opens tomorrow 09:00" });
    expect(r.places.b2).toMatchObject({ chip: "Open", status: "Closes 20:00" });
    expect(r.places.a3).toMatchObject({ chip: "Open", status: "Closes 22:00" });
  });
  it("shows kilometres in Markets C and D and miles in A and B, with one decimal", async () => {
    expect(Object.values<any>((await out(market("eu")).call("bank.locations.search", {})).places).slice(0, 3).map((p) => p.distanceText)).toEqual(["0.4 km", "0.8 km", "1.2 km"]);
    expect((await out(market("uk")).call("bank.locations.search", {})).places.b4.distanceText).toBe("7.7 mi");
    expect((await out(market("ae")).call("bank.locations.search", {})).unit).toBe("km");
    expect(distanceText(5.8, "mi")).toBe("3.6 mi");
  });
  it("the search matches the name, address or area; the kind and Open now narrow the list", async () => {
    const b = out(), ids = async (input: Record<string, unknown>) => Object.keys((await b.call("bank.locations.search", input)).places);
    expect(await ids({ query: "riverside" })).toEqual(["a3", "b3"]);
    expect(await ids({ query: "RIVERSIDE" })).toEqual(["a3", "b3"]);
    expect(await ids({ query: "market" })).toEqual(["b2"]);
    expect(await ids({ query: "1 example" })).toEqual(["b1"]);
    expect(await ids({ kind: "branch" })).toEqual(["b1", "b2", "b3", "b4"]);
    expect(await ids({ kind: "atm" })).toEqual(["a1", "a2", "a3", "a4"]);
    expect(await ids({ query: "riverside", openNow: true })).toEqual(["a3"]);
    expect(await ids({ openNow: true })).toEqual(["a1", "a2", "b2", "a3", "a4", "b4"]);
    expect(await ids({ query: "zzz" })).toEqual([]);
  });
  it("cash machines only when the bank shows them, the Open now filter only when it offers it", async () => {
    const off = out({ config: { options: { "find-branch-atm": { showAtms: false, openNow: false } } } });
    expect(Object.keys((await off.call("bank.locations.search", {})).places)).toEqual(["b1", "b2", "b3", "b4"]);
    expect(Object.keys((await off.call("bank.locations.search", { kind: "atm" })).places)).toEqual(["b1", "b2", "b3", "b4"]);
    expect(Object.keys((await off.call("bank.locations.search", { openNow: true })).places).length).toBe(4);
    expect(Object.keys((await out().call("bank.locations.search", { showAtms: false })).places)).toEqual(["b1", "b2", "b3", "b4"]);
  });
  it("opens a place with its seven opening-hours rows and its services", async () => {
    const d = await out().call("bank.locations.details", { placeId: "b2" });
    expect(d).toMatchObject({ name: "Market Street Branch", reference: "MAP-B2", services: ["Cash deposits", "Safe deposit boxes", "Step-free access"], hours: { sunday: "10:00 to 16:00", monday: "08:00 to 20:00", saturday: "08:00 to 20:00" } });
    expect(Object.keys(d.hours)).toEqual(["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]);
    expect((await out().call("bank.locations.details", { placeId: "a1" })).hours.tuesday).toBe("Open 24 hours");
    expect(await code(out().call("bank.locations.details", { placeId: "zz" }))).toBe("NOT_FOUND");
  });
  it("the status text follows the day: opens later today, tomorrow, or on another day", () => {
    const at = (iso: string) => openStatus(HOURS.branch, Date.parse(iso));
    expect(at("2026-11-03T07:00:00Z")).toMatchObject({ chip: "Closed", text: "Opens 09:00" });
    expect(at("2026-11-03T12:00:00Z")).toMatchObject({ chip: "Open", text: "Closes 17:00" });
    expect(at("2026-11-06T18:00:00Z")).toMatchObject({ chip: "Closed", text: "Opens tomorrow 09:00" });
    expect(at("2026-11-08T12:00:00Z")).toMatchObject({ chip: "Closed", text: "Opens tomorrow 09:00" });
    expect(at("2026-11-07T14:00:00Z")).toMatchObject({ text: "Opens Mon 09:00" });
    expect(openStatus(HOURS.call, Date.parse("2026-11-06T19:00:00Z")).text).toBe("Opens Mon 08:00");
    expect(openStatus(HOURS.branch.map(() => null), TUE).text).toBe("Closed");
  });
});

describe("contact us", () => {
  it("says which ways are open from their own hours and the clock", async () => {
    const h = await out().call("bank.support.hours", {});
    expect(h.choices.chat).toMatchObject({ chip: "Open now", status: "Closes 20:00" });
    expect(h.choices.call).toMatchObject({ chip: "Closed", status: "Opens tomorrow 08:00" });
    expect(h.choices.message).toMatchObject({ chip: "Open now", status: "Any time" });
    expect(h.callHours).toMatchObject({ saturday: "Closed", sunday: "Closed", monday: "08:00 to 18:00" });
    expect(h.callSummary).toBe("Mon to Fri, 08:00 to 18:00");
    expect(h.callReference).toMatch(/^CALL-20261103-/);
  });
  it("offers chat and call only when the bank does, and message always", async () => {
    const h = await out({ config: { options: { "contact-support": { allowChat: false, allowCall: false } } } }).call("bank.support.hours", {});
    expect(Object.keys(h.choices)).toEqual(["message"]);
    expect(Object.keys((await out().call("bank.support.hours", { allowChat: false })).choices)).toEqual(["call", "message"]);
    expect(await code(out({ config: { options: { "contact-support": { allowChat: false } } } }).call("bank.support.openChat", { topic: "Cards", text: "I need help with my card." }))).toBe("WAY_UNAVAILABLE");
  });
  it("a chat needs a topic and 5 to 300 characters; a message a topic, an email and 10 to 1000 characters", async () => {
    const b = out();
    expect(await b.call("bank.support.openChat", { topic: "Cards", text: "I need help with my card." })).toMatchObject({ waitMinutes: 2, reference: "CHAT-20261103-0001" });
    expect(await code(b.call("bank.support.openChat", { topic: "Cards", text: "Hi" }))).toBe("TEXT_INVALID");
    expect(await code(b.call("bank.support.openChat", { topic: "Cards", text: "x".repeat(301) }))).toBe("TEXT_INVALID");
    expect(await code(b.call("bank.support.openChat", { topic: "Weather", text: "I need help" }))).toBe("TOPIC_INVALID");
    const m = (input: Record<string, unknown>) => code(b.call("bank.support.sendMessage", { topic: "Accounts", email: "alex.morgan@example.com", text: "Please help me with my account.", ...input }));
    expect(await m({ email: "alex" })).toBe("EMAIL_INVALID");
    expect(await m({ text: "Hello" })).toBe("TEXT_INVALID");
    expect(await m({ text: "y".repeat(1001) })).toBe("TEXT_INVALID");
    expect(await m({ topic: "" })).toBe("TOPIC_INVALID");
    expect(await m({})).toBe("ok");
  });
  it("keeps only a masked address and a count: never the text or the address, and limits a device to five messages an hour", async () => {
    const b = out(), send = (n: number) => b.call("bank.support.sendMessage", { topic: "Accounts", email: "alex.morgan@example.com", text: `Please help me with my account ${n}.` });
    for (let i = 0; i < 5; i++) await send(i);
    expect(await code(send(6))).toBe("RATE_LIMITED");
    const i = await b.call("sandbox.public.inspect", { contains: "alex.morgan" });
    expect([i.contains, i.support.messages, i.outbox[0]]).toEqual([false, 5, { to: "a•••@example.com", kind: "support-reply" }]);
    expect((await b.call("sandbox.public.inspect", { contains: "Please help me" })).contains).toBe(false);
    b.now = () => TUE + 61 * 60_000;
    expect(await code(send(7))).toBe("ok");
  });
});

/** The photos' outcomes are set by conditions: the first photo of that kind fails and a retake passes. */
const onboard = (opts: ConstructorParameters<typeof MockBank>[1] = {}, conditions?: SandboxConditions) => out({ ...opts, conditions });
async function verified(b: MockBank, mobile = "5550104410", email = "alex.morgan@example.org") {
  const s = await b.call("bank.onboarding.start", { mobile, email });
  await b.call("bank.otp.send", { channel: "sms" }); await b.call("bank.otp.verify", { code: "482100" });
  return s.applicationId as string;
}
const ABOUT = { name: "Alex Morgan", dob: "14/03/1990", nationality: "United States", idNumber: "123456789" };
const ADDRESS = { line1: "12 Harbour Road", city: "Springfield", postcode: "10001", country: "United States" };
const WORK = { employment: "Employed", income: "50-100", source: "Salary", deposits: "2-10" };
const TAX = { taxOnly: "yes" };
const SUBMIT = { ...ABOUT, ...ADDRESS, ...WORK, ...TAX, product: "acc_everyday", terms: true, taxConfirm: true, signed: true };
async function ready(b: MockBank, extra: Record<string, unknown> = {}, mobile?: string, email?: string) {
  const applicationId = await verified(b, mobile, email);
  await b.call("bank.onboarding.check", { applicationId, step: "id", idDocument: "national-id", front: "SIM-FRONT-1", back: "SIM-BACK-1" });
  await b.call("bank.onboarding.verifyIdentity", { applicationId, selfie: "SIM-SELFIE-1", dob: "14/03/1990", idNumber: "123456789" });
  return b.call("bank.onboarding.submit", { applicationId, ...SUBMIT, ...extra });
}

describe("opening an account: the code, the market and the checks", () => {
  it("asks for the market's rules and offers only the accounts the bank offers", async () => {
    const a = await out().call("bank.onboarding.begin", {});
    expect(a).toMatchObject({ market: "A", symbol: "$", idHint: "9 digits", poa: false, postcode: true, preselect: "acc_everyday", welcome: "" });
    expect(Object.keys(a.accounts)).toEqual(["acc_everyday", "acc_saver"]);
    expect(a.incomeBands["o1m"].name).toBe("Over $1M");
    expect(Object.keys((await out({ config: { options: { "open-account": { offerSaver: false, offerIslamic: true } } } }).call("bank.onboarding.begin", {})).accounts)).toEqual(["acc_everyday", "acc_islamic"]);
    expect((await out().call("bank.onboarding.begin", { productId: "acc_saver" })).preselect).toBe("acc_saver");
    expect((await out({ config: { options: { "open-account": { offerSaver: false } } } }).call("bank.onboarding.begin", { productId: "acc_saver" })).preselect).toBe("acc_everyday");
    expect((await out().call("bank.onboarding.begin", { productId: "loan_home" })).welcome).toBe("Home loan");
    const d = await out(market("ae")).call("bank.onboarding.begin", {});
    expect(d).toMatchObject({ market: "D", symbol: "AED ", poa: true, postcode: false, country: "United Arab Emirates", idMessage: "Enter the 15 digits, starting 784." });
    expect((await out({ config: { homeMarket: "ae", options: { "open-account": { requirePoa: false } } } }).call("bank.onboarding.begin", {})).poa).toBe(false);
  });
  it("starts with a mobile number and an email, stops a duplicate, and sends the code to the mobile", async () => {
    const b = out();
    expect(await code(b.call("bank.onboarding.start", { mobile: "12", email: "a@example.org" }))).toBe("PHONE_INVALID");
    expect(await code(b.call("bank.onboarding.start", { mobile: "5550104410", email: "alex" }))).toBe("EMAIL_INVALID");
    expect(await code(b.call("bank.onboarding.start", { mobile: "5550104410", email: "duplicate@example.com" }))).toBe("DUPLICATE_APPLICATION");
    expect(await code(b.call("bank.onboarding.start", { mobile: "555 010 0999", email: "other@example.org" }))).toBe("DUPLICATE_APPLICATION");
    expect(await b.call("bank.onboarding.start", { mobile: "+1 (555) 010-4410", email: "alex.morgan@example.org" })).toMatchObject({ maskedMobile: "••• 4410" });
    expect(await b.call("bank.otp.send", { channel: "sms" })).toMatchObject({ sent: true, maskedPhone: "••• 4410" });
    expect(await code(b.call("bank.otp.verify", { code: "000000" }))).toBe("OTP_INVALID");
    expect(await code(b.call("bank.otp.verify", { code: "999999" }))).toBe("OTP_EXPIRED");
    expect(await b.call("bank.otp.verify", { code: "482100" })).toEqual({ verified: true });
  });
  it("a code is sent at most four times, a new one makes the old one useless, and one is needed before anything is saved or checked", async () => {
    const b = out(), s = await b.call("bank.onboarding.start", { mobile: "5550104410", email: "alex.morgan@example.org" });
    expect(await code(b.call("bank.onboarding.save", { applicationId: s.applicationId, ...ABOUT }))).toBe("NOT_VERIFIED");
    expect(await code(b.call("bank.onboarding.check", { applicationId: s.applicationId, step: "about", ...ABOUT }))).toBe("NOT_VERIFIED");
    await b.call("bank.otp.send", {}); await b.call("bank.otp.send", { resend: true });
    expect(await code(b.call("bank.otp.verify", { code: "482100" }))).toBe("OTP_INVALID");
    expect(await b.call("bank.otp.verify", { code: "482101" })).toEqual({ verified: true });
    await b.call("bank.otp.send", {}); await b.call("bank.otp.send", {});
    expect(await code(b.call("bank.otp.send", {}))).toBe("OTP_RESEND_LIMIT");
    b.now = () => TUE + 6 * 60_000;
    expect(await code(b.call("bank.otp.verify", { code: "482103" }))).toBe("OTP_EXPIRED");
  });
  it("checks the name, the date of birth, the nationality and the ID number in the format of the market", async () => {
    const b = out(), applicationId = await verified(b), t = (more: Record<string, unknown>) => code(b.call("bank.onboarding.check", { applicationId, step: "about", ...ABOUT, ...more }));
    expect(await t({})).toBe("ok");
    expect(await t({ name: "Alex" })).toBe("NAME_PARTS");
    expect(await t({ name: "Alex 99" })).toBe("NAME_INVALID");
    expect(await t({ dob: "14/03/2010" })).toBe("UNDER_AGE");
    expect(await t({ dob: "31/02/1990" })).toBe("DOB_FORMAT");
    expect(await t({ dob: "14-03-1990" })).toBe("DOB_FORMAT");
    expect(await t({ dob: "14/03/2030" })).toBe("DOB_RANGE");
    expect(await t({ dob: "14/03/1900" })).toBe("DOB_RANGE");
    expect(await t({ dob: "03/11/2008" })).toBe("ok"); // 18 today
    expect(await t({ dob: "04/11/2008" })).toBe("UNDER_AGE");
    expect(await t({ nationality: "" })).toBe("NATIONALITY_REQUIRED");
    expect(await t({ idNumber: "12345" })).toBe("ID_INVALID");
    expect(await t({ idNumber: "12345678A" })).toBe("ID_INVALID");
  });
  it("the ID number follows the market: letters and digits in B, 8 to 14 in C, 15 digits starting 784 in D", async () => {
    const t = async (m: "uk" | "eu" | "ae", idNumber: string) => { const b = out(market(m)); const applicationId = await verified(b); return code(b.call("bank.onboarding.check", { applicationId, step: "about", ...ABOUT, idNumber })); };
    expect(await t("uk", "QQ123456C")).toBe("ok"); expect(await t("uk", "123456789")).toBe("ID_INVALID");
    expect(await t("eu", "AB12345678")).toBe("ok"); expect(await t("eu", "AB123")).toBe("ID_INVALID");
    expect(await t("ae", "784199012345678")).toBe("ok"); expect(await t("ae", "123199012345678")).toBe("ID_INVALID");
  });
  it("checks the address, the postcode only where the market has one, the work answers and the tax details", async () => {
    const b = out(), applicationId = await verified(b), t = (step: string, more: Record<string, unknown>) => code(b.call("bank.onboarding.check", { applicationId, step, ...more }));
    expect(await t("address", ADDRESS)).toBe("ok");
    expect(await t("address", { ...ADDRESS, line1: "12" })).toBe("ADDRESS_INCOMPLETE");
    expect(await t("address", { ...ADDRESS, city: "" })).toBe("ADDRESS_INCOMPLETE");
    expect(await t("address", { ...ADDRESS, postcode: "1" })).toBe("POSTCODE_INVALID");
    expect(await t("work", WORK)).toBe("ok");
    expect(await t("work", { ...WORK, income: "rich" })).toBe("WORK_INVALID");
    expect(await t("tax", TAX)).toBe("ok");
    expect(await t("tax", { taxOnly: "no" })).toBe("TAX_REQUIRED");
    expect(await t("tax", { taxOnly: "no", taxCountry: "Germany", taxId: "123" })).toBe("TAX_REQUIRED");
    expect(await t("tax", { taxOnly: "no", taxCountry: "Germany", taxId: "12$45" })).toBe("TIN_INVALID");
    expect(await t("tax", { taxOnly: "no", taxCountry: "Germany", taxId: "DE 4455" })).toBe("ok");
    expect(await t("nothing", {})).toBe("STEP_UNKNOWN");
    const d = out(market("ae")), id = await verified(d);
    expect(await code(d.call("bank.onboarding.check", { applicationId: id, step: "address", ...ADDRESS, postcode: "" }))).toBe("ok");
  });
  it("asks for a proof of address where the market asks, and refuses one that is too old", async () => {
    const d = onboard(market("ae"), { onboarding: { poa: "old" } }), id = await verified(d), t = (more: Record<string, unknown>) => code(d.call("bank.onboarding.check", { applicationId: id, step: "poa", ...more }));
    expect(await t({})).toBe("POA_REQUIRED");
    expect(await t({ proofName: "bill.pdf" })).toBe("POA_TOO_OLD");
    expect(await t({ proofName: "bill2.pdf" })).toBe("ok");
    const a = out(), ida = await verified(a);
    expect(await a.call("bank.onboarding.check", { applicationId: ida, step: "poa" })).toEqual({ ok: true, asked: false });
  });
  it("the ID photos are readable and not expired, the selfie is live and in good light, and the details match (the birth year inside a Market D ID number)", async () => {
    const run = async (c: SandboxConditions["onboarding"], opts: ConstructorParameters<typeof MockBank>[1] = {}) => { const b = onboard(opts, { onboarding: c }); return { b, id: await verified(b) }; };
    const idCheck = (b: MockBank, id: string, idDocument = "national-id") => code(b.call("bank.onboarding.check", { applicationId: id, step: "id", idDocument, front: "SIM-FRONT-1", back: "SIM-BACK-1" }));
    let r = await run({ id: "unreadable" });
    expect(await idCheck(r.b, r.id)).toBe("ID_UNREADABLE"); expect(await idCheck(r.b, r.id)).toBe("ok");
    r = await run({ id: "expired" });
    expect(await idCheck(r.b, r.id)).toBe("ID_EXPIRED"); expect(await idCheck(r.b, r.id)).toBe("ok");
    r = await run({});
    expect(await code(r.b.call("bank.onboarding.check", { applicationId: r.id, step: "id", idDocument: "national-id", front: "SIM-FRONT-1" }))).toBe("PHOTO_MISSING");
    expect(await code(r.b.call("bank.onboarding.check", { applicationId: r.id, step: "id", idDocument: "passport", front: "SIM-FRONT-1" }))).toBe("ok");
    expect(await code(r.b.call("bank.onboarding.check", { applicationId: r.id, step: "id", idDocument: "cheque", front: "x", back: "y" }))).toBe("DOCUMENT_REQUIRED");
    const selfie = (b: MockBank, id: string, more: Record<string, unknown> = {}) => code(b.call("bank.onboarding.verifyIdentity", { applicationId: id, selfie: "SIM-SELFIE-1", dob: "14/03/1990", idNumber: "123456789", ...more }));
    r = await run({ selfie: "dark" });
    expect(await selfie(r.b, r.id)).toBe("LIVENESS_LOW_LIGHT"); expect(await selfie(r.b, r.id)).toBe("ok");
    r = await run({ selfie: "notLive" });
    expect(await selfie(r.b, r.id)).toBe("LIVENESS_FAILED"); expect(await selfie(r.b, r.id)).toBe("ok");
    expect(await code(r.b.call("bank.onboarding.verifyIdentity", { applicationId: r.id, dob: "14/03/1990" }))).toBe("PHOTO_MISSING");
    r = await run({ match: "mismatch" });
    expect(await selfie(r.b, r.id)).toBe("ID_MISMATCH"); expect(await selfie(r.b, r.id)).toBe("ok");
    const d = await run({}, market("ae"));
    expect(await selfie(d.b, d.id, { idNumber: "784199012345678", dob: "02/05/1991" })).toBe("ID_MISMATCH");
    expect(await selfie(d.b, d.id, { idNumber: "784199012345678", dob: "02/05/1990" })).toBe("ok");
  });
  it("saves the answers for 30 days without the photos, the code, the ID number or the tax ID, and resumes them on the same device", async () => {
    const b = out(), id = await verified(b);
    const s = await b.call("bank.onboarding.save", { applicationId: id, ...ABOUT, ...ADDRESS, front: "SIM-FRONT-1", selfie: "SIM-SELFIE-1", code: "482100", proofName: "bill.pdf", taxId: "TIN-99-0099" });
    expect(s).toMatchObject({ savedText: "Saved. Continue any time in the next 30 days.", days: 30, savedUntil: "2026-12-03T18:45:00.000Z" });
    const i = await b.call("sandbox.public.inspect", {});
    expect(i.draft).toMatchObject({ verified: true, hasId: true, idMasked: "•••• 789", taxMasked: "•••• 99" });
    expect(i.draft.keys).toEqual(["city", "country", "dob", "line1", "name", "nationality", "postcode"]);
    for (const secret of ["123456789", "TIN-99-0099", "SIM-FRONT", "SIM-SELFIE", "482100", "bill.pdf", "alex.morgan@example.org", "5550104410"]) expect((await b.call("sandbox.public.inspect", { contains: secret })).contains, secret).toBe(false);
    const r = await b.call("bank.onboarding.begin", {});
    expect(r.saved).toMatchObject({ found: true, name: "Alex Morgan", idMasked: "•••• 789", savedText: "Saved 3 Nov 18:45. You’ll retake your photos." });
    expect(r.saved.answers).toMatchObject({ name: "Alex Morgan", dob: "14/03/1990", line1: "12 Harbour Road" });
    expect(JSON.stringify(r)).not.toContain("123456789");
    expect((await b.call("bank.onboarding.begin", { fresh: true })).saved.found).toBe(false);
    expect((await out({ config: { options: { "open-account": { allowSave: false } } } }).call("bank.onboarding.begin", {})).saved.found).toBe(false);
  });
  it("a saved application ends after 30 days and Start again discards it; saving can be switched off", async () => {
    const b = out(), id = await verified(b);
    await b.call("bank.onboarding.save", { applicationId: id, ...ABOUT });
    b.now = () => TUE + 29 * 86_400_000; expect((await b.call("bank.onboarding.begin", {})).saved.found).toBe(true);
    b.now = () => TUE + 31 * 86_400_000; expect((await b.call("bank.onboarding.begin", {})).saved.found).toBe(false);
    expect((await b.call("sandbox.public.inspect", {})).drafts).toBe(0);
    const c = out(), id2 = await verified(c); await c.call("bank.onboarding.save", { applicationId: id2, ...ABOUT });
    await c.call("bank.onboarding.discard", { applicationId: id2 });
    expect((await c.call("bank.onboarding.begin", {})).saved.found).toBe(false);
    const off = out({ config: { options: { "open-account": { allowSave: false } } } }), id3 = await verified(off);
    expect(await code(off.call("bank.onboarding.save", { applicationId: id3, ...ABOUT }))).toBe("SAVE_OFF");
  });
  it("a draft belongs to its device, and a later start replaces it", async () => {
    const dir = new AccessDirectory();
    const a = out({ directory: dir, device: { id: "dev_a", name: "A", kind: "phone" } }), b2 = out({ directory: dir, device: { id: "dev_b", name: "B", kind: "phone" } });
    const id = await verified(a); await a.call("bank.onboarding.save", { applicationId: id, ...ABOUT });
    expect((await b2.call("bank.onboarding.begin", {})).saved.found).toBe(false);
    expect((await a.call("bank.onboarding.begin", {})).saved.found).toBe(true);
    await verified(a, "5550104411", "second@example.org");
    expect((await a.call("bank.onboarding.begin", {})).saved.found).toBe(false);
    expect(await code(a.call("bank.onboarding.save", { applicationId: id, ...ABOUT }))).toBe("APPLICATION_NOT_FOUND");
  });
  it("sends the application with both ticks, an identity that was checked and an account the bank offers, and keeps no answers once sent", async () => {
    const b = out(), id = await verified(b), call = (more: Record<string, unknown>) => code(b.call("bank.onboarding.submit", { applicationId: id, ...SUBMIT, ...more }));
    expect(await call({})).toBe("IDENTITY_NOT_VERIFIED");
    await b.call("bank.onboarding.check", { applicationId: id, step: "id", idDocument: "national-id", front: "a", back: "b" });
    await b.call("bank.onboarding.verifyIdentity", { applicationId: id, selfie: "c", dob: "14/03/1990", idNumber: "123456789" });
    expect(await call({ terms: false })).toBe("CONSENT_REQUIRED");
    expect(await call({ taxConfirm: false })).toBe("CONSENT_REQUIRED");
    expect(await call({ signed: false })).toBe("CONSENT_REQUIRED");
    expect(await call({ product: "acc_islamic" })).toBe("PRODUCT_UNAVAILABLE");
    expect(await call({ dob: "14/03/2010" })).toBe("UNDER_AGE");
    expect(await call({ idNumber: "1" })).toBe("ID_INVALID");
    expect(await call({ postcode: "?" })).toBe("POSTCODE_INVALID");
    expect(await call({ taxOnly: "no", taxCountry: "Germany", taxId: "12" })).toBe("TAX_REQUIRED");
    expect(await call({ taxOnly: "no", taxCountry: "Germany", taxId: "1$$$$" })).toBe("TIN_INVALID");
    const r = await b.call("bank.onboarding.submit", { applicationId: id, ...SUBMIT });
    expect(r).toMatchObject({ reference: "APP-100236", status: "checking", productName: "Everyday Account" });
    const i = await b.call("sandbox.public.inspect", {});
    expect([i.drafts, i.submitted, i.draft]).toEqual([0, 4, null]);
    expect(i.outbox).toEqual([{ to: "••• 4410", kind: "application-received" }, { to: "a•••@example.org", kind: "application-received" }]);
    for (const secret of ["123456789", "Alex Morgan", "12 Harbour Road", "5550104410", "alex.morgan@example.org", "14/03/1990"]) expect((await b.call("sandbox.public.inspect", { contains: secret })).contains, secret).toBe(false);
  });
  it("income over 1M goes to manual review when the bank asks for it, and the next application gets the next number", async () => {
    expect((await ready(out(), { income: "o1m" })).status).toBe("manual-review");
    expect((await ready(out({ config: { options: { "open-account": { reviewHigh: false } } } }), { income: "o1m" })).status).toBe("checking");
    expect((await ready(out(), { income: "o1m", reviewHigh: false })).status).toBe("checking");
    const b = out(); await ready(b); expect((await ready(b, {}, "5550104411", "second@example.org")).reference).toBe("APP-100237");
  });
  it("can be declined by the bank, and an application sent is found with its number", async () => {
    expect(await code(ready(onboard({}, { onboarding: { decline: true } })))).toBe("APPLICATION_NOT_ACCEPTED");
    const b = out(), r = await ready(b);
    expect(await b.call("bank.applications.find", { reference: r.reference, mobile: "5550104410" })).toMatchObject({ found: true, needsCode: true, maskedMobile: "••• 4410" });
  });
  it("an application made in one bank is found in the next one of the same app (the directory is shared)", async () => {
    const dir = new AccessDirectory(), a = out({ directory: dir }), r = await ready(a), b = out({ directory: dir });
    expect((await b.call("bank.applications.find", { reference: r.reference, mobile: "5550104410" })).found).toBe(true);
    expect((await out().call("sandbox.public.inspect", {})).submitted).toBe(3);
  });
});

describe("tracking an application", () => {
  const find = (b: MockBank, reference = "APP-100234", mobile = "5550100123") => b.call("bank.applications.find", { reference, mobile });
  const codeOk = async (b: MockBank) => { await b.call("bank.otp.send", {}); await b.call("bank.otp.verify", { code: "482100" }); };
  it("needs the number and the last six digits of the mobile, and says nothing of which part was wrong", async () => {
    const b = out();
    expect(await find(b, " app-100234 ", "(555) 010-0123")).toMatchObject({ found: true, needsCode: true, maskedMobile: "••• 0123" });
    for (const [ref, mob] of [["APP-100234", "5550100999"], ["APP-999999", "5550100123"], ["APP-12", "5550100123"], ["APP-100234", "12"]] as const) {
      const e: any = await find(out(), ref, mob).catch((x) => x);
      expect([e.code, e.message]).toEqual(["NOT_FOUND", "We couldn’t find an application with those details. Check them and try again."]);
    }
  });
  it("shows the status only after the code, and never before", async () => {
    const b = out();
    expect(await code(b.call("bank.applications.status", {}))).toBe("FIND_FIRST");
    await find(b);
    expect(await code(b.call("bank.applications.status", {}))).toBe("OTP_REQUIRED");
    await b.call("bank.otp.send", {});
    expect(await code(b.call("bank.otp.verify", { code: "000000" }))).toBe("OTP_INVALID");
    expect(await code(b.call("bank.applications.status", {}))).toBe("OTP_REQUIRED");
    await b.call("bank.otp.verify", { code: "482100" });
    expect(await b.call("bank.applications.status", {})).toMatchObject({ reference: "APP-100234", productName: "Everyday Account", stage: "checking", accountLast4: "" });
  });
  it("a Ready application shows its account number, a code is expired at 999999, and askCode off shows the status after the details", async () => {
    const b = out(); await find(b, "APP-100235", "5550100124"); await codeOk(b);
    expect(await b.call("bank.applications.status", {})).toMatchObject({ stage: "ready", accountLast4: "2208" });
    const e = out(); await find(e); await e.call("bank.otp.send", {});
    expect(await code(e.call("bank.otp.verify", { code: "999999" }))).toBe("OTP_EXPIRED");
    const n = out({ config: { options: { "track-application": { askCode: false } } } });
    expect(await find(n)).toMatchObject({ found: true, needsCode: false });
    expect((await n.call("bank.applications.status", {})).stage).toBe("checking");
  });
  it("three wrong tries, details and codes together, lock it for 30 minutes of the clock", async () => {
    const b = out();
    expect(await code(find(b, "APP-100234", "5550100999"))).toBe("NOT_FOUND");
    expect(await code(find(b, "APP-100234", "5550100998"))).toBe("NOT_FOUND");
    expect(await code(find(b, "APP-100234", "5550100997"))).toBe("TRACK_LOCKED");
    expect(await code(find(b))).toBe("TRACK_LOCKED");
    b.now = () => TUE + 29 * 60_000; expect(await code(find(b))).toBe("TRACK_LOCKED");
    b.now = () => TUE + 31 * 60_000; expect((await find(b)).found).toBe(true);
    const c = out();
    await code(find(c, "APP-100234", "5550100999")); await find(c); await c.call("bank.otp.send", {});
    expect(await code(c.call("bank.otp.verify", { code: "000000" }))).toBe("OTP_INVALID");
    expect(await code(c.call("bank.otp.verify", { code: "000000" }))).toBe("TRACK_LOCKED");
    expect(await code(c.call("bank.otp.verify", { code: "482100" }))).toBe("TRACK_LOCKED");
    expect(await code(c.call("bank.applications.status", {}))).toBe("TRACK_LOCKED");
    expect(await code(find(c))).toBe("TRACK_LOCKED");
  });
  it("a stage can be moved for a scenario", async () => {
    const b = out(); await b.call("sandbox.public.advance", { reference: "APP-100234", stage: "received" });
    await find(b); await codeOk(b);
    expect((await b.call("bank.applications.status", {})).stage).toBe("received");
    expect(await code(b.call("sandbox.public.advance", { reference: "APP-100234", stage: "gone" }))).toBe("STAGE_INVALID");
  });
});

describe("registering for digital banking", () => {
  const id = { customerId: "20481993", day: 1, month: 1, year: "1990" };
  const verify = (b: MockBank, more: Record<string, unknown> = {}) => b.call("bank.registration.verify", { ...id, ...more });
  const codeIn = async (b: MockBank) => { await b.call("bank.otp.send", { channel: "sms" }); await b.call("bank.otp.verify", { code: "482100" }); };
  const PW = "Granite-Lemon-92-River";
  const finish = (b: MockBank, token: string, more: Record<string, unknown> = {}) => b.call("bank.registration.complete", { registrationToken: token, username: "jordan.l.1990", password: PW, confirm: PW, terms: true, trustDevice: true, deviceName: "My phone", ...more });
  it("checks the customer ID, the card number and the date before it looks anyone up", async () => {
    const b = out(), t = (more: Record<string, unknown>) => code(verify(b, more));
    expect(await t({ customerId: "1234" })).toBe("CUSTOMER_ID_INVALID");
    expect(await t({ year: "199" })).toBe("YEAR_INVALID");
    expect(await t({ year: "2015" })).toBe("UNDER_AGE");
    expect(await t({ day: 31, month: 2 })).toBe("DATE_INVALID");
    expect(await t({ year: "2030" })).toBe("DATE_FUTURE");
    expect(await t({ customerId: undefined, cardNumber: "4242 4242 4242 4241" })).toBe("CARD_INVALID");
    expect(await t({ customerId: undefined, cardNumber: "1234" })).toBe("CARD_INVALID");
    expect(await b.call("sandbox.public.inspect", {})).toMatchObject({ regFails: 0 });
  });
  it("one message for every miss, the third locks it, and a right answer after the lock is refused until 30 minutes have passed", async () => {
    const b = out(), wrong = { year: "1991" };
    expect(await code(verify(b, wrong))).toBe("NOT_MATCHED"); expect(await code(verify(b, { customerId: "20481999" }))).toBe("NOT_MATCHED");
    expect(await code(verify(b, wrong))).toBe("ID_LOCKED");
    expect(await code(verify(b))).toBe("ID_LOCKED");
    b.now = () => TUE + 31 * 60_000; expect((await verify(b)).maskedMobile).toBe("••• 0177");
    expect((await verify(out(), { customerId: undefined, cardNumber: "5555 5555 5555 4444" })).maskedMobile).toBe("••• 0177");
  });
  it("a customer who is already registered is told to sign in or reset the password", async () => {
    expect(await code(verify(out(), { customerId: "20440010" }))).toBe("ALREADY_REGISTERED");
    expect(await code(verify(out(), { customerId: undefined, cardNumber: "4242 4242 4242 4242" }))).toBe("ALREADY_REGISTERED");
  });
  it("a wrong code counts with the identity checks; 000000 is wrong, 999999 expired, four sends at most", async () => {
    const b = out(); await verify(b); await b.call("bank.otp.send", {});
    expect(await code(b.call("bank.otp.verify", { code: "000000" }))).toBe("OTP_INVALID");
    expect(await code(b.call("bank.otp.verify", { code: "999999" }))).toBe("OTP_EXPIRED");
    await b.call("bank.otp.send", {}); await b.call("bank.otp.send", {}); await b.call("bank.otp.send", {});
    expect(await code(b.call("bank.otp.send", {}))).toBe("OTP_RESEND_LIMIT");
    const c = out(); await code(verify(c, { year: "1991" })); await code(verify(c, { year: "1991" })); await verify(c); await c.call("bank.otp.send", {});
    expect(await code(c.call("bank.otp.verify", { code: "000000" }))).toBe("ID_LOCKED");
    expect(await code(c.call("bank.otp.verify", { code: "482100" }))).toBe("ID_LOCKED");
  });
  it("makes the profile only after the code: the password is a hash, the username is checked, and the password follows the sign-in's rules", async () => {
    const dir = new AccessDirectory(), b = out({ directory: dir }), v = await verify(b);
    expect(await code(finish(b, v.registrationToken))).toBe("OTP_REQUIRED");
    await codeIn(b);
    const t = async (more: Record<string, unknown>) => (await finish(b, v.registrationToken, { dryRun: true, ...more })).code ?? "ok";
    expect(await t({ username: "admin" })).toBe("USERNAME_TAKEN");
    expect(await t({ username: "abc" })).toBe("USERNAME_INVALID");
    expect(await t({ username: "x".repeat(31) })).toBe("USERNAME_INVALID");
    expect(await t({ username: "administrator" })).toBe("USERNAME_TAKEN");
    expect(await t({ username: "Alex.Morgan" })).toBe("USERNAME_TAKEN");
    expect(await t({ username: "demo.locked" })).toBe("USERNAME_TAKEN");
    expect(await t({ username: "no spaces here" })).toBe("USERNAME_INVALID");
    expect(await t({ password: "short", confirm: "short" })).toBe("MIN_LENGTH");
    expect(await t({ password: "x".repeat(65), confirm: "x".repeat(65) })).toBe("MAX_LENGTH");
    expect(await t({ password: "my-jordan.l.1990-pass", confirm: "my-jordan.l.1990-pass" })).toBe("PASSWORD_CONTAINS_USERNAME");
    expect(await t({ password: "Password123!Password", confirm: "Password123!Password" })).toBe("PASSWORD_COMMON");
    expect(await t({ password: "Winter2024!Winter", confirm: "Winter2024!Winter" })).toBe("PASSWORD_BREACHED");
    expect(await t({ confirm: "another-one-12345" })).toBe("MISMATCH");
    expect(await t({ terms: false })).toBe("TERMS_REQUIRED");
    expect(await t({ deviceName: "  " })).toBe("NAME_REQUIRED");
    expect(await t({})).toBe("ok");
    expect(dir.users.has("jordan.l.1990")).toBe(false);
    const done = await finish(b, v.registrationToken);
    expect(done).toEqual({ ok: true, username: "jordan.l.1990", deviceTrusted: true });
    const u = dir.users.get("jordan.l.1990")!;
    expect(u.passwordHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify([...dir.users.values()])).not.toContain(PW);
    expect(JSON.stringify(dir.pub)).not.toContain(PW);
    expect(u.usedHashes).toEqual([u.passwordHash]);
    expect(u.devices[0]).toMatchObject({ name: "My phone", trusted: true });
    expect(await code(finish(b, v.registrationToken))).toBe("TOKEN_INVALID");
  });
  it("the new profile signs in with that password, and the code, the token and the flow are used up", async () => {
    const dir = new AccessDirectory(), b = out({ directory: dir }), v = await verify(b); await codeIn(b); await finish(b, v.registrationToken, { trustDevice: false, deviceName: "" });
    const s = out({ directory: dir });
    expect(await s.call("bank.auth.signIn", { username: "jordan.l.1990", password: PW })).toMatchObject({ ok: true, firstName: "Jordan", status: "otp" });
    expect(await s.call("bank.auth.signIn", { username: "jordan.l.1990", password: "Bwx!Demo2026" })).toMatchObject({ ok: false, code: "INVALID_CREDENTIALS" });
    expect(await code(verify(out({ directory: dir })))).toBe("ALREADY_REGISTERED");
    expect(await code(b.call("bank.otp.send", {}))).toBe("VERIFY_FIRST");
  });
  it("registers from a Ready application (the code goes to the mobile on the application), and not from one that is not ready", async () => {
    const dir = new AccessDirectory(), b = out({ directory: dir });
    expect(await code(b.call("bank.registration.verify", { applicationId: "APP-100234" }))).toBe("NOT_MATCHED");
    expect(await code(b.call("bank.registration.verify", { applicationId: "APP-999999" }))).toBe("NOT_MATCHED");
    const v = await b.call("bank.registration.verify", { applicationId: "APP-100235" });
    expect(v.maskedMobile).toBe("••• 0124");
    await codeIn(b); expect(await finish(b, v.registrationToken, { username: "sam.hart.2026" })).toMatchObject({ ok: true });
    expect(await code(out({ directory: dir }).call("bank.registration.verify", { applicationId: "APP-100235" }))).toBe("ALREADY_REGISTERED");
    expect(dir.users.get("sam.hart.2026")!.personaId).toBe("demoapplicant");
  });
  it("the token runs out after ten minutes", async () => {
    const b = out(), v = await verify(b); await codeIn(b);
    b.now = () => TUE + 11 * 60_000;
    expect(await code(finish(b, v.registrationToken))).toBe("TOKEN_EXPIRED");
    expect(await code(finish(b, v.registrationToken))).toBe("TOKEN_INVALID");
  });
  it("a sign-in that starts ends a public code flow: the code belongs to the sign-in", async () => {
    const b = out(); await verify(b); await b.call("bank.otp.send", {});
    await b.call("bank.auth.signIn", { username: "alex.morgan", password: "Bwx!Demo2026" });
    expect(await b.call("bank.otp.send", {})).toMatchObject({ maskedPhone: "+1 ••• ••• 0142" });
  });
});

describe("before sign-in only the public adapters answer", () => {
  const SIGNED_OUT_OK = /^(bank\.(auth|recover)\.|bank\.device\.options$|bank\.password\.policy$|bank\.otp\.(send|verify)$|bank\.app\.config$|sandbox\.access\.inspect$)/;
  const PUBLIC = [
    "bank.products.list", "bank.products.get", "bank.rates.loans", "bank.rates.deposits", "bank.locations.search", "bank.locations.details", "bank.support.hours", "bank.support.openChat", "bank.support.sendMessage",
    "bank.onboarding.begin", "bank.onboarding.start", "bank.onboarding.check", "bank.onboarding.save", "bank.onboarding.discard", "bank.onboarding.verifyIdentity", "bank.onboarding.submit",
    "bank.applications.find", "bank.applications.status", "bank.registration.verify", "bank.registration.complete", "sandbox.public.inspect", "sandbox.public.advance",
    "bank.kyb.config", "bank.kyb.check", "bank.kyb.submit",
  ];
  it("every public adapter is in the catalog, and every other adapter still answers NOT_SIGNED_IN", async () => {
    const all = ADAPTER_CATALOG.map((a) => a.adapter);
    for (const a of PUBLIC) expect(all, a).toContain(a);
    const b = out();
    for (const a of all.filter((x) => !SIGNED_OUT_OK.test(x) && !PUBLIC.includes(x))) expect(await code(b.call(a, {})), a).toBe("NOT_SIGNED_IN");
    // the public ones never answer NOT_SIGNED_IN (they may refuse the empty input in other words)
    for (const a of PUBLIC) expect(await code(b.call(a, {})), a).not.toBe("NOT_SIGNED_IN");
    // the older application adapters that read a customer's own applications are not public
    for (const a of ["bank.applications.list", "bank.applications.get", "bank.applications.save"]) expect(await code(b.call(a, {})), a).toBe("NOT_SIGNED_IN");
  });
  it("no public adapter answers with account data", async () => {
    const b = out();
    for (const [a, i] of [["bank.products.list", {}], ["bank.rates.loans", {}], ["bank.locations.search", {}], ["bank.support.hours", {}], ["bank.onboarding.begin", {}]] as const) {
      const text = JSON.stringify(await b.call(a, i));
      for (const banned of ["accountNumber", "maskedNumber", "Alex", "Sam Rivera", "acc_main"]) expect(text, `${a} ${banned}`).not.toContain(banned);
    }
  });
  it("a signed-in customer can use them too, and they never touch the customer's accounts", async () => {
    const b = new MockBank("alex", { now: TUE });
    expect((await b.call("bank.rates.loans", { type: "personal", amount: 10000, term: 36 })).quote.paymentText).toBe("$322.20");
    expect(await b.call("bank.locations.search", {})).toMatchObject({ count: 8 });
    expect(b.persona.accounts.map((a) => a.balance)).toEqual(new MockBank("alex", { now: TUE }).persona.accounts.map((a) => a.balance));
  });
});
