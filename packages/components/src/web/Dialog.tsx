import { useEffect, useId, useRef } from "react";
import type { DialogProps } from "../props";
import { Button } from "./Button";
import { Icon } from "./Icon";

/** A pop-up over the screen: it takes focus, Escape closes it, and what is behind it is covered. */
export function Dialog({ title, text, icon, children, actions, onDismiss }: DialogProps) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.focus(); }, []);
  return (
    <div className="fxc-dialog-scrim" onKeyDown={(e) => { if (e.key === "Escape") onDismiss?.(); }}>
      <div ref={box} className="fxc-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} aria-describedby={text ? `${id}-d` : undefined} tabIndex={-1}>
        {icon ? <span className="fxc-dialog-icon"><Icon name={icon} size={28} /></span> : null}
        <h2 id={`${id}-t`} className="fxc-dialog-title">{title}</h2>
        {text ? <p id={`${id}-d`} className="fxc-dialog-text">{text}</p> : null}
        {children}
        <div className="fxc-dialog-actions">{actions.map((a) => <Button key={a.id} label={a.label} variant={a.variant ?? "primary"} onPress={a.onPress} />)}</div>
      </div>
    </div>
  );
}
