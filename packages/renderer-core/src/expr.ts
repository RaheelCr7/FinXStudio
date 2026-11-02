/** Safe expression evaluator: no eval, no function constructor, whitelisted functions only. */
type Tok = { t: "num" | "str" | "id" | "op" | "eof"; v: string; /** where the token starts and ends in the source */ s?: number; e?: number };

const OPS = ["&&", "||", "==", "!=", "<=", ">=", "<", ">", "+", "-", "*", "/", "%", "!", "(", ")", "[", "]", ",", ".", "?", ":"];

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9]/.test(c)) { let j = i; while (j < src.length && /[0-9._]/.test(src[j]!)) j++; out.push({ t: "num", v: src.slice(i, j).replace(/_/g, ""), s: i, e: j }); i = j; continue; }
    if (c === '"' || c === "'") { let j = i + 1; while (j < src.length && src[j] !== c) j++; out.push({ t: "str", v: src.slice(i + 1, j), s: i, e: j + 1 }); i = j + 1; continue; }
    if (/[A-Za-z_$]/.test(c)) { let j = i; while (j < src.length && /[A-Za-z0-9_$]/.test(src[j]!)) j++; out.push({ t: "id", v: src.slice(i, j), s: i, e: j }); i = j; continue; }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) throw new Error(`Unexpected character '${c}' in expression`);
    out.push({ t: "op", v: op, s: i, e: i + op.length }); i += op.length;
  }
  out.push({ t: "eof", v: "" });
  return out;
}

const FUNCS: Record<string, (...a: any[]) => any> = {
  min: Math.min, max: Math.max, abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil,
  len: (x: any) => (x == null ? 0 : x.length ?? Object.keys(x).length),
  isEmpty: (x: any) => x == null || x === "" || (Array.isArray(x) && x.length === 0),
};

export function getPath(obj: any, path: string): any {
  let cur = obj;
  for (const seg of path.split(".")) {
    if (cur == null) return undefined;
    cur = cur[seg];
  }
  return cur;
}

export function setPath(obj: any, path: string, value: any): void {
  const segs = path.split(".");
  let cur = obj;
  for (let i = 0; i < segs.length - 1; i++) {
    const s = segs[i]!;
    if (typeof cur[s] !== "object" || cur[s] == null) cur[s] = {};
    cur = cur[s];
  }
  cur[segs[segs.length - 1]!] = value;
}

class Parser {
  private p = 0;
  constructor(private toks: Tok[], private scope: any) {}
  private peek() { return this.toks[this.p]!; }
  private next() { return this.toks[this.p++]!; }
  private isOp(v: string) { const k = this.peek(); return k.t === "op" && k.v === v; }
  private eat(v: string) { if (!this.isOp(v)) throw new Error(`Expected '${v}'`); this.p++; }

  parse(): any { const v = this.ternary(); if (this.peek().t !== "eof") throw new Error("Unexpected trailing input"); return v; }
  private ternary(): any {
    const c = this.or();
    if (this.isOp("?")) { this.p++; const a = this.ternary(); this.eat(":"); const b = this.ternary(); return c ? a : b; }
    return c;
  }
  private or(): any { let l = this.and(); while (this.isOp("||")) { this.p++; const r = this.and(); l = l || r; } return l; }
  private and(): any { let l = this.eq(); while (this.isOp("&&")) { this.p++; const r = this.eq(); l = l && r; } return l; }
  private eq(): any {
    let l = this.rel();
    while (this.isOp("==") || this.isOp("!=")) { const o = this.next().v; const r = this.rel(); l = o === "==" ? l == r : l != r; }
    return l;
  }
  private rel(): any {
    let l = this.add();
    while (["<", ">", "<=", ">="].some((o) => this.isOp(o))) {
      const o = this.next().v; const r = this.add();
      l = o === "<" ? l < r : o === ">" ? l > r : o === "<=" ? l <= r : l >= r;
    }
    return l;
  }
  private add(): any { let l = this.mul(); while (this.isOp("+") || this.isOp("-")) { const o = this.next().v; const r = this.mul(); l = o === "+" ? l + r : l - r; } return l; }
  private mul(): any {
    let l = this.unary();
    while (this.isOp("*") || this.isOp("/") || this.isOp("%")) { const o = this.next().v; const r = this.unary(); l = o === "*" ? l * r : o === "/" ? l / r : l % r; }
    return l;
  }
  private unary(): any {
    if (this.isOp("!")) { this.p++; return !this.unary(); }
    if (this.isOp("-")) { this.p++; return -this.unary(); }
    return this.postfix();
  }
  private postfix(): any {
    let v = this.primary();
    for (;;) {
      if (this.isOp(".")) { this.p++; const k = this.next(); if (k.t !== "id") throw new Error("Expected property name"); v = v == null ? undefined : v[k.v]; }
      else if (this.isOp("[")) { this.p++; const k = this.ternary(); this.eat("]"); v = v == null ? undefined : v[k]; }
      else break;
    }
    return v;
  }
  private primary(): any {
    const k = this.next();
    if (k.t === "num") return Number(k.v);
    if (k.t === "str") return k.v;
    if (k.t === "op" && k.v === "(") { const v = this.ternary(); this.eat(")"); return v; }
    if (k.t === "id") {
      if (k.v === "true") return true;
      if (k.v === "false") return false;
      if (k.v === "null") return null;
      if (k.v === "Infinity") return Infinity;
      if (this.isOp("(")) {
        this.p++;
        const args: any[] = [];
        if (!this.isOp(")")) { do { args.push(this.ternary()); } while (this.isOp(",") && this.next()); }
        this.eat(")");
        const fn = FUNCS[k.v];
        if (!fn) throw new Error(`Unknown function ${k.v}`);
        return fn(...args);
      }
      return this.scope?.[k.v];
    }
    throw new Error(`Unexpected token '${k.v}'`);
  }
}

export function evaluate(expr: string, scope: any): any {
  return new Parser(tokenize(expr), scope).parse();
}

/** Syntax and function check without needing real data. Returns an error message, or null when the expression parses. */
export function checkExpression(src: string): string | null {
  try {
    new Parser(tokenize(src), new Proxy({}, { get: () => undefined })).parse();
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

/** The tokens of an expression with their positions, for tools that read or rewrite rules. Throws on an unreadable character. */
export const tokensOf = (src: string) => tokenize(src);

const LITERALS = new Set(["true", "false", "null", "Infinity"]);

/** Static dotted data paths an expression reads, e.g. `ctx.limits.daily`, including paths inside `[...]`. */
export function pathsOf(src: string): string[] {
  const toks = tokenize(src);
  const out: string[] = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]!;
    if (t.t !== "id" || LITERALS.has(t.v)) continue;
    const prev = toks[i - 1];
    const next = toks[i + 1];
    if (prev && prev.t === "op" && prev.v === ".") continue;
    if (next && next.t === "op" && next.v === "(") continue;
    let path = t.v;
    let j = i + 1;
    while (toks[j]?.t === "op" && toks[j]!.v === "." && toks[j + 1]?.t === "id") { path += "." + toks[j + 1]!.v; j += 2; }
    out.push(path);
  }
  return out;
}
