import type { Journey, Screen } from "../schema";
import { businessPayrollAcceptance, businessPayrollScenarios } from "./business-payroll-tests";
import { alert, button, failScreens, go, is, lacks, lockedScreen, lockOnWrongCode, route, set, text, toRoute } from "./business-kit";

const PERIOD_CODES = ["INVALID_PERIOD", "PAYROLL_ALREADY_RUN", "DATE_REQUIRED", "DATE_NOT_WORKING_DAY", "ACCOUNT_NOT_FOUND", "ACCOUNT_NOT_PERMITTED"];
const OP_CODES = ["INVALID_AMOUNT", "BONUS_NOT_ALLOWED", "DEDUCTION_NOT_ALLOWED", "NOT_AN_EMPLOYEE", "NO_BANK_DETAILS", "UNKNOWN_OP", "NO_RUN_STARTED"];
const PEOPLE_CODES = ["EMPTY_BATCH", "ROWS_NEED_FIXING", "INSUFFICIENT_FUNDS", "REASON_REQUIRED"];
const MONEY_CODES = ["LIMIT_USER_EXCEEDED", "LIMIT_COMPANY_EXCEEDED"];
const STEPPER = { type: "stepper" as const, steps: ["period", "people", "review"] };
const STATUSES = { ready: { label: "Ready", tone: "positive" as const }, fix: { label: "Needs fixing", tone: "negative" as const } };
const OPTIONS = { allowBonus: "{{opt.allowBonus != false}}", allowDeduction: "{{opt.allowDeduction != false}}", varianceCheck: "{{opt.varianceCheck != false}}" };
/** What the person did to the run (one change at a time): the bank applies it and gives the whole run back. */
const NO_OP = { op: "", employeeId: "", amount: "", kind: "", index: "" };
const op = (o: Partial<typeof NO_OP>) => Object.entries({ ...NO_OP, ...o }).map(([k, v]) => set(`pr.op.${k}`, v));

/**
 * Payroll run (BankWorkx Business, Payments). A Maker pays the employees for one pay period from the company's register (net pay already worked out in the payroll system;
 * tax and insurance are not calculated here): the period, the pay date and the account, then each person's pay (a bonus, a deduction, or out of the run), a review and a
 * one-time code that is always asked. The run waits for approval as ONE payment; nothing leaves the account until the approvers release it. The bank checks everything:
 * the register is the only source, a pay above 1.5 times the monthly salary is marked, a total that moves by more than 20% needs a reason, and the money must be there.
 *
 * Replaces, for BankWorkx, the Meezan journey of the same name, which reads a pasted file. Built from the spec with the blocks FinX has (docs/BANKWORKX.md): a row opens a
 * card in place of editing the pay in the table, and the payslip switch is saved with the run (no payslip is sent).
 */
