export type PillTone = "neutral" | "positive" | "negative" | "accent" | "cyan";

/** A small rounded label, in a tone. */
export const Pill = ({ children, tone = "neutral", className }: { children: React.ReactNode; tone?: PillTone; className?: string }) => <span className={`fx-pill fx-pill-${tone} ${className ?? ""}`}>{children}</span>;

export function ProgressBar({ value, max, tone = "positive", label }: { value: number; max: number; tone?: "positive" | "warning" | "negative"; label: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div className="fx-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)}>
      <div className={`fx-progress-bar fx-progress-${tone}`} style={{ inlineSize: `${pct * 100}%` }} />
    </div>
  );
}
