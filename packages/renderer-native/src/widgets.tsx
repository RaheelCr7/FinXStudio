import React, { useId, useMemo, useState } from "react";
import { GestureResponderEvent, LayoutChangeEvent, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { useTheme } from "./theme";

const tab = { fontVariant: ["tabular-nums" as const] };
const gid = (id: string) => `g${id.replace(/[^a-zA-Z0-9]/g, "")}`;

// ---------- icons -----------------------------------------------------------------------------------------------------
type IconDraw = (c: string) => React.ReactNode;
const P = (d: string) => (_c: string) => <Path d={d} />;
const ICONS: Record<string, IconDraw> = {
  home: (c) => <><Path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><Path d="M9 22V12h6v10" /></>,
  accounts: P("M3 3v16a2 2 0 0 0 2 2h16M18 17V9M13 17V5M8 17v-3"),
  budgets: P("m12 14 4-4M3.34 19a10 10 0 1 1 17.32 0"),
  wallet: P("M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"),
  bell: P("M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"),
  menu: P("M5 8h14M9 16h10"),
  plus: P("M5 12h14M12 5v14"),
  x: P("M18 6 6 18M6 6l12 12"),
  check: P("M20 6 9 17l-5-5"),
  back: P("m12 19-7-7 7-7M19 12H5"),
  chevronRight: P("m9 18 6-6-6-6"),
  chevronDown: P("m6 9 6 6 6-6"),
  up: P("M7 7h10v10M7 17 17 7"),
  down: P("m7 7 10 10M17 7v10H7"),
  bag: P("M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"),
  food: P("M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"),
  briefcase: (c) => <><Path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /><Rect x={2} y={6} width={20} height={14} rx={2} /></>,
  card: (c) => <><Rect x={2} y={5} width={20} height={14} rx={2} /><Path d="M2 10h20" /></>,
  bank: P("M3 22h18M6 18v-7M10 18v-7M14 18v-7M18 18v-7M12 2l8 5H4z"),
  shield: P("M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1zM9 12l2 2 4-4"),
  trend: P("m22 7-8.5 8.5-5-5L2 17M16 7h6v6"),
  repeat: P("m17 2 4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3"),
  dollar: P("M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"),
  lock: (c) => <><Rect x={3} y={11} width={18} height={11} rx={2} /><Path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
};
export type IconName = keyof typeof ICONS | (string & {});

export function Icon({ name, size = 22, color, stroke = 2 }: { name: IconName; size?: number; color?: string; stroke?: number }) {
  const { c } = useTheme();
  const col = color ?? c.text;
  const draw = ICONS[name];
  return (
    // A View, not a bare <svg>: on the web only positioned elements stack above a gradient's absolutely positioned layer
    <View pointerEvents="none" style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <G stroke={col} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeLinejoin="round">{draw ? draw(col) : null}</G>
      </Svg>
    </View>
  );
}

// ---------- gradient surface --------------------------------------------------------------------------------------------
export function Gradient({ from, to, radius = 0, style, children }: { from: string; to: string; radius?: number; style?: ViewStyle; children?: React.ReactNode }) {
  const id = gid(useId());
  return (
    <View style={[{ overflow: "hidden", borderRadius: radius }, style]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" pointerEvents="none">
        <Defs><LinearGradient id={id} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={from} /><Stop offset="1" stopColor={to} /></LinearGradient></Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
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
export type Point = { label: string; value: number };

/** Smooth path through the points (Catmull-Rom converted to cubic Béziers). */
function smooth(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  let d = `M${pts[0]!.x} ${pts[0]!.y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!, p1 = pts[i]!, p2 = pts[i + 1]!, p3 = pts[i + 2] ?? p2;
    d += ` C${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6} ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6} ${p2.x} ${p2.y}`;
  }
  return d;
}

/** Drag or tap across the chart to read a value. */
export function LineChart({ data, color, height = 150, format, selected, onSelect }: { data: Point[]; color?: string; height?: number; format?: (p: Point) => string; selected?: number; onSelect?: (i: number) => void }) {
  const { c } = useTheme();
  const col = color ?? c.accent;
  const id = gid(useId());
  const [w, setW] = useState(0);
  const [inner, setInner] = useState<number | null>(null);
  const idx = Math.min(data.length - 1, Math.max(0, selected ?? inner ?? data.length - 1));
  const pad = 16, padX = 14;
  const geo = useMemo(() => {
    const vals = data.map((d) => d.value), lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
    const pts = data.map((d, i) => ({ x: data.length > 1 ? padX + (i / (data.length - 1)) * (w - padX * 2) : w / 2, y: pad + (1 - (d.value - lo) / span) * (height - pad * 2) }));
    const line = smooth(pts);
    return { pts, line, area: pts.length ? `${line} L${pts[pts.length - 1]!.x} ${height} L${pts[0]!.x} ${height} Z` : "" };
  }, [data, w, height]);
  const at = (e: GestureResponderEvent) => {
    const x = e.nativeEvent.locationX;
    const i = Math.round(((x - padX) / Math.max(1, w - padX * 2)) * (data.length - 1));
    const k = Math.min(data.length - 1, Math.max(0, i));
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
export type Segment = { label: string; value: number; color: string };

export function Donut({ segments, size = 168, thickness = 20, centerTop, centerSub, selected, onSelect }: { segments: Segment[]; size?: number; thickness?: number; centerTop: string; centerSub?: string; selected?: number | null; onSelect?: (i: number | null) => void }) {
  const { c } = useTheme();
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const R = (size - thickness) / 2, C = 2 * Math.PI * R, gap = segments.length > 1 ? thickness : 0; // round caps reach half a thickness past each end, so leave a full one between arcs
  let acc = 0;
  const arcs = segments.map((s, i) => { const len = (s.value / total) * C; const a = { s, i, start: acc, len }; acc += len; return a; });
  const pick = (e: GestureResponderEvent) => {
    const x = e.nativeEvent.locationX - size / 2, y = e.nativeEvent.locationY - size / 2;
    const dist = Math.hypot(x, y);
    if (dist < R - thickness || dist > R + thickness) { onSelect?.(null); return; }
    let ang = Math.atan2(y, x) + Math.PI / 2; if (ang < 0) ang += 2 * Math.PI;
    const at = (ang / (2 * Math.PI)) * C;
    const hit = arcs.find((a) => at >= a.start && at < a.start + a.len);
    if (hit) onSelect?.(hit.i === selected ? null : hit.i);
  };
  return (
    <View style={{ width: size, height: size, alignSelf: "center" }} accessibilityRole="image" accessibilityLabel={`Spending chart. ${centerTop} ${centerSub ?? ""}`} onStartShouldSetResponder={() => true} onResponderRelease={pick}>
      <Svg width={size} height={size} pointerEvents="none">
        <G transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <Circle cx={size / 2} cy={size / 2} r={R} stroke={c.surfaceMuted} strokeWidth={thickness} fill="none" />
          {arcs.map(({ s, i, start, len }) => (
            <Circle key={i} cx={size / 2} cy={size / 2} r={R} stroke={s.color} strokeWidth={selected === i ? thickness + 6 : thickness} fill="none" strokeLinecap="round"
              strokeDasharray={`${Math.max(0, len - gap)} ${C - Math.max(0, len - gap)}`} strokeDashoffset={-start} opacity={selected == null || selected === i ? 1 : 0.35} />
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
        <View style={{ flexDirection: "row" }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#EB001B" }} />
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#F79E1B", marginStart: -11, opacity: 0.92 }} />
        </View>
        <Text style={{ color: "rgba(255,255,255,.9)", fontSize: 13, fontWeight: "700", textTransform: "capitalize" }}>{label ?? network}</Text>
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
