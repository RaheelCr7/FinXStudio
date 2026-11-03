import type { TextFieldProps } from "../props";
import { useId, useState } from "react";
import { Icon } from "./Icon";


const MODE = { default: undefined, number: "numeric", phone: "tel", email: "email" } as const;

export function TextField({ label, value, onChange, look = "standard", placeholder, helper, error, secure, keyboard = "default", lines, disabled, autoComplete, strings = { show: "Show", hide: "Hide" } }: TextFieldProps) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const outlined = look === "outlined";
  const describedBy = [helper ? `${id}-help` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`fxc-field ${outlined ? "is-outlined" : ""}`}>
      <label className={outlined ? "fxc-sr" : "fxc-label"} htmlFor={id}>{label}</label>
      <div className="fxc-input-wrap">
        {lines && lines > 1 ? (
          <textarea id={id} className={`fxc-input fxc-textarea ${error ? "has-error" : ""}`} rows={lines} value={value} disabled={disabled} autoCapitalize="none" autoCorrect="off" spellCheck={false}
            placeholder={outlined ? placeholder ?? label : placeholder} aria-invalid={error ? true : undefined} aria-describedby={describedBy} onChange={(e) => onChange?.(e.target.value)} />
        ) : (
        <input id={id} className={`fxc-input ${error ? "has-error" : ""} ${secure ? "has-action" : ""}`} value={value} disabled={disabled}
          type={secure && !shown ? "password" : keyboard === "email" ? "email" : keyboard === "phone" ? "tel" : "text"} inputMode={MODE[keyboard]}
          autoComplete={autoComplete ?? (secure ? "off" : keyboard === "email" ? "email" : keyboard === "phone" ? "tel" : "off")} autoCapitalize="none" autoCorrect="off" spellCheck={false}
          placeholder={outlined ? placeholder ?? label : placeholder}
          aria-invalid={error ? true : undefined} aria-describedby={describedBy} onChange={(e) => onChange?.(e.target.value)} />
        )}
        {secure ? (
          <button type="button" className="fxc-input-action" aria-pressed={shown} aria-label={shown ? strings.hide : strings.show} onClick={() => setShown(!shown)}>
            {outlined ? <Icon name={shown ? "eyeOff" : "eye"} size={20} /> : shown ? strings.hide : strings.show}
          </button>
        ) : null}
      </div>
      {helper ? <p id={`${id}-help`} className="fxc-help">{helper}</p> : null}
      {error ? <p id={`${id}-error`} className="fxc-error" role="alert">{error}</p> : null}
    </div>
  );
}
