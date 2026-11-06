import type { Journey } from "../schema";
import { steps } from "./business-kit";

const { press, text, noText, screen, set, error, refuses, bank } = steps;

/** What must be true for "Add a supplier" to be right (the spec's criteria; the bank's checks are proved by forced calls). */
export const addSupplierAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "Only a Maker who may manage suppliers can start it; a role without the permission lands on a no-access card and the bank refuses the same calls." },
  { id: "AC-2", text: "The bank-detail fields and checks follow the bank's home market (routing number and account, sort code and account, or an IBAN); a bank in another country asks for the country, an IBAN or account number, the bank code the country needs, the SWIFT/BIC and an address." },
  { id: "AC-3", text: "A name already on the list, bank details already on the list and a tenth waiting request are refused with the messages of the spec, and nothing is saved." },
  { id: "AC-4", text: "Where the market has a name check, a close, wrong-type or no-match result needs \"Add anyway\" before Continue; Use and Switch fix it; the bank refuses the request without the person's confirmation." },
  { id: "AC-5", text: "A code is always asked, naming the supplier, after the confirmation tick; three wrong codes stop the request, and the bank refuses it without the code." },
  { id: "AC-6", text: "The result is \"Sent for approval\" with a waiting chip; the supplier is on the list as waiting and cannot be paid yet." },
  { id: "AC-7", text: "A timeout of the request shows the \"Check Suppliers\" message and an unavailable bank shows the sheet; nothing is saved." },
  { id: "AC-8", text: "Each of the four options hides what it names: the type, the other country, the name check and the 24-hour line; the bank refuses a person or a bank abroad when they are off." },
];

const NOW = "2026-11-03T10:42:00Z";
const alpha = { persona: "alex", context: "alpha", now: NOW };
type Scenario = NonNullable<Journey["scenarios"]>[number];
const T = (id: string, name: string, covers: string[], base: Record<string, unknown>, stepList: Record<string, unknown>[], extra: Record<string, unknown> = {}): Scenario => ({ id, name, covers, ...base, ...extra, steps: stepList } as Scenario);
const code = (c = "482100") => [set({ "otp.code": c }), press("Send for approval")];
const waiting = (path: string, equals: unknown) => bank("corp.suppliers.list", path, equals, { include: "all" });
/** The first step with a name, then the bank details of the first market. */
const name = (n: string): Record<string, unknown>[] => [screen("step1"), set({ "as.name": n }), press("Continue"), screen("step2")];
const usBank = (account = "100004321", routing = "021000021"): Record<string, unknown>[] => [set({ "as.routing": routing, "as.account": account, "as.accountType": "checking" }), press("Continue")];
const ukBank = (accountName: string, type = "personal"): Record<string, unknown>[] => [set({ "as.accountName": accountName, "as.sort": "20-00-00", "as.account": "55779911", "as.accountType": type }), press("Continue")];
const toCode: Record<string, unknown>[] = [set({ "as.consent": true }), press("Send for approval"), screen("otp")];
const form = { name: "Brightline Packaging", type: "company", where: "same", routing: "021000021", account: "100004321", accountType: "checking" };

