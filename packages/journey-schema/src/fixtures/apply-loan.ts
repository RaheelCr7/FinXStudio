import type { Journey, Screen } from "../schema";
import { applyLoanAcceptance, applyLoanScenarios } from "./apply-loan-tests";
import { alert, answerScreens, button, codeScreen, denied, go, lacks, lockedScreen, otpData, otpIntegrations, payIntegration, route, sendCode, set, text } from "./save-kit";

/** What this journey holds only while it is being sent: the code and the tick. Cleared on every way out. */
const wipe = [set("otp.code", ""), set("loan.consent", false)];
const err = (e: string) => `loan.err == '${e}'`;
const TIMEOUT = "We didn’t get an answer in time. Check your loans before you try again.";
/** Which screen can fix a bank refusal: the amount and term, the work and income, or the account that gets the money. */
const KIND = "{{ctx.error.code == 'LOAN_LIMIT' || ctx.error.code == 'AMOUNT_RANGE' || ctx.error.code == 'AMOUNT_STEP' || ctx.error.code == 'TERM_INVALID' || ctx.error.code == 'AMOUNT_REQUIRED' || ctx.error.code == 'PURPOSE_INVALID' ? 'loan' : ctx.error.code == 'EMPLOYMENT_INVALID' || ctx.error.code == 'INCOME_INVALID' || ctx.error.code == 'COMMITMENTS_INVALID' ? 'work' : ctx.error.code == 'ACCOUNT_NOT_FOUND' || ctx.error.code == 'ACCOUNT_CANNOT_CREDIT' ? 'account' : ''}}";
const summary = (rows: [string, string][], visibleWhen?: string) => ({ type: "reviewSummary" as const, ...(visibleWhen ? { visibleWhen } : {}), rows: rows.map(([label, value]) => ({ label, value })) });
const view = (label: string, to: string) => button(label, [{ type: "navigate", toJourney: to }], "secondary");
const TERMS = ["12", "24", "36", "48", "60"].map((t) => ({ id: t, label: `${t} months` }));
const PURPOSES = ["Home improvement", "Car", "Education", "Medical", "Travel", "Debt consolidation", "Other"];
const EMPLOYMENT = ["Employed", "Self-employed", "Retired", "Student", "Not working"];
/** The live card: the payment is the amount times what 1.00 costs each month at the term's rate (the bank gives that factor), so it follows the amount and the term as they change. */
const PAYMENT = "{{loan.amount > 0 ? round(loan.amount * ctx.rates.rates[loan.term].factor * 100) / 100 : 0 | money2:USD}}";

/**
 * Apply for a loan (BankWorkx, Personal: Save & Borrow). The amount and term with a monthly payment and rate that follow them, what the loan is for, work and
 * income, a decision at once (approved, in review or declined), and for an approved offer the terms ticked and a one-time code before the money is paid in.
 * Only an approval asks for a code; a review or a decline creates no loan and moves no money.
 *
 * Built from the spec of the prototype with the blocks FinX has: the amount is typed (or one of the quick amounts), not slid; the checking wait of 1.4 seconds is
 * not built; an empty purpose says "Required" (the engine's word); the amount of other payments is a text field with a pattern, because the amount field
 * cannot take 0; the decision is shown on its own screen and then closed into the result, as the spec has it.
 */
