import React, { useEffect, useMemo, useReducer, useRef } from "react";
import { BackHandler, Platform, Pressable, ScrollView, Share, Text, View } from "react-native";
import type { Journey } from "@finx/journey-schema";
import { JourneyController, type Adapter, type ChainRequest, type JourneyEvent, type Receipt } from "@finx/renderer-core";
import { registry } from "./blocks";
import type { BlockType } from "@finx/renderer-core";
import { AppBar as KitAppBar, KitProvider, useKit } from "@finx/components/native";
import { useTheme } from "./theme";
import { Icon } from "./widgets";

export type JourneyPlayerProps = { journey: Journey; adapter: Adapter; lang?: string; onExit?: () => void; onClose?: () => void; /** Answers to fill in when the journey opens, by data path, for example the item the customer was looking at. */ initial?: Record<string, any>; /** Values there before the first screen runs (the entry can branch on them). */ launch?: Record<string, any>; /** The journey asked to open another one (navigate.toJourney); without it a message is shown. */ onOpenJourney?: (req: ChainRequest) => void; /** Receives screen views, mistakes, bank failures and exits (never answers), for analytics. */ onEvent?: (e: JourneyEvent) => void; /** What the person may do where they bank from; journeys read it as `session.permissions` (read-only). */ session?: { permissions?: string[] }; /** A journey shared a receipt. By default the phone's share sheet opens. */ onShare?: (receipt: Receipt) => void };

