import type { HomeMarket } from "./retail/payments";
export type { HomeMarket } from "./retail/payments";
/** The markets a bank can be at home in: they decide the rails behind the domestic speed classes. */
export const HOME_MARKETS: HomeMarket[] = ["us", "uk", "eu", "ae", "sa", "jo"];

/**
 * What a bank configures besides its look (docs/journeys/10-journey-catalog.md): its home market, which journeys are switched off,
 * the options of each journey, and which rail serves each speed class. The sandbox enforces the switch; menus only reflect it.
 */
export type BankConfig = {
  /** Decides which rails serve the domestic speed classes (retail/payments.ts, DOMESTIC_RAILS). */
  homeMarket: HomeMarket;
  /** Journey slugs the bank has switched off: a call made for one is refused with JOURNEY_DISABLED. */
  disabled: string[];
  /** Per-journey options, keyed by slug (for example { "personal-transfer": { instant: false } }). */
  options: Record<string, Record<string, unknown>>;
};
export const DEFAULT_CONFIG: BankConfig = { homeMarket: "us", disabled: [], options: {} };

/** Journeys that cannot be switched off (the catalog's `core` entries). */
export const CORE_JOURNEYS = ["sign-in"];
export const journeyEnabled = (c: BankConfig, slug: string) => CORE_JOURNEYS.includes(slug) || !c.disabled.includes(slug);
