import { describe, expect, it } from "vitest";
import { interpolate } from "./template";

describe("money with a currency", () => {
  it("formats in the named currency, or the one on the data", () => {
    expect(interpolate("{{ amt | money:JOD }}", { amt: 12.5 })).toBe("JOD 12.500");
    expect(interpolate("{{ amt | money:USD }}", { amt: 1234.5 })).toBe("$1,234.50");
    expect(interpolate("{{ amt | money:account.currency }}", { amt: 5000, account: { currency: "JPY" } })).toBe("¥5,000");
    expect(interpolate("{{ amt | money }}", { amt: 5000 })).toBe("5,000");
    expect(interpolate("{{ amt | money:nope.currency }}", { amt: 5000 })).toBe("5,000");
  });
});

describe("money formatter lint", () => {
  it("accepts a currency argument and checks a path argument", async () => {
    const { lintExpressions } = await import("./lint-expr");
    const { Journey } = await import("@finx/journey-schema");
    const mk = (text: string) => Journey.parse({ id: "j", slug: "j", name: "J", version: 1, status: "draft", channels: ["web"], locale: { default: "en", supported: ["en"] }, entryScreen: "a", dataModel: { "a.amt": { type: "money" } }, integrations: [],
      screens: [{ id: "a", title: "A", kind: "terminal", blocks: [{ type: "text", text }] }] });
    expect(lintExpressions(mk("{{ a.amt | money:JOD }}")).map((i) => i.code)).toEqual([]);
    expect(lintExpressions(mk("{{ a.amt | money:nope.currency }}")).map((i) => i.code)).toContain("unknown_reference");
  });
});
