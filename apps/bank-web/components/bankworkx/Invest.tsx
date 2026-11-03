"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { hasAction, instrumentView, investHome, pctText, rangePhrase, signedMoney, usd2, type InvestKind } from "@finx/bank-client";
import { RANGES, dayChange, instrumentOf, type Instrument, type Range } from "@finx/mock-bank-api";
import { Icon, LineChart, Pill, Segmented } from "@finx/renderer-web";
import { useApp, useAppState } from "../AppProvider";

const palette = ["--c-chart1", "--c-chart2", "--c-chart3", "--c-chart4", "--c-chart5", "--c-chart6"];
function Mark({ i, size = 42 }: { i: Instrument; size?: number }) {
  const tone = palette[[...i.sector].reduce((s, ch) => s + ch.charCodeAt(0), 0) % palette.length]!;
  return <span className="wb-cat" style={{ ["--tone" as string]: `var(${tone})`, inlineSize: size, blockSize: size, fontSize: size * 0.3, fontWeight: 800 }} aria-hidden>{i.symbol.slice(0, 2)}</span>;
}
const Change = ({ value }: { value: number }) => <Pill tone={value >= 0 ? "positive" : "negative"}>{pctText(value)}</Pill>;

function Row({ i, sub, value, href }: { i: Instrument; sub: string; value?: string; href: string }) {
  const ch = dayChange(i);
  return (
    <li>
      <Link className="wb-inst" href={href} aria-label={`${i.name}, ${value ?? usd2(i.price)}, ${pctText(ch.pct)} today`}>
        <Mark i={i} />
        <span className="wb-inst-text"><b>{i.name}</b><small>{sub}</small></span>
        <span className="wb-inst-price"><b className="wb-num">{value ?? usd2(i.price)}</b><small className={ch.pct >= 0 ? "wb-pos" : "wb-neg"}>{pctText(ch.pct)}</small></span>
      </Link>
    </li>
  );
}

type Section = "portfolio" | "watchlist" | "explore";

export function InvestHome() {
  const { app, project } = useApp();
  const s = useAppState();
  const inv = app.persona.finance!.invest;
  const [section, setSection] = useState<Section>("portfolio");
  const [range, setRange] = useState<Range>("1M");
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<InvestKind>("all");
  const canBuy = hasAction(s.catalog.entries, "invest");
  const { totals, series, held, watch, explore, movers } = useMemo(() => investHome(inv, range, q, kind), [inv, range, q, kind, s.tick]);
  const at = (symbol: string) => `/${project.id}/invest/${symbol}`;
  return (
    <div className="wb-page" key={s.tick}>
      <h1>Invest</h1>
      <section className="wb-hero" aria-label="Portfolio">
        <p>Portfolio value</p>
        <p className="wb-hero-amount">{usd2(totals.value)}</p>
        {inv.holdings.length > 0 ? (
          <>
            <p className="wb-strong">{signedMoney(totals.gain, usd2)} ({pctText(totals.gainPct)}) all time</p>
            <Segmented dark label="Chart range" value={range} onChange={setRange} options={RANGES.map((x) => ({ id: x, label: x }))} />
            <div className="wb-hero-chart"><LineChart key={range} data={series} height={150} tone="light" label={`Portfolio value, ${range}`} format={(p) => usd2(p.value)} /></div>
          </>
        ) : <p>Buy your first stock or fund and watch it grow here.</p>}
      </section>

      <Segmented label="Invest sections" value={section} onChange={setSection} options={[{ id: "portfolio", label: "Portfolio" }, { id: "watchlist", label: `Watchlist${watch.length ? ` ${watch.length}` : ""}` }, { id: "explore", label: "Explore" }]} />

      {section === "portfolio" ? (held.length === 0
        ? <div className="wb-panel wb-empty"><Icon name="trend" size={34} /><b>Nothing here yet</b><p className="wb-muted">Pick a stock or fund from Explore and invest from as little as $1.</p><button type="button" className="wb-btn wb-btn-ghost wb-btn-sm" onClick={() => setSection("explore")}>Explore</button></div>
        : <ul className="wb-panel wb-inst-list">{held.map(({ holding: h, instrument: i }) => <Row key={h.symbol} i={i} href={at(i.symbol)} sub={`${h.shares} ${i.kind === "fund" ? "units" : "shares"} · ${signedMoney((i.price - h.avgCost) * h.shares, usd2)} all time`} value={usd2(h.shares * i.price)} />)}</ul>) : null}

      {section === "watchlist" ? (watch.length === 0
        ? <div className="wb-panel wb-empty"><Icon name="star" size={34} /><b>Your watchlist is empty</b><p className="wb-muted">Use the star on any stock or fund to follow its price.</p></div>
        : <ul className="wb-panel wb-inst-list">{watch.map((i) => <Row key={i.symbol} i={i} href={at(i.symbol)} sub={`${i.symbol} · ${i.sector}`} />)}</ul>) : null}

      {section === "explore" ? (
        <>
          <div className="wb-tools">
            <label className="wb-search"><Icon name="search" size={18} /><span className="wb-sr">Search stocks and funds</span><input type="search" placeholder="Search stocks and funds" autoCapitalize="none" autoCorrect="off" value={q} onChange={(e) => setQ(e.target.value)} /></label>
            <Segmented label="Kind" value={kind} onChange={setKind} options={[{ id: "all", label: "All" }, { id: "stock", label: "Stocks" }, { id: "fund", label: "Funds" }]} />
          </div>
          {q === "" && kind === "all" ? (
            <section aria-labelledby="movers"><h2 id="movers">Biggest movers today</h2>
              <ul className="wb-cards">{movers.map((i) => <li key={i.symbol}><Link className="wb-mover" href={at(i.symbol)} aria-label={`${i.name} ${pctText(dayChange(i).pct)} today`}><Mark i={i} size={36} /><b>{i.name}</b><b className="wb-num">{usd2(i.price)}</b><Change value={dayChange(i).pct} /></Link></li>)}</ul>
            </section>
          ) : null}
          {explore.length === 0 ? <p className="wb-muted wb-center">Nothing matches “{q}”.</p> : <ul className="wb-panel wb-inst-list">{explore.map((i) => <Row key={i.symbol} i={i} href={at(i.symbol)} sub={`${i.symbol} · ${i.kind === "fund" ? "Fund" : i.sector}`} />)}</ul>}
        </>
      ) : null}
      {canBuy ? <Link className="wb-btn wb-btn-primary wb-btn-block" href={`/${project.id}/j/${app.resolveSlug("invest")}`} prefetch={false}>Invest</Link> : null}
    </div>
  );
}

