import { slugIs, type Entry } from "./live";
import { can, type BankSettings, type ContextInfo } from "./session";

/**
 * Every button that opens a journey, as data (docs/journeys/README.md sections 5.2, 5.3 and 5.5). Web and mobile draw their
 * buttons, the + quick actions and the command bar from this one list, so they stay identical. Showing a button is check 1 of three:
 * the journey's own authorisation and the sandbox check again, whatever a screen shows.
 */
export type LaunchPoint = {
  id: string;
  workspace: "personal" | "business";
  /** Where it sits: "<tab>" or "<tab>.<area>", for example "cards.card" or "payments.hub". */
  place: string;
  label: string;
  journey: string;
  /** The names of the values the place passes in (cardId, accountId, ...). */
  passes: string[];
  /** Values that are always passed, for example { mode: "renew" }. */
  fixed?: Record<string, unknown>;
  /** The permission the context must hold. */
  needs?: string;
  /** Acts on a selection of rows, not on one: no row shows it (the inbox offers it once rows are selected). */
  many?: boolean;
  /** Shown in the + quick actions. */
  quick?: boolean;
  /** Drawn only on a row in one of these states (a card that is frozen, a payment that can be reported): the others are hidden, not disabled. */
  states?: string[];
  /** Asks the person to confirm it is them again first (docs/journeys/README.md 4.3), unless a step-up from the last five minutes is still valid. */
  stepUp?: boolean;
  icon?: string;
};

