import { ui } from "../strings";

export type CaptureStep = "front" | "back" | "selfie";
export const CAPTURE_STEPS: CaptureStep[] = ["front", "back", "selfie"];
/** What is saved: for each step captured, a reference to the simulated picture. No picture is taken or kept. */
export type IdCaptureValue = Partial<Record<CaptureStep, { ref: string }>>;

export const captureSteps = (steps?: unknown): CaptureStep[] => (Array.isArray(steps) && steps.length ? (steps as CaptureStep[]) : ["front", "selfie"]);

/** The reference for the next capture of a step: SIM-FRONT-1, then SIM-FRONT-2 for a retake. Counted, not timed, so tests repeat. */
export function nextCapture(value: unknown, step: CaptureStep): IdCaptureValue {
  const cur = (value && typeof value === "object" ? value : {}) as IdCaptureValue;
  const n = Number(/-(\d+)$/.exec(cur[step]?.ref ?? "")?.[1] ?? 0) + 1;
  return { ...cur, [step]: { ref: `SIM-${step.toUpperCase()}-${n}` } };
}
export function captureRows(value: unknown, steps: CaptureStep[], lang: string) {
  const cur = (value && typeof value === "object" ? value : {}) as IdCaptureValue;
  return steps.map((id) => ({ id, label: ui(lang, `capture_${id}`), hint: ui(lang, `capture_${id}_hint`), done: !!cur[id], ref: cur[id]?.ref }));
}
/** The steps still to do, as one message, or undefined when all are captured. */
export function captureProblem(lang: string, value: unknown, steps: CaptureStep[]): string | undefined {
  const missing = captureRows(value, steps, lang).filter((r) => !r.done).map((r) => r.label.toLowerCase());
  return missing.length ? ui(lang, "captureMissing", { steps: missing.join(", ") }) : undefined;
}
