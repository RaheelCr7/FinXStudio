import type { Journey } from "../schema";

/** What must be true for "Sell investment" to be right. Each is proved by at least one scenario below. */
export const sellInvestmentAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "Only funds the customer holds are offered; with one holding, or one passed in, the choice is skipped; with none the journey says so." },
  { id: "AC-2", text: "A part sale needs an amount from $10.00 to the holding's value, with the messages of the spec; \"Everything\" needs none." },
  { id: "AC-3", text: "The review shows the amount, the fee (when sellFee is on), the estimated proceeds and the settlement date." },
  { id: "AC-4", text: "A tick and a code are asked before anything is sold; a wrong code sells nothing, and three wrong codes end the attempt." },
  { id: "AC-5", text: "Selling everything removes the holding; a part sale reduces it." },
  { id: "AC-6", text: "The proceeds go to the chosen account, at once in the sandbox." },
  { id: "AC-7", text: "With sellFee off no fee is shown or taken." },
  { id: "AC-8", text: "When the bank is unavailable or times out nothing is sold." },
  { id: "AC-9", text: "It needs payments.create; the bank itself asks for the code and refuses a holding, an amount or an account that a screen would not offer." },
  { id: "AC-10", text: "A stock opened from the Invest tab (launch value symbol) is sold the older way: from 1 up to its value, no fee, a tick and a code before the money moves, and the same refusals and failure screens." },
];

// Alex Morgan on Tuesday 3 November 2026: Main ••4410 with $8,602.36 available, Savings ••7731; Balanced Portfolio 150 units ($2,400.00) and Global Equity Fund 88 units ($2,420.00).
const NOW = "2026-11-03T10:00:00Z";
type Step = Record<string, unknown>;
const set = (v: Record<string, unknown>): Step => ({ set: v });
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const toast = (t: string): Step => ({ expectToast: t });
const forced = (adapter: string, input: Record<string, unknown>, c: string): Step => ({ expectBankError: { adapter, input, code: c } });
const bank = (adapter: string, input: Record<string, unknown>, path: string, equals: unknown): Step => ({ expectBank: { adapter, input, path, equals } });
const avail = (id: string, equals: number): Step => bank("bank.accounts.payFrom", {}, `accounts.${id}.available`, equals);
const held = (path: string, equals: unknown): Step => bank("bank.funds.holdings", {}, path, equals);
const count = (equals: number): Step => bank("bank.funds.holdings", { pick: true }, "count", equals);
const base = { persona: "alex", now: NOW };
const bal = { ...base, launch: { "launch.holdId": "bal" } };
const geq = { ...base, launch: { "launch.holdId": "geq" } };
const code = (c = "482100"): Step[] => [set({ "otp.code": c }), press("Confirm")];
const everything: Step[] = [set({ "sl.how": "all" }), press("Continue"), screen("review")];
const toCode = (steps: Step[] = everything): Step[] => [...steps, set({ "sl.consent": true }), press("Sell"), screen("code")];
const stock = (symbol: string) => ({ ...base, launch: { "launch.symbol": symbol } });
const toStockCode = (amount: number): Step[] => [screen("stockAmount"), set({ "sl.amount": amount }), press("Continue"), screen("stockReview"), set({ "sl.consent": true }), press("Sell"), screen("code")];
/** Balanced Portfolio sold in full with the bank's own calls, so one holding is left. */
const soldBal: NonNullable<Journey["scenarios"]>[number]["setup"] = [{ adapter: "bank.otp.send" }, { adapter: "bank.otp.verify", input: { code: "482100" } }, { adapter: "bank.funds.sell", input: { fundId: "bal", all: true, toAccountId: "acc_main" } }];

