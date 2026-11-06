import type { Journey, Screen } from "../schema";
import { sellInvestmentAcceptance, sellInvestmentScenarios } from "./sell-investment-tests";
import { alert, answerScreens, button, codeScreen, denied, go, lacks, lockedScreen, otpData, otpIntegrations, payIntegration, route, sendCode, set, text } from "./save-kit";

/** What this journey holds only while it is being sent: the code and the tick. Cleared on every way out. */
const wipe = [set("otp.code", ""), set("sl.consent", false)];
const err = (e: string) => `sl.err == '${e}'`;
const TIMEOUT = "We didn’t get an answer in time. Check your investments before you try again, so you don’t sell twice.";
const KIND = "{{ctx.error.code == 'NOTHING_TO_SELL' || ctx.error.code == 'FUND_NOT_FOUND' || ctx.error.code == 'NOT_HELD' ? 'gone' : ctx.error.code == 'OTP_REQUIRED' ? 'otp' : ctx.error.code == 'SELL_BELOW' || ctx.error.code == 'ABOVE_HOLDING' || ctx.error.code == 'INSUFFICIENT_HOLDING' || ctx.error.code == 'AMOUNT_REQUIRED' || ctx.error.code == 'AMOUNT_DECIMALS' || ctx.error.code == 'INVALID_AMOUNT' || ctx.error.code == 'ACCOUNT_NOT_FOUND' || ctx.error.code == 'ACCOUNT_CANNOT_CREDIT' ? 'amount' : ''}}";
const HOLD = "ctx.hold.items[sl.fundId]";
const summary = (rows: [string, string][], visibleWhen?: string) => ({ type: "reviewSummary" as const, rows: rows.map(([label, value]) => ({ label, value })), ...(visibleWhen ? { visibleWhen } : {}) });
const tick = (bind: string, t: string) => ({ type: "consent" as const, bind, termsVersion: "sell-v1", text: t, validation: { mustBeTrue: true, messages: { mustBeTrue: "Tick the box to continue." } } });
const view = (label: string) => button(label, [{ type: "navigate", toJourney: "save-borrow" }], "secondary");
/** The rows of the review and of the receipt: the fee is a row only when the bank takes one. */
const rows = (from: string, extra: [string, string][] = []): Record<"fee" | "free", [string, string][]> => ({
  fee: [["Investment", `{{${from}.name}}`], ["Sold", `{{${from}.soldText}}`], ["Selling fee", `{{${from}.feeText}}`], ["Estimated proceeds", `{{${from}.proceedsText}}`], ...extra],
  free: [["Investment", `{{${from}.name}}`], ["Sold", `{{${from}.soldText}}`], ["Estimated proceeds", `{{${from}.proceedsText}}`], ...extra],
});

/**
 * Sell an investment (BankWorkx, Personal: Save & Borrow). Choose a fund held (skipped with one, or one passed in), an amount or everything and the account to pay
 * into, see the selling fee, the estimated proceeds and the day the money arrives, tick, and sell with a one-time code. Selling everything removes the holding.
 *
 * A stock opened from the Invest tab (launch value `symbol`) takes a second, smaller road with the older adapters (`bank.invest.sell`): an amount from 1 up to its
 * value, no fee, a tick and a code. Built from the spec of the prototype with the blocks FinX has: the fee, proceeds and arrival day are on the review (the engine has
 * no live redraw), the bank checks the amount when Continue is pressed, and an empty amount says "Required" (the engine's word).
 */
