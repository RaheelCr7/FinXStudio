import type { Journey } from "../schema";

const base = { version: 1, status: "published" as const, channels: ["mobile" as const], apps: ["bankworkx"], locale: { default: "en", supported: ["en"] } };
const done = { type: "button" as const, label: "Done", variant: "primary" as const, actions: [{ type: "exit" as const }] };

export const invest: Journey = {
  ...base, id: "jrn_invest", slug: "invest", name: "Invest", entryScreen: "buy",
  dataModel: {
    "invest.symbol": { type: "string", required: true },
    "invest.fromAccountId": { type: "string", required: true },
    "invest.amount": { type: "number", required: true, currency: "USD" },
  },
  integrations: [
    { id: "accounts", adapter: "bank.accounts.list", mode: "sandbox" },
    { id: "instruments", adapter: "bank.invest.instruments", mode: "sandbox" },
    { id: "buy", adapter: "bank.invest.buy", mode: "sandbox" },
  ],
  screens: [
    {
      id: "buy", title: "Invest",
      onEnter: [{ type: "callApi", integration: "accounts", saveAs: "ctx.accounts" }, { type: "callApi", integration: "instruments", saveAs: "ctx.instruments" }],
      blocks: [
        { type: "stepper", steps: ["buy", "review"] },
        { type: "select", bind: "invest.symbol", label: "What do you want to buy?", source: "ctx.instruments" },
        { type: "accountPicker", bind: "invest.fromAccountId", source: "ctx.accounts", showBalance: true },
        {
          type: "amountInput", bind: "invest.amount", currency: "USD", label: "Amount to invest", helper: "From $1 to $50,000. You buy part of a share if the amount is smaller than its price.", quickAmounts: [25, 50, 100, 250],
          validation: { min: 1, max: 50000, messages: { min: "The smallest amount is $1", max: "The most you can invest at once is $50,000" } },
        },
        { type: "button", label: "Continue", variant: "primary", actions: [{ type: "validate" }, { type: "navigate", to: "review" }] },
      ],
    },
    {
      id: "review", title: "Review order",
      blocks: [
        { type: "reviewSummary", rows: [{ label: "Buying", value: "{{invest.symbol}}" }, { label: "Amount", value: "${{invest.amount | money}}" }, { label: "Order type", value: "Market order at today's price" }, { label: "Fee", value: "$0" }] },
        { type: "alert", tone: "info", text: "Investments can go down as well as up. This is a sandbox: no real money moves." },
        {
          type: "button", label: "Buy ${{invest.amount | money}}", variant: "primary",
          actions: [
            { type: "callApi", integration: "buy", input: { symbol: "{{invest.symbol}}", fromAccountId: "{{invest.fromAccountId}}", amount: "{{invest.amount}}" }, saveAs: "result", onError: { navigate: "failed" } },
            { type: "navigate", to: "success" },
          ],
        },
      ],
    },
    {
      id: "success", title: "Order placed", kind: "terminal",
      blocks: [{ type: "result", tone: "success", title: "Order placed", text: "You bought {{result.shares}} of {{result.symbol}} at ${{result.price | money2}}.", meta: "Ref {{result.reference}}" }, done],
    },
    {
      id: "failed", title: "Order not placed", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We couldn't place this order", text: "Nothing was bought and no money left your account. Check the amount and your balance, then try again." },
        { type: "button", label: "Try again", variant: "primary", actions: [{ type: "navigate", to: "buy" }] },
      ],
    },
  ],
};
