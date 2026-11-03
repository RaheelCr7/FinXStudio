import { tokensOf } from "@finx/renderer-core";
import type { Journey } from "@finx/journey-schema";

/**
 * A rule as the visual editor sees it: a list of simple conditions joined by "all" or "any".
 * Anything fancier (brackets, ?:, mixed and/or) stays a text rule: parseRule gives null and the editor shows the text.
 */
export type Op = "==" | "!=" | ">" | ">=" | "<" | "<=" | "empty" | "filled" | "true" | "false";
export type Condition = { left: string; op: Op; right: string };
export type RuleModel = { join: "&&" | "||"; conditions: Condition[] };

export const OPS: { op: Op; label: string; unary?: boolean }[] = [
  { op: "==", label: "is" }, { op: "!=", label: "is not" },
  { op: ">", label: "is more than" }, { op: ">=", label: "is at least" }, { op: "<", label: "is less than" }, { op: "<=", label: "is at most" },
  { op: "empty", label: "is empty", unary: true }, { op: "filled", label: "has a value", unary: true },
  { op: "true", label: "is yes", unary: true }, { op: "false", label: "is no", unary: true },
];
export const isUnary = (op: Op) => !!OPS.find((o) => o.op === op)?.unary;

const CMP = new Set(["==", "!=", "<=", ">=", "<", ">"]);
const PATH = /^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*)*$/;

/** Reads a rule into conditions, or null when it is too complex for the visual editor. Empty text and `alwaysValue` mean no conditions. */
export function parseRule(src: string | undefined, alwaysValue?: string): RuleModel | null {
  const text = (src ?? "").trim();
  if (text === "" || text === alwaysValue) return { join: "&&", conditions: [] };
  let toks;
  try { toks = tokensOf(text).slice(0, -1); } catch { return null; }
  if (toks.some((t) => t.s == null || t.e == null)) return null;
  // split at the top-level && or || (inside brackets they belong to an operand)
  const segments: (typeof toks)[] = [[]];
  let join: "&&" | "||" | null = null, depth = 0;
  for (const t of toks) {
    if (t.t === "op" && (t.v === "(" || t.v === "[")) depth++;
    if (t.t === "op" && (t.v === ")" || t.v === "]")) depth--;
    if (depth === 0 && t.t === "op" && (t.v === "&&" || t.v === "||")) {
      if (join && join !== t.v) return null;
      join = t.v; segments.push([]); continue;
    }
    if (t.t === "op" && (t.v === "?" || t.v === ":")) return null;
    segments[segments.length - 1]!.push(t);
  }
  if (depth !== 0) return null;
  const slice = (seg: typeof toks) => text.slice(seg[0]!.s!, seg[seg.length - 1]!.e!).trim();
  const conditions: Condition[] = [];
  for (const seg of segments) {
    if (seg.length === 0) return null;
    // exactly one comparison at the top level of the segment
    let d = 0; const at: number[] = [];
    seg.forEach((t, i) => { if (t.t === "op" && (t.v === "(" || t.v === "[")) d++; else if (t.t === "op" && (t.v === ")" || t.v === "]")) d--; else if (d === 0 && t.t === "op" && CMP.has(t.v)) at.push(i); });
    if (at.length > 1) return null;
    if (at.length === 1) {
      const i = at[0]!;
      if (i === 0 || i === seg.length - 1) return null;
      conditions.push({ left: slice(seg.slice(0, i)), op: seg[i]!.v as Op, right: slice(seg.slice(i + 1)) });
      continue;
    }
    const whole = slice(seg);
    const empty = /^(!)?\s*isEmpty\((.+)\)$/.exec(whole);
    if (empty) { conditions.push({ left: empty[2]!.trim(), op: empty[1] ? "filled" : "empty", right: "" }); continue; }
    const not = /^!\s*(.+)$/.exec(whole);
    if (not && PATH.test(not[1]!.trim())) { conditions.push({ left: not[1]!.trim(), op: "false", right: "" }); continue; }
    if (PATH.test(whole) && !["true", "false", "null"].includes(whole)) { conditions.push({ left: whole, op: "true", right: "" }); continue; }
    return null;
  }
  return { join: join ?? "&&", conditions };
}

/** Turns what the person typed on the right-hand side into expression text, when they edit it: numbers, yes/no, known data paths and functions stay as they are, anything else becomes quoted text. */
export function operand(raw: string, known: Iterable<string> = []): string {
  const v = raw.trim();
  if (v === "") return '""';
  if (/^-?\d+(\.\d+)?$/.test(v) || ["true", "false", "null"].includes(v)) return v;
  if (/^(['"]).*\1$/.test(v)) return v;
  if (new Set(known).has(v) || /^[A-Za-z_$][\w$]*\(.*\)$/.test(v)) return v;
  return JSON.stringify(v);
}

/** The expression text for a model. Each right-hand side is already expression text (see `operand`). */
export function printRule(m: RuleModel, alwaysValue?: string): string {
  if (m.conditions.length === 0) return alwaysValue ?? "";
  const one = (c: Condition) => {
    const l = c.left.trim() || "value";
    switch (c.op) {
      case "empty": return `isEmpty(${l})`;
      case "filled": return `!isEmpty(${l})`;
      case "true": return l;
      case "false": return `!${/^[\w$.]+$/.test(l) ? l : `(${l})`}`;
      default: return `${l} ${c.op} ${c.right.trim() || '""'}`;
    }
  };
  return m.conditions.map(one).join(m.join === "||" ? " || " : " && ");
}

/** The same rule in plain words, for the line under the editor. */
export function describeRule(m: RuleModel, none = "Always"): string {
  if (m.conditions.length === 0) return none;
  const word = (c: Condition) => {
    const op = OPS.find((o) => o.op === c.op)!.label;
    return isUnary(c.op) ? `${c.left || "…"} ${op}` : `${c.left || "…"} ${op} ${c.right.trim() === "" ? "…" : c.right.trim().replace(/^(['"])(.*)\1$/, "$2")}`;
  };
  return m.conditions.map(word).join(m.join === "||" ? "  or  " : "  and  ");
}

/** Every data path a journey declares, for the pick lists. */
export function knownPaths(j: Journey): string[] {
  const out = new Set<string>(Object.keys(j.dataModel ?? {}));
  const collect = (actions: any[] | undefined) => {
    for (const a of actions ?? []) {
      if (a?.type === "callApi" && a.saveAs) out.add(a.saveAs);
      if (a?.type === "setData" && a.path) out.add(a.path);
    }
  };
  for (const s of j.screens) {
    collect(s.onEnter);
    for (const b of s.blocks as any[]) { if (b.type === "button") collect(b.actions); if (b.type === "otp") collect(b.onResend); if (b.type === "dialog") { b.buttons.forEach((x: any) => collect(x.actions)); collect(b.dismiss); } if (b.type === "map") collect(b.onSelect); }
  }
  return [...out].sort();
}

/** Turns what someone typed in a test box into a value the rule can use: numbers, yes/no, or text. */
export function sampleValue(raw: string): unknown {
  const v = raw.trim();
  if (v === "") return undefined;
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}
