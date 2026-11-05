import { currencyInfo, roundMoney } from "@finx/ui-kit";
import { BankError } from "../errors";
import type { Account, Beneficiary, Persona, SandboxConditions, SavedBiller, SavedNumber, Schedule } from "../index";
import type { Flaws } from "../business/corporate";
import type { BankConfig } from "../config";
import { instrumentOf, INSTRUMENTS, dayChange } from "./invest";
import { BANKS, cardNetwork, luhnValid } from "./finance";
import { customerRate, midRate, priceQuote, fxSupports, DEFAULT_FX, BANKWORKX_FX, QUOTE_TTL_SECONDS, type FxConfig, type Quote } from "./fx";
import { CabSandbox } from "./cab";
import { checkName, checkPayee, COOLING_OFF_HOURS, COOLING_OFF_USD, COUNTRY_RULES, findCustomer, hoursSince, MAX_PAYEES, sendTypeOf, type NameCheck, type PayeeDetails, type PayeeInput, type PayeeKind, type PayeeRegion } from "./payees";
import { AUTOPAY_CATEGORIES, autopayPlan, BANKWORKX_BILLERS, BILL_CURRENCY, billOf, billCase, choicesOf, dayLabel, limitsOf, minimumCents, normaliseRef, RAISE_CENTS, validRef, type Biller } from "./bills";
import { AHEAD_MONTHS, amountText, addDays, addMonths, changeState, dayName, END_DATES, FREQUENCIES, isFreq, isOpen, isoOf, isWeekday, MAX_ACTIVE, msOf, nextOpen, nominal, remaining, runDate, scheduleLine, upcoming, validIso, type AmountMode, type Freq, type ScheduleDetail, type ScheduleKind } from "./schedules";
import { amountChoices, dayKey, marketOf, normaliseNumber, numberCase, OPERATORS, receiptDate, TOPUP_CURRENCY, TOPUP_NUMBER_DAILY, validNumber } from "./topup";
import { ADDRESS_RULE_USD, businessDays, money, PAYMENT_QUOTE_SECONDS, PURPOSES, RELATIONSHIPS, REPEATS, SANCTIONS_NAME, SENDER_PAYS_ALL, speedsFor, speedText, railsFor, type Offer, type SendType, type SpeedClass } from "./payments";
import { credit, debit, spendable } from "./money";
import { retailRecords } from "./records";

const hour = 3600 * 1000;

export const BILLERS = [
  { id: "k_electric", name: "K-Electric", category: "Electricity" }, { id: "lesco", name: "LESCO", category: "Electricity" },
  { id: "ssgc", name: "SSGC", category: "Gas" }, { id: "ptcl", name: "PTCL", category: "Internet" },
];
export const CARRIERS = [{ id: "jazz", name: "Jazz" }, { id: "zong", name: "Zong" }, { id: "telenor", name: "Telenor" }, { id: "ufone", name: "Ufone" }];

/** The one-time code state a customer shares across personal and company adapters. */
export type OtpState = { attempts: number; verified: boolean };
type PayQuote = {
  quoteId: string; fromAccountId: string; type: SendType; speed: SpeedClass; railId: string;
  /** Who is paid: a saved payee (id), or one typed in the payment (the account key, not saved yet). */
  payee: { id?: string; key: string; name: string; country?: string; currency: string };
  receive: number; rate: number | null; pay: number; fee: number; total: number; currency: string; expiresAt: string;
  coolingOff: boolean; speedName: string; arrives: string;
};
export type RetailHost = { now: () => number; otp: OtpState; conditions: () => SandboxConditions; flaws: Flaws; config: () => BankConfig; /** moves the sandbox clock on (a scheduler run, a slow answer) */ setNow: (fn: () => number) => void };

/**
 * The personal adapters (`bank.*` apart from the session, the one-time code and the bank's configuration): accounts, moving money,
 * payees and payments to others, bills, top-ups, cards, spending and investing. Moved here from MockBank without changes in behaviour.
 */
export class RetailSandbox {
  private seq = 0;
  private quotes = new Map<string, Quote & { used: boolean }>();
  /** How many quotes were asked for each pair of accounts, so a renewed quote can show the market moving. */
  private quoteCount = new Map<string, number>();
  /** What was sent to each payee (by its id, or by its account key while it is not saved), so a new payee is kept to its allowance for its first 24 hours. */
  private sent = new Map<string, { at: number; usd: number }[]>();
  /** Prices of payments to someone else, each used once. */
  private payQuotes = new Map<string, PayQuote & { used: boolean }>();
  /** The rate of a currency for payments: held for 60 seconds, then the market moves a little (see fx.ts). */
  private rateSlots = new Map<string, { n: number; until: number }>();
  private schSeq = 0;
  /** Bills: what was paid on each reference (cents), the references whose amount due has gone up, and the saved billers. */
  private billPaid = new Map<string, number>();
  private billRaised = new Set<string>();
  private savedBillers: SavedBiller[];
  /** Mobile top-ups: what was sent to each number today (cents, by day and number), and the saved numbers. */
  private topupSent = new Map<string, number>();
  private savedNumbers: SavedNumber[];
  private numSeq = 0;
  private billSeq = 0;
  private seeded = false;
  private benSeq = 0;
  private schedules: Schedule[];
  private fx: FxConfig;
  private flaws: Flaws;
  readonly cab: CabSandbox;
  constructor(private p: Persona, private host: RetailHost) {
    this.schedules = p.schedules ?? [];
    this.savedBillers = p.savedBillers ?? [];
    this.savedNumbers = p.savedNumbers ?? [];
    this.fx = p.brand === "bankworkx" ? BANKWORKX_FX : DEFAULT_FX;
    this.flaws = host.flaws;
    this.cab = new CabSandbox(p, { otpVerified: () => host.otp.verified, clearOtp: () => { host.otp.verified = false; } });
  }
  private get otp(): OtpState { return this.host.otp; }
  private get conditions(): SandboxConditions { return this.host.conditions(); }
  /** The clock the bank runs on (tests move it). */
  private now = () => this.host.now();

  /** The daily limit that applies to an account in this currency. The first account's currency uses `limits`; another needs its own entry. */
  private limitFor(currency: string) {
    const base = this.p.accounts[0]?.currency;
    if (!base || currency === base) return this.p.limits;
    const own = this.p.limitsByCurrency?.[currency];
    if (!own) throw new BankError("LIMIT_NOT_SET", `No daily limit is set for ${currency}`);
    return own;
  }

  /** The saved payees. Seeded ones get their date from the clock the bank runs on the first time they are read, so a test's clock decides how old they are. */
  private payees(): Beneficiary[] {
    if (!this.seeded) {
      this.seeded = true;
      for (const b of this.p.beneficiaries) if (b.addedAgoMs !== undefined) { b.addedAt = this.now() - b.addedAgoMs; delete b.addedAgoMs; }
    }
    return this.p.beneficiaries;
  }
  /** A payee is new for its first 24 hours: the age in whole hours is under 24. */
  private isNew(b: Beneficiary) { return hoursSince(b.addedAt, this.now()) < COOLING_OFF_HOURS; }
  /** What a new payee may still be sent in its first 24 hours, in US dollars. */
  private allowanceLeft(b: Beneficiary): number { return this.allowanceOf(b.id); }
  private allowanceOf(sentKey: string): number {
    const since = this.now() - COOLING_OFF_HOURS * hour;
    const used = (this.sent.get(sentKey) ?? []).filter((x) => x.at > since).reduce((sum, x) => sum + x.usd, 0);
    return Math.max(0, Math.round((COOLING_OFF_USD - used) * 100) / 100);
  }
  private toUsd(amount: number, currency: string) { return Math.round((amount / (this.fx.perUsd[currency] ?? 1)) * 100) / 100; }
  /** A saved payee as the list shows it: what was saved, how old it is, and the cooling-off state. */
  private payeeView(b: Beneficiary) {
    const { addedAgoMs: _seed, ...saved } = b;
    const now = this.now(), isNew = this.isNew(b), until = b.addedAt + COOLING_OFF_HOURS * hour;
    const uses = this.schedules.filter((x) => x.beneficiaryId === b.id && this.isLive(x));
    return {
      ...saved, sendType: sendTypeOf(b.region), ageHours: hoursSince(b.addedAt, now),
      coolingOffUntil: isNew ? new Date(until).toISOString() : null, coolingOffHoursLeft: isNew ? Math.max(1, Math.ceil((until - now) / hour)) : 0,
      allowanceLeft: isNew ? this.allowanceLeft(b) : null,
      scheduledCount: uses.length, scheduledText: uses.map((x) => x.text).join("; "),
    };
  }
  /** Checks the details of a payee being added (no payeeId) or changed, and that it is not a second copy of one already saved. */
  private examinePayee(input: Record<string, any>, payeeId?: string) {
    const list = this.payees();
    const current = payeeId ? list.find((b) => b.id === payeeId) : undefined;
    if (payeeId && !current) throw new BankError("BENEFICIARY_NOT_FOUND", "We can't find that payee.");
    // the kind and the region of a payee cannot change
    const d = checkPayee(current ? { ...input, kind: current.kind, region: current.region } : input, this.flaws);
    if (!current && list.length >= MAX_PAYEES && this.flaws.payeeLimit !== false) throw new BankError("BENEFICIARY_LIMIT", "You can save up to 50 payees. Delete one to add another.");
    if (this.flaws.payeeDuplicate !== false && list.some((b) => b.id !== payeeId && b.key === d.key)) throw new BankError("BENEFICIARY_EXISTS", "You already saved this payee with these details.");
    return { d, current };
  }
  /** What a change to a saved payee touches: the name, or the bank details (the account, the country, the type of account). */
  private payeeChange(d: PayeeDetails, cur: Beneficiary) {
    return { nameChanged: d.displayName !== cur.displayName, detailsChanged: d.key !== cur.key || d.country !== cur.country || (d.accountType ?? "") !== (cur.accountType ?? "") };
  }
  /** Changing the bank details starts the 24 hours again; changing only the name or the nickname does not. */
  private restartsClock(c: { nameChanged: boolean; detailsChanged: boolean }) {
    return c.detailsChanged ? this.flaws.clockOnDetails !== false : c.nameChanged && this.flaws.nameKeepsClock === false;
  }
  /** Refuses a payment to a new payee that is more than its allowance for the first 24 hours. */
  private coolingOff(b: Beneficiary, usd: number) {
    if (!this.isNew(b)) return;
    this.coolingOffFor({ sentKey: b.id, displayName: b.displayName, addedAt: b.addedAt }, usd);
  }
  /** The same rule for a payee that is not saved yet (one typed in a payment): it is new, added just now. */
  private coolingOffFor(b: { sentKey: string; displayName: string; addedAt: number }, usd: number) {
    const left = this.allowanceOf(b.sentKey);
    if (usd <= left) return;
    const at = new Date(b.addedAt + COOLING_OFF_HOURS * hour), pad = (n: number) => String(n).padStart(2, "0");
    const when = `${at.getUTCDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][at.getUTCMonth()]} ${at.getUTCFullYear()} ${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())} UTC`;
    const hours = hoursSince(b.addedAt, this.now());
    const head = `${b.displayName} was added ${hours} ${hours === 1 ? "hour" : "hours"} ago. For your security you can send up to $${COOLING_OFF_USD.toFixed(2)} to a new beneficiary in the first ${COOLING_OFF_HOURS} hours.`;
    throw new BankError("BENEFICIARY_COOLING_OFF", left > 0 ? `${head} You can send up to $${left.toFixed(2)} more now, or the full amount after ${when}.` : `${head} You can send more after ${when}.`);
  }

