import type { Journey } from "../schema";
import { steps } from "./business-kit";

const { press, text, noText, screen, set, error, opens, refuses, bank } = steps;

/** What must be true for "Withdraw a payment" to be right (the spec's criteria). */
export const businessWithdrawAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "Only the Maker's own pending payments can be withdrawn; another person's is refused with \"You can only withdraw payments you started.\", and a role without the permission lands on a no-access card and is refused by the bank." },
  { id: "AC-2", text: "The confirm screen shows the payment and, when askReason is on, an optional reason; Other adds a note of up to 100 characters, and the bank refuses a reason that is not on the list." },
  { id: "AC-3", text: "The result is \"Payment withdrawn\", status Withdrawn, says nothing was sent, and the payment leaves the approvers' queue and gives its amount back to the person's daily limit." },
  { id: "AC-4", text: "A payment released to the bank, or no longer waiting for approval, cannot be withdrawn, with the words of the spec." },
  { id: "AC-5", text: "With nothing to withdraw the pick step shows \"Nothing to withdraw\"; opened with a payment the pick step is skipped." },
  { id: "AC-6", text: "A timeout shows the Check Payments message and changes nothing; an unavailable bank shows the sheet and changes nothing." },
];

const NOW = "2026-11-03T10:42:00Z";
const alpha = { persona: "alex", context: "alpha", now: NOW };
type Scenario = NonNullable<Journey["scenarios"]>[number];
const T = (id: string, name: string, covers: string[], base: Record<string, unknown>, stepList: Record<string, unknown>[], extra: Record<string, unknown> = {}): Scenario => ({ id, name, covers, ...base, ...extra, steps: stepList } as Scenario);
const withPayment = (id: string, extra: Record<string, unknown> = {}) => ({ launch: { "launch.paymentId": id }, ...extra });
const trk = (path: string, equals: unknown, id = "PAY-2040") => bank("corp.payments.track", path, equals, { paymentId: id });
const stillPending = trk("statusKey", "pending_approval");
const someoneElses = { adapter: "corp.sandbox.arrange", input: { op: "payment", payment: { id: "PAY-7001", companyId: "alpha", fromAccountId: "alpha_ops", beneficiaryId: "harb", amount: 100, currency: "USD", reference: "X-1", status: "pending_approval", initiatedBy: "tess_m", initiatedAt: "2026-11-03T09:00:00Z", valueDate: "2026-11-03", afterCutoff: false, required: 1, approvals: [] } } };

