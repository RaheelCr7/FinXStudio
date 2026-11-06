import { secretHash } from "../hash";

/**
 * What the bank publishes before anyone signs in (BankWorkx, Public): the products, the loan and deposit rates, the branches and cash machines with their hours, the ways to reach the
 * bank, and what the bank remembers about applications and about customers who may register for digital banking. The sandbox side of `loan-calculator`, `deposit-calculator`,
 * `find-branch-atm`, `contact-support`, `open-account`, `track-application` and `register-digital-banking` (retail/public.ts holds the rules).
 *
 * All of it is made up. What the bank holds about a person is a mask or a hash (the last digits of a number, a salted hash of an ID number or an email); photos and codes are never kept.
 */
export type PubMarket = "A" | "B" | "C" | "D";
export const MARKET_BY_HOME = { us: "A", uk: "B", eu: "C", ae: "D", sa: "D", jo: "D" } as const;
/** The symbol before an amount, the distance unit, the country pre-selected and the currency, by the market the bank is at home in. */
export const MARKETS: Record<PubMarket, { symbol: string; unit: "mi" | "km"; country: string; currency: string }> = {
  A: { symbol: "$", unit: "mi", country: "United States", currency: "USD" },
  B: { symbol: "£", unit: "mi", country: "United Kingdom", currency: "GBP" },
  C: { symbol: "€", unit: "km", country: "Germany", currency: "EUR" },
  D: { symbol: "AED ", unit: "km", country: "United Arab Emirates", currency: "AED" },
};

const DAY = 86_400_000;
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* --------------------------------------------------------------------------------------------------- hours */
/** One day: "24" is open all day, a pair is opening and closing as minutes after midnight, null is closed. Indexed Sunday (0) to Saturday (6). */
export type DayHours = "24" | [number, number] | null;
const hm = (h: number, m = 0) => h * 60 + m;
const week = (sun: DayHours, weekday: DayHours, sat: DayHours): DayHours[] => [sun, weekday, weekday, weekday, weekday, weekday, sat];
export const HOURS = {
  branch: week(null, [hm(9), hm(17)], [hm(9), hm(13)]),
  late: week([hm(10), hm(16)], [hm(8), hm(20)], [hm(8), hm(20)]),
  mall: week([hm(10), hm(21)], [hm(9), hm(22)], [hm(9), hm(22)]),
  all: week("24", "24", "24"),
  chat: week([hm(10), hm(16)], [hm(8), hm(20)], [hm(8), hm(20)]),
  call: week(null, [hm(8), hm(18)], null),
  message: week("24", "24", "24"),
} satisfies Record<string, DayHours[]>;
const t = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const dayText = (d: DayHours) => (d === "24" ? "Open 24 hours" : d ? `${t(d[0])} to ${t(d[1])}` : "Closed");
export const hoursRows = (h: DayHours[]) => h.map((d, i) => ({ day: WEEKDAYS[i]!, text: dayText(d) }));
/** Whether a place or a line is open at this moment (UTC, the sandbox bank's clock) and what to say about it: "Closes 20:00", "Opens 09:00", "Opens tomorrow 09:00", "Opens Mon 09:00". */
export function openStatus(h: DayHours[], at: number): { open: boolean; chip: "Open" | "Closed"; text: string } {
  const d = new Date(at), dow = d.getUTCDay(), mins = d.getUTCHours() * 60 + d.getUTCMinutes(), today = h[dow] ?? null;
  if (today === "24") return { open: true, chip: "Open", text: "Closes 24:00" };
  if (today && mins >= today[0] && mins < today[1]) return { open: true, chip: "Open", text: `Closes ${t(today[1])}` };
  if (today && mins < today[0]) return { open: false, chip: "Closed", text: `Opens ${t(today[0])}` };
  for (let i = 1; i <= 7; i++) {
    const next = h[(dow + i) % 7];
    if (!next) continue;
    const from = next === "24" ? 0 : next[0];
    return { open: false, chip: "Closed", text: i === 1 ? `Opens tomorrow ${t(from)}` : `Opens ${SHORT_DAYS[(dow + i) % 7]} ${t(from)}` };
  }
  return { open: false, chip: "Closed", text: "Closed" };
}

