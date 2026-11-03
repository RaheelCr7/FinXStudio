import React, { useRef, useState } from "react";
import { Image, Platform, Pressable, Text, TextInput, View } from "react-native";
import { mix } from "@finx/ui-kit";
import type { AlertProps, AmountFieldProps, CheckboxProps, ChoiceGroupProps, CodeInputProps, HeroProps, ResultProps, SectionHeaderProps, ShortcutsProps, SummaryListProps, SwitchProps } from "../props";
import { Icon } from "./Icon";
import { useKit } from "./kit";

const tabular = { fontVariant: ["tabular-nums" as const] };
const noOutline = Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null;

const ErrorText = ({ text }: { text?: string }) => {
  const { c } = useKit();
  return text ? <Text accessibilityRole="alert" style={{ color: c.negative, fontSize: 13, marginTop: 6 }}>{text}</Text> : null;
};
const Legend = ({ children }: { children: React.ReactNode }) => {
  const { c } = useKit();
  return <Text style={{ fontSize: 13, fontWeight: "500", color: c.textMuted, marginBottom: 8 }}>{children}</Text>;
};

export function Alert({ tone, text }: AlertProps) {
  const { c, r } = useKit();
  const [bg, fg] = { warning: [c.warningBg, c.warning], error: [c.negativeBg, c.negative], success: [c.positiveBg, c.positive], info: [c.infoBg, c.info] }[tone] ?? [c.infoBg, c.info];
  return <View accessibilityRole="alert" style={{ backgroundColor: bg, padding: 14, borderRadius: r.md }}><Text style={{ color: fg, fontSize: 14, lineHeight: 20 }}>{text}</Text></View>;
}

export function Result({ tone, title, text, meta }: ResultProps) {
  const { c, r } = useKit();
  const ok = tone === "success";
  return (
    <View style={{ alignItems: "center", paddingTop: 32 }}>
      <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: ok ? c.positiveBg : c.negativeBg, alignItems: "center", justifyContent: "center" }}>
        {ok ? <Icon name="check" size={40} color={c.positive} stroke={2.5} /> : <Text style={{ fontSize: 40, color: c.negative }}>!</Text>}
      </View>
      <Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: "600", color: c.text, marginTop: 20, textAlign: "center" }}>{title}</Text>
      {text ? <Text style={{ color: c.textMuted, fontSize: 15, marginTop: 8, textAlign: "center", lineHeight: 22 }}>{text}</Text> : null}
      {meta ? <Text style={{ marginTop: 14, paddingHorizontal: 12, paddingVertical: 5, borderRadius: r.pill, backgroundColor: c.surfaceMuted, color: c.textMuted, fontSize: 12, fontFamily: Platform.OS === "web" ? "ui-monospace, Menlo, monospace" : undefined }}>{meta}</Text> : null}
    </View>
  );
}

export function SummaryList({ rows }: SummaryListProps) {
  const { c, r } = useKit();
  return (
    <View style={{ borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, borderRadius: r.lg, paddingHorizontal: 16 }}>
      {rows.map((row, i) => (
        <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", gap: 16, paddingVertical: 14, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
          <Text style={{ color: c.textMuted, fontSize: 14 }}>{row.label}</Text>
          <Text style={[{ color: c.text, fontSize: 14, fontWeight: "600", flexShrink: 1, textAlign: "right" }, tabular]}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

export function Switch({ label, helper, checked, onChange, link }: SwitchProps) {
  const { c } = useKit();
  const row = (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked }} accessibilityLabel={label} onPress={() => onChange?.(!checked)} style={{ flexDirection: "row", alignItems: "center", gap: 14, flex: link ? undefined : 1 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontSize: 15, fontWeight: "600" }}>{label}</Text>
        {helper ? <Text style={{ color: c.textMuted, fontSize: 13, marginTop: 2 }}>{helper}</Text> : null}
      </View>
      <View style={{ width: 50, height: 30, borderRadius: 15, padding: 3, backgroundColor: checked ? c.accent2 : c.borderStrong, alignItems: checked ? "flex-end" : "flex-start", justifyContent: "center" }}>
        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#fff" }} />
      </View>
    </Pressable>
  );
  if (!link) return row;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <Pressable accessibilityRole="link" accessibilityLabel={link.label} onPress={link.onPress} hitSlop={8}><Text style={{ color: c.accent, fontSize: 13, fontWeight: "600" }}>{link.label}</Text></Pressable>
      {row}
    </View>
  );
}

export function Checkbox({ label, checked, onChange, error }: CheckboxProps) {
  const { c } = useKit();
  return (
    <View>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={label} onPress={() => onChange?.(!checked)} style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: checked ? c.accent : error ? c.negative : c.borderStrong, backgroundColor: checked ? c.accent : "transparent", alignItems: "center", justifyContent: "center", marginEnd: 12 }}>
          {checked ? <Icon name="check" size={14} color={c.accentOn} stroke={3} /> : null}
        </View>
        <Text style={{ flex: 1, color: c.text, fontSize: 15, lineHeight: 22 }}>{label}</Text>
      </Pressable>
      <ErrorText text={error} />
    </View>
  );
}

