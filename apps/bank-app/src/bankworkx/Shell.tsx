import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { MockBank, personasFor } from "@finx/mock-bank-api";
import { localize } from "@finx/renderer-core";
import { Gradient, Icon, IconTile, JourneyPlayer, Pill, useTheme, type IconName } from "@finx/renderer-native";
import { formatMoney } from "@finx/ui-kit";
import { ServerSetting } from "../ServerSetting";
import { BRAND_INFO } from "../brand";
import { DEFAULT_STUDIO_URL, SERVER_CHANGE_ALLOWED, loadStudioUrl } from "../studio-config";
import { bundledEntries, loadCatalog, loadJourney, slugIs, type Entry, type Live } from "../live";
import { Dashboard, type Actions } from "./Dashboard";
import { Accounts, BudgetDetail, Budgets, Wallet } from "./Tabs";
import { InstrumentDetail, InvestHome } from "./Invest";
import { Card, Sheet, TabBar, tab, type TabId } from "./ui";

const SLUG_ICON: Record<string, { icon: IconName; text: string }> = {
  "add-money": { icon: "dollar", text: "Top up your account from a saved card" },
  "add-card": { icon: "card", text: "Save a debit or credit card" },
  "connect-account": { icon: "bank", text: "Link an account from another bank" },
  "create-budget": { icon: "budgets", text: "Set a monthly spending limit" },
  invest: { icon: "trend", text: "Buy a stock or fund" },
  "sell-investment": { icon: "down", text: "Sell part or all of a holding" },
};

/** Known actions first, in a sensible order; anything a team adds in Studio follows. */
const kindOf = (slug: string) => Object.keys(SLUG_ICON).find((k) => slugIs(slug, k));
const rank = (slug: string) => { const k = kindOf(slug); return k ? Object.keys(SLUG_ICON).indexOf(k) : 99; };

