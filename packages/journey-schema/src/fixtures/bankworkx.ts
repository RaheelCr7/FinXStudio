import type { Journey } from "../schema";

/** Journeys for the BankWorkx app. English only for now; the app filters them out of other banks' apps with `apps`. */
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

export const addCard: Journey = {
  ...base, id: "jrn_add_card", slug: "add-card", name: "Add card", entryScreen: "card",
  dataModel: {
    card: { type: "object", required: true },
    "card.number": { type: "string" }, "card.holder": { type: "string" }, "card.expiry": { type: "string" }, "card.cvv": { type: "string" },
    "card.nickname": { type: "string" },
    "card.makeDefault": { type: "boolean" },
    "card.consent": { type: "boolean", required: true },
  },
  integrations: [{ id: "addCard", adapter: "bank.cards.add", mode: "sandbox" }],
  screens: [
    {
      id: "card", title: "Add your card",
      blocks: [
        { type: "stepper", steps: ["card", "review"] },
        { type: "cardForm", bind: "card" },
        { type: "textInput", bind: "card.nickname", label: "Nickname (optional)", placeholder: "For example, Everyday" },
        { type: "toggle", bind: "card.makeDefault", label: "Make this my default card", helper: "Used first when you add money" },
        { type: "button", label: "Continue", variant: "primary", actions: [{ type: "validate" }, { type: "navigate", to: "review" }] },
      ],
    },
    {
      id: "review", title: "Review card",
      blocks: [
        { type: "reviewSummary", rows: [{ label: "Name on card", value: "{{card.holder}}" }, { label: "Expires", value: "{{card.expiry}}" }, { label: "Nickname", value: "{{card.nickname}}" }] },
        {
          type: "consent", bind: "card.consent", termsVersion: "cards-v1", text: "I authorise BankWorkx to save this card for adding money",
          validation: { mustBeTrue: true, messages: { mustBeTrue: "Tick the box to continue" } },
        },
        {
          type: "button", label: "Save card", variant: "primary",
          actions: [
            { type: "validate" },
            { type: "callApi", integration: "addCard", input: { number: "{{card.number}}", holder: "{{card.holder}}", expiry: "{{card.expiry}}", cvv: "{{card.cvv}}", nickname: "{{card.nickname}}", makeDefault: "{{card.makeDefault}}" }, saveAs: "result", onError: { navigate: "failed" } },
            { type: "navigate", to: "success" },
          ],
        },
      ],
    },
    {
      id: "success", title: "Card added", kind: "terminal",
      blocks: [{ type: "result", tone: "success", title: "Card added", text: "You can now add money from this card." }, done],
    },
    {
      id: "failed", title: "Card not added", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We couldn't add this card", text: "It may already be saved, or the details may not match. Check them and try again." },
        { type: "button", label: "Try again", variant: "primary", actions: [{ type: "navigate", to: "card" }] },
      ],
    },
  ],
};

export const connectAccount: Journey = {
  ...base, id: "jrn_connect_account", slug: "connect-account", name: "Connect account", entryScreen: "type",
  dataModel: {
    "conn.accountType": { type: "string", required: true },
    "conn.bankId": { type: "string", required: true },
    "conn.username": { type: "string", required: true },
    "conn.password": { type: "string", required: true },
    "conn.consent": { type: "boolean", required: true },
  },
  integrations: [
    { id: "banks", adapter: "bank.banks.list", mode: "sandbox" },
    { id: "connectBank", adapter: "bank.accounts.connect", mode: "sandbox" },
  ],
  screens: [
    {
      id: "type", title: "Account type",
      blocks: [
        { type: "stepper", steps: ["type", "bank", "login"] },
        {
          type: "select", bind: "conn.accountType", label: "What do you want to connect?", variant: "tiles",
          choices: [{ id: "bank", label: "Bank account", icon: "bank", text: "Savings or current" }, { id: "credit", label: "Credit card", icon: "card", text: "Cards and credit lines" }],
        },
        { type: "button", label: "Continue", variant: "primary", actions: [{ type: "validate" }, { type: "navigate", to: "bank" }] },
      ],
    },
    {
      id: "bank", title: "Choose your bank",
      onEnter: [{ type: "callApi", integration: "banks", saveAs: "ctx.banks" }],
      blocks: [
        { type: "select", bind: "conn.bankId", label: "Your bank", variant: "tiles", source: "ctx.banks" },
        { type: "button", label: "Continue", variant: "primary", actions: [{ type: "validate" }, { type: "navigate", to: "login" }] },
      ],
    },
    {
      id: "login", title: "Sign in to your bank",
      blocks: [
        { type: "alert", tone: "info", text: "Your details are encrypted and sent securely. BankWorkx only gets read-only access." },
        { type: "textInput", bind: "conn.username", label: "Username", placeholder: "Your online banking username" },
        { type: "textInput", bind: "conn.password", label: "Password", placeholder: "At least 6 characters", secure: true },
        {
          type: "consent", bind: "conn.consent", termsVersion: "connect-v1", text: "I allow BankWorkx to read my balance and transactions",
          validation: { mustBeTrue: true, messages: { mustBeTrue: "Tick the box to continue" } },
        },
        {
          type: "button", label: "Connect account", variant: "primary",
          actions: [
            { type: "validate" },
            { type: "callApi", integration: "connectBank", input: { bankId: "{{conn.bankId}}", username: "{{conn.username}}", password: "{{conn.password}}", accountType: "{{conn.accountType}}" }, saveAs: "ctx.connected", onError: { navigate: "failed" } },
            { type: "navigate", to: "success" },
          ],
        },
      ],
    },
    {
      id: "success", title: "Account connected", kind: "terminal",
      blocks: [{ type: "result", tone: "success", title: "Account connected", text: "{{ctx.connected.bank}} {{ctx.connected.maskedNumber}} is now linked to BankWorkx.", meta: "Balance ${{ctx.connected.balance | money}}" }, done],
    },
    {
      id: "failed", title: "Couldn't connect", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We couldn't connect your bank", text: "Check your username and password, then try again. If it keeps failing, your bank may be unavailable." },
        { type: "button", label: "Try again", variant: "primary", actions: [{ type: "navigate", to: "login" }] },
      ],
    },
  ],
};

