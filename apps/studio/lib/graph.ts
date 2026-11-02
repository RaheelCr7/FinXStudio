import type { Journey } from "@finx/journey-schema";

export type FlowEdge = { id: string; from: string; to: string; label: string; kind: "flow" | "rule" | "error" };

const textOf = (t: any): string => (typeof t === "string" ? t : t?.en ?? Object.values(t ?? {})[0] ?? "");

/** All navigation edges of a journey: button navigate actions, screen rules, default, and error exits. */
export function buildEdges(j: Journey): FlowEdge[] {
  const out: FlowEdge[] = [];
  const seen = new Set<string>();
  const add = (from: string, to: string | undefined, kind: FlowEdge["kind"], label: string) => {
    if (!to) return;
    const id = `${from}>${to}:${kind}`;
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ id, from, to, kind, label });
  };
  for (const s of j.screens) {
    for (const r of s.navigation?.rules ?? []) add(s.id, r.to, "rule", r.when);
    add(s.id, s.navigation?.default, "flow", "");
    const walk = (a: any, label: string) => {
      if (a?.type === "navigate") add(s.id, a.to, "flow", label);
      if (a?.type === "callApi" && a.onError) {
        add(s.id, a.onError.navigate, "error", "on error");
        add(s.id, a.onError.lockTo, "error", `locked after ${a.onError.lockAfter ?? "?"}`);
      }
    };
    s.onEnter?.forEach((a) => walk(a, ""));
    for (const b of s.blocks as any[]) {
      if (b.type === "button") b.actions.forEach((a: any) => walk(a, textOf(b.label)));
      if (b.type === "otp") b.onResend?.forEach((a: any) => walk(a, ""));
    }
  }
  return out;
}

/** Layered top-to-bottom layout from the entry screen; unreachable screens go in a final column. */
export function layout(j: Journey, gapX = 250, gapY = 132): Record<string, { x: number; y: number }> {
  const edges = buildEdges(j);
  const level = new Map<string, number>();
  const queue = [j.entryScreen];
  level.set(j.entryScreen, 0);
  while (queue.length) {
    const id = queue.shift()!;
    for (const e of edges) if (e.from === id && !level.has(e.to)) { level.set(e.to, level.get(id)! + 1); queue.push(e.to); }
  }
  const maxLevel = Math.max(0, ...level.values());
  for (const s of j.screens) if (!level.has(s.id)) level.set(s.id, maxLevel + 1);
  const rows = new Map<number, number>();
  const pos: Record<string, { x: number; y: number }> = {};
  for (const s of j.screens) {
    const l = level.get(s.id)!;
    const r = rows.get(l) ?? 0;
    rows.set(l, r + 1);
    pos[s.id] = { x: r * gapX, y: l * gapY };
  }
  return pos;
}

export type Shape = { nodes: { id: string; x: number; y: number; kind: string; entry: boolean }[]; edges: { from: string; to: string; kind: FlowEdge["kind"] }[] };

/** A small left-to-right sketch of a journey's flow, for thumbnails on the journeys list. */
export function shapeOf(j: Journey): Shape {
  const pos = layout(j, 1, 1);
  const ids = new Set(j.screens.map((s) => s.id));
  return {
    nodes: j.screens.map((s) => ({ id: s.id, x: pos[s.id]!.y, y: pos[s.id]!.x, kind: s.kind ?? "screen", entry: s.id === j.entryScreen })),
    edges: buildEdges(j).filter((e) => ids.has(e.from) && ids.has(e.to)).map((e) => ({ from: e.from, to: e.to, kind: e.kind })),
  };
}
