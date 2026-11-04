import { BankError } from "./errors";
import { DEFAULT_SPEED, PURPOSES, PURPOSE_REQUIRED_MARKETS, REFERENCE_MAX, SPEED_CLASSES, checkAmount, price, railOf, referenceValid, speedOptions, type Market, type SpeedClass, type SpeedMap, type SpeedOption } from "./rails";

/** What a person or a company types on the amount screen, once the payee is known. */
export type QuoteRequest = {
  payee: { name: string; market: Market; country: string; currency: string };
  /** What the payee receives, in the payee's currency. */
  receive: number;
  speed?: SpeedClass; charges?: "SHA" | "OUR" | "BEN"; purpose?: string; reference?: string;
  /** Companies always give a purpose and a reference (invoice or PO number). */
  company?: boolean;
  now: number; down: (railId: string) => boolean; speedMap?: Partial<Record<Market, SpeedMap>>;
};

const money = (n: number, cur: string) => `${cur} ${n.toLocaleString("en-US")}`;

/**
 * The checks and prices both kinds of payment share: amount, purpose, reference, the rail for the chosen speed (the next that fits
 * when the first is too small, the next that is up when it is down) and what it costs. Funds, limits and approval are the caller's.
 */
export function buildQuote(q: QuoteRequest) {
  const { payee } = q;
  checkAmount(q.receive, payee.currency);
  const needsPurpose = q.company || PURPOSE_REQUIRED_MARKETS.includes(payee.market);
  if (needsPurpose && !PURPOSES.includes(String(q.purpose ?? ""))) throw new BankError("PURPOSE_REQUIRED", "Choose a purpose for this payment.");
  const reference = String(q.reference ?? "");
  if (q.company && !reference.trim()) throw new BankError("REFERENCE_REQUIRED", "Enter an invoice or PO number.");
  if (reference.length > REFERENCE_MAX[payee.market]) throw new BankError("REFERENCE_TOO_LONG", `A reference can have up to ${REFERENCE_MAX[payee.market]} characters.`);
  if (!referenceValid(reference)) throw new BankError("INVALID_REFERENCE", "A reference can use letters, numbers, spaces and . , ' - / ( ) + : ?");

  const options = speedOptions({ market: payee.market, country: payee.country, receive: q.receive, now: q.now, down: q.down, charges: q.charges, speedMap: q.speedMap });
  if (!options.length) throw new BankError("RAIL_NOT_AVAILABLE", "That isn't available right now. Choose another way to send it.");
  let chosen: SpeedOption | undefined;
  if (q.speed) {
    if (!SPEED_CLASSES.includes(q.speed)) throw new BankError("RAIL_NOT_AVAILABLE", "That isn't available right now. Choose another way to send it.");
    chosen = options.find((o) => o.speed === q.speed);
    if (!chosen) throw new BankError("RAIL_NOT_AVAILABLE", "That isn't available for this payee. Choose another way to send it.");
    if (!chosen.available) {
      if (chosen.reason === "RAIL_LIMIT") throw new BankError("RAIL_LIMIT", `That's over the ${chosen.railName} limit of ${money(chosen.max!, payee.currency)}. Choose another way to send it.`);
      throw new BankError("RAIL_NOT_AVAILABLE", `${chosen.railName} isn't available right now. Choose another way to send it.`);
    }
  } else {
    // the region's default, else the first speed that works
    chosen = options.find((o) => o.speed === DEFAULT_SPEED[payee.market] && o.available) ?? options.find((o) => o.available);
    if (!chosen) {
      const big = options.every((o) => o.reason === "RAIL_LIMIT");
      throw new BankError(big ? "RAIL_LIMIT" : "RAIL_NOT_AVAILABLE", big ? "That's over the limit for this payment. Choose a smaller amount." : "That isn't available right now. Choose another way to send it.");
    }
  }
  const rail = railOf(chosen.railId)!;
  const charges = payee.market === "intl" ? q.charges ?? "SHA" : undefined;
  return { ...price(q.receive, payee.currency, rail, charges), rail, option: chosen, options, charges, reference };
}
