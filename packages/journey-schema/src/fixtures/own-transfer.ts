import type { Journey } from "../schema";
import { ownTransferAcceptance, ownTransferScenarios } from "./own-transfer-tests";

/** The account chosen as From or To, as a person reads it. */
const acct = (path: string) => `{{ctx.accounts[${path}].name}} {{ctx.accounts[${path}].maskedNumber}}`;
const FROM = "ctx.accounts[own.from]", TO = "ctx.accounts[own.to]";
/** The currency of the amount the person types: what they send, or what they get. */
const ENTERED = "{{own.dir == 'get' ? ctx.accounts[own.to].currency : ctx.accounts[own.from].currency}}";
/** More than one currency: a conversion (own.fx is saved when the accounts are chosen). */
const FX = "own.fx";
const SAME = "!own.fx";

/** The quote request, shared by "See the rate", "Get a new rate" and the renewal after a rate ran out. */
const quoteInput = { fromAccountId: "{{own.from}}", toAccountId: "{{own.to}}", amount: "{{own.amount}}", direction: "{{own.dir}}", feeWaived: "{{opt.fxFee == false}}" };
const toRoute = { navigate: "route" };

/**
 * Between my accounts (BankWorkx, Payments). Money between a person's own accounts. In the same currency it is an instant, free
 * move; in different currencies it is converted at the mid-market rate with no margin, a separate 0.20% fee and a rate held for
 * 30 seconds. Two options of the bank are plain data a bank sets: opt.allowFx (conversion on, the default) and opt.fxFee (the fee on).
 *
 * Built from the spec of the prototype with the blocks FinX has: the countdown, the live conversion summary and the launch values
 * of the prototype are not there (see docs/BANKWORKX.md).
 */
