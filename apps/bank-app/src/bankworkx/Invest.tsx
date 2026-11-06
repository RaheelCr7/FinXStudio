import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Gradient, Icon, LineChart, Pill, Segmented, useTheme } from "@finx/renderer-native";
import { RANGES, dayChange, type Instrument, type Range } from "@finx/mock-bank-api";
import { hasAction, instrumentView, investHome, pctText, rangePhrase, signedMoney, type InvestKind } from "@finx/bank-client";
import type { Actions } from "./Dashboard";
import { Card, SectionTitle, tab } from "./ui";

const signed = signedMoney;
const pct = pctText;

/** A coloured tile with the first letters of the symbol, the colour chosen from the sector so the same company always looks the same. */
function Mark({ i, size = 42 }: { i: Instrument; size?: number }) {
  const { c } = useTheme();
  const palette = [c.chart1, c.chart2, c.chart3, c.chart4, c.chart5, c.chart6];
  const color = palette[[...i.sector].reduce((s, ch) => s + ch.charCodeAt(0), 0) % palette.length]!;
  return <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: `${color}26`, alignItems: "center", justifyContent: "center" }}><Text style={{ color, fontWeight: "800", fontSize: size * 0.3 }}>{i.symbol.slice(0, 2)}</Text></View>;
}

function Change({ value }: { value: number }) {
  return <Pill text={pct(value)} tone={value >= 0 ? "positive" : "negative"} />;
}

