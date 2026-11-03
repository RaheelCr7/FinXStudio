"use client";
import { useLayoutEffect, useRef, useState } from "react";
import {
  accountRows, amountText, applyKey, beneficiaryRows, KEYPAD_ROWS, caretAfterFormat, cardFields, cardNetwork, cleanOtp, keyboardKind, otpCells, otpLabel, parseAmountText,
  quickAmounts, selectChoices, symbolOf, ui, type BlockProps, type BlockType, type PickerRow,
} from "@finx/renderer-core";
import { CardVisual } from "../widgets/CardVisual";
import { Icon, IconTile } from "../widgets/Icon";
import { FieldError, FieldLabel, describedBy, useFieldIds } from "./field";
import { useLook } from "../look";

type P = BlockProps;

/** A group of radio options (accounts, beneficiaries, chips, tiles): real radio inputs, so arrow keys and screen readers work without extra code. */
function RadioGroup({ legend, name, error, children, className }: { legend: string; name: string; error?: string; children: React.ReactNode; className?: string }) {
  const ids = useFieldIds();
  return (
    <fieldset className={`fx-field ${className ?? ""}`} aria-describedby={describedBy(ids, !!error)} data-name={name}>
      <legend className="fx-label">{legend}</legend>
      {children}
      <FieldError id={ids.error} text={error} />
    </fieldset>
  );
}
function Radio({ name, checked, onChange, label, children, className, invalid }: { name: string; checked: boolean; onChange: () => void; label: string; children: React.ReactNode; className: string; invalid?: boolean }) {
  return (
    <label className={`${className} ${checked ? "is-on" : ""}`}>
      <input className="fx-radio-input" type="radio" name={name} checked={checked} onChange={onChange} aria-label={label} aria-invalid={invalid ? true : undefined} />
      {children}
    </label>
  );
}
const Avatar = ({ text, round }: { text: string; round?: boolean }) => <span className={`fx-avatar ${round ? "is-round" : ""}`} aria-hidden>{text}</span>;
const PickerRows = ({ rows, name, onPick, invalid }: { rows: PickerRow[]; name: string; onPick: (id: string) => void; invalid?: boolean }) => (
  <>
    {rows.map((r) => (
      <Radio key={r.id} name={name} checked={r.selected} onChange={() => onPick(r.id)} label={r.label} className="fx-row" invalid={invalid}>
        <Avatar text={r.avatar} round={r.round} />
        <span className="fx-row-text"><span className="fx-row-title">{r.title}</span>{r.sub ? <span className="fx-row-sub">{r.sub}</span> : null}</span>
      </Radio>
    ))}
  </>
);

export function AccountPicker({ b, set, strings }: P) {
  return (
    <RadioGroup legend={strings.account!} name={b.bind} error={b.error}>
      <PickerRows rows={accountRows(b as any)} name={b.bind} onPick={(id) => set(b.bind, id)} invalid={!!b.error} />
    </RadioGroup>
  );
}

export function BeneficiaryPicker({ b, set, strings }: P) {
  return (
    <RadioGroup legend={strings.payTo!} name={b.bind} error={b.error}>
      <PickerRows rows={beneficiaryRows(b as any)} name={b.bind} onPick={(id) => set(b.bind, id)} invalid={!!b.error} />
      {b.allowAddNew ? <p className="fx-link-text">{strings.addBeneficiary}</p> : null}
    </RadioGroup>
  );
}

export function AmountInput({ b, set, lang }: P) {
  const ids = useFieldIds();
  const chips = quickAmounts(b as any);
  return (
    <div className="fx-field">
      <FieldLabel htmlFor={ids.input}>{b.label}</FieldLabel>
      <div className={`fx-amount ${b.error ? "has-error" : ""}`}>
        <span className="fx-amount-symbol" aria-hidden>{symbolOf(b.currency)}</span>
        {/* text with a numeric keypad, not type=number: no spinner, no scroll-to-change, no "e" */}
        <input id={ids.input} className="fx-amount-input" type="text" inputMode="numeric" autoComplete="off" enterKeyHint="next" placeholder="0" value={amountText(b.value)}
          aria-invalid={b.error ? true : undefined} aria-describedby={describedBy(ids, !!b.error, !!b.helper)} onChange={(e) => set(b.bind, parseAmountText(e.target.value))} />
      </div>
      {b.helper ? <p id={ids.help} className="fx-help">{b.helper}</p> : null}
      {chips.length ? (
        <div className="fx-chips" role="radiogroup" aria-label={ui(lang, "quickAmounts")}>
          {chips.map((q) => (
            <button key={q.value} type="button" role="radio" aria-checked={q.selected} aria-label={q.aria} className={`fx-chip ${q.selected ? "is-on" : ""}`} onClick={() => set(b.bind, q.value)}>{q.label}</button>
          ))}
        </div>
      ) : null}
      <FieldError id={ids.error} text={b.error} />
    </div>
  );
}

