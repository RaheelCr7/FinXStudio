import { describe, it, expect } from "vitest";
import { Block, Journey, lintJourney, localTransfer } from "@finx/journey-schema";
import { BLOCK_GROUPS, BLOCK_LABELS, addBlock, addScreen, blockSummary, deleteScreen, moveBlock, newBlock, removeBlock, setLoc } from "./edit";
import { BLOCK_HELP, BLOCK_ICONS } from "./blocks-ui";
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

describe("BankWorkx blocks in the Builder", () => {
  const j = (apps?: string[]) => ({ ...structuredClone(localTransfer), apps, dataModel: {} }) as any;
  it("adds a card form with its four fields declared in the data model, so lint stays clean", () => {
    const out = addBlock(j(["bankworkx"]), "amount", "cardForm").journey;
    expect(Object.keys(out.dataModel ?? {})).toEqual(expect.arrayContaining(["card", "card.number", "card.holder", "card.expiry", "card.cvv"]));
  });
  it("adds a switch that is a plain yes/no, never required", () => {
    const out = addBlock(j(), "amount", "toggle").journey;
    expect(out.dataModel!.option).toEqual({ type: "boolean" });
  });
  it("starts money fields in the journey's own currency", () => {
    expect((newBlock("amountInput", j(["bankworkx"])) as any).currency).toBe("USD");
    expect((newBlock("amountInput", j()) as any).currency).toBe("PKR");
  });
});

describe("every block can be added in the Builder", () => {
  const types = (Block as any).options.map((o: any) => o.shape.type.value as string);
  const addable = types.filter((t: string) => t !== "stepper");
  it("has a name, an icon, a line of help and a group for each block of the schema", () => {
    const grouped = new Set(BLOCK_GROUPS.flatMap((g) => g.types));
    for (const t of addable) {
      expect(BLOCK_LABELS[t], `${t} label`).toBeTruthy();
      expect(BLOCK_ICONS[t], `${t} icon`).toBeTruthy();
      expect(BLOCK_HELP[t], `${t} help`).toBeTruthy();
      expect(grouped.has(t), `${t} group`).toBe(true);
    }
  });
  it("starts each one as a block the schema accepts", () => {
    for (const t of addable) expect(() => Block.parse(newBlock(t, blank())), t).not.toThrow();
  });
  it("declares the ticked rows of a table as a list, so lint stays clean", () => {
    const j = blank();
    const out = addBlock(j, "a", "dataTable").journey;
    const table: any = out.screens[0]!.blocks.find((b) => b.type === "dataTable");
    out.screens[0]!.blocks.splice(out.screens[0]!.blocks.indexOf(table), 1, { ...table, bind: "pick" });
    const again = addBlock(out, "a", "statusChip").journey;
    expect(again.dataModel!.pick).toEqual({ type: "array" });
    expect(lintJourney(again).filter((i) => i.code === "unbound_input")).toEqual([]);
  });
  it("summarises the new blocks in the block list", () => {
    expect(blockSummary(newBlock("dataTable", blank()))).toBe("ctx.items · 2 columns");
    expect(blockSummary(newBlock("chart", blank()))).toBe("line · ctx.series");
    expect(blockSummary(newBlock("timeline", blank()))).toBe("2 steps");
    expect(blockSummary(newBlock("statusChip", blank()))).toBe("{{payment.status}}");
  });
  it("keeps a table's row action working when its target screen is deleted", () => {
    const j = blank();
    j.screens.splice(1, 0, { id: "detail", title: "Detail", blocks: [{ type: "button", label: "Next", actions: [{ type: "navigate", to: "end" }] }] });
    j.screens[0]!.blocks.unshift({ type: "dataTable", source: "ctx.items", label: "Items", columns: [{ key: "name", label: "Name" }], onRowPress: [{ type: "navigate", to: "detail" }] });
    const out = deleteScreen(j, "detail")!;
    expect((out.screens[0]!.blocks[0] as any).onRowPress[0].to).toBe("end");
  });
});
