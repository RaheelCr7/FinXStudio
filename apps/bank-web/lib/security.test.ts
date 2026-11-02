import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, newNonce, securityHeaders } from "./security";

describe("content security policy", () => {
  const prod = contentSecurityPolicy({ nonce: "abc", dev: false, https: true });
  it("allows scripts only from this app and with this request's nonce, never eval, and no framing, plugins or <base>", () => {
    expect(prod).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(prod).not.toMatch(/unsafe-eval|unsafe-inline'(?!\s*;)/);
    expect(prod).toContain("object-src 'none'");
    expect(prod).toContain("worker-src 'self'");
    expect(prod).toContain("manifest-src 'self'");
    expect(prod).toContain("base-uri 'none'");
    expect(prod).toContain("frame-ancestors 'none'");
    expect(prod).toContain("form-action 'self'");
    expect(prod).toContain("default-src 'self'");
  });
  it("lets the browser talk only to this app, so Studio's address stays on the server", () => {
    expect(prod).toContain("connect-src 'self'");
    expect(prod).not.toMatch(/connect-src[^;]*(https?:|ws:)/);
  });
  it("only relaxes inline style attributes, not inline style elements or scripts", () => {
    expect(prod).toContain("style-src 'self' 'nonce-abc'");
    expect(prod).toContain("style-src-attr 'unsafe-inline'");
    expect(prod.match(/'unsafe-inline'/g)).toHaveLength(1);
  });
  it("development adds eval and the reload socket, and nothing else changes; upgrade-insecure-requests only on https in production", () => {
    const dev = contentSecurityPolicy({ nonce: "abc", dev: true, https: false });
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).toContain("style-src 'self' 'unsafe-inline'");
    expect(dev).toContain("connect-src 'self' ws: wss:");
    expect(dev).not.toContain("upgrade-insecure-requests");
    expect(prod).toContain("upgrade-insecure-requests");
    expect(contentSecurityPolicy({ nonce: "abc", dev: false, https: false })).not.toContain("upgrade-insecure-requests");
  });
});

describe("other security headers", () => {
  it("always sends the basics, and HSTS only over https", () => {
    const h = securityHeaders({ https: false });
    expect(h).toMatchObject({ "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "strict-origin-when-cross-origin", "Cross-Origin-Opener-Policy": "same-origin" });
    expect(h["Permissions-Policy"]).toContain("camera=()");
    expect(h["Strict-Transport-Security"]).toBeUndefined();
    expect(securityHeaders({ https: true })["Strict-Transport-Security"]).toContain("max-age=");
  });
  it("makes a different nonce each time", () => {
    const a = new Set(Array.from({ length: 50 }, () => newNonce()));
    expect(a.size).toBe(50);
    expect([...a][0]).toMatch(/^[A-Za-z0-9+/=]{20,}$/);
  });
});
