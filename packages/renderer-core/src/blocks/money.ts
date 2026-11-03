import { prefixOf, symbolOf } from "@finx/ui-kit";
export { prefixOf, symbolOf };

/** The amount as typed text, with thousands separators: 12000 becomes "12,000", nothing becomes "". `decimals` is how many places the currency allows (0 by default). */
export const amountText = (value: unknown, decimals = 0) => (value ? Number(value).toLocaleString("en-US", { maximumFractionDigits: decimals }) : "");
/** Whole units from what was typed (digits only), or undefined when there are none. With `decimals`, a decimal point and that many places are kept. */
export function parseAmountText(text: string, decimals = 0): number | undefined {
  return typedAmount(text, decimals).value;
}
/**
 * What typing in an amount field does: the text to show (thousands separators in the whole part, a trailing "." kept while the person is still typing)
 * and the number it means. Extra decimal places are dropped, and a "." is ignored for a currency with no decimals.
 */
export function typedAmount(text: string, decimals = 0): { text: string; value: number | undefined } {
  const cleaned = text.replace(decimals > 0 ? /[^0-9.]/g : /[^0-9]/g, "");
  const dot = cleaned.indexOf(".");
  const whole = (dot < 0 ? cleaned : cleaned.slice(0, dot)).replace(/^0+(?=\d)/, "");
  const frac = dot < 0 ? "" : cleaned.slice(dot + 1).replace(/\./g, "").slice(0, decimals);
  const shown = (whole ? Number(whole).toLocaleString("en-US") : dot >= 0 ? "0" : "") + (dot >= 0 && decimals > 0 ? `.${frac}` : "");
  const n = Number(`${whole || "0"}${frac ? `.${frac}` : ""}`);
  return { text: shown, value: !whole && !frac ? undefined : n };
}

export type QuickAmount = { value: number; label: string; aria: string; selected: boolean };
/** The one-tap amount buttons of an amount block: what each shows, what a screen reader says, and which one is chosen. */
export const quickAmounts = (b: { quickAmounts?: number[]; currency: string; value?: unknown }): QuickAmount[] =>
  (b.quickAmounts ?? []).map((q) => ({ value: q, label: `${prefixOf(b.currency)}${q.toLocaleString("en-US", { maximumFractionDigits: 3 })}`, aria: `${prefixOf(b.currency)}${q}`, selected: Number(b.value) === q }));
