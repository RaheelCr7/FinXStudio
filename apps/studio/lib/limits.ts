/** Request limits for the production profile. In-memory: one server process; put a gateway limit in front when scaled out. */
export class RateLimiter {
  private hits = new Map<string, { n: number; reset: number }>();
  constructor(private max: number, private windowMs: number) {}
  /** true when this call is allowed */
  take(key: string, now: number = Date.now()): boolean {
    const h = this.hits.get(key);
    if (!h || h.reset <= now) {
      if (this.hits.size > 10_000) for (const [k, v] of this.hits) if (v.reset <= now) this.hits.delete(k);
      this.hits.set(key, { n: 1, reset: now + this.windowMs });
      return true;
    }
    return ++h.n <= this.max;
  }
  /** true when the key has used up its allowance in the current window (without counting another call) */
  isBlocked(key: string, now: number = Date.now()): boolean { const h = this.hits.get(key); return Boolean(h && h.reset > now && h.n >= this.max); }
  reset(key: string) { this.hits.delete(key); }
  retryAfterSeconds(key: string, now: number = Date.now()) { return Math.max(1, Math.ceil(((this.hits.get(key)?.reset ?? now) - now) / 1000)); }
}

export const MAX_BODY_BYTES = 2 * 1024 * 1024;
export const bodyTooLarge = (contentLength: string | null, max = MAX_BODY_BYTES) => {
  if (contentLength === null) return false;
  const n = Number(contentLength);
  return !Number.isFinite(n) || n > max;
};

/** Failed sign-ins: 5 in 15 minutes locks that person and address out until the window ends. */
export const loginFailures = new RateLimiter(5, 15 * 60_000);
export const apiRate = new RateLimiter(600, 60_000);
