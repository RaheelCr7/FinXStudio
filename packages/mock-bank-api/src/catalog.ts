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
    input: { homeOnly: "optional, true: only accounts that can pay someone else" }, returns: "Map by account id: { id, name, maskedNumber, iban, balance, currency, status, canDebit }. Save as ctx.accounts and use with accountPicker.",
  },
  {
    adapter: "bank.beneficiaries.list", suggestedId: "beneficiaries", description: "Saved payees. One added in the last 24 hours is new and may only be sent 500.00 USD in any 24 hours.",
    input: { sendType: "optional: internal | domestic | international, only payees of that kind" }, returns: "Map by beneficiary id: { id, displayName, bank, maskedNumber, addedAt, ageHours, sendType } and, for payees saved with bank.payees.save: kind (internal | domestic | international), region (bw | us | eu | uk | me | world), country, nickname, label, verified, nameCheck, coolingOffUntil (ISO or null), coolingOffHoursLeft, allowanceLeft (USD, null when not new), scheduledCount, scheduledText. Save as ctx.beneficiaries.",
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
    input: { userId: "the initiator", fromAccountId: "the company account to pay from", file: "the text of the file, as the person pasted it", "with a session (BankWorkx)": "a CSV or bank file (file text, kind csv|xml, size, format csv|bank, bankFormats), or lines (raw, as returned), or repairOf (a batch id); then one change: addSupplierId, addAmount, addReference | editN, editName, editAccount, editCode, editAmount | removeN | removeErrors | useSavedN; begin true on Continue of step 1. It keeps nothing." },
    returns: "{ lines (object keyed by row number: n, payee, amount, reference, ok, code, message), problems (only the rows that fail, same shape; use as a list source), validCount, invalidCount, total (of the rows that pass), requiredApprovers (1 or 2), currency }. Errors: NOT_AUTHORISED, ACCOUNT_NOT_FOUND, EMPTY_BATCH, BATCH_TOO_LARGE (over 50 rows). With a session: { count, valid, invalid, total (USD), totalText, mixed, canContinue, blocker, firstFix, resend, repairOf, batchName, requiredApprovers, fileKey, lines (map by number: name, accountText '••8841', amountText, currency, usd, status ready|fix, statusText, message, note, canUseSaved), raw (send it back as lines) }; errors FILE_TOO_BIG (256 KB), FILE_TYPE, FILE_UNREADABLE, FILE_EMPTY, BATCH_TOO_LARGE (50), ALREADY_SENT, FORMAT_NOT_ENABLED, ADD_INVALID, EMPTY_BATCH, REPAIR_NOT_ALLOWED, PAYMENT_NOT_FOUND, ACCOUNT_NOT_PERMITTED, PERMISSION_DENIED, WRONG_CONTEXT.",
  },
  {
    adapter: "corp.bulk.quote", suggestedId: "quoteBulk", description: "The speeds a batch can go at with the fee of each and the dates it can be sent on; with a speed and review, the totals, the approvers and the checks before the code (BankWorkx).",
    input: { fromAccountId: "id", lines: "raw lines from corp.bulk.check", speed: "standard | sameDay | instant", sendOn: "today or a working day of the next 30", review: "true to check the limits and the money", allowSameDay: "false when off", allowInstant: "false when off" },
    returns: "{ speeds: map { id, name, sub, feeText, usable, reason 'Some payments are too large' | 'Some payments go abroad' }, firstUsable, dates, count } and with a speed { speed, sendOn, sendText, totalText, feeText, youPayText, requiredApprovers, codeExtra (from 25,000.00), mixed }. Errors: NO_VALID_LINES, LINES_NEED_FIXING, RAIL_LIMIT, RAIL_NOT_AVAILABLE, DATE_NOT_WORKING_DAY, LIMIT_USER_EXCEEDED, LIMIT_COMPANY_EXCEEDED, INSUFFICIENT_FUNDS.", errors: ["PERMISSION_DENIED", "WRONG_CONTEXT"],
  },
  {
    adapter: "corp.bulk.submit", suggestedId: "submitBulk", description: "Starts ONE bulk payment of the rows that pass the checks (failing rows are left out) and sends it for approval as one. The total counts against the daily limits; moves no money until approved. Needs the one-time code first.",
    input: { userId: "the initiator", fromAccountId: "the account to pay from", file: "the same file text that was checked", reference: "optional label for the whole file", "with a session (BankWorkx)": "every line must be valid (all or nothing); lines (raw from corp.bulk.check), speed, sendOn today|date, name up to 35 characters, repairOf, fileKey, allowSameDay, allowInstant" },
    returns: "The payment (payee shows '3 payments'; lines lists what it pays), 'pending_approval'. Errors: OTP_REQUIRED, NOT_AUTHORISED, NO_VALID_LINES, EMPTY_BATCH, BATCH_TOO_LARGE, INSUFFICIENT_FUNDS, LIMIT_USER_EXCEEDED, LIMIT_COMPANY_EXCEEDED, CURRENCY_NOT_SUPPORTED. With a session: { id, status, required, name, count, totalText, youPayText, speedName, sendText, approvalsText, reference 'BWX-…', resent } and also LINES_NEED_FIXING, NAME_TOO_LONG, RAIL_LIMIT, RAIL_NOT_AVAILABLE, DATE_NOT_WORKING_DAY, STEP_UP_FAILED; the lines sent again are marked Resent on the original."
  },
  {
    adapter: "corp.bulk.list", suggestedId: "bulkBatches", description: "The company's bulk batches, newest first, each with its status: Waiting for approval, Sent to bank, Paid, Partly paid, Rejected, Withdrawn (BankWorkx).",
    input: {}, returns: "{ count, latest, batches: map by id { id, name, countText, totalText, statusKey, statusText, date, line, sub, canResend, failed } }.", errors: ["PERMISSION_DENIED", "WRONG_CONTEXT"],
  },
  {
    adapter: "corp.bulk.get", suggestedId: "bulkBatch", description: "One bulk batch (the latest without an id) with the standing of each payment and the other batches; report returns the CSV (BankWorkx).",
    input: { id: "optional batch id", report: "true for the report" }, returns: "The card of corp.bulk.list plus lines (map: payee '4. Gulf Trade FZE', account '••3456', amountText, statusKey, statusText Waiting for approval|Sent to bank|Paid|Failed|Resent|Cancelled|Withdrawn, note) and others; with report { fileName 'PAY-1190_report.csv', csv, rows }. Errors: PAYMENT_NOT_FOUND, NO_BATCHES.", errors: ["PERMISSION_DENIED", "WRONG_CONTEXT"],
  },
  {
    adapter: "corp.payroll.check", suggestedId: "checkPayroll", description: "Checks a payroll file for one pay period (rows `employee,amount,reference`, optional header) without starting anything. Each row: an employee on the register, paid once, at most 1.5 times their monthly salary. The run fails when the period is not a past or current month (YYYY-MM) or was already run.",
    input: { userId: "the initiator", fromAccountId: "the company account to pay from", period: "the pay period, YYYY-MM", file: "the text of the file, as the person pasted it", "with a session (BankWorkx)": "checks the run opened with corp.payroll.register: reason (up to 140), review true for the limits and the money, varianceCheck, payslips" },
    returns: "{ lines (object keyed by row number: n, payee, amount, reference, ok, code, message), problems (only the rows that fail), validCount, invalidCount, total, requiredApprovers (always 2), period, currency }. Errors: NOT_AUTHORISED, ACCOUNT_NOT_FOUND, INVALID_PERIOD, PAYROLL_ALREADY_RUN, EMPTY_BATCH, BATCH_TOO_LARGE. Row codes: NOT_AN_EMPLOYEE, INVALID_AMOUNT, ABOVE_SALARY_CAP, DUPLICATE_LINE. With a session: the view of corp.payroll.register plus feeText and youPayText; errors EMPTY_BATCH, ROWS_NEED_FIXING, INSUFFICIENT_FUNDS, REASON_REQUIRED, LIMIT_USER_EXCEEDED, LIMIT_COMPANY_EXCEEDED, NO_RUN_STARTED.",
  },
  {
    adapter: "corp.payroll.register", suggestedId: "payrollRegister", description: "The payroll register behind a run (BankWorkx): open a run for a period, a pay date and an account, then change one person at a time; moves nothing.",
    input: { op: "options (periods, pay dates) | open (default) | net | bonus | deduction | removeLine | remove | addBack", period: "YYYY-MM, this month or earlier", fromAccountId: "id", payDate: "a working day of the next 25", employeeId: "id", amount: "up to the currency's decimals", kind: "removeLine: bonus | deduction", index: "removeLine", allowBonus: "false when off", allowDeduction: "false when off", varianceCheck: "false when off" },
    returns: "{ periodText, payDateText, accountName, count, totalText ('$17,800.00 + £3,000.00'), totalUsdText, from, balanceAfterText, fundsOk, fundsMessage, varianceNeeded, varianceText, canReview, blocker, requiredApprovers, codeExtra, rows: map by employee { name, dept, currency, netText, payText, message, status, detail, bonuses, deductions }, notIn: map { name, reason Removed | No bank details, canAddBack } }. Errors: INVALID_PERIOD, PAYROLL_ALREADY_RUN, DATE_REQUIRED, DATE_NOT_WORKING_DAY, NOT_AN_EMPLOYEE, NO_BANK_DETAILS, INVALID_AMOUNT, BONUS_NOT_ALLOWED, DEDUCTION_NOT_ALLOWED, NO_RUN_STARTED, ACCOUNT_NOT_PERMITTED.", errors: ["PERMISSION_DENIED", "WRONG_CONTEXT"],
  },
  {
    adapter: "corp.payroll.submit", suggestedId: "submitPayroll", description: "Starts ONE payroll run of the rows that pass the checks and sends it for approval by two different approvers. Counts against the daily limits; moves no money until approved. Needs the one-time code first. Withdrawing or rejecting it frees the period.",
    input: { userId: "the initiator", fromAccountId: "the account to pay from", period: "the pay period, YYYY-MM", file: "the same file text that was checked", "with a session (BankWorkx)": "the run opened with corp.payroll.register: reason, payslips" },
    returns: "The payment (payee shows 'Payroll 2026-10 · 3 employees'; period; lines lists the employees), 'pending_approval' with required 2. Errors: OTP_REQUIRED, NOT_AUTHORISED, INVALID_PERIOD, PAYROLL_ALREADY_RUN, NO_VALID_LINES, INSUFFICIENT_FUNDS, LIMIT_USER_EXCEEDED, LIMIT_COMPANY_EXCEEDED, CURRENCY_NOT_SUPPORTED. With a session: required is 1, or 2 above the company's threshold; { id, status, required, periodText, payDateText, count, totalText, totalUsdText, youPayText, approvalsText, reference 'BWX-…' }."
  },
  {
    adapter: "corp.payments.approve", suggestedId: "approvePayment", description: "Approves a pending payment. The last approval releases it: the money moves. Needs the one-time code first.",
    input: { userId: "an approver other than the one who started it", paymentId: "from corp.payments.pending", acknowledged: "true once the person checked a flagged payee name", stepUp: "with a session: false when the bank does not ask for the code (option stepUp)" },
    returns: "The payment, 'released' (with releaseReference) or still 'pending_approval' when a second approver is needed. With a session the answer adds aprRef (APR-20261103-0001, the reference of the decision), signatories (id, name, label, state approved|passed|next|waiting|can, text, step, time), mode sequential|parallel, groupName, groupText and nextActors, and batch (the lines of a bulk or payroll payment: payee, amountText, reference). Errors: OTP_REQUIRED, NOT_AUTHORISED, SELF_APPROVAL, ALREADY_APPROVED, OUT_OF_SEQUENCE, DELEGATED, APPROVAL_EXPIRED, NAME_CHECK_NOT_CONFIRMED, PAYMENT_NOT_PENDING, INSUFFICIENT_FUNDS, LIMIT_COMPANY_EXCEEDED.",
  },
  {
    adapter: "corp.payments.reject", suggestedId: "rejectPayment", description: "An approver rejects a pending payment, with a reason. The initiator's daily limit is given back. The person who started the payment cannot reject it (NOT_AUTHORISED): they use corp.payments.withdraw.",
    input: { userId: "an approver other than the one who started it", paymentId: "from corp.payments.pending", reason: "optional text; with a session Wrong amount | Wrong payee | Unknown supplier | Duplicate, or a note of 10 to 300 characters" }, returns: "The payment, 'rejected' (with a session also aprRef). Errors: NOT_AUTHORISED, PAYMENT_NOT_PENDING, PAYMENT_NOT_FOUND, PERMISSION_DENIED, REASON_REQUIRED.",
  },
  {
    adapter: "corp.payments.withdraw", suggestedId: "withdrawPayment", description: "The person who started a payment takes it back while it waits for approval. Only them; their daily limit is given back. Moves no money.",
    input: { userId: "the initiator who started it", paymentId: "from corp.payments.pending with as: 'initiator'", reason: "with a session: Wrong amount | Wrong supplier | Wrong reference | Not needed any more | Other", note: "with Other, up to 100 characters" }, returns: "The payment, 'rejected' with reason 'Withdrawn by the person who started it'. With a session the answer is the tracker row (statusKey 'withdrawn', withdrawReason). Errors: NOT_AUTHORISED (not theirs), PAYMENT_NOT_PENDING, PAYMENT_NOT_FOUND; with a session NOT_YOUR_PAYMENT, PAYMENT_RELEASED, INVALID_REASON.",
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
    input: { category: "BankWorkx", q: "BankWorkx" }, returns: "Map by biller id: { id, name, category } (BankWorkx adds label, format, accepts, fee). Save as ctx.billers; use as a block source.",
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
    input: {}, returns: "Map by carrier id: { id, name }. Save as ctx.carriers and use with a select block (source). BankWorkx adds amounts.",
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
    input: {}, returns: "Map by bank id: { id, name, color }. Save as ctx.banks and use with a select block (source).",
  },
  {
    adapter: "bank.cards.list", suggestedId: "cards", description: "The customer's saved cards (BankWorkx).",
    input: {}, returns: "Map by card id: { id, network, last4, holder, expiry, nickname, isDefault, name }. Save as ctx.cards and use with a select block (source).",
  },
  {
    adapter: "bank.deposit.create", suggestedId: "addMoney", description: "Adds money to an account from a saved card, after the code; 10.00 to 5,000.00 with a 1.5% fee",
    input: { toAccountId: "account id", fromCardId: "card id", amount: "10 to 5000, at most 2 decimals", securityCode: "3 digits (never kept)", fee: "false: no fee", allowCard: "false: refused", dryRun: "true: apply every rule, charge nothing, no code" },
    returns: "{ toName, cardName, amountText, fee, feeText, chargedText } and, after the code, reference, newBalance. The account gets the amount, the card is charged the amount and the fee.", requiresOtp: true,
    errors: ["INVALID_AMOUNT", "LIMIT_EXCEEDED", "ACCOUNT_NOT_FOUND", "ACCOUNT_CANNOT_CREDIT", "CARD_NOT_FOUND", "CARD_EXPIRED", "CARD_DECLINED (a card ending 0000)", "CVV_INVALID", "CARD_OFF", "OTP_REQUIRED"],
  },
  {
    adapter: "bank.cards.check", suggestedId: "checkCard", description: "Checks a card from another bank before saving it",
    input: { number: "digits; Visa 4, Mastercard 51-55 or 2221-2720 (16), Amex 34 or 37 (15, with acceptAmex)", expiry: "MM/YY, not past, within 15 years", cvv: "3 digits (4 for Amex)", holder: "letters", postcode: "by home market", acceptAmex: "false when off" },
    returns: "{ network, networkName, last4, expiry, typeText, phoneEnding }. Saves nothing; starts the code check. A number ending 0002 is declined.", errors: ["CARD_INVALID", "CARD_BRAND_UNSUPPORTED", "EXPIRY_INVALID", "CARD_EXPIRED", "CVV_INVALID", "HOLDER_INVALID", "POSTCODE_INVALID", "CARD_DECLINED", "CARD_DUPLICATE", "CARD_LIMIT"],
  },
  {
    adapter: "bank.cards.verify", suggestedId: "verifyCard", description: "Proves the person holds the card with a code",
    input: { method: "sms | charge", code: "sms: 482100 (or 000000); charge: 4821" }, returns: "{ verified, method }. Three wrong codes lock it until the card is checked again.", errors: ["VERIFY_REQUIRED", "VERIFY_INVALID", "VERIFY_LOCKED"],
  },
  {
    adapter: "bank.cards.add", suggestedId: "addCard", description: "Saves a verified card from another bank",
    input: { "...": "as bank.cards.check", nickname: "optional, 2 or more characters", useToAddMoney: "default true", useToPay: "default true", allowPay: "false when off" },
    returns: "{ cardId, last4, network, networkName, expiry, nickname, typeText, usedFor }. Keeps the last four digits and the expiry only; at most 5.", errors: ["VERIFY_REQUIRED", "NICKNAME_INVALID", "the errors of bank.cards.check"],
  },
  {
    adapter: "bank.accounts.connect", suggestedId: "connectBank", description: "Links an account from another bank (BankWorkx). Sandbox: password invalid123 is rejected.",
    input: { bankId: "bank id", username: "text", password: "at least 6 characters", accountType: "'bank' or 'credit'" },
    returns: "{ connectedId, bank, kind, maskedNumber, balance }", errors: ["BANK_NOT_FOUND", "BANK_AUTH_FAILED", "ALREADY_CONNECTED"],
  },
  {
    adapter: "bank.budgets.list", suggestedId: "budgets", description: "Monthly budgets, with how far each is used (BankWorkx).",
    input: {}, returns: "Map by id: { id, name, category, limit, spent, pct, barPct (max 100), tone ok|warn|over, chip 'On track' (under 80%) | 'Close to limit' (80%) | 'Over budget' (100%), spentText, limitText, line, leftText, alert80, alert100, canAdd (fewer than 8) }.",
  },
  {
    adapter: "bank.budgets.create", suggestedId: "createBudget", description: "Creates a budget for a category; no code, no money moves (BankWorkx).",
    input: { category: "Food & Drinks | Shopping | Transport | Health | Travel | Bills | Entertainment | Subscriptions", limit: "10.00 to 100000.00", alert80: "default true", alert100: "default true" },
    returns: "{ budgetId, name, limit }; spent starts at the last 30 days.", errors: ["INVALID_AMOUNT", "CATEGORY_REQUIRED", "BUDGET_EXISTS"],
  },
  { adapter: "bank.budgets.update", suggestedId: "updateBudget", description: "Changes a budget's amount and alerts.", input: { budgetId: "id", limit: "10.00 to 100000.00", alert80: "boolean", alert100: "boolean" }, returns: "{ budgetId, name, limit }", errors: ["BUDGET_NOT_FOUND", "INVALID_AMOUNT"] },
  { adapter: "bank.budgets.delete", suggestedId: "deleteBudget", description: "Removes a budget.", input: { budgetId: "id" }, returns: "{ budgetId, name }", errors: ["BUDGET_NOT_FOUND"] },
  { adapter: "bank.spending.byCategory", suggestedId: "spending", description: "Spending of the last 30 days per budget category.", input: { category: "optional: one category" }, returns: "{ id, category, amount, text, hasBudget, budgetId, days } for the category, or a map of them for all 8." },
  {
    adapter: "bank.subscriptions.list", suggestedId: "subscriptions", description: "Recurring payments the customer has (BankWorkx).",
    input: {}, returns: "Map by subscription id: { id, name, amount, nextInDays, color }. Save as ctx.subscriptions.",
  },
  {
    adapter: "bank.subscriptions.pay", suggestedId: "paySubscription", description: "Pays a subscription now from an account (BankWorkx).",
    input: { subscriptionId: "subscription id", fromAccountId: "account id" }, returns: "{ reference, newBalance }", moneyMoving: true,
    errors: ["SUBSCRIPTION_NOT_FOUND", "ACCOUNT_NOT_FOUND", "INSUFFICIENT_FUNDS"],
  },
  {
    adapter: "bank.invest.instruments", suggestedId: "instruments", description: "The stocks and funds that can be bought (BankWorkx). Made-up companies.",
    input: {}, returns: "Map by symbol: { id, symbol, kind, sector, price, changePct, name }. Save as ctx.instruments and use it as a select source.",
  },
  {
    adapter: "bank.invest.buy", suggestedId: "buyInvestment", description: "Buys a stock or fund with a dollar amount from an account (BankWorkx). Buys fractional shares at today's price.",
    input: { symbol: "instrument symbol", amount: "number, 1 to 50000", fromAccountId: "account id" }, returns: "{ reference, symbol, name, shares, price, newBalance }", moneyMoving: true,
    errors: ["INSTRUMENT_NOT_FOUND", "INVALID_AMOUNT", "ACCOUNT_NOT_FOUND", "INSUFFICIENT_FUNDS"],
  },
  {
    adapter: "bank.invest.holdings", suggestedId: "holdings", description: "What the customer owns (BankWorkx).",
    input: {}, returns: "Map by symbol: { id, symbol, shares, value, name }. Save as ctx.holdings and use it as a select source.",
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
    input: { method: "'password', 'pin' or 'biometric'", secret: "the password or PIN" }, returns: "{ stepUpUntil }", requiresOtp: true, errors: ["STEP_UP_FAILED", "OTP_REQUIRED", "SESSION_EXPIRED"],
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
  { adapter: "corp.suppliers.list", suggestedId: "suppliers", description: "The company's approved suppliers; include 'all' adds the ones waiting for approval.", input: { include: "optional: 'all'" }, returns: "Map by id: { id, name, displayName, line 'USD · ••8841', bank, maskedNumber, country?, currency?, status 'approved' | 'waiting_approval', statusText }.", errors: ["PERMISSION_DENIED"] },
  { adapter: "corp.templates.list", suggestedId: "templates", description: "The company's payment templates, each with the state of its supplier.", input: {}, returns: "Map by id: { id, name, beneficiaryId, supplierName, amount?, amountText ('$4,500.00' | 'Amount each time'), currency, reference, purpose, line, status 'ready' | 'waiting' | 'unavailable', statusText }.", errors: ["PERMISSION_DENIED"] },
  {
    adapter: "corp.payments.list", suggestedId: "paymentsList", description: "Payments for an approvals inbox, each as the signed-in person sees it (you, statusKey, note, signatories, nameResult, cutoffText, delegates).",
    input: { status: "'pending' | 'ready' (approvable together) | 'history'" }, returns: "Map by payment id.",
  },
  {
    adapter: "corp.payments.approveMany", suggestedId: "approveMany", description: "Approves several waiting payments with ONE code, all or none (NOT_FOR_BATCH if one has a name check).",
    input: { paymentIds: "ids", stepUp: "false when the bank does not ask for the code" }, returns: "{ count, released, total, currency, aprRef, payments }.", moneyMoving: true, requiresOtp: true,
    errors: ["PERMISSION_DENIED", "OTP_REQUIRED", "NOT_FOR_BATCH", "SELF_APPROVAL", "OUT_OF_SEQUENCE", "APPROVAL_EXPIRED", "INSUFFICIENT_FUNDS"],
  },
  {
    adapter: "corp.payments.rejectMany", suggestedId: "rejectMany", description: "Rejects several waiting payments for one reason, all or none; nothing is sent (BankWorkx).",
    input: { paymentIds: "ids", reason: "Wrong amount | Wrong payee | Unknown supplier | Duplicate, or a note of 10 to 300 characters" }, returns: "{ count, total, currency, reason, aprRef, payments }.",
    errors: ["PERMISSION_DENIED", "EMPTY_BATCH", "REASON_REQUIRED", "PAYMENT_NOT_PENDING", "NOT_AUTHORISED"],
  },
  {
    adapter: "corp.payments.delegate", suggestedId: "delegatePayment", description: "An approver passes a waiting payment to another, who alone can then approve it.",
    input: { paymentId: "id", toUserId: "an approver" }, returns: "The payment with passedTo.", errors: ["DELEGATE_CONFLICT", "DELEGATE_ALREADY_APPROVED", "PERMISSION_DENIED"],
  },
  { adapter: "corp.signatories.list", suggestedId: "signatories", description: "Signatory groups: who approves, in order (sequential) or any order (parallel), above which amount.", input: {}, returns: "Map by id: { id, name, mode, members, required, above }.", errors: ["PERMISSION_DENIED"] },
  { adapter: "corp.audit.list", suggestedId: "audit", description: "The audit trail, newest first, including what this session did and was refused.", input: {}, returns: "Map by position: { id, at, userId, action, outcome 'Done'|'Refused' }.", errors: ["PERMISSION_DENIED"] },
  // ---- Business: Accounts and Payments (BankWorkx; one session in a company, the active context decides who acts) ----
  {
    adapter: "corp.accounts.overview", suggestedId: "companyAccounts", description: "The company's accounts with the total in its currency; each row has the person's rights on it.",
    input: {}, returns: "{ company, currency, count, total, totalText, note, exportable, accounts: map by id { id, name, maskedNumber, currency, type, ledgerBalance, availableBalance (less pending and waiting payments), ledgerText, availableText, chip 'View only' | '', nameText, rights { transactions, export, pay } } }.",
    errors: ["PERMISSION_DENIED", "WRONG_CONTEXT"],
  },
  {
    adapter: "corp.accounts.list", suggestedId: "accountList", description: "The company's accounts as a map; for 'export' only those the person may export.",
    input: { for: "optional: 'export'" }, returns: "Map by id: the account row of corp.accounts.overview plus option 'Operating ••2001 · USD'.", errors: ["PERMISSION_DENIED", "WRONG_CONTEXT"],
  },
  {
    adapter: "corp.accounts.get", suggestedId: "companyAccount", description: "One account with the numbers others pay it on (by the bank's home market).",
    input: { accountId: "id", details: "false leaves the numbers out" }, returns: "The account row plus holds and identifiers { first { label, value }, second, name } (Routing number and Account number, Sort code and Account number, or IBAN and BIC) or null.", errors: ["ACCOUNT_NOT_FOUND", "PERMISSION_DENIED"],
  },
  {
    adapter: "corp.transactions.list", suggestedId: "companyTransactions", description: "An account's (or every account's) transactions for a period, with a search; up to 25.",
    input: { accountId: "optional", period: "7d | 30d (default) | 90d | month", text: "counterparty or reference" }, returns: "{ from, to, period, periodText, count, shown, rows: map by id { id, date, dateIso, description, reference, text, account, where, amount, currency, amountText, status 'Pending' | 'Booked' } }.",
    errors: ["ACCOUNT_NOT_FOUND", "ACCOUNT_NOT_PERMITTED", "INVALID_RANGE", "PERMISSION_DENIED"],
  },
  {
    adapter: "corp.statements.list", suggestedId: "statementList", description: "The statement schedules that exist, the most there can be and the default address.",
    input: { accountId: "optional: ticked alone when the person may export it" }, returns: "{ picked: [ids], count, max, defaultRecipient, accountIds, schedules: map by id { id, format, frequency, how, first, recipients, accounts } }.", errors: ["PERMISSION_DENIED"],
  },
  {
    adapter: "corp.statements.check", suggestedId: "statementCheck", description: "Checks the accounts and the period of a statement; sends nothing.",
    input: { accountIds: "[ids]", type: "eod | intraday", period: "7d | month | last | 3m | custom", from: "custom", to: "custom", intraday: "true when the bank offers Today so far" }, returns: "{ ok, from, to }. Errors: ACCOUNT_REQUIRED, ACCOUNT_NOT_PERMITTED, INVALID_RANGE, PERIOD_TOO_LONG (over 24 months), FORMAT_NOT_ENABLED.", errors: ["PERMISSION_DENIED"],
  },
  {
    adapter: "corp.statements.generate", suggestedId: "statementSend", description: "Builds a statement and emails it once. No code; the company's addresses unless external.",
    input: { accountIds: "[ids]", type: "eod | intraday", period: "as corp.statements.check", format: "pdf | csv | excel (bankFormats: bai2 | mt940 | camt053; intraday: bai2 | mt942 | camt052)", recipients: "1 to 5 addresses, comma separated, up to 200 characters", bankFormats: "true if offered", intraday: "true if offered", external: "true to allow outside addresses" },
    returns: "{ reference, format, formatText, accounts, period, recipients, count }. Errors as corp.statements.check plus NO_TRANSACTIONS, INVALID_RECIPIENT, EXTERNAL_RECIPIENT_BLOCKED.", errors: ["PERMISSION_DENIED"],
  },
  {
    adapter: "corp.statements.schedule", suggestedId: "statementSchedule", description: "Creates (or removes) a repeating statement; ten at most.",
    input: { action: "create (default) | remove", scheduleId: "to remove", "...": "the fields of corp.statements.generate", frequency: "daily | weekly | monthly", day: "weekly: mon | tue | fri; monthly: 1 | 5 | last", schedule: "false when the bank has switched schedules off" },
    returns: "{ id, format, formatText, how, frequencyText, first 'Fri 6 Nov', recipients, accounts, reference, count, max }. Errors: SCHEDULE_LIMIT, INVALID_SCHEDULE, FORMAT_NOT_ENABLED, as the statement.", errors: ["PERMISSION_DENIED"],
  },
  {
    adapter: "corp.suppliers.validate", suggestedId: "validateSupplier", description: "Checks a supplier being added: step 1 the name, step 2 the bank details of the home market or the country.",
    input: { step: "1 | 2 (default)", name: "supplier", type: "company | person", where: "same | abroad", allowPerson: "false when off", allowAbroad: "false when off", accountName: "name on the account", routing: "9 digits + account (+ accountType)", sort: "sort code + account", iban: "IBAN", country: "abroad", swift: "abroad", bankCode: "abroad, some countries" },
    returns: "{ ok, name, accountName, key, region, country, account ('021000021 · ••4321'), countryName, needsAddress }. Errors: INVALID_NAME, SUPPLIER_NAME_EXISTS, TOO_MANY_PENDING (10 waiting), SUPPLIER_EXISTS, INVALID_ROUTING, INVALID_ACCOUNT, INVALID_SORT_CODE, INVALID_IBAN, NOT_SEPA, COUNTRY_MISMATCH, INVALID_BIC, INVALID_BANK_CODE.", errors: ["PERMISSION_DENIED"],
  },
  {
    adapter: "corp.suppliers.check", suggestedId: "supplierNameCheck", description: "The name check of a supplier's bank account against the name on the account.",
    input: { "...": "the fields of corp.suppliers.validate" }, returns: "{ result: match | close | none | na | wrongType, registeredName, recorded, fix }.", errors: ["PERMISSION_DENIED", "TIMEOUT", "SERVICE_UNAVAILABLE"],
  },
  {
    adapter: "corp.suppliers.request", suggestedId: "requestSupplier", description: "Asks for a supplier to be added; an administrator approves it. Needs the one-time code first.",
    input: { "...": "the fields of corp.suppliers.validate", acknowledged: "true when the person accepted a name that was not a match", street: "abroad", city: "abroad", postcode: "abroad" },
    returns: "{ requestId, reference, name, account, country, status 'waiting_approval', approval }. Errors: OTP_REQUIRED, STEP_UP_FAILED, NAME_CHECK_NOT_CONFIRMED, ADDRESS_REQUIRED, and those of corp.suppliers.validate.", requiresOtp: true, errors: ["PERMISSION_DENIED"],
  },
  {
    adapter: "corp.templates.save", suggestedId: "saveTemplate", description: "Saves a payment template (twenty at most); dryRun only checks. No code.",
    input: { name: "up to 30 characters, not another template's", supplierId: "an approved supplier", amount: "optional, up to the person's limit", reference: "optional", purpose: "optional: Goods | Services | Rent | Utilities | Taxes and duties | Other", dryRun: "true to check only" },
    returns: "The template (see corp.templates.list). Errors: NAME_REQUIRED, TEMPLATE_NAME_EXISTS, SUPPLIER_NOT_APPROVED, INVALID_AMOUNT, LIMIT_USER_EXCEEDED, INVALID_REFERENCE, PURPOSE_REQUIRED, TEMPLATE_LIMIT.", errors: ["PERMISSION_DENIED"],
  },
  {
    adapter: "corp.templates.delete", suggestedId: "deleteTemplate", description: "Deletes a payment template; payments already sent are not touched.",
    input: { templateId: "id" }, returns: "{ deleted, id, name }.", errors: ["TEMPLATE_NOT_FOUND", "PERMISSION_DENIED"],
  },
  {
    adapter: "corp.schedules.list", suggestedId: "scheduleList", description: "The company's scheduled supplier payments, not the cancelled ones.",
    input: {}, returns: "Map by id: { id, supplierName, reference, purpose, amountText, how, next, line '$4,500.00 · Monthly · next Tue 1 Dec', statusKey 'active' | 'awaiting', badge, progress '0 of 1 approved', warning (why the next payment would be skipped), last, info, ends }.", errors: ["PERMISSION_DENIED"],
  },
  {
    adapter: "corp.schedules.get", suggestedId: "getSchedule", description: "One scheduled payment to change or cancel; refused when changes have closed.",
    input: { scheduleId: "id", strictCutoff: "true when changes close at 09:00 instead of 18:00" }, returns: "The row of corp.schedules.list plus supplierId, currency, amount, frequency, nextRunOn, nextText, endMode, endsOn, endCount. Errors: SCHEDULE_NOT_FOUND, SCHEDULE_NOT_ACTIVE, SCHEDULE_RUNNING, SCHEDULE_CUTOFF_PASSED.", errors: ["PERMISSION_DENIED"],
  },
  {
    adapter: "corp.schedules.check", suggestedId: "checkSchedule", description: "The review of a schedule or a change (with scheduleId): every rule applied, nothing made.",
    input: { supplierId: "approved", amount: "in the supplier's currency", reference: "required", purpose: "required", frequency: "once | weekly | monthly | quarterly", start: "YYYY-MM-DD, a weekday from tomorrow to 12 months", endMode: "never | date | count", endDate: "a payment date after the first", endCount: "2 to 104 weekly, 60 monthly, 40 quarterly", allowQuarterly: "false when off", scheduleId: "to change one", strictCutoff: "see get" },
    returns: "{ firstText, firstShort, nextDates, required (1 or 2 approvers), approvalText, codeRequired (from 25,000.00), amountText, how, adverb, ends, before, endDates }. Errors: SUPPLIER_NOT_APPROVED, RAIL_LIMIT, LIMIT_USER_EXCEEDED, DATE_TOO_SOON, DATE_TOO_FAR, NOT_A_WEEKDAY, END_BEFORE_START, INVALID_COUNT, INVALID_END_DATE, INVALID_FREQUENCY, REFERENCE_REQUIRED, PURPOSE_REQUIRED.", errors: ["PERMISSION_DENIED"],
  },
  {
    adapter: "corp.schedules.create", suggestedId: "createSchedule", description: "Schedules a supplier payment; it waits for approval and no money moves. A code from the threshold.",
    input: { "...": "the fields of corp.schedules.check" }, returns: "The schedule row plus the review fields and a reference. Errors: those of check, SCHEDULE_LIMIT (20 active), OTP_REQUIRED, STEP_UP_FAILED.", requiresOtp: true, errors: ["PERMISSION_DENIED"],
  },
  {
    adapter: "corp.schedules.update", suggestedId: "updateSchedule", description: "Changes a scheduled payment; it goes back for approval. A code from the threshold.",
    input: { scheduleId: "id", "...": "the fields of corp.schedules.check" }, returns: "As corp.schedules.create. Errors: those of check and get.", requiresOtp: true, errors: ["PERMISSION_DENIED"],
  },
  {
    adapter: "corp.schedules.cancel", suggestedId: "cancelSchedule", description: "Cancels a scheduled payment at once; no code.",
    input: { scheduleId: "id", strictCutoff: "see get" }, returns: "{ id, supplierName, amountText, how, cancelledOn }. Errors: as get.", errors: ["PERMISSION_DENIED"],
  },
  {
    adapter: "corp.payments.track", suggestedId: "track", description: "Every payment of the company, newest first, with its status; with paymentId one payment and its timeline.",
    input: { status: "all | pending_approval | released | settled | rejected | withdrawn", paymentId: "optional" }, returns: "{ role, count, canStart, rows: map by id { id, started, to, amount, currency, amountText, statusKey, statusText, startedBy, reference, canWithdraw, withdrawReason } }; with paymentId the row plus timeline: map { id, title, text, state } and canReceipt. Error: PAYMENT_NOT_FOUND.", errors: ["PERMISSION_DENIED"],
  },
  {
    adapter: "corp.sandbox.arrange", suggestedId: "arrange", description: "Scenario only: sets the books up for a test (a supplier off the list, a balance, a payment released).",
    input: { op: "removeSupplier | waitSupplier | approveSupplier | balance | release | payment | fillTemplates | fillSchedules | fillRequests | fillStatements | emptyTransactions", "...": "id, accountId, balance, paymentId, payment, count" }, returns: "{ ok }. Never called by a journey.",
  },
  // ---- A retail customer's records (BankWorkx) ----
  {
    adapter: "bank.accounts.overview", suggestedId: "overview", description: "All accounts in groups, with the total",
    input: { showFx: "false leaves accounts in other currencies out of the list and the total" },
    returns: "{ count, visible, total { currency, amount, text } | null, groups { everyday, savings, other, hidden: [ { id, name, line '••4410 · USD', balanceText (available), chip Frozen|Dormant|Closing|'', hidden } ] } }. The total adds ledger balances of visible accounts at the sandbox rate.",
  },
  {
    adapter: "bank.accounts.get", suggestedId: "account", description: "One account: both balances, holds, product, numbers",
    input: { accountId: "id" },
    returns: "The account plus: name, ledgerText, availableText, heldText, onHold, holds [ { id, title, text, date } ], productName, openedOn, interestRate, paperless, rows [ { label, value } ] (routing and account number; sort code; or IBAN and BIC), chip, hiddenChip, warning dormant|closing|'', closureReference, destinations (where a balance can go on closing, by id).",
    errors: ["ACCOUNT_NOT_FOUND"],
  },
  { adapter: "bank.accounts.rename", suggestedId: "renameAccount", description: "Names an account, or puts the original name back.", input: { accountId: "id", nickname: "2 to 24 letters, digits, spaces and & _ . ' -; not another account's name (any case)", reset: "true: use the original name" }, returns: "{ accountId, nickname }", errors: ["ACCOUNT_NOT_FOUND", "INVALID_NICKNAME", "NAME_CHARS", "NAME_TAKEN"] },
  {
    adapter: "bank.accounts.transactions", suggestedId: "accountActivity", description: "One account's transactions, pending first, filtered",
    input: { accountId: "id", q: "title, category, reference or amount", direction: "all | in | out", limit: "default 10, to 100" },
    returns: "{ items [ { id, title, category, amountText, line, when, status, date, reference, party From|To, counterparty, incoming, pending, reportable, reported (case) } ], total, shown, more, empty, filtered }.", errors: ["ACCOUNT_NOT_FOUND"],
  },
  { adapter: "bank.accounts.setHidden", suggestedId: "setHidden", description: "Hides an account from the overview and total, or shows it", input: { accountId: "id", hidden: "boolean" }, returns: "{ accountId, hidden }", errors: ["ACCOUNT_NOT_FOUND", "LAST_VISIBLE_ACCOUNT"] },
  {
    adapter: "bank.accounts.reportProblem", suggestedId: "reportProblem", description: "Reports a problem with a payment, once per payment",
    input: { accountId: "id", transactionId: "id", reason: "card payment: 'I do not recognise it' | 'I was charged twice' | 'The amount is wrong' | 'Something else'; other payment: 'I sent it to the wrong person' | 'I did not make this transfer' | 'Something else'", note: "10 characters or more for 'Something else'" },
    returns: "{ caseRef DSP-..., transactionId, title, amountText }. A pending payment takes only 'I do not recognise it', 'I did not make this transfer' and 'Something else'.", errors: ["TRANSACTION_NOT_FOUND", "NOT_REPORTABLE", "REASON_INVALID", "PENDING_NOT_DISPUTABLE", "NOTE_TOO_SHORT", "DUPLICATE_REPORT"],
  },
  {
    adapter: "bank.accounts.requestClosure", suggestedId: "requestClosure", description: "Asks to close an account, after the code",
    input: { accountId: "id", reason: "'I do not need it' | 'I am moving to another bank' | 'Fees are too high' | 'Something else'", note: "10 characters or more for 'Something else'", destination: "with a balance above zero: another account of the same currency (from bank.accounts.get destinations) or 'post'" },
    returns: "{ accountId, reference CLS-..., destination, name, maskedNumber }", requiresOtp: true, errors: ["OTP_REQUIRED", "ACCOUNT_HAS_HOLDS", "ACCOUNT_OVERDRAWN", "CLOSURE_PENDING", "REASON_REQUIRED", "NOTE_TOO_SHORT", "DESTINATION_INVALID"],
  },
  { adapter: "bank.accounts.restore", suggestedId: "restoreAccount", description: "Cancels a closure, or reactivates a dormant account", input: { accountId: "id" }, returns: "{ accountId, status, was closing|dormant }", errors: ["NOT_RESTORABLE"] },
  {
    adapter: "bank.accounts.open", suggestedId: "openAccount", description: "Opens an empty account after the code; at most 6",
    input: { product: "current | savings | currency", currency: "currency account: EUR | GBP | AED", name: "2 to 24 characters, not used by another account (any case)", dryRun: "true: apply every rule and open nothing (no code needed)" },
    returns: "{ accountId, name, productName, currency, maskedNumber, last4, openedOn, status }", requiresOtp: true, errors: ["OTP_REQUIRED", "PRODUCT_UNAVAILABLE", "CURRENCY_REQUIRED", "ACCOUNT_LIMIT", "INVALID_NICKNAME", "NAME_CHARS", "NAME_TAKEN"],
  },
  {
    adapter: "bank.statements.prepare", suggestedId: "prepareStatement", description: "Checks a statement or letter and shows what it will be. Changes nothing.",
    input: { accountId: "id", kind: "statement | official | letter | certificate", period: "this | last | 3m | custom (statement and official only)", from: "custom: YYYY-MM-DD", to: "custom: YYYY-MM-DD", format: "pdf (csv, and ofx or qif with allowOfxQif true, for a statement only)", delivery: "download | email", fee: "false when the bank charges none" },
    returns: "{ kind, kindLabel, kindLower, periodText, from, to, file, sizeKb, count, openingText, closingText, balanceText, fee, feeText, needsCode, emailMasked, paperFeeText, paperless }. Official statement and certificate cost 5.00 USD (converted); a letter and certificate have no period.",
    errors: ["RANGE_INVALID", "BEFORE_OPENING", "PERIOD_TOO_LONG (24 months, 12 official)", "NO_TRANSACTIONS", "FEE_INSUFFICIENT_FUNDS", "ACCOUNT_DORMANT (letter)", "FORMAT_UNAVAILABLE", "KIND_UNAVAILABLE"],
  },
  { adapter: "bank.statements.deliver", suggestedId: "deliverStatement", description: "Delivers a plain statement, free and without a code.", input: { "...": "as bank.statements.prepare", paperless: "boolean" }, returns: "The prepared statement plus reference STM-...", errors: ["OTP_REQUIRED (not a plain statement)", "the errors of prepare"] },
  {
    adapter: "bank.statements.issue", suggestedId: "issueStatement", description: "Issues an official document after the code and takes the fee.",
    input: { "...": "as bank.statements.prepare" }, returns: "The prepared document plus reference STM-..., newBalanceText, availableText", moneyMoving: true, requiresOtp: true, errors: ["OTP_REQUIRED", "NOT_OFFICIAL (a plain statement)", "the errors of prepare"],
  },
  {
    adapter: "bank.payments.speeds", suggestedId: "speeds", description: "Speeds to another bank and country: arrival, fee, limit",
    input: { standard: "false if off (also sameDay, instant)", priority: "true if on" }, returns: "{ domestic, international [ { id, speed, arrives, fee ('Free' or amount), limit ('None' from 1,000,000) } ], domesticLine, internationalLine } for the bank's home market. Names no scheme or country.",
  },
  {
    adapter: "bank.transactions.list", suggestedId: "transactions", description: "Account transactions, newest first. A pending item lowers the available balance, not yet the ledger balance.",
    input: { accountId: "optional", from: "YYYY-MM-DD", to: "YYYY-MM-DD", direction: "'in'|'out'", category: "text", status: "'posted'|'pending'", q: "text in the title", minAmount: "number", maxAmount: "number", limit: "1-100 (default 100)" },
    returns: "Map by id: { id, accountId, date, title, category, amount (negative is out), currency, status, reference? }.", errors: ["ACCOUNT_NOT_FOUND", "INVALID_INPUT", "NOT_SUPPORTED"],
  },
  { adapter: "bank.statements.get", suggestedId: "statement", description: "A statement for an account and period: opening, closing, totals, posted transactions.", input: { accountId: "id", from: "YYYY-MM-DD", to: "YYYY-MM-DD" }, returns: "{ accountId, currency, from, to, opening, credits, debits, closing, count, transactions }", errors: ["ACCOUNT_NOT_FOUND", "INVALID_DATE", "NOT_SUPPORTED"] },
  {
    adapter: "bank.cards.issued", suggestedId: "issuedCards", description: "The cards the bank issued, with status and limits",
    input: {}, returns: "Map by id (debit, credit, a virtual card under its parent): { id, kind, virtual, parentCardId, network, last4, holder, expiry, nickname, name 'Everyday debit ••9021', status inactive|active|frozen|blocked|expired|replaced, pill, number, holderLine, line, accountId, credit, controls { online, contactless, abroad, atm }, limits { perTransaction, dailyPurchases, monthly, dailyAtm }, ceilings, pinSet, locked, can { freeze, unfreeze, controls, pin, activate, replace, createVirtual } }.", errors: ["NOT_SUPPORTED"],
  },
  {
    adapter: "bank.cards.eligible", suggestedId: "eligibleCards", description: "The cards a journey offers, and the first it can use",
    input: { for: "view | activate | controls | pin | replace | virtual" }, returns: "{ count, usable, firstId ('' if none), cards: map as bank.cards.issued, for a select source }. A card offered but not usable says why when chosen.", errors: ["NOT_SUPPORTED"],
  },
  { adapter: "bank.cards.get", suggestedId: "issuedCard", description: "One issued card.", input: { cardId: "id" }, returns: "The card as bank.cards.issued shows it.", errors: ["CARD_NOT_FOUND", "NOT_SUPPORTED"] },
  {
    adapter: "bank.cards.transactions", suggestedId: "cardActivity", description: "A card's spending, newest first",
    input: { cardId: "optional: all cards", status: "pending | posted | disputed", q: "merchant", limit: "default 10, to 100" },
    returns: "{ items [ { id, cardId, cardName, merchant, amountText, status, pending, when, channelLabel, country, disputeId, reportable, notice, line } ], choices (select source), total, more, empty }.", errors: ["CARD_NOT_FOUND"],
  },
  {
    adapter: "bank.cards.verifyActivation", suggestedId: "verifyActivation", description: "Checks a card's last 4, expiry and code; counts tries",
    input: { cardId: "id", last4: "4 digits", expiry: "MM/YY", securityCode: "3 digits, optional (000 never matches)" }, returns: "{ verified, code '' | ACTIVATION_MISMATCH | ACTIVATION_LOCKED, triesLeft, locked }: a wrong try is an answer. The third locks the card.", errors: ["CARD_NOT_FOUND", "CARD_ALREADY_ACTIVE", "CARD_BLOCKED", "CARD_EXPIRED (a past date, no try used)"],
  },
  {
    adapter: "bank.cards.activate", suggestedId: "activateCard", description: "Activates a checked card; sets its PIN if given",
    input: { cardId: "id", pin: "optional, 4 digits (not easy or built from card, birth date, phone, accounts)" },
    returns: "{ cardId, status 'active', pinSet, name }. The PIN is kept only as a hash.", errors: ["CARD_NOT_FOUND", "CARD_ALREADY_ACTIVE", "CARD_BLOCKED", "ACTIVATION_MISMATCH", "ACTIVATION_LOCKED", "PIN_INVALID", "PIN_WEAK"],
  },
  { adapter: "bank.cards.freeze", suggestedId: "freezeCard", description: "Freezes an active card at once; no code", input: { cardId: "id" }, returns: "{ cardId, status 'frozen', name }", errors: ["CARD_NOT_FOUND", "CARD_NOT_ACTIVE", "CARD_ALREADY_FROZEN"] },
  { adapter: "bank.cards.unfreeze", suggestedId: "unfreezeCard", description: "Unfreezes a frozen card, after the code", input: { cardId: "id" }, returns: "{ cardId, status 'active', name }", requiresOtp: true, errors: ["CARD_NOT_FOUND", "CARD_NOT_FROZEN", "OTP_REQUIRED"] },
  { adapter: "bank.cards.block", suggestedId: "blockCard", description: "Blocks a card for good; no code", input: { cardId: "id", reason: "lost | stolen | fraud" }, returns: "{ cardId, status 'blocked', reference, name }", errors: ["CARD_NOT_FOUND", "CARD_ALREADY_BLOCKED", "CARD_NOT_ACTIVE", "REASON_INVALID"] },
  {
    adapter: "bank.cards.controls.update", suggestedId: "updateControls", description: "Freezes, sets limits, places, a trip and alerts",
    input: { cardId: "id", status: "frozen | active", "perTransaction, dailyPurchases, monthly, dailyAtm": "limits: up to the card's ceiling, each not above the next", "allowContactless, allowOnline, allowAbroad, allowAtm": "booleans", "tripCountry, tripFrom, tripTo": "all three (up to 90 days, today to 120 days ahead); all empty clears it", "alertEvery, alertLarge, alertFrom, alertOnline": "alertFrom 1 to 100000", dryRun: "true: check only, no code" },
    returns: "{ cardId, name, changes [ { key, label, before, after } ], loosened, needsCode, kind freeze|unfreeze|changes, changed, status }. Loosening: unfreeze, a higher limit, a control on, a trip.", requiresOtp: true,
    errors: ["CARD_NOT_FOUND", "CARD_NOT_ACTIVATED", "CARD_NOT_ACTIVE", "CARD_FROZEN", "LIMIT_INVALID", "LIMIT_ABOVE_CEILING", "TRIP_INVALID", "ALERT_INVALID", "NOTHING_CHANGED", "OTP_REQUIRED"],
  },
  {
    adapter: "bank.cards.virtual.create", suggestedId: "createVirtual", description: "Makes a virtual card, after the code; details once",
    input: { cardId: "the active physical card", purpose: "Online shopping | Subscriptions | One-time purchase", limit: "1.00 to 5000.00", singleUse: "true: closes after one payment (always for One-time purchase)", dryRun: "true: apply every rule and make nothing (no code)" },
    returns: "{ cardId, parentName, purpose, limit, limitText, per, lasts, singleUse } and, once made, id, last4, expiry, status, number, cvv (shown once; only the last four are kept).", requiresOtp: true,
    errors: ["CARD_NOT_FOUND", "CARD_NOT_ACTIVE", "VIRTUAL_LIMIT_REACHED (5)", "PURPOSE_INVALID", "LIMIT_INVALID", "LIMIT_ABOVE_CEILING", "OTP_REQUIRED"],
  },
  { adapter: "bank.cards.virtual.delete", suggestedId: "deleteVirtual", description: "Deletes (blocks) a virtual card", input: { cardId: "id" }, returns: "{ cardId, status 'blocked' }", errors: ["CARD_NOT_FOUND", "CARD_ALREADY_BLOCKED"] },
  {
    adapter: "bank.cards.replace", suggestedId: "replaceCard", description: "Orders a replacement card, after the code",
    input: { cardId: "id", reason: "lost | stolen (block first) | damaged | expired (or 60 days or fewer left)", speed: "standard (free, 5 working days) | express (2 days, 15.00 unless fee is false)", where: "home | other", "line, city, postcode": "other: 3-60, 2-40, 3-10 characters (no postcode in market D)", fee: "false: no fee" },
    returns: "{ cardId, name, reason, speed, fee, feeText, deliveryText, deliverTo, oldCard, reference, newCardId, last4, newStatus, arrivesBy }. The fee comes from the card's account.", moneyMoving: true, requiresOtp: true,
    errors: ["CARD_NOT_FOUND", "CARD_VIRTUAL", "REPLACEMENT_PENDING", "CARD_REPLACED", "CARD_NOT_ACTIVATED", "REASON_INVALID", "CARD_NOT_BLOCKED", "ADDRESS_INVALID", "DELIVERY_INVALID", "INSUFFICIENT_FUNDS", "OTP_REQUIRED"],
  },
  { adapter: "bank.cards.replace.check", suggestedId: "checkReplace", description: "Checks a replacement order; changes nothing", input: { "...": "as bank.cards.replace" }, returns: "The summary of bank.cards.replace without the order.", errors: ["the errors of bank.cards.replace except OTP_REQUIRED"] },
  {
    adapter: "bank.cards.pin.set", suggestedId: "setPin", description: "Sets or changes a card PIN, after the code",
    input: { cardId: "id", pin: "4 digits; with blockWeak not a repeat, a run, a pattern or part of the card number or expiry", blockWeak: "false when off" }, returns: "{ cardId, firstSet, pinSet, name }", requiresOtp: true,
    errors: ["CARD_NOT_FOUND", "CARD_VIRTUAL", "CARD_NOT_ACTIVATED", "CARD_NOT_ACTIVE", "PIN_INVALID", "PIN_WEAK", "OTP_REQUIRED"],
  },
  { adapter: "bank.disputes.reasons", suggestedId: "disputeReasons", description: "The reasons a card payment can be reported", input: {}, returns: "{ reasons [ { id, name, asks } ], days30, days60, days90 (maps of dates for the selects), windowDays 120 }." },
  {
    adapter: "bank.disputes.check", suggestedId: "checkDispute", description: "Whether a card payment can be reported",
    input: { cardId: "id", transactionId: "id" }, returns: "The payment as bank.cards.transactions shows it, plus cardActive and cardName.", errors: ["CARD_NOT_FOUND", "TRANSACTION_NOT_FOUND", "TRANSACTION_PENDING", "NOT_A_PAYMENT_OUT", "NOT_A_CARD_PAYMENT", "DISPUTE_EXISTS", "DISPUTE_WINDOW_CLOSED (120 days)"],
  },
  {
    adapter: "bank.disputes.create", suggestedId: "createDispute", description: "Reports a card payment; no money moves, no code",
    input: { cardId: "id", transactionId: "id", reason: "from dispute.reasons", details: "{ cardInPossession yes|no, otherChargeDate, expectedAmount (not the amount charged), ordered (3+), arrivedBy, contacted yes|no, cancelledOn, cancellationRef, text (10+) } by reason, as an object or as the same keys beside reason", blockCard: "true: block the card (only for 'I don’t recognise it' on an active card)", evidence: "optional [ { name } ]", evidenceName: "or one file name" },
    returns: "{ disputeId DSP-..., status 'under_review', statusLabel, replyBy, cardBlocked, merchant, amountText, reason, evidence }", errors: ["CARD_NOT_FOUND", "TRANSACTION_NOT_FOUND", "TRANSACTION_PENDING", "NOT_A_PAYMENT_OUT", "NOT_A_CARD_PAYMENT", "DISPUTE_EXISTS", "DISPUTE_WINDOW_CLOSED", "REASON_INVALID", "DETAILS_INVALID", "DISPUTE_AMOUNT_INVALID"],
  },
  { adapter: "bank.disputes.list", suggestedId: "disputes", description: "The cases opened on card payments", input: { cardId: "optional" }, returns: "Map by case id: { id, cardId, transactionId, reason, amountText, status, cardBlocked }." },
  { adapter: "bank.deposits.list", suggestedId: "deposits", description: "Term deposits", input: { pick: "true: { items, count, firstId } instead of the map" }, returns: "Map by id: { id, name (the amount), title, sub, principal, ratePercent, termMonths, openedOn, maturesOn, status, accountId, amountText, rateText, maturesText, line, renewalText ('Renews for 12 months' once chosen) }.", errors: ["NOT_SUPPORTED"] },
  { adapter: "bank.deposits.terms", suggestedId: "terms", description: "The four terms with rate and maturity date", input: { allowMonthly: "false: monthly interest not offered" }, returns: "{ terms, renewTerms: maps '3'|'6'|'12'|'24' of { id, name, sub, months, rateText, maturesText } (sub: the maturity, or the rate for a renewal), allowMonthly }" },
  {
    adapter: "bank.deposits.quote", suggestedId: "depositQuote", description: "Prices a deposit and checks the account; changes nothing",
    input: { amount: "1000 to 250000, at most 2 decimals", term: "3 | 6 | 12 | 24 months", payout: "maturity | monthly", allowMonthly: "false: monthly refused", fromAccountId: "the account that pays (optional)" },
    returns: "{ amountText, termText, rateText, interestText, maturesText, receiveText (the amount alone when payout is monthly), payoutText, from }",
    errors: ["AMOUNT_REQUIRED", "AMOUNT_DECIMALS", "BELOW_MINIMUM", "ABOVE_MAXIMUM", "TERM_INVALID", "PAYOUT_INVALID", "PAYOUT_OFF", "ACCOUNT_NOT_FOUND", "ACCOUNT_CANNOT_DEBIT", "INSUFFICIENT_FUNDS"],
  },
  {
    adapter: "bank.deposits.open", suggestedId: "openDeposit", description: "Opens a term deposit, after the code",
    input: { "...": "as bank.deposits.quote, fromAccountId required", dryRun: "true: the quote, no code" }, returns: "The quote plus depositId, reference. The amount leaves the account.", moneyMoving: true, requiresOtp: true,
    errors: ["the errors of bank.deposits.quote", "OTP_REQUIRED"],
  },
  {
    adapter: "bank.deposits.renew", suggestedId: "renewDeposit", description: "Changes the term and what happens at maturity, after the code; no money moves",
    input: { depositId: "id", term: "3 | 6 | 12 | 24", instruction: "renew | renew-payout | payout", dryRun: "true: the summary, no code" },
    returns: "{ depositText, termText, rateText, instructionText, effectText, renewsText } and reference", requiresOtp: true, errors: ["DEPOSIT_NOT_FOUND", "TERM_INVALID", "INSTRUCTION_INVALID", "OTP_REQUIRED"],
  },
  { adapter: "bank.deposits.renew.quote", suggestedId: "renewQuote", description: "Checks a renewal and says what it does; changes nothing", input: { depositId: "id", term: "3 | 6 | 12 | 24", instruction: "renew | renew-payout | payout" }, returns: "As bank.deposits.renew without the reference", errors: ["DEPOSIT_NOT_FOUND", "TERM_INVALID", "INSTRUCTION_INVALID"] },
  { adapter: "bank.deposits.close.quote", suggestedId: "closeQuote", description: "What closing a deposit early pays: interest, the charge, the net", input: { depositId: "id", earlyClose: "false: early closure is off" }, returns: "{ depositText, days, earnedText, chargeText (half the interest, negative), netText }", errors: ["DEPOSIT_NOT_FOUND", "EARLY_CLOSE_OFF"] },
  {
    adapter: "bank.deposits.close", suggestedId: "closeDeposit", description: "Closes a deposit early and pays the net into an account, after the code",
    input: { depositId: "id", toAccountId: "id", earlyClose: "false: refused" }, returns: "The quote plus reference, paidInto. The deposit is gone.", moneyMoving: true, requiresOtp: true,
    errors: ["DEPOSIT_NOT_FOUND", "EARLY_CLOSE_OFF", "ACCOUNT_NOT_FOUND", "ACCOUNT_CANNOT_CREDIT", "OTP_REQUIRED"],
  },
  { adapter: "bank.goals.list", suggestedId: "goals", description: "Savings goals", input: { pick: "true: { items, count, firstId } instead of the map" }, returns: "Map by id: { id, name, sub, target, saved, targetDate, savedText, ofText, pct, pctText, reached, byText ('By 30 Jun 2027' or 'Goal reached'), line, autoOn, autoAmount, autoText }.", errors: ["NOT_SUPPORTED"] },
  { adapter: "bank.goals.months", suggestedId: "months", description: "The next 36 month ends, from next month", input: {}, returns: "{ months: map of { id (YYYY-MM-DD, the last day), name ('December 2026') } } for a select" },
  { adapter: "bank.goals.plan", suggestedId: "plan", description: "What it takes to reach a target by a month", input: { target: "amount", date: "a month end", saved: "optional, taken off" }, returns: "{ months (this month counts), monthly, monthlyText, byText, line, suggested (at least 5.00), reachedAlready }", errors: ["AMOUNT_REQUIRED"] },
  {
    adapter: "bank.goals.create", suggestedId: "createGoal", description: "Creates a goal; no code",
    input: { name: "2 to 30 characters", target: "50 to 1000000", date: "a month end from goals.months", auto: "{ on, fromAccountId, amount (5 or more) } or flat autoOn, autoAmount, fromAccountId", allowAuto: "false: a top-up is refused", dryRun: "true: check only" },
    returns: "{ goalId, name, targetText, byText, autoText } and reference. A top-up shows in bank.schedule.list.",
    errors: ["GOAL_LIMIT (10)", "NAME_INVALID", "AMOUNT_REQUIRED", "AMOUNT_DECIMALS", "TARGET_BELOW", "TARGET_ABOVE", "DATE_REQUIRED", "DATE_INVALID", "AUTO_OFF", "AUTO_REQUIRED", "AUTO_BELOW", "ACCOUNT_NOT_FOUND"],
  },
  { adapter: "bank.goals.update", suggestedId: "updateGoal", description: "Changes a goal's name, target, month and top-up; no code", input: { goalId: "id", "...": "as bank.goals.create" }, returns: "As bank.goals.create. A top-up is replaced, switched off it is removed.", errors: ["GOAL_NOT_FOUND", "the errors of bank.goals.create except GOAL_LIMIT"] },
  {
    adapter: "bank.goals.contribute", suggestedId: "addToGoal", description: "Adds money to a goal from an account; no code",
    input: { goalId: "id", amount: "1 or more", fromAccountId: "id" }, returns: "{ savedText ('$3,300.00 of $5,000.00'), reached, reachedText, amountText, fromName, goalName, reference }. A goal can go above its target.", moneyMoving: true,
    errors: ["GOAL_NOT_FOUND", "AMOUNT_REQUIRED", "AMOUNT_DECIMALS", "AMOUNT_BELOW", "ACCOUNT_NOT_FOUND", "ACCOUNT_CANNOT_DEBIT", "INSUFFICIENT_FUNDS"],
  },
  {
    adapter: "bank.goals.withdraw", suggestedId: "takeFromGoal", description: "Takes money out of a goal into an account; no code",
    input: { goalId: "id", amount: "1 up to what is saved", toAccountId: "id", allowWithdraw: "false: refused" }, returns: "{ savedText, amountText, intoName, goalName, reference }", moneyMoving: true,
    errors: ["GOAL_NOT_FOUND", "WITHDRAW_OFF", "AMOUNT_REQUIRED", "AMOUNT_BELOW", "ABOVE_SAVED", "ACCOUNT_NOT_FOUND", "ACCOUNT_CANNOT_CREDIT"],
  },
  { adapter: "bank.schedule.list", suggestedId: "scheduled", description: "The monthly top-ups of goals as scheduled payments", input: {}, returns: "Map by id (goal:g1): { id, name ('Goal: Holiday fund'), kind 'goal', goalId, amountText, fromAccountId, nextText, sub ('Monthly · 1 Dec') }." },
  { adapter: "bank.loans.list", suggestedId: "loans", description: "Loans, without their schedule", input: { pick: "true: { items, count, firstId } instead of the map" }, returns: "Map by id: { id, name, sub, original, outstanding, ratePercent, monthlyPayment, nextDue, paymentsLeft, leftText, pct, pctText, nextAmountText, nextText ('Next payment $412.50 on 1 Dec 2026') }.", errors: ["NOT_SUPPORTED"] },
  { adapter: "bank.loans.get", suggestedId: "loan", description: "One loan with the cost of each way to pay it", input: { loanId: "id", settleFee: "false: no early settlement fee" }, returns: "{ …loan, nextSub ('Due 1 Dec 2026'), interestText, principalText, settle: { balanceText, interestText, feeText, totalText, sub } }", errors: ["LOAN_NOT_FOUND", "NOT_SUPPORTED"] },
  {
    adapter: "bank.loans.quote", suggestedId: "loanQuote", description: "The rate table, or the checks of a loan request",
    input: { amount: "1000 to 50000 in steps of 500 (leave out for the table)", term: "12 | 24 | 36 | 48 | 60 months" },
    returns: "{ rates: map by term of { term, rate, factor }, min, max, step } and, with an amount, ok, rate, rateText, payment, paymentText. A screen shows the payment as amount x factor.",
    errors: ["LOAN_LIMIT (3)", "AMOUNT_REQUIRED", "AMOUNT_RANGE", "AMOUNT_STEP", "TERM_INVALID"],
  },
  {
    adapter: "bank.loans.eligibility", suggestedId: "decide", description: "Decides a loan request: approved, referred or declined",
    input: { amount: "as loans.quote", term: "months", purpose: "Home improvement | Car | Education | Medical | Travel | Debt consolidation | Other", employment: "Employed | Self-employed | Retired | Student | Not working", income: "monthly after tax, above 0, up to 1000000", commitments: "monthly payments, 0 or more", allowReferral: "false: a referral is a decline", arrFee: "false: no 1% fee" },
    returns: "{ decision, reason ('income' | 'affordability' | 'review' | ''), rate, payment, ratio, reference } and, approved, offer: { loanText, termText, rateText, paymentText, interestText, feeText, totalText, firstText, payoutText }. An approval keeps the offer a loan can be made from.",
    errors: ["LOAN_LIMIT", "AMOUNT_RANGE", "AMOUNT_STEP", "TERM_INVALID", "PURPOSE_INVALID", "EMPLOYMENT_INVALID", "INCOME_INVALID", "COMMITMENTS_INVALID"],
  },
  {
    adapter: "bank.loans.apply", suggestedId: "applyLoan", description: "Makes the approved loan and pays it into an account, after the code",
    input: { amount: "the offer's", term: "the offer's", rate: "the offer's, for example 9.9", accountId: "account to pay into and repay from" }, returns: "{ loanId, reference, name ('Car loan'), paidIntoText, paymentText, feeText, firstText, paidOutText }. The account gets the loan less the fee.", moneyMoving: true, requiresOtp: true,
    errors: ["LOAN_LIMIT", "OFFER_NOT_FOUND", "ACCOUNT_NOT_FOUND", "ACCOUNT_CANNOT_CREDIT", "OTP_REQUIRED"],
  },
  {
    adapter: "bank.loans.repay", suggestedId: "repayLoan", description: "Pays the next instalment or another amount, after the code",
    input: { loanId: "id", option: "next | custom", amount: "custom: 10 up to just below the balance", fromAccountId: "id", dryRun: "true: the summary, no code" },
    returns: "{ loanName, fromName, paidText, balanceText, next ('1 Jan 2027'), resultText } and reference. An instalment lowers the balance by its principal and moves the date a month.", moneyMoving: true, requiresOtp: true,
    errors: ["LOAN_NOT_FOUND", "OPTION_INVALID", "AMOUNT_REQUIRED", "REPAY_BELOW", "REPAY_ABOVE", "ACCOUNT_NOT_FOUND", "ACCOUNT_CANNOT_DEBIT", "INSUFFICIENT_FUNDS", "OTP_REQUIRED"],
  },
  { adapter: "bank.loans.settlement.quote", suggestedId: "settleQuote", description: "What settling a loan costs today", input: { loanId: "id", settleFee: "false: no fee" }, returns: "{ balanceText, interestText (since the last payment), feeText (1% of the balance with more than 12 payments left), totalText, sub }", errors: ["LOAN_NOT_FOUND"] },
  {
    adapter: "bank.loans.settle", suggestedId: "settleLoan", description: "Pays a loan off in full, after the code",
    input: { loanId: "id", fromAccountId: "id", settleFee: "false: no fee", dryRun: "true: the summary, no code" }, returns: "The settlement plus loanName, fromName, paidText, reference. The loan is gone.", moneyMoving: true, requiresOtp: true,
    errors: ["LOAN_NOT_FOUND", "ACCOUNT_NOT_FOUND", "ACCOUNT_CANNOT_DEBIT", "INSUFFICIENT_FUNDS", "OTP_REQUIRED"],
  },
  { adapter: "bank.funds.list", suggestedId: "funds", description: "The shelf of four funds, all and by risk", input: { allowHigh: "false: no high-risk funds" }, returns: "{ funds: { all, low, medium, high } each a map of { id, name, sub, riskText, chargeText, minText, priceText, price, min, charge }, count }" },
  { adapter: "bank.funds.get", suggestedId: "fund", description: "One fund, or the check of a purchase or a sale", input: { fundId: "gov | bal | geq | tech", "amount, fromAccountId": "with either: the check of bank.funds.buy (no code)", sell: "true: the check of bank.funds.sell (with amount or all, toAccountId)" }, returns: "{ id, name, riskText, charge, chargeText, min, minText, price, priceText, about }, or the summary of the buy or sell", errors: ["FUND_NOT_FOUND", "the errors of bank.funds.buy or sell"] },
  { adapter: "bank.funds.holdings", suggestedId: "fundHoldings", description: "The funds the customer holds", input: { pick: "true: { items, count, firstId } instead of the map" }, returns: "Map by fund id: { id, name, units, unitsText, cost, value, valueText, sub ('150 units · $2,400.00') }." },
  { adapter: "bank.funds.portfolio", suggestedId: "portfolio", description: "The value of all holdings and the gain against cost", input: {}, returns: "{ count, valueText, cost, gain, up, gainText ('▲ $170.00 (3.7%) since you invested') }" },
  {
    adapter: "bank.funds.buy", suggestedId: "buyFund", description: "Buys units of a fund from an account, after the code",
    input: { fundId: "id", amount: "at least the fund's smallest", fromAccountId: "id", allowHigh: "false: high-risk funds are closed", dryRun: "true: the summary, no code" },
    returns: "{ name, riskText, fromName, amountText, unitsText (3 decimals), priceText, chargeText, chargeAbout } and reference. A fund held already grows.", moneyMoving: true, requiresOtp: true,
    errors: ["FUND_NOT_FOUND", "FUND_CLOSED", "AMOUNT_REQUIRED", "BELOW_MINIMUM", "ACCOUNT_NOT_FOUND", "ACCOUNT_CANNOT_DEBIT", "INSUFFICIENT_FUNDS", "OTP_REQUIRED"],
  },
  {
    adapter: "bank.funds.sell", suggestedId: "sellFund", description: "Sells part or all of a holding into an account, after the code",
    input: { fundId: "id", amount: "10 up to the value (or all: true)", all: "true: everything", toAccountId: "id", sellFee: "false: no 0.25% fee", dryRun: "true: the summary, no code" },
    returns: "{ name, soldText, feeText (negative), proceedsText, settlesText (2 business days), intoName, everything } and reference. The account is credited at once.", moneyMoving: true, requiresOtp: true,
    errors: ["FUND_NOT_FOUND", "NOTHING_TO_SELL", "AMOUNT_REQUIRED", "SELL_BELOW", "ABOVE_HOLDING", "ACCOUNT_NOT_FOUND", "ACCOUNT_CANNOT_CREDIT", "OTP_REQUIRED"],
  },
  { adapter: "bank.accounts.payFrom", suggestedId: "payFrom", description: "The accounts that can pay, with what is available", input: {}, returns: "{ accounts: map of { id, name ('Main ••4410'), sub ('$8,602.36 available'), available, status }, count, firstId, defaultId }" },
  { adapter: "bank.deposit.cards", suggestedId: "topupCards", description: "The saved cards that can top up an account", input: {}, returns: "{ cards: map of { id, name ('Visa ••4242'), sub ('Harbor Bank · expires 09/28') } (not expired), count, firstId, hasExpired, expired, expiredText }" },
  { adapter: "bank.messages.list", suggestedId: "messages", description: "Secure conversations with the bank, newest first", input: {}, returns: "Map by thread id: { id, reference, subject, topic, status (Open | Answered | Closed), unread, preview (70 characters), dateText, lastFrom, hasFile, closed }. Empty: {}.", errors: ["NOT_SUPPORTED"] },
  { adapter: "bank.messages.get", suggestedId: "thread", description: "One conversation with every message, oldest first", input: { threadId: "id" }, returns: "{ id, reference, subject, topic, status, unread, closed, messages: [{ id, mine, who, timeText, text, fileName, fileText }] }. Text is what the person wrote: show it as text.", errors: ["THREAD_NOT_FOUND"] },
  { adapter: "bank.messages.markRead", suggestedId: "markRead", description: "Marks a conversation read", input: { threadId: "id" }, returns: "{ ok }", errors: ["THREAD_NOT_FOUND"] },
  {
    adapter: "bank.messages.send", suggestedId: "sendMessage", description: "Starts a conversation with a topic, a subject, text and one optional file; no code, no money",
    input: { topic: "Account | Cards | Payments | Fraud or security | Feedback | Something else", subject: "3 to 80 characters", text: "10 to 1000 characters", fileName: "optional: pdf, jpg or png", fileSize: "bytes, at most 5 MB", allowFile: "false: no attachment", accountId: "optional" },
    returns: "{ threadId, reference }. The bank answers two seconds later (sandbox clock).", errors: ["TOPIC_INVALID", "SUBJECT_INVALID", "TEXT_INVALID", "FILE_TYPE", "FILE_TOO_LARGE", "FILE_NOT_ALLOWED"],
  },
  { adapter: "bank.messages.reply", suggestedId: "reply", description: "Adds a reply to an open conversation", input: { threadId: "id", text: "2 to 1000 characters" }, returns: "{ messageId }", errors: ["THREAD_NOT_FOUND", "THREAD_CLOSED", "REPLY_INVALID"] },
  { adapter: "bank.requests.options", suggestedId: "requestOptions", description: "What the service request form offers", input: { accountId: "optional: the account whose type is changed" }, returns: "{ kinds, accounts, branches, letters (maps of { id, name }), currentType, changeTo (types without the current one), cardJourney ('' when no card journey is on) }" },
  {
    adapter: "bank.requests.create", suggestedId: "createRequest", description: "Sends a service request; no code, no money",
    input: { type: "cheque | letter | acctype | other (lost is refused)", accountId: "id", leaves: "25 | 50", delivery: "Post to my address | Collect at a branch (letter: Email | Post | Collect at a branch)", branch: "when collecting", letter: "a letter kind", addressedTo: "optional", changeTo: "Everyday | Savings | Premium", reason: "optional", subject: "other", details: "other, 10 to 500" },
    returns: "{ reference (SR-...), requestId, status 'Received', title, account, leaves, delivery, letter, addressedTo, changeTo, subject }", errors: ["USE_CARD_OPTIONS", "TYPE_UNAVAILABLE", "ACCOUNT_NOT_FOUND", "DUPLICATE", "SAME_TYPE", "SUBJECT_INVALID", "DETAILS_INVALID"],
  },
  { adapter: "bank.requests.list", suggestedId: "requests", description: "The customer's service requests, newest first", input: {}, returns: "Map by id: { id, reference, kind, title, date, status (Received | In progress | Done | Cancelled), rows: [{ label, value }], canCancel, line }.", errors: ["NOT_SUPPORTED"] },
  { adapter: "bank.requests.get", suggestedId: "request", description: "One service request", input: { requestId: "id" }, returns: "As one entry of bank.requests.list.", errors: ["REQUEST_NOT_FOUND"] },
  { adapter: "bank.requests.cancel", suggestedId: "cancelRequest", description: "Cancels a request that is only Received", input: { requestId: "id" }, returns: "{ status: 'Cancelled' }", errors: ["REQUEST_NOT_FOUND", "ALREADY_STARTED"] },
  { adapter: "bank.profile.get", suggestedId: "profile", description: "The customer's profile", input: {}, returns: "{ name, email, phone, dateOfBirth, customerSince, address, addressText, customerId, kycLevel, phoneMasked, emailMasked, pending: { mobile, email, address } }", errors: ["NOT_SUPPORTED"] },
  { adapter: "bank.profile.contacts", suggestedId: "contacts", description: "Contact details masked, what waits, and what the home market asks for", input: {}, returns: "{ market, mobileHint, phoneEnding, state, postal, mobileMasked, emailMasked, addressText, pending, choices: map of { id, name } for a select }", errors: ["NOT_SUPPORTED"] },
  {
    adapter: "bank.profile.update", suggestedId: "updateProfile", description: "Changes the mobile number, the email or the address, after the code; dryRun checks only",
    input: { field: "mobile | email | address", value: "mobile or email", line1: "address", line2: "optional", city: "address", state: "market A", postal: "not market D", proofName: "pdf, jpg or png when proof is asked", dryRun: "true: every rule, no code, no change", verifyNewMobile: "false: no code to the new number", verifyEmail: "false: applies at once", verifyAddress: "false: applies at once", requireProof: "true: proof of address" },
    returns: "{ reference, field, fieldName, status 'updated' | 'pending', statusText, valueText (masked), title, text, oldTold }. The old and the new contact are told.", requiresOtp: true,
    errors: ["INVALID_MOBILE", "INVALID_EMAIL", "INVALID_POSTAL", "ADDRESS_INCOMPLETE", "SAME_VALUE", "CONTACT_IN_USE", "ALREADY_PENDING", "PROOF_REQUIRED", "FILE_TYPE", "OTP_REQUIRED", "CONTACT_NOT_VERIFIED"],
  },
  { adapter: "bank.profile.sendContactCode", suggestedId: "sendContactCode", description: "Sends a code to the new mobile number", input: { channel: "sms", value: "the new number" }, returns: "{ sent, masked }", errors: ["INVALID_MOBILE", "SAME_VALUE"] },
  { adapter: "bank.profile.verifyContact", suggestedId: "verifyContact", description: "Checks the code sent to the new number", input: { channel: "sms", value: "the new number", code: "6 digits" }, returns: "{ verified }", errors: ["OTP_REQUIRED", "OTP_INVALID", "OTP_EXPIRED", "OTP_LOCKED"] },
  { adapter: "bank.accounts.linked", suggestedId: "linked", description: "Accounts at other banks the customer connected, read only", input: {}, returns: "Map by id: { id, bank, name, title, maskedNumber, balanceText, readOnly, line ('At Maple (read only)'), connectedText, untilText }" },
  { adapter: "bank.connections.banks", suggestedId: "connectBanks", description: "Banks to connect, and the banks already connected", input: {}, returns: "{ banks: map of { id, name } not yet connected, count, connected: [{ id, bank, accounts, untilText, line }], connectedCount, sharingDays, untilText, market }" },
  { adapter: "bank.connections.start", suggestedId: "startConnection", description: "Starts a connection: the other bank's own sign-in, then its accounts", input: { bankId: "id", allowCards: "false: no credit card" }, returns: "{ state, bank, count, accounts: [{ index, kind, label, balanceText }] }", errors: ["BANK_NOT_FOUND", "ALREADY_CONNECTED", "BANK_UNAVAILABLE"] },
  {
    adapter: "bank.connections.finish", suggestedId: "finishConnection", description: "Connects the chosen accounts, read only; denied: true refuses", input: { state: "from start", consent: "true", pick1: "account 1 on", pick2: "account 2 on", pick3: "account 3 on", denied: "true: the person said no" },
    returns: "{ bank, accounts, untilText, days }", errors: ["ACCESS_DENIED", "STATE_INVALID", "CONSENT_REQUIRED", "NO_ACCOUNT_CHOSEN", "ALREADY_CONNECTED"],
  },
  { adapter: "bank.connections.remove", suggestedId: "disconnectBank", description: "Disconnects a bank and removes its accounts", input: { bankId: "id" }, returns: "{ removed, bank }", errors: ["LINK_NOT_FOUND"] },
  { adapter: "sandbox.more.inspect", suggestedId: "inspectMore", description: "For scenarios only: what the bank sent and logged, never a value", input: {}, returns: "{ outbox: [{ to (masked), channel, kind }], log, pending, threads, requests }" },
  { adapter: "sandbox.more.advance", suggestedId: "advanceMore", description: "For scenarios only: closes a conversation, starts work on a request or sets it back to Received", input: { what: "close-thread | start-request | reset-request", id: "id" }, returns: "{ ok }" },
  // ---- Before sign-in (BankWorkx, Public): answer for anyone, never with account data; the public journeys are in docs/BANKWORKX.md ----
  { adapter: "bank.products.list", suggestedId: "products", description: "The bank's public products by group", input: { type: "account | card | deposit | loan, optional" }, returns: "Map by id in the bank's order: { id, type, name, tagline, rank, headline: { label, value }, facts, fees, eligibility, needed, termsVersion, action }." },
  { adapter: "bank.products.get", suggestedId: "product", description: "One public product with all its facts", input: { productId: "id" }, returns: "A product as in bank.products.list.", errors: ["PRODUCT_NOT_FOUND"] },
  {
    adapter: "bank.rates.loans", suggestedId: "loanRates", description: "The loan table; with type, amount and term the exact payment, interest and total",
    input: { type: "personal | auto | home, for a quote", amount: "whole units, for a quote", term: "months, for a quote", showHome: "false: no home loans" },
    returns: "{ symbol, currency, market, home, order, loans: map by type of { type, name, apr, termChoices (a select), amountMin, amountMax, amountStep, startAmount, termMin, termMax, termStep, startTerm, factors: map by term of { term, text, pay, total } (per 1 unit in 1e-12, for a live payment) }, quote?: { paymentCents, interestCents, totalCents, *Text, termText, apr, reference EST-... } }. Whole cents, no float.",
    errors: ["LOAN_TYPE_INVALID", "AMOUNT_REQUIRED", "AMOUNT_RANGE", "AMOUNT_STEP", "TERM_INVALID"],
  },
  {
    adapter: "bank.rates.deposits", suggestedId: "depositRates", description: "The deposit rates by term; with amount and term the interest and what comes back",
    input: { amount: "whole units 500 to 100,000 in steps of 500, for a quote", term: "3 | 6 | 12 | 24 | 60 months", pay: "end | monthly", allowMonthly: "false: no monthly interest" },
    returns: "{ symbol, currency, market, allowMonthly, range, terms: map by months of { id, term, name, rateH (hundredths of a percent), rate, rateText }, quote?: { interestCents, returnCents, monthlyCents, *Text, payText, rateText, reference EST-... } }",
    errors: ["AMOUNT_REQUIRED", "AMOUNT_RANGE", "AMOUNT_STEP", "TERM_INVALID", "PAY_INVALID", "PAY_UNAVAILABLE"],
  },
  {
    adapter: "bank.locations.search", suggestedId: "places", description: "Branches and cash machines, nearest first, open or closed by their hours and the clock",
    input: { query: "name, address or area, up to 60", kind: "branch | atm | all", openNow: "true: only places open now", offerOpenNow: "false: the filter is not offered", showAtms: "false: no cash machines" },
    returns: "{ places: map by id nearest first of { id, name, kind, kindName, address, area, distanceText (mi or km by market), chip 'Open' | 'Closed', status ('Closes 20:00', 'Opens tomorrow 09:00'), lat, lng, icon }, count, firstId, unit, showAtms, openNowOffered, kind }",
  },
  { adapter: "bank.locations.details", suggestedId: "place", description: "One place with its seven opening-hours rows and its services", input: { placeId: "id" }, returns: "A place as in bank.locations.search plus { services: [text], servicesText, hours: { sunday ... saturday: 'Closed' | '09:00 to 17:00' | 'Open 24 hours' }, reference MAP-B1 }", errors: ["NOT_FOUND"] },
  {
    adapter: "bank.support.hours", suggestedId: "hours", description: "The ways to reach the bank (chat, call, message) with open or closed from their hours",
    input: { allowChat: "false: no chat", allowCall: "false: no call" },
    returns: "{ choices: map of { id, name, sub ('Ask an adviser online · Open now · Closes 20:00'), chip, status }, callHours: { sunday ... saturday }, callSummary, callReference CALL-..., secure (secure messages offered), topics }",
  },
  { adapter: "bank.support.openChat", suggestedId: "openChat", description: "Joins the chat queue; nothing is kept but a count", input: { topic: "Accounts | Cards | Payments | Loans and savings | Online and app banking | Something else", text: "5 to 300 characters", allowChat: "false: refused" }, returns: "{ queueId, reference CHAT-..., waitMinutes, topic }", errors: ["TOPIC_INVALID", "TEXT_INVALID", "WAY_UNAVAILABLE"] },
  { adapter: "bank.support.sendMessage", suggestedId: "sendSupport", description: "Sends a message to the bank; it keeps a masked address, never the text; 5 an hour per device", input: { topic: "as openChat", email: "name@host.tld, up to 80", text: "10 to 1000 characters" }, returns: "{ reference CS-..., topic, replyTo (masked), replyWithin }", errors: ["TOPIC_INVALID", "EMAIL_INVALID", "TEXT_INVALID", "RATE_LIMITED"] },
  {
    adapter: "bank.onboarding.begin", suggestedId: "begin", description: "The market's rules for opening an account and any application saved on this device",
    input: { fresh: "true: ignore a saved application", productId: "optional: acc_saver preselects it; loan_ and card_ products say to open an account first" },
    returns: "{ market, symbol, idHint, idMessage, postcode (asked), poa (asked), taxText, country, countries, incomeBands, depositBands, accounts: map of { id, name, sub }, preselect, welcome, allowSave, saved: { found, applicationId, name, savedText, idMasked, taxMasked, answers } }",
  },
  { adapter: "bank.onboarding.start", suggestedId: "startApplication", description: "Starts an application with a mobile number and an email; then bank.otp.send and verify", input: { mobile: "7 to 15 digits, optional +", email: "name@host.tld" }, returns: "{ applicationId, maskedMobile ('••• 4410') }", errors: ["PHONE_INVALID", "EMAIL_INVALID", "DUPLICATE_APPLICATION"] },
  {
    adapter: "bank.onboarding.check", suggestedId: "checkStep", description: "The bank's checks of one step of an application; changes nothing",
    input: { applicationId: "id", step: "about | address | poa | id | work | tax", name: "about", dob: "DD/MM/YYYY", nationality: "about", idNumber: "about, the market's format", line1: "address", city: "address", postcode: "address, not market D", country: "address", proofName: "poa", idDocument: "id: national-id | passport | licence", front: "id", back: "id, not a passport", employment: "work", income: "work: band id", source: "work", deposits: "work", taxOnly: "tax: yes | no", taxCountry: "tax", taxId: "tax" },
    returns: "{ ok, idMasked (step about) }", errors: ["NOT_VERIFIED", "NAME_INVALID", "NAME_PARTS", "DOB_FORMAT", "DOB_RANGE", "UNDER_AGE", "NATIONALITY_REQUIRED", "ID_INVALID", "ADDRESS_INCOMPLETE", "POSTCODE_INVALID", "POA_REQUIRED", "POA_TOO_OLD", "DOCUMENT_REQUIRED", "PHOTO_MISSING", "ID_UNREADABLE", "ID_EXPIRED", "WORK_INVALID", "TAX_REQUIRED", "TIN_INVALID"],
  },
  { adapter: "bank.onboarding.save", suggestedId: "saveOnboarding", description: "Saves the answers for 30 days: never photos, the code, the ID number or the tax ID (a hash and a mask)", input: { applicationId: "id", name: "any answer of check, flat", idNumber: "kept as a hash", taxId: "kept as a hash" }, returns: "{ savedUntil, savedText, days }", errors: ["NOT_VERIFIED", "APPLICATION_NOT_FOUND", "SAVE_OFF"] },
  { adapter: "bank.onboarding.discard", suggestedId: "discardApplication", description: "Discards the application saved on this device", input: { applicationId: "optional" }, returns: "{ ok }" },
  { adapter: "bank.onboarding.verifyIdentity", suggestedId: "verifyIdentity", description: "The selfie (live, good light) and the ID matching the details; a mismatch throws the photos away", input: { applicationId: "id", selfie: "photo reference", dob: "DD/MM/YYYY", idNumber: "the number typed" }, returns: "{ match }", errors: ["NOT_VERIFIED", "PHOTO_MISSING", "LIVENESS_LOW_LIGHT", "LIVENESS_FAILED", "ID_MISMATCH"] },
  {
    adapter: "bank.onboarding.submit", suggestedId: "submitApplication", description: "Sends the application; no account is opened, the bank decides after its checks",
    input: { applicationId: "id", answers: "name, dob, nationality, idNumber, line1, line2, city, postcode, country, employment, income, source, deposits, taxOnly, taxCountry, taxId (flat)", product: "an account the bank offers", terms: "true", taxConfirm: "true", signed: "true: the terms were signed", reviewHigh: "false: income over 1M not reviewed" },
    returns: "{ reference APP-..., status 'checking' | 'manual-review', productName, stage }", errors: ["NOT_VERIFIED", "IDENTITY_NOT_VERIFIED", "CONSENT_REQUIRED", "PRODUCT_UNAVAILABLE", "APPLICATION_NOT_ACCEPTED", "UNDER_AGE", "ID_INVALID", "POSTCODE_INVALID", "TIN_INVALID"],
  },
  { adapter: "bank.applications.find", suggestedId: "findApplication", description: "Finds an application by its number and the last 6 digits of the mobile; the status needs the code", input: { reference: "APP-123456", mobile: "7 to 18 digits" }, returns: "{ found, needsCode, maskedMobile }. One miss never says which part; the third wrong try or code locks it for 30 minutes.", errors: ["NOT_FOUND", "TRACK_LOCKED"] },
  { adapter: "bank.applications.status", suggestedId: "applicationStatus", description: "Where the application is: received, checking or ready, once found and (when asked) the code was right", input: {}, returns: "{ reference, product, productName, stage 'received' | 'checking' | 'ready', accountLast4 }", errors: ["FIND_FIRST", "OTP_REQUIRED", "TRACK_LOCKED"] },
  {
    adapter: "bank.registration.verify", suggestedId: "verifyCustomer", description: "An existing customer says who they are; the code goes to the mobile on file",
    input: { customerId: "8 digits", cardNumber: "13 or more digits that pass the check-digit test", day: "1 to 31", month: "1 to 12", year: "4 digits", applicationId: "a Ready application instead", allowCard: "false: a card number is refused" },
    returns: "{ registrationToken, maskedMobile ('••• 0177') }. Then bank.otp.send and verify. One miss never says which part; the third wrong check or code locks it for 30 minutes.",
    errors: ["CUSTOMER_ID_INVALID", "CARD_INVALID", "YEAR_INVALID", "DATE_INVALID", "DATE_FUTURE", "UNDER_AGE", "NOT_MATCHED", "ALREADY_REGISTERED", "ID_LOCKED"],
  },
  {
    adapter: "bank.registration.complete", suggestedId: "completeRegistration", description: "Chooses the username and password once the code was right; dryRun checks only",
    input: { registrationToken: "from verify", username: "6 to 30 letters, numbers, dots, dashes, underscores", password: "12 to 64, the sign-in rules", confirm: "same", terms: "true", trustDevice: "true: trust this device 90 days", offerTrust: "false: the bank does not trust devices", deviceName: "1 to 30 when trusting", dryRun: "true: every rule, nothing saved" },
    returns: "{ ok: true, username, deviceTrusted } or { ok: false, code, problems? } with USERNAME_INVALID, USERNAME_TAKEN, MISMATCH, MIN_LENGTH, MAX_LENGTH, PASSWORD_CONTAINS_USERNAME, PASSWORD_COMMON, PASSWORD_BREACHED, TERMS_REQUIRED, NAME_REQUIRED. The password is kept as a hash.", errors: ["TOKEN_INVALID", "TOKEN_EXPIRED", "OTP_REQUIRED"],
  },
  { adapter: "sandbox.public.inspect", suggestedId: "inspectPublic", description: "For scenarios only: what the bank holds before sign-in, never a value", input: { contains: "optional text: whether it is anywhere in what the bank keeps" }, returns: "{ drafts, submitted, draft, outbox (masked), support, trackFails, regFails, registered, contains? }" },
  { adapter: "sandbox.public.advance", suggestedId: "advancePublic", description: "For scenarios only: moves an application to received, checking or ready", input: { reference: "APP-...", stage: "received | checking | ready" }, returns: "{ ok }", errors: ["NOT_FOUND", "STAGE_INVALID"] },
  { adapter: "bank.notifications.list", suggestedId: "notifications", description: "Notifications, each tagged with its place (personal, or a company id). The text of other places is withheld.", input: { context: "optional" }, returns: "Map by id: { id, context, topic, text (\"New activity\" for another place), at, read }.", errors: ["NOT_SUPPORTED"] },
  { adapter: "bank.applications.list", suggestedId: "applications", description: "Account applications, drafts included.", input: {}, returns: "Map by id: { id, status 'draft'|'submitted'|'in review'|'approved'|'declined'|'active', step, data, updatedAt, productId? }.", errors: ["NOT_SUPPORTED"] },
  { adapter: "bank.applications.get", suggestedId: "application", description: "One application, to resume it.", input: { applicationId: "id" }, returns: "The application.", errors: ["APPLICATION_NOT_FOUND", "NOT_SUPPORTED"] },
  { adapter: "bank.applications.save", suggestedId: "saveApplication", description: "Saves an application as a draft, or sends it (submit: true); a sent one cannot change.", input: { applicationId: "optional: new when absent", step: "screen to resume on", data: "answers so far", productId: "optional", submit: "optional" }, returns: "{ applicationId, status, step, updatedAt }", errors: ["APPLICATION_NOT_FOUND", "APPLICATION_LOCKED", "NOT_SUPPORTED"] },
  // ---- Cairo Amman Bank access journeys: outcomes come back as data ({ ok, code }) so a journey can route on them ----
  { adapter: "cab.legalEntities.list", suggestedId: "legalEntities", description: "The legal entities a customer can choose from.", input: {}, returns: "Map by id: { id, name }. Save as legal.list and use with select source." },
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
  { adapter: "cab.preview.accounts", suggestedId: "previewAccounts", description: "The balances account preview shows before sign-in, ready for accountPicker.", input: {}, returns: "Map by account id: { id, name, balance, currency, maskedNumber }. Save as ctx.previewAccounts." },
  { adapter: "cab.preview.set", suggestedId: "previewSet", description: "Turns account preview before sign-in on or off.", input: { enabled: "true or false" }, returns: "{ ok, enabled }" },
  { adapter: "cab.language.list", suggestedId: "languages", description: "Languages the app offers.", input: {}, returns: "Map by language code: { id, name, sub }. Save as ctx.languages and use with select source." },
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
  { adapter: "cab.locations.search", suggestedId: "locations", description: "Branches and ATMs.", input: { kind: "'branch' | 'atm' | 'all'", rangeMiles: "5, 10, 25, 50 or 100", query: "optional text" }, returns: "Map by location id: { id, name, sub }. Save as loc.found; use len(loc.found) for the count and select source to list them." },
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
    adapter: "bank.password.change", suggestedId: "changeOwnPassword", description: "Changes the password after bank.password.check, a step-up and a strict code.", input: { new: "text", confirm: "text", signOutOthers: "boolean" },
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
    adapter: "bank.devices.setQuickSignIn", suggestedId: "setDeviceQuickSignIn", description: "Quick sign-in on (step-up, strict code) or off (neither).", input: { method: "pin | biometric | passkey | off", pin: "6 digits" },
    returns: "{ ok, method, device } | { ok: false, code: PIN_* | DEVICE_NOT_TRUSTED }",
  },
  {
    adapter: "bank.devices.checkPin", suggestedId: "checkPin", description: "Would this PIN do? Changes nothing.", input: { pin: "6 digits" }, returns: "{ ok } | { ok: false, code: PIN_INVALID | PIN_WEAK | PIN_PHONE }",
  },
  {
    adapter: "bank.devices.verifyPin", suggestedId: "verifyQuickPin", description: "Checks the quick PIN; the 3rd wrong turns quick sign-in off.", input: { pin: "6 digits" }, returns: "{ ok } | { ok: false, code: PIN_WRONG (triesLeft) | PIN_LOCKED }",
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
    // the account-states customer is Alex with two more accounts: said in a line
    if (p.id === "alexsave") return { ...describe(p), accounts: ["Same accounts as alex"] };
    if (p.id === "alexaccounts") return { ...describe(p), accounts: ["As alex, plus acc_old: Old savings ••6602, USD 12 (dormant); acc_spare: Spare ••6603, USD -5 (overdrawn)"] };
    return { ...describe(p), accounts: twin ? [`Same accounts as ${twin.id}`] : accounts };
  });
}
const SIGN_IN_CAST = ["demolocked", "demoexpired", "demoinactive", "demonew", "demolimit"];
function describe(p: (typeof personas)[string]) {
  if (SIGN_IN_CAST.includes(p.id)) return { id: p.id, brand: p.brand, name: p.name, otpCode: p.behaviour.otpCode, note: "Sign-in cast (see bank.auth.signIn)." };
  if (p.id === "alexsave") return { id: p.id, brand: p.brand, name: p.name, otpCode: p.behaviour.otpCode, note: "As alex; saved cards for adding money: c_4242 Visa 4242 Harbor Bank 09/28, c_5100 Mastercard 5100 Crest Bank 03/29, c_0019 Visa 0019 Lakeside Bank 01/26 (expired)." };
  if (p.id === "alexaccounts") return { id: p.id, brand: p.brand, name: p.name, otpCode: p.behaviour.otpCode, note: "As alex; 6 accounts for the limit, budgets in all 8 categories at the edges of the chips (79.99%, 80%, 99.99%, 100%, 320%)." };
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
