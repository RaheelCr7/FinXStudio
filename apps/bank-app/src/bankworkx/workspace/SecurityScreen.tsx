import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { filtersOn, NO_FILTERS, type BankApp, type HistoryQuery, type HistoryRow, type LaunchPoint } from "@finx/bank-client";
import { Icon, useTheme } from "@finx/renderer-native";
import { Card, Sheet } from "../ui";
import { useBankApp } from "../../useBankApp";
import { Notice } from "./ScreenView";

const RESULTS = [["all", "All"], ["ok", "Signed in"], ["failed", "Failed"]] as const;
const PERIODS = [[7, "7 days"], [30, "30 days"], [90, "90 days"]] as const;
const unavailable = (code?: string) => code === "SERVICE_UNAVAILABLE" || code === "TIMEOUT";

/**
 * Settings > Security on the phone (docs: Signing in and security). The same data as the web page (bank-client's security view-model): the password, the
 * ways to sign in (with the Biometrics switch, which only a phone has), the trusted devices and the login history as a list of cards. Every button starts
 * a journey; the shell asks for the step-up first. Only type-checked in this build: no emulator was run for it.
 */
export function SecurityScreen({ app, open }: { app: BankApp; open: (lp: LaunchPoint) => void }) {
  const { c, r } = useTheme();
  const s = useBankApp(app);
  const [q, setQ] = useState<HistoryQuery>(NO_FILTERS);
  const [row, setRow] = useState<HistoryRow | null>(null);
  const [confirmOff, setConfirmOff] = useState(false);
  const vm = app.securityView()?.data, sv = app.securityView();
  const points = app.launchPoints({ place: "more.security" });
  const lp = (label: string) => points.find((p) => p.label === label);
  useEffect(() => { void app.loadSecurityView(); }, [app, s.tick]);
  useEffect(() => { if (vm) void app.loadHistoryView(q, vm.device.id); }, [app, q, vm?.device.id, s.tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const hv = app.historyView(q), h = hv?.data;
  const set = (patch: Partial<HistoryQuery>) => setQ((cur) => ({ ...cur, page: 1, ...patch }));

  const Btn = ({ label, text }: { label: string; text?: string }) => { const p = lp(label); return p ? <Pressable accessibilityRole="button" onPress={() => open(p)} style={{ minHeight: 36, paddingHorizontal: 14, borderRadius: r.pill, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" }}><Text style={{ color: c.text, fontWeight: "600", fontSize: 13 }}>{text ?? label}</Text></Pressable> : null; };
  const Line = ({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.border }}>
      <View style={{ flex: 1, gap: 2 }}><Text style={{ color: c.text, fontWeight: "600", fontSize: 15 }}>{title}</Text>{sub ? <Text style={{ color: c.textFaint, fontSize: 12 }}>{sub}</Text> : null}</View>{right}
    </View>
  );
  const Chip = ({ on, text, onPress }: { on: boolean; text: string; onPress: () => void }) => <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress} style={{ paddingHorizontal: 12, minHeight: 34, borderRadius: r.pill, borderWidth: 1, borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accent : c.surface, justifyContent: "center" }}><Text style={{ color: on ? c.accentOn : c.text, fontSize: 13, fontWeight: "600" }}>{text}</Text></Pressable>;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 130, gap: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to More" onPress={() => app.closeSub()} hitSlop={10}><Icon name="chevronLeft" size={24} color={c.text} /></Pressable>
        <Text accessibilityRole="header" style={{ color: c.text, fontSize: 26, fontWeight: "800", letterSpacing: -0.4 }}>Security</Text>
      </View>
      {!sv || (sv.status === "loading" && !vm) ? <Text accessibilityState={{ busy: true }} style={{ color: c.textMuted }}>Loading</Text>
        : sv.status === "error" && !vm ? <Notice icon="warn" title={sv.code === "TIMEOUT" ? "This is taking longer than expected" : unavailable(sv.code) ? "This service is not available right now" : "Could not load"} text={unavailable(sv.code) ? "Nothing was changed. Please try again in a few minutes." : sv.error} action="Try again" onAction={() => void app.loadSecurityView(true)} />
        : vm ? (
          <>
            <Card style={{ borderRadius: r.xl }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 4 }}><Text accessibilityRole="header" style={{ color: c.text, fontSize: 16, fontWeight: "700" }}>Password</Text><Btn label="Change password" /></View>
              <Line title="Password" sub={vm.password} />
            </Card>
            <Card style={{ borderRadius: r.xl }}>
              <Text accessibilityRole="header" style={{ color: c.text, fontSize: 16, fontWeight: "700", paddingBottom: 4 }}>Sign in with</Text>
              {/* fingerprint and face: only a phone has them. The switch follows what the bank holds for the device (a flag; the sandbox cannot show the phone's own prompt) */}
              <Line title="Biometrics" sub={vm.biometrics.available ? (vm.biometrics.on ? "On" : "Off") : vm.biometrics.helper}
                right={<Switch accessibilityLabel="Biometrics" value={vm.biometrics.on} disabled={!vm.biometrics.available || !lp("Biometrics")} onValueChange={(on) => { if (on) { const p = lp("Biometrics"); if (p) open(p); } else setConfirmOff(true); }} />} />
              <Line title="Quick PIN" sub={vm.quickPin.label} right={vm.quickPin.set ? <Btn label="Change quick PIN" text="Change" /> : <Btn label="Quick sign-in" text="Set up" />} />
              <Line title="Default sign in" sub={vm.defaultSignIn.label} right={<Btn label="Quick sign-in" text="Change" />} />
            </Card>
            <Card style={{ borderRadius: r.xl }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 4 }}><Text accessibilityRole="header" style={{ color: c.text, fontSize: 16, fontWeight: "700" }}>Trusted devices</Text><Btn label="Trusted devices" text="Manage" /></View>
              <Line title="Trusted devices" sub={vm.devices.text} />
            </Card>
          </>
        ) : null}

      <Card style={{ borderRadius: r.xl, gap: 10 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text accessibilityRole="header" style={{ color: c.text, fontSize: 16, fontWeight: "700" }}>Login history</Text>
          {filtersOn(q) ? <Pressable accessibilityRole="button" onPress={() => setQ(NO_FILTERS)}><Text style={{ color: c.accent, fontWeight: "700", fontSize: 13 }}>Clear filters</Text></Pressable> : null}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{RESULTS.map(([v, n]) => <Chip key={v} on={q.result === v} text={n} onPress={() => set({ result: v })} />)}</View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{PERIODS.map(([v, n]) => <Chip key={v} on={q.days === v} text={n} onPress={() => set({ days: v })} />)}</View>
        {(vm?.deviceList.length ?? 0) > 0 ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}><Chip on={q.deviceId === ""} text="All devices" onPress={() => set({ deviceId: "" })} />{vm!.deviceList.map((d) => <Chip key={d.id} on={q.deviceId === d.id} text={d.name} onPress={() => set({ deviceId: d.id })} />)}</View> : null}
        <Pressable accessibilityRole="button" onPress={() => set({ order: q.order === "newest" ? "oldest" : "newest" })}><Text style={{ color: c.accent, fontWeight: "700", fontSize: 13 }}>{q.order === "newest" ? "Newest first" : "Oldest first"}</Text></Pressable>
        {!hv || (hv.status === "loading" && !h) ? <Text accessibilityState={{ busy: true }} style={{ color: c.textMuted }}>Loading</Text>
          : hv.status === "error" && !h ? <Notice icon="warn" title={hv.code === "TIMEOUT" ? "This is taking longer than expected" : "This service is not available right now"} text="Nothing was changed. Please try again in a few minutes." action="Try again" onAction={() => void app.loadHistoryView(q, vm?.device.id ?? "", true)} />
          : h && h.rows.length === 0 ? <Text style={{ color: c.textMuted, paddingVertical: 8 }}>{h.none ? "Your sign-ins will appear here." : "No sign-ins to show for these filters."}</Text>
          : h ? (
            <>
              {h.rows.map((x) => (
                <Pressable key={x.id} accessibilityRole="button" accessibilityLabel={`${x.when}, ${x.result.label}`} onPress={() => setRow(x)} style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.border, gap: 2 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}><Text style={{ color: c.text, fontWeight: "600", fontSize: 14 }}>{x.when}</Text><Text style={{ color: x.result.tone === "positive" ? c.positive : x.result.tone === "negative" ? c.negative : x.result.tone === "warning" ? c.warning : c.textMuted, fontWeight: "700", fontSize: 12 }}>{x.result.label}</Text></View>
                  <Text style={{ color: c.textFaint, fontSize: 12 }}>{x.method} · {x.device}{x.thisDevice ? " · This device" : ""} · {x.place} · {x.ip}</Text>
                </Pressable>
              ))}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Pressable accessibilityRole="button" disabled={q.page <= 1} onPress={() => setQ({ ...q, page: q.page - 1 })}><Text style={{ color: q.page <= 1 ? c.textFaint : c.accent, fontWeight: "700" }}>Previous</Text></Pressable>
                <Text style={{ color: c.textMuted, fontSize: 12 }}>Page {q.page} of {h.pages}</Text>
                <Pressable accessibilityRole="button" disabled={q.page >= h.pages} onPress={() => setQ({ ...q, page: q.page + 1 })}><Text style={{ color: q.page >= h.pages ? c.textFaint : c.accent, fontWeight: "700" }}>Next</Text></Pressable>
              </View>
            </>
          ) : null}
      </Card>

      <Sheet visible={!!row} onClose={() => setRow(null)} title="Sign-in details">
        {row ? (
          <View style={{ gap: 10 }}>
            {([["Date and time", row.when], ["Result", row.result.label], ["Method", row.method], ["Device", `${row.device}${row.thisDevice ? " · This device" : ""}`], ["Place", row.place], ["Network address", row.ip], ["How you signed in", row.how]] as const).map(([k, v]) => <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}><Text style={{ color: c.textMuted }}>{k}</Text><Text style={{ color: c.text, fontWeight: "600", flexShrink: 1, textAlign: "right" }}>{v}</Text></View>)}
            <Text style={{ color: c.textMuted }}>We also recommend you change your password if this wasn’t you.</Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>{lp("This wasn't me") ? <Btn label="This wasn't me" text="This wasn’t me" /> : <Text style={{ color: c.textMuted }}>Not you? Call us on +1 800 555 0100 (sandbox number).</Text>}<Btn label="Change password" /></View>
          </View>
        ) : null}
      </Sheet>

      <Sheet visible={confirmOff} onClose={() => setConfirmOff(false)} title="Turn off biometrics?">
        <View style={{ gap: 14 }}>
          <Text style={{ color: c.textMuted }}>You’ll sign in with your {vm?.quickPin.set ? "PIN" : "password"} instead.</Text>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
            <Pressable accessibilityRole="button" onPress={() => setConfirmOff(false)} style={{ minHeight: 44, paddingHorizontal: 18, borderRadius: r.lg, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" }}><Text style={{ color: c.text, fontWeight: "600" }}>Cancel</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => { setConfirmOff(false); void app.biometricsOff(); }} style={{ minHeight: 44, paddingHorizontal: 18, borderRadius: r.lg, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" }}><Text style={{ color: c.accentOn, fontWeight: "700" }}>Turn off</Text></Pressable>
          </View>
        </View>
      </Sheet>
    </ScrollView>
  );
}
