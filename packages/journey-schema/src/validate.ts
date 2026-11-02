import { Journey } from "./schema";

const fmtPath = (p: ReadonlyArray<string | number | symbol>) =>
  p.map((s, i) => (typeof s === "number" ? `[${s}]` : i ? `.${String(s)}` : String(s))).join("") || "(root)";

export type ValidationResult =
  | { ok: true; journey: Journey; warnings: string[] }
  | { ok: false; errors: string[] };

/** Keys present in the input but dropped by the schema (usually typos such as `placeholdr`). */
export function strippedKeys(input: unknown, output: unknown, path = ""): string[] {
  if (Array.isArray(input) && Array.isArray(output)) return input.flatMap((v, i) => strippedKeys(v, output[i], `${path}[${i}]`));
  if (input && output && typeof input === "object" && typeof output === "object" && !Array.isArray(input) && !Array.isArray(output)) {
    const out: string[] = [];
    for (const k of Object.keys(input as object)) {
      const p = path ? `${path}.${k}` : k;
      if (!(k in (output as object))) out.push(p);
      else out.push(...strippedKeys((input as any)[k], (output as any)[k], p));
    }
    return out;
  }
  return [];
}

/** Validate untrusted journey JSON. Reports every schema error with its path, and warns about silently ignored keys. */
export function validateJourney(input: unknown): ValidationResult {
  const r = Journey.safeParse(input);
  if (!r.success) {
    return { ok: false, errors: r.error.issues.slice(0, 40).map((i) => `${fmtPath(i.path)}: ${i.message}`) };
  }
  return { ok: true, journey: r.data, warnings: strippedKeys(input, r.data).map((k) => `Unknown field "${k}" is ignored. Check the spelling.`) };
}
