import type { RunStatus } from "./store";

export const STATUS: Record<RunStatus, { label: string; chip: string }> = {
  running: { label: "Running", chip: "chip accent" },
  needs_review: { label: "Needs your review", chip: "chip warn" },
  done: { label: "Done", chip: "chip pos" },
  failed: { label: "Failed", chip: "chip neg" },
};
export const AGENT_LABEL: Record<string, string> = { journey: "Journey agent", review: "Review agent", code: "Code agent", requirements: "Requirements agent" };
/** Deterministic UTC timestamp, so server and browser render the same text. */
export const fmtTime = (iso: string) => iso.slice(0, 16).replace("T", " ") + " UTC";
