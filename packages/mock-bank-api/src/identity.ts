import type { CorpCompany, CorpRole } from "./business/corporate";

/**
 * One login, several places to bank from: a person's own accounts and each company they act for (docs/journeys/README.md 2.3).
 * The sandbox holds the active context the way a server holds a session, and every adapter reads it, so what Alex does at Alpha
 * cannot touch Beta or the personal accounts, whatever a screen shows or hides.
 */
export type ContextKind = "personal" | "business";

/** What a person is allowed to do in a context: the dotted names of docs/journeys/README.md section 4. */
export const PERSONAL_PERMISSIONS = [
  "accounts.view", "accounts.statement", "accounts.manage", "payments.create", "payments.schedule", "beneficiaries.manage",
  "cards.view", "cards.manage", "cards.pin", "cards.dispute", "savings.manage", "loans.apply", "loans.repay", "invest.trade",
  "profile.update", "messages.send", "security.manage",
];

/**
 * What a call in the personal context needs, beyond being signed in: the permission of the adapter, and one more for what the input asks it to
 * keep or repeat (a payee or biller saved with it, a payment set for later or on repeat). Reading, quoting and checking need none here.
 * The company adapters have the same rule in business/business.ts (NEEDS).
 */
export function personalNeeds(adapter: string, input: Record<string, any> = {}): string[] {
  const need: string[] = [];
  if (/^bank\.(transfers\.(create|own)|payments\.create|fx\.convert|bills\.pay|topup\.create)$/.test(adapter)) need.push("payments.create");
  else if (/^bank\.schedules\.(create|update|cancel)$/.test(adapter)) need.push("payments.schedule");
  else if (/^bank\.payees\.(save|update|delete)$/.test(adapter)) need.push("beneficiaries.manage");
  else if (/^bank\.(accounts\.(open|rename|setHidden|requestClosure|restore)|budgets\.(create|update|delete))$/.test(adapter)) need.push("accounts.manage");
  else if (/^bank\.statements\.(deliver|issue)$/.test(adapter)) need.push("accounts.statement");
  else if (/^bank\.cards\.(verifyActivation|activate|freeze|unfreeze|block|controls\.update|virtual\.(create|delete)|replace(\.check)?)$/.test(adapter)) need.push("cards.manage");
  else if (adapter === "bank.cards.pin.set") need.push("cards.pin");
  else if (adapter === "bank.disputes.create") need.push("cards.dispute");
  else if (/^bank\.cards\.(check|verify|add)$/.test(adapter)) need.push("payments.create");
  if (adapter === "bank.payments.create" && input.when === "later") need.push("payments.schedule");
  if (adapter === "bank.bills.pay" && input.autopay === true) need.push("payments.schedule");
  if ((adapter === "bank.payments.create" || adapter === "bank.bills.pay" || adapter === "bank.topup.create") && input.save === true) need.push("beneficiaries.manage");
  return need;
}

const BIZ_BY_ROLE: Record<CorpRole, string[]> = {
  initiator: [
    "biz.accounts.view", "biz.accounts.export", "biz.payments.initiate", "biz.payments.bulk", "biz.payroll.run", "biz.payments.schedule",
    "biz.payments.withdraw", "biz.templates.manage", "biz.suppliers.manage", "biz.approvals.view", "biz.requests.create",
  ],
  approver: ["biz.accounts.view", "biz.accounts.export", "biz.approvals.view", "biz.approvals.approve", "biz.audit.view"],
  admin: ["biz.accounts.view", "biz.accounts.export", "biz.admin.users", "biz.admin.limits", "biz.admin.signatories", "biz.audit.view", "biz.requests.create"],
};
export const permissionsOf = (roles: CorpRole[]): string[] => [...new Set(roles.flatMap((r) => BIZ_BY_ROLE[r]))];
export const ROLE_LABEL: Record<CorpRole, string> = { initiator: "Maker", approver: "Approver", admin: "Administrator" };

/** A company the identity acts for. `userId` is who the person is inside the company; the company's own user list gives the roles. */
export type BusinessContextDef = { id: string; company: CorpCompany; userId: string };
export type IdentityDef = {
  id: string; name: string;
  /** The password the step-up asks for with method "password" (sandbox seed; a real bank checks its own). */
  password: string;
  business: BusinessContextDef[];
  /** The company books carry the fuller cast of payments (alpha-beta.ts, seedPayments) instead of the combined demo's. */
  cast?: boolean;
};

/** How long a step-up stays valid (seconds): switching to a company within this time does not ask again. */
export const STEP_UP_SECONDS = 300;

export type ContextInfo = {
  id: string; label: string; workspace: ContextKind; companyId?: string; roles: string[]; permissions: string[];
  limits?: Record<string, number | string>; access: "active";
};

/** Builds the context list from the identity and the live company data (limits change as payments are made). */
export function contextsOf(def: IdentityDef, personal: { name: string; limits: Record<string, number | string>; /** What the person holds here; all of PERSONAL_PERMISSIONS when left out. */ permissions?: string[] }, companies: Record<string, CorpCompany>): ContextInfo[] {
  const out: ContextInfo[] = [{ id: "personal", label: "Personal", workspace: "personal", roles: [], permissions: personal.permissions ?? PERSONAL_PERMISSIONS, limits: personal.limits, access: "active" }];
  for (const b of def.business) {
    const c = companies[b.id] ?? b.company;
    const me = c.users.find((u) => u.id === b.userId);
    const roles = me?.roles ?? [];
    out.push({
      id: b.id, label: c.name, workspace: "business", companyId: c.id, roles: roles.map((r) => ROLE_LABEL[r]), permissions: permissionsOf(roles),
      limits: { currency: c.currency, personDaily: me?.dailyLimit ?? 0, personUsedToday: me?.usedToday ?? 0, companyDaily: c.companyDailyLimit, companyUsedToday: c.companyUsedToday, approvalAbove: c.dualApprovalAbove, codeAbove: c.codeAbove ?? 0 },
      access: "active",
    });
  }
  return out;
}
