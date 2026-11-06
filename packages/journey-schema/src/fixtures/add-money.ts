import type { Journey } from "../schema";

const base = { version: 1, status: "published" as const, channels: ["mobile" as const], apps: ["bankworkx"], locale: { default: "en", supported: ["en"] } };
const done = { type: "button" as const, label: "Done", variant: "primary" as const, actions: [{ type: "exit" as const }] };

export const addMoney: Journey = {
  ...base, id: "jrn_add_money", slug: "add-money", name: "Add money", entryScreen: "amount",
  dataModel: {
    "add.toAccountId": { type: "string", required: true },
    "add.amount": { type: "number", required: true, currency: "USD" },
    "add.fromCardId": { type: "string", required: true },
  },
  integrations: [
    { id: "accounts", adapter: "bank.accounts.list", mode: "sandbox" },
    { id: "cards", adapter: "bank.cards.list", mode: "sandbox" },
    { id: "addMoney", adapter: "bank.deposit.create", mode: "sandbox" },
  ],
  screens: [
    {
      id: "amount", title: "Add money",
      onEnter: [{ type: "callApi", integration: "accounts", saveAs: "ctx.accounts" }, { type: "callApi", integration: "cards", saveAs: "ctx.cards" }],
      blocks: [
        { type: "stepper", steps: ["amount", "review"] },
        { type: "accountPicker", bind: "add.toAccountId", source: "ctx.accounts", showBalance: true },
        {
          type: "amountInput", bind: "add.amount", currency: "USD", label: "Amount", helper: "Enter an amount from $1 to $50,000 per transaction", quickAmounts: [50, 100, 150, 200],
          validation: { min: 1, max: 50000, messages: { min: "The smallest amount is $1", max: "The most you can add at once is $50,000" } },
        },
        { type: "select", bind: "add.fromCardId", label: "From card", source: "ctx.cards" },
        { type: "button", label: "Continue", variant: "primary", actions: [{ type: "validate" }, { type: "navigate", to: "review" }] },
      ],
    },
    {
      id: "review", title: "Review",
      blocks: [
        { type: "reviewSummary", rows: [{ label: "Amount", value: "${{add.amount | money}}" }, { label: "Fee", value: "$0" }, { label: "You'll add", value: "${{add.amount | money}}" }] },
        {
          type: "button", label: "Add ${{add.amount | money}}", variant: "primary",
          actions: [
            { type: "callApi", integration: "addMoney", input: { toAccountId: "{{add.toAccountId}}", fromCardId: "{{add.fromCardId}}", amount: "{{add.amount}}" }, saveAs: "result", onError: { navigate: "failed" } },
            { type: "navigate", to: "success" },
          ],
        },
      ],
    },
    {
      id: "success", title: "Money added", kind: "terminal",
      blocks: [{ type: "result", tone: "success", title: "Money added", text: "${{add.amount | money}} is now in your account.", meta: "Ref {{result.reference}}" }, done],
    },
    {
      id: "failed", title: "Couldn't add money", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "Couldn't add money", text: "Nothing was charged to your card. Check the amount and try again." },
        { type: "button", label: "Try again", variant: "primary", actions: [{ type: "navigate", to: "amount" }] },
      ],
    },
  ],
};