export const businessPayroll: Journey = {
  id: "jrn_payroll_run_business",
  slug: "payroll-run",
  name: "Payroll run",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: businessPayrollAcceptance,
  scenarios: businessPayrollScenarios,
  dataModel: {
    "launch.period": { type: "string" }, "opt.allowBonus": { type: "boolean" }, "opt.allowDeduction": { type: "boolean" }, "opt.varianceCheck": { type: "boolean" }, "opt.payslips": { type: "boolean" },
    "pr.period": { type: "string", required: true }, "pr.date": { type: "string", required: true }, "pr.from": { type: "string", required: true }, "pr.v": { type: "object" }, "pr.c": { type: "object" },
    "pr.cur": { type: "string" }, "pr.row": { type: "object" }, "pr.net": { type: "string" }, "pr.amt": { type: "string" }, "pr.reason": { type: "string", pattern: "^[\\s\\S]{0,140}$" }, "pr.payslips": { type: "boolean" }, "pr.consent": { type: "boolean", required: true },
    "pr.op": { type: "object" }, "pr.op.op": { type: "string" }, "pr.op.employeeId": { type: "string" }, "pr.op.amount": { type: "string" }, "pr.op.kind": { type: "string" }, "pr.op.index": { type: "string" },
    "pr.done": { type: "object" }, "otp.code": { type: "string", pattern: "^[0-9]{6}$" },
  },
  integrations: [
    { id: "company", adapter: "corp.company.get", mode: "sandbox" },
    { id: "accts", adapter: "corp.accounts.list", mode: "sandbox" },
    { id: "options", adapter: "corp.payroll.register", mode: "sandbox" },
    { id: "open", adapter: "corp.payroll.register", mode: "sandbox" },
    { id: "row", adapter: "corp.payroll.register", mode: "sandbox" },
    { id: "change", adapter: "corp.payroll.register", mode: "sandbox" },
    { id: "check", adapter: "corp.payroll.check", mode: "sandbox" },
    { id: "review", adapter: "corp.payroll.check", mode: "sandbox" },
    { id: "otpSend", adapter: "bank.otp.send", mode: "sandbox" },
    { id: "otpVerify", adapter: "bank.otp.verify", mode: "sandbox" },
    { id: "submit", adapter: "corp.payroll.submit", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Payroll run", kind: "branch",
      onEnter: [
        set("ctx.error", null), set("pr.date", ""), set("pr.cur", ""), set("pr.net", ""), set("pr.amt", ""), set("pr.reason", ""), set("pr.payslips", true), set("pr.consent", false), set("otp.code", ""),
        ...op({}),
        set("pr.period", "{{isEmpty(launch.period) ? '2026-11' : launch.period}}"), set("launch.period", ""),
        { type: "callApi", integration: "company", saveAs: "ctx.company", onError: toRoute },
        { type: "callApi", integration: "accts", input: { for: "pay" }, saveAs: "ctx.accts", onError: toRoute },
        { type: "callApi", integration: "options", input: { op: "options" }, saveAs: "ctx.po", onError: toRoute },
        set("pr.from", "{{ctx.company.defaultAccountId}}"),
        go("period"),
      ],
      navigation: route([lacks("biz.payroll.run"), "denied"]),
      blocks: [],
    },
    {
      id: "period", title: "Pay period and date",
      blocks: [
        STEPPER,
        text("Step 1 of 3 · Payroll run", "caption"),
        text("Pay period and date", "title"),
        alert("error", "{{ctx.error.message}}", is(...PERIOD_CODES)),
        { type: "select", bind: "pr.period", label: "Pay period", variant: "dropdown", source: "ctx.po.periods" },
        { type: "select", bind: "pr.date", label: "Pay date", variant: "dropdown", source: "ctx.po.dates" },
        { type: "select", bind: "pr.from", label: "Pay from", variant: "dropdown", source: "ctx.accts" },
        button("Continue", [
          { type: "validate" }, set("ctx.error", null),
          { type: "callApi", integration: "open", input: { op: "open", period: "{{pr.period}}", payDate: "{{pr.date}}", fromAccountId: "{{pr.from}}", ...OPTIONS }, saveAs: "pr.v", onError: toRoute },
          set("pr.reason", ""),
          go("people"),
        ]),
        button("Cancel", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "people", title: "Employees",
      blocks: [
        STEPPER,
        text("Step 2 of 3 · Payroll run", "caption"),
        text("Employees", "title"),
        text("Check each person’s pay.", "body"),
        alert("error", "{{ctx.error.message}}", `${is(...PEOPLE_CODES)} || ${is(...OP_CODES)}`),
        { type: "reviewSummary", rows: [{ label: "Total", value: "{{pr.v.totalText}}" }, { label: "Employees", value: "{{pr.v.from}}" }] },
        text("{{pr.v.balanceAfterText}}", "caption", "!isEmpty(pr.v.balanceAfterText)"),
        alert("error", "{{pr.v.fundsMessage}}", "!pr.v.fundsOk"),
        alert("warning", "{{pr.v.varianceText}}", "pr.v.varianceNeeded"),
        { type: "textInput", bind: "pr.reason", label: "Reason for the change", placeholder: "For example: bonus month", lines: 2, pattern: "^[\\s\\S]{0,140}$", patternMessage: "Use up to 140 characters.", visibleWhen: "pr.v.varianceNeeded" },
        text("Nobody in this run", "title", "pr.v.count == 0"),
        text("Add someone back to continue.", "body", "pr.v.count == 0"),
        {
          type: "dataTable", source: "pr.v.rows", label: "Employees in this run", visibleWhen: "pr.v.count > 0", pageSize: 25,
          columns: [{ key: "name", label: "Employee" }, { key: "dept", label: "Department" }, { key: "netText", label: "Net pay" }, { key: "currency", label: "Currency" }, { key: "payText", label: "Pay" }, { key: "status", label: "Status", type: "status", statuses: STATUSES }, { key: "detail", label: "Details" }],
          onRowPress: [set("pr.cur", "{{item.id}}"), go("editOpen")],
        },
        { type: "sectionHeader", title: "Not in this run", visibleWhen: "pr.v.notInCount > 0" },
        {
          type: "dataTable", source: "pr.v.notIn", label: "Not in this run", visibleWhen: "pr.v.notInCount > 0",
          columns: [{ key: "name", label: "Employee" }, { key: "reason", label: "Why" }],
          onRowPress: [set("ctx.error", null), ...op({ op: "addBack", employeeId: "{{item.id}}" }), go("apply")],
        },
        text("Press a person who was taken out to add them back.", "caption", "pr.v.notInCount > 0"),
        button("Review", [
          { type: "validate" }, set("ctx.error", null),
          { type: "callApi", integration: "check", input: { reason: "{{pr.reason}}", payslips: "{{pr.payslips}}", ...OPTIONS }, saveAs: "pr.c", onError: toRoute },
          set("pr.consent", false),
          go("review"),
        ]),
        button("Back", [go("period")], "ghost"),
      ],
    },
    {
      id: "editOpen", title: "Employee", kind: "branch",
      onEnter: [
        set("ctx.error", null),
        { type: "callApi", integration: "row", input: { op: "row", employeeId: "{{pr.cur}}", ...OPTIONS }, saveAs: "pr.row", onError: toRoute },
        set("pr.net", "{{pr.row.netText}}"), set("pr.amt", ""), go("edit"),
      ],
      blocks: [],
    },
    {
      id: "edit", title: "Employee",
      blocks: [
        text("Pay for {{pr.row.name}}", "title"),
        text("{{pr.row.dept}} · pays in {{pr.row.currency}}", "caption"),
        alert("error", "{{ctx.error.message}}", is(...OP_CODES)),
        alert("error", "{{pr.row.message}}", "!isEmpty(pr.row.message)"),
        { type: "reviewSummary", rows: [{ label: "Pay", value: "{{pr.row.payText}}" }] },
        { type: "textInput", bind: "pr.net", label: "Net pay ({{pr.row.currency}})", keyboard: "number" },
        button("Save pay", [set("ctx.error", null), ...op({ op: "net", employeeId: "{{pr.cur}}", amount: "{{pr.net}}" }), go("apply")]),
        { type: "sectionHeader", title: "Adjust this pay" },
        { type: "textInput", bind: "pr.amt", label: "Amount ({{pr.row.currency}})", placeholder: "0.00", keyboard: "number" },
        button("Bonus", [set("ctx.error", null), ...op({ op: "bonus", employeeId: "{{pr.cur}}", amount: "{{pr.amt}}" }), go("apply")], "secondary", "opt.allowBonus != false"),
        button("Deduction", [set("ctx.error", null), ...op({ op: "deduction", employeeId: "{{pr.cur}}", amount: "{{pr.amt}}" }), go("apply")], "secondary", "opt.allowDeduction != false"),
        { type: "menu", source: "pr.row.bonuses", item: { label: "{{item.name}}", text: "Remove", actions: [set("ctx.error", null), ...op({ op: "removeLine", employeeId: "{{pr.cur}}", kind: "bonus", index: "{{item.index}}" }), go("apply")] } },
        { type: "menu", source: "pr.row.deductions", item: { label: "{{item.name}}", text: "Remove", actions: [set("ctx.error", null), ...op({ op: "removeLine", employeeId: "{{pr.cur}}", kind: "deduction", index: "{{item.index}}" }), go("apply")] } },
        button("Remove from this run", [set("ctx.error", null), ...op({ op: "remove", employeeId: "{{pr.cur}}" }), go("apply")], "secondary"),
        button("Back", [go("people")], "ghost"),
      ],
    },
    {
      // a change to the run (a pay, a bonus, a deduction, someone out or back in): the bank applies it and gives the whole run back
      id: "apply", title: "Employees", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "change", input: { op: "{{pr.op.op}}", employeeId: "{{pr.op.employeeId}}", amount: "{{pr.op.amount}}", kind: "{{pr.op.kind}}", index: "{{pr.op.index}}", ...OPTIONS }, saveAs: "pr.v", onError: toRoute },
        go("people"),
      ],
      blocks: [],
    },
    {
      id: "review", title: "Review",
      blocks: [
        STEPPER,
        text("Step 3 of 3 · Payroll run", "caption"),
        text("Review", "title"),
        alert("error", "{{ctx.error.message}}", is(...MONEY_CODES)),
        { type: "reviewSummary", rows: [{ label: "Total", value: "{{pr.c.totalUsdText}}" }, { label: "Employees", value: "{{pr.c.count}}" }] },
        {
          type: "reviewSummary",
          rows: [
            { label: "Pay period", value: "{{pr.c.periodText}}" },
            { label: "Pay date", value: "{{pr.c.payDateText}}" },
            { label: "Employees", value: "{{pr.c.count}}" },
            { label: "Pay from", value: "{{pr.c.accountName}}" },
            { label: "Fees", value: "{{pr.c.feeText}}" },
            { label: "You pay", value: "{{pr.c.youPayText}}" },
            { label: "Approvals needed", value: "{{pr.c.requiredApprovers}}" },
          ],
        },
        { type: "toggle", bind: "pr.payslips", label: "Send payslips", visibleWhen: "opt.payslips != false" },
        alert("info", "Nothing leaves the account until the approvers release the payment.", undefined),
        { type: "consent", bind: "pr.consent", termsVersion: "payroll-run-v1", text: "I confirm the pay is correct", validation: { mustBeTrue: true, messages: { mustBeTrue: "Tick the confirmation first" } } },
        button("Submit for approval", [
          { type: "validate" }, set("ctx.error", null), set("otp.code", ""),
          // the limits and the money are checked before the code is asked
          { type: "callApi", integration: "review", input: { reason: "{{pr.reason}}", payslips: "{{pr.payslips}}", review: true, ...OPTIONS }, saveAs: "pr.c", onError: toRoute },
          { type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: toRoute },
          go("otp"),
        ]),
        button("Back", [go("people")], "ghost"),
      ],
    },
    {
      id: "otp", title: "Enter your code",
      blocks: [
        text("Authorise payroll {{pr.c.periodText}}: {{pr.c.totalUsdText}}", "title"),
        text("Code sent to {{ctx.otp.maskedPhone}}.", "caption"),
        text("This amount needs an extra code.", "caption", "pr.c.codeExtra"),
        {
          type: "otp", bind: "otp.code", length: 6, maxAttempts: 3, resendAfterSeconds: 30, keypad: true,
          onResend: [{ type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: toRoute }],
        },
        button("Submit for approval", [
          { type: "validate" },
          { type: "callApi", integration: "otpVerify", input: { code: "{{otp.code}}" }, onError: lockOnWrongCode },
          { type: "callApi", integration: "submit", input: { reason: "{{pr.reason}}", payslips: "{{pr.payslips}}", ...OPTIONS }, saveAs: "pr.done", onError: toRoute },
          go("done"),
        ]),
      ],
    },
    {
      id: "done", title: "Sent for approval", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Sent for approval", text: "Payroll for {{pr.done.periodText}}, {{pr.done.totalText}}. Nothing has left the account yet.", meta: "Payment {{pr.done.id}}" },
        { type: "statusChip", status: "pending_approval", label: "{{pr.done.approvalsText}}" },
        {
          type: "reviewSummary",
          rows: [
            { label: "Pay period", value: "{{pr.done.periodText}}" },
            { label: "Pay date", value: "{{pr.done.payDateText}}" },
            { label: "Employees", value: "{{pr.done.count}}" },
            { label: "Total", value: "{{pr.done.totalUsdText}}" },
            { label: "You pay", value: "{{pr.done.youPayText}}" },
            { label: "Approvals needed", value: "{{pr.done.required}}" },
            { label: "Reference", value: "{{pr.done.reference}}" },
          ],
        },
        button("Track payment", [{ type: "navigate", toJourney: "payment-tracker", with: { "launch.paymentId": "{{pr.done.id}}" } }]),
        button("Share receipt", [{ type: "share", template: "receipt" }], "ghost"),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      // why the run cannot go ahead, and where to fix it
      id: "problem", title: "Check the run",
      blocks: [
        { type: "result", tone: "error", title: "This is above your payment limit.", text: "Reduce the pay or take people out. Nothing was sent.", visibleWhen: "ctx.error.code == 'LIMIT_USER_EXCEEDED'" },
        { type: "result", tone: "error", title: "This is above the company limit.", text: "Wait for the limit to reset. Nothing was sent.", visibleWhen: "ctx.error.code == 'LIMIT_COMPANY_EXCEEDED'" },
        button("Change the run", [go("people")], "primary"),
        button("Cancel", [{ type: "exit" }], "ghost"),
      ],
    },
    lockedScreen("payroll run"),
    ...failures(),
  ] as Screen[],
};