/* ------------------------------------------------------------------------------------------------ places */
export type Place = { id: string; name: string; kind: "branch" | "atm"; address: string; area: string; km: number; hours: keyof typeof HOURS; services: string[]; lat: number; lng: number };
/** The branches and cash machines (invented), nearest first. Coordinates only place a pin on the schematic map. */
export const PLACES: Place[] = [
  { id: "a1", name: "Central Plaza cash machine", kind: "atm", address: "Central Plaza, ground floor", area: "City centre", km: 0.4, hours: "all", services: ["Cash withdrawal", "Cash deposit"], lat: 51.5, lng: -0.122 },
  { id: "b1", name: "Central Branch", kind: "branch", address: "1 Example Square", area: "City centre", km: 0.8, hours: "branch", services: ["Cash deposits", "Advice desk", "Step-free access"], lat: 51.503, lng: -0.119 },
  { id: "a2", name: "Station cash machine", kind: "atm", address: "Main Station concourse", area: "Station", km: 1.2, hours: "all", services: ["Cash withdrawal"], lat: 51.497, lng: -0.131 },
  { id: "b2", name: "Market Street Branch", kind: "branch", address: "48 Market Street", area: "Market", km: 2.1, hours: "late", services: ["Cash deposits", "Safe deposit boxes", "Step-free access"], lat: 51.512, lng: -0.108 },
  { id: "a3", name: "Mall cash machine", kind: "atm", address: "Riverside Mall, level 1", area: "Riverside", km: 3.4, hours: "mall", services: ["Cash withdrawal", "Cash deposit", "Step-free access"], lat: 51.488, lng: -0.105 },
  { id: "b3", name: "Riverside Branch", kind: "branch", address: "9 Example Road", area: "Riverside", km: 3.6, hours: "branch", services: ["Cash deposits", "Advice desk"], lat: 51.486, lng: -0.11 },
  { id: "a4", name: "Harbour cash machine", kind: "atm", address: "Harbour Walk", area: "Harbour", km: 5.8, hours: "all", services: ["Cash withdrawal"], lat: 51.52, lng: -0.15 },
  { id: "b4", name: "Airport Branch", kind: "branch", address: "Terminal 1, arrivals", area: "Airport", km: 12.4, hours: "late", services: ["Cash deposits", "Currency exchange", "Step-free access"], lat: 51.47, lng: -0.2 },
];
/** Kilometres as the market shows them: one decimal, miles = km x 0.621 rounded half up, in whole tenths so no fraction is ever added. */
export function distanceText(km: number, unit: "mi" | "km"): string {
  const tenthsKm = Math.round(km * 10), tenths = unit === "km" ? tenthsKm : Math.floor((tenthsKm * 621 + 500) / 1000);
  return `${Math.floor(tenths / 10)}.${tenths % 10} ${unit}`;
}

