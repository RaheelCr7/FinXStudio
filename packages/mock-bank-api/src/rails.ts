import { currencyInfo, roundMoney } from "@finx/ui-kit";
import { BankError } from "./errors";

/**
 * Payment rails for the sandbox (docs/journeys/09-payment-rails.md). A customer picks a speed class (Standard, Same day, Instant);
 * the bank's configuration maps each class to a real rail per market. Pure data and functions: the clock is passed in, nothing here
 * holds state. Fees are in USD, `max` in the rail's own currency, cut-offs in UTC (fixed offsets: no daylight saving in the sandbox).
 */
export type Market = "us" | "eu" | "uk" | "ae" | "sa" | "jo" | "intl";
export type SpeedClass = "standard" | "sameDay" | "instant";
export const SPEED_CLASSES: SpeedClass[] = ["standard", "sameDay", "instant"];

export type Rail = {
  id: string; market: Market; name: string;
  /** The speed class the rail naturally serves. */
  speed: SpeedClass;
  eta: string; /** USD */ fee: number; /** in the payee's currency; null = no limit */ max: number | null;
  /** HH:MM UTC after which a same-day rail goes out on the next business day. Absent: no cut-off. */
  cutoff?: string;
  /** Whole business days until the money arrives, for rails that are not instant or same day. */
  businessDays: number;
  instant: boolean;
  refLabel: string; refPrefix: string;
};

const r = (id: string, market: Market, name: string, speed: SpeedClass, eta: string, fee: number, max: number | null, refLabel: string, refPrefix: string, more: Partial<Rail> = {}): Rail =>
  ({ id, market, name, speed, eta, fee, max, businessDays: 0, instant: false, refLabel, refPrefix, ...more });

export const RAILS: Rail[] = [
  r("ach", "us", "ACH (standard)", "standard", "1–2 business days", 0, 25_000, "ACH trace number", "", { businessDays: 2 }),
  r("sach", "us", "Same-day ACH", "sameDay", "Same day", 1, 1_000_000, "ACH trace number", "", { cutoff: "19:45" }),
  r("rtp", "us", "Instant (RTP® / FedNow®)", "instant", "Seconds, 24/7", 0.25, 500_000, "Network ID", "RTP", { instant: true }),
  r("wire", "us", "Wire (Fedwire®)", "sameDay", "Same day", 25, null, "IMAD", "20261103B1Q8", { cutoff: "23:00" }),
  r("sct", "eu", "SEPA Credit Transfer", "standard", "Next business day", 0, 1_000_000, "End-to-end ID", "E2E", { businessDays: 1, cutoff: "14:00" }),
  r("sinst", "eu", "SEPA Instant", "instant", "Within 10 seconds, 24/7", 0.5, 100_000, "UETR", "", { instant: true }),
  r("fps", "uk", "Faster Payments", "instant", "Seconds, 24/7", 0, 1_000_000, "FPS reference", "FP", { instant: true }),
  r("chaps", "uk", "CHAPS", "sameDay", "Same day", 25, null, "CHAPS reference", "CH", { cutoff: "17:40" }),
  r("bacs", "uk", "Bacs", "standard", "3 business days", 0, 20_000, "Bacs reference", "BC", { businessDays: 3 }),
  r("aani", "ae", "Aani instant payment", "instant", "Seconds, 24/7", 0.5, 10_000, "Aani reference", "AANI", { instant: true }),
  r("uaefts", "ae", "UAEFTS transfer", "sameDay", "Same day", 2, null, "UAEFTS reference", "UF", { cutoff: "11:00" }),
  r("sarieI", "sa", "sarie instant", "instant", "Seconds, 24/7", 0.5, 20_000, "sarie reference", "SI", { instant: true }),
  r("sarie", "sa", "SARIE transfer", "sameDay", "Same day", 2, null, "SARIE reference", "SA", { cutoff: "12:00" }),
  r("cliq", "jo", "CliQ instant payment", "instant", "Seconds, 24/7", 0.3, 10_000, "CliQ reference", "CQ", { instant: true }),
  r("jopacc", "jo", "JoPACC transfer", "standard", "Next business day", 1, null, "JoPACC reference", "JP", { businessDays: 1, cutoff: "11:00" }),
  r("swift", "intl", "International (SWIFT)", "standard", "1–3 business days", 25, null, "UETR", "", { businessDays: 3 }),
];
export const railOf = (id: string) => RAILS.find((x) => x.id === id);

