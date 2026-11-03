import { describe, it, expect } from "vitest";
import { evaluate, setPath } from "@finx/renderer-core";
import { localTransfer } from "@finx/journey-schema";
import { describeRule, knownPaths, operand, parseRule, printRule, sampleValue } from "./rules";

describe("rule model", () => {
  it("reads simple comparisons, joined by and", () => {
    expect(parseRule("transfer.amount > ctx.limits.daily")).toEqual({ join: "&&", conditions: [{ left: "transfer.amount", op: ">", right: "ctx.limits.daily" }] });
    expect(parseRule('a >= 5 && b == "x"')!.conditions).toEqual([{ left: "a", op: ">=", right: "5" }, { left: "b", op: "==", right: '"x"' }]);
  });

  it("reads or, empty checks and yes/no", () => {
    expect(parseRule("a < 1 || b != 2")!.join).toBe("||");
    expect(parseRule("isEmpty(x.y) && !isEmpty(z) && ok && !done")!.conditions.map((c) => [c.left, c.op])).toEqual([["x.y", "empty"], ["z", "filled"], ["ok", "true"], ["done", "false"]]);
  });

  it("treats empty text and the always-value as no conditions", () => {
    expect(parseRule(undefined)!.conditions).toEqual([]);
    expect(parseRule("true", "true")!.conditions).toEqual([]);
    expect(printRule({ join: "&&", conditions: [] }, "true")).toBe("true");
    expect(printRule({ join: "&&", conditions: [] })).toBe("");
  });

  it("leaves what it cannot show to the text editor", () => {
    expect(parseRule("a > 1 && b > 2 || c")).toBeNull();
    expect(parseRule("(a > 1)")).toBeNull();
    expect(parseRule("a ? b : c")).toBeNull();
    expect(parseRule("a > 1 > 2")).toBeNull();
    expect(parseRule("a >")).toBeNull();
    expect(parseRule("a # b")).toBeNull();
    expect(parseRule("max(a, b) > 3 && len(c) == 2")!.conditions[0]!.left).toBe("max(a, b)");
  });

  it("prints back what it read", () => {
    for (const src of ["transfer.amount > ctx.limits.daily", "a >= 5 && b == \"x\"", "isEmpty(x.y) || !isEmpty(z)", "ok && !done", "amount > limits.daily - limits.usedToday"]) {
      expect(printRule(parseRule(src)!)).toBe(src);
    }
  });

  it("quotes typed text but keeps numbers, yes/no and known paths", () => {
    expect(operand("5000")).toBe("5000");
    expect(operand("true")).toBe("true");
    expect(operand("pending")).toBe('"pending"');
    expect(operand("ctx.limits.daily", ["ctx.limits.daily"])).toBe("ctx.limits.daily");
    expect(operand("")).toBe('""');
    expect(printRule({ join: "&&", conditions: [{ left: "status", op: "==", right: operand("pending") }] })).toBe('status == "pending"');
  });

  it("describes a rule in words", () => {
    expect(describeRule(parseRule('transfer.amount > 10000 && status == "new"')!)).toBe("transfer.amount is more than 10000  and  status is new");
    expect(describeRule({ join: "&&", conditions: [] })).toBe("Always");
  });

  it("builds rules that evaluate the way they read", () => {
    const rule = printRule({ join: "&&", conditions: [{ left: "amount", op: ">", right: "10000" }, { left: "note", op: "filled", right: "" }] });
    const scope: any = {}; setPath(scope, "amount", 20000); setPath(scope, "note", "gift");
    expect(evaluate(rule, scope)).toBe(true);
    setPath(scope, "note", "");
    expect(evaluate(rule, scope)).toBe(false);
  });

  it("lists the data paths a journey declares", () => {
    const paths = knownPaths(localTransfer);
    expect(paths).toContain("transfer.amount");
    expect(paths).toContain("ctx.limits");
    expect(paths).toEqual([...paths].sort());
  });

  it("turns sample text into values", () => {
    expect([sampleValue("12.5"), sampleValue("true"), sampleValue("hi"), sampleValue("")]).toEqual([12.5, true, "hi", undefined]);
  });
});
