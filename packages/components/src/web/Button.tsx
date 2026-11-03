import type { ButtonProps } from "../props";

export function Button({ label, variant = "primary", busy, disabled, type = "button", onPress }: ButtonProps) {
  return (
    <button type={type} className={`fxc-btn fxc-btn-${variant === "ghost" ? "secondary" : variant}`} disabled={disabled || busy} aria-busy={busy || undefined} onClick={type === "submit" ? undefined : onPress}>
      {label}
    </button>
  );
}
