import type { Persona } from "@finx/mock-bank-api";
import type { Entry } from "../live";

/** The Meezan home screen: first account, daily limit and the status of the services list. */
export function homeView(persona: Persona, catalog: { entries: Entry[]; source: "studio" | "bundled" }) {
  const first = persona.accounts[0];
  return {
    account: first, hasAccounts: persona.accounts.length > 0,
    limit: { used: persona.limits.usedToday, daily: persona.limits.daily },
    sourcePill: catalog.source === "studio" ? { tone: "positive" as const, text: `Live from Studio · ${catalog.entries.length} journeys` } : { tone: "warning" as const, text: "Offline copies" },
  };
}
/** The sign-in screen line under a customer's name. */
export const personaSummary = (p: Persona, money: (n: number) => string) => (p.accounts.length ? `${p.accounts.length} account(s) · daily limit ${money(p.limits.daily)}` : "No accounts (KYC rejected)");