export function SelectChips({ b, set }: P) {
  const { tiles, rows, choices } = selectChoices(b as any);
  if (rows) {
    return (
      <RadioGroup legend={b.label} name={b.bind} error={b.error} className="fx-rows">
        {choices.map((o) => (
          <Radio key={o.id} name={b.bind} checked={o.selected} onChange={() => set(b.bind, o.id)} label={o.name} className="fx-listrow" invalid={!!b.error}>
            <span className="fx-row-text"><span className="fx-row-title">{o.name}</span>{o.sub ? <span className="fx-row-sub">{o.sub}</span> : null}</span>
            <span className="fx-radio-dot" aria-hidden />
          </Radio>
        ))}
      </RadioGroup>
    );
  }
  return (
    <RadioGroup legend={b.label} name={b.bind} error={b.error} className={tiles ? "fx-tiles" : "fx-chips"}>
      {choices.map((o) => (
        <Radio key={o.id} name={b.bind} checked={o.selected} onChange={() => set(b.bind, o.id)} label={o.name} className={tiles ? "fx-tile" : "fx-chip"} invalid={!!b.error}>
          {tiles ? (
            <>
              {o.icon ? <IconTile icon={o.icon} size={40} tone={o.selected ? "accent2" : "accent"} /> : <span className="fx-letter" style={o.color ? { background: o.color } : undefined} aria-hidden>{o.letter}</span>}
              <span className="fx-row-text"><span className="fx-row-title">{o.name}</span>{o.sub ? <span className="fx-row-sub">{o.sub}</span> : null}</span>
              {o.selected ? <span className="fx-tick" aria-hidden><Icon name="check" size={13} stroke={3} /></span> : null}
            </>
          ) : o.name}
        </Radio>
      ))}
    </RadioGroup>
  );
}

export function TextField({ b, set, lang }: P) {
  const ids = useFieldIds();
  const [shown, setShown] = useState(false);
  const kind = keyboardKind(b.keyboard);
  const secure = !!b.secure;
  const outlined = useLook().look?.fields === "outlined";
  const type = secure && !shown ? "password" : kind === "email" ? "email" : kind === "phone" ? "tel" : "text";
  return (
    <div className={`fx-field ${outlined ? "is-outlined" : ""}`}>
      {outlined ? <label className="fx-sr" htmlFor={ids.input}>{b.label}</label> : <FieldLabel htmlFor={ids.input}>{b.label}</FieldLabel>}
      <div className="fx-input-wrap">
        <input id={ids.input} className={`fx-input ${b.error ? "has-error" : ""} ${secure ? "has-action" : ""}`} type={type} inputMode={kind === "number" ? "numeric" : undefined}
          autoComplete={secure ? "off" : kind === "email" ? "email" : kind === "phone" ? "tel" : "off"} autoCapitalize="none" autoCorrect="off" spellCheck={false}
          placeholder={outlined ? b.placeholder ?? b.label : b.placeholder} value={String(b.value ?? "")} aria-invalid={b.error ? true : undefined} aria-describedby={describedBy(ids, !!b.error)} onChange={(e) => set(b.bind, e.target.value)} />
        {secure ? <button type="button" className="fx-input-action" aria-pressed={shown} aria-label={shown ? ui(lang, "hide") : ui(lang, "show")} onClick={() => setShown(!shown)}>{outlined ? <Icon name={shown ? "eyeOff" : "eye"} size={20} /> : shown ? ui(lang, "hide") : ui(lang, "show")}</button> : null}
      </div>
      <FieldError id={ids.error} text={b.error} />
    </div>
  );
}

