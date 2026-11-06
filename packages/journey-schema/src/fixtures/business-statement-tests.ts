import type { Journey } from "../schema";
import { steps } from "./business-kit";

const { press, text, noText, screen, set, refuses, bank } = steps;

/** What must be true for "Statements and reports" to be right (the spec's criteria; the bank's own refusals are proved by forced calls). */
export const businessStatementAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "Only accounts the person may export are listed and ticked; at least one must stay ticked, and the bank refuses an account the person may not export." },
  { id: "AC-2", text: "A custom period needs both dates, in order, within 24 months; the bank says which is wrong in the words of the spec." },
  { id: "AC-3", text: "PDF, CSV and Excel are always offered; the bank formats (BAI2, MT940, camt.053) appear only when bankFormats is on, and no other format name appears otherwise." },
  { id: "AC-4", text: "Recipients are 1 to 5 valid addresses at the company unless external is on, with the words of the spec." },
  { id: "AC-5", text: "A one-off statement with no booked transactions in the period is refused with \"There are no transactions in that period. Choose another period.\"" },
  { id: "AC-6", text: "A schedule can be created when schedule is on and fewer than ten exist, and its result shows the first run and how many of ten there are; the eleventh is refused." },
  { id: "AC-7", text: "Today so far appears only with intraday, includes the pending items of today and hides the period; the bank refuses it when intraday is off." },
  { id: "AC-8", text: "A timeout shows its message on the step, the bank being unavailable shows the sheet, and in both nothing is sent and no schedule is made." },
  { id: "AC-9", text: "Opened with an account only that account is ticked; opened with a period from Accounts the period is Custom with those dates." },
];

const NOW = "2026-11-03T10:42:00Z";
const alpha = { persona: "alex", context: "alpha", now: NOW };
const beta = { persona: "alex", context: "beta", now: NOW };
type Scenario = NonNullable<Journey["scenarios"]>[number];
const T = (id: string, name: string, covers: string[], base: Record<string, unknown>, stepList: Record<string, unknown>[], extra: Record<string, unknown> = {}): Scenario => ({ id, name, covers, ...base, ...extra, steps: stepList } as Scenario);
const next = [press("Continue"), screen("step2")];
const lists = (count: number) => bank("corp.statements.list", "count", count);
const fill = (count: number) => ({ setup: [{ adapter: "corp.sandbox.arrange", input: { op: "fillStatements", count } }] });

