import { currencyInfo, roundMoney } from "@finx/ui-kit";
import { BankError } from "./index";

/**
 * Sandbox for corporate payments with maker-checker approval (plan, Stage 1). A company has accounts, users with roles,
 * a whitelist of beneficiaries, daily limits per user and per company, a cut-off time, and an approval rule. Every rule
 * answers with a named error so a journey can say what went wrong. Pure logic: the clock is injectable and nothing here
 * knows about screens. A real bank's API sits behind the same `CorporateBankAdapter` contract.
 */
export type CorpRole = "initiator" | "approver";
/** A person may hold both roles (a finance manager who also starts payments): the four-eyes rule still stops them approving their own. */
export type CorpUser = { id: string; name: string; roles: CorpRole[]; /** most this person may send in a day, in the company's currency */ dailyLimit: number; usedToday: number };
export type CorpAccount = { id: string; name: string; maskedNumber: string; currency: string; balance: number };
export type CorpBeneficiary = { id: string; name: string; bank: string; maskedNumber: string };
export type CorpCompany = {
  id: string; name: string;
  /** The currency the limits and the approval rule are written in. */
  currency: string;
  accounts: CorpAccount[]; users: CorpUser[];
  /** Only these may be paid. */
  whitelist: CorpBeneficiary[];
  companyDailyLimit: number; companyUsedToday: number;
  /** A payment above this needs two different approvers instead of one. */
  dualApprovalAbove: number;
  /** HH:MM (UTC) after which a payment is value-dated the next working day. */
  cutoff: string;
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
};

export type InitiateInput = { userId: string; fromAccountId: string; beneficiaryId: string; amount: number; reference?: string };
/** What a corporate bank API has to offer the generated journeys. Both simulated APIs (and a real one later) implement it. */
export interface CorporateBankAdapter {
  initiatePayment(input: InitiateInput): CorpPayment;
  approvePayment(input: { userId: string; paymentId: string }): CorpPayment;
  rejectPayment(input: { userId: string; paymentId: string; reason?: string }): CorpPayment;
  /** What a person can act on: as an approver, what waits for them; as an initiator, what they started. `as` defaults to approver for anyone who holds that role. */
  listPending(input: { userId: string; as?: "approver" | "initiator" }): CorpPayment[];
}

const pad = (n: number) => String(n).padStart(2, "0");
const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export class CorporateSandbox implements CorporateBankAdapter {
  private payments = new Map<string, CorpPayment>();
  private seq = 0;
  /** The clock; tests replace it. */
  now: () => number = () => Date.now();
  private company: CorpCompany;

  constructor(company: CorpCompany) { this.company = structuredClone(company); }

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
    if (open && hhmm <= this.company.cutoff) return { valueDate: today, afterCutoff: false };
    let next = t;
    do { next += 24 * 3600 * 1000; } while (!this.isWorkingDay(dayOf(next)));
    return { valueDate: dayOf(next), afterCutoff: true };
  }

  initiatePayment(input: InitiateInput): CorpPayment {
    const c = this.company;
    const user = this.user(input.userId);
    if (!user.roles.includes("initiator")) throw new BankError("NOT_AUTHORISED", `${user.name} is not allowed to initiate payments`);
    const from = this.account(input.fromAccountId);
    const to = c.whitelist.find((b) => b.id === input.beneficiaryId);
    if (!to) throw new BankError("BENEFICIARY_NOT_WHITELISTED", "This beneficiary is not on the company's approved list");
    const amount = Number(input.amount);
    const digits = currencyInfo(from.currency).decimals;
    if (!(amount > 0) || Math.abs(amount * 10 ** digits - Math.round(amount * 10 ** digits)) > 1e-6) throw new BankError("INVALID_AMOUNT", `Enter an amount in ${from.currency} with at most ${digits} decimal places`);
    if (from.currency !== c.currency) throw new BankError("CURRENCY_NOT_SUPPORTED", `Payments are limited in ${c.currency}: choose a ${c.currency} account`);
    if (amount > from.balance) throw new BankError("INSUFFICIENT_FUNDS", "Insufficient funds");
    if (user.usedToday + amount > user.dailyLimit) throw new BankError("LIMIT_USER_EXCEEDED", `This is above ${user.name}'s daily limit`);
    if (c.companyUsedToday + amount > c.companyDailyLimit) throw new BankError("LIMIT_COMPANY_EXCEEDED", "This is above the company's daily limit");
    user.usedToday = roundMoney(user.usedToday + amount, c.currency);
    this.seq += 1;
    const { valueDate, afterCutoff } = this.valueDate();
    const p: CorpPayment = {
      id: `pay_${this.seq}`, companyId: c.id, fromAccountId: from.id, beneficiaryId: to.id, amount, currency: from.currency, reference: input.reference ?? "",
      status: "pending_approval", initiatedBy: user.id, initiatedAt: new Date(this.now()).toISOString(), valueDate, afterCutoff,
      required: amount > c.dualApprovalAbove ? 2 : 1, approvals: [],
    };
    this.payments.set(p.id, p);
    return structuredClone(p);
  }

  approvePayment(input: { userId: string; paymentId: string }): CorpPayment {
    const c = this.company;
    const user = this.user(input.userId);
    if (!user.roles.includes("approver")) throw new BankError("NOT_AUTHORISED", `${user.name} is not allowed to approve payments`);
    const p = this.payment(input.paymentId);
    if (p.status !== "pending_approval") throw new BankError("PAYMENT_NOT_PENDING", `This payment is already ${p.status.replace("_", " ")}`);
    if (p.initiatedBy === user.id) throw new BankError("SELF_APPROVAL", "You cannot approve a payment you started");
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
    if (c.companyUsedToday + p.amount > c.companyDailyLimit) { p.approvals.pop(); throw new BankError("LIMIT_COMPANY_EXCEEDED", "This is above the company's daily limit"); }
    from.balance = roundMoney(from.balance - p.amount, from.currency);
    c.companyUsedToday = roundMoney(c.companyUsedToday + p.amount, c.currency);
    p.status = "released"; p.releasedAt = new Date(this.now()).toISOString(); p.releaseReference = `CORP-${p.valueDate.replace(/-/g, "")}-${String(p.id.split("_")[1]).padStart(4, "0")}`;
  }

  rejectPayment(input: { userId: string; paymentId: string; reason?: string }): CorpPayment {
    const user = this.user(input.userId);
    const p = this.payment(input.paymentId);
    if (p.status !== "pending_approval") throw new BankError("PAYMENT_NOT_PENDING", `This payment is already ${p.status.replace("_", " ")}`);
    // an approver may reject any pending payment but their own; the person who started it may withdraw it
    const mayWithdraw = user.id === p.initiatedBy;
    if (!user.roles.includes("approver") && !mayWithdraw) throw new BankError("NOT_AUTHORISED", `${user.name} is not allowed to reject payments`);
    p.status = "rejected"; p.rejectedBy = user.id; p.rejectedAt = new Date(this.now()).toISOString();
    p.rejectReason = (input.reason ?? "").trim() || (mayWithdraw ? "Withdrawn by the person who started it" : "");
    // the payment will not happen, so what it used of the person's day is given back
    const maker = this.user(p.initiatedBy); maker.usedToday = roundMoney(Math.max(0, maker.usedToday - p.amount), this.company.currency);
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
};
