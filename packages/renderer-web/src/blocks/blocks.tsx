"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  accountRows, amountText, typedAmount, applyKey, beneficiaryRows, caretAfterFormat, cardFields, cardNetwork, cleanOtp, keyboardKind, otpCells, otpLabel, parseAmountText,
  quickAmounts, selectChoices, symbolOf, ui, type BlockProps, type BlockType, type PickerRow,
} from "@finx/renderer-core";
import { Alert as KitAlert, AmountField, Button as KitButton, Accordion as KitAccordion, Checkbox, ChoiceGroup, CodeInput, Divider as KitDivider, Hero as KitHero, Keypad, ListRow, PinDots, Result as KitResult, SectionHeader as KitSectionHeader, Shortcuts as KitShortcuts, SummaryList, Switch, TextField as KitTextField, type ChoiceOption } from "@finx/components";
import { CardVisual } from "../widgets/CardVisual";
import { FieldError, FieldLabel, useFieldIds } from "./field";
import { useLook } from "../look";

type P = BlockProps;

const toOptions = (rows: PickerRow[]): ChoiceOption[] => rows.map((r) => ({ id: r.id, title: r.title, sub: r.sub, selected: r.selected, label: r.label, avatar: r.avatar, round: r.round }));

export function AccountPicker({ b, set, strings }: P) {
  return <ChoiceGroup label={strings.account!} name={b.bind} look="cards" options={toOptions(accountRows(b as any))} onChange={(id) => set(b.bind, id)} error={b.error} />;
}

export function BeneficiaryPicker({ b, set, strings }: P) {
  return <ChoiceGroup label={strings.payTo!} name={b.bind} look="cards" options={toOptions(beneficiaryRows(b as any))} onChange={(id) => set(b.bind, id)} error={b.error} footer={b.allowAddNew ? strings.addBeneficiary : undefined} />;
}

export function AmountInput({ b, set, lang }: P) {
  const decimals: number = b.decimals ?? 0;
  const [text, setText] = useState(() => amountText(b.value, decimals));
  // what is typed stays as typed ("12." while more digits are coming); a change from outside, such as a quick amount, replaces it
  useEffect(() => { if (typedAmount(text, decimals).value !== (b.value == null || b.value === "" ? undefined : Number(b.value))) setText(amountText(b.value, decimals)); }, [b.value, decimals]); // eslint-disable-line react-hooks/exhaustive-deps
  const type = (t: string) => { const r = typedAmount(t, decimals); setText(r.text); set(b.bind, r.value); };
  return <AmountField label={b.label} symbol={symbolOf(b.currency)} decimals={decimals} value={text} onChange={type} helper={b.helper} error={b.error} quick={quickAmounts(b as any)} onQuick={(v) => set(b.bind, v)} quickLabel={ui(lang, "quickAmounts")} />;
}

export function SelectChips({ b, set }: P) {
  const { tiles, rows, choices } = selectChoices(b as any);
  const options: ChoiceOption[] = choices.map((o) => ({ id: o.id, title: o.name, sub: o.sub, selected: o.selected, icon: o.icon, color: o.color }));
  return <ChoiceGroup label={b.label} name={b.bind} look={rows ? "rows" : tiles ? "tiles" : "chips"} options={options} onChange={(id) => set(b.bind, id)} error={b.error} />;
}

export function TextField({ b, set, lang }: P) {
  const kind = keyboardKind(b.keyboard);
  const outlined = useLook().look?.fields === "outlined";
  return (
    <KitTextField label={b.label} value={String(b.value ?? "")} onChange={(v) => set(b.bind, v)} look={outlined ? "outlined" : "standard"} placeholder={b.placeholder}
      error={b.error} secure={!!b.secure} keyboard={kind === "number" ? "number" : kind === "phone" ? "phone" : kind === "email" ? "email" : "default"} strings={{ show: ui(lang, "show"), hide: ui(lang, "hide") }} />
  );
}

export function Alert({ b }: P) {
  return <KitAlert tone={b.tone} text={b.text} />;
}

export function Toggle({ b, set, press }: P) {
  return <Switch label={b.label} helper={b.helper} checked={b.value === true} onChange={(v) => set(b.bind, v)} link={b.link ? { label: b.link.label, onPress: () => press(b.link.actions) } : undefined} />;
}

/** A text input that reformats as it is typed (spaces in a card number, a slash in an expiry) and keeps the caret where it was. */
function FormattedInput({ value, clean, show, onChange, inputProps }: { value: string; clean: (typed: string) => string; show: (stored: string) => string; onChange: (stored: string) => void; inputProps: React.InputHTMLAttributes<HTMLInputElement> }) {
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (caret.current != null && ref.current && document.activeElement === ref.current) ref.current.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  });
  return (
    <input ref={ref} {...inputProps} value={show(value)}
      onChange={(e) => {
        const typed = e.target.value, at = e.target.selectionStart ?? typed.length, stored = clean(typed);
        caret.current = caretAfterFormat(typed, at, show(stored));
        onChange(stored);
      }} />
  );
}

