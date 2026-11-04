import { currencyInfo, roundMoney } from "@finx/ui-kit";

/** Mid-market rates for the sandbox: how many units of each currency buy 1 US dollar. A real bank's rate provider replaces this table behind the same adapters. */
export const PER_USD: Record<string, number> = { USD: 1, PKR: 278.5, AED: 3.6725, KWD: 0.3075, EUR: 0.92, GBP: 0.79, JOD: 0.709, SAR: 3.75, INR: 83.2, JPY: 151.3 };
/** What the bank keeps on the rate (0.5%), the fee on the amount sent (0.2%), and how long a quote can be used. */
export const FX_SPREAD = 0.005;
export const FX_FEE_RATE = 0.002;
export const QUOTE_TTL_SECONDS = 30;

/**
 * How a bank prices conversions: its rate table, the spread it keeps on the rate and, for the BankWorkx sandbox, small
 * steady moves of the market that a renewed quote shows. The default keeps the reference bank's 0.5% spread.
 */
export type FxConfig = {
  perUsd: Record<string, number>;
  spread: number;
  /** For the 2nd, 3rd … quote of the same pair: how far the market has moved (0.0002 is +0.02%). Empty or missing: it never moves. */
  drift?: number[];
};
export const DEFAULT_FX: FxConfig = { perUsd: PER_USD, spread: FX_SPREAD };
/** BankWorkx quotes the mid-market rate with no margin; a renewed quote moves within 0.04% either way (fixed values here, so tests repeat). */
export const BANKWORKX_FX: FxConfig = { perUsd: { ...PER_USD, EUR: 0.926, AED: 3.672 }, spread: 0, drift: [0.0002, -0.0003, 0.0004, -0.0001] };

export const fxSupports = (currency: string, cfg: FxConfig = DEFAULT_FX) => currency in cfg.perUsd;
/** Units of `to` for one unit of `from`, before the spread. */
export const midRate = (from: string, to: string, cfg: FxConfig = DEFAULT_FX): number | undefined => (fxSupports(from, cfg) && fxSupports(to, cfg) ? cfg.perUsd[to]! / cfg.perUsd[from]! : undefined);
/** The rate the customer gets: the mid rate less the spread, to six decimals. */
export const customerRate = (from: string, to: string, cfg: FxConfig = DEFAULT_FX): number | undefined => {
  const m = midRate(from, to, cfg);
  return m === undefined ? undefined : Math.round(m * (1 - cfg.spread) * 1e6) / 1e6;
};

export type Quote = {
  quoteId: string; fromAccountId: string; toAccountId: string;
  from: { currency: string; amount: number }; to: { currency: string; amount: number };
  midRate: number; rate: number; fee: number; feeCurrency: string; total: number;
  expiresAt: string; ttlSeconds: number;
};

export type PriceOptions = {
  cfg?: FxConfig;
  /** "send": the amount is in the currency that leaves (default). "get": it is what the person receives; the amount sent is worked out and rounded up to the next cent. */
  direction?: "send" | "get";
  /** How far the market has moved since the first quote, as a fraction (0.0002 is +0.02%). */
  drift?: number;
  /** The fee is not charged (a bank option). */
  feeWaived?: boolean;
};

/** Works out what converting an amount of one currency into another costs and pays, to each currency's own decimals. */
export function priceQuote(fromCurrency: string, toCurrency: string, amount: number, o: PriceOptions = {}) {
  const cfg = o.cfg ?? DEFAULT_FX;
  const mid = Math.round(midRate(fromCurrency, toCurrency, cfg)! * (1 + (o.drift ?? 0)) * 1e6) / 1e6;
  const rate = Math.round(mid * (1 - cfg.spread) * 1e6) / 1e6;
  const d = currencyInfo(fromCurrency).decimals;
  // typing what they get: the amount sent is rounded UP to the next cent (the 1e6 step keeps 500.00000000000006 from becoming 500.01)
  const send = o.direction === "get" ? Math.ceil(Math.round((amount / rate) * 10 ** d * 1e6) / 1e6) / 10 ** d : amount;
  const fee = o.feeWaived ? 0 : roundMoney(send * FX_FEE_RATE, fromCurrency);
  const receive = o.direction === "get" ? amount : roundMoney(send * rate, toCurrency);
  return { midRate: mid, rate, send, fee, receive, total: roundMoney(send + fee, fromCurrency), digits: d };
}
