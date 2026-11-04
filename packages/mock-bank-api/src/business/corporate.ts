import { currencyInfo, roundMoney } from "@finx/ui-kit";
import { BankError } from "../errors";

/**
 * Sandbox for corporate payments with maker-checker approval (plan, Stage 1). A company has accounts, users with roles,
 * a whitelist of beneficiaries, daily limits per user and per company, a cut-off time, and an approval rule. Every rule
 * answers with a named error so a journey can say what went wrong. Pure logic: the clock is injectable and nothing here
 * knows about screens. A real bank's API sits behind the same `CorporateBankAdapter` contract.
 */
export type CorpRole = "initiator" | "approver" | "admin";
/** A person may hold both roles (a finance manager who also starts payments): the four-eyes rule still stops them approving their own. An admin manages people and limits and moves no money. */
export type CorpUser = { id: string; name: string; roles: CorpRole[]; /** most this person may send in a day, in the company's currency */ dailyLimit: number; usedToday: number };
export type CorpAccount = { id: string; name: string; maskedNumber: string; currency: string; balance: number };
export type CorpBeneficiary = { id: string; name: string; bank: string; maskedNumber: string;
  /** Where the supplier is paid, for the payment adapters: the country (see rails.ts) and the currency it receives. Absent for a supplier paid in the company's currency. */
  country?: string; currency?: string };
/** A saved payment a Maker can reuse; `amount` is empty for "ask me each time". */
export type CorpTemplate = { id: string; name: string; beneficiaryId: string; amount?: number; reference: string; purpose: string };
/** Who must approve, in what order. `sequential`: members approve one after another; `parallel`: any of them, in any order, until `required` have. */
export type CorpSignatoryGroup = { id: string; name: string; mode: "sequential" | "parallel"; members: string[]; required: number; /** applies to payments above this, in the company's currency */ above: number };
export type CorpAuditEntry = { at: string; userId: string; action: string; outcome: "Done" | "Refused" };
/** A person on the company's payroll register. `salary` is their monthly pay; a payroll line may not exceed it by more than half again. */
export type CorpEmployee = { id: string; name: string; bank: string; maskedNumber: string; salary: number };
export type CorpCompany = {
  id: string; name: string;
  /** The currency the limits and the approval rule are written in. */
  currency: string;
  accounts: CorpAccount[]; users: CorpUser[];
  /** Only these may be paid. */
  whitelist: CorpBeneficiary[];
  /** Only these may be paid by a payroll run. Absent for a company that has no payroll. */
  employees?: CorpEmployee[];
  companyDailyLimit: number; companyUsedToday: number;
  /** A payment above this needs two different approvers instead of one. */
  dualApprovalAbove: number;
  /** HH:MM (UTC) after which a payment is value-dated the next working day. */
  cutoff: string;
  /** From this amount (in the company's currency) the person starting or approving a payment confirms it with a one-time code. Absent: always. */
  codeAbove?: number;
  /** Payment ids run PREFIX-n from n = start; absent: pay_1, pay_2 … */
  paymentSeq?: { prefix: string; start: number };
  templates?: CorpTemplate[]; signatoryGroups?: CorpSignatoryGroup[]; audit?: CorpAuditEntry[];
  /** YYYY-MM-DD days the bank is closed, besides weekends. */
  holidays: string[];
};

export type PaymentStatus = "pending_approval" | "released" | "rejected";
export type CorpPayment = {
  id: string; companyId: string; fromAccountId: string; beneficiaryId: string;
  amount: number; currency: string; reference: string;
  status: PaymentStatus;
  initiatedBy: string; initiatedAt: string;
  /** The day the money moves: today, or the next working day when the payment is made after the cut-off or on a closed day. */
  valueDate: string; afterCutoff: boolean;
  /** How many different approvers are needed, and who has approved so far. */
  required: number; approvals: { userId: string; at: string }[];
  rejectedBy?: string; rejectReason?: string; rejectedAt?: string;
  releasedAt?: string; releaseReference?: string;
  /** A bulk payment pays many beneficiaries at once and is approved as one: `amount` is the total and `beneficiaryId` is "bulk". */
  lines?: { n: number; beneficiaryId: string; amount: number; reference: string }[];
  /** A payroll run is a bulk payment to employees for one pay period (YYYY-MM): `beneficiaryId` is "payroll" and the lines are employee ids. */
  period?: string;
};