/* ----------------------------------------------------------------------------------------------- products */
export type Fact = { label: string; value: string };
export type Product = {
  id: string; type: "account" | "card" | "deposit" | "loan"; name: string; tagline: string; rank: number; headline: Fact; facts: Fact[]; fees: Fact[]; eligibility: string[]; needed: string[];
  termsVersion: string; action: { label: string; journey: string };
};
const f = (label: string, value: string): Fact => ({ label, value });
const base = { termsVersion: "2026-10", action: { label: "Open this account", journey: "open-account" } };
const ID3 = ["Photo ID", "proof of address", "tax details"];
export const PRODUCTS: Product[] = [
  { id: "acc_everyday", type: "account", name: "Everyday Account", tagline: "A simple current account with a debit card.", rank: 1, headline: f("Monthly fee", "$0"), facts: [f("Currency", "USD"), f("Opening balance", "$0"), f("Debit card", "included"), f("Overdraft", "none")], fees: [f("Monthly fee", "None"), f("ATM in network", "None"), f("Card replacement", "$10.00")], eligibility: ["18 or older.", "Lives in the United States."], needed: ID3, ...base },
  { id: "acc_saver", type: "account", name: "Aurora Savings", tagline: "Earn interest on money you set aside.", rank: 2, headline: f("Rate", "3.10% a year"), facts: [f("Currency", "USD"), f("Interest", "paid monthly"), f("Minimum opening balance", "$100"), f("Withdrawals", "unlimited")], fees: [f("Monthly fee", "None")], eligibility: ["18 or older.", "Lives in the United States."], needed: ID3, ...base },
  { id: "acc_student", type: "account", name: "Student Account", tagline: "For 16 to 25 year olds who are studying.", rank: 3, headline: f("Monthly fee", "$0"), facts: [f("Currency", "USD"), f("Opening balance", "$0"), f("Debit card", "included"), f("Daily card limit", "$500")], fees: [f("Monthly fee", "None"), f("Card replacement", "$5.00")], eligibility: ["16 to 25.", "Studying (student letter)."], needed: ["Photo ID", "proof of address", "student letter", "tax details"], ...base },
  { id: "card_debit", type: "card", name: "Aurora Debit", tagline: "Spend from your account, in shops and online.", rank: 1, headline: f("Included with", "Everyday"), facts: [f("Network", "sandbox card network"), f("Contactless", "yes"), f("Daily ATM limit", "$1,000")], fees: [f("Annual fee", "None"), f("Foreign transactions", "1.5%")], eligibility: ["Holds an Everyday or Student Account."], needed: ["An open account"], ...base },
  { id: "card_credit", type: "card", name: "Aurora Credit", tagline: "Spread the cost with a credit limit.", rank: 2, headline: f("Limit", "Up to $10,000"), facts: [f("Credit limit", "$500 to $10,000"), f("Interest-free days", "up to 45"), f("Representative APR", "19.9%")], fees: [f("Annual fee", "$0 in year one, then $35"), f("Late payment", "$25")], eligibility: ["21 or older.", "Income of at least $24,000 a year."], needed: ["Photo ID", "proof of income"], ...base },
  ...[["dep_6m", "6-month deposit", "Lock money away for six months.", 1, "3.60% a year", "6 months"], ["dep_12m", "12-month deposit", "A year, a steady rate.", 2, "4.10% a year", "12 months"], ["dep_24m", "24-month deposit", "Our best rate for two years.", 3, "4.40% a year", "24 months"]].map(([id, name, tagline, rank, rate, term]): Product => (
    { id: id as string, type: "deposit", name: name as string, tagline: tagline as string, rank: rank as number, headline: f("Rate", rate as string), facts: [f("Term", term as string), f("Minimum", "$500"), f("Maximum", "$250,000"), f("Interest", "at maturity or monthly"), f("Bonus", "+0.10% for $50,000 or more")], fees: [f("Early withdrawal", "1% of the amount")], eligibility: ["18 or older.", "Has a BankWorkx® account."], needed: ["An open account"], ...base, action: { label: "Estimate returns", journey: "deposit-calculator" } })),
  { id: "loan_personal", type: "loan", name: "Personal loan", tagline: "Borrow for what matters, repay monthly.", rank: 1, headline: f("From", "8.90% APR"), facts: [f("Amount", "$1,000 to $35,000"), f("Term", "12, 24, 36, 48 or 60 months"), f("Rate", "fixed")], fees: [f("Arrangement fee", "None"), f("Early repayment", "None")], eligibility: ["21 or older.", "Income of at least $24,000 a year."], needed: ["Photo ID", "proof of address", "proof of income"], ...base, action: { label: "Estimate repayments", journey: "loan-calculator" } },
  { id: "loan_auto", type: "loan", name: "Auto loan", tagline: "Finance a car.", rank: 2, headline: f("From", "6.90% APR"), facts: [f("Amount", "$5,000 to $60,000"), f("Term", "12 to 84 months in steps of 12"), f("Rate", "fixed")], fees: [f("Arrangement fee", "None")], eligibility: ["21 or older.", "Income of at least $24,000 a year."], needed: ["Photo ID", "proof of address", "proof of income", "the vehicle quote"], ...base, action: { label: "Estimate repayments", journey: "loan-calculator" } },
  { id: "loan_home", type: "loan", name: "Home loan", tagline: "Buy or improve a home.", rank: 3, headline: f("From", "5.40% APR"), facts: [f("Amount", "$50,000 to $500,000"), f("Term", "60 to 360 months in steps of 60"), f("Rate", "fixed for the whole term")], fees: [f("Arrangement fee", "None"), f("Valuation", "$250 (paid at offer)")], eligibility: ["21 or older.", "Income of at least $24,000 a year.", "A deposit of at least 10%."], needed: ["Photo ID", "proof of address", "proof of income", "the property details"], ...base, action: { label: "Estimate repayments", journey: "loan-calculator" } },
];

