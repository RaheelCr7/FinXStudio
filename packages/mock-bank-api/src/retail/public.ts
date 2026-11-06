import { BankError } from "../errors";
import type { SandboxConditions } from "../index";
import type { Flaws } from "../business/corporate";
import { journeyEnabled, type BankConfig } from "../config";
import { ACCESS, freshOtp, judgeCode, sendCode, type AccessDirectory, type AccessSandbox, type Otp } from "../access";
import { luhnValid } from "./finance";
import {
  DEPOSIT_RANGE, DEPOSIT_RATES, HOURS, LOANS, MARKETS, MARKET_BY_HOME, MONTHS, PLACES, PRODUCTS, aprText, cardKey, depositInterest, distanceText, hashContact, hashMobile6, hoursRows, loanFigures,
  openStatus, ratePct, roundedDiv, termText, type Application, type BankCustomer, type PubMarket,
} from "./public-data";

/**
 * Everything a person can do before signing in (BankWorkx, Public): read the products and the rates, work out a loan or a deposit, find a branch or a cash machine, reach the bank,
 * open an account (with save and resume, the ID and the selfie), track an application, and register for digital banking. No adapter here answers with account data, and none moves money.
 *
 * What the bank keeps about a person is a mask or a hash: the last four digits of a mobile number, a hash of an email, an ID number or a tax ID; the name and the answers of a saved draft
 * until it is sent; never a photo, a code or a password (the password goes to the sign-in directory as a hash). Every rule can be switched off for the mutation check (Flaws).
 */
export type PublicHost = {
  now: () => number; config: () => BankConfig; conditions: () => SandboxConditions; flaws: () => Flaws; dir: AccessDirectory; access: AccessSandbox;
  /** The device the apps (or a scenario) run on: a saved draft belongs to it. */
  device: () => string;
};

const ADAPTERS = /^(bank\.(products\.(list|get)|rates\.(loans|deposits)|locations\.(search|details)|support\.(hours|openChat|sendMessage)|onboarding\.(begin|start|check|save|discard|verifyIdentity|submit)|applications\.(find|status)|registration\.(verify|complete))|sandbox\.public\.(inspect|advance))$/;
const DAY = 86_400_000, MINUTE = 60_000;
export const SAVE_DAYS = 30;
const TOPICS = ["Accounts", "Cards", "Payments", "Loans and savings", "Online and app banking", "Something else"];
/** An email address is checked without a backtracking pattern: at most 80 characters, no spaces, one "@", and a dot inside the domain with text on both sides. */
const isEmail = (s: string) => {
  if (s.length === 0 || s.length > 80 || /\s/.test(s)) return false;
  const at = s.indexOf("@");
  if (at < 1 || at !== s.lastIndexOf("@")) return false;
  const dot = s.lastIndexOf(".");
  return dot > at + 1 && dot < s.length - 1;
};
const EMAIL = { test: isEmail };
const digitsOf = (s: unknown) => String(s ?? "").replace(/\D/g, "");
const norm = (s: unknown) => String(s ?? "").trim();
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10).replace(/-/g, "");
const seq4 = (n: number) => String(n).padStart(4, "0");
const maskLast4 = (last4: string) => `••• ${last4}`;
const maskEmail = (e: string) => e.replace(/^(.).*(@.*)$/, "$1•••$2");
const group = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
/** Cents as money: the symbol, whole units grouped by thousands, two decimals. Whole numbers only: no float is ever formatted. */
export const moneyText = (cents: number, sym: string) => `${sym}${group(Math.floor(cents / 100))}.${String(cents % 100).padStart(2, "0")}`;
const wholeText = (n: number, sym: string) => `${sym}${group(n)}`;

type Flow = { kind: "onboard" | "track" | "register"; masked: string; otp: Otp };
type Reg = { token: string; expiresAt: number; customerId?: string; applicationRef?: string; name: string; last4: string; email: string; phone: string; dob: string; persona: string };

/** The ID number each market asks for, the proof of address, the postcode field and the tax declaration (the customer never sees a country name here). */
export const ONBOARD_MARKET: Record<PubMarket, { idHint: string; idMessage: string; id: RegExp; poa: boolean; postcode: boolean; taxText: string }> = {
  A: { idHint: "9 digits", idMessage: "Enter the 9 digits.", id: /^\d{9}$/, poa: false, postcode: true, taxText: "I confirm my tax details are correct and I am not subject to backup withholding." },
  B: { idHint: "2 letters, 6 digits, 1 letter", idMessage: "Use 2 letters, 6 digits, then 1 letter.", id: /^[A-Za-z]{2}\d{6}[A-Za-z]$/, poa: false, postcode: true, taxText: "I confirm my tax residency details are correct." },
  C: { idHint: "8 to 14 letters or digits", idMessage: "Use 8 to 14 letters or digits.", id: /^[A-Za-z0-9]{8,14}$/, poa: false, postcode: true, taxText: "I confirm these details may be reported for automatic exchange of tax information." },
  D: { idHint: "15 digits, starting 784", idMessage: "Enter the 15 digits, starting 784.", id: /^784\d{12}$/, poa: true, postcode: false, taxText: "I confirm my tax residency details are correct and may be shared with the tax authority." },
};
const COUNTRIES = ["United States", "United Kingdom", "Germany", "France", "Spain", "Italy", "Canada", "Australia", "India", "Pakistan", "Jordan", "United Arab Emirates", "Saudi Arabia", "Egypt"];
const BANDS = {
  income: [["u25", "Under {s}25,000"], ["25-50", "{s}25,000 to {s}50,000"], ["50-100", "{s}50,000 to {s}100,000"], ["100-250", "{s}100,000 to {s}250,000"], ["250-1m", "{s}250,000 to {s}1M"], ["o1m", "Over {s}1M"]],
  deposits: [["u2", "Under {s}2,000"], ["2-10", "{s}2,000 to {s}10,000"], ["10-50", "{s}10,000 to {s}50,000"], ["o50", "Over {s}50,000"]],
} as const;
const EMPLOYMENT = ["Employed", "Self-employed", "Student", "Retired", "Not working"];
const FUNDS = ["Salary", "Business income", "Savings", "Pension", "Investments", "Gift or inheritance"];
const DOCS = ["national-id", "passport", "licence"];
const ACCOUNT_CHOICES = [["acc_everyday", "Everyday Account", "No monthly fee, with a debit card"], ["acc_saver", "Aurora Savings", "Earn interest, withdraw any time"], ["acc_islamic", "Everyday Islamic Account", "Profit sharing, no interest"]] as const;