  /**
   * Prices a payment to someone else and checks it, in the order a person meets the rules: the account, the amount, the speed,
   * the money, the daily limit, the new-payee allowance, the purpose, the address. Throws the first problem; nothing is changed.
   */
  private priceTransfer(input: Record<string, any>) {
    const f = this.flaws;
    const from = this.p.accounts.find((a) => a.id === input.fromAccountId);
    if (!from) throw new BankError("ACCOUNT_NOT_FOUND", "We can’t find that account.");
    const home = this.p.accounts[0]!.currency;
    // only an account in the home currency can pay someone else
    if ((!from.canDebit && f.canDebit !== false) || from.currency !== home) throw new BankError("ACCOUNT_CANNOT_DEBIT", "You can’t send money from this account right now.");
    const saved = input.payeeId ? this.payees().find((b) => b.id === input.payeeId) : undefined;
    if (input.payeeId && !saved) throw new BankError("BENEFICIARY_NOT_FOUND", "We can’t find that payee.");
    const type = (saved ? sendTypeOf(saved.region) : String(input.sendType ?? "")) as SendType;
    if (!["internal", "domestic", "international"].includes(type) || (!saved && !String(input.payeeKey ?? ""))) throw new BankError("PAYEE_NOT_CHECKED", "Check the payee before you continue.");
    const payee = saved
      ? { id: saved.id, key: saved.id, name: saved.displayName, country: saved.country, currency: saved.currency ?? home }
      : { key: String(input.payeeKey), name: String(input.payeeName ?? ""), country: input.country ? String(input.country) : undefined, currency: type === "international" ? String(input.currency ?? "") : home };
    const cur = payee.currency, digits = currencyInfo(cur).decimals, receive = Number(input.receiveAmount);
    if (!(receive > 0)) throw new BankError("INVALID_AMOUNT", "Enter an amount above zero.");
    if (Math.abs(receive * 10 ** digits - Math.round(receive * 10 ** digits)) > 1e-6) throw new BankError("INVALID_AMOUNT", digits === 0 ? "Enter a whole number." : `Enter an amount with at most ${digits} decimal places.`);

    // the speeds the bank offers for this kind of payment and this amount
    const offer: Offer = { standard: input.standard !== false, sameDay: input.sameDay !== false, instant: input.instant !== false, priority: input.priority === true };
    const down = (this.conditions.unavailable ?? []).filter((x) => x.startsWith("rail:")).map((x) => x.slice(5));
    const speeds = speedsFor(type, receive, offer, down, f.railLimit === false, railsFor(this.host.config().homeMarket));
    const extra = type === "international" && input.chargeChoice === true && input.chargeBearer === "ours" ? SENDER_PAYS_ALL : 0;
    let chosen = input.speed ? speeds.find((x) => x.speed === input.speed) : speeds.find((x) => x.available && x.fits);
    if (input.speed && (!chosen || !chosen.available)) throw new BankError("RAIL_NOT_AVAILABLE", "Sending isn’t available right now. Try again later.");
    if (input.speed && chosen && !chosen.fits) throw new BankError("RAIL_LIMIT", type === "internal" ? `You can send up to ${money(chosen.limit!, cur)} at a time.` : `That speed is limited to ${money(chosen.limit!, cur)} a payment. Choose another speed or send less.`);
    if (!chosen) {
      if (!speeds.some((x) => x.available)) throw new BankError("RAIL_NOT_AVAILABLE", "Sending isn’t available right now. Try again later.");
      const largest = Math.max(...speeds.filter((x) => x.available).map((x) => x.limit ?? 0));
      throw new BankError("RAIL_LIMIT", type === "internal" ? `You can send up to ${money(largest, cur)} at a time.` : `That is over the limit of ${money(largest, cur)}. Try a smaller amount.`);
    }
    const fee = chosen.fee + extra;

    // what it costs in the sender's currency; a payment in another currency uses the rate, held for 60 seconds
    let rate: number | null = null, pay = receive, until = this.now() + PAYMENT_QUOTE_SECONDS * 1000;
    if (cur !== home) {
      if (!fxSupports(home, this.fx) || !fxSupports(cur, this.fx)) throw new BankError("CURRENCY_NOT_SUPPORTED", "We can’t send to that currency yet.");
      const slot = `${from.id}>${cur}`, held = this.rateSlots.get(slot);
      const n = !held ? 0 : this.now() > held.until ? held.n + 1 : held.n;
      if (held && this.now() <= held.until) until = held.until;
      this.rateSlots.set(slot, { n, until });
      const price = priceQuote(home, cur, receive, { cfg: this.fx, direction: "get", drift: n === 0 ? 0 : (this.fx.drift?.[(n - 1) % (this.fx.drift?.length || 1)] ?? 0), feeWaived: true });
      rate = price.rate; pay = price.send;
    }
    const total = roundMoney(pay + fee, home);
    const usd = this.toUsd(pay, home);
    const person = { id: saved?.id, sentKey: saved?.id ?? payee.key, name: payee.name, addedAt: saved?.addedAt ?? this.now(), isNew: saved ? this.isNew(saved) : true };
    this.checkMoney(from, home, pay, total, usd, person, input.coolingOff !== false);

    if (type === "international" && f.purposeRule !== false && !PURPOSES.includes(String(input.purpose ?? ""))) throw new BankError("PURPOSE_REQUIRED", "Choose a purpose for this payment.");
    const addressRule = type === "international" && ((payee.country && COUNTRY_RULES[payee.country]?.address) || usd >= ADDRESS_RULE_USD);
    if (addressRule && f.addressRule !== false && (!String(input.street ?? "").trim() || !String(input.city ?? "").trim() || !RELATIONSHIPS.includes(String(input.relationship ?? "")))) throw new BankError("ADDRESS_REQUIRED", "We need the payee’s address for this payment.");

    this.seq += 1;
    const q: PayQuote = {
      quoteId: `payq_${this.seq}`, fromAccountId: from.id, type, speed: chosen.speed, railId: chosen.id, payee, receive, rate, pay, fee, total, currency: home,
      expiresAt: new Date(until).toISOString(), coolingOff: input.coolingOff !== false, speedName: chosen.name, arrives: chosen.arrives,
    };
    this.payQuotes.set(q.quoteId, { ...q, used: false });
    return {
      quoteId: q.quoteId, type, speed: q.speed, speedName: q.speedName, arrives: q.arrives,
      speeds: Object.fromEntries(speeds.map((x) => [x.speed, { id: x.speed, name: x.name, sub: speedText(x, cur, home, extra), usable: x.available && x.fits }])),
      receive: { currency: cur, amount: receive }, rate, converted: cur !== home, pay, fee, feeText: fee === 0 ? "Free" : money(fee, home), total, currency: home,
      expiresAt: q.expiresAt, ttlSeconds: PAYMENT_QUOTE_SECONDS, sendDates: businessDays(this.now()),
    };
  }
  /** The money rules of a payment: enough in the account, within the daily limit, and within the allowance of a new payee. */
  private checkMoney(from: Account, home: string, pay: number, total: number, usd: number, person: { sentKey: string; name: string; addedAt: number; isNew: boolean }, coolingOff: boolean) {
    const f = this.flaws;
    if (total > spendable(from) && f.funds !== false) throw new BankError("INSUFFICIENT_FUNDS", `Not enough in the account: you’d pay ${money(total, home)} but ${money(spendable(from), home)} is available.`);
    const limit = this.limitFor(home), left = Math.max(0, roundMoney(limit.daily - limit.usedToday, home));
    if (pay > left && f.dailyLimit !== false) throw new BankError("DAILY_LIMIT_EXCEEDED", `That is over your remaining daily limit of ${money(left, home)}.`);
    if (coolingOff && f.coolingOff !== false && person.isNew) this.coolingOffFor({ sentKey: person.sentKey, displayName: person.name, addedAt: person.addedAt }, usd);
  }

  /* ------------------------------------------------------------------------------------------ bills (BankWorkx) */