/** Which rails serve each speed class in each market, in order of preference (the first that fits and is up wins). A bank overrides this in its configuration. */
export type SpeedMap = Partial<Record<SpeedClass, string[]>>;
export const DEFAULT_SPEED_MAP: Record<Market, SpeedMap> = {
  us: { standard: ["ach"], sameDay: ["sach", "wire"], instant: ["rtp"] },
  eu: { standard: ["sct"], instant: ["sinst"] },
  uk: { standard: ["bacs"], sameDay: ["chaps"], instant: ["fps"] },
  ae: { standard: ["uaefts"], sameDay: ["uaefts"], instant: ["aani"] },
  sa: { standard: ["sarie"], sameDay: ["sarie"], instant: ["sarieI"] },
  jo: { standard: ["jopacc"], instant: ["cliq"] },
  intl: { standard: ["swift"] },
};
/** The speed a payment gets when the customer does not choose: the region's default rail from 09-payment-rails.md section 2 (first that fits, else the next). */
export const DEFAULT_SPEED: Record<Market, SpeedClass> = { us: "standard", eu: "standard", uk: "instant", ae: "instant", sa: "instant", jo: "instant", intl: "standard" };

export const MARKET_CURRENCY: Record<Exclude<Market, "intl">, string> = { us: "USD", eu: "EUR", uk: "GBP", ae: "AED", sa: "SAR", jo: "JOD" };
const INTL_CURRENCY: Record<string, string> = { CA: "CAD", IN: "INR", JP: "JPY", AU: "AUD" };
export const SEPA = ["DE", "FR", "ES", "IT", "NL", "IE", "BE", "AT", "PT", "FI", "LU", "GR"];
export const IBAN_LENGTH: Record<string, number> = { DE: 22, FR: 27, ES: 24, IT: 27, NL: 18, IE: 22, BE: 16, AT: 20, PT: 25, FI: 18, LU: 20, GR: 27, AE: 23, SA: 24, JO: 30, GB: 22 };
/** Units of each currency for 1 US dollar (09-payment-rails.md section 5). No spread: the conversion is receive ÷ rate. */
export const PAYMENT_RATES: Record<string, number> = { USD: 1, EUR: 0.926, GBP: 0.781, AED: 3.672, SAR: 3.75, JOD: 0.709, CAD: 1.36, INR: 83.2, JPY: 151, AUD: 1.52 };
export const PURPOSES = ["Family support", "Goods or services", "Salary", "Rent", "Education", "Savings or investment", "Other"];
export const REFERENCE_MAX: Record<Market, number> = { us: 80, eu: 140, uk: 18, ae: 140, sa: 140, jo: 140, intl: 140 };
/** Markets where a purpose is always required (companies always need one). */
export const PURPOSE_REQUIRED_MARKETS: Market[] = ["ae", "sa", "jo", "intl"];
export const SWIFT_OUR_EXTRA = 15;
export const QUOTE_HOLD_SECONDS = 60;

export function marketOf(country: string): Market {
  const cc = String(country ?? "").toUpperCase();
  if (cc === "US") return "us";
  if (SEPA.includes(cc)) return "eu";
  if (cc === "GB") return "uk";
  if (cc === "AE") return "ae";
  if (cc === "SA") return "sa";
  if (cc === "JO") return "jo";
  if (cc in INTL_CURRENCY) return "intl";
  throw new BankError("COUNTRY_NOT_SUPPORTED", "We can't send money to that country yet");
}
export const currencyOfCountry = (country: string): string => {
  const m = marketOf(country);
  return m === "intl" ? INTL_CURRENCY[country.toUpperCase()]! : MARKET_CURRENCY[m];
};
/** The market's default country, for a bank whose home market is this one. */
export const HOME_COUNTRY: Record<Market, string> = { us: "US", eu: "DE", uk: "GB", ae: "AE", sa: "SA", jo: "JO", intl: "CA" };

