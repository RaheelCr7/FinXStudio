/**
 * The AI assistant page without a browser: the guided brief for a new journey, the starter templates, how old a run is,
 * and the first line of a run's summary. Pure functions so the page stays thin and this stays tested.
 */
import { languageInfo } from "@finx/ui-kit";

export type JourneyBrief = { goal: string; steps: string; rules: string; fails: string; languages: string };
export const EMPTY_BRIEF: JourneyBrief = { goal: "", steps: "", rules: "", fails: "", languages: "" };

/** "English and Arabic" from a project's language codes; unknown codes are kept as they are. */
export function languageNames(codes: readonly string[] | undefined): string {
  const names = (codes ?? []).map((c) => languageInfo(c)?.name ?? c);
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** Trimmed, one space between words, a capital to start and a full stop to end. */
const sentence = (s: string) => { const t = s.trim().replace(/\s+/g, " "); if (!t) return ""; const c = t[0]!.toUpperCase() + t.slice(1); return /[.!?]$/.test(c) ? c : `${c}.`; };

/**
 * One brief from the guided fields, in the shape the journey skill reads best: what the customer does, the steps, the
 * rules, the failure cases, the languages, and what to prove. Only the goal is needed; empty parts are left out.
 */
export function composeJourneyBrief(b: JourneyBrief): string {
  const goal = sentence(b.goal);
  if (!goal) return "";
  const parts = [goal];
  if (b.steps.trim()) parts.push(`Steps: ${sentence(b.steps)}`);
  if (b.rules.trim()) parts.push(`Rules: ${sentence(b.rules)}`);
  if (b.fails.trim()) parts.push(`If it fails: ${sentence(b.fails)}`);
  if (b.languages.trim()) parts.push(`Languages: ${sentence(b.languages)}`);
  parts.push("Prove it in the sandbox: the happy path, a blocked input, a failure path, and the whole flow in each language.");
  return parts.join(" ");
}

export type Template = { id: string; label: string; brief: Omit<JourneyBrief, "languages"> };
/** Starters for the journeys every bank asks for first. Languages come from the project, so a template never sets them. */
export const TEMPLATES: Template[] = [
  { id: "sign-in", label: "Sign in", brief: {
    goal: "Sign in with username and password",
    steps: "Username and password, then the dashboard on success; a Forgot password link on the first screen",
    rules: "Show attempts left after a wrong password and lock the profile after five wrong tries",
    fails: "A locked profile, an expired password that must be changed, and a profile not yet activated each get their own screen",
  } },
  { id: "pay-a-bill", label: "Pay a bill", brief: {
    goal: "Pay a utility bill from an account",
    steps: "Pick the company, enter the reference, look the bill up, review it, tick consent, confirm with a one-time code, see a receipt",
    rules: "Only unpaid bills can be paid; the account must have enough balance",
    fails: "Already paid, no balance, or the bank unavailable: say so clearly and move no money",
  } },
  { id: "send-money", label: "Send money", brief: {
    goal: "Send money to a saved payee",
    steps: "Choose the payee and the account, enter the amount and a note, review, tick consent, confirm with a one-time code, see a receipt",
    rules: "A daily limit checked before the review; three wrong one-time codes lock the payment",
    fails: "No balance, over the limit, or the bank unavailable: say so and move no money",
  } },
];

/** "just now", "12 min ago", "3 h ago", "2 days ago"; older than a month, the date. */
export function ageOf(iso: string, nowMs: number): string {
  const ms = nowMs - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 60_000) return "just now";
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d < 31) return `${d} day${d === 1 ? "" : "s"} ago`;
  return iso.slice(0, 10);
}

/** A run that still says "running" but has not reported for an hour has most likely stopped. */
export const STALE_AFTER_MS = 60 * 60_000;
export const isStale = (status: string, updatedAt: string, nowMs: number) => status === "running" && nowMs - Date.parse(updatedAt) > STALE_AFTER_MS;

/** The first sentence or line of a run's summary, to show on its card; the rest stays for the run's page. */
export function outcomeOf(summary: string | undefined, max = 160): string {
  const first = (summary ?? "").trim().split(/\n/)[0] ?? "";
  const m = first.match(/^(.{20,}?[.!?])\s/);
  const line = m ? m[1]! : first;
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}
