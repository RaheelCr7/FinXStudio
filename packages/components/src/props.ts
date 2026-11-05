import type React from "react";
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
  /** Several lines of text (pasted rows, a note): how many lines tall the box is. Omitted: one line. */
  lines?: number;
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

export type SectionHeaderProps = { title: string; /** A quieter line under the title, such as "As of 03/30/2026 12:50 PM". */ subtitle?: string; action?: { label: string; onPress: () => void } };

export type ShortcutsProps = { items: { id: string; label: string; icon?: string; onPress?: () => void }[] };

export type HeroProps = { name: string; logo?: string };

export type DividerProps = { /** A word in the middle of the line, such as "OR". */ label?: string };

export type AccordionProps = {
  items: { id: string; title: string; text: string }[];
  /** The item open to start with. */
  defaultOpen?: string;
};

export type BalanceListProps = {
  /** Read-only rows: the account's name and number, a type tag, the balance and a note under it. */
  rows: { id: string; title: string; tag?: string; amount: string; caption?: string }[];
};

export type DialogProps = {
  /** The pop-up's heading. */
  title: string;
  text?: string;
  /** An icon from the shared drawings, shown above the heading (lock, phone, shield). */
  icon?: string;
  /** What the pop-up asks for, for example the code field of a PIN prompt. */
  children?: React.ReactNode;
  /** Its buttons, in the order shown. Cancel-like ones are secondary. */
  actions: { id: string; label: string; variant?: "primary" | "secondary" | "ghost"; onPress?: () => void }[];
  /** Escape (and the back key) close it with this. */
  onDismiss?: () => void;
};

export type MapPinsProps = {
  /** The places, with a position as latitude and longitude. */
  pins: { id: string; label: string; lat: number; lng: number; kind?: string }[];
  selected?: string;
  /** Names the map for a screen reader. */
  label: string;
  onSelect?: (id: string) => void;
  /** The map's height in points. */
  height?: number;
};

export type DateFieldProps = {
  label: string;
  /** The chosen day as YYYY-MM-DD, or empty. */
  value?: string;
  onChange?: (iso: string) => void;
  /** The earliest and latest day that may be chosen: YYYY-MM-DD, or "today". */
  min?: string;
  max?: string;
  placeholder?: string;
  error?: string;
  helper?: string;
  look?: "standard" | "outlined";
  /** The screen's language, for month and weekday names. */
  lang?: string;
  /** Words for the buttons, in the screen's language. */
  strings?: { open: string; prevMonth: string; nextMonth: string; prevYear: string; nextYear: string };
  /** The first day of the week (0 = Sunday). */
  weekStart?: number;
};

export type DropdownProps = {
  label: string;
  options: { id: string; name: string; sub?: string }[];
  value?: string;
  onChange?: (id: string) => void;
  placeholder?: string;
  error?: string;
  look?: "standard" | "outlined";
};

export type AvatarProps = {
  /** The person's name; the circle shows their initials. */
  name: string;
  /** A line under the name, such as a username. */
  text?: string;
};

export type StatusTone = "positive" | "warning" | "negative" | "info" | "neutral";

export type StatusChipProps = {
  /** The status in words. A colour alone never says it: the icon and the words do. */
  label: string;
  tone?: StatusTone;
  /** An icon from the shared drawings; by default the one that goes with the tone. */
  icon?: string;
};

export type TimelineProps = {
  /** Names the list for a screen reader ("Payment history"). */
  label?: string;
  /** Top to bottom. `done` is the default; `upcoming` is drawn dashed, `failed` in the negative colour. */
  items: { id: string; title: string; text?: string; /** When it happened or is due, already written for a person. */ time?: string; state?: "done" | "current" | "upcoming" | "failed" }[];
  /** What a screen reader says for each state, in the screen's language (the drawing alone cannot be read). */
  strings?: { done: string; current: string; upcoming: string; failed: string };
};

export type DataTableCell = { text: string; chip?: { label: string; tone: StatusTone; icon: string } };
export type DataTableProps = {
  /** Names the table for a screen reader. */
  label: string;
  /** table on a wide screen; cards on a phone, one card per row. */
  layout?: "table" | "cards";
  columns: { key: string; label: string; align?: "start" | "end"; sortable?: boolean; /** The order this column is in now. */ sort?: "asc" | "desc" }[];
  rows: { id: string; cells: Record<string, DataTableCell>; selected?: boolean; /** Present when the row can be opened. */ onPress?: () => void }[];
  /** A heading was pressed (no `dir`: go to its next order), or an order was chosen from the list on cards. */
  onSort?: (key: string, dir?: "asc" | "desc" | "none") => void;
  /** Tick boxes. `all` says whether every row on this page is ticked. */
  selectable?: boolean;
  all?: "all" | "some" | "none";
  onToggleRow?: (id: string) => void;
  onToggleAll?: () => void;
  /** The line above the table while rows are ticked, such as "3 selected · total $1,200.00". */
  selection?: string;
  search?: { value: string; onChange: (v: string) => void };
  filters?: { key: string; label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }[];
  page?: { summary: string; index: number; pages: number; onPrev: () => void; onNext: () => void };
  /** Shown instead of the rows when there are none. `clear` appears with it when a search or filter hides every row. */
  empty?: string;
  onClear?: () => void;
  /** The words around the table, in the screen's language. */
  strings: { search: string; all: string; clear: string; prev: string; next: string; selectRow: string; selectAll: string; sortBy: string; asc: string; desc: string; open: string };
};
