import type { Journey, Screen } from "../schema";
import { termDepositAcceptance, termDepositScenarios } from "./term-deposit-tests";
import { alert, answerScreens, button, codeScreen, denied, go, lacks, lockedScreen, otpData, otpIntegrations, payIntegration, route, sendCode, set, text } from "./save-kit";

/** What this journey holds only while it is being sent: the code and the tick. Cleared on every way out. */
const wipe = [set("otp.code", ""), set("td.consent", false)];
const err = (e: string) => `td.err == '${e}'`;
const TIMEOUT = "We didn’t get an answer in time. Check Activity before you try again, so you don’t pay twice.";
/** Which kind of problem a bank refusal is: what the person can fix on a screen has its place, the rest is a plain failure. */
const KIND = "{{ctx.error.code == 'DEPOSIT_NOT_FOUND' ? 'gone' : ctx.error.code == 'EARLY_CLOSE_OFF' ? 'early' : ctx.error.code == 'OTP_REQUIRED' ? 'otp' : ctx.error.code == 'TERM_INVALID' || ctx.error.code == 'PAYOUT_OFF' || ctx.error.code == 'PAYOUT_INVALID' || ctx.error.code == 'INSTRUCTION_INVALID' ? 'term' : ctx.error.code == 'BELOW_MINIMUM' || ctx.error.code == 'ABOVE_MAXIMUM' || ctx.error.code == 'AMOUNT_REQUIRED' || ctx.error.code == 'AMOUNT_DECIMALS' || ctx.error.code == 'INSUFFICIENT_FUNDS' || ctx.error.code == 'ACCOUNT_NOT_FOUND' || ctx.error.code == 'ACCOUNT_CANNOT_DEBIT' || ctx.error.code == 'ACCOUNT_CANNOT_CREDIT' ? 'amount' : ''}}";
const choice = (id: string, label: string, t: string) => ({ id, label, text: t });
const summary = (rows: [string, string][]) => ({ type: "reviewSummary" as const, rows: rows.map(([label, value]) => ({ label, value })) });
const view = (label: string, to: string) => button(label, [{ type: "navigate", toJourney: to }], "secondary");

/**
 * Term deposit (BankWorkx, Personal: Save & Borrow). One journey, three modes: open a deposit (amount and the account that pays, a term, a review with the
 * interest and what arrives at maturity, a tick, a one-time code), renew or change what happens at maturity (no money moves, a code all the same) and close
 * early (the interest earned, the charge of half of it and what is paid, shown before the code; the money paid in is never touched).
 *
 * Built from the spec of the prototype with the blocks FinX has: the amount and the account are checked by the bank when Continue is pressed (the engine has
 * no live redraw), so "not enough money" is a line above the fields, not under one; a review carries the tick the money rules ask for (the spec has none);
 * the choice of a deposit says "Required" when nothing is chosen (the engine's word).
 */
