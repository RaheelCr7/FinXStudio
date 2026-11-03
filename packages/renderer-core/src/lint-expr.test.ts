import { describe, it, expect } from "vitest";
import { localTransfer, payBill, type Journey } from "@finx/journey-schema";
import { checkExpression, pathsOf } from "./expr";
import { lintAll, lintExpressions } from "./lint-expr";

const lt = () => structuredClone(localTransfer);
const codes = (j: Journey) => lintExpressions(j).map((i) => i.code);
const msg = (j: Journey, code: string) => lintExpressions(j).find((i) => i.code === code)?.message ?? "";

describe("expression helpers", () => {
  it("checkExpression accepts valid syntax and rejects broken syntax and unknown functions", () => {
    expect(checkExpression("a > 1 && b == 'x'")).toBeNull();
    expect(checkExpression("min(a.b, 5) + ctx.x[id].y")).toBeNull();
    expect(checkExpression("a >")).not.toBeNull();
    expect(checkExpression("foo(1)")).toContain("Unknown function");
    expect(checkExpression("a ?? b")).not.toBeNull();
  });
  it("pathsOf lists dotted reads including bracket lookups and ignores functions and literals", () => {
    expect(pathsOf("ctx.accounts[transfer.fromAccountId].balance")).toEqual(["ctx.accounts", "transfer.fromAccountId"]);
    expect(pathsOf("min(bill.amount, 25000) > 5 && true")).toEqual(["bill.amount"]);
  });
});

describe("lintAll on the shipped journeys", () => {
  it("Local transfer and Pay a bill pass both structure and expression lint", () => {
    expect(lintAll(localTransfer)).toEqual([]);
    expect(lintAll(payBill)).toEqual([]);
  });
});

describe("expression lint catches mistakes an agent or a person could make", () => {
  it("flags an expression with broken syntax in a navigation rule", () => {
    const j = lt(); j.screens.find((s) => s.id === "amount")!.navigation!.rules![0]!.when = "transfer.amount >";
    expect(codes(j)).toContain("expression_syntax");
  });
  it("flags a misspelled data root and suggests the right one", () => {
    const j = lt(); (j.screens[2]!.blocks[0] as any).visibleWhen = "trasfer.amount > 5";
    expect(msg(j, "unknown_reference")).toContain('Did you mean "transfer"?');
  });
  it("flags a misspelled field inside a known root", () => {
    const j = lt(); j.screens.find((s) => s.id === "amount")!.navigation!.rules![0]!.when = "transfer.amout > 5";
    expect(msg(j, "unknown_field")).toContain('Did you mean "transfer.amount"?');
  });
  it("flags ctx names that no API call saves", () => {
    const j = lt(); j.screens.find((s) => s.id === "amount")!.navigation!.rules![0]!.when = "transfer.amount > ctx.limit.daily";
    expect(msg(j, "unknown_reference")).toContain('Did you mean "limits"?');
  });
  it("flags unknown functions and unknown formatters in templates", () => {
    const j = lt(); (j.screens[3]!.blocks[0] as any).text = { en: "PKR {{transfer.amount | moneyy}}", ur: "PKR {{transfer.amount | money}}" };
    expect(codes(j)).toContain("unknown_formatter");
    const k = lt(); k.screens.find((s) => s.id === "amount")!.navigation!.rules![0]!.when = "maxx(transfer.amount, 5) > 1";
    expect(msg(k, "expression_syntax")).toContain("Unknown function");
  });
  it("flags a data source that is never saved", () => {
    const j = structuredClone(payBill); (j.screens[0]!.blocks[1] as any).source = "ctx.biller";
    expect(msg(j, "unknown_source")).toContain('Did you mean "ctx.billers"?');
  });
  it("checks validation max expressions and templates inside review rows", () => {
    const j = lt(); (j.screens[2]!.blocks[0] as any).validation.max = "ctx.accounts[transfer.fromAcountId].balance";
    expect(codes(j)).toContain("unknown_field");
    const k = lt(); (k.screens.find((s) => s.id === "review")!.blocks[0] as any).rows[1].value = "{{ctx.beneficiary[transfer.beneficiaryId].displayName}}";
    expect(codes(k)).toContain("unknown_reference");
  });
  it("accepts account filters that use the account row", () => {
    const j = lt(); (j.screens[0]!.blocks[1] as any).filter = "account.canDebit && account.balance > 0";
    expect(lintAll(j)).toEqual([]);
  });
});