  private biller(id: unknown): Biller {
    const b = BANKWORKX_BILLERS.find((x) => x.id === id);
    if (!b) throw new BankError("BILLER_NOT_FOUND", "Choose a biller.");
    return b;
  }
  /** Billers and saved billers that match a search (name or category) and a category ("All" or nothing: every one). */
  private billMatches(name: string, category: string, input: Record<string, any>) {
    const q = String(input.q ?? "").trim().toLowerCase(), cat = String(input.category ?? "");
    return (!cat || cat.toLowerCase() === "all" || cat === category) && (!q || name.toLowerCase().includes(q) || category.toLowerCase().includes(q));
  }
  private savedView(x: SavedBiller) {
    const b = this.biller(x.billerId);
    return { id: x.id, nickname: x.nickname, name: x.nickname, sub: `${b.name} \u2022\u2022\u2022\u2022 ${x.reference.slice(-4)}`, billerId: b.id, billerName: b.name, category: b.category, label: b.label, format: b.format, accepts: b.accepts, fee: b.fee, reference: x.reference, last4: x.reference.slice(-4) };
  }
  private isSavedBiller(b: Biller, ref: string) { return this.savedBillers.some((x) => x.billerId === b.id && x.reference === ref); }
  /**
   * What is left to pay on a bill, in cents, or the reason there is nothing to pay. The last four digits of the reference choose the
   * outcome (bills.ts). With `raise`, a reference ending 3333 goes up by 12.00, once (the review checks the amount again).
   */
  private openBill(biller: Biller, rawRef: unknown, raise = false) {
    const ref = normaliseRef(rawRef);
    if (!validRef(biller, ref)) throw new BankError("INVALID_REFERENCE", "Check the reference.");
    const kind = billCase(ref);
    if (kind === "unavailable") throw new BankError("BILLER_UNAVAILABLE", "Biller unavailable. Try again later.");
    if (kind === "notFound") throw new BankError("BILL_NOT_FOUND", "No bill found. Check the reference and try again.");
    if (kind === "paid") throw new BankError("BILL_ALREADY_PAID", "This bill is already paid.");
    if (kind === "none") throw new BankError("NO_AMOUNT_DUE", "No bill due.");
    const key = `${biller.id}:${ref}`, bill = billOf(ref, this.now());
    let changed = false;
    if (kind === "changing" && raise && !this.billRaised.has(key)) { this.billRaised.add(key); changed = true; }
    const paid = this.flaws.billMemory === false ? 0 : this.billPaid.get(key) ?? 0;
    const left = bill.dueCents + (this.billRaised.has(key) ? RAISE_CENTS : 0) - paid;
    if (left <= 0) throw new BankError("BILL_ALREADY_PAID", "This bill is already paid.");
    return { ...bill, ref, key, dueCents: left, changed };
  }
  /** Prices a bill payment and checks it, in the order a person meets the rules: the bill, the amount, the account, the money, the daily limit. Nothing is changed. */
  private priceBill(input: Record<string, any>, forPay: boolean) {
    const f = this.flaws, biller = this.biller(input.billerId), fetched = input.fetched !== false;
    const ref = normaliseRef(input.reference);
    const bill = fetched ? this.openBill(biller, ref, !forPay) : undefined;
    if (!bill && !validRef(biller, ref)) throw new BankError("INVALID_REFERENCE", "Check the reference.");
    // the amount: the full bill, the minimum, or what the person typed
    let cents: number;
    if (bill && !forPay && input.choice === "full") cents = bill.dueCents;
    else if (bill && !forPay && input.choice === "min") {
      if (biller.accepts !== "minimum") throw new BankError("INVALID_AMOUNT", "This biller does not take a minimum.");
      cents = limitsOf(biller, bill.dueCents).min;
    } else {
      const n = Number(input.amount);
      if (!(n > 0)) throw new BankError("INVALID_AMOUNT", "Enter an amount above zero.");
      if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) throw new BankError("INVALID_AMOUNT", "Enter an amount with at most 2 decimal places.");
      cents = Math.round(n * 100);
    }
    if (bill) {
      const lim = limitsOf(biller, bill.dueCents);
      if (cents < lim.min && f.billMinimum !== false) throw new BankError("AMOUNT_BELOW_MINIMUM", "That is below the minimum.");
      if (cents > lim.max && f.billMaximum !== false) throw new BankError("AMOUNT_ABOVE_DUE", "That is more than the amount due.");
      // the amount due the person saw is not the one the bank has now
      if (forPay && input.due !== undefined && Math.round(Number(input.due) * 100) !== bill.dueCents && f.billChanged !== false) throw new BankError("BILL_CHANGED", "The amount due changed. Check it and confirm again.");
    }
    const from = this.p.accounts.find((a) => a.id === input.fromAccountId);
    if (!from) throw new BankError("ACCOUNT_NOT_FOUND", "Choose an account to pay from.");
    if (!from.canDebit && f.canDebit !== false) throw new BankError("ACCOUNT_CANNOT_DEBIT", "You can’t pay from this account right now.");
    // a bill is in the bank's home currency; another currency adds one rate line and is a bank option
    if (from.currency !== BILL_CURRENCY && input.allowCrossCurrency === false && f.billCurrency !== false) throw new BankError("BILL_CURRENCY_MISMATCH", "Choose an account in the same currency as the bill.");
    const feeCents = Math.round(biller.fee * 100), totalCents = cents + feeCents;
    let rate: number | null = null, youPay = totalCents / 100;
    if (from.currency !== BILL_CURRENCY) {
      if (!fxSupports(from.currency, this.fx)) throw new BankError("CURRENCY_NOT_SUPPORTED", "We can’t pay from that currency yet.");
      rate = Math.round(midRate(BILL_CURRENCY, from.currency, this.fx)! * 1e6) / 1e6;
      const d = currencyInfo(from.currency).decimals;
      youPay = Math.ceil(Math.round((totalCents / 100) * rate * 10 ** d * 1e6) / 1e6) / 10 ** d;
    }
    if (youPay > spendable(from) && f.funds !== false) throw new BankError("INSUFFICIENT_FUNDS", "Not enough in this account.");
    const limit = this.limitFor(from.currency), left = Math.max(0, roundMoney(limit.daily - limit.usedToday, from.currency));
    if (youPay > left && f.dailyLimit !== false) throw new BankError("DAILY_LIMIT_EXCEEDED", "That is over your daily limit.");
    return { biller, ref, bill, from, cents, feeCents, rate, youPay, limit };
  }
  private bankworkxBills(adapter: string, input: Record<string, any>): any {
    switch (adapter) {
      case "bank.billers.list":
        return Object.fromEntries(BANKWORKX_BILLERS.filter((b) => this.billMatches(b.name, b.category, input)).map((b) => [b.id, { id: b.id, name: b.name, category: b.category, label: b.label, format: b.format, accepts: b.accepts, fee: b.fee }]));
      case "bank.bills.saved": {
        if (input.billerId) {
          const b = this.biller(input.billerId), ref = normaliseRef(input.reference);
          if (!validRef(b, ref)) throw new BankError("INVALID_REFERENCE", "Check the reference.");
          if (!this.isSavedBiller(b, ref)) this.savedBillers.push({ id: `sb_new${++this.billSeq}`, nickname: String(input.nickname ?? "").trim() || b.name, billerId: b.id, reference: ref });
        }
        return Object.fromEntries(this.savedBillers.map((x) => this.savedView(x)).filter((v) => this.billMatches(`${v.nickname} ${v.billerName}`, v.category, input)).map((v) => [v.id, v]));
      }
      case "bank.bills.lookup": {
        const biller = this.biller(input.billerId), bill = this.openBill(biller, input.reference);
        const lim = limitsOf(biller, bill.dueCents);
        return {
          billerName: biller.name, category: biller.category, label: biller.label, reference: bill.ref, holder: this.p.name.split(" (")[0],
          due: bill.dueCents / 100, min: lim.min / 100, max: lim.max / 100, fee: biller.fee, currency: BILL_CURRENCY,
          date: new Date(bill.dueDate).toISOString().slice(0, 10), dateText: dayLabel(bill.dueDate), late: bill.late, lateFee: bill.lateFeeCents / 100,
          choices: choicesOf(biller, bill.dueCents, input.allowPartial !== false),
        };
      }
      case "bank.bills.quote": {
        const q = this.priceBill(input, false);
        return {
          billerName: q.biller.name, reference: q.ref, amount: q.cents / 100, fee: q.biller.fee, rate: q.rate, youPay: q.youPay, currency: q.from.currency, billCurrency: BILL_CURRENCY,
          due: q.bill ? q.bill.dueCents / 100 : null, changed: q.bill?.changed ?? false, late: q.bill?.late ?? false,
          // the late fee is part of a full payment only
          lateFee: q.bill?.late && q.cents === q.bill.dueCents ? q.bill.lateFeeCents / 100 : 0,
          autopayOk: !!q.bill && AUTOPAY_CATEGORIES.includes(q.biller.category), saved: this.isSavedBiller(q.biller, q.ref),
        };
      }
      case "bank.bills.pay": {
        if (!this.otp.verified) throw new BankError("OTP_REQUIRED", "OTP not verified");
        if (this.p.behaviour.transferFails) throw new BankError("CORE_UNAVAILABLE", "Core banking unavailable");
        const q = this.priceBill(input, true), cur = q.from.currency, key = `${q.biller.id}:${q.ref}`;
        debit(q.from, q.youPay);
        q.limit.usedToday += q.youPay;
        this.billPaid.set(key, (this.billPaid.get(key) ?? 0) + q.cents);
        this.otp.verified = false;
        this.seq += 1;
        // what the person asked to keep: the biller, and a monthly payment of the full bill
        let saved = false, next: ReturnType<typeof autopayPlan> | undefined;
        if (input.save === true && !this.isSavedBiller(q.biller, q.ref)) { this.savedBillers.push({ id: `sb_new${++this.billSeq}`, nickname: q.biller.name, billerId: q.biller.id, reference: q.ref }); saved = true; }
        if (input.autopay === true && q.bill && AUTOPAY_CATEGORIES.includes(q.biller.category)) {
          next = autopayPlan(q.bill.dueDate, q.bill.dueCents);
          this.schedules.push({ id: `sch_bill${++this.schSeq}`, beneficiaryId: "", name: q.biller.name, text: `${q.biller.name} · Monthly, ${next.firstText}, full bill, up to ${money(next.cap, BILL_CURRENCY)}` });
        }
        // the payment shows in Activity under the biller's name, as a bill
        this.p.finance?.transactions.unshift({ id: `t_bill${this.seq}`, title: q.biller.name, category: "bills", amount: -(q.cents + q.feeCents) / 100, daysAgo: 0, time: "Now" });
        return {
          reference: `BILL-20261102-${String(930 + this.seq).padStart(4, "0")}`, paid: q.cents / 100, left: Math.max(0, (q.bill?.dueCents ?? q.cents) - q.cents) / 100, fee: q.biller.fee, rate: q.rate, youPay: q.youPay, currency: cur,
          newBalance: q.from.balance, saved, nextAutopay: next?.firstText ?? null,
        };
      }
      default: return undefined;
    }
  }

  /* ------------------------------------------------------------------------------------------ mobile top-up (BankWorkx) */

  private operator(id: unknown) {
    const o = OPERATORS.find((x) => x.id === id);
    if (!o) throw new BankError("OPERATOR_NOT_FOUND", "Choose an operator.");
    return o;
  }
  private numberView(x: SavedNumber) { return { id: x.id, name: x.name, operatorId: x.operatorId, number: x.number, last4: x.number.slice(-4), sub: `\u2022\u2022\u2022\u2022 ${x.number.slice(-4)}` }; }
  private isSavedNumber(operatorId: string, number: string) { return this.savedNumbers.some((x) => x.operatorId === operatorId && x.number === number); }
  /**
   * Checks a top-up in the order a person meets the rules: the operator, the amount (one of the operator's own), the number (its format,
   * then the last four digits), the day's allowance of that number, the account and the money. Throws the first problem; nothing is changed.
   */
  private priceTopup(input: Record<string, any>) {
    const f = this.flaws, op = this.operator(input.operatorId), amount = Number(input.amount);
    if (!op.amounts.includes(amount) && f.topupAmount !== false) throw new BankError("INVALID_AMOUNT", "Choose an amount.");
    const number = normaliseNumber(input.number);
    if (!validNumber(input.market, number)) throw new BankError("NUMBER_INVALID", marketOf(input.market).message);
    const kind = numberCase(number);
    if (f.topupNumber !== false) {
      if (kind === "notFound") throw new BankError("NUMBER_NOT_FOUND", "We can\u2019t top up this number. Check it and try again.");
      if (kind === "unavailable") throw new BankError("OPERATOR_UNAVAILABLE", "The operator isn\u2019t available right now. Try again later.");
    }
    const key = `${dayKey(this.now())}:${number}`, sent = this.topupSent.get(key) ?? 0;
    if (f.topupLimit !== false && sent + Math.round(amount * 100) > TOPUP_NUMBER_DAILY * 100) throw new BankError("TOPUP_LIMIT", "You\u2019ve reached today\u2019s top-up limit for this number.");
    const from = this.p.accounts.find((a) => a.id === input.fromAccountId);
    if (!from) throw new BankError("ACCOUNT_NOT_FOUND", "Choose an account to pay from.");
    if (!from.canDebit && f.canDebit !== false) throw new BankError("ACCOUNT_CANNOT_DEBIT", "You can\u2019t pay from this account right now.");
    if (from.currency !== TOPUP_CURRENCY) throw new BankError("CURRENCY_NOT_SUPPORTED", "Choose a dollar account.");
    if (amount > spendable(from) && f.funds !== false) throw new BankError("INSUFFICIENT_FUNDS", "Not enough in this account.");
    const limit = this.limitFor(from.currency);
    if (limit.usedToday + amount > limit.daily && f.dailyLimit !== false) throw new BankError("LIMIT_EXCEEDED", "That is over your daily limit.");
    return { op, amount, number, key, sent, from, limit };
  }
  private bankworkxTopup(adapter: string, input: Record<string, any>): any {
    switch (adapter) {
      case "bank.carriers.list":
        return Object.fromEntries(OPERATORS.map((o) => [o.id, { id: o.id, name: o.name, amounts: amountChoices(o) }]));
      case "bank.topup.amounts":
        // the amounts one operator offers, one choice each (the amount screen)
        return amountChoices(this.operator(input.operatorId));
      case "bank.topup.numbers": {
        // the saved numbers (of one operator, and only those whose format fits the home market); with a number and a name: saves it first
        if (input.number) {
          const op = this.operator(input.operatorId), n = normaliseNumber(input.number);
          if (!validNumber(input.market, n)) throw new BankError("NUMBER_INVALID", marketOf(input.market).message);
          if (!this.isSavedNumber(op.id, n)) this.savedNumbers.push({ id: `sn_new${++this.numSeq}`, name: String(input.name ?? "").trim() || op.name, operatorId: op.id, number: n });
        }
        return Object.fromEntries(this.savedNumbers.filter((x) => (!input.operatorId || x.operatorId === input.operatorId) && validNumber(input.market, x.number)).map((x) => [x.id, this.numberView(x)]));
      }
      case "bank.topup.check": {
        const q = this.priceTopup(input);
        return { ok: true, operatorName: q.op.name, last4: q.number.slice(-4), amount: q.amount, saved: this.isSavedNumber(q.op.id, q.number), left: Math.max(0, TOPUP_NUMBER_DAILY - q.sent / 100 - q.amount), currency: TOPUP_CURRENCY };
      }
      case "bank.topup.create": {
        if (!this.otp.verified) throw new BankError("OTP_REQUIRED", "OTP not verified");
        if (this.p.behaviour.transferFails) throw new BankError("CORE_UNAVAILABLE", "Core banking unavailable");
        const q = this.priceTopup(input), cur = q.from.currency;
        debit(q.from, q.amount);
        q.limit.usedToday += q.amount;
        this.topupSent.set(q.key, q.sent + Math.round(q.amount * 100));
        this.otp.verified = false;
        this.seq += 1;
        let saved = false;
        if (input.save === true && !this.isSavedNumber(q.op.id, q.number)) { this.savedNumbers.push({ id: `sn_new${++this.numSeq}`, name: String(input.name ?? "").trim() || q.op.name, operatorId: q.op.id, number: q.number }); saved = true; }
        // the payment shows in Activity as a bill, under the operator's name
        this.p.finance?.transactions.unshift({ id: `t_topup${this.seq}`, title: `${q.op.name} top-up`, category: "bills", amount: -q.amount, daysAgo: 0, time: "Now" });
        return { reference: `TOP-20261102-${String(930 + this.seq).padStart(4, "0")}`, newBalance: q.from.balance, operatorName: q.op.name, last4: q.number.slice(-4), amount: q.amount, currency: cur, date: receiptDate(this.now()), saved };
      }
      default: return undefined;
    }
  }

  /* ------------------------------------------------------------------------------------------ scheduled payments (BankWorkx) */

  /** A schedule that is still going (active or paused). The older entries have no status and count as active. */
  private isLive(x: Schedule) { return !x.status || x.status === "active" || x.status === "paused"; }
  private closedDays() { return this.conditions.closedDays ?? []; }
  private scheduleOf(id: unknown) {
    const x = this.schedules.find((s) => s.id === id);
    if (!x || !x.kind) throw new BankError("SCHEDULE_NOT_FOUND", "We can’t find that payment.");
    return x as Schedule & ScheduleDetail;
  }
  /** Who a schedule pays, as its name and as a line with the account. */
  private targetOf(x: { kind: ScheduleKind; targetId: string; name: string }) {
    if (x.kind === "payee") { const b = this.payees().find((y) => y.id === x.targetId); return { name: b?.displayName ?? x.name, text: b ? `${b.displayName} ${b.maskedNumber}` : x.name }; }
    if (x.kind === "own") { const a = this.p.accounts.find((y) => y.id === x.targetId); return { name: a ? `${a.name} ${a.maskedNumber}` : x.name, text: a ? `${a.name} ${a.maskedNumber}` : x.name }; }
    const v = this.savedBillers.find((y) => y.id === x.targetId);
    return { name: v?.nickname ?? x.name, text: v ? `${v.nickname} •••• ${v.reference.slice(-4)}` : x.name };
  }
  private endTypeOf(x: ScheduleDetail) { return x.frequency === "once" || (x.endsOn === null && x.endCount === null) ? "never" : x.endsOn !== null ? "date" : "count"; }
  private endsText(freq: Freq, type: string, on: string | null, count: number | null) {
    return freq === "once" ? "Doesn’t repeat" : type === "date" ? dayName(on!, true) : type === "count" ? `After ${count} payments` : "Never";
  }
  /** What a list and a card say about a schedule. An older entry (a later payment, a bill paid automatically) keeps what it had. */
  private scheduleView(x: Schedule, strict = false) {
    const status = x.status ?? "active";
    if (!x.kind) return { ...x, status };
    const d = x as Schedule & ScheduleDetail, closed = this.closedDays(), left = remaining(d, closed), type = this.endTypeOf(d);
    const state = status === "active" ? changeState(d.nextRunOn, this.now(), strict, closed) : "ok";
    const note = status === "paused" ? "Paused" : state === "running" ? "Running now" : "";
    const a = this.p.accounts.find((y) => y.id === d.fromAccountId), amt = amountText(d.amountMode, d.amount, d.currency);
    return {
      ...d, status, payee: d.name, toText: this.targetOf(d).text, fromText: a ? `${a.name} ${a.maskedNumber}` : "", frequencyName: FREQUENCIES[d.frequency].name,
      amountText: amt, nextText: dayName(d.nextRunOn), nextLong: dayName(d.nextRunOn, true), endsText: this.endsText(d.frequency, type, d.endsOn, d.endCount), remainingRuns: left,
      running: state === "running", cutoffPassed: state === "cutoff", note, sub: `${FREQUENCIES[d.frequency].name} · ${dayName(d.nextRunOn)} · ${amt}${note ? ` · ${note}` : ""}`,
    };
  }
  /** What stops a schedule being changed or cancelled now, in the order a person meets it. A paused schedule is not about to run, so it can always be changed. */
  private checkChangeable(x: Schedule & ScheduleDetail, strict: boolean) {
    if (x.status !== "active" && x.status !== "paused") throw new BankError("SCHEDULE_NOT_ACTIVE", "This payment has already ended or been cancelled.");
    if (x.status === "paused") return;
    const state = changeState(x.nextRunOn, this.now(), strict, this.closedDays());
    if (state === "running" && this.flaws.scheduleRunning !== false) throw new BankError("SCHEDULE_RUNNING", "This payment is being processed. Try again later.");
    if (state === "cutoff" && this.flaws.scheduleCutoff !== false) throw new BankError("SCHEDULE_CUTOFF_PASSED", "This payment can’t be changed any more. Change it after it runs.");
  }
  private nextScheduleNo() {
    return Math.max(1000, ...this.schedules.map((x) => Number(/^SCH-(\d+)$/.exec(x.id)?.[1] ?? 0))) + 1;
  }
  /**
   * Checks a new schedule (or a change to one) in the order a person meets the rules: what and from where, who, the amount, the daily limit,
   * how often, the first date, the end, the new-payee wait, the number of schedules. Throws the first problem; nothing is changed.
   * Nothing is taken when a schedule is made, so the balance is not checked here; each run checks it.
   */
  private planSchedule(input: Record<string, any>, existing?: Schedule & ScheduleDetail) {
    const f = this.flaws, closed = this.closedDays(), today = isoOf(this.now());
    const kind = (existing ? existing.kind : input.kind) as ScheduleKind;
    if (!["payee", "own", "bill"].includes(kind)) throw new BankError("NOT_SUPPORTED", "This payment can’t be scheduled.");
    const from = this.p.accounts.find((a) => a.id === (existing ? existing.fromAccountId : input.from));
    if (!from) throw new BankError("ACCOUNT_NOT_FOUND", "Choose an account to pay from.");
    if (!existing && !from.canDebit && f.canDebit !== false) throw new BankError("ACCOUNT_CANNOT_DEBIT", "You can’t send money from this account right now.");
    const targetId = String(existing ? existing.targetId : input.target ?? ""), home = this.p.accounts[0]!.currency;
    let name: string, payee: Beneficiary | undefined, biller: Biller | undefined;
    if (kind === "payee") {
      payee = this.payees().find((b) => b.id === targetId);
      if (!payee) throw new BankError("BENEFICIARY_NOT_FOUND", "We can’t find that payee. Choose another.");
      if (from.currency !== home) throw new BankError("ACCOUNT_CANNOT_DEBIT", "You can’t send money from this account right now.");
      name = payee.displayName;
    } else if (kind === "own") {
      const to = this.p.accounts.find((a) => a.id === targetId);
      if (!to) throw new BankError("ACCOUNT_NOT_FOUND", "Choose an account to pay.");
      if (to.id === from.id && f.sameAccount !== false) throw new BankError("SAME_ACCOUNT", "Choose two different accounts.");
      if (to.currency !== from.currency) throw new BankError("CURRENCY_MISMATCH", "Choose two accounts in the same currency.");
      name = `${to.name} ${to.maskedNumber}`;
    } else {
      const saved = this.savedBillers.find((x) => x.id === targetId);
      if (!saved) throw new BankError("BILLER_NOT_FOUND", "Choose a biller.");
      biller = this.biller(saved.billerId);
      if (from.currency !== BILL_CURRENCY) throw new BankError("BILL_CURRENCY_MISMATCH", "Choose an account in the same currency as the bill.");
      name = saved.nickname;
    }
    // the amount: a fixed one, or (a bill) the bill each time, or its minimum
    const mode = String(existing ? existing.amountMode : kind === "bill" ? input.amountMode ?? "fixed" : "fixed") as AmountMode;
    if (!["fixed", "full", "minimum"].includes(mode) || (kind !== "bill" && mode !== "fixed")) throw new BankError("INVALID_AMOUNT", "Choose how much to pay.");
    if (mode === "minimum" && biller?.accepts !== "minimum") throw new BankError("INVALID_AMOUNT", "This biller has no minimum due.");
    let amount: number | null = existing ? existing.amount : null;
    if (mode === "fixed") {
      if (input.amount !== undefined && input.amount !== null && input.amount !== "") amount = Number(input.amount);
      const digits = currencyInfo(from.currency).decimals;
      if (!(Number(amount) > 0)) throw new BankError("INVALID_AMOUNT", "Enter an amount above zero.");
      if (Math.abs(amount! * 10 ** digits - Math.round(amount! * 10 ** digits)) > 1e-6) throw new BankError("INVALID_AMOUNT", digits === 0 ? "Enter a whole number." : `Enter an amount with at most ${digits} decimal places.`);
      if (amount! > this.limitFor(from.currency).daily && f.dailyLimit !== false) throw new BankError("DAILY_LIMIT_EXCEEDED", "That is over your daily limit.");
    }
    const freq = (existing ? existing.frequency : input.frequency) as Freq;
    if (!isFreq(freq)) throw new BankError("NOT_SUPPORTED", "This payment can’t be scheduled.");
    // the first date: from tomorrow, within 12 months, a business day
    const first = String(input.first ?? existing?.nextRunOn ?? "");
    if (!validIso(first)) throw new BankError("INVALID_DATE", "Choose a date.");
    // a change that keeps the date it already has was valid when it was made
    const moved = !existing || existing.status !== "active" || first !== existing.nextRunOn;
    if (moved && f.scheduleDates !== false) {
      if (first <= today) throw new BankError("DATE_TOO_SOON", "Choose a date from tomorrow.");
      if (first > addMonths(today, AHEAD_MONTHS)) throw new BankError("DATE_TOO_FAR", "Choose a date within the next 12 months.");
      if (!isWeekday(first)) throw new BankError("DATE_NOT_WEEKDAY", "Choose a weekday.");
      if (!isOpen(first, closed)) throw new BankError("DATE_CLOSED", "The bank is closed on that day. Choose another date.");
    }
    // a change that keeps the date and the end keeps the series; any other change starts it again from the date
    const sameEnd = (type: string, on: string | null, count: number | null) => !existing || (input.endType === undefined) || (type === this.endTypeOf(existing) && (type === "never" || (type === "date" ? on === existing.endsOn : count === remaining(existing, closed))));
    let endType = freq === "once" ? "never" : String(input.endType ?? (existing ? this.endTypeOf(existing) : "never")), endOn: string | null = null, endCount: number | null = null;
    if (freq !== "once") {
      if (endType === "date") endOn = String(input.endOn ?? ""); else if (endType === "count") endCount = Number(input.endCount);
      else if (endType !== "never") throw new BankError("NOT_SUPPORTED", "This payment can’t be scheduled.");
    }
    const keep = !!existing && existing.status === "active" && first === existing.nextRunOn && sameEnd(endType, endOn, endCount);
    // the same date and end: nothing about the series changes, whatever the end screen showed
    if (keep) { endType = this.endTypeOf(existing!); endOn = existing!.endsOn; endCount = existing!.endCount; }
    const series = keep ? { anchor: existing!.anchor, done: existing!.done } : { anchor: first, done: 0 };
    const later = Array.from({ length: END_DATES }, (_, i) => runDate(series.anchor, freq, series.done + 1 + i, closed));
    if (!keep && f.scheduleEnd !== false) {
      if (endType === "date" && (!validIso(endOn) || endOn <= first)) throw new BankError("END_BEFORE_START", "Choose an end date after the start.");
      if (endType === "date" && !later.includes(endOn!)) throw new BankError("INVALID_END_DATE", "Choose a date from the list.");
      if (endType === "count" && (!Number.isInteger(endCount) || endCount! < 2 || endCount! > FREQUENCIES[freq].max)) throw new BankError("INVALID_COUNT", "Enter a valid number of payments.");
    }
    // a payee added in the last 24 hours: the first payment waits until the 24 hours are over
    if (payee && !keep && f.coolingOff !== false) {
      const until = payee.addedAt + COOLING_OFF_HOURS * hour;
      if (msOf(first) < until) {
        const hours = hoursSince(payee.addedAt, this.now()), soonest = nextOpen(addDays(isoOf(until - 1), 1), closed);
        throw new BankError("BENEFICIARY_COOLING_OFF", `${payee.displayName} was added ${hours} ${hours === 1 ? "hour" : "hours"} ago. For your security the first payment to a new beneficiary must be on or after ${dayName(soonest, true)}.`);
      }
    }
    if (!existing && f.scheduleLimit !== false && this.schedules.filter((x) => x.kind && this.isLive(x)).length >= MAX_ACTIVE) throw new BankError("SCHEDULE_LIMIT", "You can have up to 20 scheduled payments. Cancel one to add another.");
    const asSeries = { ...series, frequency: freq, endsOn: endOn, endCount };
    const dates = upcoming(asSeries, series.done, 3, closed), a = amountText(mode, amount, from.currency);
    return {
      kind, targetId, name, mode, amount, currency: from.currency, freq, first, endType, endOn, endCount, series, keep, reminder: existing ? existing.reminder : input.reminder !== false, retry: existing ? existing.retry : input.retry === true,
      from: from.id,
      view: {
        targetName: name, toText: this.targetOf({ kind, targetId, name }).text, fromText: `${from.name} ${from.maskedNumber}`, amountText: a, authAmount: mode === "fixed" ? a : mode === "full" ? "the full bill" : "the minimum due", frequency: freq, frequencyName: FREQUENCIES[freq].name, adverb: FREQUENCIES[freq].adverb,
        firstText: dayName(first), startText: dayName(first, true), endType, endsText: this.endsText(freq, endType, endOn, endCount), nextDates: dates.map((d) => dayName(d)).join(" · "), reminder: existing ? existing.reminder : input.reminder !== false,
        // the payments after the first that "On a date" can end on
        dates: Object.fromEntries(later.map((d) => [d, { id: d, name: dayName(d, true) }])),
        maxCount: FREQUENCIES[freq].max, text: scheduleLine(name, freq, first, mode, amount, from.currency),
      },
    };
  }
  private schedulesApi(adapter: string, input: Record<string, any>): any {
    const closed = this.closedDays(), strict = input.strictCutoff === true;
    switch (adapter) {
      case "bank.schedules.list": {
        // without a status: every entry, as before. With one (active, paused, live, completed, cancelled or history): the Payments schedules of that kind, soonest first
        const st = input.status ? String(input.status) : "";
        const keep = (x: Schedule) => !st || (!!x.kind && (st === "live" ? this.isLive(x) : st === "history" ? !this.isLive(x) : (x.status ?? "active") === st));
        const list = this.schedules.filter(keep);
        if (st) list.sort((a, b) => ((a as any).nextRunOn ?? "").localeCompare((b as any).nextRunOn ?? "") || a.id.localeCompare(b.id));
        return Object.fromEntries(list.map((x) => [x.id, this.scheduleView(x, strict)]));
      }
      case "bank.schedules.get": {
        const x = this.scheduleOf(input.scheduleId);
        // for: "change" or "cancel" also says why it cannot be done now
        if (input.for === "change" || input.for === "cancel") this.checkChangeable(x, strict);
        const left = remaining(x, closed), type = this.endTypeOf(x);
        return {
          ...this.scheduleView(x, strict), endType: type, endOn: x.endsOn ?? "", endLeft: left ?? "",
          canSkip: x.frequency !== "once" && (left === null || left > 1) && this.isLive(x),
          afterText: dayName(runDate(x.anchor, x.frequency, x.done + 1, closed)),
        };
      }
      case "bank.schedules.check": {
        // the review before the code: the rules, the dates and the words; changes nothing
        const x = input.scheduleId ? this.scheduleOf(input.scheduleId) : undefined;
        if (x) this.checkChangeable(x, strict);
        const p = this.planSchedule(input, x);
        return { ok: true, ...p.view, existing: !!x };
      }
      case "bank.schedules.create":
      case "bank.schedules.update": {
        const isNew = adapter === "bank.schedules.create";
        if (!this.otp.verified) throw new BankError("OTP_REQUIRED", "OTP not verified");
        if (this.p.behaviour.transferFails) throw new BankError("CORE_UNAVAILABLE", "Core banking unavailable");
        const x = isNew ? undefined : this.scheduleOf(input.scheduleId);
        if (x) this.checkChangeable(x, strict);
        const p = this.planSchedule(input, x);
        const detail: ScheduleDetail = {
          kind: p.kind, targetId: p.targetId, fromAccountId: p.from, amountMode: p.mode, amount: p.amount, currency: p.currency, frequency: p.freq, anchor: p.series.anchor, done: p.series.done,
          paid: x?.paid ?? 0, nextRunOn: p.keep ? x!.nextRunOn : p.first, endsOn: p.endType === "date" ? p.endOn : null, endCount: p.endType === "count" ? p.endCount : null,
          status: "active", reminder: p.reminder, retry: p.retry, fails: 0,
        };
        if (isNew) {
          const id = `SCH-${this.nextScheduleNo()}`;
          this.schedules.push({ id, beneficiaryId: p.kind === "payee" ? p.targetId : "", name: p.name, text: p.view.text, ...detail });
          this.otp.verified = false;
          return { scheduleId: id, next: p.view.firstText, nextOn: p.first, ...p.view };
        }
        // an older end that is kept stays as it was
        Object.assign(x!, detail, { text: p.view.text });
        this.otp.verified = false;
        return { scheduleId: x!.id, next: p.view.firstText, nextOn: detail.nextRunOn, ...p.view };
      }
      case "bank.schedules.cancel": {
        const x = this.scheduleOf(input.scheduleId);
        this.checkChangeable(x, strict);
        const left = remaining(x, closed), name = this.targetOf(x).name, base = { scheduleId: x.id, name, amountText: amountText(x.amountMode, x.amount, x.currency), frequencyName: FREQUENCIES[x.frequency].name };
        if (input.scope === "next") {
          if (x.frequency === "once" || (left !== null && left < 2)) throw new BankError("NOT_SUPPORTED", "Only the next payment can be skipped, and only when the payment repeats.");
          const skipped = x.nextRunOn;
          x.done += 1; x.nextRunOn = runDate(x.anchor, x.frequency, x.done, closed); x.text = scheduleLine(x.name, x.frequency, x.nextRunOn, x.amountMode, x.amount, x.currency);
          return { ...base, status: "skipped", skippedOn: dayName(skipped, true), next: dayName(x.nextRunOn, true), nextOn: x.nextRunOn };
        }
        x.status = "cancelled"; x.endedOn = isoOf(this.now());
        return { ...base, status: "cancelled", cancelledOn: dayName(x.endedOn, true) };
      }
      default: return this.runDue(input);
    }
  }
  /**
   * The scheduler, for scenarios and tests: moves the sandbox clock to the middle of `date` (if that is later) and makes every payment that is due
   * on or before it, in date order. A payment checks the account, the payee, the daily limit and the new-payee allowance again; if there is not
   * enough money it is tried once more the next business day when the schedule asks (`retry`), otherwise skipped. Two in a row that do not go pause
   * the schedule. Answers one entry per payment dealt with.
   */
  private runDue(input: Record<string, any>) {
    const date = validIso(input.date) ? input.date : isoOf(this.now()), closed = this.closedDays(), noon = 12 * hour;
    const runs: { id: string; scheduleId: string; name: string; on: string; status: "paid" | "skipped" | "retry"; amount: number | null; reason: string; notice: string; paused: boolean }[] = [];
    const spent = new Map<string, number>();
    const dueOf = (x: Schedule & ScheduleDetail) => x.retryOn ?? x.nextRunOn;
    for (let guard = 0; guard < 600; guard++) {
      const due = (this.schedules.filter((x) => x.kind && x.status === "active" && dueOf(x as Schedule & ScheduleDetail) <= date) as (Schedule & ScheduleDetail)[]).sort((a, b) => dueOf(a).localeCompare(dueOf(b)) || a.id.localeCompare(b.id))[0];
      if (!due) break;
      const on = dueOf(due), at = msOf(on) + noon;
      if (at > this.now()) this.host.setNow(() => at);
      const r = this.runOne(due, on, spent), id = `${due.id}-${on}`, run = { id, scheduleId: due.id, name: due.name, on, amount: r.amount, reason: r.ok ? "" : r.code, paused: false };
      if (!r.ok && r.shortfall && due.retry && !due.retryOn) {
        due.retryOn = nextOpen(addDays(on, 1), closed);
        runs.push({ ...run, status: "retry", notice: `Payment postponed, not enough money. We’ll try again on ${dayName(due.retryOn)}.` });
        continue;
      }
      due.done += 1; due.retryOn = undefined;
      if (r.ok) { due.paid += 1; due.fails = 0; runs.push({ ...run, status: "paid", notice: "Payment sent" }); }
      else {
        due.fails += 1;
        const paused = due.fails >= 2;
        runs.push({ ...run, status: "skipped", paused, notice: `${r.shortfall ? "Payment skipped, not enough money" : "Payment skipped"}${paused ? ". Schedule paused" : ""}` });
        if (paused) due.status = "paused";
      }
      if (remaining(due, closed) === 0) { due.status = "completed"; due.endedOn = on; }
      else due.nextRunOn = runDate(due.anchor, due.frequency, due.done, closed);
      due.text = scheduleLine(due.name, due.frequency, due.nextRunOn, due.amountMode, due.amount, due.currency);
    }
    const end = msOf(date) + noon;
    if (end > this.now()) this.host.setNow(() => end);
    return Object.fromEntries(runs.map((r) => [r.id, r]));
  }
  /** One payment of a schedule on a day: checks everything again and, if it can go, moves the money. */
  private runOne(x: Schedule & ScheduleDetail, on: string, spent: Map<string, number>): { ok: true; amount: number } | { ok: false; code: string; amount: number | null; shortfall?: boolean } {
    const f = this.flaws, no = (code: string, amount: number | null = null, shortfall = false) => ({ ok: false as const, code, amount, shortfall });
    const from = this.p.accounts.find((a) => a.id === x.fromAccountId);
    if (!from || !from.canDebit) return no("ACCOUNT_CANNOT_DEBIT");
    let amount = x.amount ?? 0, to: Account | undefined, payee: Beneficiary | undefined;
    if (x.kind === "payee") { payee = this.payees().find((b) => b.id === x.targetId); if (!payee) return no("BENEFICIARY_NOT_FOUND"); }
    else if (x.kind === "own") { to = this.p.accounts.find((a) => a.id === x.targetId); if (!to) return no("ACCOUNT_NOT_FOUND"); }
    else {
      const saved = this.savedBillers.find((b) => b.id === x.targetId);
      if (!saved) return no("BILLER_NOT_FOUND");
      const due = billOf(saved.reference, msOf(on)).dueCents;
      amount = x.amountMode === "minimum" ? minimumCents(due) / 100 : x.amountMode === "full" ? due / 100 : amount;
      // a full bill is paid only up to the most the person agreed to
      if (x.amountMode === "full" && x.amount !== null && amount > x.amount) return no("ABOVE_CAP", amount);
    }
    if (amount > spendable(from) && f.funds !== false) return no("INSUFFICIENT_FUNDS", amount, true);
    const limit = this.limitFor(from.currency), key = `${on}:${from.currency}`, used = spent.get(key) ?? 0;
    if (used + amount > limit.daily && f.dailyLimit !== false) return no("DAILY_LIMIT_EXCEEDED", amount);
    const usd = this.toUsd(amount, from.currency);
    if (payee && f.coolingOff !== false) { try { this.coolingOff(payee, usd); } catch (e) { return no((e as BankError).code, amount); } }
    debit(from, amount);
    if (to) credit(to, amount);
    spent.set(key, used + amount);
    if (payee && this.isNew(payee)) this.sent.set(payee.id, [...(this.sent.get(payee.id) ?? []), { at: this.now(), usd }]);
    if (x.kind === "bill") { this.seq += 1; this.p.finance?.transactions.unshift({ id: `t_sch${this.seq}`, title: x.name, category: "bills", amount: -amount, daysAgo: 0, time: "Now" }); }
    return { ok: true, amount };
  }

  async call(adapter: string, input: Record<string, any> = {}): Promise<any> {
    if (this.cab.handles(adapter)) {
      const out = this.cab.call(adapter, input);
      if (out !== undefined) return out;
    }
    // a BankWorkx customer pays bills from the bank's own directory (bills.ts); the Meezan customers keep the older billers below
    if (this.p.brand === "bankworkx" && /^bank\.bill(er)?s\./.test(adapter)) return this.bankworkxBills(adapter, input);
    // a BankWorkx customer tops up from the bank's own operators (topup.ts); the Meezan customers keep the carriers and the 50 to 5,000 rule below
    if (this.p.brand === "bankworkx" && /^bank\.(carriers\.list|topup\.)/.test(adapter)) return this.bankworkxTopup(adapter, input);
    switch (adapter) {
      case "bank.accounts.list": {
        // homeOnly: the accounts that can pay someone else (in the currency of the customer's main account)
        const home = this.p.accounts[0]?.currency;
        return Object.fromEntries(this.p.accounts.filter((a) => input.homeOnly !== true || a.currency === home).map((a) => [a.id, a]));
      }
      case "bank.beneficiaries.list":
        // sendType: only the payees of one kind of payment (internal, domestic, international)
        return Object.fromEntries(this.payees().map((b) => this.payeeView(b)).filter((v) => !input.sendType || v.sendType === input.sendType).map((v) => [v.id, v]));
      case "bank.schedules.list":
      case "bank.schedules.get":
      case "bank.schedules.check":
      case "bank.schedules.create":
      case "bank.schedules.update":
      case "bank.schedules.cancel":
      case "bank.schedules.runDue":
        return this.schedulesApi(adapter, input);
      case "bank.payees.lookup": {
        const c = findCustomer(String(input.by ?? ""), String(input.value ?? ""));
        if (!c) throw new BankError("CUSTOMER_NOT_FOUND", "We can’t find a BankWorkx® customer with those details. Check them and try again.");
        const key = `bw:${c.customerNumber}`;
        if (this.flaws.payeeDuplicate !== false && this.payees().some((b) => b.key === key)) throw new BankError("BENEFICIARY_EXISTS", "You’ve already saved this payee. Choose them from your saved payees.");
        return { name: c.name, customerNumber: c.customerNumber, maskedAccount: `••${c.customerNumber.slice(-4)}`, currency: "USD", key };
      }
      case "bank.payments.quote":
        return this.priceTransfer(input);
      case "bank.payments.create": {
        if (!this.otp.verified) throw new BankError("OTP_REQUIRED", "OTP not verified");
        if (this.p.behaviour.transferFails) throw new BankError("CORE_UNAVAILABLE", "Core banking unavailable");
        const f = this.flaws, q = this.payQuotes.get(String(input.quoteId));
        if (!q) throw new BankError("QUOTE_NOT_FOUND", "Quote not found");
        if (q.used && f.quoteReplay !== false) throw new BankError("QUOTE_USED", "This quote has already been used");
        // a payment in another currency is priced for 60 seconds
        if (q.rate !== null && this.now() > Date.parse(q.expiresAt) && f.quoteExpiry !== false) throw new BankError("QUOTE_EXPIRED", "The exchange rate changed. Check the new amount and confirm again.");
        const from = this.p.accounts.find((a) => a.id === q.fromAccountId)!, home = q.currency;
        if (!from.canDebit && f.canDebit !== false) throw new BankError("ACCOUNT_CANNOT_DEBIT", "You can’t send money from this account right now.");
        // the money rules again: the balance, the limit and the allowance may have changed since the price was given
        const saved = q.payee.id ? this.payees().find((b) => b.id === q.payee.id) : undefined;
        const usd = this.toUsd(q.pay, home);
        this.checkMoney(from, home, q.pay, q.total, usd, { sentKey: saved?.id ?? q.payee.key, name: q.payee.name, addedAt: saved?.addedAt ?? this.now(), isNew: saved ? this.isNew(saved) : true }, q.coolingOff);
        const later = input.when === "later", days = businessDays(this.now());
        if (later && !days[String(input.sendOn)]) throw new BankError("INVALID_DATE", "Choose a date from the list.");
        const held = f.sanctions !== false && q.payee.name.toLowerCase().includes(SANCTIONS_NAME);
        // saving the payee is checked before any money moves (a copy of one already saved, the limit of 50)
        let payeeId = q.payee.id, details: PayeeDetails | undefined;
        if (input.save === true && !payeeId && !held) details = this.examinePayee(input).d;
        this.seq += 1;
        const reference = `TRX-20261102-${String(930 + this.seq).padStart(4, "0")}`, railReference = `RR-${String(7100 + this.seq)}`;
        q.used = true; this.otp.verified = false;
        if (details) {
          const b: Beneficiary = { ...details, id: `ben_new${++this.benSeq}`, addedAt: this.now(), verified: false, nameCheck: "na" };
          this.payees().push(b); payeeId = b.id;
          // what was sent to this account before it was saved still counts against its allowance
          const before = this.sent.get(q.payee.key);
          if (before) { this.sent.set(b.id, before); this.sent.delete(q.payee.key); }
        }
        const base = { reference, railReference, speed: q.speed, speedName: q.speedName, arrives: q.arrives, receive: { currency: q.payee.currency, amount: q.receive }, rate: q.rate, pay: q.pay, fee: q.fee, total: q.total, currency: home, payeeId: payeeId ?? null, payeeName: q.payee.name };
        if (held) return { ...base, status: "held" };
        if (later) {
          const repeat = REPEATS.includes(String(input.repeat)) ? String(input.repeat) : "none";
          const words = { none: "Once", weekly: "Every week", monthly: "Every month" }[repeat as "none"];
          this.schedules.push({ id: `sch_new${++this.schSeq}`, beneficiaryId: payeeId ?? "", name: q.payee.name, text: `${q.payee.name} · ${words}, ${days[String(input.sendOn)]!.name}, ${money(q.pay, home)}` });
          return { ...base, status: "scheduled", sendOn: String(input.sendOn), repeat };
        }
        const limit = this.limitFor(home);
        debit(from, q.total);
        limit.usedToday += q.pay;
        const isNew = saved ? this.isNew(saved) : true;
        if (isNew) { const key = payeeId ?? q.payee.key; this.sent.set(key, [...(this.sent.get(key) ?? []), { at: this.now(), usd }]); }
        return { ...base, status: q.speed === "instant" ? "settled" : "processing", newBalance: from.balance };
      }
      case "bank.payees.validate": {
        const { d, current } = this.examinePayee(input, input.payeeId ? String(input.payeeId) : undefined);
        const change = current ? this.payeeChange(d, current) : { nameChanged: false, detailsChanged: false };
        const [first = "", ...rest] = d.displayName.split(" ");
        return {
          ok: true, bankName: d.bank, maskedNumber: d.maskedNumber, key: d.key, currency: d.currency ?? this.p.accounts[0]?.currency, country: d.country, sendType: sendTypeOf(d.region),
          ...(d.region === "bw" ? { registeredName: d.displayName, found: `${first} ${rest.pop()?.[0] ?? ""}. · ${d.maskedNumber}` } : {}),
          // for a change: does it need the name check and the code, and does it start the 24 hours again?
          sensitive: change.nameChanged || change.detailsChanged, restartsClock: this.restartsClock(change),
        };
      }
      case "bank.payees.check": {
        const d = checkPayee(input, this.flaws);
        return checkName(d, d.displayName, { skip: input.skip === true, flaws: this.flaws });
      }
      case "bank.payees.save": {
        if (!this.otp.verified) throw new BankError("OTP_REQUIRED", "OTP not verified");
        const { d } = this.examinePayee(input);
        const chk = checkName(d, d.displayName, { skip: input.skip === true, flaws: this.flaws });
        if (chk.result !== "match" && input.acknowledged !== true) throw new BankError("PAYEE_NOT_CHECKED", "Check the payee before you continue.");
        const b: Beneficiary = { ...d, id: `ben_new${++this.benSeq}`, addedAt: this.now(), verified: this.flaws.verifiedOnMatch === false ? true : chk.result === "match", nameCheck: chk.result };
        this.payees().push(b);
        this.otp.verified = false;
        return { payeeId: b.id, addedAt: b.addedAt, coolingOffUntil: new Date(b.addedAt + COOLING_OFF_HOURS * hour).toISOString(), displayName: b.displayName, bank: b.bank, maskedNumber: b.maskedNumber, verified: b.verified, nameCheck: chk.result, allowanceUsd: COOLING_OFF_USD };
      }
      case "bank.payees.update": {
        const { d, current } = this.examinePayee(input, String(input.payeeId ?? ""));
        const cur = current!, change = this.payeeChange(d, cur);
        const sensitive = change.nameChanged || change.detailsChanged;
        let chk: NameCheck | undefined;
        // the name or the account changed: check the name again, and ask for the code. A nickname or a label alone needs neither.
        if (sensitive) {
          if (!this.otp.verified) throw new BankError("OTP_REQUIRED", "OTP not verified");
          chk = checkName(d, d.displayName, { skip: input.skip === true, flaws: this.flaws });
          if (chk.result !== "match" && input.acknowledged !== true) throw new BankError("PAYEE_NOT_CHECKED", "Check the payee before you continue.");
        }
        Object.assign(cur, d);
        if (chk) { cur.verified = this.flaws.verifiedOnMatch === false ? true : chk.result === "match"; cur.nameCheck = chk.result; }
        const restarted = this.restartsClock(change);
        if (restarted) cur.addedAt = this.now();
        if (sensitive) this.otp.verified = false;
        return { payeeId: cur.id, addedAt: cur.addedAt, coolingOffUntil: this.isNew(cur) ? new Date(cur.addedAt + COOLING_OFF_HOURS * hour).toISOString() : null, displayName: cur.displayName, bank: cur.bank, maskedNumber: cur.maskedNumber, verified: cur.verified === true, nameCheck: cur.nameCheck ?? "na", sensitive, restarted, allowanceUsd: COOLING_OFF_USD };
      }
      case "bank.payees.delete": {
        const list = this.payees(), i = list.findIndex((b) => b.id === input.payeeId);
        if (i < 0) throw new BankError("BENEFICIARY_NOT_FOUND", "We can't find that payee.");
        const gone = list[i]!, uses = this.schedules.filter((x) => x.beneficiaryId === gone.id && this.isLive(x));
        if (uses.length && input.cancelSchedules !== true && this.flaws.payeeInUse !== false) throw new BankError("BENEFICIARY_IN_USE", `${gone.displayName} is used by ${uses.length} scheduled ${uses.length === 1 ? "payment" : "payments"}. Cancel ${uses.length === 1 ? "it" : "them"} first.`);
        list.splice(i, 1);
        this.schedules = this.schedules.filter((x) => !(x.beneficiaryId === gone.id && this.isLive(x)));
        return { removed: true, schedulesCancelled: uses.length, displayName: gone.displayName, bank: gone.bank, maskedNumber: gone.maskedNumber };
      }
      case "bank.limits.get":
        // with a currency: the limit for accounts in that currency; without: the main one, as before
        return input.currency ? { ...this.limitFor(String(input.currency)), currency: String(input.currency) } : { ...this.p.limits };
      case "bank.fx.rate": {
        const from = String(input.from ?? ""), to = String(input.to ?? "");
        if (!fxSupports(from, this.fx) || !fxSupports(to, this.fx)) throw new BankError("CURRENCY_NOT_SUPPORTED", "We do not convert that currency pair");
        return { from, to, midRate: Math.round(midRate(from, to, this.fx)! * 1e6) / 1e6, rate: customerRate(from, to, this.fx), spreadPercent: this.fx.spread * 100 };
      }
      case "bank.fx.quote": {
        const from = this.p.accounts.find((a) => a.id === input.fromAccountId), to = this.p.accounts.find((a) => a.id === input.toAccountId);
        if (!from || !to) throw new BankError("ACCOUNT_NOT_FOUND", "Account not found");
        if (from.currency === to.currency) throw new BankError("SAME_CURRENCY", "Choose two accounts in different currencies");
        if (!from.canDebit && this.flaws.canDebit !== false) throw new BankError("ACCOUNT_CANNOT_DEBIT", "This account cannot send money right now");
        if (!fxSupports(from.currency, this.fx) || !fxSupports(to.currency, this.fx)) throw new BankError("CURRENCY_NOT_SUPPORTED", "We do not convert that currency pair");
        const get = input.direction === "get";
        const amount = Number(input.amount);
        // the amount is in the currency the person typed it in: what leaves (default) or what arrives
        const entered = get ? to.currency : from.currency;
        const digits = currencyInfo(entered).decimals;
        if (!(amount > 0) || Math.abs(amount * 10 ** digits - Math.round(amount * 10 ** digits)) > 1e-6) throw new BankError("INVALID_AMOUNT", `Enter an amount in ${entered} with at most ${digits} decimal places`);
        // the market moves a little between the first quote of a pair and a renewed one (fixed steps, so tests repeat)
        const pair = `${from.id}>${to.id}`, n = this.quoteCount.get(pair) ?? 0;
        this.quoteCount.set(pair, n + 1);
        const drift = n === 0 ? 0 : (this.fx.drift?.[(n - 1) % (this.fx.drift?.length || 1)] ?? 0);
        const price = priceQuote(from.currency, to.currency, amount, { cfg: this.fx, direction: get ? "get" : "send", drift, feeWaived: input.feeWaived === true });
        if (price.total > spendable(from) && this.flaws.funds !== false) throw new BankError("INSUFFICIENT_FUNDS", "Insufficient funds");
        this.seq += 1;
        const q: Quote = {
          quoteId: `fxq_${this.seq}`, fromAccountId: from.id, toAccountId: to.id,
          from: { currency: from.currency, amount: price.send }, to: { currency: to.currency, amount: price.receive },
          midRate: price.midRate, rate: price.rate, fee: price.fee, feeCurrency: from.currency, total: price.total,
          expiresAt: new Date(this.now() + QUOTE_TTL_SECONDS * 1000).toISOString(), ttlSeconds: QUOTE_TTL_SECONDS,
        };
        this.quotes.set(q.quoteId, { ...q, used: false });
        return q;
      }
      case "bank.fx.convert": {
        if (!this.otp.verified) throw new BankError("OTP_REQUIRED", "OTP not verified");
        if (this.p.behaviour.transferFails) throw new BankError("CORE_UNAVAILABLE", "Core banking unavailable");
        const q = this.quotes.get(String(input.quoteId));
        if (!q) throw new BankError("QUOTE_NOT_FOUND", "Quote not found");
        if (q.used && this.flaws.quoteReplay !== false) throw new BankError("QUOTE_USED", "This quote has already been used");
        if (this.now() > Date.parse(q.expiresAt) && this.flaws.quoteExpiry !== false) throw new BankError("QUOTE_EXPIRED", "The rate has expired. Get a new one.");
        const from = this.p.accounts.find((a) => a.id === q.fromAccountId)!, to = this.p.accounts.find((a) => a.id === q.toAccountId)!;
        if (q.total > spendable(from) && this.flaws.funds !== false) throw new BankError("INSUFFICIENT_FUNDS", "Insufficient funds");
        debit(from, q.total);
        credit(to, q.to.amount);
        q.used = true; this.otp.verified = false; this.seq += 1;
        return { reference: `FX-20261102-${String(930 + this.seq).padStart(4, "0")}`, from: { currency: from.currency, newBalance: from.balance }, to: { currency: to.currency, newBalance: to.balance }, quoteId: q.quoteId };
      }
      case "bank.transfers.own": {
        // money between a person's own accounts in the same currency: instant, free, and not counted against the daily limit
        if (!this.otp.verified) throw new BankError("OTP_REQUIRED", "OTP not verified");
        if (this.p.behaviour.transferFails) throw new BankError("CORE_UNAVAILABLE", "Core banking unavailable");
        const from = this.p.accounts.find((a) => a.id === input.fromAccountId), to = this.p.accounts.find((a) => a.id === input.toAccountId);
        if (!from || !to) throw new BankError("ACCOUNT_NOT_FOUND", "Account not found");
        if (from.id === to.id && this.flaws.sameAccount !== false) throw new BankError("SAME_ACCOUNT", "Choose two different accounts");
        if (!from.canDebit && this.flaws.canDebit !== false) throw new BankError("ACCOUNT_CANNOT_DEBIT", "This account cannot send money right now");
        if (from.currency !== to.currency) throw new BankError("CURRENCY_MISMATCH", "These accounts use different currencies: convert instead");
        const amount = Number(input.amount), digits = currencyInfo(from.currency).decimals;
        if (!(amount > 0) || Math.abs(amount * 10 ** digits - Math.round(amount * 10 ** digits)) > 1e-6) throw new BankError("INVALID_AMOUNT", `Enter an amount in ${from.currency} with at most ${digits} decimal places`);
        if (amount > spendable(from) && this.flaws.funds !== false) throw new BankError("INSUFFICIENT_FUNDS", "Insufficient funds");
        debit(from, amount);
        credit(to, amount);
        this.otp.verified = false; this.seq += 1;
        return { reference: `TRX-20261102-${String(930 + this.seq).padStart(4, "0")}`, from: { currency: from.currency, newBalance: from.balance }, to: { currency: to.currency, newBalance: to.balance } };
      }
      case "bank.accounts.totals": {
        // balances added up per currency, never across currencies; a record keyed by currency so it can feed a list
        const out: Record<string, { id: string; currency: string; total: number; count: number }> = {};
        for (const a of this.p.accounts) {
          const t = out[a.currency] ?? (out[a.currency] = { id: a.currency, currency: a.currency, total: 0, count: 0 });
          t.total = Math.round((t.total + a.balance) * 1000) / 1000; t.count += 1;
        }
        return out;
      }
      case "bank.transfers.create": {
        if (!this.otp.verified) throw new BankError("OTP_REQUIRED", "OTP not verified");
        if (this.p.behaviour.transferFails) throw new BankError("CORE_UNAVAILABLE", "Core banking unavailable");
        const amount = Number(input.amount);
        const from = this.p.accounts.find((a) => a.id === input.fromAccountId);
        if (!from) throw new BankError("ACCOUNT_NOT_FOUND", "Account not found");
        if (amount > spendable(from)) throw new BankError("INSUFFICIENT_FUNDS", "Insufficient funds");
        const limit = this.limitFor(from.currency);
        if (limit.usedToday + amount > limit.daily) throw new BankError("LIMIT_EXCEEDED", "Daily limit exceeded");
        // a payee added in the last 24 hours may only be sent a small amount (a payee the bank does not know is not held to it)
        const payee = input.beneficiaryId ? this.payees().find((b) => b.id === input.beneficiaryId) : undefined;
        const usd = this.toUsd(amount, from.currency);
        if (payee) this.coolingOff(payee, usd);
        debit(from, amount);
        limit.usedToday += amount;
        if (payee && this.isNew(payee)) this.sent.set(payee.id, [...(this.sent.get(payee.id) ?? []), { at: this.now(), usd }]);
        this.otp.verified = false;
        this.seq += 1;
        return { reference: `TRX-20261102-${String(930 + this.seq).padStart(4, "0")}`, newBalance: from.balance, currency: from.currency };
      }
      case "bank.billers.list":
        return Object.fromEntries(BILLERS.map((b) => [b.id, b]));
      case "bank.bills.lookup": {
        const biller = BILLERS.find((b) => b.id === input.billerId);
        const ref = String(input.reference ?? "").replace(/\s/g, "");
        if (!biller) throw new BankError("BILLER_NOT_FOUND", "Unknown biller");
        if (!/^[0-9]{10,14}$/.test(ref)) throw new BankError("BILL_NOT_FOUND", "No bill found for this reference");
        const amount = 1000 + (parseInt(ref.slice(-4), 10) % 9000);
        return { billerName: biller.name, reference: ref, payerName: this.p.name.split(" (")[0], amount, dueDate: "2026-11-12" };
      }
      // the saved billers and the price of a bill are for BankWorkx customers (bills.ts)
      case "bank.bills.saved":
      case "bank.bills.quote":
        throw new BankError("NOT_SUPPORTED", "Not available for this customer");
      // the saved numbers and the check of a top-up are for BankWorkx customers (topup.ts)
      case "bank.topup.amounts":
      case "bank.topup.numbers":
      case "bank.topup.check":
        throw new BankError("NOT_SUPPORTED", "Not available for this customer");
      case "bank.activity.list": {
        const fin = this.p.finance; if (!fin) throw new BankError("NOT_SUPPORTED", "Not available for this customer");
        return Object.fromEntries(fin.transactions.map((t) => [t.id, t]));
      }
      case "bank.bills.pay":
      case "bank.topup.create": {
        const isBill = adapter === "bank.bills.pay";
        if (!this.otp.verified) throw new BankError("OTP_REQUIRED", "OTP not verified");
        if (this.p.behaviour.transferFails) throw new BankError("CORE_UNAVAILABLE", "Core banking unavailable");
        const amount = Number(input.amount);
        if (!isBill && !(amount >= 50 && amount <= 5000)) throw new BankError("INVALID_AMOUNT", "Top-up must be between 50 and 5,000");
        const from = this.p.accounts.find((a) => a.id === input.fromAccountId);
        if (!from) throw new BankError("ACCOUNT_NOT_FOUND", "Account not found");
        if (amount > spendable(from)) throw new BankError("INSUFFICIENT_FUNDS", "Insufficient funds");
        const limit = this.limitFor(from.currency);
        if (limit.usedToday + amount > limit.daily) throw new BankError("LIMIT_EXCEEDED", "Daily limit exceeded");
        debit(from, amount);
        limit.usedToday += amount;
        this.otp.verified = false;
        this.seq += 1;
        return { reference: `${isBill ? "BILL" : "TOP"}-20261102-${String(930 + this.seq).padStart(4, "0")}`, newBalance: from.balance };
      }
      case "bank.banks.list":
        return Object.fromEntries(BANKS.map((b) => [b.id, { id: b.id, name: b.name, color: b.color }]));
      case "bank.cards.list":
        return Object.fromEntries((this.p.finance?.cards ?? []).map((c) => [c.id, { ...c, name: `${c.nickname} ••${c.last4}` }]));
      case "bank.budgets.list":
        return Object.fromEntries((this.p.finance?.budgets ?? []).map((b) => [b.id, b]));
      case "bank.subscriptions.list":
        return Object.fromEntries((this.p.finance?.subscriptions ?? []).map((x) => [x.id, x]));
      case "bank.deposit.create": {
        const fin = this.p.finance; if (!fin) throw new BankError("NOT_SUPPORTED", "Not available for this customer");
        const to = this.p.accounts.find((a) => a.id === input.toAccountId);
        if (!to) throw new BankError("ACCOUNT_NOT_FOUND", "Account not found");
        const amount = Number(input.amount);
        if (!(amount >= 1 && amount <= 50000)) throw new BankError("INVALID_AMOUNT", "Enter an amount from $1 to $50,000");
        if (!fin.cards.some((c) => c.id === input.fromCardId)) throw new BankError("CARD_NOT_FOUND", "Choose a card to add money from");
        credit(to, amount);
        fin.transactions.unshift({ id: `t_dep${++this.seq}`, title: "Added money", category: "income", amount, daysAgo: 0, time: "Now" });
        return { reference: `ADD-20261102-${String(930 + this.seq).padStart(4, "0")}`, newBalance: to.balance };
      }
      case "bank.cards.add": {
        const fin = this.p.finance; if (!fin) throw new BankError("NOT_SUPPORTED", "Not available for this customer");
        const num = String(input.number ?? "").replace(/\s/g, "");
        if (!luhnValid(num)) throw new BankError("CARD_INVALID", "That card number is not valid");
        const m = /^(0[1-9]|1[0-2])\/?([0-9]{2})$/.exec(String(input.expiry ?? "").replace(/\s/g, ""));
        if (!m) throw new BankError("EXPIRY_INVALID", "Enter the expiry as MM/YY");
        const exp = new Date(2000 + Number(m[2]), Number(m[1]), 0, 23, 59);
        if (exp.getTime() < Date.UTC(2026, 10, 2)) throw new BankError("CARD_EXPIRED", "This card has expired");
        if (!/^[0-9]{3,4}$/.test(String(input.cvv ?? ""))) throw new BankError("CVV_INVALID", "Enter the 3 or 4 digit security code");
        if (fin.cards.some((c) => c.last4 === num.slice(-4))) throw new BankError("CARD_EXISTS", "This card is already added");
        const makeDefault = input.makeDefault === true || fin.cards.length === 0;
        if (makeDefault) fin.cards.forEach((c) => { c.isDefault = false; });
        const card = { id: `c_${num.slice(-4)}`, network: cardNetwork(num), last4: num.slice(-4), holder: String(input.holder ?? this.p.name), expiry: `${m[1]}/${m[2]}`, nickname: String(input.nickname || "My card"), isDefault: makeDefault };
        fin.cards.push(card);
        return { cardId: card.id, last4: card.last4, network: card.network };
      }
      case "bank.accounts.connect": {
        const fin = this.p.finance; if (!fin) throw new BankError("NOT_SUPPORTED", "Not available for this customer");
        const bank = BANKS.find((b) => b.id === input.bankId);
        if (!bank) throw new BankError("BANK_NOT_FOUND", "Choose a bank to connect");
        if (!String(input.username ?? "").trim() || String(input.password ?? "").length < 6) throw new BankError("BANK_AUTH_FAILED", "Check your username and password");
        if (String(input.password) === "invalid123") throw new BankError("BANK_AUTH_FAILED", `${bank.name} did not accept these details`);
        if (fin.linked.some((l) => l.id === `l_${bank.id}`)) throw new BankError("ALREADY_CONNECTED", `${bank.name} is already connected`);
        const kind = input.accountType === "credit" ? "Credit" : "Savings";
        const linked = { id: `l_${bank.id}`, bank: bank.name, kind, maskedNumber: `••${String(1000 + (String(input.username).length * 977) % 9000).slice(-4)}`, balance: kind === "Credit" ? 1240.5 : 4210.25 } as const;
        fin.linked.push(linked);
        return { connectedId: linked.id, bank: bank.name, kind, maskedNumber: linked.maskedNumber, balance: linked.balance };
      }
      case "bank.budgets.create": {
        const fin = this.p.finance; if (!fin) throw new BankError("NOT_SUPPORTED", "Not available for this customer");
        const limit = Number(input.limit);
        if (!(limit >= 10 && limit <= 100000)) throw new BankError("INVALID_AMOUNT", "A budget must be between $10 and $100,000");
        const name = String(input.category ?? "").trim();
        if (!name) throw new BankError("CATEGORY_REQUIRED", "Choose a category");
        if (fin.budgets.some((b) => b.name.toLowerCase() === name.toLowerCase())) throw new BankError("BUDGET_EXISTS", `You already have a ${name} budget`);
        const b = { id: `b_${name.toLowerCase().replace(/[^a-z]+/g, "_")}`, name, category: "shopping" as const, limit, spent: 0 };
        fin.budgets.push(b);
        return { budgetId: b.id, name, limit };
      }
      case "bank.subscriptions.pay": {
        const fin = this.p.finance; if (!fin) throw new BankError("NOT_SUPPORTED", "Not available for this customer");
        const sub = fin.subscriptions.find((x) => x.id === input.subscriptionId);
        if (!sub) throw new BankError("SUBSCRIPTION_NOT_FOUND", "Subscription not found");
        const from = this.p.accounts.find((a) => a.id === input.fromAccountId);
        if (!from) throw new BankError("ACCOUNT_NOT_FOUND", "Account not found");
        if (sub.amount > spendable(from)) throw new BankError("INSUFFICIENT_FUNDS", "Insufficient funds");
        debit(from, sub.amount);
        sub.nextInDays += 30;
        fin.transactions.unshift({ id: `t_sub${++this.seq}`, title: sub.name, category: "entertainment", amount: -sub.amount, daysAgo: 0, time: "Now" });
        return { reference: `SUB-20261102-${String(930 + this.seq).padStart(4, "0")}`, newBalance: from.balance };
      }
      case "bank.invest.instruments":
        return Object.fromEntries(INSTRUMENTS.map((i) => [i.symbol, { id: i.symbol, symbol: i.symbol, kind: i.kind, sector: i.sector, price: i.price, changePct: dayChange(i).pct, name: `${i.name} (${i.symbol}) · $${i.price.toFixed(2)}` }]));
      case "bank.invest.buy": {
        const fin = this.p.finance; if (!fin) throw new BankError("NOT_SUPPORTED", "Not available for this customer");
        const inst = instrumentOf(String(input.symbol));
        if (!inst) throw new BankError("INSTRUMENT_NOT_FOUND", "Choose a stock or fund to buy");
        const amount = Number(input.amount);
        if (!(amount >= 1 && amount <= 50000)) throw new BankError("INVALID_AMOUNT", "Enter an amount from $1 to $50,000");
        const from = this.p.accounts.find((a) => a.id === input.fromAccountId);
        if (!from) throw new BankError("ACCOUNT_NOT_FOUND", "Account not found");
        if (amount > spendable(from)) throw new BankError("INSUFFICIENT_FUNDS", "Insufficient funds");
        const shares = Math.round((amount / inst.price) * 10000) / 10000;
        const held = fin.invest.holdings.find((h) => h.symbol === inst.symbol);
        if (held) { held.avgCost = (held.avgCost * held.shares + amount) / (held.shares + shares); held.shares = Math.round((held.shares + shares) * 10000) / 10000; }
        else fin.invest.holdings.push({ symbol: inst.symbol, shares, avgCost: inst.price });
        debit(from, amount);
        fin.transactions.unshift({ id: `t_inv${++this.seq}`, title: `Bought ${inst.symbol}`, category: "investing", amount: -amount, daysAgo: 0, time: "Now" });
        return { reference: `INV-20261102-${String(930 + this.seq).padStart(4, "0")}`, symbol: inst.symbol, name: inst.name, shares, price: inst.price, newBalance: from.balance };
      }
      case "bank.invest.holdings": {
        const fin = this.p.finance; if (!fin) throw new BankError("NOT_SUPPORTED", "Not available for this customer");
        return Object.fromEntries(fin.invest.holdings.map((h) => {
          const i = instrumentOf(h.symbol)!, value = Math.round(h.shares * i.price * 100) / 100;
          return [h.symbol, { id: h.symbol, symbol: h.symbol, shares: h.shares, value, name: `${i.name} (${h.symbol}) · $${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }];
        }));
      }
      case "bank.invest.sell": {
        const fin = this.p.finance; if (!fin) throw new BankError("NOT_SUPPORTED", "Not available for this customer");
        const inst = instrumentOf(String(input.symbol));
        const held = fin.invest.holdings.find((h) => h.symbol === input.symbol);
        if (!inst || !held) throw new BankError("NOT_HELD", "Choose something you own to sell");
        const amount = Number(input.amount);
        if (!(amount >= 1)) throw new BankError("INVALID_AMOUNT", "Enter an amount of at least $1");
        const to = this.p.accounts.find((a) => a.id === input.toAccountId);
        if (!to) throw new BankError("ACCOUNT_NOT_FOUND", "Account not found");
        const value = held.shares * inst.price;
        if (amount > value + 0.005) throw new BankError("INSUFFICIENT_HOLDING", `You only hold $${(Math.floor(value * 100) / 100).toFixed(2)} of ${inst.symbol}`);
        // selling the whole value sells every share, so no rounding crumbs are left behind
        const all = value - amount < 0.01;
        const shares = all ? held.shares : Math.round((amount / inst.price) * 10000) / 10000;
        const proceeds = all ? Math.round(value * 100) / 100 : amount;
        if (all) fin.invest.holdings = fin.invest.holdings.filter((h) => h.symbol !== inst.symbol);
        else held.shares = Math.round((held.shares - shares) * 10000) / 10000;
        credit(to, proceeds);
        fin.transactions.unshift({ id: `t_sell${++this.seq}`, title: `Sold ${inst.symbol}`, category: "investing", amount: proceeds, daysAgo: 0, time: "Now" });
        return { reference: `SEL-20261102-${String(930 + this.seq).padStart(4, "0")}`, symbol: inst.symbol, name: inst.name, shares, price: inst.price, proceeds, newBalance: to.balance };
      }
      case "bank.invest.watch": {
        const fin = this.p.finance; if (!fin) throw new BankError("NOT_SUPPORTED", "Not available for this customer");
        if (!instrumentOf(String(input.symbol))) throw new BankError("INSTRUMENT_NOT_FOUND", "Unknown stock or fund");
        const w = fin.invest.watchlist.filter((s) => s !== input.symbol);
        fin.invest.watchlist = input.on === false ? w : [...w, String(input.symbol)];
        return { watching: input.on !== false };
      }
      case "bank.carriers.list":
        return Object.fromEntries(CARRIERS.map((c) => [c.id, c]));
      default: {
        const out = retailRecords(this.p, adapter, input, this.now());
        if (out !== undefined) return out;
        throw new BankError("UNKNOWN_ADAPTER", `No sandbox handler for ${adapter}`);
      }
    }
  }
}
