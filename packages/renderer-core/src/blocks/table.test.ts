import { describe, expect, it } from "vitest";
import { dateText, initialTable, liveSelection, nextSort, pageState, selectionTotal, statusChip, tableColumns, tableRow, tableView, togglePage, toggleRow, type TableModel } from "./index";

const say = (t: unknown) => String(t);
const defs: any[] = [
  { key: "payee", label: "Payee" },
  { key: "amount", label: "Amount", type: "money", currency: "USD" },
  { key: "on", label: "Date", type: "date" },
  { key: "status", label: "Status", type: "status", filter: true, statuses: { pending_approval: { label: "Waiting for approval" } } },
];
const items = [
  { id: "p1", payee: "Zeta Supplies", amount: 1200.5, on: "2026-11-12", status: "pending_approval" },
  { id: "p2", payee: "alpha Freight", amount: 80, on: "2026-10-30", status: "released" },
  { id: "p3", payee: "Mid Co", amount: 9999.99, on: "2026-11-01", status: "rejected" },
  { id: "p4", payee: "Empty Co", amount: null, on: "2026-11-02", status: "released" },
];
const model = (over: Partial<TableModel> = {}): TableModel => ({ columns: tableColumns(defs, say), rows: items.map((x) => tableRow(x, x.id, defs, say)), ...over });

describe("table cells", () => {
  it("writes money with the currency's digits, dates for a person, and a chip for a status", () => {
    const r = model().rows[0]!;
    expect(r.cells.amount).toEqual({ text: "$1,200.50", sort: 1200.5 });
    expect(r.cells.on).toEqual({ text: "12 Nov 2026", sort: "2026-11-12" });
    expect(r.cells.status!.chip).toEqual({ label: "Waiting for approval", tone: "warning", icon: "clock" });
    expect(model().rows[1]!.cells.status!.chip).toMatchObject({ label: "Released", tone: "positive" });
  });
  it("always shows two decimals for dollars and three for dinars", () => {
    expect(tableRow({ a: 80 }, "x", [{ key: "a", label: "A", type: "money", currency: "USD" }], say).cells.a!.text).toBe("$80.00");
    expect(tableRow({ a: 12.5, c: "JOD" }, "x", [{ key: "a", label: "A", type: "money", currencyKey: "c" }], say).cells.a!.text).toBe("JOD 12.500");
  });
  it("lines numbers up at the end and text at the start", () => {
    expect(tableColumns(defs, say).map((c) => c.align)).toEqual(["start", "end", "start", "start"]);
  });
  it("reads dates in any day of the year and leaves anything else alone", () => {
    expect([dateText("2026-01-05"), dateText("2026-12-31T08:41:00Z"), dateText("soon"), dateText(undefined)]).toEqual(["5 Jan 2026", "31 Dec 2026", "soon", ""]);
  });
});

