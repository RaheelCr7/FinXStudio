import { useId } from "react";
import type { DropdownProps } from "../props";
import { Icon } from "./Icon";

/** A list that folds into one line until pressed: the browser's own select, so keyboards and screen readers already know it. */
export function Dropdown({ label, options, value = "", onChange, placeholder, error, look = "standard" }: DropdownProps) {
  const id = useId();
  const outlined = look === "outlined";
  return (
    <div className={`fxc-field ${outlined ? "is-outlined" : ""}`}>
      <label className={outlined ? "fxc-sr" : "fxc-label"} htmlFor={id}>{label}</label>
      <div className="fxc-input-wrap">
        <select id={id} className={`fxc-input fxc-select ${error ? "has-error" : ""}`} value={value} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} onChange={(e) => onChange?.(e.target.value)}>
          <option value="" disabled>{placeholder ?? (outlined ? label : "")}</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.sub ? `${o.name} (${o.sub})` : o.name}</option>)}
        </select>
        <span className="fxc-select-chevron" aria-hidden><Icon name="chevronDown" size={18} /></span>
      </div>
      {error ? <p id={`${id}-error`} className="fxc-error" role="alert">{error}</p> : null}
    </div>
  );
}
