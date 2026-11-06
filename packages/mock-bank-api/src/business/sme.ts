import { currencyInfo, fromMinor, roundMoney, toMinor } from "@finx/ui-kit";
import { BankError } from "../errors";
import type { BankConfig } from "../config";
import type { SandboxConditions } from "../index";
import { BANKWORKX_FX, midRate, priceQuote } from "../retail/fx";
import { railsFor, speedsFor, type Offer, type SendType } from "../retail/payments";
import { addDays, addMonths, changeState, dayName, FREQUENCIES, isOpen, isoOf, msOf, nominal, remaining, runDate, upcoming, validIso, type Freq } from "../retail/schedules";
import { checkName, checkPayee, COUNTRY_RULES, WORLD_COUNTRIES, type PayeeDetails, type PayeeInput } from "../retail/payees";
import type { OtpState } from "../retail/retail";
import { permissionsOf } from "../identity";
import type { Actor } from "./business";
import type { CorpBeneficiary, CorpCompany, CorpPayment, CorpTemplate, Flaws } from "./corporate";
import type { CorporateProvider } from "./corporate-provider";
import { BUSINESS_PURPOSES, DOMESTIC, fmt, supplierLine } from "./rules";
import { DOMAINS, identifiers, RIGHTS, SCHEDULE_SEEDS, seedTransactions, SUPPLIER_KEYS, UK_ACCOUNT_KIND, type Rights, type Tx } from "./sme-data";

/**
 * The business sandbox beyond payments (BankWorkx Business, Accounts and Payments): the accounts a person may see and what they may do with each,
 * their transactions, statements by email, requests to add a supplier, payment templates, scheduled supplier payments, the tracker and withdrawing.
 * Every call is made for the company of the active context; what a person may do is decided here (the permission of the call, then the right on
 * the account), never by a screen. Every rule can be switched off for the mutation check (Flaws). Money is kept as the company keeps it (whole
 * currency units with the currency's own decimals) and every sum is made in the smallest unit.
 */
export type SmeHost = {
  now: () => number; otp: OtpState; config: () => BankConfig; conditions: () => SandboxConditions; flaws: () => Flaws; actor: () => Actor | undefined;
  log: (corp: CorporateProvider, userId: string, action: string, outcome?: "Done" | "Refused") => void;
};

/** What each adapter needs the context to allow (the shell and the journeys of docs/journeys/02-sme.md). */
export const SME_NEEDS: Record<string, string> = {
  "corp.accounts.overview": "biz.accounts.view", "corp.accounts.list": "biz.accounts.view", "corp.accounts.get": "biz.accounts.view", "corp.transactions.list": "biz.accounts.view",
  "corp.statements.list": "biz.accounts.export", "corp.statements.check": "biz.accounts.export", "corp.statements.generate": "biz.accounts.export", "corp.statements.schedule": "biz.accounts.export",
  "corp.suppliers.validate": "biz.suppliers.manage", "corp.suppliers.check": "biz.suppliers.manage", "corp.suppliers.request": "biz.suppliers.manage",
  "corp.templates.save": "biz.templates.manage", "corp.templates.delete": "biz.templates.manage",
  "corp.schedules.list": "biz.accounts.view", "corp.schedules.get": "biz.payments.schedule", "corp.schedules.check": "biz.payments.schedule", "corp.schedules.create": "biz.payments.schedule", "corp.schedules.update": "biz.payments.schedule", "corp.schedules.cancel": "biz.payments.schedule",
  "corp.payments.track": "biz.accounts.view",
};
const OWN = /^corp\.(accounts\.(overview|list|get)|transactions\.list|statements\.(list|check|generate|schedule)|suppliers\.(validate|check|request|list)|templates\.(save|delete|list)|schedules\.(list|get|check|create|update|cancel)|payments\.track|sandbox\.arrange)$/;

export const MAX_TEMPLATES = 20;
export const MAX_SCHEDULES = 20;
export const MAX_STATEMENT_SCHEDULES = 10;
export const MAX_PENDING_SUPPLIERS = 10;
export const MAX_RECIPIENTS = 5;
const MAX_MONTHS = 24;
const WITHDRAW_REASONS = ["Wrong amount", "Wrong supplier", "Wrong reference", "Not needed any more", "Other"];
const REFERENCE_CHARS = new Set(" .,'-/()+:#");
const NAME_CHARS = new Set(" .,'’&()/-");
const PERIODS: Record<string, string> = { "7d": "7 days", "30d": "30 days", "90d": "90 days", month: "This month" };
const FORMATS: Record<string, string> = { pdf: "PDF", csv: "CSV", excel: "Excel", bai2: "BAI2", mt940: "MT940", camt053: "camt.053", mt942: "MT942", camt052: "camt.052" };
const DAYS: Record<string, string> = { mon: "Monday", tue: "Tuesday", fri: "Friday" };
const MONTH_DAYS: Record<string, string> = { "1": "1st", "5": "5th", last: "last business day" };
const STATUS_WORDS: Record<string, string> = { pending_approval: "Pending approval", released: "Released to bank", settled: "Settled", rejected: "Rejected", withdrawn: "Withdrawn" };

type Req = { id: string; name: string; type: "company" | "person"; where: "same" | "abroad"; accountName: string; account: string; country?: string; key: string; addedBy: string; addedAt: string; address?: { street: string; city: string; postcode: string }; status: "waiting_approval" };
type Tpl = CorpTemplate & { createdBy: string };
type Sch = { id: string; supplierId: string; amount: number; currency: string; reference: string; purpose: string; frequency: "once" | "weekly" | "monthly" | "quarterly"; anchor: string; done: number; paid: number; endsOn: string | null; endCount: number | null; status: "awaiting" | "active" | "cancelled"; approvals: number; required: 1 | 2; last: string; createdBy: string; cancelledOn?: string };
type StmSch = { id: string; accountIds: string[]; format: string; frequency: "daily" | "weekly" | "monthly"; day: string; recipients: string[]; first: string; createdBy: string };
type State = { tx: Tx[]; reqs: Req[]; tpls: Tpl[]; sch: Sch[]; stm: StmSch[]; wd: Map<string, { reason: string; note: string }>; n: { req: number; tpl: number; sch: number; stm: number; ref: number } };

function fail(code: string, message: string): never { throw new BankError(code, message); }
const minorSum = (list: number[], currency: string) => fromMinor(list.reduce((s, n) => s + toMinor(n, currency), 0), currency);

export class SmeSandbox {
  private st = new Map<string, State>();
  constructor(private host: SmeHost) {}

  /** Whether this class answers the adapter: its own, and the three older ones it makes richer (suppliers and templates list, withdraw with a session). */
  handles(adapter: string, hasActor: boolean) { return OWN.test(adapter) || (adapter === "corp.payments.withdraw" && hasActor); }

  private get f() { return this.host.flaws(); }
  private now = () => this.host.now();
  private today = () => isoOf(this.now());
  private state(co: CorpCompany): State {
    let s = this.st.get(co.id);
    if (!s) {
      s = {
        tx: seedTransactions(co.id), reqs: [], wd: new Map(), n: { req: 0, tpl: 0, sch: 0, stm: 0, ref: 0 },
        tpls: (co.templates ?? []).map((t) => ({ ...t, createdBy: "alex" })),
        sch: (SCHEDULE_SEEDS[co.id] ?? []).map((x) => ({ ...x, createdBy: "alex" })),
        stm: co.id === "gamma" ? [] : [{ id: "STS-1", accountIds: co.accounts.slice(0, 1).map((a) => a.id), format: "pdf", frequency: "weekly", day: "mon", recipients: [`finance@${DOMAINS[co.id] ?? "company.example"}`], first: "2026-11-09", createdBy: "alex" }],
      };
      this.st.set(co.id, s);
    }
    return s;
  }
  private closed = (co: CorpCompany) => [...co.holidays, ...(this.host.conditions().closedDays ?? [])];
  private userOf(co: CorpCompany, id: string) { return co.users.find((u) => u.id === id) ?? fail("USER_NOT_FOUND", `No user ${id} at ${co.name}`); }
  private perms(co: CorpCompany, userId: string) { return this.host.actor()?.permissions ?? permissionsOf(this.userOf(co, userId).roles); }
  private home() { return this.host.config().homeMarket; }