type Def = [place: string, label: string, journey: string, needs?: string, passes?: string[], extra?: Partial<LaunchPoint>];
const make = (workspace: LaunchPoint["workspace"], defs: Def[]): LaunchPoint[] => defs.map(([place, label, journey, needs, passes, extra]) => ({
  id: `${workspace}:${place}:${journey}:${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
  workspace, place, label, journey, passes: passes ?? [], ...(needs ? { needs } : {}), ...extra,
}));

const PERSONAL: Def[] = [
  ["home", "Send money", "personal-transfer", "payments.create", [], { quick: true, icon: "send" }],
  ["home", "Pay a bill", "pay-bill", "payments.create", [], { quick: true, icon: "repeat" }],
  ["home", "Top up", "mobile-topup", "payments.create", [], { quick: true, icon: "phone" }],
  ["home", "Add money", "add-money", "payments.create", [], { quick: true, icon: "dollar" }],
  ["home.upcoming", "Edit", "schedule-payment", "payments.schedule", ["scheduleId"]],
  ["home.offer", "Apply", "apply-loan", "loans.apply", ["offerId"]],
  ["home.offer", "Open", "open-another-account", "accounts.manage", ["offerId", "product"]],
  ["home", "See all your money", "connect-account", "accounts.manage"],
  ["accounts", "Open another account", "open-another-account", "accounts.manage"],
  // the views of the Accounts tab as journeys a bank can switch off: no button of the shell draws these places, the command bar and the links open them
  ["accounts.overview", "Accounts overview", "accounts", "accounts.view"],
  ["accounts.budgetview", "Budgets", "budgets", "accounts.view"],
  ["accounts.detail", "Details", "account-details", "accounts.view", ["accountId"]],
  ["accounts.detail", "Statement", "statement", "accounts.statement", ["accountId"]],
  ["accounts.detail", "Rename", "account-nickname", "accounts.manage", ["accountId"]],
  ["accounts.detail", "Transfer", "own-transfer", "payments.create", ["accountId"]],
  ["accounts.detail", "Send money", "personal-transfer", "payments.create", ["accountId"]],
  ["accounts.detail", "Ask about this account", "new-message", "messages.send", ["accountId"]],
  ["accounts.transaction", "Dispute", "dispute-transaction", "cards.dispute", ["transactionId"]],
  ["accounts.budgets", "New budget", "create-budget", "accounts.manage", ["category"]],
  ["accounts.budget", "Edit", "create-budget", "accounts.manage", ["budgetId"]],
  ["accounts.budget", "Delete", "create-budget", "accounts.manage", ["budgetId", "mode"], { fixed: { mode: "delete" } }],
  ["payments.hub", "Ways to send money", "transfer-types", "payments.create"],
  ["payments.hub", "Quick transfer", "single-transfer", "payments.create"],
  ["payments.hub", "Between my accounts", "own-transfer", "payments.create"],
  ["payments.hub", "To a customer", "internal-transfer", "payments.create", ["beneficiaryId"]],
  ["payments.hub", "To another bank", "personal-transfer", "payments.create", ["beneficiaryId"]],
  ["payments.hub", "To another country", "international-transfer", "payments.create", ["beneficiaryId", "country"]],
  ["payments.hub", "Bills", "pay-bill", "payments.create", ["billerId"]],
  ["payments.hub", "Top up", "mobile-topup", "payments.create", ["operatorId"]],
  ["payments.beneficiaries", "Add", "manage-beneficiary", "beneficiaries.manage", ["mode"], { fixed: { mode: "add" } }],
  ["payments.beneficiary", "Edit", "manage-beneficiary", "beneficiaries.manage", ["beneficiaryId"], { fixed: { mode: "edit" } }],
  ["payments.beneficiary", "Delete", "manage-beneficiary", "beneficiaries.manage", ["beneficiaryId"], { fixed: { mode: "delete" } }],
  ["payments.beneficiary", "Send money", "personal-transfer", "payments.create", ["beneficiaryId"]],
  ["payments.beneficiary", "Schedule", "schedule-payment", "payments.schedule", ["beneficiaryId"]],
  ["payments.scheduled", "New", "schedule-payment", "payments.schedule"],
  ["payments.scheduled", "Change", "schedule-payment", "payments.schedule", ["scheduleId"]],
  ["payments.scheduled", "Cancel", "cancel-standing-order", "payments.schedule", ["scheduleId"]],
  ["payments.payment", "Repeat payment", "personal-transfer", "payments.create", ["paymentId"]],
  // the view of the Cards tab as a journey a bank can switch off: no button of the shell draws this place, the command bar and the links open it
  ["cards.overview", "Cards", "cards", "cards.view", ["cardId"]],
  ["cards", "Add a card", "add-card", "payments.create"],
  ["cards.card", "Activate", "activate-card", "cards.manage", ["cardId"], { states: ["inactive"] }],
  ["cards.card", "Freeze", "freeze-card", "cards.manage", ["cardId", "action"], { fixed: { action: "freeze" }, states: ["active", "virtual-active"] }],
  ["cards.card", "Unfreeze", "freeze-card", "cards.manage", ["cardId", "action"], { fixed: { action: "unfreeze" }, states: ["frozen", "virtual-frozen"] }],
  ["cards.card", "Limits and controls", "card-controls", "cards.manage", ["cardId", "mode"], { states: ["active", "frozen", "virtual-active", "virtual-frozen"] }],
  ["cards.card", "Virtual card", "virtual-card", "cards.manage", ["cardId"], { states: ["active"] }],
  ["cards.card", "Replace card", "replace-card", "cards.manage", ["cardId", "reason"], { states: ["active", "frozen", "blocked", "expired"] }],
  ["cards.card", "Set PIN", "card-pin", "cards.pin", ["cardId"], { states: ["active", "frozen"] }],
  ["cards.transaction", "Report a problem", "dispute-transaction", "cards.dispute", ["cardId", "transactionId"], { states: ["reportable"] }],
  ["save.deposits", "Open a deposit", "term-deposit", "savings.manage", ["mode"], { fixed: { mode: "open" } }],
  ["save.deposit", "Renew", "term-deposit", "savings.manage", ["depositId"], { fixed: { mode: "renew" } }],
  ["save.deposit", "Close", "term-deposit", "savings.manage", ["depositId"], { fixed: { mode: "close" } }],
  ["save.goals", "New goal", "savings-goal", "savings.manage"],
  ["save.goal", "Add money", "savings-goal", "savings.manage", ["goalId"]],
  ["save.loans", "Apply for a loan", "apply-loan", "loans.apply"],
  ["save.loan", "Repay", "repay-loan", "loans.repay", ["loanId", "mode"], { fixed: { mode: "repay" } }],
  ["save.loan", "Settle early", "repay-loan", "loans.repay", ["loanId", "mode"], { fixed: { mode: "settle" } }],
  ["save.investments", "Buy", "invest", "invest.trade", ["symbol"]],
  ["save.investments", "Sell", "sell-investment", "invest.trade", ["symbol"]],
  ["save.investments", "Add money", "add-money", "payments.create", ["accountId"]],
  ["more.profile", "Edit details", "update-profile", "profile.update", ["field"]],
  ["more.profile", "Request a change", "service-request", "messages.send", ["type"], { fixed: { type: "name-change" } }],
  ["more.messages", "New message", "new-message", "messages.send", ["topic", "accountId"]],
  ["more.requests", "New request", "service-request", "messages.send", ["type"]],
  ["more.help", "Send a secure message", "new-message", "messages.send", ["topic"]],
  ["more.settings", "Connect a bank", "connect-account", "accounts.manage"],
  ["more.security", "Change password", "change-password", "security.manage", [], { stepUp: true }],
  ["more.security", "Trusted devices", "trusted-devices", "security.manage", ["deviceId"], { stepUp: true }],
  ["more.security", "Change quick PIN", "change-quick-pin", "security.manage", [], { stepUp: true }],
  ["more.security", "Quick sign-in", "setup-quick-login", "security.manage", [], { stepUp: true }],
  ["more.security", "Biometrics", "setup-quick-login", "security.manage", [], { stepUp: true }],
  ["more.security", "This wasn't me", "new-message", "messages.send", ["topic"], { fixed: { topic: "security" } }],
];

const BUSINESS: Def[] = [
  ["overview", "Pay a supplier", "supplier-payment", "biz.payments.initiate", [], { quick: true, icon: "send" }],
  ["overview", "Upload payments", "bulk-payment", "biz.payments.bulk", [], { quick: true, icon: "plus" }],
  ["overview", "Run payroll", "payroll-run", "biz.payroll.run", [], { quick: true, icon: "userPlus" }],
  ["overview.approvals", "Approve", "approve-payments", "biz.approvals.approve", ["paymentId"]],
  ["overview.cutoff", "Pay now", "supplier-payment", "biz.payments.initiate"],
  ["accounts.detail", "Statement", "business-statement", "biz.accounts.export", ["accountId"]],
  ["accounts.transactions", "Export", "business-statement", "biz.accounts.export", ["accountId", "from", "to"]],
  ["accounts.statements", "New statement", "business-statement", "biz.accounts.export", ["accountId"]],
  ["accounts.detail", "Request a chequebook", "business-service-request", "biz.requests.create", ["type"], { fixed: { type: "chequebook" } }],
  ["payments.hub", "Pay a supplier", "supplier-payment", "biz.payments.initiate", ["supplierId"]],
  ["payments.hub", "Upload a file", "bulk-payment", "biz.payments.bulk"],
  ["payments.hub", "Run payroll", "payroll-run", "biz.payroll.run", ["period"]],
  ["payments.hub", "Schedule", "schedule-business-payment", "biz.payments.schedule", ["templateId"]],
  ["payments.payment", "Withdraw", "withdraw-payment", "biz.payments.withdraw", ["paymentId"]],
  ["payments.payment", "Repair rejected lines", "repair-bulk-lines", "biz.payments.bulk", ["paymentId"]],
  ["payments.payment", "Save as template", "payment-template", "biz.templates.manage", ["paymentId"]],
  ["payments.payment", "Repeat", "supplier-payment", "biz.payments.initiate", ["paymentId"]],
  ["payments.templates", "New template", "payment-template", "biz.templates.manage"],
  ["payments.templates", "Use", "supplier-payment", "biz.payments.initiate", ["templateId"]],
  ["payments.suppliers", "Add", "add-supplier", "biz.suppliers.manage"],
  ["payments.suppliers", "Edit", "add-supplier", "biz.suppliers.manage", ["supplierId"]],
  ["payments.scheduled", "Stop", "schedule-business-payment", "biz.payments.schedule", ["scheduleId"]],
  ["payments.history", "New run", "payroll-run", "biz.payroll.run", ["period"]],
  ["approvals.inbox", "Approve", "approve-payments", "biz.approvals.approve", ["paymentId"]],
  ["approvals.inbox", "Approve several", "approve-payments", "biz.approvals.approve", ["paymentIds"], { many: true }],
  ["approvals.inbox", "Reject several", "approve-payments", "biz.approvals.approve", ["paymentIds"], { many: true }],
  ["admin.users", "Invite", "manage-user", "biz.admin.users"],
  ["admin.users", "Edit", "manage-user", "biz.admin.users", ["userId"]],
  ["admin.users", "Change limit", "change-limits", "biz.admin.limits", ["userId"]],
  ["admin.permissions", "Edit roles", "manage-user", "biz.admin.users", ["userId"]],
  ["admin.limits", "Change", "change-limits", "biz.admin.limits", ["userId"]],
  ["admin.limits", "Ask for a higher ceiling", "business-service-request", "biz.requests.create", ["type"], { fixed: { type: "limit_review" } }],
  ["admin.groups", "Edit", "edit-signatory-group", "biz.admin.signatories", ["groupId"]],
  ["admin.groups", "New group", "edit-signatory-group", "biz.admin.signatories"],
  ["more.requests", "New request", "business-service-request", "biz.requests.create", ["type"]],
  ["more.profile", "Request a change", "business-service-request", "biz.requests.create", ["type"]],
  ["more.profile", "Business onboarding", "kyb-onboarding", "biz.admin.users"],
];

export const LAUNCH_POINTS: LaunchPoint[] = [...make("personal", PERSONAL), ...make("business", BUSINESS)];

/** Older names of journeys that exist under another slug today (docs/journeys/README.md, "Slug mapping to existing fixtures"). */
export const JOURNEY_ALIASES: Record<string, string[]> = {
  "supplier-payment": ["corporate-payment"], "approve-payments": ["corporate-approval"], "withdraw-payment": ["withdraw-a-payment"], "pay-bill": ["pay-a-bill"],
  "personal-transfer": ["fund-transfer-local"], "own-transfer": ["convert-currency"], statement: ["account-statement"],
};

/** The slug of the catalog entry that runs `journey`: the journey itself (or a bank's copy of it), else its older name. */
export function entryFor(journey: string, entries: Pick<Entry, "slug">[]): string | undefined {
  for (const name of [journey, ...(JOURNEY_ALIASES[journey] ?? [])]) {
    const hit = entries.find((e) => slugIs(e.slug, name));
    if (hit) return hit.slug;
  }
  return undefined;
}

export type LaunchContext = {
  context: ContextInfo | undefined;
  /** The journeys this app can open now (the catalog). */
  entries: Pick<Entry, "slug">[];
  settings?: Pick<BankSettings, "disabled" | "options">;
};

/** Whether the bank has this journey on: not in the disabled list, and not switched off in its options. */
export function journeyOn(journey: string, settings: LaunchContext["settings"]) {
  const names = [journey, ...(JOURNEY_ALIASES[journey] ?? [])];
  if (names.some((n) => settings?.disabled.some((d) => slugIs(d, n)))) return false;
  return !names.some((n) => settings?.options[n]?.enabled === false);
}

/**
 * The launch points a person sees: this workspace's, holding the permission, with a journey this app has and the bank has not
 * switched off. `place` narrows to one place ("cards.card") or, with `deep: false`, to exactly that place.
 */
export function launchPointsFor(ctx: LaunchContext, filter: { place?: string; quick?: boolean } = {}): LaunchPoint[] {
  const workspace = ctx.context?.workspace;
  if (!workspace) return [];
  return LAUNCH_POINTS.filter((lp) => lp.workspace === workspace
    && (filter.place === undefined || lp.place === filter.place)
    && (!filter.quick || lp.quick)
    && can(ctx.context, lp.needs)
    && journeyOn(lp.journey, ctx.settings)
    && entryFor(lp.journey, ctx.entries) !== undefined);
}

/**
 * Whether a link may open this journey in this context: some launch point of the workspace runs it, the context holds that
 * launch point's permission, and the bank has it on. Used for deep links and the command bar, which are not buttons.
 */
export function journeyAllowed(journey: string, ctx: LaunchContext): boolean {
  const workspace = ctx.context?.workspace;
  if (!workspace) return false;
  return LAUNCH_POINTS.some((lp) => lp.workspace === workspace && (slugIs(journey, lp.journey) || (JOURNEY_ALIASES[lp.journey] ?? []).some((a) => slugIs(journey, a))) && can(ctx.context, lp.needs))
    && journeyOn(journey, ctx.settings);
}

/** The values to start the journey with: the launch point's fixed values, then the ones the place passed in (only the names it declares). */
export function launchValues(lp: LaunchPoint, passed: Record<string, unknown> = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of lp.passes) if (passed[k] !== undefined && passed[k] !== "") out[k] = passed[k];
  return { ...out, ...(lp.fixed ?? {}) };
}

/** Where a journey reads the values it was opened with: the engine puts launch values at data paths, and journeys read them under `launch.`. */
export const LAUNCH_PREFIX = "launch.";

/** The names a journey may be opened with: what any launch point of it declares (passed or fixed), under any of its names. */
export function launchNames(journey: string): Set<string> {
  const names = new Set<string>();
  for (const lp of LAUNCH_POINTS) {
    if (slugIs(journey, lp.journey) || (JOURNEY_ALIASES[lp.journey] ?? []).some((a) => slugIs(journey, a))) { for (const k of lp.passes) names.add(k); for (const k of Object.keys(lp.fixed ?? {})) names.add(k); }
  }
  return names;
}

/**
 * Values as a button or a link carries them (plain names) to what the engine takes: only the names the journey's launch points declare,
 * each at `launch.<name>`. A name the journey does not declare, from an address or another app's link, is dropped, so a link cannot set
 * `opt`, `ctx` or any other path the journey keeps for itself.
 */
export function launchFromValues(journey: string, values: Record<string, unknown> | undefined): Record<string, unknown> {
  const allowed = launchNames(journey), out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values ?? {})) if (allowed.has(k) && v !== undefined && v !== "") out[`${LAUNCH_PREFIX}${k}`] = v;
  return out;
}

/** Whether opening this journey asks for a step-up (any launch point of it is marked so): the shell asks before it opens, and the bank refuses the change without one. */
export const journeyNeedsStepUp = (journey: string) => LAUNCH_POINTS.some((lp) => lp.stepUp && (slugIs(journey, lp.journey) || (JOURNEY_ALIASES[lp.journey] ?? []).some((a) => slugIs(journey, a))));

/** The buttons of a row: those that need no particular state, and those that name the row's own. */
export const forRow = (points: LaunchPoint[], row: { state?: string }) => points.filter((lp) => !lp.states || (row.state !== undefined && lp.states.includes(row.state)));

/** Whether a button belongs to one row (it needs a value the row passes in) rather than to the section or the tab. */
export const isRowLevel = (lp: LaunchPoint) => !lp.many && lp.passes.some((p) => !(lp.fixed && p in lp.fixed));
/** Whether a button belongs to the section or the tab itself. */
export const isSectionLevel = (lp: LaunchPoint) => !lp.many && !isRowLevel(lp);

/** The tab a place belongs to. */
export const tabOfPlace = (place: string) => place.split(".")[0]!;
