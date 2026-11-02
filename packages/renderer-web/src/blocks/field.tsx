import { useId, type ReactNode } from "react";

/** Ids that tie a field to its label, helper text and error message, so a screen reader announces them with it. */
export function useFieldIds() {
  const id = useId();
  return { input: `${id}-input`, error: `${id}-error`, help: `${id}-help` };
}
export const describedBy = (ids: { error: string; help: string }, hasError: boolean, hasHelp = false) => [hasHelp ? ids.help : null, hasError ? ids.error : null].filter(Boolean).join(" ") || undefined;

/** The error message under a field. It is a live region, so it is read out when it appears. */
export const FieldError = ({ id, text }: { id: string; text?: string }) => (text ? <p id={id} className="fx-error" role="alert">{text}</p> : null);

export const FieldLabel = ({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) => <label className="fx-label" htmlFor={htmlFor}>{children}</label>;
