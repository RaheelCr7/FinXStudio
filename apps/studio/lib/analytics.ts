import { promises as fs } from "node:fs";
import path from "node:path";
import type { Journey } from "@finx/journey-schema";

/** One thing that happened during a play-through, as the players report it. Never holds answers or personal data. */
export type AnalyticsEvent = {
  type: "screen" | "invalid" | "apiError" | "back" | "exit";
  session: string; slug: string; version: number; lang: string; at: string; screen: string;
  kind?: "screen" | "branch" | "terminal"; fields?: string[]; integration?: string; code?: string;
  /** where it was played: the Studio preview (sandbox data) or a real app */
  source: string;
};
const CAP = 20000;
const file = () => path.join(process.env.FINX_DATA_DIR ?? path.join(process.cwd(), ".data"), "analytics.json");
const TYPES = new Set(["screen", "invalid", "apiError", "back", "exit"]);

/** Keeps only the fields we know, with sane sizes, so a bad client cannot fill the file or smuggle data in. */
export function cleanEvent(x: any, source: string): AnalyticsEvent | null {
  if (!x || typeof x !== "object" || !TYPES.has(x.type)) return null;
  const s = (v: unknown, n = 80) => (typeof v === "string" ? v.slice(0, n) : "");
  const e: AnalyticsEvent = { type: x.type, session: s(x.session, 40), slug: s(x.slug), version: Number.isFinite(x.version) ? Number(x.version) : 0, lang: s(x.lang, 10), at: s(x.at, 30), screen: s(x.screen), source: s(source, 20) };
  if (!e.session || !e.slug || !e.screen || Number.isNaN(Date.parse(e.at))) return null;
  if (x.kind === "screen" || x.kind === "branch" || x.kind === "terminal") e.kind = x.kind;
  if (Array.isArray(x.fields)) e.fields = x.fields.slice(0, 20).map((f: unknown) => s(f));
  if (x.type === "apiError") { e.integration = s(x.integration); e.code = s(x.code, 40); }
  return e;
}

let chain: Promise<unknown> = Promise.resolve();
async function read(): Promise<AnalyticsEvent[]> {
  try { const a = JSON.parse(await fs.readFile(file(), "utf8")); return Array.isArray(a) ? a : []; } catch { return []; }
}
/** Adds events (serialised, capped). Returns how many were kept. */
export function recordEvents(raw: unknown[], source: string): Promise<number> {
  const events = raw.map((x) => cleanEvent(x, source)).filter((e): e is AnalyticsEvent => !!e);
  const done = chain.then(async () => {
    if (!events.length) return 0;
    const all = await read();
    all.push(...events);
    await fs.mkdir(path.dirname(file()), { recursive: true });
    await fs.writeFile(file(), JSON.stringify(all.slice(-CAP)));
    return events.length;
  });
  chain = done.catch(() => undefined);
  return done;
}
export async function eventsFor(slug: string, opts: { source?: string; version?: number } = {}): Promise<AnalyticsEvent[]> {
  return (await read()).filter((e) => e.slug === slug && (!opts.source || e.source === opts.source) && (opts.version == null || e.version === opts.version));
}
export async function clearEvents(slug: string): Promise<void> {
  const done = chain.then(async () => { const all = (await read()).filter((e) => e.slug !== slug); await fs.writeFile(file(), JSON.stringify(all)); });
  chain = done.catch(() => undefined);
  return done;
}

/* ------------------------------------------------------------------------------------------ the funnel */

export type FunnelStep = {
  screen: string; title: string; kind: "screen" | "branch" | "terminal";
  /** play-throughs that reached this screen, and the share of all starts */
  reached: number; pct: number;
  /** play-throughs whose last screen was this one without finishing: they left here */
  leftHere: number; leftPct: number;
  /** mistakes shown on this screen (validation failures), and the fields that caused most of them */
  mistakes: number; topFields: { field: string; count: number }[];
  /** times people stepped back from this screen */
  backs: number;
  /** bank calls that failed on this screen */
  failures: { integration: string; code: string; count: number }[];
};
export type Funnel = {
  starts: number;
  /** how play-throughs ended, by end screen; "left" is everyone who stopped on a screen that is not an end screen */
  finished: number; finishedPct: number; left: number; leftPct: number;
  endings: { screen: string; title: string; count: number }[];
  steps: FunnelStep[];
  /** the screen where most people leave, if anyone left */
  biggestLeak: { screen: string; title: string; leftHere: number } | null;
  versions: number[];
  from?: string; to?: string;
};

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);
const titleOf = (j: Journey, s: any): string => { const t = s.title; return typeof t === "string" ? t : t?.en ?? s.id; };

