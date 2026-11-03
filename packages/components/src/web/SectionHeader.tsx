import type { SectionHeaderProps } from "../props";
import { Icon } from "./Icon";

export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <div className="fxc-sectionhead">
      <h2>{title}</h2>
      {action ? <button type="button" className="fxc-sectionhead-link" onClick={action.onPress}>{action.label}<Icon name="chevronDown" size={14} /></button> : null}
    </div>
  );
}
