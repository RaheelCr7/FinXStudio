import type { Journey } from "../schema";
import { supplierPaymentAcceptance, supplierPaymentScenarios } from "./supplier-payment-tests";

const toRoute = { navigate: "route" };
const lockOnWrongCode = { showToast: "That code isn't right.", stay: true, lockAfter: 3, lockTo: "locked" };

/** What a supplier payment is for (the bank accepts these). */
const PURPOSES = ["Goods", "Services", "Rent", "Utilities", "Taxes and duties", "Other"];
/** Letters, digits, space and . , ' - / ( ) + : # — up to 35. */
const REFERENCE = "^[A-Za-z0-9 .,'\\-/()+:#]{1,35}$";

const CCY = "sp.ccy";
/** What the supplier gets, as the person reads it ("€30,000.00"). */
const RECEIVE = "{{ctx.quote.receive.amount | money2:ctx.quote.receive.currency}}";
const APPROVALS = "Needs {{ctx.quote.requiredApprovers}} approval{{ctx.quote.requiredApprovers > 1 ? 's' : ''}}";
/** What the supplier gets, from the payment that was made. */
const RESULT_RECEIVE = "{{sp.result.receive.amount | money2:sp.result.receive.currency}}";
const SUPPLIER = "{{sp.supplierName}}";
const QUOTE_INPUT = { fromAccountId: "{{sp.from}}", beneficiaryId: "{{sp.supplierId}}", amount: "{{sp.amount}}", purpose: "{{sp.purpose}}", reference: "{{sp.reference}}" };
/** Why a price or a payment was refused, in the words of the spec; the bank's own sentence follows where it says more. */
const MONEY_CODES = "ctx.error.code == 'INSUFFICIENT_FUNDS' || ctx.error.code == 'LIMIT_USER_EXCEEDED' || ctx.error.code == 'LIMIT_COMPANY_EXCEEDED'";
const SPEED_CODES = "ctx.error.code == 'RAIL_LIMIT' || ctx.error.code == 'RAIL_NOT_AVAILABLE'";
const FIELD_CODES = "ctx.error.code == 'INVALID_AMOUNT' || ctx.error.code == 'PURPOSE_REQUIRED' || ctx.error.code == 'REFERENCE_REQUIRED' || ctx.error.code == 'REFERENCE_TOO_LONG' || ctx.error.code == 'CURRENCY_NOT_SUPPORTED' || ctx.error.code == 'ACCOUNT_NOT_FOUND'";
const ALL_PROBLEMS = `${MONEY_CODES} || ${SPEED_CODES} || ${FIELD_CODES}`;

/**
 * Pay a supplier (BankWorkx Business, Payments). A Maker pays a saved supplier from the company's account: choose the supplier, enter the amount, a reference
 * and a purpose, see the speeds the bank offers (a speed over its limit is marked and not used), review, and send the payment for approval. Nothing leaves the
 * account until the approvers release it. A code is asked only from the company's threshold (25,000.00 in the demo), and it names the amount and the supplier.
 *
 * Built from the spec of the prototype with the blocks FinX has (see docs/BANKWORKX.md): the speeds are their own step because the bank only knows which fit
 * once it has the amount, a row is one tap, the bank's refusals are one screen with the bank's words instead of a message under the field, "Later" with a
 * pay date is not built (the bank starts every payment today), and the review has the consent tick the money rules ask for.
 */
