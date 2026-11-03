import { INSTRUMENTS, dayChange, instrumentOf, portfolioSeries, portfolioTotals, type Instrument, type InvestState, type Range } from "@finx/mock-bank-api";

export type InvestKind = "all" | "stock" | "fund";

/** The Invest home: what is owned, what is followed, and what can be explored. */
export function investHome(inv: InvestState, range: Range, query = "", kind: InvestKind = "all") {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return {
    totals: portfolioTotals(inv.holdings),
    series: portfolioSeries(inv.holdings, range),
    held: inv.holdings.map((h) => ({ holding: h, instrument: instrumentOf(h.symbol)! })),
    watch: inv.watchlist.map((s) => instrumentOf(s)).filter((x): x is Instrument => !!x),
    explore: INSTRUMENTS.filter((i) => (kind === "all" || i.kind === kind) && words.every((w) => `${i.name} ${i.symbol} ${i.sector}`.toLowerCase().includes(w))),
    movers: [...INSTRUMENTS].sort((x, y) => Math.abs(dayChange(y).pct) - Math.abs(dayChange(x).pct)).slice(0, 3),
  };
}

/** One stock or fund page: price, change over the chosen range, and the customer's position in it. */
export function instrumentView(symbol: string, inv: InvestState, range: Range) {
  const instrument = instrumentOf(symbol)!;
  const data = instrument.series[range];
  const first = data[0]!.value, move = instrument.price - first;
  const held = inv.holdings.find((h) => h.symbol === symbol);
  return {
    instrument, data, move, movePct: first ? move / first : 0, up: move >= 0, day: dayChange(instrument),
    watching: inv.watchlist.includes(symbol), held: held ? { ...held, value: held.shares * instrument.price, gain: (instrument.price - held.avgCost) * held.shares, gainPct: instrument.price / held.avgCost - 1 } : undefined,
  };
}
export const rangePhrase = (r: Range) => (r === "1D" ? "the day" : r === "1W" ? "the week" : r === "1M" ? "the month" : "the year");
