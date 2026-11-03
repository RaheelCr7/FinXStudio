/**
 * Where the caret belongs after typed text was reformatted (spaces or a slash added): after the same number of digits it was after before.
 * Without this the caret jumps to the end each time a card number is edited in the middle.
 */
export function caretAfterFormat(typed: string, caret: number, formatted: string): number {
  const digits = typed.slice(0, caret).replace(/\D/g, "").length;
  if (digits === 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) if (/\d/.test(formatted[i]!) && ++seen === digits) return i + 1;
  return formatted.length;
}
