import { instrumentOf, INSTRUMENTS, dayChange } from "./invest";
import { alexFinance, BANKS, cardNetwork, luhnValid, type Finance } from "./finance";
import { customerRate, midRate, priceQuote, fxSupports, DEFAULT_FX, BANKWORKX_FX, QUOTE_TTL_SECONDS, type FxConfig, type Quote } from "./fx";
import { currencyInfo, roundMoney } from "@finx/ui-kit";
import { BankError } from "./errors";
import { ACME, type CorpCompany, type CorpPayment, type Flaws } from "./corporate";
import { createCorporateProvider, type CorporateProvider, type ProviderId } from "./corporate-provider";
import { CabSandbox, CAB_PROFILES, type CabProfile } from "./cab";
export * from "./finance";
export { SANDBOX_MARKER, SandboxNotAllowedError, assertSandboxAllowed, sandboxAllowed, sandboxAllowedFor, setSandboxPolicy } from "./policy";
import { assertSandboxAllowed } from "./policy";
export { CAB_PROFILES, CAB_CURRENCY, PASSWORD_RULES, passwordProblems, type CabProfile } from "./cab";
export { BankError } from "./errors";
export * from "./invest";
export { createCorporateProvider, MappedCorporateProvider, PROVIDERS, PROVIDER_INFO, isProviderId, type CorporateProvider, type ProviderId } from "./corporate-provider";
export { BankBApi, ApiError } from "./corporate-b";
export { applyRule, build, mapError, type MappingSpec } from "./mapping";
export { MAX_BULK_LINES, SALARY_CAP_FACTOR, type CorpEmployee, type BatchCheck, type BulkLineInput, type BulkLineResult, ACME, CorporateSandbox, type CorporateBankAdapter, type CorpCompany, type Flaws, type CorpPayment, type CorpUser, type CorpRole, type InitiateInput } from "./corporate";
export { PER_USD, FX_SPREAD, FX_FEE_RATE, QUOTE_TTL_SECONDS, DEFAULT_FX, BANKWORKX_FX, midRate, customerRate, type FxConfig, type Quote } from "./fx";

export type Account = { id: string; name: string; maskedNumber: string; iban: string; balance: number; currency: string; status: "active" | "frozen"; canDebit: boolean };
export type Beneficiary = { id: string; displayName: string; bank: string; maskedNumber: string; addedAt: number };
export type Persona = {
  id: string;
  /** Which bank app this sandbox customer belongs to. */
  brand: "meezan" | "bankworkx";
  /** A sandbox customer that belongs to one project (bank app) in particular, on top of its look. */
  project?: string;
  /** Sign-in, enrolment and recovery details, for the Cairo Amman Bank access journeys. */
  cab?: CabProfile;
  /** A company with users, a whitelist, limits and approval rules, for the corporate payment journeys. */
  corp?: CorpCompany;
  name: string;
  phone: string;
  accounts: Account[];
  beneficiaries: Beneficiary[];
  limits: { daily: number; usedToday: number };
  /** Daily limits for accounts in other currencies, by currency code. `limits` applies to the currency of the first account. */
  limitsByCurrency?: Record<string, { daily: number; usedToday: number }>;
  /** Spending, budgets and cards, for the BankWorkx app. */
  finance?: Finance;
  /** deterministic failure modes for testing unhappy paths */
  behaviour: { otpCode: string; transferFails?: boolean; kyc: "verified" | "pending" | "rejected" };
};

const day = 24 * 3600 * 1000;
export const BILLERS = [
  { id: "k_electric", name: "K-Electric", category: "Electricity" }, { id: "lesco", name: "LESCO", category: "Electricity" },
  { id: "ssgc", name: "SSGC", category: "Gas" }, { id: "ptcl", name: "PTCL", category: "Internet" },
];
export const CARRIERS = [{ id: "jazz", name: "Jazz" }, { id: "zong", name: "Zong" }, { id: "telenor", name: "Telenor" }, { id: "ufone", name: "Ufone" }];