  /** What a person may do with an account: the table of the company, and paying also needs the permission and the company's currency. */
  rights(co: CorpCompany, accountId: string, userId: string): Rights {
    const a = co.accounts.find((x) => x.id === accountId) ?? fail("ACCOUNT_NOT_FOUND", "We can’t find that account.");
    const r = RIGHTS[co.id]?.[accountId]?.[userId] ?? {};
    const own = this.f.bizRights === false ? { transactions: true, export: true, pay: true } : { transactions: r.transactions !== false, export: r.export !== false, pay: r.pay !== false };
    return { ...own, pay: own.pay && this.perms(co, userId).includes("biz.payments.initiate") && a.currency === co.currency };
  }
  private pendingOut(s: State, accountId: string, currency: string) { return minorSum(s.tx.filter((t) => t.accountId === accountId && t.status === "pending" && t.amount < 0).map((t) => -t.amount), currency); }
  private heldBy(corp: CorporateProvider, accountId: string, currency: string) { return minorSum((corp.all?.() ?? []).filter((p) => p.status === "pending_approval" && p.fromAccountId === accountId).map((p) => p.amount), currency); }
  /** The ledger balance less what is still to leave: pending items and payments waiting for approval. */
  private available(corp: CorporateProvider, co: CorpCompany, s: State, a: CorpCompany["accounts"][number]) {
    if (this.f.bizAvailable === false) return a.balance;
    return fromMinor(toMinor(a.balance, a.currency) - toMinor(this.pendingOut(s, a.id, a.currency), a.currency) - toMinor(this.heldBy(corp, a.id, a.currency), a.currency), a.currency);
  }
  /** An amount in the company's currency at the sandbox's mid-market rate. */
  private toCompany(co: CorpCompany, amount: number, currency: string) {
    if (currency === co.currency) return amount;
    const rate = midRate(currency, co.currency, BANKWORKX_FX);
    return rate === undefined ? 0 : fromMinor(Math.round(toMinor(amount, currency) * rate * 10 ** (currencyInfo(co.currency).decimals - currencyInfo(currency).decimals)), co.currency);
  }
  private usd(co: CorpCompany, amount: number, currency: string) { return currency === co.currency ? amount : priceQuote(co.currency, currency, amount, { cfg: BANKWORKX_FX, direction: "get", feeWaived: true }).send; }

  call(adapter: string, input: Record<string, any>, corp: CorporateProvider, userId: string): any {
    const co = corp.getCompany(), s = this.state(co);
    switch (adapter) {
      case "corp.accounts.overview": return this.overview(corp, co, s, userId);
      case "corp.accounts.list": return this.accounts(corp, co, s, userId, input);
      case "corp.accounts.get": return this.account(corp, co, s, userId, input);
      case "corp.transactions.list": return this.transactions(co, s, userId, input);
      case "corp.statements.list": return this.statementList(co, s, userId, input);
      case "corp.statements.check": return this.generate(corp, co, s, userId, { ...input, check: true });
      case "corp.statements.generate": return this.generate(corp, co, s, userId, input);
      case "corp.statements.schedule": return this.statementSchedule(corp, co, s, userId, input);
      case "corp.suppliers.list": return this.suppliers(co, s, input);
      case "corp.suppliers.validate": return this.validateSupplier(co, s, input);
      case "corp.suppliers.check": return this.supplierCheck(co, s, input);
      case "corp.suppliers.request": return this.requestSupplier(corp, co, s, userId, input);
      case "corp.templates.list": return this.templates(co, s);
      case "corp.templates.save": return this.saveTemplate(corp, co, s, userId, input);
      case "corp.templates.delete": return this.deleteTemplate(corp, co, s, userId, input);
      case "corp.schedules.list": return this.scheduleList(corp, co, s, userId, input);
      case "corp.schedules.get": return this.scheduleGet(corp, co, s, input);
      case "corp.schedules.check": return this.scheduleCheck(corp, co, s, userId, input);
      case "corp.schedules.create": return this.scheduleCreate(corp, co, s, userId, input);
      case "corp.schedules.update": return this.scheduleUpdate(corp, co, s, userId, input);
      case "corp.schedules.cancel": return this.scheduleCancel(corp, co, s, userId, input);
      case "corp.payments.track": return this.track(corp, co, s, userId, input);
      case "corp.payments.withdraw": return this.withdraw(corp, co, s, userId, input);
      case "corp.sandbox.arrange": return this.arrange(corp, co, s, input);
    }
    return undefined;
  }

  /** The one-time code a request needs: from a threshold in the company's currency, or always when `always`. The code is spent when the request is made. */
  private needCode(co: CorpCompany, amount: number, always = false) {
    const asked = always || co.codeAbove === undefined || amount >= co.codeAbove;
    if (asked && !this.host.otp.verified) fail(this.host.otp.attempts >= 3 ? "STEP_UP_FAILED" : "OTP_REQUIRED", this.host.otp.attempts >= 3 ? "We couldn’t confirm this request. Nothing was sent. Start again." : "OTP not verified");
  }
  private spendCode() { this.host.otp.verified = false; }
  private reference(prefix: string, s: State) { return `${prefix}-${this.today().replace(/-/g, "")}-${String(++s.n.ref).padStart(4, "0")}`; }

  /* ------------------------------------------------------------------------------------------------ accounts */

  private row(corp: CorporateProvider, co: CorpCompany, s: State, a: CorpCompany["accounts"][number], userId: string) {
    const rights = this.rights(co, a.id, userId), available = this.available(corp, co, s, a);
    return {
      id: a.id, name: a.name, maskedNumber: a.maskedNumber, currency: a.currency, type: a.id.endsWith("_pay") ? "payroll" : a.id.endsWith("_res") ? "savings" : "current", status: "active",
      ledgerBalance: a.balance, availableBalance: available, ledgerText: fmt(a.balance, a.currency), availableText: fmt(available, a.currency),
      line: `${a.maskedNumber} · ${a.currency}`, chip: rights.transactions ? "" : "View only", nameText: rights.transactions ? a.name : `${a.name} · View only`, rights,
    };
  }
  /** The accounts and the total across them, converted into the company's currency at the sandbox's rates. */
  private overview(corp: CorporateProvider, co: CorpCompany, s: State, userId: string) {
    const rows = co.accounts.map((a) => this.row(corp, co, s, a, userId));
    const total = this.f.bizTotal === false ? minorSum(co.accounts.map((a) => a.balance), co.currency) : fromMinor(co.accounts.reduce((sum, a) => sum + toMinor(this.toCompany(co, a.balance, a.currency), co.currency), 0), co.currency);
    const exportable = rows.filter((r) => r.rights.export).length;
    return {
      company: co.name, currency: co.currency, count: rows.length, total, totalText: fmt(total, co.currency), exportable,
      note: `Total across ${rows.length} account${rows.length === 1 ? "" : "s"}, in ${co.currency}`, rates: "Rates are indicative.",
      accounts: Object.fromEntries(rows.map((r) => [r.id, r])),
    };
  }
  /** The accounts as a map; `for: "export"` lists only those the person may export. */
  private accounts(corp: CorporateProvider, co: CorpCompany, s: State, userId: string, input: Record<string, any>) {
    const rows = co.accounts.map((a) => this.row(corp, co, s, a, userId)).filter((r) => input.for !== "export" || r.rights.export);
    return Object.fromEntries(rows.map((r) => [r.id, { ...r, option: `${r.name} ${r.maskedNumber} · ${r.currency}` }]));
  }
  private account(corp: CorporateProvider, co: CorpCompany, s: State, userId: string, input: Record<string, any>) {
    const a = co.accounts.find((x) => x.id === input.accountId) ?? fail("ACCOUNT_NOT_FOUND", "We can’t find that account.");
    const r = this.row(corp, co, s, a, userId);
    const [first, second] = identifiers(a.id, a.maskedNumber, this.home());
    const show = input.details !== false || this.f.bizDetails === false;
    return { ...r, holds: fromMinor(toMinor(r.ledgerBalance, a.currency) - toMinor(r.availableBalance, a.currency), a.currency), identifiers: show ? { first, second, name: { label: "Account name", value: co.name } } : null };
  }

