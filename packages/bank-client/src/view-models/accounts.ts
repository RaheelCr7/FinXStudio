import type { Persona, Finance, Txn } from "@finx/mock-bank-api";

export type AccountItem = { id: string; name: string; bank: string; mask: string; balance: number };
export type TxnKind = "all" | "in" | "out";

/** Own accounts first, then linked banks, as one list of cards. */
export function accountItems(persona: Pick<Persona, "accounts">, fin: Pick<Finance, "linked">): AccountItem[] {
  return [
    ...persona.accounts.map((x) => ({ id: x.id, name: x.name, bank: "BankWorkx", mask: x.maskedNumber, balance: x.balance })),
    ...fin.linked.map((l) => ({ id: l.id, name: l.kind, bank: l.bank, mask: l.maskedNumber, balance: l.balance })),
  ];
}

/** Search by title and filter to money in or out. */
export function filterTransactions(txns: Txn[], query: string, kind: TxnKind): Txn[] {
  const q = query.trim().toLowerCase();
  return txns.filter((t) => (kind === "all" || (kind === "in" ? t.amount > 0 : t.amount < 0)) && t.title.toLowerCase().includes(q));
}

/** Transactions grouped by how many days ago they happened, most recent day first. */
export function groupByDay(txns: Txn[]): [number, Txn[]][] {
  const m = new Map<number, Txn[]>();
  for (const t of txns) m.set(t.daysAgo, [...(m.get(t.daysAgo) ?? []), t]);
  return [...m.entries()].sort((x, y) => x[0] - y[0]);
}