/** The local identifier fields a payee form asks for in a market. The home market decides which set a domestic payee needs. */
export const LOCAL_FIELDS: Record<Market, string[]> = {
  us: ["routingNumber", "accountNumber"], eu: ["iban"], uk: ["sortCode", "accountNumber"], ae: ["iban"], sa: ["iban"], jo: ["iban"], intl: ["bic", "accountNumber"],
};

/* ------------------------------------------------------------------------------------------------ payee validation */

export type PayeeFields = { country?: string; name?: string; routingNumber?: string; accountNumber?: string; accountType?: string; sortCode?: string; iban?: string; bic?: string };
export type FieldError = { code: string; message: string };

export const clean = (s: unknown) => String(s ?? "").replace(/[\s-]/g, "").toUpperCase();
export function ibanValid(iban: string): boolean {
  const s = clean(iban);
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  const moved = s.slice(4) + s.slice(0, 4);
  let rem = 0;
  for (const ch of moved) rem = Number((String(rem) + (/[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch))) % 97;
  return rem === 1;
}
export const abaValid = (n: string) => /^[0-9]{9}$/.test(n) && (3 * (+n[0]! + +n[3]! + +n[6]!) + 7 * (+n[1]! + +n[4]! + +n[7]!) + (+n[2]! + +n[5]! + +n[8]!)) % 10 === 0;

/** Checks the identifier fields a market asks for. Returns one error per field; empty means the payee is well formed. */
export function validatePayee(f: PayeeFields): { market: Market; country: string; currency: string; errors: Record<string, FieldError>; bank?: string; masked: string } {
  const country = String(f.country ?? "").toUpperCase();
  const market = marketOf(country);
  const errors: Record<string, FieldError> = {};
  const name = String(f.name ?? "").trim();
  if (name.length < 2 || name.length > 70) errors.name = { code: "PAYEE_NAME_REQUIRED", message: "Enter the name on the account." };
  let bank: string | undefined;
  if (market === "us") {
    const rout = clean(f.routingNumber), acct = clean(f.accountNumber);
    if (!abaValid(rout)) errors.routingNumber = { code: "INVALID_ROUTING", message: "That routing number isn't valid. Check the 9 digits." };
    else bank = BANK_BY_KEY[rout];
    if (!/^[0-9]{4,17}$/.test(acct)) errors.accountNumber = { code: "INVALID_ACCOUNT", message: "An account number has 4 to 17 digits." };
  } else if (market === "uk") {
    const sort = clean(f.sortCode), acct = clean(f.accountNumber);
    if (!/^[0-9]{6}$/.test(sort)) errors.sortCode = { code: "INVALID_SORT_CODE", message: "A sort code has 6 digits, like 20-00-00." };
    else bank = BANK_BY_KEY[sort];
    if (!/^[0-9]{8}$/.test(acct)) errors.accountNumber = { code: "INVALID_ACCOUNT", message: "An account number has 8 digits." };
  } else if (market === "intl") {
    const bic = clean(f.bic), acct = String(f.accountNumber ?? "").trim();
    if (!/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic)) errors.bic = { code: "INVALID_BIC", message: "A SWIFT/BIC has 8 or 11 letters and numbers." };
    if (!/^[A-Za-z0-9 -]{6,34}$/.test(acct)) errors.accountNumber = { code: "INVALID_ACCOUNT", message: "That account number looks too short or too long." };
  } else {
    const iban = clean(f.iban), cc = iban.slice(0, 2);
    if (!ibanValid(iban) || (IBAN_LENGTH[cc] && iban.length !== IBAN_LENGTH[cc])) errors.iban = { code: "INVALID_IBAN", message: "That IBAN doesn't look right. Check each character." };
    else if (market === "eu" && !SEPA.includes(cc)) errors.iban = { code: "NOT_SEPA", message: "That IBAN can't be used for this payment. Use an international payment." };
    else if (cc !== country) errors.iban = { code: "COUNTRY_MISMATCH", message: `That IBAN starts with ${cc}, but you chose ${country}.` };
    else bank = BANK_BY_KEY[cc];
  }
  return { market, country, currency: currencyOfCountry(country), errors, bank, masked: maskPayee(market, f) };
}

