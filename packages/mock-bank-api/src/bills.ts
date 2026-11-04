import { money } from "./payments";

/**
 * Paying a bill (BankWorkx, Payments): the bank's own directory of billers and the rules that read a reference. Pure functions and
 * sandbox data in whole cents (docs: pay-bill). The names are made up. A real bank's biller network replaces this behind the same adapters.
 * The Meezan-flavoured BILLERS in index.ts stay as they are for the Meezan journey; a BankWorkx customer gets this directory.
 */
export const BILL_CURRENCY = "USD";
export const BILLER_CATEGORIES = ["Electricity", "Water", "Gas", "Internet and phone", "Mobile top-up", "Insurance", "Credit card", "Loan", "Tax and government", "Education", "Other"] as const;
/** The categories where "Pay automatically" is offered (a bill that comes back every month). */
export const AUTOPAY_CATEGORIES: readonly string[] = ["Electricity", "Water", "Gas", "Internet and phone", "Insurance", "Credit card", "Loan"];
/** The reference formats: n digits, or "HI" and 8 digits. */
export type BillerFormat = "d8" | "d10" | "d12" | "d16" | "hi8";
/** What may be paid: "any" amount up to the amount due, the "full" amount only, or the full amount, the "minimum" or another amount. */
export type Accepts = "any" | "full" | "minimum";
export type Biller = {
  id: string; name: string; category: string; label: string; format: BillerFormat; accepts: Accepts;
  /** What the biller charges for a payment, in the bill's currency. */
  fee: number;
  /** The most that can be paid, as a multiple of the amount due. */
  maxFactor: number;
  /** A reference that works in the sandbox. */
  sample: string;
};

const b = (id: string, name: string, category: string, label: string, format: BillerFormat, sample: string, accepts: Accepts = "any", fee = 0, maxFactor = 1): Biller => ({ id, name, category, label, format, accepts, fee, maxFactor, sample });
export const BANKWORKX_BILLERS: Biller[] = [
  b("city_power", "City Power", "Electricity", "Account number", "d10", "4400123456"),
  b("metro_water", "Metro Water", "Water", "Account number", "d10", "3300456712"),
  b("summit_gas", "Summit Gas", "Gas", "Account number", "d10", "2200789012"),
  b("skyline_broadband", "Skyline Broadband", "Internet and phone", "Account number", "d10", "5550012345"),
  b("clearwave_telecom", "ClearWave Telecom", "Internet and phone", "Phone number", "d10", "5550987654", "any", 1),
  b("northline_mobile", "Northline Mobile", "Mobile top-up", "Mobile number", "d10", "5550123456"),
  b("harbor_insurance", "Harbor Insurance", "Insurance", "Policy number", "hi8", "HI12345678", "full"),
  b("pioneer_life", "Pioneer Life", "Insurance", "Policy number", "d10", "6600123478", "full"),
  b("northwind_card", "Northwind Card", "Credit card", "Card number", "d16", "1234567890123456", "minimum", 0, 1.8),
  b("crest_card", "Crest Card", "Credit card", "Card number", "d16", "1234567890124567", "minimum", 0, 1.8),
  b("lakeside_home_loans", "Lakeside Home Loans", "Loan", "Loan number", "d10", "7700123456", "minimum", 2),
  b("county_revenue", "County Revenue", "Tax and government", "Reference number", "d12", "123456781234", "full"),
  b("city_council", "City Council", "Tax and government", "Reference number", "d10", "8800123456", "full"),
  b("westbrook_university", "Westbrook University", "Education", "Student number", "d8", "20261234"),
  b("greenfield_school", "Greenfield School", "Education", "Student number", "d8", "20265678", "any", 0.5),
  b("riverside_club", "Riverside Community Club", "Other", "Member number", "d8", "30123456"),
];

/** A reference without spaces and hyphens, in capitals. */
export const normaliseRef = (ref: unknown) => String(ref ?? "").replace(/[\s-]/g, "").toUpperCase();
const FORMAT: Record<BillerFormat, RegExp> = { d8: /^[0-9]{8}$/, d10: /^[0-9]{10}$/, d12: /^[0-9]{12}$/, d16: /^[0-9]{16}$/, hi8: /^HI[0-9]{8}$/ };
export const validRef = (biller: Biller, ref: string) => FORMAT[biller.format].test(ref);

