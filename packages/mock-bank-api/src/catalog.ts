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
    input: { currency: "optional, e.g. 'USD': the limit for accounts in that currency (customers with accounts in several currencies have one per currency)" }, returns: "{ daily, usedToday } in the currency of the customer's first account; with a currency, also { currency }. Fails with LIMIT_NOT_SET for a currency with no limit. Save as ctx.limits.",
  },
  {
    adapter: "bank.accounts.totals", suggestedId: "totals", description: "Balances added up per currency (never across currencies), for a customer with accounts in several currencies.",
    input: {}, returns: "Object keyed by currency code: { id, currency, total, count }. Save as ctx.totals and use it as a list source (a balance per currency).",
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
  {
    adapter: "bank.invest.instruments", suggestedId: "instruments", description: "The stocks and funds that can be bought (BankWorkx). Made-up companies.",
    input: {}, returns: "Object map keyed by symbol: { id, symbol, kind, sector, price, changePct, name }. Save as ctx.instruments and use it as a select source.",
  },
  {
    adapter: "bank.invest.buy", suggestedId: "buyInvestment", description: "Buys a stock or fund with a dollar amount from an account (BankWorkx). Buys fractional shares at today's price.",
    input: { symbol: "instrument symbol", amount: "number, 1 to 50000", fromAccountId: "account id" }, returns: "{ reference, symbol, name, shares, price, newBalance }", moneyMoving: true,
    errors: ["INSTRUMENT_NOT_FOUND", "INVALID_AMOUNT", "ACCOUNT_NOT_FOUND", "INSUFFICIENT_FUNDS"],
  },
  {
    adapter: "bank.invest.holdings", suggestedId: "holdings", description: "What the customer owns (BankWorkx).",
    input: {}, returns: "Object map keyed by symbol: { id, symbol, shares, value, name }. Save as ctx.holdings and use it as a select source.",
  },
  {
    adapter: "bank.invest.sell", suggestedId: "sellInvestment", description: "Sells a dollar amount of a holding and pays it into an account (BankWorkx). Selling the whole value sells every share.",
    input: { symbol: "symbol of a holding", amount: "number, at least 1, at most the holding's value", toAccountId: "account id" }, returns: "{ reference, symbol, name, shares, price, proceeds, newBalance }", moneyMoving: true,
    errors: ["NOT_HELD", "INVALID_AMOUNT", "ACCOUNT_NOT_FOUND", "INSUFFICIENT_HOLDING"],
  },
  {
    adapter: "bank.invest.watch", suggestedId: "watch", description: "Adds a stock or fund to the watchlist, or removes it with on: false (BankWorkx).",
    input: { symbol: "instrument symbol", on: "boolean, default true" }, returns: "{ watching }", errors: ["INSTRUMENT_NOT_FOUND"],
  },
  // ---- Cairo Amman Bank access journeys: outcomes come back as data ({ ok, code }) so a journey can route on them ----
  { adapter: "cab.legalEntities.list", suggestedId: "legalEntities", description: "The legal entities a customer can choose from.", input: {}, returns: "Object map keyed by id: { id, name }. Save as legal.list and use with select source." },
  { adapter: "cab.captcha.generate", suggestedId: "captcha", description: "A picture-code challenge. The sandbox returns its text so a journey can show it.", input: {}, returns: "{ serviceKey, text }. Save as captcha; send serviceKey and what the customer typed to a call that checks it." },
  { adapter: "cab.captcha.verify", suggestedId: "captchaCheck", description: "Checks what the customer typed for a picture code.", input: { serviceKey: "captcha.serviceKey", value: "the typed text" }, returns: "{ ok }" },
  {
    adapter: "cab.auth.signIn", suggestedId: "signIn", description: "Checks a username and password.", input: { username: "text", password: "text" },
    returns: "{ ok: true, firstName, lastLogin, accountCount, netWorth, currency, defaultSignIn } or { ok: false, code } where code is INVALID_CREDENTIALS (with attemptsLeft), LOCKED (lockMinutes, after 3 mistakes), PASSWORD_EXPIRED or INACTIVE. Save as auth.result and route with navigation rules.",
    errors: [],
  },
  { adapter: "cab.device.options", suggestedId: "deviceOptions", description: "Which sign-in options the customer has set up on this device.", input: {}, returns: "{ default: 'password'|'pin'|'biometric', pinSet, biometricAvailable }" },
  { adapter: "cab.device.setDefault", suggestedId: "setDefault", description: "Sets the default way to sign in; a PIN is six digits.", input: { mode: "'password' | 'pin' | 'biometric'", pin: "six digits, for pin" }, returns: "{ ok, default }", errors: ["INVALID_MODE", "PIN_INVALID"] },
  { adapter: "cab.device.verifyPin", suggestedId: "verifyPin", description: "Checks the sign-in PIN.", input: { pin: "six digits" }, returns: "{ ok }" },
  { adapter: "cab.preview.get", suggestedId: "preview", description: "Whether account preview before sign-in is on, and the balances it would show.", input: {}, returns: "{ enabled, accounts: map of { id, name, sub, balance, currency, maskedNumber }, asOf }" },
  { adapter: "cab.preview.accounts", suggestedId: "previewAccounts", description: "The balances account preview shows before sign-in, ready for accountPicker.", input: {}, returns: "Object map keyed by account id: { id, name, balance, currency, maskedNumber }. Save as ctx.previewAccounts." },
  { adapter: "cab.preview.set", suggestedId: "previewSet", description: "Turns account preview before sign-in on or off.", input: { enabled: "true or false" }, returns: "{ ok, enabled }" },
  { adapter: "cab.language.list", suggestedId: "languages", description: "Languages the app offers.", input: {}, returns: "Object map keyed by language code: { id, name, sub }. Save as ctx.languages and use with select source." },
  { adapter: "cab.language.current", suggestedId: "currentLanguage", description: "The language the app uses now.", input: {}, returns: "{ current, name }" },
  { adapter: "cab.language.selection", suggestedId: "languageSelection", description: "Which language to show as selected on the language list: the one already picked, else the one in use.", input: { chosen: "the code picked so far, or empty" }, returns: "{ code, name }. Save as language so the list opens with it ticked." },
  { adapter: "cab.language.set", suggestedId: "setLanguage", description: "Changes the app language.", input: { code: "en_US, en_GB, fr_FR or ar_AE" }, returns: "{ ok, current, name }", errors: ["LANGUAGE_UNSUPPORTED"] },
  {
    adapter: "cab.enroll.retail", suggestedId: "enroll", description: "Enrols a retail customer from the details the bank holds, after a picture-code check.",
    input: { captchaKey: "captcha.serviceKey", captchaValue: "typed text", lastName: "text", nationalId: "text", dob: "DD/MM/YYYY" },
    returns: "{ ok: true, firstName, username, activationCodeSent, maskedEmail, maskedPhone } or { ok: false, code } with CAPTCHA_WRONG, NOT_FOUND or ALREADY_ENROLLED.",
  },
  {
    adapter: "cab.activate.validate", suggestedId: "activate", description: "Checks a username and the activation code that was sent after enrolment.", input: { username: "text", code: "text" },
    returns: "{ ok: true } or { ok: false, code } with INVALID (attemptsLeft) or BLOCKED after 3 mistakes.",
  },
  { adapter: "cab.activate.regenerate", suggestedId: "regenerate", description: "Sends a new activation code (after the customer was found by cab.recover.verifyUser).", input: {}, returns: "{ ok, sent, maskedEmail, maskedPhone }", errors: ["VERIFY_FIRST"] },
  { adapter: "cab.password.policy", suggestedId: "policy", description: "The password rules the bank enforces.", input: {}, returns: "{ minLength: 8, maxLength: 100, differentChars: 5, notContainUsername: true }" },
  {
    adapter: "cab.activate.setPassword", suggestedId: "setPassword", description: "Creates the first password, activating the profile.", input: { password: "text", confirm: "text, optional: MISMATCH is returned when it differs" },
    returns: "{ ok: true } or { ok: false, code: 'MISMATCH' | 'POLICY', problems: [MIN_LENGTH | MAX_LENGTH | DIFFERENT_CHARS | CONTAINS_USERNAME] }", errors: ["ACTIVATION_REQUIRED"],
  },
  {
    adapter: "cab.recover.verifyUser", suggestedId: "verifyUser", description: "Finds a customer who cannot sign in from email, phone and date of birth, after a picture-code check.",
    input: { captchaKey: "captcha.serviceKey", captchaValue: "typed text", email: "text", phone: "digits", dob: "DD/MM/YYYY" },
    returns: "{ ok: true, username, firstName, status: 'ACTIVE'|'NEW', maskedEmail, maskedPhone } or { ok: false, code: 'CAPTCHA_WRONG'|'NOT_FOUND' }",
  },
  {
    adapter: "cab.recover.resetPassword", suggestedId: "resetPassword", description: "Sets a new password. The one-time code (bank.otp.send then bank.otp.verify) must be verified first.", input: { password: "text", confirm: "text, optional" },
    returns: "{ ok: true } or { ok: false, code: 'MISMATCH' | 'POLICY', problems }", requiresOtp: true, errors: ["VERIFY_FIRST", "OTP_REQUIRED"],
  },
  { adapter: "cab.locations.search", suggestedId: "locations", description: "Branches and ATMs.", input: { kind: "'branch' | 'atm' | 'all'", rangeMiles: "5, 10, 25, 50 or 100", query: "optional text" }, returns: "Object map keyed by location id: { id, name, sub }. Save as loc.found; use len(loc.found) for the count and select source to list them." },
  { adapter: "cab.locations.details", suggestedId: "locationDetail", description: "One branch or ATM.", input: { id: "location id" }, returns: "{ id, name, type, status, address, hours, phone, distanceKm, services }", errors: ["LOCATION_NOT_FOUND"] },
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