export const businessStatementScenarios: NonNullable<Journey["scenarios"]> = [
  T("T-1", "Alex at Alpha: every account ticked, Last month, PDF, to his own address: Statement sent", ["AC-1", "AC-3"], alpha, [
    screen("step1"), text("Statements and reports"), text("Operating ••2001 · USD"), text("Reserve ••2044 · EUR"), text("Last month"), noText("Today so far"), ...next,
    text("PDF"), text("CSV"), text("Excel"), noText("BAI2"), text("alex.morgan@alpha-trading.example"), text("Send once"), press("Send"),
    screen("resultOnce"), text("Statement sent"), text("It is on its way to alex.morgan@alpha-trading.example."), text("Operating, Reserve"), text("Thu 1 Oct 2026 to Sat 31 Oct 2026"), text("Reference STM-20261103-0001"),
  ]),
  T("T-2", "Alex at Beta: only Operating is listed (Payroll is view only); nothing ticked is refused", ["AC-1"], beta, [
    screen("step1"), text("Operating ••3001 · USD"), noText("Payroll"), set({ "bs.picked": [] }), press("Continue"), screen("step1"), text("Choose at least one account."),
    refuses("corp.statements.generate", "ACCOUNT_NOT_PERMITTED", { accountIds: ["beta_pay"], type: "eod", period: "last", format: "pdf", recipients: "alex.morgan@beta-services.example" }),
    refuses("corp.statements.check", "ACCOUNT_REQUIRED", { accountIds: [], period: "last" }),
  ]),
  T("T-3", "A custom period whose end is before its start: The end date is before the start date.", ["AC-2"], alpha, [
    set({ "bs.period": "custom", "bs.from": "2026-10-10", "bs.to": "2026-10-01" }), press("Continue"), screen("step1"), text("The end date is before the start date."),
  ]),
  T("T-4", "A custom period of three years is refused; exactly 24 months is accepted; without dates it asks for them", ["AC-2"], alpha, [
    set({ "bs.period": "custom", "bs.from": "2023-11-03", "bs.to": "2026-11-03" }), press("Continue"), screen("step1"), text("Choose up to 24 months at a time."),
    set({ "bs.from": "2024-11-02" }), press("Continue"), screen("step1"), text("Choose up to 24 months at a time."),
    set({ "bs.from": "2024-11-03" }), press("Continue"), screen("step2"), press("Back"), screen("step1"),
    set({ "bs.from": "", "bs.to": "" }), press("Continue"), screen("step1"), text("Choose a start and an end date."),
  ]),
  T("T-5", "With bankFormats on, BAI2, MT940 and camt.053 are offered; with it off they are not", ["AC-3"], alpha, [...next, text("BAI2"), text("MT940"), text("camt.053"), noText("MT942")], { launch: { "opt.bankFormats": true } }),
  T("T-6", "With bankFormats off the bank refuses a bank format even when asked directly", ["AC-3"], alpha, [...next, text("PDF"), noText("BAI2"), noText("MT940"), noText("camt.053"), refuses("corp.statements.generate", "FORMAT_NOT_ENABLED", { accountIds: ["alpha_ops"], type: "eod", period: "last", format: "mt940", recipients: "alex.morgan@alpha-trading.example" })]),
  T("T-7", "An address outside the company is refused; with external on it is sent", ["AC-4"], alpha, [
    ...next, set({ "bs.recipients": "bob@outside.example" }), press("Send"), screen("step2"), text("You can only send to addresses at your company."),
  ]),
  T("T-8", "With external on an outside address is sent", ["AC-4"], alpha, [...next, set({ "bs.recipients": "bob@outside.example" }), press("Send"), screen("resultOnce"), text("It is on its way to bob@outside.example.")], { launch: { "opt.external": true } }),
  T("T-9", "Six addresses, or something that is not an address, is refused with the spec's words", ["AC-4"], alpha, [
    ...next, set({ "bs.recipients": "a@alpha-trading.example, b@alpha-trading.example, c@alpha-trading.example, d@alpha-trading.example, e@alpha-trading.example, f@alpha-trading.example" }), press("Send"), screen("step2"), text("Check the email addresses. Use up to 5, separated by commas."),
    set({ "bs.recipients": "not an email" }), press("Send"), text("Check the email addresses. Use up to 5, separated by commas."),
    set({ "bs.recipients": "one@alpha-trading.example, two@alpha-trading.example" }), press("Send"), screen("resultOnce"), text("one@alpha-trading.example, two@alpha-trading.example"),
  ]),
  T("T-10", "A custom period with no transactions is refused when it is sent", ["AC-5"], alpha, [
    set({ "bs.period": "custom", "bs.from": "2026-01-05", "bs.to": "2026-01-10" }), ...next, press("Send"), screen("step2"), text("There are no transactions in that period. Choose another period."), press("Back"), screen("step1"),
  ]),
  T("T-11", "A schedule, Weekly on Friday: Schedule created, the first one Fri 6 Nov, 2 of 10 schedules", ["AC-6"], alpha, [
    ...next, set({ "bs.delivery": "schedule" }), text("How often"), set({ "bs.frequency": "weekly", "bs.wday": "fri" }), press("Send"),
    screen("resultSchedule"), text("Schedule created"), text("PDF statements will be sent weekly."), text("Weekly, Friday"), text("Fri 6 Nov"), text("2 of 10 schedules"), text("alex.morgan@alpha-trading.example"), lists(2),
  ]),
  T("T-12", "A monthly schedule on the last business day and a daily one: the first run follows the clock", ["AC-6"], alpha, [
    ...next, set({ "bs.delivery": "schedule" }), set({ "bs.frequency": "monthly", "bs.mday": "last" }), press("Send"), screen("resultSchedule"), text("Monthly, last business day"), text("Mon 30 Nov"),
    press("New statement"), ...next, set({ "bs.delivery": "schedule" }), set({ "bs.frequency": "daily" }), press("Send"), text("Daily"), text("Wed 4 Nov"), text("3 of 10 schedules"),
  ]),
  T("T-13", "Ten schedules exist: the eleventh is refused and nothing is made", ["AC-6", "AC-8"], alpha, [
    ...next, set({ "bs.delivery": "schedule" }), press("Send"), screen("step2"), text("You already have 10 schedules. Remove one first."), lists(10),
  ], fill(10)),
  T("T-14", "Nine schedules exist: the tenth is made", ["AC-6"], alpha, [...next, set({ "bs.delivery": "schedule" }), press("Send"), screen("resultSchedule"), text("10 of 10 schedules"), lists(10)], fill(9)),
  T("T-15", "With schedule off there is no Delivery choice and no Schedule this", ["AC-6"], alpha, [...next, noText("Send once"), noText("Schedule"), press("Send"), screen("resultOnce"), noText("Schedule this"), press("Send another"), screen("step1")], { launch: { "opt.schedule": false } }),
  T("T-16", "Today so far (intraday on): offered, hides the period, includes the pending items, and offers MT942 with bankFormats", ["AC-7"], alpha, [
    text("Today so far"), set({ "bs.type": "intraday" }), noText("Last month"), ...next, text("MT942"), text("camt.052"), noText("MT940"), set({ "bs.format": "mt942" }), press("Send"),
    screen("resultOnce"), text("Today so far"), text("MT942"),
  ], { launch: { "opt.intraday": true, "opt.bankFormats": true } }),
  T("T-17", "With intraday off there is no Today so far, and the bank refuses it", ["AC-7"], alpha, [
    screen("step1"), noText("Today so far"), refuses("corp.statements.check", "FORMAT_NOT_ENABLED", { accountIds: ["alpha_ops"], type: "intraday", period: "last" }),
  ]),
  T("T-18", "A timeout on Send is a message on the step and nothing is sent", ["AC-8"], alpha, [...next, press("Send"), screen("step2"), text("We didn’t get an answer in time. Nothing was changed."), noText("Statement sent")], { conditions: { timeout: ["corp.statements.generate"], latencyMs: 10000 } }),
  T("T-19", "A timeout on a schedule is a message and no schedule is made", ["AC-8"], alpha, [...next, set({ "bs.delivery": "schedule" }), press("Send"), screen("step2"), text("We didn’t get an answer in time. Nothing was changed."), lists(1)], { conditions: { timeout: ["corp.statements.schedule"], latencyMs: 10000 } }),
  T("T-20", "The bank being unavailable on Send shows the sheet, and Try again goes back to the step", ["AC-8"], alpha, [...next, press("Send"), screen("unavailable"), text("We couldn’t reach the bank"), text("Nothing was sent and you haven’t been charged. Try again in a moment."), press("Try again"), screen("step2")], { conditions: { unavailable: ["corp.statements.generate"] } }),
  T("T-21", "The bank being unavailable at the first step shows the sheet and Try again returns to step 1", ["AC-8"], alpha, [set({ "bs.period": "custom" }), press("Continue"), screen("unavailable"), press("Try again"), screen("step1"), text("Start date")], { conditions: { unavailable: ["corp.statements.check"] } }),
  T("T-22", "A schedule with the bank unavailable shows the sheet and makes no schedule", ["AC-8"], alpha, [...next, set({ "bs.delivery": "schedule" }), press("Send"), screen("unavailable"), lists(1), press("Try again"), screen("step2"), text("How often")], { conditions: { unavailable: ["corp.statements.schedule"] } }),
  T("T-23", "When the accounts cannot be loaded the journey says so and offers Try again", ["AC-8"], alpha, [screen("loadFail"), text("We couldn’t load your accounts"), press("Try again"), screen("loadFail")], { conditions: { unavailable: ["corp.accounts.list"] } }),
  T("T-24", "When the schedules cannot be read the journey says so", ["AC-8"], alpha, [screen("loadFail"), text("We couldn’t load your accounts")], { conditions: { unavailable: ["corp.statements.list"] } }),
  T("T-25", "Opened with an account (Export on Accounts): only that account is ticked", ["AC-9"], alpha, [screen("step1"), ...next, press("Send"), screen("resultOnce"), text("Reserve"), noText("Operating, Reserve")], { launch: { "launch.accountId": "alpha_res" } }),
  T("T-26", "Opened with an account and a period: the period is Custom with those dates", ["AC-9"], alpha, [text("Custom"), ...next, press("Send"), screen("resultOnce"), text("Mon 5 Oct 2026 to Tue 20 Oct 2026"), text("Operating")], { launch: { "launch.accountId": "alpha_ops", "launch.from": "2026-10-05", "launch.to": "2026-10-20" } }),
  T("T-27", "Schedule this on the result of a statement goes to the delivery step with Schedule chosen", ["AC-6"], alpha, [...next, press("Send"), screen("resultOnce"), press("Schedule this"), screen("step2"), text("How often")]),
  T("T-29", "A company none of whose accounts the person may export has nothing to send", ["AC-1"], { persona: "alexempty", context: "gamma", now: NOW }, [screen("none"), text("No account to export"), noText("Continue")]),
  T("T-28", "From Personal the bank does not answer for a company", ["AC-1"], { persona: "alex", now: NOW }, [screen("denied"), text("Switch to your business first"), refuses("corp.statements.check", "WRONG_CONTEXT", { accountIds: ["alpha_ops"], period: "last" })]),
];
