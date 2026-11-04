import { BankError } from "./errors";
import type { Flaws } from "./corporate";

/**
 * The payees a person saves: the checks on their details, the name check and the cooling-off rule. Pure functions with sandbox
 * data (obviously fake names and numbers); MockBank keeps the saved list. A real bank's API replaces this behind the same adapters.
 */
export type PayeeKind = "internal" | "domestic" | "international";
/** bw: another BankWorkx customer; us, eu, uk, me: another bank in that region; world: abroad over SWIFT. */
export type PayeeRegion = "bw" | "us" | "eu" | "uk" | "me" | "world";
export const REGION_KIND: Record<PayeeRegion, PayeeKind> = { bw: "internal", us: "domestic", eu: "domestic", uk: "domestic", me: "domestic", world: "international" };

/** A new payee may be sent at most this much (USD, or the same value in the account's currency) in its first 24 hours. */
export const COOLING_OFF_HOURS = 24;
export const COOLING_OFF_USD = 500;
/** The most payees a person can save. */
export const MAX_PAYEES = 50;
const HOUR = 3_600_000;
export const hoursSince = (at: number, now: number) => Math.max(0, Math.floor((now - at) / HOUR));

export const LABELS = ["Family", "Friend", "Landlord", "Business", "Other"];
export const ME_COUNTRIES: Record<string, string> = { AE: "United Arab Emirates", SA: "Saudi Arabia", JO: "Jordan" };
export const WORLD_COUNTRIES: Record<string, { name: string; currency: string }> = {
  DE: { name: "Germany", currency: "EUR" }, CA: { name: "Canada", currency: "CAD" }, IN: { name: "India", currency: "INR" }, JP: { name: "Japan", currency: "JPY" }, AU: { name: "Australia", currency: "AUD" },
  CH: { name: "Switzerland", currency: "CHF" }, SG: { name: "Singapore", currency: "SGD" }, MX: { name: "Mexico", currency: "MXN" },
};

/** IBAN lengths by country. A country that is not here has no IBAN the sandbox knows. */
const IBAN_LENGTH: Record<string, number> = {
  AD: 24, AE: 23, AT: 20, BE: 16, BG: 22, CH: 21, CY: 28, CZ: 24, DE: 22, DK: 18, EE: 20, ES: 24, FI: 18, FR: 27, GB: 22, GR: 27, HR: 21, HU: 28, IE: 22, IS: 26, IT: 27,
  JO: 30, LI: 21, LT: 20, LU: 20, LV: 21, MC: 27, MT: 31, NL: 18, NO: 15, PL: 28, PT: 25, RO: 24, SA: 24, SE: 24, SI: 19, SK: 24, SM: 27,
};
/** The SEPA area, as the sandbox sees it. The United Kingdom pays over its own scheme, so a GB IBAN is not SEPA here. */
const SEPA = new Set(["AD", "AT", "BE", "BG", "CH", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HR", "HU", "IE", "IS", "IT", "LI", "LT", "LU", "LV", "MC", "MT", "NL", "NO", "PL", "PT", "RO", "SE", "SI", "SK", "SM"]);
const US_BANKS: Record<string, string> = { "021000021": "JPMorgan Chase", "026009593": "Bank of America", "121000248": "Wells Fargo", "011401533": "Citizens Bank", "031201360": "Capital One" };

/** Other BankWorkx customers a person can add by account number. */
export const CUSTOMERS: Record<string, string> = { "3301123308": "Taylor Brooks", "3301554412": "Jordan Keller" };

/** Who owns an account, as the name check sees it (Verification of Payee, Confirmation of Payee). An account that is not here cannot be checked. */
const NAME_REGISTRY: Record<string, string> = {
  "iban:FR1420041010050500013M02606": "Camille Dubois",
  "iban:DE44500105175407324931": "Lena Fischer",
  "uk:200000:55779911": "James Whitfield",
  "iban:AE070331234567890123456": "Omar Haddad",
  "us:021000021:987654321": "Priya Raman",
  "iban:SA0380000000608010167519": "Faisal Al-Harbi",
  "iban:JO94CBJO0010000000000131000302": "Rania Haddad",
};

const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "");
const clean = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();
const compact = (s: unknown) => String(s ?? "").replace(/[\s-]/g, "").toUpperCase();

export const ibanValid = (iban: string): boolean => {
  const r = iban.slice(4) + iban.slice(0, 4);
  let rem = 0;
  for (const c of r) for (const d of /[A-Z]/.test(c) ? String(c.charCodeAt(0) - 55) : c) rem = (rem * 10 + Number(d)) % 97;
  return rem === 1;
};
export const abaValid = (r: string): boolean => {
  const d = [...r].map(Number);
  return (3 * (d[0]! + d[3]! + d[6]!) + 7 * (d[1]! + d[4]! + d[7]!) + (d[2]! + d[5]! + d[8]!)) % 10 === 0;
};

/** What a person typed, whichever fields the payee's region uses. */
export type PayeeInput = {
  kind?: string; region?: string; country?: string; name?: string; nickname?: string; label?: string;
  customerNo?: string; routing?: string; account?: string; accountType?: string; iban?: string; sort?: string; swift?: string;
};
/** The details of a payee after the checks: what the sandbox keeps. */
export type PayeeDetails = {
  kind: PayeeKind; region: PayeeRegion; country?: string; currency?: string; displayName: string; nickname: string; label: string;
  bank: string; maskedNumber: string; iban?: string; swift?: string; routing?: string; sortCode?: string; accountNumber?: string; accountType?: string; customerNumber?: string;
  /** The same account always gives the same key: used to find a payee saved twice and to look the owner up in the name check. */
  key: string;
};

const fail = (code: string, message: string): never => { throw new BankError(code, message); };
const ibanOf = (raw: string, flaws: Flaws): string => {
  const iban = compact(raw);
  if (!iban) return fail("INVALID_IBAN", "Enter the IBAN.");
  const len = IBAN_LENGTH[iban.slice(0, 2)];
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(iban) || !len || iban.length !== len || (flaws.ibanChecksum !== false && !ibanValid(iban))) return fail("INVALID_IBAN", "That IBAN isn't valid. Check the characters and the length.");
  return iban;
};
const last4 = (s: string) => `••${s.slice(-4)}`;

