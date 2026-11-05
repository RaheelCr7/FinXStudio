import { describe, expect, it } from "vitest";
import type { Journey } from "@finx/journey-schema";
import { Journey as JourneySchema, chainTargets, chainWarnings } from "@finx/journey-schema";
import { JourneyController } from "./controller";
import { evaluate } from "./expr";
import { lintAll } from "./lint-expr";
import { JourneyRunner, type ChainRequest } from "./runner";

const adapter = async () => ({});

/** An entry that reads what it was launched with: a branch that skips the choice when a kind was given, and one that hands over to another journey. */
const journey = (over: Partial<Journey> = {}): Journey => JourneySchema.parse({
  id: "jrn_test", slug: "test", name: "Test", version: 1, status: "draft", channels: ["web"],
  locale: { default: "en", supported: ["en"] }, entryScreen: "start",
  dataModel: { "launch.kind": { type: "string" }, "t.kind": { type: "string" }, "t.note": { type: "string" }, "opt.big": { type: "boolean" } },
  integrations: [],
  screens: [
    {
      id: "start", title: "Start", kind: "branch",
      onEnter: [{ type: "setData", path: "t.kind", value: "{{launch.kind ? launch.kind : ''}}" }, { type: "navigate", to: "choose" }],
      navigation: { rules: [{ when: "t.kind == 'fast'", to: "fast" }, { when: "t.kind == 'other'", to: "handOver" }] },
      blocks: [],
    },
    { id: "choose", title: "Choose", blocks: [{ type: "text", text: "Choose a kind" }, { type: "button", label: "Done", actions: [{ type: "navigate", to: "end" }] }] },
    { id: "fast", title: "Fast", blocks: [{ type: "text", text: "Fast lane for {{t.kind}}" }, { type: "button", label: "Done", actions: [{ type: "navigate", to: "end" }] }] },
    {
      id: "handOver", title: "Hand over", kind: "branch",
      onEnter: [{ type: "setData", path: "t.note", value: "hello" }, { type: "navigate", toJourney: "other-journey", with: { "pt.type": "international", "pt.note": "{{t.note}}", "pt.text": "kind {{t.kind}}" }, returnTo: "choose" }],
      blocks: [],
    },
    { id: "end", title: "End", kind: "terminal", blocks: [{ type: "button", label: "Close", actions: [{ type: "exit" }] }] },
  ],
  ...over,
});

describe("launch values", () => {
  it("are there before the entry screen runs, so its branch can read them", async () => {
    const r = new JourneyRunner(journey(), { adapter, launch: { "launch.kind": "fast" } });
    await r.start();
    expect(r.current).toBe("fast");
    expect(r.get("launch.kind")).toBe("fast");
  });

  it("change nothing for a journey opened without them", async () => {
    const r = new JourneyRunner(journey(), { adapter });
    await r.start();
    expect(r.current).toBe("choose");
    const withEmpty = new JourneyRunner(journey(), { adapter, launch: {} });
    await withEmpty.start();
    expect(withEmpty.current).toBe("choose");
  });

  it("go through the controller before the first screen, while `initial` answers still arrive after it", async () => {
    const c = new JourneyController(journey(), { adapter, launch: { "launch.kind": "fast" }, initial: { "t.kind": "later" } });
    await c.start();
    expect(c.layout().view.screenId).toBe("fast");
    // initial is applied after the first screen has opened, as before
    expect(c.runner.get("t.kind")).toBe("later");
  });

  it("can set bank options (opt.*) for the whole run", async () => {
    const r = new JourneyRunner(journey(), { adapter, launch: { "opt.big": true } });
    await r.start();
    expect(r.get("opt.big")).toBe(true);
  });
});