export const createBudget: Journey = {
  ...base, id: "jrn_create_budget", slug: "create-budget", name: "Create budget", entryScreen: "setup",
  dataModel: {
    "budget.category": { type: "string", required: true },
    "budget.limit": { type: "number", required: true, currency: "USD" },
    "budget.alert": { type: "boolean" },
  },
  integrations: [{ id: "createBudget", adapter: "bank.budgets.create", mode: "sandbox" }],
  screens: [
    {
      id: "setup", title: "New budget",
      blocks: [
        { type: "stepper", steps: ["setup", "review"] },
        {
          type: "select", bind: "budget.category", label: "What are you budgeting for?", variant: "tiles",
          choices: [
            { id: "Food & Drinks", label: "Food & Drinks", icon: "food" }, { id: "Shopping", label: "Shopping", icon: "bag" }, { id: "Transport", label: "Transport", icon: "trend" },
            { id: "Health", label: "Health", icon: "shield" }, { id: "Travel", label: "Travel", icon: "wallet" }, { id: "Bills", label: "Bills", icon: "repeat" },
          ],
        },
        {
          type: "amountInput", bind: "budget.limit", currency: "USD", label: "Monthly limit", helper: "Choose an amount from $10 to $100,000", quickAmounts: [100, 250, 500, 1000],
          validation: { min: 10, max: 100000, messages: { min: "A budget must be at least $10", max: "A budget can be at most $100,000" } },
        },
        { type: "toggle", bind: "budget.alert", label: "Alert me at 80%", helper: "We'll tell you when you're close to the limit" },
        { type: "button", label: "Continue", variant: "primary", actions: [{ type: "validate" }, { type: "navigate", to: "review" }] },
      ],
    },
    {
      id: "review", title: "Review budget",
      blocks: [
        { type: "reviewSummary", rows: [{ label: "Category", value: "{{budget.category}}" }, { label: "Monthly limit", value: "${{budget.limit | money}}" }, { label: "Resets", value: "Every month" }] },
        {
          type: "button", label: "Create budget", variant: "primary",
          actions: [
            { type: "callApi", integration: "createBudget", input: { category: "{{budget.category}}", limit: "{{budget.limit}}" }, saveAs: "result", onError: { navigate: "failed" } },
            { type: "navigate", to: "success" },
          ],
        },
      ],
    },
    {
      id: "success", title: "Budget created", kind: "terminal",
      blocks: [{ type: "result", tone: "success", title: "Budget created", text: "{{budget.category}}: ${{budget.limit | money}} a month. You'll see it on your dashboard." }, done],
    },
    {
      id: "failed", title: "Budget not created", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We couldn't create this budget", text: "You may already have a budget for this category. Try a different one." },
        { type: "button", label: "Try again", variant: "primary", actions: [{ type: "navigate", to: "setup" }] },
      ],
    },
  ],
};

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

export const bankworkxJourneys: Journey[] = [addMoney, addCard, connectAccount, createBudget, invest];
