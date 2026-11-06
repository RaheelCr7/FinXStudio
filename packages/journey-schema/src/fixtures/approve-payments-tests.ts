import type { Journey } from "../schema";

/**
 * What must be true for "Approve payments" to be right (the spec's AC-1 to AC-10, with the ones this build adds: approving several with one code, the
 * history, and a payment that is gone). Each is proved by at least one scenario below.
 */
export const approvePaymentsAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "Only a holder of the approve permission sees the inbox; anyone else sees the no-access card and their own payments waiting for approval, and the bank refuses the same calls when they are forced (approve, reject, approve several, pass on)." },
  { id: "AC-2", text: "A payment you started, or already approved, shows the sentence and no Approve button; the bank refuses it if forced." },
  { id: "AC-3", text: "A payment that must be approved in order shows \"Waiting for {name} to approve first.\" until that person has approved; the bank refuses an approval out of turn." },
  { id: "AC-4", text: "Approving needs a code when the bank asks for one (from 25,000.00 in the demo) and none below it." },
  { id: "AC-5", text: "Every approval needs the tick \"I checked the payee details\"; a payee whose name the bank's record does not match shows the chip and the bank's record, the bank refuses an approval without the tick, and such a payment cannot be part of an approval of several." },
  { id: "AC-6", text: "A payment that needs two approvals shows \"Approved, one more needed\" after the first, and is released by the second." },
  { id: "AC-7", text: "Reject needs a reason; \"Other\" needs a note of at least 10 characters; the payment is rejected with that reason and nothing is sent." },
  { id: "AC-8", text: "With batch off no Approve several; with delegation off no Pass to someone; with delegation on a payment is passed to another approver who alone can then approve it, but not to one who already approved." },
  { id: "AC-9", text: "After the cut-off no approval is possible, and the details say so; before it they show how long is left." },
  { id: "AC-10", text: "An unavailable bank or a timeout approves nothing and says so; a timeout says to check Payments first." },
  { id: "AC-11", text: "Several payments that can be approved together are approved with one code, all or none; the ones with a name to check, the ones you started and the ones out of turn are not offered, and the bank refuses them if forced." },
  { id: "AC-12", text: "The history lists what was released or rejected and opens its details; a payment that is gone, or no longer waiting, says so." },
  { id: "AC-13", text: "With the bank's option stepUp off no code is asked at any amount, for one payment or several; with it on the code is asked from the company's threshold, and the bank follows the option." },
  { id: "AC-14", text: "Reject several: the person ticks payments and gives one reason (a note of at least 10 characters for Other), and all are rejected with one reference or none; one that cannot be rejected stops the whole group, and the bank refuses a rejection with no reason or a short note." },
  { id: "AC-15", text: "The details name the rule behind the approvers, any of them in any order or one after the other, and show when each approver approved." },
  { id: "AC-16", text: "Every decision (approving, rejecting, passing on, approving or rejecting several) ends with its APR reference." },
  { id: "AC-17", text: "A batch or a payroll run shows who is paid how much under its details, and never an account number." },
];

// Alex Morgan at Beta Services Ltd (an Approver), working in the company from the start. Today is Tuesday 3 November 2026, 10:42 UTC; the cut-off is 16:00.
// "alex" has the two payments of the combined demo waiting (PAY-2039 for 64,500.00 after Lee Park, PAY-2041 for 8,200.00); "alexbiz" has the cast on top:
// PAY-2043 27,500.00 close name, PAY-2044 9,800.00 started by Alex, PAY-2046 56,000.00 two approvals, PAY-2047 72,000.00 Lee goes first, PAY-2048 6,100.00 no name match,
// PAY-2036 rejected and PAY-2012 paid.
const NOW = "2026-11-03T10:42:00Z";
type Step = Record<string, unknown>;
const set = (v: Record<string, unknown>): Step => ({ set: v });
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const error = (e: string): Step => ({ expectError: e });
const payment = (id: string, path: string, equals: unknown): Step => ({ expectBank: { adapter: "corp.payments.get", input: { paymentId: id }, path, equals } });
const balance = (equals: number): Step => ({ expectBank: { adapter: "corp.company.get", path: "accounts.beta_ops.balance", equals } });
const released = (equals: number): Step => ({ expectBank: { adapter: "corp.company.get", path: "companyUsedToday", equals } });
const refused = (adapter: string, code: string, input: Record<string, unknown> = {}): Step => ({ expectBankError: { adapter, input, code } });
/** A fresh code is verified, as a forced call needs it before the bank looks at anything else. */
const withCode: Step[] = [{ expectBank: { adapter: "bank.otp.send", path: "sent", equals: true } }, { expectBank: { adapter: "bank.otp.verify", input: { code: "482100" }, path: "verified", equals: true } }];
const code = (c = "482100"): Step[] => [set({ "otp.code": c })];
const launch = (id: string) => ({ "launch.paymentId": id });
/** From a payment's details to the confirmation with the tick given. */
const toConfirm = (amount: string): Step[] => [press(`Approve ${amount}`), screen("confirm")];
const ticked: Step = set({ "ap.ack": true });

const base = { persona: "alex", context: "beta", now: NOW };
const T = (id: string, name: string, covers: string[], steps: Step[], extra: Record<string, unknown> = {}): NonNullable<Journey["scenarios"]>[number] => ({ id, name, covers, ...base, ...extra, steps } as any);
const C = (id: string, name: string, covers: string[], steps: Step[], extra: Record<string, unknown> = {}) => T(id, name, covers, steps, { persona: "alexbiz", ...extra });

