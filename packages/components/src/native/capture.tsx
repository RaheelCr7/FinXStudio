import React, { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Svg, { Line, Path } from "react-native-svg";
import type { DocumentViewerProps, FileFieldProps, IdCaptureProps, SignaturePadProps } from "../props";
import { PAD, pointCount, reachedEnd, strokesFromPath, strokesToPath, type SignaturePoint } from "../signature";
import { Icon } from "./Icon";
import { useKit } from "./kit";

const ErrorText = ({ text }: { text?: string }) => {
  const { c } = useKit();
  return text ? <Text accessibilityRole="alert" style={{ color: c.negative, fontSize: 13, marginTop: 6 }}>{text}</Text> : null;
};
const Legend = ({ children }: { children: React.ReactNode }) => {
  const { c } = useKit();
  return <Text style={{ fontSize: 13, fontWeight: "500", color: c.textMuted, marginBottom: 8 }}>{children}</Text>;
};

/** The phone's file picker opens from the button (the app passes onPick); a chosen file shows with its size and a Remove. */
export function FileField({ label, hint, helper, error, file, onPick, onRemove, busy, strings }: FileFieldProps) {
  const { c, r } = useKit();
  return (
    <View>
      <Legend>{label}</Legend>
      <View style={{ gap: 10, alignItems: "flex-start", padding: 14, borderWidth: 1.5, borderStyle: "dashed", borderColor: error ? c.negative : c.borderStrong, borderRadius: r.lg, backgroundColor: c.surface }}>
        {file ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, alignSelf: "stretch" }}>
            <Icon name="check" size={18} stroke={2.5} color={c.positive} />
            <View style={{ flex: 1 }}><Text style={{ fontSize: 14, fontWeight: "700", color: c.text }}>{file.name}</Text>{file.detail ? <Text style={{ fontSize: 12, color: c.textMuted }}>{file.detail}</Text> : null}</View>
            <Pressable accessibilityRole="button" onPress={onRemove} hitSlop={8}><Text style={{ color: c.negative, fontWeight: "600", fontSize: 13 }}>{strings.remove}</Text></Pressable>
          </View>
        ) : strings.drop ? <Text style={{ fontSize: 13, color: c.textMuted }}>{strings.drop}</Text> : null}
        <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ busy: !!busy, disabled: !!busy }} disabled={busy} onPress={onPick}
          style={{ minHeight: 44, paddingHorizontal: 16, justifyContent: "center", borderWidth: 1, borderColor: c.borderStrong, borderRadius: r.md, backgroundColor: c.surface, opacity: busy ? 0.6 : 1 }}>
          <Text style={{ fontSize: 15, fontWeight: "600", color: c.text }}>{file ? strings.replace : strings.choose}</Text>
        </Pressable>
      </View>
      {hint ? <Text style={{ fontSize: 13, color: c.textMuted, marginTop: 8 }}>{hint}</Text> : null}
      {helper ? <Text style={{ fontSize: 13, color: c.textMuted, marginTop: 4 }}>{helper}</Text> : null}
      <ErrorText text={error} />
    </View>
  );
}

export function DocumentViewer({ title, paragraphs, read, onRead, height = 240, error, strings }: DocumentViewerProps) {
  const { c, r } = useKit();
  const [box, setBox] = useState(0);
  const [total, setTotal] = useState(0);
  // a text that fits without scrolling is read as soon as it is shown
  useEffect(() => { if (!read && box > 0 && total > 0 && reachedEnd(0, box, total)) onRead?.(); }, [box, total, read]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View>
      <Text accessibilityRole="header" style={{ fontSize: 15, fontWeight: "600", color: c.text, marginBottom: 8 }}>{title}</Text>
      <ScrollView accessibilityLabel={title} style={{ height, borderWidth: 1, borderColor: error ? c.negative : c.borderStrong, borderRadius: r.lg, backgroundColor: c.surface }} contentContainerStyle={{ padding: 14, gap: 10 }}
        onLayout={(e) => setBox(e.nativeEvent.layout.height)} onContentSizeChange={(_w, h) => setTotal(h)} scrollEventThrottle={64}
        onScroll={(e) => { const n = e.nativeEvent; if (!read && reachedEnd(n.contentOffset.y, n.layoutMeasurement.height, n.contentSize.height)) onRead?.(); }}>
        {paragraphs.map((p, i) => (
          <View key={i}>{p.heading ? <Text style={{ fontSize: 14, fontWeight: "700", color: c.text, marginBottom: 4 }}>{p.heading}</Text> : null}{p.text ? <Text style={{ fontSize: 14, lineHeight: 21, color: c.text }}>{p.text}</Text> : null}</View>
        ))}
      </ScrollView>
      <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 }}>
        {read ? <Icon name="check" size={14} stroke={3} color={c.positive} /> : null}
        <Text style={{ fontSize: 13, color: read ? c.positive : c.textMuted, fontWeight: read ? "600" : "400" }}>{read ? strings.done : strings.progress}</Text>
      </View>
      <ErrorText text={error} />
    </View>
  );
}

