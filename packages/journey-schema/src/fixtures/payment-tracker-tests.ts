import type { Journey } from "../schema";
import { steps } from "./business-kit";

const { press, text, noText, screen, opens, refuses } = steps;

/** What must be true for "Payment tracker" to be right (the spec's criteria). */
export const paymentTrackerAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "The list shows the company's payments, newest first, with id, start time, who it is to, the amount and a status chip." },
  { id: "AC-2", text: "The filter chips narrow the list by status; All shows everything; Released matches only Released to bank, and a payment released on an earlier day is Settled." },
  { id: "AC-3", text: "The detail shows a timeline that matches the status: who started it and when, how many approved and by whom, the cut-off, and for a withdrawn payment the reason." },
  { id: "AC-4", text: "Withdraw shows only on the Maker's own pending payment and only with the right to withdraw, and opens Withdraw a payment with that payment." },
  { id: "AC-5", text: "A withdrawn payment shows Withdrawn and no release steps." },
  { id: "AC-6", text: "With no payments the empty state shows; with a filter that matches none, \"Nothing here\"; a payment that cannot be found says so." },
  { id: "AC-7", text: "An Approver sees the same list for the company and no Withdraw, with a note about their role in place of New supplier payment." },
  { id: "AC-8", text: "A bank that cannot be reached, or does not answer in time, shows the retry state; the bank answers only for the payments of the company the person is in." },
];

const NOW = "2026-11-03T10:42:00Z";
const alpha = { persona: "alex", context: "alpha", now: NOW };
const beta = { persona: "alex", context: "beta", now: NOW };
type Scenario = NonNullable<Journey["scenarios"]>[number];
const T = (id: string, name: string, covers: string[], base: Record<string, unknown>, stepList: Record<string, unknown>[], extra: Record<string, unknown> = {}): Scenario => ({ id, name, covers, ...base, ...extra, steps: stepList } as Scenario);
const withdrawn = { setup: [{ adapter: "corp.payments.withdraw", input: { paymentId: "PAY-2040", reason: "Wrong amount" } }] };

