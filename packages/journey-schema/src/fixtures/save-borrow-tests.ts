import type { Journey } from "../schema";

/** What must be true for "Save" (the view of savings, deposits, loans and investments) to be right. Each is proved by at least one scenario below. */
export const saveBorrowAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "Each section shows its heading, its cards and its button only when its option is on and its journey is allowed (not switched off by the bank, and the person holds its permission)." },
  { id: "AC-2", text: "A goal card shows the saved and target amounts, the share saved, the target date (or \"Goal reached\") and, when on, the monthly amount." },
  { id: "AC-3", text: "A deposit card shows the amount, the rate, the maturity date and, after Renew, the renewal term." },
  { id: "AC-4", text: "A loan card shows the amount left, the share repaid and the next payment with its date." },
  { id: "AC-5", text: "The portfolio card shows total value and the gain or loss against cost with its percentage." },
  { id: "AC-6", text: "A section with nothing in it shows its empty text and one button to start." },
  { id: "AC-7", text: "When all sections are hidden the screen says \"Nothing to show\"." },
  { id: "AC-8", text: "After a Save journey succeeds the screen shows the changed figures." },
  { id: "AC-9", text: "Each button opens the journey of its card with the values it needs (the goal, the deposit or the loan chosen)." },
  { id: "AC-10", text: "When a section cannot be read the screen says so with Try again, and shows no figure as if it were right." },
  { id: "AC-11", text: "It needs accounts.view; a person without it gets \"Not available\"." },
];

// Alex Morgan on Tuesday 3 November 2026: the goal g1 (Holiday fund), the deposit td1, the loan ln1 and two funds worth 4,820.00.
const NOW = "2026-11-03T10:00:00Z";
type Step = Record<string, unknown>;
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const press = (label: string): Step => ({ press: label });
const base = { persona: "alex", now: NOW };
const SECTIONS = ["Savings goals", "Term deposits", "Loans", "Investments"];
const allOff = { "opt.showGoals": false, "opt.showDeposits": false, "opt.showLoans": false, "opt.showInvest": false };
const code: NonNullable<Journey["scenarios"]>[number]["setup"] = [{ adapter: "bank.otp.send" }, { adapter: "bank.otp.verify", input: { code: "482100" } }];
const emptyAll = { empty: ["bank.goals.list", "bank.deposits.list", "bank.loans.list", "bank.funds.portfolio"] };

/** One button of the view and where it leads. */
const opens: [string, string, Record<string, unknown>, string[]][] = [
  ["New goal", "savings-goal", { "launch.mode": "create" }, ["AC-9"]],
  ["Add money to Holiday fund", "savings-goal", { "launch.mode": "add", "launch.goalId": "g1" }, ["AC-9"]],
  ["Edit Holiday fund", "savings-goal", { "launch.mode": "edit", "launch.goalId": "g1" }, ["AC-9"]],
  ["Open", "term-deposit", { "launch.mode": "open" }, ["AC-9"]],
  ["Renew the $10,000.00 deposit", "term-deposit", { "launch.mode": "renew", "launch.depositId": "td1" }, ["AC-9"]],
  ["Close the $10,000.00 deposit", "term-deposit", { "launch.mode": "close", "launch.depositId": "td1" }, ["AC-9"]],
  ["Apply", "apply-loan", {}, ["AC-9"]],
  ["Repay Personal loan", "repay-loan", { "launch.loanId": "ln1" }, ["AC-9"]],
  ["Invest", "invest", {}, ["AC-9"]],
  ["Sell", "sell-investment", {}, ["AC-9"]],
];
/** The empty states, each with its one button. */
const starts: [string, string, string, Record<string, unknown>][] = [
  ["No savings goals", "Create a goal", "savings-goal", { "launch.mode": "create" }],
  ["No term deposits", "Open a term deposit", "term-deposit", { "launch.mode": "open" }],
  ["No loans", "Apply for a loan", "apply-loan", {}],
  ["No investments yet", "Start investing", "invest", {}],
];