describe("opening another journey (navigate.toJourney)", () => {
  it("hands the target and its values to the app: templates are read from this journey's data, bank options go along", async () => {
    const asked: ChainRequest[] = [];
    const r = new JourneyRunner(journey(), { adapter, launch: { "launch.kind": "other", "opt.big": true }, openJourney: (q) => asked.push(q) });
    await r.start();
    expect(asked).toEqual([{ journey: "other-journey", launch: { "opt.big": true, "pt.type": "international", "pt.note": "hello", "pt.text": "kind other" }, returnTo: "choose" }]);
    expect(r.chained).toEqual(asked[0]);
    expect(r.current).toBe("handOver");
    expect(r.exited).toBe(false);
  });

  it("is reported to analytics by name only, never with the values", async () => {
    const events: any[] = [];
    const r = new JourneyRunner(journey(), { adapter, launch: { "launch.kind": "other" }, onEvent: (e) => events.push(e), openJourney: () => {} });
    await r.start();
    expect(events.filter((e) => e.type === "chain")).toEqual([{ type: "chain", screen: "handOver", journey: "other-journey" }]);
  });

  it("without an app to open it, says so on the screen and stays (the Studio preview)", async () => {
    const r = new JourneyRunner(journey(), { adapter, launch: { "launch.kind": "other" } });
    await r.start();
    expect(r.chained).toBeUndefined();
    expect(r.current).toBe("handOver");
    expect(r.view().toast).toBe("This step opens another journey, which is not loaded here.");
  });

  it("lets a navigation rule of the screen that matches win, as it does over `to`", async () => {
    const j = journey();
    (j.screens.find((s) => s.id === "handOver") as any).navigation = { rules: [{ when: "t.note == 'hello'", to: "end" }] };
    const asked: ChainRequest[] = [];
    const r = new JourneyRunner(j, { adapter, launch: { "launch.kind": "other" }, openJourney: (q) => asked.push(q) });
    await r.start();
    expect(asked).toEqual([]);
    expect(r.current).toBe("end");
  });

  it("reaches the controller's callback", async () => {
    const asked: ChainRequest[] = [];
    const c = new JourneyController(journey(), { adapter, launch: { "launch.kind": "other" }, onOpenJourney: (q) => asked.push(q) });
    await c.start();
    expect(asked.map((q) => q.journey)).toEqual(["other-journey"]);
  });

  it("can start from a button, not only from an entry screen", async () => {
    const j = journey();
    (j.screens.find((s) => s.id === "choose") as any).blocks.push({ type: "button", label: "Elsewhere", actions: [{ type: "navigate", toJourney: "x-journey", with: { "a.b": 1 } }] });
    const asked: ChainRequest[] = [];
    const r = new JourneyRunner(j, { adapter, openJourney: (q) => asked.push(q) });
    await r.start();
    await r.press([{ type: "navigate", toJourney: "x-journey", with: { "a.b": 1 } }]);
    expect(asked).toEqual([{ journey: "x-journey", launch: { "a.b": 1 } }]);
  });
});

describe("get(map, key)", () => {
  it("reads an entry whose key is data, own entries only", () => {
    const scope = { m: { a: { n: 1 } }, k: "a" };
    expect(evaluate("get(m, k)", scope)).toEqual({ n: 1 });
    expect(evaluate("get(m, 'zzz')", scope)).toBeUndefined();
    expect(evaluate("get(m, 'constructor')", scope)).toBeUndefined();
    expect(evaluate("get(get(m, k), 'n')", scope)).toBe(1);
  });
});

describe("lint of a journey that opens another", () => {
  it("accepts `with` templates that read this journey's data", () => {
    expect(lintAll(journey()).filter((i) => i.code.startsWith("unknown") || i.code.startsWith("expression"))).toEqual([]);
  });

  it("flags a `with` template that reads something the journey does not have", () => {
    const j = journey();
    (j.screens.find((s) => s.id === "handOver") as any).onEnter[1].with["pt.note"] = "{{nope.thing}}";
    const issues = lintAll(j);
    expect(issues.some((i) => i.code === "unknown_reference" && i.message.includes("nope"))).toBe(true);
  });

  it("warns (without blocking) about a target that is not a known journey, and accepts a copy made for a bank", () => {
    const j = journey();
    expect(chainTargets(j)).toEqual(["other-journey"]);
    expect(chainWarnings(j, ["add-money", "other-journey"])).toEqual([]);
    expect(chainWarnings(j, ["other-journey-acme"])).toEqual([]);
    expect(chainWarnings(j, ["add-money"]).map((i) => i.code)).toEqual(["unknown_journey"]);
    expect(lintAll(j).map((i) => i.code)).not.toContain("unknown_journey");
  });
});
