import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Donut, Gradient, Icon, IconTile, LineChart, Pill, ProgressBar, Segmented, useTheme } from "@finx/renderer-native";
import type { MockBank } from "@finx/mock-bank-api";
import { slugIs, type Entry } from "../live";
import { portfolioTotals } from "@finx/mock-bank-api";
import { budgetIcon, budgetProgress, compactMoney, displayName, firstName, hasAccounts, initials as initialsOf, inDays, recentTransactions, spendingSegments, totalBalance, transactionsTitle } from "@finx/bank-client";
import { Card, SectionTitle, TxnRow, lift, tab, type TabId } from "./ui";

export type Actions = {
  bank: MockBank; money: (n: number) => string; money2: (n: number) => string; go: (t: TabId) => void; openJourney: (slug: string, initial?: Record<string, any>, launch?: Record<string, any>) => void;
  openBudget: (id: string) => void; paySub: (id: string) => void; journeys: Entry[]; menu: () => void; notifications: () => void; openInvest: () => void;
};
type Range = "1W" | "1M" | "3M" | "1Y";
type Filter = "all" | "income" | "expense";

export function Dashboard({ a }: { a: Actions }) {
  const { c, r, mode } = useTheme();
  const fin = a.bank.persona.finance!;
  const accounts = a.bank.persona.accounts;
  const [range, setRange] = useState<Range>("1M");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [seg, setSeg] = useState<number | null>(null);
  const total = totalBalance(a.bank.persona, fin);
  const connected = hasAccounts(a.bank.persona, fin);
  const series = fin.ranges[range];
  const first = firstName(a.bank.persona);
  const initials = initialsOf(a.bank.persona);
  const txns = useMemo(() => recentTransactions(fin.transactions, filter), [fin.transactions, filter]);
  const { total: spendTotal, segments: ring } = spendingSegments(fin);
  const colors = [c.chart1, c.chart2, c.chart3, c.chart4, c.chart5, c.chart6];
  const segments = ring.map((s, i) => ({ label: s.label, value: s.value, color: colors[i % colors.length]! }));
  const pickedSeg = seg != null ? segments[seg] : null;

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 18 }} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" }}><Text style={{ color: c.accentOn, fontWeight: "700" }}>{initials}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.textFaint, fontSize: 12 }}>Welcome back,</Text>
          <Text style={{ color: c.text, fontSize: 17, fontWeight: "700" }}>{displayName(a.bank.persona)}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Notifications" onPress={a.notifications} hitSlop={8}>
          <Icon name="bell" size={24} color={c.text} />
          <View style={{ position: "absolute", right: 0, top: 0, width: 9, height: 9, borderRadius: 5, backgroundColor: c.negative, borderWidth: 1.5, borderColor: c.bg }} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Menu" onPress={a.menu} hitSlop={8}><Icon name="menu" size={24} color={c.text} /></Pressable>
      </View>

      {!connected ? (
        <GetStarted a={a} first={first} />
      ) : (
        <>
          <View>
            <Gradient from={c.heroFrom} to={c.heroTo} radius={r.xl} style={{ padding: 20, paddingBottom: 56 }}>
              <Text style={{ color: "rgba(255,255,255,.8)", fontSize: 13 }}>Total balance</Text>
              <Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit style={[{ color: "#fff", fontSize: 36, fontWeight: "800", letterSpacing: -0.8, marginTop: 2, marginBottom: 12 }, tab]}>{a.money(total)}</Text>
              <Segmented dark value={range} onChange={setRange} options={(["1W", "1M", "3M", "1Y"] as Range[]).map((x) => ({ id: x, label: x }))} />
              <View style={{ marginTop: 10 }}>
                {series.length > 1
                  ? <LineChart key={range} data={series} color="#FFFFFF" height={120} format={(p) => a.money(p.value)} />
                  : <View style={{ height: 120, justifyContent: "center" }}><Text style={{ color: "rgba(255,255,255,.85)", fontSize: 14, lineHeight: 20 }}>Your balance history will appear here as you use your accounts.</Text></View>}
              </View>
            </Gradient>
            <View style={{ marginTop: -36, marginHorizontal: 14 }}>
              <Card style={{ flexDirection: "row", padding: 12, gap: 8 }}>
                {([
                  { id: "income" as const, label: "Income", value: fin.income, sign: "+", color: c.positive, icon: "up" as const },
                  { id: "expense" as const, label: "Expense", value: fin.expense, sign: "-", color: c.negative, icon: "down" as const },
                ]).map((s) => {
                  const on = filter === s.id;
                  return (
                    <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={`${s.label} ${a.money(s.value)}. Filter transactions`} accessibilityState={{ selected: on }} onPress={() => setFilter(on ? "all" : s.id)}
                      style={{ flex: 1, padding: 8, borderRadius: r.md, backgroundColor: on ? c.surfaceMuted : "transparent", borderWidth: 1, borderColor: on ? c.borderStrong : "transparent" }}>
                      <Text style={{ color: c.textMuted, fontSize: 11 }}>{s.label}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 }}>
                        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[{ color: s.color, fontSize: 14, fontWeight: "800", flexShrink: 1 }, tab]}>{`${s.sign}${a.money2(s.value)}`}</Text><Icon name={s.icon} size={13} color={s.color} />
                      </View>
                    </Pressable>
                  );
                })}
                <View style={{ flex: 1, padding: 8 }}>
                  <Text style={{ color: c.textMuted, fontSize: 11 }}>Savings</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 }}>
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[{ color: c.accent, fontSize: 14, fontWeight: "800", flexShrink: 1 }, tab]}>{a.money2(fin.savings)}</Text><Icon name="trend" size={13} color={c.accent} />
                  </View>
                </View>
              </Card>
            </View>
          </View>

          <SectionTitle title={transactionsTitle(filter)} action="See all" onAction={() => a.go("accounts")} />
          <Card style={{ paddingVertical: 6 }}>
            {txns.length === 0 ? <Text style={{ color: c.textMuted, padding: 14 }}>No transactions yet.</Text> : txns.map((t) => <TxnRow key={t.id} t={t} money={a.money} open={open === t.id} onPress={() => setOpen(open === t.id ? null : t.id)} />)}
          </Card>

          <SectionTitle title="Monthly Budgets" action={fin.budgets.length ? "Manage" : "Create"} onAction={() => (fin.budgets.length ? a.go("budgets") : a.journeys.some((j) => slugIs(j.slug, "create-budget")) && a.openJourney("create-budget"))} />
          {fin.budgets.length === 0 ? <Card style={{ padding: 16 }}><Text style={{ color: c.textMuted }}>No budgets yet. Create one to track your spending by category.</Text></Card> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingTop: 4, paddingBottom: 24, paddingEnd: 20 }} style={{ marginBottom: -16 }}>
            {fin.budgets.map((b) => {
              const { pct, tone, message } = budgetProgress(b);
              const col = tone === "ok" ? c.chart3 : tone === "warn" ? c.chart4 : c.negative;
              return (
                <Card key={b.id} onPress={() => a.openBudget(b.id)} label={`${b.name} budget, ${Math.round(pct * 100)} percent used`} style={{ width: 250, gap: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <IconTile icon={budgetIcon(b.name)} color={col} bg={c.surfaceMuted} size={38} />
                    <View style={{ flex: 1 }}><Text style={{ color: c.text, fontWeight: "700", fontSize: 15 }}>{b.name}</Text><Text style={[{ color: c.textFaint, fontSize: 12 }, tab]}>{a.money(b.limit)}/month</Text></View>
                    <Icon name="chevronRight" size={18} color={c.textFaint} />
                  </View>
                  <ProgressBar value={b.spent} max={b.limit} color={col} />
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={[{ color: c.textMuted, fontSize: 12 }, tab]}>{a.money(b.spent)} of {a.money(b.limit)}</Text>
                    <View style={{ paddingHorizontal: 9, paddingVertical: 2, borderRadius: 999, backgroundColor: col }}><Text style={[{ color: "#fff", fontSize: 11, fontWeight: "800" }, tab]}>{Math.round(pct * 100)}%</Text></View>
                  </View>
                  <Text style={{ color: c.textMuted, fontSize: 12 }}>{message}</Text>
                </Card>
              );
            })}
          </ScrollView>

          {segments.length > 0 ? <SectionTitle title="Your Account Spendings" /> : null}
          {segments.length > 0 ? <Card style={{ gap: 14 }}>
            <Donut segments={segments} selected={seg} onSelect={setSeg} centerTop={pickedSeg ? a.money(pickedSeg.value) : compactMoney(spendTotal)} centerSub={pickedSeg ? `${Math.round((pickedSeg.value / spendTotal) * 100)}% · ${pickedSeg.label}` : "Spent this month"} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {segments.map((s, i) => (
                <Pressable key={s.label} accessibilityRole="button" accessibilityLabel={`${s.label} ${a.money(s.value)}`} accessibilityState={{ selected: seg === i }} onPress={() => setSeg(seg === i ? null : i)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, minHeight: 30, borderRadius: 999, borderWidth: 1.5, borderColor: s.color, backgroundColor: seg === i ? s.color : "transparent" }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: seg === i ? "#fff" : s.color }} />
                  <Text style={{ color: seg === i ? "#fff" : s.color, fontSize: 12, fontWeight: "700" }}>{s.label}</Text>
                </Pressable>
              ))}
            </View>
          </Card> : null}

          <SectionTitle title="Investments" action="Explore" onAction={a.openInvest} />
          <InvestCard a={a} />

          {fin.subscriptions.length > 0 ? <SectionTitle title="Monthly Subscriptions" /> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingTop: 4, paddingBottom: 24, paddingEnd: 20 }} style={{ marginBottom: -16 }}>
            {fin.subscriptions.map((s) => (
              <Card key={s.id} style={{ width: 170, gap: 8 }}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: s.color, alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#fff", fontWeight: "800" }}>{s.name[0]}</Text></View>
                <Text style={{ color: c.text, fontWeight: "700", fontSize: 15 }}>{s.name}</Text>
                <Text style={{ color: c.textFaint, fontSize: 11 }}>Next payment on <Text style={{ fontWeight: "700", color: c.textMuted }}>{inDays(s.nextInDays)}</Text></Text>
                <Pressable accessibilityRole="button" accessibilityLabel={`Pay ${s.name} ${a.money(s.amount)} now`} onPress={() => a.paySub(s.id)} style={({ pressed }) => ({ marginTop: 4, minHeight: 34, borderRadius: r.md, backgroundColor: c.accent, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.85 : 1 })}>
                  <Text style={[{ color: c.accentOn, fontSize: 13, fontWeight: "700" }, tab]}>Pay now {a.money(s.amount)}</Text>
                </Pressable>
              </Card>
            ))}
          </ScrollView>
        </>
      )}
    </ScrollView>
  );
}

