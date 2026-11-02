import { formatMoney } from "@finx/ui-kit";

export const initialsOf = (name: string) => name.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();

export type PickerRow = { id: string; label: string; title: string; sub?: string; avatar: string; round: boolean; selected: boolean };

/** Accounts as radio rows: name and masked number, with the balance when the block asks for it. */
export function accountRows(b: { items: any[]; value?: unknown; showBalance?: boolean }): PickerRow[] {
  return b.items.map((a) => ({
    id: a.id, label: `${a.name} ${a.maskedNumber}`, title: `${a.name} ${a.maskedNumber}`, sub: b.showBalance ? formatMoney(a.balance, a.currency) : undefined,
    avatar: String(a.name).slice(0, 2).toUpperCase(), round: false, selected: b.value === a.id,
  }));
}

/** Saved beneficiaries as radio rows: name, then bank and masked number. */
export function beneficiaryRows(b: { items: any[]; value?: unknown }): PickerRow[] {
  return b.items.map((x) => ({ id: x.id, label: x.displayName, title: x.displayName, sub: `${x.bank} · ${x.maskedNumber}`, avatar: initialsOf(x.displayName), round: true, selected: b.value === x.id }));
}

export type Choice = { id: string; name: string; sub?: string; icon?: string; color?: string; letter: string; selected: boolean };
/** The options of a select block, as chips or tiles. */
export function selectChoices(b: { items: { id: string; name: string; sub?: string; icon?: string; color?: string }[]; value?: unknown; variant?: string }): { tiles: boolean; choices: Choice[] } {
  return { tiles: b.variant === "tiles", choices: b.items.map((o) => ({ ...o, letter: o.name.slice(0, 1), selected: b.value === o.id })) };
}
