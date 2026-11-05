import { formatMoney } from "@finx/ui-kit";
import { evaluate } from "./expr";

export const FORMATTERS: Record<string, (v: any, arg?: string) => string> = {
  /** A plain number with thousands separators. With a currency ({{ amount | money:JOD }}) it is that currency's own money: symbol, its decimals (JPY 0, JOD 3). */
  money: (v, currency) => (v == null || v === "" ? "" : currency ? formatMoney(Number(v), currency) : Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 })),
  /** Always two decimals, for prices: 184.2 becomes 184.20. */
  money2: (v, currency) => (v == null || v === "" ? "" : currency ? formatMoney(Number(v), currency, "en-US", undefined, true) : Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })),
  /** A date and time for a person: 03/30/2026 12:50 PM, in the device's time zone. */
  datetime: (v) => { const d = v ? new Date(v) : null; return d && !isNaN(d.getTime()) ? `${d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })} ${d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}` : ""; },
  /** A saved date (YYYY-MM-DD) as a person writes it: 01 / 01 / 2001. */
  date: (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v ?? "")); return m ? `${m[3]} / ${m[2]} / ${m[1]}` : v == null ? "" : String(v); },
  upper: (v) => String(v ?? "").toUpperCase(),
};

/**
 * The expression of a value that is exactly one {{ expression }} (trimmed), or null. Plain string handling, not a pattern with
 * overlapping parts, so a journey full of braces and spaces cannot make it slow.
 */
export function wholeExpression(v: unknown): string | null {
  if (typeof v !== "string" || !v.startsWith("{{") || !v.endsWith("}}") || v.length < 5) return null;
  const inner = v.slice(2, -2);
  if (inner.includes("}")) return null;
  return inner.trim() || null;
}

/** Interpolates {{ expr | formatter }} using the safe evaluator. Missing values render as empty string. */
export function interpolate(text: string, scope: any): string {
  return text.replace(/\{\{([^}]*)\}\}/g, (match, raw: string) => {
    const inner = raw.trim();
    if (!inner) return match;
    const [exprPart, fmtPart] = inner.split("|").map((s) => s.trim());
    const [fmt, argPart] = (fmtPart ?? "").split(":").map((s) => s.trim());
    let val: any;
    try { val = evaluate(exprPart!, scope); } catch { val = undefined; }
    if (fmt && FORMATTERS[fmt]) {
      // the currency is a code (JOD) or a path to one ({{ amount | money:account.currency }})
      let arg = argPart;
      if (arg && !/^[A-Z]{3,4}$/.test(arg)) { try { arg = String(evaluate(arg, scope) ?? ""); } catch { arg = ""; } }
      return FORMATTERS[fmt]!(val, arg || undefined);
    }
    return val == null ? "" : String(val);
  });
}

export function localize(t: string | Record<string, string> | undefined, lang: string, fallback: string): string {
  if (t == null) return "";
  if (typeof t === "string") return t;
  return t[lang] ?? t[fallback] ?? Object.values(t)[0] ?? "";
}
