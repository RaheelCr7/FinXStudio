import { useId } from "react";
import type { CheckboxProps } from "../props";
import { Icon } from "./Icon";

export function Checkbox({ label, checked, onChange, error }: CheckboxProps) {
  const id = useId();
  return (
    <div className="fxc-field">
      <label className="fxc-check-row" htmlFor={id}>
        <input id={id} className="fxc-check-input" type="checkbox" checked={checked} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} onChange={(e) => onChange?.(e.target.checked)} />
        <span className="fxc-check" aria-hidden><Icon name="check" size={14} stroke={3} /></span>
        <span>{label}</span>
      </label>
      {error ? <p id={`${id}-error`} className="fxc-error" role="alert">{error}</p> : null}
    </div>
  );
}
