import type { BalanceListProps } from "../props";

export function BalanceList({ rows }: BalanceListProps) {
  return (
    <ul className="fxc-balances">
      {rows.map((r) => (
        <li key={r.id} className="fxc-balance">
          <div className="fxc-balance-main">
            <span className="fxc-balance-title">{r.title}</span>
            {r.tag ? <span className="fxc-balance-tag">{r.tag}</span> : null}
          </div>
          <div className="fxc-balance-side">
            <span className="fxc-balance-amount">{r.amount}</span>
            {r.caption ? <span className="fxc-balance-caption">{r.caption}</span> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
