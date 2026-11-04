import { BankError } from "./errors";
import { alexFinance, type Finance } from "./retail/finance";
import { ACME, type CorpCompany, type Flaws } from "./business/corporate";
import { ALPHA, BETA, seedPayments } from "./business/alpha-beta";
import { createCorporateProvider, type CorporateProvider, type ProviderId } from "./business/corporate-provider";
import { CAB_PROFILES, type CabProfile } from "./retail/cab";
import { alexAccounts, alexPayees, alexRetail } from "./retail/alex";
import type { RetailData } from "./retail/data";
import { RetailSandbox, BILLERS, CARRIERS } from "./retail/retail";
import type { OtpState } from "./retail/payments";
import { BusinessSandbox, type Actor } from "./business/business";
import { applyConditions, railIsDown, type Conditions } from "./conditions";
import { DEFAULT_CONFIG, journeyEnabled, type BankConfig } from "./config";
import { STEP_UP_SECONDS, contextsOf, type IdentityDef } from "./identity";
export * from "./retail/finance";
export { CAB_PROFILES, CAB_CURRENCY, PASSWORD_RULES, passwordProblems, type CabProfile } from "./retail/cab";
export { BankError } from "./errors";
export * from "./retail/invest";
export { createCorporateProvider, MappedCorporateProvider, PROVIDERS, PROVIDER_INFO, isProviderId, type CorporateProvider, type ProviderId } from "./business/corporate-provider";
export { BankBApi, ApiError } from "./business/corporate-b";
export { applyRule, build, mapError, type MappingSpec } from "./business/mapping";
export { MAX_BULK_LINES, SALARY_CAP_FACTOR, type CorpEmployee, type BatchCheck, type BulkLineInput, type BulkLineResult, ACME, CorporateSandbox, type CorporateBankAdapter, type CorpCompany, type Flaws, type CorpPayment, type CorpUser, type CorpRole, type InitiateInput, type CorpBeneficiary, type CorpTemplate, type CorpSignatoryGroup, type CorpAuditEntry } from "./business/corporate";
export { ALPHA, BETA } from "./business/alpha-beta";
export { parseBulkFile } from "./business/business";
export { PER_USD, FX_SPREAD, FX_FEE_RATE, QUOTE_TTL_SECONDS, midRate, customerRate, type Quote } from "./retail/fx";
export { BILLERS, CARRIERS } from "./retail/retail";
export * from "./retail/data";
export * from "./rails";
export { type Conditions } from "./conditions";
export { DEFAULT_CONFIG, CORE_JOURNEYS, journeyEnabled, type BankConfig } from "./config";
export { PERSONAL_PERMISSIONS, permissionsOf, ROLE_LABEL, STEP_UP_SECONDS, type ContextInfo, type IdentityDef } from "./identity";

export type Account = { id: string; name: string; maskedNumber: string; iban: string; balance: number; currency: string; status: "active" | "frozen"; canDebit: boolean;
  /** What can be spent now: the balance less what is on hold. Absent: the whole balance. `balance` is the ledger balance. */
  available?: number; nickname?: string; kind?: "current" | "savings" };
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
  /** Everything else a retail customer has: payees, cards, deposits, loans, messages, applications. */
  retail?: RetailData;
  /** One login, several places to bank from: the companies this person acts for. Absent for a persona with a single place. */
  identity?: IdentityDef;
  /** deterministic failure modes for testing unhappy paths */
  behaviour: { otpCode: string; transferFails?: boolean; kyc: "verified" | "pending" | "rejected" };
};

const day = 24 * 3600 * 1000;

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
    accounts: alexAccounts(),
    beneficiaries: alexPayees().map((p) => ({ id: p.id, displayName: p.name, bank: p.bank ?? "", maskedNumber: p.masked, addedAt: p.addedAt })),
    limits: { daily: 50000, usedToday: 0 },
    finance: alexFinance(),
    retail: alexRetail(),
    identity: { id: "alex", name: "Alex Morgan", password: "Bwx!Demo2026", business: [{ id: "alpha", company: ALPHA, userId: "alex" }, { id: "beta", company: BETA, userId: "alex" }] },
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
  return (uses("corp.") ? people.find((p) => p.corp) : uses("cab.") ? people.find((p) => p.cab) : undefined) ?? people[0]!;
}