export const personas: Record<string, Persona> = {
  ayesha: {
    id: "ayesha", brand: "meezan", name: "Ayesha Rahman", phone: "+92 300 1234471",
    accounts: [
      { id: "acc_current", name: "Current", maskedNumber: "••7710", iban: "PK36 MEZN 0000 1234 5678 7710", balance: 184250, currency: "PKR", status: "active", canDebit: true },
      { id: "acc_savings", name: "Savings", maskedNumber: "••2204", iban: "PK12 MEZN 0000 1234 5678 2204", balance: 1250000, currency: "PKR", status: "active", canDebit: true },
    ],
    beneficiaries: [
      { id: "ben_4821", displayName: "Ahmed Khan", bank: "HBL", maskedNumber: "••4821", addedAt: Date.now() - 90 * day },
      { id: "ben_1190", displayName: "Sana Malik", bank: "UBL", maskedNumber: "••1190", addedAt: Date.now() - 40 * day },
    ],
    limits: { daily: 50000, usedToday: 0 },
    behaviour: { otpCode: "482100", kyc: "verified" },
  },
  bilal: {
    id: "bilal", brand: "meezan", name: "Bilal Raza (transfer fails)", phone: "+92 301 5550192",
    accounts: [{ id: "acc_current", name: "Current", maskedNumber: "••3301", iban: "PK50 MEZN 0000 7777 0000 3301", balance: 92000, currency: "PKR", status: "active", canDebit: true }],
    beneficiaries: [{ id: "ben_9001", displayName: "Hira Builders", bank: "MCB", maskedNumber: "••9001", addedAt: Date.now() - 12 * day }],
    limits: { daily: 50000, usedToday: 40000 },
    behaviour: { otpCode: "111111", transferFails: true, kyc: "verified" },
  },
  alex: {
    id: "alex", brand: "bankworkx", name: "Alex Morgan", phone: "+1 415 555 0142",
    accounts: [
      { id: "acc_main", name: "Main", maskedNumber: "••4410", iban: "US00 BWX 0000 0000 4410", balance: 8720.76, currency: "USD", status: "active", canDebit: true },
      { id: "acc_save", name: "Savings", maskedNumber: "••7731", iban: "US00 BWX 0000 0000 7731", balance: 15254.37, currency: "USD", status: "active", canDebit: true },
    ],
    beneficiaries: [],
    limits: { daily: 50000, usedToday: 0 },
    finance: alexFinance(),
    behaviour: { otpCode: "482100", kyc: "verified" },
  },
  // Alex with a Euro and a Dirham account too, for moving money between accounts in different currencies. A separate customer because
  // the BankWorkx dashboards and tests count Alex's two accounts.
  alexglobal: {
    id: "alexglobal", brand: "bankworkx", name: "Alex Morgan (accounts in three currencies)", phone: "+1 415 555 0142",
    accounts: [
      { id: "acc_main", name: "Main", maskedNumber: "••4410", iban: "US00 BWX 0000 0000 4410", balance: 8720.76, currency: "USD", status: "active", canDebit: true },
      { id: "acc_save", name: "Savings", maskedNumber: "••7731", iban: "US00 BWX 0000 0000 7731", balance: 15254.37, currency: "USD", status: "active", canDebit: true },
      { id: "acc_eur", name: "EUR Travel", maskedNumber: "••5502", iban: "US00 BWX 0000 0000 5502", balance: 2400, currency: "EUR", status: "active", canDebit: true },
      { id: "acc_aed", name: "AED Home", maskedNumber: "••8816", iban: "US00 BWX 0000 0000 8816", balance: 11000, currency: "AED", status: "active", canDebit: true },
    ],
    beneficiaries: [],
    limits: { daily: 50000, usedToday: 0 },
    limitsByCurrency: { EUR: { daily: 20000, usedToday: 0 }, AED: { daily: 100000, usedToday: 0 } },
    finance: alexFinance(),
    behaviour: { otpCode: "482100", kyc: "verified" },
  },
  sam: {
    id: "sam", brand: "bankworkx", name: "Sam Rivera (new customer)", phone: "+1 415 555 0199",
    accounts: [], beneficiaries: [], limits: { daily: 50000, usedToday: 0 },
    finance: { ...alexFinance(), income: 0, expense: 0, savings: 0, balanceSeries: [], ranges: { "1W": [], "1M": [], "3M": [], "1Y": [] }, spendingByCategory: [], transactions: [], budgets: [], subscriptions: [], linked: [], cards: [], invest: { holdings: [], watchlist: [] } },
    behaviour: { otpCode: "123456", kyc: "verified" },
  },
  zara: {
    id: "zara", brand: "meezan", name: "Zara Ali (KYC rejected)", phone: "+92 333 2000123",
    accounts: [],
    beneficiaries: [],
    limits: { daily: 25000, usedToday: 0 },
    behaviour: { otpCode: "123456", kyc: "rejected" },
  },
  hina: {
    id: "hina", brand: "meezan", name: "Hina Qureshi (accounts in four currencies)", phone: "+92 321 5550144",
    accounts: [
      { id: "acc_pkr", name: "Current", maskedNumber: "••5521", iban: "PK41 MEZN 0000 5555 0000 5521", balance: 320000, currency: "PKR", status: "active", canDebit: true },
      { id: "acc_usd", name: "Dollar savings", maskedNumber: "••8830", iban: "PK77 MEZN 0000 5555 0000 8830", balance: 4200.5, currency: "USD", status: "active", canDebit: true },
      { id: "acc_aed", name: "Dirham account", maskedNumber: "••1147", iban: "PK19 MEZN 0000 5555 0000 1147", balance: 15000, currency: "AED", status: "active", canDebit: true },
      { id: "acc_kwd", name: "Dinar account", maskedNumber: "••9042", iban: "PK63 MEZN 0000 5555 0000 9042", balance: 120.75, currency: "KWD", status: "active", canDebit: true },
    ],
    beneficiaries: [{ id: "ben_4821", displayName: "Ahmed Khan", bank: "HBL", maskedNumber: "••4821", addedAt: Date.now() - 90 * day }],
    limits: { daily: 50000, usedToday: 0 },
    limitsByCurrency: { USD: { daily: 2000, usedToday: 0 }, AED: { daily: 7000, usedToday: 0 }, KWD: { daily: 300, usedToday: 0 } },
    behaviour: { otpCode: "482100", kyc: "verified" },
  },
  acme: {
    id: "acme", brand: "meezan", name: "Acme Trading Co. (corporate payments)", phone: "+92 300 5550166", corp: ACME,
    accounts: [], beneficiaries: [], limits: { daily: 0, usedToday: 0 },
    behaviour: { otpCode: "482100", kyc: "verified" },
  },
  nour: {
    id: "nour", brand: "meezan", project: "cab", name: "Nour Haddad (active customer)", phone: "+962 34 56 78 90", cab: CAB_PROFILES.nour!,
    accounts: [], beneficiaries: [], limits: { daily: 5000, usedToday: 0 },
    behaviour: { otpCode: "482100", kyc: "verified" },
  },
  sara: {
    id: "sara", brand: "meezan", project: "cab", name: "Sara Hegazy (new customer, not enrolled)", phone: "+962 79 123 4567", cab: CAB_PROFILES.sara!,
    accounts: [], beneficiaries: [], limits: { daily: 5000, usedToday: 0 },
    behaviour: { otpCode: "482100", kyc: "verified" },
  },
  yasmin: {
    id: "yasmin", brand: "meezan", project: "cab", name: "Yasmin Khoury (enrolled, not activated)", phone: "+962 79 333 0172", cab: CAB_PROFILES.yasmin!,
    accounts: [], beneficiaries: [], limits: { daily: 5000, usedToday: 0 },
    behaviour: { otpCode: "482100", kyc: "verified" },
  },
  lina: {
    id: "lina", brand: "meezan", project: "cab", name: "Lina Qasem (profile locked)", phone: "+962 77 555 0188", cab: CAB_PROFILES.lina!,
    accounts: [], beneficiaries: [], limits: { daily: 5000, usedToday: 0 },
    behaviour: { otpCode: "482100", kyc: "verified" },
  },
  omar: {
    id: "omar", brand: "meezan", project: "cab", name: "Omar Nassar (password expired)", phone: "+962 78 222 0150", cab: CAB_PROFILES.omar!,
    accounts: [], beneficiaries: [], limits: { daily: 5000, usedToday: 0 },
    behaviour: { otpCode: "482100", kyc: "verified" },
  },
};

