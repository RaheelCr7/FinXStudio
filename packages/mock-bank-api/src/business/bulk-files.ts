import { currencyInfo } from "@finx/ui-kit";

/**
 * Reading a payment file (BankWorkx Business, bulk payments). Everything in a file is data: it is read with plain string code (no pattern with
 * nested or overlapping parts, so no file can make it slow), cut to the sizes below, and never run, shown as markup or trusted as a number or a name.
 */
export const MAX_FILE_BYTES = 256 * 1024;
export const MAX_FILE_LINES = 50;
/** The longest value kept from one cell of a file; the bank's own checks (a name of 70 characters, a reference of 35) are far below it. */
export const MAX_CELL = 200;

/** Control characters become spaces and the value is cut: what a file says is kept as text only. */
export function cleanCell(value: unknown, max = MAX_CELL): string {
  const s = String(value ?? "");
  let out = "";
  for (let i = 0; i < s.length && out.length < max; i++) { const c = s.charCodeAt(i); out += c < 32 || c === 127 ? " " : s[i]; }
  return out.trim();
}

export type RawLine = { name: string; account: string; code: string; amount: string; reference: string; /** the bank's own sentence for a payment it returned, until the line is edited */ note?: string; /** the line of the batch being resent that this one came from */ origN?: number };

/** A CSV file as rows of cells: quotes may hold commas, quotes (doubled) and line breaks. Stops after `maxRows` + 1 rows so a long file is noticed without being read to the end. */
export function parseCsv(text: string, maxRows: number): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false, i = text.charCodeAt(0) === 0xfeff ? 1 : 0, any = false;
  const endCell = () => { row.push(cleanCell(cell)); cell = ""; };
  const endRow = () => { endCell(); if (row.some((c) => c !== "")) rows.push(row); row = []; any = false; };
  for (; i < text.length && rows.length <= maxRows + 1; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; } else if (cell.length < MAX_CELL * 2) cell += c;
    } else if (c === '"' && cell === "") { quoted = true; any = true; }
    else if (c === ",") { endCell(); any = true; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; endRow(); }
    else { if (cell.length < MAX_CELL * 2) cell += c; any = true; }
  }
  if (any || cell !== "" || row.length) endRow();
  return rows;
}

const ENTITIES: [string, string][] = [["&lt;", "<"], ["&gt;", ">"], ["&quot;", '"'], ["&apos;", "'"], ["&amp;", "&"]];
/** Only the five entities every XML has are understood, in one pass, so `&amp;lt;` stays the text `&lt;`. */
function decode(s: string): string {
  let out = "", i = 0;
  while (i < s.length) {
    if (s[i] === "&") { const e = ENTITIES.find(([k]) => s.startsWith(k, i)); if (e) { out += e[1]; i += e[0].length; continue; } }
    out += s[i]; i++;
  }
  return out;
}
const between = (s: string, open: string, close: string, from = 0): { text: string; end: number } | null => {
  const a = s.indexOf(open, from); if (a < 0) return null;
  const b = s.indexOf(close, a + open.length); if (b < 0) return null;
  return { text: s.slice(a + open.length, b), end: b + close.length };
};

/**
 * The bank's own file: a `<BatchFile>` of `<Payment>` blocks with `<Name>`, `<Account>`, `<BankCode>`, `<Amount>` and `<Reference>`. A file that declares a
 * document type or an entity is refused (nothing is expanded or fetched), and so is one that is not XML. Returns null when the file cannot be read.
 */
export function parseBankFile(text: string, maxRows: number): string[][] | null {
  const lower = text.toLowerCase();
  if (lower.includes("<!doctype") || lower.includes("<!entity") || lower.includes("<![cdata[")) return null;
  const body = text.trimStart().replace(/^﻿/, "");
  if (!body.startsWith("<") || !body.includes("<BatchFile")) return null;
  const rows: string[][] = [];
  let at = 0;
  while (rows.length <= maxRows) {
    const block = between(body, "<Payment>", "</Payment>", at);
    if (!block) break;
    at = block.end;
    const tag = (name: string) => decode(between(block.text, `<${name}>`, `</${name}>`)?.text ?? "");
    rows.push([tag("Name"), tag("Account"), tag("BankCode"), tag("Amount"), tag("Reference")].map((c) => cleanCell(c)));
  }
  return rows;
}

/** A line as the bank keeps it from a row of cells: payee name, account number or IBAN, bank code, amount, reference. */
export const rawOf = (cells: string[]): RawLine => ({ name: cleanCell(cells[0]), account: cleanCell(cells[1]), code: cleanCell(cells[2]), amount: cleanCell(cells[3]), reference: cleanCell(cells[4], 35 * 2) });

/**
 * An amount as a whole number of the currency's smallest unit, from what was typed: digits with at most one dot and no more decimals than the currency has.
 * Anything else (a sign, a comma, a letter, an exponent, an empty value) is null, never guessed.
 */
export function parseMinor(raw: string, currency: string): number | null {
  const t = raw.trim();
  if (!t || t.length > 15) return null;
  let dot = -1;
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    if (c === 46) { if (dot >= 0) return null; dot = i; } else if (c < 48 || c > 57) return null;
  }
  const whole = dot < 0 ? t : t.slice(0, dot), frac = dot < 0 ? "" : t.slice(dot + 1);
  if (!whole || (dot >= 0 && !frac)) return null;
  const d = currencyInfo(currency).decimals;
  if (frac.length > d) return null;
  return Number(whole + frac.padEnd(d, "0"));
}

/** The same bytes always give the same key: a file sent before is found by it. (FNV-1a; not a security hash, only a name for the content.) */
export function fileKey(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return `f${h.toString(16).padStart(8, "0")}${text.length.toString(16)}`;
}

/** A cell for a CSV report: a value that a spreadsheet would run as a formula starts with a quote mark, and a cell with a comma, quote or line break is quoted. */
export function reportCell(value: unknown): string {
  let s = String(value ?? "");
  if (s !== "" && "=+-@\t\r".includes(s[0]!)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.split('"').join('""')}"` : s;
}
