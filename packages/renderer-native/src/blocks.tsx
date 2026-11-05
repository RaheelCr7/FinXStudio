import { Alert as KitAlert, AmountField, Button as KitButton, Accordion as KitAccordion, Dialog as KitDialog, DateField as KitDateField, Dropdown as KitDropdown, Avatar as KitAvatar, MapPins as KitMapPins, BalanceList as KitBalanceList, Checkbox, ChoiceGroup, CodeInput, Divider as KitDivider, Hero as KitHero, Keypad as KitKeypad, ListRow as KitListRow, PinDots as KitPinDots, Result as KitResult, SectionHeader as KitSectionHeader, Shortcuts as KitShortcuts, SummaryList, Switch, TextField as KitTextField, StatusChip as KitStatusChip, Timeline as KitTimeline, DataTable as KitDataTable, FileField as KitFileField, DocumentViewer as KitDocumentViewer, SignaturePad as KitSignaturePad, IdCapture as KitIdCapture } from "@finx/components/native";
import React from "react";
import { Image, Pressable, Text, TextInput, View, StyleSheet, Platform, useWindowDimensions } from "react-native";
import { mix, space } from "@finx/ui-kit";
import { accountRows, amountText, typedAmount, applyKey, beneficiaryRows, cardFields, cardNetwork, cleanOtp, keyboardKind, KEYPAD_ROWS, otpCells, otpLabel, parseAmountText, prefixOf, quickAmounts, selectChoices, symbolOf, ui, CARDS_BELOW, dataTableProps, initialTableFor, tableStrings, MIME, TEXT_KINDS, sizeText, fileKindOf, fileMessage, fileProblem, fileValue, nextCapture, type FileKind, type FileValue, type BlockProps, type BlockType, type ChartView, type TableState } from "@finx/renderer-core";
import { useTheme } from "./theme";
import { CardVisual, Donut, Icon, IconTile, LineChart, Segmented } from "./widgets";

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
  if (b.variant === "dropdown") return <SelectDropdown b={b} set={set} />;
  const { tiles, rows, choices } = selectChoices(b as any);
  return <ChoiceGroup label={b.label} name={b.bind} look={rows ? "rows" : tiles ? "tiles" : "chips"} options={choices.map((o) => ({ id: o.id, title: o.name, sub: o.sub, selected: o.selected, icon: o.icon, color: o.color }))} onChange={(id) => set(b.bind, id)} error={b.error} />;
}

function SelectDropdown({ b, set }: Pick<P, "b" | "set">) {
  const outlined = useTheme().look?.fields === "outlined";
  return <KitDropdown label={b.label} options={b.items.map((o: any) => ({ id: o.id, name: o.name, sub: o.sub }))} value={String(b.value ?? "")} onChange={(id) => set(b.bind, id)} look={outlined ? "outlined" : "standard"} error={b.error} />;
}

/** A date with a calendar under the field. The answer is YYYY-MM-DD. */
export function DateInputBlock({ b, set, lang }: P) {
  const outlined = useTheme().look?.fields === "outlined";
  return <KitDateField label={b.label} value={String(b.value ?? "")} onChange={(iso) => set(b.bind, iso)} min={b.min} max={b.max} placeholder={b.placeholder} helper={b.helper} error={b.error} look={outlined ? "outlined" : "standard"} lang={lang}
    strings={{ open: ui(lang, "pickDate"), prevMonth: ui(lang, "prevMonth"), nextMonth: ui(lang, "nextMonth"), prevYear: ui(lang, "prevYear"), nextYear: ui(lang, "nextYear") }} />;
}
export const AvatarBlock = ({ b }: P) => <KitAvatar name={b.name} text={b.text || undefined} />;

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

export const StatusChipBlock = ({ b }: P) => <KitStatusChip {...b.chip} />;

export function TimelineBlock({ b, lang }: P) {
  return <KitTimeline label={b.label || undefined} items={b.entries} strings={{ done: ui(lang, "timelineDone"), current: ui(lang, "timelineCurrent"), upcoming: ui(lang, "timelineUpcoming"), failed: ui(lang, "timelineFailed") }} />;
}