/**
 * The sandbox customers for one bank app: the ones made for that project when there are any, otherwise the ones
 * for its look (a project that only chose a look shares that look's customers).
 */
export function personasFor(brand: Persona["brand"], project?: string) {
  const mine = project ? Object.values(personas).filter((p) => p.project === project) : [];
  return mine.length ? mine : Object.values(personas).filter((p) => p.brand === brand && !p.project);
}

/**
 * The sandbox customer a journey should preview with: one that has what it calls (a company for corp.* adapters, a Cairo Amman
 * Bank profile for cab.* ones), else the first. A journey for a company cannot run as a retail customer.
 */
export function defaultPersonaFor<T extends Persona>(people: T[], integrations: { adapter: string }[] = []): T {
  const uses = (prefix: string) => integrations.some((i) => i.adapter.startsWith(prefix));
  // a conversion needs accounts in more than one currency
  const manyCurrencies = (p: Persona) => new Set(p.accounts.map((a) => a.currency)).size > 1;
  return (uses("corp.") ? people.find((p) => p.corp) : uses("cab.") ? people.find((p) => p.cab) : uses("bank.fx.") ? people.find(manyCurrencies) : undefined) ?? people[0]!;
}

/**
 * Things a test can make go wrong in the sandbox, so a scenario can prove a journey's unhappy paths. Nothing in the apps sets these.
 * A call that times out or is unavailable is not applied: no balance changes.
 */
