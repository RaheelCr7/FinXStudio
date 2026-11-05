import { BankError } from "../errors";
import type { BankConfig, HomeMarket } from "../config";
import type { SandboxConditions } from "../index";
import { BANKWORKX_FX, priceQuote } from "../retail/fx";
import { PAYMENT_QUOTE_SECONDS, PURPOSES, SENDER_PAYS_ALL, money, railsFor, speedsFor, type Offer, type SendType, type SpeedClass } from "../retail/payments";
import type { CorpAuditEntry, CorpCompany, CorpPayment } from "./corporate";
import type { CorporateProvider } from "./corporate-provider";
import type { OtpState } from "../retail/retail";
import { currencyInfo, roundMoney } from "@finx/ui-kit";

/** The acting person, when the sandbox knows who signed in: set by the session for an identity with several contexts, absent for a company persona whose journey picks the user itself. */
export type Actor = { contextId: string; userId: string; permissions: string[] };
export type BusinessHost = {
  now: () => number; otp: OtpState; transferFails: () => boolean; config: () => BankConfig; conditions: () => SandboxConditions;
  provider: () => CorporateProvider | undefined; actor: () => Actor | undefined;
};

/** What each adapter needs the context to allow (docs/journeys/README.md 4.2). Checked before the company's own rules, which stay as a second line. */
const NEEDS: Record<string, string> = {
  "corp.users.list": "biz.accounts.view", "corp.company.get": "biz.accounts.view", "corp.suppliers.list": "biz.accounts.view", "corp.templates.list": "biz.accounts.view",
  "corp.payments.get": "biz.accounts.view", "corp.payments.pending": "biz.approvals.view",
  "corp.payments.initiate": "biz.payments.initiate", "corp.payments.quote": "biz.payments.initiate", "corp.payments.create": "biz.payments.initiate",
  "corp.bulk.check": "biz.payments.bulk", "corp.bulk.submit": "biz.payments.bulk", "corp.payroll.check": "biz.payroll.run", "corp.payroll.submit": "biz.payroll.run",
  "corp.payments.approve": "biz.approvals.approve", "corp.payments.reject": "biz.approvals.approve", "corp.payments.withdraw": "biz.payments.withdraw",
  "corp.signatories.list": "biz.audit.view", "corp.audit.list": "biz.audit.view",
};

export type PaymentMeta = { speed: SpeedClass; rail: { id: string; name: string }; railReference: string; receive: { amount: number; currency: string }; rate: number | null; fee: number; purpose: string; arrives: string };
type HeldQuote = { id: string; used: boolean; expiresAt: number; userId: string; fromAccountId: string; beneficiaryId: string; total: number; reference: string; meta: Omit<PaymentMeta, "railReference"> };

export class BusinessSandbox {
  private meta = new Map<string, PaymentMeta>();
  private quotes = new Map<string, HeldQuote>();
  private audit = new Map<string, CorpAuditEntry[]>();
  private seq = 0;
  constructor(private host: BusinessHost) {}

  /** The people, accounts and rules of the company the call is for. */
  private company(corp: CorporateProvider) { return corp.getCompany(); }
  private log(corp: CorporateProvider, userId: string, action: string, outcome: CorpAuditEntry["outcome"] = "Done") {
    const c = this.company(corp);
    const list = this.audit.get(c.id) ?? [...(c.audit ?? [])];
    list.unshift({ at: new Date(this.host.now()).toISOString(), userId, action, outcome });
    this.audit.set(c.id, list);
  }

  /** The acting user. With a session it is the person who signed in (a different `userId` in the input is refused); without one it is what the journey passes. */
  private acting(adapter: string, corp: CorporateProvider, input: Record<string, any>): string {
    const actor = this.host.actor();
    if (!actor) return String(input.userId ?? "");
    const company = this.company(corp);
    const need = NEEDS[adapter];
    const refuse = (what: string) => {
      this.log(corp, actor.userId, `${what} (${adapter})`, "Refused");
      throw new BankError("PERMISSION_DENIED", `Your role doesn't allow this. Ask an administrator at ${company.name}.`);
    };
    if (input.userId !== undefined && String(input.userId) !== actor.userId) refuse("Tried to act as another user");
    if (need && !actor.permissions.includes(need)) refuse("Tried an action the role does not allow");
    return actor.userId;
  }

