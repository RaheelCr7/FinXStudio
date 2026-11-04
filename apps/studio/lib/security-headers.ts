/**
 * Headers added in the production profile. The CSP is report-only first: it logs what it would block without breaking the page,
 * so it can be tightened from real reports. Next needs inline scripts today, hence 'unsafe-inline' until nonces are added.
 */
export function securityHeaders(): Record<string, string> {
  return {
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Content-Security-Policy-Report-Only": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  };
}
