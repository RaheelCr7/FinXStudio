import type { ListRowProps } from "../props";
import { Icon } from "./Icon";


export function ListRow({ label, text, icon, onPress, disabled }: ListRowProps) {
  return (
    <div className="fxc-row-wrap">
      <button type="button" className="fxc-row" disabled={disabled} onClick={onPress}>
        {icon ? <Icon name={icon} size={22} className="fxc-row-icon" /> : null}
        <span className="fxc-row-title">{label}</span>
        <Icon name="chevronRight" size={18} className="fxc-flip" />
      </button>
      {text ? <p className="fxc-row-help">{text}</p> : null}
    </div>
  );
}
