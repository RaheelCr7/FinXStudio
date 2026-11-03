import { ui } from "../strings";

export const cleanOtp = (t: string) => t.replace(/[^0-9]/g, "");
export const otpLabel = (lang: string, length: number) => ui(lang, "otpLabel", { n: length });
/** One cell per digit of the code, with the next cell to fill marked active. */
export const otpCells = (value: unknown, length: number, masked = false) => {
  const v = String(value ?? "");
  return Array.from({ length }, (_, i) => ({ char: v[i] ? (masked ? "•" : v[i]!) : "", active: i === v.length }));
};

/** The number pad: three keys across, with a blank, 0 and delete on the last row. */
export const KEYPAD_ROWS: string[][] = [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], ["", "0", "back"]];
/** What the code becomes after a key is pressed on the pad: a digit is added up to the length, "back" removes the last one. */
export function applyKey(value: unknown, key: string, length: number): string {
  const v = String(value ?? "");
  if (key === "back") return v.slice(0, -1);
  return /^[0-9]$/.test(key) && v.length < length ? v + key : v;
}
