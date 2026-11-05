import { BankError } from "./errors";
import { alexFinance, type Finance } from "./retail/finance";
import { ACME, type CorpCompany, type Flaws } from "./business/corporate";
import { ALPHA, BETA, BETA_CAST, seedPayments } from "./business/alpha-beta";
import { createCorporateProvider, type CorporateProvider, type ProviderId } from "./business/corporate-provider";
import { CAB_PROFILES, type CabProfile } from "./retail/cab";
import { alexRetail } from "./retail/alex";
import type { RetailData } from "./retail/data";
import { RetailSandbox, type OtpState } from "./retail/retail";
import { BusinessSandbox, type Actor } from "./business/business";
import { hit, isListAdapter } from "./conditions";
import { DEFAULT_CONFIG, journeyEnabled, type BankConfig } from "./config";
import { STEP_UP_SECONDS, contextsOf, type IdentityDef } from "./identity";
import { assertSandboxAllowed } from "./policy";
import { addDays, addMonths, scheduleLine, type AmountMode, type Freq, type ScheduleDetail, type ScheduleKind } from "./retail/schedules";
import { hoursSince, MAX_PAYEES, type NameCheck, type PayeeKind, type PayeeRegion } from "./retail/payees";
export { RAILS, PURPOSES, RELATIONSHIPS, type SendType, type SpeedClass } from "./retail/payments";
export { CUSTOMERS, DIRECTORY, COOLING_OFF_HOURS, COOLING_OFF_USD, MAX_PAYEES, type PayeeKind, type PayeeRegion } from "./retail/payees";
export * from "./retail/finance";
export { maskPhone } from "./retail/phone";
import { maskPhone } from "./retail/phone";
export { SANDBOX_MARKER, SandboxNotAllowedError, assertSandboxAllowed, sandboxAllowed, sandboxAllowedFor, setSandboxPolicy } from "./policy";
export { CAB_PROFILES, CAB_CURRENCY, PASSWORD_RULES, passwordProblems, type CabProfile } from "./retail/cab";
export { BankError } from "./errors";
export * from "./retail/invest";
export { createCorporateProvider, MappedCorporateProvider, PROVIDERS, PROVIDER_INFO, isProviderId, type CorporateProvider, type ProviderId } from "./business/corporate-provider";
export { BankBApi, ApiError } from "./business/corporate-b";
export { applyRule, build, mapError, type MappingSpec } from "./business/mapping";
export { MAX_BULK_LINES, SALARY_CAP_FACTOR, type CorpEmployee, type BatchCheck, type BulkLineInput, type BulkLineResult, ACME, CorporateSandbox, type CorporateBankAdapter, type CorpCompany, type Flaws, type CorpPayment, type CorpUser, type CorpRole, type InitiateInput, type CorpBeneficiary, type CorpTemplate, type CorpSignatoryGroup, type CorpAuditEntry } from "./business/corporate";
export { ALPHA, BETA, BETA_CAST } from "./business/alpha-beta";
export { parseBulkFile } from "./business/business";
export { PER_USD, FX_SPREAD, FX_FEE_RATE, QUOTE_TTL_SECONDS, DEFAULT_FX, BANKWORKX_FX, midRate, customerRate, type FxConfig, type Quote } from "./retail/fx";
export { BILLERS, CARRIERS } from "./retail/retail";
export * from "./retail/data";
export { DEFAULT_CONFIG, CORE_JOURNEYS, journeyEnabled, HOME_MARKETS, type BankConfig, type HomeMarket } from "./config";
export { PERSONAL_PERMISSIONS, permissionsOf, ROLE_LABEL, STEP_UP_SECONDS, type ContextInfo, type IdentityDef } from "./identity";

export type Account = { id: string; name: string; maskedNumber: string; iban: string; balance: number; currency: string; status: "active" | "frozen"; canDebit: boolean;
  /** What can be spent now: the balance less what is on hold. Absent: the whole balance. `balance` is the ledger balance. */
  available?: number; nickname?: string; kind?: "current" | "savings" };
