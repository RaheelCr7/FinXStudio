export type TimelineState = "done" | "current" | "upcoming" | "failed";
export type TimelineEntry = { id: string; title: string; text?: string; time?: string; state: TimelineState };

export const TIMELINE_STATES: TimelineState[] = ["done", "current", "upcoming", "failed"];
export const timelineState = (v: unknown): TimelineState => (TIMELINE_STATES.includes(v as TimelineState) ? (v as TimelineState) : "done");
