import { evaluate } from "./expr";

export const FORMATTERS: Record<string, (v: any) => string> = {
  money: (v) => (v == null || v === "" ? "" : Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 })),
  upper: (v) => String(v ?? "").toUpperCase(),
};

/** Interpolates {{ expr | formatter }} using the safe evaluator. Missing values render as empty string. */
export function interpolate(text: string, scope: any): string {
  return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, inner: string) => {
    const [exprPart, fmt] = inner.split("|").map((s) => s.trim());
    let val: any;
    try { val = evaluate(exprPart!, scope); } catch { val = undefined; }
    if (fmt && FORMATTERS[fmt]) return FORMATTERS[fmt]!(val);
    return val == null ? "" : String(val);
  });
}

export function localize(t: string | Record<string, string> | undefined, lang: string, fallback: string): string {
  if (t == null) return "";
  if (typeof t === "string") return t;
  return t[lang] ?? t[fallback] ?? Object.values(t)[0] ?? "";
}