export function BankWorkxShell() {
  const { c, r } = useTheme();
  const [screen, setScreen] = useState<"login" | "app" | "journey">("login");
  const [personaId, setPersonaId] = useState("alex");
  const [tabId, setTabId] = useState<TabId>("dashboard");
  const [budgetId, setBudgetId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | "fab" | "menu" | "notes">(null);
  const [investView, setInvestView] = useState<null | { symbol?: string }>(null);
  const [subId, setSubId] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const [tick, setTick] = useState(0);
  const [catalog, setCatalog] = useState<{ entries: Entry[]; source: "studio" | "bundled" }>({ entries: bundledEntries(), source: "bundled" });
  const [active, setActive] = useState<(Live & { initial?: Record<string, any> }) | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [studioUrl, setStudioUrl] = useState(DEFAULT_STUDIO_URL);
  const [editingServer, setEditingServer] = useState(false);
  const loginScroller = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { loadStudioUrl().then(setStudioUrl); }, []);
  useEffect(() => { if (screen === "app") loadCatalog(studioUrl).then(setCatalog); }, [screen, tick, studioUrl]);
  const bank = useMemo(() => new MockBank(personaId), [personaId, screen === "login"]);
  const adapter = useMemo(() => (id: string, input: Record<string, any>) => bank.call(id, input), [bank]);
  const money = useMemo(() => (n: number) => formatMoney(n, "USD"), []);
  const money2 = useMemo(() => (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n), []);
  const say = (text: string, ok = true) => { setToast({ text, ok }); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setToast(null), 3200); };

  async function openJourney(want: string, initial?: Record<string, any>) {
    const slug = catalog.entries.find((e) => slugIs(e.slug, want))?.slug ?? want;
    setSheet(null); setOpening(slug);
    const l = await loadJourney(studioUrl, slug);
    setOpening(null);
    if (l) { setActive({ ...l, initial }); setScreen("journey"); } else say("That journey is not available right now.", false);
  }
  const closeJourney = () => { setTick((t) => t + 1); setScreen("app"); };

  const fin = bank.persona.finance;
  const accounts = bank.persona.accounts;
  const sub = fin?.subscriptions.find((x) => x.id === subId) ?? null;
  async function confirmPay() {
    if (!sub || !accounts[0]) return;
    setPaying(true);
    try { await bank.call("bank.subscriptions.pay", { subscriptionId: sub.id, fromAccountId: accounts[0].id }); setTick((t) => t + 1); setSubId(null); say(`Paid ${sub.name} ${money(sub.amount)}`); }
    catch (e: any) { say(e?.message ?? "Payment failed", false); }
    finally { setPaying(false); }
  }

  const actions: Actions = {
    bank, money, money2, journeys: catalog.entries, go: (t) => setTabId(t), openJourney, openBudget: (id) => setBudgetId(id), paySub: (id) => setSubId(id),
    menu: () => setSheet("menu"), notifications: () => setSheet("notes"), openInvest: () => setInvestView({}),
  };

  if (screen === "login") {
    return (
      <ScrollView ref={loginScroller} keyboardShouldPersistTaps="handled" onContentSizeChange={() => { if (editingServer) loginScroller.current?.scrollToEnd({ animated: true }); }}
        contentContainerStyle={{ padding: 24, paddingTop: 48, maxWidth: 480, width: "100%", alignSelf: "center", gap: 14 }}>
        <View style={{ alignItems: "center", gap: 6 }}>
          <Gradient from={c.heroFrom} to={c.heroTo} radius={22} style={{ width: 72, height: 72, alignItems: "center", justifyContent: "center" }}><Icon name="wallet" size={34} color="#fff" /></Gradient>
          <Text accessibilityRole="header" style={{ fontSize: 30, fontWeight: "800", color: c.text, marginTop: 10, letterSpacing: -0.6 }}>{BRAND_INFO.name}</Text>
          <Text style={{ color: c.textMuted }}>Sign in with a sandbox customer</Text>
        </View>
        <View style={{ gap: 10, marginTop: 14 }}>
          {personasFor(BRAND_INFO.preset).map((p) => {
            const on = p.id === personaId;
            return (
              <Pressable key={p.id} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setPersonaId(p.id)} style={{ padding: 16, borderRadius: r.lg, backgroundColor: c.surface, borderWidth: 2, borderColor: on ? c.accent : "transparent" }}>
                <Text style={{ color: c.text, fontWeight: "700", fontSize: 16 }}>{p.name}</Text>
                <Text style={{ color: c.textMuted, fontSize: 13, marginTop: 4 }}>{p.accounts.length ? `${p.accounts.length} accounts · ${p.finance?.cards.length ?? 0} card · budgets and subscriptions` : "No accounts yet: start from scratch"}</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable accessibilityRole="button" onPress={() => { setTabId("dashboard"); setScreen("app"); }} style={({ pressed }) => ({ minHeight: 54, borderRadius: r.lg, backgroundColor: c.accent, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.88 : 1, marginTop: 6 })}>
          <Text style={{ color: c.accentOn, fontWeight: "700", fontSize: 16 }}>Log in</Text>
        </Pressable>
        {SERVER_CHANGE_ALLOWED ? <ServerSetting url={studioUrl} onChange={setStudioUrl} onEditingChange={setEditingServer} /> : null}
        <Text style={{ textAlign: "center", color: c.textFaint, fontSize: 12, marginTop: 10 }}>Sandbox build · no real money moves</Text>
      </ScrollView>
    );
  }

  if (screen === "journey" && active) {
    return <JourneyPlayer journey={active.journey} initial={active.initial} adapter={adapter} onClose={closeJourney} onExit={closeJourney} />;
  }

  // the Invest screens sit above the tabs, like the budget detail
  if (investView && fin) {
    const back = investView.symbol ? () => setInvestView({}) : () => setInvestView(null);
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <View style={{ flex: 1, width: "100%", maxWidth: 560, alignSelf: "center" }}>
          {investView.symbol ? <InstrumentDetail key={`${investView.symbol}-${tick}`} symbol={investView.symbol} a={actions} onBack={back} /> : <InvestHome key={tick} a={actions} onBack={back} onOpen={(symbol) => setInvestView({ symbol })} />}
        </View>
      </View>
    );
  }
  const budget = fin?.budgets.find((b) => b.id === budgetId) ?? null;
  if (budget) return <BudgetDetail b={budget} a={actions} onBack={() => setBudgetId(null)} />;

  const notes: { icon: IconName; text: string; tone: "negative" | "accent" | "positive" }[] = [];
  for (const b of fin?.budgets ?? []) if (b.limit && b.spent / b.limit >= 0.9) notes.push({ icon: "budgets", text: `${b.name} budget is ${Math.round((b.spent / b.limit) * 100)}% used`, tone: "negative" });
  for (const s of fin?.subscriptions ?? []) if (s.nextInDays <= 5) notes.push({ icon: "repeat", text: `${s.name} renews in ${s.nextInDays} days (${money(s.amount)})`, tone: "accent" });
  if (notes.length === 0) notes.push({ icon: "check", text: "You're all caught up.", tone: "positive" });

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flex: 1, width: "100%", maxWidth: 560, alignSelf: "center" }}>
        {tabId === "dashboard" ? <Dashboard key={tick} a={actions} /> : tabId === "accounts" ? <Accounts key={tick} a={actions} /> : tabId === "budgets" ? <Budgets key={tick} a={actions} /> : <Wallet key={tick} a={actions} />}
      </View>
      <View style={{ width: "100%", maxWidth: 560, alignSelf: "center" }}><TabBar tab={tabId} onTab={setTabId} onFab={() => setSheet("fab")} /></View>

      <Sheet visible={sheet === "fab"} onClose={() => setSheet(null)} title="What would you like to do?">
        <View style={{ gap: 10 }}>
          {catalog.entries.length === 0 ? <Text style={{ color: c.textMuted }}>No actions are available right now.</Text> : [...catalog.entries].sort((x, y) => rank(x.slug) - rank(y.slug)).map((e) => {
            const meta = SLUG_ICON[kindOf(e.slug) ?? ""] ?? { icon: "plus" as IconName, text: `Version ${e.version}` };
            return (
              <Card key={e.slug} onPress={() => openJourney(e.slug)} label={localize(e.name, "en", "en")} style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 14, boxShadow: undefined } as any}>
                <IconTile icon={meta.icon} color={c.accent} bg={c.accentSoft} size={46} />
                <View style={{ flex: 1 }}><Text style={{ color: c.text, fontWeight: "700", fontSize: 16 }}>{opening === e.slug ? "Opening…" : localize(e.name, "en", "en")}</Text><Text style={{ color: c.textMuted, fontSize: 13 }}>{meta.text}</Text></View>
                <Icon name="chevronRight" size={18} color={c.textFaint} />
              </Card>
            );
          })}
          <View style={{ flexDirection: "row", marginTop: 4 }}><Pill text={catalog.source === "studio" ? "Live from Studio" : "Offline copies"} tone={catalog.source === "studio" ? "positive" : "neutral"} /></View>
        </View>
      </Sheet>

      <Sheet visible={sheet === "notes"} onClose={() => setSheet(null)} title="Notifications">
        <View style={{ gap: 10 }}>
          {notes.map((n, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: r.md, backgroundColor: c.surfaceMuted }}>
              <IconTile icon={n.icon} color={n.tone === "negative" ? c.negative : n.tone === "positive" ? c.positive : c.accent} bg={c.surface} size={38} />
              <Text style={{ flex: 1, color: c.text, fontSize: 14 }}>{n.text}</Text>
            </View>
          ))}
        </View>
      </Sheet>

      <Sheet visible={sheet === "menu"} onClose={() => setSheet(null)} title={bank.persona.name.split(" (")[0] ?? "Menu"}>
        <View style={{ gap: 10 }}>
          <Text style={{ color: c.textMuted, fontSize: 13 }}>Signed in as a sandbox customer. No real money moves.</Text>
          {SERVER_CHANGE_ALLOWED ? <Text selectable style={{ color: c.textFaint, fontSize: 12 }}>Studio: {studioUrl}</Text> : null}
          <Pressable accessibilityRole="button" onPress={() => { setSheet(null); setScreen("login"); }} style={({ pressed }) => ({ minHeight: 48, borderRadius: r.md, borderWidth: 1, borderColor: c.borderStrong, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.85 : 1 })}>
            <Text style={{ color: c.negative, fontWeight: "700", fontSize: 15 }}>Log out</Text>
          </Pressable>
        </View>
      </Sheet>

      <Sheet visible={!!sub} onClose={() => setSubId(null)} title="Pay subscription">
        {sub ? (
          <View style={{ gap: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: sub.color, alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#fff", fontWeight: "800", fontSize: 18 }}>{sub.name[0]}</Text></View>
              <View style={{ flex: 1 }}><Text style={{ color: c.text, fontWeight: "700", fontSize: 17 }}>{sub.name}</Text><Text style={{ color: c.textMuted, fontSize: 13 }}>Monthly subscription</Text></View>
              <Text style={[{ color: c.text, fontWeight: "800", fontSize: 20 }, tab]}>{money(sub.amount)}</Text>
            </View>
            <View style={{ padding: 12, borderRadius: r.md, backgroundColor: c.surfaceMuted }}><Text style={{ color: c.textMuted, fontSize: 13 }}>From <Text style={{ color: c.text, fontWeight: "700" }}>{accounts[0]?.name} {accounts[0]?.maskedNumber}</Text> · {money(accounts[0]?.balance ?? 0)} available</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel={paying ? "Paying" : `Pay ${money(sub.amount)}`} disabled={paying} onPress={confirmPay} style={({ pressed }) => ({ minHeight: 52, borderRadius: r.lg, backgroundColor: c.accent, alignItems: "center", justifyContent: "center", opacity: paying ? 0.6 : pressed ? 0.88 : 1 })}>
              <Text style={{ color: c.accentOn, fontWeight: "700", fontSize: 16 }}>{paying ? "Paying…" : `Pay ${money(sub.amount)}`}</Text>
            </Pressable>
          </View>
        ) : null}
      </Sheet>

      {toast ? (
        <View pointerEvents="none" style={{ position: "absolute", left: 20, right: 20, bottom: 104, alignItems: "center" }}>
          <View accessibilityRole="alert" style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, backgroundColor: c.ink, maxWidth: 420 }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: toast.ok ? c.fab : c.negative, alignItems: "center", justifyContent: "center" }}><Icon name={toast.ok ? "check" : "x"} size={13} color="#fff" stroke={3} /></View>
            <Text style={{ color: c.inkText, fontSize: 14, fontWeight: "600" }}>{toast.text}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
