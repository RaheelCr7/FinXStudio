import { describe, expect, it } from "vitest";
import { Journey as JourneySchema, lintJourney } from "@finx/journey-schema";
import { JourneyRunner } from "./runner";

const PAYMENTS = {
  p1: { id: "p1", payee: "Zeta Supplies", amount: 1200.5, status: "pending_approval", on: "2026-11-12" },
  p2: { id: "p2", payee: "Alpha Freight", amount: 80, status: "released", on: "2026-10-30" },
  p3: { id: "p3", payee: "Mid Co", amount: 20, status: "released", on: "2026-11-01" },
};
const weeks = [{ weekStart: "2026-11-09", inflow: 1000, closing: 600 }, { weekStart: "2026-11-16", inflow: 200, closing: -100 }];

const journey = (blocks: any[], dataModel: any = {}) => JourneySchema.parse({
  id: "jrn_t", slug: "t", name: "T", version: 1, status: "draft", channels: ["web"], locale: { default: "en", supported: ["en", "ur"] }, entryScreen: "s",
  dataModel, integrations: [],
  screens: [
    { id: "s", title: "S", blocks: [...blocks, { type: "button", label: "Go", actions: [{ type: "navigate", to: "end" }] }] },
    { id: "end", title: "End", kind: "terminal", blocks: [{ type: "button", label: "Close", actions: [{ type: "exit" }] }] },
  ],
});
const start = async (j: any, data: Record<string, any> = {}) => {
  const r = new JourneyRunner(j, { adapter: async () => ({}), launch: data });
  await r.start();
  return r;
};
const block = (r: JourneyRunner, type: string) => r.view().blocks.find((b) => b.type === type)!;

describe("statusChip", () => {
  it("reads the status from the data and gives known words their tone", async () => {
    const r = await start(journey([{ type: "statusChip", status: "{{pay.status}}" }]), { "pay.status": "pending_approval" });
    expect(block(r, "statusChip").chip).toEqual({ label: "Pending approval", tone: "warning", icon: "clock" });
  });
  it("uses the journey's words and tone for a value, and the block's own label over the default", async () => {
    const statuses = { pending_approval: { label: { en: "Waiting", ur: "انتظار" }, tone: "info" } };
    const r = await start(journey([{ type: "statusChip", status: "{{pay.status}}", statuses }]), { "pay.status": "pending_approval" });
    expect(block(r, "statusChip").chip).toMatchObject({ label: "Waiting", tone: "info" });
    r.setLang("ur");
    expect(block(r, "statusChip").chip.label).toBe("انتظار");
    const own = await start(journey([{ type: "statusChip", status: "paid", label: "All settled" }]));
    expect(block(own, "statusChip").chip).toMatchObject({ label: "All settled", tone: "positive" });
  });
});

describe("timeline", () => {
  const items = [
    { id: "a", title: "Started by {{pay.by}}", time: "{{pay.at}}" },
    { id: "b", title: "Released", state: "{{pay.status == 'released' ? 'done' : 'upcoming'}}" },
    { id: "c", title: "Only when rejected", state: "failed", visibleWhen: "pay.status == 'rejected'" },
  ];
  it("fills in the templates, reads a state from the data and hides a step whose rule is false", async () => {
    const r = await start(journey([{ type: "timeline", items }]), { "pay.by": "Priya", "pay.at": "12 Nov", "pay.status": "pending" });
    expect(block(r, "timeline").entries).toEqual([
      { id: "a", title: "Started by Priya", time: "12 Nov", state: "done" },
      { id: "b", title: "Released", state: "upcoming" },
    ]);
  });
  it("draws one step per row of a saved list, from the item template", async () => {
    const events = [{ id: "e1", what: "Submitted", state: "done" }, { id: "e2", what: "Review", state: "bogus" }];
    const r = await start(journey([{ type: "timeline", source: "ev", item: { title: "{{item.what}}", state: "{{item.state}}" } }]), { ev: events });
    expect(block(r, "timeline").entries.map((e: any) => [e.title, e.state])).toEqual([["Submitted", "done"], ["Review", "done"]]);
  });
});

