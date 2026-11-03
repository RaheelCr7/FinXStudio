import type { DividerProps } from "../props";

export function Divider({ label }: DividerProps) {
  return label ? <div className="fxc-divider" role="separator" aria-label={label}><span aria-hidden>{label}</span></div> : <hr className="fxc-divider-line" />;
}
