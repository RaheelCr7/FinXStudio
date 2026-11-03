import { useEffect, useId, useRef, useState } from "react";
import type { DateFieldProps } from "../props";
import { displayDate, isoOf, limitIso, monthGrid, monthName, parseIso, shiftMonth, spokenDate, todayIso, weekdayNames, withinLimits } from "../calendar";
import { Icon } from "./Icon";

const WORDS = { open: "Choose a date", prevMonth: "Previous month", nextMonth: "Next month", prevYear: "Previous year", nextYear: "Next year" };

/** A date field with a calendar that opens under it. Month and year can be stepped, so a birth date is a few presses, not hundreds. */
export function DateField({ label, value = "", onChange, min, max, placeholder, error, helper, look = "standard", lang = "en", strings = WORDS, weekStart = 0 }: DateFieldProps) {
  const id = useId();
  const now = todayIso();
  const lo = limitIso(min), hi = limitIso(max);
  const chosen = parseIso(value);
  // the calendar opens on the chosen month, else on the latest allowed month before today
  const start = chosen ?? parseIso(hi && hi < now ? hi : lo && lo > now ? lo : now)!;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState({ year: start.y, month: start.m });
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) box.current?.querySelector<HTMLButtonElement>("button[aria-pressed=true], button.is-today:not(:disabled), .fxc-cal-day:not(:disabled)")?.focus(); }, [open]);
  const outlined = look === "outlined";
  const move = (months: number) => setView((v) => shiftMonth(v.year, v.month, months));
  const weeks = monthGrid(view.year, view.month, weekStart);
  const describedBy = [helper ? `${id}-help` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`fxc-field ${outlined ? "is-outlined" : ""}`} onKeyDown={(e) => { if (e.key === "Escape" && open) { e.stopPropagation(); setOpen(false); } }}>
      <span id={`${id}-label`} className={outlined ? "fxc-sr" : "fxc-label"}>{label}</span>
      <button type="button" id={id} className={`fxc-input fxc-date-btn ${error ? "has-error" : ""}`} aria-haspopup="dialog" aria-expanded={open} aria-labelledby={`${id}-label ${id}`} aria-invalid={error ? true : undefined} aria-describedby={describedBy} onClick={() => setOpen(!open)}>
        <span className={value ? "" : "fxc-date-empty"}>{value ? displayDate(value) : placeholder ?? (outlined ? label : "DD / MM / YYYY")}</span>
        <Icon name="calendar" size={18} />
      </button>
      {open ? (
        <div ref={box} className="fxc-cal" role="dialog" aria-label={strings.open}>
          <div className="fxc-cal-head">
            <button type="button" className="fxc-cal-nav" aria-label={strings.prevYear} onClick={() => move(-12)}>«</button>
            <button type="button" className="fxc-cal-nav" aria-label={strings.prevMonth} onClick={() => move(-1)}>‹</button>
            <span className="fxc-cal-title" aria-live="polite">{monthName(lang, view.month)} {view.year}</span>
            <button type="button" className="fxc-cal-nav" aria-label={strings.nextMonth} onClick={() => move(1)}>›</button>
            <button type="button" className="fxc-cal-nav" aria-label={strings.nextYear} onClick={() => move(12)}>»</button>
          </div>
          <div className="fxc-cal-week" aria-hidden>{weekdayNames(lang, weekStart).map((d, i) => <span key={i}>{d}</span>)}</div>
          <div className="fxc-cal-grid">
            {weeks.flat().map((d) => {
              const ok = withinLimits(d.iso, lo, hi);
              return (
                <button key={d.iso} type="button" className={`fxc-cal-day ${d.inMonth ? "" : "is-out"} ${d.iso === now ? "is-today" : ""}`} disabled={!ok} aria-pressed={d.iso === value} aria-label={spokenDate(lang, d.iso)}
                  onClick={() => { onChange?.(d.iso); setOpen(false); }}>{d.day}</button>
              );
            })}
          </div>
        </div>
      ) : null}
      {helper ? <p id={`${id}-help`} className="fxc-help">{helper}</p> : null}
      {error ? <p id={`${id}-error`} className="fxc-error" role="alert">{error}</p> : null}
    </div>
  );
}
export { isoOf };
