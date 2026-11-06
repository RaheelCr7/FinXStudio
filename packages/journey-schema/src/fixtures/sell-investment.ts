import type { Journey } from "../schema";

const base = { version: 1, status: "published" as const, channels: ["mobile" as const], apps: ["bankworkx"], locale: { default: "en", supported: ["en"] } };
const done = { type: "button" as const, label: "Done", variant: "primary" as const, actions: [{ type: "exit" as const }] };

export const sellInvestment: Journey = {
  ...base, id: "jrn_sell_investment", slug: "sell-investment", name: "Sell investment", entryScreen: "sell",
  dataModel: {
    "sell.symbol": { type: "string", required: true },
    "sell.toAccountId": { type: "string", required: true },
    "sell.amount": { type: "number", required: true, currency: "USD" },
  },
  integrations: [
    { id: "accounts", adapter: "bank.accounts.list", mode: "sandbox" },
    { id: "holdings", adapter: "bank.invest.holdings", mode: "sandbox" },
    { id: "sell", adapter: "bank.invest.sell", mode: "sandbox" },
  ],
  screens: [
    {
      id: "sell", title: "Sell",
      onEnter: [{ type: "callApi", integration: "accounts", saveAs: "ctx.accounts" }, { type: "callApi", integration: "holdings", saveAs: "ctx.holdings" }],
      blocks: [
        { type: "stepper", steps: ["sell", "review"] },
        { type: "select", bind: "sell.symbol", label: "What do you want to sell?", source: "ctx.holdings" },
        {
          type: "amountInput", bind: "sell.amount", currency: "USD", label: "Amount to sell", helper: "You can sell up to the value of what you own. Selling all of it closes the holding.", quickAmounts: [25, 50, 100, 250],
          validation: { min: 1, messages: { min: "The smallest amount is $1" } },
        },
        { type: "accountPicker", bind: "sell.toAccountId", source: "ctx.accounts", showBalance: true },
        { type: "button", label: "Continue", variant: "primary", actions: [{ type: "validate" }, { type: "navigate", to: "review" }] },
      ],
    },
    {
      id: "review", title: "Review sale",
      blocks: [
        { type: "reviewSummary", rows: [{ label: "Selling", value: "{{sell.symbol}}" }, { label: "Amount", value: "${{sell.amount | money}}" }, { label: "Order type", value: "Market order at today's price" }, { label: "Fee", value: "$0" }] },
        { type: "alert", tone: "info", text: "The money reaches your account straight away. This is a sandbox: no real money moves." },
        {
          type: "button", label: "Sell ${{sell.amount | money}}", variant: "primary",
          actions: [
            { type: "callApi", integration: "sell", input: { symbol: "{{sell.symbol}}", toAccountId: "{{sell.toAccountId}}", amount: "{{sell.amount}}" }, saveAs: "result", onError: { navigate: "failed" } },
            { type: "navigate", to: "success" },
          ],
        },
      ],
    },
    {
      id: "success", title: "Sale complete", kind: "terminal",
      blocks: [{ type: "result", tone: "success", title: "Sale complete", text: "You sold {{result.shares}} of {{result.symbol}} and ${{result.proceeds | money2}} is in your account.", meta: "Ref {{result.reference}}" }, done],
    },
    {
      id: "failed", title: "Sale not completed", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We couldn't complete this sale", text: "Nothing was sold and your account is unchanged. You can only sell up to the value of what you own." },
        { type: "button", label: "Try again", variant: "primary", actions: [{ type: "navigate", to: "sell" }] },
      ],
    },
  ],
};