export const sellInvestment: Journey = {
  id: "jrn_sell_investment",
  slug: "sell-investment",
  name: "Sell investment",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: sellInvestmentAcceptance,
  scenarios: sellInvestmentScenarios,
  dataModel: {
    "launch.holdId": { type: "string" },
    "launch.symbol": { type: "string" },
    "opt.sellFee": { type: "boolean" },
    "sl.kind": { type: "string" },
    "sl.fundId": { type: "string", required: true },
    "sl.symbol": { type: "string" },
    "sl.how": { type: "string", required: true },
    "sl.amount": { type: "money", currency: "USD", required: true },
    "sl.to": { type: "string", required: true },
    "sl.consent": { type: "boolean", required: true },
    "sl.err": { type: "string" },
    "sl.msg": { type: "string" },
    ...otpData,
  },
  integrations: [
    payIntegration,
    { id: "holdings", adapter: "bank.funds.holdings", mode: "sandbox" },
    { id: "stocks", adapter: "bank.invest.holdings", mode: "sandbox" },
    { id: "check", adapter: "bank.funds.get", mode: "sandbox" },
    ...otpIntegrations,
    { id: "sell", adapter: "bank.funds.sell", mode: "sandbox" },
    { id: "sellStock", adapter: "bank.invest.sell", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Sell an investment", kind: "branch",
      onEnter: [
        ...wipe, set("sl.err", ""), set("sl.msg", ""), set("sl.how", "amount"), set("sl.amount", null), set("sl.fundId", ""), set("ctx.error", null),
        set("sl.kind", "{{isEmpty(launch.symbol) ? 'fund' : 'stock'}}"), set("sl.symbol", "{{launch.symbol}}"),
        { type: "callApi", integration: "pay", saveAs: "ctx.pay", onError: { navigate: "fail" } },
        set("sl.to", "{{ctx.pay.defaultId}}"),
        go("loadHoldings"),
      ],
      navigation: route([lacks("payments.create"), "denied"], ["sl.kind == 'stock'", "loadStock"]),
      blocks: [],
    },
    {
      id: "loadHoldings", title: "Sell an investment", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "holdings", input: { pick: true }, saveAs: "ctx.hold", onError: { navigate: "fail" } },
        // a holding passed in is used when it is one the person has; with only one there is nothing to choose
        set("sl.fundId", "{{has(ctx.hold.items, launch.holdId) ? launch.holdId : len(ctx.hold.items) == 1 ? ctx.hold.firstId : ''}}"),
        go("pick"),
      ],
      navigation: route(["len(ctx.hold.items) == 0", "none"], ["!isEmpty(sl.fundId)", "amount"]),
      blocks: [],
    },
    {
      id: "pick", title: "What do you want to sell?",
      blocks: [
        text("What do you want to sell?", "title"),
        { type: "select", bind: "sl.fundId", label: "Investment", source: "ctx.hold.items", variant: "rows" },
        button("Continue", [{ type: "validate" }, go("amount")]),
        button("Cancel", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "none", title: "Sell an investment", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "You have no investments to sell.", text: "Invest first, then come back to sell." },
        button("Done", [{ type: "exit" }]),
      ],
    },
    {
      id: "amount", title: "How much?",
      blocks: [
        text("How much?", "title"),
        text(`{{${HOLD}.name}}`, "caption"),
        text(`{{${HOLD}.valueText}} · {{${HOLD}.unitsText}} units`, "body"),
        alert("error", "{{sl.msg}}", err("amount")),
        { type: "select", bind: "sl.how", label: "How much", variant: "chips", choices: [{ id: "amount", label: "An amount" }, { id: "all", label: "Everything" }] },
        { type: "amountInput", bind: "sl.amount", currency: "USD", label: "Amount", helper: "The smallest sale is $10.00", visibleWhen: "sl.how == 'amount'" },
        { type: "select", bind: "sl.to", label: "Pay into", source: "ctx.pay.accounts", variant: "rows" },
        // the bank applies the smallest sale, the value of the holding and the account that is paid before the person goes on
        button("Continue", [
          { type: "validate" }, set("sl.err", ""),
          { type: "callApi", integration: "check", input: { sell: true, fundId: "{{sl.fundId}}", all: "{{sl.how == 'all'}}", amount: "{{sl.amount}}", toAccountId: "{{sl.to}}", sellFee: "{{opt.sellFee != false}}" }, saveAs: "ctx.sum", onError: { navigate: "fail" } },
          go("review"),
        ]),
        button("Back", [set("sl.err", ""), go("pick")], "ghost", "len(ctx.hold.items) > 1 && isEmpty(launch.holdId)"),
        button("Cancel", [{ type: "exit" }], "ghost", "!(len(ctx.hold.items) > 1 && isEmpty(launch.holdId))"),
      ],
    },
    {
      id: "review", title: "Review sale",
      blocks: [
        text("Review sale", "title"),
        summary([...rows("ctx.sum", [["Money arrives", "{{ctx.sum.settlesText}}"], ["Pay into", "{{ctx.sum.intoName}}"]]).fee], "ctx.sum.fee > 0"),
        summary([...rows("ctx.sum", [["Money arrives", "{{ctx.sum.settlesText}}"], ["Pay into", "{{ctx.sum.intoName}}"]]).free], "!(ctx.sum.fee > 0)"),
        text("The price is the one when the sale is made. This is a sandbox: no real money moves.", "caption"),
        tick("sl.consent", "I confirm this sale."),
        button("Sell", [{ type: "validate" }, sendCode(), go("code")]),
        button("Back", [go("amount")], "ghost"),
      ],
    },
    // the stock of the older Invest tab: an amount, review, the same tick and code
    {
      id: "loadStock", title: "Sell an investment", kind: "branch",
      onEnter: [{ type: "callApi", integration: "stocks", saveAs: "ctx.inst", onError: { navigate: "fail" } }, go("stockAmount")],
      navigation: route(["!has(ctx.inst, sl.symbol)", "gone"]),
      blocks: [],
    },
    {
      id: "stockAmount", title: "Sell",
      blocks: [
        text("Sell", "title"),
        text("{{ctx.inst[sl.symbol].name}}", "caption"),
        alert("error", "{{sl.msg}}", err("amount")),
        {
          type: "amountInput", bind: "sl.amount", currency: "USD", label: "Amount to sell", helper: "You can sell up to the value of what you own. Selling all of it closes the holding.", quickAmounts: [25, 50, 100, 250],
          validation: { min: 1, messages: { min: "The smallest amount is $1" } },
        },
        { type: "select", bind: "sl.to", label: "Pay into", source: "ctx.pay.accounts", variant: "rows" },
        button("Continue", [{ type: "validate" }, set("sl.err", ""), go("stockReview")]),
        button("Cancel", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "stockReview", title: "Review sale",
      blocks: [
        text("Review sale", "title"),
        summary([["Selling", "{{ctx.inst[sl.symbol].name}}"], ["Amount", "${{sl.amount | money}}"], ["Order type", "Market order at today's price"], ["Fee", "$0"]]),
        text("The money reaches your account straight away. This is a sandbox: no real money moves.", "caption"),
        tick("sl.consent", "I confirm this sale."),
        button("Sell", [{ type: "validate" }, sendCode(), go("code")]),
        button("Back", [go("stockAmount")], "ghost"),
      ],
    },
    codeScreen({
      title: "Confirm with your code", submit: "Confirm", after: [set("otp.code", ""), go("submit")], back: "start", wipe,
      heading: [
        text("Authorise selling {{ctx.sum.soldText}}", "title", "sl.kind == 'fund'"),
        text("Authorise selling ${{sl.amount | money}} of {{sl.symbol}}", "title", "sl.kind == 'stock'"),
      ],
    }),
    {
      id: "submit", title: "Sell an investment", kind: "branch",
      onEnter: [go("doSell")],
      navigation: route(["sl.kind == 'stock'", "doSellStock"]),
      blocks: [],
    },
    {
      id: "doSell", title: "Sell an investment", kind: "branch",
      onEnter: [{ type: "callApi", integration: "sell", input: { fundId: "{{sl.fundId}}", all: "{{sl.how == 'all'}}", amount: "{{sl.amount}}", toAccountId: "{{sl.to}}", sellFee: "{{opt.sellFee != false}}" }, saveAs: "sl.res", onError: { navigate: "fail" } }, set("sl.consent", false), go("done")],
      blocks: [],
    },
    {
      id: "doSellStock", title: "Sell an investment", kind: "branch",
      onEnter: [{ type: "callApi", integration: "sellStock", input: { symbol: "{{sl.symbol}}", toAccountId: "{{sl.to}}", amount: "{{sl.amount}}" }, saveAs: "sl.res", onError: { navigate: "fail" } }, set("sl.consent", false), go("doneStock")],
      blocks: [],
    },
    {
      id: "done", title: "Sale placed", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Sale placed", text: "{{sl.res.proceedsText}} arrives on {{sl.res.settlesText}}.", meta: "Reference {{sl.res.reference}}" },
        summary(rows("sl.res", [["Pay into", "{{sl.res.intoName}}"], ["Settlement date", "{{sl.res.settlesText}}"]]).fee, "sl.res.fee > 0"),
        summary(rows("sl.res", [["Pay into", "{{sl.res.intoName}}"], ["Settlement date", "{{sl.res.settlesText}}"]]).free, "!(sl.res.fee > 0)"),
        view("View investments"),
        button("Done", [{ type: "exit" }]),
      ],
    },
    {
      id: "doneStock", title: "Sale complete", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Sale complete", text: "You sold {{sl.res.shares}} of {{sl.res.symbol}} and ${{sl.res.proceeds | money2}} is in your account.", meta: "Ref {{sl.res.reference}}" },
        button("Done", [{ type: "exit" }]),
      ],
    },
    lockedScreen("Too many wrong codes. Nothing was sold. Start again when you’re ready.", "start", wipe),
    {
      id: "fail", title: "Sell an investment", kind: "branch",
      onEnter: [set("otp.code", ""), set("sl.err", KIND), set("sl.msg", "{{ctx.error.message}}"), go("problem")],
      navigation: route(
        ["ctx.error.code == 'TIMEOUT'", "timeout"], ["ctx.error.code == 'SERVICE_UNAVAILABLE'", "unavailable"], ["sl.err == 'gone'", "gone"],
        ["sl.err == 'amount' && sl.kind == 'stock'", "stockAmount"], ["sl.err == 'amount'", "amount"], ["sl.err == 'otp'", "start"],
      ),
      blocks: [],
    },
    {
      id: "gone", title: "Sell an investment", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "You don’t hold any of this investment.", text: "Nothing was sold." },
        button("Back", [go("start")]),
        button("Close", [{ type: "exit" }], "ghost"),
      ],
    },
    ...answerScreens("start", TIMEOUT, wipe),
    {
      id: "problem", title: "Sell an investment", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We couldn’t sell", text: "Something went wrong. Nothing was sold." },
        button("Try again", [go("start")]),
        button("Close", [{ type: "exit" }], "ghost"),
      ],
    },
    denied("Sell an investment"),
  ] as Screen[],
};
