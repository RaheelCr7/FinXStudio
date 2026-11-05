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
    input: { homeOnly: "optional, true: only accounts that can pay someone else" }, returns: "Object map keyed by account id: { id, name, maskedNumber, iban, balance, currency, status, canDebit }. Save as ctx.accounts and use with accountPicker.",
  },
  {
    adapter: "bank.beneficiaries.list", suggestedId: "beneficiaries", description: "Saved payees. One added in the last 24 hours is new and may only be sent 500.00 USD in any 24 hours.",
    input: { sendType: "optional: internal | domestic | international, only payees of that kind" }, returns: "Object map keyed by beneficiary id: { id, displayName, bank, maskedNumber, addedAt, ageHours, sendType } and, for payees saved with bank.payees.save: kind (internal | domestic | international), region (bw | us | eu | uk | me | world), country, nickname, label, verified, nameCheck, coolingOffUntil (ISO or null), coolingOffHoursLeft, allowanceLeft (USD, null when not new), scheduledCount, scheduledText. Save as ctx.beneficiaries.",
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
    adapter: "bank.payees.lookup", suggestedId: "lookup", description: "Finds a BankWorkx customer by mobile number, email or BankWorkx ID. No code needed.",
    input: { by: "mobile | email | id", value: "what was typed" },
    returns: "{ name, customerNumber, maskedAccount, currency, key }; key goes to bank.payments.quote.", errors: ["CUSTOMER_NOT_FOUND", "BENEFICIARY_EXISTS"],
  },
  {
    adapter: "bank.payments.quote", suggestedId: "quote", description: "Prices and checks a payment to someone else (BankWorkx customer, home-market bank, or abroad): speeds with arrival, limit and fee, the rate (held 60 s), the total, every bank rule. Home-currency accounts only. Nothing moves.",
    input: { fromAccountId: "home-currency account", payeeId: "a saved payee; or sendType (internal | domestic | international), currency, country, payeeName, payeeKey (from validate or lookup)", receiveAmount: "what the payee gets, in their currency", speed: "optional: standard | sameDay | instant | priority (default: first that fits)", standard: "false if the bank does not offer it (also sameDay, instant); priority only when true", chargeChoice: "true if the customer may pick who pays charges", chargeBearer: "shared | ours | theirs", coolingOff: "false if the bank switched the new-payee limit off", purpose: "abroad: Family support | Goods or services | Salary | Rent | Education | Savings or investment | Other", street: "abroad, when ADDRESS_REQUIRED", city: "as street", relationship: "as street: Myself | Family member | Friend | My employer | Supplier or business | Landlord | School or university | Other" },
    returns: "{ quoteId, type, speed, speedName, arrives, speeds (map: { id, name, sub, usable }), receive { currency, amount }, rate, converted, pay, fee, feeText, total, currency, expiresAt, sendDates (map: { id, name }) }. Save as ctx.quote.",
    errors: ["ACCOUNT_CANNOT_DEBIT", "PAYEE_NOT_CHECKED", "INVALID_AMOUNT", "RAIL_NOT_AVAILABLE", "RAIL_LIMIT", "INSUFFICIENT_FUNDS", "DAILY_LIMIT_EXCEEDED", "BENEFICIARY_COOLING_OFF", "PURPOSE_REQUIRED", "ADDRESS_REQUIRED"],
  },
  {
    adapter: "bank.payments.create", suggestedId: "pay", description: "Pays a quote after the one-time code, checking the rules again. A payee named \"Test Sanctions\" is held (nothing moves). when: later only sets it up. save: true also saves a payee typed in the payment (new for 24 hours).",
    input: { quoteId: "from bank.payments.quote", when: "now | later", sendOn: "later: a date of sendDates", repeat: "later: none | weekly | monthly", save: "true to save a typed payee (with the fields of bank.payees.validate)", reference: "optional" },
    returns: "{ reference, railReference, status (settled | processing | scheduled | held), speed, speedName, arrives, receive, rate, pay, fee, total, currency, payeeId, payeeName, newBalance }",
    moneyMoving: true, requiresOtp: true,
    errors: ["OTP_REQUIRED", "CORE_UNAVAILABLE", "QUOTE_EXPIRED", "INSUFFICIENT_FUNDS", "DAILY_LIMIT_EXCEEDED", "BENEFICIARY_COOLING_OFF", "INVALID_DATE", "BENEFICIARY_EXISTS"],
  },
  {
    adapter: "bank.schedules.list", suggestedId: "schedules", description: "Payments set up to go later or repeat. BankWorkx: with status (live, active, paused, history) the schedules of schedule-payment, soonest first.",
    input: { status: "optional" }, returns: "Map by id: { id, beneficiaryId, name, text }; with status also sub, nextText, amountText, remainingRuns, running.",
  },
  {
    adapter: "bank.schedules.get", suggestedId: "scheduleGet", description: "BankWorkx: one schedule. With for: change or cancel it fails if that cannot be done now.",
    input: { scheduleId: "id", for: "optional: change | cancel" }, returns: "The list entry plus canSkip, afterText, endType, endOn, endLeft.",
    errors: ["SCHEDULE_NOT_FOUND", "SCHEDULE_NOT_ACTIVE", "SCHEDULE_RUNNING", "SCHEDULE_CUTOFF_PASSED"],
  },
  {
    adapter: "bank.schedules.check", suggestedId: "scheduleCheck", description: "BankWorkx: checks a new schedule, or a change (scheduleId), before the code. Changes nothing.",
    input: { kind: "payee | own | bill", target: "payee, account or saved biller id", from: "account id", amount: "number", amountMode: "bill: fixed | full | minimum", frequency: "once | weekly | biweekly | monthly | quarterly", first: "YYYY-MM-DD", endType: "never | date | count", endOn: "date", endCount: "number" },
    returns: "{ targetName, amountText, frequencyName, startText, endsText, nextDates, dates, maxCount }",
    errors: ["BENEFICIARY_NOT_FOUND", "SAME_ACCOUNT", "INVALID_AMOUNT", "DAILY_LIMIT_EXCEEDED", "DATE_TOO_SOON", "DATE_TOO_FAR", "DATE_NOT_WEEKDAY", "END_BEFORE_START", "INVALID_COUNT", "BENEFICIARY_COOLING_OFF", "SCHEDULE_LIMIT"],
  },
  {
    adapter: "bank.schedules.create", suggestedId: "scheduleCreate", description: "BankWorkx: makes the schedule; nothing is taken until each date. Input of check.",
    input: {}, returns: "{ scheduleId, ...check }", moneyMoving: true, requiresOtp: true, errors: ["OTP_REQUIRED", "CORE_UNAVAILABLE"],
  },
  {
    adapter: "bank.schedules.update", suggestedId: "scheduleUpdate", description: "BankWorkx: changes amount, next date or end, never the payee. Input of check and scheduleId.",
    input: {}, returns: "{ scheduleId, ...check }", moneyMoving: true, requiresOtp: true, errors: ["OTP_REQUIRED", "CORE_UNAVAILABLE", "SCHEDULE_NOT_ACTIVE", "SCHEDULE_RUNNING", "SCHEDULE_CUTOFF_PASSED"],
  },
  {
    adapter: "bank.schedules.cancel", suggestedId: "scheduleCancel", description: "BankWorkx: ends a schedule, or skips only the next payment. No code.",
    input: { scheduleId: "id", scope: "all | next" }, returns: "{ status: cancelled | skipped, name, amountText, next }", errors: ["SCHEDULE_NOT_FOUND", "SCHEDULE_NOT_ACTIVE", "SCHEDULE_RUNNING", "SCHEDULE_CUTOFF_PASSED"],
  },
  {
    adapter: "bank.schedules.runDue", suggestedId: "scheduleRun", description: "Scenarios only: moves the clock to the date and makes what is due.",
    input: { date: "YYYY-MM-DD" }, returns: "Map of { status: paid | skipped | retry, reason }",
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
    adapter: "bank.transfers.own", suggestedId: "transferOwn", description: "Moves money between two of the customer's own accounts in the same currency: instant, no fee, not counted against the daily limit. Needs the one-time code first. Other currencies: bank.fx.quote and bank.fx.convert.",
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
    adapter: "corp.bulk.check", suggestedId: "checkBulk", description: "Checks a bulk file (rows `beneficiary,amount,reference`, optional header) without starting anything: which rows would be paid, and why not (approved list, amount, duplicates).",
    input: { userId: "the initiator", fromAccountId: "the company account to pay from", file: "the text of the file, as the person pasted it" },
    returns: "{ lines (object keyed by row number: n, payee, amount, reference, ok, code, message), problems (only the rows that fail, same shape; use as a list source), validCount, invalidCount, total (of the rows that pass), requiredApprovers (1 or 2), currency }. Errors: NOT_AUTHORISED, ACCOUNT_NOT_FOUND, EMPTY_BATCH, BATCH_TOO_LARGE (over 50 rows).",
  },
  {
    adapter: "corp.bulk.submit", suggestedId: "submitBulk", description: "Starts ONE bulk payment of the rows that pass the checks (failing rows are left out) and sends it for approval as one. The total counts against the daily limits; moves no money until approved. Needs the one-time code first.",
    input: { userId: "the initiator", fromAccountId: "the account to pay from", file: "the same file text that was checked", reference: "optional label for the whole file" },
    returns: "The payment (payee shows '3 payments'; lines lists what it pays), 'pending_approval'. Errors: OTP_REQUIRED, NOT_AUTHORISED, NO_VALID_LINES, EMPTY_BATCH, BATCH_TOO_LARGE, INSUFFICIENT_FUNDS, LIMIT_USER_EXCEEDED, LIMIT_COMPANY_EXCEEDED, CURRENCY_NOT_SUPPORTED.",
  },
  {
    adapter: "corp.payroll.check", suggestedId: "checkPayroll", description: "Checks a payroll file for one pay period (rows `employee,amount,reference`, optional header) without starting anything. Each row: an employee on the register, paid once, at most 1.5 times their monthly salary. The run fails when the period is not a past or current month (YYYY-MM) or was already run.",
    input: { userId: "the initiator", fromAccountId: "the company account to pay from", period: "the pay period, YYYY-MM", file: "the text of the file, as the person pasted it" },
    returns: "{ lines (object keyed by row number: n, payee, amount, reference, ok, code, message), problems (only the rows that fail), validCount, invalidCount, total, requiredApprovers (always 2), period, currency }. Errors: NOT_AUTHORISED, ACCOUNT_NOT_FOUND, INVALID_PERIOD, PAYROLL_ALREADY_RUN, EMPTY_BATCH, BATCH_TOO_LARGE. Row codes: NOT_AN_EMPLOYEE, INVALID_AMOUNT, ABOVE_SALARY_CAP, DUPLICATE_LINE.",
  },
  {
    adapter: "corp.payroll.submit", suggestedId: "submitPayroll", description: "Starts ONE payroll run of the rows that pass the checks and sends it for approval by two different approvers. Counts against the daily limits; moves no money until approved. Needs the one-time code first. Withdrawing or rejecting it frees the period.",
    input: { userId: "the initiator", fromAccountId: "the account to pay from", period: "the pay period, YYYY-MM", file: "the same file text that was checked" },
    returns: "The payment (payee shows 'Payroll 2026-10 · 3 employees'; period; lines lists the employees), 'pending_approval' with required 2. Errors: OTP_REQUIRED, NOT_AUTHORISED, INVALID_PERIOD, PAYROLL_ALREADY_RUN, NO_VALID_LINES, INSUFFICIENT_FUNDS, LIMIT_USER_EXCEEDED, LIMIT_COMPANY_EXCEEDED, CURRENCY_NOT_SUPPORTED.",
  },
  {
    adapter: "corp.payments.approve", suggestedId: "approvePayment", description: "Approves a pending payment. The last approval releases it: the money moves. Needs the one-time code first.",
    input: { userId: "an approver other than the one who started it", paymentId: "from corp.payments.pending", acknowledged: "true once the person checked a flagged payee name" },
    returns: "The payment, 'released' (with releaseReference) or still 'pending_approval' when a second approver is needed. Errors: OTP_REQUIRED, NOT_AUTHORISED, SELF_APPROVAL, ALREADY_APPROVED, OUT_OF_SEQUENCE, DELEGATED, APPROVAL_EXPIRED, NAME_CHECK_NOT_CONFIRMED, PAYMENT_NOT_PENDING, INSUFFICIENT_FUNDS, LIMIT_COMPANY_EXCEEDED.",
  },
  {
    adapter: "corp.payments.reject", suggestedId: "rejectPayment", description: "An approver rejects a pending payment, with a reason. The initiator's daily limit is given back. The person who started the payment cannot reject it (NOT_AUTHORISED): they use corp.payments.withdraw.",
    input: { userId: "an approver other than the one who started it", paymentId: "from corp.payments.pending", reason: "optional text" }, returns: "The payment, 'rejected'. Errors: NOT_AUTHORISED, PAYMENT_NOT_PENDING, PAYMENT_NOT_FOUND, PERMISSION_DENIED.",
  },
  {
    adapter: "corp.payments.withdraw", suggestedId: "withdrawPayment", description: "The person who started a payment takes it back while it waits for approval. Only them; their daily limit is given back. Moves no money.",
    input: { userId: "the initiator who started it", paymentId: "from corp.payments.pending with as: 'initiator'" }, returns: "The payment, 'rejected' with reason 'Withdrawn by the person who started it'. Errors: NOT_AUTHORISED (not theirs), PAYMENT_NOT_PENDING, PAYMENT_NOT_FOUND.",
  },
  {
    adapter: "corp.payments.get", suggestedId: "getPayment", description: "One payment by id: status, amounts, who started it, who approved, value date, release reference or rejection reason. With a session, the context must allow viewing accounts (PERMISSION_DENIED); with a userId, that user must work for the company (NOT_AUTHORISED).",
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
    adapter: "bank.otp.verify", suggestedId: "otpVerify", description: "Checks the code. Must succeed before any money-moving call. strict: true (also on send) for a signed-in customer's own change: 000000 wrong, 999999 expired, 3 wrong end it.",
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
    adapter: "bank.billers.list", suggestedId: "billers", description: "Billers the customer can pay. BankWorkx: the bank's directory.",
    input: { category: "BankWorkx", q: "BankWorkx" }, returns: "Object map keyed by biller id: { id, name, category } (BankWorkx adds label, format, accepts, fee). Save as ctx.billers; use as a block source.",
  },
  {
    adapter: "bank.bills.saved", suggestedId: "savedBillers", description: "BankWorkx: saved billers; billerId and reference save one.",
    input: { q: "optional", category: "optional", billerId: "save", reference: "save" }, returns: "Map by id: { id, nickname, billerId, billerName, category, label, format, accepts, fee, reference, last4 }",
  },
  {
    adapter: "bank.bills.quote", suggestedId: "billQuote", description: "BankWorkx: prices and checks a bill payment. Pays nothing.",
    input: { billerId: "biller id", reference: "as typed", choice: "full | min | other", amount: "for other", fromAccountId: "account id", fetched: "false: no lookup", allowCrossCurrency: "false: same currency only" },
    returns: "{ amount, fee, rate, youPay, due, changed, lateFee, autopayOk, saved }",
    errors: ["BILL_ALREADY_PAID", "AMOUNT_BELOW_MINIMUM", "AMOUNT_ABOVE_DUE", "INSUFFICIENT_FUNDS", "DAILY_LIMIT_EXCEEDED", "BILL_CURRENCY_MISMATCH"],
  },
  {
    adapter: "bank.bills.lookup", suggestedId: "billLookup", description: "Finds a bill by biller and consumer number.",
    input: { billerId: "biller id", reference: "consumer number, 10 to 14 digits" },
    returns: "{ billerName, reference, payerName, amount, dueDate }; BankWorkx: { billerName, label, due, min, max, dateText, late, lateFee, choices }", errors: ["BILL_NOT_FOUND", "BILLER_NOT_FOUND", "BILL_ALREADY_PAID", "NO_AMOUNT_DUE", "BILLER_UNAVAILABLE"],
  },
  {
    adapter: "bank.bills.pay", suggestedId: "billPay", description: "Pays a bill from an account.",
    input: { fromAccountId: "account id", amount: "number (PKR)", billerId: "optional", reference: "optional", due: "BankWorkx: amount due seen", save: "BankWorkx", autopay: "BankWorkx" },
    returns: "{ reference, newBalance }; BankWorkx adds paid, left, youPay, nextAutopay", moneyMoving: true, requiresOtp: true,
    errors: ["OTP_REQUIRED", "CORE_UNAVAILABLE", "ACCOUNT_NOT_FOUND", "INSUFFICIENT_FUNDS", "LIMIT_EXCEEDED", "BILL_CHANGED"],
  },
  {
    adapter: "bank.carriers.list", suggestedId: "carriers", description: "Mobile carriers (Jazz, Zong, Telenor, Ufone). BankWorkx: operators.",
    input: {}, returns: "Object map keyed by carrier id: { id, name }. Save as ctx.carriers and use with a select block (source). BankWorkx adds amounts.",
  },
  {
    adapter: "bank.topup.amounts", suggestedId: "amounts", description: "BankWorkx: an operator's fixed amounts.",
    input: { operatorId: "operator id" }, returns: "Map keyed by amount: { id, amount, name }", errors: ["OPERATOR_NOT_FOUND"],
  },
  {
    adapter: "bank.topup.numbers", suggestedId: "savedNumbers", description: "BankWorkx: saved numbers of an operator that fit the market.",
    input: { operatorId: "optional", market: "A to D, default A" }, returns: "Map keyed by id: { id, name, number, last4, sub }", errors: ["OPERATOR_NOT_FOUND"],
  },
  {
    adapter: "bank.topup.check", suggestedId: "checkNumber", description: "BankWorkx: checks a top-up before the code. Changes nothing.",
    input: { operatorId: "id", number: "text", market: "A to D", amount: "number", fromAccountId: "account id" }, returns: "{ ok, last4, saved }",
    errors: ["INVALID_AMOUNT", "NUMBER_INVALID", "NUMBER_NOT_FOUND", "OPERATOR_UNAVAILABLE", "TOPUP_LIMIT", "INSUFFICIENT_FUNDS", "LIMIT_EXCEEDED"],
  },
  {
    adapter: "bank.topup.create", suggestedId: "topup", description: "Mobile top-up from an account. Meezan: 50 to 5,000 PKR. BankWorkx: an operator's amount, up to $300.00 a day to a number.",
    input: { fromAccountId: "account id", amount: "number", carrier: "optional carrier id", mobile: "optional mobile number", operatorId: "BankWorkx", number: "BankWorkx", market: "BankWorkx", save: "BankWorkx", name: "BankWorkx" },
    returns: "{ reference, newBalance }; BankWorkx adds last4, date, saved", moneyMoving: true, requiresOtp: true,
    errors: ["OTP_REQUIRED", "CORE_UNAVAILABLE", "INVALID_AMOUNT", "ACCOUNT_NOT_FOUND", "INSUFFICIENT_FUNDS", "LIMIT_EXCEEDED", "TOPUP_LIMIT"],
  },
  {
    adapter: "bank.activity.list", suggestedId: "activity", description: "BankWorkx: recent activity.",
    input: {}, returns: "Map keyed by id: { id, title, category, amount }",
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
  // ---- One login, several places: session and context (BankWorkx combined demo) ----
  {
    adapter: "bank.session.get", suggestedId: "session", description: "Who is signed in and the places they bank from (their own accounts, each company they act for), with each place's permissions. Only for a customer who acts for companies.",
    input: {}, returns: "{ identity, activeContextId, contexts: [{ id, label, workspace 'personal'|'business', companyId?, roles, permissions (biz.payments.initiate …), limits }], stepUpUntil?, expiresAt }.",
    errors: ["SESSION_EXPIRED", "NOT_SUPPORTED"],
  },
  {
    adapter: "bank.session.switch", suggestedId: "switchContext", description: "Makes another place active. A company needs a step-up in the last 5 minutes; going back to personal does not. A verified code does not carry over.",
    input: { contextId: "personal, alpha or beta" }, returns: "The new context as in bank.session.get, plus auditId.", errors: ["STEP_UP_REQUIRED", "PERMISSION_DENIED", "SESSION_EXPIRED"],
  },
  {
    adapter: "bank.session.stepUp", suggestedId: "stepUp", description: "Confirms it is the customer: password (or biometric), then the one-time code; valid 5 minutes. A right password is remembered while the code is entered, so call again without the secret.",
    input: { method: "'password' or 'biometric'", secret: "the password" }, returns: "{ stepUpUntil }", requiresOtp: true, errors: ["STEP_UP_FAILED", "OTP_REQUIRED", "SESSION_EXPIRED"],
  },
  {
    adapter: "bank.app.config", suggestedId: "appConfig", description: "How the bank is set up: home market (decides the rails behind Standard, Same day, Instant), journeys it switched off (a call made for one is JOURNEY_DISABLED), options per journey.",
    input: {}, returns: "{ homeMarket 'us'|'uk'|'eu'|'ae'|'sa'|'jo', disabled: [slug], options: { slug: {…} } }",
  },
  {
    adapter: "corp.payments.quote", suggestedId: "quoteSupplierPayment", description: "Prices a payment to an approved supplier in its currency: conversion, fee, speed, approvers needed, whether a code is asked (from the company threshold). Purpose and reference always required. Moves nothing.",
    input: { fromAccountId: "company account", beneficiaryId: "approved supplier", amount: "what the supplier receives", speed: "optional speed", chargeBearer: "optional 'ours'", purpose: "required", reference: "required (invoice or PO)" },
    returns: "{ quoteId, expiresAt, type, speed, arrives, receive, rate, pay, fee, total, currency, speeds, requiredApprovers, codeRequired }. Save as ctx.quote.",
    errors: ["PERMISSION_DENIED", "ACCOUNT_NOT_FOUND", "BENEFICIARY_NOT_WHITELISTED", "CURRENCY_NOT_SUPPORTED", "INVALID_AMOUNT", "PURPOSE_REQUIRED", "REFERENCE_REQUIRED", "REFERENCE_TOO_LONG", "RAIL_LIMIT", "RAIL_NOT_AVAILABLE", "INSUFFICIENT_FUNDS", "LIMIT_USER_EXCEEDED", "LIMIT_COMPANY_EXCEEDED"],
  },
  {
    adapter: "corp.payments.create", suggestedId: "createSupplierPayment", description: "Starts the payment a quote priced; it waits for approval. A code is asked only from the company threshold (25,000 for Alpha and Beta).",
    input: { quoteId: "from corp.payments.quote" }, returns: "The payment: { id, status 'pending_approval', required, rail, speed, receive, rate, fee, purpose, railReference, … }.", moneyMoving: true, requiresOtp: true,
    errors: ["PERMISSION_DENIED", "QUOTE_NOT_FOUND", "QUOTE_USED", "QUOTE_EXPIRED", "RAIL_NOT_AVAILABLE", "OTP_REQUIRED", "STEP_UP_FAILED", "LIMIT_USER_EXCEEDED", "LIMIT_COMPANY_EXCEEDED", "INSUFFICIENT_FUNDS"],
  },
  { adapter: "corp.suppliers.list", suggestedId: "suppliers", description: "The company's approved suppliers.", input: {}, returns: "Map by id: { id, name, displayName, line, bank, maskedNumber, country?, currency? }.", errors: ["PERMISSION_DENIED"] },
  { adapter: "corp.templates.list", suggestedId: "templates", description: "Saved payment templates.", input: {}, returns: "Map by id: { id, name, beneficiaryId, amount?, reference, purpose }.", errors: ["PERMISSION_DENIED"] },
  {
    adapter: "corp.payments.list", suggestedId: "paymentsList", description: "Payments for an approvals inbox, each as the signed-in person sees it (you, statusKey, note, signatories, nameResult, cutoffText, delegates).",
    input: { status: "'pending' | 'ready' (approvable together) | 'history'" }, returns: "Map by payment id.",
  },
  {
    adapter: "corp.payments.approveMany", suggestedId: "approveMany", description: "Approves several waiting payments with ONE code, all or none (NOT_FOR_BATCH if one has a name check).",
    input: { paymentIds: "ids" }, returns: "{ count, released, total, currency, payments }.", moneyMoving: true, requiresOtp: true,
    errors: ["PERMISSION_DENIED", "OTP_REQUIRED", "NOT_FOR_BATCH", "SELF_APPROVAL", "OUT_OF_SEQUENCE", "APPROVAL_EXPIRED", "INSUFFICIENT_FUNDS"],
  },
  {
    adapter: "corp.payments.delegate", suggestedId: "delegatePayment", description: "An approver passes a waiting payment to another, who alone can then approve it.",
    input: { paymentId: "id", toUserId: "an approver" }, returns: "The payment with passedTo.", errors: ["DELEGATE_CONFLICT", "DELEGATE_ALREADY_APPROVED", "PERMISSION_DENIED"],
  },
  { adapter: "corp.signatories.list", suggestedId: "signatories", description: "Signatory groups: who approves, in order (sequential) or any order (parallel), above which amount.", input: {}, returns: "Map by id: { id, name, mode, members, required, above }.", errors: ["PERMISSION_DENIED"] },
  { adapter: "corp.audit.list", suggestedId: "audit", description: "The audit trail, newest first, including what this session did and was refused.", input: {}, returns: "Map by position: { id, at, userId, action, outcome 'Done'|'Refused' }.", errors: ["PERMISSION_DENIED"] },
  // ---- A retail customer's records (BankWorkx) ----
  { adapter: "bank.accounts.get", suggestedId: "account", description: "One account: ledger balance (balance), available balance (available), nickname.", input: { accountId: "id" }, returns: "The account.", errors: ["ACCOUNT_NOT_FOUND"] },
  { adapter: "bank.accounts.rename", suggestedId: "renameAccount", description: "Sets an account nickname (1 to 30 characters).", input: { accountId: "id", nickname: "text" }, returns: "{ accountId, nickname }", errors: ["ACCOUNT_NOT_FOUND", "INVALID_NICKNAME"] },
  {
    adapter: "bank.transactions.list", suggestedId: "transactions", description: "Account transactions, newest first. A pending item lowers the available balance, not yet the ledger balance.",
    input: { accountId: "optional", from: "YYYY-MM-DD", to: "YYYY-MM-DD", direction: "'in'|'out'", category: "text", status: "'posted'|'pending'", q: "text in the title", minAmount: "number", maxAmount: "number", limit: "number" },
    returns: "Map by id: { id, accountId, date, title, category, amount (negative is out), currency, status, reference? }.", errors: ["ACCOUNT_NOT_FOUND", "NOT_SUPPORTED"],
  },
  { adapter: "bank.statements.get", suggestedId: "statement", description: "A statement for an account and period: opening, closing, totals, posted transactions.", input: { accountId: "id", from: "YYYY-MM-DD", to: "YYYY-MM-DD" }, returns: "{ accountId, currency, from, to, opening, credits, debits, closing, count, transactions }", errors: ["ACCOUNT_NOT_FOUND", "INVALID_DATE", "NOT_SUPPORTED"] },
  { adapter: "bank.cards.issued", suggestedId: "issuedCards", description: "Debit and credit cards the bank issued (bank.cards.list is the saved cards).", input: {}, returns: "Map by id: { id, kind, network, last4, nickname, status 'inactive'|'active'|'frozen'|'blocked', accountId?, virtual, pinSet, limits, controls, creditLimit?, outstanding? }.", errors: ["NOT_SUPPORTED"] },
  { adapter: "bank.cards.get", suggestedId: "issuedCard", description: "One issued card.", input: { cardId: "id" }, returns: "The card.", errors: ["CARD_NOT_FOUND", "NOT_SUPPORTED"] },
  { adapter: "bank.deposits.list", suggestedId: "deposits", description: "Term deposits.", input: {}, returns: "Map by id: { id, name, principal, currency, ratePercent, termMonths, openedOn, maturesOn, status, autoRenew, accountId }.", errors: ["NOT_SUPPORTED"] },
  { adapter: "bank.goals.list", suggestedId: "goals", description: "Savings goals.", input: {}, returns: "Map by id: { id, name, target, saved, currency, targetDate, accountId }.", errors: ["NOT_SUPPORTED"] },
  { adapter: "bank.loans.list", suggestedId: "loans", description: "Loans, without their schedule.", input: {}, returns: "Map by id: { id, name, principal, outstanding, currency, ratePercent, monthlyPayment, nextDue }.", errors: ["NOT_SUPPORTED"] },
  { adapter: "bank.loans.get", suggestedId: "loan", description: "One loan with its schedule.", input: { loanId: "id" }, returns: "{ …loan, schedule: [{ n, due, principal, interest, balance }] }", errors: ["LOAN_NOT_FOUND", "NOT_SUPPORTED"] },
  { adapter: "bank.messages.list", suggestedId: "messages", description: "Secure messages.", input: {}, returns: "Map by id: { id, subject, from, at, read, body }.", errors: ["NOT_SUPPORTED"] },
  { adapter: "bank.notifications.list", suggestedId: "notifications", description: "Notifications, each tagged with its place (personal, or a company id).", input: { context: "optional" }, returns: "Map by id: { id, context, text, at, read }.", errors: ["NOT_SUPPORTED"] },
  { adapter: "bank.requests.list", suggestedId: "requests", description: "Service requests.", input: {}, returns: "Map by id: { id, type, summary, status, openedAt }.", errors: ["NOT_SUPPORTED"] },
  { adapter: "bank.profile.get", suggestedId: "profile", description: "The customer's profile.", input: {}, returns: "{ name, email, phone, dateOfBirth, customerSince, language, address }", errors: ["NOT_SUPPORTED"] },
  { adapter: "bank.applications.list", suggestedId: "applications", description: "Account applications, drafts included.", input: {}, returns: "Map by id: { id, status 'draft'|'submitted'|'in review'|'approved'|'declined'|'active', step, data, updatedAt, productId? }.", errors: ["NOT_SUPPORTED"] },
  { adapter: "bank.applications.get", suggestedId: "application", description: "One application, to resume it.", input: { applicationId: "id" }, returns: "The application.", errors: ["APPLICATION_NOT_FOUND", "NOT_SUPPORTED"] },
  { adapter: "bank.applications.save", suggestedId: "saveApplication", description: "Saves an application as a draft, or sends it (submit: true); a sent one cannot change.", input: { applicationId: "optional: new when absent", step: "screen to resume on", data: "answers so far", productId: "optional", submit: "optional" }, returns: "{ applicationId, status, step, updatedAt }", errors: ["APPLICATION_NOT_FOUND", "APPLICATION_LOCKED", "NOT_SUPPORTED"] },
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
  // ---- Signing in (BankWorkx): answers are data; a journey that runs before sign-in uses persona "signed-out". Security's adapters (devices, PIN, password change, history) are in docs/BANKWORKX.md ----
  {
    adapter: "bank.auth.signIn", suggestedId: "checkCredentials", description: "Checks a username and password; opens no session (finish with completeSignIn). Users: alex.morgan, sam.rivera, demo.locked, demo.expired, demo.inactive, new.user, device.limit. 5 wrong tries lock for 30 minutes.",
    input: { username: "text", password: "text" }, returns: "{ ok, status: ok | otp | change-password, firstName, maskedPhone, reason, deviceKnown } or { ok: false, code: INVALID_CREDENTIALS (attemptsLeft) | LOCKED | INACTIVE }",
  },
  {
    adapter: "bank.auth.quickSignIn", suggestedId: "quickSignIn", description: "A quick PIN, biometric or passkey on a device that remembers the person: no password, no code.",
    input: { method: "pin | biometric | passkey", pin: "6 digits" }, returns: "{ ok, status, firstName } or { ok: false, code: QUICK_PIN_INVALID | QUICK_OFF | LOCKED | PASSWORD_EXPIRED }",
  },
  {
    adapter: "bank.auth.changePassword", suggestedId: "changePassword", description: "The forced new password of a sign-in: 12 to 64 characters, not the username, common, breached or used before.",
    input: { newPassword: "text", confirm: "text" }, returns: "{ ok, changedAt } or { ok: false, code: MISMATCH | MIN_LENGTH | MAX_LENGTH | PASSWORD_CONTAINS_USERNAME | PASSWORD_COMMON | PASSWORD_BREACHED | PASSWORD_REUSED }",
  },
  {
    adapter: "bank.auth.trustDevice", suggestedId: "trustDevice", description: "Trusts this device for 90 days under a name; at most 5.", input: { name: "1 to 30 characters" },
    returns: "{ ok, expiresInDays } or { ok: false, code: NAME_REQUIRED | DEVICE_LIMIT }",
  },
  {
    adapter: "bank.auth.setQuickSignIn", suggestedId: "setQuickSignIn", description: "Turns quick sign-in on for this trusted device, or off. A PIN: 6 digits, no repeat or run, none of the phone number.",
    input: { method: "pin | biometric | passkey | off", pin: "6 digits" }, returns: "{ ok, method } or { ok: false, code: PIN_INVALID | PIN_WEAK | PIN_PHONE | DEVICE_NOT_TRUSTED }",
  },
  {
    adapter: "bank.auth.completeSignIn", suggestedId: "completeSignIn", description: "Opens the session once every step is done; the bank then serves the customer. remember keeps the username on this device.",
    input: { remember: "boolean" }, returns: "{ ok, username, firstName, how: password | password+code | quick-pin | quick-biometric, deviceTrusted, quick, passwordChanged, lastSignIn }",
  },
  {
    adapter: "bank.device.options", suggestedId: "signInDevice", description: "What this device remembers: whom to greet, the username, the default sign-in.", input: {},
    returns: "{ default, pinSet, biometricAvailable, firstName, username, trusted, quick }",
  },
  {
    adapter: "bank.recover.verifyUser", suggestedId: "findProfile", description: "Finds a profile: username or email (reset, unlock), or mobile or email with date of birth (forgot username). A miss never says what failed; the 3rd locks for 30 minutes.",
    input: { usernameOrEmail: "text", mobile: "text", email: "text", dateOfBirth: "YYYY-MM-DD" }, returns: "{ ok, recoveryToken (lives 10 minutes), maskedContact, maskedMobile } or { ok: false, code: NOT_FOUND | ID_LOCKED }",
  },
  {
    adapter: "bank.recover.sendUsername", suggestedId: "sendUsername", description: "Sends the username to the contact on file after the code; never in the answer.", input: { recoveryToken: "from findProfile" },
    returns: "{ sent, maskedContact }", requiresOtp: true,
  },
  {
    adapter: "bank.recover.resetPassword", suggestedId: "resetForgottenPassword", description: "Sets a new password after the code; clears any lock.", input: { recoveryToken: "from findProfile", password: "text", confirm: "text" },
    returns: "{ ok, changedOn, username } or { ok: false, code: as changePassword }", requiresOtp: true,
  },
  {
    adapter: "bank.recover.unlock", suggestedId: "unlockProfile", description: "Unlocks a profile after the code; the password stays.", input: { recoveryToken: "from findProfile" },
    returns: "{ ok, wasLocked, username }", requiresOtp: true,
  },
  {
    adapter: "bank.password.policy", suggestedId: "passwordPolicy", description: "The password rules as a list to tick off.", input: { password: "text", username: "text" },
    returns: "{ ok, problems, rules: [{ id, ok }] }",
  },
  {
    adapter: "bank.password.check", suggestedId: "checkPassword", description: "Checks the current password; 5 wrong lock (shared with sign-in). Needs a step-up.", input: { current: "text" },
    returns: "{ ok } | { ok: false, code: INVALID_PASSWORD (attemptsLeft) | ACCOUNT_LOCKED }",
  },
  {
    adapter: "bank.password.change", suggestedId: "changePassword", description: "Changes the password after bank.password.check, a step-up and a strict code.", input: { new: "text", confirm: "text", signOutOthers: "boolean" },
    returns: "{ ok, changedText, otherDevicesSignedOut } | { ok: false, code: PASSWORD_SAME | rules as sign-in }", requiresOtp: true,
  },
  {
    adapter: "bank.devices.list", suggestedId: "devices", description: "The trusted devices, this one first.", input: { scope: "optional: current | others" },
    returns: "{ max, count, others, items: [{ id, name, lastUsedText, current }] }",
  },
  {
    adapter: "bank.devices.remove", suggestedId: "removeDevice", description: "Removes a device, or every other one, after a step-up and a strict code; never this one.", input: { deviceId: "text", all: "true" },
    returns: "{ removed } | error DEVICE_NOT_FOUND | CURRENT_DEVICE", requiresOtp: true,
  },
  {
    adapter: "bank.devices.setQuickSignIn", suggestedId: "setQuickSignIn", description: "Quick sign-in on (step-up, strict code) or off (neither).", input: { method: "pin | biometric | passkey | off", pin: "6 digits" },
    returns: "{ ok, method, device } | { ok: false, code: PIN_* | DEVICE_NOT_TRUSTED }",
  },
  {
    adapter: "bank.devices.checkPin", suggestedId: "checkPin", description: "Would this PIN do? Changes nothing.", input: { pin: "6 digits" }, returns: "{ ok } | { ok: false, code: PIN_INVALID | PIN_WEAK | PIN_PHONE }",
  },
  {
    adapter: "bank.devices.verifyPin", suggestedId: "verifyPin", description: "Checks the quick PIN; the 3rd wrong turns quick sign-in off.", input: { pin: "6 digits" }, returns: "{ ok } | { ok: false, code: PIN_WRONG (triesLeft) | PIN_LOCKED }",
  },
  {
    adapter: "bank.devices.changePin", suggestedId: "changePin", description: "A new PIN after bank.devices.verifyPin and a step-up.", input: { new: "6 digits" }, returns: "{ ok, device } | { ok: false, code: PIN_SAME | PIN_WEAK | PIN_PHONE }",
  },
  {
    adapter: "sandbox.access.inspect", suggestedId: "inspectAccess", description: "For scenarios only (expectBank), never a journey: what the bank holds about a username.", input: { username: "text" },
    returns: "{ found, locked, failedSignIns, trustedDevices, remembered, quick, outbox, sessionOpen }",
  },
];

