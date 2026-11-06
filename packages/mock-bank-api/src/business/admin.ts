import { currencyInfo, fromMinor, toMinor } from "@finx/ui-kit";
import { BankError } from "../errors";
import type { OtpState } from "../retail/retail";
import type { SandboxConditions } from "../index";
import type { Actor } from "./business";
import type { CorpCompany, CorpUser, Flaws } from "./corporate";
import type { CorporateProvider } from "./corporate-provider";
import { fmt } from "./rules";
import { CEILING, CHANGE_SEED, GROUP_SEED, LOG_LENGTH, LOG_SEED, PEOPLE_SEED, ROLES, ROLE_TEXT, rolesOf, type Change, type LogRow, type Person, type Role } from "./admin-data";

/**
 * Administering a company (BankWorkx Business, Admin): who can act and with what limit, the limits and approval thresholds of the company, the approval groups, and the changes that wait for a second
 * administrator. Everything here changes who can move money or how much, so the bank (not a screen) decides every rule, asks for a one-time code before any change, writes every outcome to the
 * activity log and, while the option is on, holds a change that raises a limit, involves an administrator or changes an approval group until ANOTHER administrator approves it. Money is compared in the
 * smallest unit of the company's currency. Every rule can be switched off for the mutation check (Flaws).
 */
export type AdminHost = {
  now: () => number; otp: OtpState; conditions: () => SandboxConditions; flaws: () => Flaws; actor: () => Actor | undefined;
  log: (corp: CorporateProvider, userId: string, action: string, outcome?: "Done" | "Refused") => void;
};

export const ADMIN_NEEDS: Record<string, string> = {
  "corp.admin.get": "biz.admin.view", "corp.changes.decide": "biz.admin.view",
  "corp.users.get": "biz.admin.users", "corp.users.invite": "biz.admin.users", "corp.users.update": "biz.admin.users", "corp.users.disable": "biz.admin.users", "corp.users.enable": "biz.admin.users",
  "corp.limits.get": "biz.admin.limits", "corp.limits.set": "biz.admin.limits",
  "corp.signatories.get": "biz.admin.signatories", "corp.signatories.update": "biz.admin.signatories",
};
const OWN = /^corp\.(admin\.get|changes\.decide|users\.(get|invite|update|disable|enable)|limits\.(get|set)|signatories\.(get|update))$/;
const ARRANGE = ["admRoles", "admSingleAdmin", "admChange", "admInspect"];

const SETTINGS = {
  person: { title: "Limit per person", sub: "Most one person can send in a day", name: "limit per person" },
  company: { title: "Company daily limit", sub: "Most the company can send in a day", name: "company daily limit" },
  two: { title: "Two approvers above", sub: "Payments above this need two approvers", name: "two-approver threshold" },
  code: { title: "Extra code from", sub: "Payments from this amount need a code", name: "extra code threshold" },
} as const;
type Which = keyof typeof SETTINGS;
const WHICH = Object.keys(SETTINGS) as Which[];
const REASONS = ["Left the company", "Changed role", "Security concern", "Other"];
const GROUPS = { over: "grp_large", upto: "grp_standard" } as const;
type GroupKey = keyof typeof GROUPS;
const MODES = ["any", "seq", "par"] as const;
type Mode = (typeof MODES)[number];

type State = { people: Person[]; changes: Change[]; log: LogRow[]; outbox: { to: string; kind: string; text: string; at: string }[]; ready: boolean };

