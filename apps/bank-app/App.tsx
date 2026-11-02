import React, { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, SafeAreaView, ScrollView, StatusBar, Text, View, useColorScheme } from "react-native";
import { Journey, lintJourney, localTransfer } from "@finx/journey-schema";
import { MockBank, personas } from "@finx/mock-bank-api";
import { JourneyPlayer, ThemeProvider, useTheme } from "@finx/renderer-native";
import { formatMoney, radius } from "@finx/ui-kit";

type Screen = { name: "login" } | { name: "home" } | { name: "journey" };
type Live = { journey: Journey; source: "studio" | "bundled" };

// Over-the-air journeys: the app asks Studio for the published version each time, and never trusts it blindly.
const STUDIO = process.env.EXPO_PUBLIC_STUDIO_URL ?? (Platform.OS === "android" ? "http://10.0.2.2:3100" : "http://localhost:3100");
async function loadJourney(slug: string): Promise<Live> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 2500);
    const res = await fetch(`${STUDIO}/api/journeys/${slug}?env=published`, { signal: ctl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error(String(res.status));
    const parsed = Journey.safeParse(await res.json());
    if (!parsed.success || lintJourney(parsed.data).length) throw new Error("invalid journey");
    return { journey: parsed.data, source: "studio" };
  } catch {
    return { journey: localTransfer, source: "bundled" };
  }
}
const tab = { fontVariant: ["tabular-nums" as const] };

