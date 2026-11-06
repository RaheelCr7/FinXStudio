import type { Journey } from "../schema";
import { steps } from "./business-kit";

const { press, text, noText, screen, set, error, opens, refuses, bank } = steps;

/** What must be true for "Bulk payment" to be right (the spec's AC-1 to AC-10, with the ones this build adds: entering payments by hand, the role, and a file being only data). */
export const businessBulkAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "A file of at most 256 KB and 50 payments is read; an unreadable, oversized, repeated or empty file is refused with a message, and the bank refuses the same file when it is forced." },
  { id: "AC-2", text: "Every line is checked and shows one short message; the batch cannot continue until each marked line is fixed or removed, and the bank refuses a batch that still has one." },
  { id: "AC-3", text: "A line whose payee is not on the approved list, or whose account differs from the saved one, is marked; Use saved details puts the saved account back." },
  { id: "AC-4", text: "Duplicate lines are marked \"Same as payment {n}.\"" },
  { id: "AC-5", text: "The speeds offered follow the options; a speed too small for a line is marked and refused by the bank; Instant has no date; a later date must be a working day." },
  { id: "AC-6", text: "The review shows the total, the fees, what the account pays and the approvers needed; the person's limit, the company's limit and the money in the account are checked before the code." },
  { id: "AC-7", text: "A code is always asked, three wrong codes stop the batch, and the result is \"Sent for approval\" with the batch waiting as one payment: no money moves, and the person who started it cannot approve it." },
  { id: "AC-8", text: "Resending failed lines creates a new batch and marks them \"Resent\" on the original, once; a batch with nothing failed says \"Nothing to resend\"." },
  { id: "AC-9", text: "With bankFormats off no bank file choice appears and no format name is on screen; with it on, a bank file is read and a CSV chosen as a bank file is refused." },
  { id: "AC-10", text: "A timeout shows the check-Payments message and an unavailable bank shows the sheet; neither creates a batch." },
  { id: "AC-11", text: "Lines can be entered by hand when the bank allows it (allowEnter): a payee, an amount and a reference are added, removed again, and an empty list is refused." },
  { id: "AC-12", text: "Only a Maker holds the permission: a role without it lands on a no-access card and the bank refuses the same calls, from Personal as well." },
  { id: "AC-13", text: "What a file says is only data: a name with markup or a formula is shown as plain text, and nothing in it is run." },
];

const NOW = "2026-11-03T10:42:00Z";
const alpha = { persona: "alex", context: "alpha", now: NOW };
type Scenario = NonNullable<Journey["scenarios"]>[number];
const T = (id: string, name: string, covers: string[], base: Record<string, unknown>, stepList: Record<string, unknown>[], extra: Record<string, unknown> = {}): Scenario => ({ id, name, covers, ...base, ...extra, steps: stepList } as Scenario);

const HEAD = "Payee name,Account number or IBAN,Bank code,Amount,Reference";
export const HARB = "Harbour Packaging,5520018841,021000021";
export const NORD = "Nordic Supplies AB,DE89370400440532013000,";
export const WHIT = "Whitby Logistics,12349911,20-00-00";
export const GULF = "Gulf Trade FZE,AE070331234567890123456,";
export const csv = (...rows: string[]) => [HEAD, ...rows].join("\n");
export const withFile = (content: string, name = "payments.csv", kind = "csv") => ({ "bp.file": { name, size: content.length, kind, content } });
const pick = (content: string, extra: Record<string, unknown> = {}) => set({ ...withFile(content), ...extra });

const CLEAN = csv(`${HARB},1200.50,PO-1`, `${NORD},6500,INV-1`, `${WHIT},920,FREIGHT-1`, `${HARB},300,PO-2`, `${GULF},4000,INV-7`);
const SMALL = csv(`${HARB},50,PO-9`);
/** Ten lines: one ready, then one of each thing that can be wrong (the first message of each is shown). */
const ERRORS = csv(
  `${HARB},9800,PO-1`, // 1 ready
  `${HARB},9800,PO-1`, // 2 same as 1
  ",5520018841,021000021,10,X", // 3 no name
  `${HARB},0,X`, // 4 amount
  "Harbour Packaging,55,021000021,10,X", // 5 account
  "Harbour Packaging,5520018841,021000022,10,X", // 6 routing number
  "Unknown Co,5520018841,021000021,10,X", // 7 not approved
  "Harbour Packaging,5520018842,021000021,10,X", // 8 not the saved account
  `${HARB},900000,X`, // 9 above the limit
  `${NORD},6500,INV-1`, // 10 ready (euros)
);
const TWELVE = csv(...Array.from({ length: 12 }, (_, i) => `${HARB},20000,L${i}`));
const BANK_XML = "<BatchFile><Payment><Name>Harbour Packaging</Name><Account>5520018841</Account><BankCode>021000021</BankCode><Amount>75.00</Amount><Reference>XML-1</Reference></Payment></BatchFile>";