  /** A confirmation code is asked from this amount (in the company's currency); a company that sets none always asks. */
  private needsCode(company: CorpCompany, amount: () => number) { return company.codeAbove === undefined || amount() >= company.codeAbove; }
  private requireCode(company: CorpCompany, amount: () => number) {
    if (this.needsCode(company, amount) && !this.host.otp.verified) throw new BankError(this.host.otp.attempts >= 3 ? "STEP_UP_FAILED" : "OTP_REQUIRED", this.host.otp.attempts >= 3 ? "We couldn't confirm this payment. Nothing was sent. Start again." : "OTP not verified");
    if (this.host.transferFails()) throw new BankError("CORE_UNAVAILABLE", "Core banking unavailable");
  }
  private shown(p: CorpPayment, company: CorpCompany) {
    const base = shown(p, company);
    const m = this.meta.get(`${company.id}:${p.id}`);
    return m ? { ...base, ...m } : base;
  }

  call(adapter: string, input: Record<string, any>): any {
    const corp = this.host.provider();
    if (!corp) throw new BankError("NOT_SUPPORTED", "Not available for this customer");
    const userId = this.acting(adapter, corp, input);
    const c = () => corp.getCompany();
    const done = (p: CorpPayment, what: string) => { this.log(corp, userId, `${what} ${p.id}`); return this.shown(p, c()); };
    switch (adapter) {
      case "corp.users.list": return Object.fromEntries(c().users.map((u) => [u.id, { id: u.id, name: u.name, sub: u.roles.join(" and ") }]));
      case "corp.company.get": {
        const co = c();
        const me = co.users.find((u) => u.id === userId);
        return { id: co.id, name: co.name, currency: co.currency, accounts: Object.fromEntries(co.accounts.map((a) => [a.id, a])), beneficiaries: Object.fromEntries(co.whitelist.map((b) => [b.id, { ...b, displayName: b.name }])), employees: Object.fromEntries((co.employees ?? []).map((e) => [e.id, { id: e.id, name: e.name, bank: e.bank, maskedNumber: e.maskedNumber }])), users: co.users.map((u) => ({ id: u.id, name: u.name, roles: u.roles })), me: me ? { id: me.id, name: me.name, roles: me.roles, dailyLimit: me.dailyLimit, usedToday: me.usedToday, remainingToday: me.dailyLimit - me.usedToday } : undefined, companyDailyLimit: co.companyDailyLimit, companyUsedToday: co.companyUsedToday, dualApprovalAbove: co.dualApprovalAbove, codeAbove: co.codeAbove, cutoff: co.cutoff };
      }
      case "corp.suppliers.list": return Object.fromEntries(c().whitelist.map((b) => [b.id, { ...b, displayName: b.name }]));
      case "corp.templates.list": return Object.fromEntries((c().templates ?? []).map((t) => [t.id, t]));
      case "corp.signatories.list": return Object.fromEntries((c().signatoryGroups ?? []).map((g) => [g.id, g]));
      case "corp.audit.list": return Object.fromEntries((this.audit.get(c().id) ?? c().audit ?? []).map((e, i) => [String(i + 1), { id: String(i + 1), ...e }]));
      case "corp.bulk.check": {
        const check = corp.checkBatch({ userId, fromAccountId: String(input.fromAccountId ?? ""), lines: parseBulkFile(String(input.file ?? "")) });
        const co = c();
        const name = (id: string) => co.whitelist.find((b) => b.id === id)?.name;
        const lines = check.lines.map((l) => ({ ...l, payee: name(l.beneficiaryId) ?? l.beneficiaryId, ...(l.code ? { message: BULK_LINE_MESSAGE[l.code] } : {}) }));
        return { ...check, lines: Object.fromEntries(lines.map((l) => [String(l.n), l])), problems: Object.fromEntries(lines.filter((l) => !l.ok).map((l) => [String(l.n), l])), requiredApprovers: check.total > co.dualApprovalAbove ? 2 : 1, currency: co.accounts.find((a) => a.id === input.fromAccountId)?.currency ?? co.currency };
      }
      case "corp.bulk.submit": {
        const lines = parseBulkFile(String(input.file ?? ""));
        this.requireCode(c(), () => corp.checkBatch({ userId, fromAccountId: String(input.fromAccountId ?? ""), lines }).total);
        const p = corp.initiateBulk({ userId, fromAccountId: String(input.fromAccountId ?? ""), lines, reference: input.reference });
        this.host.otp.verified = false;
        return done(p, "Started bulk payment");
      }
      case "corp.payroll.check": {
        const check = corp.checkPayroll({ userId, fromAccountId: String(input.fromAccountId ?? ""), period: String(input.period ?? ""), lines: parseBulkFile(String(input.file ?? "")) });
        const co = c();
        const name = (id: string) => co.employees?.find((e) => e.id === id)?.name;
        const lines = check.lines.map((l) => ({ ...l, payee: name(l.beneficiaryId) ?? l.beneficiaryId, ...(l.code ? { message: ({ ...BULK_LINE_MESSAGE, DUPLICATE_LINE: "This employee is already on the file" } as Record<string, string>)[l.code] } : {}) }));
        return { ...check, lines: Object.fromEntries(lines.map((l) => [String(l.n), l])), problems: Object.fromEntries(lines.filter((l) => !l.ok).map((l) => [String(l.n), l])), requiredApprovers: 2, period: String(input.period), currency: co.accounts.find((a) => a.id === input.fromAccountId)?.currency ?? co.currency };
      }
      case "corp.payroll.submit": {
        const lines = parseBulkFile(String(input.file ?? ""));
        this.requireCode(c(), () => corp.checkPayroll({ userId, fromAccountId: String(input.fromAccountId ?? ""), period: String(input.period ?? ""), lines }).total);
        const p = corp.initiatePayroll({ userId, fromAccountId: String(input.fromAccountId ?? ""), period: String(input.period ?? ""), lines });
        this.host.otp.verified = false;
        return done(p, "Started payroll");
      }
      case "corp.payments.initiate": {
        this.requireCode(c(), () => Number(input.amount));
        const p = corp.initiatePayment({ userId, fromAccountId: String(input.fromAccountId ?? ""), beneficiaryId: String(input.beneficiaryId ?? ""), amount: Number(input.amount), reference: input.reference });
        this.host.otp.verified = false;
        return done(p, "Started payment");
      }
      case "corp.payments.quote": return this.quote(corp, userId, input);
      case "corp.payments.create": return this.create(corp, userId, input);
      case "corp.payments.approve": {
        this.requireCode(c(), () => corp.getPayment(String(input.paymentId ?? "")).amount);
        const p = corp.approvePayment({ userId, paymentId: String(input.paymentId ?? "") });
        this.host.otp.verified = false;
        return done(p, p.status === "released" ? "Approved and released" : "Approved");
      }
      case "corp.payments.withdraw": return done(corp.withdrawPayment({ userId, paymentId: String(input.paymentId ?? "") }), "Withdrew");
      case "corp.payments.reject": return done(corp.rejectPayment({ userId, paymentId: String(input.paymentId ?? ""), reason: input.reason }), "Rejected");
      case "corp.payments.pending": return Object.fromEntries(corp.listPending({ userId, as: input.as === "initiator" ? "initiator" : input.as === "approver" ? "approver" : undefined }).map((p) => [p.id, this.shown(p, c())]));
      case "corp.payments.get": {
        // a payment is read by someone who works for the company; with a session the permission above already says so, without one a named user must be on the company's list
        if (!this.host.actor() && input.userId !== undefined && !c().users.some((u) => u.id === String(input.userId))) throw new BankError("NOT_AUTHORISED", "You don't work for this company.");
        return this.shown(corp.getPayment(String(input.paymentId ?? "")), c());
      }
      default: return undefined;
    }
  }