function Shell() {
  const { c, mode } = useTheme();
  const [screen, setScreen] = useState<Screen>({ name: "login" });
  const [personaId, setPersonaId] = useState("ayesha");
  const [lang, setLang] = useState("en");
  const [tick, setTick] = useState(0);
  const [live, setLive] = useState<Live>({ journey: localTransfer, source: "bundled" });
  useEffect(() => { if (screen.name === "home") loadJourney("fund-transfer-local").then(setLive); }, [screen.name, tick]);
  const bank = useMemo(() => new MockBank(personaId), [personaId, screen.name === "login"]);
  const adapter = useMemo(() => (id: string, input: Record<string, any>) => bank.call(id, input), [bank]);
  const rtl = lang === "ur";

  const LangToggle = (
    <Pressable accessibilityRole="button" accessibilityLabel="Switch language" onPress={() => setLang(lang === "en" ? "ur" : "en")}
      style={{ paddingHorizontal: 12, height: 32, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, justifyContent: "center" }}>
      <Text style={{ color: c.text, fontSize: 13, fontWeight: "600" }}>{lang === "en" ? "اردو" : "English"}</Text>
    </Pressable>
  );

  if (screen.name === "login") {
    return (
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 56, maxWidth: 480, width: "100%", alignSelf: "center" }}>
        <View style={{ alignItems: "center" }}>
          <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 28, color: c.accentOn }}>🏛</Text></View>
          <Text accessibilityRole="header" style={{ fontSize: 28, fontWeight: "600", color: c.text, marginTop: 14, letterSpacing: -0.4 }}>Meezan Digital</Text>
          <Text style={{ color: c.textMuted, marginTop: 6 }}>Sign in with a sandbox customer</Text>
        </View>
        <View style={{ marginTop: 32, gap: 10 }}>
          {Object.values(personas).map((p) => {
            const on = p.id === personaId;
            return (
              <Pressable key={p.id} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setPersonaId(p.id)}
                style={{ padding: 16, borderRadius: radius.lg, backgroundColor: c.surface, borderWidth: on ? 2 : 1, borderColor: on ? c.accent : c.border }}>
                <Text style={{ color: c.text, fontWeight: "600", fontSize: 16 }}>{p.name}</Text>
                <Text style={{ color: c.textMuted, fontSize: 13, marginTop: 4 }}>{p.accounts.length ? `${p.accounts.length} account(s) · daily limit ${formatMoney(p.limits.daily)}` : "No accounts (KYC rejected)"}</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable accessibilityRole="button" onPress={() => setScreen({ name: "home" })} style={({ pressed }) => ({ marginTop: 24, height: 54, borderRadius: radius.lg, backgroundColor: c.accent, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.88 : 1 })}>
          <Text style={{ color: c.accentOn, fontWeight: "600", fontSize: 16 }}>Log in</Text>
        </Pressable>
        <View style={{ alignItems: "center", marginTop: 20 }}>{LangToggle}</View>
        <Text style={{ textAlign: "center", color: c.textFaint, fontSize: 12, marginTop: 24 }}>Sandbox build · no real money moves</Text>
      </ScrollView>
    );
  }

  if (screen.name === "journey") {
    return (
      <JourneyPlayer journey={live.journey} adapter={adapter} lang={lang}
        onClose={() => { setTick(tick + 1); setScreen({ name: "home" }); }} onExit={() => { setTick(tick + 1); setScreen({ name: "home" }); }} />
    );
  }

  const accounts = bank.persona.accounts;
  return (
    <View style={{ flex: 1, direction: rtl ? "rtl" : "ltr" } as any}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 24, gap: 18, maxWidth: 560, width: "100%", alignSelf: "center" }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={{ color: c.textMuted, fontSize: 13 }}>{rtl ? "خوش آمدید" : "Good morning"}</Text>
            <Text style={{ color: c.text, fontSize: 20, fontWeight: "600" }}>{bank.persona.name.split(" (")[0]}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>{LangToggle}
            <Pressable accessibilityRole="button" onPress={() => setScreen({ name: "login" })} style={{ paddingHorizontal: 12, height: 32, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, justifyContent: "center" }}><Text style={{ color: c.text, fontSize: 13, fontWeight: "600" }}>Log out</Text></Pressable>
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
            <Text key={tick} style={[{ color: c.accentOn, fontSize: 32, fontWeight: "600", marginTop: 6, letterSpacing: -0.6 }, tab]}>{formatMoney(accounts[0]!.balance, accounts[0]!.currency)}</Text>
            <Text style={{ color: c.accentOn, opacity: 0.85, fontSize: 13, marginTop: 10 }}>Daily limit used {formatMoney(bank.persona.limits.usedToday)} of {formatMoney(bank.persona.limits.daily)}</Text>
          </View>
        )}

        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          {[{ k: "transfer", en: "Transfer", ur: "ٹرانسفر", go: true }, { k: "bills", en: "Bills", ur: "بلز" }, { k: "topup", en: "Top-up", ur: "ٹاپ اپ" }, { k: "scan", en: "Scan", ur: "اسکین" }].map((a) => (
            <Pressable key={a.k} accessibilityRole="button" accessibilityLabel={a.en} disabled={!a.go || accounts.length === 0} onPress={() => setScreen({ name: "journey" })}
              style={({ pressed }) => ({ alignItems: "center", gap: 8, opacity: !a.go || accounts.length === 0 ? 0.45 : pressed ? 0.8 : 1, width: 76 })}>
              <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: c.accentSoft, alignItems: "center", justifyContent: "center" }}><Text style={{ color: c.accent, fontWeight: "700", fontSize: 16 }}>{a.en.slice(0, 1)}</Text></View>
              <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: "500" }}>{rtl ? a.ur : a.en}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ paddingHorizontal: 10, height: 24, borderRadius: radius.pill, justifyContent: "center", backgroundColor: live.source === "studio" ? c.positiveBg : c.warningBg }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: live.source === "studio" ? c.positive : c.warning }}>{live.source === "studio" ? `Live from Studio · v${live.journey.version}` : `Offline copy · v${live.journey.version}`}</Text>
          </View>
        </View>
        <Text style={{ color: c.textFaint, fontSize: 12 }}>Transfer runs the “Send to beneficiary” journey published from FinX Studio. Bills, Top-up and Scan arrive with their journeys.</Text>
      </ScrollView>
    </View>
  );
}

export default function App() {
  const scheme = useColorScheme();
  const mode = scheme === "dark" ? "dark" : "light";
  return (
    <ThemeProvider mode={mode}>
      <Root mode={mode} />
    </ThemeProvider>
  );
}
function Root({ mode }: { mode: "light" | "dark" }) {
  const { c } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0 }}>
      <StatusBar barStyle={mode === "dark" ? "light-content" : "dark-content"} />
      <Shell />
    </SafeAreaView>
  );
}