export type Beneficiary = {
  id: string; displayName: string; bank: string; maskedNumber: string; addedAt: number;
  /** What kind of payee, where its account is and its details: set for payees saved with bank.payees.save (and the Payments cast). */
  kind?: PayeeKind; region?: PayeeRegion; country?: string; currency?: string; iban?: string; swift?: string; routing?: string; sortCode?: string; accountNumber?: string; accountType?: string; customerNumber?: string;
  nickname?: string; label?: string;
  /** Verified: the name matched the owner of the account when it was saved. Saved: it did not, or could not be checked. */
  verified?: boolean;
  /** The result of the name check when it was saved. */
  nameCheck?: NameCheck["result"];
  /** The same account always has the same key (see payees.ts). */
  key?: string;
  /** Seed only: how long before the sandbox clock this payee was added. Turned into addedAt the first time the list is read, so a scenario's clock decides. */
  addedAgoMs?: number;
};
/** A biller the customer saved to pay again: the biller and the reference, under a name of their own. */
export type SavedBiller = { id: string; nickname: string; billerId: string; reference: string };
/** A mobile number the customer saved to top up again: the operator, the number and a name of their own. */
export type SavedNumber = { id: string; name: string; operatorId: string; number: string };
/** A payment set up to repeat, so a payee that is used by one cannot be deleted. */
export type Schedule = { id: string; beneficiaryId: string; name: string; text: string } & Partial<ScheduleDetail>;
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
  /** Payments set up to repeat; each names the payee it pays. */
  schedules?: Schedule[];
  /** Billers saved to pay again (BankWorkx). */
  savedBillers?: SavedBiller[];
  /** Mobile numbers saved to top up again (BankWorkx). */
  savedNumbers?: SavedNumber[];
  limits: { daily: number; usedToday: number };
  /** Daily limits for accounts in other currencies, by currency code. `limits` applies to the currency of the first account. */
  limitsByCurrency?: Record<string, { daily: number; usedToday: number }>;
  /** Spending, budgets and cards, for the BankWorkx app. */
  finance?: Finance;
  /** Everything else a retail customer has: transactions, cards, deposits, goals, loans, messages, applications. */
  retail?: RetailData;
  /** One login, several places to bank from: the companies this person acts for. Absent for a persona with a single place. */
  identity?: IdentityDef;
  /** A customer made for tests and previews (Alex with saved payees, with fifty payees, ...): not offered at the apps' sign-in, still there for Studio and scenarios. */
  testCast?: boolean;
  /** deterministic failure modes for testing unhappy paths */
  behaviour: { otpCode: string; transferFails?: boolean; kyc: "verified" | "pending" | "rejected" };
};

