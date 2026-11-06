import type { ButtonProps } from "../props";

export function Button({ label, variant = "primary", busy, disabled, type = "button", onPress }: ButtonProps) {
  return (
    <button type={type} className={`fxc-btn fxc-btn-${variant === "ghost" ? "secondary" : variant}`} disabled={disabled || busy} aria-busy={busy || undefined} onClick={type === "submit" ? undefined : (e) => {
      // a button that was not a submit button when it was pressed must not submit the form: when pressing it changes the screen, a button of the new screen can take its place (same
      // position) and become the submit button before the browser finishes the click, which would press the new one too
      e.preventDefault();
      onPress?.();
    }}>
      {label}
    </button>
  );
}
