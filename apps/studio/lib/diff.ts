import type { Journey } from "@finx/journey-schema";

const text = (t: any): string => (typeof t === "string" ? t : t?.en ?? Object.values(t ?? {})[0] ?? "");
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** A few plain sentences about what differs between two versions of a journey, for the history list. Empty when they match. */
export function describeChanges(from: Journey, to: Journey): string[] {
  const out: string[] = [];
  if (!same(from.name, to.name)) out.push(`Name: "${text(from.name)}" → "${text(to.name)}"`);
  if (from.entryScreen !== to.entryScreen) out.push("The start screen is different");
  if (!same(from.apps ?? [], to.apps ?? [])) out.push("It is shown in different projects");
  if (!same(from.integrations, to.integrations)) out.push("Bank calls (integrations) differ");

  const a = new Map(from.screens.map((s) => [s.id, s])), b = new Map(to.screens.map((s) => [s.id, s]));
  const added = to.screens.filter((s) => !a.has(s.id)), removed = from.screens.filter((s) => !b.has(s.id));
  if (added.length) out.push(`${plural(added.length, "screen")} added: ${added.map((s) => text(s.title)).join(", ")}`);
  if (removed.length) out.push(`${plural(removed.length, "screen")} removed: ${removed.map((s) => text(s.title)).join(", ")}`);
  for (const [id, s] of b) {
    const old = a.get(id);
    if (!old || same(old, s)) continue;
    const d = s.blocks.length - old.blocks.length;
    out.push(d > 0 ? `${text(s.title)}: ${plural(d, "block")} added` : d < 0 ? `${text(s.title)}: ${plural(-d, "block")} removed` : same(old.blocks, s.blocks) ? `${text(s.title)}: title, type or next-screen rules changed` : `${text(s.title)}: blocks edited`);
  }
  if (!out.length && !same(from, to)) out.push("Small differences (settings or data model)");
  return out;
}