  /** The days a period covers, from the clock: 7, 30 and 90 days end today; "This month" starts on the 1st. */
  private span(period: string) {
    const today = this.today(), days = { "7d": 7, "30d": 30, "90d": 90 }[period];
    if (period === "month") return { from: `${today.slice(0, 8)}01`, to: today };
    return { from: addDays(today, -((days ?? 30) - 1)), to: today };
  }
  private transactions(co: CorpCompany, s: State, userId: string, input: Record<string, any>) {
    const period = String(input.period ?? "30d"), q = String(input.text ?? "").trim().toLowerCase();
    if (!(period in PERIODS)) fail("INVALID_RANGE", "Choose a period from the list.");
    let allowed = co.accounts.filter((a) => this.rights(co, a.id, userId).transactions);
    if (input.accountId) {
      const a = co.accounts.find((x) => x.id === input.accountId) ?? fail("ACCOUNT_NOT_FOUND", "We can’t find that account.");
      if (!this.rights(co, a.id, userId).transactions) fail("ACCOUNT_NOT_PERMITTED", "You can see the balance of this account, but not its transactions.");
      allowed = [a];
    }
    const ids = new Set(allowed.map((a) => a.id)), span = this.span(period), name = new Map(co.accounts.map((a) => [a.id, a.name]));
    const hits = s.tx.filter((t) => ids.has(t.accountId) && (this.f.bizPeriod === false || (t.date >= span.from && t.date <= span.to))
      && (this.f.bizSearch === false || !q || t.description.toLowerCase().includes(q) || t.reference.toLowerCase().includes(q)))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    const rows = hits.slice(0, 25).map((t) => ({
      id: t.id, accountId: t.accountId, date: dayName(t.date).slice(4), dateIso: t.date, description: t.description, reference: t.reference, text: `${t.description} · ${t.reference}`, account: name.get(t.accountId)!,
      amount: t.amount, currency: t.currency, amountText: fmt(t.amount, t.currency), status: t.status === "pending" ? "Pending" : "Booked", pending: t.status === "pending",
      where: input.accountId ? (t.status === "pending" ? "Pending" : "Booked") : `${name.get(t.accountId)!}${t.status === "pending" ? " · Pending" : ""}`,
    }));
    return { from: span.from, to: span.to, period, periodText: PERIODS[period]!, count: hits.length, shown: rows.length, rows: Object.fromEntries(rows.map((r) => [r.id, r])) };
  }

  /* ----------------------------------------------------------------------------------------------- statements */

  private resolvePeriod(input: Record<string, any>): { from: string; to: string } {
    const today = this.today(), first = `${today.slice(0, 8)}01`, kind = String(input.period ?? "last");
    if (input.type === "intraday") return { from: today, to: today };
    if (kind === "7d") return { from: addDays(today, -6), to: today };
    if (kind === "month") return { from: first, to: today };
    if (kind === "last") return { from: addMonths(first, -1), to: addDays(first, -1) };
    if (kind === "3m") return { from: addMonths(first, -3), to: addDays(first, -1) };
    if (kind === "custom") {
      const from = input.from, to = input.to;
      if (!validIso(from) || !validIso(to)) fail("INVALID_RANGE", "Choose a start and an end date.");
      if (this.f.stmtRange !== false) {
        if (to < from) fail("INVALID_RANGE", "The end date is before the start date.");
        if (to > addMonths(from, MAX_MONTHS)) fail("PERIOD_TOO_LONG", "Choose up to 24 months at a time.");
      }
      return { from, to };
    }
    return fail("INVALID_RANGE", "Choose a period from the list.");
  }
  private formatOk(format: string, input: Record<string, any>) {
    const bank = input.type === "intraday" ? ["bai2", "mt942", "camt052"] : ["bai2", "mt940", "camt053"];
    return this.f.stmtFormat === false ? format in FORMATS : ["pdf", "csv", "excel"].includes(format) || (input.bankFormats === true && bank.includes(format));
  }
  private recipients(co: CorpCompany, text: unknown, external: boolean) {
    const list = String(text ?? "").split(",").map((x) => x.trim()).filter(Boolean), domain = DOMAINS[co.id] ?? "company.example";
    const valid = (e: string) => { const at = e.indexOf("@"), dom = e.slice(at + 1); return at > 0 && at === e.lastIndexOf("@") && !e.includes(" ") && e.length <= 254 && dom.includes(".") && !dom.startsWith(".") && !dom.endsWith(".") && !dom.includes(".."); };
    if (this.f.stmtRecipients !== false && (list.length === 0 || list.length > MAX_RECIPIENTS || String(text ?? "").length > 200 || !list.every(valid))) fail("INVALID_RECIPIENT", "Check the email addresses. Use up to 5, separated by commas.");
    if (this.f.stmtExternal !== false && !external && !list.every((e) => e.toLowerCase().endsWith(`@${domain}`))) fail("EXTERNAL_RECIPIENT_BLOCKED", "You can only send to addresses at your company.");
    return list;
  }
  private statementAccounts(co: CorpCompany, userId: string, input: Record<string, any>) {
    const ids: string[] = Array.isArray(input.accountIds) ? input.accountIds.map(String) : [];
    if (!ids.length) fail("ACCOUNT_REQUIRED", "Choose at least one account.");
    for (const id of ids) if (!this.rights(co, id, userId).export) fail("ACCOUNT_NOT_PERMITTED", "You can’t export this account.");
    return ids;
  }
  private defaultRecipient(co: CorpCompany, userId: string) { return `${this.userOf(co, userId).name.toLowerCase().split(" ").join(".")}@${DOMAINS[co.id] ?? "company.example"}`; }

  /** Builds a statement and emails it once. With `check` it only tests the accounts and the period (the first step); nothing is sent. */
  private generate(corp: CorporateProvider, co: CorpCompany, s: State, userId: string, input: Record<string, any>) {
    const ids = this.statementAccounts(co, userId, input);
    if (input.type === "intraday" && input.intraday !== true && this.f.stmtIntraday !== false) fail("FORMAT_NOT_ENABLED", "That format isn’t available.");
    const span = this.resolvePeriod(input);
    if (input.check === true) return { ok: true, from: span.from, to: span.to };
    const format = String(input.format ?? "pdf");
    if (!this.formatOk(format, input)) fail("FORMAT_NOT_ENABLED", "That format isn’t available.");
    const to = this.recipients(co, input.recipients, input.external === true);
    const items = s.tx.filter((t) => ids.includes(t.accountId) && t.date >= span.from && t.date <= span.to && (input.type === "intraday" || t.status === "booked"));
    if (this.f.stmtEmpty !== false && items.length === 0) fail("NO_TRANSACTIONS", "There are no transactions in that period. Choose another period.");
    const names = co.accounts.filter((a) => ids.includes(a.id)).map((a) => a.name);
    this.host.log(corp, userId, `Sent a ${FORMATS[format]} statement for ${names.join(", ")}`);
    return {
      reference: this.reference("STM", s), format, formatText: FORMATS[format], accounts: names.join(", "), period: input.type === "intraday" ? "Today so far" : `${dayName(span.from, true)} to ${dayName(span.to, true)}`,
      from: span.from, to: span.to, recipients: to.join(", "), count: items.length, sent: true,
    };
  }

