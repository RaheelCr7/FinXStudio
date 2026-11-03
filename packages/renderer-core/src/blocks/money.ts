import { prefixOf, symbolOf } from "@finx/ui-kit";
export { prefixOf, symbolOf };

/** The amount as typed text, with thousands separators: 12000 becomes "12,000", nothing becomes "". */
export const amountText = (value: unknown) => (value ? Number(value).toLocaleString("en-US") : "");
/** Whole units from what was typed (digits only), or undefined when there are none. */
export function parseAmountText(text: string): number | undefined {
  const n = parseInt(text.replace(/[^0-9]/g, ""), 10);
  return isNaN(n) ? undefined : n;
}

export type QuickAmount = { value: number; label: string; aria: string; selected: boolean };
/** The one-tap amount buttons of an amount block: what each shows, what a screen reader says, and which one is chosen. */
export const quickAmounts = (b: { quickAmounts?: number[]; currency: string; value?: unknown }): QuickAmount[] =>
  (b.quickAmounts ?? []).map((q) => ({ value: q, label: `${prefixOf(b.currency)}${q.toLocaleString("en-US")}`, aria: `${prefixOf(b.currency)}${q}`, selected: Number(b.value) === q }));
