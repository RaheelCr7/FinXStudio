import type { SectionHeaderProps } from "../props";
import { Icon } from "./Icon";

export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  return (
    <div className="fxc-sectionhead">
      <div className="fxc-sectionhead-text"><h2>{title}</h2>{subtitle ? <p className="fxc-sectionhead-sub">{subtitle}</p> : null}</div>
      {action ? <button type="button" className="fxc-sectionhead-link" onClick={action.onPress}>{action.label}<Icon name="chevronDown" size={14} /></button> : null}
    </div>
  );
}
