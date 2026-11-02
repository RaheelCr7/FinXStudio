import React from "react";
import { Pressable, Text, TextInput, View, StyleSheet, Platform } from "react-native";
import { space, formatMoney } from "@finx/ui-kit";
import { useTheme } from "./theme";
import { CardVisual, Icon, IconTile } from "./widgets";

type P = { b: Record<string, any>; set: (path: string, v: any) => void; press: (actions: any[]) => void; busy: boolean; lang: string; strings: Record<string, string> };
const tab = { fontVariant: ["tabular-nums" as const] };
/** "$" for USD, "PKR" for PKR: the short form people expect in front of an amount. */
const symbolOf = (currency: string) => {
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency, currencyDisplay: "narrowSymbol" }).formatToParts(0).find((p) => p.type === "currency")?.value ?? currency; } catch { return currency; }
};

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
const initials = (n: string) => n.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();

export function AccountPicker({ b, set, strings }: P) {
  const { c, r: radius } = useTheme();
  return (
    <View accessibilityRole="radiogroup">
      <Label>{strings.account}</Label>
      {b.items.map((a: any) => (
        <Row key={a.id} label={`${a.name} ${a.maskedNumber}`} selected={b.value === a.id} onPress={() => set(b.bind, a.id)}>
          <Avatar text={a.name.slice(0, 2).toUpperCase()} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontWeight: "600", fontSize: 15 }}>{a.name} {a.maskedNumber}</Text>
            {b.showBalance && <Text style={[{ color: c.textMuted, fontSize: 13, marginTop: 2 }, tab]}>{formatMoney(a.balance, a.currency)}</Text>}
          </View>
        </Row>
      ))}
      <ErrorText e={b.error} />
    </View>
  );
}

