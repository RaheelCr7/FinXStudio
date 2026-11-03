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
