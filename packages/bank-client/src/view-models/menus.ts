import type { WorkspaceId } from "@finx/ui-kit";
import { can, canAny, type ContextInfo } from "../session";

export type PersonalTab = "home" | "accounts" | "payments" | "cards" | "save" | "more";
export type BusinessTab = "overview" | "accounts" | "payments" | "approvals" | "admin" | "more";
export type ShellTab = PersonalTab | BusinessTab;

export type MenuItem = { id: ShellTab; label: string; icon: string; /** False when the context lacks the permission: the screen shows "no access". */ allowed: boolean; badge?: number };

type Def = { id: ShellTab; label: string; icon: string; any?: string[] };
const PERSONAL: Def[] = [
  { id: "home", label: "Home", icon: "home", any: ["accounts.view"] },
  { id: "accounts", label: "Accounts", icon: "wallet", any: ["accounts.view"] },
  { id: "payments", label: "Payments", icon: "send", any: ["payments.create", "payments.schedule", "beneficiaries.manage"] },
  { id: "cards", label: "Cards", icon: "card", any: ["cards.view"] },
  { id: "save", label: "Save & Borrow", icon: "bank", any: ["savings.manage", "loans.apply", "loans.repay", "invest.trade"] },
  { id: "more", label: "More", icon: "menu" },
];
const BUSINESS: Def[] = [
  { id: "overview", label: "Overview", icon: "trend", any: ["biz.accounts.view"] },
  { id: "accounts", label: "Accounts", icon: "wallet", any: ["biz.accounts.view"] },
  { id: "payments", label: "Payments", icon: "send", any: ["biz.accounts.view"] },
  { id: "approvals", label: "Approvals", icon: "shield", any: ["biz.approvals.view", "biz.approvals.approve"] },
  { id: "admin", label: "Admin", icon: "user", any: ["biz.admin.users", "biz.admin.limits", "biz.admin.signatories", "biz.audit.view"] },
  { id: "more", label: "More", icon: "menu" },
];

export const FIRST_TAB: Record<WorkspaceId, ShellTab> = { personal: "home", business: "overview" };
export const tabsOf = (workspace: WorkspaceId): ShellTab[] => (workspace === "business" ? BUSINESS : PERSONAL).map((d) => d.id);
export const isTab = (workspace: WorkspaceId, tab: string): tab is ShellTab => tabsOf(workspace).includes(tab as ShellTab);
export const tabLabel = (workspace: WorkspaceId, tab: string) => (workspace === "business" ? BUSINESS : PERSONAL).find((d) => d.id === tab)?.label ?? "";

/** The navigation for the active context, drawn the same on web (side rail) and mobile (tab bar). The approvals badge is the queue length. */
export function menuFor(ctx: ContextInfo | undefined, counts: { approvals?: number } = {}): MenuItem[] {
  if (!ctx) return [];
  const defs = ctx.workspace === "business" ? BUSINESS : PERSONAL;
  return defs.map((d) => ({
    id: d.id, label: d.label, icon: d.icon, allowed: !d.any || canAny(ctx, d.any),
    ...(d.id === "approvals" && counts.approvals ? { badge: counts.approvals } : {}),
  }));
}

/** Whether a tab may be opened in a context (a link to a tab the person cannot use falls back to the first one). */
export const tabAllowed = (ctx: ContextInfo | undefined, tab: string) => !!menuFor(ctx).find((m) => m.id === tab)?.allowed;
export const canApprove = (ctx: ContextInfo | undefined) => can(ctx, "biz.approvals.approve");
