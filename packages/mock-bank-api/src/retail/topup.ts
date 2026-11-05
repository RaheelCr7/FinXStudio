import { money } from "./payments";

/**
 * Mobile top-up (BankWorkx, Payments): the bank's own directory of operators and their fixed amounts, and the number rules of the
 * home market. Pure functions and sandbox data (docs: mobile-topup). The names are made up. A real bank's operator network replaces
 * this behind the same adapters. The Meezan carriers (Jazz, Zong ...) and their 50 to 5,000 rule stay as they are in index.ts;
 * a BankWorkx customer gets this directory, whose amounts are in the bank's home currency.
 */
export const TOPUP_CURRENCY = "USD";
export type Operator = { id: string; name: string; amounts: number[] };
export const OPERATORS: Operator[] = [
  { id: "aster", name: "Aster Mobile", amounts: [5, 10, 20, 50] },
  { id: "bright", name: "Brightline", amounts: [10, 20, 30, 50] },
  { id: "cobalt", name: "Cobalt Wireless", amounts: [5, 10, 25, 100] },
];
/** The most that can be topped up to one number in a day, in the bank's home currency. */
export const TOPUP_NUMBER_DAILY = 300;

/** The number rule of each home market (the only thing that changes with the market). The number is checked without spaces, brackets and hyphens. */
export const MARKETS: Record<string, { rule: RegExp; message: string; sample: string }> = {
  A: { rule: /^[0-9]{10}$/, message: "Enter the 10-digit number.", sample: "5550123456" },
  B: { rule: /^07[0-9]{9}$/, message: "Enter 11 digits, starting 07.", sample: "07700900123" },
  C: { rule: /^[0-9]{8,12}$/, message: "Enter 8 to 12 digits.", sample: "15112345678" },
  D: { rule: /^05[0-9]{8}$/, message: "Enter 10 digits, starting 05.", sample: "0501234567" },
};
export const marketOf = (m: unknown) => MARKETS[String(m ?? "A").toUpperCase()] ?? MARKETS.A!;

/** A number without spaces, brackets and hyphens. */
export const normaliseNumber = (n: unknown) => String(n ?? "").replace(/[\s()-]/g, "");
export const validNumber = (market: unknown, n: string) => marketOf(market).rule.test(n);

/** The last four digits of a number choose the outcome, so a tester can reproduce every state. */
export type NumberCase = "notFound" | "unavailable" | "normal";
export function numberCase(n: string): NumberCase {
  const tail = n.slice(-4);
  return tail === "0000" ? "notFound" : tail === "1111" ? "unavailable" : "normal";
}

/** What the amount screen offers for an operator: one choice per fixed amount. */
export function amountChoices(op: Operator) {
  return Object.fromEntries(op.amounts.map((a) => [String(a), { id: String(a), amount: a, name: money(a, TOPUP_CURRENCY) }]));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** A date as it is written on a receipt: 3 Nov 2026. */
export const receiptDate = (t: number) => { const d = new Date(t); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
/** The day a top-up counts for (the daily allowance of one number is per day). */
export const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);
