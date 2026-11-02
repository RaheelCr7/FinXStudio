import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { CardVisual, Icon, IconTile, Pill, ProgressBar, useTheme } from "@finx/renderer-native";
import type { Budget, Txn } from "@finx/mock-bank-api";
import type { Actions } from "./Dashboard";
import { Card, SectionTitle, TxnRow, dayLabel, tab } from "./ui";

const Title = ({ text, onAdd, label }: { text: string; onAdd?: () => void; label?: string }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Text accessibilityRole="header" style={{ color: c.text, fontSize: 26, fontWeight: "800", letterSpacing: -0.5 }}>{text}</Text>
      {onAdd ? <Pressable accessibilityRole="button" accessibilityLabel={label ?? `Add to ${text}`} onPress={onAdd} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.accent2, alignItems: "center", justifyContent: "center" }}><Icon name="plus" size={16} color="#fff" stroke={3} /></Pressable> : null}
    </View>
  );
};
const has = (a: Actions, slug: string) => a.journeys.some((j) => j.slug === slug);

// ---------- Accounts ------------------------------------------------------------------------------------------------------
export function Accounts({ a }: { a: Actions }) {
  const { c, r } = useTheme();
  const fin = a.bank.persona.finance!;
  const items = [
    ...a.bank.persona.accounts.map((x) => ({ id: x.id, name: x.name, bank: "BankWorkx", mask: x.maskedNumber, balance: x.balance })),
    ...fin.linked.map((l) => ({ id: l.id, name: l.kind, bank: l.bank, mask: l.maskedNumber, balance: l.balance })),
  ];
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | "in" | "out">("all");
  const list = useMemo(() => fin.transactions.filter((t) => (kind === "all" || (kind === "in" ? t.amount > 0 : t.amount < 0)) && t.title.toLowerCase().includes(q.trim().toLowerCase())), [fin.transactions, q, kind]);
  const groups = useMemo(() => { const m = new Map<number, Txn[]>(); for (const t of list) m.set(t.daysAgo, [...(m.get(t.daysAgo) ?? []), t]); return [...m.entries()].sort((x, y) => x[0] - y[0]); }, [list]);
  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Title text="Connected Accounts" onAdd={has(a, "connect-account") ? () => a.openJourney("connect-account") : undefined} label="Connect an account" />
      {items.length === 0 ? (
        <Card style={{ alignItems: "center", gap: 8, padding: 24 }}>
          <IconTile icon="bank" color={c.accent} bg={c.accentSoft} size={52} /><Text style={{ color: c.text, fontWeight: "700", fontSize: 16 }}>No accounts yet</Text>
          <Text style={{ color: c.textMuted, textAlign: "center" }}>Connect a bank to see its balance and activity here.</Text>
        </Card>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingEnd: 20, paddingVertical: 6 }}>
          {items.map((x) => {
            const on = (sel ?? items[0]!.id) === x.id;
            return (
              <Pressable key={x.id} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${x.bank} ${x.name} ${x.mask}, ${a.money(x.balance)}`} onPress={() => setSel(x.id)}
                style={{ width: 168, padding: 14, borderRadius: r.lg, backgroundColor: c.surface, borderWidth: 2, borderColor: on ? c.accent2 : "transparent", gap: 8 }}>
                <IconTile icon="bank" color={c.accent} bg={c.accentSoft} size={38} />
                <Text style={{ color: c.textFaint, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 }}>{x.name}</Text>
                <Text style={[{ color: c.text, fontSize: 18, fontWeight: "800" }, tab]}>{a.money(x.balance)}</Text>
                <Text style={{ color: c.textMuted, fontSize: 12 }}>{x.bank} {x.mask}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <SectionTitle title="Transactions" />
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, height: 42, borderRadius: r.md, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
          <TextInput accessibilityLabel="Search transactions" value={q} onChangeText={setQ} placeholder="Search" placeholderTextColor={c.textFaint} style={{ flex: 1, color: c.text, fontSize: 15, padding: 0 }} />
          {q ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQ("")}><Icon name="x" size={16} color={c.textFaint} /></Pressable> : null}
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {([["all", "All"], ["in", "Money in"], ["out", "Money out"]] as const).map(([id, label]) => <Pill key={id} text={label} selected={kind === id} onPress={() => setKind(id)} />)}
      </View>
      {groups.length === 0 ? <Text style={{ color: c.textMuted, textAlign: "center", paddingVertical: 24 }}>No transactions match.</Text> : groups.map(([d, ts]) => (
        <View key={d}>
          <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: "700", marginBottom: 6 }}>{dayLabel(d)}</Text>
          <Card style={{ paddingVertical: 4 }}>{ts.map((t) => <TxnRow key={t.id} t={t} money={a.money} />)}</Card>
        </View>
      ))}
    </ScrollView>
  );
}

// ---------- Budgets -------------------------------------------------------------------------------------------------------
export function Budgets({ a }: { a: Actions }) {
  const { c } = useTheme();
  const budgets = a.bank.persona.finance!.budgets;
  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 14 }} showsVerticalScrollIndicator={false}>
      <Title text="Monthly Budgets" onAdd={has(a, "create-budget") ? () => a.openJourney("create-budget") : undefined} label="Create a budget" />
      {budgets.length === 0 ? (
        <Card style={{ alignItems: "center", gap: 8, padding: 24 }}><IconTile icon="budgets" color={c.accent} bg={c.accentSoft} size={52} /><Text style={{ color: c.text, fontWeight: "700", fontSize: 16 }}>No budgets yet</Text><Text style={{ color: c.textMuted, textAlign: "center" }}>Set a monthly limit for a category and track it here.</Text></Card>
      ) : budgets.map((b) => {
        const pct = b.limit ? b.spent / b.limit : 0;
        const col = pct < 0.6 ? c.chart3 : pct < 0.9 ? c.chart4 : c.negative;
        return (
          <Card key={b.id} onPress={() => a.openBudget(b.id)} label={`${b.name} budget`} style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <IconTile icon={b.name.startsWith("Food") ? "food" : b.name.startsWith("Shop") ? "bag" : "repeat"} color={col} bg={c.surfaceMuted} />
              <View style={{ flex: 1 }}><Text style={{ color: c.text, fontWeight: "700", fontSize: 16 }}>{b.name}</Text><Text style={[{ color: c.textFaint, fontSize: 12 }, tab]}>{a.money(b.limit)}/month</Text></View>
              <Icon name="chevronRight" size={18} color={c.textFaint} />
            </View>
            <Text style={[{ color: c.text, fontWeight: "800", fontSize: 18 }, tab]}>{a.money(Math.max(0, b.limit - b.spent))} <Text style={{ color: c.textFaint, fontSize: 13, fontWeight: "500" }}>left out of {a.money(b.limit)}</Text></Text>
            <ProgressBar value={b.spent} max={b.limit} color={col} height={10} />
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ color: c.textFaint, fontSize: 12 }}>{Math.round(pct * 100)}% used</Text><Text style={[{ color: c.textFaint, fontSize: 12 }, tab]}>{a.money(b.limit - b.spent)} remaining</Text></View>
          </Card>
        );
      })}
    </ScrollView>
  );
}

/** The dark budget screen from the design: what is left, what was spent and a daily allowance. */
export function BudgetDetail({ b, a, onBack }: { b: Budget; a: Actions; onBack: () => void }) {
  const { c, r } = useTheme();
  const [day, setDay] = useState(0);
  const left = Math.max(0, b.limit - b.spent), pct = b.limit ? b.spent / b.limit : 0;
  const daysLeft = 28;
  const col = pct < 0.6 ? c.chart3 : pct < 0.9 ? c.chart4 : c.negative;
  const related = a.bank.persona.finance!.transactions.filter((t) => (b.category === "food" ? t.category === "food" || t.category === "coffee" : t.category === b.category));
  return (
    <View style={{ flex: 1, backgroundColor: c.ink }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 18 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} hitSlop={10}><Icon name="back" size={24} color={c.inkText} /></Pressable>
          <Text accessibilityRole="header" style={{ flex: 1, textAlign: "center", color: c.inkText, fontWeight: "700", fontSize: 16, marginEnd: 24 }}>{b.name} Budget</Text>
        </View>
        <View style={{ alignItems: "center", gap: 4 }}>
          <Text style={[{ color: col, fontSize: 40, fontWeight: "800", letterSpacing: -1 }, tab]}>{a.money(left)}</Text>
          <Text style={{ color: c.inkMuted, fontSize: 13 }}>left out of {a.money(b.limit)}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 12 }}>
          {[["SPENT", a.money(b.spent)], ["BALANCE", a.money(left)]].map(([k, v]) => (
            <View key={k} style={{ flex: 1, padding: 14, borderRadius: r.lg, backgroundColor: "rgba(255,255,255,.07)", alignItems: "center", gap: 4 }}>
              <Text style={[{ color: c.inkText, fontSize: 18, fontWeight: "800" }, tab]}>{v}</Text><Text style={{ color: c.inkMuted, fontSize: 11, letterSpacing: 0.8 }}>{k}</Text>
            </View>
          ))}
        </View>
        <View style={{ gap: 8 }}>
          <ProgressBar value={b.spent} max={b.limit} color={col} track="rgba(255,255,255,.14)" height={12} />
          <Text style={{ color: c.inkMuted, fontSize: 12, textAlign: "center" }}>{Math.round(pct * 100)}% used · {daysLeft} days left</Text>
        </View>
        <View style={{ padding: 14, borderRadius: r.lg, backgroundColor: "rgba(255,255,255,.07)" }}>
          <Text style={{ color: c.inkText, fontSize: 14, lineHeight: 20 }}>You can spend <Text style={[{ color: col, fontWeight: "800" }, tab]}>{a.money(Math.floor(left / daysLeft))}</Text> each day for the rest of the period.</Text>
        </View>
        <Text style={{ color: c.inkText, fontSize: 17, fontWeight: "700" }}>Transactions</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {["This week", "This month"].map((l, i) => <Pressable key={l} accessibilityRole="button" accessibilityState={{ selected: day === i }} onPress={() => setDay(i)} style={{ paddingHorizontal: 14, minHeight: 32, borderRadius: 999, justifyContent: "center", backgroundColor: day === i ? c.accent2 : "rgba(255,255,255,.1)" }}><Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>{l}</Text></Pressable>)}
        </View>
        {related.filter((t) => day === 1 || t.daysAgo <= 7).length === 0 ? <Text style={{ color: c.inkMuted }}>Nothing spent here yet.</Text> : related.filter((t) => day === 1 || t.daysAgo <= 7).map((t) => (
          <View key={t.id} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,.08)" }}>
            <View><Text style={{ color: c.inkText, fontWeight: "600" }}>{t.title}</Text><Text style={{ color: c.inkMuted, fontSize: 12 }}>{dayLabel(t.daysAgo)}</Text></View>
            <Text style={[{ color: c.negative, fontWeight: "700" }, tab]}>-{a.money(Math.abs(t.amount))}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ---------- Wallet ---------------------------------------------------------------------------------------------------------
export function Wallet({ a }: { a: Actions }) {
  const { c, r } = useTheme();
  const cards = a.bank.persona.finance!.cards;
  const [sel, setSel] = useState(0);
  const card = cards[Math.min(sel, cards.length - 1)];
  const actions = [
    { slug: "add-money", icon: "dollar" as const, label: "Add money" }, { slug: "add-card", icon: "card" as const, label: "Add card" }, { slug: "connect-account", icon: "bank" as const, label: "Connect bank" },
  ].filter((x) => has(a, x.slug));
  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 16 }} showsVerticalScrollIndicator={false}>
      <Title text="My Wallet" onAdd={has(a, "add-card") ? () => a.openJourney("add-card") : undefined} label="Add a card" />
      {cards.length === 0 ? (
        <Card onPress={has(a, "add-card") ? () => a.openJourney("add-card") : undefined} label="Add your first card" style={{ alignItems: "center", gap: 8, padding: 26 }}>
          <IconTile icon="card" color={c.accent} bg={c.accentSoft} size={52} /><Text style={{ color: c.text, fontWeight: "700", fontSize: 16 }}>Add your first card</Text><Text style={{ color: c.textMuted, textAlign: "center" }}>Save a card to add money in seconds.</Text>
        </Card>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={316} decelerationRate="fast" contentContainerStyle={{ gap: 16, paddingEnd: 20 }}
            onMomentumScrollEnd={(e) => setSel(Math.round(e.nativeEvent.contentOffset.x / 316))}>
            {cards.map((k, i) => (
              <Pressable key={k.id} accessibilityRole="button" accessibilityLabel={`${k.nickname} card ending ${k.last4}`} accessibilityState={{ selected: i === sel }} onPress={() => setSel(i)} style={{ width: 300, opacity: i === sel ? 1 : 0.7 }}>
                <CardVisual number={`${k.network === "visa" ? "4000" : "5200"}00000000${k.last4}`} holder={k.holder.toUpperCase()} expiry={k.expiry} network={k.network} label={k.network} />
              </Pressable>
            ))}
          </ScrollView>
          {card ? (
            <Card style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Text style={{ color: c.text, fontWeight: "700", fontSize: 17, flex: 1 }}>{card.nickname}</Text>{card.isDefault ? <Pill text="Default" tone="positive" /> : null}</View>
              <Text style={{ color: c.textMuted }}>{card.network === "visa" ? "Visa" : "Mastercard"} ending {card.last4} · expires {card.expiry}</Text>
            </Card>
          ) : null}
        </>
      )}
      <SectionTitle title="Quick actions" />
      <View style={{ flexDirection: "row", gap: 12 }}>
        {actions.map((x) => (
          <Pressable key={x.slug} accessibilityRole="button" accessibilityLabel={x.label} onPress={() => a.openJourney(x.slug)} style={({ pressed }) => ({ flex: 1, alignItems: "center", gap: 8, padding: 14, borderRadius: r.lg, backgroundColor: c.surface, opacity: pressed ? 0.85 : 1 })}>
            <IconTile icon={x.icon} color={c.accent} bg={c.accentSoft} size={44} /><Text style={{ color: c.text, fontWeight: "600", fontSize: 13, textAlign: "center" }}>{x.label}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
