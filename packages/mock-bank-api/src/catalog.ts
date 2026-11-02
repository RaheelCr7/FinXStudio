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
];

/** Sandbox customers for testing. The OTP codes are sandbox-only test values. */
export function describePersonas() {
  return Object.values(personas).map((p) => ({
    id: p.id,
    name: p.name,
    otpCode: p.behaviour.otpCode,
    accounts: p.accounts.map((a) => `${a.id}: ${a.name} ${a.maskedNumber}, ${a.currency} ${a.balance.toLocaleString("en-US")}`),
    beneficiaries: p.beneficiaries.map((b) => `${b.id}: ${b.displayName}`),
    limits: p.limits,
    behaviour: p.behaviour.transferFails ? "Money-moving calls fail with CORE_UNAVAILABLE after a correct OTP." : p.behaviour.kyc === "rejected" ? "KYC rejected: no accounts, so money-moving journeys cannot start." : "Everything works.",
  }));
}
