"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { accountItems, budgetDetail, budgetIcon, budgetProgress, cardPictureNumber, dayLabel, filterTransactions, groupByDay, hasAction, networkName, usd, type Period, type TxnKind } from "@finx/bank-client";
import { CardVisual, Icon, IconTile, Pill, ProgressBar, Segmented } from "@finx/renderer-web";
import { useApp, useAppState } from "../AppProvider";
import { TxnRow } from "./parts";

const Empty = ({ icon, title, text }: { icon: string; title: string; text: string }) => (
  <div className="wb-panel wb-empty"><IconTile icon={icon} size={52} /><b>{title}</b><p className="wb-muted">{text}</p></div>
);

const PageTitle = ({ title, addHref, addLabel }: { title: string; addHref?: string; addLabel?: string }) => (
  <div className="wb-page-title"><h1>{title}</h1>{addHref ? <Link href={addHref} prefetch={false} className="wb-add" aria-label={addLabel}><Icon name="plus" size={16} stroke={3} /></Link> : null}</div>
);

export function Accounts() {
  const { app, project } = useApp();
  const s = useAppState();
  const fin = app.persona.finance!;
  const items = accountItems(app.persona, fin);
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<TxnKind>("all");
  const list = useMemo(() => filterTransactions(fin.transactions, q, kind), [fin.transactions, q, kind, s.tick]);
  const groups = useMemo(() => groupByDay(list), [list]);
  const [open, setOpen] = useState<string | null>(null);
  const current = sel ?? items[0]?.id;
  return (
    <div className="wb-page" key={s.tick}>
      <PageTitle title="Connected Accounts" addHref={hasAction(s.catalog.entries, "connect-account") ? `/${project.id}/j/connect-account` : undefined} addLabel="Connect an account" />
      {items.length === 0 ? <Empty icon="bank" title="No accounts yet" text="Connect a bank to see its balance and activity here." /> : (
        <div role="radiogroup" aria-label="Accounts"><ul className="wb-acct-row">
          {items.map((x) => (
            <li key={x.id}>
              <label className={`wb-acct ${current === x.id ? "is-on" : ""}`}>
                <input type="radio" className="fx-radio-input" name="acct" checked={current === x.id} onChange={() => setSel(x.id)} aria-label={`${x.bank} ${x.name} ${x.mask}, ${usd(x.balance)}`} />
                <IconTile icon="bank" size={38} /><small>{x.name}</small><b className="wb-num">{usd(x.balance)}</b><span className="wb-muted">{x.bank} {x.mask}</span>
              </label>
            </li>
          ))}
        </ul></div>
      )}
      <section className="wb-panel" aria-labelledby="acc-tx">
        <h2 id="acc-tx">Transactions</h2>
        <div className="wb-tools">
          <label className="wb-search"><Icon name="search" size={18} /><span className="wb-sr">Search transactions</span><input type="search" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <Segmented label="Show" value={kind} onChange={setKind} options={[{ id: "all", label: "All" }, { id: "in", label: "Money in" }, { id: "out", label: "Money out" }]} />
        </div>
        {groups.length === 0 ? <p className="wb-muted wb-center">No transactions match.</p> : groups.map(([d, ts]) => (
          <div key={d}><h3 className="wb-day">{dayLabel(d)}</h3><ul className="wb-txn-list">{ts.map((t) => <TxnRow key={t.id} t={t} money={usd} open={open === t.id} onToggle={() => setOpen(open === t.id ? null : t.id)} />)}</ul></div>
        ))}
      </section>
    </div>
  );
}

