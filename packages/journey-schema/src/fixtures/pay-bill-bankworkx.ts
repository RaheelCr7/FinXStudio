import type { Journey } from "../schema";
import { payBillBankworkxAcceptance, payBillBankworkxScenarios } from "./pay-bill-bankworkx-tests";

const toRoute = { navigate: "route" };
const lockOnWrongCode = { showToast: "That code isn't right.", stay: true, lockAfter: 3, lockTo: "locked" };

/** The bill is in the bank's home currency; the sandbox bank's is US dollars (the prefix of the amount is fixed, as in the prototype). */
const CCY = "USD";
const FETCH = "opt.billFetch != false";
const NO_FETCH = "opt.billFetch == false";
const ACCT = "{{ctx.accounts[pb.from].name}} {{ctx.accounts[pb.from].maskedNumber}}";
// always two decimals ($50.00): the bill is in the bank's home currency, whose symbol is fixed here (see CCY)
const MONEY = (path: string) => `$\{{${path} | money2}}`;

const CATEGORIES = ["Electricity", "Water", "Gas", "Internet and phone", "Mobile top-up", "Insurance", "Credit card", "Loan", "Tax and government", "Education", "Other"];

/** The reference formats of the directory: n digits (spaces and hyphens do not count), or "HI" and 8 digits. */
const digits = (n: number) => `^(?=.{0,24}$)(?:[ -]*[0-9]){${n}}[ -]*$`;
const REF_FIELDS = [
  { format: "d8", pattern: digits(8), hint: "8 digits", message: "Enter 8 digits." },
  { format: "d10", pattern: digits(10), hint: "10 digits", message: "Enter 10 digits." },
  { format: "d12", pattern: digits(12), hint: "12 digits", message: "Enter 12 digits." },
  { format: "d16", pattern: digits(16), hint: "16 digits", message: "Enter 16 digits." },
  { format: "hi8", pattern: "^(?=.{0,24}$)[ -]*[Hh][ -]*[Ii](?:[ -]*[0-9]){8}[ -]*$", hint: "HI and 8 digits", message: "Enter HI followed by 8 digits." },
];

/** Choosing a biller, from the directory or from the saved ones: what the next screens need to know about it. */
const choose = (idPath: string, namePath: string, ref?: string) => [
  { type: "setData", path: "ctx.error", value: null },
  { type: "setData", path: "pb.billerId", value: `{{${idPath}}}` },
  { type: "setData", path: "pb.billerName", value: `{{${namePath}}}` },
  { type: "setData", path: "pb.billerCat", value: "{{item.category}}" },
  { type: "setData", path: "pb.label", value: "{{item.label}}" },
  { type: "setData", path: "pb.format", value: "{{item.format}}" },
  { type: "setData", path: "pb.fee", value: "{{item.fee}}" },
  { type: "setData", path: "pb.ref", value: ref ?? "" },
  { type: "navigate", to: "ref" },
];

/** What the bank is asked to price: the same on the amount screen and when the amount changed under the person. */
const QUOTE_INPUT = {
  billerId: "{{pb.billerId}}", reference: "{{pb.ref}}", choice: "{{pb.choice}}", amount: "{{pb.amount}}", fromAccountId: "{{pb.from}}",
  fetched: "{{opt.billFetch != false}}", allowCrossCurrency: "{{opt.allowCrossCurrency != false}}",
};

const REF_PROBLEMS = "ctx.error.code == 'BILLER_NOT_FOUND' || ctx.error.code == 'BILL_NOT_FOUND' || ctx.error.code == 'BILL_ALREADY_PAID' || ctx.error.code == 'NO_AMOUNT_DUE' || ctx.error.code == 'BILLER_UNAVAILABLE' || ctx.error.code == 'INVALID_REFERENCE'";
const AMOUNT_CODES = ["AMOUNT_BELOW_MINIMUM", "AMOUNT_ABOVE_DUE", "INSUFFICIENT_FUNDS", "DAILY_LIMIT_EXCEEDED", "INVALID_AMOUNT"];
const ACCOUNT_CODES = ["BILL_CURRENCY_MISMATCH", "ACCOUNT_NOT_FOUND", "ACCOUNT_CANNOT_DEBIT", "CURRENCY_NOT_SUPPORTED"];
const isCode = (codes: string[]) => codes.map((c) => `ctx.error.code == '${c}'`).join(" || ");

