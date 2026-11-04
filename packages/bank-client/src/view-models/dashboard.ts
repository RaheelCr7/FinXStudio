import type { Finance, Persona, Txn, Budget, Subscription } from "@finx/mock-bank-api";

export type Filter = "all" | "income" | "expense";

/** The customer's name without the sandbox note in brackets: "Alex Morgan (...)" becomes "Alex Morgan". */
export const displayName = (persona: Pick<Persona, "name">) => persona.name.split(" (")[0] ?? persona.name;
export const firstName = (persona: Pick<Persona, "name">) => persona.name.split(" ")[0] ?? "";
export const initials = (persona: Pick<Persona, "name">) => persona.name.split(" ").map((x) => x[0]).slice(0, 2).join("");

/** Everything the customer has: own accounts plus linked banks, leaving out credit lines. */
export function totalBalance(persona: Pick<Persona, "accounts">, fin: Pick<Finance, "linked" | "currency">): number {
  // balances are added up in the app's currency only: an account in another currency is never added to them
  return persona.accounts.filter((x) => x.currency === fin.currency).reduce((s, x) => s + x.balance, 0) + fin.linked.reduce((s, x) => s + (x.kind === "Credit" ? 0 : x.balance), 0);
}
export const hasAccounts = (persona: Pick<Persona, "accounts">, fin: Pick<Finance, "linked">) => persona.accounts.length + fin.linked.length > 0;

/** The dashboard's recent transactions, filtered to money in or out. */
export function recentTransactions(txns: Txn[], filter: Filter, limit = 4): Txn[] {
  return txns.filter((t) => filter === "all" || (filter === "income" ? t.amount > 0 : t.amount < 0)).slice(0, limit);
}
export const transactionsTitle = (filter: Filter) => (filter === "all" ? "Transactions" : filter === "income" ? "Money in" : "Money out");

export type Tone = "ok" | "warn" | "over";
/** How far through a monthly budget the customer is, and what to say about it. */
export function budgetProgress(b: Pick<Budget, "limit" | "spent">): { pct: number; tone: Tone; message: string } {
  const pct = b.limit ? b.spent / b.limit : 0;
  return {
    pct, tone: pct < 0.6 ? "ok" : pct < 0.9 ? "warn" : "over",
    message: pct < 0.6 ? "Good job! Your spending is on track." : pct < 0.9 ? "Careful, you have used most of this budget." : "Almost at your limit this month.",
  };
}
/** The icon a budget card shows, by what the budget is called. */
export const budgetIcon = (name: string): "food" | "bag" | "repeat" => (name.startsWith("Food") ? "food" : name.startsWith("Shop") ? "bag" : "repeat");

/** The spending ring: category totals and their sum (never zero, so shares can be worked out). */
export function spendingSegments(fin: Pick<Finance, "spendingByCategory">) {
  const total = fin.spendingByCategory.reduce((s, x) => s + x.value, 0) || 1;
  return { total, segments: fin.spendingByCategory.map((s) => ({ label: s.label, value: s.value, share: s.value / total })) };
}

export const subscriptionsDue = (subs: Subscription[], withinDays: number) => subs.filter((s) => s.nextInDays <= withinDays);

export type Notice = { icon: "budgets" | "repeat" | "check"; text: string; tone: "negative" | "accent" | "positive" };
/** What the bell lists: budgets nearly used up and subscriptions about to renew, or a note that all is quiet. */
export function notifications(fin: Pick<Finance, "budgets" | "subscriptions"> | undefined, money: (n: number) => string): Notice[] {
  const out: Notice[] = [];
  for (const b of fin?.budgets ?? []) if (b.limit && b.spent / b.limit >= 0.9) out.push({ icon: "budgets", text: `${b.name} budget is ${Math.round((b.spent / b.limit) * 100)}% used`, tone: "negative" });
  for (const s of fin?.subscriptions ?? []) if (s.nextInDays <= 5) out.push({ icon: "repeat", text: `${s.name} renews in ${s.nextInDays} days (${money(s.amount)})`, tone: "accent" });
  if (out.length === 0) out.push({ icon: "check", text: "You're all caught up.", tone: "positive" });
  return out;
}