const BANK_BY_KEY: Record<string, string> = { "021000021": "JPMorgan Chase", "200000": "Barclays", DE: "Commerzbank", FR: "Crédit Agricole", AE: "Emirates NBD", SA: "Al Rajhi Bank", JO: "Central Bank of Jordan" };

/** The payee as the app shows it after entry: `DE89 •••• 3000`, `20-00-00 · ••9911`, `ABA 021000021 · ••6789`, `BOTKJPJT · ••7890`. */
export function maskPayee(market: Market, f: PayeeFields): string {
  const last4 = (s: string) => `••${clean(s).slice(-4)}`;
  if (market === "us") return `ABA ${clean(f.routingNumber)} · ${last4(String(f.accountNumber ?? ""))}`;
  if (market === "uk") { const s = clean(f.sortCode); return `${s.slice(0, 2)}-${s.slice(2, 4)}-${s.slice(4, 6)} · ${last4(String(f.accountNumber ?? ""))}`; }
  if (market === "intl") return `${clean(f.bic)} · ${last4(String(f.accountNumber ?? ""))}`;
  const i = clean(f.iban);
  return `${i.slice(0, 4)} •••• ${i.slice(-4)}`;
}

/* ------------------------------------------------------------------------------------------------ name check */

export type NameCheck = { result: "match" | "close" | "none" | "na"; registeredName?: string };
/** Synthetic registry (09-payment-rails.md section 14). A key is the identifier the market checks the name against. */
const REGISTRY: Record<string, string> = {
  "021000021|123456789": "Maya Chen", "021000021|987654321": "Priya Raman",
  DE89370400440532013000: "Lena Fischer", FR1420041010050500013M02606: "Camille Dubois",
  "20000055779911": "James Whitfield",
  AE070331234567890123456: "Omar Haddad", SA0380000000608010167519: "Faisal Al-Harbi", JO94CBJO0010000000000131000302: "Rania Haddad",
};
export function registryKey(market: Market, f: PayeeFields): string | undefined {
  if (market === "us") return `${clean(f.routingNumber)}|${clean(f.accountNumber)}`;
  if (market === "uk") return clean(f.sortCode) + clean(f.accountNumber);
  if (market === "intl") return undefined;
  return clean(f.iban);
}
const words = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, "").split(" ").filter((w) => w.length > 1);
/** Match: same words. Close: at least one word in common. None: no word in common. Na: no registry entry, or a market that cannot check. */
export function checkName(market: Market, f: PayeeFields): NameCheck {
  const key = registryKey(market, f);
  const reg = key ? REGISTRY[key] : undefined;
  if (!reg) return { result: "na" };
  const a = words(String(f.name ?? "")), b = words(reg);
  if (a.join(" ") === b.join(" ")) return { result: "match", registeredName: reg };
  return { result: a.some((w) => b.includes(w)) ? "close" : "none", registeredName: reg };
}

/* ------------------------------------------------------------------------------------------------ pricing and timing */

const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const isBusinessDay = (day: string) => { const d = new Date(`${day}T00:00:00Z`).getUTCDay(); return d !== 0 && d !== 6; };
const nextBusinessDay = (ms: number) => { let t = ms; do { t += 86_400_000; } while (!isBusinessDay(dayOf(t))); return t; };
const addBusinessDays = (ms: number, n: number) => { let t = ms; for (let i = 0; i < n; i++) t = nextBusinessDay(t); return t; };

/** When money sent on this rail now arrives: instant rails at once, same-day rails today before the cut-off, otherwise on a later business day. */
export function arrival(rail: Rail, now: number): { arrivesOn: string; afterCutoff: boolean } {
  const today = dayOf(now);
  if (rail.instant) return { arrivesOn: today, afterCutoff: false };
  const d = new Date(now);
  const hhmm = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  const open = isBusinessDay(today);
  const late = !open || (rail.cutoff !== undefined && hhmm > rail.cutoff);
  // it goes out today, or on the next business day when it is late; a slower rail then adds its business days
  const start = late ? nextBusinessDay(now) : now;
  return { arrivesOn: dayOf(rail.businessDays ? addBusinessDays(start, rail.businessDays) : start), afterCutoff: late && open };
}