export const addSupplierScenarios: NonNullable<Journey["scenarios"]> = [
  T("T-1", "Market A: Brightline Packaging by routing number and account: the review, the confirmation, the code, Sent for approval, waiting for an administrator", ["AC-2", "AC-5", "AC-6"], alpha, [
    ...name("Brightline Packaging"), text("Routing number"), text("Account number"), text("Checking"), noText("Sort code"), noText("IBAN"), ...usBank(), screen("review"),
    text("Brightline Packaging"), text("021000021 · ••4321"), text("An administrator"), text("Up to $5,000.00 a payment"), text("Company"), noText("Country"), noText("Address"),
    press("Send for approval"), screen("review"), error("as.consent"), text("Tick the confirmation first"), ...toCode, text("Authorise adding Brightline Packaging as a supplier"), text("Code sent to"),
    ...code(), screen("result"), text("Sent for approval"), text("Brightline Packaging can be paid once an administrator approves it."), text("Waiting for an administrator"), text("Approval"), text("Up to $5,000.00 a payment"),
    waiting("req_1.statusText", "Waiting for approval"), bank("corp.suppliers.list", "req_1", undefined),
    refuses("corp.payments.quote", "BENEFICIARY_NOT_WHITELISTED", { fromAccountId: "alpha_ops", beneficiaryId: "req_1", amount: 100, purpose: "Goods", reference: "X" }),
  ]),
  T("T-2", "Market B: a close name needs Add anyway or Use: Continue is blocked, Use takes the registered name and goes on", ["AC-4"], alpha, [
    ...name("Whitfield Services"), text("Sort code"), ...ukBank("James Whitfeld"), screen("nameResult"), text("The name is close"), text("The account holder is James Whitfield."),
    press("Continue"), screen("nameResult"), error("Confirm to continue."), press("Use “James Whitfield”"), screen("review"), text("20-00-00 · ••9911"), text("James Whitfield"),
  ], { config: { homeMarket: "uk" } }),
  T("T-3", "Market B: the right name but the wrong type of account: Switch to personal fixes it", ["AC-4"], alpha, [
    ...name("Whitfield Services"), ...ukBank("James Whitfield", "business"), screen("nameResult"), text("Wrong type of account"), text("This is a personal account."), press("Switch to personal"), screen("review"), text("20-00-00 · ••9911"),
  ], { config: { homeMarket: "uk" } }),
  T("T-4", "Market B: a name that does not match needs Add anyway, and then goes on", ["AC-4"], alpha, [
    ...name("Whitfield Services"), ...ukBank("Someone Else"), screen("nameResult"), text("The name doesn’t match"), text("The account is held by someone else."), noText("Use “"),
    set({ "as.ack": true }), press("Continue"), screen("review"), text("Someone Else"),
  ], { config: { homeMarket: "uk" } }),
  T("T-5", "A bank in another country: country, IBAN, SWIFT/BIC, then the address step, and the review has the country and the address", ["AC-2"], alpha, [
    ...name("Maple Freight").slice(0, 1), set({ "as.name": "Maple Freight", "as.where": "abroad" }), press("Continue"), screen("step2"), text("Country"), text("SWIFT / BIC code"), noText("Routing number"), text("Step 2 of 4"),
    set({ "as.country": "DE", "as.accountName": "Maple Freight GmbH", "as.iban": "DE44500105175407324931", "as.swift": "DEUTDEFFXXX" }), press("Continue"), screen("address"), text("Step 3 of 4"),
    set({ "as.street": "Hafenstrasse 12", "as.city": "Hamburg" }), press("Review"), screen("review"), text("Germany"), text("DEUTDEFFXXX · ••4931"), text("Hafenstrasse 12, Hamburg"), text("Maple Freight GmbH"),
  ]),
  T("T-6", "Another country that uses an account number and a bank code (Canada): the bank code is asked", ["AC-2"], alpha, [
    ...name("Maple Freight").slice(0, 1), set({ "as.name": "Maple Freight", "as.where": "abroad" }), press("Continue"), set({ "as.country": "CA" }), text("Bank code"), noText("IBAN"), text("Account number"),
    set({ "as.accountName": "Maple Freight Ltd", "as.account": "004817392", "as.bankCode": "00012-003", "as.swift": "ROYCCAT2XXX" }), press("Continue"), screen("address"),
  ]),
  T("T-7", "A name that is already on the list (any case) is refused at the first step", ["AC-3"], alpha, [screen("step1"), set({ "as.name": "harbour packaging" }), press("Continue"), screen("step1"), text("You already have a supplier with this name.")]),
  T("T-8", "The bank details of a supplier that is already on the list are refused at the second step", ["AC-3"], alpha, [...name("Harbour Packaging North"), ...usBank("100008841"), screen("step2"), text("You already have a supplier with these bank details."), bank("corp.suppliers.list", "req_1", undefined, { include: "all" })]),
  T("T-9", "Ten suppliers waiting: the tenth request is the last, and the eleventh name is refused at the first step", ["AC-3"], alpha, [
    screen("step1"), set({ "as.name": "Another One" }), press("Continue"), screen("step1"), text("You have 10 suppliers waiting for approval. Wait for an answer before you add more."),
  ], { setup: [{ adapter: "corp.sandbox.arrange", input: { op: "fillRequests", count: 10 } }] }),
  T("T-10", "Nine waiting: one more is allowed", ["AC-3"], alpha, [...name("Another One"), screen("step2")], { setup: [{ adapter: "corp.sandbox.arrange", input: { op: "fillRequests", count: 9 } }] }),
  T("T-11", "Three wrong codes stop the request and nothing is saved", ["AC-5"], alpha, [
    ...name("Brightline Packaging"), ...usBank(), ...toCode, ...code("111111"), screen("otp"), ...code("111111"), screen("otp"), ...code("111111"),
    screen("locked"), text("We couldn’t confirm this request."), text("Nothing was sent. Start again."), waiting("req_1", undefined),
  ]),
  T("T-12", "A request is not made without the code, and the bank refuses it forced", ["AC-5"], alpha, [
    screen("step1"), refuses("corp.suppliers.request", "OTP_REQUIRED", form),
  ]),
  T("T-13", "A name that was not a match is refused by the bank unless the person said they checked", ["AC-4", "AC-5"], alpha, [
    screen("step1"), refuses("corp.suppliers.request", "NAME_CHECK_NOT_CONFIRMED", { name: "Whitfield Services", type: "company", where: "same", sort: "20-00-00", account: "55779911", accountType: "personal", accountName: "James Whitfeld" }),
  ], { config: { homeMarket: "uk" } }),
  T("T-14", "A timeout of the request shows the Check Suppliers message and nothing is saved", ["AC-7"], alpha, [
    ...name("Brightline Packaging"), ...usBank(), ...toCode, ...code(), screen("timeout"), text("Check Suppliers before you try again, so you don’t add it twice."), noText("Sent for approval"), waiting("req_1", undefined),
  ], { conditions: { timeout: ["corp.suppliers.request"], latencyMs: 10000 } }),
  T("T-15", "The bank being unavailable at the request shows the sheet and nothing is saved", ["AC-7"], alpha, [
    ...name("Brightline Packaging"), ...usBank(), ...toCode, ...code(), screen("unavailable"), text("We couldn’t reach the bank"), text("Nothing was sent and you haven’t been charged. Try again in a moment."), waiting("req_1", undefined),
  ], { conditions: { unavailable: ["corp.suppliers.request"] } }),
  T("T-16", "The bank being unavailable at the first step shows the sheet; Try again goes back to the step", ["AC-7"], alpha, [screen("step1"), set({ "as.name": "Brightline Packaging" }), press("Continue"), screen("unavailable"), press("Try again"), screen("step1"), text("Brightline Packaging")], { conditions: { unavailable: ["corp.suppliers.validate"] } }),
  T("T-17", "A slow answer to the checks says nothing was changed", ["AC-7"], alpha, [screen("step1"), set({ "as.name": "Brightline Packaging" }), press("Continue"), screen("slow"), text("This is taking longer than expected. Nothing was changed."), press("Try again"), screen("step1")], { conditions: { timeout: ["corp.suppliers.validate"], latencyMs: 10000 } }),
  T("T-18", "The name check not answering shows the sheet and Try again returns to the bank details", ["AC-7"], alpha, [...name("Whitfield Services"), ...ukBank("James Whitfeld"), screen("unavailable"), press("Try again"), screen("step2")], { config: { homeMarket: "uk" }, conditions: { unavailable: ["corp.suppliers.check"] } }),
  T("T-19", "A code that cannot be sent shows the sheet and Try again returns to the review", ["AC-7"], alpha, [...name("Brightline Packaging"), ...usBank(), ...toCode.slice(0, 1), press("Send for approval"), screen("unavailable"), press("Try again"), screen("review")], { conditions: { unavailable: ["bank.otp.send"] } }),
  T("T-20", "The bank's setup not answering shows the sheet", ["AC-7"], alpha, [screen("unavailable"), press("Try again"), screen("unavailable")], { conditions: { unavailable: ["bank.app.config"] } }),
  T("T-21", "Alex at Beta (an Approver): the no-access card, and the bank refuses the same calls", ["AC-1"], { persona: "alex", context: "beta", now: NOW }, [
    screen("denied"), text("You can’t add suppliers at this company"), noText("Supplier name"), refuses("corp.suppliers.request", "PERMISSION_DENIED", form), refuses("corp.suppliers.validate", "PERMISSION_DENIED", form), refuses("corp.suppliers.check", "PERMISSION_DENIED", form),
  ]),
  T("T-22", "From Personal the bank refuses a company's supplier request", ["AC-1"], { persona: "alex", now: NOW }, [screen("denied"), text("You can’t add suppliers at this company"), refuses("corp.suppliers.request", "WRONG_CONTEXT", form)]),
  T("T-23", "With the four options off there is no type, no other country, no name check and no 24-hour line; the bank refuses a person or a bank abroad", ["AC-8"], alpha, [
    screen("step1"), noText("Person"), noText("In another country"), set({ "as.name": "Whitfield Services" }), press("Continue"), ...ukBank("James Whitfeld"), screen("review"), noText("Type"), noText("First 24 hours"), noText("The name is close"),
    refuses("corp.suppliers.validate", "INVALID_TYPE", { ...form, step: 1, type: "person", allowPerson: false }), refuses("corp.suppliers.validate", "INVALID_REGION", { ...form, step: 1, where: "abroad", allowAbroad: false }),
  ], { config: { homeMarket: "uk" }, launch: { "opt.allowPerson": false, "opt.allowAbroad": false, "opt.nameCheck": false, "opt.newCap": false } }),
  T("T-24", "With the options on the type, the other country and the 24-hour line are there", ["AC-8"], alpha, [screen("step1"), text("Person"), text("Company"), text("In another country"), text("In the same country"), set({ "as.name": "X Supplies" }), press("Continue"), ...usBank(), text("Up to $5,000.00 a payment"), text("Type")]),
  T("T-25", "Market A: a routing number whose check digit is wrong is refused with its words", ["AC-2"], alpha, [...name("Brightline Packaging"), ...usBank("100004321", "021000020"), screen("step2"), text("That routing number isn't valid. Check the 9 digits.")]),
  T("T-26", "Every market checks its own fields: routing check digit, sort code, IBAN check digits, the payment area, the home country, the BIC and the bank code", ["AC-2"], alpha, [
    screen("step1"),
    refuses("corp.suppliers.validate", "INVALID_ROUTING", { ...form, routing: "021000020" }), refuses("corp.suppliers.validate", "INVALID_ACCOUNT", { ...form, account: "12" }),
    refuses("corp.suppliers.validate", "INVALID_BIC", { name: "Maple Freight", where: "abroad", country: "DE", iban: "DE44500105175407324931", swift: "DEUTFRFFXXX" }),
    refuses("corp.suppliers.validate", "INVALID_BANK_CODE", { name: "Maple Freight", where: "abroad", country: "CA", account: "004817392", bankCode: "12", swift: "ROYCCAT2XXX" }),
    refuses("corp.suppliers.validate", "INVALID_IBAN", { name: "Maple Freight", where: "abroad", country: "DE", iban: "DE44500105175407324932", swift: "DEUTDEFFXXX" }),
  ]),
  T("T-27", "Market B: a sort code that is not six digits is refused", ["AC-2"], alpha, [screen("step1"), refuses("corp.suppliers.validate", "INVALID_SORT_CODE", { name: "Whitfield Services", sort: "20-00", account: "55779911" })], { config: { homeMarket: "uk" } }),
  T("T-28", "Market C: an IBAN with wrong check digits, or from outside the payment area, is refused; a good one goes on", ["AC-2"], alpha, [
    screen("step1"), refuses("corp.suppliers.validate", "INVALID_IBAN", { name: "Lena Supplies", iban: "DE44500105175407324932" }), refuses("corp.suppliers.validate", "NOT_SEPA", { name: "Lena Supplies", iban: "GB29NWBK60161331926819" }),
    set({ "as.name": "Lena Supplies" }), press("Continue"), set({ "as.accountName": "Lena Fischer", "as.iban": "DE44500105175407324931" }), press("Continue"), screen("review"), text("DE44 •••• 4931"),
  ], { config: { homeMarket: "eu" } }),
  T("T-30", "The form asks for what is missing before it asks the bank: a name, the name on the account, the street and city, the code", ["AC-2", "AC-5"], alpha, [
    screen("step1"), press("Continue"), screen("step1"), error("as.name"), ...name("Brightline Packaging"), set({ "as.accountName": "" }), press("Continue"), screen("step2"), error("as.accountName"),
    press("Back"), set({ "as.where": "abroad" }), press("Continue"), set({ "as.country": "DE", "as.accountName": "Maple Freight GmbH", "as.iban": "DE44500105175407324931", "as.swift": "DEUTDEFFXXX" }), press("Continue"), screen("address"),
    press("Review"), screen("address"), error("as.street"), error("as.city"),
    set({ "as.street": "Hafenstrasse 12", "as.city": "Hamburg" }), press("Review"), screen("review"), ...toCode, press("Send for approval"), screen("otp"), error("otp.code"),
  ]),
  T("T-29", "Market D: an IBAN of another country than the bank's home market is refused", ["AC-2"], alpha, [screen("step1"), refuses("corp.suppliers.validate", "COUNTRY_MISMATCH", { name: "Gulf Supplies", iban: "DE44500105175407324931" })], { config: { homeMarket: "ae" } }),
];