  /**
   * Prices a payment to an approved supplier in the supplier's currency: the conversion to the company's currency, the fee, the speed
   * (rails come from the bank's home market, as for a person), how many approvers it needs and whether a confirmation code is asked
   * (from the company's threshold). Purpose and reference (an invoice or PO number) are always required. Moves nothing.
   */
  private quote(corp: CorporateProvider, userId: string, input: Record<string, any>) {
    const co = corp.getCompany(), now = this.host.now();
    const user = co.users.find((u) => u.id === userId);
    if (!user) throw new BankError("USER_NOT_FOUND", `No user ${userId} at ${co.name}`);
    const from = co.accounts.find((a) => a.id === input.fromAccountId);
    if (!from) throw new BankError("ACCOUNT_NOT_FOUND", "Account not found");
    const sup = co.whitelist.find((b) => b.id === input.beneficiaryId);
    if (!sup) throw new BankError("BENEFICIARY_NOT_WHITELISTED", "This beneficiary is not on the company's approved list");
    if (from.currency !== co.currency) throw new BankError("CURRENCY_NOT_SUPPORTED", `Payments are limited in ${co.currency}: choose a ${co.currency} account`);
    const cur = sup.currency ?? co.currency, digits = currencyInfo(cur).decimals, receive = Number(input.amount);
    if (!(receive > 0) || Math.abs(receive * 10 ** digits - Math.round(receive * 10 ** digits)) > 1e-6) throw new BankError("INVALID_AMOUNT", `Enter an amount in ${cur} with at most ${digits} decimal places`);
    if (!PURPOSES.includes(String(input.purpose ?? ""))) throw new BankError("PURPOSE_REQUIRED", "Choose a purpose for this payment.");
    const reference = String(input.reference ?? "").trim();
    if (!reference) throw new BankError("REFERENCE_REQUIRED", "Enter an invoice or PO number.");
    if (reference.length > 140) throw new BankError("REFERENCE_TOO_LONG", "A reference can have up to 140 characters.");

    // the speeds the bank offers for this supplier: domestic when it is paid over the home market's own rails
    const home = this.host.config().homeMarket;
    const type: SendType = sup.country && DOMESTIC[home].includes(sup.country) ? "domestic" : "international";
    const offer: Offer = { standard: true, sameDay: true, instant: true, priority: false };
    const down = (this.host.conditions().unavailable ?? []).filter((x) => x.startsWith("rail:")).map((x) => x.slice(5));
    const speeds = speedsFor(type, receive, offer, down, false, railsFor(home));
    const chosen = input.speed ? speeds.find((x) => x.speed === input.speed) : speeds.find((x) => x.available && x.fits);
    if (input.speed && (!chosen || !chosen.available)) throw new BankError("RAIL_NOT_AVAILABLE", "Sending isn't available right now. Try again later.");
    if (input.speed && chosen && !chosen.fits) throw new BankError("RAIL_LIMIT", `That speed is limited to ${money(chosen.limit!, cur)} a payment. Choose another speed or send less.`);
    if (!chosen) throw new BankError(speeds.some((x) => x.available) ? "RAIL_LIMIT" : "RAIL_NOT_AVAILABLE", speeds.some((x) => x.available) ? "That is over the limit for this payment. Try a smaller amount." : "Sending isn't available right now. Try again later.");
    const fee = chosen.fee + (type === "international" && input.chargeBearer === "ours" ? SENDER_PAYS_ALL : 0);

    // what it costs in the company's currency; another currency uses the rate, held for 60 seconds
    let rate: number | null = null, pay = receive;
    if (cur !== co.currency) {
      const price = priceQuote(co.currency, cur, receive, { cfg: BANKWORKX_FX, direction: "get", feeWaived: true });
      rate = price.rate; pay = price.send;
    }
    const total = roundMoney(pay + fee, co.currency);
    // the same rules a payment meets when it starts, checked now so the screen can say so before the person confirms
    if (total > from.balance) throw new BankError("INSUFFICIENT_FUNDS", `There isn't enough money in ${from.name}. Available: ${money(from.balance, co.currency)}. You need ${money(total, co.currency)}.`);
    if (user.usedToday + total > user.dailyLimit) throw new BankError("LIMIT_USER_EXCEEDED", `That is over your limit of ${money(user.dailyLimit, co.currency)} a day.`);
    if (co.companyUsedToday + total > co.companyDailyLimit) throw new BankError("LIMIT_COMPANY_EXCEEDED", "This is above the company's daily limit");
    const id = `corpq_${++this.seq}`, expiresAt = now + PAYMENT_QUOTE_SECONDS * 1000;
    const meta: HeldQuote["meta"] = { speed: chosen.speed, rail: { id: chosen.id, name: chosen.name }, receive: { amount: receive, currency: cur }, rate, fee, purpose: String(input.purpose), arrives: chosen.arrives };
    this.quotes.set(id, { id, used: false, expiresAt, userId, fromAccountId: from.id, beneficiaryId: sup.id, total, reference, meta });
    return {
      quoteId: id, expiresAt: new Date(expiresAt).toISOString(), ttlSeconds: PAYMENT_QUOTE_SECONDS, fromAccountId: from.id, payee: { id: sup.id, name: sup.name, masked: sup.maskedNumber },
      type, speed: chosen.speed, speedName: chosen.name, arrives: chosen.arrives, receive: meta.receive, rate, converted: cur !== co.currency, pay, fee, total, currency: co.currency,
      speeds: Object.fromEntries(speeds.map((x) => [x.speed, { id: x.speed, name: x.name, arrives: x.arrives, fee: x.fee, usable: x.available && x.fits, ...(x.reason ? { reason: x.reason } : {}) }])),
      requiredApprovers: total > co.dualApprovalAbove ? 2 : 1, codeRequired: this.needsCode(co, () => total),
    };
  }

