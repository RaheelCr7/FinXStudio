import { useId } from "react";
import type { ChoiceGroupProps, ChoiceOption } from "../props";
import { Icon } from "./Icon";

/** A group of real radio inputs, so arrow keys and screen readers work without extra code. */
function Option({ o, name, look, invalid, onChange }: { o: ChoiceOption; name: string; look: NonNullable<ChoiceGroupProps["look"]>; invalid: boolean; onChange?: (id: string) => void }) {
  const kind = look === "cards" ? "card" : look === "rows" ? "listrow" : look === "tiles" ? "tile" : "chip";
  const text = <span className="fxc-text"><span className="fxc-title">{o.title}</span>{o.sub ? <span className="fxc-sub">{o.sub}</span> : null}</span>;
  return (
    <label className={`fxc-${kind} ${o.selected ? "is-on" : ""}`}>
      <input className="fxc-radio-input" type="radio" name={name} checked={o.selected} onChange={() => onChange?.(o.id)} aria-label={o.label ?? o.title} aria-invalid={invalid ? true : undefined} />
      {look === "cards" ? <><span className={`fxc-avatar ${o.round ? "is-round" : ""}`} aria-hidden>{o.avatar}</span>{text}</> : null}
      {look === "rows" ? <>{text}<span className="fxc-radio-dot" aria-hidden /></> : null}
      {look === "tiles" ? (
        <>
          {o.icon ? <span className={`fxc-icon-tile ${o.selected ? "is-on" : ""}`} aria-hidden><Icon name={o.icon} size={18} /></span>
            : <span className="fxc-letter" style={o.color ? { background: o.color } : undefined} aria-hidden>{o.title.slice(0, 1)}</span>}
          {text}
          {o.selected ? <span className="fxc-tick" aria-hidden><Icon name="check" size={13} stroke={3} /></span> : null}
        </>
      ) : null}
      {look === "chips" ? o.title : null}
    </label>
  );
}

export function ChoiceGroup({ label, name, look = "chips", options, onChange, error, footer }: ChoiceGroupProps) {
  const id = useId();
  return (
    <fieldset className={`fxc-field fxc-choices is-${look}`} aria-describedby={error ? `${id}-error` : undefined} data-name={name}>
      <legend className="fxc-label">{label}</legend>
      {options.map((o) => <Option key={o.id} o={o} name={name} look={look} invalid={!!error} onChange={onChange} />)}
      {footer ? <p className="fxc-footer">{footer}</p> : null}
      {error ? <p id={`${id}-error`} className="fxc-error" role="alert">{error}</p> : null}
    </fieldset>
  );
}