/** Sandbox customers for testing. The OTP codes are sandbox-only test values. */
export function describePersonas() {
  const seen: { id: string; accounts: string[] }[] = [];
  return Object.values(personas).map((p) => {
    const accounts = p.accounts.map((a) => `${a.id}: ${a.name} ${a.maskedNumber}, ${a.currency} ${a.balance.toLocaleString("en-US")}`);
    // customers that start with the same accounts say so, to keep the catalog short
    const twin = accounts.length > 2 ? seen.find((x) => x.accounts.join("|") === accounts.join("|")) : undefined;
    seen.push({ id: p.id, accounts });
    return { ...describe(p), accounts: twin ? [`Same accounts as ${twin.id}`] : accounts };
  });
}
const SIGN_IN_CAST = ["demolocked", "demoexpired", "demoinactive", "demonew", "demolimit"];
function describe(p: (typeof personas)[string]) {
  if (SIGN_IN_CAST.includes(p.id)) return { id: p.id, brand: p.brand, name: p.name, otpCode: p.behaviour.otpCode, note: "Sign-in cast (see bank.auth.signIn)." };
  // the approvals cast is Alex again with more waiting at Beta: said in a line
  if (p.identity?.cast) return { id: p.id, brand: p.brand, name: p.name, otpCode: p.behaviour.otpCode, note: "As alex; Beta also holds PAY-2043 to PAY-2048 (name checks, an order, two approvals) and PAY-2036 rejected." };
  return {
    id: p.id,
    brand: p.brand,
    name: p.name,
    otpCode: p.behaviour.otpCode,
    // a customer with many payees is described, not listed
    ...(p.beneficiaries.length ? { beneficiaries: p.beneficiaries.length > 6 ? [`${p.beneficiaries.length} saved payees (${p.beneficiaries[0]!.id} to ${p.beneficiaries.at(-1)!.id})`] : p.beneficiaries.map((b) => `${b.id}: ${b.displayName}`) } : {}),
    ...((p.schedules?.length ?? 0) > 2 ? { scheduled: `${p.schedules!.length} scheduled payments (${p.schedules![0]!.id} to ${p.schedules!.at(-1)!.id})` } : {}),
    limits: p.limits,
    ...(p.identity ? { contexts: ["personal", ...p.identity.business.map((b) => `${b.id}: ${b.company.name} as ${b.company.users.find((u) => u.id === b.userId)?.roles.join(" and ")}`)], note: "One login: call bank.session.switch to move between places (a company needs bank.session.stepUp first)." } : {}),
    // only what is not the usual: a customer for whom everything works says nothing
    ...(p.behaviour.transferFails ? { behaviour: "Money-moving calls fail with CORE_UNAVAILABLE after a correct OTP." } : p.behaviour.kyc === "rejected" ? { behaviour: "KYC rejected: no accounts, so money-moving journeys cannot start." } : {}),
  };
}
