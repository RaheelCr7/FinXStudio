import React from "react";
import { Modal, Platform, Pressable, ScrollView, Text, View, type ViewStyle } from "react-native";
import { Icon, IconTile, useTheme, type IconName } from "@finx/renderer-native";
import type { Colors } from "@finx/ui-kit";
import type { Category, Txn } from "@finx/mock-bank-api";

export const tab = { fontVariant: ["tabular-nums" as const] };

/** Soft elevation that works on iOS, Android and the web. */
export const lift = (mode: "light" | "dark"): ViewStyle => Platform.select<ViewStyle>({
  ios: { shadowColor: mode === "dark" ? "#000" : "#2A2F6B", shadowOpacity: mode === "dark" ? 0.5 : 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  android: { elevation: 3 },
  default: { boxShadow: mode === "dark" ? "0 6px 18px rgba(0,0,0,.45)" : "0 6px 18px rgba(42,47,107,.10)" } as any,
})!;

export function Card({ children, style, onPress, label }: { children: React.ReactNode; style?: ViewStyle; onPress?: () => void; label?: string }) {
  const { c, r, mode } = useTheme();
  const body = { backgroundColor: c.surface, borderRadius: r.lg, padding: 16, ...lift(mode), ...style } as ViewStyle;
  return onPress
    ? <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [body, { opacity: pressed ? 0.92 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] }]}>{children}</Pressable>
    : <View style={body}>{children}</View>;
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
      <Text accessibilityRole="header" style={{ color: c.text, fontSize: 17, fontWeight: "700", letterSpacing: -0.2 }}>{title}</Text>
      {action ? <Pressable accessibilityRole="button" onPress={onAction} hitSlop={10}><Text style={{ color: c.accent, fontSize: 13, fontWeight: "700" }}>{action}</Text></Pressable> : null}
    </View>
  );
}

/** Icon and tint for a spending category. The tile background is the icon colour at low strength, so it suits light and dark. */
export function categoryStyle(c: Colors, cat: Category): { icon: IconName; fg: string; bg: string } {
  const pick = (): { icon: IconName; fg: string } => {
    switch (cat) {
      case "investing": return { icon: "trend", fg: c.chart2 };
      case "income": return { icon: "briefcase", fg: c.accent };
      case "shopping": return { icon: "bag", fg: "#E8872B" };
      case "food": case "coffee": return { icon: "food", fg: c.chart5 };
      case "rent": return { icon: "home", fg: c.chart2 };
      case "groceries": return { icon: "bag", fg: c.chart3 };
      case "health": return { icon: "shield", fg: c.chart6 };
      case "vehicle": case "transport": return { icon: "trend", fg: c.chart1 };
      case "entertainment": return { icon: "repeat", fg: c.chart6 };
    }
  };
  const { icon, fg } = pick();
  return { icon, fg, bg: `${fg}26` };
}

export function dayLabel(daysAgo: number): string {
  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  const d = new Date(Date.now() - daysAgo * 86400000);
  return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
}
export const inDays = (n: number) => new Date(Date.now() + n * 86400000).toLocaleDateString("en-US", { day: "numeric", month: "short" });

export function TxnRow({ t, money, open, onPress }: { t: Txn; money: (n: number) => string; open?: boolean; onPress?: () => void }) {
  const { c, r } = useTheme();
  const s = categoryStyle(c, t.category);
  const out = t.amount < 0;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${t.title}, ${money(t.amount)}`} accessibilityState={{ expanded: !!open }} onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 }}>
        <IconTile icon={s.icon} color={s.fg} bg={s.bg} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.text, fontWeight: "600", fontSize: 15 }}>{t.title}</Text>
          <Text style={{ color: c.textFaint, fontSize: 12, marginTop: 2 }}>{dayLabel(t.daysAgo)}{t.time ? ` · ${t.time}` : ""}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text style={[{ color: out ? c.negative : c.positive, fontWeight: "700", fontSize: 15 }, tab]}>{out ? "-" : "+"}{money(Math.abs(t.amount))}</Text>
          <Icon name={out ? "down" : "up"} size={14} color={out ? c.negative : c.positive} />
        </View>
      </View>
      {open ? (
        <View style={{ marginLeft: 56, marginBottom: 8, padding: 10, borderRadius: r.md, backgroundColor: c.surfaceMuted, gap: 2 }}>
          <Text style={{ color: c.textMuted, fontSize: 12 }}>Category: <Text style={{ color: c.text, fontWeight: "600", textTransform: "capitalize" }}>{t.category}</Text></Text>
          <Text style={{ color: c.textMuted, fontSize: 12 }}>Reference: <Text style={{ color: c.text, fontWeight: "600" }}>{t.id.toUpperCase()}</Text></Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** A panel that slides up from the bottom. */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const { c, r } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close" onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(10,12,40,.5)", justifyContent: "flex-end" }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: c.surface, borderTopLeftRadius: r.xl, borderTopRightRadius: r.xl, padding: 20, paddingBottom: 32, maxHeight: "86%", width: "100%", maxWidth: 560, alignSelf: "center" }}>
          <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: c.borderStrong, marginBottom: 14 }} />
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
            <Text accessibilityRole="header" style={{ flex: 1, color: c.text, fontSize: 18, fontWeight: "700" }}>{title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={10}><Icon name="x" size={22} color={c.textMuted} /></Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export type TabId = "dashboard" | "accounts" | "budgets" | "wallet";
const TABS: { id: TabId; label: string; icon: IconName }[] = [
  { id: "dashboard", label: "Dashboard", icon: "home" }, { id: "accounts", label: "Accounts", icon: "accounts" },
  { id: "budgets", label: "Budgets", icon: "budgets" }, { id: "wallet", label: "Wallet", icon: "wallet" },
];

/** Four tabs with the round action button standing above the middle. */
export function TabBar({ tab: active, onTab, onFab }: { tab: TabId; onTab: (t: TabId) => void; onFab: () => void }) {
  const { c, mode } = useTheme();
  const item = (t: (typeof TABS)[number]) => {
    const on = t.id === active;
    return (
      <Pressable key={t.id} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={t.label} onPress={() => onTab(t.id)} style={{ flex: 1, alignItems: "center", paddingVertical: 8, gap: 3 }}>
        <Icon name={t.icon} size={22} color={on ? c.accent : c.textFaint} />
        <Text style={{ fontSize: 11, fontWeight: on ? "700" : "500", color: on ? c.accent : c.textFaint }}>{t.label}</Text>
      </Pressable>
    );
  };
  return (
    <View style={{ backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 8, paddingBottom: 6, ...lift(mode) }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
        {item(TABS[0]!)}{item(TABS[1]!)}
        <View style={{ width: 64 }} />
        {item(TABS[2]!)}{item(TABS[3]!)}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Quick actions" onPress={onFab} style={({ pressed }) => ({ position: "absolute", alignSelf: "center", top: -26, width: 56, height: 56, borderRadius: 28, backgroundColor: c.fab, alignItems: "center", justifyContent: "center", transform: [{ scale: pressed ? 0.94 : 1 }], ...lift(mode) })}>
        <Icon name="plus" size={28} color={c.fabOn} stroke={2.6} />
      </Pressable>
    </View>
  );
}