/** Checks what was typed for a payee of a region and returns it cleaned. Throws the first problem, in the order of the form. */
export function checkPayee(input: PayeeInput, flaws: Flaws = {}): PayeeDetails {
  const region = input.region as PayeeRegion;
  if (!(region in REGION_KIND)) return fail("INVALID_REGION", "Choose where the account is.");
  const kind = REGION_KIND[region];
  if (input.kind && input.kind !== kind) return fail("INVALID_REGION", "That payee type does not use that region.");
  const nickname = clean(input.nickname), label = clean(input.label);
  if (nickname.length > 24) return fail("NICKNAME_TOO_LONG", "Use 24 characters or fewer.");
  if (label && !LABELS.includes(label)) return fail("INVALID_LABEL", "Choose a label from the list.");
  const base = { kind, region, nickname, label };

  if (region === "bw") {
    const no = digits(input.customerNo);
    if (!/^[0-9]{10}$/.test(no) || no !== clean(input.customerNo)) return fail("INVALID_ACCOUNT", "Enter the 10-digit BankWorkx® account number.");
    const owner = CUSTOMERS[no];
    if (!owner) return fail("CUSTOMER_NOT_FOUND", "We can't find a BankWorkx® account with that number. Check it and try again.");
    return { ...base, displayName: owner, bank: "BankWorkx", maskedNumber: last4(no), customerNumber: no, currency: "USD", key: `bw:${no}` };
  }

  let country: string | undefined, currency: string | undefined;
  if (region === "me") {
    country = clean(input.country);
    if (!ME_COUNTRIES[country]) return fail("COUNTRY_REQUIRED", "Choose a country.");
  } else if (region === "world") {
    country = clean(input.country);
    if (!WORLD_COUNTRIES[country]) return fail("COUNTRY_REQUIRED", "Choose a country.");
    currency = WORLD_COUNTRIES[country]!.currency;
  }
  const displayName = clean(input.name);
  if (displayName.length < 2) return fail("PAYEE_NAME_REQUIRED", "Enter the name on the account.");

  switch (region) {
    case "us": {
      const routing = clean(input.routing);
      if (!routing) return fail("INVALID_ROUTING", "Enter the 9-digit routing number.");
      if (!/^[0-9]{9}$/.test(routing) || (flaws.routingChecksum !== false && !abaValid(routing))) return fail("INVALID_ROUTING", "That routing number isn't valid. Check the 9 digits.");
      const account = clean(input.account);
      if (!account) return fail("INVALID_ACCOUNT", "Enter the account number.");
      if (!/^[0-9]{4,17}$/.test(account)) return fail("INVALID_ACCOUNT", "An account number has 4 to 17 digits.");
      const accountType = input.accountType === "savings" ? "savings" : "checking";
      return { ...base, displayName, country: "US", currency: "USD", bank: US_BANKS[routing] ?? `Bank (routing ${routing})`, maskedNumber: last4(account), routing, accountNumber: account, accountType, key: `us:${routing}:${account}` };
    }
    case "uk": {
      const sort = clean(input.sort);
      if (!sort) return fail("INVALID_SORT_CODE", "Enter the 6-digit sort code.");
      if (flaws.sortCode !== false && !/^[0-9]{6}$/.test(digits(sort))) return fail("INVALID_SORT_CODE", "A sort code has 6 digits, like 20-00-00.");
      const account = clean(input.account);
      if (!account) return fail("INVALID_ACCOUNT", "Enter the 8-digit account number.");
      if (!/^[0-9]{8}$/.test(account)) return fail("INVALID_ACCOUNT", "A UK account number has 8 digits.");
      const sc = digits(sort);
      return { ...base, displayName, country: "GB", currency: "GBP", bank: `UK bank (sort code ${sc.slice(0, 2)}-${sc.slice(2, 4)}-${sc.slice(4)})`, maskedNumber: last4(account), sortCode: `${sc.slice(0, 2)}-${sc.slice(2, 4)}-${sc.slice(4)}`, accountNumber: account, key: `uk:${sc}:${account}` };
    }
    case "eu": case "me": {
      const iban = ibanOf(String(input.iban ?? ""), flaws), cc = iban.slice(0, 2);
      if (region === "eu" && flaws.sepa !== false && !SEPA.has(cc)) return fail("NOT_SEPA", "That IBAN isn't in the SEPA area. Use “Other countries (SWIFT)”.");
      if (region === "me" && flaws.countryMatch !== false && cc !== country) return fail("COUNTRY_MISMATCH", `That IBAN starts with ${cc}, but you chose ${ME_COUNTRIES[country!]}.`);
      return { ...base, displayName, country: region === "eu" ? cc : country, currency: region === "eu" ? "EUR" : undefined, bank: `Bank (IBAN ${cc})`, maskedNumber: last4(iban), iban, key: `iban:${iban}` };
    }
    default: {
      const swift = compact(input.swift);
      if (!swift) return fail("INVALID_BIC", "Enter the SWIFT/BIC code.");
      if (flaws.bic !== false && !/^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(swift)) return fail("INVALID_BIC", "A SWIFT/BIC has 8 or 11 letters and numbers.");
      const account = clean(input.account);
      if (!account) return fail("INVALID_ACCOUNT", "Enter the account number or IBAN.");
      const bare = account.replace(/[\s-]/g, "");
      if (!/^[A-Za-z0-9 -]+$/.test(account) || bare.length < 6 || bare.length > 34) return fail("INVALID_ACCOUNT", "That account number looks too short or too long.");
      return { ...base, displayName, country, currency, bank: `SWIFT ${swift}`, maskedNumber: last4(bare), swift, accountNumber: bare.toUpperCase(), key: `swift:${swift}:${bare.toUpperCase()}` };
    }
  }
}