export const sellInvestmentScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "Everything of the Balanced Portfolio: 2,400.00 less a 6.00 fee is 2,394.00, arriving 5 Nov 2026; a tick and the code; Sale placed, the holding is gone, Main has the money", covers: ["AC-3", "AC-4", "AC-5", "AC-6"], ...bal,
    steps: [
      screen("amount"), text("Balanced Portfolio"), text("$2,400.00 · 150 units"), text("An amount"), text("Everything"), text("Main ••4410"),
      set({ "sl.how": "all" }), noText("The smallest sale is $10.00"), press("Continue"), screen("review"),
      text("Balanced Portfolio"), text("$2,400.00"), text("Selling fee"), text("-$6.00"), text("Estimated proceeds"), text("$2,394.00"), text("Money arrives"), text("5 Nov 2026"), text("Main ••4410"),
      press("Sell"), screen("review"), { expectError: "sl.consent" }, count(2), avail("acc_main", 8602.36),
      set({ "sl.consent": true }), press("Sell"), screen("code"), text("Authorise selling $2,400.00"), count(2), avail("acc_main", 8602.36),
      ...code(), screen("done"), text("Sale placed"), text("$2,394.00 arrives on 5 Nov 2026."), text("Reference SEL-20261103-"), text("Settlement date"), text("-$6.00"), text("View investments"),
      count(1), held("bal", undefined), avail("acc_main", 10996.36),
    ],
  },
  {
    id: "T-2", name: "A part sale of the Global Equity Fund: below 10 and above its 2,420.00 are refused with their words; 100.00 pays 99.75 after a 0.25 fee and leaves about 84.364 units", covers: ["AC-2", "AC-3", "AC-5"], ...geq,
    steps: [
      set({ "sl.amount": 5 }), press("Continue"), screen("amount"), text("The smallest sale is $10.00."),
      set({ "sl.amount": 3000 }), press("Continue"), screen("amount"), text("You can’t sell more than $2,420.00."),
      set({ "sl.amount": 100 }), press("Continue"), screen("review"), text("$100.00"), text("-$0.25"), text("$99.75"), text("5 Nov 2026"),
      set({ "sl.consent": true }), press("Sell"), ...code(), screen("done"), text("$99.75 arrives on 5 Nov 2026."), text("-$0.25"),
      held("geq.unitsText", "84.364"), count(2), avail("acc_main", 8702.11),
    ],
  },
  {
    id: "T-3", name: "Selling exactly the value of a holding sells everything: the holding is gone", covers: ["AC-2", "AC-5"], ...geq,
    steps: [set({ "sl.amount": 2420 }), press("Continue"), screen("review"), text("$2,420.00"), text("-$6.05"), set({ "sl.consent": true }), press("Sell"), ...code(), screen("done"), count(1), held("geq", undefined)],
  },
  {
    id: "T-4", name: "Nothing typed is refused on the screen, and so is an amount that is not a number of dollars and cents", covers: ["AC-2"], ...geq,
    steps: [press("Continue"), screen("amount"), { expectError: "sl.amount" }, set({ "sl.amount": 10.005 }), press("Continue"), screen("amount"), text("Use at most 2 decimal places")],
  },
  {
    id: "T-5", name: "With sellFee off no fee is shown and the proceeds are the whole 2,400.00", covers: ["AC-7"], ...bal, launch: { "launch.holdId": "bal", "opt.sellFee": false },
    steps: [...everything, noText("Selling fee"), text("$2,400.00"), set({ "sl.consent": true }), press("Sell"), ...code(), screen("done"), noText("Selling fee"), text("$2,400.00 arrives on 5 Nov 2026."), avail("acc_main", 11002.36)],
  },
  {
    id: "T-6", name: "With no holding passed in both funds are offered with their units and value; one must be chosen", covers: ["AC-1"], ...base,
    steps: [screen("pick"), text("What do you want to sell?"), text("Balanced Portfolio"), text("150 units · $2,400.00"), text("Global Equity Fund"), text("88 units · $2,420.00"), press("Continue"), screen("pick"), { expectError: "sl.fundId" }, set({ "sl.fundId": "geq" }), press("Continue"), screen("amount"), text("Global Equity Fund"), press("Back"), screen("pick")],
  },
  {
    id: "T-7", name: "With one holding the choice is skipped, and the screen offers Cancel rather than Back", covers: ["AC-1"], ...base, setup: soldBal,
    steps: [screen("amount"), text("Global Equity Fund"), text("Cancel"), noText("Back")],
  },
  {
    id: "T-8", name: "A holding id the person does not have is ignored: they choose", covers: ["AC-1"], ...base, launch: { "launch.holdId": "gov" },
    steps: [screen("pick"), noText("Government Bond Fund")],
  },
  {
    id: "T-9", name: "With no holdings the journey says You have no investments to sell.", covers: ["AC-1"], ...base, conditions: { empty: ["bank.funds.holdings"] },
    steps: [screen("none"), text("You have no investments to sell.")],
  },
  {
    id: "T-10", name: "The proceeds go to the account chosen: Savings", covers: ["AC-6"], ...bal,
    steps: [set({ "sl.to": "acc_save" }), ...everything, text("Savings ••7731"), set({ "sl.consent": true }), press("Sell"), ...code(), screen("done"), avail("acc_save", 17648.37), avail("acc_main", 8602.36)],
  },
  {
    id: "T-11", name: "An account that cannot receive money is refused with the shared message", covers: ["AC-6"], ...bal, conditions: { frozen: ["acc_main"] },
    steps: [set({ "sl.to": "acc_main", "sl.how": "all" }), press("Continue"), screen("amount"), text("This account can’t receive money right now. Choose another account."), set({ "sl.to": "acc_save" }), press("Continue"), screen("review")],
  },
  {
    id: "T-12", name: "A wrong code sells nothing and says so; the right code goes on", covers: ["AC-4"], ...bal,
    steps: [...toCode(), ...code("111111"), toast("That code isn’t right. Try again."), screen("code"), count(2), avail("acc_main", 8602.36), ...code(), screen("done"), count(1)],
  },
  {
    id: "T-13", name: "Three wrong codes end the attempt: nothing sold, nothing paid", covers: ["AC-4"], ...bal,
    steps: [...toCode(), ...code("111111"), ...code("111111"), ...code("111111"), screen("locked"), text("Too many wrong codes"), text("Nothing was sold."), count(2), avail("acc_main", 8602.36), press("Start again"), screen("amount")],
  },
  {
    id: "T-14", name: "An empty code is not sent", covers: ["AC-4"], ...bal,
    steps: [...toCode(), press("Confirm"), screen("code"), { expectError: "otp.code" }],
  },
  {
    id: "T-15", name: "When the bank is unavailable at the last step nothing is sold and nothing is paid", covers: ["AC-8"], ...bal, conditions: { unavailable: ["bank.funds.sell"] },
    steps: [...toCode(), ...code(), screen("unavailable"), text("We couldn’t reach the bank"), count(2), avail("acc_main", 8602.36)],
  },
  {
    id: "T-16", name: "When the bank does not answer in time nothing is sold; Try again starts again", covers: ["AC-8"], ...bal, conditions: { timeout: ["bank.funds.sell"], latencyMs: 10000 },
    steps: [...toCode(), ...code(), screen("timeout"), text("We didn’t get an answer in time. Check your investments before you try again, so you don’t sell twice."), count(2), avail("acc_main", 8602.36), press("Try again"), screen("amount")],
  },
  {
    id: "T-17", name: "When the holdings cannot be read nothing starts", covers: ["AC-8"], ...base, conditions: { unavailable: ["bank.funds.holdings"] },
    steps: [screen("unavailable")],
  },
  {
    id: "T-18", name: "When the accounts cannot be read nothing starts", covers: ["AC-8"], ...base, conditions: { timeout: ["bank.accounts.payFrom"], latencyMs: 10000 },
    steps: [screen("timeout")],
  },
  {
    id: "T-19", name: "When the check of the sale cannot be made at Continue nothing is sold", covers: ["AC-8"], ...bal, conditions: { unavailable: ["bank.funds.get"] },
    steps: [set({ "sl.how": "all" }), press("Continue"), screen("unavailable"), count(2)],
  },
  {
    id: "T-20", name: "When the code cannot be sent nothing goes on", covers: ["AC-8"], ...bal, conditions: { unavailable: ["bank.otp.send"] },
    steps: [...everything, set({ "sl.consent": true }), press("Sell"), screen("unavailable"), count(2)],
  },
  {
    id: "T-21", name: "Without payments.create it is not available, and the bank refuses a sale whatever a screen does", covers: ["AC-9"], ...bal, conditions: { withoutPermissions: ["payments.create"] },
    steps: [screen("denied"), text("Not available"), forced("bank.funds.sell", { fundId: "bal", all: true, toAccountId: "acc_main" }, "PERMISSION_DENIED"), count(2)],
  },
  {
    id: "T-22", name: "The bank asks for the code itself, and refuses what a screen would not offer: nothing held, too little, too much, an unknown fund", covers: ["AC-9", "AC-2"], ...base,
    steps: [
      forced("bank.funds.sell", { fundId: "bal", all: true, toAccountId: "acc_main" }, "OTP_REQUIRED"), forced("bank.funds.get", { sell: true, fundId: "gov", all: true, toAccountId: "acc_main" }, "NOTHING_TO_SELL"),
      forced("bank.funds.get", { sell: true, fundId: "geq", amount: 5, toAccountId: "acc_main" }, "SELL_BELOW"), forced("bank.funds.get", { sell: true, fundId: "geq", amount: 3000, toAccountId: "acc_main" }, "ABOVE_HOLDING"),
      forced("bank.funds.get", { sell: true, fundId: "nope", all: true, toAccountId: "acc_main" }, "FUND_NOT_FOUND"), forced("bank.funds.get", { sell: true, fundId: "geq", all: true, toAccountId: "nope" }, "ACCOUNT_NOT_FOUND"),
      forced("bank.invest.sell", { symbol: "LMRB", amount: 10, toAccountId: "acc_main" }, "OTP_REQUIRED"), count(2),
    ],
  },
  {
    id: "T-23", name: "View investments opens the Save screen", covers: ["AC-6"], ...bal,
    steps: [...toCode(), ...code(), press("View investments"), { expectOpens: { journey: "save-borrow" } }],
  },
  {
    id: "T-24", name: "The tick is needed on the review", covers: ["AC-4"], ...bal,
    steps: [...everything, press("Sell"), screen("review"), { expectError: "sl.consent" }, count(2)],
  },
  // the stock of the older Invest tab
  {
    id: "T-25", name: "A stock from the Invest tab: 184.20 of LMRB, review with the order type and a fee of 0, tick, code; Sale complete with the shares sold, Main 184.20 more", covers: ["AC-10", "AC-6"], ...stock("LMRB"),
    steps: [
      screen("stockAmount"), text("Lumen Robotics (LMRB)"), set({ "sl.amount": 184.2 }), press("Continue"), screen("stockReview"), text("Selling"), text("$184.2"), text("Market order at today's price"), text("Fee"), text("$0"),
      press("Sell"), screen("stockReview"), { expectError: "sl.consent" }, set({ "sl.consent": true }), press("Sell"), screen("code"), text("Authorise selling $184.2 of LMRB"), avail("acc_main", 8602.36),
      ...code(), screen("doneStock"), text("Sale complete"), text("You sold 1 of LMRB and $184.20 is in your account."), avail("acc_main", 8786.56), bank("bank.invest.holdings", {}, "LMRB.shares", 5.5),
    ],
  },
  {
    id: "T-26", name: "A stock sold in full closes the holding; more than is held is refused after the code with the bank's words and nothing is sold", covers: ["AC-10"], ...stock("TBND"),
    steps: [
      ...toStockCode(600), ...code(), screen("stockAmount"), text("You only hold $491.50 of TBND"), avail("acc_main", 8602.36), bank("bank.invest.holdings", {}, "TBND.shares", 5),
      set({ "sl.amount": 491.5 }), press("Continue"), set({ "sl.consent": true }), press("Sell"), ...code(), screen("doneStock"), avail("acc_main", 9093.86), bank("bank.invest.holdings", {}, "TBND", undefined),
    ],
  },
  {
    id: "T-27", name: "A stock the person does not hold says so and offers nothing to sell", covers: ["AC-10"], ...stock("APXC"),
    steps: [screen("gone"), text("You don’t hold any of this investment."), text("Nothing was sold.")],
  },
  {
    id: "T-28", name: "A stock: below 1 and nothing typed are refused on the screen", covers: ["AC-10"], ...stock("LMRB"),
    steps: [set({ "sl.amount": 0.5 }), press("Continue"), screen("stockAmount"), text("The smallest amount is $1"), set({ "sl.amount": null }), press("Continue"), { expectError: "sl.amount" }],
  },
  {
    id: "T-29", name: "A stock: a wrong code sells nothing", covers: ["AC-10", "AC-4"], ...stock("LMRB"),
    steps: [...toStockCode(100), ...code("111111"), toast("That code isn’t right. Try again."), screen("code"), avail("acc_main", 8602.36), bank("bank.invest.holdings", {}, "LMRB.shares", 6.5)],
  },
  {
    id: "T-30", name: "A stock: when the bank is unavailable at the last step nothing is sold", covers: ["AC-10", "AC-8"], ...stock("LMRB"), conditions: { unavailable: ["bank.invest.sell"] },
    steps: [...toStockCode(100), ...code(), screen("unavailable"), avail("acc_main", 8602.36)],
  },
  {
    id: "T-31", name: "A stock: when the bank does not answer in time nothing is sold", covers: ["AC-10", "AC-8"], ...stock("LMRB"), conditions: { timeout: ["bank.invest.sell"], latencyMs: 10000 },
    steps: [...toStockCode(100), ...code(), screen("timeout"), avail("acc_main", 8602.36)],
  },
  {
    id: "T-32", name: "A stock: when the holdings cannot be read nothing starts", covers: ["AC-10", "AC-8"], ...stock("LMRB"), conditions: { unavailable: ["bank.invest.holdings"] },
    steps: [screen("unavailable")],
  },
  {
    id: "T-33", name: "A stock: when the code cannot be sent nothing goes on", covers: ["AC-10", "AC-8"], ...stock("LMRB"), conditions: { unavailable: ["bank.otp.send"] },
    steps: [screen("stockAmount"), set({ "sl.amount": 100 }), press("Continue"), set({ "sl.consent": true }), press("Sell"), screen("unavailable")],
  },
  {
    id: "T-34", name: "A stock: Back goes to the amount", covers: ["AC-10"], ...stock("LMRB"),
    steps: [set({ "sl.amount": 100 }), press("Continue"), press("Back"), screen("stockAmount")],
  },
];