export const paymentTrackerScenarios: NonNullable<Journey["scenarios"]> = [
  T("T-1", "Alex at Alpha: the payments, newest first, PAY-2040 pending approval with its start time, the batches as Bulk, and New supplier payment", ["AC-1"], alpha, [
    screen("list"), text("Payments"), text("PAY-2040"), text("Today 09:30"), text("Harbour Packaging"), text("$18,900.00"), text("Pending approval"), text("PAY-1187"), text("$12,450.00"), text("Settled"),
    text("Bulk · 3 payments"), text("Bulk · 2 payments"), text("New supplier payment"), noText("Nothing here"), noText("Your role here is"),
  ]),
  T("T-2", "The chip Settled shows only settled payments; PAY-2040 is gone", ["AC-2"], alpha, [press("Settled"), text("PAY-1187"), text("PAY-1190"), text("PAY-1180"), noText("PAY-2040"), noText("Pending approval"), press("Pending"), text("PAY-2040"), noText("PAY-1187"), press("All"), text("PAY-1187"), text("PAY-2040")]),
  T("T-3", "The chip Rejected matches none: Nothing here and No payment has this status.", ["AC-6"], alpha, [press("Rejected"), text("Nothing here"), text("No payment has this status."), noText("PAY-2040"), noText("No payments yet")]),
  T("T-4", "A payment released today is Released to bank (not Settled); the chip Released shows it and Settled does not", ["AC-2"], alpha, [
    text("Released to bank"), press("Released"), text("PAY-2040"), noText("PAY-1187"), press("Settled"), noText("PAY-2040"), text("PAY-1187"),
  ], { setup: [{ adapter: "corp.sandbox.arrange", input: { op: "release", paymentId: "PAY-2040" } }] }),
  T("T-5", "PAY-2040: the timeline has Created, Approval 0 of 1 approved, the cut-off and Settled still to come; Withdraw is offered", ["AC-3", "AC-4"], alpha, [
    press("PAY-2040"), screen("detail"), text("PAY-2040"), text("Pending approval"), text("$18,900.00"), text("Harbour Packaging"), text("Ref PO-5612"), text("Alex Morgan"), text("Created"), text("Alex Morgan · Today 09:30"), text("Approval"), text("0 of 1 approved"),
    text("Released to bank"), text("Before the 16:00 cut-off"), text("Settled"), text("Withdraw"), noText("View receipt"),
  ]),
  T("T-6", "PAY-1187: the timeline ends at Settled with the approver's name; no Withdraw; View receipt", ["AC-3", "AC-4"], alpha, [
    press("PAY-1187"), screen("detail"), text("Settled"), text("1 of 1 approved (Dana Cruz)"), text("Before the 16:00 cut-off"), noText("Withdraw"), text("View receipt"),
  ]),
  T("T-7", "Withdraw opens Withdraw a payment with that payment", ["AC-4"], alpha, [press("PAY-2040"), press("Withdraw"), opens("withdraw-payment", { "launch.paymentId": "PAY-2040" }), screen("confirm"), text("PAY-2040 · Ref PO-5612")]),
  T("T-8", "A withdrawn payment shows Withdrawn with its reason, and no Released or Settled steps", ["AC-5"], alpha, [
    text("Withdrawn"), press("PAY-2040"), screen("detail"), text("Withdrawn · Wrong amount"), noText("Before the 16:00 cut-off"), noText("Withdraw "), noText("View receipt"), press("Back to payments"), press("Withdrawn"), text("PAY-2040"), noText("PAY-1187"),
  ], withdrawn),
  T("T-9", "Alex at Beta (an Approver): the same kind of list for Beta, no New supplier payment but a note about his role, and no Withdraw", ["AC-7"], beta, [
    screen("list"), text("PAY-2041"), text("PAY-2039"), text("PAY-2012"), text("Nimbus Logistics"), noText("PAY-2040"), noText("New supplier payment"),
    text("Your role here is Approver. It can’t create payments, so this button isn’t offered. The bank refuses it too."), press("PAY-2041"), screen("detail"), text("Priya Nair"), noText("Withdraw"),
  ]),
  T("T-10", "A company with no payments: No payments yet", ["AC-6"], { persona: "alexempty", context: "gamma", now: NOW }, [screen("list"), text("No payments yet"), text("Payments you start will show here with their status."), noText("Nothing here")]),
  T("T-11", "New supplier payment opens Pay a supplier", ["AC-4"], alpha, [press("New supplier payment"), opens("supplier-payment"), screen("supplier")]),
  T("T-12", "Opened with a payment (the deep link) it shows that payment; a payment that cannot be found says so", ["AC-6"], alpha, [screen("detail"), text("PAY-1187"), text("Settled"), press("Back to payments"), screen("list")], { launch: { "launch.paymentId": "PAY-1187" } }),
  T("T-13", "A payment that is not there says Payment not found.", ["AC-6"], alpha, [screen("detail"), text("Payment not found."), text("We can’t find that payment."), noText("Withdraw")], { launch: { "launch.paymentId": "PAY-9999" } }),
  T("T-14", "The bank answers only for the payments of the company the person is in", ["AC-8"], alpha, [screen("list"), refuses("corp.payments.track", "PAYMENT_NOT_FOUND", { paymentId: "PAY-2041" })]),
  T("T-15", "When the bank is unavailable the list shows the retry state", ["AC-8"], alpha, [screen("loadFail"), text("We couldn’t load your payments. Nothing was changed."), text("Nothing was sent and you haven’t been charged. Try again in a moment."), noText("PAY-2040"), press("Try again"), screen("loadFail")], { conditions: { unavailable: ["corp.payments.track"] } }),
  T("T-16", "When the bank does not answer in time the retry state says so", ["AC-8"], alpha, [screen("loadFail"), text("This is taking longer than expected. Nothing was changed."), press("Try again"), screen("loadFail")], { conditions: { timeout: ["corp.payments.track"], latencyMs: 10000 } }),
  T("T-17", "From Personal the bank does not answer for a company's payments", ["AC-8"], { persona: "alex", now: NOW }, [screen("denied"), text("You can’t see payments at this company"), refuses("corp.payments.track", "WRONG_CONTEXT")]),
];
