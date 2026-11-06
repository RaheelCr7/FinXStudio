import type { Journey, Screen } from "../schema";
import { loanCalculatorAcceptance, loanCalculatorScenarios } from "./loan-calculator-tests";
import { alert, answerRules, button, downScreens, go, note, route, row, set, text } from "./public-kit";

const TYPES = [["personal", "Personal loan"], ["auto", "Car loan"], ["home", "Home loan"]] as const;
const err = (e: string) => `lc.err == '${e}'`;
/** The loan the journey opens on: a launch product (`personal`, `auto`, `home`) or a product id of the Products screen; home loans only when the bank offers them. */
const OPEN_ON = "{{launch.productId == 'loan_auto' || launch.product == 'auto' ? 'auto' : (launch.productId == 'loan_home' || launch.product == 'home') && ctx.rates.home ? 'home' : 'personal'}}";
/** The live figures follow the amount and the term: the bank gives, for each term, what 1.00 costs (in units of 1e-12) so the box need not do the sum itself; the result is the bank's own, in whole cents. */
const F = "ctx.rates.loans[lc.type].factors[lc.term]";
const CENTS = (factor: string) => `round(lc.amount * ${F}.${factor} / 10000000000)`;
const PAYMENT = `{{ctx.rates.symbol}}{{(lc.amount > 0 ? ${CENTS("pay")} : 0) / 100 | money2}}`;
const INTEREST = `{{ctx.rates.symbol}}{{(lc.amount > 0 ? ${CENTS("total")} - lc.amount * 100 : 0) / 100 | money2}}`;
const TOTAL = `{{ctx.rates.symbol}}{{(lc.amount > 0 ? ${CENTS("total")} : 0) / 100 | money2}}`;
const start = (t: string) => [set("lc.type", t), set("lc.amount", `{{ctx.rates.loans.${t}.startAmount}}`), set("lc.term", `{{ctx.rates.loans.${t}.startTerm + ''}}`), set("lc.err", ""), set("lc.msg", "")];
const apply = button("Start application", [{ type: "navigate", toJourney: "apply-loan", with: { "launch.amount": "{{lc.amount}}", "launch.term": "{{lc.term * 1}}" } }], "secondary", "opt.showApply != false");

/**
 * Loan calculator (BankWorkx, Public: before sign-in). Choose a personal, car or home loan, move the amount and the term, and read the monthly payment, the total interest and the
 * total to repay. Nothing is stored and no one signs in; no personal data is asked. The figures are the bank's, worked in whole cents (no float); the box under the amount follows
 * the amount and the term with a factor the bank gives for each term, and "Show summary" asks the bank for the exact figures and a reference (EST-).
 *
 * Built from the spec of the prototype with the blocks FinX has: the engine has no slider, so the amount is typed (or one of the quick amounts) and the term is a list; a change
 * of loan is a row that resets both (the engine cannot react to a chip); the bank checks the step of the amount and the term on "Show summary" and says so above the form.
 */
