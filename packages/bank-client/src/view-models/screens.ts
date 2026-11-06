import { formatMoney } from "@finx/ui-kit";
import { canApprove, type ShellTab } from "./menus";
import { approvalBadge, approvalQueue, businessOverview, listOf, personalHome, type MoneyLine, type RawAccount, type RawActivity, type RawBudget, type RawCorpAccount, type RawCorpPayment, type RawSchedule } from "./widgets";
import { can, type ContextInfo } from "../session";

/**
 * The shell's tab screens as plain data, so web and mobile draw the same thing: an optional hero, then sections of rows.
 * A row may name a launch-point place and the values it passes ("cards.card", { cardId }); the apps draw that place's buttons next to it.
 */
export type RowTone = "positive" | "negative" | "warning" | "neutral";
export type Row = { id: string; title: string; subtitle?: string; value?: string; tag?: string; tone?: RowTone; /** 0 to 100, drawn as a bar. */ progress?: number; /** The launch-point place of this row's buttons. */ place?: string; passes?: Record<string, string>; /** The row opens a page of the app instead of showing buttons (Settings > Security). */ go?: "security";
  /** What state the row is in (a card: active, frozen, ...): a launch point that names `states` is drawn only on a row in one of them. */ state?: string };
export type Section = { id: string; title: string; rows: Row[]; /** Shown instead of rows when there are none. */ empty: string; /** The launch-point place whose buttons sit in the section header. */ place?: string };
export type Screen = { tab: ShellTab; hero?: { label: string; value: string; lines: MoneyLine[] }; sections: Section[]; /** Open items, drawn as the badge on Approvals. */ approvals?: number };

/** A screen with nothing to show at all, so the app draws its empty state instead of empty sections. */
export const screenIsEmpty = (s: Screen) => s.sections.every((x) => x.rows.length === 0) && !s.hero;

export type Call = (adapter: string, input?: Record<string, any>) => Promise<any>;
const list = listOf;
const date = (iso?: string) => (iso ? iso.slice(0, 10) : "");
const money = (n: number, currency: string) => formatMoney(n, currency);

