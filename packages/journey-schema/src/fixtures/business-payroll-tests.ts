import type { Journey } from "../schema";
import { steps } from "./business-kit";

const { press, text, noText, screen, set, error, opens, refuses, bank } = steps;

/** What must be true for "Payroll run" to be right (the spec's AC-1 to AC-9, with the ones this build adds: the role, the limits, and the register being the bank's). */
export const businessPayrollAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "A period already sent, or in the future, cannot be chosen: the bank refuses it with \"Payroll for this period was already sent.\" or \"Choose this month or an earlier one.\", and so does a pay date that is not a working day." },
  { id: "AC-2", text: "The register is the source: the people with bank details are in the run, the others are listed under Not in this run with their reason and cannot be added; the bank refuses anyone who is not on the register." },
  { id: "AC-3", text: "Pay is net plus bonus minus deduction; a pay above 1.5 times the monthly salary, zero or invalid is marked and blocks the step, and the bank refuses it." },
  { id: "AC-4", text: "The Bonus and Deduction buttons follow the options (the bank refuses a line that is switched off); Remove and adding someone back work." },
  { id: "AC-5", text: "A total more than 20% from last month asks for a reason when varianceCheck is on; without one the bank refuses to go on." },
  { id: "AC-6", text: "A debit above the balance blocks the step with the message, and the review checks the person's limit and the company's before the code is asked." },
  { id: "AC-7", text: "A code is always asked, three wrong codes stop the run, and the result is \"Sent for approval\": the run waits as one payment, no money moves and the person who started it cannot approve it." },
  { id: "AC-8", text: "Approvals needed is 2 above 50,000.00 of the company's currency, otherwise 1; the period is taken once the run is sent and free again when it is withdrawn." },
  { id: "AC-9", text: "A timeout shows the check-Payments message and an unavailable bank shows the sheet; neither creates a run." },
  { id: "AC-10", text: "Only a Maker holds the permission: a role without it lands on a no-access card and the bank refuses the same calls, from Personal as well." },
  { id: "AC-11", text: "The payslips switch follows its option, and nothing about one person's pay is shown outside the table and the card of that person." },
];

const NOW = "2026-11-03T10:42:00Z";
const alpha = { persona: "alex", context: "alpha", now: NOW };
type Scenario = NonNullable<Journey["scenarios"]>[number];
const T = (id: string, name: string, covers: string[], base: Record<string, unknown>, stepList: Record<string, unknown>[], extra: Record<string, unknown> = {}): Scenario => ({ id, name, covers, ...base, ...extra, steps: stepList } as Scenario);

const DATE = "2026-11-04";
const ALL = ["emp_ali", "emp_sana", "emp_bilal", "emp_hina", "emp_lena", "emp_noura", "emp_khalid", "emp_rana"];
const toPeople = [set({ "pr.date": DATE }), press("Continue"), screen("people")];
const toReview = [...toPeople, press("Review"), screen("review")];
const toCode = [...toReview, set({ "pr.consent": true }), press("Submit for approval"), screen("otp")];
const send = [set({ "otp.code": "482100" }), press("Submit for approval"), screen("done")];
const pay = (id: string, net: string) => [press(id), screen("edit"), set({ "pr.net": net }), press("Save pay"), screen("people")];
const out = (id: string) => [press(id), screen("edit"), press("Remove from this run"), screen("people")];
const register = (extra: Record<string, unknown> = {}) => ({ op: "open", period: "2026-11", fromAccountId: "alpha_ops", payDate: DATE, ...extra });
const runs = (n: number) => bank("corp.payments.track", "count", n);
const noRun = runs(4);
const noMoney = bank("corp.company.get", "accounts.alpha_ops.balance", 480_000);

