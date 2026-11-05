import { formatMoney, fromMinor, toMinor } from "@finx/ui-kit";

/** The raw lists the sandbox answers with: an object keyed by id. */
export const listOf = <T>(keyed: Record<string, T> | undefined | null): T[] => Object.values(keyed ?? {});

/** Sums amounts in one currency without float drift: through minor units. */
export const sumMoney = (amounts: number[], currency: string) => fromMinor(amounts.reduce((t, a) => t + toMinor(a, currency), 0), currency);

// ---- Personal -----------------------------------------------------------------------------------------------------
export type RawAccount = { id: string; name: string; maskedNumber: string; balance: number; available?: number; currency: string; status?: string; kind?: string };
export type RawBudget = { id: string; name: string; category: string; limit: number; spent: number };
export type RawSchedule = { id: string; name?: string; text?: string; amount?: number; currency?: string; nextRunOn?: string; status?: string };
export type RawActivity = { id: string; title: string; category: string; amount: number; daysAgo: number };

export type MoneyLine = { label: string; value: string };
export type PersonalHome = {
  hero: { currency: string; total: string; label: string; others: MoneyLine[] };
  accounts: { id: string; name: string; masked: string; balance: string; kind: string; currency: string }[];
  insights: { id: string; name: string; spent: string; limit: string; pct: number; over: boolean }[];
  upcoming: { id: string; title: string; amount: string; when: string }[];
  recent: { id: string; title: string; amount: string; incoming: boolean; daysAgo: number }[];
};

/** The Personal home: the balance in the main currency, the others beneath it, then accounts, budgets, upcoming payments and recent activity. Empty lists stay empty (the screen shows its empty state). */
export function personalHome(input: { accounts: RawAccount[]; budgets?: RawBudget[]; schedules?: RawSchedule[]; activity?: RawActivity[] }): PersonalHome {
  const accounts = input.accounts.filter((a) => a.status !== "closed");
  const main = accounts[0]?.currency ?? "USD";
  const currencies = [...new Set(accounts.map((a) => a.currency))];
  const totalIn = (c: string) => sumMoney(accounts.filter((a) => a.currency === c).map((a) => a.balance), c);
  return {
    hero: { currency: main, total: formatMoney(totalIn(main), main), label: "Total balance", others: currencies.filter((c) => c !== main).map((c) => ({ label: c, value: formatMoney(totalIn(c), c) })) },
    accounts: accounts.map((a) => ({ id: a.id, name: a.name, masked: a.maskedNumber, balance: formatMoney(a.balance, a.currency), kind: a.kind ?? "current", currency: a.currency })),
    insights: (input.budgets ?? []).map((b) => ({ id: b.id, name: b.name, spent: formatMoney(b.spent, main), limit: formatMoney(b.limit, main), pct: b.limit > 0 ? Math.min(100, Math.round((b.spent / b.limit) * 100)) : 0, over: b.spent > b.limit })),
    upcoming: (input.schedules ?? []).filter((s) => s.status !== "cancelled" && s.amount !== undefined).slice(0, 3).map((s) => ({ id: s.id, title: s.name ?? "Payment", amount: formatMoney(s.amount!, s.currency ?? main), when: s.nextRunOn ?? s.text ?? "" })),
    recent: (input.activity ?? []).slice(0, 5).map((t) => ({ id: t.id, title: t.title, amount: formatMoney(Math.abs(t.amount), main), incoming: t.amount > 0, daysAgo: t.daysAgo })),
  };
}

// ---- Business -----------------------------------------------------------------------------------------------------
export type RawCorpAccount = { id: string; name: string; maskedNumber: string; currency: string; balance: number };
export type RawCorpPayment = {
  id: string; payee?: string; amount: number; currency: string; reference?: string; status: string; initiatedBy: string; initiatedAt: string;
  required: number; approvals: { userId: string; at: string }[]; valueDate?: string; afterCutoff?: boolean;
};
export type ApprovalItem = {
  id: string; payee: string; amount: string; reference: string; status: string;
  /** "1 of 2": approvals given out of the approvals needed. */
  progress: string;
  /** The person can approve it: they hold the permission, did not start it and have not approved it yet. */
  approvable: boolean;
  /** The person started it. */
  own: boolean;
};

/** The approvals queue. Separation of duties shows here too (nobody approves what they started), though the sandbox enforces it. */
export function approvalQueue(payments: RawCorpPayment[], userId: string, mayApprove: boolean): ApprovalItem[] {
  return payments.filter((p) => p.status === "pending_approval").sort((a, b) => Date.parse(a.initiatedAt) - Date.parse(b.initiatedAt)).map((p) => {
    const own = p.initiatedBy === userId, done = p.approvals.some((a) => a.userId === userId);
    return {
      id: p.id, payee: p.payee ?? "Payment", amount: formatMoney(p.amount, p.currency), reference: p.reference ?? "", status: p.status,
      progress: `${p.approvals.length} of ${p.required}`, own, approvable: mayApprove && !own && !done,
    };
  });
}
/** How many the badge on Approvals counts: the ones this person can act on (a Maker sees their own in the list but is not asked to act). */
export const approvalBadge = (queue: ApprovalItem[]) => queue.filter((i) => i.approvable).length;

export type BusinessOverview = {
  currency: string;
  balances: { id: string; name: string; masked: string; balance: string; currency: string }[];
  /** Total of the accounts in the company's own currency. */
  total: string;
  /** Other currencies, kept apart: never added to the total. */
  others: MoneyLine[];
  cutoff: string;
  queue: ApprovalItem[];
  limit: { used: string; daily: string; pct: number } | null;
};

export function businessOverview(input: { currency: string; accounts: RawCorpAccount[]; cutoff: string; queue: ApprovalItem[]; me?: { dailyLimit: number; usedToday: number } }): BusinessOverview {
  const { currency } = input;
  const inOwn = input.accounts.filter((a) => a.currency === currency);
  const others = [...new Set(input.accounts.filter((a) => a.currency !== currency).map((a) => a.currency))]
    .map((c) => ({ label: c, value: formatMoney(sumMoney(input.accounts.filter((a) => a.currency === c).map((a) => a.balance), c), c) }));
  const me = input.me;
  return {
    currency, total: formatMoney(sumMoney(inOwn.map((a) => a.balance), currency), currency), others, cutoff: input.cutoff, queue: input.queue,
    balances: input.accounts.map((a) => ({ id: a.id, name: a.name, masked: a.maskedNumber, balance: formatMoney(a.balance, a.currency), currency: a.currency })),
    limit: me && me.dailyLimit > 0 ? { used: formatMoney(me.usedToday, currency), daily: formatMoney(me.dailyLimit, currency), pct: Math.min(100, Math.round((me.usedToday / me.dailyLimit) * 100)) } : null,
  };
}