export const applyLoan: Journey = {
  id: "jrn_bankworkx_apply_loan",
  slug: "apply-loan",
  name: "Apply for a loan",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: applyLoanAcceptance,
  scenarios: applyLoanScenarios,
  dataModel: {
    "launch.amount": { type: "number" },
    "opt.allowReferral": { type: "boolean" },
    "opt.arrFee": { type: "boolean" },
    "loan.amount": { type: "money", currency: "USD", required: true },
    "loan.term": { type: "string", required: true },
    "loan.purpose": { type: "string", required: true },
    "loan.employment": { type: "string", required: true },
    "loan.income": { type: "money", currency: "USD", required: true },
    "loan.commitments": { type: "string", required: true },
    "loan.to": { type: "string", required: true },
    "loan.consent": { type: "boolean", required: true },
    "loan.err": { type: "string" },
    "loan.msg": { type: "string" },
    ...otpData,
  },
  integrations: [
    { id: "rates", adapter: "bank.loans.quote", mode: "sandbox" },
    payIntegration,
    { id: "check", adapter: "bank.loans.quote", mode: "sandbox" },
    { id: "decide", adapter: "bank.loans.eligibility", mode: "sandbox" },
    ...otpIntegrations,
    { id: "apply", adapter: "bank.loans.apply", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Apply for a loan", kind: "branch",
      onEnter: [
        ...wipe, set("loan.err", ""), set("loan.msg", ""), set("loan.term", "36"), set("loan.purpose", ""), set("loan.employment", ""), set("loan.income", null), set("loan.commitments", ""), set("ctx.error", null),
        { type: "callApi", integration: "rates", saveAs: "ctx.rates", onError: { navigate: "fail" } },
        { type: "callApi", integration: "pay", saveAs: "ctx.pay", onError: { navigate: "fail" } },
        set("loan.to", "{{ctx.pay.defaultId}}"),
        // an amount passed in (an offer on Home, a link) fills the amount; the person can change it
        set("loan.amount", "{{launch.amount > 0 ? launch.amount : 5000}}"),
        go("loan"),
      ],
      navigation: route([lacks("loans.apply"), "denied"]),
      blocks: [],
    },
    {
      id: "loan", title: "How much do you need?",
      blocks: [
        text("How much do you need?", "title"),
        alert("error", "{{loan.msg}}", err("loan")),
        {
          type: "amountInput", bind: "loan.amount", currency: "USD", label: "Amount", helper: "From $1,000.00 to $50,000.00, in steps of $500.00", quickAmounts: [2000, 5000, 10000, 25000],
          validation: { min: 1000, max: 50000, messages: { min: "The smallest loan is $1,000.00.", max: "The largest loan is $50,000.00." } },
        },
        { type: "select", bind: "loan.term", label: "Term", variant: "chips", choices: TERMS },
        { type: "select", bind: "loan.purpose", label: "What is it for?", variant: "dropdown", options: PURPOSES },
        text("Monthly payment", "caption"),
        text(PAYMENT, "title"),
        text("Rate (APR)", "caption"),
        text("{{ctx.rates.rates[loan.term].rate}}% a year", "title"),
        text("Your rate can differ after we check your details.", "caption"),
        // the bank checks the amount, the step and the number of loans before the person is asked about work and income
        button("Continue", [
          { type: "validate" }, set("loan.err", ""),
          { type: "callApi", integration: "check", input: { amount: "{{loan.amount}}", term: "{{loan.term}}" }, onError: { navigate: "fail" } },
          go("work"),
        ]),
        button("Cancel", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "work", title: "Work and income",
      blocks: [
        text("Work and income", "title"),
        alert("error", "{{loan.msg}}", err("work")),
        { type: "select", bind: "loan.employment", label: "Employment", variant: "dropdown", options: EMPLOYMENT },
        {
          type: "amountInput", bind: "loan.income", currency: "USD", label: "Monthly income after tax",
          validation: { min: 0.01, max: 1000000, messages: { min: "Enter your monthly income.", max: "Check this amount." } },
        },
        { type: "textInput", bind: "loan.commitments", label: "Monthly loan and card payments", placeholder: "0", keyboard: "number", pattern: "^[0-9]{1,7}([.][0-9]{1,2})?$", patternMessage: "Enter 0 or more." },
        text("Enter 0 if you have none.", "caption"),
        button("Check my application", [
          { type: "validate" }, set("loan.err", ""),
          { type: "callApi", integration: "decide", input: { amount: "{{loan.amount}}", term: "{{loan.term}}", purpose: "{{loan.purpose}}", employment: "{{loan.employment}}", income: "{{loan.income}}", commitments: "{{loan.commitments}}", allowReferral: "{{opt.allowReferral != false}}", arrFee: "{{opt.arrFee != false}}" }, saveAs: "loan.dec", onError: { navigate: "fail" } },
          go("decision"),
        ]),
        button("Back", [go("loan")], "ghost"),
      ],
    },
    {
      id: "decision", title: "Apply for a loan", kind: "branch",
      onEnter: [go("outcome")],
      navigation: route(["loan.dec.decision == 'approved'", "offer"]),
      blocks: [],
    },
    {
      id: "offer", title: "Your offer",
      blocks: [
        text("Your offer", "title"),
        alert("error", "{{loan.msg}}", err("account")),
        summary([
          ["Loan", "{{loan.dec.offer.loanText}}"], ["Term", "{{loan.dec.offer.termText}}"], ["Rate (APR)", "{{loan.dec.offer.rateText}}"], ["Monthly payment", "{{loan.dec.offer.paymentText}}"],
          ["Total interest", "{{loan.dec.offer.interestText}}"], ["Total to repay", "{{loan.dec.offer.totalText}}"], ["First payment", "{{loan.dec.offer.firstText}}"],
        ], "loan.dec.offer.fee == 0"),
        summary([
          ["Loan", "{{loan.dec.offer.loanText}}"], ["Term", "{{loan.dec.offer.termText}}"], ["Rate (APR)", "{{loan.dec.offer.rateText}}"], ["Monthly payment", "{{loan.dec.offer.paymentText}}"],
          ["Total interest", "{{loan.dec.offer.interestText}}"], ["Arrangement fee", "{{loan.dec.offer.feeText}}"], ["Total to repay", "{{loan.dec.offer.totalText}}"], ["First payment", "{{loan.dec.offer.firstText}}"],
        ], "loan.dec.offer.fee > 0"),
        { type: "select", bind: "loan.to", label: "Pay into and repay from", source: "ctx.pay.accounts", variant: "rows" },
        { type: "consent", bind: "loan.consent", termsVersion: "loan-v1", text: "I agree to the loan terms", validation: { mustBeTrue: true, messages: { mustBeTrue: "Agree to the terms to continue." } } },
        button("Accept offer", [{ type: "validate" }, set("loan.err", ""), sendCode(), go("code")]),
        button("Back", [go("work")], "ghost"),
      ],
    },
    {
      id: "outcome", title: "Our decision",
      blocks: [
        text("Our decision", "title"),
        { type: "result", tone: "success", title: "We need to look at this", text: "A member of our team will review your application and reply within 2 working days.", visibleWhen: "loan.dec.decision == 'referred'" },
        { type: "result", tone: "error", title: "We can’t offer this loan", text: "We can’t lend based on the income you gave.", visibleWhen: "loan.dec.decision == 'declined' && loan.dec.reason == 'income'" },
        { type: "result", tone: "error", title: "We can’t offer this loan", text: "The payments would be too high against your income. Try a smaller amount or a longer term.", visibleWhen: "loan.dec.decision == 'declined' && loan.dec.reason == 'affordability'" },
        button("Close", [{ type: "navigate" }]),
      ],
      navigation: route(["loan.dec.decision == 'referred'", "doneReview"], ["loan.dec.decision == 'declined'", "doneDeclined"]),
    },
    codeScreen({ title: "Confirm with your code", heading: "Authorise a loan of {{loan.dec.offer.loanText}}", submit: "Confirm", after: [set("otp.code", ""), go("doApply")], back: "offer", wipe }),
    {
      id: "doApply", title: "Apply for a loan", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "apply", input: { amount: "{{loan.amount}}", term: "{{loan.term}}", rate: "{{loan.dec.rate}}", purpose: "{{loan.purpose}}", accountId: "{{loan.to}}", arrFee: "{{opt.arrFee != false}}" }, saveAs: "loan.res", onError: { navigate: "fail" } },
        set("loan.consent", false), go("doneApproved"),
      ],
      blocks: [],
    },
    {
      id: "doneApproved", title: "Loan approved", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Loan approved", text: "{{loan.res.paidOutText}} is in {{loan.res.paidIntoText}}.", meta: "Reference {{loan.res.reference}}" },
        { type: "statusChip", status: "done", label: "Done", tone: "positive" },
        summary([["Loan", "{{loan.dec.offer.loanText}}"], ["Paid into", "{{loan.res.paidIntoText}}"], ["Rate (APR)", "{{loan.res.rateText}}"], ["Monthly payment", "{{loan.res.paymentText}}"], ["First payment", "{{loan.res.firstText}}"]], "loan.res.fee == 0"),
        summary([["Loan", "{{loan.dec.offer.loanText}}"], ["Paid into", "{{loan.res.paidIntoText}}"], ["Rate (APR)", "{{loan.res.rateText}}"], ["Monthly payment", "{{loan.res.paymentText}}"], ["Arrangement fee", "{{loan.res.feeText}}"], ["First payment", "{{loan.res.firstText}}"]], "loan.res.fee > 0"),
        view("View loan", "save-borrow"),
        button("Done", [{ type: "exit" }]),
      ],
    },
    {
      id: "doneReview", title: "Application in review", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Application in review", text: "We’ll reply within 2 working days.", meta: "Reference {{loan.dec.reference}}" },
        { type: "statusChip", status: "in_review", label: "In review", tone: "warning" },
        summary([["Amount", "${{loan.amount | money2}}"], ["Term", "{{loan.term}} months"], ["Purpose", "{{loan.purpose}}"]]),
        view("View Save", "save-borrow"),
        button("Done", [{ type: "exit" }]),
      ],
    },
    {
      id: "doneDeclined", title: "Application not approved", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "Application not approved", text: "No loan was created.", meta: "Reference {{loan.dec.reference}}" },
        { type: "statusChip", status: "declined", label: "Declined", tone: "negative" },
        summary([["Amount", "${{loan.amount | money2}}"], ["Term", "{{loan.term}} months"]]),
        button("Try a different amount", [go("start")]),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    lockedScreen("Too many wrong codes. No loan was created. Start again when you’re ready.", "start", wipe),
    {
      // where a refusal goes: what the person can fix has its screen, the bank not answering has another
      id: "fail", title: "Apply for a loan", kind: "branch",
      onEnter: [...wipe, set("loan.err", KIND), set("loan.msg", "{{ctx.error.message}}"), go("problem")],
      navigation: route(
        ["ctx.error.code == 'TIMEOUT'", "timeout"], ["ctx.error.code == 'SERVICE_UNAVAILABLE'", "unavailable"], ["loan.err == 'loan'", "loan"], ["loan.err == 'work'", "work"], ["loan.err == 'account'", "offer"],
      ),
      blocks: [],
    },
    ...answerScreens("start", TIMEOUT, wipe),
    {
      id: "problem", title: "Apply for a loan", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We couldn’t do that", text: "Something went wrong. No loan was created and no money has moved." },
        button("Try again", [go("start")]),
        button("Close", [{ type: "exit" }], "ghost"),
      ],
    },
    denied("Apply for a loan"),
  ] as Screen[],
};