/* ------------------------------------------------------------------------------------------------- rates */
export type LoanKind = { type: "personal" | "auto" | "home"; name: string; aprH: number; amountMin: number; amountMax: number; amountStep: number; startAmount: number; termMin: number; termMax: number; termStep: number; startTerm: number };
/** The loan table (invented; a bank loads its own). `aprH` is the yearly rate in hundredths of a percent (990 is 9.90%); amounts are whole units. */
export const LOANS: LoanKind[] = [
  { type: "personal", name: "Personal loan", aprH: 990, amountMin: 1000, amountMax: 50000, amountStep: 500, startAmount: 10000, termMin: 6, termMax: 84, termStep: 6, startTerm: 36 },
  { type: "auto", name: "Car loan", aprH: 740, amountMin: 2000, amountMax: 80000, amountStep: 500, startAmount: 15000, termMin: 12, termMax: 84, termStep: 6, startTerm: 48 },
  { type: "home", name: "Home loan", aprH: 510, amountMin: 50000, amountMax: 750000, amountStep: 5000, startAmount: 200000, termMin: 60, termMax: 360, termStep: 12, startTerm: 240 },
];
/** The deposit rates by term, in hundredths of a percent a year (390 is 3.90%). */
export const DEPOSIT_RATES: { termMonths: number; rateH: number }[] = [{ termMonths: 3, rateH: 300 }, { termMonths: 6, rateH: 340 }, { termMonths: 12, rateH: 390 }, { termMonths: 24, rateH: 360 }, { termMonths: 60, rateH: 330 }];
export const DEPOSIT_RANGE = { min: 500, max: 100000, step: 500, start: 10000 };
export const termText = (n: number) => (n === 12 ? "1 year" : n < 24 || n % 12 !== 0 ? `${n} months` : `${n / 12} years`);
export const ratePct = (rateH: number) => `${Math.floor(rateH / 100)}.${String(rateH % 100).padStart(2, "0")}`;
/** 9.90 prints as 9.9 (a loan's rate), 3.9 as 3.90 (a deposit's, always two decimals). */
export const aprText = (aprH: number) => `${(aprH / 100).toString()}%`;

const roundDiv = (a: bigint, b: bigint) => (2n * a + b) / (2n * b);
/**
 * The monthly payment and the total of a loan, exactly: payment = P r / (1 - (1 + r)^-n) with r = rate / 12, worked as a fraction of whole numbers (BigInt) so no float ever
 * touches money. The payment is rounded half up to the cent; the total is the unrounded payment times n, rounded once (so total interest is not payment x n - amount).
 * `perUnit` is the payment (and the total) for 1.00 of principal in units of 1e-12, which a screen multiplies by the amount to follow it live.
 */
export function loanFigures(amountCents: number, aprH: number, n: number) {
  const num = BigInt(aprH), den = 120000n, p = BigInt(amountCents), A = (den + num) ** BigInt(n), B = den ** BigInt(n);
  const dd = den * (A - B), numer = p * num * A;
  const payment = roundDiv(numer, dd), total = roundDiv(numer * BigInt(n), dd);
  const per = (x: bigint) => Number(roundDiv(x * 10n ** 12n * num * A, dd));
  return { paymentCents: Number(payment), totalCents: Number(total), interestCents: Number(total) - amountCents, payFactor: per(1n), totalFactor: per(BigInt(n)) };
}
/** Simple interest: amount x rate x months / 12, in cents, rounded half up. */
export const depositInterest = (amountCents: number, rateH: number, months: number) => Number(roundDiv(BigInt(amountCents) * BigInt(rateH) * BigInt(months), 120000n));
export const roundedDiv = (a: number, b: number) => Number(roundDiv(BigInt(a), BigInt(b)));

