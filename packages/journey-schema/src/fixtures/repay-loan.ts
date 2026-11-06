import type { Journey, Screen } from "../schema";
import { repayLoanAcceptance, repayLoanScenarios } from "./repay-loan-tests";
import { alert, answerScreens, button, codeScreen, denied, go, lacks, lockedScreen, otpData, otpIntegrations, payIntegration, route, sendCode, set, text } from "./save-kit";

/** What this journey holds only while it is being sent: the code and the tick. Cleared on every way out. */
const wipe = [set("otp.code", ""), set("rp.consent", false)];
const err = (e: string) => `rp.err == '${e}'`;
const TIMEOUT = "We didn’t get an answer in time. Check Activity before you try again, so you don’t pay twice.";
/** Which screen can fix a bank refusal: the amount to pay, the account that pays, or a loan that is gone. */
const KIND = "{{ctx.error.code == 'LOAN_NOT_FOUND' ? 'gone' : ctx.error.code == 'REPAY_BELOW' || ctx.error.code == 'REPAY_ABOVE' || ctx.error.code == 'AMOUNT_REQUIRED' || ctx.error.code == 'AMOUNT_DECIMALS' || ctx.error.code == 'OPTION_INVALID' ? 'amount' : ctx.error.code == 'INSUFFICIENT_FUNDS' || ctx.error.code == 'ACCOUNT_NOT_FOUND' || ctx.error.code == 'ACCOUNT_CANNOT_DEBIT' ? 'funds' : ''}}";
const view = (label: string, to: string) => button(label, [{ type: "navigate", toJourney: to }], "secondary");
const rows = (r: [string, string][], visibleWhen: string) => ({ type: "reviewSummary" as const, visibleWhen, rows: r.map(([label, value]) => ({ label, value })) });
const NEXT = { id: "next", label: "Pay next instalment", text: "{{ctx.loan.nextSub}} · {{ctx.loan.nextAmountText}}" };
const CUSTOM = { id: "custom", label: "Pay another amount", text: "Reduces what you owe" };
const SETTLE = { id: "settle", label: "Settle in full", text: "{{ctx.loan.settle.sub}} · {{ctx.loan.settle.totalText}}" };
/** The cards a bank offers: another amount and settling in full can each be switched off (opt.allowCustom, opt.allowSettle). */
const cards = (custom: boolean, settle: boolean) => ({
  type: "select" as const, bind: "rp.option", label: "How much?", variant: "rows" as const, choices: [NEXT, ...(custom ? [CUSTOM] : []), ...(settle ? [SETTLE] : [])],
  visibleWhen: `${custom ? "opt.allowCustom != false" : "opt.allowCustom == false"} && ${settle ? "opt.allowSettle != false" : "opt.allowSettle == false"}`,
});

/**
 * Repay a loan (BankWorkx, Personal: Save & Borrow). Choose a loan (skipped when there is one or one is passed in), how much (the next instalment, another
 * amount, or settle in full with the settlement figure on its card), the account that pays, a review the bank has checked, a tick, a one-time code, and the result.
 * A payment lowers the balance by its principal part; settling pays the balance, the interest since the last payment and, with more than 12 payments left, a 1% fee.
 *
 * Built from the spec of the prototype with the blocks FinX has: the card of a way that is switched off is not drawn and a line says so (the engine cannot dim a
 * card); the bank checks the amount and the account when Review is pressed, so its refusal is a line above the fields; a review carries the tick the money rules ask for
 * (the spec has none); an empty choice of loan says "Required" (the engine's word).
 */