function fail(code: string, message: string): never { throw new BankError(code, message); }
const lc = (s: string) => (s ? s[0]!.toLowerCase() + s.slice(1) : s);
const letter = (ch: string) => ch.toLowerCase() !== ch.toUpperCase();
/** A name: it starts with a letter and has letters, spaces, apostrophes, hyphens and full stops, 2 to 60 characters. */
export function validName(raw: string): boolean {
  const s = raw.trim();
  if (s.length < 2 || s.length > 60 || !letter(s[0]!)) return false;
  for (const ch of s) if (!(letter(ch) || ch === " " || ch === "'" || ch === "’" || ch === "-" || ch === ".")) return false;
  return true;
}
/** An email address, checked with plain string tests (no backtracking pattern): up to 80 characters, no spaces, one "@", a dot inside the domain with text on both sides. */
export function validEmail(s: string): boolean {
  if (s.length === 0 || s.length > 80) return false;
  for (const ch of s) if (ch === " " || ch === "\t" || ch === "\n") return false;
  const at = s.indexOf("@");
  if (at < 1 || at !== s.lastIndexOf("@")) return false;
  const dot = s.lastIndexOf(".");
  return dot > at + 1 && dot < s.length - 1;
}
/** A mobile number with its country code: "+", then 8 to 16 digits (spaces allowed between them). */
export function validPhone(s: string): boolean {
  if (s[0] !== "+") return false;
  let digits = 0;
  for (const ch of s.slice(1)) { if (ch >= "0" && ch <= "9") digits++; else if (ch !== " ") return false; }
  return digits >= 8 && digits <= 16;
}
export const maskEmail = (e: string) => { const at = e.lastIndexOf("@"); return at < 1 ? "•••" : `${e[0]}•••${e.slice(at)}`; };
export const maskPhone = (p: string) => `•••• ${p.replace(/\D/g, "").slice(-4)}`;
const when = (iso: string) => { const d = new Date(iso); return `${d.getUTCDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()]} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`; };
const whole = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export class AdminSandbox {
  private st = new Map<string, State>();
  private chg = 1043;
  constructor(private host: AdminHost) {}

  handles(adapter: string, input: Record<string, any>, hasActor: boolean) { return hasActor && (OWN.test(adapter) || (adapter === "corp.sandbox.arrange" && ARRANGE.includes(String(input.op)))); }
  private get f() { return this.host.flaws(); }
  private now = () => new Date(this.host.now()).toISOString();

  /** The records of a company: made from the spec's seed the first time anything about administering it is asked, and kept in step with the company's own books from then on. */
  private state(corp: CorporateProvider, co: CorpCompany): State {
    let s = this.st.get(co.id);
    if (!s) {
      s = { people: [], changes: structuredClone(CHANGE_SEED[co.id] ?? []), log: structuredClone(LOG_SEED), outbox: [], ready: false };
      this.st.set(co.id, s);
      const seed = PEOPLE_SEED[co.id];
      const ids = co.accounts.map((a) => a.id);
      if (seed) {
        s.people = seed.map((p) => ({ ...p, accounts: [...ids] }));
        for (const c of s.changes) { const who = s.people.find((p) => p.id === c.by); if (who) c.by = who.id; }
        const g = GROUP_SEED[co.id];
        corp.configure?.((c) => {
          for (const p of s!.people) this.sync(c, p);
          c.personLimit ??= 250_000;
          const set = (id: string, key: GroupKey) => { const grp = (c.signatoryGroups ??= []).find((x) => x.id === id); const want = g![key]; if (grp) { grp.mode = want.mode === "seq" ? "sequential" : "parallel"; grp.members = [...want.members]; grp.required = want.mode === "seq" ? want.members.length : want.mode === "par" ? 2 : 1; } };
          if (g) { set(GROUPS.over, "over"); set(GROUPS.upto, "upto"); }
        });
      } else {
        // a company without a spec seed (the new company): its own users, as they are
        s.people = co.users.map((u) => ({ id: u.id, name: u.name, email: `${u.name.toLowerCase().replace(/[^a-z]+/g, ".")}@company.example`, phone: "+1 415 555 0100", role: u.roles.includes("admin") ? "admin" : u.roles.includes("initiator") && u.roles.includes("approver") ? "both" : u.roles.includes("initiator") ? "maker" : u.roles.includes("approver") ? "approver" : "viewer", limit: u.dailyLimit, accounts: [...ids], status: "active" }));
      }
    }
    return s;
  }
  /** The company's own user for a person: made when the person is first seen, with the roles of the role while active (none while invited, waiting or disabled), and the person's limit. */
  private sync(co: CorpCompany, p: Person) {
    let u: CorpUser | undefined = co.users.find((x) => x.id === p.id);
    if (!u) { u = { id: p.id, name: p.name, roles: [], dailyLimit: 0, usedToday: 0 }; co.users.push(u); }
    u.name = p.name; u.roles = p.status === "active" ? rolesOf(p.role) : []; u.dailyLimit = p.role === "maker" || p.role === "both" ? p.limit : 0;
  }
  private remove(corp: CorporateProvider, id: string) { corp.configure?.((c) => { c.users = c.users.filter((u) => u.id !== id); }); }
  private person(s: State, id: unknown): Person { return s.people.find((p) => p.id === String(id)) ?? fail("USER_NOT_FOUND", "We can’t find that person. They may have been removed."); }
  private nameOf(s: State, id: string) { return s.people.find((p) => p.id === id)?.name ?? id; }
  private put(s: State, who: string, what: string, result: LogRow["result"], corp?: CorporateProvider) {
    s.log.unshift({ at: this.now(), who, what, result });
    if (corp && result !== "Waiting") this.host.log(corp, who, what, result === "Refused" ? "Refused" : "Done");
  }
  private tell(s: State, to: string, kind: string, text: string) { s.outbox.unshift({ to, kind, text, at: this.now() }); }

  /** A one-time code is needed for every change; a refused change spends none. */
  private code() {
    if (this.f.admCode === false) return;
    if (!this.host.otp.verified) fail(this.host.otp.attempts >= 3 ? "STEP_UP_FAILED" : "OTP_REQUIRED", this.host.otp.attempts >= 3 ? "The code didn’t work. Nothing was changed." : "OTP not verified");
  }
  private spend() { this.host.otp.verified = false; }

  call(adapter: string, input: Record<string, any>, corp: CorporateProvider, userId: string): any {
    const s = this.state(corp, corp.getCompany());
    // read after the records were made: making them puts the spec's people, limits and groups into the company's books
    const co = corp.getCompany();
    switch (adapter) {
      case "corp.admin.get": return this.view(corp, co, s, userId, input);
      case "corp.users.get": return this.userGet(corp, co, s, userId, input);
      case "corp.users.invite": return this.user("invite", corp, co, s, userId, input);
      case "corp.users.update": return this.user("edit", corp, co, s, userId, input);
      case "corp.users.disable": return this.user("disable", corp, co, s, userId, input);
      case "corp.users.enable": return this.user("enable", corp, co, s, userId, input);
      case "corp.limits.get": return this.limitsGet(co, s);
      case "corp.limits.set": return this.limitSet(corp, co, s, userId, input);
      case "corp.signatories.get": return this.groupGet(corp, co, s, input);
      case "corp.signatories.update": return this.groupSet(corp, co, s, userId, input);
      case "corp.changes.decide": return this.decide(corp, co, s, userId, input);
      case "corp.sandbox.arrange": return this.arrange(corp, co, s, input);
    }
    return undefined;
  }

  // ---------------------------------------------------------------------------------------------------- the view

  private pending(corp: CorporateProvider, personId: string) { return (corp.all?.() ?? []).filter((p) => p.status === "pending_approval" && p.initiatedBy === personId).length; }
  private statusText(p: Person) { return p.changeId && p.status === "active" ? ["change", "Change waiting"] : ({ active: ["active", "Active"], invited: ["invited", "Invited"], disabled: ["disabled", "Disabled"], waiting: ["waiting", "Waiting for approval"] } as const)[p.status]; }
  private limitLine(co: CorpCompany, which: Which) { return fmt(this.limit(co, which), co.currency); }
  private limit(co: CorpCompany, which: Which) { return which === "person" ? co.personLimit ?? 250_000 : which === "company" ? co.companyDailyLimit : which === "two" ? co.dualApprovalAbove : co.codeAbove ?? 0; }

  private view(corp: CorporateProvider, co: CorpCompany, s: State, me: string, input: Record<string, any>) {
    const mine = s.people.find((p) => p.id === me);
    const people = s.people.map((p) => {
      const self = p.id === me, [key, text] = this.statusText(p);
      const free = !self && !p.changeId && p.status !== "waiting";
      return [p.id, { id: p.id, name: p.name, label: `${p.name}${self ? " (you)" : ""}`, role: p.role, roleText: ROLE_TEXT[p.role], limitText: p.role === "maker" || p.role === "both" ? fmt(p.limit, co.currency) : "-", statusKey: key, statusText: text, self, canEdit: free && p.status !== "disabled", canDisable: free && p.status !== "disabled", canEnable: free && p.status === "disabled" }] as const;
    });
    const waiting = s.changes.filter((c) => c.status === "waiting").map((c) => [c.id, { id: c.id, text: c.text, byId: c.by, byName: this.nameOf(s, c.by), mine: c.by === me, sent: `Sent by ${c.by === me ? "you" : this.nameOf(s, c.by)} · ${when(c.at)}`, canDecide: c.by !== me }] as const);
    const limits = Object.fromEntries(WHICH.map((w) => [w, { id: w, title: SETTINGS[w].title, value: this.limit(co, w), text: this.limitLine(co, w) }]));
    const rows = [
      { label: "Limit per person", value: this.limitLine(co, "person") }, { label: "Company daily limit", value: this.limitLine(co, "company") }, { label: "Ceiling set by the bank", value: fmt(CEILING, co.currency) },
      { label: "Two approvers above", value: this.limitLine(co, "two") }, { label: "Extra code from", value: this.limitLine(co, "code") },
    ];
    const groups = Object.fromEntries((["over", "upto"] as GroupKey[]).map((k) => { const g = this.groupOf(co, s, k); return [k, { key: k, title: g.title, line: g.line }]; }));
    const log = input.log === false ? {} : Object.fromEntries(s.log.slice(0, LOG_LENGTH).map((l, i) => [String(i + 1), { id: String(i + 1), when: when(l.at), who: l.who, what: l.what, result: l.result === "Refused" ? "Refused" : l.result, resultKey: l.result.toLowerCase() }]));
    return { access: true, company: { id: co.id, name: co.name, currency: co.currency }, me: { id: me, name: mine?.name ?? me }, waiting: Object.fromEntries(waiting), waitingCount: waiting.length, people: Object.fromEntries(people), limits, limitRows: rows, groups, log, logCount: Object.keys(log).length };
  }

  // ---------------------------------------------------------------------------------------------------- people

  private userGet(corp: CorporateProvider, co: CorpCompany, s: State, me: string, input: Record<string, any>) {
    // without a person: the blank form of an invitation (every account on, a Maker)
    const p = input.personId === undefined || input.personId === "" ? ({ id: "", name: "", email: "", phone: "", role: "maker", limit: 0, accounts: co.accounts.map((a) => a.id), status: "active" } as Person) : this.person(s, input.personId);
    return {
      paymentsWaiting: p.id ? this.pending(corp, p.id) : 0,
      id: p.id, name: p.name, emailMasked: maskEmail(p.email), phone: p.phone, phoneMasked: maskPhone(p.phone), role: p.role, roleText: ROLE_TEXT[p.role], limit: p.limit, limitText: fmt(p.limit, co.currency), status: p.status, self: p.id === me,
      ...Object.fromEntries(co.accounts.flatMap((a, i) => [[`on${i + 1}`, p.accounts.includes(a.id)], [`label${i + 1}`, `${a.name} ${a.maskedNumber}`]])), count: co.accounts.length,
      ceiling: co.personLimit ?? 250_000, ceilingText: fmt(co.personLimit ?? 250_000, co.currency), companyLimit: co.companyDailyLimit,
    };
  }
  private accountsOf(co: CorpCompany, input: Record<string, any>): string[] {
    if (Array.isArray(input.accounts)) return input.accounts.map(String);
    return co.accounts.filter((_, i) => input[`on${i + 1}`] === true).map((a) => a.id);
  }
  private accountsText(co: CorpCompany, ids: string[]) { return ids.length === co.accounts.length ? "All accounts" : co.accounts.filter((a) => ids.includes(a.id)).map((a) => `${a.name} ${a.maskedNumber}`).join(", "); }
  private involvesAdmin(p: Person | undefined, role?: Role) { return p?.role === "admin" || role === "admin"; }
  private activeAdmins(s: State, except?: string) { return s.people.filter((p) => p.role === "admin" && p.status === "active" && p.id !== except); }
  /** The groups in which this person is the only active approver left. */
  private soleApproverOf(co: CorpCompany, s: State, id: string): string | undefined {
    for (const k of ["over", "upto"] as GroupKey[]) {
      const g = this.groupOf(co, s, k);
      if (!g.members.includes(id)) continue;
      if (!g.members.some((m) => m !== id && s.people.some((p) => p.id === m && p.status === "active" && (p.role === "approver" || p.role === "both")))) return g.title;
    }
    return undefined;
  }

  private user(mode: "invite" | "edit" | "disable" | "enable", corp: CorporateProvider, co: CorpCompany, s: State, me: string, input: Record<string, any>) {
    const dry = input.dryRun === true, f = this.f;
    if (input.step === 1 && dry) return this.step1(mode, s, me, input);
    const attempt = () => this.userRules(mode, corp, co, s, me, input);
    let plan: ReturnType<AdminSandbox["userRules"]>;
    try { plan = attempt(); }
    catch (e) {
      // a refused change is written down (the rules are checked again on the call that changes something); nothing changes and no code is spent
      if (!dry && e instanceof BankError && e.code !== "OTP_REQUIRED") this.put(s, me, `Refused to ${mode === "invite" ? "invite" : mode} ${String(input.name ?? input.personId ?? "a person")}`, "Refused", corp);
      throw e;
    }
    if (dry) return plan.review;
    this.code();
    const waits = plan.involves && input.secondApproval !== false && f.admSecond !== false;
    const target = plan.target;
    const text = plan.text, done = plan.done;
    if (mode === "invite") {
      const person: Person = { id: plan.newId!, name: String(input.name).trim(), email: String(input.email).trim(), phone: String(input.phone).trim(), role: input.role as Role, limit: plan.limit, accounts: plan.accounts, status: waits ? "waiting" : "invited" };
      s.people.push(person);
      corp.configure?.((c) => this.sync(c, person));
      if (waits) { this.queue(s, me, person.id, { text, done, kind: "user", data: { op: "invite", personId: person.id } }); this.put(s, me, done, "Waiting", corp); this.tell(s, "other administrators", "change-waiting", "A change is waiting for your approval"); }
      else { this.put(s, me, done, "Done", corp); this.tell(s, maskEmail(person.email), "invitation", `Invitation to ${person.name}`); }
      this.spend();
      return { ...plan.review, status: waits ? "waiting" : "invited", personId: person.id, changeId: waits ? person.changeId : undefined };
    }
    if (waits) {
      const c = this.queue(s, me, target!.id, { text, done, kind: "user", data: { op: mode, personId: target!.id, patch: plan.patch } });
      target!.changeId = c.id;
      this.put(s, me, done, "Waiting", corp); this.tell(s, "other administrators", "change-waiting", "A change is waiting for your approval");
      this.spend();
      return { ...plan.review, status: "waiting", personId: target!.id, changeId: c.id };
    }
    this.applyUser(corp, s, mode, target!, plan.patch);
    this.put(s, me, done, "Done", corp);
    this.spend();
    return { ...plan.review, status: mode === "disable" ? "disabled" : mode === "enable" ? "active" : "saved", personId: target!.id };
  }

  /** The first screen of an invitation or an edit: who the person is (name, work email, mobile number), checked before the person chooses a role. Changes nothing. */
  private step1(mode: "invite" | "edit" | "disable" | "enable", s: State, me: string, input: Record<string, any>) {
    const f = this.f;
    const target = mode === "edit" ? this.person(s, input.personId) : undefined;
    if (target && f.admSelf !== false && target.id === me) fail("SELF_CHANGE", "You can’t change your own access. Ask another administrator.");
    if (target && f.admPending !== false && (target.changeId || target.status === "waiting")) fail("CHANGE_PENDING", "A change to this person is already waiting for approval.");
    const name = String(input.name ?? "").trim(), email = String(input.email ?? "").trim(), phone = String(input.phone ?? "").trim();
    if (f.admFields !== false) {
      if (!validName(name)) fail("INVALID_NAME", "Enter their full name.");
      if (mode === "invite" && !validEmail(email)) fail("INVALID_EMAIL", "Enter a valid work email, like name@company.com.");
      if (!validPhone(phone)) fail("INVALID_PHONE", "Enter a mobile number with the country code, like +1 415 555 0100.");
    }
    if (mode === "invite" && f.admExists !== false && s.people.some((p) => p.email.toLowerCase() === email.toLowerCase())) fail("USER_EXISTS", "This email already has access. Edit that person instead.");
    return { ok: true };
  }

  private queue(s: State, by: string, personId: string | undefined, c: Pick<Change, "text" | "done" | "kind" | "data"> & Partial<Change>): Change {
    const change: Change = { id: `CHG-${++this.chg}`, by, at: this.now(), status: "waiting", ...c, ...(personId ? { personId } : {}) };
    s.changes.unshift(change);
    if (personId) { const p = s.people.find((x) => x.id === personId); if (p) p.changeId = change.id; }
    return change;
  }

  private applyUser(corp: CorporateProvider, s: State, mode: string, p: Person, patch: Record<string, any>) {
    if (mode === "edit") Object.assign(p, patch);
    else if (mode === "disable") p.status = "disabled";
    else if (mode === "enable") p.status = "active";
    delete p.changeId;
    corp.configure?.((c) => this.sync(c, p));
  }

  /** Every rule of inviting, editing, disabling and enabling a person, in the order the spec shows them, and the review the screen draws. Changes nothing. */
  private userRules(mode: "invite" | "edit" | "disable" | "enable", corp: CorporateProvider, co: CorpCompany, s: State, me: string, input: Record<string, any>) {
    const f = this.f, cur = co.currency;
    const target = mode === "invite" ? undefined : this.person(s, input.personId);
    if (target && f.admSelf !== false && target.id === me) fail(mode === "disable" ? "CANNOT_DISABLE_SELF" : "SELF_CHANGE", mode === "disable" ? "You can’t disable yourself. Ask another administrator." : "You can’t change your own access. Ask another administrator.");
    if (target && f.admPending !== false && target.changeId) fail("CHANGE_PENDING", "A change to this person is already waiting for approval.");
    if (target?.status === "waiting") fail("CHANGE_PENDING", "A change to this person is already waiting for approval.");
    let patch: Record<string, any> = {}, newId: string | undefined;
    let role: Role = target?.role ?? "maker", limit = target?.limit ?? 0, accounts = target?.accounts ?? [];
    const labels: string[] = [];
    const changeRows: Record<string, string> = { nameChange: "", mobileChange: "", roleChange: "", accountsChange: "", limitChange: "" };
    if (mode === "invite" || mode === "edit") {
      const name = String(input.name ?? "").trim(), email = String(input.email ?? "").trim(), phone = String(input.phone ?? "").trim();
      if (f.admFields !== false) {
        if (!validName(name)) fail("INVALID_NAME", "Enter their full name.");
        if (mode === "invite" && !validEmail(email)) fail("INVALID_EMAIL", "Enter a valid work email, like name@company.com.");
        if (!validPhone(phone)) fail("INVALID_PHONE", "Enter a mobile number with the country code, like +1 415 555 0100.");
      }
      if (mode === "invite" && f.admExists !== false && s.people.some((p) => p.email.toLowerCase() === email.toLowerCase())) fail("USER_EXISTS", "This email already has access. Edit that person instead.");
      role = ROLES.includes(input.role) ? (input.role as Role) : fail("INVALID_ROLE", "Choose a role.");
      accounts = this.accountsOf(co, input);
      if (f.admFields !== false) {
        if (!accounts.length) fail("NO_ACCOUNT", "Choose at least one account.");
        if (accounts.some((a) => !co.accounts.some((x) => x.id === a))) fail("ACCOUNT_NOT_FOUND", "We can’t find that account.");
      }
      const maker = role === "maker" || role === "both";
      limit = maker ? Number(input.limit) : 0;
      if (maker && f.admLimit !== false) {
        const digits = currencyInfo(cur).decimals;
        if (!(limit > 0) || Math.abs(limit * 10 ** digits - Math.round(limit * 10 ** digits)) > 1e-6) fail("INVALID_AMOUNT", "Enter a daily limit above 0.");
        if (toMinor(limit, cur) > toMinor(co.companyDailyLimit, cur)) fail("LIMIT_ABOVE_COMPANY", `That is above the company limit of ${fmt(co.companyDailyLimit, cur)}.`);
        if (toMinor(limit, cur) > toMinor(co.personLimit ?? 250_000, cur)) fail("LIMIT_ABOVE_PERSON", `The most one person can have is ${fmt(co.personLimit ?? 250_000, cur)}.`);
      }
      if (mode === "edit" && target) {
        const was = target;
        if (f.admPayments !== false && (was.role === "maker" || was.role === "both") && !(role === "maker" || role === "both") && this.pending(corp, was.id) > 0) fail("USER_HAS_PENDING_PAYMENTS", "This person has payments waiting for approval. Remove the Maker role after they are approved or rejected.");
        if (f.admLastAdmin !== false && was.role === "admin" && role !== "admin" && !this.activeAdmins(s, was.id).length) fail("LAST_ADMIN", "The company must keep one active administrator. Add another one first.");
        if (f.admLastApprover !== false && (was.role === "approver" || was.role === "both") && role !== "approver" && role !== "both") { const g = this.soleApproverOf(co, s, was.id); if (g) fail("LAST_APPROVER", `${was.name} is the only approver left for ${g}. Choose another approver first.`); }
        if (name !== was.name) { patch.name = name; labels.push("name"); changeRows.nameChange = `${was.name} → ${name}`; }
        if (phone !== was.phone) { patch.phone = phone; labels.push("mobile"); changeRows.mobileChange = `${maskPhone(was.phone)} → ${maskPhone(phone)}`; }
        if (role !== was.role) { patch.role = role; labels.push("role"); changeRows.roleChange = `${ROLE_TEXT[was.role]} → ${ROLE_TEXT[role]}`; }
        if ([...accounts].sort().join() !== [...was.accounts].sort().join()) { patch.accounts = accounts; labels.push("accounts"); changeRows.accountsChange = `${this.accountsText(co, was.accounts)} → ${this.accountsText(co, accounts)}`; }
        const wasMaker = was.role === "maker" || was.role === "both", nextLimit = maker ? limit : 0, wasLimit = wasMaker ? was.limit : 0;
        if (nextLimit !== wasLimit) { patch.limit = nextLimit; labels.push("daily limit"); changeRows.limitChange = `${wasMaker ? fmt(was.limit, cur) : "-"} \u2192 ${maker ? fmt(limit, cur) : "-"}`; }
        if (!labels.length) fail("NO_CHANGE", "Change something to continue.");
      }
      if (mode === "invite") { newId = `u_${name.toLowerCase().replace(/[^a-z]+/g, "_")}`.slice(0, 24); let n = 1; const base = newId; while (s.people.some((p) => p.id === newId)) newId = `${base}${++n}`; }
    } else if (mode === "disable" && target) {
      if (target.status === "disabled") fail("ALREADY_DISABLED", "This person is already disabled.");
      if (f.admLastAdmin !== false && target.role === "admin" && target.status === "active" && !this.activeAdmins(s, target.id).length) fail("LAST_ADMIN", "The company must keep one active administrator. Add another one first.");
      if (f.admLastApprover !== false && target.status === "active") { const g = this.soleApproverOf(co, s, target.id); if (g) fail("LAST_APPROVER", `${target.name} is the only approver left for ${g}. Choose another approver first.`); }
      if (input.askReason !== false) {
        const reason = String(input.reason ?? "");
        if (!REASONS.includes(reason)) fail("REASON_REQUIRED", "Choose a reason.");
        if (reason === "Other" && String(input.note ?? "").trim().length < 5) fail("REASON_REQUIRED", "Add a few words.");
      }
      patch = {};
    } else if (mode === "enable" && target) {
      if (target.status !== "disabled") fail("NOT_DISABLED", "This person is not disabled.");
    }
    const involves = mode === "invite" ? role === "admin" : this.involvesAdmin(target, mode === "edit" ? role : undefined);
    const who = mode === "invite" ? String(input.name).trim() : target!.name;
    const reasonText = mode === "disable" && input.askReason !== false ? (input.reason === "Other" ? `Other: ${String(input.note).trim()}` : String(input.reason)) : "";
    const approvalNeeded = involves && input.secondApproval !== false && this.f.admSecond !== false;
    const text = mode === "invite" ? `Invite ${who} as ${ROLE_TEXT[role]}` : mode === "edit" ? `Change ${who}: ${labels.join(", ")}` : mode === "disable" ? `Disable ${who}` : `Enable ${who}`;
    const done = mode === "invite" ? `Invited ${who} as ${ROLE_TEXT[role]} (${maskEmail(String(input.email).trim())})` : mode === "edit" ? `Changed ${who}: ${labels.join(", ")}` : mode === "disable" ? `Disabled ${who}${reasonText ? `. Reason: ${reasonText}` : ""}` : `Enabled ${who}`;
    const maker = role === "maker" || role === "both";
    const review = {
      mode, name: who, role, roleText: ROLE_TEXT[role], emailMasked: mode === "invite" ? maskEmail(String(input.email).trim()) : target ? maskEmail(target.email) : "", phoneMasked: mode === "invite" ? maskPhone(String(input.phone)) : target ? maskPhone(String(patch.phone ?? target.phone)) : "",
      accountsText: this.accountsText(co, accounts), limitText: maker ? fmt(limit, cur) : "-", isMaker: maker, company: co.name, approvalNeeded, approvalText: approvalNeeded ? "Second administrator needed" : "",
      changed: labels.join(", "), ...changeRows, reasonText, paymentsWaiting: target ? this.pending(corp, target.id) : 0,
      statusFrom: mode === "disable" ? "Active" : mode === "enable" ? "Disabled" : "", statusTo: mode === "disable" ? "Disabled" : mode === "enable" ? "Active" : "",
    };
    return { target, patch, review, involves, text, done, limit: maker ? limit : 0, accounts, newId };
  }

  // ---------------------------------------------------------------------------------------------------- limits

  private limitsGet(co: CorpCompany, s: State) {
    const items = Object.fromEntries(WHICH.map((w) => [w, { id: w, title: SETTINGS[w].title, sub: SETTINGS[w].sub, name: SETTINGS[w].name, value: this.limit(co, w), text: this.limitLine(co, w), waiting: s.changes.some((c) => c.status === "waiting" && c.kind === "limit" && c.which === w) }]));
    return { currency: co.currency, items, ceiling: CEILING, ceilingText: fmt(CEILING, co.currency), ...Object.fromEntries(WHICH.flatMap((w) => [[`${w}Text`, this.limitLine(co, w)], [`${w}Waiting`, items[w]!.waiting]])) };
  }
  /** The rules of a new amount for one of the four settings, with the bank's own message. */
  private limitRules(co: CorpCompany, s: State, which: unknown, raw: unknown) {
    const f = this.f, cur = co.currency, w = which as Which;
    if (!WHICH.includes(w)) fail("INVALID_SETTING", "Choose what to change.");
    if (f.limPending !== false && s.changes.some((c) => c.status === "waiting" && c.kind === "limit" && c.which === w)) fail("CHANGE_PENDING", "A change to this is already waiting for approval.");
    const value = Number(raw), digits = currencyInfo(cur).decimals;
    if (!(value > 0) || !Number.isFinite(value) || Math.abs(value * 10 ** digits - Math.round(value * 10 ** digits)) > 1e-6) fail("INVALID_AMOUNT", "Enter an amount above 0.");
    const now = this.limit(co, w), vm = toMinor(value, cur);
    if (f.limRules !== false) {
      if (vm === toMinor(now, cur)) fail("LIMIT_SAME", "That is the same as now. Enter a different amount.");
      if ((w === "person" || w === "two" || w === "code") && vm > toMinor(co.companyDailyLimit, cur)) fail("LIMIT_ABOVE_COMPANY", `It can’t be above the company daily limit of ${fmt(co.companyDailyLimit, cur)}.`);
    }
    if (w === "company") {
      if (f.limCeiling !== false && vm > toMinor(CEILING, cur)) fail("LIMIT_ABOVE_CEILING", `The bank’s ceiling is ${fmt(CEILING, cur)}.`);
      const top = Math.max(this.limit(co, "person"), this.limit(co, "two"), this.limit(co, "code"));
      if (f.limRules !== false && vm < toMinor(top, cur)) fail("LIMIT_BELOW_OTHERS", `It can’t be below ${fmt(top, cur)}, the highest limit or threshold set now.`);
      if (f.limRules !== false && vm === toMinor(now, cur)) fail("LIMIT_SAME", "That is the same as now. Enter a different amount.");
    }
    const up = vm > toMinor(now, cur), diff = fromMinor(Math.abs(vm - toMinor(now, cur)), cur);
    return { w, value, now, up, diff };
  }
  private limitSet(corp: CorporateProvider, co: CorpCompany, s: State, me: string, input: Record<string, any>) {
    const dry = input.dryRun === true, cur = co.currency;
    let r: ReturnType<AdminSandbox["limitRules"]>;
    try { r = this.limitRules(co, s, input.which, input.value); }
    catch (e) { if (!dry && e instanceof BankError) this.put(s, me, `Refused to change the ${SETTINGS[String(input.which) as Which]?.name ?? "limit"}`, "Refused", corp); throw e; }
    const waits = r.up && input.secondApproval !== false && this.f.admSecond !== false && this.f.limIncrease !== false;
    const text = `${r.up ? "Raise" : "Lower"} the ${SETTINGS[r.w].name} from ${fmt(r.now, cur)} to ${fmt(r.value, cur)}`;
    const review = { which: r.w, setting: SETTINGS[r.w].title, name: SETTINGS[r.w].name, nowText: fmt(r.now, cur), newText: fmt(r.value, cur), kind: r.up ? "increase" : "decrease", changeText: `${r.up ? "Increase" : "Decrease"} of ${fmt(r.diff, cur)}`, effectText: waits ? "After a second administrator approves" : "Straight away", approvalNeeded: waits, company: co.name };
    if (dry) return review;
    this.code();
    if (waits) {
      const c = this.queue(s, me, undefined, { text, done: text, kind: "limit", data: { which: r.w, value: r.value }, which: r.w });
      this.put(s, me, text, "Waiting", corp); this.tell(s, "other administrators", "change-waiting", "A change is waiting for your approval");
      this.spend();
      return { ...review, status: "waiting", changeId: c.id };
    }
    this.applyLimit(corp, s, r.w, r.value);
    this.put(s, me, text, "Done", corp);
    this.spend();
    return { ...review, status: "applied" };
  }
  private applyLimit(corp: CorporateProvider, s: State, w: Which, value: number) {
    if (w === "person") for (const p of s.people) if (p.limit > value) p.limit = value;
    corp.configure?.((c) => {
      if (w === "person") { c.personLimit = value; for (const u of c.users) if (u.dailyLimit > value) u.dailyLimit = value; }
      else if (w === "company") c.companyDailyLimit = value;
      else if (w === "two") { c.dualApprovalAbove = value; const g = c.signatoryGroups?.find((x) => x.id === GROUPS.over); if (g) g.above = value; }
      else c.codeAbove = value;
    });
  }

  // ---------------------------------------------------------------------------------------------------- approval groups

  /** A group as the spec shows it: its title (the amount follows the two-approver limit), its mode and people, and the line. */
  private groupOf(co: CorpCompany, s: State, key: GroupKey) {
    const raw = co.signatoryGroups?.find((g) => g.id === GROUPS[key]);
    const mode: Mode = !raw ? "any" : raw.mode === "sequential" ? "seq" : raw.required > 1 ? "par" : "any";
    const members = raw?.members ?? [];
    const names = members.map((m) => this.nameOf(s, m));
    const line = mode === "any" ? `Any one of ${names.join(", ")}` : mode === "seq" ? `In order: ${names.join(", then ")}` : `${raw?.required ?? 2} of ${members.length} together: ${names.join(", ")}`;
    const title = `Payments ${key === "over" ? "over" : "up to"} ${whole(co.dualApprovalAbove)}`;
    return { key, mode, members, need: mode === "par" ? raw!.required : mode === "seq" ? members.length : 1, line, title };
  }
  private candidates(s: State) { return s.people.filter((p) => p.status === "active" && (p.role === "approver" || p.role === "both")); }
  private groupGet(corp: CorporateProvider, co: CorpCompany, s: State, input: Record<string, any>) {
    const cands = this.candidates(s), key = input.group as GroupKey;
    const mk = (k: GroupKey) => { const g = this.groupOf(co, s, k); return { ...g, waiting: s.changes.some((c) => c.status === "waiting" && c.kind === "group" && c.group === k), ...Object.fromEntries(cands.slice(0, 6).map((p, i) => [`on${i + 1}`, g.members.includes(p.id)])) }; };
    const cur = key === "over" || key === "upto" ? mk(key) : undefined;
    return {
      groups: { over: mk("over"), upto: mk("upto") }, candidates: Object.fromEntries(cands.map((p) => [p.id, { id: p.id, name: p.name }])), count: Math.min(cands.length, 6),
      ...Object.fromEntries(cands.slice(0, 6).flatMap((p, i) => [[`label${i + 1}`, p.name], [`id${i + 1}`, p.id]])),
      current: cur, paymentsWaiting: (corp.all?.() ?? []).filter((p) => p.status === "pending_approval").length, ...(cur ? { mode: cur.mode, need: cur.need, line: cur.line, title: cur.title, modeText: cur.mode === "any" ? "Any one" : cur.mode === "seq" ? "In order" : `${cur.need} of ${cur.members.length}` } : {}),
      first: cur?.mode === "seq" ? cur.members[0] : "",
    };
  }
  private groupRules(corp: CorporateProvider, co: CorpCompany, s: State, input: Record<string, any>) {
    const f = this.f;
    const key = input.group as GroupKey;
    if (key !== "over" && key !== "upto") fail("INVALID_GROUP", "Choose a group.");
    if (f.grpPending !== false && s.changes.some((c) => c.status === "waiting" && c.kind === "group" && c.group === key)) fail("CHANGE_PENDING", "A change to this group is already waiting for approval.");
    const mode = input.mode as Mode;
    if (!MODES.includes(mode)) fail("INVALID_MODE", "Choose how they approve.");
    if (mode === "seq" && input.allowSeq === false) fail("MODE_NOT_ALLOWED", "Approving in order isn’t available at your bank.");
    const cands = this.candidates(s);
    // the people: the ids given, or the switches on1..on6 in the order the bank listed them
    const given: string[] = Array.isArray(input.approvers) ? input.approvers.map(String) : cands.slice(0, 6).filter((_, i) => input[`on${i + 1}`] === true).map((p) => p.id);
    if (given.some((id) => !cands.some((p) => p.id === id))) fail("INVALID_APPROVER", "Choose people who can approve payments.");
    const chosen = cands.filter((p) => given.includes(p.id));
    if (!chosen.length) fail("NO_APPROVERS", "Choose at least one approver.");
    const n = chosen.length;
    let need = 1;
    if (mode === "par") {
      need = Number(input.need);
      if (!Number.isInteger(need) || need < 2 || need > n) fail("INVALID_NEED", `Choose how many must approve, up to ${n}.`);
    } else if (mode === "seq") need = n;
    const title = this.groupOf(co, s, key).title;
    if (f.grpRules !== false && key === "over") {
      if (mode === "any") fail("NOT_ENOUGH_APPROVERS", `${title} need two approvers. Choose In order or Several together.`);
      if (n < 2) fail("NOT_ENOUGH_APPROVERS", "Add at least 2 approvers.");
    }
    if (f.grpSeparation !== false) {
      const minOthers = mode === "par" ? need : mode === "seq" ? (key === "over" ? 2 : 1) : 1;
      if (n === 1 && chosen[0]!.role === "both") fail("SEPARATION", "The person who starts payments can’t be the only approver.");
      for (const p of chosen) if (p.role === "both" && n - 1 < minOthers) fail("SEPARATION", `If ${p.name} starts a payment, there would not be enough other approvers.`);
    }
    const first = mode === "seq" ? (chosen.some((p) => p.id === input.first) ? String(input.first) : chosen[0]!.id) : "";
    const members = mode === "seq" ? [first, ...chosen.map((p) => p.id).filter((id) => id !== first)] : chosen.map((p) => p.id);
    const was = this.groupOf(co, s, key);
    if (was.mode === mode && was.members.join() === members.join() && was.need === need) fail("NO_CHANGE", "Change something to continue.");
    const names = members.map((m) => this.nameOf(s, m));
    const line = mode === "any" ? `Any one of ${names.join(", ")}` : mode === "seq" ? `In order: ${names.join(", then ")}` : `${need} of ${n} together: ${names.join(", ")}`;
    return { key, mode, members, need, line, was, title, names };
  }
  private groupSet(corp: CorporateProvider, co: CorpCompany, s: State, me: string, input: Record<string, any>) {
    const dry = input.dryRun === true;
    let r: ReturnType<AdminSandbox["groupRules"]>;
    try { r = this.groupRules(corp, co, s, input); }
    catch (e) { if (!dry && e instanceof BankError) this.put(s, me, `Refused to change an approval group`, "Refused", corp); throw e; }
    const waiting = (corp.all?.() ?? []).filter((p) => p.status === "pending_approval").length;
    const waits = input.secondApproval !== false && this.f.admSecond !== false;
    const review = {
      group: r.key, groupTitle: r.title, nowLine: r.was.line, newLine: r.line, mode: r.mode, modeText: r.mode === "any" ? "Any one" : r.mode === "seq" ? "In order" : `${r.need} of ${r.members.length}`, approversText: r.names.join(", "),
      effectText: waits ? "After a second administrator approves" : "Straight away", approvalNeeded: waits, paymentsWaiting: waiting, company: co.name, lower: r.title.charAt(0).toLowerCase() + r.title.slice(1),
    };
    if (dry) return review;
    this.code();
    const text = `Change approvers for ${review.lower} to: ${r.line}`;
    if (waits) {
      const c = this.queue(s, me, undefined, { text, done: text, kind: "group", data: { group: r.key, mode: r.mode, members: r.members, need: r.need }, group: r.key });
      this.put(s, me, text, "Waiting", corp); this.tell(s, "other administrators", "change-waiting", "A change is waiting for your approval");
      this.spend();
      return { ...review, status: "waiting", changeId: c.id };
    }
    this.applyGroup(corp, r.key, r.mode, r.members, r.need);
    this.put(s, me, text, "Done", corp);
    this.spend();
    return { ...review, status: "applied" };
  }
  private applyGroup(corp: CorporateProvider, key: GroupKey, mode: Mode, members: string[], need: number) {
    // the payments that wait keep the approvers they started with
    if (this.f.grpSnapshot !== false) corp.fixWaitingApprovers?.();
    corp.configure?.((c) => {
      const g = c.signatoryGroups?.find((x) => x.id === GROUPS[key]);
      if (g) { g.mode = mode === "seq" ? "sequential" : "parallel"; g.members = [...members]; g.required = mode === "seq" ? members.length : mode === "par" ? need : 1; }
    });
  }

  // ---------------------------------------------------------------------------------------------------- a second administrator decides

  private decide(corp: CorporateProvider, co: CorpCompany, s: State, me: string, input: Record<string, any>) {
    const c = s.changes.find((x) => x.id === String(input.changeId) && x.status === "waiting") ?? fail("CHANGE_NOT_FOUND", "We can’t find that change. It may already be decided.");
    if (input.decision !== "approve" && input.decision !== "decline") fail("INVALID_DECISION", "Approve or decline.");
    if (this.f.admSelf !== false && c.by === me) { this.put(s, me, `Tried to decide on their own change ${c.id}`, "Refused", corp); fail("SELF_APPROVAL", "Another administrator has to approve this."); }
    if (input.decision === "decline") {
      c.status = "declined";
      const p = c.personId ? s.people.find((x) => x.id === c.personId) : undefined;
      if (p) { delete p.changeId; if (c.data.op === "invite") { s.people = s.people.filter((x) => x.id !== p.id); this.remove(corp, p.id); } }
      this.put(s, me, `Declined ${lc(c.text)} (${c.id})`, "Done", corp);
      return { id: c.id, status: "declined", text: c.text, message: "Declined. Nothing was changed." };
    }
    // approving applies the change, so it asks for the code like the change itself did
    this.code();
    if (c.kind === "limit") {
      const w = c.data.which as Which;
      this.limitRulesForApply(co, w, c.data.value);
      this.applyLimit(corp, s, w, c.data.value);
    } else if (c.kind === "group") this.applyGroup(corp, c.data.group, c.data.mode, c.data.members, c.data.need);
    else {
      const p = this.person(s, c.data.personId);
      if (c.data.op === "invite") { p.status = "invited"; delete p.changeId; corp.configure?.((x) => this.sync(x, p)); this.tell(s, maskEmail(p.email), "invitation", `Invitation to ${p.name}`); }
      else this.applyUser(corp, s, c.data.op, p, c.data.patch ?? {});
    }
    c.status = "approved";
    this.put(s, me, `Approved ${lc(c.text)} (${c.id})`, "Done", corp);
    this.spend();
    return { id: c.id, status: "approved", text: c.text, message: "Approved. The change is live." };
  }
  /** A limit that waited is checked again against what the company has now. */
  private limitRulesForApply(co: CorpCompany, w: Which, value: number) {
    const cur = co.currency, vm = toMinor(value, cur);
    if ((w === "person" || w === "two" || w === "code") && vm > toMinor(co.companyDailyLimit, cur)) fail("LIMIT_ABOVE_COMPANY", `It can’t be above the company daily limit of ${fmt(co.companyDailyLimit, cur)}.`);
    if (w === "company" && vm > toMinor(CEILING, cur)) fail("LIMIT_ABOVE_CEILING", `The bank’s ceiling is ${fmt(CEILING, cur)}.`);
  }

  // ---------------------------------------------------------------------------------------------------- sandbox only

  private arrange(corp: CorporateProvider, co: CorpCompany, s: State, input: Record<string, any>) {
    switch (input.op) {
      case "admRoles": { const p = this.person(s, input.personId); if (input.role) p.role = input.role; if (input.status) p.status = input.status; if (input.limit !== undefined) p.limit = Number(input.limit); corp.configure?.((c) => this.sync(c, p)); return { ok: true }; }
      // only this administrator is active: every other one is disabled, and so is the person acting (a bank-side preview), so nobody else can stand in
      case "admSingleAdmin": { for (const p of s.people) if (p.role === "admin") { p.status = p.id === input.personId ? "active" : "disabled"; corp.configure?.((c) => this.sync(c, p)); } return { ok: true }; }
      case "admChange": { const c = this.queue(s, String(input.by), input.personId, { text: String(input.text), done: String(input.text), kind: input.kind ?? "limit", data: input.data ?? {}, ...(input.which ? { which: input.which } : {}), ...(input.group ? { group: input.group } : {}) }); return { ok: true, id: c.id }; }
      case "admInspect": return this.inspect(s);
    }
    void co;
    return fail("UNKNOWN_ARRANGEMENT", "Unknown arrangement.");
  }
  /** Scenarios only: what was sent and written, never a value. */
  private inspect(s: State) { return { outbox: s.outbox, log: s.log.slice(0, LOG_LENGTH), changes: s.changes.map((c) => ({ id: c.id, status: c.status })) }; }
}