export const approvePaymentsScenarios: NonNullable<Journey["scenarios"]> = [
  T("T-1", "PAY-2041, 8,200.00, from the inbox: no code is asked, the tick is, and it is Approved and Sent to the bank", ["AC-4", "AC-5", "AC-6"], [
    screen("inbox"), text("Inbox (2)"), text("PAY-2039"), text("PAY-2041"), text("Nimbus Logistics"), text("Priya Nair"), text("$8,200.00"), text("Ready for you"), text("Cut-off in 5h 18m"),
    press("PAY-2041"), screen("detail"), text("$8,200.00 to Nimbus Logistics"), text("Ready for you"), text("INV-2291"), text("Priya Nair"), text("Operating ••3001"),
    text("Alex Morgan (you)"), text("Can approve"), text("Cut-off in 5h 18m"), noText("You’ll be asked for a code."), noText("Pass to someone"),
    ...toConfirm("$8,200.00"), noText("Close match"), press("Approve $8,200.00"), screen("confirm"), error("ap.ack"), text("Confirm that you checked the payee details."),
    ticked, press("Approve $8,200.00"), screen("approved"), noText("Code sent"), text("Approved"), text("$8,200.00 to Nimbus Logistics"), text("Sent to the bank"), text("CORP-20261103-2041"), text("1 of 1"),
    payment("PAY-2041", "status", "released"), payment("PAY-2041", "approvals.0.userId", "alex"), payment("PAY-2041", "initiatedBy", "priya"), balance(301_800), released(8_200),
    { expectBank: { adapter: "corp.payments.list", input: { status: "pending" }, path: "PAY-2041", equals: undefined } },
    press("Back to approvals"), screen("inbox"), text("Inbox (1)"), noText("PAY-2041"),
  ]),
  T("T-2", "PAY-2039, 64,500.00, second of two after Lee Park: the code is asked and names the amount, then it is released with both approvals", ["AC-3", "AC-4", "AC-6"], [
    screen("inbox"), press("PAY-2039"), screen("detail"), text("$64,500.00 to Nimbus Logistics"), text("Lee Park"), text("Approved"), text("Alex Morgan (you)"), text("Next"), text("1 of 2 approved"),
    text("You’ll be asked for a code."), ...toConfirm("$64,500.00"), ticked, press("Approve $64,500.00"), screen("otp"), text("Approve $64,500.00"), text("Code sent to"),
    payment("PAY-2039", "status", "pending_approval"), payment("PAY-2039", "approvals.1", undefined), balance(310_000),
    ...code(), press("Approve $64,500.00"), screen("approved"), text("Approved"), text("Sent to the bank"), text("2 of 2"), text("CORP-20261102-2039"),
    payment("PAY-2039", "status", "released"), payment("PAY-2039", "approvals.0.userId", "lee"), payment("PAY-2039", "approvals.1.userId", "alex"), balance(245_500), released(64_500),
  ]),
  C("T-3", "PAY-2044, which Alex started: the sentence instead of the buttons, and the bank refuses it if forced", ["AC-2"], [
    screen("inbox"), text("Waiting for others"), text("Started by you"), press("PAY-2044"), screen("detail"), text("$9,800.00 to Nimbus Logistics"),
    text("You started this payment. Another approver must approve it."), noText("Approve $9,800.00"), noText("Reject"), noText("Pass to someone"),
    refused("corp.payments.approve", "SELF_APPROVAL", { paymentId: "PAY-2044" }), refused("corp.payments.reject", "NOT_AUTHORISED", { paymentId: "PAY-2044", reason: "Wrong amount" }),
    payment("PAY-2044", "status", "pending_approval"), balance(310_000),
  ]),
  C("T-4", "PAY-2047, which Lee Park must approve first: \"Waiting for Lee Park to approve first.\" and no button; the bank refuses an approval out of turn", ["AC-3"], [
    screen("detail"), text("$72,000.00 to Nimbus Logistics"), text("Waiting for Lee Park to approve first."), text("Next"), text("Waiting"), noText("Approve $72,000.00"),
    ...withCode, refused("corp.payments.approve", "OUT_OF_SEQUENCE", { paymentId: "PAY-2047" }), payment("PAY-2047", "approvals", []), balance(310_000),
  ], { launch: launch("PAY-2047") }),
  C("T-5", "PAY-2043, whose name is a close match: the chip and the bank's record on the details and the confirmation, the tick is needed, then the code", ["AC-5", "AC-4"], [
    screen("detail"), text("$27,500.00 to Rhine Freight GmbH"), text("The payee gets about €25,465.00"), text("Close match"), text("The bank’s record says “Rhine Fracht GmbH”."),
    ...toConfirm("$27,500.00"), text("Close match"), text("The bank’s record says “Rhine Fracht GmbH”."), press("Approve $27,500.00"), screen("confirm"), error("ap.ack"), text("Confirm that you checked the payee details."),
    payment("PAY-2043", "status", "pending_approval"), ticked, press("Approve $27,500.00"), screen("otp"), ...code(), press("Approve $27,500.00"), screen("approved"), text("Sent to the bank"),
    payment("PAY-2043", "status", "released"), balance(282_500),
  ], { launch: launch("PAY-2043") }),
  C("T-6", "PAY-2048, whose name does not match: \"No match\" and the bank's record; the bank refuses an approval without the tick when forced", ["AC-5"], [
    screen("detail"), text("No match"), text("The bank’s record says “Zenith Holdings”."), text("Gulf Trade FZE"), text("The payee gets about"),
    refused("corp.payments.approve", "NAME_CHECK_NOT_CONFIRMED", { paymentId: "PAY-2048" }), payment("PAY-2048", "status", "pending_approval"), balance(310_000),
  ], { launch: launch("PAY-2048") }),
  C("T-7", "PAY-2046, 56,000.00 with two approvals: after Alex's it is \"Approved, one more needed\", waiting for another approver, and Alex cannot approve it again", ["AC-6", "AC-2"], [
    screen("detail"), text("$56,000.00 to Rhine Freight GmbH"), text("Can approve"), ...toConfirm("$56,000.00"), ticked, press("Approve $56,000.00"), screen("otp"), ...code(), press("Approve $56,000.00"),
    screen("approved"), text("Approved, one more needed"), text("Waiting for another approver"), text("1 of 2"), noText("Sent to the bank"),
    payment("PAY-2046", "status", "pending_approval"), payment("PAY-2046", "approvals.0.userId", "alex"), balance(310_000), released(0),
    press("Back to approvals"), press("PAY-2046"), screen("detail"), text("You approved this payment. Waiting for the next approver."), noText("Approve $56,000.00"),
    ...withCode, refused("corp.payments.approve", "ALREADY_APPROVED", { paymentId: "PAY-2046" }),
  ], { launch: launch("PAY-2046") }),
  C("T-8", "Rejecting PAY-2048: no reason gives \"Choose a reason.\", then Wrong payee rejects it, nothing is sent and the starter is told", ["AC-7"], [
    screen("detail"), press("Reject"), screen("reject"), press("Reject payment"), screen("reject"), text("Choose a reason."), payment("PAY-2048", "status", "pending_approval"),
    set({ "ap.reason": "Wrong payee" }), noText("Choose a reason."), press("Reject payment"), screen("rejected"), text("Payment rejected"), text("$6,100.00 to Gulf Trade FZE. Nothing was sent."), text("Rejected"), text("Wrong payee"), text("Told"), text("Omar Haddad"),
    payment("PAY-2048", "status", "rejected"), payment("PAY-2048", "rejectReason", "Wrong payee"), payment("PAY-2048", "rejectedBy", "alex"), balance(310_000), released(0),
  ], { launch: launch("PAY-2048") }),
  C("T-9", "Rejecting with Other: a note is needed and it must have at least 10 characters; the note becomes the reason", ["AC-7"], [
    screen("detail"), press("Reject"), set({ "ap.reason": "Other" }), text("Note"), press("Reject payment"), screen("reject"), error("ap.note"),
    set({ "ap.note": "too short" }), press("Reject payment"), screen("reject"), error("Write at least 10 characters"),
    set({ "ap.note": "Duplicate of INV-2290, already paid" }), press("Reject payment"), screen("rejected"), payment("PAY-2048", "rejectReason", "Duplicate of INV-2290, already paid"), payment("PAY-2048", "status", "rejected"),
  ], { launch: launch("PAY-2048") }),
  C("T-10", "Rejecting with a reason from the list does not ask for a note", ["AC-7"], [
    screen("detail"), press("Reject"), set({ "ap.reason": "Duplicate" }), noText("Note"), press("Reject payment"), screen("rejected"), payment("PAY-2048", "rejectReason", "Duplicate"),
  ], { launch: launch("PAY-2048") }),
  T("T-11", "Alex at Alpha, a Maker: the no-access card and his own waiting payment, and the bank refuses every forced approval, whatever name the call carries", ["AC-1"], [
    screen("denied"), text("You don’t have access to the approvals inbox"), text("The bank checks this on its side too"), text("Your requests waiting for approval"), text("PAY-2040 · 0 of 1 approved"), text("Harbour Packaging"),
    noText("Approve $"), noText("Reject"),
    ...withCode, refused("corp.payments.approve", "PERMISSION_DENIED", { paymentId: "PAY-2040" }), refused("corp.payments.approve", "PERMISSION_DENIED", { paymentId: "PAY-2040", userId: "dana" }),
    refused("corp.payments.reject", "PERMISSION_DENIED", { paymentId: "PAY-2040", reason: "Wrong amount" }), refused("corp.payments.approveMany", "PERMISSION_DENIED", { paymentIds: ["PAY-2040"] }),
    refused("corp.payments.delegate", "PERMISSION_DENIED", { paymentId: "PAY-2040", toUserId: "dana" }),
    payment("PAY-2040", "status", "pending_approval"), payment("PAY-2040", "approvals", []),
    { expectBank: { adapter: "corp.company.get", path: "accounts.alpha_ops.balance", equals: 480_000 } },
  ], { context: "alpha" }),
  T("T-12", "Opened from Personal the bank says it belongs to the business side: the card asks the person to switch", ["AC-1"], [
    screen("denied"), text("Switch to your business first"), text("This belongs to your business banking."), noText("Your requests waiting for approval"),
  ], { context: undefined }),
  T("T-13", "After the cut-off nothing due that day can be approved: the details say so, there is no button, and the bank refuses it", ["AC-9"], [
    screen("inbox"), text("Cut-off passed"), press("PAY-2041"), screen("detail"), text("Cut-off passed"), text("The cut-off has passed. This payment can’t be approved today."), noText("Approve $8,200.00"), noText("Reject"),
    refused("corp.payments.approve", "APPROVAL_EXPIRED", { paymentId: "PAY-2041" }), payment("PAY-2041", "status", "pending_approval"), balance(310_000),
  ], { now: "2026-11-03T16:01:00Z" }),
  T("T-14", "Before the cut-off the chip counts down: under 90 minutes it is a warning, under 30 minutes an alarm, and at the cut-off itself it still can be approved", ["AC-9"], [
    screen("detail"), text("Cut-off in 48m"), ...toConfirm("$8,200.00"), ticked, press("Approve $8,200.00"), screen("approved"), text("Sent to the bank"),
  ], { now: "2026-11-03T15:12:00Z", launch: launch("PAY-2041") }),
  T("T-15", "At 16:00 exactly the cut-off has not passed yet; a minute later it has", ["AC-9"], [
    screen("detail"), text("Cut-off in 0m"), ...toConfirm("$8,200.00"), ticked, press("Approve $8,200.00"), screen("approved"),
  ], { now: "2026-11-03T16:00:00Z", launch: launch("PAY-2041") }),
  T("T-16", "The bank is unavailable when approving: nothing is approved, the payment still waits, and Try again returns to the confirmation", ["AC-10"], [
    screen("detail"), ...toConfirm("$8,200.00"), ticked, press("Approve $8,200.00"), screen("unavailable"), text("We couldn’t reach the bank. Nothing was approved. Try again."),
    payment("PAY-2041", "status", "pending_approval"), balance(310_000), press("Try again"), screen("confirm"),
  ], { launch: launch("PAY-2041"), conditions: { unavailable: ["corp.payments.approve"] } }),
  T("T-17", "The bank does not answer when approving: Check Payments before trying again, so as not to approve twice", ["AC-10"], [
    screen("detail"), ...toConfirm("$8,200.00"), ticked, press("Approve $8,200.00"), screen("timeout"), text("Check Payments before you try again, so you don’t approve twice."), press("Check Payments"),
    payment("PAY-2041", "status", "pending_approval"), balance(310_000),
  ], { launch: launch("PAY-2041"), conditions: { timeout: ["corp.payments.approve"], latencyMs: 10_000 } }),
  T("T-18", "Wrong code three times: nothing is approved", ["AC-4", "AC-10"], [
    screen("detail"), ...toConfirm("$64,500.00"), ticked, press("Approve $64,500.00"), screen("otp"),
    ...code("111111"), press("Approve $64,500.00"), screen("otp"), press("Approve $64,500.00"), screen("otp"), press("Approve $64,500.00"), screen("locked"), text("The code didn’t work."), text("Nothing was approved."),
    payment("PAY-2039", "status", "pending_approval"), payment("PAY-2039", "approvals.1", undefined), balance(310_000),
  ], { launch: launch("PAY-2039") }),
  T("T-19", "The code cannot be sent: nothing is approved and Try again returns to the confirmation", ["AC-10"], [
    screen("detail"), ...toConfirm("$64,500.00"), ticked, press("Approve $64,500.00"), screen("unavailable"), text("Nothing was approved."), payment("PAY-2039", "approvals.1", undefined), press("Try again"), screen("confirm"),
  ], { launch: launch("PAY-2039"), conditions: { unavailable: ["bank.otp.send"] } }),
  T("T-20", "The core fails after a right code: nothing is approved and the person is told so", ["AC-10"], [
    screen("detail"), ...toConfirm("$64,500.00"), ticked, press("Approve $64,500.00"), screen("otp"), ...code(), press("Approve $64,500.00"), screen("failed"), text("We couldn’t complete this right now."), text("Nothing was approved."), balance(310_000),
  ], { launch: launch("PAY-2039"), conditions: { transferFails: true } }),
  T("T-21", "Passing is off unless the bank turns it on: no Pass to someone; with it on, PAY-2041 is passed to Lee Park, who alone can approve it now", ["AC-8"], [
    screen("detail"), noText("Pass to someone"), set({ "opt.delegation": true }), text("Pass to someone"), press("Pass to someone"), screen("pass"), text("Lee Park"), text("Sofia Reyes"), noText("Alex Morgan"),
    press("Pass on"), screen("pass"), error("ap.to"), set({ "ap.to": "lee" }), press("Pass on"), screen("passed"), text("Passed to Lee Park"), text("Lee Park can now approve this payment."), text("Passed on"),
    payment("PAY-2041", "passedTo", "lee"), payment("PAY-2041", "status", "pending_approval"), balance(310_000),
    press("Back to approvals"), press("PAY-2041"), screen("detail"), text("Passed to Lee Park."), noText("Approve $8,200.00"), noText("Pass to someone"),
    ...withCode, refused("corp.payments.approve", "DELEGATED", { paymentId: "PAY-2041" }),
  ], { launch: launch("PAY-2041") }),
  T("T-22", "A payment cannot be passed to someone who already approved it: the bank's message, and the person chooses again", ["AC-8"], [
    set({ "opt.delegation": true }), press("Pass to someone"), screen("pass"), set({ "ap.to": "lee" }), press("Pass on"), screen("pass"), text("That person already approved this payment. Choose someone else."),
    payment("PAY-2039", "passedTo", undefined), set({ "ap.to": "sofia" }), press("Pass on"), screen("passed"), text("Passed to Sofia Reyes"), payment("PAY-2039", "passedTo", "sofia"),
  ], { launch: launch("PAY-2039") }),
  T("T-23", "Approve several: with batch off there is none", ["AC-8"], [screen("inbox"), text("Approve several"), set({ "opt.batch": false }), noText("Approve several")]),
  C("T-24", "Approve several: only what can be approved together is offered; two are approved with one code and both are released", ["AC-11", "AC-4"], [
    screen("inbox"), text("Inbox (7)"), press("Approve several"), screen("many"), text("Approve several"), text("PAY-2039"), text("PAY-2041"), text("PAY-2046"),
    noText("PAY-2043"), noText("PAY-2044"), noText("PAY-2047"), noText("PAY-2048"), noText("Approve 2"), text("Tick the payments to approve."),
    set({ "ap.picked": ["PAY-2041", "PAY-2039"] }), text("Approve 2"), press("Approve 2"), screen("many"), error("ap.ack"), payment("PAY-2041", "status", "pending_approval"),
    ticked, press("Approve 2"), screen("otpMany"), text("Approve 2 payments"), text("One code covers them all."), payment("PAY-2039", "approvals.1", undefined), balance(310_000),
    ...code(), press("Approve 2"), screen("manyDone"), text("2 payments approved"), text("$72,700.00 in total."), text("Sent to the bank"), text("2 of 2"),
    payment("PAY-2041", "status", "released"), payment("PAY-2039", "status", "released"), balance(237_300), released(72_700),
    press("Back to approvals"), screen("inbox"), text("Inbox (5)"),
  ]),
  C("T-25", "Approve several, small ones only: no code is asked", ["AC-11", "AC-4"], [
    press("Approve several"), set({ "ap.picked": ["PAY-2041"], "ap.ack": true }), press("Approve 1"), screen("manyDone"), noText("Code sent"), text("1 payment approved"), payment("PAY-2041", "status", "released"), balance(301_800),
  ]),
  C("T-26", "Approve several: one that needs a second approver is approved but not released; the result says some wait", ["AC-11", "AC-6"], [
    press("Approve several"), set({ "ap.picked": ["PAY-2041", "PAY-2046"], "ap.ack": true }), press("Approve 2"), screen("otpMany"), ...code(), press("Approve 2"), screen("manyDone"),
    text("2 payments approved"), text("Some wait for another approver"), text("1 of 2"), payment("PAY-2041", "status", "released"), payment("PAY-2046", "status", "pending_approval"), payment("PAY-2046", "approvals.0.userId", "alex"), balance(301_800),
  ]),
  C("T-27", "Approving several is all or none: one that cannot be approved by Alex, or has a name to check, is refused by the bank and nothing is approved", ["AC-11", "AC-5", "AC-2", "AC-3"], [
    press("Approve several"), set({ "ap.picked": ["PAY-2041", "PAY-2044"], "ap.ack": true }), press("Approve 2"), screen("problem"), text("You started this payment, so another approver must approve it."), text("Nothing was approved."), payment("PAY-2041", "status", "pending_approval"),
    press("Back to approvals"), press("Approve several"), set({ "ap.picked": ["PAY-2041", "PAY-2043"], "ap.ack": true }), press("Approve 2"), screen("problem"), text("A payment with a name check to confirm is approved on its own."), payment("PAY-2041", "status", "pending_approval"),
    press("Back to approvals"), press("Approve several"), set({ "ap.picked": ["PAY-2041", "PAY-2047"], "ap.ack": true }), press("Approve 2"), screen("problem"), text("Another approver goes first."), payment("PAY-2041", "status", "pending_approval"), balance(310_000), released(0),
  ]),
  C("T-28", "Opened with several payments ticked (launch.paymentIds): Approve several shows them ticked", ["AC-11"], [
    screen("many"), text("Approve 2"), set({ "ap.ack": true }), press("Approve 2"), screen("otpMany"), ...code(), press("Approve 2"), screen("manyDone"), text("2 payments approved"),
  ], { launch: { "launch.paymentIds": ["PAY-2041", "PAY-2039"] } }),
  C("T-29", "Approve several: the bank asks for the code and it is wrong three times: nothing is approved", ["AC-11", "AC-10"], [
    press("Approve several"), set({ "ap.picked": ["PAY-2039"], "ap.ack": true }), press("Approve 1"), screen("otpMany"),
    ...code("111111"), press("Approve 1"), screen("otpMany"), press("Approve 1"), screen("otpMany"), press("Approve 1"), screen("locked"), payment("PAY-2039", "approvals.1", undefined), balance(310_000),
  ]),
  C("T-30", "The bank is unavailable when approving several: nothing is approved, and Try again returns to the choice", ["AC-10"], [
    press("Approve several"), set({ "ap.picked": ["PAY-2041"], "ap.ack": true }), press("Approve 1"), screen("unavailable"), payment("PAY-2041", "status", "pending_approval"), press("Try again"), screen("many"),
  ], { conditions: { unavailable: ["corp.payments.approveMany"] } }),
  C("T-31", "The bank does not answer when approving several: Check Payments first", ["AC-10"], [
    press("Approve several"), set({ "ap.picked": ["PAY-2041"], "ap.ack": true }), press("Approve 1"), screen("timeout"), text("so you don’t approve twice"), payment("PAY-2041", "status", "pending_approval"),
  ], { conditions: { timeout: ["corp.payments.approveMany"], latencyMs: 10_000 } }),
  C("T-32", "The code for several cannot be sent: nothing is approved and Try again returns to the choice", ["AC-10"], [
    press("Approve several"), set({ "ap.picked": ["PAY-2039"], "ap.ack": true }), press("Approve 1"), screen("unavailable"), payment("PAY-2039", "approvals.1", undefined), press("Try again"), screen("many"),
  ], { conditions: { unavailable: ["bank.otp.send"] } }),
  C("T-33", "The history lists what is over and opens it: a rejection with its reason, a payment that was paid; neither can be approved", ["AC-12"], [
    press("History"), screen("history"), text("PAY-2036"), text("Rejected"), text("PAY-2012"), text("Sent to the bank"), text("$3,400.00"), noText("PAY-2041"),
    press("PAY-2036"), screen("detail"), text("Wrong amount"), text("This payment is no longer waiting for approval."), noText("Approve $4,300.00"), noText("Approvals"),
    press("Back"), screen("inbox"), press("History"), press("PAY-2012"), screen("detail"), text("Sent to the bank"), text("This payment is no longer waiting for approval."),
    press("Back"), press("History"), press("Inbox (7)"), screen("inbox"),
  ]),
  T("T-34", "With nothing waiting: All caught up; with no history yet: No history yet", ["AC-12"], [
    screen("inbox"), text("All caught up"), text("No payments are waiting for approval."), noText("Approve several"), press("History"), screen("history"), text("No history yet"), text("Payments you approve or reject are listed here."),
  ], { conditions: { empty: ["corp.payments.list"] } }),
  T("T-35", "A payment that is gone: \"This payment has already been handled.\"; one that was paid says it is no longer waiting", ["AC-12"], [
    screen("gone"), text("This payment has already been handled."), press("Go to approvals"), screen("inbox"),
  ], { launch: launch("PAY-9999") }),
  T("T-36", "A payment that was rejected by someone else after the list was shown: the approval is refused and says it is no longer waiting", ["AC-12", "AC-10"], [
    screen("detail"), ...toConfirm("$8,200.00"), ticked,
    { expectBank: { adapter: "corp.payments.reject", input: { paymentId: "PAY-2041", reason: "Wrong amount" }, path: "status", equals: "rejected" } },
    press("Approve $8,200.00"), screen("problem"), text("This payment is no longer waiting for approval."), text("Nothing was approved."), press("Back to approvals"), screen("inbox"), noText("PAY-2041"),
  ], { launch: launch("PAY-2041") }),
  T("T-37", "The inbox cannot be read: the sheet, and Try again asks again; the payment cannot be read: back to the inbox", ["AC-10"], [
    screen("unavailable"), text("We couldn’t reach the bank"), press("Try again"), screen("unavailable"),
  ], { conditions: { unavailable: ["corp.payments.list"] } }),
  T("T-38", "One payment cannot be read: nothing was approved, and Try again returns to the inbox", ["AC-10"], [
    screen("inbox"), press("PAY-2041"), screen("slow"), text("This is taking longer than expected. Nothing was approved."), press("Try again"), screen("inbox"),
  ], { conditions: { timeout: ["corp.payments.get"], latencyMs: 10_000 } }),
  T("T-39", "The company cannot be read: the sheet, and Try again asks again", ["AC-10"], [screen("unavailable"), press("Try again"), screen("unavailable")], { conditions: { unavailable: ["corp.company.get"] } }),
  T("T-48", "The code sheet needs all six digits before it checks anything, for one payment and for several", ["AC-4", "AC-11"], [
    screen("detail"), ...toConfirm("$64,500.00"), ticked, press("Approve $64,500.00"), screen("otp"), press("Approve $64,500.00"), screen("otp"), error("otp.code"), ...code("12"), press("Approve $64,500.00"), screen("otp"), error("otp.code"),
    payment("PAY-2039", "approvals.1", undefined), balance(310_000),
  ], { launch: launch("PAY-2039") }),
  C("T-49", "The code sheet for several needs all six digits too", ["AC-11"], [
    press("Approve several"), set({ "ap.picked": ["PAY-2039"], "ap.ack": true }), press("Approve 1"), screen("otpMany"), press("Approve 1"), screen("otpMany"), error("otp.code"), ...code("12"), press("Approve 1"), screen("otpMany"), error("otp.code"),
    payment("PAY-2039", "approvals.1", undefined), balance(310_000),
  ]),
  C("T-50", "The core fails after the right code for several: nothing is approved and the person is told so", ["AC-11", "AC-10"], [
    press("Approve several"), set({ "ap.picked": ["PAY-2039"], "ap.ack": true }), press("Approve 1"), screen("otpMany"), ...code(), press("Approve 1"), screen("failed"), text("We couldn’t complete this right now."), text("Nothing was approved."),
    payment("PAY-2039", "approvals.1", undefined), balance(310_000),
  ], { conditions: { transferFails: true } }),
  T("T-41", "Rejecting when the bank is unavailable or does not answer approves nothing; passing the same", ["AC-10"], [
    screen("detail"), press("Reject"), set({ "ap.reason": "Duplicate" }), press("Reject payment"), screen("unavailable"), payment("PAY-2041", "status", "pending_approval"), press("Try again"), screen("reject"),
  ], { launch: launch("PAY-2041"), conditions: { unavailable: ["corp.payments.reject"] } }),
  T("T-42", "Rejecting when the bank does not answer: Check Payments first", ["AC-10"], [
    screen("detail"), press("Reject"), set({ "ap.reason": "Duplicate" }), press("Reject payment"), screen("timeout"), payment("PAY-2041", "status", "pending_approval"),
  ], { launch: launch("PAY-2041"), conditions: { timeout: ["corp.payments.reject"], latencyMs: 10_000 } }),
  T("T-43", "Passing a payment when the bank is unavailable changes nothing, and Try again returns to the choice", ["AC-10", "AC-8"], [
    set({ "opt.delegation": true }), press("Pass to someone"), set({ "ap.to": "lee" }), press("Pass on"), screen("unavailable"), payment("PAY-2041", "passedTo", undefined), press("Try again"), screen("pass"),
  ], { launch: launch("PAY-2041"), conditions: { unavailable: ["corp.payments.delegate"] } }),
  T("T-44", "Passing a payment when the bank does not answer: Check Payments first", ["AC-10", "AC-8"], [
    set({ "opt.delegation": true }), press("Pass to someone"), set({ "ap.to": "lee" }), press("Pass on"), screen("timeout"), payment("PAY-2041", "passedTo", undefined),
  ], { launch: launch("PAY-2041"), conditions: { timeout: ["corp.payments.delegate"], latencyMs: 10_000 } }),
  T("T-45", "Alex's own waiting payments cannot be read on the no-access card: the card still shows", ["AC-1"], [
    screen("denied"), text("You don’t have access to the approvals inbox"), noText("Your requests waiting for approval"),
  ], { context: "alpha", conditions: { unavailable: ["corp.payments.pending"] } }),
  T("T-46", "Forced approvals the bank refuses even for a payment Alex may approve: a payment already released, and a payment that does not exist", ["AC-2", "AC-12"], [
    screen("detail"), ...toConfirm("$8,200.00"), ticked, press("Approve $8,200.00"), screen("approved"),
    refused("corp.payments.approve", "PAYMENT_NOT_PENDING", { paymentId: "PAY-2041" }), refused("corp.payments.approve", "PAYMENT_NOT_FOUND", { paymentId: "PAY-0000" }), refused("corp.payments.reject", "PAYMENT_NOT_PENDING", { paymentId: "PAY-2041", reason: "Wrong amount" }),
    balance(301_800),
  ], { launch: launch("PAY-2041") }),
  T("T-47", "Back from the details and Cancel from the confirmation return without approving anything", ["AC-4"], [
    screen("detail"), ...toConfirm("$8,200.00"), press("Cancel"), screen("detail"), press("Back"), screen("inbox"), payment("PAY-2041", "status", "pending_approval"), balance(310_000),
  ], { launch: launch("PAY-2041") }),
];