/** Turns the raw events of one journey into a funnel over its screens. Pure: the same events always give the same funnel. */
export function funnel(journey: Journey, events: AnalyticsEvent[]): Funnel {
  const by = new Map<string, AnalyticsEvent[]>();
  for (const e of events) { const l = by.get(e.session) ?? []; l.push(e); by.set(e.session, l); }
  const screens = new Map(journey.screens.map((s) => [s.id, s]));
  const isEnd = (id: string) => (screens.get(id)?.kind ?? "screen") === "terminal";

  const reached = new Map<string, number>(), leftHere = new Map<string, number>(), mistakes = new Map<string, number>(), backs = new Map<string, number>();
  const fields = new Map<string, Map<string, number>>(), fails = new Map<string, Map<string, number>>(), endings = new Map<string, number>();
  const bump = (m: Map<string, number>, k: string, n = 1) => m.set(k, (m.get(k) ?? 0) + n);
  let starts = 0, finished = 0, left = 0;
  const versions = new Set<number>();

  for (const evs of by.values()) {
    const ordered = [...evs].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    const views = ordered.filter((e) => e.type === "screen");
    if (!views.length) continue;
    starts++;
    for (const e of ordered) versions.add(e.version);
    for (const id of new Set(views.map((e) => e.screen))) bump(reached, id);
    for (const e of ordered) {
      if (e.type === "invalid") { bump(mistakes, e.screen); for (const f of e.fields ?? []) { const m = fields.get(e.screen) ?? new Map(); bump(m, f); fields.set(e.screen, m); } }
      if (e.type === "back") bump(backs, e.screen);
      if (e.type === "apiError") { const m = fails.get(e.screen) ?? new Map(); bump(m, `${e.integration}\u0000${e.code}`); fails.set(e.screen, m); }
    }
    const last = views[views.length - 1]!.screen;
    if (isEnd(last)) { finished++; bump(endings, last); } else { left++; bump(leftHere, last); }
  }

  const steps: FunnelStep[] = journey.screens.map((s) => ({
    screen: s.id, title: titleOf(journey, s), kind: s.kind ?? "screen",
    reached: reached.get(s.id) ?? 0, pct: pct(reached.get(s.id) ?? 0, starts),
    leftHere: leftHere.get(s.id) ?? 0, leftPct: pct(leftHere.get(s.id) ?? 0, starts),
    mistakes: mistakes.get(s.id) ?? 0,
    topFields: [...(fields.get(s.id) ?? [])].map(([field, count]) => ({ field, count })).sort((a, b) => b.count - a.count).slice(0, 3),
    backs: backs.get(s.id) ?? 0,
    failures: [...(fails.get(s.id) ?? [])].map(([k, count]) => { const [integration, code] = k.split("\u0000"); return { integration: integration!, code: code!, count }; }).sort((a, b) => b.count - a.count),
  }));
  const leak = [...steps].filter((s) => s.leftHere > 0).sort((a, b) => b.leftHere - a.leftHere)[0];
  return {
    starts, finished, finishedPct: pct(finished, starts), left, leftPct: pct(left, starts),
    endings: [...endings].map(([screen, count]) => ({ screen, title: titleOf(journey, screens.get(screen)), count })).sort((a, b) => b.count - a.count),
    steps, biggestLeak: leak ? { screen: leak.screen, title: leak.title, leftHere: leak.leftHere } : null,
    versions: [...versions].sort((a, b) => a - b),
    from: events.length ? events.reduce((m, e) => (e.at < m ? e.at : m), events[0]!.at) : undefined,
    to: events.length ? events.reduce((m, e) => (e.at > m ? e.at : m), events[0]!.at) : undefined,
  };
}