export function ChoiceGroup({ label, look = "chips", options, onChange, error, footer }: ChoiceGroupProps) {
  const { c, r } = useKit();
  const text = (o: ChoiceGroupProps["options"][number], size = 15) => (
    <View style={{ flex: 1 }}>
      <Text style={{ color: c.text, fontWeight: "600", fontSize: size }}>{o.title}</Text>
      {o.sub ? <Text style={[{ color: c.textMuted, fontSize: 13, marginTop: 2 }, tabular]}>{o.sub}</Text> : null}
    </View>
  );
  const press = (o: ChoiceGroupProps["options"][number]) => ({ accessibilityRole: "radio" as const, accessibilityState: { selected: o.selected }, accessibilityLabel: o.label ?? o.title, onPress: () => onChange?.(o.id) });
  let body: React.ReactNode;
  if (look === "rows") {
    body = options.map((o) => (
      <Pressable key={o.id} {...press(o)} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border }}>
        {text(o)}
        <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: o.selected ? c.accent : c.borderStrong, alignItems: "center", justifyContent: "center" }}>
          {o.selected ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.accent }} /> : null}
        </View>
      </Pressable>
    ));
  } else if (look === "cards") {
    body = options.map((o) => (
      <Pressable key={o.id} {...press(o)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, marginBottom: 10, borderRadius: r.lg, backgroundColor: c.surface, borderColor: o.selected ? c.accent : c.border, borderWidth: o.selected ? 2 : 1, opacity: pressed ? 0.85 : 1 })}>
        <View style={{ width: 40, height: 40, borderRadius: o.round ? 20 : r.md, backgroundColor: c.accentSoft, alignItems: "center", justifyContent: "center" }}><Text style={{ color: c.accent, fontWeight: "600", fontSize: 13 }}>{o.avatar}</Text></View>
        {text(o)}
      </Pressable>
    ));
  } else if (look === "tiles") {
    body = (
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {options.map((o) => (
          <Pressable key={o.id} {...press(o)} style={({ pressed }) => ({ width: "47%", flexGrow: 1, padding: 14, borderRadius: r.lg, gap: 10, backgroundColor: c.surface, borderWidth: 2, borderColor: o.selected ? c.accent2 : c.border, opacity: pressed ? 0.88 : 1 })}>
            {o.icon ? <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: o.selected ? c.accent2Soft : c.accentSoft, alignItems: "center", justifyContent: "center" }}><Icon name={o.icon} size={18} color={o.selected ? c.accent2 : c.accent} /></View>
              : <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: o.color ?? c.accent, alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>{o.title.slice(0, 1)}</Text></View>}
            {text(o)}
            {o.selected ? <View style={{ position: "absolute", top: 10, end: 10, width: 22, height: 22, borderRadius: 11, backgroundColor: c.accent2, alignItems: "center", justifyContent: "center" }}><Icon name="check" size={13} color="#fff" stroke={3} /></View> : null}
          </Pressable>
        ))}
      </View>
    );
  } else {
    body = (
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((o) => (
          <Pressable key={o.id} {...press(o)} style={{ paddingHorizontal: 14, minHeight: 40, paddingVertical: 6, borderRadius: r.pill, justifyContent: "center", borderWidth: o.selected ? 2 : 1, borderColor: o.selected ? c.accent : c.border, backgroundColor: o.selected ? c.accentSoft : c.surface }}>
            <Text style={{ color: o.selected ? c.accent : c.text, fontWeight: "500", fontSize: 14 }}>{o.title}</Text>
          </Pressable>
        ))}
      </View>
    );
  }
  return (
    <View accessibilityRole="radiogroup">
      <Legend>{label}</Legend>
      {body}
      {footer ? <Text style={{ color: c.accent, fontWeight: "600", marginTop: 4 }}>{footer}</Text> : null}
      <ErrorText text={error} />
    </View>
  );
}

