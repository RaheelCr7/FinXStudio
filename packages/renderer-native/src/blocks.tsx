import React from "react";
import { Image, Pressable, Text, TextInput, View, StyleSheet, Platform } from "react-native";
import { mix, space } from "@finx/ui-kit";
import { accountRows, amountText, applyKey, beneficiaryRows, cardFields, cardNetwork, cleanOtp, keyboardKind, KEYPAD_ROWS, otpCells, otpLabel, parseAmountText, prefixOf, quickAmounts, selectChoices, symbolOf, ui, type BlockProps, type BlockType } from "@finx/renderer-core";
import { useTheme } from "./theme";
import { CardVisual, Icon, IconTile } from "./widgets";

type P = BlockProps;
const tab = { fontVariant: ["tabular-nums" as const] };

export const Label = ({ children }: { children: React.ReactNode }) => {
  const { c, r: radius } = useTheme();
  return <Text style={{ fontSize: 13, fontWeight: "500", color: c.textMuted, marginBottom: 8 }}>{children}</Text>;
};
const ErrorText = ({ e }: { e?: string }) => {
  const { c, r: radius } = useTheme();
  return e ? <Text accessibilityRole="alert" style={{ color: c.negative, fontSize: 13, marginTop: 6 }}>{e}</Text> : null;
};

export function Row({ children, selected, onPress, label }: { children: React.ReactNode; selected: boolean; onPress: () => void; label: string }) {
  const { c, r: radius } = useTheme();
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => [s.row, { borderRadius: radius.lg, backgroundColor: c.surface, borderColor: selected ? c.accent : c.border, borderWidth: selected ? 2 : 1, opacity: pressed ? 0.85 : 1 }]}>
      {children}
    </Pressable>
  );
}
const Avatar = ({ text, round }: { text: string; round?: boolean }) => {
  const { c, r: radius } = useTheme();
  return <View style={{ width: 40, height: 40, borderRadius: round ? 20 : radius.md, backgroundColor: c.accentSoft, alignItems: "center", justifyContent: "center", marginEnd: 12 }}><Text style={{ color: c.accent, fontWeight: "600", fontSize: 13 }}>{text}</Text></View>;
};

export function AccountPicker({ b, set, strings }: P) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="radiogroup">
      <Label>{strings.account}</Label>
      {accountRows(b as any).map((a) => (
        <Row key={a.id} label={a.label} selected={a.selected} onPress={() => set(b.bind, a.id)}>
          <Avatar text={a.avatar} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontWeight: "600", fontSize: 15 }}>{a.title}</Text>
            {a.sub && <Text style={[{ color: c.textMuted, fontSize: 13, marginTop: 2 }, tab]}>{a.sub}</Text>}
          </View>
        </Row>
      ))}
      <ErrorText e={b.error} />
    </View>
  );
}

export function BeneficiaryPicker({ b, set, strings }: P) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="radiogroup">
      <Label>{strings.payTo}</Label>
      {beneficiaryRows(b as any).map((x) => (
        <Row key={x.id} label={x.label} selected={x.selected} onPress={() => set(b.bind, x.id)}>
          <Avatar round text={x.avatar} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontWeight: "600", fontSize: 15 }}>{x.title}</Text>
            <Text style={{ color: c.textMuted, fontSize: 13, marginTop: 2 }}>{x.sub}</Text>
          </View>
        </Row>
      ))}
      {b.allowAddNew && <Text style={{ color: c.accent, fontWeight: "600", marginTop: 4 }}>{strings.addBeneficiary}</Text>}
      <ErrorText e={b.error} />
    </View>
  );
}