export function Budgets() {
  const { app, project } = useApp();
  const s = useAppState();
  const budgets = app.persona.finance!.budgets;
  return (
    <div className="wb-page" key={s.tick}>
      <PageTitle title="Monthly Budgets" addHref={hasAction(s.catalog.entries, "create-budget") ? `/${project.id}/j/create-budget` : undefined} addLabel="Create a budget" />
      {budgets.length === 0 ? <Empty icon="budgets" title="No budgets yet" text="Set a monthly limit for a category and track it here." /> : (
        <ul className="wb-cards wb-cards-wide">
          {budgets.map((b) => {
            const { pct, tone } = budgetProgress(b);
            return (
              <li key={b.id}>
                <Link className="wb-budget" href={`/${project.id}/budgets/${b.id}`} aria-label={`${b.name} budget`}>
                  <span className="wb-budget-head"><IconTile icon={budgetIcon(b.name)} size={44} /><span><b>{b.name}</b><small>{usd(b.limit)}/month</small></span><Icon name="chevronRight" size={18} /></span>
                  <span className="wb-budget-left"><b className="wb-num">{usd(Math.max(0, b.limit - b.spent))}</b> <small>left out of {usd(b.limit)}</small></span>
                  <ProgressBar value={b.spent} max={b.limit} tone={tone === "ok" ? "positive" : tone === "warn" ? "warning" : "negative"} label={`${b.name} budget used`} />
                  <span className="wb-budget-foot"><small>{Math.round(pct * 100)}% used</small><small>{usd(b.limit - b.spent)} remaining</small></span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** The dark budget screen from the design: what is left, what was spent, and a daily allowance. */
export function BudgetDetail() {
  const { id } = useParams<{ id: string }>();
  const { app, project } = useApp();
  const s = useAppState();
  const fin = app.persona.finance!;
  const b = fin.budgets.find((x) => x.id === id);
  const [period, setPeriod] = useState<Period>("week");
  if (!b) return <div className="wb-page"><Empty icon="budgets" title="Budget not found" text="It may have been removed." /><Link className="wb-btn wb-btn-primary" href={`/${project.id}/budgets`}>Back to budgets</Link></div>;
  const d = budgetDetail(b, fin.transactions, period);
  const col = d.tone === "ok" ? "var(--c-chart3)" : d.tone === "warn" ? "var(--c-chart4)" : "var(--c-negative)";
  return (
    <div className="wb-page wb-dark" key={s.tick}>
      <Link href={`/${project.id}/budgets`} className="wb-back"><Icon name="back" size={20} /> Budgets</Link>
      <h1>{b.name} Budget</h1>
      <div className="wb-big" style={{ color: col }}><b>{usd(d.left)}</b><small>left out of {usd(b.limit)}</small></div>
      <div className="wb-two"><div><b className="wb-num">{usd(b.spent)}</b><small>SPENT</small></div><div><b className="wb-num">{usd(d.left)}</b><small>BALANCE</small></div></div>
      <ProgressBar value={b.spent} max={b.limit} tone={d.tone === "ok" ? "positive" : d.tone === "warn" ? "warning" : "negative"} label={`${b.name} budget used`} />
      <p className="wb-center wb-small">{Math.round(d.pct * 100)}% used · {d.daysLeft} days left</p>
      <p className="wb-box">You can spend <b style={{ color: col }}>{usd(d.perDay)}</b> each day for the rest of the period.</p>
      <h2>Transactions</h2>
      <Segmented dark label="Period" value={period} onChange={setPeriod} options={[{ id: "week", label: "This week" }, { id: "month", label: "This month" }]} />
      {d.transactions.length === 0 ? <p className="wb-muted">Nothing spent here yet.</p> : (
        <ul className="wb-dark-list">{d.transactions.map((t) => <li key={t.id}><span><b>{t.title}</b><small>{dayLabel(t.daysAgo)}</small></span><b className="wb-neg wb-num">-{usd(Math.abs(t.amount))}</b></li>)}</ul>
      )}
    </div>
  );
}

export function Wallet() {
  const { app, project } = useApp();
  const s = useAppState();
  const cards = app.persona.finance!.cards;
  const [sel, setSel] = useState(0);
  const card = cards[Math.min(sel, cards.length - 1)];
  const actions = [{ slug: "add-money", icon: "dollar", label: "Add money" }, { slug: "add-card", icon: "card", label: "Add card" }, { slug: "connect-account", icon: "bank", label: "Connect bank" }].filter((x) => hasAction(s.catalog.entries, x.slug));
  return (
    <div className="wb-page" key={s.tick}>
      <PageTitle title="My Wallet" addHref={hasAction(s.catalog.entries, "add-card") ? `/${project.id}/j/add-card` : undefined} addLabel="Add a card" />
      {cards.length === 0 ? (
        <Link className="wb-panel wb-empty" href={`/${project.id}/j/add-card`} prefetch={false}><IconTile icon="card" size={52} /><b>Add your first card</b><p className="wb-muted">Save a card to add money in seconds.</p></Link>
      ) : (
        <>
          <div role="radiogroup" aria-label="Your cards"><ul className="wb-cardrow">
            {cards.map((k, i) => (
              <li key={k.id}>
                <label className={`wb-cardpick ${i === sel ? "is-on" : ""}`}>
                  <input type="radio" className="fx-radio-input" name="card" checked={i === sel} onChange={() => setSel(i)} aria-label={`${k.nickname} card ending ${k.last4}`} />
                  <CardVisual number={cardPictureNumber(k)} holder={k.holder.toUpperCase()} expiry={k.expiry} network={k.network} />
                </label>
              </li>
            ))}
          </ul></div>
          {card ? <section className="wb-panel"><div className="wb-between"><h2>{card.nickname}</h2>{card.isDefault ? <Pill tone="positive">Default</Pill> : null}</div><p className="wb-muted">{networkName(card)} ending {card.last4} · expires {card.expiry}</p></section> : null}
        </>
      )}
      <h2 className="wb-h2">Quick actions</h2>
      <ul className="wb-quick">
        {actions.map((x) => <li key={x.slug}><Link href={`/${project.id}/j/${x.slug}`} prefetch={false}><IconTile icon={x.icon} size={44} /><span>{x.label}</span></Link></li>)}
      </ul>
    </div>
  );
}
