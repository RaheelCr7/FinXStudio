/**
 * Two profiles (docs/adr/0005-two-profiles.md). "demo" is the laptop behaviour: a "Working as" switcher, no sign-in.
 * "production" turns the Studio controls on: sign-in, signed sessions, headers, limits, tamper-evident audit log.
 * Set FINX_PROFILE=production. Anything else is demo.
 */
export const isProduction = (env: Record<string, string | undefined> = process.env) => env.FINX_PROFILE === "production";

export const COOKIE_SESSION = "finx.session";