export function AmountField({ label, value, symbol, onChange, helper, error, quick = [], onQuick, quickLabel }: AmountFieldProps) {
  const { c, r } = useKit();
  const [focus, setFocus] = useState(false);
  return (
    <View>
      <Legend>{label}</Legend>
      <View style={{ flexDirection: "row", alignItems: "baseline", borderBottomWidth: 2, borderBottomColor: error ? c.negative : focus ? c.accent : c.borderStrong, paddingBottom: 8 }}>
        <Text style={{ fontSize: 20, fontWeight: "500", color: c.textMuted, marginEnd: 8 }}>{symbol}</Text>
        <TextInput accessibilityLabel={label} value={value} placeholder="0" placeholderTextColor={c.textFaint} keyboardType="number-pad" onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} onChangeText={onChange}
          style={[{ flex: 1, fontSize: 40, fontWeight: "600", color: c.text, padding: 0 }, tabular, noOutline]} />
      </View>
      {helper ? <Text style={[{ color: c.textMuted, fontSize: 13, marginTop: 8 }, tabular]}>{helper}</Text> : null}
      {quick.length ? (
        <View accessibilityRole="radiogroup" accessibilityLabel={quickLabel} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
          {quick.map((q) => (
            <Pressable key={q.value} accessibilityRole="radio" accessibilityState={{ selected: q.selected }} accessibilityLabel={q.aria} onPress={() => onQuick?.(q.value)}
              style={({ pressed }) => ({ minWidth: 64, minHeight: 40, paddingHorizontal: 16, borderRadius: r.md, alignItems: "center", justifyContent: "center", backgroundColor: q.selected ? c.accent2 : c.surface, borderWidth: 1, borderColor: q.selected ? c.accent2 : c.border, opacity: pressed ? 0.85 : 1 })}>
              <Text style={[{ color: q.selected ? "#fff" : c.text, fontWeight: "700", fontSize: 15 }, tabular]}>{q.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <ErrorText text={error} />
    </View>
  );
}

export function CodeInput({ label, length, value, onChange, hint, error }: CodeInputProps) {
  const { c, r } = useKit();
  const ref = useRef<React.ComponentRef<typeof TextInput>>(null);
  return (
    <View>
      {hint ? <Text style={{ color: c.textMuted, fontSize: 14, marginBottom: 16, lineHeight: 20 }}>{hint}</Text> : null}
      <Pressable onPress={() => ref.current?.focus()} accessibilityLabel={label}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", direction: "ltr" as any }}>
          {Array.from({ length }, (_, i) => (
            <View key={i} style={{ width: 46, height: 56, borderRadius: r.md, borderWidth: i === value.length ? 2 : 1, borderColor: error ? c.negative : i === value.length ? c.accent : c.borderStrong, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" }}>
              <Text style={[{ fontSize: 24, fontWeight: "600", color: c.text }, tabular]}>{value[i] ?? ""}</Text>
            </View>
          ))}
        </View>
        <TextInput ref={ref} value={value} keyboardType="number-pad" maxLength={length} textContentType="oneTimeCode" autoComplete="one-time-code" onChangeText={onChange} style={{ position: "absolute", opacity: 0, width: "100%", height: "100%" }} />
      </Pressable>
      <ErrorText text={error} />
    </View>
  );
}

export function SectionHeader({ title, action }: SectionHeaderProps) {
  const { c } = useKit();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text accessibilityRole="header" style={{ fontSize: 16, fontWeight: "700", color: c.text }}>{title}</Text>
      {action ? (
        <Pressable accessibilityRole="button" onPress={action.onPress} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text style={{ fontSize: 13, color: c.text }}>{action.label}</Text><Icon name="chevronDown" size={14} color={c.text} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function Shortcuts({ items }: ShortcutsProps) {
  const { c } = useKit();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-around", paddingVertical: 4 }}>
      {items.map((it) => (
        <Pressable key={it.id} accessibilityRole="button" accessibilityLabel={it.label} onPress={it.onPress} style={{ alignItems: "center", gap: 8, minWidth: 88 }}>
          <View style={{ width: 50, height: 50, borderRadius: 14, backgroundColor: mix(c.accent, "#000000", 0.35), alignItems: "center", justifyContent: "center" }}>
            {it.icon ? <Icon name={it.icon} size={22} color="#FFFFFF" /> : null}
          </View>
          <Text style={{ fontSize: 12, fontWeight: "500", color: c.text }}>{it.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Hero({ name, logo }: HeroProps) {
  const { c, bar } = useKit();
  return (
    <View accessibilityRole="header" style={{ backgroundColor: bar ?? c.accent, height: 200, alignItems: "center", justifyContent: "center" }}>
      {logo ? <Image accessibilityLabel={name} source={{ uri: logo }} resizeMode="contain" style={{ width: 230, height: 70 }} /> : <Text style={{ color: c.accentOn, fontSize: 26, fontWeight: "700" }}>{name}</Text>}
    </View>
  );
}
