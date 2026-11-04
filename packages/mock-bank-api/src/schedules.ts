import { money } from "./payments";

/**
 * Scheduled and recurring payments (BankWorkx, Payments): the calendar, the frequencies and the rules of when a schedule runs and when it
 * can still be changed. Pure functions on ISO dates ("2026-11-03", UTC) and sandbox data (docs: schedule-payment). Business days are
 * Monday to Friday; a bank may also close other days (the sandbox takes them from `conditions.closedDays`), and there are no regional
 * calendars or holidays. A real bank's scheduler replaces this behind the same adapters.
 */
export type Freq = "once" | "weekly" | "biweekly" | "monthly" | "quarterly";
export type ScheduleKind = "payee" | "own" | "bill";
export type AmountMode = "fixed" | "full" | "minimum";
export type ScheduleStatus = "active" | "paused" | "completed" | "cancelled";
/** How a schedule is told apart in words: the name on a card, the word in a sentence ("Authorise $100.00 to Maya Chen, monthly"), and the most payments it may be set to end after. */
export const FREQUENCIES: Record<Freq, { name: string; adverb: string; max: number }> = {
  once: { name: "Once", adverb: "once", max: 1 },
  weekly: { name: "Weekly", adverb: "weekly", max: 104 },
  biweekly: { name: "Every 2 weeks", adverb: "every 2 weeks", max: 52 },
  monthly: { name: "Monthly", adverb: "monthly", max: 60 },
  quarterly: { name: "Every 3 months", adverb: "every 3 months", max: 40 },
};
export const isFreq = (f: unknown): f is Freq => typeof f === "string" && f in FREQUENCIES;
/** A person can have up to this many schedules that are active or paused. */
export const MAX_ACTIVE = 20;
/** The first payment is at most this many months from today. */
export const AHEAD_MONTHS = 12;
/** "On a date" offers the payment dates after the first, up to this many. */
export const END_DATES = 60;
/** Changes close at this hour (UTC) on the business day before the next payment; 09:00 with the bank's strict option. */
export const CUTOFF_HOUR = 18;
export const STRICT_CUTOFF_HOUR = 9;

/** What the sandbox keeps about a schedule made by the Payments journeys. All optional so the older entries (a later payment, "pay automatically") stay as they were. */
export type ScheduleDetail = {
  kind: ScheduleKind;
  /** The payee id, the id of the other own account, or the saved biller id. */
  targetId: string;
  fromAccountId: string;
  amountMode: AmountMode;
  /** The fixed amount, or for a full bill the most the person agreed to pay (the cap). */
  amount: number | null;
  currency: string;
  frequency: Freq;
  /** The date every later date counts from (the day of the month is kept from it). */
  anchor: string;
  /** How many payments were dealt with (paid or skipped), so the next one is number `done`. */
  done: number;
  paid: number;
  nextRunOn: string;
  /** The last payment on or before this date. */
  endsOn: string | null;
  /** The number of payments, counted from the anchor. */
  endCount: number | null;
  status: ScheduleStatus;
  reminder: boolean;
  /** Try once more on the next business day when there is not enough money. */
  retry: boolean;
  /** Set while the payment of day `nextRunOn` waits for its second try. */
  retryOn?: string;
  /** Payments in a row that did not go. */
  fails: number;
  endedOn?: string;
};

const DAY = 86_400_000;
const NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const isoOf = (t: number) => new Date(t).toISOString().slice(0, 10);
export const msOf = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
/** A real calendar date written as YYYY-MM-DD. */
export const validIso = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(msOf(s)) && isoOf(msOf(s)) === s;
/** A date as a person reads it: Fri 6 Nov, or Fri 6 Nov 2026. */
export const dayName = (iso: string, year = false) => { const d = new Date(msOf(iso)); return `${NAMES[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}${year ? ` ${d.getUTCFullYear()}` : ""}`; };
export const addDays = (iso: string, n: number) => isoOf(msOf(iso) + n * DAY);

