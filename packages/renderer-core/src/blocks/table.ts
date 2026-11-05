import { formatMoney } from "@finx/ui-kit";
import { statusChip, type StatusChipView } from "./status";

export type ColumnType = "text" | "number" | "money" | "date" | "status";
export type TableColumn = { key: string; label: string; type: ColumnType; align: "start" | "end"; sortable: boolean; filter: boolean };
/** One cell as it is drawn (`text`) and as it is ordered (`sort`). A status cell also carries its chip. */
export type TableCell = { text: string; sort: string | number; chip?: StatusChipView };
export type TableRow = { id: string; cells: Record<string, TableCell>; /** Run when the row is opened; {{item.x}} is already filled in from the row. */ actions?: any[] };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** A saved date (YYYY-MM-DD, or a time that starts with one) as a person reads it: 12 Nov 2026. */
export function dateText(v: unknown): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v ?? ""));
  return m && MONTHS[Number(m[2]) - 1] ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : v == null ? "" : String(v);
}

type ColumnDef = { key: string; label: unknown; type?: ColumnType; currency?: string; currencyKey?: string; sortable?: boolean; filter?: boolean; align?: "start" | "end"; statuses?: Record<string, { label?: unknown; tone?: unknown }> };

/** The columns of a table block, with the label in the screen's language. Numbers and money line up at the end of the cell. */
export function tableColumns(defs: ColumnDef[], say: (t: unknown) => string): TableColumn[] {
  return defs.map((c) => {
    const type = c.type ?? "text";
    return { key: c.key, label: say(c.label), type, align: c.align ?? (type === "money" || type === "number" ? "end" : "start"), sortable: c.sortable !== false, filter: !!c.filter };
  });
}

/** One entry of a list as a row: every column's value, written for a person and ready to order. */
export function tableRow(item: any, id: string, defs: ColumnDef[], say: (t: unknown) => string, actions?: any[]): TableRow {
  const cells: Record<string, TableCell> = {};
  for (const c of defs) {
    const v = item?.[c.key];
    const type = c.type ?? "text";
    if (type === "money") {
      const cur = c.currency ?? (c.currencyKey ? item?.[c.currencyKey] : undefined);
      const n = v == null || v === "" ? NaN : Number(v);
      cells[c.key] = { text: Number.isNaN(n) ? "" : cur ? formatMoney(n, String(cur), "en-US", undefined, true) : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), sort: Number.isNaN(n) ? "" : n };
    } else if (type === "number") {
      const n = v == null || v === "" ? NaN : Number(v);
      cells[c.key] = { text: Number.isNaN(n) ? "" : n.toLocaleString("en-US", { maximumFractionDigits: 6 }), sort: Number.isNaN(n) ? "" : n };
    } else if (type === "date") {
      cells[c.key] = { text: dateText(v), sort: v == null ? "" : String(v) };
    } else if (type === "status") {
      const o = c.statuses?.[String(v)];
      const chip = statusChip(v, { label: o?.label != null ? say(o.label) : undefined, tone: o?.tone });
      cells[c.key] = { text: chip.label, sort: chip.label, chip };
    } else {
      const text = v == null ? "" : String(v);
      cells[c.key] = { text, sort: text };
    }
  }
  return { id, cells, ...(actions?.length ? { actions } : {}) };
}

export type TableState = { sort?: { key: string; dir: "asc" | "desc" }; query: string; filters: Record<string, string>; page: number };
export const initialTable = (sort?: TableState["sort"]): TableState => ({ ...(sort ? { sort } : {}), query: "", filters: {}, page: 0 });

/** Pressing a heading: ascending, then descending, then the order the list came in. Another heading starts ascending. */
export function nextSort(state: TableState, key: string): TableState {
  const cur = state.sort;
  const sort = cur?.key !== key ? { key, dir: "asc" as const } : cur.dir === "asc" ? { key, dir: "desc" as const } : undefined;
  return { ...state, ...(sort ? { sort } : { sort: undefined }), page: 0 };
}

/** An order chosen from a list (the cards on a phone have no headings): that column and direction, or the original order for "none". */
export const setSort = (state: TableState, key: string, dir: "asc" | "desc" | "none"): TableState =>
  ({ ...state, sort: dir === "none" || !key ? undefined : { key, dir }, page: 0 });

const compare = (a: string | number, b: string | number): number => {
  // empty values go last whichever way the column is ordered
  if (a === "" || b === "") return a === b ? 0 : a === "" ? 1 : -1;
  return typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
};

