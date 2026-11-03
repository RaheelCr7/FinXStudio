import { Alert as KitAlert, AmountField, Button as KitButton, Accordion as KitAccordion, Dialog as KitDialog, MapPins as KitMapPins, BalanceList as KitBalanceList, Checkbox, ChoiceGroup, CodeInput, Divider as KitDivider, Hero as KitHero, Keypad as KitKeypad, ListRow as KitListRow, PinDots as KitPinDots, Result as KitResult, SectionHeader as KitSectionHeader, Shortcuts as KitShortcuts, SummaryList, Switch, TextField as KitTextField } from "@finx/components/native";
import React from "react";
import { Image, Pressable, Text, TextInput, View, StyleSheet, Platform } from "react-native";
import { mix, space } from "@finx/ui-kit";
import { accountRows, amountText, typedAmount, applyKey, beneficiaryRows, cardFields, cardNetwork, cleanOtp, keyboardKind, KEYPAD_ROWS, otpCells, otpLabel, parseAmountText, prefixOf, quickAmounts, selectChoices, symbolOf, ui, type BlockProps, type BlockType } from "@finx/renderer-core";
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

const toOptions = (rows: ReturnType<typeof accountRows>) => rows.map((r) => ({ id: r.id, title: r.title, sub: r.sub, selected: r.selected, label: r.label, avatar: r.avatar, round: r.round }));

export function AccountPicker({ b, set, strings }: P) {
  return <ChoiceGroup label={strings.account!} name={b.bind} look="cards" options={toOptions(accountRows(b as any))} onChange={(id) => set(b.bind, id)} error={b.error} />;
}

export function BeneficiaryPicker({ b, set, strings }: P) {
  return <ChoiceGroup label={strings.payTo!} name={b.bind} look="cards" options={toOptions(beneficiaryRows(b as any))} onChange={(id) => set(b.bind, id)} error={b.error} footer={b.allowAddNew ? strings.addBeneficiary : undefined} />;
}

export function AmountInput({ b, set, lang }: P) {
  const decimals: number = b.decimals ?? 0;
  const [text, setText] = React.useState(() => amountText(b.value, decimals));
  // what is typed stays as typed ("12." while more digits are coming); a change from outside, such as a quick amount, replaces it
  React.useEffect(() => { if (typedAmount(text, decimals).value !== (b.value == null || b.value === "" ? undefined : Number(b.value))) setText(amountText(b.value, decimals)); }, [b.value, decimals]); // eslint-disable-line react-hooks/exhaustive-deps
  const type = (t: string) => { const r = typedAmount(t, decimals); setText(r.text); set(b.bind, r.value); };
  return <AmountField label={b.label} symbol={symbolOf(b.currency)} decimals={decimals} value={text} onChange={type} helper={b.helper} error={b.error} quick={quickAmounts(b as any)} onQuick={(v) => set(b.bind, v)} quickLabel={ui(lang, "quickAmounts")} />;
}

export function SelectChips({ b, set }: P) {
  const { tiles, rows, choices } = selectChoices(b as any);
  return <ChoiceGroup label={b.label} name={b.bind} look={rows ? "rows" : tiles ? "tiles" : "chips"} options={choices.map((o) => ({ id: o.id, title: o.name, sub: o.sub, selected: o.selected, icon: o.icon, color: o.color }))} onChange={(id) => set(b.bind, id)} error={b.error} />;
}

export function TextField({ b, set, lang }: P) {
  const outlined = useTheme().look?.fields === "outlined";
  return (
    <KitTextField label={b.label} value={String(b.value ?? "")} onChange={(t) => set(b.bind, t)} look={outlined ? "outlined" : "standard"} placeholder={b.placeholder} error={b.error} secure={!!b.secure} lines={b.lines}
      keyboard={keyboardKind(b.keyboard)} strings={{ show: ui(lang, "show"), hide: ui(lang, "hide") }} />
  );
}

export function Toggle({ b, set, press }: P) {
  return <Switch label={b.label} helper={b.helper} checked={b.value === true} onChange={(v) => set(b.bind, v)} link={b.link ? { label: b.link.label, onPress: () => press(b.link.actions) } : undefined} />;
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
  return <KitAlert tone={b.tone} text={b.text} />;
}

export function ReviewSummary({ b }: P) {
  return <SummaryList rows={b.rows} />;
}

export function Consent({ b, set }: P) {
  return <Checkbox label={b.text} checked={b.value === true} onChange={(v) => set(b.bind, v)} error={b.error} />;
}

