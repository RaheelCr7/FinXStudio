"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  budgetIcon, budgetProgress, compactMoney, hasAction, hasAccounts, inDays, pctText, recentTransactions, spendingSegments, totalBalance, transactionsTitle, usd, usd2, type Filter,
} from "@finx/bank-client";
import { portfolioTotals } from "@finx/mock-bank-api";
import { Donut, Icon, IconTile, LineChart, Pill, ProgressBar, Segmented } from "@finx/renderer-web";
import { useApp, useAppState } from "../AppProvider";
import { SectionTitle, TxnRow } from "./parts";

type DashRange = "1W" | "1M" | "3M" | "1Y";

export function Dashboard() {
  const { app, project } = useApp();
  const s = useAppState();
  const persona = app.persona, fin = persona.finance!;
  const [range, setRange] = useState<DashRange>("1M");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [seg, setSeg] = useState<number | null>(null);
  const total = totalBalance(persona, fin);
  const connected = hasAccounts(persona, fin);
  const series = fin.ranges[range];
  const txns = useMemo(() => recentTransactions(fin.transactions, filter), [fin.transactions, filter, s.tick]);
  const { total: spendTotal, segments: ring } = spendingSegments(fin);
  const colors = ["--c-chart1", "--c-chart2", "--c-chart3", "--c-chart4", "--c-chart5", "--c-chart6"];
  const css = (v: string) => (typeof document === "undefined" ? "#888" : getComputedStyle(document.documentElement).getPropertyValue(v).trim() || "#888");
  const segments = ring.map((r, i) => ({ label: r.label, value: r.value, color: css(colors[i % colors.length]!) }));
  const picked = seg != null ? segments[seg] : null;
  const inv = fin.invest, invT = portfolioTotals(inv.holdings);
  const canConnect = hasAction(s.catalog.entries, "connect-account"), canCard = hasAction(s.catalog.entries, "add-card");

  if (!connected) {
    return (
      <div className="wb-dash" key={s.tick}>
        <section className="wb-hero"><p>Hi {persona.name.split(" ")[0]}</p><h1>Let&apos;s set up your money</h1><p>Connect an account and your balance, spending and budgets appear here.</p></section>
        <ul className="wb-start">
          {[{ slug: "connect-account", icon: "bank", title: "Connect your first account", text: "Link a bank to see your balance and spending here.", ok: canConnect }, { slug: "add-card", icon: "card", title: "Add a card", text: "Save a card to add money in seconds.", ok: canCard }].map((x) => (
            <li key={x.slug}>{x.ok
              ? <Link className="wb-start-card" href={`/${project.id}/j/${x.slug}`} prefetch={false}><IconTile icon={x.icon} size={48} /><span><b>{x.title}</b><small>{x.text}</small></span><Icon name="chevronRight" size={20} /></Link>
              : <span className="wb-start-card is-disabled" aria-disabled="true"><IconTile icon={x.icon} size={48} /><span><b>{x.title}</b><small>{x.text}</small></span></span>}</li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="wb-dash" key={s.tick}>
      <h1 className="wb-sr">Dashboard</h1>
      <div className="wb-col">
      <section className="wb-hero" aria-label="Balance">
        <p>Total balance</p>
        <p className="wb-hero-amount">{usd(total)}</p>
        <Segmented dark label="Chart range" value={range} onChange={setRange} options={(["1W", "1M", "3M", "1Y"] as DashRange[]).map((x) => ({ id: x, label: x }))} />
        <div className="wb-hero-chart">
          {series.length > 1 ? <LineChart key={range} data={series} height={150} tone="light" label={`Balance, ${range}`} format={(p) => usd(p.value)} /> : <p>Your balance history will appear here as you use your accounts.</p>}
        </div>
      </section>

      <section className="wb-stats" aria-label="This month">
        {([{ id: "income" as const, label: "Income", value: fin.income, sign: "+", tone: "in" }, { id: "expense" as const, label: "Expense", value: fin.expense, sign: "-", tone: "out" }]).map((x) => (
          <button key={x.id} type="button" className={`wb-stat is-${x.tone} ${filter === x.id ? "is-on" : ""}`} aria-pressed={filter === x.id} onClick={() => setFilter(filter === x.id ? "all" : x.id)}>
            <small>{x.label}</small><b>{x.sign}{usd2(x.value)}</b><span className="wb-sr">Filter transactions</span>
          </button>
        ))}
        <div className="wb-stat is-save"><small>Savings</small><b>{usd2(fin.savings)}</b></div>
      </section>

      <section className="wb-panel wb-tx" aria-labelledby="tx-title">
        <div className="wb-section-title"><h2 id="tx-title">{transactionsTitle(filter)}</h2><Link href={`/${project.id}/accounts`}>See all</Link></div>
        {txns.length === 0 ? <p className="wb-muted">No transactions yet.</p> : <ul className="wb-txn-list">{txns.map((t) => <TxnRow key={t.id} t={t} money={usd} open={open === t.id} onToggle={() => setOpen(open === t.id ? null : t.id)} />)}</ul>}
      </section>

      </div>

      <div className="wb-col">
      <section className="wb-panel wb-bud" aria-labelledby="bud-title">
        <div className="wb-section-title"><h2 id="bud-title">Monthly Budgets</h2>{fin.budgets.length ? <Link href={`/${project.id}/budgets`}>Manage</Link> : hasAction(s.catalog.entries, "create-budget") ? <Link href={`/${project.id}/j/create-budget`} prefetch={false}>Create</Link> : null}</div>
        {fin.budgets.length === 0 ? <p className="wb-muted">No budgets yet. Create one to track your spending by category.</p> : (
          <ul className="wb-cards">
            {fin.budgets.map((b) => {
              const { pct, tone, message } = budgetProgress(b);
              return (
                <li key={b.id}>
                  <Link className="wb-budget" href={`/${project.id}/budgets/${b.id}`} aria-label={`${b.name} budget, ${Math.round(pct * 100)} percent used`}>
                    <span className="wb-budget-head"><IconTile icon={budgetIcon(b.name)} size={38} /><span><b>{b.name}</b><small>{usd(b.limit)}/month</small></span><Icon name="chevronRight" size={18} /></span>
                    <ProgressBar value={b.spent} max={b.limit} tone={tone === "ok" ? "positive" : tone === "warn" ? "warning" : "negative"} label={`${b.name} budget used`} />
                    <span className="wb-budget-foot"><small>{usd(b.spent)} of {usd(b.limit)}</small><Pill tone={tone === "over" ? "negative" : tone === "warn" ? "accent" : "positive"}>{Math.round(pct * 100)}%</Pill></span>
                    <small className="wb-muted">{message}</small>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {segments.length > 0 ? (
        <section className="wb-panel wb-spend" aria-labelledby="sp-title">
          <h2 id="sp-title">Your Account Spendings</h2>
          <Donut label="Spending by category" segments={segments} selected={seg} onSelect={setSeg} centerTop={picked ? usd(picked.value) : compactMoney(spendTotal)} centerSub={picked ? `${Math.round((picked.value / spendTotal) * 100)}% · ${picked.label}` : "Spent this month"} />
          <ul className="wb-legend">
            {segments.map((x, i) => (
              <li key={x.label}><button type="button" aria-pressed={seg === i} onClick={() => setSeg(seg === i ? null : i)} style={{ ["--tone" as string]: x.color }}><i aria-hidden />{x.label}<span className="wb-sr">{usd(x.value)}</span></button></li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="wb-panel wb-subs" aria-labelledby="sub-title">
        <h2 id="sub-title">Monthly Subscriptions</h2>
        <ul className="wb-cards">
          {fin.subscriptions.map((x) => (
            <li key={x.id} className="wb-subcard">
              <span className="wb-sub-logo" style={{ background: x.color }} aria-hidden>{x.name[0]}</span>
              <b>{x.name}</b>
              <small>Next payment on <b>{inDays(x.nextInDays)}</b></small>
              <button type="button" className="wb-btn wb-btn-primary wb-btn-sm" onClick={() => app.paySubscription(x.id)} aria-label={`Pay ${x.name} ${usd(x.amount)} now`}>Pay now {usd(x.amount)}</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="wb-panel wb-invest" aria-labelledby="inv-title">
        <div className="wb-section-title"><h2 id="inv-title">Investments</h2><Link href={`/${project.id}/invest`}>Explore</Link></div>
        <Link className="wb-invest-card" href={`/${project.id}/invest`}>
          <IconTile icon="trend" size={48} />
          {inv.holdings.length === 0
            ? <span><b>Start investing</b><small>Buy stocks and funds from as little as $1.</small></span>
            : <span><small>Portfolio value</small><b className="wb-num">{usd2(invT.value)}</b><small>{inv.holdings.length} holdings · {inv.watchlist.length} on your watchlist</small></span>}
          {inv.holdings.length ? <Pill tone={invT.gain >= 0 ? "positive" : "negative"}>{pctText(invT.gainPct)}</Pill> : <Icon name="chevronRight" size={20} />}
        </Link>
      </section>
      </div>
    </div>
  );
}