/** One row of a bulk file, as the person gave it. */
export type BulkLineInput = { beneficiaryId: string; amount: number; reference?: string };
export type BulkLineCode = "BENEFICIARY_NOT_WHITELISTED" | "INVALID_AMOUNT" | "DUPLICATE_LINE" | "NOT_AN_EMPLOYEE" | "ABOVE_SALARY_CAP";
/** A payroll line may be at most this many times the employee's monthly salary (a bonus fits; a typo does not). */
export const SALARY_CAP_FACTOR = 1.5;
export type BulkLineResult = { n: number; beneficiaryId: string; amount: number; reference: string; ok: boolean; code?: BulkLineCode };
export type BatchCheck = { lines: BulkLineResult[]; validCount: number; invalidCount: number; /** the sum of the lines that passed */ total: number };
/** Most rows a bulk file may have. */
export const MAX_BULK_LINES = 50;

export type InitiateInput = { userId: string; fromAccountId: string; beneficiaryId: string; amount: number; reference?: string };
/** What a corporate bank API has to offer the generated journeys. Both simulated APIs (and a real one later) implement it. */
export interface CorporateBankAdapter {
  initiatePayment(input: InitiateInput): CorpPayment;
  approvePayment(input: { userId: string; paymentId: string }): CorpPayment;
  rejectPayment(input: { userId: string; paymentId: string; reason?: string }): CorpPayment;
  /** The person who started a payment takes it back while it waits. Only them, and only while it is pending. */
  withdrawPayment(input: { userId: string; paymentId: string }): CorpPayment;
  /** Checks every row of a bulk file and says which would be paid; moves nothing and keeps nothing. */
  checkBatch(input: { userId: string; fromAccountId: string; lines: BulkLineInput[] }): BatchCheck;
  /** Starts one bulk payment of the rows that pass the checks (the rest are left out). It is approved as one and counts as one payment against the limits. */
  initiateBulk(input: { userId: string; fromAccountId: string; lines: BulkLineInput[]; reference?: string }): CorpPayment;
  /** Checks a payroll file for a pay period: every row must be an employee, once, within the salary cap. Also fails when the period is not valid or has already been run. Moves nothing. */
  checkPayroll(input: { userId: string; fromAccountId: string; period: string; lines: BulkLineInput[] }): BatchCheck;
  /** Starts one payroll run. It always needs two different approvers, however small. */
  initiatePayroll(input: { userId: string; fromAccountId: string; period: string; lines: BulkLineInput[] }): CorpPayment;
  /** What a person can act on: as an approver, what waits for them; as an initiator, what they started. `as` defaults to approver for anyone who holds that role. */
  listPending(input: { userId: string; as?: "approver" | "initiator" }): CorpPayment[];
}

const pad = (n: number) => String(n).padStart(2, "0");
const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * Rules that can be switched off, to check that a test suite notices: a mutation check runs the scenarios against a sandbox with
 * one rule missing and expects at least one to fail. Every rule is on by default; nothing in the apps ever turns one off.
 */
export type Flaws = { /** retail rules of the sandbox bank */ sameAccount?: false; canDebit?: false; funds?: false; quoteExpiry?: false; quoteReplay?: false; /** sending money to someone else */ railLimit?: false; dailyLimit?: false; coolingOff?: false; sanctions?: false; purposeRule?: false; addressRule?: false; bankCode?: false; /** paying a bill */ billMinimum?: false; billMaximum?: false; billMemory?: false; billChanged?: false; billCurrency?: false; /** mobile top-up */ topupAmount?: false; topupLimit?: false; topupNumber?: false; /** saved payees */ payeeLimit?: false; payeeDuplicate?: false; payeeInUse?: false; ibanChecksum?: false; sepa?: false; countryMatch?: false; routingChecksum?: false; sortCode?: false; bic?: false; nameCheck?: false; verifiedOnMatch?: false; clockOnDetails?: false; nameKeepsClock?: false; roles?: false; whitelist?: false; userLimit?: false; companyLimit?: false; dualApproval?: false; fourEyes?: false; cutoff?: false; lineChecks?: false; employeeChecks?: false; payrollPeriod?: false };

export class CorporateSandbox implements CorporateBankAdapter {
  private payments = new Map<string, CorpPayment>();
  private seq = 0;
  /** The clock; tests replace it. */
  now: () => number = () => Date.now();
  private company: CorpCompany;

