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
import { addMoney } from "./add-money";
import { invest } from "./invest";
import { sellInvestment } from "./sell-investment";
import { termDeposit } from "./term-deposit";
import { saveBorrow } from "./save-borrow";
import { savingsGoal } from "./savings-goal";
import { applyLoan } from "./apply-loan";
import { repayLoan } from "./repay-loan";
export { addMoney, invest, sellInvestment };

// Create a budget is its own file (accounts and budgets belong together); it is still exported from here, where it always was
export { createBudget };

/** Journeys for the BankWorkx app. English only for now; the app filters them out of other banks' apps with `apps`. */
const base = { version: 1, status: "published" as const, channels: ["mobile" as const], apps: ["bankworkx"], locale: { default: "en", supported: ["en"] } };
const done = { type: "button" as const, label: "Done", variant: "primary" as const, actions: [{ type: "exit" as const }] };


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



export const bankworkxJourneys: Journey[] = [addMoney, addCard, connectAccount, createBudget, invest, sellInvestment, ownTransfer, manageBeneficiary, personalTransfer, internalTransfer, internationalTransfer, payBillBankworkx, mobileTopup, schedulePayment, cancelStandingOrder, supplierPayment, approvePayments, signIn, forgotUsername, resetPassword, forgotPassword, unlockAccount, changePassword, trustedDevices, changeQuickPin, setupQuickLogin, accounts, accountDetails, statement, openAnotherAccount, budgets, accountNickname, transferTypes, singleTransfer, cardsView, activateCard, cardControls, freezeCard, virtualCard, replaceCard, cardPin, disputeTransaction, saveBorrow, termDeposit, savingsGoal, applyLoan, repayLoan];
