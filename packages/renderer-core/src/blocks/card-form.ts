import { ui } from "../strings";

/** "4242424242424242" as "4242 4242 4242 4242". */
export const groupCard = (digits: string) => (digits.match(/.{1,4}/g) ?? []).join(" ");
/** What is typed for an expiry, kept as MM/YY: "1128" becomes "11/28". */
export const expiryText = (raw: string) => { const d = raw.replace(/\D/g, "").slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; };
export const cleanCardNumber = (t: string) => t.replace(/\D/g, "").slice(0, 19);
export const cleanCvv = (t: string) => t.replace(/\D/g, "").slice(0, 4);

export type CardNetwork = "visa" | "mastercard" | "amex";
/** The card brand from the first digits. Visa starts with 4, American Express with 34 or 37, Mastercard with 51 to 55 or 2221 to 2720; anything else is drawn as Mastercard, as before. */
export function cardNetwork(number: string): CardNetwork {
  const d = number.replace(/\D/g, "");
  if (d.startsWith("4")) return "visa";
  if (/^3[47]/.test(d)) return "amex";
  return "mastercard";
}

/** The card number as the card picture shows it: groups of four, with dots for digits not typed yet. */
export const cardPictureDigits = (number: string) => (number.replace(/\D/g, "").padEnd(16, "•").match(/.{1,4}/g) ?? []).join("  ");

export type CardFieldKey = "number" | "holder" | "expiry" | "cvv";
export type CardField = {
  key: CardFieldKey; label: string; placeholder: string; value: string; error?: string;
  numeric: boolean; max?: number; secure: boolean; caps: boolean;
  /** The browser autofill token. */
  autocomplete: "cc-number" | "cc-name" | "cc-exp" | "cc-csc";
  /** Turns what is typed into what is stored. */
  clean: (typed: string) => string;
  /** Turns what is stored into what is shown. */
  show: (stored: string) => string;
};

/** The four fields of a card form, with their labels in the journey's language, limits, formatting and autofill hints. */
export function cardFields(b: { value?: unknown; errors?: Record<string, string | undefined> }, lang: string): CardField[] {
  const v = (b.value ?? {}) as Record<string, string>;
  const f = (key: CardFieldKey, rest: Omit<CardField, "key" | "value" | "error">): CardField => ({ key, value: String(v[key] ?? ""), error: b.errors?.[key], ...rest });
  const id = (t: string) => t;
  return [
    f("number", { label: ui(lang, "cardNumberLabel"), placeholder: "1234 5678 9012 3456", numeric: true, max: 23, secure: false, caps: false, autocomplete: "cc-number", clean: cleanCardNumber, show: groupCard }),
    f("holder", { label: ui(lang, "cardHolderLabel"), placeholder: ui(lang, "cardHolderPlaceholder"), numeric: false, secure: false, caps: true, autocomplete: "cc-name", clean: id, show: id }),
    f("expiry", { label: ui(lang, "cardExpiryLabel"), placeholder: "MM/YY", numeric: true, max: 5, secure: false, caps: false, autocomplete: "cc-exp", clean: expiryText, show: expiryText }),
    f("cvv", { label: ui(lang, "cardCvvLabel"), placeholder: "123", numeric: true, max: 4, secure: true, caps: false, autocomplete: "cc-csc", clean: cleanCvv, show: id }),
  ];
}