// ---- Personal -----------------------------------------------------------------------------------------------------
export async function loadPersonal(call: Call, tab: ShellTab): Promise<Screen> {
  switch (tab) {
    case "home": {
      const [accounts, budgets, schedules, activity] = await Promise.all([call("bank.accounts.list"), call("bank.budgets.list"), call("bank.schedules.list", { status: "live" }), call("bank.activity.list")]);
      const h = personalHome({ accounts: list<RawAccount>(accounts), budgets: list<RawBudget>(budgets), schedules: list<RawSchedule>(schedules), activity: list<RawActivity>(activity) });
      return { tab, hero: { label: h.hero.label, value: h.hero.total, lines: h.hero.others }, sections: [
        { id: "accounts", title: "Accounts", empty: "No accounts yet", rows: h.accounts.map((a) => ({ id: a.id, title: a.name, subtitle: a.masked, value: a.balance, place: "accounts.detail", passes: { accountId: a.id } })) },
        { id: "insights", title: "Spending", empty: "No budgets yet", place: "accounts.budgets", rows: h.insights.map((i) => ({ id: i.id, title: i.name, subtitle: `${i.spent} of ${i.limit}`, progress: i.pct, tone: i.over ? "negative" as const : "neutral" as const })) },
        { id: "upcoming", title: "Upcoming", empty: "Nothing scheduled", rows: h.upcoming.map((u) => ({ id: u.id, title: u.title, subtitle: u.when, value: u.amount, place: "home.upcoming", passes: { scheduleId: u.id } })) },
        { id: "recent", title: "Recent", empty: "No activity yet", rows: h.recent.map((t) => ({ id: t.id, title: t.title, value: `${t.incoming ? "+" : "-"}${t.amount}`, tone: t.incoming ? "positive" as const : "neutral" as const })) },
      ] };
    }
    case "accounts": {
      // the accounts at other banks the customer connected are listed apart, read only (a list that cannot be read leaves the section empty)
      const [accounts, budgets, linked] = await Promise.all([call("bank.accounts.list"), call("bank.budgets.list"), call("bank.accounts.linked").catch(() => ({}))]);
      const accs = list<RawAccount>(accounts);
      const first = accs[0];
      const tx = first ? list<any>(await call("bank.transactions.list", { accountId: first.id })) : [];
      return { tab, sections: [
        { id: "accounts", title: "Accounts", empty: "No accounts yet", rows: accs.map((a) => ({ id: a.id, title: a.name, subtitle: `${a.maskedNumber} · ${a.currency}`, value: money(a.balance, a.currency), tag: a.kind === "savings" ? "Savings" : undefined, place: "accounts.detail", passes: { accountId: a.id } })) },
        { id: "transactions", title: first ? `${first.name} activity` : "Activity", empty: "No transactions yet", rows: tx.map((t) => ({ id: t.id, title: t.title, subtitle: `${t.date} · ${t.category}`, value: money(t.amount, t.currency), tone: t.amount > 0 ? "positive" as const : "neutral" as const, tag: t.status === "pending" ? "Pending" : undefined, place: "accounts.transaction", passes: { transactionId: t.id } })) },
        ...(Object.keys(linked).length ? [{ id: "linked", title: "At other banks", empty: "", rows: list<any>(linked).map((l) => ({ id: l.id, title: l.title, subtitle: `${l.line} · ${l.maskedNumber}`, value: l.balanceText })) }] : []),
        { id: "budgets", title: "Budgets", empty: "No budgets yet", place: "accounts.budgets", rows: list<RawBudget>(budgets).map((b) => ({ id: b.id, title: b.name, subtitle: `${money(b.spent, first?.currency ?? "USD")} of ${money(b.limit, first?.currency ?? "USD")}`, progress: b.limit > 0 ? Math.min(100, Math.round((b.spent / b.limit) * 100)) : 0, tone: b.spent > b.limit ? "negative" as const : "neutral" as const, place: "accounts.budget", passes: { budgetId: b.id } })) },
      ] };
    }
    case "payments": {
      const [bens, scheds] = await Promise.all([call("bank.beneficiaries.list"), call("bank.schedules.list", { status: "live" })]);
      return { tab, sections: [
        { id: "beneficiaries", title: "Beneficiaries", empty: "No beneficiaries yet", place: "payments.beneficiaries", rows: list<any>(bens).map((b) => ({ id: b.id, title: b.displayName, subtitle: `${b.maskedNumber} · ${b.country}`, // the bank's own wording for the account (scheme names) stays off the screen
 place: "payments.beneficiary", passes: { beneficiaryId: b.id } })) },
        { id: "scheduled", title: "Scheduled", empty: "Nothing scheduled", place: "payments.scheduled", rows: [...list<RawSchedule>(scheds)].sort((a, b) => (a.nextRunOn ?? "9999").localeCompare(b.nextRunOn ?? "9999")).map((s) => ({ id: s.id, title: s.name ?? "Payment", subtitle: s.nextRunOn ?? s.text, value: s.amount !== undefined ? money(s.amount, s.currency ?? "USD") : undefined, place: "payments.scheduled", passes: { scheduleId: s.id } })) },
      ] };
    }
    case "cards": {
      const [cards, spending] = await Promise.all([call("bank.cards.issued"), call("bank.cards.transactions", { limit: 8 })]);
      return { tab, sections: [
        {
          id: "cards", title: "Cards", empty: "No cards yet",
          rows: list<any>(cards).map((c) => ({
            id: c.id, title: c.nickname ?? c.kind, subtitle: `${c.networkName ?? c.network} •• ${c.last4} · ${c.expiry}`, tag: c.status === "active" && !c.virtual ? undefined : String(c.pill ?? c.status), tone: c.status === "active" ? "neutral" as const : "warning" as const,
            place: "cards.card", passes: { cardId: c.id }, state: c.virtual && (c.status === "active" || c.status === "frozen") ? `virtual-${c.status}` : String(c.status),
          })),
        },
        {
          id: "spending", title: "Card spending", empty: "No card spending yet", place: "cards.spending",
          rows: list<any>(spending.items).map((t) => ({
            id: t.id, title: t.merchant, subtitle: `${t.cardName} · ${t.when}`, value: t.amountText, tag: t.status === "disputed" ? "Disputed" : t.pending ? "Pending" : undefined, tone: "neutral" as const,
            place: "cards.transaction", passes: { cardId: t.cardId, transactionId: t.id }, state: t.reportable ? "reportable" : "none",
          })),
        },
      ] };
    }
    case "save": {
      const [deps, goals, loans, funds] = await Promise.all([call("bank.deposits.list"), call("bank.goals.list"), call("bank.loans.list"), call("bank.funds.holdings")]);
      return { tab, sections: [
        { id: "goals", title: "Savings goals", empty: "No goals yet", place: "save.goals", rows: list<any>(goals).map((g) => ({ id: g.id, title: g.name, subtitle: `${g.savedText} ${g.ofText} · ${g.line}`, progress: g.pct, place: "save.goal", passes: { goalId: g.id } })) },
        { id: "deposits", title: "Term deposits", empty: "No deposits yet", place: "save.deposits", rows: list<any>(deps).map((d) => ({ id: d.id, title: d.title ?? d.name, subtitle: `${d.line}${d.renewalText ? ` · ${d.renewalText}` : ""}`, value: money(d.principal, d.currency), place: "save.deposit", passes: { depositId: d.id } })) },
        { id: "loans", title: "Loans", empty: "No loans", place: "save.loans", rows: list<any>(loans).map((l) => ({ id: l.id, title: l.name, subtitle: `${l.nextText} · ${l.pctText}`, value: money(l.outstanding, l.currency), progress: l.pct, place: "save.loan", passes: { loanId: l.id } })) },
        { id: "investments", title: "Investments", empty: "No investments yet", place: "save.investments", rows: list<any>(funds).map((h) => ({ id: h.id, title: h.name, subtitle: `${h.unitsText} units`, value: h.valueText, place: "save.holding", passes: { fundId: h.id, holdId: h.id } })) },
      ] };
    }
    default: {
      // the counts are a courtesy: a list that cannot be read leaves its section empty, it does not take the tab down
      const soft = (p: Promise<any>) => p.catch(() => ({}));
      const [profile, messages, requests, linked] = await Promise.all([call("bank.profile.get"), soft(call("bank.messages.list")), soft(call("bank.requests.list")), soft(call("bank.accounts.linked"))]);
      const address = profile.addressText ?? (profile.address ? [profile.address.line1, profile.address.city, [profile.address.region, profile.address.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ") : "");
      const waiting = (k: "mobile" | "email" | "address") => (profile.pending?.[k] ? "Pending" : undefined);
      return { tab, sections: [
        { id: "profile", title: "Profile", empty: "", place: "more.profile", rows: [
          { id: "name", title: profile.name, subtitle: "Full name. To change it, send a service request." },
          { id: "phone", title: profile.phone, subtitle: "Mobile number", tag: waiting("mobile"), tone: "warning" as const, place: "more.profile", passes: { field: "phone" } },
          { id: "email", title: profile.email, subtitle: "Email", tag: waiting("email"), tone: "warning" as const, place: "more.profile", passes: { field: "email" } },
          ...(address ? [{ id: "address", title: address, subtitle: "Home address", tag: waiting("address"), tone: "warning" as const, place: "more.profile", passes: { field: "address" } }] : []),
        ] },
        { id: "messages", title: "Messages", empty: "No messages", place: "more.messages", rows: list<any>(messages).map((m) => ({ id: m.id, title: m.subject, subtitle: m.preview ? `${m.preview} · ${m.dateText}` : date(m.at), tag: (m.unread ?? !m.read) ? "New" : undefined })) },
        { id: "requests", title: "Requests", empty: "No requests", place: "more.requests", rows: list<any>(requests).map((r) => ({ id: r.id, title: r.title ?? r.summary, subtitle: r.line ?? r.type, tag: r.status })) },
        { id: "linked", title: "Linked banks", empty: "You haven't connected another bank yet. Connect one to see all your money in one place.", place: "more.linked", rows: list<any>(linked).map((l) => ({ id: l.id, title: l.title, subtitle: `${l.line} · ${l.maskedNumber}`, value: l.balanceText })) },
        { id: "settings", title: "Settings", empty: "", rows: [{ id: "security", title: "Security", subtitle: "Password, quick sign-in, devices and your recent sign-ins", go: "security" }] },
      ] };
    }
  }
}

// ---- Business -----------------------------------------------------------------------------------------------------
const payments = (r: Record<string, RawCorpPayment> | undefined) => list<RawCorpPayment>(r);
const queueRows = (items: ReturnType<typeof approvalQueue>, place: string): Row[] => items.map((i) => ({
  id: i.id, title: i.payee, subtitle: `${i.id} · ${i.reference}`.replace(/ · $/, ""), value: i.amount, tag: i.own ? "Yours" : i.progress, tone: i.approvable ? "warning" as const : "neutral" as const, place, passes: { paymentId: i.id },
}));

/** Who the person is inside the company comes from the company itself (`me` in `corp.company.get`), so a queue never offers them their own payment. */
export async function loadBusiness(call: Call, ctx: ContextInfo, tab: ShellTab): Promise<Screen> {
  const mayApprove = canApprove(ctx);
  const company = await call("corp.company.get");
  const userId: string = company.me?.id ?? "";
  const pending = async () => approvalQueue(payments(await call("corp.payments.pending")), userId, mayApprove);
  switch (tab) {
    case "overview": {
      const queue = await pending();
      const o = businessOverview({ currency: company.currency, accounts: list<RawCorpAccount>(company.accounts), cutoff: company.cutoff, queue, me: company.me });
      return { tab, approvals: approvalBadge(queue), hero: { label: "Total balance", value: o.total, lines: o.others }, sections: [
        { id: "accounts", title: "Accounts", empty: "No accounts", rows: o.balances.map((a) => ({ id: a.id, title: a.name, subtitle: `${a.masked} · ${a.currency}`, value: a.balance, place: "accounts.detail", passes: { accountId: a.id } })) },
        { id: "approvals", title: "Waiting for approval", empty: "Nothing waiting", rows: queueRows(queue, "overview.approvals") },
        { id: "limits", title: "Today", empty: "", rows: [{ id: "cutoff", title: "Payment cut-off", value: `${o.cutoff} UTC` }, ...(o.limit ? [{ id: "limit", title: "Your daily limit", subtitle: `${o.limit.used} of ${o.limit.daily}`, progress: o.limit.pct }] : [])] },
      ] };
    }
    case "accounts": {
      return { tab, sections: [{ id: "accounts", title: "Accounts", empty: "No accounts", rows: list<RawCorpAccount>(company.accounts).map((a) => ({ id: a.id, title: a.name, subtitle: `${a.maskedNumber} · ${a.currency}`, value: money(a.balance, a.currency), place: "accounts.detail", passes: { accountId: a.id } })) }] };
    }
    case "payments": {
      // the scheduled payments are a courtesy: a list that cannot be read leaves its section empty, it does not take the tab down
      // (the bulk batches are the same courtesy, and only for a person who may start one)
      const [pend, suppliers, templates, scheduled, bulk] = await Promise.all([call("corp.payments.pending"), call("corp.suppliers.list"), call("corp.templates.list"), call("corp.schedules.list").catch(() => ({})), can(ctx, "biz.payments.bulk") ? call("corp.bulk.list").catch(() => ({ batches: {} })) : Promise.resolve({ batches: {} })]);
      return { tab, sections: [
        { id: "tracker", title: "In progress", empty: "No payments in progress", rows: payments(pend).map((p) => ({ id: p.id, title: p.payee ?? "Payment", subtitle: `${p.id} · value date ${p.valueDate ?? ""}`, value: money(p.amount, p.currency), tag: `${p.approvals.length} of ${p.required} approved`, place: "payments.payment", passes: { paymentId: p.id } })) },
        ...(can(ctx, "biz.payments.bulk") ? [{ id: "bulk", title: "Bulk batches", empty: "No batches yet", place: "payments.bulk", rows: list<any>(bulk?.batches).map((b) => ({ id: b.id, title: b.name, subtitle: b.line, value: b.totalText, tag: b.statusText, tone: b.statusKey === "partly" || b.statusKey === "waiting" ? "warning" as const : "neutral" as const, place: "payments.bulk", passes: { id: b.id, paymentId: b.id }, state: b.canResend ? "partly" : b.statusKey })) }] : []),
        { id: "scheduled", title: "Scheduled", empty: "Nothing scheduled", place: "payments.scheduled", rows: list<any>(scheduled).map((x) => ({ id: x.id, title: `${x.supplierName} \u00b7 ${x.reference}`, subtitle: x.line, tag: x.badge, tone: x.statusKey === "awaiting" ? "warning" as const : "neutral" as const, place: "payments.scheduled", passes: { scheduleId: x.id } })) },
        { id: "templates", title: "Templates", empty: "No templates yet", place: "payments.templates", rows: list<any>(templates).map((t) => ({ id: t.id, title: t.name, subtitle: t.reference, value: t.amountText ?? (t.amount !== undefined ? money(t.amount, company.currency) : undefined), tag: t.status === "waiting" ? "Waiting for approval" : t.status === "unavailable" ? "Unavailable" : undefined, place: "payments.templates", passes: { templateId: t.id } })) },
        { id: "suppliers", title: "Suppliers", empty: "No suppliers yet", place: "payments.suppliers", rows: list<any>(suppliers).map((s) => ({ id: s.id, title: s.name, subtitle: `${s.bank} · ${s.currency}`, place: "payments.suppliers", passes: { supplierId: s.id } })) },
      ] };
    }
    case "approvals": {
      const queue = await pending();
      return { tab, approvals: approvalBadge(queue), sections: [{ id: "inbox", title: "Inbox", empty: "Nothing waiting for approval", rows: queueRows(queue, "approvals.inbox") }] };
    }
    case "admin": {
      const [users, groups, audit] = await Promise.all([
        can(ctx, "biz.admin.users") ? call("corp.users.list") : {}, can(ctx, "biz.admin.signatories") ? call("corp.signatories.list") : {}, can(ctx, "biz.audit.view") ? call("corp.audit.list") : {},
      ]);
      return { tab, sections: [
        { id: "users", title: "Users", empty: "No users", place: "admin.users", rows: list<any>(users).map((u) => ({ id: u.id, title: u.name, tag: u.sub, place: "admin.users", passes: { userId: u.id } })) },
        { id: "groups", title: "Signatory groups", empty: "No groups", place: "admin.groups", rows: list<any>(groups).map((g) => ({ id: g.id, title: g.name, subtitle: `${g.mode} · ${g.required} required`, place: "admin.groups", passes: { groupId: g.id } })) },
        { id: "audit", title: "Audit trail", empty: "Nothing recorded", rows: list<any>(audit).map((a) => ({ id: a.id, title: a.action, subtitle: `${a.userId} · ${date(a.at)}`, tag: a.outcome, tone: a.outcome === "Done" ? "neutral" as const : "negative" as const })) },
      ] };
    }
    default: {
      return { tab, sections: [
        { id: "profile", title: "Business", empty: "", place: "more.profile", rows: [{ id: "name", title: company.name, subtitle: company.currency }, { id: "role", title: "Your role", value: ctx.roles.join(" · ") }] },
        { id: "requests", title: "Requests", empty: "No open requests", place: "more.requests", rows: [] },
      ] };
    }
  }
}

export const loadScreen = (call: Call, ctx: ContextInfo, tab: ShellTab): Promise<Screen> => (ctx.workspace === "business" ? loadBusiness(call, ctx, tab) : loadPersonal(call, tab));