export const businessWithdrawScenarios: NonNullable<Journey["scenarios"]> = [
  T("T-1", "PAY-2040 with the reason Wrong amount: Payment withdrawn, nothing was sent to Harbour Packaging, the reason is on the receipt, the tracker says Withdrawn, the day's limit is given back", ["AC-2", "AC-3"], alpha, [
    screen("confirm"), text("Withdraw this payment?"), text("$18,900.00 to Harbour Packaging"), text("PAY-2040 · Ref PO-5612"), text("Pending approval"), text("Reason (optional)"), noText("Note"),
    set({ "wd.reason": "Wrong amount" }), press("Withdraw payment"), screen("done"), text("Payment withdrawn"), text("Nothing was sent to Harbour Packaging."), text("Withdrawn"), text("Wrong amount"), text("$18,900.00"),
    trk("statusKey", "withdrawn"), trk("withdrawReason", "Wrong amount"), bank("corp.company.get", "me.usedToday", 0), bank("corp.company.get", "accounts.alpha_ops.balance", 480_000), bank("corp.payments.pending", "PAY-2040", undefined, { as: "initiator" }),
  ], withPayment("PAY-2040")),
  T("T-2", "The reason Other asks for a note, which is the reason on the receipt and in the tracker", ["AC-2"], alpha, [
    set({ "wd.reason": "Other" }), text("Note"), set({ "wd.note": "Wrong invoice" }), press("Withdraw payment"), screen("done"), text("Wrong invoice"), trk("withdrawReason", "Wrong invoice"),
    bank("corp.payments.track", "timeline.approval.text", "Withdrawn · Wrong invoice", { paymentId: "PAY-2040" }),
  ], withPayment("PAY-2040")),
  T("T-3", "With askReason off there is no reason field and the payment is still withdrawn", ["AC-2"], alpha, [noText("Reason"), noText("Note"), press("Withdraw payment"), screen("done"), text("Payment withdrawn"), noText("Reason"), trk("statusKey", "withdrawn")], withPayment("PAY-2040", { launch: { "launch.paymentId": "PAY-2040", "opt.askReason": false } })),
  T("T-4", "A note of more than 100 characters is not accepted, and the bank refuses a reason that is not on the list", ["AC-2"], alpha, [
    set({ "wd.reason": "Other", "wd.note": "x".repeat(101) }), press("Withdraw payment"), screen("confirm"), error("wd.note"), trk("statusKey", "pending_approval"),
    refuses("corp.payments.withdraw", "INVALID_REASON", { paymentId: "PAY-2040", reason: "Because I said so" }), refuses("corp.payments.withdraw", "INVALID_REASON", { paymentId: "PAY-2040", reason: "Other", note: "x".repeat(101) }), stillPending,
  ], withPayment("PAY-2040")),
  T("T-5", "A payment already released to the bank (PAY-1187) cannot be withdrawn", ["AC-4"], alpha, [screen("confirm"), text("Settled"), press("Withdraw payment"), screen("confirm"), text("This payment has already been released to the bank. It can’t be withdrawn."), noText("Payment withdrawn")], withPayment("PAY-1187")),
  T("T-6", "A payment released by an approver while the screen was open is refused with the same words", ["AC-4"], alpha, [press("Withdraw payment"), screen("confirm"), text("This payment has already been released to the bank. It can’t be withdrawn."), trk("statusKey", "released")], withPayment("PAY-2040", { setup: [{ adapter: "corp.sandbox.arrange", input: { op: "release", paymentId: "PAY-2040" } }] })),
  T("T-7", "A payment that is no longer waiting for approval (already withdrawn) is refused", ["AC-4"], alpha, [press("Withdraw payment"), screen("confirm"), text("This payment is no longer waiting for approval.")], withPayment("PAY-2040", { setup: [{ adapter: "corp.payments.withdraw", input: { paymentId: "PAY-2040" } }] })),
  T("T-8", "A payment started by someone else is refused: You can only withdraw payments you started.", ["AC-1"], alpha, [screen("confirm"), press("Withdraw payment"), screen("confirm"), text("You can only withdraw payments you started."), noText("Payment withdrawn"), trk("statusKey", "pending_approval", "PAY-7001")], withPayment("PAY-7001", { setup: [someoneElses] })),
  T("T-9", "A payment that is not there says so", ["AC-1"], alpha, [screen("confirm"), text("We can’t find that payment."), noText("Withdraw payment"), refuses("corp.payments.withdraw", "PAYMENT_NOT_FOUND", { paymentId: "PAY-9999" })], withPayment("PAY-9999")),
  T("T-10", "Without a payment the pick step lists the Maker's own pending payments, and choosing one goes to the confirm step", ["AC-1", "AC-5"], alpha, [
    screen("pick"), text("Withdraw a payment"), text("$18,900.00 to Harbour Packaging"), text("PAY-2040 · 0 of 1 approved"), noText("PAY-1187"), noText("Nothing to withdraw"), press("$18,900.00 to Harbour Packaging"), screen("confirm"), text("PAY-2040 · Ref PO-5612"),
  ], { setup: [someoneElses] }),
  T("T-11", "With nothing waiting the pick step says Nothing to withdraw", ["AC-5"], alpha, [screen("pick"), text("Nothing to withdraw"), text("Only payments waiting for approval can be withdrawn."), noText("PAY-2040")], { setup: [{ adapter: "corp.payments.withdraw", input: { paymentId: "PAY-2040" } }] }),
  T("T-12", "A timeout on the withdraw shows Check Payments and the payment stays pending", ["AC-6"], alpha, [press("Withdraw payment"), screen("timeout"), text("We didn’t get an answer in time. Check Payments before you try again."), noText("Payment withdrawn"), stillPending], withPayment("PAY-2040", { conditions: { timeout: ["corp.payments.withdraw"], latencyMs: 10000 } })),
  T("T-13", "The bank being unavailable on the withdraw shows the sheet; Try again returns to the confirm step; the payment stays pending", ["AC-6"], alpha, [
    press("Withdraw payment"), screen("unavailable"), text("We couldn’t reach the bank"), text("Nothing was sent and you haven’t been charged. Try again in a moment."), stillPending, press("Try again"), screen("confirm"),
  ], withPayment("PAY-2040", { conditions: { unavailable: ["corp.payments.withdraw"] } })),
  T("T-14", "The payments to pick from not loading shows the sheet", ["AC-6"], alpha, [screen("unavailable"), press("Try again"), screen("unavailable")], { conditions: { unavailable: ["corp.payments.pending"] } }),
  T("T-15", "The payment not loading shows the sheet and Try again asks again", ["AC-6"], alpha, [screen("unavailable"), press("Try again"), screen("unavailable")], withPayment("PAY-2040", { conditions: { unavailable: ["corp.payments.track"] } })),
  T("T-16", "A slow list changes nothing and says so", ["AC-6"], alpha, [screen("slow"), text("This is taking longer than expected. Nothing was changed."), press("Try again"), screen("slow")], { conditions: { timeout: ["corp.payments.pending"], latencyMs: 10000 } }),
  T("T-17", "Alex at Beta (an Approver): the no-access card, and the bank refuses the withdraw", ["AC-1"], { persona: "alex", context: "beta", now: NOW }, [screen("denied"), text("You can’t withdraw payments at this company"), refuses("corp.payments.withdraw", "PERMISSION_DENIED", { paymentId: "PAY-2041" })]),
  T("T-18", "From Personal the bank does not answer for a company's payments", ["AC-1"], { persona: "alex", now: NOW }, [screen("denied"), refuses("corp.payments.withdraw", "WRONG_CONTEXT", { paymentId: "PAY-2040" })]),
  T("T-19", "Back to payments opens the Payment tracker and New supplier payment opens Pay a supplier", ["AC-3"], alpha, [press("Withdraw payment"), press("Back to payments"), opens("payment-tracker")], withPayment("PAY-2040")),
  T("T-20", "New supplier payment opens Pay a supplier", ["AC-3"], alpha, [press("Withdraw payment"), press("New supplier payment"), opens("supplier-payment"), screen("supplier")], withPayment("PAY-2040")),
  T("T-21", "Withdrawing is checked again by the bank: a pending payment of Beta cannot be withdrawn from Alpha's session", ["AC-1"], alpha, [screen("confirm"), refuses("corp.payments.withdraw", "PAYMENT_NOT_FOUND", { paymentId: "PAY-2041" })], withPayment("PAY-2040")),
  T("T-22", "Withdrawing a payment of the Maker's own that an approver has partly approved is still allowed", ["AC-3"], alpha, [press("Withdraw payment"), screen("done"), trk("statusKey", "withdrawn", "PAY-7002")], withPayment("PAY-7002", { setup: [{ adapter: "corp.sandbox.arrange", input: { op: "payment", payment: { id: "PAY-7002", companyId: "alpha", fromAccountId: "alpha_ops", beneficiaryId: "harb", amount: 60_000, currency: "USD", reference: "X-2", status: "pending_approval", initiatedBy: "alex", initiatedAt: "2026-11-03T09:00:00Z", valueDate: "2026-11-03", afterCutoff: false, required: 2, approvals: [{ userId: "dana", at: "2026-11-03T09:30:00Z" }] } } }] })),
];
