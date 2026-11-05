export type StatusTone = "positive" | "warning" | "negative" | "info" | "neutral";
export const STATUS_TONES: StatusTone[] = ["positive", "warning", "negative", "info", "neutral"];

/** Words the sandbox and the journeys already use for where something stands, and the tone each one gets. Anything else is neutral. */
const KNOWN: Record<string, StatusTone> = {
  paid: "positive", released: "positive", settled: "positive", approved: "positive", active: "positive", completed: "positive", complete: "positive", success: "positive", done: "positive", ready: "positive", verified: "positive", accepted: "positive",
  pending: "warning", pending_approval: "warning", waiting: "warning", awaiting: "warning", in_review: "warning", needs_fixing: "warning", attention: "warning",
  rejected: "negative", failed: "negative", declined: "negative", overdue: "negative", blocked: "negative", error: "negative", expired: "negative", refused: "negative",
  processing: "info", scheduled: "info", submitted: "info", new: "info", sent: "info", in_progress: "info",
  withdrawn: "neutral", cancelled: "neutral", canceled: "neutral", draft: "neutral", closed: "neutral", inactive: "neutral",
};
/** The icon next to the words, so a status never relies on its colour alone. */
export const TONE_ICON: Record<StatusTone, string> = { positive: "check", warning: "clock", negative: "x", info: "info", neutral: "minus" };

export const isTone = (t: unknown): t is StatusTone => STATUS_TONES.includes(t as StatusTone);
/** "pending_approval" as a person reads it: "Pending approval". */
export const humanize = (value: unknown): string => {
  const t = String(value ?? "").trim().replace(/[_-]+/g, " ");
  return t ? t[0]!.toUpperCase() + t.slice(1) : "";
};

export type StatusChipView = { label: string; tone: StatusTone; icon: string };
/** The chip for a status value. `label` and `tone` replace the defaults (the journey writes its own words, in its own language). */
export function statusChip(value: unknown, over: { label?: string; tone?: unknown } = {}): StatusChipView {
  const key = String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const tone = isTone(over.tone) ? over.tone : KNOWN[key] ?? "neutral";
  return { label: over.label ?? humanize(value), tone, icon: TONE_ICON[tone] };
}