export const businessPayrollScenarios: NonNullable<Journey["scenarios"]> = [
  T("T-1", "November 2026 on the next working day from Operating: eight employees (nine are on the register), $30,866.24, the extra code line, Sent for approval with one approver", ["AC-2", "AC-7", "AC-8"], alpha, [
    screen("period"), text("Step 1 of 3 · Payroll run"), text("Pay period"), text("November 2026"), text("Pay date"), text("Pay from"), text("Operating ••2001"), text("$458,760.00"), ...toPeople, text("Step 2 of 3 · Payroll run"), text("Check each person’s pay."),
    text("$17,800.00 + £3,000.00 + AED 12,500.00 + SAR 11,250.00 + JOD 2,000.000"), text("8 employees · from Operating ••2001"), text("balance after $449,133.76"), text("Ali Hamdan"), text("Finance"), text("Rana Qasem"), text("JOD 2,000.000"), text("Faris Qasem"), text("No bank details"),
    press("Review"), screen("review"), text("Step 3 of 3 · Payroll run"), text("$30,866.24"), text("Wed 4 Nov 2026"), text("Fees"), text("None"), text("You pay"), text("Approvals needed"), text("Send payslips"),
    set({ "pr.consent": true }), press("Submit for approval"), screen("otp"), text("Authorise payroll November 2026: $30,866.24"), text("This amount needs an extra code."),
    ...send, text("Sent for approval"), text("Payroll for November 2026"), text("Nothing has left the account yet."), text("Waiting for 1 approver"), text("BWX-20261103-2042"),
    bank("corp.payments.track", "rows.PAY-2042.statusKey", "pending_approval", { status: "all" }), bank("corp.payments.track", "rows.PAY-2042.to", "Payroll 2026-11 · 8 employees", { status: "all" }), noMoney, bank("corp.company.get", "companyUsedToday", 0), bank("corp.company.get", "me.usedToday", 49_766.24),
  ]),
  T("T-2", "October 2026 was already sent: the bank says so and the first step stays", ["AC-1"], alpha, [
    set({ "pr.period": "2026-10", "pr.date": DATE }), press("Continue"), screen("period"), text("Payroll for this period was already sent."),
    refuses("corp.payroll.register", "PAYROLL_ALREADY_RUN", register({ period: "2026-10" })),
  ]),
  T("T-3", "A period in the future, a pay date that is not a working day and no date are refused", ["AC-1"], alpha, [
    screen("period"), noText("December 2026"), set({ "pr.date": "2026-11-07" }), press("Continue"), screen("period"), text("Choose a working day."), set({ "pr.date": "2026-11-09" }), press("Continue"), screen("period"), text("Choose a working day."),
    set({ "pr.date": "" }), press("Continue"), screen("period"), error("pr.date"),
    refuses("corp.payroll.register", "INVALID_PERIOD", register({ period: "2026-12" })), refuses("corp.payroll.register", "DATE_REQUIRED", register({ payDate: "" })), refuses("corp.payroll.register", "INVALID_PERIOD", register({ period: "next year" })),
  ]),
  T("T-4", "September 2026 is open and has no earlier month to compare with; the period can be chosen when the run is opened (launch.period)", ["AC-1"], alpha, [
    screen("period"), text("September 2026"), set({ "pr.date": DATE }), press("Continue"), screen("people"), noText("on last month"), text("8 employees"),
  ], { launch: { "launch.period": "2026-09" } }),
  T("T-5", "Ali Hamdan's net pay set to 6,000 is above the maximum of $5,400.00: it is marked and the step cannot go on; the bank refuses it too", ["AC-3"], alpha, [
    ...toPeople, ...pay("emp_ali", "6000"), text("Above the maximum of $5,400.00."), text("Needs fixing"), press("Review"), screen("people"), text("Fix or remove the people marked."),
    ...pay("emp_ali", "5400"), noText("Above the maximum"), ...pay("emp_ali", "5400.01"), text("Above the maximum of $5,400.00."),
  ]),
  T("T-6", "A pay of zero, one that is not an amount, or one with too many decimals is marked", ["AC-3"], alpha, [
    ...toPeople, ...pay("emp_ali", "0"), text("Pay must be above zero."), ...pay("emp_ali", "12.345"), text("Enter an amount with up to 2 decimals."), ...pay("emp_ali", "abc"), text("Enter an amount with up to 2 decimals."), ...pay("emp_ali", "3600"), noText("Needs fixing."),
  ]),
  T("T-7", "A bonus of 500 to Sana Malik makes her pay $5,300.00 with the line under her name; a deduction takes from it; a line is removed", ["AC-3", "AC-4"], alpha, [
    ...toPeople, press("emp_sana"), screen("edit"), text("Sana Malik"), text("Sales · pays in USD"), set({ "pr.amt": "500" }), press("Bonus"), screen("people"), text("$5,300.00"), text("Bonus +$500.00"), text("$18,300.00 + £3,000.00"),
    press("emp_sana"), set({ "pr.amt": "120.50" }), press("Deduction"), screen("people"), text("$5,179.50"), text("Deduction -$120.50"),
    press("emp_sana"), text("Bonus +$500.00"), press("Bonus +$500.00"), screen("people"), text("$4,679.50"), noText("Bonus +$500.00"), text("Deduction -$120.50"),
  ]),
  T("T-8", "A bonus or deduction of zero or nothing is refused with the toast text; both buttons are gone when the options are off and the bank refuses the lines", ["AC-4"], alpha, [
    ...toPeople, press("emp_sana"), screen("edit"), noText("Bonus"), noText("Deduction"),
    refuses("corp.payroll.register", "BONUS_NOT_ALLOWED", { op: "bonus", employeeId: "emp_sana", amount: "5", allowBonus: false }), refuses("corp.payroll.register", "DEDUCTION_NOT_ALLOWED", { op: "deduction", employeeId: "emp_sana", amount: "5", allowDeduction: false }),
  ], { launch: { "opt.allowBonus": false, "opt.allowDeduction": false } }),
  T("T-9", "A bonus of nothing shows Enter an amount above zero", ["AC-4"], alpha, [...toPeople, press("emp_sana"), press("Bonus"), screen("people"), text("Enter an amount above zero")]),
  T("T-10", "Remove takes Hina Rauf out (the total falls and she is listed as Removed) and pressing her adds her back", ["AC-2", "AC-4"], alpha, [
    ...toPeople, ...out("emp_hina"), text("7 employees"), text("$11,400.00 + £3,000.00"), text("Not in this run"), text("Hina Rauf"), text("Removed"), noText("$6,400.00"),
    press("emp_hina"), screen("people"), text("8 employees"), text("$17,800.00 + £3,000.00"), text("$6,400.00"),
  ]),
  T("T-11", "Sana Malik, Hina Rauf and Bilal Ahmed out: the total is down 46% on last month and a reason is asked; without one the bank refuses to go on", ["AC-5"], alpha, [
    ...toPeople, ...out("emp_sana"), ...out("emp_hina"), ...out("emp_bilal"), text("The total is down 46% on last month."), text("Reason for the change"), press("Review"), screen("people"), text("Add a short reason."),
    set({ "pr.reason": "x".repeat(141) }), press("Review"), screen("people"), error("pr.reason"),
    set({ "pr.reason": "Three leavers in October" }), press("Review"), screen("review"), text("5"),
    refuses("corp.payroll.check", "REASON_REQUIRED", { reason: "" }),
  ]),
  T("T-12", "A bonus that lifts the total more than 20% asks for a reason, and a rise is up not down", ["AC-5"], alpha, [
    ...toPeople, press("emp_ali"), set({ "pr.amt": "1800" }), press("Bonus"), press("emp_sana"), set({ "pr.amt": "2400" }), press("Bonus"), press("emp_bilal"), set({ "pr.amt": "1500" }), press("Bonus"),
    press("emp_hina"), set({ "pr.amt": "3200" }), press("Bonus"), screen("people"), text("The total is up 29% on last month."), text("Reason for the change"),
  ]),
  T("T-13", "With varianceCheck off no reason is asked however the total moves", ["AC-5"], alpha, [...toPeople, ...out("emp_sana"), ...out("emp_hina"), ...out("emp_bilal"), noText("on last month"), noText("Reason for the change"), press("Review"), screen("review")], { launch: { "opt.varianceCheck": false } }),
  T("T-14", "A debit above the balance blocks the step with the message", ["AC-6"], alpha, [
    ...toPeople, text("There isn’t enough money in this account."), noText("balance after"), press("Review"), screen("people"), text("There isn’t enough money in this account."),
  ], { setup: [{ adapter: "corp.sandbox.arrange", input: { op: "balance", accountId: "alpha_ops", balance: 20_000 } }] }),
  T("T-15", "With nobody in the run: Nobody in this run, and Review says to add at least one person", ["AC-2"], alpha, [
    ...toPeople, ...ALL.flatMap(out), text("Nobody in this run"), text("Add someone back to continue."), text("None"), press("Review"), screen("people"), text("Add at least one person."),
    refuses("corp.payroll.check", "EMPTY_BATCH", { reason: "x" }),
  ]),
  T("T-16", "Faris Qasem has no bank details: he is listed with the reason, cannot be added, and the bank refuses it", ["AC-2"], alpha, [
    ...toPeople, text("Faris Qasem"), text("No bank details"), press("emp_faris"), screen("people"), text("No bank details."), text("8 employees"),
    refuses("corp.payroll.register", "NO_BANK_DETAILS", { op: "addBack", employeeId: "emp_faris" }), refuses("corp.payroll.register", "NOT_AN_EMPLOYEE", { op: "net", employeeId: "emp_nobody", amount: "5" }),
  ]),
  T("T-17", "The review needs the tick, and Back returns to the employees", ["AC-7"], alpha, [...toReview, press("Submit for approval"), screen("review"), error("pr.consent"), press("Back"), screen("people")]),
  T("T-18", "A code is always asked, even for a small run; the extra line is only from 25,000.00", ["AC-7"], alpha, [
    ...toPeople, ...out("emp_hina"), ...out("emp_noura"), ...out("emp_lena"), ...out("emp_khalid"), ...out("emp_rana"), ...out("emp_sana"), ...out("emp_bilal"), press("Review"), screen("review"), set({ "pr.consent": true }), press("Submit for approval"), screen("otp"),
    text("Authorise payroll November 2026: $3,600.00"), noText("This amount needs an extra code."),
  ], { launch: { "opt.varianceCheck": false } }),
  T("T-19", "Three wrong codes stop the run and nothing is created", ["AC-7"], alpha, [
    ...toCode, set({ "otp.code": "111111" }), press("Submit for approval"), screen("otp"), set({ "otp.code": "111111" }), press("Submit for approval"), screen("otp"), set({ "otp.code": "111111" }), press("Submit for approval"), screen("locked"),
    text("We couldn’t confirm this payroll run."), noRun, noMoney,
  ]),
  T("T-20", "A code that is not six digits is stopped before the bank is asked, and the bank refuses the run without the code", ["AC-7"], alpha, [...toCode, set({ "otp.code": "12" }), press("Submit for approval"), screen("otp"), error("otp.code"), noRun, refuses("corp.payroll.submit", "OTP_REQUIRED", { payslips: true }), noRun]),
  T("T-21", "The person who started the run cannot approve it, the code is used up, and the period is taken once it is sent", ["AC-7", "AC-8"], alpha, [
    ...toCode, ...send, refuses("corp.payments.approve", "PERMISSION_DENIED", { paymentId: "PAY-2042" }), refuses("corp.payroll.register", "PAYROLL_ALREADY_RUN", register()),
    bank("corp.payments.track", "rows.PAY-2042.statusKey", "pending_approval", { status: "all" }), noMoney,
  ]),
  T("T-22", "A run that is withdrawn frees the period again", ["AC-8"], alpha, [
    ...toCode, ...send, bank("corp.payments.withdraw", "statusKey", "withdrawn", { paymentId: "PAY-2042" }), bank("corp.payroll.register", "count", 8, register()),
  ]),
  T("T-23", "Above 50,000.00 the run needs two approvers (the company's threshold, lowered for the test), and the review and the result say so", ["AC-8"], alpha, [
    ...toReview, text("Approvals needed"), text("2"), set({ "pr.consent": true }), press("Submit for approval"), ...send, text("Waiting for 2 approvers"),
  ], { setup: [{ adapter: "corp.sandbox.arrange", input: { op: "dualAbove", amount: 25_000 } }] }),
  T("T-24", "One approver at or below the threshold", ["AC-8"], alpha, [...toReview, text("Approvals needed"), text("1"), noText("Waiting for 2 approvers")]),
  T("T-25", "A timeout on the run shows the check-Payments message and no run is created", ["AC-9"], alpha, [
    ...toCode, set({ "otp.code": "482100" }), press("Submit for approval"), screen("timeout"), text("We didn’t get an answer in time. Check Payments before you try again, so you don’t pay twice."), noRun, noMoney,
  ], { conditions: { timeout: ["corp.payroll.submit"], latencyMs: 10_000 } }),
  T("T-26", "An unavailable bank on the run shows the sheet and no run is created; Try again goes back to the review", ["AC-9"], alpha, [
    ...toCode, set({ "otp.code": "482100" }), press("Submit for approval"), screen("unavailable"), text("We couldn’t reach the bank"), text("Nothing was sent and you haven’t been charged. Try again in a moment."), noRun, press("Try again"), screen("review"),
  ], { conditions: { unavailable: ["corp.payroll.submit"] } }),
  T("T-27", "The register not loading shows the sheet; the check before the review not answering shows the sheet and Try again goes back to the employees", ["AC-9"], alpha, [screen("unavailable"), text("We couldn’t reach the bank"), press("Try again"), screen("unavailable")], { conditions: { unavailable: ["corp.payroll.register"] } }),
  T("T-28", "The check before the review not answering shows the sheet; Try again goes back to the employees", ["AC-9"], alpha, [...toPeople, press("Review"), screen("unavailable"), press("Try again"), screen("people")], { conditions: { unavailable: ["corp.payroll.check"] } }),
  T("T-29", "A slow check says so and changes nothing", ["AC-9"], alpha, [...toPeople, press("Review"), screen("slow"), text("This is taking longer than expected. Nothing was changed."), press("Try again"), screen("people")], { conditions: { timeout: ["corp.payroll.check"], latencyMs: 10_000 } }),
  T("T-30", "The code not being sent shows the sheet and Try again goes back to the review", ["AC-9"], alpha, [...toReview, set({ "pr.consent": true }), press("Submit for approval"), screen("unavailable"), press("Try again"), screen("review")], { conditions: { unavailable: ["bank.otp.send"] } }),
  T("T-31", "The accounts not loading shows the sheet", ["AC-9"], alpha, [screen("unavailable")], { conditions: { unavailable: ["corp.accounts.list"] } }),
  T("T-32", "The person's limit is checked before the code: a run that would take them over their day is refused with its words, and no code is asked", ["AC-6"], alpha, [
    ...toReview, set({ "pr.consent": true }), press("Submit for approval"), screen("problem"), text("This is above your payment limit."), text("Nothing was sent."), noRun, press("Change the run"), screen("people"),
  ], { setup: [{ adapter: "corp.sandbox.arrange", input: { op: "userUsed", userId: "alex", amount: 240_000 } }] }),
  T("T-33", "The company's limit is checked before the code too, with its words", ["AC-6"], alpha, [
    ...toReview, set({ "pr.consent": true }), press("Submit for approval"), screen("problem"), text("This is above the company limit."), noRun,
  ], { setup: [{ adapter: "corp.sandbox.arrange", input: { op: "companyUsed", amount: 990_000 } }] }),
  T("T-34", "A role without the permission lands on the no-access card, and the bank refuses the same calls", ["AC-10"], { persona: "alex", context: "beta", now: NOW }, [
    screen("denied"), text("You can’t run payroll at this company"), text("The bank checks this on its side too"),
    refuses("corp.payroll.register", "PERMISSION_DENIED", { op: "options" }), refuses("corp.payroll.check", "PERMISSION_DENIED", {}), refuses("corp.payroll.submit", "PERMISSION_DENIED", {}),
  ]),
  T("T-35", "From Personal the bank does not answer for a company's payroll", ["AC-10"], { persona: "alex", now: NOW }, [screen("denied"), refuses("corp.payroll.register", "WRONG_CONTEXT", { op: "options" })]),
  T("T-36", "Another person's name cannot be used, and an account the person may not pay from is refused", ["AC-10"], alpha, [
    screen("period"), refuses("corp.payroll.register", "PERMISSION_DENIED", { userId: "tess_m", op: "options" }), refuses("corp.payroll.register", "ACCOUNT_NOT_PERMITTED", register({ fromAccountId: "alpha_res" })),
  ]),
  T("T-37", "The payslips switch follows the option; Track payment opens the Payment tracker", ["AC-11"], alpha, [...toReview, noText("Send payslips")], { launch: { "opt.payslips": false } }),
  T("T-38", "Track payment opens the Payment tracker at the run", ["AC-7"], alpha, [...toCode, ...send, press("Track payment"), opens("payment-tracker", { "launch.paymentId": "PAY-2042" })]),
  T("T-39", "Back from the first step cancels, and Back from the employees returns to the first step", ["AC-1"], alpha, [...toPeople, press("Back"), screen("period"), press("Cancel"), screen("period")]),
  T("T-40", "The card of a person shows only that person's pay: the review and the receipt show totals and counts, no one's name or pay", ["AC-11"], alpha, [
    ...toCode, noText("Ali Hamdan"), noText("Sana Malik"), noText("$3,600.00"), ...send, noText("Ali Hamdan"), noText("Sana Malik"), noText("$4,800.00"),
  ]),
];
