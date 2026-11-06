import type { Journey } from "../schema";
import { bank, forced, home, inspect, noText, opens, press, screen, set, SLOW, text, visitor, error, type Step } from "./public-test-kit";

/** What must be true for "Deposit calculator" to be right. Each is proved by at least one scenario below. */
export const depositCalculatorAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "Interest, the total return and the monthly interest follow the formula (amount x rate x months / 12, in whole cents) and update on every change." },
  { id: "AC-2", text: "The five terms (3, 6, 12, 24 and 60 months) show the rates of the bank's table with two decimals." },
  { id: "AC-3", text: "Interest every month is offered only with allowMonthly; chosen, the big figure is the monthly interest and a row shows the deposit returned at the end." },
  { id: "AC-4", text: "An unknown launch term opens 1 year; a deposit product id opens its term." },
  { id: "AC-5", text: "Start application appears only with showApply on, on the form and on the result, and carries the amount and the term to term-deposit." },
  { id: "AC-6", text: "Every amount uses the symbol of the bank's home market." },
  { id: "AC-7", text: "The screen says rates can change, and the result says nothing has been opened." },
  { id: "AC-8", text: "When the rates cannot load, or the bank does not answer in time, the person sees the plain message, nothing is changed and Try again works." },
  { id: "AC-9", text: "The bank refuses an amount outside 500 to 100,000, off the step of 500, a term that is not in its table and monthly interest it does not offer." },
  { id: "AC-10", text: "It works before anyone signs in, asks for no personal data and keeps nothing." },
];

/** What the journey would send now, read through the bank. */
const now = (path: string, equals: unknown): Step => bank("bank.rates.deposits", path, equals, { amount: "{{dc.amount}}", term: "{{dc.term}}", pay: "{{dc.pay}}" });
const q = (input: Record<string, unknown>, c: string): Step => forced("bank.rates.deposits", input, c);
const RATES = ["bank.rates.deposits"];

