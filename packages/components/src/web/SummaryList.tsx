import type { SummaryListProps } from "../props";

export function SummaryList({ rows }: SummaryListProps) {
  return (
    <dl className="fxc-summary">
      {rows.map((r, i) => <div key={i} className="fxc-summary-row"><dt>{r.label}</dt><dd>{r.value}</dd></div>)}
    </dl>
  );
}
