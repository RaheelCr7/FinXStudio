import type { Journey } from "../schema";
import { steps } from "./business-kit";

const { press, text, noText, screen, set, error, opens, refuses, bank } = steps;

/** What must be true for "Schedule a supplier payment" to be right (the spec's criteria; the money rules add the confirmation tick and the bank's refusals). */
export const scheduleBusinessAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "Only saved, approved suppliers can be chosen; the amount, reference and purpose are required; a role without the permission lands on a no-access card and the bank refuses the same calls." },
  { id: "AC-2", text: "The date is a working day from tomorrow within 12 months; Ends and the number of payments follow the limits of the spec (2 to 104 weekly, 60 monthly, 40 every 3 months); the amount fits the Standard speed and the person's limit." },
  { id: "AC-3", text: "The review shows the next three dates and how many approvals are needed; the code is asked only from 25,000.00 in the company's currency, names the amount, the supplier and how often, and is never asked for Cancel." },
  { id: "AC-4", text: "The result is \"Sent for approval\" with a waiting chip; the schedule waits for approval and no money moves." },
  { id: "AC-5", text: "Change goes back for approval and clears earlier approvals; Cancel is immediate and asks for no code." },
  { id: "AC-6", text: "Change and Cancel are refused after changes closed (18:00 the business day before, or 09:00 with strictCutoff) and while the payment is running." },
  { id: "AC-7", text: "A 21st active schedule is refused and a 20th is not." },
  { id: "AC-8", text: "A timeout of the real call shows the Check Scheduled payments message and an unavailable bank shows the sheet; nothing is created or changed." },
  { id: "AC-9", text: "Three wrong codes stop the payment, and the bank refuses it without the code." },
];

const NOW = "2026-11-03T10:42:00Z";
const alpha = { persona: "alex", context: "alpha", now: NOW };
type Scenario = NonNullable<Journey["scenarios"]>[number];
const T = (id: string, name: string, covers: string[], base: Record<string, unknown>, stepList: Record<string, unknown>[], extra: Record<string, unknown> = {}): Scenario => ({ id, name, covers, ...base, ...extra, steps: stepList } as Scenario);
const arrange = (input: Record<string, unknown>) => ({ adapter: "corp.sandbox.arrange", input });
const sch = (id: string, path: string, equals: unknown) => bank("corp.schedules.list", `${id}.${path}`, equals);
/** From the first screen to "How often", for a supplier and an amount. */
const toWhen = (supplier: string, amount: number, reference = "INV-2041", purpose = "Goods"): Record<string, unknown>[] => [
  screen("supplier"), press(supplier), screen("amount"), set({ "sc.amount": amount, "sc.reference": reference, "sc.purpose": purpose }), press("Continue"), screen("when"),
];
const toReview = (start: string, extra: Record<string, unknown> = {}): Record<string, unknown>[] => [set({ "sc.start": start, ...extra }), press("Continue"), screen("review")];
const send: Record<string, unknown>[] = [set({ "sc.consent": true }), press("Send for approval")];
const code = (c = "482100"): Record<string, unknown>[] => [set({ "otp.code": c }), press("Send for approval")];
const unmoved = bank("corp.company.get", "accounts.alpha_ops.balance", 480_000);
const plan = { supplierId: "harb", amount: 4_500, reference: "INV-2041", purpose: "Goods", frequency: "monthly", start: "2026-12-01", endMode: "never" };
const edit = (id: string, extra: Record<string, unknown> = {}) => ({ launch: { "launch.mode": "edit", "launch.scheduleId": id }, ...extra });
const cancel = (id: string, extra: Record<string, unknown> = {}) => ({ launch: { "launch.mode": "cancel", "launch.scheduleId": id }, ...extra });

