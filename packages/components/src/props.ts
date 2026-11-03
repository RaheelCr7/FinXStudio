/** The props of every shared component. The web and the native versions take exactly these, so a screen can swap one for the other. */

export type ButtonProps = {
  label: string;
  variant?: "primary" | "secondary" | "ghost";
  busy?: boolean;
  disabled?: boolean;
  /** "submit" lets Enter in a form press it. */
  type?: "button" | "submit";
  onPress?: () => void;
};

export type TextFieldProps = {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  /** standard: label above the box. outlined: label inside as the placeholder, as in a bank's own design. */
  look?: "standard" | "outlined";
  placeholder?: string;
  helper?: string;
  error?: string;
  /** Hides what is typed, with a show/hide control (passwords). */
  secure?: boolean;
  keyboard?: "default" | "number" | "phone" | "email";
  disabled?: boolean;
  /** Words for the show/hide control, in the screen's language. */
  strings?: { show: string; hide: string };
};

export type AppBarProps = {
  title: string;
  /** plain: on the page colour. bar: a solid bar in the bank's colour with white text and icons. */
  tone?: "plain" | "bar";
  onBack?: () => void;
  onClose?: () => void;
  labels?: { back: string; close: string };
};

export type ListRowProps = {
  label: string;
  /** A line of help under the row. */
  text?: string;
  icon?: string;
  onPress?: () => void;
  disabled?: boolean;
};

export type KeypadKey = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "back";

export type KeypadProps = { onKey?: (key: KeypadKey) => void; labels?: { back: string } };

export type PinDotsProps = { length: number; filled: number; masked?: boolean; digits?: string; label: string };
