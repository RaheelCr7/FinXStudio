import type { AppBarProps } from "../props";
import { Icon } from "./Icon";


export function AppBar({ title, tone = "plain", onBack, onClose, labels = { back: "Back", close: "Close" } }: AppBarProps) {
  return (
    <header className={`fxc-bar is-${tone}`}>
      {onBack ? <button type="button" className="fxc-bar-btn" aria-label={labels.back} onClick={onBack}><Icon name="back" size={22} className="fxc-flip" /></button> : <span className="fxc-bar-gap" />}
      <h1 className="fxc-bar-title">{title}</h1>
      {onClose ? <button type="button" className="fxc-bar-btn" aria-label={labels.close} onClick={onClose}><Icon name="x" size={22} /></button> : <span className="fxc-bar-gap" />}
    </header>
  );
}