export const supplierPayment: Journey = {
  id: "jrn_supplier_payment",
  slug: "supplier-payment",
  name: "Pay a supplier",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: supplierPaymentAcceptance,
  scenarios: supplierPaymentScenarios,
  dataModel: {
    "launch.supplierId": { type: "string" },
    "launch.amount": { type: "number" },
    "sp.supplierId": { type: "string", required: true },
    "sp.supplierName": { type: "string" },
    "sp.supplierLine": { type: "string" },
    "sp.ccy": { type: "string" },
    "sp.from": { type: "string" },
    "sp.amount": { type: "money", required: true, currency: "{{sp.ccy}}" },
    "sp.reference": { type: "string", required: true },
    "sp.purpose": { type: "string", required: true },
    "sp.speed": { type: "string", required: true },
    "sp.fromSpeed": { type: "boolean" },
    "sp.moved": { type: "boolean" },
    "sp.consent": { type: "boolean", required: true },
    "sp.result": { type: "object" },
    "otp.code": { type: "string", pattern: "^[0-9]{6}$" },
  },
  integrations: [
    { id: "company", adapter: "corp.company.get", mode: "sandbox" },
    { id: "quote", adapter: "corp.payments.quote", mode: "sandbox" },
    { id: "otpSend", adapter: "bank.otp.send", mode: "sandbox" },
    { id: "otpVerify", adapter: "bank.otp.verify", mode: "sandbox" },
    { id: "create", adapter: "corp.payments.create", mode: "sandbox" },
  ],
  screens: [
    {
      // loads the company (its accounts and saved suppliers) and clears the form. Opened with a supplier (launch.supplierId) the choice is skipped; with an amount it is filled in.
      id: "start", title: "Pay a supplier", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "company", saveAs: "ctx.company", onError: toRoute },
        { type: "setData", path: "ctx.error", value: null },
        { type: "setData", path: "sp.supplierId", value: "{{has(ctx.company.beneficiaries, launch.supplierId) ? launch.supplierId : ''}}" },
        { type: "setData", path: "sp.amount", value: "{{isEmpty(launch.amount) ? null : launch.amount}}" },
        // used once: Pay another supplier asks again
        { type: "setData", path: "launch.supplierId", value: "" },
        { type: "setData", path: "launch.amount", value: null },
        { type: "setData", path: "sp.supplierName", value: "" },
        { type: "setData", path: "sp.supplierLine", value: "" },
        { type: "setData", path: "sp.ccy", value: "" },
        { type: "setData", path: "sp.from", value: "{{ctx.company.defaultAccountId}}" },
        { type: "setData", path: "sp.reference", value: "" },
        { type: "setData", path: "sp.purpose", value: "" },
        { type: "setData", path: "sp.speed", value: "" },
        { type: "setData", path: "sp.fromSpeed", value: false },
        { type: "setData", path: "sp.moved", value: false },
        { type: "setData", path: "sp.consent", value: false },
        { type: "setData", path: "otp.code", value: "" },
        { type: "navigate", to: "supplier" },
      ],
      navigation: {
        rules: [
          // the screen only hides what the context cannot use: the bank refuses it again
          { when: "!isEmpty(session.permissions) && !has(session.permissions, 'biz.payments.initiate')", to: "denied" },
          { when: "!isEmpty(sp.supplierId)", to: "chosen" },
        ],
      },
      blocks: [],
    },
    {
      id: "supplier", title: "Choose a supplier",
      blocks: [
        { type: "stepper", steps: ["supplier", "amount", "speed", "review"] },
        { type: "text", variant: "title", text: "Choose a supplier" },
        { type: "alert", tone: "error", text: "Choose a supplier from your list.", visibleWhen: "ctx.error.code == 'BENEFICIARY_NOT_WHITELISTED'" },
        {
          // one row for each saved supplier: pressing it chooses them
          type: "menu", source: "ctx.company.beneficiaries",
          item: {
            label: "{{item.displayName}}", text: "{{item.line}}",
            actions: [{ type: "setData", path: "ctx.error", value: null }, { type: "setData", path: "sp.supplierId", value: "{{item.id}}" }, { type: "navigate", to: "chosen" }],
          },
        },
        { type: "text", variant: "body", text: "No suppliers are saved yet. Request one to pay them.", visibleWhen: "len(ctx.company.beneficiaries) == 0" },
        { type: "button", label: "Request a new supplier", variant: "secondary", actions: [{ type: "navigate", toJourney: "add-supplier" }] },
        { type: "button", label: "Cancel", variant: "ghost", actions: [{ type: "exit" }] },
      ],
    },
    {
      // takes what the supplier is paid in from the saved supplier
      id: "chosen", title: "Pay a supplier", kind: "branch",
      onEnter: [
        { type: "setData", path: "sp.supplierName", value: "{{ctx.company.beneficiaries[sp.supplierId].displayName}}" },
        { type: "setData", path: "sp.supplierLine", value: "{{ctx.company.beneficiaries[sp.supplierId].line}}" },
        { type: "setData", path: "sp.ccy", value: "{{ctx.company.beneficiaries[sp.supplierId].currency ? ctx.company.beneficiaries[sp.supplierId].currency : ctx.company.currency}}" },
        { type: "navigate", to: "amount" },
      ],
      blocks: [],
    },
    {
      id: "amount", title: "Amount",
      blocks: [
        { type: "stepper", steps: ["supplier", "amount", "speed", "review"] },
        { type: "reviewSummary", rows: [{ label: "To", value: `${SUPPLIER} {{sp.supplierLine}}` }, { label: "From", value: "{{ctx.company.accounts[sp.from].name}} {{ctx.company.accounts[sp.from].maskedNumber}}" }] },
        {
          type: "amountInput", bind: "sp.amount", currency: `{{${CCY}}}`,
          label: `{{sp.ccy == ctx.company.currency ? 'Amount' : 'Amount (' + sp.ccy + ')'}}`,
        },
        { type: "textInput", bind: "sp.reference", label: "Reference", placeholder: "Invoice or PO number", pattern: REFERENCE, patternMessage: "Use letters, numbers and spaces only." },
        { type: "select", bind: "sp.purpose", label: "Purpose", variant: "dropdown", options: PURPOSES },
        {
          // the bank prices it and chooses the first speed that fits; the person can change it on the next step
          type: "button", label: "Review", variant: "primary",
          actions: [
            { type: "validate" },
            { type: "setData", path: "ctx.error", value: null },
            { type: "setData", path: "sp.speed", value: "" },
            { type: "setData", path: "sp.fromSpeed", value: false },
            { type: "setData", path: "sp.consent", value: false },
            { type: "setData", path: "sp.moved", value: false },
            { type: "callApi", integration: "quote", input: { ...QUOTE_INPUT }, saveAs: "ctx.quote", onError: toRoute },
            { type: "setData", path: "sp.speed", value: "{{ctx.quote.speed}}" },
            { type: "navigate", to: "speed" },
          ],
        },
        { type: "button", label: "Back", variant: "ghost", actions: [{ type: "navigate", to: "supplier" }] },
      ],
    },
    {
      id: "speed", title: "How fast?",
      blocks: [
        { type: "stepper", steps: ["supplier", "amount", "speed", "review"] },
        { type: "text", variant: "title", text: "How fast?" },
        { type: "select", bind: "sp.speed", label: "Speed", variant: "rows", source: "ctx.quote.speeds" },
        { type: "text", variant: "caption", text: "A speed that is over the limit for this amount is marked, and the bank will not use it." },
        { type: "reviewSummary", visibleWhen: "ctx.quote.converted", rows: [{ label: "Rate", value: "1 {{ctx.quote.currency}} = {{ctx.quote.rate}} {{ctx.quote.receive.currency}}" }] },
        { type: "reviewSummary", rows: [{ label: "You pay", value: "{{ctx.quote.total | money2:ctx.quote.currency}}" }] },
        {
          type: "button", label: "Review", variant: "primary",
          actions: [
            { type: "validate" },
            { type: "setData", path: "ctx.error", value: null },
            { type: "setData", path: "sp.fromSpeed", value: true },
            { type: "setData", path: "sp.consent", value: false },
            { type: "callApi", integration: "quote", input: { ...QUOTE_INPUT, speed: "{{sp.speed}}" }, saveAs: "ctx.quote", onError: toRoute },
            { type: "navigate", to: "review" },
          ],
        },
        { type: "button", label: "Change amount", variant: "ghost", actions: [{ type: "navigate", to: "amount" }] },
      ],
    },
    {
      id: "review", title: "Review payment",
      blocks: [
        { type: "stepper", steps: ["supplier", "amount", "speed", "review"] },
        { type: "alert", tone: "warning", visibleWhen: "sp.moved", text: "The price changed. Check the new amount and confirm again." },
        { type: "text", variant: "title", text: `You’re paying ${RECEIVE} to ${SUPPLIER}` },
        {
          type: "reviewSummary",
          rows: [
            { label: "Supplier", value: SUPPLIER },
            { label: "Amount", value: RECEIVE },
            { label: "You pay", value: "{{ctx.quote.total | money2:ctx.quote.currency}}" },
            { label: "Speed", value: "{{ctx.quote.speedName}}" },
            { label: "Arrives", value: "{{ctx.quote.arrives}}" },
            { label: "Reference", value: "{{sp.reference}}" },
            { label: "Approval", value: APPROVALS },
          ],
        },
        { type: "reviewSummary", visibleWhen: "ctx.quote.converted", rows: [{ label: "Rate", value: "1 {{ctx.quote.currency}} = {{ctx.quote.rate}} {{ctx.quote.receive.currency}}" }] },
        { type: "alert", tone: "info", text: "Nothing leaves the account until the approvers release the payment." },
        { type: "consent", bind: "sp.consent", termsVersion: "supplier-payment-v1", text: "I confirm the details are correct", validation: { mustBeTrue: true, messages: { mustBeTrue: "Tick the confirmation first" } } },
        {
          // under the company's threshold no code is asked: the list of saved suppliers is the control
          type: "button", label: "Send for approval", variant: "primary", visibleWhen: "!ctx.quote.codeRequired",
          actions: [
            { type: "validate" },
            { type: "setData", path: "ctx.error", value: null },
            { type: "callApi", integration: "create", input: { quoteId: "{{ctx.quote.quoteId}}" }, saveAs: "sp.result", onError: toRoute },
            { type: "navigate", to: "result" },
          ],
        },
        {
          type: "button", label: "Send for approval", variant: "primary", visibleWhen: "ctx.quote.codeRequired",
          actions: [
            { type: "validate" },
            { type: "setData", path: "ctx.error", value: null },
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
        { type: "text", variant: "title", text: `Authorise ${RECEIVE} to ${SUPPLIER}` },
        { type: "text", variant: "caption", text: "It only works for this payment." },
        {
          type: "otp", bind: "otp.code", length: 6, maxAttempts: 3, resendAfterSeconds: 30, keypad: true,
          hint: "Code sent to {{ctx.otp.maskedPhone}}.",
          onResend: [{ type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: toRoute }],
        },
        {
          type: "button", label: "Send for approval", variant: "primary",
          actions: [
            { type: "validate" },
            { type: "callApi", integration: "otpVerify", input: { code: "{{otp.code}}" }, onError: lockOnWrongCode },
            // a price that ran out while the person typed the code ends in route: a new price, nothing sent
            { type: "callApi", integration: "create", input: { quoteId: "{{ctx.quote.quoteId}}" }, saveAs: "sp.result", onError: toRoute },
            { type: "navigate", to: "result" },
          ],
        },
      ],
    },
    {
      id: "result", title: "Sent for approval", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Sent for approval", text: `${RESULT_RECEIVE} to ${SUPPLIER}`, meta: "Payment {{sp.result.id}}" },
        { type: "statusChip", status: "pending_approval", label: "Waiting for {{sp.result.required}} approval{{sp.result.required > 1 ? 's' : ''}}" },
        {
          type: "reviewSummary",
          rows: [
            { label: "Supplier", value: SUPPLIER },
            { label: "Amount", value: RESULT_RECEIVE },
            { label: "You pay", value: "{{sp.result.amount | money2:sp.result.currency}}" },
            { label: "Speed", value: "{{sp.result.rail.name}}" },
            { label: "Arrives", value: "{{sp.result.arrives}}" },
            { label: "Approval", value: "Needs {{sp.result.required}} approval{{sp.result.required > 1 ? 's' : ''}}" },
          ],
        },
        { type: "button", label: "Track payment", variant: "primary", actions: [{ type: "exit" }] },
        { type: "button", label: "Pay another supplier", variant: "secondary", actions: [{ type: "navigate", to: "start" }] },
        { type: "button", label: "Share receipt", variant: "ghost", actions: [{ type: "share", template: "receipt" }] },
        { type: "button", label: "Done", variant: "ghost", actions: [{ type: "exit" }] },
      ],
    },
    {
      // after a failed bank call: where to go depends on what the bank said (ctx.error)
      id: "route", title: "One moment", kind: "branch",
      onEnter: [{ type: "navigate", to: "failed" }],
      blocks: [],
      navigation: {
        rules: [
          { when: "ctx.error.code == 'TIMEOUT' && ctx.error.integration == 'create'", to: "timeout" },
          { when: "ctx.error.code == 'TIMEOUT'", to: "slow" },
          { when: "ctx.error.code == 'SERVICE_UNAVAILABLE'", to: "unavailable" },
          { when: "ctx.error.code == 'PERMISSION_DENIED' || ctx.error.code == 'WRONG_CONTEXT'", to: "denied" },
          { when: "ctx.error.code == 'QUOTE_EXPIRED'", to: "requote" },
          { when: "ctx.error.code == 'BENEFICIARY_NOT_WHITELISTED'", to: "supplier" },
          { when: ALL_PROBLEMS, to: "problem" },
        ],
      },
    },
    {
      // the price ran out: ask for a new one, and the person confirms the new amount
      id: "requote", title: "New price", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "quote", input: { ...QUOTE_INPUT, speed: "{{sp.speed}}" }, saveAs: "ctx.quote", onError: toRoute },
        { type: "setData", path: "sp.moved", value: true },
        { type: "setData", path: "sp.consent", value: false },
        { type: "navigate", to: "review" },
      ],
      blocks: [],
    },
    {
      // why the payment cannot go ahead, and where to fix it
      id: "problem", title: "Check the payment",
      blocks: [
        { type: "result", tone: "error", title: "That is over the limit for this payment. Try a smaller amount.", text: "{{ctx.error.message}} Nothing was sent.", visibleWhen: "ctx.error.code == 'RAIL_LIMIT'" },
        { type: "result", tone: "error", title: "There isn’t enough money in the account.", text: "Not enough in {{ctx.company.accounts[sp.from].name}}. Available: {{ctx.company.accounts[sp.from].balance | money2:ctx.company.currency}}. Nothing was sent.", visibleWhen: "ctx.error.code == 'INSUFFICIENT_FUNDS'" },
        { type: "result", tone: "error", title: "That is over your daily limit.", text: "{{ctx.error.message}} Nothing was sent.", visibleWhen: "ctx.error.code == 'LIMIT_USER_EXCEEDED'" },
        { type: "result", tone: "error", title: "We can’t send this payment yet", text: "{{ctx.error.message}} Nothing was sent.", visibleWhen: "ctx.error.code != 'RAIL_LIMIT' && ctx.error.code != 'INSUFFICIENT_FUNDS' && ctx.error.code != 'LIMIT_USER_EXCEEDED'" },
        { type: "button", label: "Change speed", variant: "primary", visibleWhen: `(${SPEED_CODES}) && sp.fromSpeed`, actions: [{ type: "navigate", to: "speed" }] },
        { type: "button", label: "Change amount", variant: "primary", visibleWhen: `!((${SPEED_CODES}) && sp.fromSpeed)`, actions: [{ type: "navigate", to: "amount" }] },
        { type: "button", label: "Change amount", variant: "secondary", visibleWhen: `(${SPEED_CODES}) && sp.fromSpeed`, actions: [{ type: "navigate", to: "amount" }] },
        { type: "button", label: "Cancel", variant: "ghost", actions: [{ type: "exit" }] },
      ],
    },
    {
      // Try again after a slow or unavailable service: back to where the person was
      id: "retry", title: "One moment", kind: "branch",
      onEnter: [{ type: "navigate", to: "review" }],
      blocks: [],
      navigation: {
        rules: [
          { when: "ctx.error.integration == 'company'", to: "start" },
          { when: "ctx.error.integration == 'quote'", to: "amount" },
        ],
      },
    },
    {
      id: "denied", title: "Not allowed", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "You can’t pay suppliers at this company", text: "Your role at this company doesn’t include it. The bank checks this on its side too, so hiding the button isn’t the only guard.", visibleWhen: "ctx.error.code != 'WRONG_CONTEXT'" },
        { type: "result", tone: "error", title: "Switch to your business first", text: "{{ctx.error.message}}", visibleWhen: "ctx.error.code == 'WRONG_CONTEXT'" },
        { type: "button", label: "Close", variant: "primary", actions: [{ type: "exit" }] },
      ],
    },
    {
      id: "locked", title: "Too many wrong codes", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We couldn’t confirm this payment.", text: "Nothing was sent. Start again." },
        { type: "button", label: "Start again", variant: "primary", actions: [{ type: "navigate", to: "start" }] },
        { type: "button", label: "Close", variant: "secondary", actions: [{ type: "exit" }] },
      ],
    },
    {
      // the payment may or may not have been made: say so, and send the person to check
      id: "timeout", title: "No answer in time", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We didn’t get an answer in time", text: "We didn’t get an answer in time. Check Payments before you try again, so you don’t pay twice." },
        { type: "button", label: "Check Payments", variant: "primary", actions: [{ type: "exit" }] },
        { type: "button", label: "Close", variant: "secondary", actions: [{ type: "exit" }] },
      ],
    },
    {
      // a slow answer to a question that moves no money (the company, the price): nothing changed, so it is safe to ask again
      id: "slow", title: "No answer in time", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We didn’t get an answer in time", text: "This is taking longer than expected. Nothing was sent." },
        { type: "button", label: "Try again", variant: "primary", actions: [{ type: "navigate", to: "retry" }] },
        { type: "button", label: "Close", variant: "secondary", actions: [{ type: "exit" }] },
      ],
    },
    {
      id: "unavailable", title: "We couldn’t reach the bank", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We couldn’t reach the bank", text: "Nothing was sent and you haven’t been charged. Try again in a moment." },
        { type: "button", label: "Try again", variant: "primary", actions: [{ type: "navigate", to: "retry" }] },
        { type: "button", label: "Cancel", variant: "secondary", actions: [{ type: "exit" }] },
      ],
    },
    {
      id: "failed", title: "Not sent", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We couldn’t confirm this payment.", text: "Nothing was sent. Start again.", visibleWhen: "ctx.error.code == 'OTP_REQUIRED' || ctx.error.code == 'OTP_INVALID' || ctx.error.code == 'STEP_UP_FAILED'" },
        { type: "result", tone: "error", title: "This payment was already handled.", text: "Check Payments before you try again. Nothing more was sent.", visibleWhen: "ctx.error.code == 'QUOTE_USED' || ctx.error.code == 'QUOTE_NOT_FOUND'" },
        { type: "result", tone: "error", title: "We couldn’t complete this right now.", text: "Nothing was sent.", visibleWhen: "ctx.error.code == 'CORE_UNAVAILABLE'" },
        {
          type: "result", tone: "error", title: "Something went wrong.", text: "Nothing was sent.",
          visibleWhen: "ctx.error.code != 'OTP_REQUIRED' && ctx.error.code != 'OTP_INVALID' && ctx.error.code != 'STEP_UP_FAILED' && ctx.error.code != 'QUOTE_USED' && ctx.error.code != 'QUOTE_NOT_FOUND' && ctx.error.code != 'CORE_UNAVAILABLE'",
        },
        { type: "button", label: "Start again", variant: "primary", actions: [{ type: "navigate", to: "start" }] },
        { type: "button", label: "Close", variant: "secondary", actions: [{ type: "exit" }] },
      ],
    },
  ],
};
