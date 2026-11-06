import type { Journey } from "../schema";
import { steps } from "./business-kit";

const { press, text, noText, screen, opens, refuses, bank } = steps;

/** What must be true for "Batch status" to be right (the spec's AC-1 to AC-5, with the ones this build adds: the role, and a bank that does not answer). */
export const bulkStatusAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "The card shows the batch's name, its total, the number of payments, its id and a status chip that follows the batch (Waiting for approval, Sent to bank, Paid, Partly paid, Rejected, Withdrawn)." },
  { id: "AC-2", text: "Every payment has its own status chip; a payment the bank returned shows the bank's sentence." },
  { id: "AC-3", text: "Fix and resend appears only when a payment failed and has not been sent again, and opens Bulk payment at that batch; once resent the line says Resent and the button is gone." },
  { id: "AC-4", text: "The report has a row for each payment with the columns Line, Payee, Amount, Currency, Status and Note, and the bank builds the CSV with a name of {id}_report.csv." },
  { id: "AC-5", text: "With no batches the empty state \"No batches yet\" and its button New bulk payment show." },
  { id: "AC-6", text: "Only a Maker sees batches: a role without the permission lands on a no-access card and the bank refuses the same calls, from Personal as well." },
  { id: "AC-7", text: "A bank that does not answer shows the sheet or the slow message and changes nothing, and Try again asks again." },
  { id: "AC-8", text: "The company's other batches are listed below, and pressing one shows it." },
];

const NOW = "2026-11-03T10:42:00Z";
const alpha = { persona: "alex", context: "alpha", now: NOW };
type Scenario = NonNullable<Journey["scenarios"]>[number];
const T = (id: string, name: string, covers: string[], base: Record<string, unknown>, stepList: Record<string, unknown>[], extra: Record<string, unknown> = {}): Scenario => ({ id, name, covers, ...base, ...extra, steps: stepList } as Scenario);
const open = (id: string, extra: Record<string, unknown> = {}) => ({ launch: { "launch.id": id }, ...extra });
const code = { adapter: "bank.otp.send", input: {} }, verify = { adapter: "bank.otp.verify", input: { code: "482100" } };
const GULF = "AE070331234567890123456";
/** Fix and resend the returned payment of PAY-1190 through the bank, as Bulk payment does. */
const resend = [
  code, verify,
  { adapter: "corp.bulk.check", input: { fromAccountId: "alpha_ops", repairOf: "PAY-1190" }, saveAs: "first" },
  { adapter: "corp.bulk.check", input: { fromAccountId: "alpha_ops", repairOf: "PAY-1190", lines: "{{setup.first.raw}}", editN: 1, editName: "Gulf Trade FZE", editAccount: GULF }, saveAs: "fixed" },
  { adapter: "corp.bulk.submit", input: { fromAccountId: "alpha_ops", repairOf: "PAY-1190", lines: "{{setup.fixed.raw}}", speed: "standard" } },
];
const sendNew = [
  code, verify,
  { adapter: "corp.bulk.check", input: { fromAccountId: "alpha_ops", file: "Payee name,Account number or IBAN,Bank code,Amount,Reference\nHarbour Packaging,5520018841,021000021,120.00,NEW-1\nWhitby Logistics,12349911,20-00-00,90.00,NEW-2", kind: "csv", format: "csv" }, saveAs: "chk" },
  { adapter: "corp.bulk.submit", input: { fromAccountId: "alpha_ops", lines: "{{setup.chk.raw}}", speed: "standard", name: "Fresh batch" } },
];
const REPORT_1190 = "Line,Payee,Amount,Currency,Status,Note\n1,Harbour Packaging,3200.00,USD,Paid,\n2,Nordic Supplies AB,1850.00,EUR,Paid,\n3,Whitby Logistics,920.00,GBP,Paid,\n4,Gulf Trade FZE,4000.00,AED,Failed,The account name didn’t match.";

