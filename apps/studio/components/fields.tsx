"use client";
import type { Journey } from "@finx/journey-schema";
import { setLoc, textOf } from "@/lib/edit";

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="field">{label}{children}{hint ? <span className="faint" style={{ fontWeight: 400 }}>{hint}</span> : null}</label>;
}

/** English + Urdu inputs for a localized string. A plain string stays plain until a translation is typed. */
export function Loc({ label, value, journey, onChange, multiline }: { label: string; value: any; journey: Journey; onChange: (v: any) => void; multiline?: boolean }) {
  const supported = journey.locale.supported;
  const get = (l: string) => (typeof value === "string" ? (l === "en" ? value : "") : value?.[l] ?? "");
  const set = (l: string, v: string) => onChange(setLoc(value, l, v, supported));
  const missing = supported.filter((l) => l !== "en" && typeof value === "object" && value && !(l in value));
  const El: any = multiline ? "textarea" : "input";
  return (
    <div className="stack" style={{ gap: 6 }}>
      <Field label={label}><El className={multiline ? "textarea" : "input"} value={get("en")} onChange={(e: any) => set("en", e.target.value)} /></Field>
      {supported.includes("ur") ? (
        <Field label="اردو" hint={missing.length ? "Translation missing" : undefined}>
          <El className={multiline ? "textarea" : "input"} dir="rtl" value={get("ur")} placeholder="اردو ترجمہ" onChange={(e: any) => set("ur", e.target.value)} />
        </Field>
      ) : null}
    </div>
  );
}

export function ScreenSelect({ journey, value, onChange, allowNone, label }: { journey: Journey; value?: string; onChange: (v: string | undefined) => void; allowNone?: boolean; label: string }) {
  return (
    <Field label={label}>
      <select className="select" value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)}>
        {allowNone ? <option value="">None</option> : null}
        {value && !journey.screens.some((s) => s.id === value) ? <option value={value}>{value} (missing)</option> : null}
        {journey.screens.map((s) => <option key={s.id} value={s.id}>{textOf(s.title)} · {s.id}</option>)}
      </select>
    </Field>
  );
}

export function BindField({ journey, value, onChange }: { journey: Journey; value: string; onChange: (v: string) => void }) {
  const id = "binds";
  return (
    <Field label="Binds to (data path)">
      <input className="input mono" list={id} value={value} onChange={(e) => onChange(e.target.value.replace(/\s/g, ""))} />
      <datalist id={id}>{Object.keys(journey.dataModel ?? {}).map((k) => <option key={k} value={k} />)}</datalist>
    </Field>
  );
}
