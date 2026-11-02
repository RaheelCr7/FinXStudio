import React, { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, SafeAreaView, ScrollView, StatusBar, Text, View, useColorScheme } from "react-native";
import { Journey, lintJourney, localTransfer, payBill } from "@finx/journey-schema";
import { MockBank, personas } from "@finx/mock-bank-api";
import { localize } from "@finx/renderer-core";
import { JourneyPlayer, ThemeProvider, useTheme } from "@finx/renderer-native";
import { formatMoney, radius } from "@finx/ui-kit";

type Screen = { name: "login" } | { name: "home" } | { name: "journey" };
type Live = { journey: Journey; source: "studio" | "bundled" };

// Over-the-air journeys: the app asks Studio what is published, and never trusts a journey blindly.
const STUDIO = process.env.EXPO_PUBLIC_STUDIO_URL ?? (Platform.OS === "android" ? "http://10.0.2.2:3100" : "http://localhost:3100");
const BUNDLED: Record<string, Journey> = { [localTransfer.slug]: localTransfer, [payBill.slug]: payBill };
type Entry = { slug: string; name: any; version: number };
const bundledEntries = (): Entry[] => Object.values(BUNDLED).map((j) => ({ slug: j.slug, name: j.name, version: j.version }));

async function timedFetch(url: string) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 2500);
  try { const res = await fetch(url, { signal: ctl.signal }); if (!res.ok) throw new Error(String(res.status)); return await res.json(); }
  finally { clearTimeout(t); }
}
async function loadCatalog(): Promise<{ entries: Entry[]; source: "studio" | "bundled" }> {
  try {
    const list = await timedFetch(`${STUDIO}/api/journeys`);
    const entries = (list as any[]).filter((j) => j.publishedVersion != null).map((j) => ({ slug: j.slug, name: j.name, version: j.publishedVersion }));
    return { entries, source: "studio" };
  } catch { return { entries: bundledEntries(), source: "bundled" }; }
}
async function loadJourney(slug: string): Promise<Live | null> {
  try {
    const parsed = Journey.safeParse(await timedFetch(`${STUDIO}/api/journeys/${slug}?env=published`));
    if (!parsed.success || lintJourney(parsed.data).length) throw new Error("invalid journey");
    return { journey: parsed.data, source: "studio" };
  } catch {
    const fallback = BUNDLED[slug];
    return fallback ? { journey: fallback, source: "bundled" } : null;
  }
}

const tab = { fontVariant: ["tabular-nums" as const] };

function Shell() {
  const { c, mode } = useTheme();
  const [screen, setScreen] = useState<Screen>({ name: "login" });
  const [personaId, setPersonaId] = useState("ayesha");
  const [lang, setLang] = useState("en");
  const [tick, setTick] = useState(0);
  const [catalog, setCatalog] = useState<{ entries: Entry[]; source: "studio" | "bundled" }>({ entries: bundledEntries(), source: "bundled" });
  const [active, setActive] = useState<Live | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  useEffect(() => { if (screen.name === "home") loadCatalog().then(setCatalog); }, [screen.name, tick]);
  async function open(slug: string) {
    setOpening(slug);
    const l = await loadJourney(slug);
    setOpening(null);
    if (l) { setActive(l); setScreen({ name: "journey" }); }
  }
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

  if (screen.name === "journey" && active) {
    return (
      <JourneyPlayer journey={active.journey} adapter={adapter} lang={lang}
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
