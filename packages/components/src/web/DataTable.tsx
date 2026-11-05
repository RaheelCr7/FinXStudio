import { useId } from "react";
import type { DataTableProps } from "../props";
import { Icon } from "./Icon";
import { StatusChip } from "./StatusChip";

const cellOf = (c: { text: string; chip?: any } | undefined) => (c?.chip ? <StatusChip {...c.chip} /> : c?.text ?? "");

/** A list of records: search, filter chips, sortable headings, ticked rows and pages. On a phone the rows are cards. */
export function DataTable({ label, layout = "table", columns, rows, onSort, selectable, all = "none", onToggleRow, onToggleAll, selection, search, filters, page, empty, onClear, strings }: DataTableProps) {
  const id = useId();
  const sorted = columns.find((c) => c.sort);
  const first = columns[0];
  const sortable = columns.filter((c) => c.sortable);
  return (
    <section className="fxc-table" aria-label={label}>
      {search ? (
        <div className="fxc-tbl-search"><Icon name="search" size={16} /><input type="search" className="fxc-tbl-input" aria-label={strings.search} placeholder={strings.search} value={search.value} onChange={(e) => search.onChange(e.target.value)} /></div>
      ) : null}
      {filters?.map((f) => (
        <div key={f.key} role="group" aria-label={f.label} className="fxc-tbl-filter">
          <span className="fxc-tbl-filter-label">{f.label}</span>
          {[{ value: "", label: strings.all }, ...f.options].map((o) => (
            <button key={o.value || "all"} type="button" className={`fxc-tbl-chip ${f.value === o.value ? "is-on" : ""}`} aria-pressed={f.value === o.value} onClick={() => f.onChange(o.value)}>{o.label}</button>
          ))}
        </div>
      ))}
      {layout === "cards" && sortable.length ? (
        <div className="fxc-tbl-sortby">
          <label htmlFor={`${id}-sort`}>{strings.sortBy}</label>
          <select id={`${id}-sort`} className="fxc-tbl-select" value={sorted ? `${sorted.key}:${sorted.sort}` : ""} onChange={(e) => {
            const [key, dir] = e.target.value.split(":");
            onSort?.(key ?? "", (dir as "asc" | "desc" | undefined) ?? "none");
          }}>
            <option value="">—</option>
            {sortable.flatMap((c) => [<option key={`${c.key}a`} value={`${c.key}:asc`}>{c.label} ({strings.asc})</option>, <option key={`${c.key}d`} value={`${c.key}:desc`}>{c.label} ({strings.desc})</option>])}
          </select>
        </div>
      ) : null}
      {selection ? <p className="fxc-tbl-selection" role="status">{selection}</p> : null}

      {rows.length === 0 ? (
        <div className="fxc-tbl-empty" role="status"><p>{empty}</p>{onClear ? <button type="button" className="fxc-tbl-link" onClick={onClear}>{strings.clear}</button> : null}</div>
      ) : layout === "cards" ? (
        <ul className="fxc-tbl-cards">
          {rows.map((r) => (
            <li key={r.id} className={`fxc-tbl-card ${r.selected ? "is-selected" : ""}`}>
              <div className="fxc-tbl-card-head">
                {selectable ? <input type="checkbox" className="fxc-tbl-check" checked={!!r.selected} aria-label={strings.selectRow.replace("{name}", r.cells[first!.key]?.text ?? "")} onChange={() => onToggleRow?.(r.id)} /> : null}
                {r.onPress ? <button type="button" className="fxc-tbl-open" onClick={r.onPress}>{r.cells[first!.key]?.text}</button> : <strong>{r.cells[first!.key]?.text}</strong>}
              </div>
              <dl className="fxc-tbl-fields">
                {columns.slice(1).map((c) => (
                  <div key={c.key}><dt>{c.label}</dt><dd className={c.align === "end" ? "is-end" : undefined}>{cellOf(r.cells[c.key])}</dd></div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      ) : (
        <div className="fxc-tbl-scroll">
          <table className="fxc-tbl">
            <thead>
              <tr>
                {selectable ? (
                  <th scope="col" className="fxc-tbl-selectcol">
                    <input type="checkbox" className="fxc-tbl-check" aria-label={strings.selectAll} checked={all === "all"} ref={(el) => { if (el) el.indeterminate = all === "some"; }} onChange={() => onToggleAll?.()} />
                  </th>
                ) : null}
                {columns.map((c) => (
                  <th key={c.key} scope="col" className={c.align === "end" ? "is-end" : undefined} aria-sort={c.sort === "asc" ? "ascending" : c.sort === "desc" ? "descending" : c.sortable ? "none" : undefined}>
                    {c.sortable ? (
                      <button type="button" className="fxc-tbl-sort" onClick={() => onSort?.(c.key)}>{c.label}<Icon name={c.sort === "asc" ? "up" : c.sort === "desc" ? "down" : "minus"} size={12} stroke={2.5} /></button>
                    ) : c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.selected ? "is-selected" : undefined}>
                  {selectable ? <td className="fxc-tbl-selectcol"><input type="checkbox" className="fxc-tbl-check" checked={!!r.selected} aria-label={strings.selectRow.replace("{name}", r.cells[first!.key]?.text ?? "")} onChange={() => onToggleRow?.(r.id)} /></td> : null}
                  {columns.map((c, i) => (
                    <td key={c.key} className={c.align === "end" ? "is-end" : undefined}>
                      {i === 0 && r.onPress ? <button type="button" className="fxc-tbl-open" onClick={r.onPress}>{r.cells[c.key]?.text}</button> : cellOf(r.cells[c.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {page && page.pages > 1 ? (
        <nav className="fxc-tbl-pages" aria-label={label}>
          <button type="button" className="fxc-tbl-pagebtn" onClick={page.onPrev} disabled={page.index <= 0} aria-label={strings.prev}><Icon name="back" size={16} className="fxc-flip" /></button>
          <span role="status">{page.summary}</span>
          <button type="button" className="fxc-tbl-pagebtn" onClick={page.onNext} disabled={page.index >= page.pages - 1} aria-label={strings.next}><Icon name="chevronRight" size={16} className="fxc-flip" /></button>
        </nav>
      ) : page ? <p className="fxc-tbl-summary" role="status">{page.summary}</p> : null}
    </section>
  );
}
