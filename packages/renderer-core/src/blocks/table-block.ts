import { ui } from "../strings";
import { initialTable, nextSort, pageState, setSort, tableView, togglePage, toggleRow, type TableState } from "./table";

/** How many rows a page holds when the block does not say. */
export const DEFAULT_PAGE_SIZE = 25;
/** Narrower than this many pixels, a table becomes a list of cards. */
export const CARDS_BELOW = 520;

export const tableStrings = (lang: string) => ({
  search: ui(lang, "tableSearch"), all: ui(lang, "tableAll"), clear: ui(lang, "tableClear"), prev: ui(lang, "tablePrev"), next: ui(lang, "tableNext"), // the component fills in the row's name
  selectRow: ui(lang, "tableSelectRow", { name: "{name}" }),
  selectAll: ui(lang, "tableSelectAll"), sortBy: ui(lang, "tableSortBy"), asc: ui(lang, "tableSortAsc"), desc: ui(lang, "tableSortDesc"), open: ui(lang, "tableOpen"),
});

export { initialTable };
export const initialTableFor = (b: Record<string, any>): TableState => initialTable(b.sort ? { key: b.sort.key, dir: b.sort.dir ?? "asc" } : undefined);

/**
 * Everything the shared DataTable component needs, from a table block the runner resolved and the table's own state (sort, search, filters, page).
 * Ticking rows writes the ids to the block's `bind`; the other state stays in the renderer, so a table is never part of a journey's answers.
 */
export function dataTableProps(b: Record<string, any>, lang: string, state: TableState, setState: (s: TableState) => void, set: (path: string, value: any) => void, press: (actions: any[]) => void, layout: "table" | "cards") {
  const view = tableView({ columns: b.columns, rows: b.rows, pageSize: b.pageSize ?? DEFAULT_PAGE_SIZE }, state);
  const selected: string[] = b.selected ?? [];
  const pageIds = view.rows.map((r) => r.id);
  const pick = (ids: string[]) => set(b.bind, ids);
  const sorted = view.sorted;
  const n = selected.length;
  const atLimit = !!b.maxSelected && n >= b.maxSelected;
  const selection = n ? [ui(lang, "tableSelected", { n }), b.selectionTotal ? ui(lang, "tableTotal", { amount: b.selectionTotal }) : "", atLimit ? ui(lang, "tableLimit", { n: b.maxSelected }) : ""].filter(Boolean).join(" · ") : undefined;
  return {
    label: b.label, layout,
    columns: b.columns.map((c: any) => ({ key: c.key, label: c.label, align: c.align, sortable: c.sortable, ...(sorted && sorted.key === c.key ? { sort: sorted.dir } : {}) })),
    rows: view.rows.map((r) => ({ id: r.id, cells: r.cells, selected: selected.includes(r.id), ...(r.actions ? { onPress: () => press(r.actions!) } : {}) })),
    onSort: (key: string, dir?: "asc" | "desc" | "none") => setState(dir ? setSort(state, key, dir) : nextSort(state, key)),
    selectable: !!b.selectable, all: pageState(selected, pageIds),
    onToggleRow: (id: string) => pick(toggleRow(selected, id, b.maxSelected)),
    onToggleAll: () => pick(togglePage(selected, pageIds, b.maxSelected)),
    ...(selection ? { selection } : {}),
    ...(b.search ? { search: { value: state.query, onChange: (query: string) => setState({ ...state, query, page: 0 }) } } : {}),
    filters: view.filters.map((f) => ({ ...f, onChange: (value: string) => setState({ ...state, filters: { ...state.filters, [f.key]: value }, page: 0 }) })),
    ...(view.pages > 1 || view.active ? { page: { summary: ui(lang, "tableRange", { from: view.from, to: view.to, total: view.total }), index: view.page, pages: view.pages, onPrev: () => setState({ ...state, page: view.page - 1 }), onNext: () => setState({ ...state, page: view.page + 1 }) } } : {}),
    empty: view.active ? ui(lang, "tableNoMatch") : b.empty ?? ui(lang, "tableEmpty"),
    ...(view.active ? { onClear: () => setState({ ...state, query: "", filters: {}, page: 0 }) } : {}),
    strings: tableStrings(lang),
  };
}
