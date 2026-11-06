import type { Journey, Screen } from "../schema";
import { businessStatementAcceptance, businessStatementScenarios } from "./business-statement-tests";
import { alert, button, denyScreen, failScreens, go, is, lacks, NOW_DENIED, route, set, text, toRoute } from "./business-kit";

const STEPPER = { type: "stepper" as const, steps: ["accounts", "delivery"] };
const FORMAT_TIPS = "PDF, CSV and Excel are always offered.";
const SEND = {
  accountIds: "{{bs.picked}}", type: "{{bs.type}}", period: "{{bs.period}}", from: "{{bs.from}}", to: "{{bs.to}}", format: "{{bs.format}}", recipients: "{{bs.recipients}}",
  bankFormats: "{{opt.bankFormats == true}}", intraday: "{{opt.intraday == true}}", external: "{{opt.external == true}}", schedule: "{{opt.schedule != false}}",
};
const when = (id: string, ...codes: string[]) => ({ type: "alert" as const, tone: "error" as const, text: id, visibleWhen: is(...codes) });

/** The words the bank's codes get on the two steps, as the spec has them. */
const BANNERS = (ids: [string, string[]][]): ReturnType<typeof when>[] => ids.map(([t, codes]) => when(t, ...codes));

const sendButton = (label: string, integration: string, extra: Record<string, unknown>, visibleWhen: string, next: string) => button(label, [
  set("ctx.error", null),
  { type: "callApi", integration, input: { ...SEND, ...extra }, saveAs: "bs.result", onError: toRoute },
  go(next),
], "primary", visibleWhen);

/**
 * Business statement (BankWorkx Business, Accounts). A statement or a report for one or several accounts, sent by email once or on a schedule, as PDF, CSV or Excel
 * (and the bank formats when the bank offers them). Only accounts the person may export are listed. Nothing is charged, no money moves and no code is asked; the
 * recipients are addresses at the company unless the bank allows others, and every send is written to the audit trail.
 *
 * Built from the spec with the blocks FinX has (docs/BANKWORKX.md): the bank checks the accounts and the period when Continue is pressed (it says which field is wrong
 * in words, there are no per-field messages), the format and day choices of the spec are chips of different lists shown by the type, and the busy text is not drawn.
 */