  constructor(company: CorpCompany, private flaws: Flaws = {}) {
    this.company = structuredClone(company);
    if (company.paymentSeq) this.seq = company.paymentSeq.start - 1;
  }

  /** Puts a payment that already happened (or is waiting) into the books without running the rules, for seed data. Only the reference sandbox has this. */
  seedPayment(p: CorpPayment) { this.payments.set(p.id, structuredClone(p)); }

  get summary() { return structuredClone(this.company); }
  all() { return structuredClone([...this.payments.values()]); }

  private user(id: string): CorpUser {
    const u = this.company.users.find((x) => x.id === id);
    if (!u) throw new BankError("USER_NOT_FOUND", `No user ${id} at ${this.company.name}`);
    return u;
  }
  private account(id: string) {
    const a = this.company.accounts.find((x) => x.id === id);
    if (!a) throw new BankError("ACCOUNT_NOT_FOUND", "Account not found");
    return a;
  }
  private payment(id: string) {
    const p = this.payments.get(id);
    if (!p) throw new BankError("PAYMENT_NOT_FOUND", `No payment ${id}`);
    return p;
  }

  private isWorkingDay(day: string) {
    const dow = new Date(`${day}T00:00:00Z`).getUTCDay();
    return dow !== 0 && dow !== 6 && !this.company.holidays.includes(day);
  }
  /** Today when it is a working day before the cut-off, otherwise the next working day. */
  private valueDate(): { valueDate: string; afterCutoff: boolean } {
    const t = this.now();
    const today = dayOf(t);
    const d = new Date(t);
    const hhmm = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
    const open = this.isWorkingDay(today);
    if (this.flaws.cutoff === false || (open && hhmm <= this.company.cutoff)) return { valueDate: today, afterCutoff: false };
    let next = t;
    do { next += 24 * 3600 * 1000; } while (!this.isWorkingDay(dayOf(next)));
    return { valueDate: dayOf(next), afterCutoff: true };
  }

  initiatePayment(input: InitiateInput): CorpPayment {
    const c = this.company;
    const user = this.user(input.userId);
    if (this.flaws.roles !== false && !user.roles.includes("initiator")) throw new BankError("NOT_AUTHORISED", `${user.name} is not allowed to initiate payments`);
    const from = this.account(input.fromAccountId);
    const to = c.whitelist.find((b) => b.id === input.beneficiaryId);
    if (!to && this.flaws.whitelist !== false) throw new BankError("BENEFICIARY_NOT_WHITELISTED", "This beneficiary is not on the company's approved list");
    const amount = Number(input.amount);
    const digits = currencyInfo(from.currency).decimals;
    if (!this.validAmount(amount, from.currency)) throw new BankError("INVALID_AMOUNT", `Enter an amount in ${from.currency} with at most ${digits} decimal places`);
    return this.start(user, from, amount, input.beneficiaryId, input.reference ?? "");
  }

  private validAmount(amount: number, currency: string) {
    const digits = currencyInfo(currency).decimals;
    return amount > 0 && Math.abs(amount * 10 ** digits - Math.round(amount * 10 ** digits)) <= 1e-6;
  }

  /** What a payment or a bulk payment has to pass whatever its rows: currency, funds, the limits. Then it waits for approval. */
  private start(user: CorpUser, from: CorpAccount, amount: number, beneficiaryId: string, reference: string, lines?: CorpPayment["lines"], payroll?: { period: string }): CorpPayment {
    const c = this.company;
    if (from.currency !== c.currency) throw new BankError("CURRENCY_NOT_SUPPORTED", `Payments are limited in ${c.currency}: choose a ${c.currency} account`);
    if (amount > from.balance) throw new BankError("INSUFFICIENT_FUNDS", "Insufficient funds");
    if (this.flaws.userLimit !== false && user.usedToday + amount > user.dailyLimit) throw new BankError("LIMIT_USER_EXCEEDED", `This is above ${user.name}'s daily limit`);
    if (this.flaws.companyLimit !== false && c.companyUsedToday + amount > c.companyDailyLimit) throw new BankError("LIMIT_COMPANY_EXCEEDED", "This is above the company's daily limit");
    user.usedToday = roundMoney(user.usedToday + amount, c.currency);
    this.seq += 1;
    const { valueDate, afterCutoff } = this.valueDate();
    const p: CorpPayment = {
      id: this.company.paymentSeq ? `${this.company.paymentSeq.prefix}-${this.seq}` : `pay_${this.seq}`, companyId: c.id, fromAccountId: from.id, beneficiaryId, amount, currency: from.currency, reference, ...(lines ? { lines } : {}), ...(payroll ? { period: payroll.period } : {}),
      status: "pending_approval", initiatedBy: user.id, initiatedAt: new Date(this.now()).toISOString(), valueDate, afterCutoff,
      required: this.flaws.dualApproval !== false && (payroll || amount > c.dualApprovalAbove) ? 2 : 1, approvals: [],
    };
    this.payments.set(p.id, p);
    return structuredClone(p);
  }

