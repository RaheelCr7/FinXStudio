import { BankError } from "../errors";

/**
 * The mapping layer: a declarative file that turns the bank-neutral shapes a journey uses into one bank's API calls and back,
 * including the translation of that bank's error codes. A journey never sees a bank's field names; a new bank is a new mapping
 * file (and adapter), not a new journey. Pure data in, pure data out: no code per bank.
 *
 * A value rule is a path ("input.amount", "response.state"), or an object:
 *   { from: path, as?: "string" | "number" | "mask4", map?: { theirs: ours }, each?: { ourField: rule }, mapEach?: { theirs: ours }, default?: any, if?: cond, unless?: cond }
 *   { const: value }
 * `if` / `unless` are { path, in: [values] }. A rule whose source is missing leaves the field out (or uses `default`).
 */
export type Cond = { path: string; in: unknown[] };
export type Rule = string | { const: unknown } | { from: string; as?: "string" | "number" | "mask4"; map?: Record<string, unknown>; each?: Record<string, Rule>; mapEach?: Record<string, unknown>; default?: unknown; if?: Cond; unless?: Cond };
export type ErrorRule = { code: string; message: string; /** rewrite a parameter before it goes into the message: { param: { theirs: ours } } */ map?: Record<string, Record<string, string>> };
export type OperationMap = { call: string; request?: Record<string, Rule>; /** where the list is in the response, for operations that return many */ list?: string; /** the rules, or the name of a shape in `shapes` shared by several operations */ response?: Record<string, Rule> | string };
export type MappingSpec = {
  provider: string; version: number;
  operations: Record<string, OperationMap>;
  /** rules shared by several operations, by name (for example the shape of a payment) */
  shapes?: Record<string, Record<string, Rule>>;
  /** their error code -> our code and message ({param} filled from what the error carries) */
  errors: Record<string, ErrorRule>;
  unmapped: { code: string; message: string };
};

const dig = (obj: any, path: string): unknown => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
const put = (obj: Record<string, any>, path: string, value: unknown) => {
  const keys = path.split(".");
  let cur = obj;
  keys.slice(0, -1).forEach((k) => { cur = cur[k] ??= {}; });
  cur[keys.at(-1)!] = value;
};
const holds = (c: Cond | undefined, scope: any) => !c || c.in.includes(dig(scope, c.path));
const convert = (v: unknown, as?: string) => {
  if (v == null || !as) return v;
  if (as === "string") return String(v);
  if (as === "number") return Number(v);
  if (as === "mask4") return `••${String(v).slice(-4)}`;
  return v;
};

/** Applies one rule to a scope (an object with `input`, `response`, `context`). `undefined` means "leave the field out". */
export function applyRule(rule: Rule, scope: any): unknown {
  if (typeof rule === "string") return dig(scope, rule);
  if ("const" in rule) return rule.const;
  if (!holds(rule.if, scope) || (rule.unless && holds(rule.unless, scope))) return undefined;
  let v = dig(scope, rule.from);
  if (v === undefined || v === null) return rule.default;
  if (rule.each) {
    const list = Array.isArray(v) ? v : [];
    return list.map((item) => Object.fromEntries(Object.entries(rule.each!).map(([k, r]) => [k, applyRule(r, { ...scope, item })]).filter(([, x]) => x !== undefined)));
  }
  if (rule.mapEach && Array.isArray(v)) return v.map((x) => (x as string) in rule.mapEach! ? rule.mapEach![x as string] : x).filter((x, i, a) => a.indexOf(x) === i);
  if (rule.map) v = String(v) in rule.map ? rule.map[String(v)] : v;
  return convert(v, rule.as);
}

/** Builds an object from a set of rules: { "debit.accountNo": "input.fromAccountId", … }. */
export function build(rules: Record<string, Rule> | undefined, scope: any): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [target, rule] of Object.entries(rules ?? {})) { const v = applyRule(rule, scope); if (v !== undefined) put(out, target, v); }
  return out;
}

/** Their error to ours: our code, and our wording with the facts filled in. */
export function mapError(spec: MappingSpec, err: { code: string; detail?: string; params?: Record<string, unknown> }): BankError {
  const rule = spec.errors[err.code];
  if (!rule) return new BankError(spec.unmapped.code, spec.unmapped.message);
  const params: Record<string, unknown> = { ...(err.params ?? {}) };
  for (const [p, table] of Object.entries(rule.map ?? {})) if (p in params) params[p] = table[String(params[p])] ?? params[p];
  return new BankError(rule.code, rule.message.replace(/\{(\w+)\}/g, (_m, k) => String(params[k] ?? "")));
}

/** The rules of an operation's response, resolving a shape name. */
export const responseRules = (spec: MappingSpec, op: OperationMap): Record<string, Rule> | undefined => (typeof op.response === "string" ? spec.shapes?.[op.response] : op.response);

/** Which of our fields a mapping fills in, for the check that a mapping is complete. */
export const filledFields = (rules: Record<string, Rule> | undefined) => Object.keys(rules ?? {}).map((k) => k.split(".")[0]!);