export type SandboxConditions = {
  /** Adapters that do not answer in time: they fail with TIMEOUT after `latencyMs`. */
  timeout?: string[];
  /** Adapters that answer SERVICE_UNAVAILABLE. */
  unavailable?: string[];
  /** How long the adapters in `timeout` take to answer, in milliseconds (10,000 by default). An answer as slow as the journey's limit counts as a timeout. */
  latencyMs?: number;
  /** Account ids that are frozen: they cannot send money, but can receive. */
  frozen?: string[];
  /** Every money-moving call fails with CORE_UNAVAILABLE after the code is accepted (as the persona flag transferFails does). */
  transferFails?: boolean;
};
/** How long a journey waits for the bank before it treats the call as timed out. */
export const ANSWER_LIMIT_MS = 10_000;

export class MockBank {
  private p: Persona;
  private otpAttempts = 0;
  private otpVerified = false;
  private seq = 0;
  private quotes = new Map<string, Quote & { used: boolean }>();
  /** How many quotes were asked for each pair of accounts, so a renewed quote can show the market moving. */
  private quoteCount = new Map<string, number>();
  private fx: FxConfig;
  private conditions: SandboxConditions;
  private flaws: Flaws;
  /** The clock quotes expire by; tests replace it. */
  now: () => number = () => Date.now();
  private cab: CabSandbox;
  private corp?: CorporateProvider;
  /** `corpProvider` picks which corporate bank API stands behind the corp.* adapters; journeys do not change. */
  constructor(personaId = "ayesha", options: { corpProvider?: ProviderId; /** rules switched off, for mutation checks only */ corpFlaws?: Flaws; /** things that go wrong on purpose, for scenarios */ conditions?: SandboxConditions } = {}) {
    assertSandboxAllowed(); // a production build must not run customers on the sandbox (policy.ts)
    const base = personas[personaId];
    if (!base) throw new Error(`Unknown persona ${personaId}`);
    this.p = structuredClone(base);
    this.fx = this.p.brand === "bankworkx" ? BANKWORKX_FX : DEFAULT_FX;
    this.conditions = options.conditions ?? {};
    this.flaws = options.corpFlaws ?? {};
    if (this.conditions.transferFails) this.p.behaviour.transferFails = true;
    for (const a of this.p.accounts) if (this.conditions.frozen?.includes(a.id)) { a.status = "frozen"; a.canDebit = false; }
    if (this.p.corp) { this.corp = createCorporateProvider(options.corpProvider ?? "reference", this.p.corp, options.corpFlaws); this.corp.now = () => this.now(); }
    this.cab = new CabSandbox(this.p, { otpVerified: () => this.otpVerified, clearOtp: () => { this.otpVerified = false; } });
  }
  get persona() { return this.p; }

