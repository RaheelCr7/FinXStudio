/**
 * The page security rules (Content Security Policy and friends), built in one place so they can be tested.
 * Scripts may only run if they carry this request's one-time nonce, so a script injected into a page does not run.
 */
export type CspOptions = { nonce: string; dev: boolean; https: boolean };

export function contentSecurityPolicy({ nonce, dev, https }: CspOptions): string {
  const directives = [
    "default-src 'self'",
    // 'strict-dynamic' lets the nonced framework scripts load the rest; development also needs eval for React's debugging tools
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // development injects stylesheets as inline <style> tags on every edit; those cannot carry the nonce, so development allows inline styles
    dev ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' 'nonce-${nonce}'`,
    // style="" attributes on elements (a chart's size, a tile's colour) cannot carry a nonce; they cannot run code either
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // the browser only talks to this app's own address (it asks the server for Studio's journeys); development adds the reload socket
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    // the installable app: its manifest and its service worker come from this app only
    "manifest-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(https && !dev ? ["upgrade-insecure-requests"] : []),
  ];
  return directives.join("; ");
}

/** Headers every response carries. Strict-Transport-Security only goes out over https, where it means something. */
export function securityHeaders({ https }: { https: boolean }): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    ...(https ? { "Strict-Transport-Security": "max-age=63072000; includeSubDomains" } : {}),
  };
}

/** A fresh, unguessable one-time value for each request. */
export const newNonce = () => btoa(crypto.randomUUID());
