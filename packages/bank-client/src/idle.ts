/**
 * The session timeout of the shell (docs: Signing in and security, "Session timeout"). After `idleSeconds` with no tap, key press, scroll or
 * request the person is signed out; `warningSeconds` before that a dialog asks "Still there?". On a phone that was in the background for
 * longer than `idleSeconds` the app is signed out at once, with no warning. Pure: the app passes the clock, so a test never waits.
 */
export const IDLE = { idleSeconds: 300, warningSeconds: 60 } as const;
export type IdleConfig = { idleSeconds: number; warningSeconds: number };

export type IdleState = { phase: "active" } | { phase: "warning"; /** whole seconds until the sign-out */ left: number } | { phase: "out" };
export const ACTIVE: IdleState = { phase: "active" };

/** Where the countdown stands after `lastActivityMs`, at `nowMs`. */
export function idleState(lastActivityMs: number, nowMs: number, cfg: IdleConfig = IDLE): IdleState {
  const quiet = Math.max(0, (nowMs - lastActivityMs) / 1000);
  if (quiet >= cfg.idleSeconds) return { phase: "out" };
  if (quiet >= cfg.idleSeconds - cfg.warningSeconds) return { phase: "warning", left: Math.ceil(cfg.idleSeconds - quiet) };
  return ACTIVE;
}

/** A phone that came back after more than `idleSeconds` in the background is signed out with no warning. */
export const backgroundTooLong = (leftAtMs: number, backAtMs: number, cfg: IdleConfig = IDLE) => (backAtMs - leftAtMs) / 1000 > cfg.idleSeconds;

export const sameIdle = (a: IdleState, b: IdleState) => a.phase === b.phase && (a.phase !== "warning" || a.left === (b as { left: number }).left);