  /** Starts the payment a quote priced. It waits for approval; a confirmation code is asked from the company's threshold. */
  private create(corp: CorporateProvider, userId: string, input: Record<string, any>) {
    const q = this.quotes.get(String(input.quoteId));
    if (!q) throw new BankError("QUOTE_NOT_FOUND", "Quote not found");
    if (q.used) throw new BankError("QUOTE_USED", "This quote has already been used");
    if (q.userId !== userId) throw new BankError("PERMISSION_DENIED", `Your role doesn't allow this. Ask an administrator at ${corp.getCompany().name}.`);
    if (this.host.now() > q.expiresAt) throw new BankError("QUOTE_EXPIRED", "The exchange rate changed. Check the new amount.");
    if ((this.host.conditions().unavailable ?? []).includes(`rail:${q.meta.rail.id}`)) throw new BankError("RAIL_NOT_AVAILABLE", "Sending isn't available right now. Try again later.");
    this.requireCode(corp.getCompany(), () => q.total);
    const p = corp.initiatePayment({ userId, fromAccountId: q.fromAccountId, beneficiaryId: q.beneficiaryId, amount: q.total, reference: q.reference });
    q.used = true; this.host.otp.verified = false;
    this.meta.set(`${corp.getCompany().id}:${p.id}`, { ...q.meta, railReference: `${q.meta.rail.id.toUpperCase()}-${String(Number(p.id.replace(/\D/g, "")) || this.seq).padStart(8, "0")}` });
    this.log(corp, userId, `Started payment ${p.id}`);
    return this.shown(p, corp.getCompany());
  }
}

