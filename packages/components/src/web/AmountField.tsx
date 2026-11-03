import { useId } from "react";
import type { AmountFieldProps } from "../props";

export function AmountField({ label, value, symbol, decimals = 0, onChange, helper, error, quick = [], onQuick, quickLabel = "Quick amounts" }: AmountFieldProps) {
  const id = useId();
  const describedBy = [helper ? `${id}-help` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="fxc-field">
      <label className="fxc-label" htmlFor={id}>{label}</label>
      <div className={`fxc-amount ${error ? "has-error" : ""}`}>
        <span className="fxc-amount-symbol" aria-hidden>{symbol}</span>
        {/* text with a numeric keypad, not type=number: no spinner, no scroll-to-change, no "e" */}
        <input id={id} className="fxc-amount-input" type="text" inputMode={decimals ? "decimal" : "numeric"} autoComplete="off" enterKeyHint="next" placeholder="0" value={value}
          aria-invalid={error ? true : undefined} aria-describedby={describedBy} onChange={(e) => onChange?.(e.target.value)} />
      </div>
      {helper ? <p id={`${id}-help`} className="fxc-help">{helper}</p> : null}
      {quick.length ? (
        <div className="fxc-choices is-chips fxc-quick" role="radiogroup" aria-label={quickLabel}>
          {quick.map((q) => (
            <button key={q.value} type="button" role="radio" aria-checked={q.selected} aria-label={q.aria} className={`fxc-chip ${q.selected ? "is-on" : ""}`} onClick={() => onQuick?.(q.value)}>{q.label}</button>
          ))}
        </div>
      ) : null}
      {error ? <p id={`${id}-error`} className="fxc-error" role="alert">{error}</p> : null}
    </div>
  );
}