export function AmountInput({ b, set }: P) {
  const { c, r: radius } = useTheme();
  const [focus, setFocus] = React.useState(false);
  const text = amountText(b.value);
  return (
    <View>
      <Label>{b.label}</Label>
      <View style={{ flexDirection: "row", alignItems: "baseline", borderBottomWidth: 2, borderBottomColor: b.error ? c.negative : focus ? c.accent : c.borderStrong, paddingBottom: 8 }}>
        <Text style={{ fontSize: 20, fontWeight: "500", color: c.textMuted, marginEnd: 8 }}>{symbolOf(b.currency)}</Text>
        <TextInput accessibilityLabel={b.label} value={text} placeholder="0" placeholderTextColor={c.textFaint} keyboardType="number-pad"
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          onChangeText={(t) => set(b.bind, parseAmountText(t))}
          style={[{ flex: 1, fontSize: 40, fontWeight: "600", color: c.text, padding: 0 }, tab, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null]} />
      </View>
      {b.helper ? <Text style={[{ color: c.textMuted, fontSize: 13, marginTop: 8 }, tab]}>{b.helper}</Text> : null}
      {quickAmounts(b as any).length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 }} accessibilityRole="radiogroup">
          {quickAmounts(b as any).map((q) => (
            <Pressable key={q.value} accessibilityRole="radio" accessibilityState={{ selected: q.selected }} accessibilityLabel={q.aria} onPress={() => set(b.bind, q.value)}
              style={({ pressed }) => ({ minWidth: 64, minHeight: 40, paddingHorizontal: 16, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: q.selected ? c.accent2 : c.surface, borderWidth: 1, borderColor: q.selected ? c.accent2 : c.border, opacity: pressed ? 0.85 : 1 })}>
              <Text style={[{ color: q.selected ? "#fff" : c.text, fontWeight: "700", fontSize: 15 }, tab]}>{q.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <ErrorText e={b.error} />
    </View>
  );
}

export function SelectChips({ b, set }: P) {
  const { c, r: radius } = useTheme();
  const { tiles, rows, choices } = selectChoices(b as any);
  if (rows) {
    return (
      <View accessibilityRole="radiogroup">
        {b.label ? <Text style={{ fontSize: 13, color: c.textMuted, marginBottom: 4 }}>{b.label}</Text> : null}
        {choices.map((o) => (
          <Pressable key={o.id} accessibilityRole="radio" accessibilityState={{ selected: o.selected }} accessibilityLabel={o.name} onPress={() => set(b.bind, o.id)}
            style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontWeight: "600", fontSize: 15 }}>{o.name}</Text>
              {o.sub ? <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 2 }}>{o.sub}</Text> : null}
            </View>
            <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: o.selected ? c.accent : c.borderStrong, alignItems: "center", justifyContent: "center" }}>
              {o.selected ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.accent }} /> : null}
            </View>
          </Pressable>
        ))}
        <ErrorText e={b.error} />
      </View>
    );
  }
  if (tiles) {
    return (
      <View>
        <Label>{b.label}</Label>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }} accessibilityRole="radiogroup">
          {choices.map((o) => {
            const on = o.selected;
            const tint = o.color ?? c.accent;
            return (
              <Pressable key={o.id} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={o.name} onPress={() => set(b.bind, o.id)}
                style={({ pressed }) => ({ width: "47%", flexGrow: 1, padding: 14, borderRadius: radius.lg, gap: 10, backgroundColor: c.surface, borderWidth: 2, borderColor: on ? c.accent2 : c.border, opacity: pressed ? 0.88 : 1 })}>
                {o.icon ? <IconTile icon={o.icon} color={on ? c.accent2 : c.accent} bg={on ? c.accent2Soft : c.accentSoft} size={40} />
                  : <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: tint, alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>{o.letter}</Text></View>}
                <View><Text style={{ color: c.text, fontWeight: "700", fontSize: 15 }}>{o.name}</Text>{o.sub ? <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 2 }}>{o.sub}</Text> : null}</View>
                {on ? <View style={{ position: "absolute", top: 10, right: 10, width: 22, height: 22, borderRadius: 11, backgroundColor: c.accent2, alignItems: "center", justifyContent: "center" }}><Icon name="check" size={13} color="#fff" stroke={3} /></View> : null}
              </Pressable>
            );
          })}
        </View>
        <ErrorText e={b.error} />
      </View>
    );
  }
  return (
    <View>
      <Label>{b.label}</Label>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }} accessibilityRole="radiogroup">
        {choices.map((o) => {
          const on = o.selected;
          return (
            <Pressable key={o.id} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => set(b.bind, o.id)}
              style={{ paddingHorizontal: 14, minHeight: 40, paddingVertical: 6, borderRadius: radius.pill, justifyContent: "center", borderWidth: on ? 2 : 1, borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accentSoft : c.surface }}>
              <Text style={{ color: on ? c.accent : c.text, fontWeight: "500", fontSize: 14 }}>{o.name}</Text>
            </Pressable>
          );
        })}
      </View>
      <ErrorText e={b.error} />
    </View>
  );
}