const DAY = 86_400_000;
const NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** A date as a person reads it: Thu 12 Nov. */
export const dayLabel = (t: number) => { const d = new Date(t); return `${NAMES[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };
const startOfDay = (t: number) => { const d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); };

/** The last four digits of a reference choose the outcome, so a tester can reproduce every state. */
export type BillCase = "unavailable" | "notFound" | "paid" | "none" | "overdue" | "changing" | "normal";
export function billCase(ref: string): BillCase {
  switch (ref.replace(/\D/g, "").slice(-4)) {
    case "1111": return "unavailable";
    case "0000": return "notFound";
    case "9999": return "paid";
    case "5555": return "none";
    case "7777": return "overdue";
    case "3333": return "changing";
    default: return "normal";
  }
}

/** The bill a reference stands for, before anything was paid on it, in cents. */
export function billOf(ref: string, now: number) {
  const n = Number(BigInt(ref.replace(/\D/g, "")) % 9000n);
  const base = (1000 + n) * 5; // (1000 + number mod 9000) / 20 dollars
  const kind = billCase(ref);
  const lateFee = kind === "overdue" ? Math.round(base * 0.05) : 0;
  const dueDate = startOfDay(now) + (kind === "overdue" ? -9 : (n % 20) + 3) * DAY;
  return { dueCents: base + lateFee, lateFeeCents: lateFee, late: kind === "overdue", dueDate };
}
/** The amount due goes up by this much, once, when the bill is checked on the review (reference ending 3333). */
export const RAISE_CENTS = 1200;

/** The smallest payment of a card or a loan: the smaller of the amount due and the larger of 10% of it and 10.00. */
export const minimumCents = (dueCents: number) => Math.min(dueCents, Math.max(Math.round(dueCents * 0.1), 1000));
/** What may be paid on a bill whose amount due (what is left) is `dueCents`, in cents. */
export function limitsOf(biller: Biller, dueCents: number) {
  return {
    min: biller.accepts === "minimum" ? minimumCents(dueCents) : biller.accepts === "full" ? dueCents : 1,
    max: biller.accepts === "full" ? dueCents : Math.round(dueCents * biller.maxFactor),
  };
}
/** The choices the amount screen offers: the full amount always, the minimum and another amount where the biller takes them and `allowPartial` is on. */
export function choicesOf(biller: Biller, dueCents: number, allowPartial: boolean) {
  const { min, max } = limitsOf(biller, dueCents), c = (cents: number) => money(cents / 100, BILL_CURRENCY);
  const out: Record<string, { id: string; name: string; sub: string }> = { full: { id: "full", name: "Pay full amount", sub: c(dueCents) } };
  if (!allowPartial || biller.accepts === "full") return out;
  if (biller.accepts === "minimum") out.min = { id: "min", name: "Pay minimum", sub: c(min) };
  out.other = { id: "other", name: "Other amount", sub: biller.accepts === "minimum" ? `From ${c(min)} to ${c(max)}` : `Up to ${c(max)}` };
  return out;
}

/** The reference rule as the person is told it. */
export const refMessage = (biller: Biller) => (biller.format === "hi8" ? "Enter HI followed by 8 digits." : `Enter ${biller.format.slice(1)} digits.`);

/** The monthly entry that "Pay automatically" makes: a month after the due date, on a business day, never more than 1.5 times the amount due rounded up to 10. */
export function autopayPlan(dueDate: number, dueCents: number) {
  const d = new Date(dueDate);
  // the same day next month, or the last day of a shorter month
  let t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, Math.min(d.getUTCDate(), new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 2, 0)).getUTCDate()));
  while ([0, 6].includes(new Date(t).getUTCDay())) t += DAY;
  const cap = Math.ceil((dueCents * 1.5) / 100 / 10) * 10;
  return { first: t, firstText: dayLabel(t), cap };
}