/** A code typed on the bank's own number pad: dashes that fill in, then three keys across. The device keyboard is not used. */
function KeypadCode({ b, set, lang }: P) {
  const { c } = useTheme();
  const v = String(b.value ?? "");
  return (
    <View>
      {b.hint ? <Text style={{ color: c.text, fontSize: 14, textAlign: "center", marginBottom: 28, lineHeight: 20 }}>{b.hint}</Text> : null}
      <KitPinDots length={b.length} filled={v.length} masked={!!b.masked} digits={v} label={otpLabel(lang, b.length)} />
      <ErrorText e={b.error} />
      <View style={{ marginTop: 32 }}>
        <KitKeypad labels={{ back: ui(lang, "back") }} onKey={(k) => set(b.bind, applyKey(v, k, b.length))} />
      </View>
    </View>
  );
}

export function Otp({ b, set, lang }: P) {
  if (b.keypad) return <KeypadCode b={b} set={set} press={() => {}} busy={false} lang={lang} strings={{}} />;
  return <CodeInput label={otpLabel(lang, b.length)} length={b.length} value={String(b.value ?? "")} onChange={(t) => set(b.bind, cleanOtp(t))} hint={b.hint} error={b.error} />;
}

export function Result({ b }: P) {
  return <KitResult tone={b.tone === "success" ? "success" : "error"} title={b.title} text={b.text} meta={b.meta} />;
}

export function TextBlock({ b }: P) {
  const { c, r: radius } = useTheme();
  const big = b.variant === "title";
  return <Text style={{ color: big ? c.text : c.textMuted, fontSize: big ? 24 : 15, fontWeight: big ? "600" : "400", lineHeight: big ? 30 : 22 }}>{b.text}</Text>;
}

export function Button({ b, press, busy, strings }: P) {
  return <KitButton label={busy ? strings.wait : b.label} variant={(b.variant ?? "primary") === "primary" ? "primary" : "secondary"} busy={busy} onPress={() => press(b.actions)} />;
}

export function Hero(_: P) {
  const { look, brand } = useTheme();
  return <KitHero name={brand} logo={look?.logo} />;
}

export function SectionHeader({ b, press }: P) {
  return <KitSectionHeader title={b.title} subtitle={b.subtitle || undefined} action={b.action ? { label: b.action.label, onPress: () => press(b.action.actions) } : undefined} />;
}

export function Shortcuts({ b, press }: P) {
  return <KitShortcuts items={b.items.map((it: any) => ({ id: it.id, label: it.label, icon: it.icon, onPress: () => press(it.actions) }))} />;
}

export const Divider = ({ b }: P) => <KitDivider label={b.label || undefined} />;
export const BalanceListBlock = ({ b }: P) => <KitBalanceList rows={b.rows} />;
export const AccordionBlock = ({ b }: P) => <KitAccordion items={b.items} />;

/** A pop-up: its buttons run their actions, a PIN field (when the block has one) saves into its bind path. */
export function DialogBlock({ b, set, press, lang }: P) {
  return (
    <KitDialog title={b.title} text={b.text} icon={b.icon} actions={b.buttons.map((x: any, i: number) => ({ id: String(i), label: x.label, variant: x.variant ?? (i === b.buttons.length - 1 ? "primary" : "secondary"), onPress: () => press(x.actions) }))}>
      {b.bind ? <CodeInput label={otpLabel(lang, b.length ?? 6)} length={b.length ?? 6} value={String(b.value ?? "")} onChange={(t) => set(b.bind, cleanOtp(t))} error={b.error} /> : null}
    </KitDialog>
  );
}

/** The places of a list as pins; pressing one saves it and runs the block's actions. */
export const MapBlock = ({ b, press }: P) => <KitMapPins label={b.label} pins={b.pins} selected={b.selected} height={b.height} onSelect={(id) => press(b.pins.find((p: any) => p.id === id)?.actions ?? [])} />;

/** Rows that each do something when tapped, with an icon, a title, a chevron and an optional line of help below. */
export function Menu({ b, press }: P) {
  return (
    <View style={{ gap: 14 }}>
      {b.items.map((it: any) => <KitListRow key={it.id} label={it.label} text={it.text} icon={it.icon} onPress={() => press(it.actions)} />)}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", padding: 14, marginBottom: 10 },
});
export const registry: Record<BlockType, (p: P) => React.ReactElement | null> = {
  accountPicker: AccountPicker, beneficiaryPicker: BeneficiaryPicker, amountInput: AmountInput, select: SelectChips, textInput: TextField,
  alert: Alert, toggle: Toggle, cardForm: CardForm, reviewSummary: ReviewSummary, consent: Consent, otp: Otp, result: Result, text: TextBlock, button: Button, stepper: () => null, hero: Hero, sectionHeader: SectionHeader, shortcuts: Shortcuts, menu: Menu, divider: Divider, accordion: AccordionBlock, dialog: DialogBlock, map: MapBlock, balanceList: BalanceListBlock,
};
export { space };