export type SpeedOption = {
  speed: SpeedClass; railId: string; railName: string; eta: string; fee: number; max: number | null; instant: boolean;
  /** false when the amount is above the rail's limit or the rail is down; `reason` says which */
  available: boolean; reason?: "RAIL_LIMIT" | "RAIL_NOT_AVAILABLE"; arrivesOn: string; afterCutoff: boolean;
};

export type PriceInput = { market: Market; country: string; receive: number; speed?: SpeedClass; charges?: "SHA" | "OUR" | "BEN"; now: number; down: (railId: string) => boolean; speedMap?: Partial<Record<Market, SpeedMap>> };

/** Every speed class the market offers, with the rail that would serve it for this amount, whether it can be used, and when the money arrives. */
export function speedOptions(i: PriceInput): SpeedOption[] {
  const map = { ...DEFAULT_SPEED_MAP[i.market], ...(i.speedMap?.[i.market] ?? {}) };
  const out: SpeedOption[] = [];
  for (const speed of SPEED_CLASSES) {
    const ids = map[speed];
    if (!ids?.length) continue;
    const rails = ids.map((id) => railOf(id)).filter((x): x is Rail => !!x);
    const fits = rails.filter((x) => x.max === null || i.receive <= x.max);
    const up = fits.find((x) => !i.down(x.id));
    const rail = up ?? fits[0] ?? rails[0];
    if (!rail) continue;
    const available = !!up;
    out.push({
      speed, railId: rail.id, railName: rail.name, eta: rail.eta, fee: rail.fee, max: rail.max, instant: rail.instant, available,
      ...(available ? {} : { reason: fits.length === 0 ? "RAIL_LIMIT" as const : "RAIL_NOT_AVAILABLE" as const }), ...arrival(rail, i.now),
    });
  }
  return out;
}

/** Works out the cost: converted amount in USD, the rail fee (+15 when the sender pays all SWIFT charges), and what the customer pays, to the cent. */
export function price(receive: number, currency: string, rail: Rail, charges: "SHA" | "OUR" | "BEN" | undefined) {
  const rate = PAYMENT_RATES[currency];
  if (rate === undefined) throw new BankError("CURRENCY_NOT_SUPPORTED", "We can't send that currency yet");
  const converted = roundMoney(receive / rate, "USD");
  const fee = roundMoney(rail.fee + (rail.id === "swift" && charges === "OUR" ? SWIFT_OUR_EXTRA : 0), "USD");
  return { rate, converted, fee, total: roundMoney(converted + fee, "USD") };
}

export function checkAmount(receive: number, currency: string) {
  const d = currencyInfo(currency).decimals;
  if (!(receive > 0) || Math.abs(receive * 10 ** d - Math.round(receive * 10 ** d)) > 1e-6) throw new BankError("INVALID_AMOUNT", `Enter an amount in ${currency} with at most ${d} decimal places`);
}

/** The rail's own reference for a payment, made from the sandbox sequence so a test sees the same one every time. */
export function railReference(rail: Rail, seq: number): string {
  const n = String(seq * 7919 + 100_000_000).padStart(12, "0");
  if (rail.id === "ach" || rail.id === "sach") return n.padStart(15, "0");
  if (rail.id === "swift" || rail.id === "sinst") { const h = (seq * 2654435761 >>> 0).toString(16).padStart(8, "0"); return `${h}-0000-4000-8000-${n}`; }
  if (rail.id === "sct") return `E2E${n}`;
  return `${rail.refPrefix}${rail.id === "wire" ? n.slice(-8) : n.slice(-10)}`;
}

/** The accepted characters of a payment reference are letters, digits, space and . , ' - / ( ) + : ? (09-payment-rails.md section 7). */
export const referenceValid = (s: string) => /^[A-Za-z0-9 .,'\-/()+:?]*$/.test(s);
