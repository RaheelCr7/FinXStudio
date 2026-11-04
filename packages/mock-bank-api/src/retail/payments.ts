import { roundMoney } from "@finx/ui-kit";
import { BankError } from "../errors";
import type { Persona } from "../index";
import type { BankConfig } from "../config";
import { buildQuote } from "../quote";
import { HOME_COUNTRY, QUOTE_HOLD_SECONDS, checkName, maskPayee, validatePayee, type PayeeFields, type SpeedClass } from "../rails";
import { railOf, railReference } from "../rails";
import type { Payee, SentPayment } from "./data";
import { spendable, debit } from "./money";

export type OtpState = { attempts: number; verified: boolean };
export type RetailHost = {
  now: () => number; otp: OtpState; config: () => BankConfig; down: (railId: string) => boolean;
  nextSeq: () => number; limitFor: (currency: string) => { daily: number; usedToday: number };
};

type Held = { quoteId: string; used: boolean; expiresAt: number; fromAccountId: string; payee: Payee; save: boolean; check: Payee["check"]; acknowledged: boolean; receive: { amount: number; currency: string };
  rate: number; converted: number; fee: number; total: number; railId: string; speed: SpeedClass; charges?: string; purpose?: string; reference: string; arrivesOn: string; scheduleDate?: string };

const fieldsOf = (input: Record<string, any>): PayeeFields => ({ country: input.country ?? HOME_COUNTRY.us, name: input.name, routingNumber: input.routingNumber, accountNumber: input.accountNumber, accountType: input.accountType, sortCode: input.sortCode, iban: input.iban, bic: input.bic });
const firstError = (errors: Record<string, { code: string; message: string }>) => { const e = Object.values(errors)[0]; if (e) throw new BankError(e.code, e.message); };
const SCREENING_NAME = "test sanctions";
const day = 86_400_000;

/** The payment flow of docs/journeys/09-payment-rails.md section 13 for a person: check a payee, save it, price a payment, then send it. */
export class RetailPayments {
  private held = new Map<string, Held>();
  constructor(private p: Persona, private h: RetailHost) {}
  private get data() { if (!this.p.retail) throw new BankError("NOT_SUPPORTED", "Not available for this customer"); return this.p.retail; }
  private fields(input: Record<string, any>): PayeeFields { return { ...fieldsOf(input), country: input.country ?? HOME_COUNTRY[this.h.config().homeMarket] }; }

  validate(input: Record<string, any>) {
    const v = validatePayee(this.fields(input));
    return { valid: Object.keys(v.errors).length === 0, market: v.market, country: v.country, currency: v.currency, bank: v.bank, masked: v.masked, errors: v.errors };
  }

  check(input: Record<string, any>) {
    const f = this.fields(input), v = validatePayee(f);
    firstError(v.errors);
    return { ...checkName(v.market, f), market: v.market, country: v.country };
  }

  save(input: Record<string, any>) {
    const d = this.data, f = this.fields(input), v = validatePayee(f);
    firstError(v.errors);
    const check = checkName(v.market, f);
    if (check.result !== "match" && input.acknowledged !== true) throw new BankError("PAYEE_NOT_CHECKED", "Check the payee before you continue.");
    if (d.payees.some((x) => x.masked === maskPayee(v.market, f) && x.country === v.country)) throw new BankError("PAYEE_EXISTS", "You already have a payee with these bank details.");
    this.h.nextSeq();
    const p: Payee = { id: `pay_${String(f.name).toLowerCase().replace(/[^a-z]+/g, "_")}_${d.payees.length + 1}`, name: String(f.name).trim(), country: v.country, market: v.market, currency: v.currency, bank: v.bank, masked: maskPayee(v.market, f), fields: f, addedAt: this.h.now(), check: check.result };
    d.payees.push(p);
    this.p.beneficiaries.push({ id: p.id, displayName: p.name, bank: p.bank ?? "", maskedNumber: p.masked, addedAt: p.addedAt });
    return { payeeId: p.id, name: p.name, masked: p.masked, check: check.result };
  }