export const loanCalculator: Journey = {
  id: "jrn_bankworkx_loan_calculator",
  slug: "loan-calculator",
  name: "Loan calculator",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: loanCalculatorAcceptance,
  scenarios: loanCalculatorScenarios,
  dataModel: {
    "launch.product": { type: "string" },
    "launch.productId": { type: "string" },
    "opt.showHome": { type: "boolean" },
    "opt.showApply": { type: "boolean" },
    "lc.type": { type: "string", required: true },
    "lc.amount": { type: "number", required: true },
    "lc.term": { type: "string", required: true },
    "lc.err": { type: "string" },
    "lc.msg": { type: "string" },
  },
  integrations: [
    { id: "rates", adapter: "bank.rates.loans", mode: "sandbox" },
    { id: "quote", adapter: "bank.rates.loans", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Loan calculator", kind: "branch",
      onEnter: [
        set("lc.err", ""), set("lc.msg", ""), set("ctx.error", null),
        { type: "callApi", integration: "rates", input: { showHome: "{{opt.showHome != false}}" }, saveAs: "ctx.rates", onError: { navigate: "fail" } },
        set("lc.type", OPEN_ON), set("lc.amount", "{{get(ctx.rates.loans, lc.type).startAmount}}"), set("lc.term", "{{get(ctx.rates.loans, lc.type).startTerm + ''}}"),
        go("calc"),
      ],
      blocks: [],
    },
    {
      id: "calc", title: "Loan calculator",
      blocks: [
        text("Loan calculator", "title"),
        alert("error", "{{lc.msg}}", "lc.err == 'rule'"),
        ...TYPES.map(([t, name]) => row(t, name, `{{lc.type == '${t}' ? 'Chosen · ' : ''}}{{ctx.rates.loans.${t}.apr}} a year`, start(t), t === "home" ? "ctx.rates.home" : undefined)),
        ...TYPES.flatMap(([t]) => [
          {
            type: "amountInput", bind: "lc.amount", currency: "{{ctx.rates.currency}}", label: "How much do you need?", visibleWhen: `lc.type == '${t}'`,
            helper: `From {{ctx.rates.symbol}}{{ctx.rates.loans.${t}.amountMin | money}} to {{ctx.rates.symbol}}{{ctx.rates.loans.${t}.amountMax | money}}, in steps of {{ctx.rates.symbol}}{{ctx.rates.loans.${t}.amountStep | money}}`,
            quickAmounts: t === "personal" ? [5000, 10000, 25000, 50000] : t === "auto" ? [10000, 15000, 30000, 60000] : [100000, 200000, 400000, 600000],
            validation: {
              min: `ctx.rates.loans.${t}.amountMin`, max: `ctx.rates.loans.${t}.amountMax`,
              messages: { min: `The smallest amount is {{ctx.rates.symbol}}{{ctx.rates.loans.${t}.amountMin | money}}.`, max: `The largest amount is {{ctx.rates.symbol}}{{ctx.rates.loans.${t}.amountMax | money}}.` },
            },
          },
          { type: "select", bind: "lc.term", label: "Over how long?", variant: "dropdown", source: `ctx.rates.loans.${t}.termChoices`, visibleWhen: `lc.type == '${t}'` },
        ]),
        text("Monthly payment", "caption"),
        text(PAYMENT, "title"),
        text(`Over {{${F}.text}}`, "body"),
        { type: "reviewSummary", rows: [{ label: "Interest rate", value: "{{ctx.rates.loans[lc.type].apr}} a year" }, { label: "Total interest", value: INTEREST }, { label: "Total to repay", value: TOTAL }] },
        note("This is an estimate. Your rate may differ."),
        apply,
        button("Show summary", [
          { type: "validate" }, set("lc.err", ""),
          { type: "callApi", integration: "quote", input: { type: "{{lc.type}}", amount: "{{lc.amount}}", term: "{{lc.term}}", showHome: "{{opt.showHome != false}}" }, saveAs: "lc.res", onError: { navigate: "fail" } },
          go("done"),
        ]),
        button("Close", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "done", title: "Your estimate", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Your estimate", text: "Based on today’s rates. Nothing has been applied for.", meta: "Reference {{lc.res.quote.reference}}" },
        { type: "reviewSummary", rows: [
          { label: "Loan", value: "{{lc.res.quote.name}}" }, { label: "Amount", value: "{{lc.res.quote.amountText}}" }, { label: "Term", value: "{{lc.res.quote.termText}}" }, { label: "Interest rate", value: "{{lc.res.quote.apr}} a year" },
          { label: "Monthly payment", value: "{{lc.res.quote.paymentText}}" }, { label: "Total interest", value: "{{lc.res.quote.interestText}}" }, { label: "Total to repay", value: "{{lc.res.quote.totalText}}" },
        ] },
        apply,
        button("Done", [{ type: "exit" }], "secondary"),
      ],
    },
    {
      // where a refusal goes: what the person can fix shows on the form (the figures stay), the rest has its screen
      id: "fail", title: "Loan calculator", kind: "branch",
      onEnter: [
        set("lc.msg", "{{ctx.error.message}}"), set("lc.err", "{{ctx.error.code != 'TIMEOUT' && ctx.error.code != 'SERVICE_UNAVAILABLE' ? 'rule' : ''}}"),
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
