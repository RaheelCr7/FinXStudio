import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as matchers from "vitest-axe/matchers";
import { JourneyRunner } from "@finx/renderer-core";
import { Journey } from "@finx/journey-schema";
import { axeCheck, renderBlock } from "./test-utils";

expect.extend(matchers as any);
afterEach(cleanup);

const PAYMENTS = {
  p1: { id: "p1", payee: "Zeta Supplies", amount: 1200.5, status: "pending_approval", on: "2026-11-12" },
  p2: { id: "p2", payee: "Alpha Freight", amount: 80, status: "released", on: "2026-10-30" },
  p3: { id: "p3", payee: "Mid Co", amount: 20, status: "released", on: "2026-11-01" },
};
const TABLE = {
  type: "dataTable", source: "ctx.payments", label: "Payments", bind: "sel", search: true, pageSize: 2, maxSelected: 2, total: { key: "amount", currency: "USD" },
  columns: [{ key: "payee", label: "Payee" }, { key: "amount", label: "Amount", type: "money", currency: "USD" }, { key: "status", label: "Status", type: "status", filter: true }],
};

/** The block as the engine resolves it for a screen, so the test draws what the player would. */
async function resolved(block: any, data: Record<string, any>) {
  const j = Journey.parse({ id: "j", slug: "j", name: "J", version: 1, status: "draft", channels: ["web"], locale: { default: "en", supported: ["en"] }, entryScreen: "s", dataModel: {}, integrations: [],
    screens: [{ id: "s", title: "S", blocks: [block] }] });
  const r = new JourneyRunner(j, { adapter: async () => ({}), launch: data });
  await r.start();
  return r.view().blocks[0]!;
}

describe("statusChip", () => {
  it("says the status in words and has no accessibility violations", async () => {
    const b = await resolved({ type: "statusChip", status: "pending_approval" }, {});
    const { container } = renderBlock("statusChip", b);
    expect(screen.getByText("Pending approval")).toBeTruthy();
    expect(container.querySelector(".fxc-status.is-warning svg")).toBeTruthy();
    expect(await axeCheck(container)).toHaveNoViolations();
  });
});

describe("timeline", () => {
  it("is an ordered list that names each state in words, and marks the current step", async () => {
    const b = await resolved({ type: "timeline", label: "Payment history", items: [{ id: "a", title: "Started", time: "12 Nov" }, { id: "b", title: "Waiting", state: "current" }, { id: "c", title: "Released", state: "upcoming" }] }, {});
    const { container } = renderBlock("timeline", b);
    const list = screen.getByRole("list", { name: "Payment history" });
    const items = within(list).getAllByRole("listitem");
    expect(items.map((i) => i.textContent)).toEqual(["Started (Done)12 Nov", "Waiting (In progress)", "Released (Not yet)"]);
    expect(items[1]!.getAttribute("aria-current")).toBe("step");
    expect(await axeCheck(container)).toHaveNoViolations();
  });
});

