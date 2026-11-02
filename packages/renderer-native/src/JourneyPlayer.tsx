import React, { useEffect, useMemo, useReducer, useRef } from "react";
import { BackHandler, Platform, Pressable, ScrollView, Text, View } from "react-native";
import type { Journey } from "@finx/journey-schema";
import { JourneyRunner, type Adapter } from "@finx/renderer-core";
import { radius } from "@finx/ui-kit";
import { registry } from "./blocks";
import { useTheme } from "./theme";

export type JourneyPlayerProps = { journey: Journey; adapter: Adapter; lang?: string; onExit?: () => void; onClose?: () => void };

export function JourneyPlayer({ journey, adapter, lang, onExit, onClose }: JourneyPlayerProps) {
  const { c, fontFamily } = useTheme();
  const runner = useMemo(() => new JourneyRunner(journey, { adapter, lang }), [journey, adapter]);
  const [, force] = useReducer((x: number) => x + 1, 0);
  const scroller = useRef<React.ComponentRef<typeof ScrollView>>(null);
  useEffect(() => runner.subscribe(force), [runner]);
  useEffect(() => { runner.start(); }, [runner]);
  useEffect(() => { if (lang) runner.setLang(lang); }, [lang, runner]);

  // Android's back button steps back through the journey, and closes it from the first or a final screen.
  // (Only on Android: react-native-web's BackHandler logs an error when used.)
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (runner.screen.kind !== "terminal" && runner.history.length > 0) runner.back(); else onClose?.();
      return true;
    });
    return () => sub.remove();
  }, [runner, onClose]);

  const v = runner.view();
  useEffect(() => { if (v.exited) onExit?.(); }, [v.exited]);
  useEffect(() => { scroller.current?.scrollTo({ y: 0, animated: false }); }, [v.screenId]);

  const body = v.blocks.filter((b) => b.type !== "button");
  const buttons = v.blocks.filter((b) => b.type === "button");
  const terminal = v.kind === "terminal";
  const Btn = registry.button!;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, direction: runner.isRtl ? "rtl" : "ltr" } as any}>
     <View style={{ flex: 1, width: "100%", maxWidth: 520, alignSelf: "center" }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", minHeight: 44 }}>
          {!terminal && runner.history.length > 0 ? (
            <Pressable accessibilityRole="button" accessibilityLabel={v.strings.back} onPress={() => runner.back()} style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, alignItems: "center", justifyContent: "center", marginEnd: 12 }}>
              <Text style={{ fontSize: 18, color: c.text }}>{runner.isRtl ? "›" : "‹"}</Text>
            </Pressable>
          ) : null}
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={{ fontSize: 17, fontWeight: "600", color: c.text, fontFamily: fontFamily(runner.lang) }}>{v.title}</Text>
            {v.stepIndex >= 0 ? <Text style={{ fontSize: 12, color: c.textMuted }}>{v.stepLabel}</Text> : null}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={v.strings.close} onPress={onClose} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 20, color: c.textMuted }}>✕</Text>
          </Pressable>
        </View>
        {v.stepCount > 0 && v.stepIndex >= 0 ? (
          <View style={{ flexDirection: "row", gap: 4, marginTop: 10 }}>
            {Array.from({ length: v.stepCount }).map((_, i) => <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= v.stepIndex ? c.accent : c.border }} />)}
          </View>
        ) : null}
      </View>

      {v.toast ? <View accessibilityRole="alert" style={{ marginHorizontal: 20, marginTop: 4, padding: 12, borderRadius: radius.md, backgroundColor: c.negativeBg }}><Text style={{ color: c.negative, fontSize: 14, fontWeight: "500" }}>{v.toast}</Text></View> : null}

      <ScrollView ref={scroller} contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 22 }} keyboardShouldPersistTaps="handled">
        {body.map((b, i) => {
          const C = registry[b.type];
          return C ? <View key={`${v.screenId}-${i}`}><C b={b} set={(p, val) => runner.set(p, val)} press={(a) => runner.press(a)} busy={v.busy} lang={runner.lang} strings={v.strings} /></View> : null;
        })}
      </ScrollView>

      <View style={{ padding: 20, paddingTop: 12, gap: 10, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.bg }}>
        {buttons.map((b, i) => <Btn key={`${v.screenId}-b${i}`} b={b} set={() => {}} press={(a: any[]) => runner.press(a)} busy={v.busy} lang={runner.lang} strings={v.strings} />)}
      </View>
     </View>
    </View>
  );
}
