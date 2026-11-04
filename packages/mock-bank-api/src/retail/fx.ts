import { currencyInfo, roundMoney } from "@finx/ui-kit";

/** Mid-market rates for the sandbox: how many units of each currency buy 1 US dollar. A real bank's rate provider replaces this table behind the same adapters. */
export const PER_USD: Record<string, number> = { USD: 1, PKR: 278.5, AED: 3.6725, KWD: 0.3075, EUR: 0.92, GBP: 0.79, JOD: 0.709, SAR: 3.75, INR: 83.2, JPY: 151.3 };
/** What the bank keeps on the rate (0.5%), the fee on the amount sent (0.2%), and how long a quote can be used. */
export const FX_SPREAD = 0.005;
export const FX_FEE_RATE = 0.002;
export const QUOTE_TTL_SECONDS = 30;

export const fxSupports = (currency: string) => currency in PER_USD;
/** Units of `to` for one unit of `from`, before the spread. */
export const midRate = (from: string, to: string): number | undefined => (fxSupports(from) && fxSupports(to) ? PER_USD[to]! / PER_USD[from]! : undefined);
/** The rate the customer gets: the mid rate less the spread, to six decimals. */
export const customerRate = (from: string, to: string): number | undefined => {
  const m = midRate(from, to);
  return m === undefined ? undefined : Math.round(m * (1 - FX_SPREAD) * 1e6) / 1e6;
};

export type Quote = {
  quoteId: string; fromAccountId: string; toAccountId: string;
  from: { currency: string; amount: number }; to: { currency: string; amount: number };
  midRate: number; rate: number; fee: number; feeCurrency: string; total: number;
  expiresAt: string; ttlSeconds: number;
};

/** Works out what converting `amount` of one currency into another costs and pays, to each currency's own decimals. */
export function priceQuote(fromCurrency: string, toCurrency: string, amount: number) {
  const mid = midRate(fromCurrency, toCurrency)!, rate = customerRate(fromCurrency, toCurrency)!;
  const fee = roundMoney(amount * FX_FEE_RATE, fromCurrency);
  const receive = roundMoney(amount * rate, toCurrency);
  return { midRate: Math.round(mid * 1e6) / 1e6, rate, fee, receive, total: roundMoney(amount + fee, fromCurrency), digits: currencyInfo(fromCurrency).decimals };
}
