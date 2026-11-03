import type { Ref } from "react";

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
  /** The browser's autofill hint. By default: off for passwords and plain text, email or tel for those fields. */
  autoComplete?: string;
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
  /** For a screen that moves focus to its title when it opens. Web only. */
  titleRef?: Ref<HTMLHeadingElement>;
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

export type AlertProps = { tone: "info" | "warning" | "error" | "success"; text: string };

export type ResultProps = { tone: "success" | "error"; title: string; text?: string; /** A reference or time, in a small pill. */ meta?: string };

export type SummaryListProps = { rows: { label: string; value: string }[] };

export type SwitchProps = {
  label: string;
  helper?: string;
  checked: boolean;
  onChange?: (checked: boolean) => void;
  /** A link on the same row, to the start of the switch ("Forgot password?" … switch). */
  link?: { label: string; onPress: () => void };
};

export type CheckboxProps = { label: string; checked: boolean; onChange?: (checked: boolean) => void; error?: string };

export type ChoiceOption = {
  id: string;
  title: string;
  sub?: string;
  selected: boolean;
  /** What a screen reader says, when it should differ from the title. */
  label?: string;
  /** cards: initials in a square, or a circle when round. */
  avatar?: string;
  round?: boolean;
  /** tiles: a shared icon, or else the first letter on a coloured square. */
  icon?: string;
  color?: string;
};

export type ChoiceGroupProps = {
  label: string;
  /** Groups the radio buttons; usually the field it fills. */
  name: string;
  /** chips: pills in a row. tiles: a grid of cards with an icon. rows: a list with a radio dot. cards: rows with initials (accounts, people). */
  look?: "chips" | "tiles" | "rows" | "cards";
  options: ChoiceOption[];
  onChange?: (id: string) => void;
  error?: string;
  /** A line under the options, such as "Add a beneficiary". */
  footer?: string;
};

export type QuickAmount = { value: number; label: string; aria: string; selected: boolean };

export type AmountFieldProps = {
  label: string;
  /** The amount as typed text; the screen parses it. */
  value: string;
  /** The currency symbol before the amount. */
  symbol: string;
  /** Decimal places the currency allows. 0 (the default) opens a number pad; more opens one with a decimal point. */
  decimals?: number;
  onChange?: (text: string) => void;
  helper?: string;
  error?: string;
  /** Preset amounts shown as chips under the field. */
  quick?: QuickAmount[];
  onQuick?: (value: number) => void;
  /** Names the preset amounts for a screen reader. */
  quickLabel?: string;
};

export type CodeInputProps = {
  /** Spoken name, for example "Enter the 6-digit code". */
  label: string;
  length: number;
  value: string;
  /** Called with what was typed or pasted; the screen keeps the digits. */
  onChange?: (typed: string) => void;
  hint?: string;
  error?: string;
};

export type SectionHeaderProps = { title: string; action?: { label: string; onPress: () => void } };

export type ShortcutsProps = { items: { id: string; label: string; icon?: string; onPress?: () => void }[] };

export type HeroProps = { name: string; logo?: string };
