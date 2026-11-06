/**
 * The steps every Public journey's scenarios are written with. Tuesday 3 November 2026, 18:45 UTC is the clock the spec pins for opening hours; the visitor is nobody
 * signed in (`signed-out`), so only the adapters a bank answers before sign-in are in play.
 */
export type Step = Record<string, unknown>;
export const set = (v: Record<string, unknown>): Step => ({ set: v });
export const press = (label: string): Step => ({ press: label });
export const text = (t: string): Step => ({ expectText: t });
export const noText = (t: string): Step => ({ expectNoText: t });
export const screen = (s: string): Step => ({ expectScreen: s });
export const error = (m: string): Step => ({ expectError: m });
export const opens = (journey: string, w?: Record<string, unknown>): Step => ({ expectOpens: { journey, ...(w ? { with: w } : {}) } });
export const bank = (adapter: string, path: string, equals: unknown, input?: Record<string, unknown>): Step => ({ expectBank: { adapter, ...(input ? { input } : {}), path, equals } });
export const forced = (adapter: string, input: Record<string, unknown>, code: string): Step => ({ expectBankError: { adapter, input, code } });
export const inspect = (path: string, equals: unknown, input?: Record<string, unknown>): Step => bank("sandbox.public.inspect", path, equals, input);
/** Tuesday 3 November 2026, 18:45 UTC. */
export const TUE = "2026-11-03T18:45:00Z";
export const visitor = { persona: "signed-out", now: TUE };
export const SLOW = "This is taking longer than expected. Nothing was changed.";
/** The bank at home in another market (the sandbox's home market decides the symbol, the unit, the ID format, the proof of address). */
export const home = (m: "uk" | "eu" | "ae") => ({ homeMarket: m });
