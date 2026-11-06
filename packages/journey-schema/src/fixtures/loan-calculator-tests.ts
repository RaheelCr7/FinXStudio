import type { Journey } from "../schema";
import { bank, forced, home, inspect, noText, opens, press, screen, set, SLOW, text, visitor, error, type Step } from "./public-test-kit";

/** What must be true for "Loan calculator" to be right. Each is proved by at least one scenario below. */
export const loanCalculatorAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "Each loan shows only its own amount field, term list and quick amounts with the ranges and start values of the bank's table, and changing the loan resets the amount and the term." },
  { id: "AC-2", text: "The monthly payment, the total interest and the total to repay follow the amortisation formula and update on every move of the amount and the term." },
  { id: "AC-3", text: "The term text follows the rule: months below 24, \"1 year\" for 12, whole years from 24." },
  { id: "AC-4", text: "Home loans appear only with showHome on; a launch with product home while it is off opens Personal loan." },
  { id: "AC-5", text: "Start application appears on the form and on the result only with showApply on, and carries the amount and the term to apply-loan." },
  { id: "AC-6", text: "Every amount uses the symbol of the bank's home market." },
  { id: "AC-7", text: "The screen says it is an estimate, and the result says nothing has been applied for." },
  { id: "AC-8", text: "When the rates cannot load, or the bank does not answer in time, the person sees the plain message, nothing is changed and Try again works." },
  { id: "AC-9", text: "The bank refuses an amount outside the range or the step of the chosen loan and a term that is not in its list, and works every figure in whole cents." },
  { id: "AC-10", text: "It works before anyone signs in, asks for no personal data and keeps nothing." },
];

/** The bank's exact quote for what the journey holds now (the type, the amount and the term it would send), read through the bank. */
const now = (path: string, equals: unknown): Step => bank("bank.rates.loans", path, equals, { type: "{{lc.type}}", amount: "{{lc.amount}}", term: "{{lc.term}}" });
const q = (input: Record<string, unknown>, c: string): Step => forced("bank.rates.loans", input, c);
const RATES = ["bank.rates.loans"];