function Row({ i, a, sub, value, onPress }: { i: Instrument; a: Actions; sub: string; value?: string; onPress: () => void }) {
  const { c } = useTheme();
  const ch = dayChange(i);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${i.name}, ${value ?? a.money2(i.price)}, ${pct(ch.pct)} today`} onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, opacity: pressed ? 0.85 : 1 })}>
      <Mark i={i} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontWeight: "700", fontSize: 15 }} numberOfLines={1}>{i.name}</Text>
        <Text style={{ color: c.textFaint, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{sub}</Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <Text style={[{ color: c.text, fontWeight: "700", fontSize: 15 }, tab]}>{value ?? a.money2(i.price)}</Text>
        <Text style={[{ color: ch.pct >= 0 ? c.positive : c.negative, fontSize: 12, fontWeight: "700" }, tab]}>{pct(ch.pct)}</Text>
      </View>
    </Pressable>
  );
}

const Header = ({ title, onBack, right }: { title: string; onBack: () => void; right?: React.ReactNode }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} hitSlop={10}><Icon name="back" size={24} color={c.text} /></Pressable>
      <Text accessibilityRole="header" style={{ flex: 1, color: c.text, fontSize: 22, fontWeight: "800", letterSpacing: -0.4 }}>{title}</Text>
      {right}
    </View>
  );
};

type Section = "portfolio" | "watchlist" | "explore";

/** The Invest area: what the customer owns, what they follow, and everything they could buy. */
export function InvestHome({ a, onBack, onOpen }: { a: Actions; onBack: () => void; onOpen: (symbol: string) => void }) {
  const { c, r } = useTheme();
  const inv = a.bank.persona.finance!.invest;
  const [section, setSection] = useState<Section>("portfolio");
  const [range, setRange] = useState<Range>("1M");
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<InvestKind>("all");
  const canBuy = hasAction(a.journeys, "invest");
  const { totals, series, held: heldRows, watch, explore, movers } = useMemo(() => investHome(inv, range, q, kind), [inv, range, q, kind, a.bank.persona.finance!.invest.holdings.length]);
  const held = heldRows.map((x) => ({ h: x.holding, i: x.instrument }));

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Header title="Invest" onBack={onBack} />
      <Gradient from={c.heroFrom} to={c.heroTo} radius={r.xl} style={{ padding: 20, gap: 4 }}>
        <Text style={{ color: "rgba(255,255,255,.8)", fontSize: 13 }}>Portfolio value</Text>
        <Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit style={[{ color: "#fff", fontSize: 34, fontWeight: "800", letterSpacing: -0.8 }, tab]}>{a.money2(totals.value)}</Text>
        {inv.holdings.length > 0 ? (
          <>
            <Text style={[{ color: "#fff", fontSize: 14, fontWeight: "700", marginBottom: 10 }, tab]}>{signed(totals.gain, a.money2)} ({pct(totals.gainPct)}) all time</Text>
            <Segmented dark value={range} onChange={setRange} options={RANGES.map((x) => ({ id: x, label: x }))} />
            <View style={{ marginTop: 10 }}><LineChart key={range} data={series} color="#FFFFFF" height={120} format={(p) => a.money2(p.value)} /></View>
          </>
        ) : <Text style={{ color: "rgba(255,255,255,.85)", fontSize: 14, lineHeight: 20, marginTop: 6 }}>Buy your first stock or fund and watch it grow here.</Text>}
      </Gradient>

      <Segmented value={section} onChange={setSection} options={[{ id: "portfolio", label: "Portfolio" }, { id: "watchlist", label: `Watchlist${watch.length ? ` ${watch.length}` : ""}` }, { id: "explore", label: "Explore" }]} />

      {section === "portfolio" ? (
        held.length === 0 ? (
          <Card style={{ alignItems: "center", gap: 10, padding: 26 }}>
            <Icon name="trend" size={34} color={c.accent} />
            <Text style={{ color: c.text, fontWeight: "700", fontSize: 16 }}>Nothing here yet</Text>
            <Text style={{ color: c.textMuted, textAlign: "center" }}>Pick a stock or fund from Explore and invest from as little as $1.</Text>
            <Pill text="Explore" tone="accent" onPress={() => setSection("explore")} />
          </Card>
        ) : (
          <Card style={{ paddingVertical: 4 }}>
            {held.map(({ h, i }, n) => (
              <View key={h.symbol} style={{ borderTopWidth: n ? 1 : 0, borderTopColor: c.border }}>
                <Row i={i} a={a} sub={`${h.shares} ${i.kind === "fund" ? "units" : "shares"} · ${signed((i.price - h.avgCost) * h.shares, a.money2)} all time`} value={a.money2(h.shares * i.price)} onPress={() => onOpen(i.symbol)} />
              </View>
            ))}
          </Card>
        )
      ) : null}

      {section === "watchlist" ? (
        watch.length === 0 ? (
          <Card style={{ alignItems: "center", gap: 10, padding: 26 }}>
            <Icon name="star" size={34} color={c.accent} />
            <Text style={{ color: c.text, fontWeight: "700", fontSize: 16 }}>Your watchlist is empty</Text>
            <Text style={{ color: c.textMuted, textAlign: "center" }}>Tap the star on any stock or fund to follow its price.</Text>
          </Card>
        ) : (
          <Card style={{ paddingVertical: 4 }}>
            {watch.map((i, n) => <View key={i.symbol} style={{ borderTopWidth: n ? 1 : 0, borderTopColor: c.border }}><Row i={i} a={a} sub={`${i.symbol} · ${i.sector}`} onPress={() => onOpen(i.symbol)} /></View>)}
          </Card>
        )
      ) : null}

      {section === "explore" ? (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, height: 44, borderRadius: r.md, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
            <Icon name="search" size={18} color={c.textFaint} />
            <TextInput accessibilityLabel="Search stocks and funds" value={q} onChangeText={setQ} placeholder="Search stocks and funds" placeholderTextColor={c.textFaint} autoCapitalize="none" autoCorrect={false} style={{ flex: 1, color: c.text, fontSize: 15, padding: 0 }} />
            {q ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQ("")}><Icon name="x" size={16} color={c.textFaint} /></Pressable> : null}
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {([["all", "All"], ["stock", "Stocks"], ["fund", "Funds"]] as const).map(([id, label]) => <Pill key={id} text={label} selected={kind === id} onPress={() => setKind(id)} />)}
          </View>
          {q === "" && kind === "all" ? (
            <>
              <SectionTitle title="Biggest movers today" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingEnd: 20, paddingVertical: 4 }}>
                {movers.map((i) => (
                  <Card key={i.symbol} onPress={() => onOpen(i.symbol)} label={`${i.name} ${pct(dayChange(i).pct)} today`} style={{ width: 150, gap: 8 }}>
                    <Mark i={i} size={36} /><Text style={{ color: c.text, fontWeight: "700" }} numberOfLines={1}>{i.name}</Text>
                    <Text style={[{ color: c.text, fontSize: 15, fontWeight: "800" }, tab]}>{a.money2(i.price)}</Text><Change value={dayChange(i).pct} />
                  </Card>
                ))}
              </ScrollView>
            </>
          ) : null}
          {explore.length === 0 ? <Text style={{ color: c.textMuted, textAlign: "center", paddingVertical: 20 }}>Nothing matches “{q}”.</Text> : (
            <Card style={{ paddingVertical: 4 }}>
              {explore.map((i, n) => <View key={i.symbol} style={{ borderTopWidth: n ? 1 : 0, borderTopColor: c.border }}><Row i={i} a={a} sub={`${i.symbol} · ${i.kind === "fund" ? "Fund" : i.sector}`} onPress={() => onOpen(i.symbol)} /></View>)}
            </Card>
          )}
        </>
      ) : null}

      {canBuy ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Invest" onPress={() => a.openJourney("invest")} style={({ pressed }) => ({ minHeight: 52, borderRadius: r.lg, backgroundColor: c.accent, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.88 : 1 })}>
          <Text style={{ color: c.accentOn, fontWeight: "700", fontSize: 16 }}>Invest</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

/** One stock or fund: price and chart, key numbers, what the customer holds, and a way to buy. */
export function InstrumentDetail({ symbol, a, onBack }: { symbol: string; a: Actions; onBack: () => void }) {
  const { c, r } = useTheme();
  const fin = a.bank.persona.finance!;
  const [range, setRange] = useState<Range>("1M");
  const [, force] = useState(0);
  const v = instrumentView(symbol, fin.invest, range);
  const { instrument: i, watching, held } = v;
  const canBuy = hasAction(a.journeys, "invest");
  const canSell = !!held && hasAction(a.journeys, "sell-investment");
  const { data, move, movePct, day, up } = v;
  const first = data[0]!.value;
  const col = up ? c.positive : c.negative;
  async function toggle() { await a.bank.call("bank.invest.watch", { symbol, on: !watching }); force((n) => n + 1); }

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 16 }} showsVerticalScrollIndicator={false}>
      <Header title={i.symbol} onBack={onBack} right={
        <Pressable accessibilityRole="button" accessibilityState={{ selected: watching }} accessibilityLabel={watching ? `Remove ${i.symbol} from watchlist` : `Add ${i.symbol} to watchlist`} onPress={toggle} hitSlop={10}>
          <Icon name="star" size={26} color={watching ? "#E8A317" : c.textFaint} stroke={watching ? 3 : 2} />
        </Pressable>} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Mark i={i} size={48} />
        <View style={{ flex: 1 }}><Text style={{ color: c.text, fontSize: 17, fontWeight: "700" }}>{i.name}</Text><Text style={{ color: c.textFaint, fontSize: 13 }}>{i.kind === "fund" ? "Fund" : "Stock"} · {i.sector}</Text></View>
      </View>
      <View>
        <Text accessibilityRole="header" style={[{ color: c.text, fontSize: 36, fontWeight: "800", letterSpacing: -0.8 }, tab]}>{a.money2(i.price)}</Text>
        <Text style={[{ color: day.amount >= 0 ? c.positive : c.negative, fontSize: 14, fontWeight: "700", marginTop: 2 }, tab]}>{signed(day.amount, a.money2)} ({pct(day.pct)}) today</Text>
      </View>
      <Card style={{ gap: 10 }}>
        <LineChart key={range} data={data} color={col} height={160} format={(p) => a.money2(p.value)} />
        <Segmented value={range} onChange={setRange} options={RANGES.map((x) => ({ id: x, label: x }))} />
        <Text style={[{ color: c.textMuted, fontSize: 13 }, tab]}>{signed(move, a.money2)} ({pct(movePct)}) over {rangePhrase(range)}</Text>
      </Card>

      {held ? (
        <Card style={{ gap: 8 }}>
          <Text style={{ color: c.text, fontWeight: "700", fontSize: 16 }}>Your position</Text>
          {[["Value", a.money2(held.shares * i.price)], [i.kind === "fund" ? "Units" : "Shares", String(held.shares)], ["Average cost", a.money2(held.avgCost)], ["Return", `${signed((i.price - held.avgCost) * held.shares, a.money2)} (${pct(i.price / held.avgCost - 1)})`]].map(([k, v]) => (
            <View key={k} style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ color: c.textMuted }}>{k}</Text><Text style={[{ color: c.text, fontWeight: "700" }, tab]}>{v}</Text></View>
          ))}
        </Card>
      ) : null}

      <SectionTitle title="Key numbers" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {i.stats.map((s) => (
          <View key={s.label} style={{ width: "48%", padding: 14, borderRadius: r.lg, backgroundColor: c.surface, gap: 4 }}>
            <Text style={{ color: c.textFaint, fontSize: 12 }}>{s.label}</Text><Text style={[{ color: c.text, fontWeight: "700", fontSize: 16 }, tab]}>{s.value}</Text>
          </View>
        ))}
      </View>
      <SectionTitle title={`About ${i.name}`} />
      <Text style={{ color: c.textMuted, fontSize: 14, lineHeight: 21 }}>{i.about}</Text>
      <Text style={{ color: c.textFaint, fontSize: 11 }}>Sandbox data about a made-up {i.kind === "fund" ? "fund" : "company"}. Not investment advice.</Text>

      <View style={{ flexDirection: "row", gap: 12 }}>
        {canSell ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Sell ${i.symbol}`} onPress={() => a.openJourney("sell-investment", undefined, { "launch.symbol": i.symbol })} style={({ pressed }) => ({ flex: 1, minHeight: 52, borderRadius: r.lg, borderWidth: 2, borderColor: c.accent, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.85 : 1 })}>
            <Text style={{ color: c.accent, fontWeight: "700", fontSize: 16 }}>Sell</Text>
          </Pressable>
        ) : null}
        {canBuy ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Buy ${i.symbol}`} onPress={() => a.openJourney("invest", undefined, { "launch.symbol": i.symbol })} style={({ pressed }) => ({ flex: 2, minHeight: 52, borderRadius: r.lg, backgroundColor: c.accent, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.88 : 1 })}>
            <Text style={{ color: c.accentOn, fontWeight: "700", fontSize: 16 }}>Buy {i.symbol}</Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}
