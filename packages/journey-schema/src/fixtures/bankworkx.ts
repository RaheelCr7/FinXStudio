import type { Journey } from "../schema";
import { ownTransfer } from "./own-transfer";
import { manageBeneficiary } from "./manage-beneficiary";
import { personalTransfer } from "./personal-transfer";
import { internalTransfer } from "./internal-transfer";
import { internationalTransfer } from "./international-transfer";
import { payBillBankworkx } from "./pay-bill-bankworkx";
import { mobileTopup } from "./mobile-topup";
import { schedulePayment } from "./schedule-payment";
import { cancelStandingOrder } from "./cancel-standing-order";
import { supplierPayment } from "./supplier-payment";
import { approvePayments } from "./approve-payments";
import { signIn } from "./sign-in";
import { forgotUsername } from "./forgot-username";
import { resetPassword } from "./reset-password";
import { forgotPassword } from "./forgot-password";
import { unlockAccount } from "./unlock-account";
import { changePassword } from "./change-password";
import { trustedDevices } from "./trusted-devices";
import { changeQuickPin } from "./change-quick-pin";
import { setupQuickLogin } from "./setup-quick-login";
import { accounts } from "./accounts";
import { accountDetails } from "./account-details";
import { statement } from "./statement";
import { openAnotherAccount } from "./open-another-account";
import { createBudget } from "./create-budget";
import { budgets } from "./budgets";
import { transferTypes } from "./transfer-types";
import { accountNickname } from "./account-nickname";
import { singleTransfer } from "./single-transfer";
import { addCard } from "./add-card";
export { addCard };
import { disputeTransaction } from "./dispute-transaction";
import { replaceCard } from "./replace-card";
import { virtualCard } from "./virtual-card";
import { freezeCard } from "./freeze-card";
import { cardControls } from "./card-controls";
import { activateCard } from "./activate-card";
import { cardsView } from "./cards";
import { cardPin } from "./card-pin";

// Create a budget is its own file (accounts and budgets belong together); it is still exported from here, where it always was
export { createBudget };

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

export const bankworkxJourneys: Journey[] = [addMoney, addCard, connectAccount, createBudget, invest, sellInvestment, ownTransfer, manageBeneficiary, personalTransfer, internalTransfer, internationalTransfer, payBillBankworkx, mobileTopup, schedulePayment, cancelStandingOrder, supplierPayment, approvePayments, signIn, forgotUsername, resetPassword, forgotPassword, unlockAccount, changePassword, trustedDevices, changeQuickPin, setupQuickLogin, accounts, accountDetails, statement, openAnotherAccount, budgets, accountNickname, transferTypes, singleTransfer, cardsView, activateCard, cardControls, freezeCard, virtualCard, replaceCard, cardPin, disputeTransaction];