export function TextField({ b, set, lang }: P) {
  const { c, r: radius, look } = useTheme();
  const outlined = look?.fields === "outlined";
  const [focus, setFocus] = React.useState(false);
  const [shown, setShown] = React.useState(false);
  const kb = ({ number: "number-pad", phone: "phone-pad", email: "email-address", default: "default" } as const)[keyboardKind(b.keyboard)];
  return (
    <View>
      {outlined ? null : <Label>{b.label}</Label>}
      <View>
        <TextInput accessibilityLabel={b.label} value={String(b.value ?? "")} placeholder={outlined ? b.placeholder ?? b.label : b.placeholder} placeholderTextColor={c.textFaint} keyboardType={kb} secureTextEntry={!!b.secure && !shown} textContentType={b.secure ? "none" : undefined} autoComplete={b.secure ? "off" : undefined} importantForAutofill={b.secure ? "no" : undefined}
          autoCapitalize="none" autoCorrect={false} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} onChangeText={(t) => set(b.bind, t)}
          style={[{ height: outlined ? 50 : 52, borderRadius: outlined ? 10 : radius.md, borderWidth: focus || b.error ? 2 : 1, borderColor: b.error ? c.negative : focus ? c.accent : c.borderStrong, backgroundColor: c.surface, paddingStart: 14, paddingEnd: b.secure ? (outlined ? 48 : 64) : 14, fontSize: 16, color: c.text }, tab, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null]} />
        {b.secure ? <Pressable accessibilityRole="button" accessibilityLabel={shown ? ui(lang, "hide") : ui(lang, "show")} onPress={() => setShown(!shown)} hitSlop={8} style={{ position: "absolute", end: 14, top: 0, bottom: 0, justifyContent: "center" }}>{outlined ? <Icon name={shown ? "eyeOff" : "eye"} size={20} color={c.textMuted} /> : <Text style={{ color: c.accent, fontWeight: "700", fontSize: 13 }}>{shown ? ui(lang, "hide") : ui(lang, "show")}</Text>}</Pressable> : null}
      </View>
      <ErrorText e={b.error} />
    </View>
  );
}

export function Toggle({ b, set, press }: P) {
  const { c } = useTheme();
  const on = b.value === true;
  const toggle = (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={b.label} onPress={() => set(b.bind, !on)} style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontSize: 15, fontWeight: "600" }}>{b.label}</Text>
        {b.helper ? <Text style={{ color: c.textMuted, fontSize: 13, marginTop: 2 }}>{b.helper}</Text> : null}
      </View>
      <View style={{ width: 50, height: 30, borderRadius: 15, padding: 3, backgroundColor: on ? c.accent2 : c.borderStrong, alignItems: on ? "flex-end" : "flex-start", justifyContent: "center" }}>
        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#fff" }} />
      </View>
    </Pressable>
  );
  if (!b.link) return toggle;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <Pressable accessibilityRole="link" accessibilityLabel={b.link.label} onPress={() => press(b.link.actions)} hitSlop={8}><Text style={{ color: c.accent, fontSize: 13, fontWeight: "600" }}>{b.link.label}</Text></Pressable>
      {toggle}
    </View>
  );
}