  checkBatch(input: { userId: string; fromAccountId: string; lines: BulkLineInput[] }): BatchCheck {
    const user = this.user(input.userId);
    if (this.flaws.roles !== false && !user.roles.includes("initiator")) throw new BankError("NOT_AUTHORISED", `${user.name} is not allowed to initiate payments`);
    const from = this.account(input.fromAccountId);
    if (!input.lines.length) throw new BankError("EMPTY_BATCH", "The file has no payment lines");
    if (input.lines.length > MAX_BULK_LINES) throw new BankError("BATCH_TOO_LARGE", `A file may have at most ${MAX_BULK_LINES} payment lines`);
    const seen = new Set<string>();
    const lines = input.lines.map((l, i): BulkLineResult => {
      const row = { n: i + 1, beneficiaryId: l.beneficiaryId, amount: Number(l.amount), reference: l.reference ?? "" };
      if (this.flaws.lineChecks === false) return { ...row, ok: true };
      if (!this.company.whitelist.some((b) => b.id === l.beneficiaryId) && this.flaws.whitelist !== false) return { ...row, ok: false, code: "BENEFICIARY_NOT_WHITELISTED" };
      if (!this.validAmount(row.amount, from.currency)) return { ...row, ok: false, code: "INVALID_AMOUNT" };
      const key = `${row.beneficiaryId}|${row.amount}|${row.reference}`;
      if (seen.has(key)) return { ...row, ok: false, code: "DUPLICATE_LINE" };
      seen.add(key);
      return { ...row, ok: true };
    });
    const ok = lines.filter((l) => l.ok);
    return { lines, validCount: ok.length, invalidCount: lines.length - ok.length, total: roundMoney(ok.reduce((s, l) => s + l.amount, 0), from.currency) };
  }

  initiateBulk(input: { userId: string; fromAccountId: string; lines: BulkLineInput[]; reference?: string }): CorpPayment {
    const check = this.checkBatch(input);
    if (!check.validCount) throw new BankError("NO_VALID_LINES", "None of the lines can be paid");
    const user = this.user(input.userId);
    const from = this.account(input.fromAccountId);
    return this.start(user, from, check.total, "bulk", input.reference ?? "", check.lines.filter((l) => l.ok).map(({ n, beneficiaryId, amount, reference }) => ({ n, beneficiaryId, amount, reference })));
  }

