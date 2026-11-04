import type { Journey } from "../schema";

/**
 * What must be true for "Schedule a payment" to be right. Each is proved by at least one scenario below. AC-7 of the spec (cancelling and
 * skipping) is the journey `cancel-standing-order`. The deep links (a payee, a bill or a schedule to start from) need launch values, which the engine does not have.
 */
export const schedulePaymentAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "A new schedule can be made to a payee, between own accounts (allowOwn) or for a saved bill (allowBills); a choice the bank switched off is not offered." },
  { id: "AC-2", text: "Own accounts must differ and share a currency; a bill can be the full bill, the minimum due where the biller has one, or a fixed amount; with no saved biller the person is told so." },
  { id: "AC-3", text: "The first date must be a business day from tomorrow to 12 months ahead, with the bank's message for each; the review lists the next three dates; a payment on a Saturday or Sunday moves to Monday and a month with fewer days uses its last day." },
  { id: "AC-4", text: "The end can be never, on a date from the list of payment dates after the first, or after 2 to the most payments for the frequency (104, 52, 60, 40); a single payment has no end." },
  { id: "AC-5", text: "Making a schedule asks for a code that names the amount and the payee; a wrong code takes nothing; three wrong codes stop the journey and save nothing; the right code saves the schedule once and takes no money." },
  { id: "AC-6", text: "Changing a schedule changes the amount, the next date or the end, never the payee; it is refused as running, closed (18:00, or 09:00 with strictCutoff) or not active with the bank's messages; a paused schedule is resumed by choosing a new date." },
  { id: "AC-8", text: "A 21st active schedule is refused; an amount over the daily limit is refused; an account that cannot send, or the same account twice, is refused by the bank even if the screen is bypassed." },
  { id: "AC-9", text: "The reminder row shows on the review only when the reminder is on." },
  { id: "AC-10", text: "On timeout, when the bank is unavailable or when the core fails, nothing is saved or changed and the person is told so; a slow or unavailable service met on the way can be tried again." },
  { id: "AC-11", text: "The first payment to a payee added in the last 24 hours must be on or after the end of those 24 hours; an older payee is not held." },
  { id: "AC-12", text: "Nothing is taken when the schedule is made; on its date the bank takes the payment and moves the next date on. A payment short of money is skipped and, after two in a row, the schedule is paused; with insufficientFundsPolicy on it is tried once more the next business day. A closed day moves a payment to the next business day." },
];

// The sandbox customer "alexsched" has Main $8,720.76, Savings $15,254.37, EUR Travel €2,400.00 and AED Home AED 11,000.00, a daily limit of $50,000.00, ten saved
// payees (Casey Nguyen was added 3 hours ago), three saved billers (Harbor Insurance, Northwind Card, Home electricity) and eight schedules, SCH-1001 to SCH-1008, and
// SCH-0900 that ended. Today is Tuesday 3 November 2026, 10:42 UTC.
const PERSONA = "alexsched";
const NOW = "2026-11-03T10:42:00Z";
type Step = Record<string, unknown>;
const set = (v: Record<string, unknown>): Step => ({ set: v });
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const error = (e: string): Step => ({ expectError: e });
const toast = (t: string): Step => ({ expectToast: t });
const balance = (account: string, equals: number): Step => ({ expectBank: { adapter: "bank.accounts.list", path: `${account}.balance`, equals } });
const unchanged: Step[] = [balance("acc_main", 8720.76), balance("acc_save", 15254.37), balance("acc_eur", 2400), balance("acc_aed", 11000)];
/** One field of a schedule, read from the bank. */
const sched = (id: string, field: string, equals: unknown): Step => ({ expectBank: { adapter: "bank.schedules.get", input: { scheduleId: id }, path: field, equals } });
/** The live list does not have this schedule (nothing was saved). */
const absent = (id: string): Step => ({ expectBank: { adapter: "bank.schedules.list", input: { status: "live" }, path: id, equals: undefined } });
/** The scheduler runs to a date, and one payment it made or skipped is read back. */
const runs = (date: string, id: string, field: string, equals: unknown): Step => ({ expectBank: { adapter: "bank.schedules.runDue", input: { date }, path: `${id}.${field}`, equals } });

