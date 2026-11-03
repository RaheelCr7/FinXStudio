import { useId } from "react";
import type { SwitchProps } from "../props";

export function Switch({ label, helper, checked, onChange, link }: SwitchProps) {
  const id = useId();
  const row = (
    <label className="fxc-switch-row" htmlFor={id}>
      <span className="fxc-text"><span className="fxc-title">{label}</span>{helper ? <span className="fxc-sub" id={`${id}-help`}>{helper}</span> : null}</span>
      <input id={id} className="fxc-switch-input" type="checkbox" role="switch" checked={checked} aria-describedby={helper ? `${id}-help` : undefined} onChange={(e) => onChange?.(e.target.checked)} />
      <span className="fxc-switch" aria-hidden />
    </label>
  );
  if (!link) return row;
  return (
    <div className="fxc-switch-link">
      <button type="button" className="fxc-link" onClick={link.onPress}>{link.label}</button>
      {row}
    </div>
  );
}