  /** The daily limit that applies to an account in this currency. The first account's currency uses `limits`; another needs its own entry. */
  private limitFor(currency: string) {
    const base = this.p.accounts[0]?.currency;
    if (!base || currency === base) return this.p.limits;
    const own = this.p.limitsByCurrency?.[currency];
    if (!own) throw new BankError("LIMIT_NOT_SET", `No daily limit is set for ${currency}`);
    return own;
  }

  /** The corporate payment adapters. Starting and approving a payment move money, so they need the one-time code first, like a transfer. */
  private corporate(adapter: string, input: Record<string, any>) {
    const corp = this.corp;
    if (!corp) throw new BankError("NOT_SUPPORTED", "Not available for this customer");
    const userId = String(input.userId ?? "");
    switch (adapter) {
      case "corp.users.list": return Object.fromEntries(corp.getCompany().users.map((u) => [u.id, { id: u.id, name: u.name, sub: u.roles.join(" and ") }]));
      case "corp.company.get": {
        const c = corp.getCompany();
        const me = c.users.find((u) => u.id === userId);
        return { id: c.id, name: c.name, currency: c.currency, accounts: Object.fromEntries(c.accounts.map((a) => [a.id, a])), beneficiaries: Object.fromEntries(c.whitelist.map((b) => [b.id, { ...b, displayName: b.name }])), employees: Object.fromEntries((c.employees ?? []).map((e) => [e.id, { id: e.id, name: e.name, bank: e.bank, maskedNumber: e.maskedNumber }])), users: c.users.map((u) => ({ id: u.id, name: u.name, roles: u.roles })), me: me ? { id: me.id, name: me.name, roles: me.roles, dailyLimit: me.dailyLimit, usedToday: me.usedToday, remainingToday: me.dailyLimit - me.usedToday } : undefined, companyDailyLimit: c.companyDailyLimit, companyUsedToday: c.companyUsedToday, dualApprovalAbove: c.dualApprovalAbove, cutoff: c.cutoff };
      }
      case "corp.bulk.check": {
        const check = corp.checkBatch({ userId, fromAccountId: String(input.fromAccountId ?? ""), lines: parseBulkFile(String(input.file ?? "")) });
        const c = corp.getCompany();
        const name = (id: string) => c.whitelist.find((b) => b.id === id)?.name;
        const lines = check.lines.map((l) => ({ ...l, payee: name(l.beneficiaryId) ?? l.beneficiaryId, ...(l.code ? { message: BULK_LINE_MESSAGE[l.code] } : {}) }));
        return { ...check, lines: Object.fromEntries(lines.map((l) => [String(l.n), l])), problems: Object.fromEntries(lines.filter((l) => !l.ok).map((l) => [String(l.n), l])), requiredApprovers: check.total > c.dualApprovalAbove ? 2 : 1, currency: c.accounts.find((a) => a.id === input.fromAccountId)?.currency ?? c.currency };
      }
      case "corp.bulk.submit": {
        if (!this.otpVerified) throw new BankError("OTP_REQUIRED", "OTP not verified");
        if (this.p.behaviour.transferFails) throw new BankError("CORE_UNAVAILABLE", "Core banking unavailable");
        const p = corp.initiateBulk({ userId, fromAccountId: String(input.fromAccountId ?? ""), lines: parseBulkFile(String(input.file ?? "")), reference: input.reference });
        this.otpVerified = false;
        return shown(p, corp.getCompany());
      }
      case "corp.payroll.check": {
        const check = corp.checkPayroll({ userId, fromAccountId: String(input.fromAccountId ?? ""), period: String(input.period ?? ""), lines: parseBulkFile(String(input.file ?? "")) });
        const c = corp.getCompany();
        const name = (id: string) => c.employees?.find((e) => e.id === id)?.name;
        const lines = check.lines.map((l) => ({ ...l, payee: name(l.beneficiaryId) ?? l.beneficiaryId, ...(l.code ? { message: ({ ...BULK_LINE_MESSAGE, DUPLICATE_LINE: "This employee is already on the file" } as Record<string, string>)[l.code] } : {}) }));
        return { ...check, lines: Object.fromEntries(lines.map((l) => [String(l.n), l])), problems: Object.fromEntries(lines.filter((l) => !l.ok).map((l) => [String(l.n), l])), requiredApprovers: 2, period: String(input.period), currency: c.accounts.find((a) => a.id === input.fromAccountId)?.currency ?? c.currency };
      }
      case "corp.payroll.submit": {
        if (!this.otpVerified) throw new BankError("OTP_REQUIRED", "OTP not verified");
        if (this.p.behaviour.transferFails) throw new BankError("CORE_UNAVAILABLE", "Core banking unavailable");
        const p = corp.initiatePayroll({ userId, fromAccountId: String(input.fromAccountId ?? ""), period: String(input.period ?? ""), lines: parseBulkFile(String(input.file ?? "")) });
        this.otpVerified = false;
        return shown(p, corp.getCompany());
      }
      case "corp.payments.initiate": {
        if (!this.otpVerified) throw new BankError("OTP_REQUIRED", "OTP not verified");
        if (this.p.behaviour.transferFails) throw new BankError("CORE_UNAVAILABLE", "Core banking unavailable");
        const p = corp.initiatePayment({ userId, fromAccountId: String(input.fromAccountId ?? ""), beneficiaryId: String(input.beneficiaryId ?? ""), amount: Number(input.amount), reference: input.reference });
        this.otpVerified = false;
        return shown(p, corp.getCompany());
      }
      case "corp.payments.approve": {
        if (!this.otpVerified) throw new BankError("OTP_REQUIRED", "OTP not verified");
        if (this.p.behaviour.transferFails) throw new BankError("CORE_UNAVAILABLE", "Core banking unavailable");
        const p = corp.approvePayment({ userId, paymentId: String(input.paymentId ?? "") });
        this.otpVerified = false;
        return shown(p, corp.getCompany());
      }
      case "corp.payments.withdraw": return shown(corp.withdrawPayment({ userId, paymentId: String(input.paymentId ?? "") }), corp.getCompany());
      case "corp.payments.reject": return shown(corp.rejectPayment({ userId, paymentId: String(input.paymentId ?? ""), reason: input.reason }), corp.getCompany());
      case "corp.payments.pending": return Object.fromEntries(corp.listPending({ userId, as: input.as === "initiator" ? "initiator" : input.as === "approver" ? "approver" : undefined }).map((p) => [p.id, shown(p, corp.getCompany())]));
      case "corp.payments.get": return shown(corp.getPayment(String(input.paymentId ?? "")), corp.getCompany());
      default: return undefined;
    }
  }