export const repayLoan: Journey = {
  id: "jrn_bankworkx_repay_loan",
  slug: "repay-loan",
  name: "Repay a loan",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: repayLoanAcceptance,
  scenarios: repayLoanScenarios,
  dataModel: {
    "launch.loanId": { type: "string" },
    "launch.option": { type: "string" },
    "opt.allowCustom": { type: "boolean" },
    "opt.allowSettle": { type: "boolean" },
    "opt.settleFee": { type: "boolean" },
    "rp.loanId": { type: "string", required: true },
    "rp.option": { type: "string", required: true },
    "rp.amount": { type: "money", currency: "USD", required: true },
    "rp.from": { type: "string", required: true },
    "rp.consent": { type: "boolean", required: true },
    "rp.err": { type: "string" },
    "rp.msg": { type: "string" },
    ...otpData,
  },
  integrations: [
    { id: "loans", adapter: "bank.loans.list", mode: "sandbox" },
    payIntegration,
    { id: "loan", adapter: "bank.loans.get", mode: "sandbox" },
    { id: "checkRepay", adapter: "bank.loans.repay", mode: "sandbox" },
    { id: "checkSettle", adapter: "bank.loans.settle", mode: "sandbox" },
    ...otpIntegrations,
    { id: "repay", adapter: "bank.loans.repay", mode: "sandbox" },
    { id: "settle", adapter: "bank.loans.settle", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Repay a loan", kind: "branch",
      onEnter: [
        ...wipe, set("rp.err", ""), set("rp.msg", ""), set("rp.amount", null), set("ctx.error", null),
        { type: "callApi", integration: "loans", input: { pick: true }, saveAs: "ctx.loans", onError: { navigate: "fail" } },
        { type: "callApi", integration: "pay", saveAs: "ctx.pay", onError: { navigate: "fail" } },
        set("rp.from", "{{ctx.pay.defaultId}}"),
        // an option passed in is the one chosen when the bank offers it
        set("rp.option", "{{launch.option == 'custom' && opt.allowCustom != false ? 'custom' : launch.option == 'settle' && opt.allowSettle != false ? 'settle' : 'next'}}"),
        // a loan passed in is used when it is one of the person's; with only one loan there is nothing to choose
        set("rp.loanId", "{{has(ctx.loans.items, launch.loanId) ? launch.loanId : len(ctx.loans.items) == 1 ? ctx.loans.firstId : ''}}"),
        go("load"),
      ],
      navigation: route([lacks("payments.create"), "denied"], ["len(ctx.loans.items) == 0", "none"], ["isEmpty(rp.loanId)", "pick"]),
      blocks: [],
    },
    {
      id: "none", title: "Repay a loan", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "You have no loans.", text: "Borrow when you need to, with a clear monthly payment." },
        view("Apply for a loan", "apply-loan"),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "pick", title: "Choose a loan",
      blocks: [
        text("Choose a loan", "title"),
        { type: "select", bind: "rp.loanId", label: "Loan", source: "ctx.loans.items", variant: "rows" },
        button("Continue", [{ type: "validate" }, go("load")]),
        button("Back", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      // the loan as the bank knows it now, with what each way of paying costs: the cards read it
      id: "load", title: "Repay a loan", kind: "branch",
      onEnter: [{ type: "callApi", integration: "loan", input: { loanId: "{{rp.loanId}}", settleFee: "{{opt.settleFee != false}}" }, saveAs: "ctx.loan", onError: { navigate: "fail" } }, go("opt")],
      blocks: [],
    },
    {
      id: "opt", title: "How much?",
      blocks: [
        text("How much?", "title"),
        text("{{ctx.loan.name}} · {{ctx.loan.leftText}}", "caption"),
        alert("error", "{{rp.msg}}", err("amount")),
        cards(true, true), cards(true, false), cards(false, true), cards(false, false),
        text("Paying another amount isn’t available.", "caption", "opt.allowCustom == false"),
        text("Settling in full isn’t available.", "caption", "opt.allowSettle == false"),
        { type: "amountInput", bind: "rp.amount", currency: "USD", label: "Amount", visibleWhen: "rp.option == 'custom'", validation: { min: 10, messages: { min: "The smallest payment is $10.00." } } },
        button("Continue", [{ type: "validate" }, set("rp.err", ""), go("from")]),
        button("Back", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "from", title: "Pay from",
      blocks: [
        text("Pay from", "title"),
        alert("error", "{{rp.msg}}", err("funds")),
        { type: "select", bind: "rp.from", label: "From", source: "ctx.pay.accounts", variant: "rows" },
        // the bank applies every rule to the amount and the account that pays before the review
        button("Review", [set("rp.err", ""), go("check")]),
        button("Back", [go("opt")], "ghost"),
      ],
    },
    {
      id: "check", title: "Repay a loan", kind: "branch",
      onEnter: [go("checkPay")],
      navigation: route(["rp.option == 'settle'", "checkSettle"]),
      blocks: [],
    },
    {
      id: "checkPay", title: "Repay a loan", kind: "branch",
      onEnter: [{ type: "callApi", integration: "checkRepay", input: { loanId: "{{rp.loanId}}", option: "{{rp.option}}", amount: "{{rp.amount}}", fromAccountId: "{{rp.from}}", dryRun: true }, saveAs: "ctx.sum", onError: { navigate: "fail" } }, go("review")],
      blocks: [],
    },
    {
      id: "checkSettle", title: "Repay a loan", kind: "branch",
      onEnter: [{ type: "callApi", integration: "checkSettle", input: { loanId: "{{rp.loanId}}", fromAccountId: "{{rp.from}}", settleFee: "{{opt.settleFee != false}}", dryRun: true }, saveAs: "ctx.sum", onError: { navigate: "fail" } }, go("review")],
      blocks: [],
    },
    {
      id: "review", title: "Review",
      blocks: [
        text("Review", "title"),
        rows([["Loan", "{{ctx.sum.loanName}}"], ["From", "{{ctx.sum.fromName}}"], ["You pay", "{{ctx.sum.paidText}}"], ["Balance after", "{{ctx.sum.balanceText}}"]], "rp.option != 'settle'"),
        rows([["Loan", "{{ctx.sum.loanName}}"], ["From", "{{ctx.sum.fromName}}"], ["Balance", "{{ctx.loan.settle.balanceText}}"], ["You pay", "{{ctx.sum.paidText}}"], ["Balance after", "{{ctx.sum.balanceText}}"]], "rp.option == 'settle' && ctx.sum.interest == 0 && ctx.sum.fee == 0"),
        rows([["Loan", "{{ctx.sum.loanName}}"], ["From", "{{ctx.sum.fromName}}"], ["Balance", "{{ctx.loan.settle.balanceText}}"], ["Interest to date", "{{ctx.sum.interestText}}"], ["You pay", "{{ctx.sum.paidText}}"], ["Balance after", "{{ctx.sum.balanceText}}"]], "rp.option == 'settle' && ctx.sum.interest > 0 && ctx.sum.fee == 0"),
        rows([["Loan", "{{ctx.sum.loanName}}"], ["From", "{{ctx.sum.fromName}}"], ["Balance", "{{ctx.loan.settle.balanceText}}"], ["Early settlement fee", "{{ctx.sum.feeText}}"], ["You pay", "{{ctx.sum.paidText}}"], ["Balance after", "{{ctx.sum.balanceText}}"]], "rp.option == 'settle' && ctx.sum.interest == 0 && ctx.sum.fee > 0"),
        rows([["Loan", "{{ctx.sum.loanName}}"], ["From", "{{ctx.sum.fromName}}"], ["Balance", "{{ctx.loan.settle.balanceText}}"], ["Interest to date", "{{ctx.sum.interestText}}"], ["Early settlement fee", "{{ctx.sum.feeText}}"], ["You pay", "{{ctx.sum.paidText}}"], ["Balance after", "{{ctx.sum.balanceText}}"]], "rp.option == 'settle' && ctx.sum.interest > 0 && ctx.sum.fee > 0"),
        { type: "consent", bind: "rp.consent", termsVersion: "loan-repay-v1", text: "I confirm I want to make this payment.", validation: { mustBeTrue: true, messages: { mustBeTrue: "Tick the box to continue." } } },
        button("Pay", [{ type: "validate" }, sendCode(), go("code")]),
        button("Back", [go("from")], "ghost"),
      ],
    },
    codeScreen({ title: "Confirm with your code", heading: "Authorise {{ctx.sum.paidText}} to {{ctx.sum.loanName}}", submit: "Confirm", after: [set("otp.code", ""), go("submit")], back: "review", wipe }),
    {
      id: "submit", title: "Repay a loan", kind: "branch",
      onEnter: [go("doRepay")],
      navigation: route(["rp.option == 'settle'", "doSettle"]),
      blocks: [],
    },
    {
      id: "doRepay", title: "Repay a loan", kind: "branch",
      onEnter: [{ type: "callApi", integration: "repay", input: { loanId: "{{rp.loanId}}", option: "{{rp.option}}", amount: "{{rp.amount}}", fromAccountId: "{{rp.from}}" }, saveAs: "rp.res", onError: { navigate: "fail" } }, set("rp.consent", false), go("doneRepay")],
      blocks: [],
    },
    {
      id: "doSettle", title: "Repay a loan", kind: "branch",
      onEnter: [{ type: "callApi", integration: "settle", input: { loanId: "{{rp.loanId}}", fromAccountId: "{{rp.from}}", settleFee: "{{opt.settleFee != false}}" }, saveAs: "rp.res", onError: { navigate: "fail" } }, set("rp.consent", false), go("doneSettle")],
      blocks: [],
    },
    {
      id: "doneRepay", title: "Payment made", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Payment made", text: "{{rp.res.resultText}}", meta: "Reference {{rp.res.reference}}" },
        rows([["Loan", "{{rp.res.loanName}}"], ["From", "{{rp.res.fromName}}"], ["Paid", "{{rp.res.paidText}}"], ["Balance now", "{{rp.res.balanceText}}"], ["Next payment", "{{rp.res.next}}"]], "!isEmpty(rp.res.next)"),
        rows([["Loan", "{{rp.res.loanName}}"], ["From", "{{rp.res.fromName}}"], ["Paid", "{{rp.res.paidText}}"], ["Balance now", "{{rp.res.balanceText}}"]], "isEmpty(rp.res.next)"),
        view("View Save", "save-borrow"),
        button("Done", [{ type: "exit" }]),
      ],
    },
    {
      id: "doneSettle", title: "Loan settled", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Loan settled", text: "The loan is paid off.", meta: "Reference {{rp.res.reference}}" },
        rows([["Loan", "{{rp.res.loanName}}"], ["From", "{{rp.res.fromName}}"], ["Paid", "{{rp.res.paidText}}"], ["Balance now", "{{rp.res.balanceText}}"]], "true"),
        view("View Save", "save-borrow"),
        button("Done", [{ type: "exit" }]),
      ],
    },
    lockedScreen("Too many wrong codes. Nothing was paid. Start again when you’re ready.", "start", wipe),
    {
      // where a refusal goes: what the person can fix has its screen, the bank not answering has another
      id: "fail", title: "Repay a loan", kind: "branch",
      onEnter: [...wipe, set("rp.err", KIND), set("rp.msg", "{{ctx.error.message}}"), go("problem")],
      navigation: route(
        ["ctx.error.code == 'TIMEOUT'", "timeout"], ["ctx.error.code == 'SERVICE_UNAVAILABLE'", "unavailable"], ["rp.err == 'gone'", "gone"], ["rp.err == 'amount'", "opt"], ["rp.err == 'funds'", "from"],
      ),
      blocks: [],
    },
    {
      id: "gone", title: "Repay a loan", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We can’t find that loan.", text: "Nothing was paid." },
        button("Back", [go("start")]),
        button("Close", [{ type: "exit" }], "ghost"),
      ],
    },
    ...answerScreens("start", TIMEOUT, wipe),
    {
      id: "problem", title: "Repay a loan", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We couldn’t do that", text: "Something went wrong. Nothing was paid." },
        button("Try again", [go("start")]),
        button("Close", [{ type: "exit" }], "ghost"),
      ],
    },
    denied("Repay a loan"),
  ] as Screen[],
};