export function Alert({ b }: P) {
  // errors and warnings interrupt a screen reader; information and success wait their turn
  const urgent = b.tone === "error" || b.tone === "warning";
  return <div className={`fx-alert fx-alert-${b.tone}`} role={urgent ? "alert" : "status"}>{b.text}</div>;
}

export function Toggle({ b, set, press }: P) {
  const ids = useFieldIds();
  const toggle = (
    <label className="fx-toggle" htmlFor={ids.input}>
      <span className="fx-row-text"><span className="fx-row-title">{b.label}</span>{b.helper ? <span className="fx-row-sub" id={ids.help}>{b.helper}</span> : null}</span>
      <input id={ids.input} className="fx-switch-input" type="checkbox" role="switch" checked={b.value === true} aria-describedby={b.helper ? ids.help : undefined} onChange={(e) => set(b.bind, e.target.checked)} />
      <span className="fx-switch" aria-hidden />
    </label>
  );
  if (!b.link) return toggle;
  return (
    <div className="fx-toggle-row">
      <button type="button" className="fx-link" onClick={() => press(b.link.actions)}>{b.link.label}</button>
      {toggle}
    </div>
  );
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
  return (
    <dl className="fx-review">
      {b.rows.map((r: any, i: number) => <div key={i} className="fx-review-row"><dt>{r.label}</dt><dd>{r.value}</dd></div>)}
    </dl>
  );
}

export function Consent({ b, set }: P) {
  const ids = useFieldIds();
  return (
    <div className="fx-field">
      <label className="fx-consent" htmlFor={ids.input}>
        <input id={ids.input} className="fx-check-input" type="checkbox" checked={b.value === true} aria-invalid={b.error ? true : undefined} aria-describedby={describedBy(ids, !!b.error)} onChange={(e) => set(b.bind, e.target.checked)} />
        <span className="fx-check" aria-hidden><Icon name="check" size={14} stroke={3} /></span>
        <span>{b.text}</span>
      </label>
      <FieldError id={ids.error} text={b.error} />
    </div>
  );
}

/** A code typed on the bank's own number pad: dashes that fill in, then three keys across. */
function KeypadCode({ b, set, lang }: P) {
  const ids = useFieldIds();
  const v = String(b.value ?? "");
  return (
    <div className="fx-field fx-keypad-code">
      {b.hint ? <p id={ids.help} className="fx-help fx-center">{b.hint}</p> : null}
      <div className="fx-dashes" dir="ltr" role="img" aria-label={`${otpLabel(lang, b.length)}. ${v.length}/${b.length}`}>
        {otpCells(v, b.length, !!b.masked).map((cell, i) => <span key={i} className={`fx-dash ${cell.active ? "is-active" : ""}`}><span>{cell.char}</span></span>)}
      </div>
      <FieldError id={ids.error} text={b.error} />
      <div className="fx-keypad" dir="ltr">
        {KEYPAD_ROWS.flat().map((k, i) => k === "" ? <span key={i} /> : (
          <button key={i} type="button" className="fx-key" aria-label={k === "back" ? ui(lang, "back") : k} onClick={() => set(b.bind, applyKey(v, k, b.length))}>{k === "back" ? <Icon name="backspace" size={20} /> : k}</button>
        ))}
      </div>
    </div>
  );
}

export const Otp = (p: P) => (p.b.keypad ? <KeypadCode {...p} /> : <CodeCells {...p} />);

function CodeCells({ b, set, lang }: P) {
  const ids = useFieldIds();
  const ref = useRef<HTMLInputElement>(null);
  const v = String(b.value ?? "");
  return (
    <div className="fx-field">
      {b.hint ? <p id={ids.help} className="fx-help">{b.hint}</p> : null}
      {/* one real input, so a code from an SMS can be filled in by the browser; the cells only mirror it */}
      <div className="fx-otp" dir="ltr" onClick={() => ref.current?.focus()}>
        <div className="fx-otp-cells" aria-hidden>
          {otpCells(v, b.length).map((cell, i) => <span key={i} className={`fx-otp-cell ${cell.active ? "is-active" : ""} ${b.error ? "has-error" : ""}`}>{cell.char}</span>)}
        </div>
        <input ref={ref} id={ids.input} className="fx-otp-input" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={b.length} value={v}
          aria-label={otpLabel(lang, b.length)} aria-invalid={b.error ? true : undefined} aria-describedby={describedBy(ids, !!b.error, !!b.hint)} onChange={(e) => set(b.bind, cleanOtp(e.target.value))} />
      </div>
      <FieldError id={ids.error} text={b.error} />
    </div>
  );
}