  /** The first day a schedule sends: strictly after today, on a business day. */
  private firstRun(co: CorpCompany, frequency: string, day: string) {
    const today = this.today(), closed = this.closed(co), open = (d: string) => { let x = d; while (!isOpen(x, closed)) x = addDays(x, 1); return x; };
    if (frequency === "daily") return open(addDays(today, 1));
    if (frequency === "weekly") { const want = { mon: 1, tue: 2, fri: 5 }[day]!; let d = addDays(today, 1); while (new Date(msOf(d)).getUTCDay() !== want) d = addDays(d, 1); return open(d); }
    const month = `${today.slice(0, 8)}01`;
    const lastOpen = (m: string) => { let d = addDays(addMonths(m, 1), -1); while (!isOpen(d, closed)) d = addDays(d, -1); return d; };
    if (day === "last") return lastOpen(month) > today ? lastOpen(month) : lastOpen(addMonths(month, 1));
    const on = (m: string) => open(`${m.slice(0, 8)}${String(Number(day)).padStart(2, "0")}`);
    return on(month) > today ? on(month) : on(addMonths(month, 1));
  }

  private stmView(co: CorpCompany, x: StmSch) {
    return { id: x.id, format: FORMATS[x.format] ?? x.format, frequency: x.frequency, how: x.frequency === "weekly" ? `Weekly, ${DAYS[x.day]}` : x.frequency === "monthly" ? `Monthly, ${MONTH_DAYS[x.day]}` : "Daily", first: dayName(x.first), recipients: x.recipients.join(", "), accounts: co.accounts.filter((a) => x.accountIds.includes(a.id)).map((a) => a.name).join(", ") };
  }
  /** The statement schedules that exist, the most there can be, the address a new one goes to by default and the accounts the person may export. */
  private statementList(co: CorpCompany, s: State, userId: string, input: Record<string, any> = {}) {
    const ids = co.accounts.filter((a) => this.rights(co, a.id, userId).export).map((a) => a.id);
    return { picked: ids.includes(input.accountId) ? [input.accountId] : ids, count: s.stm.length, max: MAX_STATEMENT_SCHEDULES, defaultRecipient: this.defaultRecipient(co, userId), accountIds: co.accounts.filter((a) => this.rights(co, a.id, userId).export).map((a) => a.id), schedules: Object.fromEntries(s.stm.map((x) => [x.id, this.stmView(co, x)])) };
  }

  private statementSchedule(corp: CorporateProvider, co: CorpCompany, s: State, userId: string, input: Record<string, any>) {
    const action = String(input.action ?? "create");
    const view = (x: StmSch) => this.stmView(co, x);
    if (action === "remove") {
      const i = s.stm.findIndex((x) => x.id === input.scheduleId);
      if (i < 0) fail("SCHEDULE_NOT_FOUND", "We can’t find that schedule.");
      s.stm.splice(i, 1);
      this.host.log(corp, userId, "Removed a statement schedule");
      return { count: s.stm.length, max: MAX_STATEMENT_SCHEDULES };
    }
    if (action !== "create") fail("UNKNOWN_ACTION", "Unknown action.");
    if (input.schedule === false) fail("FORMAT_NOT_ENABLED", "That isn’t available.");
    const ids = this.statementAccounts(co, userId, input), format = String(input.format ?? "pdf");
    if (!this.formatOk(format, input)) fail("FORMAT_NOT_ENABLED", "That format isn’t available.");
    const to = this.recipients(co, input.recipients, input.external === true);
    const frequency = String(input.frequency ?? "weekly") as StmSch["frequency"], day = String(input.day ?? "");
    if (!["daily", "weekly", "monthly"].includes(frequency) || (frequency === "weekly" && !(day in DAYS)) || (frequency === "monthly" && !(day in MONTH_DAYS))) fail("INVALID_SCHEDULE", "Choose how often.");
    if (this.f.stmtLimit !== false && s.stm.length >= MAX_STATEMENT_SCHEDULES) fail("SCHEDULE_LIMIT", "You already have 10 schedules. Remove one first.");
    const first = this.firstRun(co, frequency, day);
    const row: StmSch = { id: `STS-${++s.n.stm + 1}`, accountIds: ids, format, frequency, day, recipients: to, first, createdBy: userId };
    s.stm.push(row);
    this.host.log(corp, userId, `Created a ${frequency} ${FORMATS[format]} statement`);
    return { ...view(row), reference: this.reference("STM", s), count: s.stm.length, max: MAX_STATEMENT_SCHEDULES, formatText: FORMATS[format], frequencyText: frequency };
  }

  /* ------------------------------------------------------------------------------------------------ suppliers */

  private approved = (co: CorpCompany, id: unknown) => co.whitelist.find((b) => b.id === id);
  private suppliers(co: CorpCompany, s: State, input: Record<string, any>) {
    const out: Record<string, any> = Object.fromEntries(co.whitelist.map((b) => [b.id, { ...b, displayName: b.name, line: supplierLine(b, co), status: "approved", statusText: "Approved" }]));
    if (input.include === "all") for (const r of s.reqs) out[r.id] = { id: r.id, name: r.name, displayName: r.name, bank: "", maskedNumber: r.account, line: r.account, status: "waiting_approval", statusText: "Waiting for approval", currency: undefined, country: r.country };
    return out;
  }
  private cleanName(name: unknown) {
    const n = String(name ?? "").replace(/\s+/g, " ").trim();
    if (n.length < 2) fail("INVALID_NAME", "Enter the supplier’s name.");
    for (const ch of n) if (!/[\p{L}\p{N}]/u.test(ch) && !NAME_CHARS.has(ch)) fail("INVALID_NAME", "Use letters, numbers and spaces in the name.");
    if (n.length > 70) fail("INVALID_NAME", "Use letters, numbers and spaces in the name.");
    return n;
  }
  /** The supplier's form. Step 1 checks the name and the waiting requests; step 2 the bank details for the bank's home market (or the country chosen) and the second copy. */
  private validateSupplier(co: CorpCompany, s: State, input: Record<string, any>) {
    const step = Number(input.step ?? 2);
    const name = this.cleanName(input.name);
    if (input.type === "person" && input.allowPerson === false) fail("INVALID_TYPE", "A supplier must be a company.");
    if (input.where === "abroad" && input.allowAbroad === false) fail("INVALID_REGION", "Suppliers abroad are not available.");
    if (this.f.supName !== false && ([...co.whitelist.map((b) => b.name), ...s.reqs.map((r) => r.name)]).some((n) => n.toLowerCase() === name.toLowerCase())) fail("SUPPLIER_NAME_EXISTS", "You already have a supplier with this name.");
    if (this.f.supPending !== false && s.reqs.length >= MAX_PENDING_SUPPLIERS) fail("TOO_MANY_PENDING", "You have 10 suppliers waiting for approval. Wait for an answer before you add more.");
    if (step === 1) return { ok: true, name };
    return this.details(co, s, input, name);
  }
  private details(co: CorpCompany, s: State, input: Record<string, any>, name: string) {
    const abroad = input.where === "abroad";
    const accountName = String(input.accountName ?? "").trim() || name;
    const d = checkPayee(this.payee(input, accountName), this.f);
    const taken = [...Object.values(SUPPLIER_KEYS[co.id] ?? {}), ...s.reqs.map((r) => r.key)];
    if (this.f.supDuplicate !== false && taken.includes(d.key)) fail("SUPPLIER_EXISTS", "You already have a supplier with these bank details.");
    const tail = d.maskedNumber.replace(/\D/g, "").slice(-4);
    const shown = d.region === "us" ? `${d.routing} \u00b7 \u2022\u2022${tail}` : d.region === "uk" ? `${d.sortCode} \u00b7 \u2022\u2022${tail}` : d.region === "world" ? `${d.swift} \u00b7 \u2022\u2022${tail}` : `${d.iban!.slice(0, 4)} \u2022\u2022\u2022\u2022 ${d.iban!.slice(-4)}`;
    return { ok: true, name, accountName: d.displayName, key: d.key, region: d.region, country: d.country, account: shown, countryName: abroad ? WORLD_COUNTRIES[String(input.country)]?.name : undefined, needsAddress: abroad };
  }
  /** What the form asked for, as a payee of the bank's home market (or of the country chosen): the checks are a payee's. */
  private payee(input: Record<string, any>, name: string): PayeeInput {
    const home = this.home();
    if (input.where === "abroad") return { region: "world", country: String(input.country ?? ""), name, account: String(input.iban || input.account || ""), bankCode: input.bankCode, swift: input.swift, strict: true };
    if (home === "us") return { region: "us", name, routing: input.routing, account: input.account, accountType: input.accountType };
    if (home === "uk") return { region: "uk", name, sort: input.sort, account: input.account };
    if (home === "eu") return { region: "eu", name, iban: input.iban };
    return { region: "me", name, iban: input.iban, country: home.toUpperCase() };
  }
  /** The name check: the account's registered holder against the name typed. A sort code and account also tells a personal account from a business one. */
  private supplierCheck(co: CorpCompany, s: State, input: Record<string, any>) {
    const name = this.cleanName(input.name);
    this.details(co, s, input, name);
    const typed = String(input.accountName ?? "").trim() || name, payee = checkPayee(this.payee(input, typed), this.f);
    const done = this.f.nameCheck === false ? { result: "match" as const, registeredName: typed } : checkName(payee, typed, { flaws: this.f });
    const kind = UK_ACCOUNT_KIND[payee.key], chosen = input.accountType === "personal" ? "personal" : "business";
    if (payee.region === "uk" && kind && kind !== chosen && done.result === "match") return { result: "wrongType", registeredName: done.registeredName ?? "", recorded: kind, fix: kind };
    return { result: done.result, registeredName: done.registeredName ?? "", recorded: "" };
  }

