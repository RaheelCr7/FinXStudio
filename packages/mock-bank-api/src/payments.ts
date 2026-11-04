import { currencyInfo, prefixOf } from "@finx/ui-kit";

/**
 * Sending money to someone else: the rails (how fast, what it costs, how much), the purposes and the date helpers.
 * Pure functions and sandbox data (docs: payment rails reference, section 2). A real bank's rails replace this behind the same adapters.
 * Only one home market is configured (a US-style one: routing number and account, ACH, same-day ACH, RTP); the speeds have
 * the names a customer reads (Standard, Same day, Instant, Priority), never the scheme.
 */
export type SendType = "internal" | "domestic" | "international";
export type SpeedClass = "standard" | "sameDay" | "instant" | "priority";
export type RailSpec = {
  /** The rail's own id; a sandbox condition can take it down (`rail:rtp`). */
  id: string; speed: SpeedClass; name: string;
  /** What the sender pays, in the sender's currency. */
  fee: number;
  arrives: string;
  /** The most one payment can be, in the payee's currency; null: no limit the sandbox sets. */
  limit: number | null;
};

export const RAILS: Record<SendType, RailSpec[]> = {
  internal: [{ id: "internal", speed: "instant", name: "Instant", fee: 0, arrives: "In seconds", limit: 25_000 }],
  domestic: [
    { id: "ach", speed: "standard", name: "Standard", fee: 0, arrives: "1 to 2 business days", limit: 25_000 },
    { id: "sach", speed: "sameDay", name: "Same day", fee: 1, arrives: "Today", limit: null },
    { id: "rtp", speed: "instant", name: "Instant", fee: 0.25, arrives: "In seconds", limit: 500_000 },
  ],
  international: [
    { id: "swift", speed: "standard", name: "Standard", fee: 25, arrives: "1 to 3 business days", limit: null },
    { id: "swiftp", speed: "priority", name: "Priority", fee: 40, arrives: "Next business day", limit: null },
  ],
};
/** Added to the fee when the sender pays all the bank charges of an international payment (a bank option). */
export const SENDER_PAYS_ALL = 15;
/** An international payment worth this much (US dollars) needs the payee's address and the relationship. */
export const ADDRESS_RULE_USD = 10_000;
/** The speeds a bank offers; a bank switches one off with an option. Priority is off unless the bank turns it on. */
export type Offer = Record<SpeedClass, boolean>;

export const PURPOSES = ["Family support", "Goods or services", "Salary", "Rent", "Education", "Savings or investment", "Other"];
export const RELATIONSHIPS = ["Myself", "Family member", "Friend", "My employer", "Supplier or business", "Landlord", "School or university", "Other"];
export const REPEATS = ["none", "weekly", "monthly"];

/** A payee whose name contains this is held for review (sanctions screening). */
export const SANCTIONS_NAME = "test sanctions";
/** A quote for a payment in another currency holds its rate for this long. */
export const PAYMENT_QUOTE_SECONDS = 60;
/** The days offered for a later payment. */
export const SEND_DATES = 30;

/** Money with its currency's own decimals, always shown in full ($500.00, JPY 1,000), for the words of an error. */
export function money(amount: number, currency: string): string {
  const d = currencyInfo(currency).decimals;
  return `${prefixOf(currency)}${amount.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })}`;
}

export type SpeedView = RailSpec & { available: boolean; fits: boolean; reason?: string };
/**
 * Every speed of a kind of payment for this amount (in the payee's currency): offered by the bank, not taken down, and within its limit.
 * `down` are rail ids that are not working right now.
 */
export function speedsFor(type: SendType, receive: number, offer: Offer, down: string[] = [], limitsOff = false): SpeedView[] {
  return RAILS[type].filter((r) => offer[r.speed]).map((r) => {
    const available = !down.includes(r.id);
    const fits = r.limit === null || receive <= r.limit || limitsOff;
    return { ...r, available, fits, ...(!available ? { reason: "Not available right now" } : !fits ? { reason: "Over the limit" } : {}) };
  });
}

/** The line under a speed card: when it arrives, its limit and its fee. */
export function speedText(s: SpeedView, payeeCurrency: string, homeCurrency: string, chargesExtra = 0): string {
  const fee = s.fee + chargesExtra;
  return `${s.reason ?? s.arrives}${!s.reason && s.limit !== null ? ` · up to ${money(s.limit, payeeCurrency)}` : ""} · ${fee === 0 ? "Free" : money(fee, homeCurrency)}`;
}

const DAY = 86_400_000;
const WEEKDAY = (t: number) => new Date(t).getUTCDay();
const NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** The next business days after `now` (Monday to Friday, UTC), as { id: "2026-11-03", name: "Tue 3 Nov" }. */
export function businessDays(now: number, count = SEND_DATES): Record<string, { id: string; name: string }> {
  const out: Record<string, { id: string; name: string }> = {};
  let t = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate());
  while (Object.keys(out).length < count) {
    t += DAY;
    const w = WEEKDAY(t);
    if (w === 0 || w === 6) continue;
    const d = new Date(t), id = d.toISOString().slice(0, 10);
    out[id] = { id, name: `${NAMES[w]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}` };
  }
  return out;
}
