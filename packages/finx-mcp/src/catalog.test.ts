import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { Action, Block, Journey } from "@finx/journey-schema";
import { lintAll } from "@finx/renderer-core";
import { ADAPTER_CATALOG } from "@finx/mock-bank-api";
import { ACTIONS, BLOCKS, getCatalog, LINT_RULES, SECTIONS, SKELETON } from "./catalog";

const src = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

describe("catalog stays in sync with the real schema and lint", () => {
  it("documents every block type the schema accepts, and nothing else", () => {
    const schemaTypes = (Block as any).options.map((o: any) => o.shape.type.value).sort();
    expect(BLOCKS.map((b) => b.type).sort()).toEqual(schemaTypes);
  });
  it("every documented block example is valid", () => {
    for (const b of BLOCKS) expect(() => Block.parse(b.example), b.type).not.toThrow();
  });
  it("documents every action type, and every example is valid", () => {
    const schemaTypes = ((Action as any)._zod.def.getter().options as any[]).map((o) => o.shape.type.value).sort();
    expect(ACTIONS.map((a) => a.type).sort()).toEqual(schemaTypes);
    for (const a of ACTIONS) expect(() => Action.parse(a.example), a.type).not.toThrow();
  });
  it("the skeleton is a valid journey that passes lint", () => {
    expect(() => Journey.parse(SKELETON)).not.toThrow();
    expect(lintAll(Journey.parse(SKELETON))).toEqual([]);
  });
  it("documents every lint code that the lint source can emit", () => {
    const emitted = new Set<string>();
    for (const f of ["../../journey-schema/src/lint.ts", "../../renderer-core/src/lint-expr.ts"]) for (const m of src(f).matchAll(/code: "([a-z_]+)"/g)) emitted.add(m[1]!);
    const documented = new Set(LINT_RULES.map((r) => r.code));
    expect([...emitted].filter((c) => !documented.has(c))).toEqual([]);
    expect([...documented].filter((c) => !emitted.has(c))).toEqual([]);
  });
  it("lists every sandbox adapter", () => {
    expect((getCatalog("adapters") as any).adapters.list).toEqual(ADAPTER_CATALOG);
  });
  it("sections return only what was asked for, and the whole catalog stays within a sensible size", () => {
    for (const s of SECTIONS.filter((x) => x !== "all")) expect(Object.keys(getCatalog(s))).toEqual([s]);
    const size = JSON.stringify(getCatalog("all")).length;
    expect(size).toBeLessThan(81_000); // agents read it by section; the whole is rarely asked for (it grew with corporate payments, bulk, payroll, the pop-up, map and date blocks, the payee adapters, the quote and pay adapters of Send money, the saved-billers and quote adapters of Pay a bill, the amounts, numbers and check adapters of Mobile top-up, and the seven schedule adapters and the scheduled-payments customer of Schedule a payment; trimmed first, raised by 3,000 because those cannot be described in less without dropping the inputs and errors a journey needs; then the session, company-quote and retail-record adapters of the combined demo, 31 adapters in about 9,600, trimmed to one line each)
  });
});
