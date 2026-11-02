import { describe, it, expect } from "vitest";
import { Journey, lintJourney, localTransfer } from "@finx/journey-schema";
import { addBlock, addScreen, deleteScreen, moveBlock, removeBlock, setLoc } from "./edit";
import { buildEdges, layout } from "./graph";

const fresh = () => structuredClone(localTransfer);
const blank = (): Journey => ({
  id: "j", slug: "j", name: "J", version: 0, status: "draft", channels: ["web"], locale: { default: "en", supported: ["en", "ur"] }, entryScreen: "a", integrations: [],
  screens: [
    { id: "a", title: "A", blocks: [{ type: "text", text: "hi" }, { type: "button", label: "Next", actions: [{ type: "navigate", to: "end" }] }] },
    { id: "end", title: "End", kind: "terminal", blocks: [{ type: "result", tone: "success", title: "ok" }, { type: "button", label: "Close", actions: [{ type: "exit" }] }] },
  ],
});

describe("graph", () => {
  it("builds flow, rule and error edges for Local transfer", () => {
    const e = buildEdges(fresh());
    expect(e.find((x) => x.from === "amount" && x.to === "limitExceeded")?.kind).toBe("rule");
    expect(e.find((x) => x.from === "otp" && x.to === "failed")?.kind).toBe("error");
    expect(e.find((x) => x.from === "account" && x.to === "beneficiary")?.kind).toBe("flow");
  });
  it("lays out screens top to bottom by distance from the entry", () => {
    const p = layout(fresh());
    expect(p.account!.y).toBe(0);
    expect(p.beneficiary!.y).toBeGreaterThan(p.account!.y);
    expect(p.success!.y).toBeGreaterThan(p.otp!.y);
  });
});

describe("editing", () => {
  it("adds a block before the buttons and keeps lint clean when binding a new input", () => {
    const { journey, index } = addBlock(blank(), "a", "amountInput");
    expect(index).toBe(1);
    expect(journey.screens[0]!.blocks.map((b) => b.type)).toEqual(["text", "amountInput", "button"]);
    expect(journey.dataModel?.amount).toBeDefined();
    expect(lintJourney(journey)).toEqual([]);
  });
  it("moves and removes blocks", () => {
    let j = blank();
    j = moveBlock(j, "a", 0, 1);
    expect(j.screens[0]!.blocks.map((b) => b.type)).toEqual(["button", "text"]);
    j = removeBlock(j, "a", 0);
    expect(j.screens[0]!.blocks.map((b) => b.type)).toEqual(["text"]);
  });
  it("inserts a screen after another and rewires the flow", () => {
    const { journey, id } = addScreen(blank(), "Confirm details", "a");
    expect(id).toBe("confirm_details");
    expect(journey.screens.map((s) => s.id)).toEqual(["a", "confirm_details", "end"]);
    const e = buildEdges(journey).map((x) => `${x.from}>${x.to}`);
    expect(e).toEqual(expect.arrayContaining(["a>confirm_details", "confirm_details>end"]));
    expect(lintJourney(journey)).toEqual([]);
  });
  it("a screen added with no anchor is flagged as unreachable", () => {
    const { journey } = addScreen(blank(), "Orphan");
    expect(lintJourney(journey).map((i) => i.code)).toContain("unreachable");
  });
  it("deleting a screen bypasses it and keeps the journey valid", () => {
    const { journey } = addScreen(blank(), "Middle", "a");
    const out = deleteScreen(journey, "middle")!;
    expect(out.screens.map((s) => s.id)).toEqual(["a", "end"]);
    expect(lintJourney(out)).toEqual([]);
  });
  it("deleting the Local transfer review screen reroutes the amount step to OTP and stays valid", () => {
    const out = deleteScreen(fresh(), "review")!;
    expect(out.screens.some((s) => s.id === "review")).toBe(false);
    expect(buildEdges(out).some((e) => e.from === "amount" && e.to === "otp")).toBe(true);
    // consent lived on the review screen, so lint now correctly objects
    expect(lintJourney(out).map((i) => i.code)).toContain("consent_before_submit");
  });
  it("keeps a plain string until a translation is typed, and drops emptied translations", () => {
    expect(setLoc("Hello", "en", "Hi", ["en", "ur"])).toBe("Hi");
    expect(setLoc("Hello", "ur", "ہیلو", ["en", "ur"])).toEqual({ en: "Hello", ur: "ہیلو" });
    expect(setLoc({ en: "Hello", ur: "ہیلو" }, "ur", "", ["en", "ur"])).toEqual({ en: "Hello" });
  });
});

describe("new blocks", () => {
  it("adds a text input and registers its binding so lint stays clean", () => {
    const { journey } = addBlock(blank(), "a", "textInput");
    expect(journey.screens[0]!.blocks.map((b) => b.type)).toEqual(["text", "textInput", "button"]);
    expect(journey.dataModel?.reference).toBeDefined();
    expect(lintJourney(journey)).toEqual([]);
  });
});