/**
 * Pay a bill (BankWorkx, Payments). Choose a biller from the bank's directory (or a saved one), enter the reference, see the bill, pay the full
 * amount, the minimum or another amount, and get a receipt. A bill in another currency than the account adds one rate line. The bank's options
 * are plain data (opt.*, on unless set to false): billFetch, allowPartial, allowCrossCurrency, offerSaveBiller, offerAutopay.
 *
 * Built from the spec of the prototype with the blocks FinX has: launch values, the lookup while typing, the filter while typing, the live
 * summary under the amount and dimmed (rather than hidden) choices are not there, and the schedule is made by the payment itself
 * (see docs/BANKWORKX.md). The Meezan journey "pay-a-bill" is a different journey and is not changed.
 */
export const payBillBankworkx: Journey = {
  id: "jrn_pay_bill_bankworkx",
  slug: "pay-bill",
  name: "Pay a bill",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: payBillBankworkxAcceptance,
  scenarios: payBillBankworkxScenarios,
  dataModel: {
    "pb.search": { type: "string" },
    "pb.filter": { type: "string" },
    "pb.billerId": { type: "string" },
    "pb.billerName": { type: "string" },
    "pb.billerCat": { type: "string" },
    "pb.label": { type: "string" },
    "pb.format": { type: "string" },
    "pb.fee": { type: "number" },
    "pb.ref": { type: "string", required: true },
    "pb.choice": { type: "string" },
    "pb.amount": { type: "money", required: true, currency: CCY },
    "pb.from": { type: "string", required: true },
    "pb.save": { type: "boolean" },
    "pb.autopay": { type: "boolean" },
    "pb.consent": { type: "boolean", required: true },
    "pb.moved": { type: "boolean" },
    // the bank's options, set by the bank: left alone they are on
    "opt.billFetch": { type: "boolean" },
    "opt.allowPartial": { type: "boolean" },
    "opt.allowCrossCurrency": { type: "boolean" },
    "opt.offerSaveBiller": { type: "boolean" },
    "opt.offerAutopay": { type: "boolean" },
    "otp.code": { type: "string", pattern: "^[0-9]{6}$" },
  },
  integrations: [
    { id: "billers", adapter: "bank.billers.list", mode: "sandbox" },
    { id: "saved", adapter: "bank.bills.saved", mode: "sandbox" },
    { id: "lookup", adapter: "bank.bills.lookup", mode: "sandbox" },
    { id: "accounts", adapter: "bank.accounts.list", mode: "sandbox" },
    { id: "quote", adapter: "bank.bills.quote", mode: "sandbox" },
    { id: "otpSend", adapter: "bank.otp.send", mode: "sandbox" },
    { id: "otpVerify", adapter: "bank.otp.verify", mode: "sandbox" },
    { id: "pay", adapter: "bank.bills.pay", mode: "sandbox" },
  ],
  screens: [
    {
      // loads the saved billers and the directory and clears the form, then shows the directory. Start again and Pay another bill come back here.
      id: "start", title: "Pay a bill", kind: "branch",
      onEnter: [
        { type: "setData", path: "ctx.error", value: null },
        { type: "setData", path: "ctx.bill", value: null },
        { type: "setData", path: "ctx.q", value: null },
        { type: "setData", path: "pb.search", value: "" },
        { type: "setData", path: "pb.filter", value: "all" },
        { type: "setData", path: "pb.billerId", value: "" },
        { type: "setData", path: "pb.billerName", value: "" },
        { type: "setData", path: "pb.ref", value: "" },
        { type: "setData", path: "pb.choice", value: "full" },
        { type: "setData", path: "pb.amount", value: null },
        { type: "setData", path: "pb.from", value: "acc_main" },
        { type: "setData", path: "pb.save", value: false },
        { type: "setData", path: "pb.autopay", value: false },
        { type: "setData", path: "pb.consent", value: false },
        { type: "setData", path: "pb.moved", value: false },
        { type: "setData", path: "otp.code", value: "" },
        { type: "navigate", to: "biller" },
      ],
      blocks: [],
    },
    {
      // the directory and the saved billers that match what was searched; Search comes back here
      id: "biller", title: "Choose a biller",
      onEnter: [
        { type: "callApi", integration: "saved", input: { q: "{{pb.search}}", category: "{{pb.filter}}" }, saveAs: "ctx.saved", onError: toRoute },
        { type: "callApi", integration: "billers", input: { q: "{{pb.search}}", category: "{{pb.filter}}" }, saveAs: "ctx.billers", onError: toRoute },
      ],
      blocks: [
        { type: "stepper", steps: ["biller", "ref", "amount", "review", "otp"] },
        { type: "text", variant: "title", text: "Choose a biller" },
        { type: "textInput", bind: "pb.search", label: "Search billers", placeholder: "Search billers", pattern: "^.{0,40}$", patternMessage: "Use up to 40 characters." },
        { type: "select", bind: "pb.filter", label: "Category", variant: "chips", choices: [{ id: "all", label: "All" }, ...CATEGORIES.map((c) => ({ id: c, label: c }))] },
        {
          type: "button", label: "Search", variant: "secondary",
          actions: [{ type: "validate" }, { type: "navigate", to: "biller" }],
        },
        { type: "sectionHeader", title: "Saved", visibleWhen: "len(ctx.saved) > 0" },
        {
          type: "menu", source: "ctx.saved", visibleWhen: "len(ctx.saved) > 0",
          item: { label: "{{item.nickname}}", text: "{{item.billerName}} ••{{item.last4}}", actions: choose("item.billerId", "item.billerName", "{{item.reference}}") },
        },
        { type: "sectionHeader", title: "All billers", visibleWhen: "len(ctx.billers) > 0" },
        {
          type: "menu", source: "ctx.billers", visibleWhen: "len(ctx.billers) > 0",
          item: { label: "{{item.name}}", text: "{{item.category}}", actions: choose("item.id", "item.name") },
        },
        { type: "text", variant: "title", text: "No billers found", visibleWhen: "len(ctx.billers) == 0 && len(ctx.saved) == 0" },
        { type: "text", variant: "body", text: "Try another name or category.", visibleWhen: "len(ctx.billers) == 0 && len(ctx.saved) == 0" },
      ],
    },
    {
      id: "ref", title: "Enter the reference",
      blocks: [
        { type: "text", variant: "title", text: "Enter the reference" },
        { type: "avatar", name: "{{pb.billerName}}", text: "{{pb.billerCat}}" },
        { type: "button", label: "Change", variant: "ghost", actions: [{ type: "navigate", to: "biller" }] },
        ...REF_FIELDS.map((f) => ({
          type: "textInput" as const, bind: "pb.ref", label: "{{pb.label}}", placeholder: f.hint, visibleWhen: `pb.format == '${f.format}'`, pattern: f.pattern, patternMessage: f.message,
        })),
        { type: "text", variant: "caption", text: "Enter the amount on the next screen.", visibleWhen: NO_FETCH },
        {
          // the bank looks the bill up; what it found is shown on the next screen, and what it could not find on its own screen
          type: "button", label: "Continue", variant: "primary", visibleWhen: FETCH,
          actions: [
            { type: "validate" },
            { type: "setData", path: "ctx.error", value: null },
            { type: "callApi", integration: "lookup", input: { billerId: "{{pb.billerId}}", reference: "{{pb.ref}}", allowPartial: "{{opt.allowPartial != false}}" }, saveAs: "ctx.bill", onError: toRoute },
            { type: "callApi", integration: "accounts", input: { homeOnly: "{{opt.allowCrossCurrency == false}}" }, saveAs: "ctx.accounts", onError: toRoute },
            { type: "setData", path: "pb.choice", value: "full" },
            { type: "setData", path: "pb.amount", value: null },
            { type: "navigate", to: "amount" },
          ],
        },
        {
          // the person types the amount: no lookup is made
          type: "button", label: "Continue", variant: "primary", visibleWhen: NO_FETCH,
          actions: [
            { type: "validate" },
            { type: "setData", path: "ctx.error", value: null },
            { type: "setData", path: "ctx.bill", value: null },
            { type: "callApi", integration: "accounts", input: { homeOnly: "{{opt.allowCrossCurrency == false}}" }, saveAs: "ctx.accounts", onError: toRoute },
            { type: "setData", path: "pb.choice", value: "other" },
            { type: "setData", path: "pb.amount", value: null },
            { type: "navigate", to: "amount" },
          ],
        },
      ],
    },
    {
      id: "amount", title: "Amount",
      blocks: [
        { type: "text", variant: "title", text: "Amount" },
        {
          type: "reviewSummary", visibleWhen: FETCH,
          rows: [
            { label: "Biller", value: "{{pb.billerName}}" },
            { label: "{{pb.label}}", value: "{{ctx.bill.reference}}" },
            { label: "Amount due", value: MONEY("ctx.bill.due") },
            { label: "Due", value: "{{ctx.bill.dateText}}" },
          ],
        },
        { type: "alert", tone: "warning", visibleWhen: "ctx.bill.late", text: `Overdue. A late fee of ${MONEY("ctx.bill.lateFee")} is added to the amount due.` },
        { type: "avatar", name: "{{pb.billerName}}", text: "{{pb.billerCat}}", visibleWhen: NO_FETCH },
        // the bank offers the full amount always, and the minimum and another amount where the biller takes them (and the bank allows them)
        { type: "select", bind: "pb.choice", label: "How much?", variant: "rows", source: "ctx.bill.choices", visibleWhen: FETCH },
        { type: "text", variant: "caption", text: "This bill can only be paid in full.", visibleWhen: `${FETCH} && len(ctx.bill.choices) == 1` },
        {
          type: "amountInput", bind: "pb.amount", currency: CCY, label: "Amount", visibleWhen: `${NO_FETCH} || pb.choice == 'other'`,
          validation: {
            min: "ctx.bill.min", max: "ctx.bill.max",
            messages: { min: `The minimum is ${MONEY("ctx.bill.min")}.`, max: `The most you can pay is ${MONEY("ctx.bill.max")}.` },
          },
        },
        { type: "sectionHeader", title: "From" },
        { type: "accountPicker", bind: "pb.from", source: "ctx.accounts", showBalance: true },
        { type: "text", variant: "caption", text: `${"{{pb.billerName}}"} charges a fee of ${MONEY("pb.fee")}. It is shown on the next screen.`, visibleWhen: "pb.fee > 0" },
        {
          type: "button", label: "Continue", variant: "primary",
          actions: [
            { type: "validate" },
            { type: "setData", path: "ctx.error", value: null },
            { type: "callApi", integration: "quote", input: QUOTE_INPUT, saveAs: "ctx.q", onError: toRoute },
            // a reference whose amount due went up since it was looked up says so on the review
            { type: "setData", path: "pb.moved", value: "{{ctx.q.changed}}" },
            { type: "setData", path: "pb.consent", value: false },
            { type: "navigate", to: "review" },
          ],
        },
        { type: "button", label: "Back", variant: "ghost", actions: [{ type: "navigate", to: "ref" }] },
      ],
    },
    {
      id: "review", title: "Review",
      blocks: [
        { type: "alert", tone: "warning", visibleWhen: "pb.moved", text: "The amount due changed. Check it and confirm again." },
        { type: "text", variant: "title", text: `You’re paying ${MONEY("ctx.q.amount")} to {{pb.billerName}}` },
        {
          type: "reviewSummary",
          rows: [
            { label: "Biller", value: "{{pb.billerName}}" },
            { label: "{{pb.label}}", value: "{{ctx.q.reference}}" },
            { label: "Amount", value: MONEY("ctx.q.amount") },
          ],
        },
        { type: "reviewSummary", visibleWhen: "ctx.q.lateFee > 0", rows: [{ label: "Includes late fee", value: MONEY("ctx.q.lateFee") }] },
        { type: "reviewSummary", visibleWhen: "ctx.q.fee > 0", rows: [{ label: "Fee", value: MONEY("ctx.q.fee") }] },
        {
          type: "reviewSummary", visibleWhen: "ctx.q.rate > 0",
          rows: [
            { label: "Rate", value: "1 {{ctx.q.billCurrency}} = {{ctx.q.rate}} {{ctx.q.currency}}" },
            { label: "You pay", value: "{{ctx.q.youPay | money:ctx.q.currency}}" },
          ],
        },
        { type: "reviewSummary", rows: [{ label: "From", value: ACCT }, { label: "Date", value: "Today" }] },
        { type: "toggle", bind: "pb.save", label: "Save this biller", helper: "Pay it again in a tap.", visibleWhen: "opt.offerSaveBiller != false && !ctx.q.saved" },
        { type: "toggle", bind: "pb.autopay", label: "Pay automatically", helper: "Pay the full bill every month, starting a month after the due date.", visibleWhen: "opt.offerAutopay != false && ctx.q.autopayOk" },
        {
          type: "consent", bind: "pb.consent", termsVersion: "pay-bill-v1", text: "I confirm I want to pay this bill",
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
        { type: "button", label: "Change amount", variant: "ghost", actions: [{ type: "navigate", to: "amount" }] },
      ],
    },
    {
      id: "otp", title: "Enter your code",
      blocks: [
        { type: "text", variant: "title", text: `Authorise ${MONEY("ctx.q.amount")} to {{pb.billerName}}` },
        { type: "text", variant: "caption", text: "It only works for this payment." },
        {
          type: "otp", bind: "otp.code", length: 6, maxAttempts: 3, resendAfterSeconds: 30, keypad: true,
          hint: "We sent a 6-digit code to {{ctx.otp.maskedPhone}}.",
          onResend: [{ type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: toRoute }],
        },
        {
          type: "button", variant: "primary", label: "Pay bill",
          actions: [
            { type: "validate" },
            { type: "callApi", integration: "otpVerify", input: { code: "{{otp.code}}" }, onError: lockOnWrongCode },
            {
              // an amount due that changed since the review ends in route: the new amount is shown and nothing is paid
              type: "callApi", integration: "pay", saveAs: "pb.result", onError: toRoute,
              input: {
                billerId: "{{pb.billerId}}", reference: "{{pb.ref}}", amount: "{{ctx.q.amount}}", due: "{{ctx.q.due}}", fromAccountId: "{{pb.from}}",
                fetched: "{{opt.billFetch != false}}", allowCrossCurrency: "{{opt.allowCrossCurrency != false}}",
                save: "{{pb.save && opt.offerSaveBiller != false}}", autopay: "{{pb.autopay && opt.offerAutopay != false && ctx.q.autopayOk}}",
              },
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
          { when: "ctx.error.code == 'TIMEOUT' && ctx.error.integration == 'pay'", to: "timeout" },
          { when: "ctx.error.code == 'TIMEOUT'", to: "slow" },
          { when: "ctx.error.code == 'SERVICE_UNAVAILABLE'", to: "unavailable" },
          { when: "ctx.error.code == 'BILL_CHANGED'", to: "requote" },
          { when: REF_PROBLEMS, to: "refProblem" },
          { when: isCode([...AMOUNT_CODES, ...ACCOUNT_CODES]), to: "amountProblem" },
        ],
      },
    },
    {
      // the amount due changed after the person saw it: ask again, show the new amount, and the person confirms again
      id: "requote", title: "New amount", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "quote", input: QUOTE_INPUT, saveAs: "ctx.q", onError: toRoute },
        { type: "setData", path: "pb.moved", value: true },
        { type: "setData", path: "pb.consent", value: false },
        { type: "navigate", to: "review" },
      ],
      blocks: [],
    },
    {
      // why the bill cannot be paid, in the bank's words, and where to fix it
      id: "refProblem", title: "Check the bill",
      blocks: [
        { type: "result", tone: "error", title: "Choose a biller.", visibleWhen: "ctx.error.code == 'BILLER_NOT_FOUND'" },
        { type: "result", tone: "error", title: "No bill found", text: "Check the reference and try again.", visibleWhen: "ctx.error.code == 'BILL_NOT_FOUND'" },
        { type: "result", tone: "error", title: "Already paid", text: "There is nothing left to pay on this bill.", visibleWhen: "ctx.error.code == 'BILL_ALREADY_PAID'" },
        { type: "result", tone: "error", title: "No bill due", text: "Nothing to pay on this bill right now.", visibleWhen: "ctx.error.code == 'NO_AMOUNT_DUE'" },
        { type: "result", tone: "error", title: "Biller unavailable", text: "Try again later.", visibleWhen: "ctx.error.code == 'BILLER_UNAVAILABLE'" },
        { type: "result", tone: "error", title: "Check the reference.", visibleWhen: "ctx.error.code == 'INVALID_REFERENCE'" },
        { type: "result", tone: "error", title: "We can’t find this bill right now.", text: "Nothing was paid.", visibleWhen: `!(${REF_PROBLEMS})` },
        { type: "button", label: "Edit", variant: "primary", visibleWhen: "ctx.error.code == 'BILL_NOT_FOUND' || ctx.error.code == 'INVALID_REFERENCE'", actions: [{ type: "navigate", to: "ref" }] },
        { type: "button", label: "Back", variant: "primary", visibleWhen: "ctx.error.code == 'BILL_ALREADY_PAID' || ctx.error.code == 'NO_AMOUNT_DUE'", actions: [{ type: "navigate", to: "biller" }] },
        { type: "button", label: "Try again", variant: "primary", visibleWhen: "ctx.error.code == 'BILLER_UNAVAILABLE'", actions: [{ type: "navigate", to: "ref" }] },
        { type: "button", label: "Choose biller", variant: "primary", visibleWhen: "ctx.error.code == 'BILLER_NOT_FOUND'", actions: [{ type: "navigate", to: "biller" }] },
      ],
    },
    {
      // why the amount or the account cannot be used, in the bank's words (nothing was paid), and where to fix it
      id: "amountProblem", title: "Check the amount",
      blocks: [
        { type: "result", tone: "error", title: "We can’t make this payment yet", text: "{{ctx.error.message}} Nothing was paid." },
        { type: "button", label: "Change amount", variant: "primary", visibleWhen: isCode(AMOUNT_CODES), actions: [{ type: "navigate", to: "amount" }] },
        { type: "button", label: "Choose account", variant: "primary", visibleWhen: isCode(ACCOUNT_CODES), actions: [{ type: "navigate", to: "amount" }] },
      ],
    },
    {
      // Try again after a slow or unavailable service: back to where the person was
      id: "retry", title: "One moment", kind: "branch",
      onEnter: [{ type: "navigate", to: "review" }],
      blocks: [],
      navigation: {
        rules: [
          { when: "ctx.error.integration == 'saved' || ctx.error.integration == 'billers'", to: "start" },
          { when: "ctx.error.integration == 'lookup' || ctx.error.integration == 'accounts'", to: "ref" },
          { when: "ctx.error.integration == 'quote'", to: "amount" },
        ],
      },
    },
    {
      id: "success", title: "Done", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Bill paid", text: `${MONEY("pb.result.paid")} to {{pb.billerName}}.`, meta: "Paid · Ref {{pb.result.reference}}" },
        {
          type: "reviewSummary",
          rows: [
            { label: "Biller", value: "{{pb.billerName}}" },
            { label: "{{pb.label}}", value: "{{ctx.q.reference}}" },
            { label: "Amount", value: MONEY("pb.result.paid") },
          ],
        },
        { type: "reviewSummary", visibleWhen: "pb.result.fee > 0", rows: [{ label: "Fee", value: MONEY("pb.result.fee") }] },
        {
          type: "reviewSummary", visibleWhen: "pb.result.rate > 0",
          rows: [{ label: "Rate", value: "1 {{ctx.q.billCurrency}} = {{pb.result.rate}} {{pb.result.currency}}" }, { label: "You paid", value: "{{pb.result.youPay | money:pb.result.currency}}" }],
        },
        { type: "reviewSummary", rows: [{ label: "From", value: ACCT }, { label: "Date", value: "Today" }] },
        { type: "reviewSummary", visibleWhen: "pb.result.nextAutopay", rows: [{ label: "Next automatic payment", value: "{{pb.result.nextAutopay}}" }] },
        { type: "text", variant: "caption", text: `${MONEY("pb.result.left")} is still due on this bill.`, visibleWhen: "pb.result.left > 0" },
        { type: "text", variant: "caption", text: "{{pb.billerName}} is saved.", visibleWhen: "pb.result.saved" },
        { type: "button", label: "Pay another bill", variant: "secondary", actions: [{ type: "navigate", to: "start" }] },
        { type: "button", label: "View in Payments", variant: "primary", actions: [{ type: "exit" }] },
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
      // a slow answer to a question that moves no money (the directory, the bill, the price): nothing changed, so it is safe to ask again
      id: "slow", title: "No answer in time", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We didn't get an answer in time", text: "This is taking longer than expected. Nothing was paid." },
        { type: "button", label: "Try again", variant: "primary", actions: [{ type: "navigate", to: "retry" }] },
        { type: "button", label: "Close", variant: "secondary", actions: [{ type: "exit" }] },
      ],
    },
    {
      id: "unavailable", title: "Service not available", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "Service not available", text: "This service is not available right now. Nothing was paid. Please try again in a few minutes." },
        { type: "button", label: "Try again", variant: "primary", actions: [{ type: "navigate", to: "retry" }] },
        { type: "button", label: "Back", variant: "secondary", actions: [{ type: "exit" }] },
      ],
    },
    {
      id: "failed", title: "Not paid", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We couldn't complete this right now.", text: "No money has left your account.", visibleWhen: "ctx.error.code == 'CORE_UNAVAILABLE'" },
        { type: "result", tone: "error", title: "We couldn’t confirm this payment.", text: "Nothing was paid. Start again.", visibleWhen: "ctx.error.code == 'OTP_REQUIRED' || ctx.error.code == 'OTP_INVALID'" },
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
