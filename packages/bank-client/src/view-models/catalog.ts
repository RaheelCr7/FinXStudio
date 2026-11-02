import { slugIs, type Entry } from "../live";

/** What each known BankWorkx action is called on screen, and the icon name each platform draws for it. */
export const ACTION_META: Record<string, { icon: string; text: string }> = {
  "add-money": { icon: "dollar", text: "Top up your account from a saved card" },
  "add-card": { icon: "card", text: "Save a debit or credit card" },
  "connect-account": { icon: "bank", text: "Link an account from another bank" },
  "create-budget": { icon: "budgets", text: "Set a monthly spending limit" },
  invest: { icon: "trend", text: "Buy a stock or fund" },
  "sell-investment": { icon: "down", text: "Sell part or all of a holding" },
};
const ORDER = Object.keys(ACTION_META);
/** Which known action a journey slug is (including copies such as add-money-acme), if any. */
export const actionOf = (slug: string) => ORDER.find((k) => slugIs(slug, k));
const rank = (slug: string) => { const k = actionOf(slug); return k ? ORDER.indexOf(k) : 99; };

/** The quick-action list: known actions first in a sensible order, then anything a team adds in Studio. */
export const orderedActions = (entries: Entry[]) => [...entries].sort((x, y) => rank(x.slug) - rank(y.slug));
export const actionMeta = (slug: string) => ACTION_META[actionOf(slug) ?? ""] ?? { icon: "plus", text: "" };
/** Whether this bank has published the journey that does something (by its base name). */
export const hasAction = (entries: Entry[], base: string) => entries.some((j) => slugIs(j.slug, base));
