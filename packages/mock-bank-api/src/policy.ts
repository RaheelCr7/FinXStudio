/**
 * The sandbox bank is for demos, UAT and tests. A production build must not run customers on it, so apps tell it whether it may be
 * used (setSandboxPolicy) and it refuses to start when it may not (assertSandboxAllowed, called by MockBank). The default is allowed, which
 * is today's behaviour everywhere: only a production build turns it off, and only a build that sets FINX_ALLOW_SANDBOX=1 (a labelled pilot or
 * demo) turns it back on.
 *
 * SANDBOX_MARKER is a fixed string that ends up in any bundle that contains the sandbox, so scripts/audit-bundle.mjs can find it.
 */
export const SANDBOX_MARKER = "finx-sandbox-bank: never ship in a production build";

let allowed = true;
export const setSandboxPolicy = (p: { allowed: boolean }) => { allowed = p.allowed; };
export const sandboxAllowed = () => allowed;

export class SandboxNotAllowedError extends Error {
  constructor() { super(`${SANDBOX_MARKER}. This build is not connected to a bank (set FINX_ALLOW_SANDBOX=1 only for a labelled demo or pilot).`); this.name = "SandboxNotAllowedError"; }
}
export function assertSandboxAllowed(): void { if (!allowed) throw new SandboxNotAllowedError(); }

/** The rule apps share: any non-production build may use the sandbox; a production build only with an explicit "1". */
export const sandboxAllowedFor = (finxEnv: string | undefined, allowFlag: string | undefined) => finxEnv !== "production" || allowFlag === "1";
