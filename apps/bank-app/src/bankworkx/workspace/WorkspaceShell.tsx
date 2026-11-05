import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Pressable, Text, TextInput, View } from "react-native";
import { businessContexts, contextInitials, menuFor, roleBadge, tabLabel, tabAllowed, unreadCount, type BankApp, type ShellTab } from "@finx/bank-client";
import { Icon, useTheme } from "@finx/renderer-native";
import { Sheet } from "../ui";
import { useBankApp } from "../../useBankApp";
import { Notice, ScreenView } from "./ScreenView";

const SCHEMES = [["system", "Auto"], ["light", "Light"], ["dark", "Dark"]] as const;

/**
 * The BankWorkx shell for a customer with a place for each hat: Personal (a floating pill tab bar) or a company (a flat tab bar).
 * What it shows and offers comes from the bank's answer for the active place; the screens are the same data as the web app.
 */
export function WorkspaceShell({ app }: { app: BankApp }) {
  const { c, r } = useTheme();
  const s = useBankApp(app);
  const ctx = app.context, info = s.session.info;
  const [switcher, setSwitcher] = useState(false);
  const [notes, setNotes] = useState(false);
  const business = s.workspace === "business";

  useEffect(() => { if (s.session.status === "idle") void app.loadSession(); }, [app, s.session.status]);
  useEffect(() => { if (s.session.status === "ready") void app.loadNotices(); }, [app, s.session.status, info?.activeContextId, s.tick]);
  // a link whose switch is done (a deep link or notification into another place)
  useEffect(() => { if (s.arrived) { const link = s.arrived; app.clearArrived(); void app.applyLink(link); } }, [s.arrived, app]);

  if (s.session.status === "error") return <Notice icon="warn" title="Could not load your accounts" text={s.session.error} action="Try again" onAction={() => void app.loadSession()} />;
  if (s.session.status !== "ready" || !ctx || !info) return <View accessibilityLabel="Loading" accessibilityState={{ busy: true }} style={{ flex: 1 }} />;

  const menu = menuFor(ctx, { approvals: app.approvalsBadge });
  const unread = unreadCount(app.notices());
  const tab = menu.some((m) => m.id === s.shellTab) ? s.shellTab : menu[0]!.id;
  const allowed = tabAllowed(ctx, tab);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Workspace: ${business ? ctx.label : "Personal"}. Switch`} onPress={() => setSwitcher(true)}
          style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, padding: 4, paddingRight: 12, borderRadius: r.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" }}><Text style={{ color: c.accentOn, fontSize: 12, fontWeight: "700" }}>{business ? contextInitials(ctx) : "AM"}</Text></View>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ color: c.text, fontWeight: "700", fontSize: 14 }}>{business ? ctx.label : info.identity.name}</Text>
            <Text style={{ color: c.textFaint, fontSize: 11 }}>{business ? `Business · ${roleBadge(ctx)}` : "Personal"}</Text>
          </View>
          <Icon name="chevronDown" size={16} color={c.textMuted} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={unread ? `Notifications, ${unread} unread` : "Notifications"} onPress={() => setNotes(true)} style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" }}>
          <Icon name="bell" size={22} color={c.text} />{unread ? <View style={{ position: "absolute", top: 8, right: 9, width: 9, height: 9, borderRadius: 5, backgroundColor: c.negative }} /> : null}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Menu" onPress={() => app.openSheet("menu")} style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" }}><Icon name="menu" size={22} color={c.text} /></Pressable>
      </View>

      <View style={{ flex: 1, width: "100%", maxWidth: 560, alignSelf: "center" }}>
        <ScreenView key={`${info.activeContextId}:${tab}`} app={app} tab={tab} allowed={allowed} title={tabLabel(s.workspace, tab)} />
      </View>

      <TabBar menu={menu} tab={tab} onTab={(t) => app.setShellTab(t)} floating={!business} />

      <Sheet visible={switcher} onClose={() => setSwitcher(false)} title="Switch workspace">
        <View style={{ gap: 8 }}>
          {info.contexts.map((x) => {
            const on = x.id === info.activeContextId;
            return (
              <Pressable key={x.id} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => { setSwitcher(false); if (!on) void app.switchContext(x.id); }}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: r.lg, borderWidth: 1, borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accentSoft : c.surface }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" }}><Text style={{ color: c.accentOn, fontSize: 12, fontWeight: "700" }}>{x.workspace === "business" ? contextInitials(x) : "AM"}</Text></View>
                <View style={{ flex: 1 }}><Text style={{ color: c.text, fontWeight: "700" }}>{x.workspace === "business" ? x.label : "Personal"}</Text><Text style={{ color: c.textFaint, fontSize: 12 }}>{x.workspace === "business" ? "Business" : info.identity.name}</Text></View>
                {x.workspace === "business" ? <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: r.pill, backgroundColor: c.accentSoft }}><Text style={{ color: c.accent, fontSize: 11, fontWeight: "700" }}>{roleBadge(x)}</Text></View> : null}
                {on ? <Icon name="check" size={18} color={c.accent} stroke={3} /> : null}
              </Pressable>
            );
          })}
          {businessContexts(info).length === 0 ? <Text style={{ color: c.textMuted }}>You have no business accounts.</Text> : null}
        </View>
      </Sheet>

      <Sheet visible={notes} onClose={() => setNotes(false)} title="Notifications"><Notices app={app} onClose={() => setNotes(false)} /></Sheet>

      <Sheet visible={s.sheet === "menu"} onClose={() => app.closeSheet()} title={info.identity.name}>
        <View style={{ gap: 14 }}>
          <View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: 8 }}>
            {SCHEMES.map(([id, name]) => (
              <Pressable key={id} accessibilityRole="radio" accessibilityState={{ selected: s.prefs.scheme === id }} onPress={() => app.setPrefs({ scheme: id })}
                style={{ paddingHorizontal: 16, minHeight: 40, borderRadius: r.pill, borderWidth: 1, borderColor: s.prefs.scheme === id ? c.accent : c.border, backgroundColor: s.prefs.scheme === id ? c.accent : c.surface, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: s.prefs.scheme === id ? c.accentOn : c.text, fontWeight: "600" }}>{name}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable accessibilityRole="button" onPress={() => app.logout()} style={({ pressed }) => ({ minHeight: 48, borderRadius: r.md, borderWidth: 1, borderColor: c.borderStrong, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.85 : 1 })}><Text style={{ color: c.negative, fontWeight: "700", fontSize: 15 }}>Log out</Text></Pressable>
        </View>
      </Sheet>

      <StepUp app={app} />
      <Offer app={app} />
      <Switching text={s.switching} />

      {s.toast ? (
        <View pointerEvents="none" style={{ position: "absolute", left: 20, right: 20, bottom: 110, alignItems: "center" }}>
          <View accessibilityRole="alert" style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, backgroundColor: c.ink, maxWidth: 420 }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: s.toast.ok ? c.fab : c.negative, alignItems: "center", justifyContent: "center" }}><Icon name={s.toast.ok ? "check" : "x"} size={13} color="#fff" stroke={3} /></View>
            <Text style={{ color: c.inkText, fontSize: 14, fontWeight: "600" }}>{s.toast.text}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** Personal: a floating pill that names the open tab only. Business: a flat bar with every label. */
function TabBar({ menu, tab, onTab, floating }: { menu: ReturnType<typeof menuFor>; tab: ShellTab; onTab: (t: ShellTab) => void; floating: boolean }) {
  const { c, r, mode } = useTheme();
  const bar = floating
    ? { position: "absolute" as const, left: 12, right: 12, bottom: 12, borderRadius: r.pill, padding: 6, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, shadowColor: "#000", shadowOpacity: mode === "dark" ? 0.5 : 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6 }
    : { borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface, paddingHorizontal: 4, paddingVertical: 6 };
  return (
    <View accessibilityRole="tablist" style={[{ flexDirection: "row", alignItems: "center", alignSelf: "center", maxWidth: 560 }, floating ? null : { width: "100%" }, bar]}>
      {menu.map((m) => {
        const on = m.id === tab;
        return (
          <Pressable key={m.id} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={m.badge ? `${m.label}, ${m.badge} waiting` : m.label} onPress={() => onTab(m.id)}
            style={{ flex: floating && on ? 2.2 : 1, minHeight: 44, flexDirection: floating ? "row" : "column", alignItems: "center", justifyContent: "center", gap: floating ? 6 : 2, borderRadius: r.pill, paddingHorizontal: 4, backgroundColor: floating && on ? c.accentSoft : "transparent" }}>
            <View>
              <Icon name={m.icon} size={22} color={on ? c.accent : c.textFaint} />
              {m.badge ? <View style={{ position: "absolute", top: -6, right: -10, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" }}><Text style={{ color: c.accentOn, fontSize: 10, fontWeight: "700" }}>{m.badge}</Text></View> : null}
            </View>
            {!floating || on ? <Text numberOfLines={1} style={{ fontSize: floating ? 13 : 10.5, fontWeight: on ? "700" : "500", color: on ? c.accent : c.textFaint }}>{m.label}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function Notices({ app, onClose }: { app: BankApp; onClose: () => void }) {
  const { c, r } = useTheme();
  useBankApp(app);
  const v = app.view("notices");
  const list = app.notices();
  if (!v || (v.status === "loading" && !v.data)) return <Text accessibilityState={{ busy: true }} style={{ color: c.textMuted }}>Loading</Text>;
  if (v.status === "error") return <View accessibilityRole="alert" style={{ gap: 10 }}><Text style={{ color: c.text }}>{v.error}</Text><Pressable accessibilityRole="button" onPress={() => void app.loadNotices(true)}><Text style={{ color: c.accent, fontWeight: "700" }}>Try again</Text></Pressable></View>;
  if (list.length === 0) return <Text style={{ color: c.textMuted }}>Nothing new.</Text>;
  return (
    <View style={{ gap: 8 }}>
      {list.map((n) => (
        <Pressable key={n.id} accessibilityRole="button" onPress={() => { app.markRead(n.id); if (!n.link) return; onClose(); if (app.followLink(n.link) === "go") void app.applyLink(n.link); }}
          style={{ padding: 12, borderRadius: r.md, backgroundColor: c.surfaceMuted }}>
          <Text style={{ color: c.text, fontSize: 14, fontWeight: n.read ? "400" : "700" }}>{n.text}</Text>
          {n.from ? <Text style={{ color: c.textFaint, fontSize: 12 }}>{n.from}</Text> : null}
        </Pressable>
      ))}
    </View>
  );
}

/** "Confirm it's you": the password, then the code the bank sent. */
function StepUp({ app }: { app: BankApp }) {
  const { c, r } = useTheme();
  const s = useBankApp(app);
  const su = s.stepUp;
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  useEffect(() => { if (!su) { setSecret(""); setCode(""); } }, [su]);
  const target = s.session.info?.contexts.find((x) => x.id === su?.contextId);
  const field = { minHeight: 48, paddingHorizontal: 12, borderRadius: r.md, borderWidth: 1, borderColor: su?.error ? c.negative : c.borderStrong, backgroundColor: c.surface, color: c.text, fontSize: 16 };
  return (
    <Sheet visible={!!su} onClose={() => app.cancelStepUp()} title="Confirm it's you">
      {su ? (
        <View style={{ gap: 12 }}>
          {target ? <Text style={{ color: c.textMuted }}>To open {target.label}.</Text> : null}
          {su.phase === "password" ? (
            <>
              <Text style={{ color: c.text, fontWeight: "600" }}>Password</Text>
              <TextInput accessibilityLabel="Password" secureTextEntry autoCapitalize="none" autoCorrect={false} value={secret} onChangeText={setSecret} onSubmitEditing={(e) => void app.beginStepUp({ secret: e.nativeEvent.text })} style={field} />
              <Pressable accessibilityRole="button" onPress={() => void app.beginStepUp({ method: "biometric" })}><Text style={{ color: c.accent, fontWeight: "700" }}>Use biometrics</Text></Pressable>
            </>
          ) : (
            <>
              <Text style={{ color: c.text, fontWeight: "600" }}>Code sent to {su.phone}</Text>
              <TextInput accessibilityLabel="One-time code" keyboardType="number-pad" textContentType="oneTimeCode" maxLength={6} value={code} onChangeText={(t) => setCode(t.replace(/\D/g, ""))} onSubmitEditing={(e) => void app.confirmStepUp(e.nativeEvent.text.replace(/\D/g, ""))} style={field} />
            </>
          )}
          {su.error ? <Text accessibilityRole="alert" style={{ color: c.negative }}>{su.error}</Text> : null}
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
            <Pressable accessibilityRole="button" onPress={() => app.cancelStepUp()} style={{ minHeight: 44, paddingHorizontal: 18, borderRadius: r.lg, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" }}><Text style={{ color: c.text, fontWeight: "600" }}>Cancel</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: su.busy }} disabled={su.busy || (su.phase === "password" ? secret === "" : code.length < 6)} onPress={() => void (su.phase === "password" ? app.beginStepUp({ secret }) : app.confirmStepUp(code))}
              style={{ minHeight: 44, paddingHorizontal: 18, borderRadius: r.lg, backgroundColor: c.accent, alignItems: "center", justifyContent: "center", opacity: su.busy || (su.phase === "password" ? secret === "" : code.length < 6) ? 0.5 : 1 }}>
              <Text style={{ color: c.accentOn, fontWeight: "700" }}>{su.busy ? "Checking..." : "Continue"}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </Sheet>
  );
}

/** A link or notification into another place: asks before switching. */
function Offer({ app }: { app: BankApp }) {
  const { c, r } = useTheme();
  const s = useBankApp(app);
  const link = s.offer;
  const label = link ? (link.workspace === "business" ? s.session.info?.contexts.find((x) => x.id === link.companyId)?.label : "Personal") : "";
  return (
    <Sheet visible={!!link} onClose={() => app.declineOffer()} title={`Switch to ${label}?`}>
      <View style={{ gap: 14 }}>
        <Text style={{ color: c.textMuted }}>This opens in {label}. What you are doing here is closed first.</Text>
        <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
          <Pressable accessibilityRole="button" onPress={() => app.declineOffer()} style={{ minHeight: 44, paddingHorizontal: 18, borderRadius: r.lg, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" }}><Text style={{ color: c.text, fontWeight: "600" }}>Not now</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => void app.acceptOffer()} style={{ minHeight: 44, paddingHorizontal: 18, borderRadius: r.lg, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" }}><Text style={{ color: c.accentOn, fontWeight: "700" }}>Switch</Text></Pressable>
        </View>
      </View>
    </Sheet>
  );
}

/** The "Switching to ..." moment: the theme changes behind it, so it reads as a cross-fade (a plain pause with reduced motion). */
function Switching({ text }: { text: string | null }) {
  const { c } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const [reduced, setReduced] = useState(false);
  useEffect(() => { void AccessibilityInfo.isReduceMotionEnabled().then(setReduced); }, []);
  useEffect(() => { Animated.timing(opacity, { toValue: text ? 1 : 0, duration: reduced ? 0 : 350, useNativeDriver: true }).start(); }, [text, reduced, opacity]);
  return (
    <Animated.View pointerEvents={text ? "auto" : "none"} accessibilityLiveRegion="polite" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity, backgroundColor: c.bg, alignItems: "center", justifyContent: "center", gap: 14 }}>
      <Text style={{ color: c.text, fontWeight: "600", fontSize: 18 }}>{text ?? ""}</Text>
    </Animated.View>
  );
}
