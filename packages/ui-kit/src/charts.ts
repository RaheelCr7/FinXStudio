/** Chart maths shared by every renderer: the numbers (points, paths, arcs) are worked out here and each platform only draws them. */

export type ChartPoint = { label: string; value: number };

/** Smooth path through the points (Catmull-Rom converted to cubic Béziers). */
export function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  let d = `M${pts[0]!.x} ${pts[0]!.y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!, p1 = pts[i]!, p2 = pts[i + 1]!, p3 = pts[i + 2] ?? p2;
    d += ` C${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6} ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6} ${p2.x} ${p2.y}`;
  }
  return d;
}

export const LINE_PAD = { x: 14, y: 16 };

/** Where each point sits in a chart of the given size, the line through them, and the filled area under it. */
export function lineGeometry(data: ChartPoint[], width: number, height: number, pad = LINE_PAD) {
  const vals = data.map((d) => d.value), lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const pts = data.map((d, i) => ({ x: data.length > 1 ? pad.x + (i / (data.length - 1)) * (width - pad.x * 2) : width / 2, y: pad.y + (1 - (d.value - lo) / span) * (height - pad.y * 2) }));
  const line = smoothPath(pts);
  return { pts, line, area: pts.length ? `${line} L${pts[pts.length - 1]!.x} ${height} L${pts[0]!.x} ${height} Z` : "" };
}

/** The point nearest to a horizontal position, for tapping and dragging across a chart. */
export function nearestIndex(x: number, width: number, count: number, padX = LINE_PAD.x): number {
  const i = Math.round(((x - padX) / Math.max(1, width - padX * 2)) * (count - 1));
  return Math.min(count - 1, Math.max(0, i));
}

export type DonutSegment = { label: string; value: number; color: string };

/** Arcs of a ring chart, as dash lengths along a circle. A gap equal to the stroke is left between arcs, because round caps reach past each end. */
export function donutArcs(segments: DonutSegment[], size: number, thickness: number) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const R = (size - thickness) / 2, C = 2 * Math.PI * R, gap = segments.length > 1 ? thickness : 0;
  let acc = 0;
  const arcs = segments.map((s, i) => {
    const len = (s.value / total) * C, start = acc; acc += len;
    const dash = Math.max(0, len - gap);
    return { index: i, segment: s, start, len, dash, dasharray: `${dash} ${C - dash}`, offset: -start };
  });
  return { total, R, C, arcs };
}

/** Which arc a point (relative to the chart's top-left) falls on: its index, or null for a point off the ring. */
export function donutHit(x: number, y: number, size: number, thickness: number, ring: ReturnType<typeof donutArcs>): number | null {
  const dx = x - size / 2, dy = y - size / 2, dist = Math.hypot(dx, dy);
  if (dist < ring.R - thickness || dist > ring.R + thickness) return null;
  let ang = Math.atan2(dy, dx) + Math.PI / 2; if (ang < 0) ang += 2 * Math.PI;
  const at = (ang / (2 * Math.PI)) * ring.C;
  return ring.arcs.find((a) => at >= a.start && at < a.start + a.len)?.index ?? null;
}