/* --------------------------------------------------------------------------------------- the bank's people */
/** The last six digits of a mobile number, as the bank keeps them: a salted hash (the match for an application needs only these). */
export const hashMobile6 = (last6: string) => secretHash(last6, "app-mobile", 8);
const h6 = (_ref: string, last6: string) => hashMobile6(last6);
export const hashContact = (value: string, salt: string) => secretHash(value.trim().toLowerCase(), `pub:${salt}`, 8);

export type Application = {
  id: string; reference?: string; state: "draft" | "submitted"; deviceId: string;
  mobileLast4: string; mobileLast6: string; emailHash: string; emailMasked: string; mobileHash: string;
  verified: boolean; savedUntil?: number; savedAt?: number;
  /** What a draft holds, as text and flags: never an ID number, a tax ID, a photo or a code. */
  answers: Record<string, string | boolean>;
  idHash?: string; idMasked?: string; taxHash?: string; taxMasked?: string;
  idVerified: boolean; attempts: { id: number; selfie: number; poa: number; match: number };
  product?: string; productName?: string; stage?: "received" | "checking" | "ready"; manual?: boolean; accountLast4?: string; submittedAt?: number; registeredAs?: string;
};
export type BankCustomer = { id: string; name: string; cardHash: string; dob: string; mobileLast4: string; mobile: string; email: string; registeredAs?: string; /** when this bank registered them (not set for a customer who was registered before) */ registeredAt?: number };
export type Outbox = { to: string; kind: string };
export const cardKey = (digits: string) => secretHash(digits, "pub:card", 8);

/** What the bank remembers before anyone signs in. Kept with the sign-in directory, so it outlasts a bank made for one sign-in (an application made here is found by Track). */
export class PublicDirectory {
  /** The last application number (APP-100236 ...), and a counter for the ids of drafts and tokens. */
  seq = 0;
  ids = 0;
  applications: Application[] = [];
  customers: BankCustomer[] = [];
  /** What the bank sent (masked destination and kind, never a value) and what it logged. */
  outbox: Outbox[] = [];
  log: string[] = [];
  constructor() {
    const seed = (reference: string, mobile: string, product: string, productName: string, stage: Application["stage"], extra: Partial<Application> = {}, email = `${reference.toLowerCase()}@example.com`) => this.applications.push({
      id: `seed_${reference}`, reference, state: "submitted", deviceId: "seed", mobileLast4: mobile.slice(-4), mobileLast6: h6(reference, mobile.slice(-6)), mobileHash: hashContact(mobile.slice(-10), "mobile"),
      emailHash: hashContact(email, "email"), emailMasked: email.replace(/^(.).*(@.*)$/, "$1•••$2"), verified: true, answers: {}, idVerified: true, attempts: { id: 0, selfie: 0, poa: 0, match: 0 }, product, productName, stage, ...extra,
    });
    seed("APP-100234", "5550100123", "acc_everyday", "Everyday Account", "checking", { submittedAt: Date.parse("2026-11-03T08:00:00Z") });
    seed("APP-100235", "5550100124", "acc_everyday", "Everyday Account", "ready", { accountLast4: "2208", submittedAt: Date.parse("2026-11-02T09:00:00Z") });
    seed("APP-100199", "5550100999", "acc_everyday", "Everyday Account", "checking", { submittedAt: Date.parse("2026-11-01T09:00:00Z") }, "duplicate@example.com");
    this.seq = 100235;
    this.customers.push(
      { id: "20481993", name: "Jordan Lee", cardHash: cardKey("5555555555554444"), dob: "1990-01-01", mobileLast4: "0177", mobile: "+1 415 555 0177", email: "jordan.lee@example.com" },
      { id: "20440010", name: "Alex Morgan", cardHash: cardKey("4242424242424242"), dob: "1990-01-01", mobileLast4: "0142", mobile: "+1 415 555 0142", email: "alex.morgan@example.com", registeredAs: "alex.morgan" },
    );
  }
}