export function JourneyPlayer({ journey, adapter, lang, onExit, onClose, initial, launch, onOpenJourney, onEvent, session, onShare }: JourneyPlayerProps) {
  const { c, r: radius, fontFamily, look } = useTheme();
  const share = useRef(onShare);
  share.current = onShare;
  const controller = useMemo(() => new JourneyController(journey, { adapter, lang, initial, launch, onOpenJourney, onEvent, session, onShare: (r) => (share.current ? share.current(r) : void Share.share({ title: r.title, message: r.text }).catch(() => {})) }), [journey, adapter]);
  const [, force] = useReducer((x: number) => x + 1, 0);
  const scroller = useRef<React.ComponentRef<typeof ScrollView>>(null);
  useEffect(() => controller.subscribe(force), [controller]);
  useEffect(() => { controller.start(); }, [controller]);
  useEffect(() => { if (lang) controller.setLang(lang); }, [lang, controller]);

  // Android's back button steps back through the journey, and closes it from the first or a final screen.
  // (Only on Android: react-native-web's BackHandler logs an error when used.)
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { if (!controller.stepBack()) onClose?.(); return true; });
    return () => sub.remove();
  }, [controller, onClose]);

  const layout = controller.layout();
  const v = layout.view;
  useEffect(() => { if (v.exited) onExit?.(); }, [v.exited]);
  useEffect(() => { scroller.current?.scrollTo({ y: 0, animated: false }); }, [v.screenId]);

  const { body, buttons, terminal } = layout;
  const Btn = registry.button!;
  // each block is findable by where it sits in its screen (the Studio preview selects blocks by clicking them)
  const mark = (b: any) => (typeof b.srcIndex === "number" ? `fxblock:${v.screenId}:${b.srcIndex}` : undefined);
  const draw = (b: any, i: number) => {
    const C = registry[b.type as BlockType];
    return C ? <View key={`${v.screenId}-${i}`} testID={mark(b)}><C b={b} set={(p, val) => controller.set(p, val)} press={(a) => controller.press(a)} busy={v.busy} lang={layout.lang} strings={v.strings} /></View> : null;
  };
  const kit = useKit();
  // pop-ups sit above the whole screen, so every layout draws them here
  const dialogs = layout.dialogs.map((b, i) => {
    const C = registry[b.type as BlockType];
    return C ? <View key={`${v.screenId}-d${i}`} testID={mark(b)} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 30 }}><C b={b} set={(p, val) => controller.set(p, val)} press={(a) => controller.press(a)} busy={v.busy} lang={layout.lang} strings={v.strings} /></View> : null;
  });
  const wrap = (n: React.ReactElement) => <KitProvider kit={{ ...kit, rtl: layout.rtl }}>{dialogs.length ? <View style={{ flex: 1 }}>{n}{dialogs}</View> : n}</KitProvider>;
  const drawButtons = () => buttons.map((b, i) => <View key={`${v.screenId}-b${i}`} testID={mark(b)}><Btn b={b} set={() => {}} press={(a: any[]) => controller.press(a)} busy={v.busy} lang={layout.lang} strings={v.strings} /></View>);
  const toast = v.toast ? <View accessibilityRole="alert" style={{ marginHorizontal: 20, marginTop: 8, padding: 12, borderRadius: 8, backgroundColor: c.negativeBg }}><Text style={{ color: c.negative, fontSize: 14, fontWeight: "500" }}>{v.toast}</Text></View> : null;

  // A bank with its own screens (an app bar in the accent colour, a banner with its logo): drawn here, in the same order of blocks.
  if (look?.chrome === "bar") {
    const page = look.pageBg ?? c.surfaceMuted;
    const barBg = look.bar ?? c.accent;
    const font = look.font ?? fontFamily(layout.lang);
    const shortcuts = body.filter((b) => b.type === "shortcuts");
    if (layout.hero) {
      const rest = body.slice(1).filter((b) => b.type !== "shortcuts");
      return wrap(
        <View style={{ flex: 1, backgroundColor: barBg, direction: layout.rtl ? "rtl" : "ltr" } as any}>
          <View style={{ flex: 1, width: "100%", maxWidth: 520, alignSelf: "center" }}>
            {draw(body[0], 0)}
            <View style={{ flex: 1, marginTop: -26, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: page, overflow: "hidden" }}>
              {toast}
              <ScrollView ref={scroller} contentContainerStyle={{ padding: 20, paddingBottom: 24, gap: 18 }} keyboardShouldPersistTaps="handled">
                {rest.map((b, i) => draw(b, i + 1))}
                {drawButtons()}
              </ScrollView>
              {shortcuts.length ? <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 18, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: c.bg, borderTopWidth: 1, borderColor: c.border }}>{shortcuts.map((b, i) => draw(b, 900 + i))}</View> : null}
            </View>
          </View>
        </View>
      );
    }
    const first = body[0];
    const band = first?.type === "text" && first.variant === "title" ? first : null;
    const rest = band ? body.slice(1) : body;
    return wrap(
      <View style={{ flex: 1, backgroundColor: c.surface, direction: layout.rtl ? "rtl" : "ltr" } as any}>
        <View style={{ flex: 1, width: "100%", maxWidth: 520, alignSelf: "center" }}>
          <KitAppBar tone="bar" title={v.title} onBack={layout.canGoBack ? () => controller.stepBack() : undefined} onClose={onClose} labels={{ back: v.strings.back ?? "Back", close: v.strings.close ?? "Close" }} />
          {band ? <View style={{ backgroundColor: page, paddingVertical: 12, paddingHorizontal: 20 }}><Text style={{ textAlign: "center", fontSize: 13, fontWeight: "700", color: c.text, fontFamily: font }}>{band.text}</Text></View> : null}
          {toast}
          <ScrollView ref={scroller} contentContainerStyle={{ padding: 20, paddingBottom: 24, gap: 18 }} keyboardShouldPersistTaps="handled">
            {rest.map((b, i) => draw(b, i + 1))}
          </ScrollView>
          <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20, gap: 10, backgroundColor: c.surface }}>{drawButtons()}</View>
        </View>
      </View>
    );
  }

  return wrap(
    <View style={{ flex: 1, backgroundColor: c.bg, direction: layout.rtl ? "rtl" : "ltr" } as any}>
     <View style={{ flex: 1, width: "100%", maxWidth: 520, alignSelf: "center" }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", minHeight: 44 }}>
          {layout.canGoBack ? (
            <Pressable accessibilityRole="button" accessibilityLabel={v.strings.back} onPress={() => controller.stepBack()} style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, alignItems: "center", justifyContent: "center", marginEnd: 12 }}>
              <Text style={{ fontSize: 18, color: c.text }}>{layout.rtl ? "›" : "‹"}</Text>
            </Pressable>
          ) : null}
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={{ fontSize: 17, fontWeight: "600", color: c.text, fontFamily: fontFamily(layout.lang) }}>{v.title}</Text>
            {layout.steps ? <Text style={{ fontSize: 12, color: c.textMuted }}>{layout.steps.label}</Text> : null}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={v.strings.close} onPress={onClose} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 20, color: c.textMuted }}>✕</Text>
          </Pressable>
        </View>
        {layout.steps ? (
          <View style={{ flexDirection: "row", gap: 4, marginTop: 10 }}>
            {layout.steps.done.map((done, i) => <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: done ? c.accent : c.border }} />)}
          </View>
        ) : null}
      </View>

      {v.toast ? <View accessibilityRole="alert" style={{ marginHorizontal: 20, marginTop: 4, padding: 12, borderRadius: radius.md, backgroundColor: c.negativeBg }}><Text style={{ color: c.negative, fontSize: 14, fontWeight: "500" }}>{v.toast}</Text></View> : null}

      <ScrollView ref={scroller} contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 22 }} keyboardShouldPersistTaps="handled">
        {/* the header already says the screen's title: a title block that only repeats it is not drawn twice */}
        {(body[0]?.type === "text" && body[0].variant === "title" && body[0].text === v.title ? body.slice(1) : body).map((b, i) => {
          const C = registry[b.type as BlockType];
          return C ? <View key={`${v.screenId}-${i}`} testID={mark(b)}><C b={b} set={(p, val) => controller.set(p, val)} press={(a) => controller.press(a)} busy={v.busy} lang={layout.lang} strings={v.strings} /></View> : null;
        })}
      </ScrollView>

      <View style={{ padding: 20, paddingTop: 12, gap: 10, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.bg }}>
        {buttons.map((b, i) => <View key={`${v.screenId}-b${i}`} testID={mark(b)}><Btn b={b} set={() => {}} press={(a: any[]) => controller.press(a)} busy={v.busy} lang={layout.lang} strings={v.strings} /></View>)}
      </View>
     </View>
    </View>
  );
}
