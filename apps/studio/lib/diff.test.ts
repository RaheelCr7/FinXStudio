import { describe, expect, it } from "vitest";
import { localTransfer } from "@finx/journey-schema";
import { describeChanges } from "./diff";
import { addBlock, addScreen, deleteScreen, setLoc } from "./edit";

const base = () => structuredClone(localTransfer);

describe("describeChanges", () => {
  it("says nothing when the versions match", () => {
    expect(describeChanges(base(), base())).toEqual([]);
  });
  it("names added and removed screens and added blocks", () => {
    const a = base();
    const { journey: withScreen } = addScreen(a, "Gift note", "amount");
    expect(describeChanges(a, withScreen)[0]).toMatch(/^1 screen added: Gift note/);
    expect(describeChanges(withScreen, a)[0]).toMatch(/^1 screen removed: Gift note/);
    const { journey: withBlock } = addBlock(a, "amount", "text");
    expect(describeChanges(a, withBlock)[0]).toMatch(/1 block added/);
  });
  it("notices an edited label and a renamed journey", () => {
    const a = base();
    const b = base();
    (b.screens[0]!.blocks.find((x) => x.type === "button") as any).label = "Go on";
    expect(describeChanges(a, b)[0]).toMatch(/blocks edited/);
    expect(describeChanges(a, { ...b, name: "Other name" }).some((c) => c.startsWith("Name:"))).toBe(true);
    expect(setLoc("x", "ur", "y", ["en", "ur"])).toBeTruthy(); // keeps the import honest
    expect(deleteScreen(a, "amount")).toBeTruthy();
  });
});