  private checkPeriod(period: string) {
    if (this.flaws.payrollPeriod === false) return;
    const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period);
    if (!m || period > dayOf(this.now()).slice(0, 7)) throw new BankError("INVALID_PERIOD", "Choose a pay period as YYYY-MM, not later than this month");
    if ([...this.payments.values()].some((p) => p.period === period && p.status !== "rejected")) throw new BankError("PAYROLL_ALREADY_RUN", `Payroll for ${period} has already been started`);
  }

  checkPayroll(input: { userId: string; fromAccountId: string; period: string; lines: BulkLineInput[] }): BatchCheck {
    const user = this.user(input.userId);
    if (this.flaws.roles !== false && !user.roles.includes("initiator")) throw new BankError("NOT_AUTHORISED", `${user.name} is not allowed to initiate payments`);
    const from = this.account(input.fromAccountId);
    this.checkPeriod(String(input.period ?? ""));
    if (!input.lines.length) throw new BankError("EMPTY_BATCH", "The file has no payment lines");
    if (input.lines.length > MAX_BULK_LINES) throw new BankError("BATCH_TOO_LARGE", `A file may have at most ${MAX_BULK_LINES} payment lines`);
    const seen = new Set<string>();
    const lines = input.lines.map((l, i): BulkLineResult => {
      const row = { n: i + 1, beneficiaryId: l.beneficiaryId, amount: Number(l.amount), reference: l.reference ?? "" };
      if (this.flaws.lineChecks === false) return { ...row, ok: true };
      const emp = (this.company.employees ?? []).find((e) => e.id === l.beneficiaryId);
      if (!emp && this.flaws.employeeChecks !== false) return { ...row, ok: false, code: "NOT_AN_EMPLOYEE" };
      if (!this.validAmount(row.amount, from.currency)) return { ...row, ok: false, code: "INVALID_AMOUNT" };
      if (emp && this.flaws.employeeChecks !== false && row.amount > emp.salary * SALARY_CAP_FACTOR) return { ...row, ok: false, code: "ABOVE_SALARY_CAP" };
      // an employee is paid once per run, whatever the amount
      if (seen.has(row.beneficiaryId)) return { ...row, ok: false, code: "DUPLICATE_LINE" };
      seen.add(row.beneficiaryId);
      return { ...row, ok: true };
    });
    const ok = lines.filter((l) => l.ok);
    return { lines, validCount: ok.length, invalidCount: lines.length - ok.length, total: roundMoney(ok.reduce((s, l) => s + l.amount, 0), from.currency) };
  }

  initiatePayroll(input: { userId: string; fromAccountId: string; period: string; lines: BulkLineInput[] }): CorpPayment {
    const check = this.checkPayroll(input);
    if (!check.validCount) throw new BankError("NO_VALID_LINES", "None of the lines can be paid");
    const user = this.user(input.userId);
    const from = this.account(input.fromAccountId);
    return this.start(user, from, check.total, "payroll", `Payroll ${input.period}`, check.lines.filter((l) => l.ok).map(({ n, beneficiaryId, amount, reference }) => ({ n, beneficiaryId, amount, reference })), { period: input.period });
  }

  approvePayment(input: { userId: string; paymentId: string }): CorpPayment {
    const c = this.company;
    const user = this.user(input.userId);
    if (this.flaws.roles !== false && !user.roles.includes("approver")) throw new BankError("NOT_AUTHORISED", `${user.name} is not allowed to approve payments`);
    const p = this.payment(input.paymentId);
    if (p.status !== "pending_approval") throw new BankError("PAYMENT_NOT_PENDING", `This payment is already ${p.status.replace("_", " ")}`);
    if (this.flaws.fourEyes !== false && p.initiatedBy === user.id) throw new BankError("SELF_APPROVAL", "You cannot approve a payment you started");
    if (p.approvals.some((a) => a.userId === user.id)) throw new BankError("ALREADY_APPROVED", "You have already approved this payment");
    p.approvals.push({ userId: user.id, at: new Date(this.now()).toISOString() });
    if (p.approvals.length >= p.required) this.release(p);
    return structuredClone(p);
  }

  /** The last approval moves the money. The checks are made again now, because things may have changed since it was started. */
  private release(p: CorpPayment) {
    const c = this.company;
    const from = this.account(p.fromAccountId);
    if (p.amount > from.balance) { p.approvals.pop(); throw new BankError("INSUFFICIENT_FUNDS", "Insufficient funds"); }
    if (this.flaws.companyLimit !== false && c.companyUsedToday + p.amount > c.companyDailyLimit) { p.approvals.pop(); throw new BankError("LIMIT_COMPANY_EXCEEDED", "This is above the company's daily limit"); }
    from.balance = roundMoney(from.balance - p.amount, from.currency);
    c.companyUsedToday = roundMoney(c.companyUsedToday + p.amount, c.currency);
    p.status = "released"; p.releasedAt = new Date(this.now()).toISOString(); p.releaseReference = `CORP-${p.valueDate.replace(/-/g, "")}-${p.id.replace(/\D/g, "").padStart(4, "0")}`;
  }

  rejectPayment(input: { userId: string; paymentId: string; reason?: string }): CorpPayment {
    const user = this.user(input.userId);
    const p = this.payment(input.paymentId);
    if (p.status !== "pending_approval") throw new BankError("PAYMENT_NOT_PENDING", `This payment is already ${p.status.replace("_", " ")}`);
    if (!user.roles.includes("approver")) throw new BankError("NOT_AUTHORISED", `${user.name} is not allowed to reject payments`);
    // the person who started a payment takes it back with withdraw; rejecting is the approvers' call
    if (p.initiatedBy === user.id) throw new BankError("NOT_AUTHORISED", `${user.name} started this payment: withdraw it instead of rejecting it`);
    p.status = "rejected"; p.rejectedBy = user.id; p.rejectedAt = new Date(this.now()).toISOString();
    p.rejectReason = (input.reason ?? "").trim();
    // the payment will not happen, so what it used of the person's day is given back
    const maker = this.user(p.initiatedBy); maker.usedToday = roundMoney(Math.max(0, maker.usedToday - p.amount), this.company.currency);
    return structuredClone(p);
  }

  withdrawPayment(input: { userId: string; paymentId: string }): CorpPayment {
    const user = this.user(input.userId);
    const p = this.payment(input.paymentId);
    if (p.status !== "pending_approval") throw new BankError("PAYMENT_NOT_PENDING", `This payment is already ${p.status.replace("_", " ")}`);
    if (p.initiatedBy !== user.id) throw new BankError("NOT_AUTHORISED", `${user.name} can only withdraw payments they started`);
    p.status = "rejected"; p.rejectedBy = user.id; p.rejectedAt = new Date(this.now()).toISOString(); p.rejectReason = "Withdrawn by the person who started it";
    // it will not happen, so what it used of the person's day is given back
    user.usedToday = roundMoney(Math.max(0, user.usedToday - p.amount), this.company.currency);
    return structuredClone(p);
  }

  listPending(input: { userId: string; as?: "approver" | "initiator" }): CorpPayment[] {
    const user = this.user(input.userId);
    const pending = [...this.payments.values()].filter((p) => p.status === "pending_approval");
    const as = input.as ?? (user.roles.includes("approver") ? "approver" : "initiator");
    // as an approver: what waits for them, never their own and never what they already approved; as an initiator: what they started
    const mine = as === "approver" ? (user.roles.includes("approver") ? pending.filter((p) => p.initiatedBy !== user.id && !p.approvals.some((a) => a.userId === user.id)) : []) : pending.filter((p) => p.initiatedBy === user.id);
    return structuredClone(mine.sort((a, b) => a.initiatedAt.localeCompare(b.initiatedAt) || a.id.localeCompare(b.id)));
  }

  getPayment(id: string): CorpPayment { return structuredClone(this.payment(id)); }
}