export function CardForm({ b, set, lang }: P) {
  const fields = cardFields(b as any, lang);
  const value = (k: string) => fields.find((f) => f.key === k)!.value;
  const idPrefix = useFieldIds().input;
  return (
    <div className="fx-card-form">
      <CardVisual number={value("number")} holder={value("holder").toUpperCase()} expiry={value("expiry")} network={cardNetwork(value("number"))} />
      <div className="fx-card-fields">
        {fields.map((f) => {
          const id = `${idPrefix}-${f.key}`, errId = `${id}-error`;
          const common = {
            id, className: `fx-input ${f.error ? "has-error" : ""} ${f.caps ? "is-caps" : ""}`, autoComplete: f.autocomplete, inputMode: f.numeric ? ("numeric" as const) : undefined, maxLength: f.max,
            placeholder: f.placeholder, autoCapitalize: f.caps ? "characters" : "none", autoCorrect: "off", spellCheck: false, name: f.autocomplete,
            "aria-invalid": f.error ? true : undefined, "aria-describedby": f.error ? errId : undefined, type: f.secure ? "password" : "text",
          } as React.InputHTMLAttributes<HTMLInputElement>;
          return (
            <div key={f.key} className={`fx-field fx-card-${f.key}`}>
              <FieldLabel htmlFor={id}>{f.label}</FieldLabel>
              {f.key === "number" || f.key === "expiry"
                ? <FormattedInput value={f.value} clean={f.clean} show={f.show} onChange={(v) => set(`${b.bind}.${f.key}`, v)} inputProps={common} />
                : <input {...common} value={f.value} onChange={(e) => set(`${b.bind}.${f.key}`, f.clean(e.target.value))} />}
              <FieldError id={errId} text={f.error} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ReviewSummary({ b }: P) {
  return <SummaryList rows={b.rows} />;
}

export function Consent({ b, set }: P) {
  return <Checkbox label={b.text} checked={b.value === true} onChange={(v) => set(b.bind, v)} error={b.error} />;
}

/** A code typed on the bank's own number pad: dashes that fill in, then three keys across. */
function KeypadCode({ b, set, lang }: P) {
  const ids = useFieldIds();
  const v = String(b.value ?? "");
  return (
    <div className="fx-field fx-keypad-code">
      {b.hint ? <p id={ids.help} className="fx-help fx-center">{b.hint}</p> : null}
      <PinDots length={b.length} filled={v.length} masked={!!b.masked} digits={v} label={otpLabel(lang, b.length)} />
      <FieldError id={ids.error} text={b.error} />
      <div className="fx-keypad-wrap">
        <Keypad labels={{ back: ui(lang, "back") }} onKey={(k) => set(b.bind, applyKey(v, k, b.length))} />
      </div>
    </div>
  );
}

export const Otp = (p: P) => (p.b.keypad ? <KeypadCode {...p} /> : <CodeCells {...p} />);

function CodeCells({ b, set, lang }: P) {
  return <CodeInput label={otpLabel(lang, b.length)} length={b.length} value={String(b.value ?? "")} onChange={(t) => set(b.bind, cleanOtp(t))} hint={b.hint} error={b.error} />;
}

export function Result({ b }: P) {
  return <KitResult tone={b.tone === "success" ? "success" : "error"} title={b.title} text={b.text} meta={b.meta} />;
}

export function TextBlock({ b }: P) {
  return b.variant === "title" ? <h2 className="fx-text-title">{b.text}</h2> : <p className={b.variant === "caption" ? "fx-text-caption" : "fx-text"}>{b.text}</p>;
}

export function Button({ b, press, busy, strings, submit }: P & { submit?: boolean }) {
  return <KitButton label={busy ? strings.wait : b.label} variant={(b.variant ?? "primary") === "primary" ? "primary" : "secondary"} busy={busy} type={submit ? "submit" : "button"} onPress={() => press(b.actions)} />;
}

export function Hero(_: P) {
  const { look, name } = useLook();
  return <KitHero name={name ?? ""} logo={look?.logo} />;
}

export function SectionHeader({ b, press }: P) {
  return <KitSectionHeader title={b.title} action={b.action ? { label: b.action.label, onPress: () => press(b.action.actions) } : undefined} />;
}

export function Shortcuts({ b, press }: P) {
  return <KitShortcuts items={b.items.map((it: any) => ({ id: it.id, label: it.label, icon: it.icon, onPress: () => press(it.actions) }))} />;
}

export const Divider = ({ b }: P) => <KitDivider label={b.label || undefined} />;
export const AccordionBlock = ({ b }: P) => <KitAccordion items={b.items} />;

/** Rows that each do something when tapped, with an icon, a title, a chevron and an optional line of help below. */
export function Menu({ b, press }: P) {
  return (
    <ul className="fx-menu">
      {b.items.map((it: any) => <li key={it.id}><ListRow label={it.label} text={it.text} icon={it.icon} onPress={() => press(it.actions)} /></li>)}
    </ul>
  );
}

/** One component for every kind of block a journey can contain. Typed against the schema, so a new block kind must be added here. */
export const registry: Record<BlockType, (p: P) => React.ReactElement | null> = {
  accountPicker: AccountPicker, beneficiaryPicker: BeneficiaryPicker, amountInput: AmountInput, select: SelectChips, textInput: TextField,
  alert: Alert, toggle: Toggle, cardForm: CardForm, reviewSummary: ReviewSummary, consent: Consent, otp: Otp, result: Result, text: TextBlock, button: Button, stepper: () => null, hero: Hero, sectionHeader: SectionHeader, shortcuts: Shortcuts, menu: Menu, divider: Divider, accordion: AccordionBlock,
};