export const scheduleBusinessScenarios: NonNullable<Journey["scenarios"]> = [
  T("T-1", "Harbour Packaging, 4,500.00, INV-2041, Goods, Monthly from Tue 1 Dec: no code, Sent for approval, waiting for 1 approval, the list shows 0 of 1 approved, nothing taken", ["AC-1", "AC-3", "AC-4"], alpha, [
    ...toWhen("Harbour Packaging", 4_500), text("Once"), text("Weekly"), text("Monthly"), text("Every 3 months"), text("Step 3 of 4"), ...toReview("2026-12-01"),
    text("Harbour Packaging"), text("$4,500.00"), text("INV-2041"), text("Goods"), text("Tue 1 Dec 2026"), text("Never"), text("Tue 1 Dec · Fri 1 Jan · Mon 1 Feb"), text("Needs 1 approval before the first payment"), text("Balance, limit and supplier are checked"),
    press("Send for approval"), screen("review"), error("sc.consent"), text("Tick the confirmation first"), ...send, screen("sent"), noText("Authorise"), text("Sent for approval"), text("$4,500.00 to Harbour Packaging, monthly, from Tue 1 Dec."),
    text("Waiting for 1 approval"), text("Needs 1 approval before the first payment"), sch("BSC-3003", "badge", "Waiting for approval"), sch("BSC-3003", "progress", "0 of 1 approved"), unmoved, bank("corp.company.get", "companyUsedToday", 0),
  ]),
  T("T-2", "Nordic Supplies AB, 30,000.00 EUR, Once: the code sheet names the amount, the supplier and how often; with the code it is waiting", ["AC-3", "AC-4"], alpha, [
    ...toWhen("Nordic Supplies AB", 30_000, "INV-77"), set({ "sc.frequency": "once" }), noText("Ends"), text("Date"), ...toReview("2026-12-01"), text("Date"), text("€30,000.00"), noText("Next dates"), noText("Ends"),
    press("Send for approval"), screen("review"), error("sc.consent"), ...send, screen("otp"), text("Authorise €30,000.00 to Nordic Supplies AB, once"), text("Code sent to"), press("Send for approval"), screen("otp"), error("otp.code"), ...code(), screen("sent"), text("€30,000.00 to Nordic Supplies AB, once, from Tue 1 Dec."), sch("BSC-3003", "badge", "Waiting for approval"), unmoved,
  ]),
  T("T-3", "Nordic Supplies AB, 60,000.00 EUR monthly (over 50,000.00 in dollars): Needs 2 approvals before the first payment, and the receipt says Waiting for 2 approvals", ["AC-3"], alpha, [
    ...toWhen("Nordic Supplies AB", 60_000, "INV-9"), ...toReview("2026-12-01"), text("Needs 2 approvals before the first payment"), ...send, screen("otp"), text("Authorise €60,000.00 to Nordic Supplies AB, monthly"), ...code(), screen("sent"),
    text("Waiting for 2 approvals"), sch("BSC-3003", "progress", "0 of 2 approved"),
  ]),
  T("T-4", "Harbour Packaging, 60,000.00 (over the 25,000.00 of the Standard speed): the amount screen says so and nothing is made", ["AC-2"], alpha, [
    ...toWhen("Harbour Packaging", 60_000), set({ "sc.start": "2026-12-01" }), press("Continue"), screen("amount"), text("That is over the limit for this payment. Try a smaller amount."),
    set({ "sc.amount": 250_000 }), press("Continue"), press("Continue"), screen("amount"), text("That is over the limit for this payment. Try a smaller amount."),
  ]),
  T("T-5", "A start date of today is refused: Choose a date from tomorrow.; tomorrow is allowed", ["AC-2"], alpha, [
    ...toWhen("Harbour Packaging", 4_500), press("Continue"), screen("when"), error("sc.start"), set({ "sc.start": "2026-11-03" }), press("Continue"), screen("when"), text("Choose a date from tomorrow."),
    set({ "sc.start": "2026-11-04" }), press("Continue"), screen("review"), text("Wed 4 Nov 2026"),
  ]),
  T("T-6", "A date that is not a weekday, or more than 12 months ahead, is refused with the spec's words", ["AC-2"], alpha, [
    ...toWhen("Harbour Packaging", 4_500), set({ "sc.start": "2026-12-05" }), press("Continue"), screen("when"), text("Choose a weekday."),
    set({ "sc.start": "2027-11-04" }), press("Continue"), screen("when"), text("Choose a date within 12 months."),
    set({ "sc.start": "2027-11-03" }), press("Continue"), screen("review"),
  ]),
  T("T-7", "After a number of payments: 1 is refused with the monthly maximum; 2 to 60 are allowed", ["AC-2"], alpha, [
    ...toWhen("Harbour Packaging", 4_500), set({ "sc.start": "2026-12-01", "sc.endMode": "count", "sc.endCount": "1" }), press("Continue"), screen("when"), text("Enter a number from 2 to 60."),
    set({ "sc.endCount": "61" }), press("Continue"), text("Enter a number from 2 to 60."), set({ "sc.endCount": "12" }), press("Continue"), screen("review"), text("12 payments"), text("Tue 1 Dec · Fri 1 Jan · Mon 1 Feb"),
  ]),
  T("T-8", "Ends on a date: the bank offers the payment dates, and the last one is on the review", ["AC-2"], alpha, [
    ...toWhen("Harbour Packaging", 4_500), set({ "sc.start": "2026-12-01", "sc.endMode": "date" }), press("Continue"), screen("endDate"), text("Last payment"), text("Fri 1 Jan 2027"), text("Mon 1 Feb 2027"),
    press("Continue"), screen("endDate"), error("sc.endDate"), set({ "sc.endDate": "2027-02-01" }), press("Continue"), screen("review"), text("Mon 1 Feb 2027"), text("Tue 1 Dec · Fri 1 Jan · Mon 1 Feb"),
  ]),
  T("T-9", "Every 3 months and weekly show the next three dates with the weekend moved to Monday", ["AC-2"], alpha, [
    ...toWhen("Harbour Packaging", 4_500), set({ "sc.frequency": "quarterly" }), ...toReview("2026-12-01"), text("Tue 1 Dec · Mon 1 Mar · Tue 1 Jun"), press("Back"), set({ "sc.frequency": "weekly", "sc.start": "2026-11-06" }), press("Continue"), text("Fri 6 Nov · Fri 13 Nov · Fri 20 Nov"),
  ]),
  T("T-10", "With allowQuarterly off there is no Every 3 months and the bank refuses it", ["AC-2"], alpha, [
    ...toWhen("Harbour Packaging", 4_500), text("Monthly"), noText("Every 3 months"), refuses("corp.schedules.check", "INVALID_FREQUENCY", { ...plan, frequency: "quarterly", allowQuarterly: false }),
  ], { launch: { "opt.allowQuarterly": false } }),
  T("T-11", "Opened with a supplier and an amount (from a template or a link) the first step is skipped and the amount is filled in", ["AC-1"], alpha, [
    screen("amount"), text("Harbour Packaging"), text("Step 2 of 4"), set({ "sc.reference": "INV-5", "sc.purpose": "Goods" }), press("Continue"), screen("when"), set({ "sc.start": "2026-12-01" }), press("Continue"), screen("review"), text("$4,500.00"),
  ], { launch: { "launch.supplierId": "harb", "launch.amount": 4_500 } }),
  T("T-12", "Reference and purpose are required, and only the spec's characters are allowed", ["AC-1"], alpha, [
    screen("supplier"), press("Harbour Packaging"), set({ "sc.amount": 100 }), press("Continue"), screen("amount"), error("sc.reference"), error("sc.purpose"),
    refuses("corp.schedules.check", "INVALID_REFERENCE", { ...plan, reference: "bad_ref" }), refuses("corp.schedules.check", "REFERENCE_REQUIRED", { ...plan, reference: " " }), refuses("corp.schedules.check", "PURPOSE_REQUIRED", { ...plan, purpose: "" }),
  ]),
  T("T-13", "A supplier that is not on the list cannot be scheduled, even when asked directly", ["AC-1"], alpha, [
    screen("supplier"), text("Harbour Packaging"), noText("Brightline"), refuses("corp.schedules.check", "SUPPLIER_NOT_APPROVED", { ...plan, supplierId: "req_1" }), refuses("corp.schedules.create", "SUPPLIER_NOT_APPROVED", { ...plan, supplierId: "req_1" }),
  ]),
  T("T-14", "An amount over the person's limit is refused by the bank", ["AC-2"], alpha, [screen("supplier"), refuses("corp.schedules.check", "LIMIT_USER_EXCEEDED", { ...plan, supplierId: "nord", amount: 250_001 }), refuses("corp.schedules.check", "INVALID_AMOUNT", { ...plan, amount: 0.001 })]),
  T("T-15", "Change BSC-3001 to 5,000.00: the card, the amount, Change sent for approval, and the list shows it waiting", ["AC-5", "AC-4"], alpha, [
    screen("editCard"), text("Change payment"), text("Harbour Packaging"), text("PO-STANDING"), text("$4,500.00"), text("Monthly"), text("Tue 1 Dec 2026"), text("Active"),
    press("Continue"), screen("amount"), text("Step 2 of 3"), set({ "sc.amount": 5_000 }), press("Continue"), screen("when"), text("Next payment"), noText("Once"), press("Continue"), screen("review"), text("$5,000.00"),
    press("Send for approval"), screen("review"), error("sc.consent"), ...send, screen("changed"), text("Change sent for approval"), text("The payment to Harbour Packaging waits until it is approved."), text("Waiting for 1 approval"),
    sch("BSC-3001", "badge", "Waiting for approval"), sch("BSC-3001", "amountText", "$5,000.00"), sch("BSC-3001", "progress", "0 of 1 approved"),
    press("View scheduled"), opens("business-schedules"),
  ], edit("BSC-3001")),
  T("T-16", "Change BSC-3002 to 30,000.00 (over 25,000.00 in dollars): a code names the amount, the supplier and how often", ["AC-3", "AC-5"], alpha, [
    press("Continue"), set({ "sc.amount": 30_000 }), press("Continue"), press("Continue"), screen("review"), ...send, screen("otp"), text("Authorise £30,000.00 to Whitby Logistics, every 3 months"), press("Send for approval"), screen("otp"), error("otp.code"), ...code("111111"), screen("otp"), ...code(), screen("changed"), sch("BSC-3002", "amountText", "£30,000.00"),
  ], edit("BSC-3002")),
  T("T-17", "Cancel BSC-3002: the card, Payment cancelled, no code, gone from the list", ["AC-5"], alpha, [
    screen("cancelCard"), text("Cancel this payment?"), text("Whitby Logistics"), text("£12,000.00"), text("Every 3 months"), noText("Authorise"), press("Cancel payment"), screen("cancelled"), text("Payment cancelled"),
    text("No more payments will go to Whitby Logistics."), text("Cancelled"), text("3 Nov 2026"), sch("BSC-3002", "id", undefined), sch("BSC-3001", "id", "BSC-3001"), press("Back to scheduled"), opens("business-schedules"),
  ], cancel("BSC-3002")),
  T("T-18", "Changes close at 09:00 the business day before when strictCutoff is on: a schedule starting Wed 4 Nov cannot be changed or cancelled on Tuesday at 10:42", ["AC-6"], alpha, [
    screen("refused"), text("This payment can’t be changed any more. Change it after it runs."), refuses("corp.schedules.cancel", "SCHEDULE_CUTOFF_PASSED", { scheduleId: "BSC-3003", strictCutoff: true }),
  ], { ...edit("BSC-3003"), launch: { "launch.mode": "edit", "launch.scheduleId": "BSC-3003", "opt.strictCutoff": true }, setup: [{ adapter: "corp.schedules.create", input: { ...plan, start: "2026-11-04" } }] }),
  T("T-19", "Without strictCutoff the same schedule can still be changed at 10:42", ["AC-6"], alpha, [screen("editCard"), text("Wed 4 Nov 2026")], { ...edit("BSC-3003"), setup: [{ adapter: "corp.schedules.create", input: { ...plan, start: "2026-11-04" } }] }),
  T("T-20", "At 18:00 on the business day before, changes have closed; at 17:59 they have not", ["AC-6"], { persona: "alex", context: "alpha", now: "2026-11-30T18:00:00Z" }, [screen("refused"), text("This payment can’t be changed any more. Change it after it runs.")], edit("BSC-3001")),
  T("T-21", "At 17:59 the day before a payment it can still be changed", ["AC-6"], { persona: "alex", context: "alpha", now: "2026-11-30T17:59:00Z" }, [screen("editCard"), text("Tue 1 Dec 2026")], edit("BSC-3001")),
  T("T-22", "On the day of the payment it is running: it cannot be changed or cancelled", ["AC-6"], { persona: "alex", context: "alpha", now: "2026-12-01T09:00:00Z" }, [screen("refused"), text("This payment is being processed. Try again later."), refuses("corp.schedules.cancel", "SCHEDULE_RUNNING", { scheduleId: "BSC-3001" })], cancel("BSC-3001")),
  T("T-23", "A payment that is not there, or was cancelled, cannot be changed", ["AC-6"], alpha, [screen("refused"), text("We can’t find that payment."), refuses("corp.schedules.update", "SCHEDULE_NOT_FOUND", { ...plan, scheduleId: "BSC-9" })], edit("BSC-9")),
  T("T-24", "A cancelled payment cannot be changed again", ["AC-6"], alpha, [screen("refused"), text("This payment has already ended or been cancelled.")], { ...edit("BSC-3002"), setup: [{ adapter: "corp.schedules.cancel", input: { scheduleId: "BSC-3002" } }] }),
  T("T-25", "Twenty schedules exist: the 21st is refused on the review and nothing is made", ["AC-7"], alpha, [...toWhen("Harbour Packaging", 4_500), ...toReview("2026-12-01"), ...send, screen("review"), text("You can have up to 20 scheduled payments. Cancel one to add another."), noText("Sent for approval")], { setup: [arrange({ op: "fillSchedules", count: 20 })] }),
  T("T-26", "Nineteen exist: the 20th is made", ["AC-7"], alpha, [...toWhen("Harbour Packaging", 4_500), ...toReview("2026-12-01"), ...send, screen("sent")], { setup: [arrange({ op: "fillSchedules", count: 19 })] }),
  T("T-27", "Three wrong codes stop the payment and nothing is scheduled", ["AC-9"], alpha, [
    ...toWhen("Nordic Supplies AB", 30_000, "INV-77"), ...toReview("2026-12-01"), ...send, ...code("111111"), screen("otp"), ...code("111111"), screen("otp"), ...code("111111"), screen("locked"),
    text("We couldn’t confirm this payment."), text("Nothing was scheduled. Start again."), sch("BSC-3003", "id", undefined),
  ]),
  T("T-28", "The bank does not schedule a payment of 25,000.00 or more without the code, even when asked directly", ["AC-9", "AC-3"], alpha, [screen("supplier"), refuses("corp.schedules.create", "OTP_REQUIRED", { ...plan, supplierId: "nord", amount: 30_000 })]),
  T("T-29", "A timeout of the real call shows the Check Scheduled payments message and nothing is made", ["AC-8"], alpha, [
    ...toWhen("Harbour Packaging", 4_500), ...toReview("2026-12-01"), ...send, screen("timeout"), text("Check Scheduled payments before you try again, so you don’t schedule it twice."), noText("Sent for approval"), sch("BSC-3003", "id", undefined),
  ], { conditions: { timeout: ["corp.schedules.create"], latencyMs: 10000 } }),
  T("T-30", "The bank being unavailable on the real call shows the sheet; Try again returns to the review; nothing is made", ["AC-8"], alpha, [
    ...toWhen("Harbour Packaging", 4_500), ...toReview("2026-12-01"), ...send, screen("unavailable"), text("We couldn’t reach the bank"), text("Nothing was sent and you haven’t been charged. Try again in a moment."), sch("BSC-3003", "id", undefined), press("Try again"), screen("review"),
  ], { conditions: { unavailable: ["corp.schedules.create"] } }),
  T("T-31", "A change that times out shows the same message and changes nothing", ["AC-8"], alpha, [press("Continue"), press("Continue"), press("Continue"), ...send, screen("timeout"), sch("BSC-3001", "badge", "Active")], { ...edit("BSC-3001"), conditions: { timeout: ["corp.schedules.update"], latencyMs: 10000 } }),
  T("T-32", "A change with the bank unavailable shows the sheet; Try again returns to the review", ["AC-8"], alpha, [press("Continue"), press("Continue"), press("Continue"), ...send, screen("unavailable"), press("Try again"), screen("review")], { ...edit("BSC-3001"), conditions: { unavailable: ["corp.schedules.update"] } }),
  T("T-33", "A cancel that times out shows the message; the payment stays", ["AC-8"], alpha, [press("Cancel payment"), screen("timeout"), sch("BSC-3002", "badge", "Waiting for approval")], { ...cancel("BSC-3002"), conditions: { timeout: ["corp.schedules.cancel"], latencyMs: 10000 } }),
  T("T-34", "A cancel with the bank unavailable shows the sheet; Try again returns to the card", ["AC-8"], alpha, [press("Cancel payment"), screen("unavailable"), press("Try again"), screen("cancelCard")], { ...cancel("BSC-3002"), conditions: { unavailable: ["corp.schedules.cancel"] } }),
  T("T-35", "The check not answering shows the sheet; Try again returns to the dates", ["AC-8"], alpha, [...toWhen("Harbour Packaging", 4_500), set({ "sc.start": "2026-12-01" }), press("Continue"), screen("unavailable"), press("Try again"), screen("when")], { conditions: { unavailable: ["corp.schedules.check"] } }),
  T("T-36", "A slow check changes nothing and says so", ["AC-8"], alpha, [...toWhen("Harbour Packaging", 4_500), set({ "sc.start": "2026-12-01" }), press("Continue"), screen("slow"), text("This is taking longer than expected. Nothing was changed."), press("Try again"), screen("when")], { conditions: { timeout: ["corp.schedules.check"], latencyMs: 10000 } }),
  T("T-37", "The suppliers not loading shows the sheet", ["AC-8"], alpha, [screen("unavailable"), press("Try again"), screen("unavailable")], { conditions: { unavailable: ["corp.suppliers.list"] } }),
  T("T-38", "The payment to change not loading shows the sheet", ["AC-8"], alpha, [screen("unavailable"), press("Try again"), screen("unavailable")], { ...edit("BSC-3001"), conditions: { unavailable: ["corp.schedules.get"] } }),
  T("T-39", "A code that cannot be sent shows the sheet; Try again returns to the review", ["AC-8"], alpha, [...toWhen("Nordic Supplies AB", 30_000, "INV-77"), ...toReview("2026-12-01"), ...send, screen("unavailable"), press("Try again"), screen("review")], { conditions: { unavailable: ["bank.otp.send"] } }),
  T("T-40", "Alex at Beta (an Approver): the no-access card, and the bank refuses scheduling, changing and cancelling", ["AC-1"], { persona: "alex", context: "beta", now: NOW }, [
    screen("denied"), text("You can’t schedule payments at this company"), refuses("corp.schedules.create", "PERMISSION_DENIED", plan), refuses("corp.schedules.cancel", "PERMISSION_DENIED", { scheduleId: "BSC-3001" }), refuses("corp.schedules.update", "PERMISSION_DENIED", { ...plan, scheduleId: "BSC-3001" }), refuses("corp.schedules.check", "PERMISSION_DENIED", plan),
  ]),
  T("T-41", "From Personal the bank refuses a company's schedules", ["AC-1"], { persona: "alex", now: NOW }, [screen("denied"), refuses("corp.schedules.create", "WRONG_CONTEXT", plan)]),
  T("T-42", "Schedule another on the result goes back to the first step", ["AC-4"], alpha, [
    ...toWhen("Harbour Packaging", 4_500), ...toReview("2026-12-01"), ...send, screen("sent"), press("Schedule another"), screen("supplier"), text("Choose a supplier"),
  ]),
  T("T-44", "A schedule above the threshold: the bank being unavailable after the code shows the sheet and nothing is made", ["AC-8"], alpha, [
    ...toWhen("Nordic Supplies AB", 30_000, "INV-77"), ...toReview("2026-12-01"), ...send, ...code(), screen("unavailable"), sch("BSC-3003", "id", undefined),
  ], { conditions: { unavailable: ["corp.schedules.create"] } }),
  T("T-45", "A change above the threshold: the bank being unavailable after the code shows the sheet and changes nothing", ["AC-8"], alpha, [
    press("Continue"), set({ "sc.amount": 30_000 }), press("Continue"), press("Continue"), ...send, ...code(), screen("unavailable"), sch("BSC-3002", "amountText", "£12,000.00"),
  ], { ...edit("BSC-3002"), conditions: { unavailable: ["corp.schedules.update"] } }),
  T("T-46", "The code check not answering keeps the person on the code sheet", ["AC-8"], alpha, [
    ...toWhen("Nordic Supplies AB", 30_000, "INV-77"), ...toReview("2026-12-01"), ...send, ...code(), screen("otp"), sch("BSC-3003", "id", undefined),
  ], { conditions: { unavailable: ["bank.otp.verify"] } }),
  T("T-43", "View scheduled opens the list of scheduled payments", ["AC-4"], alpha, [...toWhen("Harbour Packaging", 4_500), ...toReview("2026-12-01"), ...send, press("View scheduled"), opens("business-schedules")]),
];
