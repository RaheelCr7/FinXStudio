import { formatMoney } from "@finx/ui-kit";
import { dateText, type TableColumn, type TableRow } from "./table";

export type ChartPointView = { label: string; value: number; /** The value as it is read out: 12,400.00 or $12,400.00. */ text: string };
export type ChartSeriesView = { key: string; label: string; points: ChartPointView[] };
export type ChartSlice = { label: string; value: number; text: string; /** 1 to 6: which of the bank's chart colours. */ tone: number };
export type ChartView = {
  series: ChartSeriesView[];
  slices: ChartSlice[];
  /** What the slices add up to, written like a point. */
  totalText: string;
  /** The same numbers as rows, for a person who cannot read a drawing. */
  table: { columns: TableColumn[]; rows: TableRow[] };
};

/** Short date for an axis or a tooltip: 9 Nov. Anything that is not a date is shown as it is. */
export const axisLabel = (v: unknown, kind: "text" | "date"): string => {
  if (kind !== "date") return v == null ? "" : String(v);
  const full = dateText(v);
  return /^\d{1,2} \w{3} \d{4}$/.test(full) ? full.replace(/ \d{4}$/, "") : full;
};

type ChartDef = { x?: string; xLabel?: string; series: { key: string; label: unknown }[]; xFormat?: "text" | "date"; currency?: string };

/** The rows of a list as points of a line chart (one series per column) and as slices of a ring (the first series, negatives left out). */
export function chartView(items: any[], b: ChartDef, say: (t: unknown) => string, currency: string): ChartView {
  const money = (n: number) => (currency ? formatMoney(n, currency, "en-US", undefined, true) : n.toLocaleString("en-US", { maximumFractionDigits: 2 }));
  const kind = b.xFormat ?? "text";
  const labelOf = (it: any, i: number) => (b.x ? axisLabel(it?.[b.x], kind) : String(i + 1));
  const series = b.series.map((s) => ({
    key: s.key, label: say(s.label),
    points: items.map((it, i) => { const n = Number(it?.[s.key]); const v = Number.isFinite(n) ? n : 0; return { label: labelOf(it, i), value: v, text: money(v) }; }),
  }));
  const first = series[0];
  const slices = (first?.points ?? []).filter((p) => p.value > 0).map((p, i) => ({ label: p.label, value: p.value, text: p.text, tone: (i % 6) + 1 }));
  const totalText = money(Math.round(slices.reduce((n, x) => n + x.value, 0) * 1000) / 1000);
  const columns: TableColumn[] = [
    { key: "x", label: b.xLabel ?? b.x ?? "", type: "text", align: "start", sortable: false, filter: false },
    ...series.map((s) => ({ key: s.key, label: s.label, type: "money" as const, align: "end" as const, sortable: false, filter: false })),
  ];
  const rows: TableRow[] = items.map((it, i) => ({
    id: String(it?.id ?? i),
    cells: { x: { text: labelOf(it, i), sort: labelOf(it, i) }, ...Object.fromEntries(series.map((s) => [s.key, { text: s.points[i]!.text, sort: s.points[i]!.value }])) },
  }));
  return { series, slices, totalText, table: { columns, rows } };
}