export class PublicApi {
  private flow: Flow | undefined;
  private reg: Reg | undefined;
  private regFails = 0; private regLockedUntil = 0;
  private trackFails = 0; private trackLockedUntil = 0;
  /** The application whose details were right in this session (and so may show its status once the code, when asked for, was right). */
  private tracking: string | undefined;
  private support = { chats: 0, messages: 0, recent: [] as number[] };
  constructor(private host: PublicHost) {}
  handles = (adapter: string) => ADAPTERS.test(adapter);
  private get f() { return this.host.flaws(); }
  private now = () => this.host.now();
  private get pub() { return this.host.dir.pub; }
  private market = (): PubMarket => MARKET_BY_HOME[this.host.config().homeMarket] ?? "A";
  private opt = (slug: string, key: string) => this.host.config().options[slug]?.[key];
  /** An option the bank switches off for everyone (config) or the journey passes as off. A rule of the bank never relies on the screen alone. */
  private on = (slug: string, key: string, input: Record<string, any> = {}, dflt = true) => (dflt ? this.opt(slug, key) !== false && input[key] !== false : this.opt(slug, key) === true && input[key] !== false);
  private tt = (n: number) => (this.f.pubTermText === false ? `${n} months` : termText(n));
  private sym = () => (this.f.pubSymbol === false ? "$" : MARKETS[this.market()].symbol);

  /** Whether the one-time code calls belong to a public flow that is in progress. */
  get ownsCodes() { return !!this.flow; }
  /** A sign-in or a recovery starts: no public flow is going on any more (a code belongs to one flow at a time). */
  endFlow() { this.flow = undefined; }

  call(adapter: string, input: Record<string, any>): any {
    switch (adapter) {
      case "bank.products.list": return this.productList(input);
      case "bank.products.get": return this.productGet(input);
      case "bank.rates.loans": return this.loanRates(input);
      case "bank.rates.deposits": return this.depositRates(input);
      case "bank.locations.search": return this.placeSearch(input);
      case "bank.locations.details": return this.placeDetails(input);
      case "bank.support.hours": return this.supportHours(input);
      case "bank.support.openChat": return this.openChat(input);
      case "bank.support.sendMessage": return this.sendMessage(input);
      case "bank.onboarding.begin": return this.begin(input);
      case "bank.onboarding.start": return this.start(input);
      case "bank.onboarding.check": return this.check(input);
      case "bank.onboarding.save": return this.save(input);
      case "bank.onboarding.discard": return this.discard(input);
      case "bank.onboarding.verifyIdentity": return this.verifyIdentity(input);
      case "bank.onboarding.submit": return this.submit(input);
      case "bank.applications.find": return this.find(input);
      case "bank.applications.status": return this.status();
      case "bank.registration.verify": return this.registrationVerify(input);
      case "bank.registration.complete": return this.registrationComplete(input);
      case "sandbox.public.inspect": return this.inspect(input);
      case "sandbox.public.advance": return this.advance(input);
    }
    return undefined;
  }

  /* ------------------------------------------------------------------------------------------ the one-time code */

  /**
   * `bank.otp.send` and `bank.otp.verify` while a public flow is in progress: the code goes to the mobile number of the customer being registered, of the application being tracked, or
   * of the person opening an account. The rules are the sign-in's (482100, a new one after each send, 000000 wrong, 999999 expired, five minutes, three resends); a wrong code at the
   * registration and the tracking counts with the wrong identity checks towards the same lock.
   */
  codeCall(adapter: "bank.otp.send" | "bank.otp.verify", input: Record<string, any>) {
    const fl = this.flow;
    if (!fl) throw new BankError("VERIFY_FIRST", "Start with your details first.");
    this.assertNotLocked(fl.kind);
    if (adapter === "bank.otp.send") {
      fl.otp = sendCode(fl.otp, this.now(), this.f);
      return { sent: true, maskedPhone: fl.masked, channel: input.channel ?? "sms", resendsLeft: Math.max(0, ACCESS.maxResends + 1 - fl.otp.sends) };
    }
    if (judgeCode(fl.otp, String(input.code ?? ""), this.now(), this.f) === "wrong") {
      if (fl.kind === "register" && this.failed("register")) throw new BankError("ID_LOCKED", "Too many tries.", fl.otp.wrong);
      if (fl.kind === "track" && this.failed("track")) throw new BankError("TRACK_LOCKED", "Too many tries.", fl.otp.wrong);
      throw new BankError("OTP_INVALID", "That code isn't right.", fl.otp.wrong);
    }
    if (fl.kind === "onboard") { const a = this.draft(); if (a) a.verified = true; }
    return { verified: true };
  }
  /** A wrong identity check or code: counted, and the third locks the journey for 30 minutes by the sandbox clock. Returns whether it is locked now. */
  private failed(kind: "register" | "track"): boolean {
    const n = kind === "register" ? ++this.regFails : ++this.trackFails;
    const lock = (kind === "register" ? this.f.pubRegLock : this.f.pubTrackLock) !== false;
    if (n >= ACCESS.maxRecoveryFails && lock) {
      const until = this.now() + ACCESS.lockMinutes * MINUTE;
      if (kind === "register") { this.regLockedUntil = until; this.reg = undefined; } else { this.trackLockedUntil = until; this.tracking = undefined; }
      return true;
    }
    return false;
  }
  private assertNotLocked(kind: "onboard" | "track" | "register") {
    const now = this.now();
    if (kind === "register") { if (this.regLockedUntil && now >= this.regLockedUntil) { this.regLockedUntil = 0; this.regFails = 0; } if (this.regLockedUntil) throw new BankError("ID_LOCKED", "Too many tries. For your security, try again in 30 minutes, or contact us."); }
    if (kind === "track") { if (this.trackLockedUntil && now >= this.trackLockedUntil) { this.trackLockedUntil = 0; this.trackFails = 0; } if (this.trackLockedUntil) throw new BankError("TRACK_LOCKED", "Too many tries. For your security, try again in 30 minutes, or contact us."); }
  }

  /* ------------------------------------------------------------------------------------------------ products */

  private productList(input: Record<string, any>) {
    const type = input.type === undefined ? undefined : String(input.type);
    return Object.fromEntries(PRODUCTS.filter((p) => !type || p.type === type).sort((a, b) => a.rank - b.rank).map((p) => [p.id, structuredClone(p)]));
  }
  private productGet(input: Record<string, any>) {
    const p = PRODUCTS.find((x) => x.id === input.productId);
    if (!p) throw new BankError("PRODUCT_NOT_FOUND", "We can't find that product. It may have changed.");
    return structuredClone(p);
  }

  /* --------------------------------------------------------------------------------------------------- rates */