  /** Single entry point used by journeys: adapter id + input -> result. */
  async call(adapter: string, input: Record<string, any> = {}): Promise<any> {
    const c = this.conditions;
    if (c.unavailable?.includes(adapter)) throw new BankError("SERVICE_UNAVAILABLE", "This service is not available right now");
    if (c.timeout?.includes(adapter)) {
      // the bank takes too long: the answer comes after the journey stopped waiting, and nothing is applied
      const wait = c.latencyMs ?? ANSWER_LIMIT_MS;
      if (wait >= ANSWER_LIMIT_MS) throw new BankError("TIMEOUT", "The bank did not answer in time");
      const t = this.now(); this.now = () => t + wait; // a slow answer still arrives: time moves on
    }
    return this.dispatch(adapter, input);
  }

  private async dispatch(adapter: string, input: Record<string, any>): Promise<any> {
    if (this.cab.handles(adapter)) {
      const out = this.cab.call(adapter, input);
      if (out !== undefined) return out;
    }
    if (adapter.startsWith("corp.")) return this.corporate(adapter, input);
    switch (adapter) {
      case "bank.accounts.list":
        return Object.fromEntries(this.p.accounts.map((a) => [a.id, a]));
      case "bank.beneficiaries.list":
        return Object.fromEntries(this.p.beneficiaries.map((b) => [b.id, { ...b, ageHours: Math.floor((Date.now() - b.addedAt) / 3600000) }]));
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
        if (price.total > from.balance && this.flaws.funds !== false) throw new BankError("INSUFFICIENT_FUNDS", "Insufficient funds");
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
        if (!this.otpVerified) throw new BankError("OTP_REQUIRED", "OTP not verified");
        if (this.p.behaviour.transferFails) throw new BankError("CORE_UNAVAILABLE", "Core banking unavailable");
        const q = this.quotes.get(String(input.quoteId));
        if (!q) throw new BankError("QUOTE_NOT_FOUND", "Quote not found");
        if (q.used && this.flaws.quoteReplay !== false) throw new BankError("QUOTE_USED", "This quote has already been used");
        if (this.now() > Date.parse(q.expiresAt) && this.flaws.quoteExpiry !== false) throw new BankError("QUOTE_EXPIRED", "The rate has expired. Get a new one.");
        const from = this.p.accounts.find((a) => a.id === q.fromAccountId)!, to = this.p.accounts.find((a) => a.id === q.toAccountId)!;
        if (q.total > from.balance && this.flaws.funds !== false) throw new BankError("INSUFFICIENT_FUNDS", "Insufficient funds");
        from.balance = roundMoney(from.balance - q.total, from.currency);
        to.balance = roundMoney(to.balance + q.to.amount, to.currency);
        q.used = true; this.otpVerified = false; this.seq += 1;
        return { reference: `FX-20261102-${String(930 + this.seq).padStart(4, "0")}`, from: { currency: from.currency, newBalance: from.balance }, to: { currency: to.currency, newBalance: to.balance }, quoteId: q.quoteId };
      }
      case "bank.transfers.own": {
        // money between a person's own accounts in the same currency: instant, free, and not counted against the daily limit
        if (!this.otpVerified) throw new BankError("OTP_REQUIRED", "OTP not verified");
        if (this.p.behaviour.transferFails) throw new BankError("CORE_UNAVAILABLE", "Core banking unavailable");
        const from = this.p.accounts.find((a) => a.id === input.fromAccountId), to = this.p.accounts.find((a) => a.id === input.toAccountId);
        if (!from || !to) throw new BankError("ACCOUNT_NOT_FOUND", "Account not found");
        if (from.id === to.id && this.flaws.sameAccount !== false) throw new BankError("SAME_ACCOUNT", "Choose two different accounts");
        if (!from.canDebit && this.flaws.canDebit !== false) throw new BankError("ACCOUNT_CANNOT_DEBIT", "This account cannot send money right now");
        if (from.currency !== to.currency) throw new BankError("CURRENCY_MISMATCH", "These accounts use different currencies: convert instead");
        const amount = Number(input.amount), digits = currencyInfo(from.currency).decimals;
        if (!(amount > 0) || Math.abs(amount * 10 ** digits - Math.round(amount * 10 ** digits)) > 1e-6) throw new BankError("INVALID_AMOUNT", `Enter an amount in ${from.currency} with at most ${digits} decimal places`);
        if (amount > from.balance && this.flaws.funds !== false) throw new BankError("INSUFFICIENT_FUNDS", "Insufficient funds");
        from.balance = roundMoney(from.balance - amount, from.currency);
        to.balance = roundMoney(to.balance + amount, to.currency);
        this.otpVerified = false; this.seq += 1;
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
      case "bank.otp.send":
        this.otpAttempts = 0;
        this.otpVerified = false;
        return { sent: true, maskedPhone: this.p.phone.replace(/\d(?=\d{4})/g, "•"), channel: input.channel ?? "sms" };
      case "bank.otp.verify": {
        this.otpAttempts += 1;
        if (String(input.code) !== this.p.behaviour.otpCode && String(input.code) !== "000000") throw new BankError("OTP_INVALID", "Incorrect code", this.otpAttempts);
        this.otpVerified = true;
        return { verified: true };
      }
      case "bank.transfers.create": {
        if (!this.otpVerified) throw new BankError("OTP_REQUIRED", "OTP not verified");
        if (this.p.behaviour.transferFails) throw new BankError("CORE_UNAVAILABLE", "Core banking unavailable");
        const amount = Number(input.amount);
        const from = this.p.accounts.find((a) => a.id === input.fromAccountId);
        if (!from) throw new BankError("ACCOUNT_NOT_FOUND", "Account not found");
        if (amount > from.balance) throw new BankError("INSUFFICIENT_FUNDS", "Insufficient funds");
        const limit = this.limitFor(from.currency);
        if (limit.usedToday + amount > limit.daily) throw new BankError("LIMIT_EXCEEDED", "Daily limit exceeded");
        from.balance = Math.round((from.balance - amount) * 1000) / 1000;
        limit.usedToday += amount;
        this.otpVerified = false;
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
      case "bank.bills.pay":
      case "bank.topup.create": {
        const isBill = adapter === "bank.bills.pay";
        if (!this.otpVerified) throw new BankError("OTP_REQUIRED", "OTP not verified");
        if (this.p.behaviour.transferFails) throw new BankError("CORE_UNAVAILABLE", "Core banking unavailable");
        const amount = Number(input.amount);
        if (!isBill && !(amount >= 50 && amount <= 5000)) throw new BankError("INVALID_AMOUNT", "Top-up must be between 50 and 5,000");
        const from = this.p.accounts.find((a) => a.id === input.fromAccountId);
        if (!from) throw new BankError("ACCOUNT_NOT_FOUND", "Account not found");
        if (amount > from.balance) throw new BankError("INSUFFICIENT_FUNDS", "Insufficient funds");
        const limit = this.limitFor(from.currency);
        if (limit.usedToday + amount > limit.daily) throw new BankError("LIMIT_EXCEEDED", "Daily limit exceeded");
        from.balance = Math.round((from.balance - amount) * 1000) / 1000;
        limit.usedToday += amount;
        this.otpVerified = false;
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
        to.balance = Math.round((to.balance + amount) * 100) / 100;
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
        if (sub.amount > from.balance) throw new BankError("INSUFFICIENT_FUNDS", "Insufficient funds");
        from.balance = Math.round((from.balance - sub.amount) * 100) / 100;
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
        if (amount > from.balance) throw new BankError("INSUFFICIENT_FUNDS", "Insufficient funds");
        const shares = Math.round((amount / inst.price) * 10000) / 10000;
        const held = fin.invest.holdings.find((h) => h.symbol === inst.symbol);
        if (held) { held.avgCost = (held.avgCost * held.shares + amount) / (held.shares + shares); held.shares = Math.round((held.shares + shares) * 10000) / 10000; }
        else fin.invest.holdings.push({ symbol: inst.symbol, shares, avgCost: inst.price });
        from.balance = Math.round((from.balance - amount) * 100) / 100;
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
        to.balance = Math.round((to.balance + proceeds) * 100) / 100;
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
      default:
        throw new BankError("UNKNOWN_ADAPTER", `No sandbox handler for ${adapter}`);
    }
  }
}

export * from "./catalog";


/** What the person sees for who a payment goes to: the beneficiary's name, or how many payees a bulk payment has. */
function shown(p: CorpPayment, company: CorpCompany): CorpPayment & { payee: string } {
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
