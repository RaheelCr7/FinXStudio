import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { BankApp, actionMeta, displayName, notifications, orderedActions, usd, usd2 } from "@finx/bank-client";
import { localize } from "@finx/renderer-core";
import { Gradient, Icon, IconTile, JourneyPlayer, Pill, useTheme, type IconName } from "@finx/renderer-native";
import { ServerSetting } from "../ServerSetting";
import { BRAND_INFO } from "../brand";
import { DEFAULT_STUDIO_URL, SERVER_CHANGE_ALLOWED, loadStudioUrl } from "../studio-config";
import { live } from "../live";
import { useBankApp } from "../useBankApp";
import { Dashboard, type Actions } from "./Dashboard";
import { Accounts, BudgetDetail, Budgets, Wallet } from "./Tabs";
import { InstrumentDetail, InvestHome } from "./Invest";
import { Card, Sheet, TabBar, tab } from "./ui";

export function BankWorkxShell() {
  const { c, r } = useTheme();
  // Everything that is not drawing (who is signed in, screens, Studio, journeys, payments, notices) lives in @finx/bank-client, shared with the web app.
  const [app] = useState(() => new BankApp({ preset: BRAND_INFO.preset, bankApi: BRAND_INFO.bankApi, live, studioUrl: DEFAULT_STUDIO_URL }));
  const s = useBankApp(app);
  const [editingServer, setEditingServer] = useState(false);
  const loginScroller = useRef<React.ComponentRef<typeof ScrollView>>(null);
  useEffect(() => { loadStudioUrl().then((u) => app.setStudioUrl(u)); return () => app.dispose(); }, [app]);

  const bank = app.bank;
  const money = usd, money2 = usd2;
  const fin = bank.persona.finance;
  const accounts = bank.persona.accounts;
  const sub = fin?.subscriptions.find((x) => x.id === s.subId) ?? null;
  const { screen, tab: tabId, tick, catalog, toast, paying, sheet, investView, active } = s;

  const actions: Actions = {
    bank, money, money2, journeys: catalog.entries, go: (t) => app.setTab(t), openJourney: (slug, initial) => app.openJourney(slug, initial), openBudget: (id) => app.openBudget(id), paySub: (id) => app.paySubscription(id),
    menu: () => app.openSheet("menu"), notifications: () => app.openSheet("notes"), openInvest: () => app.openInvest(),
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
          {app.personas().map((p) => {
            const on = p.id === s.personaId;
            return (
              <Pressable key={p.id} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => app.selectPersona(p.id)} style={{ padding: 16, borderRadius: r.lg, backgroundColor: c.surface, borderWidth: 2, borderColor: on ? c.accent : "transparent" }}>
                <Text style={{ color: c.text, fontWeight: "700", fontSize: 16 }}>{p.name}</Text>
                <Text style={{ color: c.textMuted, fontSize: 13, marginTop: 4 }}>{p.accounts.length ? `${p.accounts.length} accounts · ${p.finance?.cards.length ?? 0} card · budgets and subscriptions` : "No accounts yet: start from scratch"}</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable accessibilityRole="button" onPress={() => app.login()} style={({ pressed }) => ({ minHeight: 54, borderRadius: r.lg, backgroundColor: c.accent, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.88 : 1, marginTop: 6 })}>
          <Text style={{ color: c.accentOn, fontWeight: "700", fontSize: 16 }}>Log in</Text>
        </Pressable>
        {SERVER_CHANGE_ALLOWED ? <ServerSetting url={s.studioUrl} onChange={(u) => app.setStudioUrl(u)} onEditingChange={setEditingServer} /> : null}
        <Text style={{ textAlign: "center", color: c.textFaint, fontSize: 12, marginTop: 10 }}>Sandbox build · no real money moves</Text>
      </ScrollView>
    );
  }

  if (screen === "journey" && active) {
    return <JourneyPlayer journey={active.journey} initial={active.initial} adapter={app.adapter} onClose={() => app.closeJourney()} onExit={() => app.closeJourney()} />;
  }

  // the Invest screens sit above the tabs, like the budget detail
  if (investView && fin) {
    const back = () => app.backInvest();
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <View style={{ flex: 1, width: "100%", maxWidth: 560, alignSelf: "center" }}>
          {investView.symbol ? <InstrumentDetail key={`${investView.symbol}-${tick}`} symbol={investView.symbol} a={actions} onBack={back} /> : <InvestHome key={tick} a={actions} onBack={back} onOpen={(symbol) => app.openInstrument(symbol)} />}
        </View>
      </View>
    );
  }
  const budget = fin?.budgets.find((b) => b.id === s.budgetId) ?? null;
  if (budget) return <BudgetDetail b={budget} a={actions} onBack={() => app.closeBudget()} />;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flex: 1, width: "100%", maxWidth: 560, alignSelf: "center" }}>
        {tabId === "dashboard" ? <Dashboard key={tick} a={actions} /> : tabId === "accounts" ? <Accounts key={tick} a={actions} /> : tabId === "budgets" ? <Budgets key={tick} a={actions} /> : <Wallet key={tick} a={actions} />}
      </View>
      <View style={{ width: "100%", maxWidth: 560, alignSelf: "center" }}><TabBar tab={tabId} onTab={(t) => app.setTab(t)} onFab={() => app.openSheet("fab")} /></View>

      <Sheet visible={sheet === "fab"} onClose={() => app.closeSheet()} title="What would you like to do?">
        <View style={{ gap: 10 }}>
          {catalog.entries.length === 0 ? <Text style={{ color: c.textMuted }}>No actions are available right now.</Text> : orderedActions(catalog.entries).map((e) => {
            const meta = actionMeta(e.slug);
            const text = meta.text || `Version ${e.version}`;
            return (
              <Card key={e.slug} onPress={() => app.openJourney(e.slug)} label={localize(e.name, "en", "en")} style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 14, boxShadow: undefined } as any}>
                <IconTile icon={meta.icon as IconName} color={c.accent} bg={c.accentSoft} size={46} />
                <View style={{ flex: 1 }}><Text style={{ color: c.text, fontWeight: "700", fontSize: 16 }}>{s.opening === e.slug ? "Opening…" : localize(e.name, "en", "en")}</Text><Text style={{ color: c.textMuted, fontSize: 13 }}>{text}</Text></View>
                <Icon name="chevronRight" size={18} color={c.textFaint} />
              </Card>
            );
          })}
          <View style={{ flexDirection: "row", marginTop: 4 }}><Pill text={catalog.source === "studio" ? "Live from Studio" : "Offline copies"} tone={catalog.source === "studio" ? "positive" : "neutral"} /></View>
        </View>
      </Sheet>

      <Sheet visible={sheet === "notes"} onClose={() => app.closeSheet()} title="Notifications">
        <View style={{ gap: 10 }}>
          {notifications(fin, money).map((n, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: r.md, backgroundColor: c.surfaceMuted }}>
              <IconTile icon={n.icon as IconName} color={n.tone === "negative" ? c.negative : n.tone === "positive" ? c.positive : c.accent} bg={c.surface} size={38} />
              <Text style={{ flex: 1, color: c.text, fontSize: 14 }}>{n.text}</Text>
            </View>
          ))}
        </View>
      </Sheet>

      <Sheet visible={sheet === "menu"} onClose={() => app.closeSheet()} title={displayName(bank.persona) || "Menu"}>
        <View style={{ gap: 10 }}>
          <Text style={{ color: c.textMuted, fontSize: 13 }}>Signed in as a sandbox customer. No real money moves.</Text>
          {SERVER_CHANGE_ALLOWED ? <Text selectable style={{ color: c.textFaint, fontSize: 12 }}>Studio: {s.studioUrl}</Text> : null}
          <Pressable accessibilityRole="button" onPress={() => app.logout()} style={({ pressed }) => ({ minHeight: 48, borderRadius: r.md, borderWidth: 1, borderColor: c.borderStrong, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.85 : 1 })}>
            <Text style={{ color: c.negative, fontWeight: "700", fontSize: 15 }}>Log out</Text>
          </Pressable>
        </View>
      </Sheet>

      <Sheet visible={!!sub} onClose={() => app.cancelPayment()} title="Pay subscription">
        {sub ? (
          <View style={{ gap: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: sub.color, alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#fff", fontWeight: "800", fontSize: 18 }}>{sub.name[0]}</Text></View>
              <View style={{ flex: 1 }}><Text style={{ color: c.text, fontWeight: "700", fontSize: 17 }}>{sub.name}</Text><Text style={{ color: c.textMuted, fontSize: 13 }}>Monthly subscription</Text></View>
              <Text style={[{ color: c.text, fontWeight: "800", fontSize: 20 }, tab]}>{money(sub.amount)}</Text>
            </View>
            <View style={{ padding: 12, borderRadius: r.md, backgroundColor: c.surfaceMuted }}><Text style={{ color: c.textMuted, fontSize: 13 }}>From <Text style={{ color: c.text, fontWeight: "700" }}>{accounts[0]?.name} {accounts[0]?.maskedNumber}</Text> · {money(accounts[0]?.balance ?? 0)} available</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel={paying ? "Paying" : `Pay ${money(sub.amount)}`} disabled={paying} onPress={() => app.confirmPayment()} style={({ pressed }) => ({ minHeight: 52, borderRadius: r.lg, backgroundColor: c.accent, alignItems: "center", justifyContent: "center", opacity: paying ? 0.6 : pressed ? 0.88 : 1 })}>
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