export type NameCheck = { result: "match" | "close" | "none" | "na"; registeredName?: string; label: string };
const CHECK_LABEL: Record<PayeeRegion, string> = { bw: "BankWorkx® customer record", uk: "Confirmation of Payee", eu: "Verification of Payee", us: "Name check", me: "Name check", world: "Name check" };
const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
const distance = (a: string, b: string): number => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length]![b.length]!;
};

/**
 * Compares the name a person typed with the owner of the account. A customer of the bank is always a match (the name comes from the
 * record). Abroad nothing is checked, and neither is an account the registry does not know, or any account when the bank switched the check off.
 */
export function checkName(p: PayeeDetails, typedName: string, o: { skip?: boolean; flaws?: Flaws } = {}): NameCheck {
  const label = CHECK_LABEL[p.region];
  if (p.region === "bw") return { result: "match", registeredName: p.displayName, label };
  const owner = NAME_REGISTRY[p.key];
  if (o.skip || p.region === "world" || !owner) return { result: "na", label };
  if (o.flaws?.nameCheck === false) return { result: "match", registeredName: owner, label };
  const typed = plain(typedName), real = plain(owner);
  if (typed === real) return { result: "match", registeredName: owner, label };
  return { result: distance(typed, real) <= 2 ? "close" : "none", registeredName: owner, label };
}
