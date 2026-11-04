import type { Market, SpeedMap } from "./rails";

/**
 * What a bank configures besides its look (docs/journeys/10-journey-catalog.md): its home market, which journeys are switched off,
 * the options of each journey, and which rail serves each speed class. The sandbox enforces the switch; menus only reflect it.
 */
export type BankConfig = {
  /** Decides which local identifiers a form asks for and which payees are domestic. */
  homeMarket: Market;
  /** Journey slugs the bank has switched off: a call made for one is refused with JOURNEY_DISABLED. */
  disabled: string[];
  /** Per-journey options, keyed by slug (for example { "personal-transfer": { instant: false } }). */
  options: Record<string, Record<string, unknown>>;
  /** Overrides of the default speed mapping, per payee market. */
  speedMap?: Partial<Record<Market, SpeedMap>>;
};
export const DEFAULT_CONFIG: BankConfig = { homeMarket: "us", disabled: [], options: {} };

/** Journeys that cannot be switched off (the catalog's `core` entries). */
export const CORE_JOURNEYS = ["sign-in"];
export const journeyEnabled = (c: BankConfig, slug: string) => CORE_JOURNEYS.includes(slug) || !c.disabled.includes(slug);