/** The demo company: two initiators, two approvers, three approved suppliers, and the rules of the first corporate proof. */
export const ACME: CorpCompany = {
  id: "acme", name: "Acme Trading Co.", currency: "PKR",
  accounts: [
    { id: "acme_ops", name: "Operations", maskedNumber: "••6100", currency: "PKR", balance: 25_000_000 },
    { id: "acme_usd", name: "Dollar account", maskedNumber: "••6101", currency: "USD", balance: 120_000 },
  ],
  users: [
    { id: "sara", name: "Sara Qureshi", roles: ["initiator"], dailyLimit: 3_000_000, usedToday: 0 },
    { id: "omar", name: "Omar Siddiqui", roles: ["initiator"], dailyLimit: 500_000, usedToday: 0 },
    { id: "hassan", name: "Hassan Raza", roles: ["approver"], dailyLimit: 0, usedToday: 0 },
    { id: "layla", name: "Layla Mirza", roles: ["approver"], dailyLimit: 0, usedToday: 0 },
    { id: "nadia", name: "Nadia Farooq", roles: ["initiator", "approver"], dailyLimit: 500_000, usedToday: 0 },
  ],
  whitelist: [
    { id: "sup_textile", name: "Crescent Textiles", bank: "HBL", maskedNumber: "••3301" },
    { id: "sup_logistics", name: "Indus Logistics", bank: "UBL", maskedNumber: "••7782" },
    { id: "sup_packaging", name: "Karachi Packaging", bank: "MCB", maskedNumber: "••9054" },
  ],
  companyDailyLimit: 8_000_000, companyUsedToday: 0,
  dualApprovalAbove: 1_000_000,
  cutoff: "16:00",
  holidays: ["2026-11-09"],
  employees: [
    { id: "emp_ali", name: "Ali Hamdan", bank: "HBL", maskedNumber: "••4410", salary: 180_000 },
    { id: "emp_sana", name: "Sana Malik", bank: "UBL", maskedNumber: "••5521", salary: 240_000 },
    { id: "emp_bilal", name: "Bilal Ahmed", bank: "MCB", maskedNumber: "••6632", salary: 150_000 },
    { id: "emp_hina", name: "Hina Rauf", bank: "Meezan", maskedNumber: "••7743", salary: 320_000 },
  ],
};
