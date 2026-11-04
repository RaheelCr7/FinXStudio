import React, { useEffect, useRef, useState } from "react";
import { Image, KeyboardAvoidingView, Pressable, ScrollView, Text, View, useColorScheme } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { BankApp, isRtl } from "@finx/bank-client";
import { localize } from "@finx/renderer-core";
import { JourneyPlayer, ThemeProvider, useTheme } from "@finx/renderer-native";
import { formatMoney } from "@finx/ui-kit";
import { ServerSetting } from "./src/ServerSetting";
import { DEFAULT_STUDIO_URL, SERVER_CHANGE_ALLOWED, loadStudioUrl } from "./src/studio-config";
import { BRAND, BRAND_INFO } from "./src/brand";
import { live } from "./src/live";
import { useBankApp } from "./src/useBankApp";
import { BankWorkxShell } from "./src/bankworkx/Shell";

const tab = { fontVariant: ["tabular-nums" as const] };

function MeezanShell() {
  const { c, r: radius } = useTheme();
  // Who is signed in, the Studio catalog, the journey in progress and the language live in @finx/bank-client, shared with the web app.
  const [app] = useState(() => new BankApp({ preset: BRAND_INFO.preset, bankApi: BRAND_INFO.bankApi, live, studioUrl: DEFAULT_STUDIO_URL }));
  const s = useBankApp(app);
  const { screen, personaId, lang, tick, catalog, active } = s;
  useEffect(() => { loadStudioUrl().then((u) => app.setStudioUrl(u)); return () => app.dispose(); }, [app]);
  const bank = app.bank;
  const adapter = app.adapter;
  const studioUrl = s.studioUrl;
  const opening = s.opening;
  const open = (slug: string) => app.openJourney(slug);
  const rtl = isRtl(lang);

  // The Studio server editor sits at the bottom of the sign-in screen. While it is open, keep it in view as the keyboard appears.
  const loginScroller = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [editingServer, setEditingServer] = useState(false);
  const followEditor = () => { if (editingServer) loginScroller.current?.scrollToEnd({ animated: true }); };

  const LangToggle = (
    <Pressable accessibilityRole="button" accessibilityLabel="Switch language" onPress={() => app.toggleLang()}
      style={{ paddingHorizontal: 12, paddingVertical: 6, minHeight: 32, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, justifyContent: "center" }}>
      <Text style={{ color: c.text, fontSize: 13, lineHeight: 20, fontWeight: "600" }}>{lang === "en" ? "اردو" : "English"}</Text>
    </Pressable>
  );

  if (screen === "login") {
    return (
      <ScrollView ref={loginScroller} keyboardShouldPersistTaps="handled" onContentSizeChange={followEditor} onLayout={followEditor}
        contentContainerStyle={{ padding: 24, paddingTop: 56, maxWidth: 480, width: "100%", alignSelf: "center" }}>
        <View style={{ alignItems: "center" }}>
          {BRAND === "meezan"
            ? <Image accessibilityIgnoresInvertColors source={require("./assets/icon.png")} style={{ width: 72, height: 72, borderRadius: 20 }} />
            : <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" }}><Text style={{ color: c.accentOn, fontSize: 32, fontWeight: "800" }}>{BRAND_INFO.name.slice(0, 1)}</Text></View>}
          <Text accessibilityRole="header" style={{ fontSize: 28, fontWeight: "600", color: c.text, marginTop: 14, letterSpacing: -0.4 }}>{BRAND_INFO.name}</Text>
          <Text style={{ color: c.textMuted, marginTop: 6 }}>Sign in with a sandbox customer</Text>
        </View>
        <View style={{ marginTop: 32, gap: 10 }}>
          {app.personas().map((p) => {
            const on = p.id === personaId;
            return (
              <Pressable key={p.id} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => app.selectPersona(p.id)}
                style={{ padding: 16, borderRadius: radius.lg, backgroundColor: c.surface, borderWidth: on ? 2 : 1, borderColor: on ? c.accent : c.border }}>
                <Text style={{ color: c.text, fontWeight: "600", fontSize: 16 }}>{p.name}</Text>
                <Text style={{ color: c.textMuted, fontSize: 13, marginTop: 4 }}>{p.accounts.length ? `${p.accounts.length} account(s) · daily limit ${formatMoney(p.limits.daily)}` : "No accounts (KYC rejected)"}</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable accessibilityRole="button" onPress={() => app.login()} style={({ pressed }) => ({ marginTop: 24, minHeight: 54, paddingVertical: 8, borderRadius: radius.lg, backgroundColor: c.accent, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.88 : 1 })}>
          <Text style={{ color: c.accentOn, fontWeight: "600", fontSize: 16 }}>Log in</Text>
        </Pressable>
        <View style={{ alignItems: "center", marginTop: 20 }}>{LangToggle}</View>
        {SERVER_CHANGE_ALLOWED ? <ServerSetting url={studioUrl} onChange={(u) => app.setStudioUrl(u)} onEditingChange={setEditingServer} /> : null}
        <Text style={{ textAlign: "center", color: c.textFaint, fontSize: 12, marginTop: 24 }}>Sandbox build · no real money moves</Text>
      </ScrollView>
    );
  }

  if (screen === "journey" && active) {
    return (
      <JourneyPlayer journey={active.journey} adapter={adapter} lang={lang}
        onClose={() => app.closeJourney()} onExit={() => app.closeJourney()} />
    );
  }

  const accounts = bank.persona.accounts;
  return (
    <View style={{ flex: 1, direction: rtl ? "rtl" : "ltr" } as any}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 24, gap: 18, maxWidth: 560, width: "100%", alignSelf: "center" }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <View style={{ flexShrink: 1 }}>
            <Text style={{ color: c.textMuted, fontSize: 13 }}>{rtl ? "خوش آمدید" : "Good morning"}</Text>
            <Text style={{ color: c.text, fontSize: 20, fontWeight: "600" }}>{bank.persona.name.split(" (")[0]}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>{LangToggle}
            <Pressable accessibilityRole="button" onPress={() => app.logout()} style={{ paddingHorizontal: 12, paddingVertical: 6, minHeight: 32, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, justifyContent: "center" }}><Text style={{ color: c.text, fontSize: 13, fontWeight: "600" }}>Log out</Text></Pressable>
          </View>
        </View>

        {accounts.length === 0 ? (
          <View style={{ padding: 20, borderRadius: radius.xl, backgroundColor: c.warningBg }}>
            <Text style={{ color: c.warning, fontWeight: "600" }}>Account opening was not approved</Text>
            <Text style={{ color: c.warning, marginTop: 6 }}>Your KYC was rejected. Contact support or try again with a new document.</Text>
          </View>
        ) : (
          <View style={{ padding: 20, borderRadius: radius.xl, backgroundColor: c.accent }}>
            <Text style={{ color: c.accentOn, opacity: 0.85, fontSize: 13 }}>{accounts[0]!.name} {accounts[0]!.maskedNumber}</Text>
            <Text key={tick} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={[{ color: c.accentOn, fontSize: 32, fontWeight: "600", marginTop: 6, letterSpacing: -0.6 }, tab]}>{formatMoney(accounts[0]!.balance, accounts[0]!.currency)}</Text>
            <Text style={{ color: c.accentOn, opacity: 0.85, fontSize: 13, marginTop: 10 }}>Daily limit used {formatMoney(bank.persona.limits.usedToday)} of {formatMoney(bank.persona.limits.daily)}</Text>
          </View>
        )}

        <Text accessibilityRole="header" style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>{rtl ? "سروسز" : "Services"}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {catalog.entries.map((e) => {
            const name = localize(e.name, lang, "en");
            const busy = opening === e.slug;
            return (
              <Pressable key={e.slug} accessibilityRole="button" accessibilityLabel={name} disabled={accounts.length === 0 || busy} onPress={() => open(e.slug)}
                style={({ pressed }) => ({ width: "47.5%", padding: 14, borderRadius: radius.lg, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, opacity: accounts.length === 0 ? 0.45 : pressed ? 0.85 : 1, gap: 10 })}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: c.accentSoft, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: c.accent, fontWeight: "700", fontSize: 16 }}>{name.slice(0, 1)}</Text>
                </View>
                <Text style={{ color: c.text, fontWeight: "600", fontSize: 15 }}>{busy ? "…" : name}</Text>
                <Text style={{ color: c.textFaint, fontSize: 12 }}>v{e.version}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ paddingHorizontal: 10, height: 24, borderRadius: radius.pill, justifyContent: "center", backgroundColor: catalog.source === "studio" ? c.positiveBg : c.warningBg }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: catalog.source === "studio" ? c.positive : c.warning }}>{catalog.source === "studio" ? `Live from Studio · ${catalog.entries.length} journeys` : "Offline copies"}</Text>
          </View>
        </View>
        <Text style={{ color: c.textFaint, fontSize: 12 }}>Services come from the journeys published in FinX Studio. Publish a new journey there and it appears here.</Text>
        {SERVER_CHANGE_ALLOWED ? <Text selectable style={{ color: c.textFaint, fontSize: 12 }}>Studio: {studioUrl}</Text> : null}
      </ScrollView>
    </View>
  );
}

export default function App() {
  const scheme = useColorScheme();
  const mode = scheme === "dark" ? "dark" : "light";
  return (
    <SafeAreaProvider>
      <ThemeProvider mode={mode} brand={BRAND}>
        <Root mode={mode} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/** Android draws behind the status bar and the gesture bar, so leave room for both. */
function Root({ mode }: { mode: "light" | "dark" }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }}>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      {/* Drawing edge to edge, Android no longer shrinks the window for the keyboard, so lift the content here. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        {BRAND_INFO.preset === "bankworkx" ? <BankWorkxShell /> : <MeezanShell />}
      </KeyboardAvoidingView>
    </View>
  );
}