// what a person does to get to each screen
const toFix = (content: string, extra: Record<string, unknown> = {}) => [pick(content, extra), press("Continue"), screen("fix")];
const toSpeed = (content: string, extra: Record<string, unknown> = {}) => [...toFix(content, extra), press("Continue"), screen("speed")];
const toReview = (content: string, extra: Record<string, unknown> = {}) => [...toSpeed(content, extra), press("Continue"), screen("review")];
const toCode = (content: string, extra: Record<string, unknown> = {}) => [...toReview(content, extra), set({ "bp.consent": true, "bp.name": "Suppliers November" }), press("Submit for approval"), screen("otp")];
const send = [set({ "otp.code": "482100" }), press("Submit for approval"), screen("done")];
const list = (path: string, equals: unknown) => bank("corp.bulk.list", path, equals);
const batch = (path: string, equals: unknown, id = "PAY-2042") => bank("corp.bulk.get", path, equals, { id });
const noBatch = list("count", 2);
const noMoney = bank("corp.company.get", "accounts.alpha_ops.balance", 480_000);

export const businessBulkScenarios: NonNullable<Journey["scenarios"]> = [
  T("T-1", "A clean file of five lines in four currencies: every line Ready, Standard, the review, the code, Sent for approval; the batch waits and no money moves", ["AC-1", "AC-2", "AC-6", "AC-7"], alpha, [
    screen("add"), text("Step 1 of 4 · Bulk payment"), text("Upload a file or enter the payments."), text("Operating ••2001"), text("$458,760.00"), ...toFix(CLEAN),
    text("Step 2 of 4 · Bulk payment"), text("Check payments"), text("Fix or remove anything marked, then continue."), text("Valid"), text("Need fixing"), text("Total in USD, about"), text("$10,787.24"),
    text("Harbour Packaging"), text("••8841"), text("€6,500.00"), text("AED 4,000.00"), text("Ready"), noText("Needs fixing."),
    press("Continue"), screen("speed"), text("Step 3 of 4 · Bulk payment"), text("Standard"), text("$75.00"), text("Same day"), text("Some payments go abroad"), text("Instant"),
    press("Continue"), screen("review"), text("Step 4 of 4 · Bulk payment"), text("Total in USD, about"), text("$10,787.24"), text("Fees"), text("$75.00"), text("You pay"), text("$10,862.24"), text("Approvals needed"), text("€6,500.00"),
    set({ "bp.consent": true, "bp.name": "Suppliers November" }), press("Submit for approval"), screen("otp"), text("Authorise $10,787.24 in 5 payments"), text("Code sent to"), noText("This amount needs an extra code."),
    set({ "otp.code": "482100" }), press("Submit for approval"), screen("done"), text("Sent for approval"), text("5 payments"), text("Nothing has left the account yet."), text("Waiting for 1 approver"), text("Suppliers November"), text("BWX-20261103-2042"),
    batch("statusKey", "waiting"), batch("name", "Suppliers November"), batch("countText", "5 payments"), noMoney, bank("corp.company.get", "companyUsedToday", 0), bank("corp.company.get", "me.usedToday", 29_762.24),
  ]),
  T("T-2", "A file with every kind of mistake: the tiles count them and each line shows its own short message; Continue is refused", ["AC-2", "AC-3", "AC-4"], alpha, [
    ...toFix(ERRORS), text("Valid"), text("2"), text("Need fixing"), text("8"),
    text("Same as payment 1."), text("Enter the payee name."), text("Enter an amount above zero."), text("Check the account number."), text("Check the routing number."), text("Not an approved payee."), text("Doesn’t match the saved account details."), text("Above your payment limit."),
    press("Continue"), screen("fix"), text("Fix or remove the payments that need fixing."),
    refuses("corp.bulk.quote", "LINES_NEED_FIXING", { fromAccountId: "alpha_ops", lines: [{ name: "Unknown Co", account: "1", code: "", amount: "5", reference: "" }] }),
  ]),
  T("T-3", "Remove all errors keeps only the valid lines, and the batch goes on", ["AC-2"], alpha, [
    ...toFix(ERRORS), press("Remove all errors"), screen("fix"), text("Need fixing"), noText("Not an approved payee."), text("Total"), text("$16,819.44"), press("Continue"), screen("speed"),
  ]),
  T("T-4", "Fix lines opens the first marked line; Done with the corrected values makes it Ready; Remove takes a line out", ["AC-2", "AC-3"], alpha, [
    ...toFix(csv(`${HARB},100,A`, `${HARB},9x,B`, "Harbour Packaging,5520018842,021000021,10,C")),
    press("Fix lines"), screen("edit"), text("Payment 2"), text("Enter an amount above zero."), text("Payee name"), text("Account number or IBAN"), text("Routing number"), text("Amount"), noText("Use saved details"),
    set({ "bp.e.amount": "90" }), press("Done"), screen("fix"), text("Doesn’t match the saved account details."),
    press("Fix lines"), screen("edit"), text("Payment 3"), text("Use saved details"), press("Use saved details"), screen("fix"), noText("Doesn’t match the saved account details."), noText("Needs fixing."),
    press("Continue"), screen("speed"),
  ]),
  T("T-5", "A line that is removed from the edit card is gone; a single line left is checked as it was", ["AC-2"], alpha, [
    ...toFix(csv(`${HARB},100,A`, "Unknown Co,1,,5,B")), press("Fix lines"), screen("edit"), press("Remove"), screen("fix"), text("Total"), noText("Unknown Co"), text("$100.00"), press("Continue"), screen("speed"),
  ]),
  T("T-6", "A line that is a duplicate of an earlier one (same payee, account, amount and reference) is marked; a different reference is not", ["AC-4"], alpha, [
    ...toFix(csv(`${HARB},100,A`, `${HARB},100,A`, `${HARB},100,B`)), text("Same as payment 1."), text("Valid"), text("Need fixing"),
  ]),
  T("T-7", "A payee that is not on the approved list, or whose account is not the saved one, is marked and cannot be sent; the bank refuses it when forced", ["AC-3"], alpha, [
    ...toFix(csv("Nobody Ltd,5520018841,021000021,10,A", "Harbour Packaging,5520018842,021000021,10,B")), text("Not an approved payee."), text("Doesn’t match the saved account details."),
    refuses("corp.bulk.submit", "LINES_NEED_FIXING", { fromAccountId: "alpha_ops", speed: "standard", lines: [{ name: "Nobody Ltd", account: "5520018841", code: "021000021", amount: "10", reference: "A" }] }),
  ]),
  T("T-8", "A file sent before stays on the first step with its date; the bank refuses it the same way when forced", ["AC-1"], alpha, [
    pick(SMALL), press("Continue"), screen("add"), text("You already sent this file on 30 Oct."), noText("Check payments"),
    refuses("corp.bulk.check", "ALREADY_SENT", { fromAccountId: "alpha_ops", file: SMALL, kind: "csv", format: "csv" }),
  ], { setup: [{ adapter: "corp.sandbox.arrange", input: { op: "sentFile", file: SMALL, on: "2026-10-30" } }] }),
  T("T-10", "More than 50 payments, a file with only a header, and a file that is too big or the wrong kind are refused with their words", ["AC-1"], alpha, [
    pick(csv(...Array.from({ length: 51 }, (_, i) => `${HARB},${i + 1},R${i}`))), press("Continue"), screen("add"), text("A batch can have up to 50 payments."),
    pick(csv()), press("Continue"), screen("add"), text("There are no payments in this file."), noText("A batch can have up to 50 payments."),
    pick(csv(...Array.from({ length: 50 }, (_, i) => `${HARB},${i + 1},R${i}`))), press("Continue"), screen("fix"), text("Valid"), text("50"),
    refuses("corp.bulk.check", "FILE_TOO_BIG", { fromAccountId: "alpha_ops", file: "x".repeat(300 * 1024), kind: "csv", format: "csv" }),
    refuses("corp.bulk.check", "FILE_TOO_BIG", { fromAccountId: "alpha_ops", file: SMALL, size: 3_400_000, kind: "csv", format: "csv" }),
    refuses("corp.bulk.check", "BATCH_TOO_LARGE", { fromAccountId: "alpha_ops", file: csv(...Array.from({ length: 51 }, (_, i) => `${HARB},${i + 1},R${i}`)), kind: "csv", format: "csv" }),
  ]),
  T("T-11", "A file that is too big, or is not a CSV, is stopped on the field with the engine's words", ["AC-1"], alpha, [
    set({ "bp.file": { name: "payments.csv", size: 3_400_000, kind: "csv", content: SMALL } }), press("Continue"), screen("add"), error("bp.file"), text("The file is larger than 256 KB."),
    set({ "bp.file": { name: "notes.exe", size: 2048, kind: "csv", content: "x" } }), press("Continue"), screen("add"), text("Use a CSV file."),
    set({ "bp.file": null }), press("Continue"), screen("add"), text("Choose a file first."),
  ]),
  T("T-12", "With the options on the bank offers all three speeds with a fee for each", ["AC-5"], alpha, [
    ...toSpeed(SMALL), text("Standard"), text("No fee"), text("Same day"), text("$1.00"), text("Instant"), text("$0.25"),
  ]),
  T("T-13", "Same day and Instant off: only Standard is offered", ["AC-5"], alpha, [...toSpeed(SMALL), text("Standard"), noText("Same day"), noText("Instant")], { launch: { "opt.allowSameDay": false, "opt.allowInstant": false } }),
  T("T-14", "Instant has no Send and no Date; Standard has Send Today or Later", ["AC-5"], alpha, [
    ...toSpeed(SMALL), text("Send"), text("Today"), text("Later"), set({ "bp.speed": "instant" }), noText("Later"), noText("Choose a date"), press("Continue"), screen("review"), text("Instant"), text("Today"), text("$0.25"), text("$50.25"),
  ]),
  T("T-15", "A payment too large for Standard (25,000.00) marks the speed and the bank refuses it when it is chosen; the first speed that fits is chosen", ["AC-5"], alpha, [
    ...toSpeed(csv(`${HARB},30000,BIG`)), text("Some payments are too large"), set({ "bp.speed": "standard" }), press("Continue"), screen("speed"), text("Some payments are too large for this speed."),
    set({ "bp.speed": "sameDay" }), press("Continue"), screen("review"), text("Same day"), text("$1.00"),
    refuses("corp.bulk.quote", "RAIL_LIMIT", { fromAccountId: "alpha_ops", speed: "standard", lines: [{ name: "Harbour Packaging", account: "5520018841", code: "021000021", amount: "30000", reference: "BIG" }] }),
  ]),
  T("T-16", "A batch with a payment abroad cannot go Same day or Instant (the rails abroad have neither)", ["AC-5"], alpha, [
    ...toSpeed(csv(`${NORD},100,A`)), text("Some payments go abroad"),
    refuses("corp.bulk.quote", "RAIL_NOT_AVAILABLE", { fromAccountId: "alpha_ops", speed: "instant", lines: [{ name: "Nordic Supplies AB", account: "DE89370400440532013000", code: "", amount: "100", reference: "A" }] }),
  ]),
  T("T-17", "Later sends on a working day the bank offers; a day it is closed, a weekend and no date are refused", ["AC-5"], alpha, [
    ...toSpeed(SMALL), set({ "bp.when": "later" }), press("Continue"), screen("speed"), text("Choose a date."),
    set({ "bp.date": "2026-11-10" }), press("Continue"), screen("review"), text("Tue 10 Nov"),
    refuses("corp.bulk.quote", "DATE_NOT_WORKING_DAY", { fromAccountId: "alpha_ops", speed: "standard", sendOn: "2026-11-09", lines: [{ name: "Harbour Packaging", account: "5520018841", code: "021000021", amount: "10", reference: "A" }] }),
    refuses("corp.bulk.quote", "DATE_NOT_WORKING_DAY", { fromAccountId: "alpha_ops", speed: "standard", sendOn: "2026-11-07", lines: [{ name: "Harbour Packaging", account: "5520018841", code: "021000021", amount: "10", reference: "A" }] }),
  ]),
  T("T-18", "A batch name of more than 35 characters is refused on the review", ["AC-6"], alpha, [
    ...toReview(SMALL), set({ "bp.name": "x".repeat(36), "bp.consent": true }), press("Submit for approval"), screen("review"), error("bp.name"),
    refuses("corp.bulk.submit", "NAME_TOO_LONG", { fromAccountId: "alpha_ops", speed: "standard", name: "x".repeat(36), lines: [{ name: "Harbour Packaging", account: "5520018841", code: "021000021", amount: "10", reference: "A" }] }),
  ]),
  T("T-19", "The person's limit is checked before the code: more than what is left of 250,000.00 is refused with its words and no code is asked", ["AC-6"], alpha, [
    ...toReview(TWELVE), set({ "bp.consent": true }), press("Submit for approval"), screen("problem"), text("This is above your payment limit."), text("Nothing was sent."), press("Remove lines"), screen("fix"), noMoney, noBatch,
  ]),
  T("T-20", "The company's limit is checked before the code, with its words", ["AC-6"], alpha, [
    ...toReview(SMALL), set({ "bp.consent": true }), press("Submit for approval"), screen("problem"), text("This is above the company limit."), text("Nothing was sent."), noBatch,
  ], { setup: [{ adapter: "corp.sandbox.arrange", input: { op: "companyUsed", amount: 999_990 } }] }),
  T("T-21", "Not enough money in the account is refused before the code, and Change account goes back to the first step", ["AC-6"], alpha, [
    ...toReview(SMALL), set({ "bp.consent": true }), press("Submit for approval"), screen("problem"), text("There isn’t enough money in this account."), press("Change account"), screen("add"), noBatch,
  ], { setup: [{ adapter: "corp.sandbox.arrange", input: { op: "balance", accountId: "alpha_ops", balance: 10 } }] }),
  T("T-22", "The review needs the tick; a batch above 50,000.00 needs two approvers", ["AC-6", "AC-7"], alpha, [
    ...toReview(CLEAN), press("Submit for approval"), screen("review"), error("bp.consent"), text("Approvals needed"), text("2"),
    set({ "bp.consent": true }), press("Submit for approval"), screen("otp"), set({ "otp.code": "482100" }), press("Submit for approval"), screen("done"), text("Waiting for 2 approvers"),
  ], { setup: [{ adapter: "corp.sandbox.arrange", input: { op: "dualAbove", amount: 5_000 } }] }),
  T("T-23", "A code is always asked, whatever the amount; from 25,000.00 the prompt adds the extra line", ["AC-7"], alpha, [
    ...toCode(SMALL), noText("This amount needs an extra code."), text("Authorise $50.00 in 1 payments"),
  ]),
  T("T-24", "From 25,000.00 the code prompt says this amount needs an extra code", ["AC-7"], alpha, [...toCode(csv(`${HARB},24000,A`, `${HARB},2000,B`)), text("This amount needs an extra code."), text("Authorise $26,000.00 in 2 payments")]),
  T("T-25", "Three wrong codes stop the batch and nothing is created", ["AC-7"], alpha, [
    ...toCode(SMALL), set({ "otp.code": "111111" }), press("Submit for approval"), screen("otp"), set({ "otp.code": "111111" }), press("Submit for approval"), screen("otp"), set({ "otp.code": "111111" }), press("Submit for approval"), screen("locked"), text("We couldn’t confirm this batch."), noBatch, noMoney,
  ]),
  T("T-26", "The code is used up by one batch; the bank refuses a second one without a new code, and the batch cannot be approved by the person who started it", ["AC-7"], alpha, [
    ...toCode(SMALL), ...send, batch("statusKey", "waiting"),
    refuses("corp.bulk.submit", "OTP_REQUIRED", { fromAccountId: "alpha_ops", speed: "standard", lines: [{ name: "Harbour Packaging", account: "5520018841", code: "021000021", amount: "60", reference: "Z" }] }),
    refuses("corp.payments.approve", "PERMISSION_DENIED", { paymentId: "PAY-2042" }), batch("statusKey", "waiting"), noMoney,
  ]),
  T("T-27", "The result opens Batch status for the new batch and the Payment tracker at it", ["AC-7"], alpha, [
    ...toCode(SMALL), ...send, press("View batch"), opens("bulk-status", { "launch.id": "PAY-2042" }),
  ]),
  T("T-28", "Track in Payments opens the Payment tracker", ["AC-7"], alpha, [...toCode(SMALL), ...send, press("Track in Payments"), opens("payment-tracker", { "launch.paymentId": "PAY-2042" })]),
  T("T-29", "Fix and resend (launch.repairOf = PAY-1190): the returned payment comes with the bank's sentence and needs fixing; fixed, it is sent as a new batch named Resend of Supplier batch 19", ["AC-8"], alpha, [
    screen("fix"), text("Step 1 of 3 · Bulk payment"), text("Gulf Trade FZE"), text("The account name didn’t match."), text("Needs fixing"), text("AED 4,000.00"), press("Continue"), screen("fix"), text("The account name didn’t match."),
    press("Fix lines"), screen("edit"), text("Payment 1"), set({ "bp.e.name": "Gulf Trade FZE", "bp.e.account": "AE070331234567890123456" }), press("Done"), screen("fix"), noText("The account name didn’t match."), text("Ready"),
    press("Continue"), screen("speed"), text("Step 2 of 3 · Bulk payment"), press("Continue"), screen("review"), text("Step 3 of 3 · Bulk payment"), text("Resend of Supplier batch 19"),
    set({ "bp.consent": true }), press("Submit for approval"), screen("otp"), ...send, text("Resend of Supplier batch 19"),
    batch("name", "Resend of Supplier batch 19"), batch("statusKey", "waiting"), batch("lines.1.payee", "1. Gulf Trade FZE"), batch("statusText", "Partly paid", "PAY-1190"), batch("lines.4.statusText", "Resent", "PAY-1190"), batch("canResend", false, "PAY-1190"),
  ], { launch: { "launch.repairOf": "PAY-1190" } }),
  T("T-30", "A batch with nothing failed says Nothing to resend, and Continue says so", ["AC-8"], alpha, [
    screen("fix"), text("Nothing to resend"), text("All payments in this batch went through."), press("Continue"), screen("fix"), text("There is nothing to resend."),
    refuses("corp.bulk.check", "REPAIR_NOT_ALLOWED", { fromAccountId: "alpha_ops", repairOf: "PAY-1180" }), refuses("corp.bulk.check", "PAYMENT_NOT_FOUND", { fromAccountId: "alpha_ops", repairOf: "PAY-9999" }),
  ], { launch: { "launch.repairOf": "PAY-1180" } }),
  T("T-31", "A batch is sent again once: after it, the lines are Resent and a second resend says there is nothing to resend", ["AC-8"], alpha, [
    screen("fix"), press("Fix lines"), set({ "bp.e.name": "Gulf Trade FZE", "bp.e.account": "AE070331234567890123456" }), press("Done"), press("Continue"), press("Continue"),
    set({ "bp.consent": true }), press("Submit for approval"), ...send, refuses("corp.bulk.check", "REPAIR_NOT_ALLOWED", { fromAccountId: "alpha_ops", repairOf: "PAY-1190" }), batch("lines.4.statusText", "Resent", "PAY-1190"),
  ], { launch: { "launch.repairOf": "PAY-1190" } }),
  T("T-32", "A line taken out of the resend stays failed on the original and can be sent later", ["AC-8"], alpha, [
    screen("fix"), press("Fix lines"), screen("edit"), press("Remove"), screen("fix"), text("Nothing to resend"), batch("lines.4.statusText", "Failed", "PAY-1190"), batch("canResend", true, "PAY-1190"),
  ], { launch: { "launch.repairOf": "PAY-1190" } }),
  T("T-33", "With bankFormats off there is no bank file choice and no format is named", ["AC-9"], alpha, [
    screen("add"), noText("Bank file"), noText("Format"), noText("XML"), text("Choose a file (up to 256 KB)"),
    refuses("corp.bulk.check", "FORMAT_NOT_ENABLED", { fromAccountId: "alpha_ops", file: BANK_XML, kind: "xml", format: "bank" }),
  ]),
  T("T-34", "With bankFormats on a bank file is read; a CSV chosen as a bank file is refused with Use a bank file, and a bank file chosen as the template with Use a CSV file", ["AC-9"], alpha, [
    text("Bank file"), text("Template (CSV)"), set({ "bp.format": "bank", ...withFile(csv(`${HARB},75,CSV-1`)) }), press("Continue"), screen("add"), text("Use a bank file."),
    set({ ...withFile(BANK_XML, "payments.xml", "xml") }), press("Continue"), screen("fix"), text("Harbour Packaging"), text("$75.00"), text("Ready"), press("Back"), screen("add"),
    set({ "bp.format": "csv", ...withFile(BANK_XML, "payments.xml", "xml") }), press("Continue"), screen("add"), text("Use a CSV file."),
  ], { launch: { "opt.bankFormats": true } }),
  T("T-35", "A bank file that is not a bank file (a document type, an entity, or no payments blocks) cannot be read and nothing in it is run", ["AC-9", "AC-13"], alpha, [
    set({ "bp.format": "bank", ...withFile("<!DOCTYPE x [<!ENTITY a \"b\">]><BatchFile><Payment><Name>&a;</Name></Payment></BatchFile>", "p.xml", "xml") }), press("Continue"), screen("add"), text("We can’t read this file type."),
    set({ ...withFile("<BatchFile></BatchFile>", "p.xml", "xml") }), press("Continue"), screen("add"), text("There are no payments in this file."),
  ], { launch: { "opt.bankFormats": true } }),
  T("T-36", "A timeout on the batch shows the check-Payments message and no batch is created", ["AC-10"], alpha, [
    ...toCode(SMALL), set({ "otp.code": "482100" }), press("Submit for approval"), screen("timeout"), text("We didn’t get an answer in time. Check Payments before you try again, so you don’t pay twice."), noBatch, noMoney,
  ], { conditions: { timeout: ["corp.bulk.submit"], latencyMs: 10_000 } }),
  T("T-37", "An unavailable bank on the batch shows the sheet and no batch is created; Try again goes back to the review", ["AC-10"], alpha, [
    ...toCode(SMALL), set({ "otp.code": "482100" }), press("Submit for approval"), screen("unavailable"), text("We couldn’t reach the bank"), text("Nothing was sent and you haven’t been charged. Try again in a moment."), noBatch, noMoney, press("Try again"), screen("review"),
  ], { conditions: { unavailable: ["corp.bulk.submit"] } }),
  T("T-38", "The bank not answering when the file is read shows the sheet; Try again goes back to the first step; a slow answer says nothing was changed", ["AC-10"], alpha, [
    pick(SMALL), press("Continue"), screen("unavailable"), text("We couldn’t reach the bank"), press("Try again"), screen("add"),
    // the file is still chosen, so Continue asks the bank again (it does not ask for the file once more)
    press("Continue"), screen("unavailable"),
  ], { conditions: { unavailable: ["corp.bulk.check"] } }),
  T("T-39", "A slow answer to a question that moves nothing says so and Try again asks again", ["AC-10"], alpha, [
    pick(SMALL), press("Continue"), screen("slow"), text("This is taking longer than expected. Nothing was changed."), press("Try again"), screen("add"),
  ], { conditions: { timeout: ["corp.bulk.check"], latencyMs: 10_000 } }),
  T("T-40", "The accounts or payees not loading shows the sheet", ["AC-10"], alpha, [screen("unavailable"), text("We couldn’t reach the bank")], { conditions: { unavailable: ["corp.suppliers.list"] } }),
  T("T-41", "The speeds not loading shows the sheet and Try again goes back to the lines", ["AC-10"], alpha, [
    ...toFix(SMALL), press("Continue"), screen("unavailable"), press("Try again"), screen("fix"),
  ], { conditions: { unavailable: ["corp.bulk.quote"] } }),
  T("T-42", "Lines entered by hand: a payee, an amount and a reference are added, each shows its own line, one is removed by pressing it and an empty list is refused", ["AC-11"], alpha, [
    text("Enter payments"), set({ "bp.how": "enter" }), press("Continue"), screen("add"), text("Add at least one payment."),
    press("Add payment"), screen("add"), text("Choose a payee and enter an amount."),
    set({ "bp.payee": "harb", "bp.amt": "120.50", "bp.ref": "INV-9" }), press("Add payment"), text("1 added"), text("Harbour Packaging · $120.50"), set({ "bp.payee": "whit", "bp.amt": "90" }), press("Add payment"), text("2 added"), text("Whitby Logistics · £90.00"),
    press("Whitby Logistics · £90.00"), text("1 added"), noText("Whitby Logistics · £90.00"), press("Continue"), screen("fix"), text("Harbour Packaging"), text("$120.50"), text("Ready"), text("$120.50"),
  ]),
  T("T-43", "Enter payments is not offered when the bank turns it off", ["AC-11"], alpha, [screen("add"), noText("Enter payments"), text("Choose a file (up to 256 KB)")], { launch: { "opt.allowEnter": false } }),
  T("T-44", "A batch cannot hold more than 50 payments entered by hand", ["AC-11"], alpha, [
    set({ "bp.how": "enter", "bp.payee": "harb", "bp.amt": "1" }), press("Add payment"), text("1 added"),
    refuses("corp.bulk.check", "BATCH_TOO_LARGE", { fromAccountId: "alpha_ops", add: true, addSupplierId: "harb", addAmount: "5", lines: Array.from({ length: 50 }, (_, i) => ({ name: "Harbour Packaging", account: "5520018841", code: "021000021", amount: String(i + 1), reference: "" })) }),
  ]),
  T("T-45", "A role without the permission lands on the no-access card, and the bank refuses the same calls", ["AC-12"], { persona: "alex", context: "beta", now: NOW }, [
    screen("denied"), text("You can’t pay in bulk at this company"), text("The bank checks this on its side too"),
    refuses("corp.bulk.check", "PERMISSION_DENIED", { fromAccountId: "beta_ops", lines: [] }), refuses("corp.bulk.submit", "PERMISSION_DENIED", { fromAccountId: "beta_ops", speed: "standard", lines: [] }),
    refuses("corp.bulk.quote", "PERMISSION_DENIED", { fromAccountId: "beta_ops", lines: [] }), refuses("corp.bulk.list", "PERMISSION_DENIED"), refuses("corp.bulk.get", "PERMISSION_DENIED", { id: "PAY-2039" }),
  ]),
  T("T-46", "From Personal the bank does not answer for a company's batch", ["AC-12"], { persona: "alex", now: NOW }, [screen("denied"), refuses("corp.bulk.check", "WRONG_CONTEXT", { fromAccountId: "alpha_ops", lines: [] }), refuses("corp.bulk.list", "WRONG_CONTEXT")]),
  T("T-47", "Another person's name cannot be used: the bank refuses a user id that is not the signed-in person's, and an account the person may not pay from", ["AC-12"], alpha, [
    screen("add"), refuses("corp.bulk.check", "PERMISSION_DENIED", { userId: "tess_m", fromAccountId: "alpha_ops", lines: [] }), refuses("corp.bulk.check", "ACCOUNT_NOT_PERMITTED", { fromAccountId: "alpha_res", lines: [] }),
  ]),
  T("T-48", "A name with markup or a formula is shown as plain text and nothing is run; a name of 70 characters is the longest", ["AC-13", "AC-2"], alpha, [
    ...toFix(csv("<b>Bold</b> & <script>x</script>,5520018841,021000021,10,A", "=HYPERLINK(\"http://example.invalid\"),5520018841,021000021,10,B", `${"N".repeat(71)},5520018841,021000021,10,C`, `${"N".repeat(70)},5520018841,021000021,10,D`)),
    text("<b>Bold</b> & <script>x</script>"), text("Not an approved payee."), text("The name is too long."), text("=HYPERLINK"),
  ]),
  T("T-49", "A line that is above the person's limit by itself is marked, and a line of an amount with more decimals than the currency has is refused", ["AC-2"], alpha, [
    ...toFix(csv(`${HARB},900000,A`, `${HARB},10.555,B`, `${HARB},-5,C`, `${HARB},1e3,D`)), text("Above your payment limit."), text("Enter an amount above zero."),
  ]),
  T("T-50", "The routing number, the sort code and the IBAN are checked by their own rules", ["AC-2"], alpha, [
    ...toFix(csv("Harbour Packaging,5520018841,021000022,10,A", `${WHIT.replace("20-00-00", "2000")},10,B`, "Nordic Supplies AB,DE89370400440532013001,,10,C", `${NORD},10,D`, `${WHIT},10,E`)),
    text("Check the routing number."), text("Check the account number."), text("Ready"),
  ]),
  T("T-51", "Back and Cancel: Back from the lines returns to the first step, and Cancel leaves", ["AC-2"], alpha, [...toFix(SMALL), press("Back"), screen("add"), press("Cancel"), screen("add")]),
  T("T-52", "The review's Back returns to the speed, and the speed's Back to the lines", ["AC-6"], alpha, [...toReview(SMALL), press("Back"), screen("speed"), press("Back"), screen("fix")]),
  T("T-53", "A file of lines in several currencies shows each currency's own amounts on the review", ["AC-6"], alpha, [...toReview(csv(`${HARB},100,A`, `${NORD},100,B`)), text("Amounts"), text("$100.00 + €100.00"), text("Total in USD, about")]),
  T("T-54", "A batch in one currency says Total, not about", ["AC-6"], alpha, [...toReview(csv(`${HARB},100,A`, `${HARB},200,B`)), noText("about"), text("Total"), text("$300.00")]),
  T("T-55", "The company's accounts not loading shows the sheet", ["AC-10"], alpha, [screen("unavailable"), text("We couldn’t reach the bank")], { conditions: { unavailable: ["corp.accounts.list"] } }),
  T("T-56", "The code not being sent shows the sheet and Try again goes back to the review; nothing is created", ["AC-10"], alpha, [
    ...toReview(SMALL), set({ "bp.consent": true }), press("Submit for approval"), screen("unavailable"), text("Nothing was sent and you haven’t been charged."), noBatch, press("Try again"), screen("review"),
  ], { conditions: { unavailable: ["bank.otp.send"] } }),
  T("T-57", "An amount that is not an amount is stopped on the field before the bank is asked", ["AC-11"], alpha, [
    set({ "bp.how": "enter", "bp.payee": "harb", "bp.amt": "12x" }), press("Add payment"), screen("add"), error("bp.amt"), noText("1 added"),
  ]),
  T("T-58", "A list that cannot be added to (the bank not answering) shows the sheet, and Try again goes back to the first step", ["AC-10", "AC-11"], alpha, [
    set({ "bp.how": "enter", "bp.payee": "harb", "bp.amt": "777.25" }), press("Add payment"), screen("unavailable"), press("Try again"), screen("add"), text("777.25"),
  ], { conditions: { unavailable: ["corp.bulk.check"] } }),
  T("T-59", "A speed must be chosen before going on", ["AC-5"], alpha, [...toSpeed(SMALL), set({ "bp.speed": "" }), press("Continue"), screen("speed"), error("bp.speed")]),
  T("T-60", "A code that is not six digits is stopped before the bank is asked", ["AC-7"], alpha, [...toCode(SMALL), set({ "otp.code": "12" }), press("Submit for approval"), screen("otp"), error("otp.code"), noBatch]),
];