function failures(): Screen[] {
  const base = failScreens({
    title: "Payroll run", effects: ["submit"], timeoutText: "We didn’t get an answer in time. Check Payments before you try again, so you don’t pay twice.",
    retry: [["open", "period"], ["row", "people"], ["change", "people"], ["check", "people"], ["review", "review"], ["otpSend", "review"], ["submit", "review"]],
    routes: [[is(...PERIOD_CODES), "period"], [is(...PEOPLE_CODES, ...OP_CODES), "people"], [is(...MONEY_CODES), "problem"]],
  });
  return base.filter((s) => s.id !== "denied").concat([deniedScreen()]).map((s) => (s.id === "failed" ? failedScreen(s) : s));
}
function deniedScreen(): Screen {
  return {
    id: "denied", title: "Payroll run", kind: "terminal",
    blocks: [
      { type: "result", tone: "error", title: "You can’t run payroll at this company", text: "Your role at this company doesn’t include it. The bank checks this on its side too, so hiding the button isn’t the only guard.", visibleWhen: "ctx.error.code != 'WRONG_CONTEXT'" },
      { type: "result", tone: "error", title: "Switch to your business first", text: "{{ctx.error.message}}", visibleWhen: "ctx.error.code == 'WRONG_CONTEXT'" },
      button("Close", [{ type: "exit" }]),
    ],
  };
}
/** The generic failure of the kit says nothing was changed; a payroll run says nothing was sent. */
function failedScreen(s: Screen): Screen {
  return {
    ...s,
    blocks: [
      { type: "result", tone: "error", title: "We couldn’t confirm this run.", text: "Nothing was sent. Start again.", visibleWhen: is("OTP_REQUIRED", "OTP_INVALID", "STEP_UP_FAILED") },
      { type: "result", tone: "error", title: "Something went wrong.", text: "Nothing was sent.", visibleWhen: `!(${is("OTP_REQUIRED", "OTP_INVALID", "STEP_UP_FAILED")})` },
      ...s.blocks.filter((b: any) => b.type === "button"),
    ],
  };
}