  quote(input: Record<string, any>) {
    const d = this.data, now = this.h.now();
    const from = this.p.accounts.find((a) => a.id === input.fromAccountId);
    if (!from) throw new BankError("ACCOUNT_NOT_FOUND", "Account not found");
    if (from.currency !== "USD") throw new BankError("CURRENCY_NOT_SUPPORTED", "Choose a USD account to pay from.");
    let payee: Payee, save = false, acknowledged = input.acknowledged === true;
    if (input.payeeId) {
      const found = d.payees.find((x) => x.id === input.payeeId);
      if (!found) throw new BankError("PAYEE_NOT_FOUND", "We can't find that payee. Choose another.");
      payee = found;
    } else {
      const f = this.fields(input.payee ?? {}), v = validatePayee(f);
      firstError(v.errors);
      const c = checkName(v.market, f);
      if (c.result !== "match" && !acknowledged) throw new BankError("PAYEE_NOT_CHECKED", "Check the payee before you continue.");
      payee = { id: "new", name: String(f.name).trim(), country: v.country, market: v.market, currency: v.currency, bank: v.bank, masked: maskPayee(v.market, f), fields: f, addedAt: now, check: c.result };
      save = input.savePayee === true;
    }
    const receive = Number(input.amount);
    const q = buildQuote({ payee, receive, speed: input.speed, charges: input.charges, purpose: input.purpose, reference: input.reference, now, down: this.h.down, speedMap: this.h.config().speedMap });
    if (q.total > spendable(from)) throw new BankError("INSUFFICIENT_FUNDS", `There isn't enough money in ${from.name}. Available: ${spendable(from).toFixed(2)}. You need ${q.total.toFixed(2)}.`);
    const limit = this.h.limitFor(from.currency);
    if (limit.usedToday + q.total > limit.daily) throw new BankError("DAILY_LIMIT_EXCEEDED", `That's over your remaining daily limit of ${roundMoney(limit.daily - limit.usedToday, "USD").toFixed(2)}.`);
    if (payee.id !== "new" && now - payee.addedAt < day) {
      // a saved payee under 24 hours old can receive at most USD 500 in 24 hours
      const used = d.payments.filter((x) => x.payeeName === payee.name && now - Date.parse(x.createdAt) < day).reduce((s, x) => s + x.youPay, 0);
      if (used + q.total > 500) throw new BankError("BENEFICIARY_COOLING_OFF", "This payee is new. You can send up to USD 500 to them in the first 24 hours.");
    }
    let scheduleDate: string | undefined;
    if (input.scheduleDate) {
      const sd = String(input.scheduleDate), today = new Date(now).toISOString().slice(0, 10);
      const dow = new Date(`${sd}T00:00:00Z`).getUTCDay();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(sd) || sd <= today || dow === 0 || dow === 6 || Date.parse(`${sd}T00:00:00Z`) - now > 30 * day) throw new BankError("INVALID_DATE", "Choose a business day from tomorrow, up to 30 days ahead.");
      scheduleDate = sd;
    }
    const seq = this.h.nextSeq();
    const quoteId = `payq_${seq}`, expiresAt = now + QUOTE_HOLD_SECONDS * 1000;
    this.held.set(quoteId, { quoteId, used: false, expiresAt, fromAccountId: from.id, payee, save, check: payee.check, acknowledged, receive: { amount: receive, currency: payee.currency }, rate: q.rate, converted: q.converted, fee: q.fee, total: q.total, railId: q.rail.id, speed: q.option.speed, charges: q.charges, purpose: input.purpose, reference: q.reference, arrivesOn: scheduleDate ?? q.option.arrivesOn, scheduleDate });
    return {
      quoteId, expiresAt: new Date(expiresAt).toISOString(), ttlSeconds: QUOTE_HOLD_SECONDS, fromAccountId: from.id,
      payee: { id: payee.id, name: payee.name, masked: payee.masked, country: payee.country, check: payee.check },
      receive: { amount: receive, currency: payee.currency }, rate: q.rate, converted: q.converted, fee: q.fee, total: q.total, charges: q.charges,
      speed: q.option.speed, rail: { id: q.rail.id, name: q.rail.name, referenceLabel: q.rail.refLabel }, arrivesOn: scheduleDate ?? q.option.arrivesOn, afterCutoff: !scheduleDate && q.option.afterCutoff,
      scheduled: !!scheduleDate, options: q.options,
    };
  }

  create(input: Record<string, any>) {
    const d = this.data, now = this.h.now();
    if (!this.h.otp.verified) throw new BankError(this.h.otp.attempts >= 3 ? "STEP_UP_FAILED" : "OTP_REQUIRED", this.h.otp.attempts >= 3 ? "We couldn't confirm this payment. Nothing was sent. Start again." : "OTP not verified");
    if (this.p.behaviour.transferFails) throw new BankError("CORE_UNAVAILABLE", "Core banking unavailable");
    const q = this.held.get(String(input.quoteId));
    if (!q) throw new BankError("QUOTE_NOT_FOUND", "Quote not found");
    if (q.used) throw new BankError("QUOTE_USED", "This quote has already been used");
    if (now > q.expiresAt) throw new BankError("QUOTE_EXPIRED", "The exchange rate changed. Check the new amount.");
    const from = this.p.accounts.find((a) => a.id === q.fromAccountId)!;
    if (this.h.down(q.railId)) throw new BankError("RAIL_NOT_AVAILABLE", "That isn't available right now. Choose another way to send it.");
    if (q.total > spendable(from)) throw new BankError("INSUFFICIENT_FUNDS", `There isn't enough money in ${from.name}. Available: ${spendable(from).toFixed(2)}.`);
    const limit = this.h.limitFor(from.currency);
    if (limit.usedToday + q.total > limit.daily) throw new BankError("DAILY_LIMIT_EXCEEDED", `That's over your remaining daily limit of ${roundMoney(limit.daily - limit.usedToday, "USD").toFixed(2)}.`);
    const seq = this.h.nextSeq();
    const held = q.payee.name.trim().toLowerCase() === SCREENING_NAME;
    const status: SentPayment["status"] = held ? "held" : q.scheduleDate ? "scheduled" : "sent";
    if (q.save) { this.save({ ...q.payee.fields, acknowledged: true }); }
    const rail = railReference(this.railOf(q.railId), seq);
    const payment: SentPayment = {
      id: `PAY-${String(seq).padStart(6, "0")}`, reference: `BWX-${String(seq).padStart(6, "0")}`, status, payeeName: q.payee.name, fromAccountId: from.id, rail: q.railId, speed: q.speed, railReference: rail,
      receive: q.receive, youPay: q.total, fee: q.fee, arrivesOn: q.arrivesOn, createdAt: new Date(now).toISOString(), purpose: q.purpose, note: q.reference || undefined, acknowledged: q.acknowledged, payeeCheck: q.check,
    };
    if (status === "sent") { debit(from, q.total); limit.usedToday = roundMoney(limit.usedToday + q.total, "USD"); }
    else if (status === "held") { from.available = roundMoney(spendable(from) - q.total, from.currency); limit.usedToday = roundMoney(limit.usedToday + q.total, "USD"); }
    else d.schedules.push({ id: `sch_${seq}`, kind: "payment", payeeName: q.payee.name, amount: q.receive.amount, currency: q.receive.currency, frequency: "once", nextDate: q.scheduleDate!, fromAccountId: from.id, reference: q.reference, status: "active" });
    if (status !== "scheduled") d.transactions.unshift({ id: `tx_p${seq}`, accountId: from.id, date: new Date(now).toISOString().slice(0, 10), title: q.payee.name, category: "Transfer", amount: -q.total, currency: from.currency, status: held ? "pending" : "posted", reference: payment.reference });
    d.payments.unshift(payment);
    q.used = true; this.h.otp.verified = false;
    return {
      paymentId: payment.id, reference: payment.reference, status, ...(held ? { code: "PAYMENT_HELD", message: "We're checking this payment and will tell you within one working day." } : {}),
      rail: { id: q.railId, name: this.railOf(q.railId).name, referenceLabel: this.railOf(q.railId).refLabel }, railReference: rail, speed: q.speed,
      receive: q.receive, youPay: q.total, fee: q.fee, rate: q.rate, arrivesOn: q.arrivesOn, newBalance: from.balance, availableBalance: spendable(from), currency: from.currency, payeeCheck: q.check, acknowledged: q.acknowledged,
    };
  }

  private railOf(id: string) { return railOf(id)!; }
}
