import type { Journey } from "../schema";
import { mobileTopupAcceptance, mobileTopupScenarios } from "./mobile-topup-tests";

const toRoute = { navigate: "route" };
const lockOnWrongCode = { showToast: "That code isn’t right. Try again.", stay: true, lockAfter: 3, lockTo: "locked" };

/** The amounts are in the bank's home currency; the sandbox bank's is US dollars (the symbol of the amounts is fixed here, as in the other BankWorkx payments). */
const CCY = "USD";
const MONEY = (path: string) => `$\{{${path} | money2}}`;
const ACCT = "{{ctx.accounts[tu.from].name}} {{ctx.accounts[tu.from].maskedNumber}}";
const LAST4 = "•••• {{ctx.chk.last4}}";

/** The number rule of the bank's home market (the only thing that changes with the market): spaces, brackets and hyphens do not count. */
const SEP = "[ ()-]*";
const digits = (min: number, max = min) => `^(?=.{0,24}$)(?:${SEP}[0-9]){${min},${max}}${SEP}$`;
const startingWith = (prefix: string, more: number) => `^(?=.{0,24}$)${SEP}${prefix.split("").join(SEP)}(?:${SEP}[0-9]){${more}}${SEP}$`;
const MARKETS = [
  { id: "A", pattern: digits(10), hint: "10 digits", message: "Enter the 10-digit number." },
  { id: "B", pattern: startingWith("07", 9), hint: "07…", message: "Enter 11 digits, starting 07." },
  { id: "C", pattern: digits(8, 12), hint: "8 to 12 digits", message: "Enter 8 to 12 digits." },
  { id: "D", pattern: startingWith("05", 8), hint: "05…", message: "Enter 10 digits, starting 05." },
];
// the home market is an option of the bank (opt.market, "A" unless set)
const IS_MARKET = (id: string) => (id === "A" ? "opt.market != 'B' && opt.market != 'C' && opt.market != 'D'" : `opt.market == '${id}'`);
const SHOW_NUMBER = "(len(ctx.saved) == 0 || tu.new)";
const NUMBER_PROBLEMS = ["NUMBER_NOT_FOUND", "NUMBER_INVALID"];
const AMOUNT_CODES = ["TOPUP_LIMIT", "INVALID_AMOUNT", "LIMIT_EXCEEDED"];
const ACCOUNT_CODES = ["INSUFFICIENT_FUNDS", "ACCOUNT_CANNOT_DEBIT", "ACCOUNT_NOT_FOUND", "CURRENCY_NOT_SUPPORTED"];
const isCode = (codes: string[]) => codes.map((c) => `ctx.error.code == '${c}'`).join(" || ");
const PROBLEMS = [...NUMBER_PROBLEMS, "OPERATOR_UNAVAILABLE", "OPERATOR_NOT_FOUND", ...AMOUNT_CODES, ...ACCOUNT_CODES];

/** What the bank is asked to check and then to pay: the same input twice. */
const TOPUP_INPUT = { operatorId: "{{tu.opId}}", number: "{{tu.number}}", market: "{{opt.market}}", amount: "{{tu.amount}}", fromAccountId: "{{tu.from}}" };

/**
 * Mobile top-up (BankWorkx, Payments). Choose the operator, the number (a saved one or another), one of the operator's fixed amounts and
 * the dollar account to pay from; the bank checks the number, the day's allowance of that number and the balance; review, tick, one-time code,
 * receipt. The home market's number rule and "Let people save numbers" are plain data (opt.market, opt.saveNumbers).
 *
 * Built from the spec of the prototype with the blocks FinX has: launch values (a deep link that skips the operator step), the "Checking the
 * number…" wait, per-field messages from the bank and messages for an empty choice are not there (see docs/BANKWORKX.md). The Meezan top-up
 * (carriers, 50 to 5,000) is a different thing and is not changed.
 */