/** Shown to a customer with no accounts yet: a clear next step instead of an empty screen. */
function GetStarted({ a, first }: { a: Actions; first: string }) {
  const { c, r } = useTheme();
  const steps = [
    { slug: "connect-account", icon: "bank" as const, title: "Connect your first account", text: "Link a bank to see your balance and spending here." },
    { slug: "add-card", icon: "card" as const, title: "Add a card", text: "Save a card to add money in seconds." },
  ];
  return (
    <>
      <Gradient from={c.heroFrom} to={c.heroTo} radius={r.xl} style={{ padding: 22, gap: 8 }}>
        <Text style={{ color: "rgba(255,255,255,.85)", fontSize: 13 }}>Hi {first}</Text>
        <Text style={{ color: "#fff", fontSize: 24, fontWeight: "800", letterSpacing: -0.4 }}>Let's set up your money</Text>
        <Text style={{ color: "rgba(255,255,255,.85)", fontSize: 14, lineHeight: 20 }}>Connect an account and your balance, spending and budgets appear here.</Text>
      </Gradient>
      {steps.map((s) => {
        const available = a.journeys.some((j) => slugIs(j.slug, s.slug));
        return (
          <Card key={s.slug} onPress={available ? () => a.openJourney(s.slug) : undefined} label={s.title} style={{ flexDirection: "row", alignItems: "center", gap: 14, opacity: available ? 1 : 0.5 }}>
            <IconTile icon={s.icon} color={c.accent} bg={c.accentSoft} size={48} />
            <View style={{ flex: 1 }}><Text style={{ color: c.text, fontWeight: "700", fontSize: 16 }}>{s.title}</Text><Text style={{ color: c.textMuted, fontSize: 13, marginTop: 2 }}>{s.text}</Text></View>
            <Icon name="chevronRight" size={20} color={c.textFaint} />
          </Card>
        );
      })}
    </>
  );
}

