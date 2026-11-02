"use client";

/** A row of options of which one is chosen (time ranges, sections). Real radio inputs: arrow keys move between them. */
export function Segmented<T extends string>({ options, value, onChange, label, dark }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; label: string; dark?: boolean }) {
  return (
    <div className={`fx-seg ${dark ? "is-dark" : ""}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <label key={o.id} className={`fx-seg-item ${o.id === value ? "is-on" : ""}`}>
          <input type="radio" className="fx-radio-input" name={`seg-${label}`} checked={o.id === value} onChange={() => onChange(o.id)} aria-label={o.label} />
          <span aria-hidden>{o.label}</span>
        </label>
      ))}
    </div>
  );
}
