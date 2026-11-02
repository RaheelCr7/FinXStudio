import { Banknote, ListOrdered, ChevronsUpDown, CircleCheck, ClipboardList, KeyRound, Landmark, MousePointerClick, ShieldCheck, TextCursorInput, Type, TriangleAlert, Users, type LucideIcon } from "lucide-react";

/** Icon and one-line help for each block type, shared by the block picker, the block list and the flow canvas. */
export const BLOCK_ICONS: Record<string, LucideIcon> = {
  text: Type, alert: TriangleAlert, result: CircleCheck, textInput: TextCursorInput, amountInput: Banknote, select: ChevronsUpDown,
  consent: ShieldCheck, accountPicker: Landmark, beneficiaryPicker: Users, reviewSummary: ClipboardList, otp: KeyRound, button: MousePointerClick, stepper: ListOrdered,
};
export const BLOCK_HELP: Record<string, string> = {
  text: "A title, paragraph or caption", alert: "An info, warning or error message", result: "Success or failure screen with a reference",
  textInput: "A free text field with optional format check", amountInput: "Money amount with limits and currency", select: "Pick one option from a list",
  consent: "A tick box the customer must accept", accountPicker: "Choose one of the customer's accounts", beneficiaryPicker: "Choose a saved payee",
  reviewSummary: "A recap of what is about to happen", otp: "One-time code entry", button: "A button that runs actions",
};