export const businessStatement: Journey = {
  id: "jrn_business_statement",
  slug: "business-statement",
  name: "Statements and reports",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: businessStatementAcceptance,
  scenarios: businessStatementScenarios,
  dataModel: {
    "launch.accountId": { type: "string" }, "launch.from": { type: "string" }, "launch.to": { type: "string" },
    "opt.bankFormats": { type: "boolean" }, "opt.intraday": { type: "boolean" }, "opt.schedule": { type: "boolean" }, "opt.external": { type: "boolean" },
    "bs.type": { type: "string" }, "bs.picked": { type: "object" }, "bs.period": { type: "string" }, "bs.from": { type: "string" }, "bs.to": { type: "string" },
    "bs.format": { type: "string" }, "bs.delivery": { type: "string" }, "bs.frequency": { type: "string" }, "bs.wday": { type: "string" }, "bs.mday": { type: "string" },
    "bs.recipients": { type: "string" }, "bs.result": { type: "object" },
  },
  integrations: [
    { id: "accounts", adapter: "corp.accounts.list", mode: "sandbox" },
    { id: "schedules", adapter: "corp.statements.list", mode: "sandbox" },
    { id: "check", adapter: "corp.statements.check", mode: "sandbox" },
    { id: "send", adapter: "corp.statements.generate", mode: "sandbox" },
    { id: "schedule", adapter: "corp.statements.schedule", mode: "sandbox" },
  ],
  screens: [
    {
      // the accounts the person may export, the schedules that exist (and the default address); opened with an account only that one is ticked
      id: "start", title: "Statements and reports", kind: "branch",
      onEnter: [
        set("ctx.error", null),
        { type: "callApi", integration: "accounts", input: { for: "export" }, saveAs: "ctx.accts", onError: toRoute },
        { type: "callApi", integration: "schedules", input: { accountId: "{{launch.accountId}}" }, saveAs: "ctx.sch", onError: toRoute },
        set("launch.accountId", ""),
        set("bs.type", "eod"), set("bs.picked", "{{ctx.sch.picked}}"), set("bs.period", "last"), set("bs.from", ""), set("bs.to", ""), set("bs.format", "pdf"), set("bs.delivery", "once"),
        set("bs.frequency", "weekly"), set("bs.wday", "mon"), set("bs.mday", "1"), set("bs.recipients", "{{ctx.sch.defaultRecipient}}"), set("bs.result", null),
        go("step1"),
      ],
      navigation: route([lacks("biz.accounts.view"), "denied"], ["len(ctx.accts) == 0", "none"], ["!isEmpty(launch.from) && !isEmpty(launch.to)", "pickCustom"]),
      blocks: [],
    },
    { id: "pickCustom", title: "Statements and reports", kind: "branch", onEnter: [set("bs.period", "custom"), set("bs.from", "{{launch.from}}"), set("bs.to", "{{launch.to}}"), set("launch.from", ""), set("launch.to", ""), go("step1")], blocks: [] },
    {
      id: "step1", title: "Statements and reports",
      blocks: [
        STEPPER,
        text("Step 1 of 2 · Statements and reports", "caption"),
        text("Accounts and period", "title"),
        { type: "select", bind: "bs.type", label: "Type", choices: [{ id: "eod", label: "End of day" }, { id: "intraday", label: "Today so far" }], visibleWhen: "opt.intraday == true" },
        ...BANNERS([
          ["Choose at least one account.", ["ACCOUNT_REQUIRED"]], ["You can’t export this account.", ["ACCOUNT_NOT_PERMITTED"]], ["That format isn’t available.", ["FORMAT_NOT_ENABLED"]],
        ]),
        { type: "dataTable", source: "ctx.accts", label: "Accounts", bind: "bs.picked", columns: [{ key: "option", label: "Account" }] },
        {
          type: "select", bind: "bs.period", label: "Period", visibleWhen: "bs.type != 'intraday'",
          choices: [{ id: "7d", label: "Last 7 days" }, { id: "month", label: "This month" }, { id: "last", label: "Last month" }, { id: "3m", label: "Last 3 months" }, { id: "custom", label: "Custom" }],
        },
        { type: "dateInput", bind: "bs.from", label: "From", placeholder: "Start date", visibleWhen: "bs.type != 'intraday' && bs.period == 'custom'" },
        { type: "dateInput", bind: "bs.to", label: "To", placeholder: "End date", visibleWhen: "bs.type != 'intraday' && bs.period == 'custom'" },
        alert("error", "{{ctx.error.message}}", is("INVALID_RANGE", "PERIOD_TOO_LONG")),
        alert("error", "We didn’t get an answer in time. Nothing was changed.", "ctx.error.code == 'TIMEOUT'"),
        button("Continue", [
          set("ctx.error", null),
          { type: "callApi", integration: "check", input: { ...SEND }, onError: toRoute },
          go("step2"),
        ]),
        button("Cancel", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "step2", title: "Statements and reports",
      blocks: [
        STEPPER,
        text("Step 2 of 2 · Statements and reports", "caption"),
        text("Format and delivery", "title"),
        { type: "select", bind: "bs.format", label: "Format", visibleWhen: "opt.bankFormats != true", choices: [{ id: "pdf", label: "PDF" }, { id: "csv", label: "CSV" }, { id: "excel", label: "Excel" }] },
        { type: "select", bind: "bs.format", label: "Format", visibleWhen: "opt.bankFormats == true && bs.type != 'intraday'", choices: [{ id: "pdf", label: "PDF" }, { id: "csv", label: "CSV" }, { id: "excel", label: "Excel" }, { id: "bai2", label: "BAI2" }, { id: "mt940", label: "MT940" }, { id: "camt053", label: "camt.053" }] },
        { type: "select", bind: "bs.format", label: "Format", visibleWhen: "opt.bankFormats == true && bs.type == 'intraday'", choices: [{ id: "pdf", label: "PDF" }, { id: "csv", label: "CSV" }, { id: "excel", label: "Excel" }, { id: "bai2", label: "BAI2" }, { id: "mt942", label: "MT942" }, { id: "camt052", label: "camt.052" }] },
        { type: "select", bind: "bs.delivery", label: "Delivery", visibleWhen: "opt.schedule != false", choices: [{ id: "once", label: "Send once" }, { id: "schedule", label: "Schedule" }] },
        { type: "select", bind: "bs.frequency", label: "How often", visibleWhen: "bs.delivery == 'schedule' && opt.schedule != false", choices: [{ id: "daily", label: "Daily" }, { id: "weekly", label: "Weekly" }, { id: "monthly", label: "Monthly" }] },
        { type: "select", bind: "bs.wday", label: "Day", visibleWhen: "bs.delivery == 'schedule' && opt.schedule != false && bs.frequency == 'weekly'", choices: [{ id: "mon", label: "Monday" }, { id: "tue", label: "Tuesday" }, { id: "fri", label: "Friday" }] },
        { type: "select", bind: "bs.mday", label: "Day", visibleWhen: "bs.delivery == 'schedule' && opt.schedule != false && bs.frequency == 'monthly'", choices: [{ id: "1", label: "1st" }, { id: "5", label: "5th" }, { id: "last", label: "Last business day" }] },
        { type: "textInput", bind: "bs.recipients", label: "Send to", placeholder: "name@company.example", lines: 2 },
        text("Up to 5 addresses, separated by commas.", "caption"),
        ...BANNERS([
          ["Check the email addresses. Use up to 5, separated by commas.", ["INVALID_RECIPIENT"]], ["You can only send to addresses at your company.", ["EXTERNAL_RECIPIENT_BLOCKED"]],
          ["That format isn’t available.", ["FORMAT_NOT_ENABLED"]], ["There are no transactions in that period. Choose another period.", ["NO_TRANSACTIONS"]],
          ["You can’t export this account.", ["ACCOUNT_NOT_PERMITTED"]], ["You already have 10 schedules. Remove one first.", ["SCHEDULE_LIMIT"]],
          ["Choose how often.", ["INVALID_SCHEDULE"]], ["We didn’t get an answer in time. Nothing was changed.", ["TIMEOUT"]],
        ]),
        alert("error", "{{ctx.error.message}}", is("INVALID_RANGE", "PERIOD_TOO_LONG", "ACCOUNT_REQUIRED")),
        sendButton("Send", "send", {}, "bs.delivery != 'schedule' || opt.schedule == false", "resultOnce"),
        sendButton("Send", "schedule", { action: "create", frequency: "{{bs.frequency}}", day: "{{bs.frequency == 'weekly' ? bs.wday : bs.mday}}" }, "bs.delivery == 'schedule' && opt.schedule != false", "resultSchedule"),
        button("Back", [set("ctx.error", null), go("step1")], "ghost"),
      ],
    },
    {
      id: "resultOnce", title: "Statement sent", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Statement sent", text: "It is on its way to {{bs.result.recipients}}.", meta: "Reference {{bs.result.reference}}" },
        { type: "statusChip", status: "sent", label: "{{bs.result.formatText}}", tone: "info" },
        { type: "reviewSummary", rows: [{ label: "Accounts", value: "{{bs.result.accounts}}" }, { label: "Period", value: "{{bs.result.period}}" }, { label: "Format", value: "{{bs.result.formatText}}" }, { label: "Sent to", value: "{{bs.result.recipients}}" }] },
        button("Schedule this", [set("bs.delivery", "schedule"), set("ctx.error", null), go("step2")], "secondary", "opt.schedule != false"),
        button("Send another", [go("start")], "secondary"),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "resultSchedule", title: "Schedule created", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Schedule created", text: "{{bs.result.formatText}} statements will be sent {{bs.result.frequencyText}}.", meta: "Reference {{bs.result.reference}}" },
        { type: "statusChip", status: "scheduled", label: "{{bs.result.count}} of {{bs.result.max}} schedules", tone: "info" },
        { type: "reviewSummary", rows: [{ label: "Accounts", value: "{{bs.result.accounts}}" }, { label: "Format", value: "{{bs.result.formatText}}" }, { label: "How often", value: "{{bs.result.how}}" }, { label: "First one", value: "{{bs.result.first}}" }, { label: "Sent to", value: "{{bs.result.recipients}}" }] },
        button("New statement", [go("start")], "secondary"),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "none", title: "Statements and reports", kind: "terminal",
      blocks: [text("No account to export", "title"), text("You can’t export any account at this company. Ask an administrator for access.", "body"), button("Done", [{ type: "exit" }], "ghost")],
    },
    ...statementFailures(),
    { id: "loadFail", title: "Statements and reports", kind: "terminal", blocks: [text("We couldn’t load your accounts", "title"), text("Nothing was changed. Please try again.", "body"), button("Try again", [go("start")]), button("Done", [{ type: "exit" }], "ghost")] },
  ] as Screen[],
};

/** A slow answer to a statement is a banner on the step it came from (nothing was sent, so it is safe to try again); the bank being down is the sheet. */
function statementFailures(): Screen[] {
  const base = failScreens({ title: "Statements and reports", unavailable: "Nothing was sent and you haven’t been charged. Try again in a moment.", denied: "You can’t send statements at this company", retry: [["check", "step1"], ["send", "step2"], ["schedule", "step2"]] });
  return base.filter((s) => ["unavailable", "retry"].includes(s.id)).concat([
    {
      id: "route", title: "One moment", kind: "branch", onEnter: [go("loadFail")], blocks: [],
      navigation: {
        rules: [
          { when: NOW_DENIED, to: "denied" },
          { when: "ctx.error.integration == 'accounts' || ctx.error.integration == 'schedules'", to: "loadFail" },
          { when: "ctx.error.code == 'SERVICE_UNAVAILABLE'", to: "unavailable" },
          { when: "ctx.error.integration == 'check'", to: "step1" },
          { when: "ctx.error.integration == 'send' || ctx.error.integration == 'schedule'", to: "step2" },
        ],
      },
    } as Screen,
    denyScreen("Statements and reports", "send statements"),
  ]);
}

void FORMAT_TIPS;