describe("dataTable", () => {
  const table = (extra: any = {}) => ({
    type: "dataTable", source: "ctx.payments", label: "Payments", bind: "sel", total: { key: "amount", currency: "USD" },
    columns: [{ key: "payee", label: "Payee" }, { key: "amount", label: "Amount", type: "money", currency: "USD" }, { key: "status", label: "Status", type: "status" }, { key: "on", label: "Date", type: "date" }],
    ...extra,
  });
  it("turns a record of rows into formatted rows and says which are ticked, forgetting ids that are gone", async () => {
    const r = await start(journey([table()], { sel: { type: "array" } }), { "ctx.payments": PAYMENTS, sel: ["p1", "p3", "gone"] });
    const b = block(r, "dataTable");
    expect(b.rows.map((x: any) => x.id)).toEqual(["p1", "p2", "p3"]);
    expect(b.rows[0].cells.amount.text).toBe("$1,200.50");
    expect(b.selected).toEqual(["p1", "p3"]);
    expect(b.selectable).toBe(true);
    expect(b.selectionTotal).toBe("$1,220.50");
  });
  it("is not selectable without a bind, and fills {{item.x}} into a row's actions", async () => {
    const t = table({ bind: undefined, total: undefined, onRowPress: [{ type: "setData", path: "open", value: "{{item.id}}" }] });
    const r = await start(journey([t]), { "ctx.payments": PAYMENTS });
    const b = block(r, "dataTable");
    expect(b.selectable).toBe(false);
    expect(b.rows[1].actions).toEqual([{ type: "setData", path: "open", value: "p2" }]);
    await r.press(b.rows[1].actions);
    expect(r.get("open")).toBe("p2");
  });
  it("requires a tick when the data model says so", async () => {
    const r = await start(journey([table()], { sel: { type: "array", required: true } }), { "ctx.payments": PAYMENTS });
    expect(r.validate()).toBe(false);
    expect(r.errors.sel).toBe("Required");
    r.set("sel", ["p2"]);
    expect(r.validate()).toBe(true);
  });
  it("lints a row action that goes to a screen that does not exist", () => {
    const j = journey([table({ onRowPress: [{ type: "navigate", to: "nowhere" }] })], { sel: { type: "array" } });
    expect(lintJourney(j).map((i) => i.code)).toContain("dangling_target");
  });
});

describe("chart", () => {
  it("reads the rows into series and a table, with money in the given currency", async () => {
    const c = { type: "chart", kind: "line", source: "ctx.weeks", label: "Cash flow", x: "weekStart", xFormat: "date", series: [{ key: "inflow", label: "In" }, { key: "closing", label: "Closing" }], currency: "{{co.currency}}", table: true };
    const r = await start(journey([c]), { "ctx.weeks": weeks, "co.currency": "USD" });
    const v = block(r, "chart").chart;
    expect(v.series[1].points.map((p: any) => [p.label, p.text])).toEqual([["9 Nov", "$600.00"], ["16 Nov", "-$100.00"]]);
    expect(v.table.rows).toHaveLength(2);
  });
});

describe("dateInput range", () => {
  const range = () => journey([
    { type: "dateInput", bind: "r.from", label: "From" },
    { type: "dateInput", bind: "r.to", label: "To", min: "{{r.from}}" },
  ], { "r.from": { type: "string" }, "r.to": { type: "string" } });
  it("hands the other answer to the field as its earliest day, and refuses an end before the start", async () => {
    const r = await start(range(), { "r.from": "2026-11-10", "r.to": "2026-11-05" });
    expect(r.view().blocks[1]!.min).toBe("2026-11-10");
    expect(r.validate()).toBe(false);
    expect(r.errors["r.to"]).toBe("That date is too early");
    r.set("r.to", "2026-11-10");
    expect(r.validate()).toBe(true);
  });
  it("puts no limit while the start is not chosen yet", async () => {
    const r = await start(range(), { "r.to": "2026-11-05" });
    expect(r.view().blocks[1]!.min).toBeUndefined();
    expect(r.validate()).toBe(true);
  });
});
