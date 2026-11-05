import { describe, expect, it } from "vitest";
import { axisLabel, chartView } from "./index";

const weeks = [
  { weekStart: "2026-11-09", inflow: 1000, outflow: 400, closing: 600 },
  { weekStart: "2026-11-16", inflow: 200, outflow: 900, closing: -100 },
];
describe("chart view", () => {
  const v = chartView(weeks, { x: "weekStart", xFormat: "date", series: [{ key: "inflow", label: "In" }, { key: "closing", label: "Closing" }] }, String, "USD");
  it("makes one series per column, with the number as it is read out", () => {
    expect(v.series.map((s) => s.label)).toEqual(["In", "Closing"]);
    expect(v.series[1]!.points).toEqual([{ label: "9 Nov", value: 600, text: "$600.00" }, { label: "16 Nov", value: -100, text: "-$100.00" }]);
  });
  it("makes slices from the first series, leaving out what is not positive", () => {
    expect(chartView(weeks, { x: "weekStart", series: [{ key: "closing", label: "C" }] }, String, "").slices).toEqual([{ label: "2026-11-09", value: 600, text: "600", tone: 1 }]);
  });
  it("gives the same numbers as table rows", () => {
    expect(v.table.columns.map((c) => c.key)).toEqual(["x", "inflow", "closing"]);
    expect(v.table.rows[0]!.cells.closing).toEqual({ text: "$600.00", sort: 600 });
  });
  it("treats a missing number as zero rather than breaking the drawing", () => {
    expect(chartView([{ a: "x" }], { series: [{ key: "a", label: "A" }] }, String, "").series[0]!.points[0]!.value).toBe(0);
  });
  it("shortens a date for an axis and leaves other text alone", () => {
    expect([axisLabel("2026-11-09", "date"), axisLabel("Week 1", "date"), axisLabel("2026-11-09", "text")]).toEqual(["9 Nov", "Week 1", "2026-11-09"]);
  });
});