describe("dataTable", () => {
  it("is a real table with sortable headings, and sorting says so", async () => {
    const b = await resolved(TABLE, { "ctx.payments": PAYMENTS });
    const { container } = renderBlock("dataTable", b);
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["", "Payee", "Amount", "Status"]);
    await userEvent.click(screen.getByRole("button", { name: /^Amount/ }));
    expect(screen.getByRole("columnheader", { name: /Amount/ }).getAttribute("aria-sort")).toBe("ascending");
    expect(within(table).getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("cell")[1]!.textContent)).toEqual(["Mid Co", "Alpha Freight"]);
    await userEvent.click(screen.getByRole("button", { name: /^Amount/ }));
    expect(screen.getByRole("columnheader", { name: /Amount/ }).getAttribute("aria-sort")).toBe("descending");
    expect(await axeCheck(container)).toHaveNoViolations();
  });

  it("searches, filters, pages and offers to clear when nothing matches", async () => {
    const b = await resolved(TABLE, { "ctx.payments": PAYMENTS });
    renderBlock("dataTable", b);
    expect(screen.getByText("1–2 of 3")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("3–3 of 3")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Previous page" }));
    await userEvent.click(screen.getByRole("button", { name: "Released" }));
    expect(screen.getByText("1–2 of 2")).toBeTruthy();
    expect(screen.queryByText("Zeta Supplies")).toBeNull();
    await userEvent.type(screen.getByRole("searchbox", { name: "Search" }), "nothing");
    expect(screen.getByText("No rows match your search or filters.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Clear search and filters" }));
    expect(screen.getByText("Zeta Supplies")).toBeTruthy();
  });

  it("saves ticked rows, names each box by its row, stops at the limit and says how many and the total", async () => {
    const set = vi.fn();
    const b = await resolved(TABLE, { "ctx.payments": PAYMENTS, sel: ["p1", "p2"] });
    const { container } = renderBlock("dataTable", b, { set });
    expect((screen.getByRole("checkbox", { name: "Select Zeta Supplies" }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText("2 selected · total $1,280.50 · You can select up to 2.")).toBeTruthy();
    expect((screen.getByLabelText("Select all rows on this page") as HTMLInputElement).checked).toBe(true);
    await userEvent.click(screen.getByRole("checkbox", { name: "Select Zeta Supplies" }));
    expect(set).toHaveBeenLastCalledWith("sel", ["p2"]);
    expect(await axeCheck(container)).toHaveNoViolations();
  });

  it("ticks nothing beyond the limit", async () => {
    const set = vi.fn();
    const b = await resolved({ ...TABLE, pageSize: 10 }, { "ctx.payments": PAYMENTS, sel: ["p1", "p2"] });
    renderBlock("dataTable", b, { set });
    await userEvent.click(screen.getByRole("checkbox", { name: "Select Mid Co" }));
    expect(set).toHaveBeenLastCalledWith("sel", ["p1", "p2"]);
  });

  it("opens a row with its actions", async () => {
    const press = vi.fn();
    const b = await resolved({ ...TABLE, bind: undefined, total: undefined, onRowPress: [{ type: "setData", path: "open", value: "{{item.id}}" }] }, { "ctx.payments": PAYMENTS });
    renderBlock("dataTable", b, { press });
    await userEvent.click(screen.getByRole("button", { name: "Zeta Supplies" }));
    expect(press).toHaveBeenCalledWith([{ type: "setData", path: "open", value: "p1" }]);
  });

  it("turns into cards when its column is narrow, with the same names and no accessibility violations", async () => {
    const original = globalThis.ResizeObserver;
    let notify: () => void = () => {};
    globalThis.ResizeObserver = class { constructor(cb: () => void) { notify = cb; } observe() {} disconnect() {} unobserve() {} } as any;
    const width = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(375);
    try {
      const b = await resolved(TABLE, { "ctx.payments": PAYMENTS, sel: ["p1"] });
      const { container } = renderBlock("dataTable", b);
      await act(async () => notify());
      expect(screen.queryByRole("table")).toBeNull();
      const cards = within(screen.getByRole("list")).getAllByRole("listitem");
      expect(cards).toHaveLength(2);
      expect(within(cards[0]!).getByText("Pending approval")).toBeTruthy();
      expect(within(cards[0]!).getByText("$1,200.50")).toBeTruthy();
      expect((within(cards[0]!).getByRole("checkbox", { name: "Select Zeta Supplies" }) as HTMLInputElement).checked).toBe(true);
      expect(await axeCheck(container)).toHaveNoViolations();
    } finally { width.mockRestore(); globalThis.ResizeObserver = original; }
  });
});

describe("chart", () => {
  const weeks = [{ id: "w1", weekStart: "2026-11-09", inflow: 1000, closing: 600 }, { id: "w2", weekStart: "2026-11-16", inflow: 200, closing: 100 }];
  const LINE = { type: "chart", kind: "line", source: "ctx.weeks", label: "Cash flow", x: "weekStart", xFormat: "date", xLabel: "Week", series: [{ key: "inflow", label: "Money in" }, { key: "closing", label: "Closing" }], currency: "USD", table: true };
  it("draws a line with a switch between series, and the same numbers as a table", async () => {
    const b = await resolved(LINE, { "ctx.weeks": weeks });
    const { container } = renderBlock("chart", b);
    expect(screen.getByRole("group", { name: /Cash flow, Money in/ })).toBeTruthy();
    await userEvent.click(screen.getByRole("radio", { name: "Closing" }));
    expect(screen.getByRole("group", { name: /Cash flow, Closing/ })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Show as table" }));
    expect(within(screen.getByRole("table")).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Week", "Money in", "Closing"]);
    expect(screen.getByText("$1,000.00")).toBeTruthy();
    expect(await axeCheck(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole("button", { name: "Show as chart" }));
    expect(screen.queryByRole("table")).toBeNull();
  });
  it("draws a ring whose legend lists each share", async () => {
    const b = await resolved({ type: "chart", kind: "donut", source: "ctx.cats", label: "Spending", x: "name", series: [{ key: "total", label: "Total" }], currency: "USD" }, { "ctx.cats": [{ id: "a", name: "Rent", total: 750 }, { id: "b", name: "Food", total: 250 }] });
    const { container } = renderBlock("chart", b);
    const rent = screen.getByRole("button", { name: /Rent/ });
    expect(rent.textContent).toContain("$750.00");
    expect(rent.textContent).toContain("75%");
    await userEvent.click(rent);
    expect(rent.getAttribute("aria-pressed")).toBe("true");
    expect(await axeCheck(container)).toHaveNoViolations();
  });
});