const day = 24 * 3600 * 1000;
const hour = 3600 * 1000;
/** Alex Morgan's four accounts, for the customers that save payees (the same as alexglobal's). */
const alexAccounts = (): Account[] => [
  { id: "acc_main", name: "Main", maskedNumber: "••4410", iban: "US00 BWX 0000 0000 4410", balance: 8720.76, currency: "USD", status: "active", canDebit: true },
  { id: "acc_save", name: "Savings", maskedNumber: "••7731", iban: "US00 BWX 0000 0000 7731", balance: 15254.37, currency: "USD", status: "active", canDebit: true },
  { id: "acc_eur", name: "EUR Travel", maskedNumber: "••5502", iban: "US00 BWX 0000 0000 5502", balance: 2400, currency: "EUR", status: "active", canDebit: true },
  { id: "acc_aed", name: "AED Home", maskedNumber: "••8816", iban: "US00 BWX 0000 0000 8816", balance: 11000, currency: "AED", status: "active", canDebit: true },
];
/** The saved payees of the Payments cast: one of each kind, one added 3 hours ago (still in its first 24 hours), and two used in the payee journeys. */
const alexPayees = (): Beneficiary[] => [
  { id: "ben_taylor", displayName: "Taylor Brooks", bank: "BankWorkx", maskedNumber: "••3308", addedAt: 0, addedAgoMs: 90 * day, kind: "internal", region: "bw", country: "US", currency: "USD", customerNumber: "3301123308", key: "bw:3301123308", verified: true, nameCheck: "match" },
  { id: "ben_jamie", displayName: "Jamie Lee", bank: "Northwind Bank", maskedNumber: "••6620", addedAt: 0, addedAgoMs: 40 * day, kind: "domestic", region: "us", country: "US", currency: "USD", routing: "031201360", accountNumber: "100006620", accountType: "checking", key: "us:031201360:100006620", nickname: "Jam", label: "Friend", verified: false, nameCheck: "na" },
  { id: "ben_marco", displayName: "Marco Rossi", bank: "SWIFT NRWDDEFFXXX", maskedNumber: "••3000", addedAt: 0, addedAgoMs: 60 * day, kind: "international", region: "world", country: "DE", currency: "EUR", swift: "NRWDDEFFXXX", accountNumber: "DE89370400440532013000", key: "swift:NRWDDEFFXXX:DE89370400440532013000", verified: false, nameCheck: "na" },
  { id: "ben_casey", displayName: "Casey Nguyen", bank: "Harbor Trust", maskedNumber: "••5150", addedAt: 0, addedAgoMs: 3 * hour, kind: "domestic", region: "us", country: "US", currency: "USD", routing: "121000248", accountNumber: "200005150", accountType: "checking", key: "us:121000248:200005150", verified: false, nameCheck: "na" },
  { id: "ben_lena", displayName: "Lena Fischer", bank: "Bank (IBAN DE)", maskedNumber: "••4931", addedAt: 0, addedAgoMs: 30 * day, kind: "domestic", region: "eu", country: "DE", currency: "EUR", iban: "DE44500105175407324931", key: "iban:DE44500105175407324931", label: "Friend", verified: true, nameCheck: "match" },
  { id: "ben_james", displayName: "James Whitfield", bank: "UK bank (sort code 20-00-00)", maskedNumber: "••9911", addedAt: 0, addedAgoMs: 120 * day, kind: "domestic", region: "uk", country: "GB", currency: "GBP", sortCode: "20-00-00", accountNumber: "55779911", key: "uk:200000:55779911", label: "Landlord", verified: true, nameCheck: "match" },
];
/** Payees for the scheduled payments: four more people and companies the schedules pay (all at US banks, added long ago). */
const alexSchedPayees = (): Beneficiary[] => {
  const us = (id: string, displayName: string, bank: string, routing: string, account: string): Beneficiary => ({ id, displayName, bank, maskedNumber: `••${account.slice(-4)}`, addedAt: 0, addedAgoMs: 80 * day, kind: "domestic", region: "us", country: "US", currency: "USD", routing, accountNumber: account, accountType: "checking", key: `us:${routing}:${account}`, verified: false, nameCheck: "na" });
  return [
    ...alexPayees(),
    us("ben_harbor", "Harbor Estates", "Harbor Trust", "121000248", "300008841"),
    us("ben_maya", "Maya Chen", "Northwind Bank", "031201360", "100004417"),
    us("ben_omar", "Omar Haddad", "Summit Federal", "021000021", "400007302"),
    us("ben_peak", "Peak Fitness", "Apex Credit Union", "011000015", "500002290"),
  ];
};
/** The billers Alex has saved (the same for the scheduled-payments customer and Alex himself). */
const alexBillers = (): SavedBiller[] => [
  { id: "sb_harbor", nickname: "Harbor Insurance", billerId: "harbor_insurance", reference: "HI12345678" },
  { id: "sb_card", nickname: "Northwind Card", billerId: "northwind_card", reference: "1234567890123456" },
  { id: "sb_power", nickname: "Home electricity", billerId: "city_power", reference: "4400123456" },
];
/** The mobile numbers Alex has saved for topping up. */
const alexNumbers = (): SavedNumber[] => [
  { id: "sn_phone", name: "My phone", operatorId: "aster", number: "5550123456" },
  { id: "sn_maya", name: "Maya", operatorId: "aster", number: "5550987654" },
  { id: "sn_lena", name: "Lena", operatorId: "bright", number: "5550765432" },
];
/**
 * A schedule of the Payments cast. `done` payments were dealt with before today, so the anchor is worked back from the next date
 * (the sandbox clock of the demo is Tue 3 Nov 2026; a scenario fixes it there).
 */
