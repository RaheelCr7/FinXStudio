import { describe, it, expect } from "vitest";
import { Journey } from "@finx/journey-schema";
import { MockBank } from "@finx/mock-bank-api";
import { JourneyRunner } from "./runner";

const j = Journey.parse({
  id: "j", slug: "j", name: "J", version: 1, status: "draft", channels: ["web"], locale: { default: "en", supported: ["en", "ur"], rtl: ["ur"] }, entryScreen: "a",
  dataModel: { "t.amount": { type: "money", required: true, currency: "PKR" } }, integrations: [],
  screens: [
    { id: "a", title: "A", blocks: [
      { type: "amountInput", bind: "t.amount", currency: "PKR", validation: { min: 50, max: 5000, messages: { min: { en: "At least PKR 50", ur: "کم از کم PKR 50" }, max: { en: "At most PKR 5,000", ur: "زیادہ سے زیادہ PKR 5,000" } } } },
      { type: "button", label: "Go", actions: [{ type: "validate" }, { type: "navigate", to: "done" }] },
    ] },
    { id: "done", title: "Done", kind: "terminal", blocks: [{ type: "result", tone: "success", title: "ok" }, { type: "button", label: "Close", actions: [{ type: "exit" }] }] },
  ],
});
const run = async (lang: string, amount: unknown) => {
  const bank = new MockBank("ayesha");
  const r = new JourneyRunner(j, { adapter: (id, input) => bank.call(id, input), lang });
  await r.start(); r.set("t.amount", amount);
  await r.press((r.view().blocks.find((b) => b.type === "button")!).actions);
  return r;
};

describe("amount validation messages", () => {
  it("uses the journey's own minimum and maximum messages, in the customer's language", async () => {
    expect((await run("en", 10)).errors["t.amount"]).toBe("At least PKR 50");
    expect((await run("ur", 10)).errors["t.amount"]).toBe("کم از کم PKR 50");
    expect((await run("en", 6000)).errors["t.amount"]).toBe("At most PKR 5,000");
    expect((await run("ur", 6000)).errors["t.amount"]).toBe("زیادہ سے زیادہ PKR 5,000");
  });
  it("accepts an amount inside the range", async () => {
    const r = await run("en", 500);
    expect(r.errors).toEqual({});
    expect(r.current).toBe("done");
  });
  it("falls back to the built-in messages when the journey gives none", async () => {
    const plain = structuredClone(j) as any; delete plain.screens[0].blocks[0].validation.messages;
    const bank = new MockBank("ayesha");
    const r = new JourneyRunner(plain, { adapter: (id, input) => bank.call(id, input), lang: "ur" });
    await r.start(); r.set("t.amount", 10);
    await r.press((r.view().blocks.find((b) => b.type === "button")!).actions);
    expect(r.errors["t.amount"]).toBe("کم از کم 50 ہے");
  });
});

import { typedAmount, amountText } from "./blocks/money";
import { lintJourney } from "@finx/journey-schema";

describe("typing an amount", () => {
  it("keeps whole currencies whole and groups thousands", () => {
    expect(typedAmount("12000")).toEqual({ text: "12,000", value: 12000 });
    expect(typedAmount("12.5")).toEqual({ text: "125", value: 125 }); // no point for a currency without decimals
    expect(typedAmount("")).toEqual({ text: "", value: undefined });
    expect(typedAmount("abc")).toEqual({ text: "", value: undefined });
  });
  it("keeps a trailing point while the person is still typing, and cuts extra places", () => {
    expect(typedAmount("12.", 3)).toEqual({ text: "12.", value: 12 });
    expect(typedAmount("12.5", 3)).toEqual({ text: "12.5", value: 12.5 });
    expect(typedAmount("12.5678", 3)).toEqual({ text: "12.567", value: 12.567 });
    expect(typedAmount("1234.5", 2)).toEqual({ text: "1,234.5", value: 1234.5 });
    expect(typedAmount(".5", 2)).toEqual({ text: "0.5", value: 0.5 });
    expect(typedAmount("1.2.3", 3)).toEqual({ text: "1.23", value: 1.23 });
  });
  it("shows a stored amount with the currency's decimals at most", () => {
    expect(amountText(12.5, 3)).toBe("12.5");
    expect(amountText(12000)).toBe("12,000");
    expect(amountText(undefined, 3)).toBe("");
  });
});

describe("amount currency and decimals", () => {
  const withCurrency = (currency: string, data: Record<string, unknown> = {}) => {
    const c = structuredClone(j) as any;
    c.screens[0].blocks[0].currency = currency;
    c.screens[0].blocks[0].validation = {};
    c.dataModel["t.amount"].currency = undefined;
    const bank = new MockBank("ayesha");
    const r = new JourneyRunner(c, { adapter: (id, input) => bank.call(id, input), lang: "en" });
    for (const [k, v] of Object.entries(data)) r.set(k, v);
    return r;
  };
  it("reads the currency from the data and tells the view its decimals", async () => {
    const r = withCurrency("{{ acct.currency }}", { acct: { currency: "JOD" } });
    await r.start(); r.set("acct", { currency: "JOD" });
    const b = r.view().blocks.find((x: any) => x.type === "amountInput") as any;
    expect([b.currency, b.decimals]).toEqual(["JOD", 3]);
    r.set("acct", { currency: "JPY" });
    expect((r.view().blocks.find((x: any) => x.type === "amountInput") as any).decimals).toBe(0);
  });
  it("refuses more places than the currency has", async () => {
    const press = async (currency: string, amount: number) => {
      const r = withCurrency(currency); await r.start(); r.set("t.amount", amount);
      await r.press((r.view().blocks.find((b: any) => b.type === "button") as any).actions);
      return r.errors["t.amount"];
    };
    expect(await press("JOD", 12.5)).toBeUndefined();
    expect(await press("JOD", 12.5555)).toBe("Use at most 3 decimal places");
    expect(await press("USD", 10.555)).toBe("Use at most 2 decimal places");
    expect(await press("JPY", 100.5)).toBe("Enter a whole amount, without decimals");
    expect(await press("JPY", 100)).toBeUndefined();
  });
});

describe("currency lint", () => {
  const lint = (mutate: (c: any) => void) => { const c = structuredClone(j) as any; mutate(c); return lintJourney(c).filter((i) => /currency/.test(i.code)).map((i) => i.code); };
  it("accepts a code and a path, and flags the rest", () => {
    expect(lint(() => {})).toEqual([]);
    expect(lint((c) => { c.screens[0].blocks[0].currency = "{{ account.currency }}"; })).toEqual([]);
    expect(lint((c) => { c.screens[0].blocks[0].currency = ""; })).toEqual(["amount_no_currency"]);
    expect(lint((c) => { c.screens[0].blocks[0].currency = "rupees"; })).toEqual(["amount_currency_invalid"]);
    expect(lint((c) => { c.screens[0].blocks[0].currency = "USD"; })).toEqual(["currency_mismatch"]);
    expect(lint((c) => { c.screens[0].blocks.splice(1, 0, { type: "amountInput", bind: "t.other", currency: "USD" }); c.dataModel["t.other"] = { type: "money", currency: "USD" }; })).toEqual(["mixed_currency"]);
  });
});