/** The countries a supplier can be in for the bank's home-market rails to serve the payment. */
const DOMESTIC: Record<HomeMarket, string[]> = { us: ["US"], uk: ["GB"], eu: ["DE", "FR", "ES", "IT", "NL", "IE", "BE", "AT", "PT", "FI", "LU", "GR"], ae: ["AE"], sa: ["SA"], jo: ["JO"] };

/** What the person sees for who a payment goes to: the beneficiary's name, or how many payees a bulk payment has. */
export function shown(p: CorpPayment, company: CorpCompany): CorpPayment & { payee: string } {
  return { ...p, payee: p.period ? `Payroll ${p.period} · ${p.lines?.length ?? 0} employee${p.lines?.length === 1 ? "" : "s"}` : p.lines ? `${p.lines.length} payment${p.lines.length === 1 ? "" : "s"}` : company.whitelist.find((b) => b.id === p.beneficiaryId)?.name ?? p.beneficiaryId };
}

const BULK_LINE_MESSAGE: Record<string, string> = {
  BENEFICIARY_NOT_WHITELISTED: "Not on the company's approved list",
  INVALID_AMOUNT: "The amount is not valid for this account's currency",
  DUPLICATE_LINE: "Same payee, amount and reference as an earlier line",
  NOT_AN_EMPLOYEE: "Not on the company's payroll register",
  ABOVE_SALARY_CAP: "More than 1.5 times this employee's monthly salary",
};

/**
 * Rows of a bulk file as pasted or uploaded: `beneficiary,amount,reference` per line. An optional header row, blank rows and
 * spaces are ignored. A row that cannot be read keeps what it has and fails the bank's own checks (a missing amount is an invalid amount).
 */
export function parseBulkFile(text: string): { beneficiaryId: string; amount: number; reference: string }[] {
  const rows = text.split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
  if (rows.length && /^beneficiar|^payee|^employee/i.test(rows[0]!)) rows.shift();
  return rows.map((r) => { const parts = r.split(","); const amount = (parts[1] ?? "").trim(); return { beneficiaryId: (parts[0] ?? "").trim(), amount: amount === "" ? NaN : Number(amount.replace(/_/g, "")), reference: parts.slice(2).join(",").trim() }; });
}