describe("sort, search, filter and pages", () => {
  const order = (v: ReturnType<typeof tableView>) => v.rows.map((r) => r.id);
  it("keeps the order the list came in until a heading is pressed", () => {
    expect(order(tableView(model(), initialTable()))).toEqual(["p1", "p2", "p3", "p4"]);
  });
  it("sorts text without regard to case, numbers by value, and puts empty values last either way", () => {
    expect(order(tableView(model(), { ...initialTable(), sort: { key: "payee", dir: "asc" } }))).toEqual(["p2", "p4", "p3", "p1"]);
    expect(order(tableView(model(), { ...initialTable(), sort: { key: "amount", dir: "asc" } }))).toEqual(["p2", "p1", "p3", "p4"]);
    expect(order(tableView(model(), { ...initialTable(), sort: { key: "amount", dir: "desc" } }))).toEqual(["p3", "p1", "p2", "p4"]);
  });
  it("cycles ascending, descending, then the original order; another heading starts ascending", () => {
    let s = initialTable();
    s = nextSort(s, "amount"); expect(s.sort).toEqual({ key: "amount", dir: "asc" });
    s = nextSort(s, "amount"); expect(s.sort).toEqual({ key: "amount", dir: "desc" });
    s = nextSort(s, "amount"); expect(s.sort).toBeUndefined();
    s = nextSort(nextSort(s, "amount"), "payee"); expect(s.sort).toEqual({ key: "payee", dir: "asc" });
  });
  it("searches every column's text, and filters a column to one value", () => {
    expect(order(tableView(model(), { ...initialTable(), query: "freight" }))).toEqual(["p2"]);
    expect(order(tableView(model(), { ...initialTable(), query: "12 nov" }))).toEqual(["p1"]);
    const v = tableView(model(), { ...initialTable(), filters: { status: "Released" } });
    expect(order(v)).toEqual(["p2", "p4"]);
    expect(v.active).toBe(true);
    expect(v.filters[0]!.options.map((o) => o.value)).toEqual(["Rejected", "Released", "Waiting for approval"]);
  });
  it("splits into pages, clamps a page that no longer exists and counts the rows across pages", () => {
    const m = model({ pageSize: 3 });
    const first = tableView(m, initialTable());
    expect([order(first), first.pages, first.from, first.to, first.total]).toEqual([["p1", "p2", "p3"], 2, 1, 3, 4]);
    const second = tableView(m, { ...initialTable(), page: 9 });
    expect([order(second), second.page, second.from, second.to]).toEqual([["p4"], 1, 4, 4]);
    expect(tableView(m, { ...initialTable(), query: "nothing" })).toMatchObject({ rows: [], total: 0, pages: 1, from: 0, to: 0, all: 4 });
  });
});

describe("selection", () => {
  it("ticks and unticks rows and stops at the limit", () => {
    expect(toggleRow([], "a")).toEqual(["a"]);
    expect(toggleRow(["a"], "a")).toEqual([]);
    expect(toggleRow(["a", "b"], "c", 2)).toEqual(["a", "b"]);
    expect(toggleRow(["a", "b"], "a", 2)).toEqual(["b"]);
  });
  it("ticks a whole page, keeps ticks from other pages, and unticks the page when all of it was ticked", () => {
    expect(togglePage(["z"], ["a", "b"])).toEqual(["z", "a", "b"]);
    expect(togglePage(["z", "a", "b"], ["a", "b"])).toEqual(["z"]);
    expect(togglePage([], ["a", "b", "c"], 2)).toEqual(["a", "b"]);
    expect([pageState(["a"], ["a", "b"]), pageState(["a", "b"], ["a", "b"]), pageState([], ["a"])]).toEqual(["some", "all", "none"]);
  });
  it("forgets ticked rows that are no longer in the list", () => {
    expect(liveSelection(["p1", "gone"], model().rows)).toEqual(["p1"]);
    expect(liveSelection(undefined, model().rows)).toEqual([]);
  });
  it("adds up the ticked amounts without floating-point drift", () => {
    const rows = ["0.1", "0.2"].map((n, i) => tableRow({ amount: n }, `r${i}`, [{ key: "amount", label: "A", type: "money", currency: "USD" }], say));
    expect(selectionTotal(rows, ["r0", "r1"], "amount", "USD")).toBe("$0.30");
    expect(selectionTotal(rows, [], "amount", "USD")).toBe("");
  });
});

describe("status chip", () => {
  it("gives known words a tone, an icon and a readable label, and anything else a neutral chip", () => {
    expect(statusChip("pending_approval")).toEqual({ label: "Pending approval", tone: "warning", icon: "clock" });
    expect(statusChip("Rejected").tone).toBe("negative");
    expect(statusChip("something-new")).toEqual({ label: "Something new", tone: "neutral", icon: "minus" });
  });
  it("lets the journey replace the words and the tone", () => {
    expect(statusChip("paid", { label: "Settled", tone: "info" })).toEqual({ label: "Settled", tone: "info", icon: "info" });
    expect(statusChip("paid", { tone: "bogus" }).tone).toBe("positive");
  });
});
