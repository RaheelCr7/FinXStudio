import type { Journey, Screen } from "../schema";
import { depositCalculatorAcceptance, depositCalculatorScenarios } from "./deposit-calculator-tests";
import { alert, answerRules, button, downScreens, go, note, route, set, text } from "./public-kit";

/** The term the journey opens on: a launch term in months when the bank has it, else the term of a deposit product, else 1 year. */
const OPEN_ON = "{{has(ctx.rates.terms, launch.term) ? launch.term + '' : launch.productId == 'dep_6m' ? '6' : launch.productId == 'dep_24m' ? '24' : '12'}}";
const T = "ctx.rates.terms[dc.term]";
/** Simple interest in cents: amount x rate x months / 12, rounded half up; the rate is in hundredths of a percent, so all of it is whole numbers until the last division by 100. */
const INTEREST = `round(dc.amount * 100 * ${T}.rateH * ${T}.term / 120000)`;
const sym = "{{ctx.rates.symbol}}";
const apply = button("Start application", [{ type: "navigate", toJourney: "term-deposit", with: { "launch.amount": "{{dc.amount}}", "launch.term": "{{dc.term * 1}}" } }], "secondary", "opt.showApply != false");
const monthly = "dc.pay == 'monthly'";

/**
 * Deposit calculator (BankWorkx, Public: before sign-in). Choose an amount, a term and when the interest is paid, and read the interest and what comes back. Interest is simple: amount x
 * rate x term / 12, worked in whole cents. Nothing is stored and no one signs in. The box follows the amount, the term and the choice as they change; "Show summary" asks the bank for
 * the exact figures and a reference (EST-). Rates are the bank's table (3, 6, 12, 24 and 60 months); a bank can switch off interest every month.
 *
 * Built from the spec of the prototype with the blocks FinX has: the amount is typed (or one of the quick amounts), not slid, and the bank checks the step of 500 on "Show summary".
 */
export const depositCalculator: Journey = {
  id: "jrn_bankworkx_deposit_calculator",
  slug: "deposit-calculator",
  name: "Deposit calculator",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: depositCalculatorAcceptance,
  scenarios: depositCalculatorScenarios,
  dataModel: {
    "launch.term": { type: "number" },
    "launch.productId": { type: "string" },
    "opt.allowMonthly": { type: "boolean" },
    "opt.showApply": { type: "boolean" },
    "dc.amount": { type: "number", required: true },
    "dc.term": { type: "string", required: true },
    "dc.pay": { type: "string", required: true },
    "dc.err": { type: "string" },
    "dc.msg": { type: "string" },
  },
  integrations: [
    { id: "rates", adapter: "bank.rates.deposits", mode: "sandbox" },
    { id: "quote", adapter: "bank.rates.deposits", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Deposit calculator", kind: "branch",
      onEnter: [
        set("dc.err", ""), set("dc.msg", ""), set("ctx.error", null),
        { type: "callApi", integration: "rates", input: { allowMonthly: "{{opt.allowMonthly != false}}" }, saveAs: "ctx.rates", onError: { navigate: "fail" } },
        set("dc.term", OPEN_ON), set("dc.amount", "{{ctx.rates.range.start}}"), set("dc.pay", "end"),
        go("calc"),
      ],
      blocks: [],
    },
    {
      id: "calc", title: "Deposit calculator",
      blocks: [
        text("Deposit calculator", "title"),
        alert("error", "{{dc.msg}}", "dc.err == 'rule'"),
        {
          type: "amountInput", bind: "dc.amount", currency: "{{ctx.rates.currency}}", label: "How much do you want to deposit?", quickAmounts: [1000, 5000, 10000, 25000, 50000],
          helper: `From ${sym}{{ctx.rates.range.min | money}} to ${sym}{{ctx.rates.range.max | money}}, in steps of ${sym}{{ctx.rates.range.step | money}}`,
          validation: {
            min: "ctx.rates.range.min", max: "ctx.rates.range.max",
            messages: { min: `The smallest deposit is ${sym}{{ctx.rates.range.min | money}}.`, max: `The largest deposit is ${sym}{{ctx.rates.range.max | money}}.` },
          },
        },
        { type: "select", bind: "dc.term", label: "For how long?", variant: "chips", source: "ctx.rates.terms" },
        { type: "select", bind: "dc.pay", label: "Interest", variant: "chips", choices: [{ id: "end", label: "At the end" }, { id: "monthly", label: "Every month" }], visibleWhen: "ctx.rates.allowMonthly" },
        text("You get back", "caption", "!(dc.pay == 'monthly')"),
        text(`${sym}{{(dc.amount * 100 + ${INTEREST}) / 100 | money2}}`, "title", "!(dc.pay == 'monthly')"),
        text("Interest every month", "caption", monthly),
        text(`${sym}{{round(${INTEREST} / ${T}.term) / 100 | money2}}`, "title", monthly),
        { type: "reviewSummary", visibleWhen: monthly, rows: [{ label: "Your deposit returned at the end", value: `${sym}{{dc.amount | money2}}` }] },
        { type: "reviewSummary", rows: [{ label: "Interest rate", value: `{{${T}.rateText}}` }, { label: "Total interest", value: `${sym}{{${INTEREST} / 100 | money2}}` }] },
        note("This is an estimate. Rates can change before you open the deposit."),
        apply,
        button("Show summary", [
          { type: "validate" }, set("dc.err", ""),
          { type: "callApi", integration: "quote", input: { amount: "{{dc.amount}}", term: "{{dc.term}}", pay: "{{dc.pay}}", allowMonthly: "{{opt.allowMonthly != false}}" }, saveAs: "dc.res", onError: { navigate: "fail" } },
          go("done"),
        ]),
        button("Close", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "done", title: "Your estimate", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Your estimate", text: "Based on today’s rates. Nothing has been opened.", meta: "Reference {{dc.res.quote.reference}}" },
        { type: "reviewSummary", rows: [
          { label: "Amount", value: "{{dc.res.quote.amountText}}" }, { label: "Term", value: "{{dc.res.quote.termText}}" }, { label: "Interest rate", value: "{{dc.res.quote.rateText}}" },
          { label: "Interest paid", value: "{{dc.res.quote.payText}}" }, { label: "Total interest", value: "{{dc.res.quote.interestText}}" },
        ] },
        { type: "reviewSummary", visibleWhen: "dc.res.quote.pay == 'end'", rows: [{ label: "You get back", value: "{{dc.res.quote.returnText}}" }] },
        { type: "reviewSummary", visibleWhen: "dc.res.quote.pay == 'monthly'", rows: [{ label: "Each month", value: "{{dc.res.quote.monthlyText}}" }, { label: "Your deposit returned at the end", value: "{{dc.res.quote.amountText}}" }] },
        apply,
        button("Done", [{ type: "exit" }], "secondary"),
      ],
    },
    {
      id: "fail", title: "Deposit calculator", kind: "branch",
      onEnter: [
        set("dc.msg", "{{ctx.error.message}}"), set("dc.err", "{{ctx.error.code != 'TIMEOUT' && ctx.error.code != 'SERVICE_UNAVAILABLE' ? 'rule' : ''}}"),
        go("calc"),
      ],
      navigation: route(...answerRules),
      blocks: [],
    },
    ...downScreens({
      retry: "start",
      unavailable: { title: "We couldn’t load the rates", text: "We couldn’t load the rates. Try again in a few minutes." },
      timeout: { text: "This is taking longer than expected. Nothing was changed." },
    }),
  ] as Screen[],
};
