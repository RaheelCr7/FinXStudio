/**
 * Mobile hardening for the production profile (docs/SECURITY.md). Nothing here changes the demo: it is all off unless the build sets
 * EXPO_PUBLIC_FINX_ENV=production, and the native modules it uses are only loaded then.
 *
 *   EXPO_PUBLIC_FINX_INTEGRITY  "block" (default in production), "warn" or "off": what to do on a rooted or jailbroken device
 */
export type Hardening = {
  enabled: boolean;
  /** stop screenshots and screen recording of the app, and hide it in the app switcher where the platform allows */
  blockCapture: boolean;
  integrity: "off" | "warn" | "block";
  /** refuse a Studio address that is not https */
  httpsOnly: boolean;
};

export function hardeningFor(env: Record<string, string | undefined>): Hardening {
  if (env.EXPO_PUBLIC_FINX_ENV !== "production") return { enabled: false, blockCapture: false, integrity: "off", httpsOnly: false };
  const i = env.EXPO_PUBLIC_FINX_INTEGRITY;
  return { enabled: true, blockCapture: true, integrity: i === "warn" || i === "off" ? i : "block", httpsOnly: true };
}

export const isHttps = (url: string) => /^https:\/\/[^/\s]+/i.test(url);

export type Integrity = "ok" | "compromised" | "unknown";
export type Verdict = "allow" | "warn" | "block";

/**
 * "unknown" (the check could not run, for example on the web or in a simulator) is allowed: a missing check must not lock out
 * every customer, and the web build has no device to inspect. A positive finding follows the policy.
 */
export function integrityVerdict(h: Hardening, result: Integrity): Verdict {
  if (!h.enabled || h.integrity === "off" || result !== "compromised") return "allow";
  return h.integrity === "block" ? "block" : "warn";
}

/** Why the app should not start, or null. The address check covers a build that was given a plain-http server. */
export function startBlock(h: Hardening, studioUrl: string, integrity: Integrity): { kind: "insecure_server" | "compromised_device"; message: string } | null {
  if (h.enabled && h.httpsOnly && !isHttps(studioUrl)) return { kind: "insecure_server", message: "This app is set up to use an unsecured server address, so it will not start. Please contact your bank." };
  if (integrityVerdict(h, integrity) === "block") return { kind: "compromised_device", message: "For your protection this app cannot run on a device that has been rooted or jailbroken." };
  return null;
}
