import type { StatusChipProps } from "../props";
import { Icon } from "./Icon";

const ICON = { positive: "check", warning: "clock", negative: "x", info: "info", neutral: "minus" } as const;

/** A status word with an icon and a tone. The tone is never the only signal. */
export function StatusChip({ label, tone = "neutral", icon }: StatusChipProps) {
  return <span className={`fxc-status is-${tone}`}><Icon name={icon ?? ICON[tone]} size={13} stroke={2.5} /><span>{label}</span></span>;
}
