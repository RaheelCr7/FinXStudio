import React, { useId, useMemo, useState } from "react";
import { GestureResponderEvent, LayoutChangeEvent, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { ICON_SHAPES, donutArcs, donutHit, lineGeometry, nearestIndex, type ChartPoint, type DonutSegment, type IconKey } from "@finx/ui-kit";
import { useTheme } from "./theme";

const tab = { fontVariant: ["tabular-nums" as const] };
const gid = (id: string) => `g${id.replace(/[^a-zA-Z0-9]/g, "")}`;

// ---------- icons -----------------------------------------------------------------------------------------------------
export type IconName = IconKey | (string & {});

export function Icon({ name, size = 22, color, stroke = 2 }: { name: IconName; size?: number; color?: string; stroke?: number }) {
  const { c } = useTheme();
  const col = color ?? c.text;
  const shapes = ICON_SHAPES[name];
  return (
    // A View, not a bare <svg>: on the web only positioned elements stack above a gradient's absolutely positioned layer
    <View pointerEvents="none" style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <G stroke={col} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeLinejoin="round">{shapes?.map((sh, i) => ("d" in sh ? <Path key={i} d={sh.d} /> : <Rect key={i} x={sh.rect.x} y={sh.rect.y} width={sh.rect.width} height={sh.rect.height} rx={sh.rect.rx} />))}</G>
      </Svg>
    </View>
  );
}

// ---------- gradient surface --------------------------------------------------------------------------------------------
export function Gradient({ from, to, radius = 0, style, children }: { from: string; to: string; radius?: number; style?: ViewStyle; children?: React.ReactNode }) {
  const id = gid(useId());
  // Explicit pixel sizes: on iOS an SVG sized "100%" inside an absolutely positioned layer did not follow its parent.
  const [box, setBox] = useState({ w: 0, h: 0 });
  return (
    <View style={[{ overflow: "hidden", borderRadius: radius }, style]} onLayout={(e: LayoutChangeEvent) => { const { width, height } = e.nativeEvent.layout; setBox((b) => (b.w === width && b.h === height ? b : { w: width, h: height })); }}>
      {box.w > 0 ? (
        <Svg style={StyleSheet.absoluteFill} width={box.w} height={box.h} pointerEvents="none">
          <Defs><LinearGradient id={id} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={from} /><Stop offset="1" stopColor={to} /></LinearGradient></Defs>
          <Rect x={0} y={0} width={box.w} height={box.h} fill={`url(#${id})`} />
        </Svg>
      ) : null}
      {children}
    </View>
  );
}

// ---------- small pieces -------------------------------------------------------------------------------------------------
export function Pill({ text, tone = "neutral", onPress, selected, icon }: { text: string; tone?: "neutral" | "positive" | "negative" | "accent" | "cyan"; onPress?: () => void; selected?: boolean; icon?: IconName }) {
  const { c } = useTheme();
  const map = { neutral: [c.surfaceMuted, c.textMuted], positive: [c.positiveBg, c.positive], negative: [c.negativeBg, c.negative], accent: [c.accentSoft, c.accent], cyan: [c.accent2Soft, c.accent2] } as const;
  const [bg, fg] = selected ? [c.accent2, "#FFFFFF"] : map[tone];
  const body = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, minHeight: 30, paddingVertical: 4, borderRadius: 999, backgroundColor: bg, alignSelf: "flex-start" }}>
      {icon ? <Icon name={icon} size={14} color={fg} /> : null}
      <Text style={[{ color: fg, fontSize: 13, fontWeight: "600" }, tab]}>{text}</Text>
    </View>
  );
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={text} accessibilityState={{ selected: !!selected }} onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>{body}</Pressable> : body;
}

