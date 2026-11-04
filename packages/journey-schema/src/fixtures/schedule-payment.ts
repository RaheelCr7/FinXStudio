import type { Journey } from "../schema";
import { schedulePaymentAcceptance, schedulePaymentScenarios } from "./schedule-payment-tests";

const toRoute = { navigate: "route" };
const lockOnWrongCode = { showToast: "That code isn’t right. Try again.", stay: true, lockAfter: 3, lockTo: "locked" };

/** The bank's closing rule for changes is an option of the bank (opt.strictCutoff: 09:00 instead of 18:00 the business day before). */
const STRICT = "{{opt.strictCutoff == true}}";
/** Payments to a payee and for a bill are made from an account in the bank's home currency (US dollars in the sandbox, fixed here as in the other BankWorkx payments). */
const HOME = "account.currency == 'USD'";
const NEW = "sp.mode == 'new'";
const EDIT = "sp.mode == 'edit'";
const KIND = (k: string) => `sp.kind == '${k}'`;
const ONCE = "sp.freq == 'once'";
const REPEATS = "sp.freq != 'once'";
const FIXED = "(sp.kind != 'bill' || sp.amountMode == 'fixed')";
const ACCEPTS_MINIMUM = "ctx.bills[sp.target].accepts == 'minimum'";
const isCode = (codes: string[]) => codes.map((c) => `ctx.error.code == '${c}'`).join(" || ");

/** The most payments each frequency can end after (the spec's table), as a pattern for a whole number from 2 to the maximum. */
const COUNTS = [
  { freq: "weekly", max: 104, pattern: "^(?:[2-9]|[1-9][0-9]|10[0-4])$" },
  { freq: "biweekly", max: 52, pattern: "^(?:[2-9]|[1-4][0-9]|5[0-2])$" },
  { freq: "monthly", max: 60, pattern: "^(?:[2-9]|[1-5][0-9]|60)$" },
  { freq: "quarterly", max: 40, pattern: "^(?:[2-9]|[1-3][0-9]|40)$" },
];

// what the bank is told: the same fields to check a schedule, to make it and to change it
const SCHEDULE_INPUT = {
  kind: "{{sp.kind}}", target: "{{sp.target}}", from: "{{sp.from}}", amount: "{{sp.amount}}", amountMode: "{{sp.amountMode}}", frequency: "{{sp.freq}}", first: "{{sp.first}}",
  endType: "{{sp.endType}}", endOn: "{{sp.endOn}}", endCount: "{{sp.endCount}}", reminder: "{{opt.reminder != false}}", retry: "{{opt.insufficientFundsPolicy == true}}", strictCutoff: STRICT,
};
const CHECK_INPUT = { ...SCHEDULE_INPUT, scheduleId: "{{sp.id}}" };
const UPDATE_INPUT = { scheduleId: "{{sp.id}}", amount: "{{sp.amount}}", first: "{{sp.first}}", endType: "{{sp.endType}}", endOn: "{{sp.endOn}}", endCount: "{{sp.endCount}}", strictCutoff: STRICT };

// the codes the bank can refuse with, grouped by the screen that fixes them
const DATE_CODES = ["DATE_TOO_SOON", "DATE_TOO_FAR", "DATE_NOT_WEEKDAY", "DATE_CLOSED", "INVALID_DATE", "BENEFICIARY_COOLING_OFF"];
const END_CODES = ["END_BEFORE_START", "INVALID_END_DATE", "INVALID_COUNT"];
const AMOUNT_CODES = ["DAILY_LIMIT_EXCEEDED", "INVALID_AMOUNT"];
const ACCOUNT_CODES = ["SAME_ACCOUNT", "CURRENCY_MISMATCH", "ACCOUNT_NOT_FOUND", "ACCOUNT_CANNOT_DEBIT", "BILL_CURRENCY_MISMATCH"];
const TARGET_CODES = ["BENEFICIARY_NOT_FOUND", "BILLER_NOT_FOUND", "NOT_SUPPORTED"];
const GONE_CODES = ["SCHEDULE_NOT_FOUND", "SCHEDULE_NOT_ACTIVE", "SCHEDULE_RUNNING", "SCHEDULE_CUTOFF_PASSED"];
const PROBLEMS = [...DATE_CODES, ...END_CODES, ...AMOUNT_CODES, ...ACCOUNT_CODES, ...TARGET_CODES, ...GONE_CODES, "SCHEDULE_LIMIT"];