export const ownTransfer: Journey = {
  id: "jrn_own_transfer",
  slug: "own-transfer",
  name: "Between my accounts",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: ownTransferAcceptance,
  scenarios: ownTransferScenarios,
  dataModel: {
    "own.from": { type: "string", required: true },
    "own.to": { type: "string", required: true },
    "own.dir": { type: "string" },
    "own.fx": { type: "boolean" },
    "own.amount": { type: "money", required: true, currency: "{{own.dir == 'get' ? ctx.accounts[own.to].currency : ctx.accounts[own.from].currency}}" },
    "own.note": { type: "string" },
    "own.consent": { type: "boolean", required: true },
    "own.moved": { type: "boolean" },
    "own.oldRate": { type: "number" },
    "own.swap": { type: "string" },
    // the bank's options, set by the bank: left alone they are on
    "opt.allowFx": { type: "boolean" },
    "opt.fxFee": { type: "boolean" },
    "otp.code": { type: "string", pattern: "^[0-9]{6}$" },
  },
  integrations: [
    { id: "accounts", adapter: "bank.accounts.list", mode: "sandbox" },
    { id: "quote", adapter: "bank.fx.quote", mode: "sandbox" },
    { id: "convert", adapter: "bank.fx.convert", mode: "sandbox" },
    { id: "transferOwn", adapter: "bank.transfers.own", mode: "sandbox" },
    { id: "otpSend", adapter: "bank.otp.send", mode: "sandbox" },
    { id: "otpVerify", adapter: "bank.otp.verify", mode: "sandbox" },
  ],
  screens: [
    {
      // loads the accounts and sets the defaults (From the first account, To the second), then shows the first screen. Start again comes back here.
      id: "start", title: "Between my accounts", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "accounts", saveAs: "ctx.accounts", onError: toRoute },
        { type: "setData", path: "own.from", value: "acc_main" },
        { type: "setData", path: "own.to", value: "acc_save" },
        { type: "setData", path: "own.dir", value: "send" },
        { type: "setData", path: "own.consent", value: false },
        { type: "setData", path: "own.moved", value: false },
        { type: "setData", path: "own.amount", value: null },
        { type: "setData", path: "own.note", value: "" },
        { type: "setData", path: "otp.code", value: "" },
        { type: "navigate", to: "accounts" },
      ],
      blocks: [],
    },
    {
      id: "accounts", title: "Between my accounts",
      blocks: [
        { type: "stepper", steps: ["accounts", "amount", "review", "otp"] },
        { type: "text", variant: "title", text: "Between my accounts" },
        { type: "text", variant: "caption", text: "Money between your own accounts arrives straight away." },
        { type: "sectionHeader", title: "From" },
        { type: "accountPicker", bind: "own.from", source: "ctx.accounts", showBalance: true },
        {
          type: "button", label: "Swap accounts", variant: "ghost",
          // the other side is kept in own.swap for a moment, so the second assignment does not read the first
          actions: [
            { type: "setData", path: "own.swap", value: "{{own.from}}" },
            { type: "setData", path: "own.from", value: "{{own.to}}" },
            { type: "setData", path: "own.to", value: "{{own.swap}}" },
          ],
        },
        { type: "sectionHeader", title: "To" },
        { type: "accountPicker", bind: "own.to", source: "ctx.accounts", showBalance: true },
        {
          type: "alert", tone: "info", visibleWhen: `${FROM}.currency != ${TO}.currency`,
          text: "These accounts use different currencies. We convert at the mid-market rate, the one banks use between themselves, with no margin added. Our fee is shown separately: 0.20% of the amount. You see the exact rate before you confirm.",
        },
        {
          type: "button", label: "Continue", variant: "primary",
          actions: [
            { type: "validate" },
            { type: "setData", path: "own.fx", value: `{{${FROM}.currency != ${TO}.currency}}` },
            { type: "setData", path: "own.dir", value: "send" },
            { type: "setData", path: "own.amount", value: null },
            { type: "navigate", to: "amount" },
          ],
        },
      ],
      navigation: {
        rules: [
          { when: "own.from == own.to", to: "problem" },
          { when: `${FROM}.canDebit == false`, to: "problem" },
          { when: `opt.allowFx == false && ${FROM}.currency != ${TO}.currency`, to: "problem" },
        ],
      },
    },
    {
      // why the accounts cannot be used, in the words of the spec; every case is read from the accounts chosen
      id: "problem", title: "Check your accounts",
      blocks: [
        { type: "result", tone: "error", title: "Choose two different accounts.", visibleWhen: "own.from == own.to" },
        { type: "result", tone: "error", title: "You can't send money from this account right now.", text: "Choose another account.", visibleWhen: `own.from != own.to && ${FROM}.canDebit == false` },
        { type: "result", tone: "error", title: `We can't convert between {{${FROM}.currency}} and {{${TO}.currency}} yet.`, visibleWhen: `own.from != own.to && ${FROM}.canDebit != false` },
        { type: "button", label: "Choose account", variant: "primary", actions: [{ type: "navigate", to: "accounts" }] },
      ],
    },
    {
      id: "amount", title: "Amount",
      blocks: [
        { type: "reviewSummary", rows: [{ label: "From", value: `${acct("own.from")}` }, { label: "To", value: `${acct("own.to")}` }] },
        {
          type: "select", bind: "own.dir", label: "I want to enter", variant: "chips", visibleWhen: FX,
          choices: [{ id: "send", label: `What I send ({{${FROM}.currency}})` }, { id: "get", label: `What I get ({{${TO}.currency}})` }],
        },
        {
          type: "amountInput", bind: "own.amount", currency: ENTERED, label: "Amount",
          helper: `Entered in ${ENTERED}. Available in {{${FROM}.name}}: {{${FROM}.balance | money:${FROM}.currency}}.`,
          validation: {
            min: 1,
            // what they send cannot be more than they have (the fee is checked by the bank with the rate); when they type what they get, the bank checks
            max: `own.dir == 'get' ? 999999999 : ${FROM}.balance`,
            messages: {
              min: "The smallest amount is 1.00.",
              max: `There isn't enough money in {{${FROM}.name}}. Available: {{${FROM}.balance | money:${FROM}.currency}}, and the fee is {{(own.fx ? round(own.amount * 0.2) / 100 : 0) | money:${FROM}.currency}}.`,
            },
          },
        },
        { type: "textInput", bind: "own.note", label: "Note to yourself", placeholder: "Optional", visibleWhen: SAME, pattern: "^.{0,35}$", patternMessage: "Use up to 35 characters." },
        { type: "text", variant: "caption", text: "Up to 35 characters.", visibleWhen: SAME },
        {
          type: "reviewSummary", visibleWhen: `${SAME} && own.amount > 0`,
          rows: [
            { label: "You send", value: `{{own.amount | money:${FROM}.currency}}` },
            { label: "Fee", value: `{{0 | money:${FROM}.currency}}` },
            { label: "They get", value: `{{own.amount | money:${FROM}.currency}}` },
            { label: "Arrives", value: "Now" },
          ],
        },
        { type: "text", variant: "caption", text: "You see the exact rate, the fee and what you get before you confirm.", visibleWhen: FX },
        {
          type: "button", label: "See the rate", variant: "primary", visibleWhen: FX,
          actions: [
            { type: "validate" },
            { type: "setData", path: "own.moved", value: false },
            { type: "callApi", integration: "quote", input: quoteInput, saveAs: "ctx.quote", onError: toRoute },
            { type: "navigate", to: "review" },
          ],
        },
        { type: "button", label: "Continue", variant: "primary", visibleWhen: SAME, actions: [{ type: "validate" }, { type: "navigate", to: "review" }] },
      ],
    },
    {
      id: "review", title: "Review transfer",
      blocks: [
        { type: "alert", tone: "warning", visibleWhen: "own.moved", text: "The rate moved from {{own.oldRate}} to {{ctx.quote.rate}}. Check the new amounts and confirm again." },
        {
          type: "reviewSummary", visibleWhen: SAME,
          rows: [
            { label: "From", value: acct("own.from") },
            { label: "To", value: acct("own.to") },
            { label: "You send", value: `{{own.amount | money:${FROM}.currency}}` },
            { label: "Fee", value: `{{0 | money:${FROM}.currency}}` },
            { label: "Total taken", value: `{{own.amount | money:${FROM}.currency}}` },
            { label: "They get", value: `{{own.amount | money:${FROM}.currency}}` },
            { label: "Arrives", value: "Now" },
            { label: "Note", value: "{{own.note ? own.note : '-'}}" },
          ],
        },
        {
          type: "alert", tone: "info", visibleWhen: FX,
          text: "Mid-market rate, no margin. Held for {{ctx.quote.ttlSeconds}} seconds from when you saw it. If it runs out we show a new rate and you confirm again. Nothing is taken until you enter your code.",
        },
        {
          type: "reviewSummary", visibleWhen: FX,
          rows: [
            { label: "From", value: acct("own.from") },
            { label: "To", value: acct("own.to") },
            { label: "You send", value: "{{ctx.quote.from.amount | money:ctx.quote.from.currency}}" },
            { label: "Rate (mid-market)", value: "1 {{ctx.quote.from.currency}} = {{ctx.quote.rate}} {{ctx.quote.to.currency}}" },
            { label: "Margin on the rate", value: "None" },
            { label: "{{opt.fxFee == false ? 'Fee' : 'Fee (0.20%)'}}", value: "{{ctx.quote.fee | money:ctx.quote.from.currency}}" },
            { label: "Total taken", value: "{{ctx.quote.total | money:ctx.quote.from.currency}}" },
            { label: "You get", value: "{{ctx.quote.to.amount | money:ctx.quote.to.currency}}" },
            { label: "Arrives", value: "Now" },
          ],
        },
        {
          type: "button", label: "Get a new rate", variant: "secondary", visibleWhen: FX,
          actions: [
            { type: "setData", path: "own.oldRate", value: "{{ctx.quote.rate}}" },
            { type: "callApi", integration: "quote", input: quoteInput, saveAs: "ctx.quote", onError: toRoute },
            { type: "setData", path: "own.moved", value: false },
            { type: "showToast", text: "New rate: 1 {{ctx.quote.from.currency}} = {{ctx.quote.rate}} {{ctx.quote.to.currency}}" },
          ],
        },
        {
          type: "consent", bind: "own.consent", termsVersion: "own-transfer-v1", text: "I confirm the details are correct",
          validation: { mustBeTrue: true, messages: { mustBeTrue: "Tick to confirm." } },
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
      ],
    },
    {
      id: "otp", title: "Enter your code",
      blocks: [
        { type: "text", variant: "title", text: "Authorise converting {{ctx.quote.from.amount | money:ctx.quote.from.currency}} to {{ctx.quote.to.amount | money:ctx.quote.to.currency}}", visibleWhen: FX },
        { type: "text", variant: "title", text: `Authorise moving {{own.amount | money:${FROM}.currency}} to {{${TO}.name}}`, visibleWhen: SAME },
        { type: "text", variant: "caption", text: "It only works for this transfer." },
        {
          type: "otp", bind: "otp.code", length: 6, maxAttempts: 3, resendAfterSeconds: 30, keypad: true,
          hint: "We sent a 6-digit code to {{ctx.otp.maskedPhone}}.",
          onResend: [{ type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: toRoute }],
        },
        {
          type: "button", variant: "primary", visibleWhen: SAME, label: `Move {{own.amount | money:${FROM}.currency}}`,
          actions: [
            { type: "validate" },
            { type: "callApi", integration: "otpVerify", input: { code: "{{otp.code}}" }, onError: { showToast: "That code isn't right.", stay: true, lockAfter: 3, lockTo: "locked" } },
            { type: "callApi", integration: "transferOwn", input: { fromAccountId: "{{own.from}}", toAccountId: "{{own.to}}", amount: "{{own.amount}}", note: "{{own.note}}" }, saveAs: "own.result", onError: toRoute },
            { type: "navigate", to: "success" },
          ],
        },
        {
          type: "button", variant: "primary", visibleWhen: FX, label: "Convert {{ctx.quote.from.amount | money:ctx.quote.from.currency}}",
          actions: [
            { type: "validate" },
            { type: "callApi", integration: "otpVerify", input: { code: "{{otp.code}}" }, onError: { showToast: "That code isn't right.", stay: true, lockAfter: 3, lockTo: "locked" } },
            // a rate that ran out while the person typed the code ends in route: a new rate, nothing converted
            { type: "callApi", integration: "convert", input: { quoteId: "{{ctx.quote.quoteId}}" }, saveAs: "own.result", onError: toRoute },
            { type: "navigate", to: "success" },
          ],
        },
      ],
    },
    {
      // after a failed bank call: where to go depends on what the bank said (ctx.error.code)
      id: "route", title: "One moment", kind: "branch",
      onEnter: [{ type: "navigate", to: "failed" }],
      blocks: [],
      navigation: {
        rules: [
          { when: "ctx.error.code == 'TIMEOUT'", to: "timeout" },
          { when: "ctx.error.code == 'SERVICE_UNAVAILABLE'", to: "unavailable" },
          { when: "ctx.error.code == 'QUOTE_EXPIRED'", to: "requote" },
          { when: "ctx.error.code == 'INVALID_AMOUNT' || ctx.error.code == 'INSUFFICIENT_FUNDS'", to: "amountProblem" },
        ],
      },
    },
    {
      // the rate ran out: ask for a new one and show both, then the person confirms again
      id: "requote", title: "New rate", kind: "branch",
      onEnter: [
        { type: "setData", path: "own.oldRate", value: "{{ctx.quote.rate}}" },
        { type: "callApi", integration: "quote", input: quoteInput, saveAs: "ctx.quote", onError: toRoute },
        { type: "setData", path: "own.moved", value: true },
        { type: "setData", path: "own.consent", value: false },
        { type: "navigate", to: "review" },
      ],
      blocks: [],
    },
    {
      id: "amountProblem", title: "Check the amount",
      blocks: [
        { type: "result", tone: "error", title: "Enter an amount in the account's currency with at most 2 decimal places.", visibleWhen: "ctx.error.code == 'INVALID_AMOUNT'" },
        {
          type: "result", tone: "error", visibleWhen: "ctx.error.code == 'INSUFFICIENT_FUNDS'",
          title: `There isn't enough money in {{${FROM}.name}}.`,
          text: `Available: {{${FROM}.balance | money:${FROM}.currency}}. The fee is added to what you send.`,
        },
        { type: "button", label: "Change amount", variant: "primary", actions: [{ type: "navigate", to: "amount" }] },
      ],
    },
    {
      id: "success", title: "Done", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Money moved", visibleWhen: SAME, text: `{{own.amount | money:${FROM}.currency}} moved from {{${FROM}.name}} to {{${TO}.name}}.`, meta: "Done · instant · Ref {{own.result.reference}}" },
        { type: "result", tone: "success", title: "Converted", visibleWhen: FX, text: "{{ctx.quote.from.amount | money:ctx.quote.from.currency}} became {{ctx.quote.to.amount | money:ctx.quote.to.currency}}.", meta: "Ref {{own.result.reference}}" },
        {
          type: "reviewSummary", visibleWhen: SAME,
          rows: [
            { label: "From", value: acct("own.from") },
            { label: "To", value: acct("own.to") },
            { label: "You sent", value: `{{own.amount | money:${FROM}.currency}}` },
            { label: "Fee", value: `{{0 | money:${FROM}.currency}}` },
            { label: "Total taken", value: `{{own.amount | money:${FROM}.currency}}` },
            { label: "You received", value: `{{own.amount | money:${FROM}.currency}}` },
            { label: "Arrived", value: "Now" },
            { label: "Note", value: "{{own.note ? own.note : '-'}}" },
          ],
        },
        {
          type: "reviewSummary", visibleWhen: FX,
          rows: [
            { label: "From", value: acct("own.from") },
            { label: "To", value: acct("own.to") },
            { label: "You sent", value: "{{ctx.quote.from.amount | money:ctx.quote.from.currency}}" },
            { label: "Rate (mid-market, no margin)", value: "1 {{ctx.quote.from.currency}} = {{ctx.quote.rate}} {{ctx.quote.to.currency}}" },
            { label: "Fee", value: "{{ctx.quote.fee | money:ctx.quote.from.currency}}" },
            { label: "Total taken", value: "{{ctx.quote.total | money:ctx.quote.from.currency}}" },
            { label: "You received", value: "{{ctx.quote.to.amount | money:ctx.quote.to.currency}}" },
            { label: "Rate reference", value: "{{ctx.quote.quoteId}}" },
            { label: "Arrived", value: "Now" },
          ],
        },
        { type: "button", label: "View accounts", variant: "secondary", actions: [{ type: "exit" }] },
        { type: "button", label: "Move more", variant: "secondary", actions: [{ type: "navigate", to: "start" }] },
        { type: "button", label: "Done", variant: "primary", actions: [{ type: "exit" }] },
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
      id: "unavailable", title: "Service not available", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "Service not available", text: "This service is not available right now. Nothing was changed. Please try again in a few minutes." },
        { type: "button", label: "Try again", variant: "primary", actions: [{ type: "navigate", to: "start" }] },
        { type: "button", label: "Back", variant: "secondary", actions: [{ type: "exit" }] },
      ],
    },
    {
      id: "failed", title: "Not moved", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We can't find that account.", text: "No money has moved.", visibleWhen: "ctx.error.code == 'ACCOUNT_NOT_FOUND'" },
        { type: "result", tone: "error", title: "You can't send money from this account right now.", text: "Choose another account. No money has moved.", visibleWhen: "ctx.error.code == 'ACCOUNT_CANNOT_DEBIT'" },
        { type: "result", tone: "error", title: "Choose two different accounts.", text: "No money has moved.", visibleWhen: "ctx.error.code == 'SAME_ACCOUNT'" },
        { type: "result", tone: "error", title: "We can't convert between those currencies yet.", text: "No money has moved.", visibleWhen: "ctx.error.code == 'CURRENCY_NOT_SUPPORTED' || ctx.error.code == 'CURRENCY_MISMATCH'" },
        { type: "result", tone: "error", title: "We couldn't complete this right now.", text: "No money has left your account.", visibleWhen: "ctx.error.code == 'CORE_UNAVAILABLE'" },
        { type: "result", tone: "error", title: "We couldn't confirm this transfer.", text: "Nothing was moved. Start again.", visibleWhen: "ctx.error.code == 'OTP_REQUIRED' || ctx.error.code == 'OTP_INVALID'" },
        {
          type: "result", tone: "error", title: "Something went wrong.", text: "No money has left your account.",
          visibleWhen: "ctx.error.code != 'ACCOUNT_NOT_FOUND' && ctx.error.code != 'ACCOUNT_CANNOT_DEBIT' && ctx.error.code != 'SAME_ACCOUNT' && ctx.error.code != 'CURRENCY_NOT_SUPPORTED' && ctx.error.code != 'CURRENCY_MISMATCH' && ctx.error.code != 'CORE_UNAVAILABLE' && ctx.error.code != 'OTP_REQUIRED' && ctx.error.code != 'OTP_INVALID'",
        },
        { type: "button", label: "Start again", variant: "primary", actions: [{ type: "navigate", to: "start" }] },
        { type: "button", label: "Close", variant: "secondary", actions: [{ type: "exit" }] },
      ],
    },
  ],
};
