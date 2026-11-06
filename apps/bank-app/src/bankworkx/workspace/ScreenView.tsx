import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { forRow, isRowLevel, isSectionLevel, screenIsEmpty, type BankApp, type LaunchPoint, type Row, type Screen, type Section, type ShellTab } from "@finx/bank-client";
import { Gradient, Icon, ProgressBar, useTheme } from "@finx/renderer-native";
import { Card, tab as tabular } from "../ui";
import { openLaunch } from "./open";
import { useBankApp } from "../../useBankApp";

function Skeleton() {
  const { c, r } = useTheme();
  const bar = (h: number) => <View style={{ height: h, borderRadius: r.lg, backgroundColor: c.surfaceMuted }} />;
  return <View accessibilityLabel="Loading" accessibilityState={{ busy: true }} style={{ gap: 12 }}>{bar(120)}{bar(64)}{bar(64)}</View>;
}

export function Notice({ icon, title, text, action, onAction }: { icon: string; title: string; text?: string; action?: string; onAction?: () => void }) {
  const { c, r } = useTheme();
  return (
    <View accessibilityRole="alert" style={{ alignItems: "center", gap: 10, paddingVertical: 48, paddingHorizontal: 20 }}>
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.accentSoft, alignItems: "center", justifyContent: "center" }}><Icon name={icon} size={24} color={c.accent} /></View>
      <Text accessibilityRole="header" style={{ color: c.text, fontSize: 17, fontWeight: "700" }}>{title}</Text>
      {text ? <Text style={{ color: c.textMuted, textAlign: "center" }}>{text}</Text> : null}
      {action ? <Pressable accessibilityRole="button" onPress={onAction} style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 20, borderRadius: r.lg, backgroundColor: c.accent, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.85 : 1 })}><Text style={{ color: c.accentOn, fontWeight: "700" }}>{action}</Text></Pressable> : null}
    </View>
  );
}

function Buttons({ points, onPress, small }: { points: LaunchPoint[]; onPress: (lp: LaunchPoint) => void; small?: boolean }) {
  const { c, r } = useTheme();
  if (points.length === 0) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {points.map((lp) => (
        <Pressable key={lp.id} accessibilityRole="button" onPress={() => onPress(lp)}
          style={({ pressed }) => ({ minHeight: small ? 36 : 44, paddingHorizontal: small ? 12 : 18, borderRadius: r.pill, alignItems: "center", justifyContent: "center", backgroundColor: small ? c.surface : c.accent, borderWidth: small ? 1 : 0, borderColor: c.border, opacity: pressed ? 0.85 : 1 })}>
          <Text style={{ color: small ? c.text : c.accentOn, fontWeight: "600", fontSize: small ? 13 : 15 }}>{lp.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function RowView({ app, row, open }: { app: BankApp; row: Row; open: (lp: LaunchPoint, passed?: Record<string, string>) => void }) {
  const { c } = useTheme();
  const [on, setOn] = useState(false);
  const points = row.place ? forRow(app.launchPoints({ place: row.place }).filter(isRowLevel), row) : [];
  const tone = row.tone === "positive" ? c.positive : row.tone === "negative" ? c.negative : c.text;
  const body = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 }}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: c.text, fontWeight: "600", fontSize: 15 }}>{row.title}</Text>
        {row.subtitle ? <Text style={{ color: c.textFaint, fontSize: 12 }}>{row.subtitle}</Text> : null}
        {row.progress !== undefined ? <ProgressBar value={row.progress} max={100} color={row.tone === "negative" ? c.negative : c.positive} track={c.surfaceMuted} /> : null}
      </View>
      {row.tag ? <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: row.tone === "warning" ? c.warningBg : c.surfaceMuted }}><Text style={{ color: row.tone === "warning" ? c.warning : c.textMuted, fontSize: 11, fontWeight: "700" }}>{row.tag}</Text></View> : null}
      {row.value ? <Text style={[{ color: tone, fontWeight: "700", fontSize: 15 }, tabular]}>{row.value}</Text> : null}
      {points.length || row.go ? <Icon name={on ? "chevronDown" : "chevronRight"} size={16} color={c.textFaint} /> : null}
    </View>
  );
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: c.border }}>
      {row.go === "security" ? <Pressable accessibilityRole="button" accessibilityLabel={row.title} onPress={() => app.openSub("security")}>{body}</Pressable> : points.length ? <Pressable accessibilityRole="button" accessibilityState={{ expanded: on }} accessibilityLabel={row.title} onPress={() => setOn(!on)}>{body}</Pressable> : body}
      {on ? <View style={{ paddingBottom: 12 }}><Buttons small points={points} onPress={(lp) => open(lp, row.passes)} /></View> : null}
    </View>
  );
}

