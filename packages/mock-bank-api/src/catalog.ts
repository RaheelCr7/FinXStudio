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
    adapter: "bank.beneficiaries.list", suggestedId: "beneficiaries", description: "Saved payees. One added in the last 24 hours is new and may only be sent 500.00 USD in any 24 hours.",
    input: {}, returns: "Object map keyed by beneficiary id: { id, displayName, bank, maskedNumber, addedAt, ageHours } and, for payees saved with bank.payees.save: kind (internal | domestic | international), region (bw | us | eu | uk | me | world), country, nickname, label, verified, nameCheck, coolingOffUntil (ISO or null), coolingOffHoursLeft, allowanceLeft (USD, null when not new), scheduledCount, scheduledText. Save as ctx.beneficiaries.",
  },
  {
    adapter: "bank.payees.validate", suggestedId: "validate", description: "Checks the details of a payee being added (or changed, with payeeId): the account for its region, no second copy, at most 50 payees. Fails with the first problem.",
    input: { payeeId: "only to change a payee", region: "bw (BankWorkx customer) | us | eu | uk | me | world (abroad)", country: "me: AE, SA, JO; world: DE, CA, IN, JP, AU, CH, SG, MX", name: "name on the account", nickname: "up to 24 characters", label: "Family | Friend | Landlord | Business | Other", customerNo: "bw: 10 digits", routing: "us: 9 digits, ABA checksum", account: "us, uk, world", accountType: "us: checking | savings", iban: "eu, me", sort: "uk: 6 digits", swift: "world: 8 or 11 characters" },
    returns: "{ ok, bankName, maskedNumber, sensitive, restartsClock }; for bw also { registeredName, found }. sensitive: the name or bank details of a saved payee changed.",
    errors: ["PAYEE_NAME_REQUIRED", "COUNTRY_REQUIRED", "INVALID_ACCOUNT", "CUSTOMER_NOT_FOUND", "INVALID_ROUTING", "INVALID_SORT_CODE", "INVALID_IBAN", "NOT_SEPA", "COUNTRY_MISMATCH", "INVALID_BIC", "NICKNAME_TOO_LONG", "BENEFICIARY_LIMIT", "BENEFICIARY_EXISTS", "BENEFICIARY_NOT_FOUND"],
  },
  {
    adapter: "bank.payees.check", suggestedId: "check", description: "The name check (Verification or Confirmation of Payee). A BankWorkx customer always matches; abroad, an unknown account, or skip gives na.",
    input: { "...": "the fields of bank.payees.validate", skip: "true when the bank switched the check off" },
    returns: "{ result: match | close | none | na, registeredName?, label }", errors: ["TIMEOUT", "SERVICE_UNAVAILABLE"],
  },
  {
    adapter: "bank.payees.save", suggestedId: "save", description: "Saves a new payee after the one-time code. Unless the name matched, acknowledged must be true. Verified only after a match. New for 24 hours.",
    input: { "...": "the fields of bank.payees.validate", skip: "as for check", acknowledged: "the person ticked that they understand" },
    returns: "{ payeeId, addedAt, coolingOffUntil, displayName, bank, maskedNumber, verified, nameCheck, allowanceUsd }",
    requiresOtp: true, errors: ["OTP_REQUIRED", "PAYEE_NOT_CHECKED", "BENEFICIARY_EXISTS", "BENEFICIARY_LIMIT"],
  },
  {
    adapter: "bank.payees.update", suggestedId: "update", description: "Changes a payee. Nickname or label: nothing more. Name or bank details: the one-time code and the check again; bank details also make it new for 24 hours (the name alone does not). Region cannot change.",
    input: { payeeId: "payee to change", "...": "the fields of bank.payees.validate", skip: "as for check", acknowledged: "as for save" },
    returns: "{ payeeId, addedAt, coolingOffUntil, displayName, bank, maskedNumber, verified, nameCheck, sensitive, restarted }",
    errors: ["OTP_REQUIRED", "PAYEE_NOT_CHECKED", "BENEFICIARY_NOT_FOUND", "BENEFICIARY_EXISTS"],
  },
  {
    adapter: "bank.payees.delete", suggestedId: "remove", description: "Removes a payee, no code needed. One used by a scheduled payment needs cancelSchedules true, which cancels them.",
    input: { payeeId: "payee to remove", cancelSchedules: "true to cancel the scheduled payments that use it" },
    returns: "{ removed, schedulesCancelled, displayName, bank, maskedNumber }", errors: ["BENEFICIARY_NOT_FOUND", "BENEFICIARY_IN_USE"],
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
    adapter: "bank.transfers.own", suggestedId: "transferOwn", description: "Moves money between two of the customer's own accounts in the same currency: instant, no fee, and not counted against the daily limit. Needs the one-time code first. For accounts in different currencies use bank.fx.quote and bank.fx.convert.",
    input: { fromAccountId: "account to debit", toAccountId: "account to credit", amount: "in the accounts' currency", note: "optional text" },
    returns: "{ reference, from: { currency, newBalance }, to: { currency, newBalance } }", moneyMoving: true, requiresOtp: true,
    errors: ["OTP_REQUIRED", "CORE_UNAVAILABLE", "ACCOUNT_NOT_FOUND", "SAME_ACCOUNT", "ACCOUNT_CANNOT_DEBIT", "CURRENCY_MISMATCH", "INVALID_AMOUNT", "INSUFFICIENT_FUNDS"],
  },
  {
    adapter: "bank.fx.rate", suggestedId: "fxRate", description: "The exchange rate between two currencies: the mid-market rate and the rate the customer gets after the bank's spread.",
    input: { from: "currency code, e.g. USD", to: "currency code, e.g. PKR" }, returns: "{ from, to, midRate, rate, spreadPercent }. Fails with CURRENCY_NOT_SUPPORTED for a pair the bank does not convert.",
  },
  {
    adapter: "bank.fx.quote", suggestedId: "fxQuote", description: "Prices converting an amount between two of the customer's own accounts in different currencies. The quote is valid for 30 seconds.",
    input: { fromAccountId: "account to debit", toAccountId: "account to credit", amount: "amount in the debit account's currency (or in the credit account's, with direction 'get')", direction: "optional: 'send' (default) or 'get', when the amount is what the person receives; the amount sent is then rounded up to the next cent", feeWaived: "optional: true when the bank does not charge the conversion fee" },
    returns: "{ quoteId, from: { currency, amount }, to: { currency, amount }, midRate, rate, fee, feeCurrency, total, expiresAt, ttlSeconds }. Save as ctx.quote. A BankWorkx customer gets the mid-market rate with no margin; a renewed quote of the same pair can move up to 0.04%. Errors: SAME_CURRENCY, INVALID_AMOUNT, INSUFFICIENT_FUNDS, CURRENCY_NOT_SUPPORTED, ACCOUNT_NOT_FOUND, ACCOUNT_CANNOT_DEBIT.",
  },
  {
    adapter: "bank.fx.convert", suggestedId: "fxConvert", description: "Carries out a quote after the one-time code: debits the amount plus the fee and credits the converted amount.",
    input: { quoteId: "from the quote" }, returns: "{ reference, from: { currency, newBalance }, to: { currency, newBalance }, quoteId }. Errors: OTP_REQUIRED, QUOTE_EXPIRED (get a new quote), QUOTE_USED, QUOTE_NOT_FOUND, INSUFFICIENT_FUNDS.",
  },
  {
    adapter: "corp.users.list", suggestedId: "companyUsers", description: "The people of the company, to choose who is acting in the sandbox (a real app knows who signed in).",
    input: {}, returns: "Object keyed by user id: { id, name, sub: roles }. Save as ctx.people and use it as a select source.",
  },
  {
    adapter: "corp.company.get", suggestedId: "company", description: "The company the signed-in user works for: accounts, approved beneficiaries, users and roles, the user's own remaining daily limit, the company's limit, the approval rule and the cut-off time.",
    input: { userId: "who is acting: sara, omar (initiators), hassan, layla (approvers), nadia (both)" }, returns: "{ id, name, currency, accounts, beneficiaries, users, me: { roles, dailyLimit, usedToday, remainingToday }, companyDailyLimit, companyUsedToday, dualApprovalAbove, cutoff }. Save as ctx.company.",
  },
  {
    adapter: "corp.payments.initiate", suggestedId: "initiatePayment", description: "Starts a payment that must be approved before it is released. Needs the one-time code first.",
    input: { userId: "an initiator", fromAccountId: "company account", beneficiaryId: "an approved beneficiary", amount: "in the account's currency", reference: "optional text" },
    returns: "The payment: { id, status 'pending_approval', required (1 or 2 approvers), valueDate, afterCutoff, … }. Errors: OTP_REQUIRED, NOT_AUTHORISED, BENEFICIARY_NOT_WHITELISTED, INVALID_AMOUNT, CURRENCY_NOT_SUPPORTED, INSUFFICIENT_FUNDS, LIMIT_USER_EXCEEDED, LIMIT_COMPANY_EXCEEDED.",
  },
  {
    adapter: "corp.bulk.check", suggestedId: "checkBulk", description: "Checks a bulk payment file (rows of `beneficiary,amount,reference`, an optional header row) without starting anything: which rows would be paid and which not, and why. Each row is checked for the approved list, a valid amount and duplicates.",
    input: { userId: "the initiator", fromAccountId: "the company account to pay from", file: "the text of the file, as the person pasted it" },
    returns: "{ lines (object keyed by row number: n, payee, amount, reference, ok, code, message), problems (only the rows that fail, same shape; use as a list source), validCount, invalidCount, total (of the rows that pass), requiredApprovers (1 or 2), currency }. Errors: NOT_AUTHORISED, ACCOUNT_NOT_FOUND, EMPTY_BATCH, BATCH_TOO_LARGE (over 50 rows).",
  },
  {
    adapter: "corp.bulk.submit", suggestedId: "submitBulk", description: "Starts ONE bulk payment of the rows that pass the checks (the failing rows are left out) and sends it for approval as one. The total counts against the person's and the company's daily limits. Moves no money until it is approved. Needs the one-time code first.",
    input: { userId: "the initiator", fromAccountId: "the account to pay from", file: "the same file text that was checked", reference: "optional label for the whole file" },
    returns: "The payment (payee shows '3 payments'; lines lists what it pays), 'pending_approval'. Errors: OTP_REQUIRED, NOT_AUTHORISED, NO_VALID_LINES, EMPTY_BATCH, BATCH_TOO_LARGE, INSUFFICIENT_FUNDS, LIMIT_USER_EXCEEDED, LIMIT_COMPANY_EXCEEDED, CURRENCY_NOT_SUPPORTED. Approve, reject and withdraw it with the corp.payments.* adapters like any payment.",
  },
  {
    adapter: "corp.payroll.check", suggestedId: "checkPayroll", description: "Checks a payroll file for one pay period (rows of `employee,amount,reference`, an optional header row) without starting anything. Each row must be an employee on the payroll register, paid once, with a valid amount of at most 1.5 times their monthly salary. The whole run fails when the period is not a month (YYYY-MM, not later than this month) or payroll for it has already been started.",
    input: { userId: "the initiator", fromAccountId: "the company account to pay from", period: "the pay period, YYYY-MM", file: "the text of the file, as the person pasted it" },
    returns: "{ lines (object keyed by row number: n, payee, amount, reference, ok, code, message), problems (only the rows that fail), validCount, invalidCount, total, requiredApprovers (always 2), period, currency }. Errors: NOT_AUTHORISED, ACCOUNT_NOT_FOUND, INVALID_PERIOD, PAYROLL_ALREADY_RUN, EMPTY_BATCH, BATCH_TOO_LARGE. Row codes: NOT_AN_EMPLOYEE, INVALID_AMOUNT, ABOVE_SALARY_CAP, DUPLICATE_LINE.",
  },
  {
    adapter: "corp.payroll.submit", suggestedId: "submitPayroll", description: "Starts ONE payroll run of the rows that pass the checks and sends it for approval. A payroll run always needs two different approvers. Counts against the person's and the company's daily limits. Moves no money until approved. Needs the one-time code first. Withdraw, reject and approve it with corp.payments.*; withdrawing or rejecting frees the period for a new run.",
    input: { userId: "the initiator", fromAccountId: "the account to pay from", period: "the pay period, YYYY-MM", file: "the same file text that was checked" },
    returns: "The payment (payee shows 'Payroll 2026-10 · 3 employees'; period; lines lists the employees), 'pending_approval' with required 2. Errors: OTP_REQUIRED, NOT_AUTHORISED, INVALID_PERIOD, PAYROLL_ALREADY_RUN, NO_VALID_LINES, INSUFFICIENT_FUNDS, LIMIT_USER_EXCEEDED, LIMIT_COMPANY_EXCEEDED, CURRENCY_NOT_SUPPORTED.",
  },
  {
    adapter: "corp.payments.approve", suggestedId: "approvePayment", description: "Approves a pending payment. The last approval releases it: the money moves. Needs the one-time code first.",
    input: { userId: "an approver other than the one who started it", paymentId: "from corp.payments.pending" },
    returns: "The payment, 'released' (with releaseReference) or still 'pending_approval' when a second approver is needed. Errors: OTP_REQUIRED, NOT_AUTHORISED, SELF_APPROVAL, ALREADY_APPROVED, PAYMENT_NOT_PENDING, PAYMENT_NOT_FOUND, INSUFFICIENT_FUNDS, LIMIT_COMPANY_EXCEEDED.",
  },
  {
    adapter: "corp.payments.reject", suggestedId: "rejectPayment", description: "An approver rejects a pending payment, with a reason. The initiator's daily limit is given back. (The person who started it uses corp.payments.withdraw.)",
    input: { userId: "an approver other than the one who started it", paymentId: "from corp.payments.pending", reason: "optional text" }, returns: "The payment, 'rejected'. Errors: NOT_AUTHORISED, PAYMENT_NOT_PENDING, PAYMENT_NOT_FOUND.",
  },
  {
    adapter: "corp.payments.withdraw", suggestedId: "withdrawPayment", description: "The person who started a payment takes it back while it waits for approval. Only them; their daily limit is given back. Moves no money.",
    input: { userId: "the initiator who started it", paymentId: "from corp.payments.pending with as: 'initiator'" }, returns: "The payment, 'rejected' with reason 'Withdrawn by the person who started it'. Errors: NOT_AUTHORISED (not theirs), PAYMENT_NOT_PENDING, PAYMENT_NOT_FOUND.",
  },
  {
    adapter: "corp.payments.get", suggestedId: "getPayment", description: "One payment by id: status, amounts, who started it, who approved, value date, release reference or rejection reason.",
    input: { paymentId: "the payment's id" }, returns: "The payment. Error: PAYMENT_NOT_FOUND.",
  },
  {
    adapter: "corp.payments.pending", suggestedId: "pendingPayments", description: "The pending payments a person can act on: an approver sees what waits for them (not their own, not ones they approved); anyone sees what they started.",
    input: { userId: "who is asking", as: "optional: 'approver' (default for approvers) or 'initiator'" }, returns: "Object keyed by payment id. Save as ctx.pending and use it as a list source.",
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
    adapter: "bank.transfers.create", suggestedId: "transfer", description: "Sends money to a saved beneficiary. A payee added in the last 24 hours may only be sent 500.00 USD (or the same value in the account's currency) in total in any 24 hours.",
    input: { fromAccountId: "account id", beneficiaryId: "beneficiary id", amount: "number (PKR)", purpose: "text" },
    returns: "{ reference, newBalance }", moneyMoving: true, requiresOtp: true,
    errors: ["OTP_REQUIRED", "CORE_UNAVAILABLE", "ACCOUNT_NOT_FOUND", "INSUFFICIENT_FUNDS", "LIMIT_EXCEEDED", "BENEFICIARY_COOLING_OFF"],
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
    // a customer with the most payees the bank allows is described, not listed
    beneficiaries: p.beneficiaries.length > 10 ? [`${p.beneficiaries.length} saved payees (${p.beneficiaries[0]!.id} to ${p.beneficiaries.at(-1)!.id})`] : p.beneficiaries.map((b) => `${b.id}: ${b.displayName}`),
    limits: p.limits,
    behaviour: p.behaviour.transferFails ? "Money-moving calls fail with CORE_UNAVAILABLE after a correct OTP." : p.behaviour.kyc === "rejected" ? "KYC rejected: no accounts, so money-moving journeys cannot start." : "Everything works.",
  }));
}