export const loanCalculatorScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "Opened with nothing passed in: Personal loan, 10,000 over 3 years; the box reads 322.20 a month, 9.9% a year, 1,599.29 of interest and 11,599.29 to repay", covers: ["AC-1", "AC-2", "AC-7"], ...visitor,
    steps: [
      screen("calc"), text("Loan calculator"), now("quote.type", "personal"), now("quote.amountCents", 1_000_000), now("quote.term", 36),
      text("$322.20"), text("Over 3 years"), text("9.9% a year"), text("$1,599.29"), text("$11,599.29"), text("This is an estimate. Your rate may differ."),
      text("From $1,000 to $50,000, in steps of $500"),
    ],
  },
  {
    id: "T-2", name: "Choosing Car loan resets the amount and the term to 15,000 over 4 years (361.98 a month); Home loan to 200,000 over 20 years (1,330.98)", covers: ["AC-1", "AC-2"], ...visitor,
    steps: [
      press("Car loan"), now("quote.type", "auto"), now("quote.amountCents", 1_500_000), now("quote.term", 48), text("$361.98"), text("Over 4 years"), text("From $2,000 to $80,000, in steps of $500"),
      press("Home loan"), now("quote.type", "home"), now("quote.amountCents", 20_000_000), now("quote.term", 240), text("$1,330.98"), text("Over 20 years"), text("From $50,000 to $750,000, in steps of $5,000"),
      noText("Over 4 years"),
    ],
  },
  {
    id: "T-3", name: "Changing the amount and the term moves the box at once, and a change of loan after that resets them", covers: ["AC-1", "AC-2"], ...visitor,
    steps: [
      set({ "lc.amount": 20_000, "lc.term": "60" }), now("quote.paymentCents", 42_396), text("$423.96"), noText("$322.20"),
      press("Car loan"), text("$361.98"), now("quote.amountCents", 1_500_000),
      set({ "lc.amount": 35_000, "lc.term": "84" }), press("Personal loan"), now("quote.amountCents", 1_000_000), now("quote.term", 36), text("$322.20"),
    ],
  },
  {
    id: "T-4", name: "The term reads 6 months, 1 year, 30 months and 3 years; a Home loan of 60 months reads 5 years", covers: ["AC-3"], ...visitor,
    steps: [
      set({ "lc.term": "6" }), text("Over 6 months"), set({ "lc.term": "12" }), text("Over 1 year"), noText("Over 6 months"), set({ "lc.term": "30" }), text("Over 30 months"), set({ "lc.term": "36" }), text("Over 3 years"),
      set({ "lc.term": "24" }), text("Over 2 years"), press("Home loan"), set({ "lc.term": "60" }), text("Over 5 years"),
    ],
  },
  {
    id: "T-5", name: "With showHome off the loans are Personal and Car; a launch with product home opens Personal loan", covers: ["AC-4"], ...visitor, launch: { "launch.product": "home", "opt.showHome": false }, config: { options: { "loan-calculator": { showHome: false } } },
    steps: [screen("calc"), text("Personal loan"), text("Car loan"), noText("Home loan"), now("quote.type", "personal"), now("quote.amountCents", 1_000_000), text("$322.20")],
  },
  {
    id: "T-6", name: "A launch with product auto opens Car loan, and so do the product ids of the Products screen; home loans are offered when showHome is on", covers: ["AC-1", "AC-4"], ...visitor, launch: { "launch.product": "auto" },
    steps: [now("quote.type", "auto"), now("quote.amountCents", 1_500_000), now("quote.term", 48), text("Home loan")],
  },
  {
    id: "T-7", name: "A product id of a home loan opens Home loan with its start values", covers: ["AC-1", "AC-4"], ...visitor, launch: { "launch.productId": "loan_home" },
    steps: [now("quote.type", "home"), now("quote.amountCents", 20_000_000), now("quote.term", 240), text("$1,330.98")],
  },
  {
    id: "T-8", name: "Start application opens apply-loan with the amount and the term of the form", covers: ["AC-5"], ...visitor,
    steps: [press("Car loan"), press("Start application"), opens("apply-loan", { "launch.amount": 15_000, "launch.term": 48 })],
  },
  {
    id: "T-9", name: "Start application on the result carries what was estimated", covers: ["AC-5"], ...visitor,
    steps: [set({ "lc.amount": 25_000, "lc.term": "36" }), press("Show summary"), screen("done"), press("Start application"), opens("apply-loan", { "launch.amount": 25_000, "launch.term": 36 })],
  },
  {
    id: "T-10", name: "With showApply off there is no Start application on the form nor on the result", covers: ["AC-5"], ...visitor, launch: { "opt.showApply": false },
    steps: [noText("Start application"), press("Show summary"), screen("done"), noText("Start application"), text("Done")],
  },
  {
    id: "T-11", name: "Market B shows pounds", covers: ["AC-6"], ...visitor, config: home("uk"),
    steps: [text("£322.20"), text("£1,599.29"), text("£11,599.29"), text("From £1,000 to £50,000"), press("Show summary"), text("£10,000.00"), text("£322.20"), noText("$")],
  },
  {
    id: "T-12", name: "Market C shows euros", covers: ["AC-6"], ...visitor, config: home("eu"),
    steps: [text("€322.20"), text("€11,599.29"), press("Show summary"), text("€1,599.29"), noText("$")],
  },
  {
    id: "T-13", name: "Market D shows dirhams with the code and a space", covers: ["AC-6"], ...visitor, config: home("ae"),
    steps: [text("AED 322.20"), text("AED 11,599.29"), press("Show summary"), text("AED 1,599.29"), noText("$")],
  },
  {
    id: "T-14", name: "The result is the bank's estimate with a reference, and says nothing has been applied for", covers: ["AC-2", "AC-7"], ...visitor,
    steps: [
      press("Show summary"), screen("done"), text("Your estimate"), text("Based on today’s rates. Nothing has been applied for."), text("Reference EST-20261103-"),
      text("Personal loan"), text("$10,000.00"), text("3 years"), text("9.9% a year"), text("$322.20"), text("$1,599.29"), text("$11,599.29"), text("Done"),
    ],
  },
  {
    id: "T-15", name: "When the rates cannot load the person sees the plain message, and Try again asks again", covers: ["AC-8"], ...visitor, conditions: { unavailable: RATES },
    steps: [screen("unavailable"), text("We couldn’t load the rates. Try again in a few minutes."), press("Try again"), screen("unavailable"), noText("Show summary")],
  },
  {
    id: "T-16", name: "When the bank does not answer in 10 seconds nothing is changed, and Try again asks again", covers: ["AC-8"], ...visitor, conditions: { timeout: RATES, latencyMs: 10_000 },
    steps: [screen("timeout"), text(SLOW), press("Try again"), screen("timeout")],
  },
  {
    id: "T-17", name: "An amount under the smallest or over the largest is refused on the form, in words", covers: ["AC-9"], ...visitor,
    steps: [
      set({ "lc.amount": 500 }), press("Show summary"), screen("calc"), error("The smallest amount is $1,000."),
      set({ "lc.amount": 60_000 }), press("Show summary"), error("The largest amount is $50,000."),
      press("Home loan"), set({ "lc.amount": 40_000 }), press("Show summary"), error("The smallest amount is $50,000."),
    ],
  },
  {
    id: "T-18", name: "An amount that is not a multiple of the step is refused by the bank in its own words, and the form keeps what was typed", covers: ["AC-9"], ...visitor,
    steps: [
      set({ "lc.amount": 10_250 }), press("Show summary"), screen("calc"), text("Choose an amount in steps of $500."), noText("Your estimate"),
      set({ "lc.amount": 10_500 }), press("Show summary"), screen("done"), text("$10,500.00"),
    ],
  },
  {
    id: "T-19", name: "The bank refuses what a screen would not send: a loan it does not have, an amount outside its table, a step, a term outside the list", covers: ["AC-9"], ...visitor,
    steps: [
      q({ type: "boat", amount: 10_000, term: 36 }, "LOAN_TYPE_INVALID"), q({ type: "personal", amount: 500, term: 36 }, "AMOUNT_RANGE"), q({ type: "personal", amount: 50_500, term: 36 }, "AMOUNT_RANGE"),
      q({ type: "auto", amount: 10_100, term: 48 }, "AMOUNT_STEP"), q({ type: "home", amount: 52_000, term: 240 }, "AMOUNT_STEP"), q({ type: "personal", amount: 10_000, term: 5 }, "TERM_INVALID"),
      q({ type: "personal", amount: 10_000, term: 37 }, "TERM_INVALID"), q({ type: "auto", amount: 10_000, term: 6 }, "TERM_INVALID"), q({ type: "home", amount: 100_000, term: 48 }, "TERM_INVALID"),
      q({ type: "personal", term: 36 }, "AMOUNT_REQUIRED"),
    ],
  },
  {
    id: "T-20", name: "The figures are exact to the cent at the edges of the table: 35,000 over 7 years, 750,000 over 30 years, 1,000 over 6 months", covers: ["AC-2", "AC-9"], ...visitor,
    steps: [
      bank("bank.rates.loans", "quote.paymentCents", 57_923, { type: "personal", amount: 35_000, term: 84 }), bank("bank.rates.loans", "quote.totalCents", 4_865_571, { type: "personal", amount: 35_000, term: 84 }),
      bank("bank.rates.loans", "quote.paymentCents", 407_212, { type: "home", amount: 750_000, term: 360 }), bank("bank.rates.loans", "quote.totalCents", 146_596_439, { type: "home", amount: 750_000, term: 360 }),
      bank("bank.rates.loans", "quote.paymentCents", 17_151, { type: "personal", amount: 1_000, term: 6 }), bank("bank.rates.loans", "quote.interestCents", 2_907, { type: "personal", amount: 1_000, term: 6 }),
      bank("bank.rates.loans", "quote.interestText", "$1,599.29", { type: "personal", amount: 10_000, term: 36 }),
    ],
  },
  {
    id: "T-21", name: "At the edge of the table the box on the form says what the bank says: 750,000 over 30 years", covers: ["AC-2"], ...visitor,
    steps: [press("Home loan"), set({ "lc.amount": 750_000, "lc.term": "360" }), text("$4,072.12"), text("$715,964.39"), text("$1,465,964.39"), press("Show summary"), text("$4,072.12"), text("$715,964.39")],
  },
  {
    id: "T-22", name: "A signed-in customer gets the same figures, and nothing of theirs is on the screen", covers: ["AC-2", "AC-10"], persona: "alex", now: "2026-11-03T18:45:00Z",
    steps: [text("$322.20"), noText("Alex"), noText("Main"), press("Show summary"), text("$11,599.29")],
  },
  {
    id: "T-23", name: "Before sign-in it asks for no personal data and keeps nothing: no application, no draft, no message", covers: ["AC-10"], ...visitor,
    steps: [press("Show summary"), screen("done"), inspect("drafts", 0), inspect("submitted", 3), inspect("support.messages", 0), inspect("outbox", []), press("Done")],
  },
  {
    id: "T-24", name: "A car loan over 80,000 and a home loan over 750,000 are refused on the form, in words", covers: ["AC-9"], ...visitor,
    steps: [
      press("Car loan"), set({ "lc.amount": 90_000 }), press("Show summary"), screen("calc"), error("The largest amount is $80,000."), set({ "lc.amount": 1_500 }), press("Show summary"), error("The smallest amount is $2,000."),
      press("Home loan"), set({ "lc.amount": 800_000 }), press("Show summary"), error("The largest amount is $750,000."),
    ],
  },
];