function SectionView({ app, section, open }: { app: BankApp; section: Section; open: (lp: LaunchPoint, passed?: Record<string, string>) => void }) {
  const { c, r } = useTheme();
  const points = section.place ? app.launchPoints({ place: section.place }).filter(isSectionLevel) : [];
  return (
    <Card style={{ borderRadius: r.xl, gap: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", paddingBottom: 4 }}>
        <Text accessibilityRole="header" style={{ color: c.text, fontSize: 16, fontWeight: "700" }}>{section.title}</Text>
        <Buttons small points={points} onPress={(lp) => open(lp)} />
      </View>
      {section.rows.length === 0 ? <Text style={{ color: c.textMuted, paddingVertical: 6 }}>{section.empty}</Text> : section.rows.map((row) => <RowView key={row.id} app={app} row={row} open={open} />)}
    </Card>
  );
}

/** One tab: loading, error (with a retry), empty, no access, or the data. The same states as the web app. */
export function ScreenView({ app, tab, allowed, title }: { app: BankApp; tab: ShellTab; allowed: boolean; title: string }) {
  const { c, r } = useTheme();
  const s = useBankApp(app);
  const active = s.session.info?.activeContextId;
  useEffect(() => { if (allowed) void app.loadShell(tab); }, [app, tab, allowed, active, s.tick]);
  const view = allowed ? s.views[app.viewKey(tab)] : undefined;
  const screen = view?.data as Screen | undefined;
  const open = (lp: LaunchPoint, passed?: Record<string, string>) => openLaunch(app, lp, passed);
  const head = app.launchPoints({ place: tab }).filter(isSectionLevel);
  const hub = app.launchPoints({ place: `${tab}.hub` });
  let body: React.ReactNode;
  if (!allowed) body = <Notice icon="lock" title="No access" text="Your role here doesn't include this." />;
  else if (view?.status === "error" && (!screen || view.code === "SESSION_EXPIRED")) {
    body = view.code === "SESSION_EXPIRED"
      ? <Notice icon="clock" title="You were signed out" text="For your security. Sign in again to continue." action="Sign in" onAction={() => app.expire()} />
      : view.code === "SERVICE_UNAVAILABLE" || view.code === "TIMEOUT"
        ? <Notice icon="warn" title={view.code === "TIMEOUT" ? "This is taking longer than expected" : "This service is not available right now"} text={view.code === "TIMEOUT" ? "Nothing was changed." : "Nothing was changed. Please try again in a few minutes."} action="Try again" onAction={() => void app.loadShell(tab, true)} />
        : <Notice icon="warn" title="Could not load" text={view.error} action="Try again" onAction={() => void app.loadShell(tab, true)} />;
  } else if (!screen) body = <Skeleton />;
  else if (screenIsEmpty(screen)) body = <Notice icon="info" title="Nothing here yet" />;
  else body = (
    <>
      {screen.hero ? (
        <Gradient from={c.heroFrom} to={c.heroTo} radius={r.xl} style={{ padding: 22, gap: 4 }}>
          <Text style={{ color: "#fff", opacity: 0.88, fontSize: 13 }}>{screen.hero.label}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={[{ color: "#fff", fontSize: 36, fontWeight: "800", letterSpacing: -0.5 }, tabular]}>{screen.hero.value}</Text>
          {screen.hero.lines.length ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>{screen.hero.lines.map((l) => <Text key={l.label} style={[{ color: "#fff", fontSize: 14 }, tabular]}>{l.value}</Text>)}</View> : null}
        </Gradient>
      ) : null}
      {screen.sections.map((x) => <SectionView key={x.id} app={app} section={x} open={open} />)}
    </>
  );
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 130, gap: 16 }} accessibilityState={{ busy: view?.status === "loading" }}>
      <Text accessibilityRole="header" style={{ color: c.text, fontSize: 26, fontWeight: "800", letterSpacing: -0.4 }}>{title}</Text>
      {view?.status === "error" && screen && view.code !== "SESSION_EXPIRED" ? (
        <View accessibilityRole="alert" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 12, borderRadius: r.md, backgroundColor: c.warningBg }}>
          <Text style={{ color: c.warning, fontWeight: "600", flex: 1 }}>{view.error}</Text>
          <Pressable accessibilityRole="button" onPress={() => void app.loadShell(tab, true)}><Text style={{ color: c.warning, fontWeight: "700" }}>Try again</Text></Pressable>
        </View>
      ) : null}
      {allowed && head.length ? <Buttons points={head} onPress={(lp) => open(lp)} /> : null}
      {allowed && hub.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {hub.map((lp) => (
            <Pressable key={lp.id} accessibilityRole="button" onPress={() => open(lp)} style={({ pressed }) => ({ flexBasis: "47%", flexGrow: 1, flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: r.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, opacity: pressed ? 0.85 : 1 })}>
              <Icon name={lp.icon ?? "send"} size={20} color={c.accent} /><Text style={{ color: c.text, fontWeight: "600", flexShrink: 1 }}>{lp.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {body}
    </ScrollView>
  );
}