export const saveBorrowScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "The four sections with their key figures: Holiday fund, the 10,000.00 deposit, the personal loan and the portfolio", covers: ["AC-1", "AC-2", "AC-3", "AC-4", "AC-5"], ...base,
    steps: [
      screen("list"), ...SECTIONS.map(text),
      text("Holiday fund"), text("$3,200.00 of $5,000.00"), text("64% saved"), text("By 30 Jun 2027"), text("$200.00 a month"),
      text("Term deposit · $10,000.00"), text("4.20% · matures 12 Aug 2027"), noText("Renews for"),
      text("Personal loan"), text("$9,600.00 left"), text("40% repaid"), text("Next payment $412.50 on 1 Dec 2026"),
      text("Portfolio"), text("$4,820.00"), text("▲ $170.00 (3.7%) since you invested"),
      noText("No savings goals"), noText("No term deposits"), noText("No loans"), noText("No investments yet"), noText("Nothing to show"),
    ],
  },
  {
    id: "T-2", name: "With all four options off the screen says Nothing to show", covers: ["AC-1", "AC-7"], ...base, launch: allOff,
    steps: [text("Nothing to show"), text("Savings and borrowing aren’t available right now."), ...SECTIONS.map(noText), noText("Holiday fund")],
  },
  {
    id: "T-3", name: "In the Lean preset (term deposits, loans and investments switched off by the bank) only Savings goals is drawn", covers: ["AC-1"], ...base, config: { disabled: ["term-deposit", "apply-loan", "invest", "sell-investment"] },
    steps: [text("Savings goals"), text("Holiday fund"), noText("Term deposits"), noText("Loans"), noText("Investments"), noText("Nothing to show")],
  },
  {
    id: "T-4", name: "With every journey the bank has switched off the screen says Nothing to show", covers: ["AC-1", "AC-7"], ...base, config: { disabled: ["savings-goal", "term-deposit", "apply-loan", "invest"] },
    steps: [text("Nothing to show"), ...SECTIONS.map(noText)],
  },
  {
    id: "T-5", name: "One option off hides one section and leaves the others", covers: ["AC-1"], ...base, launch: { "opt.showDeposits": false },
    steps: [noText("Term deposits"), noText("Term deposit · $10,000.00"), text("Savings goals"), text("Loans"), text("Investments"), text("Nothing to show".replace("Nothing to show", "Portfolio"))],
  },
  {
    id: "T-6", name: "With repay-loan and sell-investment switched off the Loans and Investments sections keep their cards but not those buttons", covers: ["AC-1"], ...base, config: { disabled: ["repay-loan", "sell-investment"] },
    steps: [text("Personal loan"), noText("Repay Personal loan"), text("$4,820.00"), noText("Sell"), text("Invest")],
  },
  {
    id: "T-7", name: "Without payments.create goals, deposits and investments are not drawn; loans still are (apply-loan needs loans.apply) but without Repay", covers: ["AC-1"], ...base, conditions: { withoutPermissions: ["payments.create"] },
    steps: [noText("Savings goals"), noText("Term deposits"), noText("Investments"), text("Loans"), text("Personal loan"), text("Apply"), noText("Repay Personal loan"), noText("Nothing to show")],
  },
  {
    id: "T-8", name: "Without payments.create and loans.apply nothing is left to show", covers: ["AC-1", "AC-7"], ...base, conditions: { withoutPermissions: ["payments.create", "loans.apply"] },
    steps: [text("Nothing to show"), ...SECTIONS.map(noText)],
  },
  {
    id: "T-9", name: "With nothing in them each section shows its empty text and one button to start", covers: ["AC-6"], ...base, conditions: emptyAll,
    steps: [
      text("No savings goals"), text("Set a target and watch it grow."), text("No term deposits"), text("Lock money away for a fixed rate."), text("No loans"), text("Borrow when you need to, with a clear monthly payment."),
      text("No investments yet"), text("Start with as little as $50."), noText("Holiday fund"), noText("Nothing to show"), noText("New goal"), noText("Renew the"), noText("Repay"), noText("Sell"),
    ],
  },
  {
    id: "T-10", name: "A new customer sees every empty state", covers: ["AC-6"], persona: "sam", now: NOW,
    steps: [text("No savings goals"), text("No term deposits"), text("No loans"), text("No investments yet")],
  },
  {
    id: "T-11", name: "After adding 100.00 to Holiday fund the card shows 3,300.00", covers: ["AC-8", "AC-2"], ...base, setup: [{ adapter: "bank.goals.contribute", input: { goalId: "g1", amount: 100, fromAccountId: "acc_main" } }],
    steps: [text("$3,300.00 of $5,000.00"), text("66% saved"), noText("$3,200.00")],
  },
  {
    id: "T-12", name: "A goal that has reached its target says Goal reached and no date", covers: ["AC-2"], ...base, setup: [{ adapter: "bank.goals.contribute", input: { goalId: "g1", amount: 1800, fromAccountId: "acc_main" } }],
    steps: [text("Goal reached"), text("100% saved"), noText("By 30 Jun 2027")],
  },
  {
    id: "T-13", name: "A goal without a top-up shows no monthly amount", covers: ["AC-2"], ...base, setup: [{ adapter: "bank.goals.update", input: { goalId: "g1", name: "Holiday fund", target: 5000, date: "2027-06-30", autoOn: false } }],
    steps: [text("By 30 Jun 2027"), noText("a month")],
  },
  {
    id: "T-14", name: "After Renew the deposit card says Renews for 24 months", covers: ["AC-3", "AC-8"], ...base, setup: [...code, { adapter: "bank.deposits.renew", input: { depositId: "td1", term: 24, instruction: "renew" } }],
    steps: [text("4.20% · matures 12 Aug 2027"), text("Renews for 24 months")],
  },
  {
    id: "T-15", name: "After a new deposit both are listed, in the order they were opened", covers: ["AC-3", "AC-8"], ...base, setup: [...code, { adapter: "bank.deposits.open", input: { amount: 5000, term: 12, payout: "maturity", fromAccountId: "acc_main" } }],
    steps: [text("Term deposit · $10,000.00"), text("Term deposit · $5,000.00"), text("4.20% · matures 3 Nov 2027")],
  },
  {
    id: "T-16", name: "After paying an instalment the loan card shows the new balance, the share repaid and the next date", covers: ["AC-4", "AC-8"], ...base, setup: [...code, { adapter: "bank.loans.repay", input: { loanId: "ln1", option: "next", fromAccountId: "acc_main" } }],
    steps: [text("$9,266.70 left"), text("42% repaid"), text("Next payment $412.50 on 1 Jan 2027")],
  },
  {
    id: "T-17", name: "After a new loan both are listed and the new one is named for its purpose", covers: ["AC-4", "AC-8"], ...base,
    setup: [{ adapter: "bank.loans.eligibility", input: { amount: 5000, term: 36, purpose: "Car", employment: "Employed", income: 5000, commitments: 300 } }, ...code, { adapter: "bank.loans.apply", input: { amount: 5000, term: 36, rate: 9.9, accountId: "acc_main" } }],
    steps: [text("Personal loan"), text("Car loan"), text("$5,000.00 left"), text("0% repaid"), text("Next payment $161.10 on 3 Dec 2026")],
  },
  {
    id: "T-18", name: "After buying 200.00 of the Global Equity Fund the portfolio reads 5,020.01", covers: ["AC-5", "AC-8"], ...base, setup: [...code, { adapter: "bank.funds.buy", input: { fundId: "geq", amount: 200, fromAccountId: "acc_main" } }],
    steps: [text("$5,020.01"), text("▲ $170.01 (3.5%) since you invested")],
  },
  {
    id: "T-19", name: "After selling everything the investments section is empty", covers: ["AC-5", "AC-6", "AC-8"], ...base,
    setup: [...code, { adapter: "bank.funds.sell", input: { fundId: "bal", all: true, toAccountId: "acc_main" } }, ...code, { adapter: "bank.funds.sell", input: { fundId: "geq", all: true, toAccountId: "acc_main" } }],
    steps: [text("No investments yet"), noText("$4,820.00"), noText("Sell")],
  },
  ...opens.map(([label, journey, values, covers], i): NonNullable<Journey["scenarios"]>[number] => ({
    id: `T-${20 + i}`, name: `${label} opens ${journey} with its values`, covers, ...base, steps: [press(label), { expectOpens: { journey, with: values } }],
  })),
  ...starts.map(([title, label, journey, values], i): NonNullable<Journey["scenarios"]>[number] => ({
    id: `T-${30 + i}`, name: `${title}: ${label} opens ${journey}`, covers: ["AC-6", "AC-9"], ...base, conditions: emptyAll, steps: [text(title), press(label), { expectOpens: { journey, with: values } }],
  })),
  {
    id: "T-34", name: "When the goals cannot be read the screen says so and offers Try again; no figure is shown", covers: ["AC-10"], ...base, conditions: { unavailable: ["bank.goals.list"] },
    steps: [screen("loadFail"), text("We couldn’t load this."), text("Nothing was changed. Please try again."), noText("$3,200.00"), press("Try again"), screen("loadFail")],
  },
  {
    id: "T-35", name: "When the deposits cannot be read the screen says so", covers: ["AC-10"], ...base, conditions: { unavailable: ["bank.deposits.list"] },
    steps: [screen("loadFail"), noText("$10,000.00")],
  },
  {
    id: "T-36", name: "When the loans cannot be read the screen says so", covers: ["AC-10"], ...base, conditions: { unavailable: ["bank.loans.list"] },
    steps: [screen("loadFail"), noText("$9,600.00")],
  },
  {
    id: "T-37", name: "When the portfolio cannot be read the screen says so", covers: ["AC-10"], ...base, conditions: { unavailable: ["bank.funds.portfolio"] },
    steps: [screen("loadFail"), noText("$4,820.00")],
  },
  {
    id: "T-38", name: "When the bank's setup cannot be read the screen says so", covers: ["AC-10"], ...base, conditions: { unavailable: ["bank.app.config"] },
    steps: [screen("loadFail"), noText("Savings goals")],
  },
  {
    id: "T-39", name: "When the bank does not answer in time the screen says it is taking longer than expected", covers: ["AC-10"], ...base, conditions: { timeout: ["bank.loans.list"], latencyMs: 10000 },
    steps: [screen("loadFail"), text("This is taking longer than expected. Nothing was changed."), noText("Nothing was changed. Please try again.")],
  },
  {
    id: "T-40", name: "Without accounts.view the screen is not available", covers: ["AC-11"], ...base, conditions: { withoutPermissions: ["accounts.view"] },
    steps: [screen("denied"), text("Not available"), noText("Savings goals")],
  },
  {
    id: "T-41", name: "Nothing is changed by looking: the figures of the bank stay as they were", covers: ["AC-8"], ...base,
    steps: [text("$4,820.00"), { expectBank: { adapter: "bank.goals.list", path: "g1.savedText", equals: "$3,200.00" } }, { expectBank: { adapter: "bank.deposits.list", path: "td1.amountText", equals: "$10,000.00" } }],
  },
];
