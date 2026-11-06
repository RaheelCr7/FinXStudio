import { BankError } from "../errors";
import type { Actor } from "./business";
import type { CorpCompany, Flaws } from "./corporate";
import type { CorporateProvider } from "./corporate-provider";
import { MAX_REQUESTS_PER_DAY } from "./admin-data";
import { validPhone } from "./admin";

/**
 * What a company asks its bank for that is not a payment: an account added or closed, the company's details updated, a cheque book, something else (BankWorkx Business, More). A request is kept
 * per company and listed newest first; nothing in it moves money, so no code is asked. The bank refuses a second open request with the same kind and subject, a sixth request in a day from one
 * person, the only account of the company being closed, and a request without the confirmation tick. Every rule can be switched off for the mutation check (Flaws).
 */
export type RequestHost = { now: () => number; flaws: () => Flaws; actor: () => Actor | undefined; log: (corp: CorporateProvider, userId: string, action: string, outcome?: "Done" | "Refused") => void };
export const REQUEST_ARRANGE = ["reqToday", "reqStatus", "soleAccount"];
export const REQUEST_NEEDS: Record<string, string> = { "corp.requests.list": "biz.accounts.view", "corp.requests.create": "biz.accounts.view" };
const OWN = /^corp\.requests\.(list|create)$/;

const TYPES = { add: "Add an account", close: "Close an account", update: "Update company details", cheque: "Cheque book", other: "Other" } as const;
type Kind = keyof typeof TYPES;
const CURRENCIES = ["USD", "EUR", "GBP", "AED"];
const PURPOSES = ["Day-to-day payments", "Payroll", "Tax", "Savings", "Other"];
const CLOSE_REASONS = ["No longer needed", "Moving to another bank", "Company is closing", "Other"];
const UPDATES = ["Registered address", "Contact details", "Company name", "Owners or directors", "Signatories"];
const LEAVES = [25, 50, 100];
const DELIVERY = ["Collect at a branch", "Post to the registered address"];

type Req = { id: string; type: Kind; subject: string; status: "received" | "in_progress" | "done" | "declined"; createdAt: string; createdBy: string; rows: Record<string, string> };
const STATUS_TEXT = { received: "Received", in_progress: "In progress", done: "Done", declined: "Declined" } as const;

