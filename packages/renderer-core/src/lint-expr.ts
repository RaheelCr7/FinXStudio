import { blockActions, lintJourney, type Journey, type LintIssue } from "@finx/journey-schema";
import { checkExpression, pathsOf } from "./expr";
import { FORMATTERS } from "./template";

function lev(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length]![b.length]!;
}
const didYouMean = (name: string, options: Iterable<string>) => {
  let best: string | undefined, bestD = 3;
  for (const o of options) { const x = lev(name, o); if (x < bestD) { bestD = x; best = o; } }
  return best ? ` Did you mean "${best}"?` : "";
};

/**
 * Checks every expression and {{template}} in a journey: syntax, known functions and formatters, and that each
 * data path points at something the journey really declares (data model, setData, or a callApi saveAs).
 */
export function lintExpressions(j: Journey): LintIssue[] {
  const issues: LintIssue[] = [];
  const dataPaths = new Set<string>(Object.keys(j.dataModel ?? {}));
  const saved = new Set<string>();
  const collect = (actions: any[] | undefined) => {
    for (const a of actions ?? []) {
      if (a?.type === "callApi" && a.saveAs) saved.add(a.saveAs);
      if (a?.type === "setData") dataPaths.add(a.path);
    }
  };
  for (const s of j.screens) {
    collect(s.onEnter);
    for (const b of s.blocks as any[]) collect(blockActions(b));
  }
  const roots = new Set<string>(["ctx"]);
  for (const p of [...dataPaths, ...saved]) roots.add(p.split(".")[0]!);
  const savedRoots = new Set([...saved].map((p) => p.split(".")[0]!));
  // "error" is always there: the engine saves what went wrong after a failed call
  const ctxNames = new Set([...[...saved].filter((p) => p.startsWith("ctx.")).map((p) => p.split(".")[1]!), "error"]);

  const checkPath = (path: string, expr: string, where: string, screen: string, extraRoots: string[]) => {
    const [root, second] = path.split(".");
    if (!root || root === "item" || extraRoots.includes(root)) return; // "item" is the row of a menu that is built from a list
    if (!roots.has(root)) {
      issues.push({ code: "unknown_reference", screen, message: `${where}: "${expr}" uses "${root}", which is not data, ctx or a saved result.${didYouMean(root, roots)}` });
    } else if (root === "ctx") {
      if (second && !ctxNames.has(second)) issues.push({ code: "unknown_reference", screen, message: `${where}: "${expr}" uses ctx.${second}, but no callApi saves to ctx.${second}.${didYouMean(second, ctxNames)}` });
    } else if (!savedRoots.has(root) && second) {
      const ok = [...dataPaths].some((p) => p === `${root}.${second}` || p.startsWith(`${root}.${second}.`));
      if (!ok) issues.push({ code: "unknown_field", screen, message: `${where}: "${expr}" uses ${root}.${second}, which is not in the data model.${didYouMean(`${root}.${second}`, [...dataPaths].map((p) => p.split(".").slice(0, 2).join(".")))}` });
    }
  };
  const checkExpr = (expr: string, where: string, screen: string, extraRoots: string[] = []) => {
    const err = checkExpression(expr);
    if (err) { issues.push({ code: "expression_syntax", screen, message: `${where}: "${expr}" is not a valid expression (${err})` }); return; }
    for (const p of pathsOf(expr)) checkPath(p, expr, where, screen, extraRoots);
  };
  const checkTemplates = (node: unknown, where: string, screen: string) => {
    if (typeof node === "string") {
      for (const m of node.matchAll(/\{\{([^{}]*)\}\}/g)) {
        if (!m[1]!.trim()) continue;
        const [expr, fmtPart] = m[1]!.trim().split("|").map((x) => x.trim());
        const [fmt, arg] = (fmtPart ?? "").split(":").map((x) => x.trim());
        if (fmt && !(fmt in FORMATTERS)) issues.push({ code: "unknown_formatter", screen, message: `${where}: unknown formatter "${fmt}" (use ${Object.keys(FORMATTERS).join(" or ")})` });
        checkExpr(expr!, where, screen);
        // a currency is a code (JOD) or a path to one (account.currency)
        if (arg && !/^[A-Z]{3,4}$/.test(arg)) checkExpr(arg, where, screen);
      }
    } else if (Array.isArray(node)) node.forEach((v, i) => checkTemplates(v, `${where}[${i}]`, screen));
    else if (node && typeof node === "object") for (const [k, v] of Object.entries(node)) checkTemplates(v, `${where}.${k}`, screen);
  };

  j.screens.forEach((s, si) => {
    const sw = `screens[${si}]`;
    (s.navigation?.rules ?? []).forEach((r, ri) => checkExpr(r.when, `${sw}.navigation.rules[${ri}].when`, s.id));
    (s.blocks as any[]).forEach((b, bi) => {
      const bw = `${sw}.blocks[${bi}]`;
      if (b.visibleWhen) checkExpr(b.visibleWhen, `${bw}.visibleWhen`, s.id);
      for (const k of ["min", "max"] as const) if (typeof b.validation?.[k] === "string") checkExpr(b.validation[k], `${bw}.validation.${k}`, s.id);
      if (b.type === "accountPicker" && b.filter) checkExpr(b.filter, `${bw}.filter`, s.id, ["account"]);
      // a source is a saved path, or something inside one (ctx.company.accounts inside ctx.company)
      if (typeof b.source === "string" && !saved.has(b.source) && ![...saved].some((p) => b.source.startsWith(`${p}.`))) {
        issues.push({ code: "unknown_source", screen: s.id, message: `${bw}.source: "${b.source}" is never saved by a callApi (saveAs).${didYouMean(b.source, saved)}` });
      }
    });
    // templates in everything except fields that hold paths, patterns and expressions
    const { navigation: _n, id: _i, ...rest } = s as any;
    checkTemplates({ onEnter: rest.onEnter, blocks: (rest.blocks as any[]).map(({ bind: _b, source: _s, pattern: _p, visibleWhen: _v, filter: _f, ...b }) => b), title: rest.title }, sw, s.id);
  });
  return issues;
}

/** Everything the Studio, the apps and the MCP tools treat as "lint": structure rules plus expression checks. */
export function lintAll(j: Journey): LintIssue[] {
  return [...lintJourney(j), ...lintExpressions(j)];
}