/** A table on a wide screen, a list of cards on a phone. Sort, search, filters and page live here; ticked rows are saved in the journey. */
export function DataTableBlock({ b, set, press, lang }: P) {
  const [width, setWidth] = React.useState(0);
  const { width: screen } = useWindowDimensions();
  const [state, setState] = React.useState<TableState>(() => initialTableFor(b));
  const narrow = (width || screen) < CARDS_BELOW;
  return <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}><KitDataTable {...dataTableProps(b, lang, state, setState, set, press, narrow ? "cards" : "table")} /></View>;
}

/** A line or a ring over a saved list, with the same numbers available as a table. */
export function ChartBlock({ b, lang }: P) {
  const { c } = useTheme();
  const v: ChartView = b.chart;
  const [series, setSeries] = React.useState(0);
  const [ring, setRing] = React.useState<number | null>(null);
  const [asTable, setAsTable] = React.useState(false);
  const s = v.series[Math.min(series, v.series.length - 1)];
  const tones = [c.chart1, c.chart2, c.chart3, c.chart4, c.chart5, c.chart6];
  const total = v.slices.reduce((n, x) => n + x.value, 0);
  return (
    <View accessibilityLabel={b.label} style={{ gap: 12 }}>
      <Label>{b.label}</Label>
      {v.series.length > 1 && b.kind === "line" && !asTable ? <Segmented options={v.series.map((x, i) => ({ id: String(i), label: x.label }))} value={String(series)} onChange={(i) => setSeries(Number(i))} /> : null}
      {asTable ? (
        <KitDataTable label={b.label} columns={v.table.columns.map((x) => ({ key: x.key, label: x.label, align: x.align }))} rows={v.table.rows} layout="table" strings={tableStrings(lang)} />
      ) : b.kind === "donut" ? (
        <>
          <Donut segments={v.slices.map((x) => ({ label: x.label, value: x.value, color: tones[x.tone - 1]! }))} centerTop={ring != null ? v.slices[ring]!.text : v.totalText} centerSub={ring != null ? v.slices[ring]!.label : undefined} selected={ring} onSelect={setRing} size={b.height} />
          {v.slices.map((x, i) => (
            <Pressable key={i} accessibilityRole="button" accessibilityState={{ selected: ring === i }} onPress={() => setRing(ring === i ? null : i)} style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 36, paddingHorizontal: 8, borderRadius: 10, backgroundColor: ring === i ? c.surfaceMuted : "transparent" }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: tones[x.tone - 1] }} />
              <Text style={{ flex: 1, color: c.text, fontSize: 14 }}>{x.label}</Text>
              <Text style={[{ color: c.text, fontSize: 14, fontWeight: "700" }, tab]}>{x.text}</Text>
              {total ? <Text style={[{ color: c.textMuted, fontSize: 12 }, tab]}>{Math.round((x.value / total) * 100)}%</Text> : null}
            </Pressable>
          ))}
        </>
      ) : s ? <LineChart data={s.points} format={(p) => (p as any).text} height={b.height} /> : null}
      {b.table ? <Pressable accessibilityRole="button" accessibilityState={{ selected: asTable }} onPress={() => setAsTable(!asTable)} style={{ alignSelf: "flex-start", paddingHorizontal: 12, minHeight: 36, justifyContent: "center", borderRadius: 999, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.surface }}><Text style={{ color: c.text, fontSize: 13 }}>{ui(lang, asTable ? "chartAsChart" : "chartAsTable")}</Text></Pressable> : null}
    </View>
  );
}

declare const require: (id: string) => any;
/** The phone's file picker (expo-document-picker). Loaded when first used, so a build without it still runs everything else. */
async function pickFile(accept: FileKind[]): Promise<{ name: string; size: number; uri: string } | undefined> {
  const picker = require("expo-document-picker");
  const r = await picker.getDocumentAsync({ type: accept.flatMap((k) => MIME[k]), copyToCacheDirectory: true, multiple: false });
  const a = r.canceled ? undefined : r.assets?.[0];
  return a ? { name: String(a.name), size: Number(a.size ?? 0), uri: String(a.uri) } : undefined;
}