  private requestSupplier(corp: CorporateProvider, co: CorpCompany, s: State, userId: string, input: Record<string, any>) {
    const name = this.cleanName(input.name), d = this.details(co, s, input, name) as any;
    const check = this.supplierCheck(co, s, input);
    if (this.f.supCheck !== false && check.result !== "match" && check.result !== "na" && input.acknowledged !== true) fail("NAME_CHECK_NOT_CONFIRMED", "Confirm the name before you continue.");
    if (input.where === "abroad" && !(String(input.street ?? "").trim() && String(input.city ?? "").trim())) fail("ADDRESS_REQUIRED", "We need the supplier’s address for a bank in another country.");
    if (this.f.supCode !== false) this.needCode(co, 0, true);
    const id = `req_${++s.n.req}`;
    s.reqs.push({ id, name, type: input.type === "person" ? "person" : "company", where: input.where === "abroad" ? "abroad" : "same", accountName: d.accountName, account: d.account, country: d.country, key: d.key, addedBy: userId, addedAt: new Date(this.now()).toISOString(), status: "waiting_approval",
      ...(input.where === "abroad" ? { address: { street: String(input.street), city: String(input.city), postcode: String(input.postcode ?? "") } } : {}) });
    this.spendCode();
    this.host.log(corp, userId, `Asked to add supplier ${name}`);
    return { requestId: id, reference: this.reference("SUP", s), name, account: d.account, country: d.countryName, status: "waiting_approval", approval: "An administrator" };
  }

  /* ------------------------------------------------------------------------------------------------ templates */

  /** Suppliers an arrangement moved off the list to "waiting for approval" (and the name they keep), by company and id: a template or a schedule still shows their name. */
  private waitingName = new Map<string, string>();
  private waiting = new Set<string>();
  private supplierStatus(co: CorpCompany, id: string): "ready" | "waiting" | "unavailable" {
    return this.approved(co, id) ? "ready" : this.waiting.has(`${co.id}:${id}`) ? "waiting" : "unavailable";
  }
  private templates(co: CorpCompany, s: State) {
    const rows = s.tpls.map((t) => {
      const sup = co.whitelist.find((b) => b.id === t.beneficiaryId), state = this.supplierStatus(co, t.beneficiaryId), cur = sup?.currency ?? co.currency;
      const name = sup?.name ?? this.waitingName.get(`${co.id}:${t.beneficiaryId}`) ?? "";
      const amountText = t.amount === undefined ? "Amount each time" : fmt(t.amount, cur);
      return [t.id, { ...t, supplierName: name, currency: cur, amountText, status: state, statusText: state === "ready" ? "Ready" : state === "waiting" ? "Waiting for approval" : "Unavailable", line: `${state === "unavailable" ? "Supplier removed" : name} · ${amountText}`, createdBy: t.createdBy }] as const;
    });
    return Object.fromEntries(rows);
  }
  private saveTemplate(corp: CorporateProvider, co: CorpCompany, s: State, userId: string, input: Record<string, any>) {
    const user = this.userOf(co, userId), name = String(input.name ?? "").replace(/\s+/g, " ").trim();
    if (!name) fail("NAME_REQUIRED", "Name the template.");
    if (name.length > 30) fail("NAME_REQUIRED", "Use 30 characters or fewer.");
    if (this.f.tplName !== false && s.tpls.some((t) => t.name.toLowerCase() === name.toLowerCase())) fail("TEMPLATE_NAME_EXISTS", "You already have a template with this name.");
    const sup = this.approved(co, input.supplierId);
    if (this.f.tplSupplier !== false && !sup) fail("SUPPLIER_NOT_APPROVED", "That supplier isn’t on your list or is waiting for approval.");
    const cur = sup?.currency ?? co.currency, digits = currencyInfo(cur).decimals;
    let amount: number | undefined;
    if (input.amount !== undefined && input.amount !== null && input.amount !== "") {
      amount = Number(input.amount);
      if (!(amount > 0) || Math.abs(amount * 10 ** digits - Math.round(amount * 10 ** digits)) > 1e-6) fail("INVALID_AMOUNT", `Enter an amount in ${cur} with at most ${digits} decimal places`);
      if (this.f.tplAmount !== false && this.usd(co, amount, cur) > user.dailyLimit) fail("LIMIT_USER_EXCEEDED", `That is over your limit of ${fmt(user.dailyLimit, co.currency)} a payment.`);
    }
    const reference = String(input.reference ?? "").trim();
    if (reference && (reference.length > 35 || [...reference].some((c) => !/[A-Za-z0-9]/.test(c) && !REFERENCE_CHARS.has(c)))) fail("INVALID_REFERENCE", "Use letters, numbers and spaces only.");
    const purpose = String(input.purpose ?? "");
    if (purpose && !BUSINESS_PURPOSES.includes(purpose)) fail("PURPOSE_REQUIRED", "Choose a purpose from the list.");
    if (input.dryRun === true) return { ok: true, name };
    if (this.f.tplLimit !== false && s.tpls.length >= MAX_TEMPLATES) fail("TEMPLATE_LIMIT", "You can have up to 20 templates. Delete one to add another.");
    const t: Tpl = { id: `tpl_${++s.n.tpl + 2}`, name, beneficiaryId: sup?.id ?? String(input.supplierId), reference, purpose, ...(amount !== undefined ? { amount } : {}), createdBy: userId };
    s.tpls.push(t);
    this.host.log(corp, userId, `Saved payment template ${name}`);
    return this.templates(co, s)[t.id];
  }
  private deleteTemplate(corp: CorporateProvider, co: CorpCompany, s: State, userId: string, input: Record<string, any>) {
    const i = s.tpls.findIndex((t) => t.id === input.templateId);
    if (i < 0) fail("TEMPLATE_NOT_FOUND", "We can’t find that template.");
    const [gone] = s.tpls.splice(i, 1);
    this.host.log(corp, userId, `Deleted payment template ${gone!.name}`);
    return { deleted: true, id: gone!.id, name: gone!.name };
  }