export function BeneficiaryPicker({ b, set, strings }: P) {
  const { c, r: radius } = useTheme();
  return (
    <View accessibilityRole="radiogroup">
      <Label>{strings.payTo}</Label>
      {b.items.map((x: any) => (
        <Row key={x.id} label={x.displayName} selected={b.value === x.id} onPress={() => set(b.bind, x.id)}>
          <Avatar round text={initials(x.displayName)} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontWeight: "600", fontSize: 15 }}>{x.displayName}</Text>
            <Text style={{ color: c.textMuted, fontSize: 13, marginTop: 2 }}>{x.bank} · {x.maskedNumber}</Text>
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
  const text = b.value ? Number(b.value).toLocaleString("en-US") : "";
  return (
    <View>
      <Label>{b.label}</Label>
      <View style={{ flexDirection: "row", alignItems: "baseline", borderBottomWidth: 2, borderBottomColor: b.error ? c.negative : focus ? c.accent : c.borderStrong, paddingBottom: 8 }}>
        <Text style={{ fontSize: 20, fontWeight: "500", color: c.textMuted, marginEnd: 8 }}>{symbolOf(b.currency)}</Text>
        <TextInput accessibilityLabel={b.label} value={text} placeholder="0" placeholderTextColor={c.textFaint} keyboardType="number-pad"
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          onChangeText={(t) => { const n = parseInt(t.replace(/[^0-9]/g, ""), 10); set(b.bind, isNaN(n) ? undefined : n); }}
          style={[{ flex: 1, fontSize: 40, fontWeight: "600", color: c.text, padding: 0 }, tab, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null]} />
      </View>
      {b.helper ? <Text style={[{ color: c.textMuted, fontSize: 13, marginTop: 8 }, tab]}>{b.helper}</Text> : null}
      {b.quickAmounts?.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 }} accessibilityRole="radiogroup">
          {b.quickAmounts.map((q: number) => {
            const on = Number(b.value) === q;
            return (
              <Pressable key={q} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${symbolOf(b.currency)}${q}`} onPress={() => set(b.bind, q)}
                style={({ pressed }) => ({ minWidth: 64, minHeight: 40, paddingHorizontal: 16, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: on ? c.accent2 : c.surface, borderWidth: 1, borderColor: on ? c.accent2 : c.border, opacity: pressed ? 0.85 : 1 })}>
                <Text style={[{ color: on ? "#fff" : c.text, fontWeight: "700", fontSize: 15 }, tab]}>{symbolOf(b.currency)}{q.toLocaleString("en-US")}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <ErrorText e={b.error} />
    </View>
  );
}

export function SelectChips({ b, set }: P) {
  const { c, r: radius } = useTheme();
  if (b.variant === "tiles") {
    return (
      <View>
        <Label>{b.label}</Label>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }} accessibilityRole="radiogroup">
          {b.items.map((o: { id: string; name: string; color?: string; icon?: string; sub?: string }) => {
            const on = b.value === o.id;
            const tint = o.color ?? c.accent;
            return (
              <Pressable key={o.id} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={o.name} onPress={() => set(b.bind, o.id)}
                style={({ pressed }) => ({ width: "47%", flexGrow: 1, padding: 14, borderRadius: radius.lg, gap: 10, backgroundColor: c.surface, borderWidth: 2, borderColor: on ? c.accent2 : c.border, opacity: pressed ? 0.88 : 1 })}>
                {o.icon ? <IconTile icon={o.icon} color={on ? c.accent2 : c.accent} bg={on ? c.accent2Soft : c.accentSoft} size={40} />
                  : <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: tint, alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>{o.name.slice(0, 1)}</Text></View>}
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
        {b.items.map((o: { id: string; name: string }) => {
          const on = b.value === o.id;
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

export function TextField({ b, set }: P) {
  const { c, r: radius } = useTheme();
  const [focus, setFocus] = React.useState(false);
  const [shown, setShown] = React.useState(false);
  const kb = b.keyboard === "number" ? "number-pad" : b.keyboard === "phone" ? "phone-pad" : b.keyboard === "email" ? "email-address" : "default";
  return (
    <View>
      <Label>{b.label}</Label>
      <View>
        <TextInput accessibilityLabel={b.label} value={String(b.value ?? "")} placeholder={b.placeholder} placeholderTextColor={c.textFaint} keyboardType={kb} secureTextEntry={!!b.secure && !shown}
          autoCapitalize="none" autoCorrect={false} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} onChangeText={(t) => set(b.bind, t)}
          style={[{ height: 52, borderRadius: radius.md, borderWidth: focus || b.error ? 2 : 1, borderColor: b.error ? c.negative : focus ? c.accent : c.borderStrong, backgroundColor: c.surface, paddingStart: 14, paddingEnd: b.secure ? 64 : 14, fontSize: 16, color: c.text }, tab, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null]} />
        {b.secure ? <Pressable accessibilityRole="button" accessibilityLabel={shown ? "Hide" : "Show"} onPress={() => setShown(!shown)} hitSlop={8} style={{ position: "absolute", end: 14, top: 0, bottom: 0, justifyContent: "center" }}><Text style={{ color: c.accent, fontWeight: "700", fontSize: 13 }}>{shown ? "Hide" : "Show"}</Text></Pressable> : null}
      </View>
      <ErrorText e={b.error} />
    </View>
  );
}

export function Toggle({ b, set }: P) {
  const { c } = useTheme();
  const on = b.value === true;
  return (
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
}

const groupCard = (digits: string) => (digits.match(/.{1,4}/g) ?? []).join(" ");
const expiryText = (raw: string) => { const d = raw.replace(/\D/g, "").slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; };

export function CardForm({ b, set }: P) {
  const { c, r: radius } = useTheme();
  const v = (b.value ?? {}) as Record<string, string>;
  const [focus, setFocus] = React.useState<string | null>(null);
  const field = (key: "number" | "holder" | "expiry" | "cvv", label: string, o: { placeholder: string; keyboard?: "number-pad" | "default"; format?: (t: string) => string; clean?: (t: string) => string; max?: number; secure?: boolean; caps?: boolean }) => {
    const err = b.errors?.[key];
    const raw = String(v[key] ?? "");
    return (
      <View style={{ flex: 1 }} key={key}>
        <Label>{label}</Label>
        <TextInput accessibilityLabel={label} value={o.format ? o.format(raw) : raw} placeholder={o.placeholder} placeholderTextColor={c.textFaint} keyboardType={o.keyboard ?? "default"} maxLength={o.max}
          secureTextEntry={o.secure} autoCapitalize={o.caps ? "characters" : "none"} autoCorrect={false} onFocus={() => setFocus(key)} onBlur={() => setFocus(null)}
          onChangeText={(t) => set(`${b.bind}.${key}`, o.clean ? o.clean(t) : t)}
          style={[{ height: 52, borderRadius: radius.md, borderWidth: focus === key || err ? 2 : 1, borderColor: err ? c.negative : focus === key ? c.accent : c.borderStrong, backgroundColor: c.surface, paddingHorizontal: 14, fontSize: 16, color: c.text }, tab, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null]} />
        <ErrorText e={err} />
      </View>
    );
  };
  return (
    <View style={{ gap: 16 }}>
      <CardVisual number={String(v.number ?? "")} holder={String(v.holder ?? "").toUpperCase()} expiry={String(v.expiry ?? "")} network={String(v.number ?? "").startsWith("4") ? "visa" : "mastercard"} />
      {field("number", "Card number", { placeholder: "1234 5678 9012 3456", keyboard: "number-pad", format: groupCard, clean: (t) => t.replace(/\D/g, "").slice(0, 19), max: 23 })}
      {field("holder", "Name on card", { placeholder: "As shown on the card", caps: true })}
      <View style={{ flexDirection: "row", gap: 12 }}>
        {field("expiry", "Expiry", { placeholder: "MM/YY", keyboard: "number-pad", format: expiryText, clean: (t) => expiryText(t), max: 5 })}
        {field("cvv", "Security code", { placeholder: "123", keyboard: "number-pad", clean: (t) => t.replace(/\D/g, "").slice(0, 4), max: 4, secure: true })}
      </View>
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

export function Otp({ b, set }: P) {
  const { c, r: radius } = useTheme();
  const ref = React.useRef<React.ComponentRef<typeof TextInput>>(null);
  const v = String(b.value ?? "");
  return (
    <View>
      {b.hint ? <Text style={{ color: c.textMuted, fontSize: 14, marginBottom: 16, lineHeight: 20 }}>{b.hint}</Text> : null}
      <Pressable onPress={() => ref.current?.focus()} accessibilityLabel={`One-time code, ${b.length} digits`}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", direction: "ltr" as any }}>
          {Array.from({ length: b.length }).map((_, i) => {
            const active = i === v.length;
            return (
              <View key={i} style={{ width: 46, height: 56, borderRadius: radius.md, borderWidth: active ? 2 : 1, borderColor: b.error ? c.negative : active ? c.accent : c.borderStrong, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" }}>
                <Text style={[{ fontSize: 24, fontWeight: "600", color: c.text }, tab]}>{v[i] ?? ""}</Text>
              </View>
            );
          })}
        </View>
        <TextInput ref={ref} autoFocus value={v} keyboardType="number-pad" maxLength={b.length} textContentType="oneTimeCode" autoComplete="one-time-code"
          onChangeText={(t) => set(b.bind, t.replace(/[^0-9]/g, ""))}
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
  const { c, r: radius } = useTheme();
  const primary = (b.variant ?? "primary") === "primary";
  const label = busy ? strings.wait : b.label;
  // An explicit label keeps screen readers announcing the button's name. Without one, React Native on Android
  // leaves the description "busy" behind after the button has been busy once.
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ busy, disabled: busy }} onPress={() => press(b.actions)}
      style={({ pressed }) => ({ minHeight: 54, paddingVertical: 8, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", backgroundColor: primary ? c.accent : "transparent", borderWidth: primary ? 0 : 1, borderColor: c.borderStrong, opacity: busy ? 0.6 : pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] })}>
      <Text style={{ color: primary ? c.accentOn : c.text, fontSize: 16, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", padding: 14, marginBottom: 10 },
});
export const registry: Record<string, (p: P) => React.ReactElement | null> = {
  accountPicker: AccountPicker, beneficiaryPicker: BeneficiaryPicker, amountInput: AmountInput, select: SelectChips, textInput: TextField,
  alert: Alert, toggle: Toggle, cardForm: CardForm, reviewSummary: ReviewSummary, consent: Consent, otp: Otp, result: Result, text: TextBlock, button: Button, stepper: () => null,
};
export { space };