/** The dashboard's view of the customer's investments: value and return, or an invitation to start. */
function InvestCard({ a }: { a: Actions }) {
  const { c } = useTheme();
  const inv = a.bank.persona.finance!.invest;
  const t = portfolioTotals(inv.holdings);
  if (inv.holdings.length === 0) {
    return (
      <Card onPress={a.openInvest} label="Start investing" style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <IconTile icon="trend" color={c.accent} bg={c.accentSoft} size={48} />
        <View style={{ flex: 1 }}><Text style={{ color: c.text, fontWeight: "700", fontSize: 16 }}>Start investing</Text><Text style={{ color: c.textMuted, fontSize: 13, marginTop: 2 }}>Buy stocks and funds from as little as $1.</Text></View>
        <Icon name="chevronRight" size={20} color={c.textFaint} />
      </Card>
    );
  }
  return (
    <Card onPress={a.openInvest} label={`Investments, ${a.money2(t.value)}`} style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <IconTile icon="trend" color={c.accent} bg={c.accentSoft} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.textFaint, fontSize: 12 }}>Portfolio value</Text>
          <Text style={[{ color: c.text, fontSize: 22, fontWeight: "800" }, tab]}>{a.money2(t.value)}</Text>
        </View>
        <Pill text={`${t.gain >= 0 ? "+" : "-"}${Math.abs(t.gainPct * 100).toFixed(2)}%`} tone={t.gain >= 0 ? "positive" : "negative"} />
      </View>
      <Text style={{ color: c.textMuted, fontSize: 13 }}>{inv.holdings.length} holdings · {inv.watchlist.length} on your watchlist</Text>
    </Card>
  );
}