function fail(code: string, message: string): never { throw new BankError(code, message); }
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export class RequestSandbox {
  private st = new Map<string, Req[]>();
  private seq = 30418;
  constructor(private host: RequestHost) {}
  handles(adapter: string, hasActor: boolean) { return hasActor && OWN.test(adapter); }
  private get f() { return this.host.flaws(); }
  private list(co: CorpCompany): Req[] {
    let l = this.st.get(co.id);
    if (!l) { l = co.id === "alpha" ? [{ id: "REQ-30418", type: "cheque", subject: "Cheque book, Operating", status: "done", createdAt: "2026-10-28T09:00:00Z", createdBy: "priya", rows: {} }] : []; this.st.set(co.id, l); }
    return l;
  }
  private dateText(iso: string) {
    const d = new Date(iso), n = new Date(this.host.now());
    if (iso.slice(0, 10) === n.toISOString().slice(0, 10)) return "Today";
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  }

  call(adapter: string, input: Record<string, any>, corp: CorporateProvider, userId: string): any {
    const co = corp.getCompany(), l = this.list(co);
    // the choices of the form: the company's accounts as a person reads them, and whether each holds a balance that has to go somewhere
    if (adapter === "corp.requests.list" && input.options === true) return { count: co.accounts.length, accounts: Object.fromEntries(co.accounts.map((a) => [a.id, { id: a.id, name: `${a.name} ${a.maskedNumber} · ${a.currency}`, hasBalance: a.balance > 0 }])) };
    if (adapter === "corp.requests.list") {
      const want = input.status ? String(input.status) : "";
      const rows = l.filter((r) => !want || r.status === want).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
      return Object.fromEntries(rows.map((r) => [r.id, { id: r.id, type: r.type, typeText: TYPES[r.type], subject: r.subject, status: r.status, statusText: STATUS_TEXT[r.status], createdAt: r.createdAt, dateText: this.dateText(r.createdAt), createdBy: r.createdBy }]));
    }
    return this.create(corp, co, l, userId, input);
  }

  private create(corp: CorporateProvider, co: CorpCompany, l: Req[], userId: string, input: Record<string, any>) {
    const f = this.f;
    try {
      const type = String(input.type) as Kind;
      if (!(type in TYPES)) fail("INVALID_TYPE", "Choose what you need.");
      if (type === "cheque" && input.cheque === false) fail("TYPE_NOT_AVAILABLE", "Cheque books aren’t available at your bank.");
      const rows: Record<string, string> = {};
      let subject = "";
      const account = (id: unknown) => co.accounts.find((a) => a.id === String(id)) ?? (f.crqAccount === false && co.accounts[0] ? co.accounts[0] : fail("ACCOUNT_NOT_FOUND", "We can’t find that account. Choose another."));
      if (f.crqRules !== false) {
        const phone = String(input.phone ?? "").trim();
        if (!validPhone(phone)) fail("INVALID_PHONE", "Enter a phone number with the country code, like +1 415 555 0100.");
        const details = String(input.details ?? "").trim();
        if (type === "add") {
          if (!CURRENCIES.includes(String(input.currency))) fail("INVALID_CURRENCY", "Choose a currency.");
          if (!PURPOSES.includes(String(input.purpose))) fail("INVALID_PURPOSE", "Choose what it is for.");
          subject = `New ${input.currency} account`; rows.Currency = String(input.currency); rows["For"] = String(input.purpose);
        } else if (type === "close") {
          if (co.accounts.length < 2) fail("ONLY_ACCOUNT", "You can’t close the only account.");
          const a = account(input.accountId);
          if (a.balance > 0) { const to = account(input.moveTo ?? ""); if (to.id === a.id) fail("ACCOUNT_NOT_FOUND", "We can’t find that account. Choose another."); rows["Balance goes to"] = `${to.name} ${to.maskedNumber}`; }
          if (!CLOSE_REASONS.includes(String(input.reason))) fail("INVALID_REASON", "Choose a reason.");
          subject = `Close ${a.name} ${a.maskedNumber}`; rows.Reason = String(input.reason);
        } else if (type === "update") {
          if (!UPDATES.includes(String(input.what))) fail("INVALID_UPDATE", "Choose what to update.");
          if (details.length < 10) fail("DETAILS_REQUIRED", "Tell us a little more (at least 10 characters).");
          subject = `Update ${String(input.what).toLowerCase()}`; rows.Details = details;
        } else if (type === "cheque") {
          const a = account(input.accountId);
          if (!LEAVES.includes(Number(input.leaves))) fail("INVALID_LEAVES", "Choose how many leaves.");
          if (!DELIVERY.includes(String(input.delivery))) fail("INVALID_DELIVERY", "Choose how to get it.");
          subject = `Cheque book, ${a.name}`; rows.Leaves = String(input.leaves); rows.Delivery = String(input.delivery);
        } else {
          subject = String(input.subject ?? "").trim();
          if (subject.length < 5) fail("SUBJECT_REQUIRED", "Add a short subject (at least 5 characters).");
          if (details.length < 10) fail("DETAILS_REQUIRED", "Tell us a little more (at least 10 characters).");
          rows.Details = details;
        }
        rows.Phone = phone;
      } else {
        subject = String(input.subject ?? type);
        if (type === "close" || type === "cheque") account(input.accountId);
      }
      if (f.crqDuplicate !== false && l.some((r) => r.type === type && r.subject === subject && r.status !== "done" && r.status !== "declined")) fail("REQUEST_DUPLICATE", "You already have an open request about this. Wait for our reply.");
      const today = new Date(this.host.now()).toISOString().slice(0, 10);
      if (f.crqDaily !== false && l.filter((r) => r.createdBy === userId && r.createdAt.slice(0, 10) === today).length >= MAX_REQUESTS_PER_DAY) fail("REQUEST_LIMIT_REACHED", `You have sent the most requests allowed today (${MAX_REQUESTS_PER_DAY}). Try again tomorrow.`);
      const shown = { typeText: TYPES[type], subject, leaves: rows.Leaves ?? "", delivery: rows.Delivery ?? "", balanceTo: rows["Balance goes to"] ?? "", phoneMasked: `\u2022\u2022\u2022\u2022 ${String(input.phone ?? "").replace(/\D/g, "").slice(-4)}`, company: co.name };
      // the check before the tick: every rule of the fields, a second open request and the day's five, and nothing is sent
      if (input.dryRun === true) return shown;
      if (f.crqConsent !== false && input.acknowledged !== true) fail("CONSENT_REQUIRED", "Confirm to send.");
      const req: Req = { id: `REQ-${++this.seq}`, type, subject, status: "received", createdAt: new Date(this.host.now()).toISOString(), createdBy: userId, rows };
      l.push(req);
      this.host.log(corp, userId, `Sent service request ${req.id} (${TYPES[type]})`);
      return { ...shown, id: req.id, type, status: req.status, statusText: STATUS_TEXT.received };
    } catch (e) {
      if (e instanceof BankError && input.dryRun !== true) this.host.log(corp, userId, `Service request refused (${e.code})`, "Refused");
      throw e;
    }
  }

  /** Scenarios only. */
  arrange(corp: CorporateProvider, co: CorpCompany, input: Record<string, any>) {
    const l = this.list(co);
    if (input.op === "soleAccount") { corp.configure?.((c) => { c.accounts = c.accounts.slice(0, 1); }); return { ok: true }; }
    if (input.op === "reqToday") { while (l.filter((r) => r.createdBy === input.userId && r.createdAt.slice(0, 10) === new Date(this.host.now()).toISOString().slice(0, 10)).length < Number(input.count)) l.push({ id: `REQ-F${l.length}`, type: "other", subject: `Earlier request ${l.length}`, status: "received", createdAt: new Date(this.host.now()).toISOString(), createdBy: String(input.userId), rows: {} }); return { ok: true }; }
    if (input.op === "reqStatus") { const r = l.find((x) => x.id === input.id); if (r) r.status = input.status; return { ok: true }; }
    return fail("UNKNOWN_ARRANGEMENT", "Unknown arrangement.");
  }
}