export function InstrumentDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const { app, project } = useApp();
  const s = useAppState();
  const fin = app.persona.finance!;
  const [range, setRange] = useState<Range>("1M");
  if (!instrumentOf(symbol)) return <div className="wb-page"><div className="wb-panel wb-empty"><b>We could not find that stock or fund</b><Link className="wb-btn wb-btn-primary" href={`/${project.id}/invest`}>Back to Invest</Link></div></div>;
  const v = instrumentView(symbol, fin.invest, range);
  const { instrument: i, watching, held, day, data, move, movePct } = v;
  const canBuy = hasAction(s.catalog.entries, "invest"), canSell = !!held && hasAction(s.catalog.entries, "sell-investment");
  const toggle = async () => { await app.bank.call("bank.invest.watch", { symbol, on: !watching }); app.bump(); };
  return (
    <div className="wb-page" key={s.tick}>
      <Link href={`/${project.id}/invest`} className="wb-back"><Icon name="back" size={20} /> Invest</Link>
      <div className="wb-between">
        <div className="wb-inst-head"><Mark i={i} size={48} /><div><h1>{i.symbol}</h1><p className="wb-muted">{i.name} · {i.kind === "fund" ? "Fund" : "Stock"} · {i.sector}</p></div></div>
        <button type="button" className={`wb-icon-btn wb-star ${watching ? "is-on" : ""}`} aria-pressed={watching} aria-label={watching ? `Remove ${i.symbol} from watchlist` : `Add ${i.symbol} to watchlist`} onClick={toggle}><Icon name="star" size={26} stroke={watching ? 3 : 2} /></button>
      </div>
      <div><p className="wb-price wb-num">{usd2(i.price)}</p><p className={`wb-strong ${day.amount >= 0 ? "wb-pos" : "wb-neg"}`}>{signedMoney(day.amount, usd2)} ({pctText(day.pct)}) today</p></div>
      <section className="wb-panel">
        <LineChart key={range} data={data} height={170} label={`${i.name} price, ${range}`} format={(p) => usd2(p.value)} tone="accent" />
        <Segmented label="Chart range" value={range} onChange={setRange} options={RANGES.map((x) => ({ id: x, label: x }))} />
        <p className="wb-muted wb-num">{signedMoney(move, usd2)} ({pctText(movePct)}) over {rangePhrase(range)}</p>
      </section>
      {held ? (
        <section className="wb-panel"><h2>Your position</h2>
          <dl className="wb-kv">
            <div><dt>Value</dt><dd>{usd2(held.value)}</dd></div><div><dt>{i.kind === "fund" ? "Units" : "Shares"}</dt><dd>{held.shares}</dd></div>
            <div><dt>Average cost</dt><dd>{usd2(held.avgCost)}</dd></div><div><dt>Return</dt><dd>{signedMoney(held.gain, usd2)} ({pctText(held.gainPct)})</dd></div>
          </dl>
        </section>
      ) : null}
      <section aria-labelledby="keys"><h2 id="keys">Key numbers</h2>
        <dl className="wb-stats-grid">{i.stats.map((x) => <div key={x.label}><dt>{x.label}</dt><dd>{x.value}</dd></div>)}</dl>
      </section>
      <section><h2>About {i.name}</h2><p className="wb-muted">{i.about}</p><p className="wb-fine">Sandbox data about a made-up {i.kind === "fund" ? "fund" : "company"}. Not investment advice.</p></section>
      <div className="wb-buttons">
        {canSell ? <Link className="wb-btn wb-btn-outline" href={`/${project.id}/j/${app.resolveSlug("sell-investment")}?symbol=${i.symbol}`} prefetch={false}>Sell</Link> : null}
        {canBuy ? <Link className="wb-btn wb-btn-primary" href={`/${project.id}/j/${app.resolveSlug("invest")}?symbol=${i.symbol}`} prefetch={false}>Buy {i.symbol}</Link> : null}
      </div>
    </div>
  );
}