/** A row of options where exactly one is selected. */
export function Segmented<T extends string>({ options, value, onChange, dark }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; dark?: boolean }) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: "row", padding: 3, borderRadius: 999, backgroundColor: dark ? "rgba(255,255,255,.14)" : c.surfaceMuted, alignSelf: "flex-start" }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable key={o.id} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(o.id)}
            style={{ paddingHorizontal: 14, minHeight: 30, justifyContent: "center", borderRadius: 999, backgroundColor: on ? (dark ? "#FFFFFF" : c.surface) : "transparent" }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: on ? (dark ? "#14489F" : c.accent) : dark ? "rgba(255,255,255,.85)" : c.textMuted }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ProgressBar({ value, max, color, track, height = 8 }: { value: number; max: number; color?: string; track?: string; height?: number }) {
  const { c } = useTheme();
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }} style={{ height, borderRadius: height, backgroundColor: track ?? c.surfaceMuted, overflow: "hidden" }}>
      <View style={{ width: `${pct * 100}%`, height: "100%", borderRadius: height, backgroundColor: color ?? c.fab }} />
    </View>
  );
}

export function IconTile({ icon, color, bg, size = 44 }: { icon: IconName; color: string; bg: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}><Icon name={icon} size={size * 0.46} color={color} /></View>;
}

// ---------- interactive line chart -----------------------------------------------------------------------------------------
export type Point = ChartPoint;

