import type { Journey } from "../schema";

/** What must be true for "Invest" to be right. Each is proved by at least one scenario below. */
export const investAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "The shelf lists the funds with risk chip, charge and smallest amount; the risk chips filter it; High is hidden with allowHigh off." },
  { id: "AC-2", text: "The amount must reach the fund's smallest amount and be covered by the paying account." },
  { id: "AC-3", text: "The estimated units and charge follow the amount as it changes." },
  { id: "AC-4", text: "A High-risk fund needs the ticked risk box when riskAck is on, and not otherwise." },
  { id: "AC-5", text: "Review shows investment, risk, account, amount, units, charge and price; a tick and a code are asked before anything is bought." },
  { id: "AC-6", text: "A purchase takes the amount from the account and adds units to the holding (a new holding or an increase)." },
  { id: "AC-7", text: "A wrong code buys nothing, and three wrong codes end the attempt." },
  { id: "AC-8", text: "When the bank is unavailable or times out nothing is invested." },
  { id: "AC-9", text: "It needs payments.create; the bank itself asks for the code and refuses a fund, an amount or an account that a screen would not offer." },
  { id: "AC-10", text: "A stock opened from the Invest tab (launch value symbol) is bought the older way: 1 to 50,000, no fee, a tick and a code before the money moves, and the same refusals and failure screens." },
];

// Alex Morgan on Tuesday 3 November 2026: Main ••4410 with $8,602.36 available, Savings ••7731; holdings Balanced Portfolio 150 units and Global Equity Fund 88 units, worth $4,820.00.
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
const portfolio = (equals: string): Step => bank("bank.funds.portfolio", {}, "valueText", equals);
const base = { persona: "alex", now: NOW };
const code = (c = "482100"): Step[] => [set({ "otp.code": c }), press("Confirm")];
/** A fund chosen and an amount typed, through the check to the review (a high-risk fund is ticked on the way). */
const toReview = (fundId: string, amount: number, extra: Record<string, unknown> = {}): Step[] => [set({ "inv.fundId": fundId }), press("Continue"), screen("amount"), set({ "inv.amount": amount, "inv.ack": true, ...extra }), press("Continue"), screen("review")];
const toCode = (fundId = "geq", amount = 200): Step[] => [...toReview(fundId, amount), set({ "inv.consent": true }), press("Invest"), screen("code")];
const stock = { ...base, launch: { "launch.symbol": "APXC" } };
const toStockCode = (amount = 100): Step[] => [screen("stockAmount"), set({ "inv.amount": amount }), press("Continue"), screen("stockReview"), set({ "inv.consent": true }), press("Invest"), screen("code")];