export const depositCalculatorScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "Opened with nothing passed in: 10,000 for 1 year, interest at the end: you get back 10,390.00, 3.90% a year, 390.00 of interest", covers: ["AC-1", "AC-2", "AC-7"], ...visitor,
    steps: [
      screen("calc"), text("Deposit calculator"), now("quote.amountCents", 1_000_000), now("quote.term", 12), now("quote.pay", "end"), text("You get back"), text("$10,390.00"), text("3.90% a year"), text("$390.00"),
      text("This is an estimate. Rates can change before you open the deposit."), text("From $500 to $100,000, in steps of $500"), noText("Interest every month"),
    ],
  },
  {
    id: "T-2", name: "Interest every month: 32.50 a month, and the deposit comes back at the end", covers: ["AC-1", "AC-3"], ...visitor,
    steps: [set({ "dc.pay": "monthly" }), text("Interest every month"), text("$32.50"), text("Your deposit returned at the end"), text("$10,000.00"), noText("You get back"), set({ "dc.pay": "end" }), text("You get back"), noText("Your deposit returned at the end")],
  },
  {
    id: "T-3", name: "Each term shows its own rate: 3 months at 10,000 is 3.00% and 75.00; 5 years at 500 is 3.30% and 82.50", covers: ["AC-1", "AC-2"], ...visitor,
    steps: [
      set({ "dc.term": "3" }), text("3.00% a year"), text("$75.00"), set({ "dc.term": "6" }), text("3.40% a year"), text("$170.00"), set({ "dc.term": "24" }), text("3.60% a year"), text("$720.00"),
      set({ "dc.term": "60", "dc.amount": 500 }), text("3.30% a year"), text("$82.50"), text("$582.50"),
    ],
  },
  {
    id: "T-4", name: "The terms are listed with their names: 3 months, 6 months, 1 year, 2 years, 5 years", covers: ["AC-2"], ...visitor,
    steps: [text("3 months"), text("6 months"), text("1 year"), text("2 years"), text("5 years")],
  },
  {
    id: "T-5", name: "With allowMonthly off there is no Interest choice and the result says At the end", covers: ["AC-3"], ...visitor, launch: { "opt.allowMonthly": false }, config: { options: { "deposit-calculator": { allowMonthly: false } } },
    steps: [noText("Every month"), noText("Interest every month"), text("You get back"), press("Show summary"), screen("done"), text("At the end"), text("You get back"), noText("Each month")],
  },
  {
    id: "T-6", name: "An unknown launch term opens 1 year; a product id of a 24 month deposit opens 2 years", covers: ["AC-4"], ...visitor, launch: { "launch.term": 7 },
    steps: [now("quote.term", 12), text("3.90% a year")],
  },
  {
    id: "T-7", name: "A deposit product id opens its own term", covers: ["AC-4"], ...visitor, launch: { "launch.productId": "dep_24m" },
    steps: [now("quote.term", 24), text("3.60% a year"), text("$720.00")],
  },
  {
    id: "T-8", name: "A term passed in that the bank has (24) opens that term, and wins over a product", covers: ["AC-4"], ...visitor, launch: { "launch.term": 24, "launch.productId": "dep_6m" },
    steps: [now("quote.term", 24), text("3.60% a year")],
  },
  {
    id: "T-9", name: "Start application opens term-deposit with the amount and the term; absent with showApply off", covers: ["AC-5"], ...visitor, launch: { "launch.term": 24 },
    steps: [press("Start application"), opens("term-deposit", { "launch.amount": 10_000, "launch.term": 24 })],
  },
  {
    id: "T-10", name: "Start application on the result carries what was estimated", covers: ["AC-5"], ...visitor,
    steps: [set({ "dc.amount": 25_000, "dc.term": "60" }), press("Show summary"), screen("done"), press("Start application"), opens("term-deposit", { "launch.amount": 25_000, "launch.term": 60 })],
  },
  {
    id: "T-11", name: "With showApply off there is no Start application on the form nor on the result", covers: ["AC-5"], ...visitor, launch: { "opt.showApply": false },
    steps: [noText("Start application"), press("Show summary"), screen("done"), noText("Start application"), text("Done")],
  },
  {
    id: "T-12", name: "Market B shows pounds", covers: ["AC-6"], ...visitor, config: home("uk"),
    steps: [text("£10,390.00"), text("£390.00"), text("From £500 to £100,000"), press("Show summary"), text("£10,000.00"), noText("$")],
  },
  {
    id: "T-13", name: "Market C shows euros", covers: ["AC-6"], ...visitor, config: home("eu"),
    steps: [text("€10,390.00"), press("Show summary"), text("€390.00"), noText("$")],
  },
  {
    id: "T-14", name: "Market D shows dirhams with the code and a space", covers: ["AC-6"], ...visitor, config: home("ae"),
    steps: [text("AED 10,390.00"), press("Show summary"), text("AED 390.00"), noText("$")],
  },
  {
    id: "T-15", name: "The result is the bank's estimate with a reference, and says nothing has been opened", covers: ["AC-1", "AC-7"], ...visitor,
    steps: [
      press("Show summary"), screen("done"), text("Your estimate"), text("Based on today’s rates. Nothing has been opened."), text("Reference EST-20261103-"), text("$10,000.00"), text("1 year"), text("3.90% a year"),
      text("At the end"), text("$390.00"), text("You get back"), text("$10,390.00"), noText("Each month"),
    ],
  },
  {
    id: "T-16", name: "The result of monthly interest says Each month and what comes back at the end", covers: ["AC-1", "AC-3"], ...visitor,
    steps: [set({ "dc.pay": "monthly" }), press("Show summary"), screen("done"), text("Every month"), text("Each month"), text("$32.50"), text("Your deposit returned at the end"), text("$10,000.00"), noText("You get back")],
  },
  {
    id: "T-17", name: "When the rates cannot load the person sees the plain message, and Try again asks again", covers: ["AC-8"], ...visitor, conditions: { unavailable: RATES },
    steps: [screen("unavailable"), text("We couldn’t load the rates. Try again in a few minutes."), press("Try again"), screen("unavailable"), noText("Show summary")],
  },
  {
    id: "T-18", name: "When the bank does not answer in 10 seconds nothing is changed, and Try again asks again", covers: ["AC-8"], ...visitor, conditions: { timeout: RATES, latencyMs: 10_000 },
    steps: [screen("timeout"), text(SLOW), press("Try again"), screen("timeout")],
  },
  {
    id: "T-19", name: "An amount under the smallest or over the largest is refused on the form, in words", covers: ["AC-9"], ...visitor,
    steps: [set({ "dc.amount": 400 }), press("Show summary"), screen("calc"), error("The smallest deposit is $500."), set({ "dc.amount": 120_000 }), press("Show summary"), error("The largest deposit is $100,000.")],
  },
  {
    id: "T-20", name: "An amount that is not a multiple of 500 is refused by the bank in its own words, and the form keeps what was typed", covers: ["AC-9"], ...visitor,
    steps: [set({ "dc.amount": 10_250 }), press("Show summary"), screen("calc"), text("Choose an amount in steps of $500."), noText("Your estimate"), set({ "dc.amount": 10_500 }), press("Show summary"), screen("done"), text("$10,500.00")],
  },
  {
    id: "T-21", name: "The bank refuses what a screen would not send: an amount outside its range or step, a term it does not have, a payout it does not offer", covers: ["AC-9"], ...visitor,
    steps: [
      q({ amount: 400, term: 12 }, "AMOUNT_RANGE"), q({ amount: 100_500, term: 12 }, "AMOUNT_RANGE"), q({ amount: 10_250, term: 12 }, "AMOUNT_STEP"), q({ term: 12 }, "AMOUNT_REQUIRED"),
      q({ amount: 10_000, term: 7 }, "TERM_INVALID"), q({ amount: 10_000, term: 120 }, "TERM_INVALID"), q({ amount: 10_000, term: 12, pay: "daily" }, "PAY_INVALID"),
    ],
  },
  {
    id: "T-22", name: "The bank refuses monthly interest when it does not offer it, whatever a screen sends", covers: ["AC-3", "AC-9"], ...visitor, config: { options: { "deposit-calculator": { allowMonthly: false } } },
    steps: [q({ amount: 10_000, term: 12, pay: "monthly" }, "PAY_UNAVAILABLE"), bank("bank.rates.deposits", "allowMonthly", false)],
  },
  {
    id: "T-23", name: "The figures are exact to the cent at the edges of the table; a half cent of monthly interest goes up", covers: ["AC-1", "AC-9"], ...visitor,
    steps: [
      bank("bank.rates.deposits", "quote.interestCents", 8_250, { amount: 500, term: 60 }), bank("bank.rates.deposits", "quote.interestCents", 720_000, { amount: 100_000, term: 24 }),
      bank("bank.rates.deposits", "quote.interestCents", 1_125, { amount: 1_500, term: 3, pay: "end" }), bank("bank.rates.deposits", "quote.monthlyCents", 3_250, { amount: 10_000, term: 12, pay: "monthly" }),
      bank("bank.rates.deposits", "quote.monthlyCents", 138, { amount: 500, term: 60, pay: "monthly" }), bank("bank.rates.deposits", "quote.returnText", "$10,390.00", { amount: 10_000, term: 12 }),
    ],
  },
  {
    id: "T-24", name: "A signed-in customer gets the same figures, and nothing of theirs is on the screen", covers: ["AC-1", "AC-10"], persona: "alex", now: "2026-11-03T18:45:00Z",
    steps: [text("$10,390.00"), noText("Alex"), noText("Main"), press("Show summary"), text("$390.00")],
  },
  {
    id: "T-25", name: "Before sign-in it asks for no personal data and keeps nothing: no application, no draft, no message", covers: ["AC-10"], ...visitor,
    steps: [press("Show summary"), screen("done"), inspect("drafts", 0), inspect("submitted", 3), inspect("support.messages", 0), inspect("outbox", []), press("Done")],
  },
];
