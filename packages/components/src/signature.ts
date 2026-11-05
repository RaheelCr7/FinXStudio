export type SignaturePoint = { x: number; y: number };
/** The drawing area is this many units wide and high, whatever size it is drawn at. */
export const PAD = { width: 300, height: 120 };

/** Strokes as one path: "M10 20 L12 24 M40 8 L44 12". Whole numbers, so the saved signature stays small. */
export const strokesToPath = (strokes: SignaturePoint[][]): string =>
  strokes.filter((s) => s.length).map((s) => s.map((p, i) => `${i ? "L" : "M"}${Math.round(p.x)} ${Math.round(p.y)}`).join(" ")).join(" ");
export const strokesFromPath = (path: unknown): SignaturePoint[][] =>
  String(path ?? "").split("M").filter(Boolean).map((seg) => seg.split("L").map((pt) => { const [x, y] = pt.trim().split(/\s+/).map(Number); return { x: x ?? 0, y: y ?? 0 }; }));
export const pointCount = (strokes: SignaturePoint[][]) => strokes.reduce((n, s) => n + s.length, 0);

/** Whether the person has scrolled to the end of a text: within a few pixels of the bottom, or the text fits without scrolling at all. Never true for a box with no size. */
export const reachedEnd = (top: number, visible: number, total: number, slack = 8): boolean =>
  // a box with no size (hidden, or not laid out yet) has shown nothing, so nothing was read
  visible > 0 && total > 0 && (total <= visible + slack || top + visible >= total - slack);