export const investScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "Global Equity Fund, 200.00 from Main: 7.273 units and about 1.70 of charge, the risk box, review, tick, code; Investment made and the portfolio reads 5,020.01", covers: ["AC-1", "AC-3", "AC-4", "AC-5", "AC-6"], ...base,
    steps: [
      screen("fund"), text("Choose an investment"), text("Government Bond Fund"), text("Global Equity Fund"), text("Technology Growth Fund"), text("High risk"), text("Low risk"), text("0.85% a year"), text("from $100.00"),
      set({ "inv.fundId": "geq" }), press("Continue"), screen("amount"), text("Global Equity Fund"), text("Smallest amount: $100.00"), text("Main ••4410"), text("$8,602.36 available"), text("I understand I could lose some or all of the money I invest."),
      set({ "inv.amount": 200 }), text("7.273"), text("0.85% a year (about $1.70)"), press("Continue"), screen("amount"), { expectError: "inv.ack" }, text("Please confirm to continue."),
      set({ "inv.ack": true }), press("Continue"), screen("review"), text("Global Equity Fund"), text("High risk"), text("Main ••4410"), text("$200.00"), text("7.273"), text("0.85% a year"), text("$27.50 per unit"), text("Estimated units"),
      avail("acc_main", 8602.36), portfolio("$4,820.00"), press("Invest"), screen("review"), { expectError: "inv.consent" },
      set({ "inv.consent": true }), press("Invest"), screen("code"), text("Authorise $200.00 into Global Equity Fund"), avail("acc_main", 8602.36), portfolio("$4,820.00"),
      ...code(), screen("done"), text("Investment made"), text("$200.00 is invested in Global Equity Fund."), text("Reference INV-20261103-"), text("Units"), text("7.273"),
      avail("acc_main", 8402.36), portfolio("$5,020.01"), held("geq.unitsText", "95.273"), text("View investments"), text("Invest more"),
    ],
  },
  {
    id: "T-2", name: "The estimate follows the amount: 100.00 is 3.636 units and about 0.85; nothing typed is 0", covers: ["AC-3"], ...base,
    steps: [set({ "inv.fundId": "geq" }), press("Continue"), text("0.85% a year"), noText("about"), set({ "inv.amount": 100 }), text("3.636"), text("(about $0.85)"), set({ "inv.amount": 1000 }), text("36.364"), text("(about $8.50)")],
  },
  {
    id: "T-3", name: "Amount rules: below the smallest of the fund is refused with its words, 50 is accepted for the Government Bond Fund, 9,000 is more than Main holds", covers: ["AC-2"], ...base,
    steps: [
      set({ "inv.fundId": "geq" }), press("Continue"), set({ "inv.amount": 50, "inv.ack": true }), press("Continue"), screen("amount"), text("The smallest amount for this fund is $100.00."), noText("Review"),
      set({ "inv.amount": 100 }), press("Continue"), screen("review"), press("Back"), screen("amount"), press("Back"), screen("fund"),
      set({ "inv.fundId": "gov" }), press("Continue"), set({ "inv.amount": 50 }), press("Continue"), screen("review"), text("$50.00"), text("4.762"),
      press("Back"), set({ "inv.amount": 9000 }), press("Continue"), screen("amount"), text("Not enough money in Main. Available: $8,602.36."),
    ],
  },
  {
    id: "T-4", name: "An empty amount is refused on the screen, and so is no fund at all", covers: ["AC-2"], ...base,
    steps: [press("Continue"), screen("fund"), { expectError: "inv.fundId" }, set({ "inv.fundId": "gov" }), press("Continue"), set({ "inv.amount": null }), press("Continue"), screen("amount"), { expectError: "inv.amount" }],
  },
  {
    id: "T-5", name: "The account that pays is chosen: Savings pays, and Main stays as it was", covers: ["AC-2", "AC-6"], ...base,
    steps: [set({ "inv.fundId": "bal" }), press("Continue"), set({ "inv.amount": 100, "inv.from": "acc_save" }), press("Continue"), text("Savings ••7731"), set({ "inv.consent": true }), press("Invest"), ...code(), screen("done"), avail("acc_save", 15154.37), avail("acc_main", 8602.36)],
  },
  {
    id: "T-6", name: "A frozen account cannot pay: You can’t use this account right now", covers: ["AC-2"], ...base, conditions: { frozen: ["acc_main"] },
    steps: [set({ "inv.fundId": "gov" }), press("Continue"), text("Frozen"), set({ "inv.amount": 100, "inv.from": "acc_main" }), press("Continue"), screen("amount"), text("You can’t use this account right now. Choose another account."), set({ "inv.from": "acc_save" }), press("Continue"), screen("review")],
  },
  {
    id: "T-7", name: "With allowHigh off only the Government Bond Fund and Balanced Portfolio show, and there is no High chip", covers: ["AC-1"], ...base, launch: { "opt.allowHigh": false },
    steps: [screen("fund"), text("Government Bond Fund"), text("Balanced Portfolio"), noText("Global Equity Fund"), noText("Technology Growth Fund"), noText("High"), text("Medium")],
  },
  {
    id: "T-8", name: "The risk chips filter the shelf: Low lists only the Government Bond Fund, High the two high-risk funds, All every fund", covers: ["AC-1"], ...base,
    steps: [
      set({ "inv.risk": "low" }), text("Government Bond Fund"), noText("Balanced Portfolio"), noText("Global Equity Fund"),
      set({ "inv.risk": "medium" }), text("Balanced Portfolio"), noText("Government Bond Fund"),
      set({ "inv.risk": "high" }), text("Global Equity Fund"), text("Technology Growth Fund"), noText("Balanced Portfolio"),
      set({ "inv.risk": "all" }), text("Government Bond Fund"), text("Technology Growth Fund"),
    ],
  },
  {
    id: "T-9", name: "A fund chosen under another risk is not the choice: Continue asks again with the spec's words", covers: ["AC-1"], ...base,
    steps: [set({ "inv.fundId": "bal", "inv.risk": "low" }), press("Continue"), screen("fund"), text("Choose an investment."), set({ "inv.risk": "medium" }), press("Continue"), screen("amount")],
  },
  {
    id: "T-10", name: "With riskAck off a High fund needs no risk box; a Low fund never does", covers: ["AC-4"], ...base, launch: { "opt.riskAck": false },
    steps: [set({ "inv.fundId": "geq" }), press("Continue"), screen("amount"), noText("I understand I could lose"), set({ "inv.amount": 200 }), press("Continue"), screen("review")],
  },
  {
    id: "T-11", name: "A Low or Medium fund asks for no risk box even with riskAck on", covers: ["AC-4"], ...base,
    steps: [set({ "inv.fundId": "gov" }), press("Continue"), screen("amount"), noText("I understand I could lose"), set({ "inv.amount": 100 }), press("Continue"), screen("review")],
  },
  {
    id: "T-12", name: "With a fund passed in the choice is skipped and the screen goes back no further; a fund that is not on the shelf is ignored", covers: ["AC-1"], ...base, launch: { "launch.fundId": "bal" },
    steps: [screen("amount"), text("Balanced Portfolio"), noText("Back"), text("Cancel")],
  },
  {
    id: "T-13", name: "A fund id the shelf does not have, or a high-risk fund with high off, is ignored: the person chooses", covers: ["AC-1"], ...base, launch: { "launch.fundId": "geq", "opt.allowHigh": false },
    steps: [screen("fund"), noText("Global Equity Fund")],
  },
  {
    id: "T-14", name: "A fund id that does not exist is ignored", covers: ["AC-1"], ...base, launch: { "launch.fundId": "nope" },
    steps: [screen("fund"), text("Government Bond Fund")],
  },
  {
    id: "T-15", name: "Buying a fund not held starts a holding; buying one held adds units", covers: ["AC-6"], ...base,
    steps: [...toCode("gov", 50), ...code(), screen("done"), held("gov.unitsText", "4.762"), held("gov.value", 50), press("Invest more"), screen("fund"), ...toCode("bal", 160), ...code(), held("bal.unitsText", "160"), held("bal.cost", 2460)],
  },
  {
    id: "T-16", name: "Invest more starts again at the choice of fund; View investments opens the Save screen", covers: ["AC-6"], ...base, launch: { "launch.fundId": "bal" },
    steps: [set({ "inv.amount": 100 }), press("Continue"), set({ "inv.consent": true }), press("Invest"), ...code(), screen("done"), press("Invest more"), screen("fund")],
  },
  {
    id: "T-17", name: "View investments opens the Save screen", covers: ["AC-6"], ...base, launch: { "launch.fundId": "bal" },
    steps: [set({ "inv.amount": 100 }), press("Continue"), set({ "inv.consent": true }), press("Invest"), ...code(), press("View investments"), { expectOpens: { journey: "save-borrow" } }],
  },
  {
    id: "T-18", name: "A wrong code buys nothing and says so; the right code goes on", covers: ["AC-7"], ...base,
    steps: [...toCode(), ...code("111111"), toast("That code isn’t right. Try again."), screen("code"), portfolio("$4,820.00"), avail("acc_main", 8602.36), ...code(), screen("done"), portfolio("$5,020.01")],
  },
  {
    id: "T-19", name: "Three wrong codes end the attempt: nothing bought, nothing taken", covers: ["AC-7"], ...base,
    steps: [...toCode(), ...code("111111"), ...code("111111"), ...code("111111"), screen("locked"), text("Too many wrong codes"), text("Nothing was invested."), portfolio("$4,820.00"), avail("acc_main", 8602.36), press("Start again"), screen("fund")],
  },
  {
    id: "T-20", name: "An empty code is not sent", covers: ["AC-7"], ...base,
    steps: [...toCode(), press("Confirm"), screen("code"), { expectError: "otp.code" }],
  },
  {
    id: "T-21", name: "When the bank is unavailable at the last step nothing is bought and no money is taken", covers: ["AC-8"], ...base, conditions: { unavailable: ["bank.funds.buy"] },
    steps: [...toCode(), ...code(), screen("unavailable"), text("We couldn’t reach the bank"), text("Nothing was sent and you haven’t been charged. Try again in a moment."), portfolio("$4,820.00"), avail("acc_main", 8602.36)],
  },
  {
    id: "T-22", name: "When the bank does not answer in time nothing is bought; Try again starts at the choice", covers: ["AC-8"], ...base, conditions: { timeout: ["bank.funds.buy"], latencyMs: 10000 },
    steps: [...toCode(), ...code(), screen("timeout"), text("This is taking longer than expected"), text("We didn’t get an answer in time. Check your investments before you try again, so you don’t invest twice."), portfolio("$4,820.00"), avail("acc_main", 8602.36), press("Try again"), screen("fund")],
  },
  {
    id: "T-23", name: "When the shelf cannot be read nothing starts", covers: ["AC-8"], ...base, conditions: { unavailable: ["bank.funds.list"] },
    steps: [screen("unavailable"), text("Nothing was sent and you haven’t been charged.")],
  },
  {
    id: "T-24", name: "When the accounts cannot be read nothing starts", covers: ["AC-8"], ...base, conditions: { timeout: ["bank.accounts.payFrom"], latencyMs: 10000 },
    steps: [screen("timeout")],
  },
  {
    id: "T-25", name: "When the check of the amount cannot be made at Continue nothing is bought and the person can try again", covers: ["AC-8"], ...base, conditions: { unavailable: ["bank.funds.get"] },
    steps: [set({ "inv.fundId": "gov" }), press("Continue"), set({ "inv.amount": 100 }), press("Continue"), screen("unavailable"), press("Try again"), screen("fund")],
  },
  {
    id: "T-26", name: "When the code cannot be sent nothing goes on", covers: ["AC-8"], ...base, conditions: { unavailable: ["bank.otp.send"] },
    steps: [...toReview("gov", 100), set({ "inv.consent": true }), press("Invest"), screen("unavailable"), portfolio("$4,820.00")],
  },
  {
    id: "T-27", name: "Without payments.create it is not available, and the bank refuses a purchase whatever a screen does", covers: ["AC-9"], ...base, conditions: { withoutPermissions: ["payments.create"] },
    steps: [screen("denied"), text("Not available"), forced("bank.funds.buy", { fundId: "bal", amount: 100, fromAccountId: "acc_main" }, "PERMISSION_DENIED"), portfolio("$4,820.00")],
  },
  {
    id: "T-28", name: "The bank asks for the code itself, and refuses amounts, funds and accounts that a screen would not offer", covers: ["AC-9", "AC-2"], ...base,
    steps: [
      forced("bank.funds.buy", { fundId: "bal", amount: 100, fromAccountId: "acc_main" }, "OTP_REQUIRED"), forced("bank.funds.get", { fundId: "geq", amount: 50, fromAccountId: "acc_main" }, "BELOW_MINIMUM"),
      forced("bank.funds.get", { fundId: "geq", amount: 200, fromAccountId: "acc_main", allowHigh: false }, "FUND_CLOSED"), forced("bank.funds.get", { fundId: "nope", amount: 200, fromAccountId: "acc_main" }, "FUND_NOT_FOUND"),
      forced("bank.funds.get", { fundId: "bal", amount: 9000, fromAccountId: "acc_main" }, "INSUFFICIENT_FUNDS"), forced("bank.funds.get", { fundId: "bal", amount: 100, fromAccountId: "nope" }, "ACCOUNT_NOT_FOUND"),
      forced("bank.funds.get", { fundId: "bal", amount: 100.555, fromAccountId: "acc_main" }, "AMOUNT_DECIMALS"), forced("bank.invest.buy", { symbol: "APXC", amount: 100, fromAccountId: "acc_main" }, "OTP_REQUIRED"), portfolio("$4,820.00"),
    ],
  },
  {
    id: "T-29", name: "A forced purchase of a frozen account is refused by the bank", covers: ["AC-9"], ...base, conditions: { frozen: ["acc_main"] },
    steps: [screen("fund"), forced("bank.funds.get", { fundId: "bal", amount: 100, fromAccountId: "acc_main" }, "ACCOUNT_CANNOT_DEBIT")],
  },
  // the stock of the older Invest tab
  {
    id: "T-30", name: "A stock from the Invest tab: 100 of APXC, review with the order type and a fee of 0, tick, code; Order placed with the shares, and Main is 100.00 less", covers: ["AC-10"], ...stock,
    steps: [
      screen("stockAmount"), text("Apex Cloud (APXC)"), text("Main ••4410"), set({ "inv.amount": 100 }), press("Continue"), screen("stockReview"), text("Buying"), text("$100"), text("Market order at today's price"), text("Fee"), text("$0"),
      press("Invest"), screen("stockReview"), { expectError: "inv.consent" }, set({ "inv.consent": true }), press("Invest"), screen("code"), text("Authorise $100 into APXC"), avail("acc_main", 8602.36),
      ...code(), screen("doneStock"), text("Order placed"), text("You bought 1.0368 of APXC at $96.45."), avail("acc_main", 8502.36), bank("bank.invest.holdings", {}, "APXC.shares", 1.0368),
    ],
  },
  {
    id: "T-31", name: "A stock: the screen takes 1 to 50,000 and nothing typed is refused", covers: ["AC-10"], ...stock,
    steps: [set({ "inv.amount": 0.5 }), press("Continue"), screen("stockAmount"), text("The smallest amount is $1"), set({ "inv.amount": 60000 }), press("Continue"), text("The most you can invest at once is $50,000"), set({ "inv.amount": null }), press("Continue"), { expectError: "inv.amount" }],
  },
  {
    id: "T-32", name: "A stock more than the account holds is refused after the code with the bank's words, and nothing is bought", covers: ["AC-10"], ...stock, launch: { "launch.symbol": "LMRB" },
    steps: [...toStockCode(50000), ...code(), screen("stockAmount"), text("Insufficient funds"), avail("acc_main", 8602.36), bank("bank.invest.holdings", {}, "LMRB.shares", 6.5)],
  },
  {
    id: "T-33", name: "A stock the bank does not know says so and offers nothing to buy", covers: ["AC-10"], ...base, launch: { "launch.symbol": "NOPE" },
    steps: [screen("gone"), text("We can’t find that investment."), text("Nothing was bought and you haven’t been charged.")],
  },
  {
    id: "T-34", name: "A stock: a wrong code buys nothing; unavailable and no answer in time buy nothing", covers: ["AC-10", "AC-7"], ...stock,
    steps: [...toStockCode(), ...code("111111"), toast("That code isn’t right. Try again."), screen("code"), avail("acc_main", 8602.36), bank("bank.invest.holdings", {}, "APXC", undefined)],
  },
  {
    id: "T-35", name: "A stock: when the bank is unavailable at the last step nothing is bought", covers: ["AC-10", "AC-8"], ...stock, conditions: { unavailable: ["bank.invest.buy"] },
    steps: [...toStockCode(), ...code(), screen("unavailable"), avail("acc_main", 8602.36)],
  },
  {
    id: "T-36", name: "A stock: when the bank does not answer in time nothing is bought", covers: ["AC-10", "AC-8"], ...stock, conditions: { timeout: ["bank.invest.buy"], latencyMs: 10000 },
    steps: [...toStockCode(), ...code(), screen("timeout"), avail("acc_main", 8602.36)],
  },
  {
    id: "T-37", name: "A stock: when the stocks cannot be read nothing starts", covers: ["AC-10", "AC-8"], ...stock, conditions: { unavailable: ["bank.invest.instruments"] },
    steps: [screen("unavailable")],
  },
  {
    id: "T-38", name: "A stock: when the code cannot be sent nothing goes on", covers: ["AC-10", "AC-8"], ...stock, conditions: { unavailable: ["bank.otp.send"] },
    steps: [screen("stockAmount"), set({ "inv.amount": 100 }), press("Continue"), set({ "inv.consent": true }), press("Invest"), screen("unavailable")],
  },
  {
    id: "T-39", name: "A stock: Back goes to the amount", covers: ["AC-10"], ...stock,
    steps: [set({ "inv.amount": 100 }), press("Continue"), press("Back"), screen("stockAmount")],
  },
];
