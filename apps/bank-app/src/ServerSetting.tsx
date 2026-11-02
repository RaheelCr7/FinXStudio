import React, { useEffect, useState } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";
import { useTheme } from "@finx/renderer-native";
import { checkStudio, normalizeStudioUrl } from "./studio-url";
import { DEFAULT_STUDIO_URL, resetStudioUrl, saveStudioUrl } from "./studio-config";

type Status = { kind: "idle" } | { kind: "checking" } | { kind: "ok" | "error"; text: string };

/** Shows which Studio the app talks to, and lets a tester point it at another one. Preview builds only. */
export function ServerSetting({ url, onChange, onEditingChange }: { url: string; onChange: (url: string) => void; onEditingChange?: (editing: boolean) => void }) {
  const { c, r: radius } = useTheme();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(url);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  useEffect(() => { onEditingChange?.(editing); return () => onEditingChange?.(false); }, [editing]);

  async function testAndSave() {
    const n = normalizeStudioUrl(draft);
    if (!n.ok) { setStatus({ kind: "error", text: n.error }); return; }
    setStatus({ kind: "checking" });
    const r = await checkStudio(n.url);
    if (!r.ok) { setStatus({ kind: "error", text: r.error }); return; }
    await saveStudioUrl(n.url);
    onChange(n.url); setDraft(n.url);
    setStatus({ kind: "ok", text: `Connected. ${r.journeys} journey${r.journeys === 1 ? "" : "s"} published.` });
    setEditing(false);
  }
  async function useDefault() {
    await resetStudioUrl();
    onChange(DEFAULT_STUDIO_URL); setDraft(DEFAULT_STUDIO_URL); setStatus({ kind: "idle" }); setEditing(false);
  }

  const mono = Platform.OS === "web" ? "ui-monospace, Menlo, monospace" : Platform.OS === "android" ? "monospace" : "Menlo";
  const message = status.kind === "ok" || status.kind === "error" ? status : null;

  return (
    <View style={{ marginTop: 24, padding: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: "500" }}>Studio server</Text>
          <Text selectable style={{ color: c.text, fontSize: 14, marginTop: 2, fontFamily: mono }}>{url}</Text>
        </View>
        {!editing ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Change Studio server" onPress={() => { setDraft(url); setStatus({ kind: "idle" }); setEditing(true); }}
            style={{ paddingHorizontal: 12, minHeight: 34, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: c.borderStrong, justifyContent: "center" }}>
            <Text style={{ color: c.text, fontSize: 13, fontWeight: "600" }}>Change</Text>
          </Pressable>
        ) : null}
      </View>

      {editing ? (
        <View style={{ marginTop: 12, gap: 10 }}>
          <TextInput accessibilityLabel="Studio server address" value={draft} onChangeText={(t) => { setDraft(t); setStatus({ kind: "idle" }); }}
            autoFocus selectTextOnFocus autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="192.168.1.20:3100" placeholderTextColor={c.textFaint}
            style={[{ height: 46, borderRadius: radius.md, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.bg, paddingHorizontal: 12, fontSize: 15, color: c.text, fontFamily: mono }, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null]} />
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Pressable accessibilityRole="button" onPress={testAndSave} disabled={status.kind === "checking"}
              style={{ paddingHorizontal: 14, minHeight: 40, paddingVertical: 6, borderRadius: radius.md, backgroundColor: c.accent, justifyContent: "center", opacity: status.kind === "checking" ? 0.6 : 1 }}>
              <Text style={{ color: c.accentOn, fontWeight: "600", fontSize: 14 }}>{status.kind === "checking" ? "Checking…" : "Test and save"}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={useDefault} style={{ paddingHorizontal: 14, minHeight: 40, paddingVertical: 6, borderRadius: radius.md, borderWidth: 1, borderColor: c.borderStrong, justifyContent: "center" }}>
              <Text style={{ color: c.text, fontWeight: "600", fontSize: 14 }}>Use default</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => { setEditing(false); setStatus({ kind: "idle" }); }} style={{ paddingHorizontal: 10, minHeight: 40, paddingVertical: 6, justifyContent: "center" }}>
              <Text style={{ color: c.textMuted, fontWeight: "600", fontSize: 14 }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {message ? <Text accessibilityRole="alert" style={{ marginTop: 10, fontSize: 13, lineHeight: 18, color: message.kind === "ok" ? c.positive : c.negative }}>{message.text}</Text> : null}
    </View>
  );
}
