import { formatMoney, fromMinor, roundMoney, toMinor } from "@finx/ui-kit";
import { BankError } from "../errors";
import type { Account, Persona, SandboxConditions } from "../index";
import type { Flaws } from "../business/corporate";
import type { BankConfig } from "../config";
import type { Budget, Category } from "./finance";
import type { AccountTxn } from "./data";
import { BANKWORKX_FX, midRate } from "./fx";
import { railsFor, type SendType, type SpeedClass } from "./payments";
import { debit, spendable } from "./money";
import { receiptDate } from "./topup";

/**
 * Accounts, statements, budgets and the speeds on offer (BankWorkx, Personal: Accounts). The sandbox side of the journeys accounts, account-details,
 * statement, open-another-account, create-budget, budgets and transfer-types: what the bank keeps about an account (its product, its opening date,
 * whether the customer hid it, a closure asked for), the numbers it shows for the home market, the checks before a statement is issued, and the
 * budgets with how far each has been used. Every rule can be switched off for the mutation check (Flaws).
 */
export const MAX_ACCOUNTS = 6;
export const MAX_BUDGET_CATEGORIES = 8;
export const BUDGET_CATEGORIES = ["Food & Drinks", "Shopping", "Transport", "Health", "Travel", "Bills", "Entertainment", "Subscriptions"] as const;
const BUDGET_KIND: Record<string, Category> = { "Food & Drinks": "food", Shopping: "shopping", Transport: "transport", Health: "health", Travel: "transport", Bills: "bills", Entertainment: "entertainment", Subscriptions: "bills" };
/** The category of a transaction (the account's own words) that counts toward each budget. */
const SPEND_TO_BUDGET: Record<string, string> = { Food: "Food & Drinks", Shopping: "Shopping", Travel: "Transport", Health: "Health", Entertainment: "Entertainment", Subscriptions: "Subscriptions", Home: "Bills" };
export const BUDGET_MIN = 10;
export const BUDGET_MAX = 100_000;
/** The days of spending a budget counts. */
export const SPENDING_DAYS = 30;
/** The fee of an official statement or a balance certificate, in US dollars (an account in another currency pays the converted amount). */
export const OFFICIAL_FEE_USD = 5;
export const PAPER_FEE_USD = 2;
export const NAME_MIN = 2;
export const NAME_MAX = 24;
const NAME_CHARS = /^[A-Za-z0-9 &_.'-]+$/;
export const CLOSE_REASONS = ["I do not need it", "I am moving to another bank", "Fees are too high", "Something else"];
export const POST = "post";
const CARD_REASONS = ["I do not recognise it", "I was charged twice", "The amount is wrong", "Something else"];
const OTHER_REASONS = ["I sent it to the wrong person", "I did not make this transfer", "Something else"];
const PENDING_REASONS = ["I do not recognise it", "I did not make this transfer", "Something else"];
const DOC_KINDS = ["statement", "official", "letter", "certificate"] as const;
type DocKind = (typeof DOC_KINDS)[number];
const KIND_LABEL: Record<DocKind, string> = { statement: "Statement", official: "Official statement", letter: "Proof of address letter", certificate: "Balance certificate" };
const DAY = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** What the bank says about the accounts the sandbox seeds (an account it opens carries its own). */
const FACTS: Record<string, NonNullable<Account["facts"]>> = {
  acc_main: { product: "Current account", openedOn: "2019-03-14", interest: "None" },
  acc_save: { product: "Savings account", openedOn: "2019-03-14", interest: "3.10% a year, variable" },
  acc_eur: { product: "Euro account", openedOn: "2023-05-02", interest: "None" },
  acc_aed: { product: "Dirham account", openedOn: "2024-01-15", interest: "None" },
  acc_old: { product: "Savings account", openedOn: "2021-06-01", interest: "3.10% a year, variable" },
  acc_spare: { product: "Current account", openedOn: "2026-09-01", interest: "None" },
};
const PRODUCTS = {
  current: { label: "Current account", interest: "None" },
  savings: { label: "Savings account", interest: "3.10% a year, variable" },
  currency: { label: "Currency account", interest: "None" },
};
const CURRENCY_NAMES: Record<string, string> = { EUR: "Euro", GBP: "Pound", AED: "Dirham" };

/** Money as the screens read it: the sign before the symbol, the currency's own decimals always shown. */
const money = (amount: number, currency: string) => formatMoney(amount, currency, "en-US", undefined, true);

export type AccountsHost = { now: () => number; otp: { attempts: number; verified: boolean }; conditions: () => SandboxConditions; flaws: Flaws; config: () => BankConfig };

const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const dayText = (d: string) => receiptDate(Date.parse(`${d}T00:00:00Z`));
const addMonthsIso = (d: string, n: number) => {
  const [y, m, day] = d.split("-").map(Number) as [number, number, number];
  const first = Date.UTC(y, m - 1 + n, 1), last = new Date(Date.UTC(new Date(first).getUTCFullYear(), new Date(first).getUTCMonth() + 1, 0)).getUTCDate();
  return iso(Date.UTC(new Date(first).getUTCFullYear(), new Date(first).getUTCMonth(), Math.min(day, last)));
};
const validIso = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && iso(Date.parse(`${d}T00:00:00Z`)) === d;
/** Whole months from `a` to `b` (b is not before a): 2024-11-03 to 2026-11-03 is 24. */
const monthsBetween = (a: string, b: string) => {
  const [y1, m1, d1] = a.split("-").map(Number) as [number, number, number], [y2, m2, d2] = b.split("-").map(Number) as [number, number, number];
  return (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
};
const maskEmail = (e: string) => { const [u = "", d = ""] = e.split("@"); return `${u.slice(0, 1)}•••@${d}`; };

export class AccountsApi {
  private seq = 0;
  private reports = new Map<string, string>();
  private dsp = 0;
  private cls = 0;
  private stm = 0;
  constructor(private p: Persona, private host: AccountsHost) {}
  private get f() { return this.host.flaws; }
  private get fx() { return BANKWORKX_FX; }
  private now = () => this.host.now();
  private today = () => iso(this.now());
  private home = () => this.p.accounts[0]?.currency ?? "USD";
  private day = () => new Date(this.now()).toISOString().slice(0, 10).replace(/-/g, "");
  private account(id: unknown): Account {
    const a = this.p.accounts.find((x) => x.id === id);
    if (!a) throw new BankError("ACCOUNT_NOT_FOUND", "We can’t find that account. Choose another.");
    return a;
  }
  private factsOf(a: Account) { return a.facts ?? FACTS[a.id] ?? { product: a.kind === "savings" ? PRODUCTS.savings.label : PRODUCTS.current.label, openedOn: "2019-03-14", interest: a.kind === "savings" ? PRODUCTS.savings.interest : "None" }; }
  private txns = (a: Account): AccountTxn[] => (this.p.retail?.transactions ?? []).filter((t) => t.accountId === a.id);
  private pendingOf = (a: Account) => this.txns(a).filter((t) => t.status === "pending" && t.amount < 0);
  private nameOf = (a: Account) => a.nickname || a.name;
  private visible = () => this.p.accounts.filter((a) => !a.hidden);
  private ensureOtp() {
    if (!this.host.otp.verified) throw new BankError("OTP_REQUIRED", "OTP not verified");
  }

  /** Whether this class answers the adapter. */
  handles = (adapter: string) => /^bank\.(accounts\.(overview|get|rename|transactions|setHidden|reportProblem|requestClosure|restore|open)|statements\.(prepare|deliver|issue)|budgets\.(list|create|update|delete)|spending\.byCategory|payments\.speeds)$/.test(adapter);

  call(adapter: string, input: Record<string, any>): any {
    switch (adapter) {
      case "bank.accounts.overview": return this.overview(input);
      case "bank.accounts.get": return this.get(input);
      case "bank.accounts.rename": return this.rename(input);
      case "bank.accounts.transactions": return this.transactions(input);
      case "bank.accounts.setHidden": return this.setHidden(input);
      case "bank.accounts.reportProblem": return this.report(input);
      case "bank.accounts.requestClosure": return this.requestClosure(input);
      case "bank.accounts.restore": return this.restore(input);
      case "bank.accounts.open": return this.open(input);
      case "bank.statements.prepare": return this.prepare(input).view;
      case "bank.statements.deliver": return this.deliver(input);
      case "bank.statements.issue": return this.issue(input);
      case "bank.budgets.list": return this.budgetList();
      case "bank.budgets.create": return this.budgetCreate(input);
      case "bank.budgets.update": return this.budgetUpdate(input);
      case "bank.budgets.delete": return this.budgetDelete(input);
      case "bank.spending.byCategory": return this.spending(input);
      case "bank.payments.speeds": return this.speeds(input);
    }
    throw new BankError("UNKNOWN_ADAPTER", `No sandbox handler for ${adapter}`);
  }

  /* ------------------------------------------------------------------------------------------------ accounts */

  /** The total of the visible accounts' ledger balances, in the home currency at the sandbox rate (never added across currencies as they are). */
  private total(list: Account[]) {
    const home = this.home();
    const sum = list.reduce((s, a) => s + a.balance * (midRate(a.currency, home, this.fx) ?? 1), 0);
    return roundMoney(sum, home);
  }
  private chipOf(a: Account) { return a.status === "frozen" ? "Frozen" : a.status === "dormant" ? "Dormant" : a.status === "closing" ? "Closing" : ""; }
  private row(a: Account, group: string) {
    return { id: a.id, name: this.nameOf(a), line: `${a.maskedNumber} · ${a.currency}`, balance: spendable(a), balanceText: money(spendable(a), a.currency), currency: a.currency, chip: this.chipOf(a), hidden: !!a.hidden, group };
  }

  private overview(input: Record<string, any>) {
    const home = this.home(), showFx = input.showFx !== false || this.f.totalFx === false;
    const shown = this.p.accounts.filter((a) => a.currency === home || showFx);
    const counted = shown.filter((a) => !a.hidden || this.f.totalHidden === false);
    const groups = { everyday: [] as any[], savings: [] as any[], other: [] as any[], hidden: [] as any[] };
    for (const a of shown) {
      if (a.hidden) groups.hidden.push(this.row(a, "hidden"));
      else if (a.currency !== home) groups.other.push(this.row(a, "other"));
      else if (a.kind === "savings") groups.savings.push(this.row(a, "savings"));
      else groups.everyday.push(this.row(a, "everyday"));
    }
    // the total needs a visible account: a customer with none has none
    const total = this.total(counted);
    return { count: shown.length, visible: shown.filter((a) => !a.hidden).length, total: shown.length ? { currency: home, amount: total, text: money(total, home) } : null, groups };
  }

  /** The account as the bank knows it, with what the details screen shows: the two balances and what is on hold, the numbers of the home market, the product. */
  private get(input: Record<string, any>) {
    // without an account id: the first one (a journey opened with no account)
    const a = input.accountId ? this.account(input.accountId) : this.p.accounts[0];
    if (!a) throw new BankError("ACCOUNT_NOT_FOUND", "We can’t find that account. Choose another.");
    const f = this.factsOf(a), holds = this.pendingOf(a).map((t) => ({ id: t.id, title: t.title, amount: Math.abs(t.amount), text: money(Math.abs(t.amount), a.currency), date: dayText(t.date) }));
    const held = roundMoney(a.balance - spendable(a), a.currency), last4 = a.maskedNumber.replace(/\D/g, "").slice(-4);
    const market = this.host.config().homeMarket;
    const rows = market === "us" ? [{ label: "Routing number", value: "100200300" }, { label: "Account number", value: `000000${last4}` }]
      : market === "uk" ? [{ label: "Sort code", value: "20-30-40" }, { label: "Account number", value: `0000${last4}` }]
        : [{ label: "IBAN", value: a.iban }, { label: "BIC", value: "BWXBUS33" }];
    const warning = a.status === "dormant" ? "dormant" : a.status === "closing" ? "closing" : "";
    return {
      ...a, name: this.nameOf(a), productName: f.product, openedOn: dayText(f.openedOn), openedIso: f.openedOn, interestRate: f.interest, paperless: a.paperless !== false,
      ledgerText: money(a.balance, a.currency), availableText: money(spendable(a), a.currency), heldText: money(held, a.currency), onHold: held > 0, holds,
      overdrawn: a.balance < 0, rows, chip: this.chipOf(a), hiddenChip: a.hidden ? "Hidden" : "", warning, closureReference: a.closure?.reference ?? "",
      // where a balance can go when the account closes: another open account in the same currency, or a cheque
      destinations: Object.fromEntries([...this.p.accounts.filter((x) => x.id !== a.id && x.currency === a.currency && x.status !== "closing").map((x) => [x.id, { id: x.id, name: `${this.nameOf(x)} ${x.maskedNumber}` }]), ...(a.balance > 0 ? [[POST, { id: POST, name: "A cheque by post" }]] : [])]),
    };
  }

  /** The words of a name for an account: 2 to 24 letters, digits, spaces and & _ . ' -, and none another account already shows (any case). */
  private checkName(raw: unknown, except?: string): string {
    const name = String(raw ?? "").trim();
    if (this.f.nameRules !== false) {
      if (name.length < NAME_MIN || name.length > NAME_MAX) throw new BankError("INVALID_NICKNAME", "Use 2 to 24 characters.");
      if (!NAME_CHARS.test(name)) throw new BankError("NAME_CHARS", "Use letters, numbers and spaces.");
    }
    if (this.f.nameTaken !== false && this.p.accounts.some((a) => a.id !== except && this.nameOf(a).toLowerCase() === name.toLowerCase())) throw new BankError("NAME_TAKEN", "You already have an account with this name.");
    return name;
  }
  private rename(input: Record<string, any>) {
    const a = this.account(input.accountId);
    if (input.reset === true) { delete a.nickname; return { accountId: a.id, nickname: "" }; }
    const nickname = this.checkName(input.nickname ?? input.name, a.id);
    a.nickname = nickname;
    return { accountId: a.id, nickname };
  }

  private setHidden(input: Record<string, any>) {
    const a = this.account(input.accountId), hidden = input.hidden === true;
    if (hidden && !a.hidden && this.visible().length <= 1 && this.f.lastVisible !== false) throw new BankError("LAST_VISIBLE_ACCOUNT", "Keep at least one account on your overview.");
    if (hidden) a.hidden = true; else delete a.hidden;
    return { accountId: a.id, hidden };
  }

  private requestClosure(input: Record<string, any>) {
    const a = this.account(input.accountId);
    if (a.status === "closing") throw new BankError("CLOSURE_PENDING", "A closure has already been requested.");
    if (this.pendingOf(a).length && this.f.closeHolds !== false) throw new BankError("ACCOUNT_HAS_HOLDS", "Card payments are still on hold. Try again when they complete.");
    if (a.balance < 0 && this.f.closeOverdrawn !== false) throw new BankError("ACCOUNT_OVERDRAWN", "This account is overdrawn. Pay in the shortfall first.");
    const reason = String(input.reason ?? ""), note = String(input.note ?? "").trim();
    if (!CLOSE_REASONS.includes(reason)) throw new BankError("REASON_REQUIRED", "Choose a reason.");
    if (reason === "Something else" && note.length < 10) throw new BankError("NOTE_TOO_SHORT", "Add a few more words.");
    const destination = String(input.destination ?? "");
    let where = "";
    if (a.balance > 0) {
      if (destination === POST) where = "A cheque by post";
      else {
        const to = this.p.accounts.find((x) => x.id === destination && x.id !== a.id && x.currency === a.currency && x.status !== "closing");
        if (!to) throw new BankError("DESTINATION_INVALID", "Choose where to send the balance.");
        where = `${this.nameOf(to)} ${to.maskedNumber}`;
      }
    }
    if (this.f.closeNeedsCode !== false) this.ensureOtp();
    this.cls += 1;
    const reference = `CLS-${5000 + this.cls}`;
    a.status = "closing"; a.closure = { reference, destination: where };
    this.host.otp.verified = false;
    return { accountId: a.id, reference, destination: where, name: this.nameOf(a), maskedNumber: a.maskedNumber };
  }

  /** Cancels a closure that was asked for, or makes a dormant account active again. */
  private restore(input: Record<string, any>) {
    const a = this.account(input.accountId);
    if (a.status !== "closing" && a.status !== "dormant") throw new BankError("NOT_RESTORABLE", "This account does not need that.");
    const was = a.status;
    a.status = "active"; delete a.closure;
    return { accountId: a.id, status: a.status, was };
  }

  private open(input: Record<string, any>) {
    const product = String(input.product ?? "");
    if (!(product in PRODUCTS)) throw new BankError("PRODUCT_UNAVAILABLE", "This account isn’t available right now.");
    const currency = product === "currency" ? String(input.currency ?? "") : this.home();
    if (product === "currency" && !(currency in CURRENCY_NAMES)) throw new BankError("CURRENCY_REQUIRED", "Choose a currency.");
    if (this.p.accounts.length >= MAX_ACCOUNTS && this.f.accountLimit !== false) throw new BankError("ACCOUNT_LIMIT", `You already have ${MAX_ACCOUNTS} accounts, the most you can hold.`);
    const name = this.checkName(input.name);
    // a check before the code: every rule is applied, nothing is opened
    if (input.dryRun === true) return { ok: true, name, currency, productName: product === "currency" ? `${CURRENCY_NAMES[currency]} account` : PRODUCTS[product as keyof typeof PRODUCTS].label, interest: PRODUCTS[product as keyof typeof PRODUCTS].interest, monthlyFee: "None", minimumBalance: product === "savings" ? money(1, currency) : "None" };
    if (this.f.openNeedsCode !== false) this.ensureOtp();
    this.seq += 1;
    const last4 = String(9100 + this.seq), kind = product === "savings" ? "savings" as const : "current" as const;
    const label = product === "currency" ? `${CURRENCY_NAMES[currency]} account` : PRODUCTS[product as keyof typeof PRODUCTS].label;
    const a: Account = {
      id: `acc_new${this.seq}`, name, maskedNumber: `••${last4}`, iban: `US00 BWX 0000 0000 ${last4}`, balance: 0, currency, status: "active", canDebit: true, kind,
      facts: { product: label, openedOn: this.today(), interest: PRODUCTS[product as keyof typeof PRODUCTS].interest },
    };
    this.p.accounts.push(a);
    this.host.otp.verified = false;
    return { accountId: a.id, name, productName: label, currency, maskedNumber: a.maskedNumber, last4, openedOn: dayText(a.facts!.openedOn), status: "Active" };
  }

  /* ------------------------------------------------------------------------------------------------ the transactions of an account */

  private whenOf(t: AccountTxn) {
    if (t.status === "pending") return "Pending";
    const today = this.today(), yesterday = iso(this.now() - DAY);
    return t.date === today ? "Today" : t.date === yesterday ? "Yesterday" : dayText(t.date);
  }
  /** Who the other side is, when the bank knows: an employer or a person, not a shop. */
  private partyOf = (t: AccountTxn) => (t.category === "Income" ? (t.title.includes(", ") ? t.title.split(", ").slice(1).join(", ") : "") : t.category === "Transfer" || t.category === "Home" ? t.title.replace(/^From /, "") : "");
  private refOf = (t: AccountTxn) => t.reference ?? `TX-${t.id.replace(/\D/g, "").padStart(6, "0")}`;
  private channelOf = (t: AccountTxn): "card" | "transfer" | "income" => (t.amount > 0 ? "income" : ["Transfer", "Home"].includes(t.category) ? "transfer" : "card");
  private transactions(input: Record<string, any>) {
    const a = this.account(input.accountId);
    const q = String(input.q ?? "").trim().toLowerCase(), dir = String(input.direction ?? "all");
    const filter = this.f.txFilter !== false;
    let list = this.txns(a).filter((t) => !filter || ((dir === "in" ? t.amount > 0 : dir === "out" ? t.amount < 0 : true) && (!q || [t.title, t.category, this.refOf(t), Math.abs(t.amount).toFixed(2), t.amount.toFixed(2)].some((x) => x.toLowerCase().includes(q)))));
    // pending items first, then the newest day first; within a day the order the bank booked them in (a stable sort)
    list = [...list].sort((x, y) => (this.f.pendingFirst !== false ? Number(y.status === "pending") - Number(x.status === "pending") : 0) || y.date.localeCompare(x.date));
    const limit = Math.min(Math.max(Number(input.limit) || 10, 1), 100);
    const signed = (t: AccountTxn) => `${t.amount > 0 ? "+" : "−"}${money(Math.abs(t.amount), a.currency)}`;
    const items = list.slice(0, limit).map((t) => {
      const when = this.whenOf(t), channel = this.channelOf(t);
      return {
        id: t.id, title: t.title, category: t.category, amountText: signed(t), incoming: t.amount > 0, pending: t.status === "pending", when, kind: channel,
        line: `${signed(t)} · ${t.category} · ${when}`, status: t.status === "pending" ? "Pending" : "Completed", date: dayText(t.date),
        reference: this.refOf(t), party: t.amount > 0 ? "From" : "To", counterparty: this.partyOf(t),
        reportable: t.amount < 0, reported: this.reports.get(t.id) ?? "",
      };
    });
    return { items, total: list.length, shown: items.length, more: list.length > items.length, empty: this.txns(a).length === 0, filtered: list.length === 0 && this.txns(a).length > 0 };
  }

  private report(input: Record<string, any>) {
    const a = this.account(input.accountId);
    const t = this.txns(a).find((x) => x.id === input.transactionId);
    if (!t) throw new BankError("TRANSACTION_NOT_FOUND", "Transaction not found. Choose another from the list.");
    if (t.amount >= 0 && this.f.reportOutgoing !== false) throw new BankError("NOT_REPORTABLE", "You can only report a payment you made.");
    const dup = this.reports.get(t.id);
    if (dup && this.f.reportDuplicate !== false) throw new BankError("DUPLICATE_REPORT", `Problem reported. Case ${dup}.`);
    const reason = String(input.reason ?? ""), card = this.channelOf(t) === "card";
    if (!(card ? CARD_REASONS : OTHER_REASONS).includes(reason)) throw new BankError("REASON_INVALID", "Choose what went wrong.");
    if (t.status === "pending" && !PENDING_REASONS.includes(reason) && this.f.reportPending !== false) throw new BankError("PENDING_NOT_DISPUTABLE", "This payment is still pending. Try again when it completes.");
    if (reason === "Something else" && String(input.note ?? "").trim().length < 10) throw new BankError("NOTE_TOO_SHORT", "Add a few more words.");
    this.dsp += 1;
    const caseRef = `DSP-${8000 + this.dsp}`;
    this.reports.set(t.id, caseRef);
    return { caseRef, transactionId: t.id, title: t.title, amountText: `${money(Math.abs(t.amount), a.currency)}` };
  }

  /* ------------------------------------------------------------------------------------------------ statements and letters */

  private periodOf(input: Record<string, any>, kind: DocKind, a: Account) {
    const today = this.today();
    if (kind === "letter" || kind === "certificate") return { from: today, to: today, text: `As of ${dayText(today)}`, none: true };
    const period = String(input.period ?? "last");
    let from: string, to: string;
    const first = (n: number) => addMonthsIso(`${today.slice(0, 8)}01`, n);
    if (period === "this") { from = first(0); to = today; }
    else if (period === "3m") { from = addMonthsIso(today, -3); to = today; }
    else if (period === "custom") {
      from = String(input.from ?? ""); to = String(input.to ?? "");
      if (!validIso(from) || !validIso(to)) throw new BankError("RANGE_INVALID", "Choose both dates.");
      if (this.f.statementDates !== false) {
        if (to < from) throw new BankError("RANGE_INVALID", "The end date is before the start date.");
        const opened = this.factsOf(a).openedOn;
        if (from < opened) throw new BankError("BEFORE_OPENING", `This account opened on ${dayText(opened)}.`);
        const limit = kind === "official" ? 12 : 24;
        if (monthsBetween(from, to) > limit || (monthsBetween(from, to) === limit && to > addMonthsIso(from, limit))) throw new BankError("PERIOD_TOO_LONG", `Use ${limit} months or less.`);
      }
    } else { from = first(-1); to = iso(Date.parse(`${first(0)}T00:00:00Z`) - DAY); }
    return { from, to, text: `${dayText(from)} to ${dayText(to)}`, none: false };
  }
  private feeOf(kind: DocKind, a: Account, input: Record<string, any>) {
    if ((kind !== "official" && kind !== "certificate") || input.fee === false) return 0;
    const usd = OFFICIAL_FEE_USD;
    return this.f.feeConvert === false ? usd : roundMoney(usd * (this.fx.perUsd[a.currency] ?? 1), a.currency);
  }

  /** Every check a statement, an official statement, a letter or a certificate passes before it is issued, with what it will show. Nothing is changed. */
  private prepare(input: Record<string, any>) {
    const a = this.account(input.accountId);
    const kind = String(input.kind ?? "statement") as DocKind;
    if (!DOC_KINDS.includes(kind)) throw new BankError("KIND_UNAVAILABLE", "Choose what you need.");
    if (kind === "letter" && a.status === "dormant" && this.f.letterDormant !== false) throw new BankError("ACCOUNT_DORMANT", "This account is dormant. Make a deposit first.");
    const range = this.periodOf(input, kind, a);
    const format = String(input.format ?? "pdf");
    if (!["pdf", "csv", "ofx", "qif"].includes(format) || (kind !== "statement" && format !== "pdf") || ((format === "ofx" || format === "qif") && input.allowOfxQif !== true)) throw new BankError("FORMAT_UNAVAILABLE", "That format isn’t available.");
    const delivery = input.delivery === "email" ? "email" : "download";
    let opening = 0, closing = a.balance, count = 0;
    if (!range.none) {
      const posted = this.txns(a).filter((t) => t.status === "posted");
      const rows = posted.filter((t) => t.date >= range.from && t.date <= range.to), after = posted.filter((t) => t.date > range.to).reduce((s, t) => s + toMinor(t.amount, a.currency), 0);
      count = rows.length;
      closing = roundMoney(a.balance - fromMinor(after, a.currency), a.currency);
      opening = roundMoney(closing - fromMinor(rows.reduce((s, t) => s + toMinor(t.amount, a.currency), 0), a.currency), a.currency);
      if (count === 0 && this.f.statementEmpty !== false) throw new BankError("NO_TRANSACTIONS", "No transactions in this period.");
    }
    const fee = this.feeOf(kind, a, input);
    if (fee > 0 && fee > spendable(a) && this.f.feeFunds !== false) throw new BankError("FEE_INSUFFICIENT_FUNDS", "Not enough available balance for the fee.");
    const last4 = a.maskedNumber.replace(/\D/g, "").slice(-4);
    const file = kind === "statement" || kind === "official" ? `statement-${last4}-${range.from}-${range.to}.${format}` : `${kind === "letter" ? "address-letter" : "balance-certificate"}-${last4}-${range.from}.pdf`;
    const email = this.p.retail?.profile.email ?? "";
    const view = {
      accountId: a.id, kind, kindLabel: KIND_LABEL[kind], kindLower: KIND_LABEL[kind].toLowerCase(), from: range.from, to: range.to, periodText: range.text, format, delivery, file, sizeKb: 40 + 6 * count + (kind === "statement" ? 0 : 12), count,
      openingText: money(opening, a.currency), closingText: money(closing, a.currency), balanceText: money(a.balance, a.currency), fee, feeText: fee > 0 ? money(fee, a.currency) : "", needsCode: kind !== "statement",
      emailMasked: email ? maskEmail(email) : "", paperFeeText: money(roundMoney(PAPER_FEE_USD * (this.fx.perUsd[a.currency] ?? 1), a.currency), a.currency), name: this.nameOf(a), maskedNumber: a.maskedNumber,
      paperless: a.paperless !== false,
    };
    return { view, account: a, fee, kind };
  }

  private reference() { this.stm += 1; return `STM-${this.day()}-${String(930 + this.stm).padStart(4, "0")}`; }

  /** A plain statement: free, no code. Remembers paperless for the account when it is asked. */
  private deliver(input: Record<string, any>) {
    if (String(input.kind ?? "statement") !== "statement") throw new BankError("OTP_REQUIRED", "OTP not verified");
    const p = this.prepare({ ...input, kind: "statement" });
    if (typeof input.paperless === "boolean") { if (input.paperless) delete p.account.paperless; else p.account.paperless = false; }
    return { ...p.view, reference: this.reference() };
  }

  /** An official statement, a letter or a certificate: a one-time code first, then the fee (if any) is taken and the document is issued. */
  private issue(input: Record<string, any>) {
    const p = this.prepare(input);
    if (p.kind === "statement") throw new BankError("NOT_OFFICIAL", "A plain statement needs no code.");
    if (this.f.issueNeedsCode !== false) this.ensureOtp();
    const a = p.account;
    if (p.fee > 0) {
      debit(a, p.fee);
      this.p.retail?.transactions.unshift({ id: `tx_fee${this.stm + 1}`, accountId: a.id, date: this.today(), title: `${KIND_LABEL[p.kind]} fee`, category: "Fees", amount: -p.fee, currency: a.currency, status: "posted" });
    }
    this.host.otp.verified = false;
    return { ...p.view, reference: this.reference(), newBalanceText: money(a.balance, a.currency), availableText: money(spendable(a), a.currency) };
  }

  /* ------------------------------------------------------------------------------------------------ budgets */

  private cents = (n: number) => toMinor(n, this.home());
  private budgetView(b: Budget) {
    const home = this.home(), spent = this.cents(b.spent), limit = Math.max(1, this.cents(b.limit));
    const pct = Math.floor((spent * 100) / limit);
    const tone = this.f.budgetChips === false ? "ok" : spent >= limit ? "over" : spent * 100 >= limit * 80 ? "warn" : "ok";
    const chip = tone === "over" ? "Over budget" : tone === "warn" ? "Close to limit" : "On track";
    const full = this.p.finance!.budgets;
    return {
      ...b, alert80: b.alert80 !== false, alert100: b.alert100 !== false, pct, barPct: Math.min(100, pct), tone, chip, spentText: money(b.spent, home), limitText: money(b.limit, home),
      line: `${money(b.spent, home)} of ${money(b.limit, home)} · last ${SPENDING_DAYS} days`, leftText: money(roundMoney(Math.max(0, b.limit - b.spent), home), home), canAdd: full.length < MAX_BUDGET_CATEGORIES,
    };
  }
  private fin() {
    const fin = this.p.finance;
    if (!fin) throw new BankError("NOT_SUPPORTED", "Not available for this customer");
    return fin;
  }
  private budgetList() { return Object.fromEntries((this.p.finance?.budgets ?? []).map((b) => [b.id, this.budgetView(b)])); }
  /** What left the customer's home-currency current accounts in the last 30 days, by the budget category it counts toward. */
  private spent(category: string) {
    const home = this.home(), since = iso(this.now() - SPENDING_DAYS * DAY), cur = this.p.accounts.filter((a) => a.currency === home && a.kind !== "savings").map((a) => a.id);
    return roundMoney((this.p.retail?.transactions ?? []).filter((t) => cur.includes(t.accountId) && t.amount < 0 && t.date >= since && SPEND_TO_BUDGET[t.category] === category).reduce((s, t) => s - t.amount, 0), home);
  }
  private spending(input: Record<string, any>) {
    const home = this.home(), have = (c: string) => (this.p.finance?.budgets ?? []).find((b) => b.name.toLowerCase() === c.toLowerCase());
    const one = (c: string) => { const amount = this.spent(c), b = have(c); return { id: c, category: c, amount, text: money(amount, home), hasBudget: !!b, budgetId: b?.id ?? "", days: SPENDING_DAYS }; };
    if (input.category) return one(String(input.category));
    return Object.fromEntries(BUDGET_CATEGORIES.map((c) => [c, one(c)]));
  }
  private checkLimit(raw: unknown): number {
    const limit = Number(raw), home = this.home();
    if (this.f.budgetAmount !== false) {
      if (!Number.isFinite(limit) || Math.abs(limit * 100 - Math.round(limit * 100)) > 1e-6) throw new BankError("INVALID_AMOUNT", "Enter an amount with at most 2 decimals.");
      if (limit < BUDGET_MIN) throw new BankError("INVALID_AMOUNT", `The smallest budget is ${money(BUDGET_MIN, home)}.`);
      if (limit > BUDGET_MAX) throw new BankError("INVALID_AMOUNT", `The most is ${money(BUDGET_MAX, home)}.`);
    }
    return limit;
  }
  private budgetCreate(input: Record<string, any>) {
    const fin = this.fin();
    const limit = this.checkLimit(input.limit);
    const name = BUDGET_CATEGORIES.find((c) => c.toLowerCase() === String(input.category ?? "").trim().toLowerCase());
    if (!name) throw new BankError("CATEGORY_REQUIRED", "Choose a category");
    if (this.f.budgetDuplicate !== false && fin.budgets.some((b) => b.name.toLowerCase() === name.toLowerCase())) throw new BankError("BUDGET_EXISTS", "You already have a budget for this category.");
    const b: Budget = { id: `b_${name.toLowerCase().replace(/[^a-z]+/g, "_")}`, name, category: BUDGET_KIND[name] ?? "shopping", limit, spent: this.spent(name), alert80: input.alert80 !== false, alert100: input.alert100 !== false };
    fin.budgets.push(b);
    return { budgetId: b.id, name, limit };
  }
  private budgetFind(id: unknown) {
    const b = this.fin().budgets.find((x) => x.id === id);
    if (!b) throw new BankError("BUDGET_NOT_FOUND", "We can’t find that budget.");
    return b;
  }
  private budgetUpdate(input: Record<string, any>) {
    const b = this.budgetFind(input.budgetId);
    b.limit = this.checkLimit(input.limit);
    if (typeof input.alert80 === "boolean") b.alert80 = input.alert80;
    if (typeof input.alert100 === "boolean") b.alert100 = input.alert100;
    return { budgetId: b.id, name: b.name, limit: b.limit };
  }
  private budgetDelete(input: Record<string, any>) {
    const b = this.budgetFind(input.budgetId), fin = this.fin();
    fin.budgets = fin.budgets.filter((x) => x.id !== b.id);
    return { budgetId: b.id, name: b.name };
  }

  /* ------------------------------------------------------------------------------------------------ the speeds on offer */

  /** The speeds the bank offers for another bank and for another country, with when each arrives, its fee and its limit. No scheme and no country is named. */
  private speeds(input: Record<string, any>) {
    const home = this.home(), rails = railsFor(this.host.config().homeMarket);
    const offer: Record<SpeedClass, boolean> = { standard: input.standard !== false, sameDay: input.sameDay !== false, instant: input.instant !== false, priority: input.priority === true };
    const rows = (type: SendType) => rails[type].filter((r) => offer[r.speed]).map((r) => ({
      id: r.speed, speed: r.name, arrives: r.arrives, fee: r.fee === 0 ? "Free" : money(r.fee, home),
      limit: r.limit === null || r.limit >= 1_000_000 ? "None" : money(r.limit, home),
    }));
    const domestic = rows("domestic"), international = rows("international");
    return {
      domestic, international,
      domesticLine: domestic.map((r) => r.speed).join(", "), internationalLine: international.map((r) => r.speed).join(", "),
    };
  }
}
