import type { ContextInfo } from "@finx/mock-bank-api";
import type { WorkspaceId } from "@finx/ui-kit";

export type { ContextInfo };

/** What `bank.session.get` returns. */
export type SessionInfo = { identity: { id: string; name: string }; activeContextId: string; contexts: ContextInfo[]; stepUpUntil?: string; expiresAt?: string };

/** What the bank has switched on or off and how (bank.app.config). */
export type BankSettings = { homeMarket: string; disabled: string[]; options: Record<string, Record<string, unknown>> };
export const NO_SETTINGS: BankSettings = { homeMarket: "us", disabled: [], options: {} };

/** The two places a customer banks from: the shell shows one at a time. */
export const PERSONAL = "personal";

/** The permissions of a context; empty when the context is unknown, so nothing shows that the bank did not allow. */
export const permissionsIn = (ctx: ContextInfo | undefined): string[] => ctx?.permissions ?? [];
export const can = (ctx: ContextInfo | undefined, permission: string | undefined) => !permission || permissionsIn(ctx).includes(permission);
export const canAny = (ctx: ContextInfo | undefined, permissions: string[]) => permissions.some((p) => can(ctx, p));

export const workspaceOf = (ctx: ContextInfo | undefined): WorkspaceId => (ctx?.workspace === "business" ? "business" : "personal");
export const findContext = (s: SessionInfo | null, id: string | undefined) => s?.contexts.find((c) => c.id === id);
export const activeContext = (s: SessionInfo | null) => findContext(s, s?.activeContextId);
export const businessContexts = (s: SessionInfo | null) => s?.contexts.filter((c) => c.workspace === "business") ?? [];

/** The role badge next to a company: "Maker", "Approver", or both joined. Empty for Personal. */
export const roleBadge = (ctx: ContextInfo | undefined) => (ctx?.roles ?? []).join(" · ");
/** "AT" for Alpha Trading LLC: the first letters of the first two words, for the entity chip. */
export const contextInitials = (ctx: ContextInfo | undefined) => (ctx?.label ?? "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

/** Whether a step-up is still valid at `now` (the session answers `stepUpUntil` after one). */
export const stepUpValid = (s: SessionInfo | null, now: number) => !!s?.stepUpUntil && now <= Date.parse(s.stepUpUntil);
