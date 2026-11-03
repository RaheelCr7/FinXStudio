import React, { useState } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";
import type { AppBarProps, ButtonProps, KeypadProps, ListRowProps, PinDotsProps, TextFieldProps } from "../props";
import { KEYPAD_ROWS } from "../web/Keypad";
import { Icon } from "./Icon";
import { useKit } from "./kit";

const tabular = { fontVariant: ["tabular-nums" as const] };
const flip = (rtl: boolean) => (rtl ? { transform: [{ scaleX: -1 }] } : undefined);

export function Button({ label, variant = "primary", busy, disabled, onPress }: ButtonProps) {
  const { c, t, bar } = useKit();
  const primary = variant === "primary";
  const off = busy || disabled;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ busy: !!busy, disabled: !!off }} disabled={off} onPress={onPress}
      style={({ pressed }) => ({ minHeight: t.button.height, paddingVertical: 8, paddingHorizontal: 16, borderRadius: t.button.radius, alignItems: "center", justifyContent: "center",
        backgroundColor: primary ? bar ?? c.accent : "transparent", borderWidth: primary ? 0 : 1, borderColor: bar ?? c.borderStrong, opacity: off ? 0.6 : pressed ? 0.9 : 1 })}>
      <Text style={{ color: primary ? c.accentOn : bar ?? c.text, fontSize: 16, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

const KEYBOARD = { default: "default", number: "number-pad", phone: "phone-pad", email: "email-address" } as const;

export function TextField({ label, value, onChange, look = "standard", placeholder, helper, error, secure, keyboard = "default", disabled, strings = { show: "Show", hide: "Hide" } }: TextFieldProps) {
  const { c, t } = useKit();
  const [shown, setShown] = useState(false);
  const [focus, setFocus] = useState(false);
  const outlined = look === "outlined";
  return (
    <View>
      {outlined ? null : <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: "500", marginBottom: 8 }}>{label}</Text>}
      <View>
        <TextInput accessibilityLabel={label} value={value} editable={!disabled} secureTextEntry={!!secure && !shown} keyboardType={KEYBOARD[keyboard]} placeholder={outlined ? placeholder ?? label : placeholder}
          placeholderTextColor={c.textFaint} textContentType={secure ? "none" : undefined} autoComplete={secure ? "off" : undefined} importantForAutofill={secure ? "no" : undefined}
          autoCapitalize="none" autoCorrect={false} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} onChangeText={onChange} accessibilityState={{ disabled: !!disabled }}
          style={[{ height: t.field.height, paddingStart: 14, paddingEnd: secure ? (outlined ? 48 : 64) : 14, borderRadius: t.field.radius, borderWidth: focus || error ? Math.max(2, t.field.border) : t.field.border,
            borderColor: error ? c.negative : focus ? c.accent : outlined ? c.border : c.borderStrong, backgroundColor: c.surface, color: c.text, fontSize: 16, opacity: disabled ? 0.6 : 1 }, tabular,
            Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null]} />
        {secure ? (
          <Pressable accessibilityRole="button" accessibilityLabel={shown ? strings.hide : strings.show} accessibilityState={{ selected: shown }} onPress={() => setShown(!shown)} hitSlop={8}
            style={{ position: "absolute", end: 14, top: 0, bottom: 0, justifyContent: "center" }}>
            {outlined ? <Icon name={shown ? "eyeOff" : "eye"} size={20} color={c.textMuted} /> : <Text style={{ color: c.accent, fontSize: 13, fontWeight: "700" }}>{shown ? strings.hide : strings.show}</Text>}
          </Pressable>
        ) : null}
      </View>
      {helper ? <Text style={{ color: c.textMuted, fontSize: 13, marginTop: 8 }}>{helper}</Text> : null}
      {error ? <Text accessibilityRole="alert" style={{ color: c.negative, fontSize: 13, marginTop: 6 }}>{error}</Text> : null}
    </View>
  );
}

