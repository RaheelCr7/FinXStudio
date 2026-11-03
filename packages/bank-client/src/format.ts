import { formatMoney, isRtlLanguage } from "@finx/ui-kit";

/** Money as the BankWorkx screens show it: whole dollars when there are no cents ($1,200), the way the design reads. */
export const usd = (n: number) => formatMoney(n, "USD");
/** Money with cents always shown ($1,200.00). */
export const usd2 = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

/** $1.2K for a thousand and over, whole dollars below. */
export const compactMoney = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(1).replace(/\.0$/, "")}K` : `$${Math.round(n)}`);
/** +$12.50 or -$12.50, using the given money formatter. */
export const signedMoney = (n: number, money: (n: number) => string) => `${n >= 0 ? "+" : "-"}${money(Math.abs(n))}`;
/** +1.78% or -0.52%, from a fraction. */
export const pctText = (fraction: number) => `${fraction >= 0 ? "+" : "-"}${Math.abs(fraction * 100).toFixed(2)}%`;

const DAY = 86_400_000;
/** Today, Yesterday, then a short date such as "Fri, 30 Oct". `now` can be given for tests. */
export function dayLabel(daysAgo: number, now: number = Date.now()): string {
  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  return new Date(now - daysAgo * DAY).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
}
/** A date a number of days from now, such as "6 Nov". */
export const inDays = (n: number, now: number = Date.now()) => new Date(now + n * DAY).toLocaleDateString("en-US", { day: "numeric", month: "short" });

/** Does this language read right to left? Arabic, Urdu, Persian and Hebrew do (the language list is in @finx/ui-kit). */
export const isRtl = (lang: string) => isRtlLanguage(lang);
