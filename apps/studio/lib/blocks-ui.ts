import { CalendarDays, CircleUser, AppWindow, MapPin, Banknote, ChevronsDownUp, Heading, Minus, Image, LayoutGrid, List, CreditCard, ListOrdered, ToggleRight, ChevronsUpDown, CircleCheck, ClipboardList, KeyRound, Landmark, MousePointerClick, ShieldCheck, TextCursorInput, Type, TriangleAlert, Users, type LucideIcon } from "lucide-react";

/** Icon and one-line help for each block type, shared by the block picker, the block list and the flow canvas. */
export const BLOCK_ICONS: Record<string, LucideIcon> = {
  text: Type, alert: TriangleAlert, result: CircleCheck, textInput: TextCursorInput, amountInput: Banknote, select: ChevronsUpDown,
  consent: ShieldCheck, accountPicker: Landmark, beneficiaryPicker: Users, reviewSummary: ClipboardList, otp: KeyRound, button: MousePointerClick, stepper: ListOrdered, toggle: ToggleRight, cardForm: CreditCard,
  hero: Image, sectionHeader: Heading, shortcuts: LayoutGrid, menu: List, divider: Minus, accordion: ChevronsDownUp, balanceList: Banknote, dialog: AppWindow, map: MapPin, dateInput: CalendarDays, avatar: CircleUser,
};
export const BLOCK_HELP: Record<string, string> = {
  text: "A title, paragraph or caption", alert: "An info, warning or error message", result: "Success or failure screen with a reference",
  textInput: "A free text field with optional format check", amountInput: "Money amount with limits and currency", select: "Pick one option from a list",
  consent: "A tick box the customer must accept", accountPicker: "Choose one of the customer's accounts", beneficiaryPicker: "Choose a saved payee",
  reviewSummary: "A recap of what is about to happen", toggle: "An on/off switch for a yes-or-no choice", cardForm: "Card number, name, expiry and code with a live card picture", otp: "One-time code entry", button: "A button that runs actions",
  hero: "The bank's logo banner", sectionHeader: "A heading with an optional link", shortcuts: "A row of icon buttons", menu: "A list of tappable rows", balanceList: "Read-only account rows with a type tag, balance and note", dateInput: "A date with a calendar to pick it", avatar: "A circle with a person's initials and name", dialog: "A pop-up over the screen, such as a PIN prompt or a confirmation", map: "Places on a schematic map; press a pin to act on it", divider: "A line between groups, with an optional word such as OR", accordion: "Questions that open to show their answers",
};