export type MockBankOptions = {
  /** Which bank API stands behind the corporate adapters of a company persona. */
  corpProvider?: ProviderId;
  /** Rules switched off, for mutation checks only. */
  corpFlaws?: Flaws;
  /** What goes wrong on the way to the bank: latency, timeouts, unavailable adapters or rails, empty lists. */
  conditions?: Conditions;
  /** The bank's own configuration: home market, journeys switched off, their options, the speed mapping. */
  config?: Partial<BankConfig>;
};

export class MockBank {
  private p: Persona;
  private otp: OtpState = { attempts: 0, verified: false };
  /** The clock quotes expire by; tests replace it. */
  now: () => number = () => Date.now();
  /** What goes wrong on the way to the bank; set from a scenario's `conditions` or a dev panel, and may be changed between calls. */
  conditions: Conditions;
  config: BankConfig;
  private retail: RetailSandbox;
  private business: BusinessSandbox;
  private providers = new Map<string, CorporateProvider>();
  /** The session, as a server would hold it: which context is active, whether a step-up is still valid, and whether it has ended. */
  private session = { active: "personal", stepUpUntil: undefined as number | undefined, passwordOk: false, ended: false, audit: 0 };

  constructor(personaId = "ayesha", options: MockBankOptions = {}) {
    const base = personas[personaId];
    if (!base) throw new Error(`Unknown persona ${personaId}`);
    this.p = structuredClone(base);
    this.conditions = structuredClone(options.conditions ?? {});
    this.config = { ...structuredClone(DEFAULT_CONFIG), ...structuredClone(options.config ?? {}) };
    const clock = (c: CorporateProvider) => { c.now = () => this.now(); return c; };
    if (this.p.identity) for (const b of this.p.identity.business) { const prov = clock(createCorporateProvider("reference", b.company, options.corpFlaws)); seedPayments(b.id, prov); this.providers.set(b.id, prov); }
    else if (this.p.corp) this.providers.set(this.p.corp.id, clock(createCorporateProvider(options.corpProvider ?? "reference", this.p.corp, options.corpFlaws)));
    const down = (id: string) => railIsDown(this.conditions, id);
    this.retail = new RetailSandbox(this.p, { now: () => this.now(), otp: this.otp, config: () => this.config, down });
    this.business = new BusinessSandbox({
      now: () => this.now(), otp: this.otp, transferFails: () => !!this.p.behaviour.transferFails, down, config: () => this.config,
      provider: () => this.activeProvider(), actor: () => this.actor(),
    });
  }
  get persona() { return this.p; }

  private activeProvider(): CorporateProvider | undefined {
    if (this.p.identity) return this.providers.get(this.session.active);
    return [...this.providers.values()][0];
  }
  /** Who is acting in a company: the signed-in person when the persona has an identity. */
  private actor(): Actor | undefined {
    const id = this.p.identity;
    if (!id || this.session.active === "personal") return undefined;
    const ctx = this.contexts().find((c) => c.id === this.session.active)!;
    return { contextId: ctx.id, userId: id.business.find((b) => b.id === ctx.id)!.userId, permissions: ctx.permissions };
  }
  private contexts() {
    const id = this.p.identity!;
    return contextsOf(id, { name: this.p.name, limits: { ...this.p.limits, currency: this.p.accounts[0]?.currency ?? "USD" } }, Object.fromEntries([...this.providers].map(([k, v]) => [k, v.getCompany()])));
  }

  /** Ends the session, as an idle timeout would: every later call answers SESSION_EXPIRED until a new MockBank (a new sign-in) is made. */
  expireSession() { this.session.ended = true; }
  /** The id of the active context (`personal` for a persona without companies). */
  get activeContextId() { return this.session.active; }

