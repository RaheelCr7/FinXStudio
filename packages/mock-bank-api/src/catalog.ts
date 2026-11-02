import { personas } from "./index";

export type AdapterInfo = {
  /** Value for a journey's integrations[].adapter */
  adapter: string;
  /** Integration id to use. The engine counts OTP failures only for an integration named exactly "otpVerify". */
  suggestedId: string;
  description: string;
  input: Record<string, string>;
  returns: string;
  moneyMoving?: boolean;
  requiresOtp?: boolean;
  errors?: string[];
};

export const ADAPTER_CATALOG: AdapterInfo[] = [
  {
    adapter: "bank.accounts.list", suggestedId: "accounts", description: "The signed-in customer's accounts.",
    input: {}, returns: "Object map keyed by account id: { id, name, maskedNumber, iban, balance, currency, status, canDebit }. Save as ctx.accounts and use with accountPicker.",
  },
  {
    adapter: "bank.beneficiaries.list", suggestedId: "beneficiaries", description: "Saved payees.",
    input: {}, returns: "Object map keyed by beneficiary id: { id, displayName, bank, maskedNumber, addedAt, ageHours }. Save as ctx.beneficiaries.",
  },
  {
    adapter: "bank.limits.get", suggestedId: "limits", description: "Daily transfer limit and how much is used today.",
    input: {}, returns: "{ daily, usedToday } in PKR. Save as ctx.limits.",
  },
  {
    adapter: "bank.otp.send", suggestedId: "otpSend", description: "Sends a one-time code by SMS to the customer's phone.",
    input: { channel: "optional, 'sms'" }, returns: "{ sent, maskedPhone, channel }. Save as ctx.otp to show {{ctx.otp.maskedPhone}}.",
  },
  {
    adapter: "bank.otp.verify", suggestedId: "otpVerify", description: "Checks the code. Must succeed before any money-moving call.",
    input: { code: "the digits the customer typed, e.g. \"{{otp.code}}\"" }, returns: "{ verified: true }",
    errors: ["OTP_INVALID"],
  },
  {
    adapter: "bank.transfers.create", suggestedId: "transfer", description: "Sends money to a saved beneficiary.",
    input: { fromAccountId: "account id", beneficiaryId: "beneficiary id", amount: "number (PKR)", purpose: "text" },
    returns: "{ reference, newBalance }", moneyMoving: true, requiresOtp: true,
    errors: ["OTP_REQUIRED", "CORE_UNAVAILABLE", "ACCOUNT_NOT_FOUND", "INSUFFICIENT_FUNDS", "LIMIT_EXCEEDED"],
  },
  {
    adapter: "bank.billers.list", suggestedId: "billers", description: "Billers the customer can pay (utilities, internet).",
    input: {}, returns: "Object map keyed by biller id: { id, name, category }. Save as ctx.billers and use with a select block (source).",
  },
  {
    adapter: "bank.bills.lookup", suggestedId: "billLookup", description: "Finds a bill by biller and consumer number.",
    input: { billerId: "biller id", reference: "consumer number, 10 to 14 digits" },
    returns: "{ billerName, reference, payerName, amount, dueDate }", errors: ["BILL_NOT_FOUND", "BILLER_NOT_FOUND"],
  },
  {
    adapter: "bank.bills.pay", suggestedId: "billPay", description: "Pays a bill from an account.",
    input: { fromAccountId: "account id", amount: "number (PKR)", billerId: "optional", reference: "optional" },
    returns: "{ reference, newBalance }", moneyMoving: true, requiresOtp: true,
    errors: ["OTP_REQUIRED", "CORE_UNAVAILABLE", "ACCOUNT_NOT_FOUND", "INSUFFICIENT_FUNDS", "LIMIT_EXCEEDED"],
  },
  {
    adapter: "bank.carriers.list", suggestedId: "carriers", description: "Mobile carriers (Jazz, Zong, Telenor, Ufone).",
    input: {}, returns: "Object map keyed by carrier id: { id, name }. Save as ctx.carriers and use with a select block (source).",
  },
  {
    adapter: "bank.topup.create", suggestedId: "topup", description: "Mobile top-up from an account. The amount must be between 50 and 5,000 PKR.",
    input: { fromAccountId: "account id", amount: "number, 50 to 5000", carrier: "optional carrier id", mobile: "optional mobile number" },
    returns: "{ reference, newBalance }", moneyMoving: true, requiresOtp: true,
    errors: ["OTP_REQUIRED", "CORE_UNAVAILABLE", "INVALID_AMOUNT", "ACCOUNT_NOT_FOUND", "INSUFFICIENT_FUNDS", "LIMIT_EXCEEDED"],
  },
  {
    adapter: "bank.banks.list", suggestedId: "banks", description: "Banks a customer can connect (BankWorkx).",
    input: {}, returns: "Object map keyed by bank id: { id, name, color }. Save as ctx.banks and use with a select block (source).",
  },
  {
    adapter: "bank.cards.list", suggestedId: "cards", description: "The customer's saved cards (BankWorkx).",
    input: {}, returns: "Object map keyed by card id: { id, network, last4, holder, expiry, nickname, isDefault, name }. Save as ctx.cards and use with a select block (source).",
  },
  {
    adapter: "bank.deposit.create", suggestedId: "addMoney", description: "Adds money to an account from a saved card (BankWorkx). $1 to $50,000 per transaction.",
    input: { toAccountId: "account id", fromCardId: "card id", amount: "number, 1 to 50000" }, returns: "{ reference, newBalance }",
    errors: ["INVALID_AMOUNT", "ACCOUNT_NOT_FOUND", "CARD_NOT_FOUND"],
  },
  {
    adapter: "bank.cards.add", suggestedId: "addCard", description: "Saves a new card after checking the number, expiry and security code (BankWorkx).",
    input: { number: "card number", holder: "name on card", expiry: "MM/YY", cvv: "3 or 4 digits", nickname: "optional", makeDefault: "optional true/false" },
    returns: "{ cardId, last4, network }", errors: ["CARD_INVALID", "EXPIRY_INVALID", "CARD_EXPIRED", "CVV_INVALID", "CARD_EXISTS"],
  },
  {
    adapter: "bank.accounts.connect", suggestedId: "connectBank", description: "Links an account from another bank (BankWorkx). Sandbox: password invalid123 is rejected.",
    input: { bankId: "bank id", username: "text", password: "at least 6 characters", accountType: "'bank' or 'credit'" },
    returns: "{ connectedId, bank, kind, maskedNumber, balance }", errors: ["BANK_NOT_FOUND", "BANK_AUTH_FAILED", "ALREADY_CONNECTED"],
  },
  {
    adapter: "bank.budgets.list", suggestedId: "budgets", description: "The customer's monthly budgets (BankWorkx).",
    input: {}, returns: "Object map keyed by budget id: { id, name, category, limit, spent }. Save as ctx.budgets.",
  },
  {
    adapter: "bank.budgets.create", suggestedId: "createBudget", description: "Creates a monthly budget for a category (BankWorkx).",
    input: { category: "category name", limit: "number, 10 to 100000" }, returns: "{ budgetId, name, limit }", errors: ["INVALID_AMOUNT", "CATEGORY_REQUIRED", "BUDGET_EXISTS"],
  },
  {
    adapter: "bank.subscriptions.list", suggestedId: "subscriptions", description: "Recurring payments the customer has (BankWorkx).",
    input: {}, returns: "Object map keyed by subscription id: { id, name, amount, nextInDays, color }. Save as ctx.subscriptions.",
  },
  {
    adapter: "bank.subscriptions.pay", suggestedId: "paySubscription", description: "Pays a subscription now from an account (BankWorkx).",
    input: { subscriptionId: "subscription id", fromAccountId: "account id" }, returns: "{ reference, newBalance }", moneyMoving: true,
    errors: ["SUBSCRIPTION_NOT_FOUND", "ACCOUNT_NOT_FOUND", "INSUFFICIENT_FUNDS"],
  },
];

/** Sandbox customers for testing. The OTP codes are sandbox-only test values. */
export function describePersonas() {
  return Object.values(personas).map((p) => ({
    id: p.id,
    brand: p.brand,
    name: p.name,
    otpCode: p.behaviour.otpCode,
    accounts: p.accounts.map((a) => `${a.id}: ${a.name} ${a.maskedNumber}, ${a.currency} ${a.balance.toLocaleString("en-US")}`),
    beneficiaries: p.beneficiaries.map((b) => `${b.id}: ${b.displayName}`),
    limits: p.limits,
    behaviour: p.behaviour.transferFails ? "Money-moving calls fail with CORE_UNAVAILABLE after a correct OTP." : p.behaviour.kyc === "rejected" ? "KYC rejected: no accounts, so money-moving journeys cannot start." : "Everything works.",
  }));
}