const arrange = (payment: Record<string, unknown>) => ({ adapter: "corp.sandbox.arrange", input: { op: "payment", payment } });
const pay = (id: string, extra: Record<string, unknown>) => ({ id, companyId: "beta", fromAccountId: "beta_ops", beneficiaryId: "nimb", amount: 1000, currency: "USD", reference: "X", status: "pending_approval", initiatedBy: "priya", initiatedAt: "2026-11-03T09:00:00Z", valueDate: "2026-11-03", afterCutoff: false, required: 1, approvals: [], ...extra });
const BATCH = pay("PAY-7200", { beneficiaryId: "bulk", amount: 7_200, reference: "Supplier batch 7", lines: [{ n: 1, beneficiaryId: "nimb", amount: 4_200, reference: "INV-2330" }, { n: 2, beneficiaryId: "rhine", amount: 3_000, reference: "INV-2332" }] });
const RUN = pay("PAY-7201", { beneficiaryId: "payroll", amount: 9_000, reference: "Payroll 2026-11", period: "2026-11", lines: [{ n: 1, beneficiaryId: "emp_1", amount: 4_500, reference: "Payroll 2026-11" }, { n: 2, beneficiaryId: "emp_2", amount: 4_500, reference: "Payroll 2026-11" }] });
const picked = (...ids: string[]) => set({ "ap.picked": ids });

