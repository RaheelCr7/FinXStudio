import type { Journey } from "@finx/journey-schema";
import { textOf } from "./edit";

export type Slide = { id: string; title: string; kind: "screen" | "terminal"; /** a step the customer reaches by an error or a limit rather than by the main path */ ending?: "success" | "failure" };

/** The screens a customer can see, in the order they were made. Branch screens only decide where to go next, so they are left out. */
export function slidesOf(journey: Journey): Slide[] {
  const out: Slide[] = [];
  for (const s of journey.screens) {
    if (s.kind === "branch") continue;
    const result = (s.blocks as any[]).find((b) => b.type === "result");
    out.push({
      id: s.id, title: textOf(s.title) || s.id, kind: s.kind === "terminal" ? "terminal" : "screen",
      ...(s.kind === "terminal" ? { ending: result?.tone === "error" || result?.tone === "failure" ? "failure" as const : "success" as const } : {}),
    });
  }
  return out;
}

/** Position after `i` in a loop of `n` slides (or before, with a negative step). */
export const stepIndex = (i: number, n: number, by = 1) => (n === 0 ? 0 : (((i + by) % n) + n) % n);

const NUMBERY = /(amount|fee|total|price|balance|limit|value|cost|payable|charge|rate)$/i;
const COUNTY = /(count|shares|qty|quantity|units|number)$/i;
const DATEY = /(date|at|time|when)$/i;
const IDY = /(ref|reference|id|code|receipt|token)$/i;
const SYMBOLY = /(symbol|ticker)$/i;

/** A believable value for a placeholder, from the last word of its name. It only has to look right in a picture. */
function sampleFor(path: string): string | number {
  const last = path.split(".").pop() ?? path;
  if (SYMBOLY.test(last)) return "LMRB";
  if (IDY.test(last)) return "FX-20481";
  if (DATEY.test(last)) return new Date().toISOString().slice(0, 10);
  if (NUMBERY.test(last)) return 250;
  if (COUNTY.test(last)) return 5;
  return /name|holder|payee|beneficiary|title|label/i.test(last) ? "Sample name" : "Sample";
}

/**
 * Values for the {{placeholders}} a screen uses, so an end screen reads "You sent PKR 250" in a picture instead of "You sent  ".
 * Anything the journey fills in itself (a callApi's saveAs, and what is inside it) is left alone, so lists still come from the sandbox.
 */
export function sampleAnswers(journey: Journey): Record<string, string | number> {
  const text = JSON.stringify(journey.screens);
  const owned = [...text.matchAll(/"saveAs":"([^"]+)"/g)].map((m) => m[1]!);
  const out: Record<string, string | number> = {};
  for (const m of text.matchAll(/\{\{\s*([A-Za-z_][A-Za-z0-9_.]*)/g)) {
    const path = m[1]!;
    if (owned.some((o) => path === o || path.startsWith(o + "."))) continue;
    out[path] = sampleFor(path);
  }
  return out;
}