  /**
   * Single entry point used by journeys: adapter id + input -> result. `meta.journey` is the slug of the journey making the call;
   * a journey the bank has switched off is refused before anything else happens.
   */
  async call(adapter: string, input: Record<string, any> = {}, meta: { journey?: string } = {}): Promise<any> {
    if (meta.journey && !journeyEnabled(this.config, meta.journey)) throw new BankError("JOURNEY_DISABLED", "This isn't available at your bank.");
    if (await applyConditions(this.conditions, adapter) === "empty") return {};
    if (this.session.ended) throw new BankError("SESSION_EXPIRED", "You were signed out for your security. Sign in again to continue.");
    if (adapter.startsWith("bank.session.")) return this.sessionCall(adapter, input);
    switch (adapter) {
      case "bank.app.config": return { homeMarket: this.config.homeMarket, disabled: [...this.config.disabled], options: structuredClone(this.config.options), speedMap: structuredClone(this.config.speedMap ?? {}) };
      case "bank.otp.send":
        this.otp.attempts = 0;
        this.otp.verified = false;
        return { sent: true, maskedPhone: this.p.phone.replace(/\d(?=\d{4})/g, "•"), channel: input.channel ?? "sms" };
      case "bank.otp.verify": {
        this.otp.attempts += 1;
        if (String(input.code) !== this.p.behaviour.otpCode && String(input.code) !== "000000") throw new BankError("OTP_INVALID", "Incorrect code", this.otp.attempts);
        this.otp.verified = true;
        return { verified: true };
      }
    }
    const business = adapter.startsWith("corp.");
    // a persona with companies keeps each place apart: personal adapters work only in the personal context and company adapters only in a company
    if (this.p.identity) {
      const inCompany = this.session.active !== "personal";
      if (business && !inCompany) throw new BankError("WRONG_CONTEXT", "This belongs to your business banking. Switch to your business to continue.");
      if (!business && inCompany) throw new BankError("WRONG_CONTEXT", "This belongs to your personal banking. Switch to Personal to continue.");
    }
    if (business) {
      const out = this.business.call(adapter, input);
      if (out === undefined) throw new BankError("UNKNOWN_ADAPTER", `No sandbox handler for ${adapter}`);
      return out;
    }
    return this.retail.call(adapter, input);
  }

  private sessionCall(adapter: string, input: Record<string, any>) {
    const id = this.p.identity;
    if (!id) throw new BankError("NOT_SUPPORTED", "Not available for this customer");
    const now = this.now();
    const stepUpValid = () => this.session.stepUpUntil !== undefined && now <= this.session.stepUpUntil;
    switch (adapter) {
      case "bank.session.get":
        return { identity: { id: id.id, name: id.name }, activeContextId: this.session.active, contexts: this.contexts(), ...(stepUpValid() ? { stepUpUntil: new Date(this.session.stepUpUntil!).toISOString() } : {}), expiresAt: new Date(now + 30 * 60_000).toISOString() };
      case "bank.session.switch": {
        const ctx = this.contexts().find((c) => c.id === input.contextId);
        if (!ctx) throw new BankError("PERMISSION_DENIED", "You don't have access to that.");
        if (ctx.id === this.session.active) return { ...ctx, auditId: undefined };
        // moving into a company needs a recent step-up; moving back to personal does not
        if (ctx.workspace === "business" && !stepUpValid()) throw new BankError("STEP_UP_REQUIRED", "For your security, confirm it's you first.");
        this.session.active = ctx.id;
        // a code verified in one place is not valid in another
        this.otp.verified = false; this.otp.attempts = 0;
        return { ...ctx, auditId: `aud_${++this.session.audit}` };
      }
      case "bank.session.stepUp": {
        const method = String(input.method ?? "password");
        if (method !== "password" && method !== "biometric") throw new BankError("STEP_UP_FAILED", "That didn't work. Try again.");
        if (method === "password" && input.secret !== undefined) {
          // a wrong password stops here; the right one is remembered while the code is entered
          this.session.passwordOk = String(input.secret) === id.password;
          if (!this.session.passwordOk) throw new BankError("STEP_UP_FAILED", "That password isn't right.");
        } else if (method === "biometric") this.session.passwordOk = true;
        if (!this.session.passwordOk) throw new BankError("STEP_UP_FAILED", "That password isn't right.");
        if (!this.otp.verified) throw new BankError("OTP_REQUIRED", "OTP not verified");
        this.otp.verified = false; this.session.passwordOk = false;
        this.session.stepUpUntil = now + STEP_UP_SECONDS * 1000;
        return { stepUpUntil: new Date(this.session.stepUpUntil).toISOString() };
      }
      default: throw new BankError("UNKNOWN_ADAPTER", `No sandbox handler for ${adapter}`);
    }
  }
}

export * from "./catalog";