export function SignaturePad({ label, helper, error, modes, mode, onMode, name = "", onName, path = "", onPath, strings }: SignaturePadProps) {
  const { c, r } = useKit();
  const [width, setWidth] = useState(PAD.width);
  const [strokes, setStrokes] = useState<SignaturePoint[][]>(() => strokesFromPath(path));
  const live = useRef<SignaturePoint[][] | null>(null);
  const scale = useRef(1);
  scale.current = PAD.width / (width || PAD.width);
  useEffect(() => { if (path !== strokesToPath(strokes)) setStrokes(strokesFromPath(path)); }, [path]); // eslint-disable-line react-hooks/exhaustive-deps
  const out = useRef(onPath);
  out.current = onPath;
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => { live.current = [...(live.current ?? []), [{ x: e.nativeEvent.locationX * scale.current, y: e.nativeEvent.locationY * scale.current }]]; setStrokes(live.current); },
    onPanResponderMove: (e) => { const cur = live.current; if (!cur) return; cur[cur.length - 1] = [...cur[cur.length - 1]!, { x: e.nativeEvent.locationX * scale.current, y: e.nativeEvent.locationY * scale.current }]; live.current = [...cur]; setStrokes(live.current); },
    onPanResponderRelease: () => { if (live.current) out.current?.(strokesToPath(live.current), pointCount(live.current)); },
  }), []);
  // the strokes in progress start from what is already drawn
  useEffect(() => { live.current = strokes; }, [strokes]);
  const height = (width / PAD.width) * PAD.height;
  return (
    <View>
      <Legend>{label}</Legend>
      {modes.length > 1 ? (
        <View accessibilityRole="radiogroup" accessibilityLabel={strings.modes} style={{ flexDirection: "row", alignSelf: "flex-start", padding: 3, borderRadius: r.pill, backgroundColor: c.surfaceMuted, marginBottom: 10 }}>
          {modes.map((m) => (
            <Pressable key={m} accessibilityRole="radio" accessibilityState={{ checked: mode === m }} onPress={() => onMode?.(m)} style={{ paddingHorizontal: 16, minHeight: 32, justifyContent: "center", borderRadius: r.pill, backgroundColor: mode === m ? c.surface : "transparent" }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: mode === m ? c.accent : c.textMuted }}>{m === "type" ? strings.type : strings.draw}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {mode === "type" ? (
        <>
          <TextInput accessibilityLabel={strings.name} placeholder={strings.name} placeholderTextColor={c.textFaint} value={name} onChangeText={onName} autoCorrect={false}
            style={[{ height: 52, borderRadius: r.md, borderWidth: error ? 2 : 1, borderColor: error ? c.negative : c.borderStrong, backgroundColor: c.surface, paddingHorizontal: 14, fontSize: 16, color: c.text }, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null]} />
          {name.trim() ? <Text accessibilityElementsHidden style={{ marginTop: 8, paddingVertical: 8, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: c.borderStrong, fontSize: 28, fontStyle: "italic", color: c.text }}>{name}</Text> : null}
        </>
      ) : (
        <>
          <View accessibilityRole="image" accessibilityLabel={strings.pad} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} {...responder.panHandlers}
            style={{ height, borderWidth: error ? 2 : 1, borderColor: error ? c.negative : c.borderStrong, borderRadius: r.lg, backgroundColor: c.surface, overflow: "hidden" }}>
            <Svg width="100%" height="100%" viewBox={`0 0 ${PAD.width} ${PAD.height}`} pointerEvents="none">
              <Line x1={12} x2={PAD.width - 12} y1={PAD.height - 24} y2={PAD.height - 24} stroke={c.borderStrong} strokeWidth={1} strokeDasharray="4 4" />
              <Path d={strokesToPath(strokes)} stroke={c.text} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
          <Pressable accessibilityRole="button" disabled={!strokes.length} onPress={() => { live.current = []; setStrokes([]); onPath?.("", 0); }} style={{ alignSelf: "flex-start", padding: 8, opacity: strokes.length ? 1 : 0.45 }}><Text style={{ color: c.accent, fontWeight: "600" }}>{strings.clear}</Text></Pressable>
        </>
      )}
      {helper ? <Text style={{ fontSize: 13, color: c.textMuted, marginTop: 8 }}>{helper}</Text> : null}
      <ErrorText text={error} />
    </View>
  );
}

export function IdCapture({ label, error, steps, onCapture, strings }: IdCaptureProps) {
  const { c, r } = useKit();
  return (
    <View>
      <Legend>{label}</Legend>
      <Text style={{ fontSize: 13, color: c.textMuted, marginBottom: 10 }}>{strings.simulated}</Text>
      <View style={{ gap: 10 }}>
        {steps.map((s) => (
          <View key={s.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderWidth: 1, borderColor: s.done ? c.positive : c.border, borderRadius: r.lg, backgroundColor: c.surface }}>
            <View style={{ width: s.id === "selfie" ? 44 : 64, height: 44, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderStyle: s.done ? "solid" : "dashed", borderColor: s.done ? c.positive : c.borderStrong, borderRadius: s.id === "selfie" ? 22 : r.md }}>
              <Icon name={s.done ? "check" : s.id === "selfie" ? "user" : "card"} size={26} stroke={1.75} color={s.done ? c.positive : c.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: c.text }}>{s.label}</Text>
              <Text style={{ fontSize: 12, color: c.textMuted }}>{s.done ? `${strings.done}${s.ref ? ` · ${s.ref}` : ""}` : s.hint}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={`${s.done ? strings.retake : strings.capture}: ${s.label}`} onPress={() => onCapture?.(s.id)} style={{ minHeight: 36, paddingHorizontal: 12, justifyContent: "center", borderRadius: r.pill, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.surface }}>
              <Text style={{ fontSize: 13, color: c.text }}>{s.done ? strings.retake : strings.capture}</Text>
            </Pressable>
          </View>
        ))}
      </View>
      <ErrorText text={error} />
    </View>
  );
}
