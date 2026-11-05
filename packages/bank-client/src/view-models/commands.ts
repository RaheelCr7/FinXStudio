import type { Link } from "../links";
import { launchPointsFor, tabOfPlace, type LaunchContext, type LaunchPoint } from "../launch-points";
import { roleBadge, type ContextInfo } from "../session";
import { menuFor, tabLabel } from "./menus";

/** One line in the command bar (⌘K "Search or go to..."). */
export type Command =
  | { id: string; kind: "go"; label: string; hint: string; link: Link }
  | { id: string; kind: "journey"; label: string; hint: string; launch: LaunchPoint }
  | { id: string; kind: "switch"; label: string; hint: string; contextId: string };

/**
 * Everything the command bar can do in the active place: go to a tab it may open, start a journey that needs no values, or switch
 * to another place. It follows the same permissions and bank settings as the buttons, so the bar never offers what a screen would hide.
 */
export function commandsFor(ctx: LaunchContext, contexts: ContextInfo[]): Command[] {
  const active = ctx.context;
  if (!active) return [];
  const companyId = active.workspace === "business" ? active.id : undefined;
  const out: Command[] = [];
  for (const m of menuFor(active)) if (m.allowed) out.push({ id: `go:${m.id}`, kind: "go", label: m.label, hint: "Go to", link: { workspace: active.workspace, ...(companyId ? { companyId } : {}), tab: m.id } as Link });
  const seen = new Set<string>();
  for (const lp of launchPointsFor(ctx)) {
    if (lp.passes.length > 0) continue;
    const key = `${lp.journey}:${JSON.stringify(lp.fixed ?? {})}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: `journey:${lp.id}`, kind: "journey", label: lp.label, hint: tabLabel(active.workspace, tabOfPlace(lp.place)), launch: lp });
  }
  for (const c of contexts) if (c.id !== active.id) out.push({ id: `switch:${c.id}`, kind: "switch", label: c.workspace === "business" ? c.label : "Personal", hint: c.workspace === "business" ? `Switch · ${roleBadge(c)}` : "Switch", contextId: c.id });
  return out;
}

/** The commands matching what was typed: every word must appear, labels that start with the text come first. Empty text lists the first few. */
export function filterCommands(all: Command[], query: string, limit = 8): Command[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return all.slice(0, limit);
  const text = (c: Command) => `${c.label} ${c.hint}`.toLowerCase();
  return all.filter((c) => words.every((w) => text(c).includes(w)))
    .sort((a, b) => Number(b.label.toLowerCase().startsWith(words[0]!)) - Number(a.label.toLowerCase().startsWith(words[0]!)))
    .slice(0, limit);
}