export function Result({ b }: P) {
  const ok = b.tone === "success";
  return (
    <div className="fx-result" role="status">
      <span className={`fx-result-icon ${ok ? "is-ok" : "is-bad"}`} aria-hidden>{ok ? <Icon name="check" size={40} stroke={2.5} /> : <span>!</span>}</span>
      <h2 className="fx-result-title">{b.title}</h2>
      {b.text ? <p className="fx-result-text">{b.text}</p> : null}
      {b.meta ? <p className="fx-result-meta">{b.meta}</p> : null}
    </div>
  );
}

export function TextBlock({ b }: P) {
  return b.variant === "title" ? <h2 className="fx-text-title">{b.text}</h2> : <p className={b.variant === "caption" ? "fx-text-caption" : "fx-text"}>{b.text}</p>;
}

export function Button({ b, press, busy, strings, submit }: P & { submit?: boolean }) {
  const primary = (b.variant ?? "primary") === "primary";
  const label = busy ? strings.wait : b.label;
  return (
    <button type={submit ? "submit" : "button"} className={`fx-btn ${primary ? "fx-btn-primary" : "fx-btn-ghost"}`} disabled={busy} aria-busy={busy || undefined} onClick={submit ? undefined : () => press(b.actions)}>{label}</button>
  );
}

/** The bank's banner: its logo (or its name) on the accent colour. The player draws the sheet that overlaps its bottom edge. */
export function Hero(_: P) {
  const { look, name } = useLook();
  return <div className="fx-hero">{look?.logo ? <img className="fx-hero-logo" src={look.logo} alt={name ?? ""} /> : <span className="fx-hero-name">{name}</span>}</div>;
}

/** A heading with a link on the same row ("Welcome" … "English ⌄"). */
export function SectionHeader({ b, press }: P) {
  return (
    <div className="fx-sectionhead">
      <h2>{b.title}</h2>
      {b.action ? <button type="button" className="fx-sectionhead-link" onClick={() => press(b.action.actions)}>{b.action.label}<Icon name="chevronDown" size={14} /></button> : null}
    </div>
  );
}

/** Icon buttons in a row, for the shortcuts at the foot of a sign-in screen. */
export function Shortcuts({ b, press }: P) {
  return (
    <div className="fx-shortcuts" role="group">
      {b.items.map((it: any) => (
        <button key={it.id} type="button" className="fx-shortcut" onClick={() => press(it.actions)}>
          <span className="fx-shortcut-tile" aria-hidden>{it.icon ? <Icon name={it.icon} size={22} /> : null}</span>
          <span>{it.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Rows that each do something when tapped, with an icon, a title, a chevron and an optional line of help below. */
export function Menu({ b, press }: P) {
  return (
    <ul className="fx-menu">
      {b.items.map((it: any) => (
        <li key={it.id}>
          <button type="button" className="fx-menu-row" onClick={() => press(it.actions)}>
            {it.icon ? <Icon name={it.icon} size={22} className="fx-menu-icon" /> : null}
            <span className="fx-menu-title">{it.label}</span>
            <Icon name="chevronRight" size={18} className="fx-flip" />
          </button>
          {it.text ? <p className="fx-menu-help">{it.text}</p> : null}
        </li>
      ))}
    </ul>
  );
}

/** One component for every kind of block a journey can contain. Typed against the schema, so a new block kind must be added here. */
export const registry: Record<BlockType, (p: P) => React.ReactElement | null> = {
  accountPicker: AccountPicker, beneficiaryPicker: BeneficiaryPicker, amountInput: AmountInput, select: SelectChips, textInput: TextField,
  alert: Alert, toggle: Toggle, cardForm: CardForm, reviewSummary: ReviewSummary, consent: Consent, otp: Otp, result: Result, text: TextBlock, button: Button, stepper: () => null, hero: Hero, sectionHeader: SectionHeader, shortcuts: Shortcuts, menu: Menu,
};