/** A file from the phone's picker. Text files (csv, xml) are read so a bank call can check their rows; the others are kept as a name and a size. */
export function FileUploadBlock({ b, set, lang }: P) {
  const [problem, setProblem] = React.useState<string>();
  const [busy, setBusy] = React.useState(false);
  const accept: FileKind[] = b.accept;
  const file = b.value as FileValue | undefined;
  const pick = async () => {
    setBusy(true);
    try {
      const f = await pickFile(accept);
      if (!f) return;
      const bad = fileProblem(f, accept, b.maxKb);
      if (bad) { setProblem(fileMessage(lang, bad, accept, b.maxKb)); return; }
      setProblem(undefined);
      set(b.bind, fileValue(f, TEXT_KINDS.includes(fileKindOf(f.name)!) ? await (await fetch(f.uri)).text() : undefined));
    } catch { setProblem(fileMessage(lang, "empty", accept, b.maxKb)); }
    finally { setBusy(false); }
  };
  return <KitFileField label={b.label} hint={b.hint} helper={b.helper} error={problem ?? b.error} accept={b.acceptAttr} busy={busy} onPick={pick} onRemove={() => { setProblem(undefined); set(b.bind, undefined); }}
    file={file ? { name: file.name, detail: sizeText(file.size) } : undefined} strings={{ choose: ui(lang, "fileChoose"), replace: ui(lang, "fileReplace"), remove: ui(lang, "fileRemove"), drop: "" }} />;
}

export function DocumentViewerBlock({ b, set, lang }: P) {
  return <KitDocumentViewer title={b.title} paragraphs={b.paragraphs} read={b.value === true} height={b.height} error={b.error} onRead={() => set(b.bind, true)} strings={{ progress: ui(lang, "docProgress"), done: ui(lang, "docRead") }} />;
}

export function SignatureBlock({ b, set, lang }: P) {
  const v = b.value as { mode?: "type" | "draw"; name?: string; path?: string } | undefined;
  const [mode, setMode] = React.useState<"type" | "draw">(v?.mode ?? b.modes[0]);
  const T = (k: string) => ui(lang, k);
  return <KitSignaturePad label={b.label} helper={b.helper} error={b.error} modes={b.modes} mode={mode} onMode={setMode} name={v?.mode === "type" ? v.name : ""} path={v?.mode === "draw" ? v.path : ""}
    onName={(name) => set(b.bind, { mode: "type", name })} onPath={(path, points) => set(b.bind, { mode: "draw", path, points })}
    strings={{ type: T("sigType"), draw: T("sigDraw"), name: T("sigName"), clear: T("sigClear"), pad: T("sigPad"), modes: T("sigModes") }} />;
}

export function IdCaptureBlock({ b, set, lang }: P) {
  return <KitIdCapture label={b.label} error={b.error} steps={b.steps} onCapture={(id) => set(b.bind, nextCapture(b.value, id as any))}
    strings={{ capture: ui(lang, "captureTake"), retake: ui(lang, "captureRetake"), done: ui(lang, "captureDone"), simulated: ui(lang, "captureSim") }} />;
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", padding: 14, marginBottom: 10 },
});
export const registry: Record<BlockType, (p: P) => React.ReactElement | null> = {
  accountPicker: AccountPicker, beneficiaryPicker: BeneficiaryPicker, amountInput: AmountInput, select: SelectChips, textInput: TextField,
  alert: Alert, toggle: Toggle, cardForm: CardForm, reviewSummary: ReviewSummary, consent: Consent, otp: Otp, result: Result, text: TextBlock, button: Button, stepper: () => null, hero: Hero, sectionHeader: SectionHeader, shortcuts: Shortcuts, menu: Menu, divider: Divider, accordion: AccordionBlock, dialog: DialogBlock, dateInput: DateInputBlock, avatar: AvatarBlock, map: MapBlock, balanceList: BalanceListBlock, statusChip: StatusChipBlock, timeline: TimelineBlock, dataTable: DataTableBlock, chart: ChartBlock, fileUpload: FileUploadBlock, documentViewer: DocumentViewerBlock, signature: SignatureBlock, idCapture: IdCaptureBlock,
};
export { space };
