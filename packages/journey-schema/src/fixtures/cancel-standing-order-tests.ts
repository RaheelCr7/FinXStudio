import type { Journey } from "../schema";

/**
 * What must be true for "Cancel a standing order" to be right (AC-7 and T-8 of the spec of schedule-payment, which this journey is the cancel mode of).
 * Each is proved by at least one scenario below.
 */
export const cancelStandingOrderAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "Cancelling a payment asks for no code, ends the schedule for good (\"Payment cancelled\", with the payee, amount, how often and the date) and takes no money; a cancelled schedule is archived, so it is no longer offered and no later payment goes." },
  { id: "AC-2", text: "With allowSkip on, a payment that repeats and has more than one payment left offers \"All future payments\" and \"Only the next payment\"; skipping gives \"Next payment skipped\", moves the next date to the following payment, and the skipped payment does not go." },
  { id: "AC-3", text: "The scope choice is not offered with allowSkip off, for a payment that happens once, or when only one payment is left: cancelling then always ends the schedule." },
  { id: "AC-4", text: "A payment that is being processed, whose changes have closed (18:00, or 09:00 with strictCutoff), that has ended or that is gone is refused with the bank's message, nothing is changed, and Back to scheduled leaves." },
  { id: "AC-5", text: "A paused payment can be cancelled; with nothing scheduled the person is told so." },
  { id: "AC-6", text: "On timeout or when the bank is unavailable nothing is cancelled and the person is told so; a slow or unavailable service met on the way can be tried again." },
];

// The sandbox customer "alexsched" has eight schedules, SCH-1001 to SCH-1008, and SCH-0900 that ended (see schedule-payment). Today is Tuesday 3 November 2026, 10:42 UTC.
const PERSONA = "alexsched";
const NOW = "2026-11-03T10:42:00Z";
type Step = Record<string, unknown>;
const set = (v: Record<string, unknown>): Step => ({ set: v });
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const balance = (account: string, equals: number): Step => ({ expectBank: { adapter: "bank.accounts.list", path: `${account}.balance`, equals } });
const unchanged: Step[] = [balance("acc_main", 8720.76), balance("acc_save", 15254.37), balance("acc_eur", 2400), balance("acc_aed", 11000)];
const sched = (id: string, field: string, equals: unknown): Step => ({ expectBank: { adapter: "bank.schedules.get", input: { scheduleId: id }, path: field, equals } });
/** The scheduler runs to a date, and one payment it made is read back (undefined: there was none). */
const runs = (date: string, id: string, field: string, equals: unknown): Step => ({ expectBank: { adapter: "bank.schedules.runDue", input: { date }, path: `${id}.${field}`, equals } });
/** The bank changes a schedule behind the person's back (another device, the scheduler), after the list was shown. */
const meanwhile = (adapter: string, input: Record<string, unknown>, path: string, equals: unknown): Step => ({ expectBank: { adapter, input, path, equals } });

const base = { persona: PERSONA, now: NOW };
type Setup = NonNullable<NonNullable<Journey["scenarios"]>[number]["setup"]>;
/** Skips the next payment of a schedule n times, so that fewer are left. */
const skips = (id: string, n: number): Setup => Array.from({ length: n }).map(() => ({ adapter: "bank.schedules.cancel", input: { scheduleId: id, scope: "next" } }));
const T = (id: string, name: string, covers: string[], steps: Step[], extra: Record<string, unknown> = {}): NonNullable<Journey["scenarios"]>[number] => ({ id, name, covers, ...base, ...extra, steps } as any);