  /* ----------------------------------------------------------------------------------------------- schedules */

  private nextOf(co: CorpCompany, x: Sch) { return runDate(x.anchor, x.frequency as Freq, x.done, this.closed(co)); }
  /** Why the next payment of an active schedule would be skipped, in the words of the list; "" when it would go. */
  private warning(corp: CorporateProvider, co: CorpCompany, x: Sch) {
    if (x.status !== "active") return "";
    const sup = this.approved(co, x.supplierId), user = co.users.find((u) => u.id === x.createdBy);
    if (!sup) return "The supplier is no longer on your list.";
    const type = this.typeOf(sup);
    const std = speedsFor(type, x.amount, this.offer, [], false, railsFor(this.home())).find((r) => r.speed === "standard");
    if (!std || !std.fits) return "The amount is over the limit for this payment.";
    const usd = this.usd(co, x.amount, x.currency);
    if (user && usd > user.dailyLimit) return "The amount is over the daily limit.";
    const from = co.accounts.find((a) => a.currency === co.currency);
    if (from && usd > this.available(corp, co, this.state(co), from)) return "There isn’t enough money in the account.";
    return "";
  }
  private offer: Offer = { standard: true, sameDay: true, instant: true, priority: false };
  private typeOf(sup: CorpBeneficiary): SendType { return sup.country && DOMESTIC[this.home()].includes(sup.country) ? "domestic" : "international"; }
  private scheduleCard(corp: CorporateProvider, co: CorpCompany, x: Sch, strict = false, userId?: string) {
    const sup = this.approved(co, x.supplierId) ?? co.whitelist.find((b) => b.id === x.supplierId);
    const next = this.nextOf(co, x), warn = this.warning(corp, co, x), name = sup?.name ?? this.waitingName.get(`${co.id}:${x.supplierId}`) ?? x.supplierId;
    const awaiting = x.status === "awaiting", moveable = changeState(next, this.now(), strict, this.closed(co));
    return {
      id: x.id, supplierId: x.supplierId, supplierName: name, reference: x.reference, purpose: x.purpose, amount: x.amount, currency: x.currency, amountText: fmt(x.amount, x.currency), frequency: x.frequency, how: FREQUENCIES[x.frequency].name,
      nextRunOn: next, next: dayName(next), nextText: dayName(next, true), statusKey: x.status, badge: awaiting ? "Waiting for approval" : "Active", required: x.required, approvals: x.approvals,
      progress: awaiting ? `${x.approvals} of ${x.required} approved` : "", warning: warn ? `${warn} The next payment would be skipped.` : "", last: x.last,
      line: `${fmt(x.amount, x.currency)} · ${FREQUENCIES[x.frequency].name} · next ${dayName(next)}`,
      info: awaiting ? `${x.approvals} of ${x.required} approved` : warn ? `${warn} The next payment would be skipped.` : x.last,
      ends: x.endCount !== null ? `${x.endCount} payments` : x.endsOn ? dayName(x.endsOn, true) : "Never", endMode: x.endCount !== null ? "count" : x.endsOn ? "date" : "never", endsOn: x.endsOn ?? "", endCount: x.endCount !== null ? String(x.endCount) : "", canChange: moveable === "ok", changeState: moveable, ...(userId ? { mine: x.createdBy === userId } : {}),
    };
  }
  private scheduleList(corp: CorporateProvider, co: CorpCompany, s: State, userId: string, input: Record<string, any>) {
    return Object.fromEntries(s.sch.filter((x) => x.status !== "cancelled").map((x) => [x.id, this.scheduleCard(corp, co, x, input.strictCutoff === true, userId)]));
  }
  private findSchedule(s: State, id: unknown) { const x = s.sch.find((y) => y.id === id); return x ?? fail("SCHEDULE_NOT_FOUND", "We can’t find that payment."); }
  /** The rules for changing or cancelling: not ended, not running now, and not after changes closed (18:00 the business day before, or 09:00 when strict). */
  private canChange(co: CorpCompany, x: Sch, strict: boolean) {
    if (x.status === "cancelled") fail("SCHEDULE_NOT_ACTIVE", "This payment has already ended or been cancelled.");
    const state = changeState(this.nextOf(co, x), this.now(), strict, this.closed(co));
    if (state === "running" && this.f.bschRunning !== false) fail("SCHEDULE_RUNNING", "This payment is being processed. Try again later.");
    if (state === "cutoff" && this.f.bschCutoff !== false) fail("SCHEDULE_CUTOFF_PASSED", "This payment can’t be changed any more. Change it after it runs.");
  }
  private scheduleGet(corp: CorporateProvider, co: CorpCompany, s: State, input: Record<string, any>) {
    const x = this.findSchedule(s, input.scheduleId);
    this.canChange(co, x, input.strictCutoff === true);
    return this.scheduleCard(corp, co, x, input.strictCutoff === true);
  }

