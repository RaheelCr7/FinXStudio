import { describe, it, expect, beforeAll } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Journey, corporatePayment } from "@finx/journey-schema";
import { cleanEvent, eventsFor, funnel, recordEvents, type AnalyticsEvent } from "./analytics";

beforeAll(() => { process.env.FINX_DATA_DIR = mkdtempSync(path.join(tmpdir(), "finx-an-")); });

const j = Journey.parse(corporatePayment);
const end = j.screens.find((s) => s.kind === "terminal")!.id;
const [first, second] = j.screens.filter((s) => (s.kind ?? "screen") === "screen").map((s) => s.id) as [string, string];
let t = 0;
const ev = (session: string, type: AnalyticsEvent["type"], screen: string, extra: Partial<AnalyticsEvent> = {}): AnalyticsEvent => ({ type, session, slug: j.slug, version: 1, lang: "en", at: new Date(Date.UTC(2026, 10, 3, 10, 0, t++)).toISOString(), screen, source: "preview", ...extra });

describe("funnel", () => {
  it("counts who reached each screen, who finished and where the rest left", () => {
    const events = [
      ev("a", "screen", first), ev("a", "screen", second), ev("a", "screen", end),
      ev("b", "screen", first), ev("b", "screen", second),
      ev("c", "screen", first),
      ev("d", "screen", first), ev("d", "screen", second),
    ];
    const f = funnel(j, events);
    expect(f.starts).toBe(4);
    expect(f.finished).toBe(1); expect(f.finishedPct).toBe(25);
    expect(f.left).toBe(3); expect(f.leftPct).toBe(75);
    const by = (id: string) => f.steps.find((s) => s.screen === id)!;
    expect(by(first)).toMatchObject({ reached: 4, pct: 100, leftHere: 1 });
    expect(by(second)).toMatchObject({ reached: 3, pct: 75, leftHere: 2 });
    expect(by(end)).toMatchObject({ reached: 1, pct: 25, leftHere: 0 });
    expect(f.biggestLeak).toMatchObject({ screen: second, leftHere: 2 });
    expect(f.endings).toEqual([{ screen: end, title: expect.any(String), count: 1 }]);
  });

  it("counts a screen once per run even when the person comes back to it, and uses the last screen to decide where they left", () => {
    const f = funnel(j, [ev("a", "screen", first), ev("a", "screen", second), ev("a", "back", second), ev("a", "screen", first)]);
    expect(f.steps.find((s) => s.screen === first)).toMatchObject({ reached: 1, leftHere: 1 });
    expect(f.steps.find((s) => s.screen === second)).toMatchObject({ reached: 1, backs: 1, leftHere: 0 });
  });

  it("shows which fields people get wrong and which bank calls fail", () => {
    const f = funnel(j, [
      ev("a", "screen", first), ev("a", "invalid", first, { fields: ["pay.amount"] }), ev("a", "invalid", first, { fields: ["pay.amount", "pay.reference"] }),
      ev("b", "screen", first), ev("b", "apiError", first, { integration: "payInitiate", code: "ERR-1" }), ev("b", "apiError", first, { integration: "payInitiate", code: "ERR-1" }),
    ]);
    const s = f.steps.find((x) => x.screen === first)!;
    expect(s.mistakes).toBe(2);
    expect(s.topFields[0]).toEqual({ field: "pay.amount", count: 2 });
    expect(s.failures).toEqual([{ integration: "payInitiate", code: "ERR-1", count: 2 }]);
  });

  it("is empty and does not divide by zero with no runs", () => {
    const f = funnel(j, []);
    expect(f).toMatchObject({ starts: 0, finishedPct: 0, leftPct: 0, biggestLeak: null, versions: [] });
  });
});

describe("recording", () => {
  it("keeps only known fields and drops malformed events", async () => {
    expect(cleanEvent({ type: "screen", session: "s", slug: j.slug, version: 1, lang: "en", at: "2026-11-03T10:00:00Z", screen: first, answers: { pin: "1234" } }, "preview")).not.toHaveProperty("answers");
    expect(cleanEvent({ type: "hack", session: "s", slug: "x", at: "2026-11-03T10:00:00Z", screen: "a" }, "preview")).toBeNull();
    expect(cleanEvent({ type: "screen", session: "s", slug: "x", at: "not a date", screen: "a" }, "preview")).toBeNull();
    expect(cleanEvent("nope", "preview")).toBeNull();
    const n = await recordEvents([ev("z", "screen", first), { junk: true }], "preview");
    expect(n).toBe(1);
    expect((await eventsFor(j.slug)).length).toBe(1);
    expect(await eventsFor(j.slug, { source: "uat" })).toEqual([]);
  });
});