export const termDeposit: Journey = {
  id: "jrn_bankworkx_term_deposit",
  slug: "term-deposit",
  name: "Term deposit",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: termDepositAcceptance,
  scenarios: termDepositScenarios,
  dataModel: {
    "launch.mode": { type: "string" },
    "launch.depositId": { type: "string" },
    "opt.allowMonthly": { type: "boolean" },
    "opt.allowEarlyClose": { type: "boolean" },
    "td.mode": { type: "string" },
    "td.depositId": { type: "string", required: true },
    "td.amount": { type: "money", currency: "USD", required: true },
    "td.from": { type: "string", required: true },
    "td.term": { type: "string", required: true },
    "td.payout": { type: "string", required: true },
    "td.instruction": { type: "string", required: true },
    "td.to": { type: "string", required: true },
    "td.consent": { type: "boolean", required: true },
    "td.err": { type: "string" },
    "td.msg": { type: "string" },
    ...otpData,
  },
  integrations: [
    { id: "deposits", adapter: "bank.deposits.list", mode: "sandbox" },
    payIntegration,
    { id: "terms", adapter: "bank.deposits.terms", mode: "sandbox" },
    { id: "quote", adapter: "bank.deposits.quote", mode: "sandbox" },
    { id: "renewQuote", adapter: "bank.deposits.renew.quote", mode: "sandbox" },
    { id: "closeQuote", adapter: "bank.deposits.close.quote", mode: "sandbox" },
    ...otpIntegrations,
    { id: "open", adapter: "bank.deposits.open", mode: "sandbox" },
    { id: "renew", adapter: "bank.deposits.renew", mode: "sandbox" },
    { id: "close", adapter: "bank.deposits.close", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Term deposit", kind: "branch",
      onEnter: [
        ...wipe, set("td.err", ""), set("td.msg", ""), set("td.term", "12"), set("td.payout", "maturity"), set("td.instruction", "renew"), set("td.amount", null), set("ctx.error", null),
        { type: "callApi", integration: "deposits", input: { pick: true }, saveAs: "ctx.deps", onError: { navigate: "fail" } },
        { type: "callApi", integration: "pay", saveAs: "ctx.pay", onError: { navigate: "fail" } },
        { type: "callApi", integration: "terms", input: { allowMonthly: "{{opt.allowMonthly != false}}" }, saveAs: "ctx.terms", onError: { navigate: "fail" } },
        set("td.mode", "{{launch.mode == 'renew' || launch.mode == 'close' ? launch.mode : 'open'}}"),
        set("td.from", "{{ctx.pay.defaultId}}"), set("td.to", "{{ctx.pay.defaultId}}"),
        // a deposit passed in is used when it is one of the person's; with only one deposit there is nothing to choose
        set("td.depositId", "{{has(ctx.deps.items, launch.depositId) ? launch.depositId : len(ctx.deps.items) == 1 ? ctx.deps.firstId : ''}}"),
        go("amount"),
      ],
      navigation: route(
        [lacks("payments.create"), "denied"], ["td.mode == 'open'", "amount"], ["len(ctx.deps.items) == 0", "none"], ["isEmpty(td.depositId)", "pick"], ["td.mode == 'renew'", "renew"], ["td.mode == 'close'", "closeLoad"],
      ),
      blocks: [],
    },
    {
      id: "pick", title: "Choose a deposit",
      blocks: [
        text("Choose a deposit", "title"),
        { type: "select", bind: "td.depositId", label: "Deposit", source: "ctx.deps.items", variant: "rows" },
        button("Continue", [{ type: "validate" }, { type: "navigate" }]),
        button("Back", [{ type: "exit" }], "ghost"),
      ],
      navigation: route(["td.mode == 'renew'", "renew"], ["td.mode == 'close'", "closeLoad"]),
    },
    {
      id: "none", title: "Term deposit", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "You have no term deposits.", text: "Open one to lock money away at a fixed rate." },
        button("Open a term deposit", [set("launch.mode", "open"), go("start")]),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "amount", title: "Open a term deposit",
      blocks: [
        text("Open a term deposit", "title"),
        alert("error", "{{td.msg}}", err("amount")),
        {
          type: "amountInput", bind: "td.amount", currency: "USD", label: "Amount", helper: "From $1,000.00 to $250,000.00",
          validation: { min: 1000, max: 250000, messages: { min: "The smallest deposit is $1,000.00.", max: "The largest deposit is $250,000.00." } },
        },
        { type: "select", bind: "td.from", label: "From", source: "ctx.pay.accounts", variant: "rows" },
        button("Continue", [{ type: "validate" }, set("td.err", ""), go("term")]),
        button("Cancel", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "term", title: "Choose a term",
      blocks: [
        text("Choose a term", "title"),
        alert("error", "{{td.msg}}", err("term")),
        { type: "select", bind: "td.term", label: "Term", source: "ctx.terms.terms", variant: "rows" },
        text("Interest paid", "caption"),
        { type: "select", bind: "td.payout", label: "Interest paid", variant: "chips", choices: [{ id: "maturity", label: "At maturity" }, { id: "monthly", label: "Every month" }], visibleWhen: "opt.allowMonthly != false" },
        text("Interest is paid at maturity.", "body", "opt.allowMonthly == false"),
        // the bank applies every rule (the amount, the account that pays, the term) before the review: a refusal goes back to the screen that can fix it
        button("Continue", [
          set("td.err", ""), set("td.payout", "{{opt.allowMonthly == false ? 'maturity' : td.payout}}"),
          { type: "callApi", integration: "quote", input: { amount: "{{td.amount}}", term: "{{td.term}}", payout: "{{td.payout}}", fromAccountId: "{{td.from}}", allowMonthly: "{{opt.allowMonthly != false}}" }, saveAs: "ctx.sum", onError: { navigate: "fail" } },
          go("review"),
        ]),
        button("Back", [go("amount")], "ghost"),
      ],
    },
    {
      // what the bank says it will do, with every rule applied and nothing opened
      id: "review", title: "Review",
      blocks: [
        text("Review", "title"),
        summary([
          ["Amount", "{{ctx.sum.amountText}}"], ["From", "{{ctx.sum.from}}"], ["Term", "{{ctx.sum.termText}}"], ["Rate", "{{ctx.sum.rateText}}"], ["Interest paid", "{{ctx.sum.payoutText}}"],
          ["Total interest", "{{ctx.sum.interestText}}"], ["Matures", "{{ctx.sum.maturesText}}"], ["You receive at maturity", "{{ctx.sum.receiveText}}"],
        ]),
        { type: "consent", bind: "td.consent", termsVersion: "term-deposit-v1", text: "I understand that closing early keeps back half of the interest earned.", validation: { mustBeTrue: true, messages: { mustBeTrue: "Tick the box to continue." } } },
        button("Confirm", [{ type: "validate" }, sendCode(), go("code")]),
        button("Back", [go("term")], "ghost"),
      ],
    },
    {
      id: "renew", title: "Renew or change",
      blocks: [
        text("Renew or change", "title"),
        alert("error", "{{td.msg}}", err("term")),
        summary([["Deposit", "{{ctx.deps.items[td.depositId].amountText}}"], ["Rate and maturity", "{{ctx.deps.items[td.depositId].line}}"]]),
        { type: "select", bind: "td.term", label: "New term", source: "ctx.terms.renewTerms", variant: "rows" },
        {
          type: "select", bind: "td.instruction", label: "At maturity", variant: "chips",
          choices: [{ id: "renew", label: "Renew with interest" }, { id: "renew-payout", label: "Renew, pay interest out" }, { id: "payout", label: "Pay out at maturity" }],
        },
        button("Review", [
          set("td.err", ""),
          { type: "callApi", integration: "renewQuote", input: { depositId: "{{td.depositId}}", term: "{{td.term}}", instruction: "{{td.instruction}}" }, saveAs: "ctx.sum", onError: { navigate: "fail" } },
          go("renewReview"),
        ]),
        button("Back", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "renewReview", title: "Review the change",
      blocks: [
        text("Review the change", "title"),
        summary([["Deposit", "{{ctx.sum.depositText}}"], ["New term", "{{ctx.sum.termText}}"], ["Rate", "{{ctx.sum.rateText}}"], ["At maturity", "{{ctx.sum.instructionText}}"], ["Takes effect", "{{ctx.sum.effectText}}"]]),
        text("No money moves.", "caption"),
        button("Confirm", [sendCode(), go("code")]),
        button("Back", [go("renew")], "ghost"),
      ],
    },
    {
      // what closing early pays, asked of the bank: with early closure off it says so and nothing can be confirmed
      id: "closeLoad", title: "Close this deposit", kind: "branch",
      onEnter: [{ type: "callApi", integration: "closeQuote", input: { depositId: "{{td.depositId}}", earlyClose: "{{opt.allowEarlyClose != false}}" }, saveAs: "ctx.cq", onError: { navigate: "fail" } }, go("close")],
      blocks: [],
    },
    {
      id: "close", title: "Close this deposit",
      blocks: [
        text("Close this deposit", "title"),
        alert("error", "This deposit can’t be closed early.", err("early")),
        alert("error", "{{td.msg}}", err("amount")),
        { type: "select", bind: "td.to", label: "Pay into", source: "ctx.pay.accounts", variant: "rows", visibleWhen: "!(td.err == 'early')" },
        {
          type: "reviewSummary", visibleWhen: "!(td.err == 'early')",
          rows: [{ label: "Deposit", value: "{{ctx.cq.depositText}}" }, { label: "Interest earned", value: "{{ctx.cq.earnedText}}" }, { label: "Early closure charge", value: "{{ctx.cq.chargeText}}" }, { label: "You receive", value: "{{ctx.cq.netText}}" }],
        },
        { type: "consent", bind: "td.consent", termsVersion: "term-deposit-v1", text: "I understand the early closure charge is taken from my interest.", validation: { mustBeTrue: true, messages: { mustBeTrue: "Tick the box to continue." } }, visibleWhen: "!(td.err == 'early')" },
        button("Confirm", [{ type: "validate" }, set("td.err", ""), sendCode(), go("code")], "primary", "!(td.err == 'early')"),
        button("Back", [{ type: "exit" }], "ghost"),
      ],
    },
    codeScreen({ title: "Confirm with your code", heading: [
      text("Authorise a deposit of {{ctx.sum.amountText}}", "title", "td.mode == 'open'"), text("Authorise the change to your deposit", "title", "td.mode == 'renew'"), text("Authorise closing your deposit", "title", "td.mode == 'close'"),
    ], submit: "Confirm", after: [set("otp.code", ""), go("submit")], back: "start", wipe }),
    {
      id: "submit", title: "Term deposit", kind: "branch",
      onEnter: [go("doOpen")],
      navigation: route(["td.mode == 'renew'", "doRenew"], ["td.mode == 'close'", "doClose"]),
      blocks: [],
    },
    {
      id: "doOpen", title: "Term deposit", kind: "branch",
      onEnter: [{ type: "callApi", integration: "open", input: { amount: "{{td.amount}}", term: "{{td.term}}", payout: "{{td.payout}}", fromAccountId: "{{td.from}}", allowMonthly: "{{opt.allowMonthly != false}}" }, saveAs: "td.res", onError: { navigate: "fail" } }, set("td.consent", false), go("doneOpen")],
      blocks: [],
    },
    {
      id: "doRenew", title: "Term deposit", kind: "branch",
      onEnter: [{ type: "callApi", integration: "renew", input: { depositId: "{{td.depositId}}", term: "{{td.term}}", instruction: "{{td.instruction}}" }, saveAs: "td.res", onError: { navigate: "fail" } }, go("doneRenew")],
      blocks: [],
    },
    {
      id: "doClose", title: "Term deposit", kind: "branch",
      onEnter: [{ type: "callApi", integration: "close", input: { depositId: "{{td.depositId}}", toAccountId: "{{td.to}}", earlyClose: "{{opt.allowEarlyClose != false}}" }, saveAs: "td.res", onError: { navigate: "fail" } }, set("td.consent", false), go("doneClose")],
      blocks: [],
    },
    {
      id: "doneOpen", title: "Deposit opened", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Deposit opened", text: "{{td.res.resultText}}", meta: "Reference {{td.res.reference}}" },
        summary([
          ["Amount", "{{td.res.amountText}}"], ["From", "{{td.res.from}}"], ["Term", "{{td.res.termText}}"], ["Rate", "{{td.res.rateText}}"], ["Interest paid", "{{td.res.payoutText}}"],
          ["Total interest", "{{td.res.interestText}}"], ["Matures", "{{td.res.maturesText}}"],
        ]),
        view("View deposits", "save-borrow"),
        button("Done", [{ type: "exit" }]),
      ],
    },
    {
      id: "doneRenew", title: "Deposit updated", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Deposit updated", text: "{{td.res.renewsText}}", meta: "Reference {{td.res.reference}}" },
        summary([["Deposit", "{{td.res.depositText}}"], ["New term", "{{td.res.termText}}"], ["Rate", "{{td.res.rateText}}"], ["At maturity", "{{td.res.instructionText}}"], ["Takes effect", "{{td.res.effectText}}"]]),
        view("View deposits", "save-borrow"),
        button("Done", [{ type: "exit" }]),
      ],
    },
    {
      id: "doneClose", title: "Deposit closed", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Deposit closed", text: "{{td.res.netText}} was paid into {{td.res.paidInto}}.", meta: "Reference {{td.res.reference}}" },
        summary([["Deposit", "{{td.res.depositText}}"], ["Interest earned", "{{td.res.earnedText}}"], ["Early closure charge", "{{td.res.chargeText}}"], ["Paid into", "{{td.res.paidInto}}"], ["You received", "{{td.res.netText}}"]]),
        view("View accounts", "accounts"),
        button("Done", [{ type: "exit" }]),
      ],
    },
    lockedScreen("Too many wrong codes. Nothing was changed. Start again when you’re ready.", "start", wipe),
    {
      // where a refusal goes: what the person can fix has its screen, the bank not answering has another
      id: "fail", title: "Term deposit", kind: "branch",
      onEnter: [...wipe, set("td.err", KIND), set("td.msg", "{{ctx.error.message}}"), go("problem")],
      navigation: route(
        ["ctx.error.code == 'TIMEOUT'", "timeout"], ["ctx.error.code == 'SERVICE_UNAVAILABLE'", "unavailable"], ["td.err == 'gone'", "gone"], ["td.err == 'early'", "close"],
        ["td.err == 'amount' && td.mode == 'close'", "close"], ["td.err == 'amount'", "amount"], ["td.err == 'term' && td.mode == 'renew'", "renew"], ["td.err == 'term'", "term"], ["td.err == 'otp'", "start"],
      ),
      blocks: [],
    },
    {
      id: "gone", title: "Term deposit", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We can’t find that deposit.", text: "Nothing was changed." },
        button("Back", [go("start")]),
        button("Close", [{ type: "exit" }], "ghost"),
      ],
    },
    ...answerScreens("start", TIMEOUT, wipe),
    {
      id: "problem", title: "Term deposit", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We couldn’t do that", text: "Something went wrong. No money has left your account and nothing was changed." },
        button("Try again", [go("start")]),
        button("Close", [{ type: "exit" }], "ghost"),
      ],
    },
    denied("Term deposit"),
  ] as Screen[],
};