export const isWeekday = (iso: string) => { const w = new Date(msOf(iso)).getUTCDay(); return w !== 0 && w !== 6; };
/** A business day: Monday to Friday, and not a day the bank is closed. */
export const isOpen = (iso: string, closed: readonly string[] = []) => isWeekday(iso) && !closed.includes(iso);
/** The first business day on or after a date. */
export function nextOpen(iso: string, closed: readonly string[] = []) { let d = iso; for (let i = 0; i < 400 && !isOpen(d, closed); i++) d = addDays(d, 1); return d; }
/** The last business day before a date. */
export function prevOpen(iso: string, closed: readonly string[] = []) { let d = addDays(iso, -1); for (let i = 0; i < 400 && !isOpen(d, closed); i++) d = addDays(d, -1); return d; }

/** The same day of the month some months later, or the last day of a shorter month. `day` is the day of the month to keep. */
export function addMonths(iso: string, months: number, day = Number(iso.slice(8, 10))) {
  const d = new Date(msOf(iso)), y = d.getUTCFullYear(), m = d.getUTCMonth() + months;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return isoOf(Date.UTC(y, m, Math.min(day, last)));
}

/** Payment number `k` (0 is the first) before it is moved off a weekend or a closed day. */
export function nominal(anchor: string, freq: Freq, k: number) {
  switch (freq) {
    case "once": return anchor;
    case "weekly": return addDays(anchor, 7 * k);
    case "biweekly": return addDays(anchor, 14 * k);
    case "monthly": return addMonths(anchor, k);
    case "quarterly": return addMonths(anchor, 3 * k);
  }
}
/** The day payment number `k` is made: a payment that falls on a Saturday, a Sunday or a closed day moves to the next business day. */
export const runDate = (anchor: string, freq: Freq, k: number, closed: readonly string[] = []) => nextOpen(nominal(anchor, freq, k), closed);

type Counting = Pick<ScheduleDetail, "anchor" | "frequency" | "done" | "endsOn" | "endCount">;
/** How many payments are left, or null when there is no end. */
export function remaining(s: Counting, closed: readonly string[] = []): number | null {
  if (s.frequency === "once") return Math.max(0, 1 - s.done);
  if (s.endCount !== null) return Math.max(0, s.endCount - s.done);
  if (s.endsOn === null) return null;
  let n = 0;
  for (let k = s.done; k < s.done + 400 && runDate(s.anchor, s.frequency, k, closed) <= s.endsOn; k++) n++;
  return n;
}
/** The next `count` payment dates from payment number `from`, never past the end. */
export function upcoming(s: Counting, from: number, count: number, closed: readonly string[] = []) {
  const left = remaining(s, closed), out: string[] = [];
  for (let k = from; out.length < count && (left === null || k < s.done + left); k++) out.push(runDate(s.anchor, s.frequency, k, closed));
  return out;
}

export type ChangeState = "ok" | "running" | "cutoff";
/**
 * Whether an active schedule can still be changed. On the day of the next payment it is "running now". Before that, changes close at 18:00
 * (09:00 when `strict`) on the business day before the next payment.
 */
export function changeState(nextRunOn: string, now: number, strict: boolean, closed: readonly string[] = []): ChangeState {
  if (nextRunOn <= isoOf(now)) return "running";
  const closes = msOf(prevOpen(nextRunOn, closed)) + (strict ? STRICT_CUTOFF_HOUR : CUTOFF_HOUR) * 3_600_000;
  return now >= closes ? "cutoff" : "ok";
}

/** The amount as the schedule says it: a fixed amount, or the bill the biller sends. */
export const amountText = (mode: AmountMode, amount: number | null, currency: string) => (mode === "full" ? "Full bill" : mode === "minimum" ? "Minimum due" : money(amount ?? 0, currency));
/** The line a list shows for a schedule. */
export const scheduleLine = (name: string, freq: Freq, next: string, mode: AmountMode, amount: number | null, currency: string) => `${name} · ${FREQUENCIES[freq].name}, ${dayName(next)}, ${amountText(mode, amount, currency)}`;