export const cancelStandingOrderScenarios: NonNullable<Journey["scenarios"]> = [
  T("T-1", "Cancelling SCH-1005 for good: no code, Payment cancelled with its rows, the schedule archived, no money taken, and no later payment goes", ["AC-1"], [
    screen("pick"), text("Which payment do you want to cancel?"), text("Rent"), text("Savings top-up"), text("Lena Fischer"), text("Monthly · Mon 16 Nov · $200.00"), noText("Old gym"),
    press("Lena Fischer"), screen("cancel"), text("Cancel this payment?"), text("Lena Fischer"), text("$200.00"), text("Monthly"), text("Mon 16 Nov 2026"), text("After 12 payments"),
    press("Cancel payment"), screen("success"), text("Payment cancelled"), text("No more payments will go to Lena Fischer."), text("Cancelled"), text("Cancelled on"), text("Tue 3 Nov 2026"),
    sched("SCH-1005", "status", "cancelled"), sched("SCH-1005", "endedOn", "2026-11-03"), ...unchanged,
    runs("2026-12-16", "SCH-1005-2026-11-16", "status", undefined),
    press("Cancel another"), screen("pick"), text("Rent"), noText("Lena Fischer"),
  ]),
  T("T-2", "Only the next payment: both choices are offered, the skip gives Next payment skipped, the next date moves and the skipped payment does not go", ["AC-2"], [
    press("Lena Fischer"), screen("cancel"), text("What should happen?"), text("All future payments"), text("Only the next payment"),
    set({ "sc.scope": "next" }), press("Cancel payment"), screen("success"), text("Next payment skipped"), text("The Mon 16 Nov 2026 payment to Lena Fischer won’t go."), text("Skipped"), text("Wed 16 Dec 2026"),
    sched("SCH-1005", "status", "active"), sched("SCH-1005", "nextRunOn", "2026-12-16"), sched("SCH-1005", "remainingRuns", 6), ...unchanged,
    runs("2026-11-20", "SCH-1005-2026-11-16", "status", undefined),
    runs("2026-12-16", "SCH-1005-2026-12-16", "status", "paid"),
  ]),
  T("T-3", "All future payments chosen on purpose ends the schedule even though skipping was on offer", ["AC-1", "AC-2"], [
    press("Lena Fischer"), set({ "sc.scope": "all" }), press("Cancel payment"), screen("success"), text("Payment cancelled"), sched("SCH-1005", "status", "cancelled"),
  ]),
  T("T-4", "With allowSkip off there is no choice and cancelling ends the schedule, even if a skip was left in the data", ["AC-3"], [
    set({ "opt.allowSkip": false }), press("Lena Fischer"), screen("cancel"), noText("Only the next payment"), noText("What should happen?"),
    set({ "sc.scope": "next" }), press("Cancel payment"), screen("success"), text("Payment cancelled"), sched("SCH-1005", "status", "cancelled"),
  ]),
  T("T-5", "A payment that happens once has no choice", ["AC-3"], [
    press("Maya Chen"), screen("cancel"), text("Once"), noText("Only the next payment"), set({ "sc.scope": "next" }), press("Cancel payment"), screen("success"), text("Payment cancelled"), sched("SCH-1006", "status", "cancelled"),
  ]),
  T("T-6", "With one payment left there is no choice: cancelling ends it", ["AC-3"], [
    press("Lena Fischer"), screen("cancel"), noText("Only the next payment"), text("Mon 17 May 2027"), set({ "sc.scope": "next" }), press("Cancel payment"), screen("success"), text("Payment cancelled"),
  ], { setup: skips("SCH-1005", 6) }),
  T("T-7", "A payment that is being processed today cannot be cancelled: the bank's message, nothing changed", ["AC-4"], [
    press("Peak Fitness"), screen("problem"), text("This payment is being processed. Try again later."), text("Nothing was changed."), sched("SCH-1004", "status", "active"),
    press("Choose another"), screen("pick"),
  ]),
  T("T-8", "Changes close at 18:00 the business day before: a payment due tomorrow can be cancelled at 10:42 and not at 18:00; with strictCutoff on it closed at 09:00", ["AC-4"], [
    set({ "opt.strictCutoff": true }), press("Harbor Insurance"), screen("problem"), text("This payment can’t be changed any more. Change it after it runs."), text("Nothing was changed."), sched("SCH-1003", "status", "active"),
  ]),
  T("T-9", "Without strictCutoff the payment due tomorrow can be cancelled until 18:00", ["AC-4"], [
    press("Harbor Insurance"), screen("cancel"), press("Cancel payment"), screen("success"), text("Payment cancelled"), sched("SCH-1003", "status", "cancelled"),
  ]),
  T("T-10", "After 18:00 the payment due tomorrow is closed", ["AC-4"], [
    press("Harbor Insurance"), screen("problem"), text("This payment can’t be changed any more. Change it after it runs."), press("Back to scheduled"),
  ], { now: "2026-11-03T18:00:00Z" }),
  T("T-11", "A payment that was cancelled elsewhere after the list was shown is refused as already ended", ["AC-4"], [
    screen("pick"), meanwhile("bank.schedules.cancel", { scheduleId: "SCH-1001", scope: "all" }, "status", "cancelled"), press("Rent"), screen("problem"), text("This payment has already ended or been cancelled."), text("Nothing was changed."),
    press("Choose another"), screen("pick"), noText("Rent"),
  ]),
  T("T-12", "A payment that is gone after the list was shown is refused as not found", ["AC-4"], [
    screen("pick"), { expectBank: { adapter: "bank.payees.delete", input: { payeeId: "ben_maya", cancelSchedules: true }, path: "schedulesCancelled", equals: 1 } },
    press("Maya Chen"), screen("problem"), text("We can’t find that payment."), text("Nothing was changed."),
  ]),
  T("T-13", "A paused payment can be cancelled", ["AC-5"], [
    text("Omar Haddad"), text("Paused"), press("Omar Haddad"), screen("cancel"), text("Paused: the last two attempts failed."), press("Cancel payment"), screen("success"), text("Payment cancelled"), sched("SCH-1008", "status", "cancelled"),
  ]),
  T("T-14", "With nothing scheduled the person is told so", ["AC-5"], [screen("pick"), text("Nothing scheduled."), text("Set up a payment once")], { persona: "alex" }),
  T("T-15", "The bank does not answer in time when cancelling: Check scheduled first, nothing cancelled", ["AC-6"], [
    press("Lena Fischer"), press("Cancel payment"), screen("timeout"), text("We didn't get an answer in time"), text("Check your scheduled payments before you try again"), press("Check scheduled"),
    sched("SCH-1005", "status", "active"),
  ], { conditions: { timeout: ["bank.schedules.cancel"], latencyMs: 10000 } }),
  T("T-16", "The bank is unavailable when cancelling: nothing cancelled, and Try again goes back to the choice", ["AC-6"], [
    press("Lena Fischer"), press("Cancel payment"), screen("unavailable"), text("We couldn’t reach the bank. Nothing was changed."), press("Try again"), screen("cancel"), sched("SCH-1005", "status", "active"),
  ], { conditions: { unavailable: ["bank.schedules.cancel"] } }),
  T("T-17", "The list of payments cannot be loaded: standard message, and Try again asks again", ["AC-6"], [screen("unavailable"), text("Service not available"), press("Try again"), screen("unavailable")], { conditions: { unavailable: ["bank.schedules.list"] } }),
  T("T-18", "One payment cannot be read: standard message, and Try again returns to the list", ["AC-6"], [
    press("Lena Fischer"), screen("unavailable"), text("Nothing was changed."), press("Try again"), screen("pick"),
  ], { conditions: { unavailable: ["bank.schedules.get"] } }),
  T("T-19", "A slow answer when reading a payment says nothing was changed and can be tried again", ["AC-6"], [
    press("Lena Fischer"), screen("slow"), text("This is taking longer than expected."), text("Nothing was changed."), press("Try again"), screen("pick"),
  ], { conditions: { timeout: ["bank.schedules.get"], latencyMs: 10000 } }),
  T("T-20", "The choice must be there when the payment offers one: an empty choice is not read as cancelling for good", ["AC-2"], [
    press("Lena Fischer"), screen("cancel"), set({ "sc.scope": "" }), press("Cancel payment"), screen("cancel"), { expectError: "sc.scope" }, sched("SCH-1005", "status", "active"),
  ]),
];
