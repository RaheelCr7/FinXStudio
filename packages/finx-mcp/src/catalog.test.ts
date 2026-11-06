import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { Action, Block, Journey } from "@finx/journey-schema";
import { lintAll } from "@finx/renderer-core";
import { ADAPTER_CATALOG } from "@finx/mock-bank-api";
import { ACTIONS, adapterDetail, adapterGist, adapterIndex, BLOCKS, CATALOG_MAX_CHARS, catalogSizes, CatalogError, getCatalog, LINT_RULES, SECTIONS, SKELETON } from "./catalog";

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
  it("lists every sandbox adapter in the index, and returns each full entry on request", () => {
    const { index } = (getCatalog("adapters") as any).adapters as ReturnType<typeof adapterIndex>;
    expect(Object.values(index).flat()).toHaveLength(ADAPTER_CATALOG.length);
    for (const a of ADAPTER_CATALOG) {
      const family = a.adapter.split(".").slice(0, 2).join(".");
      const last = a.adapter.slice(family.length + 1);
      const line = index[family]?.find((l) => l.startsWith(`${last}: `) || l.startsWith(`${last} -> `));
      expect(line, a.adapter).toBeDefined();
      if (a.suggestedId !== last) expect(line, a.adapter).toContain(` -> ${a.suggestedId}: `);
      else expect(line, a.adapter).not.toContain(" -> ");
      expect(line!.match(/ \[([a-z, ]+)\]$/)?.[1] ?? "", a.adapter).toBe([a.moneyMoving ? "money" : "", a.requiresOtp ? "otp" : ""].filter(Boolean).join(", "));
    }
    // the detail is the entries of ADAPTER_CATALOG, unchanged and in the same order
    expect((getCatalog("adapters", "bank,corp,cab,sandbox") as any).adapters.list).toEqual(ADAPTER_CATALOG);
    expect(Object.keys(getCatalog("adapters", "bank.payees"))).toEqual(["adapters"]);
    expect((getCatalog("adapters", "bank.payees") as any).adapters.list.map((a: any) => a.adapter)).toEqual(ADAPTER_CATALOG.filter((a) => a.adapter.startsWith("bank.payees.")).map((a) => a.adapter));
    expect(adapterDetail("bank.otp.verify, bank.otp.verify,bank.otp").map((a) => a.adapter)).toEqual(["bank.otp.send", "bank.otp.verify"]);
  });
  it("refuses an unknown adapter, an empty selector, and an adapter filter on another section", () => {
    expect(() => adapterDetail("bank.pay")).toThrow(CatalogError); // a prefix ends at a dot: bank.pay is not bank.payees
    expect(() => adapterDetail("bank.nope")).toThrow(/Families: .*bank\.payees/);
    expect(() => adapterDetail(" , ")).toThrow(CatalogError);
    expect(() => getCatalog("blocks", "bank")).toThrow(CatalogError);
    expect(() => getCatalog("all", "bank")).toThrow(CatalogError);
  });
  it("gives every adapter a short gist for the index", () => {
    for (const a of ADAPTER_CATALOG) {
      const g = adapterGist(a);
      expect(g.length, a.adapter).toBeGreaterThan(8);
      expect(g.length, a.adapter).toBeLessThanOrEqual(101);
      expect(g.split("(").length, a.adapter).toBe(g.split(")").length); // never cut inside a bracket
    }
  });
  it("sections return only what was asked for", () => {
    for (const s of SECTIONS.filter((x) => x !== "all")) expect(Object.keys(getCatalog(s))).toEqual([s]);
  });

  // Agents read the whole catalog (section "all") first, so it is kept small: the adapters are an index there, and their inputs, results and
  // errors are fetched by family. When a size below fails, the message lists every section's size (also: pnpm --filter @finx/mcp catalog-size).
  // Trim the section that grew (shorter wording, no repeats) before raising a number, and raise it by what the new entries need, not more.
  // adapters 12,700 -> 12,800: the 14 adapters of the Accounts journeys (overview, transactions, hide, report, closure, open, three statement calls, budgets update and delete,
  // spending, speeds), each cut to one short line before raising (12,796 now). The whole stays at 54,530 of 56,000.
  // adapters 12,800 -> 14,100: the 19 new adapters of the Cards journeys (choosing cards, their spending, activation, freezing, controls, virtual cards, replacing, the PIN, reporting a payment, saving another
  // bank's card), and 3 rewritten entries (issued, get, add), each cut to one short line before raising (14,055 now). The whole stays at 55,802 of 56,000, which is not raised.
  const SECTION_CEILINGS: Record<string, number> = { overview: 900, journey: 2_600, blocks: 22_500, actions: 3_000, expressions: 1_900, data: 900, localization: 1_100, adapters: 14_100, personas: 5_800, lint: 4_300, patterns: 1_700 };
  it("each section stays within its ceiling, and the whole stays within the size the tool returns", () => {
    const sizes = catalogSizes();
    const report = JSON.stringify(sizes);
    expect(Object.keys(SECTION_CEILINGS).sort(), "a section has no ceiling").toEqual(SECTIONS.filter((x) => x !== "all").sort());
    for (const [k, max] of Object.entries(SECTION_CEILINGS)) expect(sizes[k]!, `${k} is ${sizes[k]} (limit ${max}); sizes: ${report}`).toBeLessThanOrEqual(max);
    expect(sizes.all!, `the whole catalog is ${sizes.all} (limit ${CATALOG_MAX_CHARS}); sizes: ${report}`).toBeLessThan(CATALOG_MAX_CHARS);
    expect(sizes.all).toBe(JSON.stringify(getCatalog("all")).length);
  });
  it("the full entries of one family fit in one small answer, and a whole domain fits in the tool's limit", () => {
    const families = new Set(ADAPTER_CATALOG.map((a) => a.adapter.split(".").slice(0, 2).join(".")));
    for (const f of families) expect(JSON.stringify(adapterDetail(f)).length, f).toBeLessThan(9_000);
    for (const d of ["bank", "corp", "cab"]) expect(JSON.stringify(getCatalog("adapters", d)).length, d).toBeLessThan(CATALOG_MAX_CHARS);
  });
});
