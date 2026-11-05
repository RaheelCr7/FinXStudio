import { ui } from "../strings";

export type SignatureMode = "type" | "draw";
/** What is saved: a typed name, or the drawn line as a path (and how many points it has). */
export type SignatureValue = { mode: SignatureMode; name?: string; path?: string; points?: number };

/** A drawn signature needs at least this many points: a dot or a short tick is not a signature. */
const MIN_POINTS = 12;

const same = (a: unknown, b: unknown) => String(a ?? "").trim().replace(/\s+/g, " ").toLowerCase() === String(b ?? "").trim().replace(/\s+/g, " ").toLowerCase();

/** What is wrong with a signature, as the message to show, or undefined. `expected` is the name it must match (the person's own name), if the journey knows it. */
export function signatureProblem(lang: string, v: unknown, expected?: string): string | undefined {
  const s = v as SignatureValue | undefined;
  if (!s || typeof s !== "object") return undefined;
  if (s.mode === "draw") return (s.points ?? 0) < MIN_POINTS ? ui(lang, "sigDrawMore") : undefined;
  if (String(s.name ?? "").trim().length < 2) return ui(lang, "sigNameShort");
  if (expected && !same(s.name, expected)) return ui(lang, "sigNameMismatch");
  return undefined;
}
