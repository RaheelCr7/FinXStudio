import type { TextFieldProps } from "../props";
import { useId, useState } from "react";
import { Icon } from "./Icon";


const MODE = { default: undefined, number: "numeric", phone: "tel", email: "email" } as const;

export function TextField({ label, value, onChange, look = "standard", placeholder, helper, error, secure, keyboard = "default", disabled, strings = { show: "Show", hide: "Hide" } }: TextFieldProps) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const outlined = look === "outlined";
  const describedBy = [helper ? `${id}-help` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`fxc-field ${outlined ? "is-outlined" : ""}`}>
      <label className={outlined ? "fxc-sr" : "fxc-label"} htmlFor={id}>{label}</label>
      <div className="fxc-input-wrap">
        <input id={id} className={`fxc-input ${error ? "has-error" : ""} ${secure ? "has-action" : ""}`} value={value} disabled={disabled}
          type={secure && !shown ? "password" : "text"} inputMode={MODE[keyboard]} placeholder={outlined ? label : placeholder}
          aria-invalid={error ? true : undefined} aria-describedby={describedBy} onChange={(e) => onChange?.(e.target.value)} />
        {secure ? (
          <button type="button" className="fxc-input-action" aria-pressed={shown} aria-label={shown ? strings.hide : strings.show} onClick={() => setShown(!shown)}>
            {outlined ? <Icon name="eye" size={18} /> : shown ? strings.hide : strings.show}
          </button>
        ) : null}
      </div>
      {helper ? <p id={`${id}-help`} className="fxc-help">{helper}</p> : null}
      {error ? <p id={`${id}-error`} className="fxc-error" role="alert">{error}</p> : null}
    </div>
  );
}
