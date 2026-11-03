import { useId, useState } from "react";
import type { AccordionProps } from "../props";
import { Icon } from "./Icon";

/** Questions that open to show their answers, one at a time. */
export function Accordion({ items, defaultOpen }: AccordionProps) {
  const base = useId();
  const [open, setOpen] = useState<string | undefined>(defaultOpen);
  return (
    <div className="fxc-accordion">
      {items.map((it) => {
        const on = open === it.id;
        return (
          <div key={it.id} className={`fxc-acc-item ${on ? "is-open" : ""}`}>
            <h3 className="fxc-acc-head">
              <button type="button" className="fxc-acc-btn" aria-expanded={on} aria-controls={`${base}-${it.id}`} id={`${base}-${it.id}-btn`} onClick={() => setOpen(on ? undefined : it.id)}>
                <span>{it.title}</span><Icon name={on ? "up" : "down"} size={16} />
              </button>
            </h3>
            <div id={`${base}-${it.id}`} role="region" aria-labelledby={`${base}-${it.id}-btn`} hidden={!on} className="fxc-acc-body">{it.text}</div>
          </div>
        );
      })}
    </div>
  );
}
