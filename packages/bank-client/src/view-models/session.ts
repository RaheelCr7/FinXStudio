import type { Workspace } from "@finx/ui-kit";

/** One place a signed-in person can bank from, as the bank describes it (bank.session.get). */
export type SessionContext = { id: string; kind: "personal" | "business"; name: string; role?: string; roles?: string[]; permissions: string[]; stepUp?: boolean };
export type SessionView = { identity: { id: string; name: string }; active: string; contexts: SessionContext[] };

export const workspaceOf = (c: SessionContext | undefined): Workspace => (c?.kind === "business" ? "business" : "personal");

export type MenuItem = { id: string; label: string; badge?: number };

const PERSONAL: MenuItem[] = [
  { id: "home", label: "Home" }, { id: "payments", label: "Payments" }, { id: "cards", label: "Cards" }, { id: "more", label: "More" },
];

/**
 * The menu for a place, from what the bank says the person may do there. Hiding an item is a convenience:
 * the sandbox refuses the call whatever the menu shows.
 */
export function menuFor(ctx: SessionContext | undefined, waitingApprovals = 0): MenuItem[] {
  if (!ctx || ctx.kind === "personal") return PERSONAL.filter((m) => m.id !== "cards" || !ctx || ctx.permissions.includes("cards.manage"));
  const can = (p: string) => ctx.permissions.includes(p);
  return [
    { id: "overview", label: "Overview" },
    ...(can("accounts.view") ? [{ id: "accounts", label: "Accounts" }] : []),
    ...(can("pay.create") || can("pay.approve") ? [{ id: "payments", label: "Payments" }] : []),
    ...(can("pay.approve") ? [{ id: "approvals", label: "Approvals", ...(waitingApprovals ? { badge: waitingApprovals } : {}) }] : []),
    { id: "more", label: "More" },
  ];
}
