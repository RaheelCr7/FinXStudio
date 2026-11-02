import { ui } from "../strings";

export const cleanOtp = (t: string) => t.replace(/[^0-9]/g, "");
export const otpLabel = (lang: string, length: number) => ui(lang, "otpLabel", { n: length });
/** One cell per digit of the code, with the next cell to fill marked active. */
export const otpCells = (value: unknown, length: number) => {
  const v = String(value ?? "");
  return Array.from({ length }, (_, i) => ({ char: v[i] ?? "", active: i === v.length }));
};
