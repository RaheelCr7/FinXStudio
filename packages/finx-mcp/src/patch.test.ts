import { describe, it, expect } from "vitest";
import { applyPatch, PatchError } from "./patch";

const doc = () => ({ screens: [{ id: "a", blocks: [{ type: "text", text: "hi" }, { type: "button" }] }, { id: "b", blocks: [] }], name: "J" });

describe("applyPatch", () => {
  it("replaces, adds (object key, array index, append) and removes without mutating the input", () => {
    const d = doc();
    const out = applyPatch(d, [
      { op: "replace", path: "/name", value: "K" },
      { op: "add", path: "/screens/0/blocks/1", value: { type: "alert" } },
      { op: "add", path: "/screens/1/blocks/-", value: { type: "text", text: "x" } },
      { op: "add", path: "/screens/0/title", value: "T" },
      { op: "remove", path: "/screens/0/blocks/0" },
    ]);
    expect(out.name).toBe("K");
    expect(out.screens[0]!.blocks.map((b: any) => b.type)).toEqual(["alert", "button"]);
    expect((out.screens[0] as any).title).toBe("T");
    expect(out.screens[1]!.blocks).toHaveLength(1);
    expect(d).toEqual(doc());
  });
  it("test passes on an equal value and fails on a different one", () => {
    expect(() => applyPatch(doc(), [{ op: "test", path: "/screens/0/id", value: "a" }])).not.toThrow();
    expect(() => applyPatch(doc(), [{ op: "test", path: "/screens/0/id", value: "z" }])).toThrow(PatchError);
  });
  it("is atomic: a failing later operation leaves nothing applied", () => {
    const d = doc();
    expect(() => applyPatch(d, [{ op: "replace", path: "/name", value: "K" }, { op: "remove", path: "/nope" }])).toThrow(/Operation 2/);
    expect(d.name).toBe("J");
  });
  it("gives clear errors for bad paths", () => {
    expect(() => applyPatch(doc(), [{ op: "replace", path: "name", value: "K" }])).toThrow(/must start with/);
    expect(() => applyPatch(doc(), [{ op: "replace", path: "/screens/9/id", value: "K" }])).toThrow(/does not exist/);
    expect(() => applyPatch(doc(), [{ op: "replace", path: "/screens/x", value: 1 }])).toThrow(/not a valid array index/);
    expect(() => applyPatch(doc(), [{ op: "add", path: "/screens/5", value: {} }])).toThrow(/past the end/);
    expect(() => applyPatch(doc(), [{ op: "replace", path: "/missing", value: 1 }])).toThrow(/nothing to replace/);
    expect(() => applyPatch(doc(), [{ op: "add", path: "/name" }])).toThrow(/needs a value/);
    expect(() => applyPatch(doc(), [{ op: "add", path: "", value: {} }])).toThrow(/must not be empty/);
  });
  it("blocks prototype pollution paths", () => {
    expect(() => applyPatch(doc(), [{ op: "add", path: "/__proto__/polluted", value: true }])).toThrow(/not allowed/);
    expect(() => applyPatch(doc(), [{ op: "add", path: "/constructor/prototype/x", value: 1 }])).toThrow(/not allowed/);
    expect(({} as any).polluted).toBeUndefined();
  });
  it("understands ~0 and ~1 escapes", () => {
    const out = applyPatch({ "a/b": { "c~d": 1 } }, [{ op: "replace", path: "/a~1b/c~0d", value: 2 }]);
    expect(out).toEqual({ "a/b": { "c~d": 2 } });
  });
});
