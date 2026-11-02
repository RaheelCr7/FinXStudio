export type KeyboardKind = "number" | "phone" | "email" | "default";
export const keyboardKind = (k: unknown): KeyboardKind => (k === "number" || k === "phone" || k === "email" ? k : "default");
/** Whether a text field hides what is typed (passwords and the like). Such fields also opt out of autofill and password saving. */
export const isSecure = (b: { secure?: boolean }) => !!b.secure;