  /** Checks a schedule and, unless `dryRun`, makes it (after the code, from the company's threshold). Used for a new one and, with a schedule id, for a change. */
  private plan(corp: CorporateProvider, co: CorpCompany, s: State, userId: string, input: Record<string, any>, existing?: Sch) {
    const user = this.userOf(co, userId), today = this.today(), closed = this.closed(co);
    const sup = this.approved(co, existing ? existing.supplierId : input.supplierId);
    if (this.f.bschSupplier !== false && !sup) fail("SUPPLIER_NOT_APPROVED", "Choose a supplier from your list.");
    const supplier = sup ?? co.whitelist.find((b) => b.id === input.supplierId) ?? ({ id: String(input.supplierId), name: "", bank: "", maskedNumber: "" } as CorpBeneficiary);
    const cur = supplier.currency ?? co.currency, digits = currencyInfo(cur).decimals, amount = Number(input.amount);
    if (!(amount > 0) || Math.abs(amount * 10 ** digits - Math.round(amount * 10 ** digits)) > 1e-6) fail("INVALID_AMOUNT", `Enter an amount in ${cur} with at most ${digits} decimal places`);
    const reference = String(input.reference ?? "").trim();
    if (!reference) fail("REFERENCE_REQUIRED", "Enter an invoice or PO number.");
    if (reference.length > 35 || [...reference].some((c) => !/[A-Za-z0-9]/.test(c) && !REFERENCE_CHARS.has(c))) fail("INVALID_REFERENCE", "Use letters, numbers and spaces only.");
    if (!BUSINESS_PURPOSES.includes(String(input.purpose ?? ""))) fail("PURPOSE_REQUIRED", "Choose a purpose.");
    const frequency = (existing ? existing.frequency : String(input.frequency ?? "monthly")) as Sch["frequency"];
    if (!["once", "weekly", "monthly", "quarterly"].includes(frequency) || (frequency === "quarterly" && input.allowQuarterly === false)) fail("INVALID_FREQUENCY", "Choose how often.");
    const std = speedsFor(this.typeOf(supplier), amount, this.offer, [], false, railsFor(this.home())).find((r) => r.speed === "standard");
    if (this.f.bschAmount !== false) {
      if (!std || !std.available) fail("RAIL_NOT_AVAILABLE", "Sending isn’t available right now. Try again later.");
      if (!std.fits) fail("RAIL_LIMIT", "That is over the limit for this payment. Try a smaller amount.");
    }
    const usd = this.usd(co, amount, cur);
    if (this.f.bschAmount !== false && usd > user.dailyLimit) fail("LIMIT_USER_EXCEEDED", `That is over your limit of ${fmt(user.dailyLimit, co.currency)} a payment.`);
    const start = String(input.start ?? "");
    if (!validIso(start)) fail("DATE_TOO_SOON", "Choose a date from tomorrow.");
    if (this.f.bschDates !== false) {
      if (start <= today) fail("DATE_TOO_SOON", "Choose a date from tomorrow.");
      if (start > addMonths(today, 12)) fail("DATE_TOO_FAR", "Choose a date within 12 months.");
      if (!isOpen(start, closed)) fail("NOT_A_WEEKDAY", "Choose a weekday.");
    }
    const endMode = frequency === "once" ? "never" : String(input.endMode ?? "never");
    let endsOn: string | null = null, endCount: number | null = null;
    const view = { anchor: start, frequency: frequency as Freq, done: 0, endsOn: null as string | null, endCount: null as number | null };
    const dates = upcoming(view, 0, 60, closed);
    if (endMode === "count") {
      endCount = Number(input.endCount);
      const max = FREQUENCIES[frequency].max;
      if (this.f.bschEnd !== false && (!Number.isInteger(endCount) || endCount < 2 || endCount > max)) fail("INVALID_COUNT", `Enter a number from 2 to ${max}.`);
    } else if (endMode === "date") {
      if (input.endDate) {
        endsOn = String(input.endDate);
        if (this.f.bschEnd !== false) {
          if (!validIso(endsOn) || endsOn <= start) fail("END_BEFORE_START", "Choose an end date after the start.");
          if (!dates.slice(1).includes(endsOn)) fail("INVALID_END_DATE", "Choose a date from the list.");
        }
      }
    } else if (endMode !== "never") fail("INVALID_END", "Choose when it ends.");
    const live = s.sch.filter((x) => x.status !== "cancelled" && x.id !== existing?.id).length;
    if (!existing && this.f.bschLimit !== false && live >= MAX_SCHEDULES && input.dryRun !== true) fail("SCHEDULE_LIMIT", "You can have up to 20 scheduled payments. Cancel one to add another.");
    const required: 1 | 2 = this.f.bschApprovals !== false && usd > co.dualApprovalAbove ? 2 : 1;
    const first = runDate(start, frequency as Freq, 0, closed), list = upcoming({ ...view, endsOn, endCount }, 0, 3, closed);
    const codeRequired = co.codeAbove === undefined || usd >= co.codeAbove;
    const preview = {
      ok: true, first, firstText: dayName(first, true), nextDates: list.map((d) => dayName(d)).join(" · "), required, approvalText: `Needs ${required} approval${required > 1 ? "s" : ""} before the first payment`, codeRequired, usd, usdText: fmt(usd, co.currency),
      endDates: Object.fromEntries(dates.slice(1).map((d) => [d, { id: d, name: dayName(d, true) }])), maxCount: FREQUENCIES[frequency].max, amountText: fmt(amount, cur), how: FREQUENCIES[frequency].name, adverb: FREQUENCIES[frequency].adverb, firstShort: dayName(first),
      ends: endMode === "count" ? `${endCount} payments` : endsOn ? dayName(endsOn, true) : "Never", before: "Balance, limit and supplier are checked", supplierName: supplier.name,
    };
    if (input.dryRun === true) return preview;
    if (existing) this.canChange(co, existing, input.strictCutoff === true);
    if (this.f.bschCode !== false) this.needCode(co, usd);
    return { preview, plan: { supplierId: supplier.id, amount, currency: cur, reference, purpose: String(input.purpose), frequency, anchor: start, endsOn, endCount, required } };
  }
  /** The review before the code: every rule applied, the next three dates and the approvers, nothing made. With a schedule id it is the check of a change. */
  private scheduleCheck(corp: CorporateProvider, co: CorpCompany, s: State, userId: string, input: Record<string, any>) {
    const x = input.scheduleId ? this.findSchedule(s, input.scheduleId) : undefined;
    if (x) { if (x.status === "cancelled") fail("SCHEDULE_NOT_ACTIVE", "This payment has already ended or been cancelled."); this.canChange(co, x, input.strictCutoff === true); }
    return this.plan(corp, co, s, userId, { ...input, supplierId: x ? x.supplierId : input.supplierId, dryRun: true }, x);
  }
  private scheduleCreate(corp: CorporateProvider, co: CorpCompany, s: State, userId: string, input: Record<string, any>) {
    const out = this.plan(corp, co, s, userId, input);
    if (input.dryRun === true) return out;
    const { preview, plan } = out as any;
    const x: Sch = { id: `BSC-${3003 + s.n.sch++}`, ...plan, done: 0, paid: 0, status: "awaiting", approvals: 0, last: "", createdBy: userId };
    s.sch.push(x);
    this.spendCode();
    this.host.log(corp, userId, `Scheduled a ${x.frequency} payment ${x.id}`);
    return { ...this.scheduleCard(corp, co, x, false, userId), ...preview, reference: this.reference("BWX", s) };
  }
  private scheduleUpdate(corp: CorporateProvider, co: CorpCompany, s: State, userId: string, input: Record<string, any>) {
    const x = this.findSchedule(s, input.scheduleId);
    if (x.status === "cancelled") fail("SCHEDULE_NOT_ACTIVE", "This payment has already ended or been cancelled.");
    this.canChange(co, x, input.strictCutoff === true);
    const out = this.plan(corp, co, s, userId, { ...input, supplierId: x.supplierId }, x);
    if (input.dryRun === true) return out;
    const { preview, plan } = out as any;
    Object.assign(x, plan, { done: 0, status: "awaiting", approvals: 0, last: x.last });
    this.spendCode();
    this.host.log(corp, userId, `Changed scheduled payment ${x.id}`);
    return { ...this.scheduleCard(corp, co, x, false, userId), ...preview, reference: this.reference("BWX", s) };
  }
  private scheduleCancel(corp: CorporateProvider, co: CorpCompany, s: State, userId: string, input: Record<string, any>) {
    const x = this.findSchedule(s, input.scheduleId);
    this.canChange(co, x, input.strictCutoff === true);
    x.status = "cancelled"; x.cancelledOn = this.today();
    this.host.log(corp, userId, `Cancelled scheduled payment ${x.id}`);
    return { id: x.id, supplierName: this.approved(co, x.supplierId)?.name ?? x.supplierId, amountText: fmt(x.amount, x.currency), how: FREQUENCIES[x.frequency].name, cancelledOn: dayName(x.cancelledOn!, true).slice(4), cancelled: true };
  }

  /* ------------------------------------------------------------------------------------- tracker and withdraw */

