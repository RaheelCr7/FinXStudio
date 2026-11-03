import type { AlertProps } from "../props";

export function Alert({ tone, text }: AlertProps) {
  // errors and warnings interrupt a screen reader; information and success wait their turn
  const urgent = tone === "error" || tone === "warning";
  return <div className={`fxc-alert fxc-alert-${tone}`} role={urgent ? "alert" : "status"}>{text}</div>;
}