/** Drag or tap across the chart to read a value. */
export function LineChart({ data, color, height = 150, format, selected, onSelect }: { data: Point[]; color?: string; height?: number; format?: (p: Point) => string; selected?: number; onSelect?: (i: number) => void }) {
  const { c } = useTheme();
  const col = color ?? c.accent;
  const id = gid(useId());
  const [w, setW] = useState(0);
  const [inner, setInner] = useState<number | null>(null);
  const idx = Math.min(data.length - 1, Math.max(0, selected ?? inner ?? data.length - 1));
  const geo = useMemo(() => lineGeometry(data, w, height), [data, w, height]);
  const at = (e: GestureResponderEvent) => {
    const k = nearestIndex(e.nativeEvent.locationX, w, data.length);
    setInner(k); onSelect?.(k);
  };
  const sel = geo.pts[idx];
  const text = data[idx] ? (format ? format(data[idx]!) : String(data[idx]!.value)) : "";
  const tipW = 112;
  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} style={{ height }} accessibilityRole="adjustable" accessibilityLabel={`Chart. ${text}`}
      onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderGrant={at} onResponderMove={at}>
      {w > 0 ? (
        <>
          <Svg width={w} height={height} pointerEvents="none">
            <Defs><LinearGradient id={id} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={col} stopOpacity={0.28} /><Stop offset="1" stopColor={col} stopOpacity={0} /></LinearGradient></Defs>
            <Path d={geo.area} fill={`url(#${id})`} />
            <Path d={geo.line} stroke={col} strokeWidth={2.5} fill="none" strokeLinecap="round" />
            {sel ? <G><Line x1={sel.x} x2={sel.x} y1={0} y2={height} stroke={col} strokeOpacity={0.25} strokeWidth={1} strokeDasharray="3 4" /><Circle cx={sel.x} cy={sel.y} r={9} fill={col} fillOpacity={0.18} /><Circle cx={sel.x} cy={sel.y} r={5} fill={c.surface} stroke={col} strokeWidth={3} /></G> : null}
          </Svg>
          {sel ? (
            <View pointerEvents="none" style={{ position: "absolute", top: Math.max(0, sel.y - 46), left: Math.min(w - tipW, Math.max(0, sel.x - tipW / 2)), width: tipW, paddingVertical: 5, borderRadius: 10, backgroundColor: c.ink, alignItems: "center" }}>
              <Text style={{ color: c.inkMuted, fontSize: 10 }}>{data[idx]!.label}</Text>
              <Text style={[{ color: c.inkText, fontSize: 13, fontWeight: "700" }, tab]}>{text}</Text>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

// ---------- interactive donut ----------------------------------------------------------------------------------------------
export type Segment = DonutSegment;

export function Donut({ segments, size = 168, thickness = 20, centerTop, centerSub, selected, onSelect }: { segments: Segment[]; size?: number; thickness?: number; centerTop: string; centerSub?: string; selected?: number | null; onSelect?: (i: number | null) => void }) {
  const { c } = useTheme();
  const ring = donutArcs(segments, size, thickness);
  const { R } = ring;
  const pick = (e: GestureResponderEvent) => {
    const hit = donutHit(e.nativeEvent.locationX, e.nativeEvent.locationY, size, thickness, ring);
    if (hit == null) { onSelect?.(null); return; }
    onSelect?.(hit === selected ? null : hit);
  };
  return (
    <View style={{ width: size, height: size, alignSelf: "center" }} accessibilityRole="image" accessibilityLabel={`Spending chart. ${centerTop} ${centerSub ?? ""}`} onStartShouldSetResponder={() => true} onResponderRelease={pick}>
      <Svg width={size} height={size} pointerEvents="none">
        <G transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <Circle cx={size / 2} cy={size / 2} r={R} stroke={c.surfaceMuted} strokeWidth={thickness} fill="none" />
          {ring.arcs.map(({ segment: s, index: i, dasharray, offset }) => (
            <Circle key={i} cx={size / 2} cy={size / 2} r={R} stroke={s.color} strokeWidth={selected === i ? thickness + 6 : thickness} fill="none" strokeLinecap="round"
              strokeDasharray={dasharray} strokeDashoffset={offset} opacity={selected == null || selected === i ? 1 : 0.35} />
          ))}
        </G>
      </Svg>
      <View pointerEvents="none" style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
        <Text style={[{ color: c.text, fontSize: size / 6.2, fontWeight: "700" }, tab]}>{centerTop}</Text>
        {centerSub ? <Text style={{ color: c.textMuted, fontSize: 11, marginTop: 2 }}>{centerSub}</Text> : null}
      </View>
    </View>
  );
}

// ---------- card visual ---------------------------------------------------------------------------------------------------
export function CardVisual({ number, holder, expiry, network = "mastercard", balance, label }: { number: string; holder: string; expiry: string; network?: string; balance?: string; label?: string }) {
  const { c } = useTheme();
  const digits = number.replace(/\D/g, "");
  const grouped = (digits.padEnd(16, "•").match(/.{1,4}/g) ?? []).join("  ");
  return (
    <Gradient from={c.heroFrom} to={c.heroTo} radius={22} style={{ padding: 20, minHeight: 170, justifyContent: "space-between" }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        {network === "visa"
          ? <Text style={{ color: "#fff", fontSize: 22, fontWeight: "900", fontStyle: "italic", letterSpacing: 1 }}>VISA</Text>
          : <View style={{ flexDirection: "row" }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#EB001B" }} />
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#F79E1B", marginStart: -11, opacity: 0.92 }} />
            </View>}
        <Text style={{ color: "rgba(255,255,255,.9)", fontSize: 13, fontWeight: "700", textTransform: "capitalize" }}>{network === "visa" ? "Credit" : "Mastercard"}</Text>
      </View>
      {balance ? <View><Text style={{ color: "rgba(255,255,255,.75)", fontSize: 11 }}>Balance</Text><Text style={[{ color: "#fff", fontSize: 24, fontWeight: "700" }, tab]}>{balance}</Text></View> : null}
      <View>
        <Text style={[{ color: "#fff", fontSize: 17, fontWeight: "600", letterSpacing: 1.5 }, tab]}>{grouped}</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 12 }}>
          <Text style={{ color: "rgba(255,255,255,.9)", fontSize: 12, fontWeight: "600" }}>{holder || "CARD HOLDER"}</Text>
          <Text style={[{ color: "rgba(255,255,255,.9)", fontSize: 12 }, tab]}>{expiry || "MM/YY"}</Text>
        </View>
      </View>
    </Gradient>
  );
}