const seedSchedule = (id: string, name: string, d: { kind: ScheduleKind; targetId: string; amount: number | null; mode?: AmountMode; frequency: Freq; next: string; done: number; paid?: number; endsOn?: string; endCount?: number; status?: ScheduleDetail["status"]; endedOn?: string; retry?: boolean; from?: string }): Schedule => {
  const mode = d.mode ?? "fixed", back: Record<Freq, string> = { once: d.next, weekly: addDays(d.next, -7 * d.done), biweekly: addDays(d.next, -14 * d.done), monthly: addMonths(d.next, -d.done), quarterly: addMonths(d.next, -3 * d.done) };
  return {
    id, beneficiaryId: d.kind === "payee" ? d.targetId : "", name, text: scheduleLine(name, d.frequency, d.next, mode, d.amount, "USD"),
    kind: d.kind, targetId: d.targetId, fromAccountId: d.from ?? "acc_main", amountMode: mode, amount: d.amount, currency: "USD", frequency: d.frequency, anchor: back[d.frequency],
    done: d.done, paid: d.paid ?? d.done, nextRunOn: d.next, endsOn: d.endsOn ?? null, endCount: d.endCount ?? null, status: d.status ?? "active", reminder: true, retry: d.retry ?? false, fails: 0, ...(d.endedOn ? { endedOn: d.endedOn } : {}),
  };
};
/** The eight schedules of the Payments cast, and one that ended. */
const alexSchedules = (): Schedule[] => [
  seedSchedule("SCH-1001", "Rent", { kind: "payee", targetId: "ben_harbor", amount: 1450, frequency: "monthly", next: "2026-12-01", done: 11 }),
  seedSchedule("SCH-1002", "Savings top-up", { kind: "own", targetId: "acc_save", amount: 100, frequency: "weekly", next: "2026-11-06", done: 40 }),
  seedSchedule("SCH-1003", "Harbor Insurance", { kind: "bill", targetId: "sb_harbor", amount: 400, mode: "full", frequency: "quarterly", next: "2026-11-04", done: 4 }),
  seedSchedule("SCH-1004", "Peak Fitness", { kind: "payee", targetId: "ben_peak", amount: 39.99, frequency: "monthly", next: "2026-11-03", done: 10 }),
  seedSchedule("SCH-1005", "Lena Fischer", { kind: "payee", targetId: "ben_lena", amount: 200, frequency: "monthly", next: "2026-11-16", done: 5, endCount: 12 }),
  seedSchedule("SCH-1006", "Maya Chen", { kind: "payee", targetId: "ben_maya", amount: 250, frequency: "once", next: "2026-11-12", done: 0 }),
  seedSchedule("SCH-1007", "James Whitfield", { kind: "payee", targetId: "ben_james", amount: 100, frequency: "biweekly", next: "2026-11-13", done: 12, endsOn: "2027-03-26" }),
  seedSchedule("SCH-1008", "Omar Haddad", { kind: "payee", targetId: "ben_omar", amount: 500, frequency: "monthly", next: "2026-11-20", done: 3, status: "paused" }),
  seedSchedule("SCH-0900", "Old gym", { kind: "payee", targetId: "ben_peak", amount: 30, frequency: "monthly", next: "2026-08-03", done: 8, status: "completed", endedOn: "2026-08-03" }),
];
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
  // The combined demo's customer: one login, a personal relationship, Maker at Alpha Trading LLC, Approver at Beta Services Ltd.
  // Four accounts with ledger and available balances, saved payees, cards, deposits, loans, messages and the rest (retail/alex.ts).
  alex: {
    id: "alex", brand: "bankworkx", name: "Alex Morgan", phone: "+1 415 555 0142",
    accounts: alexAccounts().map((a) => ({ ...a, kind: a.id === "acc_save" ? "savings" as const : "current" as const, available: a.id === "acc_main" ? 8602.36 : a.balance })),
    beneficiaries: alexSchedPayees(),
    // what the Payments journeys need to have something to pick: saved billers and mobile numbers, and the scheduled payments (the test customers
    // alexbills, alextopup and alexsched hold the same data separately, because their tests count what they have)
    savedBillers: [...alexBillers(), { id: "sb_net", nickname: "Home internet", billerId: "skyline_broadband", reference: "5550012345" }],
    savedNumbers: alexNumbers(),
    schedules: alexSchedules(),
    limits: { daily: 50000, usedToday: 0 },
    limitsByCurrency: { EUR: { daily: 20000, usedToday: 0 }, AED: { daily: 100000, usedToday: 0 } },
    finance: alexFinance(),
    retail: alexRetail(),
    identity: { id: "alex", name: "Alex Morgan", password: "Bwx!Demo2026", business: [{ id: "alpha", company: ALPHA, userId: "alex" }, { id: "beta", company: BETA, userId: "alex" }] },
    behaviour: { otpCode: "482100", kyc: "verified" },
  },
  // Alex with a Euro and a Dirham account too, for moving money between accounts in different currencies.
  alexglobal: {
    id: "alexglobal", brand: "bankworkx", testCast: true, name: "Alex Morgan (accounts in three currencies)", phone: "+1 415 555 0142",
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
  // The Payments cast: Alex with four accounts and saved payees, and a scheduled payment that uses one of them. Separate from Alex and
  // Alex with three currencies because their tests count what they have.
  alexpayees: {
    id: "alexpayees", brand: "bankworkx", testCast: true, name: "Alex Morgan (saved payees)", phone: "+1 415 555 0142",
    accounts: alexAccounts(),
    beneficiaries: alexPayees(),
    schedules: [{
      // the older entry, also described the way the Payments journeys read a schedule, so it can be changed or cancelled (its id and text stay as they were)
      ...seedSchedule("SCH-RENT", "Rent", { kind: "payee", targetId: "ben_james", amount: 1450, frequency: "monthly", next: "2026-12-01", done: 11 }), id: "sch_rent", text: "Rent · Monthly, 1 Dec, $1,450.00",
    }],
    limits: { daily: 50000, usedToday: 0 },
    limitsByCurrency: { EUR: { daily: 20000, usedToday: 0 }, AED: { daily: 100000, usedToday: 0 } },
    finance: alexFinance(),
    behaviour: { otpCode: "482100", kyc: "verified" },
  },
  // Alex with the most payees the bank allows (50), to try the limit.
  alexfull: {
    id: "alexfull", brand: "bankworkx", testCast: true, name: "Alex Morgan (50 saved payees)", phone: "+1 415 555 0142",
    accounts: alexAccounts(),
    beneficiaries: Array.from({ length: MAX_PAYEES }, (_, i) => {
      const n = String(i + 1).padStart(2, "0"), account = String(1000000 + i + 1);
      return { id: `ben_full${n}`, displayName: `Payee ${n}`, bank: "JPMorgan Chase", maskedNumber: `••${account.slice(-4)}`, addedAt: 0, addedAgoMs: 60 * day, kind: "domestic" as const, region: "us" as const, country: "US", currency: "USD", routing: "021000021", accountNumber: account, accountType: "checking", key: `us:021000021:${account}`, verified: false, nameCheck: "na" as const };
    }),
    limits: { daily: 50000, usedToday: 0 },
    limitsByCurrency: { EUR: { daily: 20000, usedToday: 0 }, AED: { daily: 100000, usedToday: 0 } },
    finance: alexFinance(),
    behaviour: { otpCode: "482100", kyc: "verified" },
  },
  // Alex with the Payments cast's accounts and two saved billers, for paying bills. Separate from the others because their tests count what they have.
  alexbills: {
    id: "alexbills", brand: "bankworkx", testCast: true, name: "Alex Morgan (saved billers)", phone: "+1 415 555 0142",
    accounts: alexAccounts(),
    beneficiaries: [],
    savedBillers: [{ id: "sb_power", nickname: "Home electricity", billerId: "city_power", reference: "4400123456" }, { id: "sb_net", nickname: "Home internet", billerId: "skyline_broadband", reference: "5550012345" }],
    limits: { daily: 50000, usedToday: 0 },
    limitsByCurrency: { EUR: { daily: 20000, usedToday: 0 }, AED: { daily: 100000, usedToday: 0 } },
    finance: alexFinance(),
    behaviour: { otpCode: "482100", kyc: "verified" },
  },
  // Alex with the Payments cast's accounts and three saved mobile numbers, for topping up. Separate from the others because their tests count what they have.
  alextopup: {
    id: "alextopup", brand: "bankworkx", testCast: true, name: "Alex Morgan (saved numbers)", phone: "+1 415 555 0142",
    accounts: alexAccounts(),
    beneficiaries: [],
    savedNumbers: alexNumbers(),
    limits: { daily: 50000, usedToday: 0 },
    limitsByCurrency: { EUR: { daily: 20000, usedToday: 0 }, AED: { daily: 100000, usedToday: 0 } },
    finance: alexFinance(),
    behaviour: { otpCode: "482100", kyc: "verified" },
  },
  // Alex with the Payments cast's accounts, ten saved payees, three saved billers and eight scheduled payments (and one that ended), for scheduling,
  // changing and cancelling payments. Separate from the others because their tests count what they have.
  alexsched: {
    id: "alexsched", brand: "bankworkx", testCast: true, name: "Alex Morgan (scheduled payments)", phone: "+1 415 555 0142",
    accounts: alexAccounts(),
    beneficiaries: alexSchedPayees(),
    savedBillers: alexBillers(),
    schedules: alexSchedules(),
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

// Alex again, for the approvals inbox: Beta has more waiting (a close name, a name that does not match, one Alex started, one that must wait for Lee, two approvals
// in any order) and a payment that was rejected. Separate from Alex because the combined demo counts what Beta has waiting.
personas.alexbiz = {
  ...structuredClone(personas.alex!), id: "alexbiz", testCast: true, name: "Alex Morgan (business cast)",
  identity: { id: "alex", name: "Alex Morgan", password: "Bwx!Demo2026", cast: true, business: [{ id: "alpha", company: ALPHA, userId: "alex" }, { id: "beta", company: BETA_CAST, userId: "alex" }] },
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
  // a conversion needs accounts in more than one currency (the combined-demo customer, with an identity, is never picked for a preview: a journey names it)
  const manyCurrencies = (p: Persona) => !p.identity && new Set(p.accounts.map((a) => a.currency)).size > 1;
  // saving a payee needs a customer who already has some
  const hasPayees = (p: Persona) => !p.identity && p.beneficiaries.some((b) => b.kind);
  return (uses("corp.") ? people.find((p) => p.corp) : uses("cab.") ? people.find((p) => p.cab) : uses("bank.payees.") ? people.find(hasPayees) : uses("bank.fx.") ? people.find(manyCurrencies) : undefined) ?? people[0]!;
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
  /** List adapters answer an empty list, to test empty states. */
  empty?: string[];
  /** Account ids that are frozen: they cannot send money, but can receive. */
  frozen?: string[];
  /** Every money-moving call fails with CORE_UNAVAILABLE after the code is accepted (as the persona flag transferFails does). */
  transferFails?: boolean;
  /** Money already sent today, against the daily limit of the customer's main currency (to reach the limit without sending it). */
  limitUsed?: number;
  /** Dates (YYYY-MM-DD) the bank is closed on top of Saturdays and Sundays: no scheduled payment is made, or can start, on them. */
  closedDays?: string[];
};
/** How long a journey waits for the bank before it treats the call as timed out. */
export const ANSWER_LIMIT_MS = 10_000;


export class MockBank {
  private p: Persona;
  private otp: OtpState = { attempts: 0, verified: false };
  /** The clock quotes expire by; tests replace it. */
  now: () => number = () => Date.now();
  /** Things that go wrong on purpose. A scenario sets them when the bank is made; a test or a dev panel may change them between calls. */
  conditions: SandboxConditions;
  /** The bank's own configuration: home market, journeys switched off, their options. */
  config: BankConfig;
  private retail: RetailSandbox;
  private business: BusinessSandbox;
  private providers = new Map<string, CorporateProvider>();
  /** The session, as a server would hold it: which context is active, whether a step-up is still valid, and whether it has ended. */
  private session = { active: "personal", stepUpUntil: undefined as number | undefined, ended: false, audit: 0 };

  /** `corpProvider` picks which corporate bank API stands behind the corp.* adapters; journeys do not change. */
  constructor(personaId = "ayesha", options: { corpProvider?: ProviderId; /** rules switched off, for mutation checks only */ corpFlaws?: Flaws; /** things that go wrong on purpose, for scenarios */ conditions?: SandboxConditions; /** how the bank is set up */ config?: Partial<BankConfig> } = {}) {
    assertSandboxAllowed(); // a production build must not run customers on the sandbox (policy.ts)
    const base = personas[personaId];
    if (!base) throw new Error(`Unknown persona ${personaId}`);
    this.p = structuredClone(base);
    this.conditions = structuredClone(options.conditions ?? {});
    this.config = { ...structuredClone(DEFAULT_CONFIG), ...structuredClone(options.config ?? {}) };
    const c = this.conditions;
    if (c.transferFails) this.p.behaviour.transferFails = true;
    if (c.limitUsed !== undefined) this.p.limits.usedToday = c.limitUsed;
    for (const a of this.p.accounts) if (c.frozen?.includes(a.id)) { a.status = "frozen"; a.canDebit = false; }
    const clock = (prov: CorporateProvider) => { prov.now = () => this.now(); return prov; };
    if (this.p.identity) for (const b of this.p.identity.business) { const prov = clock(createCorporateProvider(options.corpProvider ?? "reference", b.company, options.corpFlaws)); seedPayments(b.id, prov, !!this.p.identity.cast); this.providers.set(b.id, prov); }
    else if (this.p.corp) this.providers.set(this.p.corp.id, clock(createCorporateProvider(options.corpProvider ?? "reference", this.p.corp, options.corpFlaws)));
    this.retail = new RetailSandbox(this.p, { now: () => this.now(), otp: this.otp, conditions: () => this.conditions, flaws: options.corpFlaws ?? {}, config: () => this.config, setNow: (fn) => { this.now = fn; } });
    this.business = new BusinessSandbox({
      now: () => this.now(), otp: this.otp, transferFails: () => !!this.p.behaviour.transferFails, config: () => this.config, conditions: () => this.conditions,
      provider: () => this.activeProvider(), actor: () => this.actor(), flaws: () => options.corpFlaws ?? {},
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
    const ctx = this.contexts().find((x) => x.id === this.session.active)!;
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
    const c = this.conditions;
    if (hit(c.unavailable, adapter)) throw new BankError("SERVICE_UNAVAILABLE", "This service is not available right now");
    if (hit(c.timeout, adapter)) {
      // the bank takes too long: the answer comes after the journey stopped waiting, and nothing is applied
      const wait = c.latencyMs ?? ANSWER_LIMIT_MS;
      if (wait >= ANSWER_LIMIT_MS) throw new BankError("TIMEOUT", "The bank did not answer in time");
      const t = this.now(); this.now = () => t + wait; // a slow answer still arrives: time moves on
    }
    if (isListAdapter(adapter) && hit(c.empty, adapter)) return {};
    if (this.session.ended) throw new BankError("SESSION_EXPIRED", "You were signed out for your security. Sign in again to continue.");
    if (adapter.startsWith("bank.session.")) return this.sessionCall(adapter, input);
    switch (adapter) {
      case "bank.app.config": return { homeMarket: this.config.homeMarket, disabled: [...this.config.disabled], options: structuredClone(this.config.options) };
      case "bank.otp.send":
        this.otp.attempts = 0;
        this.otp.verified = false;
        return { sent: true, maskedPhone: maskPhone(this.p.phone), channel: input.channel ?? "sms" };
      case "bank.otp.verify": {
        this.otp.attempts += 1;
        if (String(input.code) !== this.p.behaviour.otpCode && String(input.code) !== "000000") throw new BankError("OTP_INVALID", "Incorrect code", this.otp.attempts);
        this.otp.verified = true;
        return { verified: true };
      }
    }
    const business = adapter.startsWith("corp.");
    // the notification centre spans every place the person banks from (each item says which), so it answers in any context
    if (adapter === "bank.notifications.list") return this.retail.call(adapter, input);
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
        const ctx = this.contexts().find((x) => x.id === input.contextId);
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
        // the proof comes with every call (the password, or the device's biometric check) and nothing is remembered between calls: a password
        // given once cannot be reused later by a call that leaves it out
        if (method === "password" && (typeof input.secret !== "string" || input.secret !== id.password)) throw new BankError("STEP_UP_FAILED", "That password isn't right.");
        if (!this.otp.verified) throw new BankError("OTP_REQUIRED", "OTP not verified");
        this.otp.verified = false;
        this.session.stepUpUntil = now + STEP_UP_SECONDS * 1000;
        return { stepUpUntil: new Date(this.session.stepUpUntil).toISOString() };
      }
      default: throw new BankError("UNKNOWN_ADAPTER", `No sandbox handler for ${adapter}`);
    }
  }
}


export * from "./catalog";