export function CardForm({ b, set, lang }: P) {
  const { c, r: radius } = useTheme();
  const [focus, setFocus] = React.useState<string | null>(null);
  const fields = cardFields(b as any, lang);
  const value = (k: string) => fields.find((f) => f.key === k)!.value;
  const field = (f: (typeof fields)[number]) => (
    <View style={{ flex: 1 }} key={f.key}>
      <Label>{f.label}</Label>
      <TextInput accessibilityLabel={f.label} value={f.show(f.value)} placeholder={f.placeholder} placeholderTextColor={c.textFaint} keyboardType={f.numeric ? "number-pad" : "default"} maxLength={f.max}
        secureTextEntry={f.secure} autoCapitalize={f.caps ? "characters" : "none"} autoCorrect={false} onFocus={() => setFocus(f.key)} onBlur={() => setFocus(null)}
        onChangeText={(t) => set(`${b.bind}.${f.key}`, f.clean(t))}
        style={[{ height: 52, borderRadius: radius.md, borderWidth: focus === f.key || f.error ? 2 : 1, borderColor: f.error ? c.negative : focus === f.key ? c.accent : c.borderStrong, backgroundColor: c.surface, paddingHorizontal: 14, fontSize: 16, color: c.text }, tab, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null]} />
      <ErrorText e={f.error} />
    </View>
  );
  const [number, holder, expiry, cvv] = fields as [(typeof fields)[number], (typeof fields)[number], (typeof fields)[number], (typeof fields)[number]];
  return (
    <View style={{ gap: 16 }}>
      <CardVisual number={value("number")} holder={value("holder").toUpperCase()} expiry={value("expiry")} network={cardNetwork(value("number"))} />
      {field(number)}
      {field(holder)}
      <View style={{ flexDirection: "row", gap: 12 }}>{field(expiry)}{field(cvv)}</View>
    </View>
  );
}

export function Alert({ b }: P) {
  const { c, r: radius } = useTheme();
  const tone = { warning: [c.warningBg, c.warning], error: [c.negativeBg, c.negative], success: [c.positiveBg, c.positive], info: [c.infoBg, c.info] }[b.tone as string] ?? [c.infoBg, c.info];
  return <View accessibilityRole="alert" style={{ backgroundColor: tone[0], padding: 14, borderRadius: radius.md }}><Text style={{ color: tone[1], fontSize: 14, lineHeight: 20 }}>{b.text}</Text></View>;
}

export function ReviewSummary({ b }: P) {
  const { c, r: radius } = useTheme();
  return (
    <View style={{ borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, borderRadius: radius.lg, paddingHorizontal: 16 }}>
      {b.rows.map((r: any, i: number) => (
        <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 14, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
          <Text style={{ color: c.textMuted, fontSize: 14 }}>{r.label}</Text>
          <Text style={[{ color: c.text, fontSize: 14, fontWeight: "600" }, tab]}>{r.value}</Text>
        </View>
      ))}
    </View>
  );
}

export function Consent({ b, set }: P) {
  const { c, r: radius } = useTheme();
  const on = b.value === true;
  return (
    <View>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => set(b.bind, !on)} style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: on ? c.accent : c.borderStrong, backgroundColor: on ? c.accent : "transparent", alignItems: "center", justifyContent: "center", marginEnd: 12 }}>
          {on ? <Text style={{ color: c.accentOn, fontWeight: "700", fontSize: 14 }}>✓</Text> : null}
        </View>
        <Text style={{ flex: 1, color: c.text, fontSize: 15, lineHeight: 22 }}>{b.text}</Text>
      </Pressable>
      <ErrorText e={b.error} />
    </View>
  );
}