/** A new payment, from the first screen to the choice of who. */
const startNew = (kind: "To a payee" | "Between my accounts" | "A saved bill"): Step[] => [press("New scheduled payment"), press(kind), screen("who")];
/** The payee chosen, the amount typed, up to the date screen. */
const payTo = (who: string, amount = 100): Step[] => [...startNew("To a payee"), press(who), screen("how"), set({ "sp.amount": amount }), press("Continue"), screen("when")];
/** The date typed (the frequency stays Monthly unless given), up to the end screen. */
const on = (first: string, freq?: string): Step[] => [set({ "sp.first": first, ...(freq ? { "sp.freq": freq } : {}) }), press("Continue"), screen("end")];
/** From the end screen to the review (the bank checks everything on the way). */
const review: Step[] = [press("Review"), screen("review")];
/** A monthly payment of $100.00 to Maya Chen from Friday 6 November, up to the review. */
const maya = (first = "2026-11-06"): Step[] => [...payTo("Maya Chen"), ...on(first), ...review];
const confirm: Step[] = [set({ "sp.consent": true }), press("Confirm and send code")];
const code = (c = "482100"): Step[] => [set({ "otp.code": c })];
/** The whole schedule, from the review to the receipt. */
const make: Step[] = [...confirm, screen("otp"), ...code(), press("Schedule payment"), screen("success")];
/** A change, from the review to the receipt. */
const save: Step[] = [...confirm, screen("otp"), ...code(), press("Save changes"), screen("success")];
/** A change to a schedule, from the first screen to the screen of its amount. */
const change = (name: string): Step[] => [press("Change a payment"), screen("pick"), press(name), screen("load"), press("Continue"), screen("how")];

const base = { persona: PERSONA, now: NOW };
type Setup = NonNullable<NonNullable<Journey["scenarios"]>[number]["setup"]>;
const withCode: Setup = [{ adapter: "bank.otp.send" }, { adapter: "bank.otp.verify", input: { code: "482100" } }];
/** n more schedules, so that the person has 8 + n. */
const more = (n: number): Setup => Array.from({ length: n }).flatMap(() => [...withCode, { adapter: "bank.schedules.create", input: { kind: "payee", target: "ben_maya", from: "acc_main", amount: 10, frequency: "monthly", first: "2026-11-20" } }]);
/** Main drained to the given balance before the walk. */
const drain = (left: number): Setup => [...withCode, { adapter: "bank.transfers.own", input: { fromAccountId: "acc_main", toAccountId: "acc_save", amount: Math.round((8720.76 - left) * 100) / 100 } }];
const T = (id: string, name: string, covers: string[], steps: Step[], extra: Record<string, unknown> = {}): NonNullable<Journey["scenarios"]>[number] => ({ id, name, covers, ...base, ...extra, steps } as any);

