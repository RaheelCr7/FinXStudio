/** Sandbox market data and a customer's investments, for the BankWorkx Invest screens. All companies and funds are made up. */

export type Range = "1D" | "1W" | "1M" | "1Y";
export const RANGES: Range[] = ["1D", "1W", "1M", "1Y"];
export type Point = { label: string; value: number };
export type Instrument = {
  symbol: string; name: string; kind: "stock" | "fund"; sector: string; price: number; about: string; stats: { label: string; value: string }[];
  series: Record<Range, Point[]>;
};
export type Holding = { symbol: string; shares: number; avgCost: number };
export type InvestState = { holdings: Holding[]; watchlist: string[] };

const POINTS: Record<Range, number> = { "1D": 12, "1W": 7, "1M": 22, "1Y": 12 };
const LABELS: Record<Range, (i: number) => string> = {
  "1D": (i) => `${9 + Math.floor((i * 6.5) / 11)}:${i % 2 ? "30" : "00"}`,
  "1W": (i) => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]!,
  "1M": (i) => `Day ${i + 1}`,
  "1Y": (i) => ["Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov"][i]!,
};
const SPREAD: Record<Range, number> = { "1D": 0.006, "1W": 0.012, "1M": 0.02, "1Y": 0.05 };

/** A repeatable pseudo-random walk that ends at today's price, so the same symbol always draws the same chart. */
function walk(symbol: string, price: number, range: Range, drift: number): Point[] {
  let seed = [...symbol].reduce((s, ch) => (s * 31 + ch.charCodeAt(0)) >>> 0, 7 + range.length * 13);
  const next = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32 - 0.5; };
  const n = POINTS[range], out: number[] = [price];
  for (let i = 1; i < n; i++) out.unshift(Math.max(1, out[0]! / (1 + drift * (range === "1Y" ? 1 : range === "1D" ? 0.08 : 0.4) + next() * SPREAD[range] * 2)));
  return out.map((v, i) => ({ label: LABELS[range](i), value: Math.round(v * 100) / 100 }));
}

const make = (symbol: string, name: string, kind: Instrument["kind"], sector: string, price: number, drift: number, about: string, stats: Instrument["stats"]): Instrument => ({
  symbol, name, kind, sector, price, about, stats, series: { "1D": walk(symbol, price, "1D", drift), "1W": walk(symbol, price, "1W", drift), "1M": walk(symbol, price, "1M", drift), "1Y": walk(symbol, price, "1Y", drift) },
});

export const INSTRUMENTS: Instrument[] = [
  make("LMRB", "Lumen Robotics", "stock", "Technology", 184.2, 0.012, "Builds warehouse robots and the software that runs them. Sells mostly to logistics companies.", [{ label: "Market cap", value: "$38.4B" }, { label: "P/E ratio", value: "31.2" }, { label: "Dividend", value: "None" }, { label: "52-week range", value: "$121 – $196" }]),
  make("APXC", "Apex Cloud", "stock", "Technology", 96.45, 0.008, "Cloud storage and tools for small businesses, sold as a monthly subscription.", [{ label: "Market cap", value: "$21.7B" }, { label: "P/E ratio", value: "27.8" }, { label: "Dividend", value: "None" }, { label: "52-week range", value: "$71 – $104" }]),
  make("HBRE", "Harbor Energy", "stock", "Energy", 52.1, -0.006, "Generates power from wind and natural gas and sells it to cities and factories.", [{ label: "Market cap", value: "$14.2B" }, { label: "P/E ratio", value: "12.4" }, { label: "Dividend", value: "3.8%" }, { label: "52-week range", value: "$44 – $63" }]),
  make("ORCH", "Orchard Foods", "stock", "Consumer", 38.75, 0.004, "Packaged fruit, juices and snacks sold in supermarkets across the country.", [{ label: "Market cap", value: "$6.1B" }, { label: "P/E ratio", value: "18.9" }, { label: "Dividend", value: "2.1%" }, { label: "52-week range", value: "$32 – $41" }]),
  make("SMTH", "Summit Health", "stock", "Healthcare", 141.3, 0.01, "Runs clinics and makes diagnostic equipment for hospitals.", [{ label: "Market cap", value: "$29.9B" }, { label: "P/E ratio", value: "24.6" }, { label: "Dividend", value: "0.9%" }, { label: "52-week range", value: "$109 – $148" }]),
  make("MRDB", "Meridian Bank", "stock", "Financials", 67.85, -0.003, "A regional bank with 400 branches that lends to families and small firms.", [{ label: "Market cap", value: "$17.5B" }, { label: "P/E ratio", value: "10.7" }, { label: "Dividend", value: "4.2%" }, { label: "52-week range", value: "$58 – $74" }]),
  make("GLBX", "Global Index Fund", "fund", "Index fund", 42.18, 0.007, "Holds thousands of companies from around the world in one fund, for broad and low-cost exposure.", [{ label: "Expense ratio", value: "0.08%" }, { label: "Holdings", value: "3,100" }, { label: "Yield", value: "1.6%" }, { label: "Risk", value: "Medium" }]),
  make("GRNF", "Green Future Fund", "fund", "Sustainable", 27.6, 0.011, "Invests in companies working on clean energy, water and recycling.", [{ label: "Expense ratio", value: "0.45%" }, { label: "Holdings", value: "86" }, { label: "Yield", value: "0.7%" }, { label: "Risk", value: "High" }]),
  make("TBND", "Treasury Bond Fund", "fund", "Bonds", 98.3, 0.001, "Lends to the government by holding short and medium-term treasury bonds. Steadier, with lower growth.", [{ label: "Expense ratio", value: "0.12%" }, { label: "Holdings", value: "54" }, { label: "Yield", value: "4.3%" }, { label: "Risk", value: "Low" }]),
];

export const instrumentOf = (symbol: string) => INSTRUMENTS.find((i) => i.symbol === symbol);
/** What a share is worth today against the previous close, in dollars and percent. */
export const dayChange = (i: Instrument) => { const prev = i.series["1D"][0]!.value; return { amount: Math.round((i.price - prev) * 100) / 100, pct: prev ? (i.price - prev) / prev : 0 }; };

export const alexInvest = (): InvestState => ({
  holdings: [{ symbol: "LMRB", shares: 6.5, avgCost: 165 }, { symbol: "GLBX", shares: 40, avgCost: 38.5 }, { symbol: "ORCH", shares: 20, avgCost: 41 }, { symbol: "TBND", shares: 5, avgCost: 99 }],
  watchlist: ["APXC", "SMTH", "GRNF"],
});

/** What the whole portfolio was worth at each point of a range. */
export function portfolioSeries(holdings: Holding[], range: Range): Point[] {
  if (holdings.length === 0) return [];
  const first = instrumentOf(holdings[0]!.symbol)!.series[range];
  return first.map((p, i) => ({ label: p.label, value: Math.round(holdings.reduce((s, h) => s + h.shares * instrumentOf(h.symbol)!.series[range][i]!.value, 0) * 100) / 100 }));
}
export function portfolioTotals(holdings: Holding[]) {
  const value = holdings.reduce((s, h) => s + h.shares * instrumentOf(h.symbol)!.price, 0);
  const cost = holdings.reduce((s, h) => s + h.shares * h.avgCost, 0);
  return { value, cost, gain: value - cost, gainPct: cost ? (value - cost) / cost : 0 };
}