/** A code typed on the bank's own number pad: dashes that fill in, then three keys across. The device keyboard is not used. */
function KeypadCode({ b, set, lang }: P) {
  const { c } = useTheme();
  const v = String(b.value ?? "");
  return (
    <View>
      {b.hint ? <Text style={{ color: c.text, fontSize: 14, textAlign: "center", marginBottom: 28, lineHeight: 20 }}>{b.hint}</Text> : null}
      <View accessibilityLabel={otpLabel(lang, b.length)} style={{ flexDirection: "row", justifyContent: "center", gap: 10, direction: "ltr" as any }}>
        {otpCells(v, b.length, !!b.masked).map((cell, i) => (
          <View key={i} style={{ width: 36, alignItems: "center" }}>
            <Text style={[{ height: 28, fontSize: 22, fontWeight: "600", color: c.text }, tab]}>{cell.char}</Text>
            <View style={{ height: 2, width: "100%", backgroundColor: cell.active ? c.accent : c.borderStrong }} />
          </View>
        ))}
      </View>
      <ErrorText e={b.error} />
      <View style={{ marginTop: 32, gap: 10, direction: "ltr" as any }}>
        {KEYPAD_ROWS.map((row, ri) => (
          <View key={ri} style={{ flexDirection: "row", justifyContent: "center", gap: 14 }}>
            {row.map((k, ki) => k === "" ? <View key={ki} style={{ width: 84, height: 40 }} /> : (
              <Pressable key={ki} accessibilityRole="button" accessibilityLabel={k === "back" ? ui(lang, "back") : k} onPress={() => set(b.bind, applyKey(v, k, b.length))}
                style={({ pressed }) => ({ width: 84, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? mix(c.accent, c.surface, 0.8) : c.surfaceMuted })}>
                {k === "back" ? <Icon name="backspace" size={20} color={c.textMuted} /> : <Text style={[{ fontSize: 18, fontWeight: "600", color: c.text }, tab]}>{k}</Text>}
              </Pressable>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

export function Otp({ b, set, lang }: P) {
  const { c, r: radius } = useTheme();
  const ref = React.useRef<React.ComponentRef<typeof TextInput>>(null);
  const v = String(b.value ?? "");
  if (b.keypad) return <KeypadCode b={b} set={set} press={() => {}} busy={false} lang={lang} strings={{}} />;
  return (
    <View>
      {b.hint ? <Text style={{ color: c.textMuted, fontSize: 14, marginBottom: 16, lineHeight: 20 }}>{b.hint}</Text> : null}
      <Pressable onPress={() => ref.current?.focus()} accessibilityLabel={otpLabel(lang, b.length)}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", direction: "ltr" as any }}>
          {otpCells(v, b.length).map((cell, i) => (
            <View key={i} style={{ width: 46, height: 56, borderRadius: radius.md, borderWidth: cell.active ? 2 : 1, borderColor: b.error ? c.negative : cell.active ? c.accent : c.borderStrong, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" }}>
              <Text style={[{ fontSize: 24, fontWeight: "600", color: c.text }, tab]}>{cell.char}</Text>
            </View>
          ))}
        </View>
        <TextInput ref={ref} autoFocus value={v} keyboardType="number-pad" maxLength={b.length} textContentType="oneTimeCode" autoComplete="one-time-code"
          onChangeText={(t) => set(b.bind, cleanOtp(t))}
          style={{ position: "absolute", opacity: 0, width: "100%", height: "100%" }} />
      </Pressable>
      <ErrorText e={b.error} />
    </View>
  );
}

export function Result({ b }: P) {
  const { c, r: radius } = useTheme();
  const ok = b.tone === "success";
  return (
    <View style={{ alignItems: "center", paddingTop: 32 }}>
      <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: ok ? c.positiveBg : c.negativeBg, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 40, color: ok ? c.positive : c.negative }}>{ok ? "✓" : "!"}</Text>
      </View>
      <Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: "600", color: c.text, marginTop: 20, textAlign: "center" }}>{b.title}</Text>
      {b.text ? <Text style={{ color: c.textMuted, fontSize: 15, marginTop: 8, textAlign: "center", lineHeight: 22 }}>{b.text}</Text> : null}
      {b.meta ? <Text style={{ marginTop: 14, paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: c.surfaceMuted, color: c.textMuted, fontSize: 12, fontFamily: Platform.OS === "web" ? "ui-monospace, Menlo, monospace" : undefined }}>{b.meta}</Text> : null}
    </View>
  );
}

export function TextBlock({ b }: P) {
  const { c, r: radius } = useTheme();
  const big = b.variant === "title";
  return <Text style={{ color: big ? c.text : c.textMuted, fontSize: big ? 24 : 15, fontWeight: big ? "600" : "400", lineHeight: big ? 30 : 22 }}>{b.text}</Text>;
}

export function Button({ b, press, busy, strings }: P) {
  const { c, r: radius, look } = useTheme();
  const bar = look?.chrome === "bar";
  const primary = (b.variant ?? "primary") === "primary";
  const label = busy ? strings.wait : b.label;
  // An explicit label keeps screen readers announcing the button's name. Without one, React Native on Android
  // leaves the description "busy" behind after the button has been busy once.
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ busy, disabled: busy }} onPress={() => press(b.actions)}
      style={({ pressed }) => ({ minHeight: bar ? 48 : 54, paddingVertical: 8, borderRadius: bar ? 8 : radius.lg, alignItems: "center", justifyContent: "center", backgroundColor: primary ? (bar ? look?.bar ?? c.accent : c.accent) : "transparent", borderWidth: primary ? 0 : 1, borderColor: bar ? look?.bar ?? c.accent : c.borderStrong, opacity: busy ? 0.6 : pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] })}>
      <Text style={{ color: primary ? c.accentOn : bar ? look?.bar ?? c.accent : c.text, fontSize: 16, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

/** The bank's banner: its logo (or its name) on the accent colour. The player draws the sheet that overlaps its bottom edge. */
export function Hero({ b }: P) {
  const { c, look, brand } = useTheme();
  return (
    <View accessibilityRole="header" style={{ backgroundColor: look?.bar ?? c.accent, height: 200, alignItems: "center", justifyContent: "center" }}>
      {look?.logo ? <Image accessibilityLabel={brand} source={{ uri: look.logo }} resizeMode="contain" style={{ width: 230, height: 70 }} />
        : <Text style={{ color: c.accentOn, fontSize: 26, fontWeight: "700" }}>{brand}</Text>}
    </View>
  );
}

/** A heading with a link on the same row ("Welcome" … "English ⌄"). */
export function SectionHeader({ b, press }: P) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text accessibilityRole="header" style={{ fontSize: 16, fontWeight: "700", color: c.text }}>{b.title}</Text>
      {b.action ? (
        <Pressable accessibilityRole="button" onPress={() => press(b.action.actions)} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text style={{ fontSize: 13, color: c.text }}>{b.action.label}</Text><Icon name="chevronDown" size={14} color={c.text} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Icon buttons in a row, for the shortcuts at the foot of a sign-in screen. */
export function Shortcuts({ b, press }: P) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-around", paddingVertical: 4 }}>
      {b.items.map((it: any) => (
        <Pressable key={it.id} accessibilityRole="button" accessibilityLabel={it.label} onPress={() => press(it.actions)} style={{ alignItems: "center", gap: 8, minWidth: 88 }}>
          <View style={{ width: 50, height: 50, borderRadius: 14, backgroundColor: mix(c.accent, "#000000", 0.35), alignItems: "center", justifyContent: "center" }}>
            {it.icon ? <Icon name={it.icon} size={22} color="#FFFFFF" /> : null}
          </View>
          <Text style={{ fontSize: 12, fontWeight: "500", color: c.text }}>{it.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Rows that each do something when tapped, with an icon, a title, a chevron and an optional line of help below. */
export function Menu({ b, press }: P) {
  const { c, r: radius, layoutRtl } = { ...useTheme(), layoutRtl: false };
  return (
    <View style={{ gap: 14 }}>
      {b.items.map((it: any) => (
        <View key={it.id}>
          <Pressable accessibilityRole="button" accessibilityLabel={it.label} onPress={() => press(it.actions)}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, minHeight: 54, borderRadius: 10, borderWidth: 1, borderColor: c.border, backgroundColor: pressed ? c.surfaceMuted : c.surface })}>
            {it.icon ? <Icon name={it.icon} size={22} color={c.textMuted} /> : null}
            <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: c.text }}>{it.label}</Text>
            <Icon name="chevronRight" size={18} color={c.text} />
          </Pressable>
          {it.text ? <Text style={{ fontSize: 11, color: c.textMuted, marginTop: 6, marginStart: 4 }}>{it.text}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", padding: 14, marginBottom: 10 },
});
export const registry: Record<BlockType, (p: P) => React.ReactElement | null> = {
  accountPicker: AccountPicker, beneficiaryPicker: BeneficiaryPicker, amountInput: AmountInput, select: SelectChips, textInput: TextField,
  alert: Alert, toggle: Toggle, cardForm: CardForm, reviewSummary: ReviewSummary, consent: Consent, otp: Otp, result: Result, text: TextBlock, button: Button, stepper: () => null, hero: Hero, sectionHeader: SectionHeader, shortcuts: Shortcuts, menu: Menu,
};
export { space };