export const approvePaymentsScenariosB: NonNullable<Journey["scenarios"]> = [
  T("T-51", "stepUp off: PAY-2039 (64,500.00) is approved with no code, and the details do not say a code will be asked", ["AC-13"], [
    screen("detail"), noText("You’ll be asked for a code."), ...toConfirm("$64,500.00"), ticked, press("Approve $64,500.00"), screen("approved"), noText("Code sent"), text("Sent to the bank"), payment("PAY-2039", "status", "released"), balance(245_500),
  ], { launch: { ...launch("PAY-2039"), "opt.stepUp": false } }),
  T("T-52", "stepUp on (the default): the same payment asks for a code, and the bank refuses it without one", ["AC-13", "AC-4"], [
    screen("detail"), text("You’ll be asked for a code."), ...toConfirm("$64,500.00"), ticked, press("Approve $64,500.00"), screen("otp"), refused("corp.payments.approve", "OTP_REQUIRED", { paymentId: "PAY-2039", acknowledged: true }), payment("PAY-2039", "status", "pending_approval"), balance(310_000),
  ], { launch: launch("PAY-2039") }),
  C("T-53", "stepUp off for several: PAY-2041 and PAY-2039 are approved together with no code", ["AC-13", "AC-11"], [
    screen("inbox"), press("Approve several"), screen("many"), picked("PAY-2041", "PAY-2039"), set({ "ap.ack": true }), press("Approve 2"), screen("manyDone"), noText("Code sent"), text("2 payments approved"), payment("PAY-2039", "status", "released"), payment("PAY-2041", "status", "released"),
  ], { launch: { "opt.stepUp": false } }),
  C("T-54", "Reject several: two payments, no reason first (Choose a reason.), then Wrong payee: both rejected with one reference, and nothing was sent", ["AC-14", "AC-16"], [
    screen("inbox"), press("Reject several"), screen("rejectMany"), text("Reject several"), picked("PAY-2041", "PAY-2046"), press("Reject 2"), screen("rejectMany"), text("Choose a reason."),
    set({ "ap.reason": "Wrong payee" }), press("Reject 2"), screen("manyRejected"), text("2 payments rejected"), text("$64,200.00 in total. Nothing was sent."), text("Wrong payee"), text("APR-20261103-0001"),
    payment("PAY-2041", "status", "rejected"), payment("PAY-2046", "status", "rejected"), payment("PAY-2041", "rejectReason", "Wrong payee"), balance(310_000), released(0), press("Back to approvals"), screen("inbox"), noText("PAY-2041"),
  ]),
  C("T-55", "Reject several with Other needs a note of at least 10 characters", ["AC-14"], [
    screen("inbox"), press("Reject several"), picked("PAY-2041", "PAY-2046"), set({ "ap.reason": "Other", "ap.note": "short" }), press("Reject 2"), screen("rejectMany"), error("ap.note"), payment("PAY-2041", "status", "pending_approval"),
    set({ "ap.note": "Duplicate of an invoice we paid" }), press("Reject 2"), screen("manyRejected"), payment("PAY-2046", "rejectReason", "Duplicate of an invoice we paid"),
  ]),
  C("T-56", "Opened in reject mode with payments (the inbox's Reject {n}): they are ticked, and Alex's own payment stops the whole group", ["AC-14"], [
    screen("rejectMany"), text("Reject 2"), set({ "ap.reason": "Duplicate" }), press("Reject 2"), screen("manyRejected"), payment("PAY-2041", "status", "rejected"), payment("PAY-2043", "status", "rejected"),
    refused("corp.payments.rejectMany", "NOT_AUTHORISED", { paymentIds: ["PAY-2039", "PAY-2044"], reason: "Duplicate" }), payment("PAY-2039", "status", "pending_approval"),
  ], { launch: { "launch.mode": "reject", "launch.paymentIds": ["PAY-2041", "PAY-2043"] } }),
  C("T-57", "The bank refuses a rejection with no reason or a short note, a group with nothing in it, a payment no longer waiting, and a Maker", ["AC-14", "AC-7"], [
    screen("inbox"), refused("corp.payments.reject", "REASON_REQUIRED", { paymentId: "PAY-2041", reason: "" }), refused("corp.payments.reject", "REASON_REQUIRED", { paymentId: "PAY-2041", reason: "too short" }),
    refused("corp.payments.rejectMany", "REASON_REQUIRED", { paymentIds: ["PAY-2041"], reason: "" }), refused("corp.payments.rejectMany", "EMPTY_BATCH", { paymentIds: [], reason: "Duplicate" }),
    refused("corp.payments.rejectMany", "PAYMENT_NOT_FOUND", { paymentIds: ["PAY-0000"], reason: "Duplicate" }), payment("PAY-2041", "status", "pending_approval"),
    { expectBank: { adapter: "corp.payments.reject", input: { paymentId: "PAY-2041", reason: "Wrong amount" }, path: "status", equals: "rejected" } },
    refused("corp.payments.rejectMany", "PAYMENT_NOT_PENDING", { paymentIds: ["PAY-2041", "PAY-2043"], reason: "Duplicate" }), payment("PAY-2043", "status", "pending_approval"),
  ]),
  T("T-58", "A Maker cannot reject several: the bank refuses it", ["AC-14", "AC-1"], [screen("denied"), refused("corp.payments.rejectMany", "PERMISSION_DENIED", { paymentIds: ["PAY-2040"], reason: "Duplicate" })], { context: "alpha" }),
  T("T-59", "The details of PAY-2039 name the order (Lee Park, then Alex Morgan) and show when Lee Park approved", ["AC-15"], [
    screen("detail"), text("In this order: Lee Park, then Alex Morgan."), text("Lee Park"), text("Approved"), text("2 Nov 17:40"), text("Next"),
  ], { launch: launch("PAY-2039") }),
  C("T-60", "PAY-2046 needs two approvers in any order: the details say so, and nobody has approved yet", ["AC-15"], [
    screen("detail"), text("Any 2 approvers, in any order."), text("Can approve"), noText("In this order"), text("0 of 2 approved"),
  ], { launch: launch("PAY-2046") }),
  T("T-61", "Approving ends with an APR reference, besides the release reference of the payment", ["AC-16"], [
    screen("detail"), ...toConfirm("$8,200.00"), ticked, press("Approve $8,200.00"), screen("approved"), text("APR-20261103-0001"), text("CORP-20261103-2041"),
  ], { launch: launch("PAY-2041") }),
  C("T-62", "Rejecting ends with an APR reference", ["AC-16", "AC-7"], [
    screen("detail"), press("Reject"), screen("reject"), set({ "ap.reason": "Wrong amount" }), press("Reject payment"), screen("rejected"), text("APR-20261103-0001"),
  ], { launch: launch("PAY-2048") }),
  C("T-63", "Passing on ends with an APR reference", ["AC-16", "AC-8"], [
    screen("detail"), press("Pass to someone"), set({ "ap.to": "lee" }), press("Pass on"), screen("passed"), text("APR-20261103-0001"),
  ], { launch: { ...launch("PAY-2041"), "opt.delegation": true } }),
  C("T-64", "Approving several ends with one APR reference", ["AC-16", "AC-11"], [
    screen("inbox"), press("Approve several"), picked("PAY-2041", "PAY-2046"), set({ "ap.ack": true }), press("Approve 2"), screen("otpMany"), ...code(), press("Approve 2"), screen("manyDone"), text("APR-20261103-0001"),
  ]),
  C("T-65", "A batch shows its payments under its details: who is paid how much and the reference, and no account number", ["AC-17"], [
    screen("detail"), text("2 payments"), text("Supplier batch 7"), text("Nimbus Logistics"), text("$4,200.00"), text("INV-2330"), text("Rhine Freight GmbH"), text("$3,000.00"), noText("5521"), noText("021000021"),
  ], { launch: launch("PAY-7200"), setup: [arrange(BATCH)] }),
  C("T-66", "A payroll run shows how many employees it pays under its details, and a payment with no lines shows no table", ["AC-17"], [
    screen("detail"), text("2 employees"), text("Payroll 2026-11"), text("$4,500.00"),
  ], { launch: launch("PAY-7201"), setup: [arrange(RUN)] }),
  C("T-67", "A single payment shows no batch table", ["AC-17"], [screen("detail"), noText("Payments in this batch"), noText("employees")], { launch: launch("PAY-2041") }),
  C("T-68", "Reject several when the bank is unavailable: nothing is rejected, and Try again returns to the list", ["AC-14", "AC-10"], [
    screen("inbox"), press("Reject several"), picked("PAY-2041", "PAY-2046"), set({ "ap.reason": "Duplicate" }), press("Reject 2"), screen("unavailable"), payment("PAY-2041", "status", "pending_approval"), payment("PAY-2046", "status", "pending_approval"), press("Try again"), screen("rejectMany"),
  ], { conditions: { unavailable: ["corp.payments.rejectMany"] } }),
  C("T-69", "Reject several when the bank does not answer: Check Payments first", ["AC-14", "AC-10"], [
    screen("inbox"), press("Reject several"), picked("PAY-2041", "PAY-2046"), set({ "ap.reason": "Duplicate" }), press("Reject 2"), screen("timeout"), text("Check Payments before you try again, so you don’t approve twice."),
  ], { conditions: { timeout: ["corp.payments.rejectMany"], latencyMs: 10_000 } }),
  C("T-70", "A payment that was rejected by someone else while the group was ticked stops the whole group: none is rejected and the screen says why", ["AC-14"], [
    screen("inbox"), press("Reject several"), picked("PAY-2041", "PAY-2043"), set({ "ap.reason": "Duplicate" }),
    { expectBank: { adapter: "corp.payments.reject", input: { paymentId: "PAY-2043", reason: "Wrong amount" }, path: "status", equals: "rejected" } },
    press("Reject 2"), screen("rejectMany"), text("This payment is already rejected"), payment("PAY-2041", "status", "pending_approval"),
  ]),
];
