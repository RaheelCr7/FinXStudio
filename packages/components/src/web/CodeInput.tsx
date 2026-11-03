import { useId, useRef } from "react";
import type { CodeInputProps } from "../props";

export function CodeInput({ label, length, value, onChange, hint, error }: CodeInputProps) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const describedBy = [hint ? `${id}-help` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="fxc-field">
      {hint ? <p id={`${id}-help`} className="fxc-help">{hint}</p> : null}
      {/* one real input, so a code from an SMS can be filled in by the browser; the cells only mirror it */}
      <div className="fxc-code" dir="ltr" onClick={() => ref.current?.focus()}>
        <div className="fxc-code-cells" aria-hidden>
          {Array.from({ length }, (_, i) => <span key={i} className={`fxc-code-cell ${i === value.length ? "is-active" : ""} ${error ? "has-error" : ""}`}>{value[i] ?? ""}</span>)}
        </div>
        <input ref={ref} id={id} className="fxc-code-input" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={length} value={value}
          aria-label={label} aria-invalid={error ? true : undefined} aria-describedby={describedBy} onChange={(e) => onChange?.(e.target.value)} />
      </div>
      {error ? <p id={`${id}-error`} className="fxc-error" role="alert">{error}</p> : null}
    </div>
  );
}