export const mobileTopup: Journey = {
  id: "jrn_mobile_topup",
  slug: "mobile-topup",
  name: "Mobile top-up",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: mobileTopupAcceptance,
  scenarios: mobileTopupScenarios,
  dataModel: {
    "tu.opId": { type: "string" },
    "tu.opName": { type: "string" },
    "tu.new": { type: "boolean" },
    "tu.number": { type: "string", required: true },
    "tu.amount": { type: "number" },
    "tu.from": { type: "string", required: true },
    "tu.save": { type: "boolean" },
    "tu.name": { type: "string", required: true },
    "tu.consent": { type: "boolean", required: true },
    // the bank's options, set by the bank: left alone the market is A and saving numbers is on
    "opt.market": { type: "string" },
    "opt.saveNumbers": { type: "boolean" },
    "otp.code": { type: "string", pattern: "^[0-9]{6}$" },
  },
  integrations: [
    { id: "carriers", adapter: "bank.carriers.list", mode: "sandbox" },
    { id: "savedNumbers", adapter: "bank.topup.numbers", mode: "sandbox" },
    { id: "amounts", adapter: "bank.topup.amounts", mode: "sandbox" },
    { id: "accounts", adapter: "bank.accounts.list", mode: "sandbox" },
    { id: "checkNumber", adapter: "bank.topup.check", mode: "sandbox" },
    { id: "otpSend", adapter: "bank.otp.send", mode: "sandbox" },
    { id: "otpVerify", adapter: "bank.otp.verify", mode: "sandbox" },
    { id: "topup", adapter: "bank.topup.create", mode: "sandbox" },
  ],
  screens: [
    {
      // loads the operators and clears the form, then shows them. Start again and Top up again come back here.
      id: "start", title: "Mobile top-up", kind: "branch",
      onEnter: [
        { type: "setData", path: "ctx.error", value: null },
        { type: "setData", path: "tu.opId", value: "" },
        { type: "setData", path: "tu.opName", value: "" },
        { type: "setData", path: "tu.new", value: false },
        { type: "setData", path: "tu.number", value: "" },
        { type: "setData", path: "tu.amount", value: null },
        { type: "setData", path: "tu.from", value: "acc_main" },
        { type: "setData", path: "tu.save", value: false },
        { type: "setData", path: "tu.name", value: "" },
        { type: "setData", path: "tu.consent", value: false },
        { type: "setData", path: "otp.code", value: "" },
        { type: "callApi", integration: "carriers", saveAs: "ctx.carriers", onError: toRoute },
        { type: "navigate", to: "op" },
      ],
      blocks: [],
    },
    {
      id: "op", title: "Choose your operator",
      blocks: [
        { type: "stepper", steps: ["op", "num", "amt", "from", "review", "otp"] },
        { type: "text", variant: "title", text: "Choose your operator" },
        {
          // changing the operator clears the number and the amount
          type: "menu", source: "ctx.carriers",
          item: {
            label: "{{item.name}}",
            actions: [
              { type: "setData", path: "ctx.error", value: null },
              { type: "setData", path: "tu.opId", value: "{{item.id}}" },
              { type: "setData", path: "tu.opName", value: "{{item.name}}" },
              { type: "setData", path: "tu.new", value: false },
              { type: "setData", path: "tu.number", value: "" },
              { type: "setData", path: "tu.amount", value: null },
              { type: "navigate", to: "num" },
            ],
          },
        },
      ],
    },
    {
      // the saved numbers of this operator that fit the home market, and "Another number"; with none saved the field shows at once
      id: "num", title: "Mobile number",
      onEnter: [
        { type: "callApi", integration: "savedNumbers", input: { operatorId: "{{tu.opId}}", market: "{{opt.market}}" }, saveAs: "ctx.saved", onError: toRoute },
      ],
      blocks: [
        { type: "text", variant: "title", text: "Mobile number" },
        { type: "avatar", name: "{{tu.opName}}", text: "Operator" },
        { type: "button", label: "Change", variant: "ghost", actions: [{ type: "navigate", to: "op" }] },
        { type: "sectionHeader", title: "Saved numbers", visibleWhen: "len(ctx.saved) > 0 && !tu.new" },
        {
          type: "menu", source: "ctx.saved", visibleWhen: "len(ctx.saved) > 0 && !tu.new",
          item: {
            label: "{{item.name}}", text: "{{item.sub}}",
            actions: [
              { type: "setData", path: "ctx.error", value: null },
              { type: "setData", path: "tu.number", value: "{{item.number}}" },
              { type: "navigate", to: "amt" },
            ],
          },
        },
        {
          type: "button", label: "Another number", variant: "secondary", visibleWhen: "len(ctx.saved) > 0 && !tu.new",
          actions: [{ type: "setData", path: "tu.new", value: true }, { type: "setData", path: "tu.number", value: "" }, { type: "navigate", to: "num" }],
        },
        ...MARKETS.map((m) => ({
          type: "textInput" as const, bind: "tu.number", label: "Mobile number", placeholder: m.hint, keyboard: "phone" as const, visibleWhen: `${SHOW_NUMBER} && ${IS_MARKET(m.id)}`, pattern: m.pattern, patternMessage: m.message,
        })),
        {
          type: "button", label: "Continue", variant: "primary", visibleWhen: SHOW_NUMBER,
          actions: [{ type: "validate" }, { type: "setData", path: "ctx.error", value: null }, { type: "navigate", to: "amt" }],
        },
      ],
    },
    {
      // the operator's own amounts, one tap each
      id: "amt", title: "Choose an amount",
      onEnter: [
        { type: "callApi", integration: "amounts", input: { operatorId: "{{tu.opId}}" }, saveAs: "ctx.amounts", onError: toRoute },
      ],
      blocks: [
        { type: "text", variant: "title", text: "Choose an amount" },
        { type: "avatar", name: "{{tu.opName}}", text: "Operator" },
        {
          type: "menu", source: "ctx.amounts",
          item: { label: "{{item.name}}", actions: [{ type: "setData", path: "ctx.error", value: null }, { type: "setData", path: "tu.amount", value: "{{item.amount}}" }, { type: "navigate", to: "from" }] },
        },
        { type: "button", label: "Back", variant: "ghost", actions: [{ type: "navigate", to: "num" }] },
      ],
    },
    {
      // the bank checks the number, the day's allowance of that number and the balance when the account is chosen
      id: "from", title: "Pay from",
      onEnter: [
        { type: "callApi", integration: "accounts", input: { homeOnly: true }, saveAs: "ctx.accounts", onError: toRoute },
      ],
      blocks: [
        { type: "text", variant: "title", text: "Pay from" },
        { type: "accountPicker", bind: "tu.from", source: "ctx.accounts", showBalance: true },
        {
          type: "button", label: "Continue", variant: "primary",
          actions: [
            { type: "validate" },
            { type: "setData", path: "ctx.error", value: null },
            { type: "callApi", integration: "checkNumber", input: TOPUP_INPUT, saveAs: "ctx.chk", onError: toRoute },
            { type: "setData", path: "tu.save", value: false },
            { type: "setData", path: "tu.name", value: "" },
            { type: "setData", path: "tu.consent", value: false },
            { type: "navigate", to: "review" },
          ],
        },
        { type: "button", label: "Back", variant: "ghost", actions: [{ type: "navigate", to: "amt" }] },
      ],
    },
    {
      id: "review", title: "Review",
      blocks: [
        { type: "text", variant: "title", text: `You’re topping up ${MONEY("tu.amount")}` },
        {
          type: "reviewSummary",
          rows: [
            { label: "Operator", value: "{{tu.opName}}" },
            { label: "Number", value: LAST4 },
            { label: "Amount", value: MONEY("tu.amount") },
            { label: "From", value: ACCT },
          ],
        },
        { type: "toggle", bind: "tu.save", label: "Save this number", helper: "Top it up again in a tap.", visibleWhen: "opt.saveNumbers != false && !ctx.chk.saved" },
        {
          type: "textInput", bind: "tu.name", label: "Name", placeholder: "For example, Mum", pattern: "^.{2,20}$", patternMessage: "Use 2 to 20 characters.",
          visibleWhen: "opt.saveNumbers != false && !ctx.chk.saved && tu.save",
        },
        {
          type: "consent", bind: "tu.consent", termsVersion: "mobile-topup-v1", text: "I confirm I want to make this top-up",
          validation: { mustBeTrue: true, messages: { mustBeTrue: "Tick the confirmation first" } },
        },
        {
          type: "button", label: "Confirm and send code", variant: "primary",
          actions: [
            { type: "validate" },
            { type: "setData", path: "otp.code", value: "" },
            { type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: toRoute },
            { type: "navigate", to: "otp" },
          ],
        },
        { type: "button", label: "Change amount", variant: "ghost", actions: [{ type: "navigate", to: "amt" }] },
      ],
    },
    {
      id: "otp", title: "Enter your code",
      blocks: [
        { type: "text", variant: "title", text: `Authorise ${MONEY("tu.amount")} top-up` },
        { type: "text", variant: "caption", text: "It only works for this top-up." },
        {
          type: "otp", bind: "otp.code", length: 6, maxAttempts: 3, resendAfterSeconds: 30, keypad: true,
          hint: "We sent a 6-digit code to {{ctx.otp.maskedPhone}}.",
          onResend: [{ type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: toRoute }],
        },
        {
          type: "button", variant: "primary", label: "Top up",
          actions: [
            { type: "validate" },
            { type: "callApi", integration: "otpVerify", input: { code: "{{otp.code}}" }, onError: lockOnWrongCode },
            {
              // the number and the balance are checked again: a top-up that went over the day's allowance or the balance meanwhile ends in route and nothing is taken
              type: "callApi", integration: "topup", saveAs: "tu.result", onError: toRoute,
              input: { ...TOPUP_INPUT, save: "{{tu.save && opt.saveNumbers != false && !ctx.chk.saved}}", name: "{{tu.name}}" },
            },
            { type: "navigate", to: "success" },
          ],
        },
      ],
    },
    {
      // after a failed bank call: where to go depends on what the bank said (ctx.error)
      id: "route", title: "One moment", kind: "branch",
      onEnter: [{ type: "navigate", to: "failed" }],
      blocks: [],
      navigation: {
        rules: [
          { when: "ctx.error.code == 'TIMEOUT' && ctx.error.integration == 'topup'", to: "timeout" },
          { when: "ctx.error.code == 'TIMEOUT'", to: "slow" },
          { when: "ctx.error.code == 'SERVICE_UNAVAILABLE'", to: "unavailable" },
          { when: isCode(PROBLEMS), to: "problem" },
        ],
      },
    },
    {
      // why the top-up cannot be made, in the bank's words (nothing was taken), and where to fix it
      id: "problem", title: "Check the top-up",
      blocks: [
        { type: "result", tone: "error", title: "We can’t make this top-up yet", text: "{{ctx.error.message}} Nothing was taken." },
        { type: "button", label: "Change number", variant: "primary", visibleWhen: isCode(NUMBER_PROBLEMS), actions: [{ type: "setData", path: "tu.new", value: true }, { type: "setData", path: "tu.number", value: "" }, { type: "navigate", to: "num" }] },
        { type: "button", label: "Try again", variant: "primary", visibleWhen: "ctx.error.code == 'OPERATOR_UNAVAILABLE'", actions: [{ type: "navigate", to: "from" }] },
        { type: "button", label: "Change amount", variant: "primary", visibleWhen: isCode(AMOUNT_CODES), actions: [{ type: "navigate", to: "amt" }] },
        { type: "button", label: "Change account", variant: "primary", visibleWhen: isCode(ACCOUNT_CODES), actions: [{ type: "navigate", to: "from" }] },
        { type: "button", label: "Choose operator", variant: "primary", visibleWhen: "ctx.error.code == 'OPERATOR_NOT_FOUND'", actions: [{ type: "navigate", to: "op" }] },
      ],
    },
    {
      // Try again after a slow or unavailable service: back to where the person was
      id: "retry", title: "One moment", kind: "branch",
      onEnter: [{ type: "navigate", to: "review" }],
      blocks: [],
      navigation: {
        rules: [
          { when: "ctx.error.integration == 'carriers'", to: "start" },
          { when: "ctx.error.integration == 'savedNumbers'", to: "num" },
          { when: "ctx.error.integration == 'amounts'", to: "amt" },
          { when: "ctx.error.integration == 'accounts' || ctx.error.integration == 'checkNumber'", to: "from" },
        ],
      },
    },
    {
      id: "success", title: "Done", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Top-up sent", text: `${MONEY("tu.result.amount")} added to •••• {{tu.result.last4}}.`, meta: "Completed" },
        {
          type: "reviewSummary",
          rows: [
            { label: "Operator", value: "{{tu.result.operatorName}}" },
            { label: "Number", value: "•••• {{tu.result.last4}}" },
            { label: "Amount", value: MONEY("tu.result.amount") },
            { label: "From", value: ACCT },
            { label: "Date", value: "{{tu.result.date}}" },
          ],
        },
        { type: "text", variant: "caption", text: "{{tu.name}} is saved.", visibleWhen: "tu.result.saved" },
        { type: "button", label: "Top up again", variant: "primary", actions: [{ type: "navigate", to: "start" }] },
        { type: "button", label: "Close", variant: "secondary", actions: [{ type: "exit" }] },
      ],
    },
    {
      id: "locked", title: "Too many wrong codes", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "Too many wrong codes", text: "You entered the wrong code 3 times, so we stopped. No money has left your account." },
        { type: "button", label: "Start again", variant: "primary", actions: [{ type: "navigate", to: "start" }] },
        { type: "button", label: "Close", variant: "secondary", actions: [{ type: "exit" }] },
      ],
    },
    {
      id: "timeout", title: "No answer in time", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We didn't get an answer in time", text: "We didn't get an answer in time. Check Activity before you try again, so you don't pay twice." },
        // Activity is a screen of the app, not of this journey: leaving the journey takes the person back to the app
        { type: "button", label: "Check Activity", variant: "primary", actions: [{ type: "exit" }] },
        { type: "button", label: "Close", variant: "secondary", actions: [{ type: "exit" }] },
      ],
    },
    {
      // a slow answer to a question that moves no money (the operators, the numbers, the check): nothing changed, so it is safe to ask again
      id: "slow", title: "No answer in time", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We didn't get an answer in time", text: "This is taking longer than expected. Nothing was taken." },
        { type: "button", label: "Try again", variant: "primary", actions: [{ type: "navigate", to: "retry" }] },
        { type: "button", label: "Close", variant: "secondary", actions: [{ type: "exit" }] },
      ],
    },
    {
      id: "unavailable", title: "Service not available", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "Service not available", text: "This service is not available right now. Nothing was changed. Please try again in a few minutes." },
        { type: "button", label: "Try again", variant: "primary", actions: [{ type: "navigate", to: "retry" }] },
        { type: "button", label: "Back", variant: "secondary", actions: [{ type: "exit" }] },
      ],
    },
    {
      id: "failed", title: "Not topped up", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We couldn't complete this right now.", text: "No money has left your account.", visibleWhen: "ctx.error.code == 'CORE_UNAVAILABLE'" },
        { type: "result", tone: "error", title: "We couldn’t confirm this top-up.", text: "Nothing was taken. Start again.", visibleWhen: "ctx.error.code == 'OTP_REQUIRED' || ctx.error.code == 'OTP_INVALID'" },
        {
          type: "result", tone: "error", title: "Something went wrong.", text: "No money has left your account.",
          visibleWhen: "ctx.error.code != 'CORE_UNAVAILABLE' && ctx.error.code != 'OTP_REQUIRED' && ctx.error.code != 'OTP_INVALID'",
        },
        { type: "button", label: "Start again", variant: "primary", actions: [{ type: "navigate", to: "start" }] },
        { type: "button", label: "Close", variant: "secondary", actions: [{ type: "exit" }] },
      ],
    },
  ],
};
