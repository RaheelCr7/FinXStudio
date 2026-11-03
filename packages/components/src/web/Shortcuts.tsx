import type { ShortcutsProps } from "../props";
import { Icon } from "./Icon";

export function Shortcuts({ items }: ShortcutsProps) {
  return (
    <div className="fxc-shortcuts" role="group">
      {items.map((it) => (
        <button key={it.id} type="button" className="fxc-shortcut" onClick={it.onPress}>
          <span className="fxc-shortcut-tile" aria-hidden>{it.icon ? <Icon name={it.icon} size={22} /> : null}</span>
          <span>{it.label}</span>
        </button>
      ))}
    </div>
  );
}