  private amountCheck(amount: unknown, min: number, max: number, step: number, sym: string, f: Flaws["pubLoanRange"]) {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) throw new BankError("AMOUNT_REQUIRED", "Enter an amount.");
    // whole units only for the table: cents are compared as whole numbers, never as a fraction
    const cents = Math.round(n * 100);
    if (f === false) return cents;
    if (cents < min * 100 || cents > max * 100) throw new BankError("AMOUNT_RANGE", `Choose an amount from ${wholeText(min, sym)} to ${wholeText(max, sym)}.`);
    if (cents % (step * 100) !== 0) throw new BankError("AMOUNT_STEP", `Choose an amount in steps of ${wholeText(step, sym)}.`);
    return cents;
  }
  /** The loan table with the factors a screen follows the amount and the term with and, with an amount and a term, the exact figures. */
  private loanRates(input: Record<string, any>) {
    const sym = this.sym(), showHome = this.on("loan-calculator", "showHome", input);
    const kinds = LOANS.filter((l) => l.type !== "home" || showHome);
    const loans = Object.fromEntries(kinds.map((l) => {
      const terms: Record<string, { term: number; text: string; pay: number; total: number }> = {};
      for (let n = l.termMin; n <= l.termMax; n += l.termStep) { const g = loanFigures(100, l.aprH, n); terms[String(n)] = { term: n, text: this.tt(n), pay: g.payFactor, total: g.totalFactor }; }
      return [l.type, { type: l.type, name: l.name, termChoices: Object.fromEntries(Object.values(terms).map((t) => [String(t.term), { id: String(t.term), name: t.text }])), aprH: l.aprH, apr: aprText(l.aprH), amountMin: l.amountMin, amountMax: l.amountMax, amountStep: l.amountStep, startAmount: l.startAmount, termMin: l.termMin, termMax: l.termMax, termStep: l.termStep, startTerm: l.startTerm, factors: terms }];
    }));
    const out: Record<string, any> = { symbol: sym, currency: this.f.pubSymbol === false ? "USD" : MARKETS[this.market()].currency, market: this.market(), home: showHome, loans, order: kinds.map((l) => l.type) };
    if (input.amount === undefined && input.term === undefined && input.type === undefined) return out;
    const kind = kinds.find((l) => l.type === input.type);
    if (!kind) throw new BankError("LOAN_TYPE_INVALID", "Choose a loan.");
    const cents = this.amountCheck(input.amount, kind.amountMin, kind.amountMax, kind.amountStep, sym, this.f.pubLoanRange);
    const term = Number(input.term);
    if (!Number.isInteger(term) || (this.f.pubLoanRange !== false && (term < kind.termMin || term > kind.termMax || (term - kind.termMin) % kind.termStep !== 0))) throw new BankError("TERM_INVALID", "Choose a term from the list.");
    const g = loanFigures(cents, kind.aprH, term);
    // a bank that adds the interest in a lump (rate x years) instead of working it month by month pays too much back in a short term and too little in a long one
    const total = this.f.pubLoanFormula === false ? cents + roundedDiv(cents * kind.aprH * term, 120000) : g.totalCents;
    const payment = this.f.pubLoanFormula === false ? roundedDiv(total, term) : g.paymentCents;
    out.quote = {
      type: kind.type, name: kind.name, amountCents: cents, term, termText: this.tt(term), apr: aprText(kind.aprH), paymentCents: payment, interestCents: total - cents, totalCents: total,
      amountText: moneyText(cents, sym), paymentText: moneyText(payment, sym), interestText: moneyText(total - cents, sym), totalText: moneyText(total, sym),
      reference: `EST-${ymd(this.now())}-${seq4(Math.floor(this.now() / 1000) % 10000)}`,
    };
    return out;
  }
  private depositRates(input: Record<string, any>) {
    const sym = this.sym(), allowMonthly = this.on("deposit-calculator", "allowMonthly", input);
    const rateOf = (months: number) => (this.f.pubDepositRate === false ? DEPOSIT_RATES.find((r) => r.termMonths === 12)! : DEPOSIT_RATES.find((r) => r.termMonths === months)!).rateH;
    const terms = Object.fromEntries(DEPOSIT_RATES.map((r) => [String(r.termMonths), { id: String(r.termMonths), term: r.termMonths, name: this.tt(r.termMonths), rateH: rateOf(r.termMonths), rate: ratePct(rateOf(r.termMonths)), rateText: `${ratePct(rateOf(r.termMonths))}% a year` }]));
    const out: Record<string, any> = { symbol: sym, currency: this.f.pubSymbol === false ? "USD" : MARKETS[this.market()].currency, market: this.market(), terms, range: { ...DEPOSIT_RANGE }, allowMonthly };
    if (input.amount === undefined && input.term === undefined) return out;
    const cents = this.amountCheck(input.amount, DEPOSIT_RANGE.min, DEPOSIT_RANGE.max, DEPOSIT_RANGE.step, sym, this.f.pubDepositRange);
    const t = terms[String(input.term)];
    if (!t) throw new BankError("TERM_INVALID", "Choose a term from the list.");
    const pay = input.pay === undefined ? "end" : String(input.pay);
    if (pay !== "end" && pay !== "monthly") throw new BankError("PAY_INVALID", "Choose when the interest is paid.");
    if (pay === "monthly" && !allowMonthly) throw new BankError("PAY_UNAVAILABLE", "Interest every month is not offered.");
    const interest = this.f.pubDepositFormula === false ? roundedDiv(cents * t.rateH, 10000) : depositInterest(cents, t.rateH, t.term);
    const monthly = roundedDiv(interest, t.term);
    out.quote = {
      amountCents: cents, term: t.term, termText: t.name, rate: t.rate, rateText: t.rateText, pay, interestCents: interest, returnCents: cents + interest, monthlyCents: monthly,
      amountText: moneyText(cents, sym), interestText: moneyText(interest, sym), returnText: moneyText(cents + interest, sym), monthlyText: moneyText(monthly, sym), payText: pay === "monthly" ? "Every month" : "At the end",
      reference: `EST-${ymd(this.now())}-${seq4(Math.floor(this.now() / 1000) % 10000)}`,
    };
    return out;
  }

  /* ------------------------------------------------------------------------------------------------- places */

  private placeView(p: (typeof PLACES)[number], unit: "mi" | "km") {
    const st = this.f.pubPlaceHours === false ? { open: true, chip: "Open" as const, text: "Closes 24:00" } : openStatus(HOURS[p.hours], this.now());
    const km = p.km;
    return {
      id: p.id, name: p.name, kind: p.kind, kindName: p.kind === "branch" ? "Branch" : "Cash machine", address: p.address, area: p.area, distanceKm: p.km, distanceText: distanceText(km, this.f.pubPlaceUnit === false ? "km" : unit),
      open: st.open, chip: st.chip, status: st.text, lat: p.lat, lng: p.lng, icon: p.kind === "branch" ? "bank" : "wallet",
    };
  }
  /** Places by area or street, by kind and (optionally) open now, nearest first. Cash machines only when the bank shows them. */
  private placeSearch(input: Record<string, any>) {
    const unit = MARKETS[this.market()].unit, atms = this.f.pubPlaceAtm === false ? true : this.on("find-branch-atm", "showAtms", input);
    const q = String(input.query ?? "").trim().toLowerCase().slice(0, 60);
    const kind = input.kind === "branch" ? "branch" : input.kind === "atm" && atms ? "atm" : "all";
    const openNow = this.openNowOffered(input) && input.openNow === true;
    let list = PLACES.filter((p) => (atms || p.kind === "branch") && (kind === "all" || p.kind === kind));
    if (q && this.f.pubPlaceSearch !== false) list = list.filter((p) => `${p.name} ${p.address} ${p.area}`.toLowerCase().includes(q));
    const views = list.map((p) => this.placeView(p, unit)).filter((v) => !openNow || v.open || this.f.pubPlaceOpen === false);
    if (this.f.pubPlaceSort !== false) views.sort((a, b) => a.distanceKm - b.distanceKm);
    else views.sort((a, b) => a.name.localeCompare(b.name));
    return { places: Object.fromEntries(views.map((v) => [v.id, v])), count: views.length, firstId: views[0]?.id ?? "", unit, showAtms: atms, openNowOffered: this.openNowOffered(input), kind };
  }
  private openNowOffered = (input: Record<string, any>) => this.opt("find-branch-atm", "openNow") !== false && input.offerOpenNow !== false;
  private placeDetails(input: Record<string, any>) {
    const p = PLACES.find((x) => x.id === input.placeId);
    if (!p) throw new BankError("NOT_FOUND", "We can't find that place.");
    const rows = hoursRows(HOURS[p.hours]);
    return { ...this.placeView(p, MARKETS[this.market()].unit), services: [...p.services], servicesText: p.services.join(" · "), hours: Object.fromEntries(rows.map((r) => [r.day.toLowerCase(), r.text])), reference: `MAP-${p.id.toUpperCase()}` };
  }

  /* ----------------------------------------------------------------------------------------------- support */

  private ways(input: Record<string, any>) {
    const at = this.now(), on = (k: "allowChat" | "allowCall") => this.f.pubSupportWays === false ? true : this.on("contact-support", k, input);
    const view = (key: "chat" | "call" | "message", name: string, sub: string) => {
      const st = this.f.pubSupportHours === false ? { open: true, chip: "Open" as const, text: key === "message" ? "Any time" : "Closes 20:00" } : openStatus(HOURS[key], at);
      return { id: key, name, sub: `${sub} · ${st.open ? "Open now" : "Closed"} · ${key === "message" ? "Any time" : st.text}`, open: st.open, chip: st.open ? "Open now" : "Closed", status: key === "message" ? "Any time" : st.text };
    };
    const out: Record<string, ReturnType<typeof view>> = {};
    if (on("allowChat")) out.chat = view("chat", "Chat", "Ask an adviser online");
    if (on("allowCall")) out.call = view("call", "Call", "Talk to us");
    out.message = view("message", "Message", "We reply within 1 working day");
    return out;
  }
  private supportHours(input: Record<string, any>) {
    const rows = hoursRows(HOURS.call);
    return {
      choices: this.ways(input), callHours: Object.fromEntries(rows.map((r) => [r.day.toLowerCase(), r.text])), callSummary: "Mon to Fri, 08:00 to 18:00", secure: this.on("contact-support", "secureMessages", input) && journeyEnabled(this.host.config(), "new-message"), callReference: `CALL-${ymd(this.now())}-${seq4(Math.floor(this.now() / 60000) % 10000)}`,
      topics: [...TOPICS],
    };
  }
  private topic(input: Record<string, any>) { if (!TOPICS.includes(String(input.topic ?? ""))) throw new BankError("TOPIC_INVALID", "Choose what it is about."); return String(input.topic); }
  private openChat(input: Record<string, any>) {
    if (!this.ways(input).chat) throw new BankError("WAY_UNAVAILABLE", "Chat is not offered.");
    const topic = this.topic(input), text = String(input.text ?? "").trim();
    if (this.f.pubSupportRules !== false && (text.length < 5 || text.length > 300)) throw new BankError("TEXT_INVALID", "Write a few words so we can help.");
    const n = ++this.support.chats;
    return { queueId: `CHAT-${ymd(this.now())}-${seq4(n)}`, reference: `CHAT-${ymd(this.now())}-${seq4(n)}`, waitMinutes: 2, topic };
  }
  private sendMessage(input: Record<string, any>) {
    const topic = this.topic(input), email = String(input.email ?? "").trim(), text = String(input.text ?? "").trim();
    if (this.f.pubSupportRules !== false) {
      if (!EMAIL.test(email) || email.length > 80) throw new BankError("EMAIL_INVALID", "Enter a valid email address.");
      if (text.length < 10 || text.length > 1000) throw new BankError("TEXT_INVALID", "Write at least 10 characters.");
    }
    // at most five messages an hour from one device: the abuse limit of the spec
    const now = this.now(), recent = this.support.recent.filter((t) => now - t < 60 * MINUTE);
    if (this.f.pubSupportRate !== false && recent.length >= 5) throw new BankError("RATE_LIMITED", "You've sent a lot of messages. Try again later.");
    this.support.recent = [...recent, now];
    const n = ++this.support.messages;
    // the bank keeps that a message arrived, its topic and a masked address: never the text or the address
    this.pub.outbox.push({ to: maskEmail(email), kind: "support-reply" });
    return { reference: `CS-${ymd(now)}-${seq4(n)}`, topic, replyTo: maskEmail(email), replyWithin: "1 working day" };
  }

  /* -------------------------------------------------------------------------------------- opening an account */

  private draft(): Application | undefined { return this.pub.applications.find((a) => a.state === "draft" && a.deviceId === this.host.device()); }
  private mine(input: Record<string, any>): Application {
    const a = this.draft();
    if (!a || (input.applicationId !== undefined && a.id !== input.applicationId)) throw new BankError("APPLICATION_NOT_FOUND", "Start again from the beginning.");
    return a;
  }
  private expired(a: Application) { return this.f.pubOnbExpiry !== false && a.savedUntil !== undefined && this.now() > a.savedUntil; }
  private offered() {
    const o = (k: string) => this.opt("open-account", k);
    return ACCOUNT_CHOICES.filter(([id]) => (id === "acc_saver" ? o("offerSaver") !== false : id === "acc_islamic" ? o("offerIslamic") === true : true));
  }
  private onboardingConfig() {
    const m = this.market(), mk = ONBOARD_MARKET[m], sym = MARKETS[m].symbol, say = (s: string) => s.replace(/\{s\}/g, sym);
    const map = (rows: readonly (readonly [string, string])[]) => Object.fromEntries(rows.map(([id, name]) => [id, { id, name: say(name) }]));
    return {
      market: m, symbol: sym, idHint: mk.idHint, idMessage: mk.idMessage, postcode: mk.postcode, taxText: mk.taxText,
      poa: mk.poa && this.opt("open-account", "requirePoa") !== false, country: MARKETS[m].country,
      countries: Object.fromEntries(COUNTRIES.map((c) => [c, { id: c, name: c }])), incomeBands: map(BANDS.income), depositBands: map(BANDS.deposits),
      accounts: Object.fromEntries(this.offered().map(([id, name, sub]) => [id, { id, name, sub }])),
    };
  }
  /** The market's rules and what the screens offer, and whether a draft was saved on this device (with its answers, minus every ID number and tax ID). */
  private begin(input: Record<string, any>) {
    const cfg = this.onboardingConfig(), allowSave = this.on("open-account", "allowSave", input);
    const a = this.draft();
    if (a && this.expired(a)) this.pub.applications.splice(this.pub.applications.indexOf(a), 1);
    const d = allowSave && input.fresh !== true ? this.draft() : undefined;
    const productId = String(input.productId ?? "");
    const product = PRODUCTS.find((p) => p.id === productId);
    const saved = d && d.verified && d.savedAt !== undefined ? { found: true, applicationId: d.id, name: String(d.answers.name ?? ""), savedText: `Saved ${this.stamp(d.savedAt ?? this.now())}. You’ll retake your photos.`, idMasked: d.idMasked ?? "", taxMasked: d.taxMasked ?? "", answers: { ...d.answers } } : { found: false, applicationId: "", name: "", savedText: "", idMasked: "", taxMasked: "", answers: {} };
    return {
      ...cfg, saved, allowSave,
      preselect: productId === "acc_saver" && cfg.accounts.acc_saver ? "acc_saver" : "acc_everyday",
      welcome: product && (product.type === "loan" || product.type === "card") ? product.name : "",
    };
  }
  private stamp(t: number) { const d = new Date(t); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.toISOString().slice(11, 16)}`; }

  private mobileDigits(v: unknown) {
    const raw = norm(v);
    const d = digitsOf(raw);
    if (!/^\+?[\d\s()-]+$/.test(raw) || d.length < 7 || d.length > 15) throw new BankError("PHONE_INVALID", "The mobile number isn’t in the right format.");
    return d;
  }
  /** Starts an application: the mobile number and the email (checked, and not already in an application); the code to the mobile is asked for next. */
  private start(input: Record<string, any>) {
    const d = this.mobileDigits(input.mobile), email = norm(input.email);
    if (this.f.pubOnbContact !== false && (!EMAIL.test(email) || email.length > 80)) throw new BankError("EMAIL_INVALID", "Enter a valid email address.");
    const eh = hashContact(email, "email"), mh = hashContact(d.slice(-10), "mobile");
    if (this.f.pubOnbDuplicate !== false && this.pub.applications.some((a) => a.state === "submitted" && (a.emailHash === eh || a.mobileHash === mh))) throw new BankError("DUPLICATE_APPLICATION", "We already have an application with these details. Sign in instead.");
    const old = this.draft();
    if (old) this.pub.applications.splice(this.pub.applications.indexOf(old), 1);
    const a: Application = {
      id: `draft_${++this.pub.ids}`, state: "draft", deviceId: this.host.device(), mobileLast4: d.slice(-4), mobileLast6: hashMobile6(d.slice(-6)), mobileHash: mh, emailHash: eh, emailMasked: maskEmail(email),
      verified: false, answers: {}, idVerified: false, attempts: { id: 0, selfie: 0, poa: 0, match: 0 },
    };
    this.pub.applications.push(a);
    this.flow = { kind: "onboard", masked: maskLast4(a.mobileLast4), otp: freshOtp() };
    return { applicationId: a.id, maskedMobile: maskLast4(a.mobileLast4) };
  }

  private onboardingProblems(input: Record<string, any>, step: "about" | "address" | "tax" | "work") {
    const m = ONBOARD_MARKET[this.market()];
    if (step === "about") {
      const name = norm(input.name);
      if (!/^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ .'-]+$/.test(name)) throw new BankError("NAME_INVALID", "Use letters only.");
      if (name.split(/\s+/).filter(Boolean).length < 2) throw new BankError("NAME_PARTS", "Enter your first and last name.");
      this.dob(input.dob);
      if (!norm(input.nationality)) throw new BankError("NATIONALITY_REQUIRED", "Choose your nationality.");
      if (this.f.pubOnbId !== false && !m.id.test(norm(input.idNumber))) throw new BankError("ID_INVALID", m.idMessage);
    } else if (step === "address") {
      if (norm(input.line1).length < 3) throw new BankError("ADDRESS_INCOMPLETE", "Enter the first line of your address.");
      if (!norm(input.city)) throw new BankError("ADDRESS_INCOMPLETE", "Enter your city.");
      if (this.f.pubOnbPostcode !== false && m.postcode && !/^[A-Za-z0-9 -]{3,10}$/.test(norm(input.postcode))) throw new BankError("POSTCODE_INVALID", "The postcode isn’t in the right format.");
      if (!norm(input.country)) throw new BankError("ADDRESS_INCOMPLETE", "Choose your country.");
    } else if (step === "work") {
      const bands = (rows: readonly (readonly [string, string])[]) => rows.map(([id]) => id as string);
      if (!EMPLOYMENT.includes(norm(input.employment)) || !bands(BANDS.income).includes(norm(input.income)) || !FUNDS.includes(norm(input.source)) || !bands(BANDS.deposits).includes(norm(input.deposits))) throw new BankError("WORK_INVALID", "Choose an answer for each question.");
    } else {
      const only = input.taxOnly === true || input.taxOnly === "yes";
      if (this.f.pubOnbTax !== false && !only) {
        if (!norm(input.taxCountry)) throw new BankError("TAX_REQUIRED", "Choose the country of your tax residence.");
        if (norm(input.taxId).length < 4) throw new BankError("TAX_REQUIRED", "Enter your tax ID.");
        if (!/^[A-Za-z0-9 -]{4,20}$/.test(norm(input.taxId))) throw new BankError("TIN_INVALID", "The tax ID isn’t in the right format.");
      }
    }
  }
  /** The date of birth as DD/MM/YYYY: a real date, not in the future and not over 110 years ago, 18 or older. Returns the year. */
  private dob(v: unknown): number {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(norm(v));
    const day = m ? Number(m[1]) : 0, mon = m ? Number(m[2]) : 0, year = m ? Number(m[3]) : 0;
    const d = new Date(Date.UTC(year, mon - 1, day));
    if (!m || d.getUTCFullYear() !== year || d.getUTCMonth() !== mon - 1 || d.getUTCDate() !== day) throw new BankError("DOB_FORMAT", "Use the format DD/MM/YYYY.");
    const today = new Date(this.now()), age = today.getUTCFullYear() - year - (today.getUTCMonth() + 1 < mon || (today.getUTCMonth() + 1 === mon && today.getUTCDate() < day) ? 1 : 0);
    if (this.f.pubOnbAge !== false) {
      if (d.getTime() > this.now() || age > 110) throw new BankError("DOB_RANGE", "Check the date.");
      if (age < 18) throw new BankError("UNDER_AGE", "You must be 18 or older to open this account.");
    }
    return year;
  }
  private attempt(a: Application, k: keyof Application["attempts"]) { a.attempts[k] += 1; return a.attempts[k]; }
  /**
   * The bank's checks, a step at a time and changing nothing but the count of photo tries: about you (name, date of birth, nationality, ID number in the market's format), the address
   * (and the postcode), the proof of address (the market asks; one older than three months is refused), the ID photos (readable and not expired) and the tax details.
   */
  private check(input: Record<string, any>) {
    const a = this.mine(input), step = String(input.step ?? ""), photos = this.host.conditions().onboarding ?? {};
    if (!a.verified && this.f.pubOnbVerified !== false) throw new BankError("NOT_VERIFIED", "Check your mobile number first.");
    if (step === "about" || step === "address" || step === "work" || step === "tax") { this.onboardingProblems(input, step); return step === "about" ? { ok: true, idMasked: `•••• ${norm(input.idNumber).slice(-3)}` } : { ok: true }; }
    if (step === "poa") {
      const cfg = this.onboardingConfig();
      if (!cfg.poa) return { ok: true, asked: false };
      if (!norm(input.proofName)) throw new BankError("POA_REQUIRED", "Add a recent utility bill or tenancy contract.");
      if (this.f.pubOnbPoa !== false && photos.poa === "old" && this.attempt(a, "poa") === 1) throw new BankError("POA_TOO_OLD", "The proof of address must be from the last 3 months.");
      return { ok: true, asked: true };
    }
    if (step === "id") {
      if (!DOCS.includes(String(input.idDocument))) throw new BankError("DOCUMENT_REQUIRED", "Choose a document.");
      if (!norm(input.front) || (input.idDocument !== "passport" && !norm(input.back))) throw new BankError("PHOTO_MISSING", "Take a photo of each side of the ID.");
      const n = this.attempt(a, "id");
      if (this.f.pubOnbPhotos !== false && n === 1 && photos.id === "unreadable") throw new BankError("ID_UNREADABLE", "We couldn’t read the ID. Retake it in good light.");
      if (this.f.pubOnbPhotos !== false && n === 1 && photos.id === "expired") throw new BankError("ID_EXPIRED", "This ID has expired. Use one that is still valid.");
      return { ok: true };
    }
    throw new BankError("STEP_UNKNOWN", "Start again from the beginning.");
  }
  /** Keeps the answers of a draft: never a photo, an ID number or a tax ID (those are kept as a hash and a mask), and never the code. */
  private keep(a: Application, input: Record<string, any>) {
    const text = ["name", "dob", "nationality", "line1", "line2", "city", "postcode", "country", "employment", "income", "source", "deposits", "taxCountry", "product"];
    for (const k of text) if (input[k] !== undefined && norm(input[k]) !== "") a.answers[k] = String(input[k]);
    if (input.taxOnly !== undefined) a.answers.taxOnly = input.taxOnly === true || input.taxOnly === "yes";
    if (norm(input.idNumber)) { const id = norm(input.idNumber); a.idHash = hashContact(id, "id"); a.idMasked = `•••• ${id.slice(-3)}`; }
    if (norm(input.taxId)) { const t = norm(input.taxId); a.taxHash = hashContact(t, "tax"); a.taxMasked = `•••• ${t.slice(-2)}`; }
    // flawed: the bank also keeps what it should not (the photos' references)
    if (this.f.pubOnbKeep === false) for (const k of ["front", "back", "selfie", "proofName", "code"]) if (input[k] !== undefined) a.answers[k] = String(input[k]);
  }
  private save(input: Record<string, any>) {
    const a = this.mine(input);
    if (this.f.pubOnbVerified !== false && !a.verified) throw new BankError("NOT_VERIFIED", "Check your mobile number first.");
    if (!this.on("open-account", "allowSave", input)) throw new BankError("SAVE_OFF", "Saving isn’t available.");
    this.keep(a, input);
    a.savedAt = this.now(); a.savedUntil = this.now() + SAVE_DAYS * DAY;
    return { savedUntil: new Date(a.savedUntil).toISOString(), savedText: `Saved. Continue any time in the next ${SAVE_DAYS} days.`, days: SAVE_DAYS };
  }
  private discard(input: Record<string, any>) {
    const a = this.draft();
    if (a && (input.applicationId === undefined || a.id === input.applicationId)) this.pub.applications.splice(this.pub.applications.indexOf(a), 1);
    this.flow = this.flow?.kind === "onboard" ? undefined : this.flow;
    return { ok: true };
  }
  /** The selfie and the match: a live face in good light, and the details on the ID the same as those entered (in Market D the birth year is inside the ID number). */
  private verifyIdentity(input: Record<string, any>) {
    const a = this.mine(input), photos = this.host.conditions().onboarding ?? {};
    if (!a.verified && this.f.pubOnbVerified !== false) throw new BankError("NOT_VERIFIED", "Check your mobile number first.");
    if (!norm(input.selfie)) throw new BankError("PHOTO_MISSING", "Take a selfie.");
    const n = this.attempt(a, "selfie");
    if (this.f.pubOnbPhotos !== false && n === 1 && photos.selfie === "dark") throw new BankError("LIVENESS_LOW_LIGHT", "It was too dark to see your face.");
    if (this.f.pubOnbPhotos !== false && n === 1 && photos.selfie === "notLive") throw new BankError("LIVENESS_FAILED", "We couldn’t confirm a live person.");
    const year = this.dob(input.dob);
    const wrongYear = this.market() === "D" && norm(input.idNumber).slice(3, 7) !== String(year);
    if (this.f.pubOnbMatch !== false && (wrongYear || (photos.match === "mismatch" && this.attempt(a, "match") === 1))) {
      // the photos are thrown away: the person retakes them
      a.attempts = { id: 0, selfie: 0, poa: a.attempts.poa, match: a.attempts.match }; a.idVerified = false;
      throw new BankError("ID_MISMATCH", "The details on your ID don’t match what you entered. Check them and retake the photos.");
    }
    a.idVerified = true;
    return { match: true };
  }
  private submit(input: Record<string, any>) {
    const a = this.mine(input), photos = this.host.conditions().onboarding ?? {};
    if (!a.verified && this.f.pubOnbVerified !== false) throw new BankError("NOT_VERIFIED", "Check your mobile number first.");
    if (!a.idVerified) throw new BankError("IDENTITY_NOT_VERIFIED", "Check your ID first.");
    for (const step of ["about", "address", "work", "tax"] as const) this.onboardingProblems(input, step);
    if (this.f.pubOnbConsent !== false && !(input.terms === true && input.taxConfirm === true && input.signed === true)) throw new BankError("CONSENT_REQUIRED", "Please agree to continue.");
    const choice = this.offered().find(([id]) => id === input.product);
    if (this.f.pubOnbProduct !== false && !choice) throw new BankError("PRODUCT_UNAVAILABLE", "Choose one of the accounts.");
    if (photos.decline === true) throw new BankError("APPLICATION_NOT_ACCEPTED", "We can’t open this account online. Please contact us.");
    const review = this.f.pubOnbReview !== false && norm(input.income) === "o1m" && this.on("open-account", "reviewHigh", { reviewHigh: input.reviewHigh });
    const reference = `APP-${String(++this.pub.seq).padStart(6, "0")}`;
    // the application is sent: what the bank keeps is the reference, the account, the stage and the masks of the contacts; the answers are gone
    Object.assign(a, {
      reference, state: "submitted", answers: {}, idHash: undefined, taxHash: undefined, savedAt: undefined, savedUntil: undefined, product: String(input.product),
      productName: choice?.[1] ?? String(input.product), stage: "checking" as const, manual: review, submittedAt: this.now(),
    });
    this.flow = undefined;
    this.pub.outbox.push({ to: maskLast4(a.mobileLast4), kind: "application-received" }, { to: a.emailMasked, kind: "application-received" });
    return { reference, status: review ? "manual-review" : "checking", productName: a.productName, stage: review ? "A few more checks" : "Checking your ID" };
  }

  /* -------------------------------------------------------------------------------------------- tracking */

  private appOf(reference: string) { return this.pub.applications.find((x) => x.state === "submitted" && x.reference === reference); }
  /** Finds an application by its number and the last 6 digits of the mobile number; one miss never says which part was wrong. The status comes after the code when the bank asks for one. */
  private find(input: Record<string, any>) {
    this.assertNotLocked("track");
    const ref = norm(input.reference).toUpperCase(), d = digitsOf(input.mobile), a = /^APP-\d{6}$/.test(ref) ? this.appOf(ref) : undefined;
    const okMobile = !!a && d.length >= 6 && (this.f.pubTrackMatch === false || hashMobile6(d.slice(-6)) === a.mobileLast6);
    if (!a || !okMobile) {
      if (this.failed("track")) throw new BankError("TRACK_LOCKED", "Too many tries. For your security, try again in 30 minutes, or contact us.");
      throw new BankError("NOT_FOUND", "We couldn’t find an application with those details. Check them and try again.", this.trackFails);
    }
    this.tracking = a.reference;
    const needsCode = this.opt("track-application", "askCode") !== false;
    this.flow = needsCode ? { kind: "track", masked: maskLast4(a.mobileLast4), otp: freshOtp() } : undefined;
    return { found: true, needsCode, maskedMobile: maskLast4(a.mobileLast4) };
  }
  private status() {
    this.assertNotLocked("track");
    const a = this.tracking ? this.appOf(this.tracking) : undefined;
    if (!a) throw new BankError("FIND_FIRST", "Enter your application number first.");
    const needsCode = this.opt("track-application", "askCode") !== false;
    if (needsCode && this.f.pubTrackCode !== false && !(this.flow?.kind === "track" && this.flow.otp.verified)) throw new BankError("OTP_REQUIRED", "Enter the code we sent you first.");
    this.trackFails = 0;
    return { reference: a.reference, product: a.product, productName: a.productName, stage: a.stage, accountLast4: a.stage === "ready" ? a.accountLast4 ?? "" : "" };
  }

  /* ------------------------------------------------------------------------------------ registering for digital banking */

  private validDay(day: number, month: number, year: number) { const d = new Date(Date.UTC(year, month - 1, day)); return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day; }
  /**
   * An existing customer says who they are: the customer ID (8 digits) or a card number (passes the check-digit test) and the date of birth, or an application that is ready. One message
   * for every miss; the third miss (identity checks and codes together) locks it for 30 minutes. The code then goes to the mobile number the bank holds.
   */
  private registrationVerify(input: Record<string, any>) {
    this.assertNotLocked("register");
    const now = this.now();
    let who: Omit<Reg, "token" | "expiresAt">;
    if (input.applicationId !== undefined && norm(input.applicationId)) {
      const a = this.appOf(norm(input.applicationId).toUpperCase());
      if (!a || a.stage !== "ready") { if (this.failed("register")) throw new BankError("ID_LOCKED", "Too many tries."); throw new BankError("NOT_MATCHED", "We couldn’t match those details. Check them and try again."); }
      if (a.registeredAs) throw new BankError("ALREADY_REGISTERED", "You’re already registered. Sign in, or reset your password if you’ve forgotten it.");
      who = { applicationRef: a.reference, name: "New customer", last4: a.mobileLast4, email: "", phone: `+1 000 000 ${a.mobileLast4}`, dob: "", persona: "demoapplicant" };
    } else {
      const byCard = norm(input.cardNumber) !== "", id = digitsOf(input.customerId), card = digitsOf(input.cardNumber);
      if (byCard && this.f.pubRegCard !== false && !this.on("register-digital-banking", "allowCard", input)) throw new BankError("CARD_UNAVAILABLE", "Use your customer ID.");
      if (byCard ? !(card.length >= 13 && luhnValid(card)) : !/^\d{8}$/.test(String(input.customerId ?? "").trim())) throw new BankError(byCard ? "CARD_INVALID" : "CUSTOMER_ID_INVALID", byCard ? "Check the card number." : "Enter your 8-digit customer ID.");
      const day = Number(input.day), month = Number(input.month), year = Number(input.year);
      if (!/^(19|20)\d{2}$/.test(String(input.year ?? "").trim())) throw new BankError("YEAR_INVALID", "Enter a 4-digit year.");
      if (!this.validDay(day, month, year)) throw new BankError("DATE_INVALID", "That date doesn’t exist.");
      const dob = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (Date.parse(dob) >= now) throw new BankError("DATE_FUTURE", "Enter a date in the past.");
      const t = new Date(now), age = t.getUTCFullYear() - year - (t.getUTCMonth() + 1 < month || (t.getUTCMonth() + 1 === month && t.getUTCDate() < day) ? 1 : 0);
      if (age < 18) throw new BankError("UNDER_AGE", "You need to be 18 or over to register online.");
      const c: BankCustomer | undefined = this.pub.customers.find((x) => (byCard ? x.cardHash === cardKey(card) : x.id === id) && (this.f.pubRegMatch === false || x.dob === dob));
      if (!c) { if (this.failed("register")) throw new BankError("ID_LOCKED", "Too many tries."); throw new BankError("NOT_MATCHED", "We couldn’t match those details. Check them and try again."); }
      if (c.registeredAs && this.f.pubRegAlready !== false) throw new BankError("ALREADY_REGISTERED", "You’re already registered. Sign in, or reset your password if you’ve forgotten it.");
      who = { customerId: c.id, name: c.name, last4: c.mobileLast4, email: c.email, phone: c.mobile, dob: c.dob, persona: "jordan" };
    }
    const token = `reg_${++this.pub.ids}_${hashContact(`${who.last4}:${now}:${this.pub.ids}`, "token").slice(0, 12)}`;
    this.reg = { ...who, token, expiresAt: now + ACCESS.tokenSeconds * 1000 };
    this.flow = { kind: "register", masked: maskLast4(who.last4), otp: freshOtp() };
    return { registrationToken: token, maskedMobile: maskLast4(who.last4) };
  }
  /** Chooses the username and password, once the code was right (`dryRun` checks every rule and changes nothing). The profile is made by the sign-in directory: the password is kept as a hash. */
  private registrationComplete(input: Record<string, any>) {
    const r = this.reg, now = this.now();
    if (!r || String(input.registrationToken ?? "") !== r.token) throw new BankError("TOKEN_INVALID", "Start again from the beginning.");
    if (this.f.tokenExpiry !== false && now > r.expiresAt) { this.reg = undefined; throw new BankError("TOKEN_EXPIRED", "That took too long. Start again."); }
    if (this.f.pubRegCode !== false && !(this.flow?.kind === "register" && this.flow.otp.verified)) throw new BankError("OTP_REQUIRED", "Enter the code we sent you first.");
    const checked = this.host.access.checkRegistration({ username: String(input.username ?? ""), password: String(input.password ?? ""), confirm: input.confirm === undefined ? undefined : String(input.confirm) });
    if (!checked.ok) return checked;
    if (input.terms !== true) return { ok: false as const, code: "TERMS_REQUIRED" };
    const trust = input.trustDevice === true && (this.f.pubRegTrust === false || this.on("register-digital-banking", "trustDevice", { trustDevice: input.offerTrust })), name = norm(input.deviceName);
    if (trust && (name.length < 1 || name.length > 30)) return { ok: false as const, code: "NAME_REQUIRED" };
    if (input.dryRun === true) return { ok: true as const, checked: true };
    const [first = "", ...rest] = r.name.split(" ");
    const done = this.host.access.registerUser({ username: String(input.username), password: String(input.password), personaId: r.persona, firstName: first, lastName: rest.join(" "), email: r.email || `${String(input.username).trim().toLowerCase()}@registered.example`, phone: r.phone, dob: r.dob, trustDevice: trust, deviceName: name });
    const c = this.pub.customers.find((x) => x.id === r.customerId); if (c) { c.registeredAs = String(input.username).trim().toLowerCase(); c.registeredAt = now; }
    const a = r.applicationRef ? this.appOf(r.applicationRef) : undefined; if (a) a.registeredAs = String(input.username).trim().toLowerCase();
    this.pub.outbox.push({ to: maskLast4(r.last4), kind: "registered" });
    if (trust) this.pub.outbox.push({ to: maskLast4(r.last4), kind: "trusted-device" });
    // used once: the token, the code and the flow are gone
    this.reg = undefined; this.flow = undefined; this.regFails = 0;
    return { ok: true as const, username: String(input.username).trim(), deviceTrusted: done.deviceTrusted };
  }

  /* -------------------------------------------------------------------------------------- for scenarios only */

  /** What the bank holds, for a scenario to check: counts, masked destinations, and whether a value is anywhere in what the bank keeps (never the value itself). */
  private inspect(input: Record<string, any>) {
    const d = this.draft(), p = this.pub;
    const contains = typeof input.contains === "string" && input.contains !== "" ? JSON.stringify([p.applications, p.outbox, p.log, this.support]).includes(input.contains) : undefined;
    return {
      drafts: p.applications.filter((a) => a.state === "draft").length, submitted: p.applications.filter((a) => a.state === "submitted").length,
      draft: d ? { verified: d.verified, keys: Object.keys(d.answers).sort(), hasId: !!d.idHash, idMasked: d.idMasked ?? "", taxMasked: d.taxMasked ?? "", savedUntil: d.savedUntil ? new Date(d.savedUntil).toISOString() : "", idVerified: d.idVerified } : null,
      outbox: p.outbox.map((o) => ({ ...o })), support: { chats: this.support.chats, messages: this.support.messages }, trackFails: this.trackFails, regFails: this.regFails,
      registered: p.customers.filter((c) => c.registeredAt !== undefined).map((c) => c.registeredAs), ...(contains === undefined ? {} : { contains }),
    };
  }
  /** Moves an application to another stage (Received, Checking your ID, Ready), as the bank's checks would. */
  private advance(input: Record<string, any>) {
    const a = this.appOf(norm(input.reference).toUpperCase());
    if (!a) throw new BankError("NOT_FOUND", "No such application.");
    const stage = ({ received: "received", checking: "checking", ready: "ready" } as Record<string, Application["stage"]>)[String(input.stage)];
    if (!stage) throw new BankError("STAGE_INVALID", "received, checking or ready");
    a.stage = stage; if (stage === "ready") a.accountLast4 = a.accountLast4 || String(2000 + (Number(a.reference!.slice(4)) % 1000)).padStart(4, "0");
    return { ok: true };
  }
}
