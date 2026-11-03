/** Date logic shared by the web and native date fields. Dates are ISO text (YYYY-MM-DD): no time zone, so a birthday never moves a day. */
export type Day = { iso: string; day: number; inMonth: boolean };

const pad = (n: number) => String(n).padStart(2, "0");
export const isoOf = (y: number, m: number, d: number) => `${String(y).padStart(4, "0")}-${pad(m + 1)}-${pad(d)}`;

/** Reads YYYY-MM-DD; anything else (or a day that does not exist, like 2026-02-31) is null. */
export function parseIso(s: unknown): { y: number; m: number; d: number } | null {
  const t = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s ?? ""));
  if (!t) return null;
  const y = Number(t[1]), m = Number(t[2]) - 1, d = Number(t[3]);
  const back = new Date(Date.UTC(y, m, d));
  return back.getUTCFullYear() === y && back.getUTCMonth() === m && back.getUTCDate() === d ? { y, m, d } : null;
}

/** Today as ISO, from the device's own calendar day. */
export const todayIso = (now = new Date()) => isoOf(now.getFullYear(), now.getMonth(), now.getDate());

/** A limit written as an ISO date or the word "today". */
export const limitIso = (v: string | undefined, now?: Date): string | undefined => (v === "today" ? todayIso(now) : v && parseIso(v) ? v : undefined);

/** Weeks of a month, each seven days, starting on `weekStart` (0 = Sunday). Days of the neighbouring months fill the first and last week. */
export function monthGrid(year: number, month: number, weekStart = 0): Day[][] {
  const first = new Date(Date.UTC(year, month, 1));
  const lead = (first.getUTCDay() - weekStart + 7) % 7;
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: Day[] = [];
  for (let i = -lead; cells.length % 7 !== 0 || i < days; i++) {
    const t = new Date(Date.UTC(year, month, 1 + i));
    cells.push({ iso: isoOf(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()), day: t.getUTCDate(), inMonth: i >= 0 && i < days });
  }
  const weeks: Day[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Moves a (year, month) by some months, wrapping the year. */
export const shiftMonth = (year: number, month: number, by: number) => { const t = new Date(Date.UTC(year, month + by, 1)); return { year: t.getUTCFullYear(), month: t.getUTCMonth() }; };

/** True when a day may be chosen: between the limits (both optional, ISO text compares in date order). */
export const withinLimits = (iso: string, min?: string, max?: string) => (!min || iso >= min) && (!max || iso <= max);

/** What a person sees in the field: DD / MM / YYYY. */
export function displayDate(iso: string | undefined): string {
  const p = parseIso(iso); return p ? `${pad(p.d)} / ${pad(p.m + 1)} / ${p.y}` : "";
}

const FALLBACK_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const FALLBACK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** The month's name in the screen's language (the device's own names; English if it has none). */
export function monthName(lang: string, month: number): string {
  try { return new Intl.DateTimeFormat(lang, { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2021, month, 1))); } catch { return FALLBACK_MONTHS[month]!; }
}
/** The seven weekday names, starting on `weekStart`. */
export function weekdayNames(lang: string, weekStart = 0): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = (weekStart + i) % 7;
    try { return new Intl.DateTimeFormat(lang, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2021, 7, 1 + d))); } catch { return FALLBACK_DAYS[d]!; }
  });
}
/** A whole date in words, for a screen reader: "1 January 2001". */
export function spokenDate(lang: string, iso: string): string {
  const p = parseIso(iso); if (!p) return iso;
  try { return new Intl.DateTimeFormat(lang, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(p.y, p.m, p.d))); } catch { return `${p.d} ${FALLBACK_MONTHS[p.m]} ${p.y}`; }
}