export type TableModel = { columns: TableColumn[]; rows: TableRow[]; pageSize?: number; search?: boolean; maxSelected?: number };
export type TableFilter = { key: string; label: string; value: string; options: { value: string; label: string }[] };
export type TableView = {
  rows: TableRow[];
  /** Rows that pass the search and the filters, over all pages. */
  total: number;
  all: number;
  page: number; pages: number; from: number; to: number;
  filters: TableFilter[];
  sorted?: { key: string; dir: "asc" | "desc" };
  active: boolean;
};

/** What to draw for the current search, filters, order and page. Pure: the same inputs give the same rows. */
export function tableView(m: TableModel, s: TableState): TableView {
  const q = s.query.trim().toLowerCase();
  const filterCols = m.columns.filter((c) => c.filter);
  const keep = (r: TableRow) =>
    (!q || Object.values(r.cells).some((c) => c.text.toLowerCase().includes(q))) &&
    filterCols.every((c) => !s.filters[c.key] || r.cells[c.key]?.text === s.filters[c.key]);
  let rows = m.rows.filter(keep);
  const total = rows.length;
  if (s.sort && m.columns.some((c) => c.key === s.sort!.key)) {
    const { key, dir } = s.sort;
    rows = rows.map((r, i) => ({ r, i })).sort((a, b) => {
      const x = a.r.cells[key]?.sort ?? "", y = b.r.cells[key]?.sort ?? "";
      if (x === "" || y === "") return compare(x, y) || a.i - b.i;
      return (dir === "asc" ? compare(x, y) : compare(y, x)) || a.i - b.i;
    }).map((x) => x.r);
  }
  const size = m.pageSize && m.pageSize > 0 ? m.pageSize : rows.length || 1;
  const pages = Math.max(1, Math.ceil(total / size));
  const page = Math.min(Math.max(0, s.page), pages - 1);
  const slice = rows.slice(page * size, page * size + size);
  const filters = filterCols.map((c) => ({
    key: c.key, label: c.label, value: s.filters[c.key] ?? "",
    options: [...new Set(m.rows.map((r) => r.cells[c.key]?.text ?? "").filter(Boolean))].sort(compare).map((v) => ({ value: v, label: v })),
  }));
  return {
    rows: slice, total, all: m.rows.length, page, pages, from: total ? page * size + 1 : 0, to: page * size + slice.length, filters,
    ...(s.sort ? { sorted: s.sort } : {}), active: !!q || filterCols.some((c) => !!s.filters[c.key]),
  };
}

/** The selection after one row is ticked or unticked. A tick past `max` is ignored. */
export function toggleRow(selected: string[], id: string, max?: number): string[] {
  if (selected.includes(id)) return selected.filter((x) => x !== id);
  return max && selected.length >= max ? selected : [...selected, id];
}
/** The selection after the "select all" tick of the current page: all of its rows, or none of them when they were all selected. */
export function togglePage(selected: string[], pageIds: string[], max?: number): string[] {
  if (pageIds.length && pageIds.every((id) => selected.includes(id))) return selected.filter((id) => !pageIds.includes(id));
  const out = [...selected];
  for (const id of pageIds) if (!out.includes(id) && (!max || out.length < max)) out.push(id);
  return out;
}
export const pageState = (selected: string[], pageIds: string[]): "all" | "some" | "none" => {
  const n = pageIds.filter((id) => selected.includes(id)).length;
  return n === 0 ? "none" : n === pageIds.length ? "all" : "some";
};
/** Ids still in the list: a selection that outlives its rows (the list was reloaded) drops the ones that are gone. */
export const liveSelection = (selected: unknown, rows: TableRow[]): string[] => {
  const ids = new Set(rows.map((r) => r.id));
  return Array.isArray(selected) ? selected.map(String).filter((id) => ids.has(id)) : [];
};

/** The sum of one money column over the ticked rows, written in the table's one currency ("$1,200.00"). Empty when nothing is ticked. */
export function selectionTotal(rows: TableRow[], selected: string[], key: string, currency: string): string {
  const picked = rows.filter((r) => selected.includes(r.id));
  if (!picked.length || !currency) return "";
  // sum in minor units so 0.1 + 0.2 stays 0.3
  const minor = picked.reduce((sum, r) => sum + Math.round(Number(r.cells[key]?.sort || 0) * 1000), 0);
  return formatMoney(minor / 1000, currency, "en-US", undefined, true);
}