export function AppBar({ title, tone = "plain", onBack, onClose, labels = { back: "Back", close: "Close" } }: AppBarProps) {
  const { c, t, bar, rtl } = useKit();
  const solid = tone === "bar";
  const ink = solid ? "#FFFFFF" : c.text;
  const Slot = ({ name, label, onPress, mirror }: { name: string; label: string; onPress?: () => void; mirror?: boolean }) => onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" }}>
      <View style={mirror ? flip(rtl) : undefined}><Icon name={name} size={t.bar.icon - 2} color={ink} /></View>
    </Pressable>
  ) : <View style={{ width: 40, height: 40 }} />;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: t.bar.height, paddingHorizontal: 12, backgroundColor: solid ? bar ?? c.accent : c.bg }}>
      <Slot name="back" label={labels.back} onPress={onBack} mirror />
      <Text accessibilityRole="header" style={{ flex: 1, textAlign: "center", color: ink, fontSize: 16, lineHeight: 22, fontWeight: "600" }}>{title}</Text>
      <Slot name="x" label={labels.close} onPress={onClose} />
    </View>
  );
}

export function ListRow({ label, text, icon, onPress, disabled }: ListRowProps) {
  const { c, t, rtl } = useKit();
  return (
    <View>
      <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, minHeight: t.row.height, borderWidth: 1, borderColor: c.border, borderRadius: t.row.radius, opacity: disabled ? 0.6 : 1,
          backgroundColor: pressed ? c.surfaceMuted : c.surface })}>
        {icon ? <Icon name={icon} size={22} color={c.textMuted} /> : null}
        <Text style={{ flex: 1, color: c.text, fontSize: 14, fontWeight: "600" }}>{label}</Text>
        <View style={flip(rtl)}><Icon name="chevronRight" size={18} color={c.text} /></View>
      </Pressable>
      {text ? <Text style={{ color: c.textMuted, fontSize: 11, marginTop: 6, marginHorizontal: 4 }}>{text}</Text> : null}
    </View>
  );
}

export function Keypad({ onKey, labels = { back: "Delete" } }: KeypadProps) {
  const { c, t } = useKit();
  const { key, keyHeight, gapX, gapY } = t.keypad;
  return (
    <View style={{ gap: gapY, direction: "ltr" as any }}>
      {KEYPAD_ROWS.map((row, ri) => (
        <View key={ri} style={{ flexDirection: "row", justifyContent: "center", gap: gapX }}>
          {row.map((k, ki) => k === "" ? <View key={ki} style={{ width: key, height: keyHeight }} /> : (
            <Pressable key={ki} accessibilityRole="button" accessibilityLabel={k === "back" ? labels.back : k} onPress={() => onKey?.(k)}
              style={({ pressed }) => ({ width: key, height: keyHeight, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? c.accentSoft : c.surfaceMuted })}>
              {k === "back" ? <Icon name="backspace" size={20} color={c.textMuted} /> : <Text style={[{ fontSize: 18, fontWeight: "600", color: c.text }, tabular]}>{k}</Text>}
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

export function PinDots({ length, filled, masked = true, digits = "", label }: PinDotsProps) {
  const { c } = useKit();
  return (
    <View accessibilityRole="image" accessibilityLabel={`${label}. ${filled}/${length}`} style={{ flexDirection: "row", justifyContent: "center", gap: 12, direction: "ltr" as any }}>
      {Array.from({ length }, (_, i) => (
        <View key={i} style={{ width: 36, alignItems: "center" }}>
          <Text style={[{ height: 28, fontSize: 22, fontWeight: "600", color: c.text }, tabular]}>{i < filled ? (masked ? "•" : digits[i]) : ""}</Text>
          <View style={{ height: 2, width: "100%", backgroundColor: i === filled ? c.accent : c.borderStrong }} />
        </View>
      ))}
    </View>
  );
}