export const schedulePaymentScenarios: NonNullable<Journey["scenarios"]> = [
  T("T-1", "With allowOwn and allowBills off only To a payee is offered", ["AC-1"], [
    set({ "opt.allowOwn": false, "opt.allowBills": false }), press("New scheduled payment"), screen("what"), text("To a payee"), noText("Between my accounts"), noText("A saved bill"),
  ]),
  T("T-2", "All three kinds are offered by default, and a payee is chosen with its bank and the last four digits", ["AC-1"], [
    press("New scheduled payment"), text("To a payee"), text("Between my accounts"), text("A saved bill"),
    press("To a payee"), screen("who"), text("Maya Chen"), text("Northwind Bank ••4417"), text("Harbor Estates"), press("Maya Chen"), screen("how"), text("Maya Chen"), text("Main"), text("Savings"),
  ]),
  T("T-3", "Between my accounts: Main to Savings is accepted; the same account twice and an account in another currency are refused with the bank's words", ["AC-2"], [
    ...startNew("Between my accounts"), text("Main ••4410"), text("Savings ••7731"), text("EUR Travel ••5502"), press("Savings ••7731"), screen("how"), set({ "sp.amount": 50 }), press("Continue"), screen("when"),
    press("Back"), press("Back"), press("Main ••4410"), set({ "sp.amount": 50 }), press("Continue"), screen("ownProblem"), text("Choose two different accounts."), press("Choose account"), screen("how"),
    press("Back"), press("EUR Travel ••5502"), set({ "sp.amount": 50 }), press("Continue"), screen("ownProblem"), text("Choose two accounts in the same currency."), press("Choose account"), screen("how"),
    ...unchanged,
  ]),
  T("T-4", "A saved bill: Full bill and Fixed amount for Harbor Insurance; Minimum due only for a card biller; a fixed amount needs the amount, the others do not", ["AC-2"], [
    ...startNew("A saved bill"), text("Harbor Insurance"), text("Northwind Card"), text("Home electricity"), text("Harbor Insurance •••• 5678"),
    press("Harbor Insurance"), screen("how"), text("Full bill"), text("Each time it is due"), text("Fixed amount"), noText("Minimum due"), set({ "sp.amountMode": "full" }), press("Continue"), screen("when"),
    press("Back"), press("Back"), press("Northwind Card"), text("Minimum due"), set({ "sp.amountMode": "minimum" }), press("Continue"), screen("when"),
    press("Back"), set({ "sp.amountMode": "fixed", "sp.amount": null }), press("Continue"), screen("how"), error("sp.amount"),
    set({ "sp.amount": 80 }), press("Continue"), screen("when"), ...on("2026-11-06"), ...review, text("Northwind Card"), text("$80.00"),
  ]),
  T("T-5", "A customer with no saved biller is told so", ["AC-2"], [...startNew("A saved bill"), text("No saved billers"), text("Save a biller when you pay a bill, then schedule it here."), noText("Harbor Insurance")], { persona: "alexpayees" }),
  T("T-6", "A first date of today is refused with the bank's message and Change date goes back to the date", ["AC-3"], [
    ...payTo("Maya Chen"), set({ "sp.first": "2026-11-03" }), press("Continue"), screen("problem"), text("Choose a date from tomorrow."), text("Nothing was changed."), press("Change date"), screen("when"),
    ...on("2026-11-04"), ...review, text("Wed 4 Nov 2026"),
  ]),
  T("T-7", "A Saturday is refused, a date 13 months out is refused, and exactly 12 months ahead is accepted", ["AC-3"], [
    ...payTo("Maya Chen"), set({ "sp.first": "2026-11-07" }), press("Continue"), screen("problem"), text("Choose a weekday."), press("Change date"),
    set({ "sp.first": "2027-11-04" }), press("Continue"), screen("problem"), text("Choose a date within the next 12 months."), press("Change date"),
    set({ "sp.first": "not a date" }), press("Continue"), screen("when"), error("sp.first"),
    ...on("2027-11-03"), ...review, text("Wed 3 Nov 2027"),
  ]),
  T("T-8", "A day the bank is closed is refused, and a payment that falls on it moves to the next business day", ["AC-3"], [
    ...payTo("Maya Chen"), set({ "sp.first": "2026-11-10" }), press("Continue"), screen("problem"), text("The bank is closed on that day."), press("Change date"),
    ...on("2026-11-06", "weekly"), ...review, text("Fri 6 Nov · Mon 16 Nov · Fri 20 Nov"),
  ], { conditions: { closedDays: ["2026-11-10", "2026-11-13"] } }),
  T("T-9", "The review lists the next three dates: a month with fewer days uses its last day, and a Saturday moves to Monday", ["AC-3"], [
    ...payTo("Maya Chen"), ...on("2027-03-31"), ...review, text("Wed 31 Mar · Fri 30 Apr · Mon 31 May"), text("Starts"), text("Wed 31 Mar 2027"),
    press("Change end"), press("Back"), ...on("2027-04-01"), ...review, text("Thu 1 Apr · Mon 3 May · Tue 1 Jun"),
    press("Change end"), press("Back"), ...on("2026-11-06", "weekly"), ...review, text("Fri 6 Nov · Fri 13 Nov · Fri 20 Nov"),
    press("Change end"), press("Back"), ...on("2026-11-06", "biweekly"), ...review, text("Fri 6 Nov · Fri 20 Nov · Fri 4 Dec"),
    press("Change end"), press("Back"), ...on("2026-11-30", "quarterly"), ...review, text("Mon 30 Nov · Mon 1 Mar · Mon 31 May"),
  ]),
  T("T-10", "After a number of payments: a number outside 2 to the most for the frequency is refused with its own message, and the most is accepted", ["AC-4"], [
    ...payTo("Maya Chen"), ...on("2026-11-06", "weekly"), set({ "sp.endType": "count", "sp.endCount": "1" }), press("Review"), screen("end"), error("Enter a number from 2 to 104."),
    set({ "sp.endCount": "105" }), press("Review"), screen("end"), error("Enter a number from 2 to 104."), set({ "sp.endCount": "104" }), press("Review"), screen("review"), text("After 104 payments"),
    press("Change end"), press("Back"), ...on("2026-11-06", "biweekly"), set({ "sp.endType": "count", "sp.endCount": "53" }), press("Review"), screen("end"), error("Enter a number from 2 to 52."),
    set({ "sp.endCount": "52" }), press("Review"), screen("review"),
    press("Change end"), press("Back"), ...on("2026-11-06", "monthly"), set({ "sp.endType": "count", "sp.endCount": "61" }), press("Review"), screen("end"), error("Enter a number from 2 to 60."),
    set({ "sp.endCount": "2" }), press("Review"), screen("review"), text("After 2 payments"), text("Fri 6 Nov · Mon 7 Dec"),
    press("Change end"), press("Back"), ...on("2026-11-06", "quarterly"), set({ "sp.endType": "count", "sp.endCount": "41" }), press("Review"), screen("end"), error("Enter a number from 2 to 40."),
    set({ "sp.endCount": "40" }), press("Review"), screen("review"),
  ]),
  T("T-11", "On a date: the list holds the payment dates after the first, the first is not in it, and the one chosen is on the review", ["AC-4"], [
    ...payTo("Maya Chen"), ...on("2026-11-06", "weekly"), set({ "sp.endType": "date" }), text("Last payment on"), text("Fri 13 Nov 2026"), text("Fri 20 Nov 2026"), noText("Fri 6 Nov 2026"),
    set({ "sp.endOn": "2026-11-20" }), ...review, text("Ends"), text("Fri 20 Nov 2026"), text("Fri 6 Nov · Fri 13 Nov · Fri 20 Nov"),
    press("Change end"), set({ "sp.endOn": "" }), press("Review"), screen("end"), error("sp.endOn"),
  ]),
  T("T-12", "Once has no end: the date goes straight to the review, with a Date row and no Ends", ["AC-4"], [
    ...payTo("Maya Chen"), set({ "sp.freq": "once", "sp.endType": "date", "sp.first": "2026-11-06" }), press("Continue"), screen("review"),
    text("Once"), text("Date"), text("Fri 6 Nov 2026"), noText("Ends"), noText("Next dates"), press("Change date"), screen("when"),
  ]),
  T("T-13", "The bank refuses an end the screen was talked out of: a count that no longer fits the frequency, and an end before the start", ["AC-4", "AC-8"], [
    ...maya(), set({ "sp.freq": "quarterly", "sp.endType": "count", "sp.endCount": "50" }), ...confirm, ...code(), press("Schedule payment"), screen("problem"), text("Enter a valid number of payments."), text("Nothing was changed."),
    press("Edit"), screen("end"), set({ "sp.endCount": "20" }), ...review,
    set({ "sp.endType": "date", "sp.endOn": "2026-11-05" }), ...confirm, ...code(), press("Schedule payment"), screen("problem"), text("Choose an end date after the start."), absent("SCH-1009"), ...unchanged,
  ]),
  T("T-14", "Making a schedule: the review, the code that names the amount and the payee, the receipt, the schedule in the list, and no money taken", ["AC-5"], [
    ...maya(), text("Review your payment"), text("Maya Chen ••4417"), text("Main ••4410"), text("$100.00"), text("Monthly"), text("Starts"), text("Fri 6 Nov 2026"), text("Never"), text("Fri 6 Nov · Mon 7 Dec · Wed 6 Jan"), text("1 day before"),
    ...confirm, screen("otp"), text("Authorise $100.00 to Maya Chen, monthly"), text("We sent a 6-digit code to"), ...code(), press("Schedule payment"),
    screen("success"), text("Payment scheduled"), text("$100.00 to Maya Chen, monthly, from Fri 6 Nov."), text("Scheduled"), text("Maya Chen ••4417"), text("Starts"),
    sched("SCH-1009", "status", "active"), sched("SCH-1009", "nextRunOn", "2026-11-06"), sched("SCH-1009", "amount", 100), sched("SCH-1009", "text", "Maya Chen · Monthly, Fri 6 Nov, $100.00"),
    ...unchanged, { expectBank: { adapter: "bank.limits.get", path: "usedToday", equals: 0 } },
    press("Schedule another"), screen("home"),
  ]),
  T("T-15", "A schedule for a bill and one between own accounts are saved the same way; the code names the full bill", ["AC-5"], [
    ...startNew("A saved bill"), press("Harbor Insurance"), set({ "sp.amountMode": "full" }), press("Continue"), ...on("2026-11-06", "quarterly"), ...review, text("Full bill"),
    ...confirm, text("Authorise the full bill to Harbor Insurance, every 3 months"), ...code(), press("Schedule payment"), screen("success"), text("Full bill to Harbor Insurance, every 3 months, from Fri 6 Nov."),
    sched("SCH-1009", "amountMode", "full"), sched("SCH-1009", "frequency", "quarterly"),
    press("Schedule another"), press("New scheduled payment"), press("Between my accounts"), press("Savings ••7731"), set({ "sp.amount": 25 }), press("Continue"), ...on("2026-11-06", "weekly"), ...review,
    text("Savings ••7731"), ...make, sched("SCH-1010", "kind", "own"), sched("SCH-1010", "targetId", "acc_save"), ...unchanged,
  ]),
  T("T-16", "A wrong code takes nothing and says so; the right code saves the schedule once", ["AC-5"], [
    ...maya(), ...confirm, ...code("111111"), press("Schedule payment"), screen("otp"), toast("That code isn’t right. Try again."), absent("SCH-1009"),
    ...code(), press("Schedule payment"), screen("success"), sched("SCH-1009", "status", "active"), absent("SCH-1010"),
  ]),
  T("T-17", "Three wrong codes stop the journey and save nothing", ["AC-5"], [
    ...maya(), ...confirm, ...code("111111"), press("Schedule payment"), screen("otp"), press("Schedule payment"), screen("otp"), press("Schedule payment"),
    screen("locked"), text("Too many wrong codes"), text("No money has left your account."), absent("SCH-1009"), ...unchanged,
    press("Start again"), screen("home"),
  ]),
  T("T-18", "The confirmation must be ticked and the code must be six digits before anything is asked of the bank", ["AC-5"], [
    ...maya(), press("Confirm and send code"), screen("review"), error("Tick the confirmation first"),
    ...confirm, screen("otp"), press("Schedule payment"), screen("otp"), error("Enter all 6 digits"), ...code("12345"), press("Schedule payment"), screen("otp"), error("Enter all 6 digits"),
    absent("SCH-1009"),
  ]),
  T("T-19", "The code is used up by the schedule it was for: after the receipt, a second schedule needs a new code", ["AC-5"], [
    ...maya(), ...make, press("Schedule another"), screen("home"),
    ...payTo("Maya Chen", 60), ...on("2026-11-13"), ...review, ...make, sched("SCH-1010", "amount", 60), sched("SCH-1009", "amount", 100),
  ]),
  T("T-20", "Changing a schedule: the amount of SCH-1006 to $300.00 gives Schedule updated, with the payee as it was", ["AC-6"], [
    press("Change a payment"), screen("pick"), text("Savings top-up"), text("Peak Fitness"), text("Maya Chen"), text("Once · Thu 12 Nov · $250.00"), text("Omar Haddad"), text("Paused"), text("Rent"),
    press("Maya Chen"), screen("load"), text("Change payment"), text("Maya Chen ••4417"), text("Thu 12 Nov 2026"), press("Continue"), screen("how"), text("Amount"),
    set({ "sp.amount": 300 }), press("Continue"), screen("when"), text("Next payment date"), press("Continue"), screen("review"), text("Review the change"), text("$300.00"), text("Date"), text("Thu 12 Nov 2026"),
    ...confirm, text("Authorise the change to your payment to Maya Chen"), ...code(), press("Save changes"),
    screen("success"), text("Schedule updated"), text("Your payment to Maya Chen is updated."), text("Updated"), text("$300.00"),
    sched("SCH-1006", "amount", 300), sched("SCH-1006", "targetId", "ben_maya"), sched("SCH-1006", "nextRunOn", "2026-11-12"), ...unchanged,
  ]),
  T("T-21", "A schedule that is running now, one whose changes closed, and one that ended are refused with the bank's words", ["AC-6"], [
    press("Change a payment"), press("Peak Fitness"), screen("problem"), text("This payment is being processed. Try again later."), text("Nothing was changed."), press("Back to scheduled"),
  ]),
  T("T-22", "With strictCutoff on, changes to a payment due tomorrow closed at 09:00; with it off they are open until 18:00", ["AC-6"], [
    set({ "opt.strictCutoff": true }), press("Change a payment"), text("Harbor Insurance"), press("Harbor Insurance"), screen("problem"), text("This payment can’t be changed any more. Change it after it runs."), press("Back to scheduled"),
  ]),
  T("T-23", "Without strictCutoff the same payment can be changed until 18:00 the day before", ["AC-6"], [
    press("Change a payment"), press("Harbor Insurance"), screen("load"), text("Full bill"), text("Wed 4 Nov 2026"), press("Continue"), screen("how"), text("This payment is for the whole bill each time"), press("Continue"), screen("when"),
    set({ "sp.first": "2026-11-05" }), press("Continue"), screen("end"), ...review, text("Next payment"), text("Thu 5 Nov 2026"), ...save, text("Schedule updated"), sched("SCH-1003", "nextRunOn", "2026-11-05"), sched("SCH-1003", "amountMode", "full"),
  ]),
  T("T-24", "After 18:00 changes to a payment due tomorrow are closed", ["AC-6"], [
    press("Change a payment"), press("Harbor Insurance"), screen("problem"), text("This payment can’t be changed any more. Change it after it runs."),
  ], { now: "2026-11-03T18:00:00Z" }),
  T("T-25", "A schedule that ended or was cancelled meanwhile is refused as not active", ["AC-6"], [
    press("Change a payment"), screen("pick"), text("Rent"),
    { expectBank: { adapter: "bank.schedules.cancel", input: { scheduleId: "SCH-1001", scope: "all" }, path: "status", equals: "cancelled" } },
    press("Rent"), screen("problem"), text("This payment has already ended or been cancelled."), press("Back to scheduled"),
  ]),
  T("T-26", "Changing the next date moves the series; changing the end keeps the payee; the changes are checked by the bank before the code", ["AC-6"], [
    ...change("Lena Fischer"), press("Continue"), screen("when"), set({ "sp.first": "2026-11-17" }), press("Continue"), screen("end"), text("After a number of payments"),
    set({ "sp.endType": "date", "sp.endOn": "2027-02-17" }), ...review, text("Next payment"), text("Tue 17 Nov 2026"), text("Wed 17 Feb 2027"), ...save, text("Schedule updated"),
    sched("SCH-1005", "nextRunOn", "2026-11-17"), sched("SCH-1005", "endsOn", "2027-02-17"), sched("SCH-1005", "targetId", "ben_lena"), sched("SCH-1005", "endCount", null),
  ]),
  T("T-27", "A date in the past is refused when changing, and the schedule stays as it was", ["AC-6"], [
    ...change("Maya Chen"), press("Continue"), screen("when"), set({ "sp.first": "2026-11-03" }), press("Continue"), screen("problem"), text("Choose a date from tomorrow."),
    press("Change date"), screen("when"), sched("SCH-1006", "nextRunOn", "2026-11-12"), sched("SCH-1006", "amount", 250),
  ]),
  T("T-28", "A paused schedule is resumed by choosing a new date", ["AC-6"], [
    press("Change a payment"), press("Omar Haddad"), screen("load"), text("Paused"), text("Choose a new date to resume it."), press("Continue"), screen("how"), set({ "sp.amount": 500 }), press("Continue"),
    set({ "sp.first": "2026-11-23" }), press("Continue"), screen("end"), ...review, ...save, text("Schedule updated"), sched("SCH-1008", "status", "active"), sched("SCH-1008", "nextRunOn", "2026-11-23"),
  ]),
  T("T-29", "The 21st active schedule is refused at the review with the bank's words; one place frees up when a schedule is cancelled", ["AC-8"], [
    ...payTo("Maya Chen"), set({ "sp.first": "2026-11-06" }), press("Continue"), screen("problem"), text("You can have up to 20 scheduled payments. Cancel one to add another."), text("Nothing was changed."), press("Back"), screen("home"),
    { expectBank: { adapter: "bank.schedules.cancel", input: { scheduleId: "SCH-1002", scope: "all" }, path: "status", equals: "cancelled" } },
    ...payTo("Maya Chen"), ...on("2026-11-06"), ...review,
  ], { setup: more(12) }),
  T("T-30", "An amount over the daily limit is refused before the review; exactly the limit is accepted", ["AC-8"], [
    ...payTo("Maya Chen", 50000.01), set({ "sp.first": "2026-11-06" }), press("Continue"), screen("problem"), text("That is over your daily limit."), text("Nothing was changed."), press("Change amount"), screen("how"),
    set({ "sp.amount": 50000 }), press("Continue"), screen("when"), ...on("2026-11-06"), ...review, text("$50,000.00"),
    absent("SCH-1009"),
  ]),
  T("T-31", "The bank refuses the same account twice and an account that cannot send, even when the screens are bypassed", ["AC-8"], [
    ...startNew("Between my accounts"), press("Savings ••7731"), set({ "sp.amount": 50 }), press("Continue"), ...on("2026-11-06"), ...review,
    set({ "sp.from": "acc_save" }), ...confirm, ...code(), press("Schedule payment"), screen("problem"), text("Choose two different accounts."), text("Nothing was changed."), absent("SCH-1009"),
  ]),
  T("T-32", "An account that is frozen cannot send, and the schedule is not saved", ["AC-8"], [
    ...payTo("Maya Chen"), set({ "sp.first": "2026-11-06" }), press("Continue"), screen("problem"), text("You can’t send money from this account right now."), text("Nothing was changed."), press("Choose account"), screen("how"), absent("SCH-1009"),
  ], { conditions: { frozen: ["acc_main"] } }),
  T("T-33", "The reminder row is on the review by default and absent with the reminder off", ["AC-9"], [
    ...maya(), text("Reminder"), text("1 day before"),
    press("Change end"), press("Back"), set({ "opt.reminder": false }), ...on("2026-11-06"), ...review, noText("Reminder"), noText("1 day before"),
  ]),
  T("T-34", "The bank does not answer in time when making the schedule: Check scheduled first, nothing saved", ["AC-10"], [
    ...maya(), ...confirm, ...code(), press("Schedule payment"), screen("timeout"), text("We didn't get an answer in time"), text("Check your scheduled payments before you try again"), press("Check scheduled"),
    absent("SCH-1009"), ...unchanged,
  ], { conditions: { timeout: ["bank.schedules.create"], latencyMs: 10000 } }),
  T("T-35", "The bank is unavailable when making the schedule: nothing saved, and Try again goes back to the review", ["AC-10"], [
    ...maya(), ...confirm, ...code(), press("Schedule payment"), screen("unavailable"), text("Service not available"), text("We couldn’t reach the bank. Nothing was changed."), press("Try again"), screen("review"),
    absent("SCH-1009"),
  ], { conditions: { unavailable: ["bank.schedules.create"] } }),
  T("T-36", "The core fails after the code: nothing is saved", ["AC-10"], [
    ...maya(), ...confirm, ...code(), press("Schedule payment"), screen("failed"), text("We couldn't complete this right now."), text("Nothing was saved."), absent("SCH-1009"), ...unchanged,
  ], { conditions: { transferFails: true } }),
  T("T-37", "The bank does not answer in time when saving a change, or is unavailable: the schedule is as it was", ["AC-10"], [
    ...change("Maya Chen"), set({ "sp.amount": 300 }), press("Continue"), press("Continue"), screen("review"), ...confirm, ...code(), press("Save changes"), screen("timeout"),
    sched("SCH-1006", "amount", 250),
  ], { conditions: { timeout: ["bank.schedules.update"], latencyMs: 10000 } }),
  T("T-38", "The bank is unavailable when saving a change: nothing changed", ["AC-10"], [
    ...change("Maya Chen"), set({ "sp.amount": 300 }), press("Continue"), press("Continue"), screen("review"), ...confirm, ...code(), press("Save changes"), screen("unavailable"), sched("SCH-1006", "amount", 250),
  ], { conditions: { unavailable: ["bank.schedules.update"] } }),
  T("T-39", "The accounts cannot be loaded: standard message, and Try again asks again", ["AC-10"], [screen("unavailable"), text("Service not available"), press("Try again"), screen("unavailable")], { conditions: { unavailable: ["bank.accounts.list"] } }),
  T("T-40", "The saved payees cannot be loaded: standard message, and Try again returns to the choice", ["AC-10"], [
    press("New scheduled payment"), press("To a payee"), screen("unavailable"), press("Try again"), screen("what"),
  ], { conditions: { unavailable: ["bank.beneficiaries.list"] } }),
  T("T-41", "The saved billers cannot be loaded: standard message", ["AC-10"], [press("New scheduled payment"), press("A saved bill"), screen("unavailable"), text("Nothing was changed."), press("Try again"), screen("what")], { conditions: { unavailable: ["bank.bills.saved"] } }),
  T("T-42", "The list of schedules cannot be loaded: standard message, and Try again returns to the first screen", ["AC-10"], [press("Change a payment"), screen("unavailable"), press("Try again"), screen("home")], { conditions: { unavailable: ["bank.schedules.list"] } }),
  T("T-43", "One schedule cannot be read: standard message", ["AC-10"], [press("Change a payment"), press("Maya Chen"), screen("unavailable"), press("Try again"), screen("home")], { conditions: { unavailable: ["bank.schedules.get"] } }),
  T("T-44", "The dates cannot be checked on the way to the end: standard message, and a slow answer says nothing was changed", ["AC-10"], [
    ...payTo("Maya Chen"), set({ "sp.first": "2026-11-06" }), press("Continue"), screen("unavailable"), press("Try again"), screen("when"), absent("SCH-1009"),
  ], { conditions: { unavailable: ["bank.schedules.check"] } }),
  T("T-45", "The check before the review is slow to answer: nothing was changed and the person can try again", ["AC-10"], [
    ...payTo("Maya Chen"), set({ "sp.freq": "once", "sp.first": "2026-11-06" }), press("Continue"), screen("slow"), text("This is taking longer than expected."), text("Nothing was changed."), press("Try again"), screen("when"),
  ], { conditions: { timeout: ["bank.schedules.check"], latencyMs: 10000 } }),
  T("T-46", "The code cannot be sent: standard message, nothing saved, and Try again returns to the review", ["AC-10"], [
    ...maya(), ...confirm, screen("unavailable"), press("Try again"), screen("review"), absent("SCH-1009"),
  ], { conditions: { unavailable: ["bank.otp.send"] } }),
  T("T-47", "A payee added 3 hours ago cannot be paid until its first 24 hours are over: tomorrow is refused with the date, the day after is accepted", ["AC-11"], [
    ...payTo("Casey Nguyen"), set({ "sp.first": "2026-11-04" }), press("Continue"), screen("problem"), text("Casey Nguyen was added 3 hours ago."), text("must be on or after Thu 5 Nov 2026."), press("Change date"), screen("when"),
    ...on("2026-11-05"), ...review, text("Thu 5 Nov 2026"),
    press("Change end"), press("Back"), press("Back"), press("Back"), press("Taylor Brooks"), set({ "sp.amount": 100 }), press("Continue"), ...on("2026-11-04"), ...review, text("Taylor Brooks"),
  ]),
  T("T-48", "Nothing is taken when the schedule is made; on its date the bank takes the payment and the next date moves on", ["AC-12"], [
    ...maya(), ...make, ...unchanged,
    runs("2026-11-06", "SCH-1009-2026-11-06", "status", "paid"),
    balance("acc_main", Math.round((8720.76 - 39.99 - 383.9 - 100 - 100) * 100) / 100), sched("SCH-1009", "nextRunOn", "2026-12-07"), sched("SCH-1009", "paid", 1),
  ]),
  T("T-49", "A payment short of money is skipped and, after two in a row, the schedule is paused", ["AC-12"], [
    ...maya(), ...make,
    runs("2026-11-06", "SCH-1009-2026-11-06", "status", "skipped"), runs("2026-12-07", "SCH-1009-2026-12-07", "notice", "Payment skipped, not enough money. Schedule paused"), sched("SCH-1009", "status", "paused"),
  ], { setup: drain(1) }),
  T("T-50", "With insufficientFundsPolicy on a short payment is tried once more the next business day", ["AC-12"], [
    set({ "opt.insufficientFundsPolicy": true }), ...maya(), ...make,
    runs("2026-11-06", "SCH-1009-2026-11-06", "status", "retry"), runs("2026-11-09", "SCH-1009-2026-11-09", "status", "skipped"), sched("SCH-1009", "nextRunOn", "2026-12-07"),
  ], { setup: drain(1) }),
  T("T-51", "Without the policy the same short payment is skipped at once and the date moves on", ["AC-12"], [
    ...maya(), ...make, runs("2026-11-06", "SCH-1009-2026-11-06", "status", "skipped"), sched("SCH-1009", "nextRunOn", "2026-12-07"),
  ], { setup: drain(1) }),
  T("T-52", "A change needs the right code too: a wrong code takes nothing, a short code is refused before the bank is asked, three wrong codes stop the journey", ["AC-5", "AC-6"], [
    ...change("Maya Chen"), set({ "sp.amount": 300 }), press("Continue"), press("Continue"), screen("review"), ...confirm, screen("otp"),
    ...code("12345"), press("Save changes"), screen("otp"), error("Enter all 6 digits"), sched("SCH-1006", "amount", 250),
    ...code("111111"), press("Save changes"), screen("otp"), toast("That code isn’t right. Try again."), press("Save changes"), screen("otp"), press("Save changes"), screen("locked"), sched("SCH-1006", "amount", 250),
  ]),
];