  private statusOf(s: State, p: CorpPayment): keyof typeof STATUS_WORDS {
    if (p.status === "pending_approval") return "pending_approval";
    if (p.status === "rejected") return p.rejectReason?.startsWith("Withdrawn by") ? "withdrawn" : "rejected";
    return this.f.trkSettled !== false && (p.releasedAt ?? "").slice(0, 10) < this.today() ? "settled" : "released";
  }
  private stamp(iso: string) {
    const d = iso.slice(0, 10), t = iso.slice(11, 16);
    return `${d === this.today() ? "Today" : dayName(d).slice(4)} ${t}`;
  }
  private trackRow(corp: CorporateProvider, co: CorpCompany, s: State, p: CorpPayment, userId: string, detail = false) {
    const key = this.statusOf(s, p), name = (id: string) => co.users.find((u) => u.id === id)?.name ?? id;
    const sup = p.lines && !p.period ? `Bulk · ${p.lines.length} payments` : p.period ? `Payroll ${p.period} · ${p.lines?.length ?? 0} employees` : co.whitelist.find((b) => b.id === p.beneficiaryId)?.name ?? p.beneficiaryId;
    const wd = s.wd.get(p.id), reason = wd ? (wd.reason === "Other" && wd.note ? wd.note : wd.reason) : "";
    const approvedBy = p.approvals.map((a) => name(a.userId)).join(", ");
    const canWithdraw = p.status === "pending_approval" && p.initiatedBy === userId && this.perms(co, userId).includes("biz.payments.withdraw");
    const row: Record<string, any> = {
      id: p.id, started: this.stamp(p.initiatedAt), to: sup, amount: p.amount, currency: p.currency, amountText: fmt(p.amount, p.currency), statusKey: key, statusText: STATUS_WORDS[key], startedBy: name(p.initiatedBy), reference: p.reference, canWithdraw, withdrawReason: reason, initiatedAt: p.initiatedAt,
    };
    if (detail) {
      const progress = `${p.approvals.length} of ${p.required} approved${approvedBy ? ` (${approvedBy})` : ""}`;
      const steps: Record<string, any> = {
        created: { id: "created", title: "Created", text: `${name(p.initiatedBy)} · ${this.stamp(p.initiatedAt)}`, state: "done" },
        approval: { id: "approval", title: "Approval", text: key === "rejected" ? `Rejected${p.rejectReason ? ` · ${p.rejectReason}` : ""}` : key === "withdrawn" ? `Withdrawn${reason ? ` · ${reason}` : ""}` : progress, state: key === "pending_approval" ? "current" : key === "rejected" || key === "withdrawn" ? "failed" : "done" },
      };
      if (key !== "rejected" && key !== "withdrawn") {
        steps.released = { id: "released", title: "Released to bank", text: "Before the 16:00 cut-off", state: key === "released" ? "current" : key === "settled" ? "done" : "upcoming" };
        steps.settled = { id: "settled", title: "Settled", text: "", state: key === "settled" ? "done" : "upcoming" };
      }
      Object.assign(row, { timeline: steps, canReceipt: key === "released" || key === "settled", valueDate: p.valueDate });
    }
    return row;
  }
  private track(corp: CorporateProvider, co: CorpCompany, s: State, userId: string, input: Record<string, any>) {
    const all = (corp.all?.() ?? []).sort((a, b) => b.initiatedAt.localeCompare(a.initiatedAt) || b.id.localeCompare(a.id));
    const roles = this.userOf(co, userId).roles.map((r) => ({ initiator: "Maker", approver: "Approver", admin: "Administrator" })[r]).join(" and ");
    if (input.paymentId) {
      const p = all.find((x) => x.id === input.paymentId) ?? fail("PAYMENT_NOT_FOUND", "Payment not found.");
      return { ...this.trackRow(corp, co, s, p, userId, true), role: roles };
    }
    const want = String(input.status ?? "all");
    const rows = all.map((p) => this.trackRow(corp, co, s, p, userId)).filter((r) => want === "all" || r.statusKey === want);
    return { role: roles, count: rows.length, canStart: this.perms(co, userId).includes("biz.payments.initiate"), rows: Object.fromEntries(rows.map((r) => [r.id, r])) };
  }
  private withdraw(corp: CorporateProvider, co: CorpCompany, s: State, userId: string, input: Record<string, any>) {
    const p = corp.getPayment(String(input.paymentId ?? ""));
    if (this.f.wdOwner !== false && p.initiatedBy !== userId) fail("NOT_YOUR_PAYMENT", "You can only withdraw payments you started.");
    if (this.f.wdState !== false) {
      if (p.status === "released") fail("PAYMENT_RELEASED", "This payment has already been released to the bank. It can’t be withdrawn.");
      if (p.status !== "pending_approval") fail("PAYMENT_NOT_PENDING", "This payment is no longer waiting for approval.");
    }
    const reason = String(input.reason ?? ""), note = String(input.note ?? "").trim();
    if (this.f.wdReason !== false && reason && (!WITHDRAW_REASONS.includes(reason) || note.length > 100)) fail("INVALID_REASON", "Choose a reason from the list.");
    const out = corp.withdrawPayment({ userId, paymentId: p.id });
    if (reason) s.wd.set(p.id, { reason, note });
    this.host.log(corp, userId, `Withdrew payment ${p.id} of ${fmt(p.amount, p.currency)}`);
    return { ...out, ...this.trackRow(corp, co, s, out, userId) };
  }

  /* ----------------------------------------------------------------------------------------- arrangements */

  /** Scenario-only: puts the books in a state a test needs (a supplier taken off the list, a payment already released, a full set of templates). Never called by a journey. */
  private arrange(corp: CorporateProvider, co: CorpCompany, s: State, input: Record<string, any>) {
    const a = (op: Record<string, any>) => (corp as any).arrange?.(op);
    switch (input.op) {
      case "removeSupplier": { const sup = co.whitelist.find((b) => b.id === input.id); if (sup) this.waitingName.set(`${co.id}:${sup.id}`, sup.name); a({ kind: "removeSupplier", id: input.id }); return { ok: true }; }
      case "waitSupplier": { const sup = co.whitelist.find((b) => b.id === input.id); if (!sup) return { ok: false }; this.waitingName.set(`${co.id}:${sup.id}`, sup.name); this.waiting.add(`${co.id}:${sup.id}`); a({ kind: "removeSupplier", id: input.id }); s.reqs.push({ id: sup.id, name: sup.name, type: "company", where: "same", accountName: sup.name, account: sup.maskedNumber, key: `moved:${sup.id}`, addedBy: "alex", addedAt: new Date(this.now()).toISOString(), status: "waiting_approval" }); return { ok: true }; }
      case "approveSupplier": { const r = s.reqs.find((x) => x.id === input.id); if (r) { s.reqs.splice(s.reqs.indexOf(r), 1); this.waiting.delete(`${co.id}:${r.id}`); a({ kind: "addSupplier", supplier: { id: r.id, name: r.name, bank: "", maskedNumber: r.account, country: r.country } }); } return { ok: true }; }
      case "balance": a({ kind: "balance", accountId: input.accountId, balance: input.balance }); return { ok: true };
      case "release": a({ kind: "release", paymentId: input.paymentId }); return { ok: true };
      case "payment": corp.seedPayment?.(input.payment); return { ok: true };
      case "fillTemplates": while (s.tpls.length < Number(input.count)) s.tpls.push({ id: `tpl_fill${s.tpls.length}`, name: `Filler ${s.tpls.length}`, beneficiaryId: co.whitelist[0]?.id ?? "", reference: "", purpose: "", createdBy: "alex" }); return { ok: true };
      case "fillSchedules": while (s.sch.filter((x) => x.status !== "cancelled").length < Number(input.count)) s.sch.push({ id: `BSC-F${s.sch.length}`, supplierId: co.whitelist[0]?.id ?? "", amount: 100, currency: co.currency, reference: "FILL", purpose: "Goods", frequency: "monthly", anchor: "2027-01-04", done: 0, paid: 0, endsOn: null, endCount: null, status: "active", approvals: 1, required: 1, last: "", createdBy: "alex" }); return { ok: true };
      case "fillRequests": while (s.reqs.length < Number(input.count)) s.reqs.push({ id: `req_fill${s.reqs.length}`, name: `Filler supplier ${s.reqs.length}`, type: "company", where: "same", accountName: "Filler", account: "••0000", key: `fill:${s.reqs.length}`, addedBy: "alex", addedAt: new Date(this.now()).toISOString(), status: "waiting_approval" }); return { ok: true };
      case "fillStatements": while (s.stm.length < Number(input.count)) s.stm.push({ id: `STS-F${s.stm.length}`, accountIds: [co.accounts[0]!.id], format: "pdf", frequency: "weekly", day: "mon", recipients: [this.defaultRecipient(co, "alex")], first: "2026-11-09", createdBy: "alex" }); return { ok: true };
      case "emptyTransactions": s.tx = s.tx.filter((t) => t.accountId !== input.accountId); return { ok: true };
    }
    return fail("UNKNOWN_ARRANGEMENT", "Unknown arrangement.");
  }
}

export { roundMoney };
