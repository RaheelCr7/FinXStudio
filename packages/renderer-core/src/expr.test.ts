import { describe, it, expect } from "vitest";
import { evaluate } from "./expr";
import { interpolate } from "./template";

describe("expression evaluator", () => {
  const scope = { a: 5, ctx: { limits: { daily: 50000, usedToday: 1000 }, accounts: { x: { balance: 99 } } }, id: "x", flag: true };
  it("does arithmetic and comparison", () => {
    expect(evaluate("a * 2 + 1", scope)).toBe(11);
    expect(evaluate("a > 3 && flag", scope)).toBe(true);
    expect(evaluate("ctx.limits.daily - ctx.limits.usedToday", scope)).toBe(49000);
  });
  it("supports dynamic bracket access and functions", () => {
    expect(evaluate("ctx.accounts[id].balance", scope)).toBe(99);
    expect(evaluate("min(ctx.accounts[id].balance, 25000)", scope)).toBe(99);
  });
  it("does not execute arbitrary code", () => {
    expect(() => evaluate("constructor.constructor('return 1')()", scope)).toThrow();
    expect(() => evaluate("process.exit()", scope)).toThrow();
  });
  it("interpolates with formatters", () => {
    expect(interpolate("PKR {{ctx.limits.daily | money}}", scope)).toBe("PKR 50,000");
    expect(interpolate("Hi {{missing.value}}!", scope)).toBe("Hi !");
  });
});