export const bulkStatusScenarios: NonNullable<Journey["scenarios"]> = [
  T("T-1", "Batch PAY-1190: Partly paid; line 4 is Failed with the bank's sentence under it; Fix and resend is shown", ["AC-1", "AC-2", "AC-3"], alpha, [
    screen("view"), text("Supplier batch 19"), text("Partly paid"), text("4 payments · PAY-1190"), text("$7,"), text("1. Harbour Packaging"), text("4. Gulf Trade FZE"), text("••3456"), text("AED 4,000.00"), text("Failed"), text("The account name didn’t match."), text("Paid"), text("Fix and resend"),
  ], open("PAY-1190")),
  T("T-2", "Batch PAY-1180: Paid, six payments, and no Fix and resend", ["AC-1", "AC-3"], alpha, [
    screen("view"), text("Supplier batch 18"), text("Paid"), text("6 payments · PAY-1180"), text("6. Whitby Logistics"), text("£1,800.00"), noText("Failed"), noText("Fix and resend"),
  ], open("PAY-1180")),
  T("T-3", "Fix and resend opens Bulk payment at the batch", ["AC-3"], alpha, [press("Fix and resend"), opens("bulk-payment", { "launch.repairOf": "PAY-1190" }), screen("fix"), text("Gulf Trade FZE")], open("PAY-1190")),
  T("T-4", "After the payment was fixed and sent again the line says Resent, the new batch is the latest, and Fix and resend is gone", ["AC-3"], alpha, [
    screen("view"), text("Resend of Supplier batch 19"), text("Waiting for approval"), noText("Fix and resend"), press("Supplier batch 19"), text("Resent"), noText("Failed"), noText("The account name didn’t match."), noText("Fix and resend"), text("Partly paid"),
  ], { setup: resend }),
  T("T-5", "Download report shows a row for each payment with the columns and the note of the one that failed; the bank's CSV has the same rows", ["AC-4"], alpha, [
    press("Download report"), screen("report"), text("PAY-1190_report.csv"), text("Gulf Trade FZE"), text("The account name didn’t match."), text("Nordic Supplies AB"),
    bank("corp.bulk.get", "report.csv", REPORT_1190, { id: "PAY-1190", report: true }), bank("corp.bulk.get", "report.fileName", "PAY-1190_report.csv", { id: "PAY-1190", report: true }),
    press("Back"), screen("view"),
  ], open("PAY-1190")),
  T("T-6", "A company with no batches shows the empty state and its button", ["AC-5"], { persona: "alexempty", context: "gamma", now: NOW }, [screen("empty"), text("No batches yet"), text("Batches you send show here."), press("New bulk payment"), opens("bulk-payment")]),
  T("T-7", "A batch just sent is the latest and shows Waiting for approval on the card and on every payment", ["AC-1", "AC-2"], alpha, [
    screen("view"), text("Fresh batch"), text("Waiting for approval"), text("2 payments · PAY-2042"), text("1. Harbour Packaging"), text("2. Whitby Logistics"), noText("Fix and resend"), noText("Failed"),
  ], { setup: sendNew }),
  T("T-8", "A batch the person took back is Withdrawn on the card and on every payment", ["AC-1", "AC-2"], alpha, [screen("view"), text("Withdrawn"), noText("Waiting for approval"), noText("Fix and resend")], { setup: [...sendNew, { adapter: "corp.payments.withdraw", input: { paymentId: "PAY-2042" } }] }),
  T("T-9", "A batch an approver rejected is Rejected, and its payments are Cancelled", ["AC-1", "AC-2"], alpha, [screen("view"), text("Rejected"), text("Cancelled"), text("Supplier batch 9"), noText("Fix and resend")], {
    launch: { "launch.id": "PAY-7100" },
    setup: [{ adapter: "corp.sandbox.arrange", input: { op: "payment", payment: { id: "PAY-7100", companyId: "alpha", fromAccountId: "alpha_ops", beneficiaryId: "bulk", amount: 500, currency: "USD", reference: "Supplier batch 9", status: "rejected", initiatedBy: "alex", initiatedAt: "2026-11-02T09:00:00Z", valueDate: "2026-11-02", afterCutoff: false, required: 1, approvals: [], rejectedBy: "dana", rejectedAt: "2026-11-02T10:00:00Z", rejectReason: "Wrong amount", lines: [{ n: 1, beneficiaryId: "harb", amount: 500, reference: "X" }] } } }],
  }),
  T("T-10", "A batch released today is Sent to bank, not Paid", ["AC-1", "AC-2"], alpha, [screen("view"), text("Sent to bank"), noText("Fix and resend")], {
    launch: { "launch.id": "PAY-7101" },
    setup: [{ adapter: "corp.sandbox.arrange", input: { op: "payment", payment: { id: "PAY-7101", companyId: "alpha", fromAccountId: "alpha_ops", beneficiaryId: "bulk", amount: 500, currency: "USD", reference: "Supplier batch 10", status: "released", initiatedBy: "alex", initiatedAt: "2026-11-03T08:00:00Z", valueDate: "2026-11-03", afterCutoff: false, required: 1, approvals: [{ userId: "dana", at: "2026-11-03T09:00:00Z" }], releasedAt: "2026-11-03T09:00:00Z", releaseReference: "CORP-20261103-7101", lines: [{ n: 1, beneficiaryId: "harb", amount: 500, reference: "X" }] } } }],
  }),
  T("T-11", "Without a batch the latest is shown, and the other batches are listed; pressing one shows it", ["AC-8"], alpha, [
    screen("view"), text("Supplier batch 19"), text("Other batches"), text("Supplier batch 18"), text("6 payments · 23 Oct · Paid"), press("Supplier batch 18"), screen("view"), text("6 payments · PAY-1180"), text("Other batches"), text("Supplier batch 19"),
  ]),
  T("T-12", "An unknown batch is not shown", ["AC-7"], alpha, [screen("failed"), text("Something went wrong."), refuses("corp.bulk.get", "PAYMENT_NOT_FOUND", { id: "PAY-9999" })], open("PAY-9999")),
  T("T-13", "A role without the permission lands on the no-access card, and the bank refuses the same calls", ["AC-6"], { persona: "alex", context: "beta", now: NOW }, [
    screen("denied"), text("You can’t see bulk batches at this company"), refuses("corp.bulk.list", "PERMISSION_DENIED"), refuses("corp.bulk.get", "PERMISSION_DENIED", { id: "PAY-1190", report: true }),
  ]),
  T("T-14", "From Personal the bank does not answer for a company's batches", ["AC-6"], { persona: "alex", now: NOW }, [screen("denied"), refuses("corp.bulk.list", "WRONG_CONTEXT"), refuses("corp.bulk.get", "WRONG_CONTEXT", { id: "PAY-1190" })]),
  T("T-15", "The list not loading shows the sheet and Try again asks again", ["AC-7"], alpha, [screen("unavailable"), text("We couldn’t reach the bank"), press("Try again"), screen("unavailable")], { conditions: { unavailable: ["corp.bulk.list"] } }),
  T("T-16", "A slow list changes nothing and says so", ["AC-7"], alpha, [screen("slow"), text("This is taking longer than expected. Nothing was changed."), press("Try again"), screen("slow")], { conditions: { timeout: ["corp.bulk.list"], latencyMs: 10_000 } }),
  T("T-17", "The batch not loading when the report is asked for shows the sheet", ["AC-7"], alpha, [screen("unavailable")], { launch: { "launch.id": "PAY-1190" }, conditions: { unavailable: ["corp.bulk.get"] } }),
  T("T-18", "New bulk payment from the card opens Bulk payment, and Close leaves", ["AC-8"], alpha, [press("New bulk payment"), opens("bulk-payment")], open("PAY-1180")),
];