const resetTarget = [
  { type: "setData", path: "ctx.error", value: null },
  { type: "setData", path: "sp.target", value: "" },
  { type: "setData", path: "sp.targetName", value: "" },
  { type: "setData", path: "sp.amountMode", value: "fixed" },
  { type: "setData", path: "sp.amount", value: null },
];

/**
 * Schedule a payment (BankWorkx, Payments). Choose what to schedule (a payee, one of your own accounts, a saved bill), who, from which
 * account and how much, how often and from when, when it ends, review with a reminder, tick, one-time code, receipt. The same journey
 * changes a schedule (the amount, the next date, the end) from the list of what is scheduled. Nothing is taken when the schedule is made:
 * the bank checks the balance, the limits and the payee again on each date. Cancelling and skipping is `cancel-standing-order`.
 *
 * Built from the spec of the prototype with the blocks FinX has: launch values (a schedule or a payee to start from), the card
 * "Different currency", per-field messages from the bank and chaining one journey to another are not there (see docs/BANKWORKX.md).
 */
export const schedulePayment: Journey = {
  id: "jrn_schedule_payment",
  slug: "schedule-payment",
  name: "Schedule a payment",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: schedulePaymentAcceptance,
  scenarios: schedulePaymentScenarios,
  dataModel: {
    "sp.mode": { type: "string" },
    "sp.id": { type: "string" },
    "sp.kind": { type: "string" },
    "sp.target": { type: "string" },
    "sp.targetName": { type: "string" },
    "sp.from": { type: "string", required: true },
    "sp.amountMode": { type: "string", required: true },
    "sp.amount": { type: "number", required: true },
    "sp.freq": { type: "string", required: true },
    "sp.first": { type: "string", required: true },
    "sp.endType": { type: "string", required: true },
    "sp.endOn": { type: "string", required: true },
    "sp.endCount": { type: "string", required: true },
    "sp.consent": { type: "boolean", required: true },
    // the bank's options, set by the bank: left alone the own-account and saved-bill schedules and the reminder are on, changes close at 18:00 and a short payment is skipped
    "opt.allowOwn": { type: "boolean" },
    "opt.allowBills": { type: "boolean" },
    "opt.reminder": { type: "boolean" },
    "opt.strictCutoff": { type: "boolean" },
    "opt.insufficientFundsPolicy": { type: "boolean" },
    "otp.code": { type: "string", pattern: "^[0-9]{6}$" },
  },
  integrations: [
    { id: "accounts", adapter: "bank.accounts.list", mode: "sandbox" },
    { id: "payees", adapter: "bank.beneficiaries.list", mode: "sandbox" },
    { id: "bills", adapter: "bank.bills.saved", mode: "sandbox" },
    { id: "schedules", adapter: "bank.schedules.list", mode: "sandbox" },
    { id: "scheduleGet", adapter: "bank.schedules.get", mode: "sandbox" },
    { id: "scheduleCheck", adapter: "bank.schedules.check", mode: "sandbox" },
    { id: "otpSend", adapter: "bank.otp.send", mode: "sandbox" },
    { id: "otpVerify", adapter: "bank.otp.verify", mode: "sandbox" },
    { id: "scheduleCreate", adapter: "bank.schedules.create", mode: "sandbox" },
    { id: "scheduleUpdate", adapter: "bank.schedules.update", mode: "sandbox" },
  ],
  screens: [
    {
      // loads the accounts and clears the form, then shows the first screen. Start again and Schedule another come back here.
      id: "start", title: "Schedule a payment", kind: "branch",
      onEnter: [
        { type: "setData", path: "ctx.error", value: null },
        { type: "setData", path: "sp.mode", value: "new" },
        { type: "setData", path: "sp.id", value: "" },
        { type: "setData", path: "sp.kind", value: "" },
        { type: "setData", path: "sp.target", value: "" },
        { type: "setData", path: "sp.targetName", value: "" },
        { type: "setData", path: "sp.from", value: "acc_main" },
        { type: "setData", path: "sp.amountMode", value: "fixed" },
        { type: "setData", path: "sp.amount", value: null },
        { type: "setData", path: "sp.freq", value: "monthly" },
        { type: "setData", path: "sp.first", value: "" },
        { type: "setData", path: "sp.endType", value: "never" },
        { type: "setData", path: "sp.endOn", value: "" },
        { type: "setData", path: "sp.endCount", value: "" },
        { type: "setData", path: "sp.consent", value: false },
        { type: "setData", path: "otp.code", value: "" },
        { type: "callApi", integration: "accounts", saveAs: "ctx.accounts", onError: toRoute },
        { type: "navigate", to: "home" },
      ],
      blocks: [],
    },
    {
      // the engine cannot be opened on a schedule, so the journey asks: a new one, or one of the schedules to change
      id: "home", title: "Schedule a payment",
      blocks: [
        { type: "text", variant: "title", text: "Schedule a payment" },
        { type: "text", variant: "caption", text: "Nothing is taken until each payment date." },
        {
          type: "menu",
          items: [
            {
              id: "new", label: "New scheduled payment", text: "To a payee, between your accounts or for a saved bill",
              actions: [{ type: "setData", path: "sp.mode", value: "new" }, { type: "navigate", to: "what" }],
            },
            {
              id: "change", label: "Change a payment", text: "The amount, the next date or the end",
              actions: [
                { type: "setData", path: "sp.mode", value: "edit" },
                { type: "callApi", integration: "schedules", input: { status: "live", strictCutoff: STRICT }, saveAs: "ctx.sched", onError: toRoute },
                { type: "navigate", to: "pick" },
              ],
            },
          ],
        },
        { type: "button", label: "Close", variant: "ghost", actions: [{ type: "exit" }] },
      ],
    },
    {
      id: "what", title: "What do you want to schedule?",
      blocks: [
        { type: "stepper", steps: ["what", "who", "how", "when", "end", "review", "otp"] },
        { type: "text", variant: "title", text: "What do you want to schedule?" },
        {
          type: "menu",
          items: [{
            id: "payee", label: "To a payee", text: "Someone you have saved",
            actions: [
              ...resetTarget,
              { type: "setData", path: "sp.kind", value: "payee" },
              { type: "callApi", integration: "payees", saveAs: "ctx.payees", onError: toRoute },
              { type: "navigate", to: "who" },
            ],
          }],
        },
        {
          // a kind the bank switched off is not offered
          type: "menu", visibleWhen: "opt.allowOwn != false",
          items: [{
            id: "own", label: "Between my accounts", text: "Move money between two of your own accounts",
            actions: [...resetTarget, { type: "setData", path: "sp.kind", value: "own" }, { type: "navigate", to: "who" }],
          }],
        },
        {
          type: "menu", visibleWhen: "opt.allowBills != false",
          items: [{
            id: "bill", label: "A saved bill", text: "Pay a biller you have saved, each time it is due",
            actions: [
              ...resetTarget,
              { type: "setData", path: "sp.kind", value: "bill" },
              { type: "callApi", integration: "bills", saveAs: "ctx.bills", onError: toRoute },
              { type: "navigate", to: "who" },
            ],
          }],
        },
        { type: "button", label: "Back", variant: "ghost", actions: [{ type: "navigate", to: "home" }] },
      ],
    },
    {
      // who: a saved payee, one of your own accounts, or a saved bill; one tap on a row
      id: "who", title: "Who do you want to pay?",
      blocks: [
        { type: "text", variant: "title", text: "Who do you want to pay?", visibleWhen: KIND("payee") },
        { type: "text", variant: "title", text: "Which account do you want to pay?", visibleWhen: KIND("own") },
        { type: "text", variant: "title", text: "Which bill do you want to pay?", visibleWhen: KIND("bill") },
        {
          type: "menu", source: "ctx.payees", visibleWhen: `${KIND("payee")} && len(ctx.payees) > 0`,
          item: {
            label: "{{item.displayName}}", text: "{{item.bank}} {{item.maskedNumber}}",
            actions: [
              { type: "setData", path: "ctx.error", value: null },
              { type: "setData", path: "sp.target", value: "{{item.id}}" },
              { type: "setData", path: "sp.targetName", value: "{{item.displayName}}" },
              { type: "navigate", to: "how" },
            ],
          },
        },
        { type: "text", variant: "body", text: "You have no saved payees. Add a payee first.", visibleWhen: `${KIND("payee")} && len(ctx.payees) == 0` },
        {
          type: "menu", source: "ctx.accounts", visibleWhen: KIND("own"),
          item: {
            label: "{{item.name}} {{item.maskedNumber}}", text: "{{item.currency}}",
            actions: [
              { type: "setData", path: "ctx.error", value: null },
              { type: "setData", path: "sp.target", value: "{{item.id}}" },
              { type: "setData", path: "sp.targetName", value: "{{item.name}} {{item.maskedNumber}}" },
              { type: "navigate", to: "how" },
            ],
          },
        },
        {
          type: "menu", source: "ctx.bills", visibleWhen: `${KIND("bill")} && len(ctx.bills) > 0`,
          item: {
            label: "{{item.nickname}}", text: "{{item.sub}}",
            actions: [
              { type: "setData", path: "ctx.error", value: null },
              { type: "setData", path: "sp.target", value: "{{item.id}}" },
              { type: "setData", path: "sp.targetName", value: "{{item.nickname}}" },
              { type: "navigate", to: "how" },
            ],
          },
        },
        { type: "text", variant: "title", text: "No saved billers", visibleWhen: `${KIND("bill")} && len(ctx.bills) == 0` },
        { type: "text", variant: "body", text: "Save a biller when you pay a bill, then schedule it here.", visibleWhen: `${KIND("bill")} && len(ctx.bills) == 0` },
        { type: "button", label: "Back", variant: "ghost", actions: [{ type: "navigate", to: "what" }] },
      ],
    },
    {
      // the account to pay from and how much; changing a payment shows who it pays and asks only for the amount
      id: "how", title: "From and amount",
      blocks: [
        { type: "text", variant: "title", text: "Who and how much", visibleWhen: NEW },
        { type: "text", variant: "title", text: "Amount", visibleWhen: EDIT },
        { type: "avatar", name: "{{sp.targetName}}", text: "{{sp.kind == 'own' ? 'Your account' : (sp.kind == 'bill' ? 'Saved bill' : 'Payee')}}" },
        { type: "sectionHeader", title: "From", visibleWhen: NEW },
        { type: "accountPicker", bind: "sp.from", source: "ctx.accounts", showBalance: true, filter: HOME, visibleWhen: `${NEW} && sp.kind != 'own'` },
        { type: "accountPicker", bind: "sp.from", source: "ctx.accounts", showBalance: true, visibleWhen: `${NEW} && ${KIND("own")}` },
        {
          // a bill is paid in full each time it is due, at its minimum (where the biller has one) or for a fixed amount
          type: "select", bind: "sp.amountMode", label: "How much each time?", variant: "rows", visibleWhen: `${NEW} && ${KIND("bill")} && ${ACCEPTS_MINIMUM}`,
          choices: [{ id: "full", label: "Full bill", text: "Each time it is due" }, { id: "minimum", label: "Minimum due", text: "The smallest payment the biller takes" }, { id: "fixed", label: "Fixed amount" }],
        },
        {
          type: "select", bind: "sp.amountMode", label: "How much each time?", variant: "rows", visibleWhen: `${NEW} && ${KIND("bill")} && !(${ACCEPTS_MINIMUM})`,
          choices: [{ id: "full", label: "Full bill", text: "Each time it is due" }, { id: "fixed", label: "Fixed amount" }],
        },
        { type: "amountInput", bind: "sp.amount", currency: "{{ctx.accounts[sp.from].currency}}", label: "Amount", visibleWhen: FIXED },
        { type: "text", variant: "body", text: "This payment is for the whole bill each time, so there is no amount to change.", visibleWhen: `${EDIT} && !${FIXED}` },
        { type: "button", label: "Continue", variant: "primary", actions: [{ type: "validate" }, { type: "setData", path: "ctx.error", value: null }, { type: "navigate", to: "howCheck" }] },
        { type: "button", label: "Back", variant: "ghost", visibleWhen: NEW, actions: [{ type: "navigate", to: "who" }] },
        { type: "button", label: "Back", variant: "ghost", visibleWhen: EDIT, actions: [{ type: "navigate", to: "load" }] },
      ],
    },
    {
      // between own accounts the two must differ and share a currency; the bank checks it again, this answers before the dates
      id: "howCheck", title: "One moment", kind: "branch",
      onEnter: [{ type: "navigate", to: "when" }],
      blocks: [],
      navigation: {
        rules: [
          { when: `${NEW} && ${KIND("own")} && sp.target == sp.from`, to: "ownProblem" },
          { when: `${NEW} && ${KIND("own")} && ctx.accounts[sp.target].currency != ctx.accounts[sp.from].currency`, to: "ownProblem" },
        ],
      },
    },
    {
      id: "ownProblem", title: "Check your accounts",
      blocks: [
        { type: "result", tone: "error", title: "Choose two different accounts.", visibleWhen: "sp.target == sp.from" },
        { type: "result", tone: "error", title: "Choose two accounts in the same currency.", visibleWhen: "sp.target != sp.from" },
        { type: "button", label: "Choose account", variant: "primary", actions: [{ type: "navigate", to: "how" }] },
      ],
    },
    {
      id: "when", title: "How often",
      blocks: [
        { type: "text", variant: "title", text: "How often", visibleWhen: NEW },
        { type: "text", variant: "title", text: "Next payment date", visibleWhen: EDIT },
        {
          // choosing Once clears the end
          type: "select", bind: "sp.freq", label: "How often", variant: "chips", visibleWhen: NEW,
          choices: [{ id: "once", label: "Once" }, { id: "weekly", label: "Weekly" }, { id: "biweekly", label: "Every 2 weeks" }, { id: "monthly", label: "Monthly" }, { id: "quarterly", label: "Every 3 months" }],
        },
        {
          type: "dateInput", bind: "sp.first", label: "{{sp.freq == 'once' || sp.mode == 'edit' ? 'Date' : 'Start date'}}", placeholder: "YYYY-MM-DD",
          helper: "A weekday from tomorrow, up to 12 months ahead.",
        },
        {
          type: "button", label: "Continue", variant: "primary",
          actions: [
            { type: "validate" },
            { type: "setData", path: "ctx.error", value: null },
            { type: "setData", path: "sp.endType", value: "{{sp.freq == 'once' ? 'never' : sp.endType}}" },
            { type: "navigate", to: "whenNext" },
          ],
        },
        { type: "button", label: "Back", variant: "ghost", actions: [{ type: "navigate", to: "how" }] },
      ],
    },
    {
      // Once has no end: straight to the review
      id: "whenNext", title: "One moment", kind: "branch",
      onEnter: [{ type: "navigate", to: "end" }],
      blocks: [],
      navigation: { rules: [{ when: ONCE, to: "review" }] },
    },
    {
      // the bank checks the dates here, so a date it refuses is told before the end is asked; its answer lists the payments an end can fall on
      id: "end", title: "When should it end?",
      onEnter: [
        { type: "callApi", integration: "scheduleCheck", input: { ...CHECK_INPUT, endType: "never", endOn: "", endCount: "" }, saveAs: "ctx.plan", onError: toRoute },
      ],
      blocks: [
        { type: "text", variant: "title", text: "When should it end?" },
        {
          type: "select", bind: "sp.endType", label: "End", variant: "rows",
          choices: [{ id: "never", label: "Never" }, { id: "date", label: "On a date" }, { id: "count", label: "After a number of payments" }],
        },
        { type: "select", bind: "sp.endOn", label: "Last payment on", variant: "dropdown", source: "ctx.plan.dates", visibleWhen: "sp.endType == 'date'" },
        ...COUNTS.map((c) => ({
          type: "textInput" as const, bind: "sp.endCount", label: "Number of payments", placeholder: "For example 12", keyboard: "number" as const, helper: `From 2 to ${c.max}.`,
          visibleWhen: `sp.endType == 'count' && sp.freq == '${c.freq}'`, pattern: c.pattern, patternMessage: `Enter a number from 2 to ${c.max}.`,
        })),
        { type: "button", label: "Review", variant: "primary", actions: [{ type: "validate" }, { type: "setData", path: "ctx.error", value: null }, { type: "navigate", to: "review" }] },
        { type: "button", label: "Back", variant: "ghost", actions: [{ type: "navigate", to: "when" }] },
      ],
    },
    {
      // the bank checks everything again here, before the code: a refused date, end, limit or payee is a screen with a way back
      id: "review", title: "Review",
      onEnter: [
        { type: "setData", path: "sp.consent", value: false },
        { type: "callApi", integration: "scheduleCheck", input: CHECK_INPUT, saveAs: "ctx.plan", onError: toRoute },
      ],
      blocks: [
        { type: "text", variant: "title", text: "Review your payment", visibleWhen: NEW },
        { type: "text", variant: "title", text: "Review the change", visibleWhen: EDIT },
        {
          type: "reviewSummary",
          rows: [
            { label: "To", value: "{{ctx.plan.toText}}" },
            { label: "From", value: "{{ctx.plan.fromText}}" },
            { label: "Amount", value: "{{ctx.plan.amountText}}" },
            { label: "How often", value: "{{ctx.plan.frequencyName}}" },
          ],
        },
        { type: "reviewSummary", visibleWhen: ONCE, rows: [{ label: "Date", value: "{{ctx.plan.startText}}" }] },
        {
          type: "reviewSummary", visibleWhen: REPEATS,
          rows: [
            { label: "{{sp.mode == 'edit' ? 'Next payment' : 'Starts'}}", value: "{{ctx.plan.startText}}" },
            { label: "Ends", value: "{{ctx.plan.endsText}}" },
            { label: "Next dates", value: "{{ctx.plan.nextDates}}" },
          ],
        },
        { type: "reviewSummary", visibleWhen: "opt.reminder != false", rows: [{ label: "Reminder", value: "1 day before" }] },
        {
          type: "consent", bind: "sp.consent", termsVersion: "schedule-payment-v1", text: "I confirm I want this payment scheduled",
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
        { type: "button", label: "Change date", variant: "ghost", visibleWhen: ONCE, actions: [{ type: "navigate", to: "when" }] },
        { type: "button", label: "Change end", variant: "ghost", visibleWhen: REPEATS, actions: [{ type: "navigate", to: "end" }] },
      ],
    },
    {
      id: "otp", title: "Enter your code",
      blocks: [
        { type: "text", variant: "title", text: "Authorise {{ctx.plan.authAmount}} to {{ctx.plan.targetName}}, {{ctx.plan.adverb}}", visibleWhen: NEW },
        { type: "text", variant: "title", text: "Authorise the change to your payment to {{ctx.plan.targetName}}", visibleWhen: EDIT },
        {
          type: "otp", bind: "otp.code", length: 6, maxAttempts: 3, resendAfterSeconds: 30, keypad: true,
          hint: "We sent a 6-digit code to {{ctx.otp.maskedPhone}}.",
          onResend: [{ type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: toRoute }],
        },
        {
          type: "button", variant: "primary", label: "Schedule payment", visibleWhen: NEW,
          actions: [
            { type: "validate" },
            { type: "callApi", integration: "otpVerify", input: { code: "{{otp.code}}" }, onError: lockOnWrongCode },
            // the dates, the limit and the payee are checked again: a schedule that stopped being allowed meanwhile ends in route and nothing is saved
            { type: "callApi", integration: "scheduleCreate", input: SCHEDULE_INPUT, saveAs: "sp.result", onError: toRoute },
            { type: "navigate", to: "success" },
          ],
        },
        {
          type: "button", variant: "primary", label: "Save changes", visibleWhen: EDIT,
          actions: [
            { type: "validate" },
            { type: "callApi", integration: "otpVerify", input: { code: "{{otp.code}}" }, onError: lockOnWrongCode },
            { type: "callApi", integration: "scheduleUpdate", input: UPDATE_INPUT, saveAs: "sp.result", onError: toRoute },
            { type: "navigate", to: "success" },
          ],
        },
      ],
    },
    {
      // the schedules that can be changed, soonest first
      id: "pick", title: "Change a payment",
      blocks: [
        { type: "text", variant: "title", text: "Change a payment" },
        {
          type: "menu", source: "ctx.sched", visibleWhen: "len(ctx.sched) > 0",
          item: {
            label: "{{item.name}}", text: "{{item.sub}}",
            actions: [
              { type: "setData", path: "ctx.error", value: null },
              { type: "setData", path: "sp.id", value: "{{item.id}}" },
              { type: "callApi", integration: "scheduleGet", input: { scheduleId: "{{sp.id}}", for: "change", strictCutoff: STRICT }, saveAs: "ctx.cur", onError: toRoute },
              { type: "setData", path: "sp.kind", value: "{{ctx.cur.kind}}" },
              { type: "setData", path: "sp.target", value: "{{ctx.cur.targetId}}" },
              { type: "setData", path: "sp.targetName", value: "{{ctx.cur.name}}" },
              { type: "setData", path: "sp.from", value: "{{ctx.cur.fromAccountId}}" },
              { type: "setData", path: "sp.amountMode", value: "{{ctx.cur.amountMode}}" },
              { type: "setData", path: "sp.amount", value: "{{ctx.cur.amount}}" },
              { type: "setData", path: "sp.freq", value: "{{ctx.cur.frequency}}" },
              { type: "setData", path: "sp.first", value: "{{ctx.cur.nextRunOn}}" },
              { type: "setData", path: "sp.endType", value: "{{ctx.cur.endType}}" },
              { type: "setData", path: "sp.endOn", value: "{{ctx.cur.endOn}}" },
              { type: "setData", path: "sp.endCount", value: "{{ctx.cur.endLeft}}" },
              { type: "navigate", to: "load" },
            ],
          },
        },
        { type: "text", variant: "body", text: "Nothing scheduled. Set up a payment once and we’ll send it on time.", visibleWhen: "len(ctx.sched) == 0" },
        { type: "button", label: "Schedule a payment", variant: "primary", visibleWhen: "len(ctx.sched) == 0", actions: [{ type: "setData", path: "sp.mode", value: "new" }, { type: "navigate", to: "what" }] },
        { type: "button", label: "Back", variant: "ghost", actions: [{ type: "navigate", to: "home" }] },
      ],
    },
    {
      id: "load", title: "Change payment",
      blocks: [
        { type: "text", variant: "title", text: "Change payment" },
        {
          type: "reviewSummary",
          rows: [
            { label: "To", value: "{{ctx.cur.toText}}" },
            { label: "Status", value: "{{ctx.cur.status == 'paused' ? 'Paused' : 'Active'}}" },
            { label: "From", value: "{{ctx.cur.fromText}}" },
            { label: "Amount", value: "{{ctx.cur.amountText}}" },
            { label: "How often", value: "{{ctx.cur.frequencyName}}" },
            { label: "Next payment", value: "{{ctx.cur.nextLong}}" },
            { label: "Ends", value: "{{ctx.cur.endsText}}" },
          ],
        },
        { type: "text", variant: "caption", text: "Paused: the last two attempts failed. Choose a new date to resume it.", visibleWhen: "ctx.cur.status == 'paused'" },
        { type: "button", label: "Continue", variant: "primary", actions: [{ type: "navigate", to: "how" }] },
        { type: "button", label: "Back", variant: "ghost", actions: [{ type: "navigate", to: "pick" }] },
      ],
    },
    {
      id: "success", title: "Done", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Payment scheduled", text: "{{sp.result.amountText}} to {{sp.result.targetName}}, {{sp.result.adverb}}, from {{sp.result.firstText}}.", meta: "Scheduled", visibleWhen: NEW },
        { type: "result", tone: "success", title: "Schedule updated", text: "Your payment to {{sp.result.targetName}} is updated.", meta: "Updated", visibleWhen: EDIT },
        {
          type: "reviewSummary",
          rows: [
            { label: "To", value: "{{sp.result.toText}}" },
            { label: "From", value: "{{sp.result.fromText}}" },
            { label: "Amount", value: "{{sp.result.amountText}}" },
            { label: "How often", value: "{{sp.result.frequencyName}}" },
          ],
        },
        { type: "reviewSummary", visibleWhen: ONCE, rows: [{ label: "Date", value: "{{sp.result.startText}}" }] },
        {
          type: "reviewSummary", visibleWhen: REPEATS,
          rows: [{ label: "{{sp.mode == 'edit' ? 'Next payment' : 'Starts'}}", value: "{{sp.result.startText}}" }, { label: "Ends", value: "{{sp.result.endsText}}" }],
        },
        { type: "button", label: "View scheduled", variant: "primary", actions: [{ type: "exit" }] },
        { type: "button", label: "Schedule another", variant: "secondary", actions: [{ type: "navigate", to: "start" }] },
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
      // after a failed bank call: where to go depends on what the bank said (ctx.error)
      id: "route", title: "One moment", kind: "branch",
      onEnter: [{ type: "navigate", to: "failed" }],
      blocks: [],
      navigation: {
        rules: [
          { when: "ctx.error.code == 'TIMEOUT' && (ctx.error.integration == 'scheduleCreate' || ctx.error.integration == 'scheduleUpdate')", to: "timeout" },
          { when: "ctx.error.code == 'TIMEOUT'", to: "slow" },
          { when: "ctx.error.code == 'SERVICE_UNAVAILABLE'", to: "unavailable" },
          { when: isCode(PROBLEMS), to: "problem" },
        ],
      },
    },
    {
      // why the payment cannot be scheduled or changed, in the bank's words (nothing was saved), and where to fix it
      id: "problem", title: "Check the payment",
      blocks: [
        { type: "result", tone: "error", title: "We can’t schedule this yet", text: "{{ctx.error.message}} Nothing was changed." },
        { type: "button", label: "Change date", variant: "primary", visibleWhen: isCode(DATE_CODES), actions: [{ type: "navigate", to: "when" }] },
        { type: "button", label: "Edit", variant: "primary", visibleWhen: isCode(END_CODES), actions: [{ type: "navigate", to: "end" }] },
        { type: "button", label: "Change amount", variant: "primary", visibleWhen: isCode(AMOUNT_CODES), actions: [{ type: "navigate", to: "how" }] },
        { type: "button", label: "Choose account", variant: "primary", visibleWhen: isCode(ACCOUNT_CODES), actions: [{ type: "navigate", to: "how" }] },
        { type: "button", label: "Back", variant: "primary", visibleWhen: isCode([...TARGET_CODES, "SCHEDULE_LIMIT"]), actions: [{ type: "navigate", to: "home" }] },
        { type: "button", label: "Back to scheduled", variant: "primary", visibleWhen: isCode(GONE_CODES), actions: [{ type: "exit" }] },
      ],
    },
    {
      // Try again after a slow or unavailable service: back to where the person was
      id: "retry", title: "One moment", kind: "branch",
      onEnter: [{ type: "navigate", to: "review" }],
      blocks: [],
      navigation: {
        rules: [
          { when: "ctx.error.integration == 'accounts'", to: "start" },
          { when: "ctx.error.integration == 'payees' || ctx.error.integration == 'bills'", to: "what" },
          { when: "ctx.error.integration == 'schedules' || ctx.error.integration == 'scheduleGet'", to: "home" },
          { when: "ctx.error.integration == 'scheduleCheck'", to: "when" },
        ],
      },
    },
    {
      id: "timeout", title: "No answer in time", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We didn't get an answer in time", text: "We didn’t get an answer in time. Check your scheduled payments before you try again." },
        // the list of scheduled payments is a screen of the app, not of this journey: leaving the journey takes the person back to it
        { type: "button", label: "Check scheduled", variant: "primary", actions: [{ type: "exit" }] },
        { type: "button", label: "Close", variant: "secondary", actions: [{ type: "exit" }] },
      ],
    },
    {
      // a slow answer to a question that changes nothing (the accounts, the payees, the list, the check): safe to ask again
      id: "slow", title: "No answer in time", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We didn't get an answer in time", text: "This is taking longer than expected. Nothing was changed." },
        { type: "button", label: "Try again", variant: "primary", actions: [{ type: "navigate", to: "retry" }] },
        { type: "button", label: "Close", variant: "secondary", actions: [{ type: "exit" }] },
      ],
    },
    {
      id: "unavailable", title: "Service not available", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "Service not available", text: "We couldn’t reach the bank. Nothing was changed." },
        { type: "button", label: "Try again", variant: "primary", actions: [{ type: "navigate", to: "retry" }] },
        { type: "button", label: "Back", variant: "secondary", actions: [{ type: "exit" }] },
      ],
    },
    {
      id: "failed", title: "Not scheduled", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We couldn't complete this right now.", text: "Nothing was saved.", visibleWhen: "ctx.error.code == 'CORE_UNAVAILABLE'" },
        { type: "result", tone: "error", title: "We couldn’t confirm this change.", text: "Nothing was saved. Start again.", visibleWhen: "ctx.error.code == 'OTP_REQUIRED' || ctx.error.code == 'OTP_INVALID'" },
        {
          type: "result", tone: "error", title: "Something went wrong.", text: "Nothing was saved.",
          visibleWhen: "ctx.error.code != 'CORE_UNAVAILABLE' && ctx.error.code != 'OTP_REQUIRED' && ctx.error.code != 'OTP_INVALID'",
        },
        { type: "button", label: "Start again", variant: "primary", actions: [{ type: "navigate", to: "start" }] },
        { type: "button", label: "Close", variant: "secondary", actions: [{ type: "exit" }] },
      ],
    },
  ],
};
