import { currencyInfo, fromMinor, toMinor } from "@finx/ui-kit";
import { BankError } from "../errors";
import type { BankConfig } from "../config";
import type { SandboxConditions } from "../index";
import { abaValid, IBAN_LENGTH, ibanValid } from "../retail/payees";
import { railsFor, RAILS, type SpeedClass } from "../retail/payments";
import { addDays, dayName, isOpen, isoOf, validIso } from "../retail/schedules";
import type { OtpState } from "../retail/retail";
import type { Actor } from "./business";
import type { CorpCompany, CorpPayment, Flaws } from "./corporate";
import type { CorporateProvider } from "./corporate-provider";
import { DOMESTIC, fmt } from "./rules";
import { convertMinor, defaultRunMinor, EMPLOYEE_LAST4, IBAN_CURRENCY, MONTH_NAMES, PAY_PERIODS, PAYROLL_HISTORY, PAYROLL_REGISTER, periodText, SEED_BATCHES, SUPPLIER_ACCOUNTS, type Employee } from "./bulk-data";
import { cleanCell, fileKey, MAX_FILE_BYTES, MAX_FILE_LINES, parseBankFile, parseCsv, parseMinor, rawOf, reportCell, type RawLine } from "./bulk-files";

/**
 * Bulk payments and payroll runs (BankWorkx Business, Payments): a file or a short list of payments is checked line by line, the person fixes what is marked,
 * and the batch goes for approval as one payment that counts once against the limits. A payroll run is made from the company's register. Every rule is the
 * bank's (a screen only shows its answer) and can be switched off for the mutation check (Flaws). Money is whole amounts of the smallest unit until it is shown.
 */
export type BulkHost = {
  now: () => number; otp: OtpState; config: () => BankConfig; conditions: () => SandboxConditions; flaws: () => Flaws; actor: () => Actor | undefined;
  log: (corp: CorporateProvider, userId: string, action: string, outcome?: "Done" | "Refused") => void;
  /** Whether the person may pay from this account (the right on the account, the permission, the company's currency). */
  canPay: (co: CorpCompany, accountId: string, userId: string) => boolean;
  /** The one-time code was verified (always asked for a batch or a run); then it is used up. */
  requireCode: (co: CorpCompany, always: boolean, amount: () => number) => void;
  spendCode: () => void;
};

const BULK = /^corp\.(bulk\.(check|quote|submit|list|get)|payroll\.(register|check|submit))$/;
export const BULK_ARRANGE = ["sentFile", "bulkBatch", "failLine", "dualAbove", "companyUsed", "userUsed"];
const MAX_NAME = 70, MAX_BATCH_NAME = 35, MAX_REFERENCE = 35, MAX_REASON = 140;
const SPEEDS: SpeedClass[] = ["standard", "sameDay", "instant"];
const STATUS_WORDS: Record<string, string> = { waiting: "Waiting for approval", sent: "Sent to bank", paid: "Paid", partly: "Partly paid", rejected: "Rejected", withdrawn: "Withdrawn" };
const LINE_WORDS: Record<string, string> = { waiting: "Waiting for approval", sent: "Sent to bank", paid: "Paid", failed: "Failed", resent: "Resent", cancelled: "Cancelled", withdrawn: "Withdrawn" };

type BLine = { n: number; supplierId?: string; employeeId?: string; payee: string; last4: string; amount: number; currency: string; usd: number; reference: string; failed?: string; resentBy?: string };
type Batch = { id: string; kind: "bulk" | "payroll"; name: string; accountId: string; lines: BLine[]; sendOn: string; speed: string; fee: number; repairOf?: string; period?: string; payslips?: boolean; reason?: string };
type PayRow = { id: string; netText: string; bonus: number[]; deduct: number[]; removed: boolean };
type Draft = { period: string; accountId: string; payDate: string; rows: PayRow[] };
type State = { batches: Map<string, Batch>; sent: Map<string, string>; drafts: Map<string, Draft> };

type View = {
  n: number; name: string; account: string; accountText: string; code: string; amountText: string; amount: number; currency: string; usd: number; usdMinor: number; reference: string;
  status: "ready" | "fix"; statusText: string; message: string; supplierId: string; canUseSaved: boolean; domestic: boolean; amountRaw: string; codeLabel: string; showCode: boolean;
};

function fail(code: string, message: string): never { throw new BankError(code, message); }
const compact = (s: string) => s.split(" ").join("").split("-").join("").toUpperCase();
const isDigit = (c: string) => c >= "0" && c <= "9";
const isUpper = (c: string) => c >= "A" && c <= "Z";
const allDigits = (s: string) => s.length > 0 && [...s].every(isDigit);
const sameName = (a: string, b: string) => a.trim().split(/\s+/).join(" ").toLowerCase() === b.trim().split(/\s+/).join(" ").toLowerCase();
const stamp = (iso: string) => dayName(iso.slice(0, 10)).slice(4);

export class BulkSandbox {
  private st = new Map<string, State>();
  constructor(private host: BulkHost) {}

  handles(adapter: string, input: Record<string, any>, hasActor: boolean) { return hasActor && (BULK.test(adapter) || (adapter === "corp.sandbox.arrange" && BULK_ARRANGE.includes(String(input.op)))); }

  private get f() { return this.host.flaws(); }
  private today = () => isoOf(this.host.now());
  private state(co: CorpCompany): State {
    let s = this.st.get(co.id);
    if (!s) {
      s = { batches: new Map(), sent: new Map(), drafts: new Map() };
      for (const [id, b] of Object.entries(SEED_BATCHES[co.id] ?? {})) {
        s.batches.set(id, { id, kind: "bulk", name: b.name, accountId: b.accountId, sendOn: "2026-10-23", speed: "standard", fee: 0, lines: b.lines.map((l, i) => ({ n: i + 1, supplierId: l.supplierId, payee: l.payee, last4: SUPPLIER_ACCOUNTS[co.id]?.[l.supplierId]?.account.slice(-4) ?? "", amount: l.amount, currency: l.currency, usd: fromMinor(convertMinor(toMinor(l.amount, l.currency), l.currency, co.currency), co.currency), reference: l.reference, ...(l.failed ? { failed: l.failed } : {}) })) });
      }
      this.st.set(co.id, s);
    }
    return s;
  }
  private home() { return this.host.config().homeMarket; }
  private closed(co: CorpCompany) { return [...co.holidays, ...(this.host.conditions().closedDays ?? [])]; }
  private workingDays(co: CorpCompany, count: number) {
    const out: Record<string, { id: string; name: string }> = {};
    for (let d = addDays(this.today(), 1); Object.keys(out).length < count; d = addDays(d, 1)) if (isOpen(d, this.closed(co))) out[d] = { id: d, name: dayName(d) };
    return out;
  }
  private payAccount(co: CorpCompany, accountId: unknown, userId: string) {
    const a = co.accounts.find((x) => x.id === accountId) ?? fail("ACCOUNT_NOT_FOUND", "Choose the account to pay from.");
    if (!this.host.canPay(co, a.id, userId)) fail("ACCOUNT_NOT_PERMITTED", "You can’t pay from this account.");
    return a;
  }
  private reference(p: { id: string }) { return `BWX-${this.today().replace(/-/g, "")}-${p.id.replace(/\D/g, "").padStart(4, "0")}`; }

  call(adapter: string, input: Record<string, any>, corp: CorporateProvider, userId: string): any {
    const co = corp.getCompany(), s = this.state(co);
    switch (adapter) {
      case "corp.bulk.check": return this.check(corp, co, s, userId, input);
      case "corp.bulk.quote": return this.quote(co, s, userId, input);
      case "corp.bulk.submit": return this.submit(corp, co, s, userId, input);
      case "corp.bulk.list": return this.list(corp, co, s);
      case "corp.bulk.get": return this.get(corp, co, s, input);
      case "corp.payroll.register": return this.register(corp, co, s, userId, input);
      case "corp.payroll.check": return this.payCheck(corp, co, s, userId, input);
      case "corp.payroll.submit": return this.paySubmit(corp, co, s, userId, input);
      case "corp.sandbox.arrange": return this.arrange(corp, co, s, input);
    }
    return undefined;
  }

  /* ----------------------------------------------------------------------------------------------- the lines of a batch */

  /** The lines the person sent back (or the rows of what they chose), cut to what a line can hold. */
  private rawFrom(list: unknown): RawLine[] {
    if (!Array.isArray(list)) return [];
    return list.slice(0, MAX_FILE_LINES + 1).map((x: any) => ({
      name: cleanCell(x?.name), account: cleanCell(x?.account), code: cleanCell(x?.code), amount: cleanCell(x?.amount, 20), reference: cleanCell(x?.reference, MAX_REFERENCE * 2),
      ...(typeof x?.note === "string" && x.note ? { note: cleanCell(x.note) } : {}), ...(Number.isInteger(x?.origN) ? { origN: x.origN } : {}),
    }));
  }

  /** The file the person chose, as lines: the checks that come before the lines (its size, its kind, its format, whether it was sent before, how many payments it has). */
  private readFile(co: CorpCompany, s: State, input: Record<string, any>): { lines: RawLine[]; key: string } {
    const text = String(input.file ?? "");
    const bank = input.format === "bank";
    if (this.f.bulkFormats !== false && bank && input.bankFormats !== true) fail("FORMAT_NOT_ENABLED", "Choose the template file.");
    const size = Number(input.size ?? text.length);
    if (this.f.bulkFile !== false && (size > MAX_FILE_BYTES || text.length > MAX_FILE_BYTES)) fail("FILE_TOO_BIG", "This file is too big. The limit is 256 KB.");
    const kind = input.kind === "xml" || input.kind === "csv" ? input.kind : text.trimStart().startsWith("<") ? "xml" : "csv";
    if (this.f.bulkFile !== false && this.f.bulkFormats !== false && (bank ? kind !== "xml" : kind !== "csv")) fail("FILE_TYPE", bank ? "Use a bank file." : "Use a CSV file.");
    const rows = bank ? parseBankFile(text, MAX_FILE_LINES) : parseCsv(text, MAX_FILE_LINES);
    if (rows === null) fail("FILE_UNREADABLE", "We can’t read this file type.");
    let body = rows;
    // a header row of the template: the first cell says Payee
    if (!bank && body.length && (body[0]![0] ?? "").toLowerCase().startsWith("payee")) body = body.slice(1);
    if (this.f.bulkFile !== false && body.length === 0) fail("FILE_EMPTY", "There are no payments in this file.");
    if (this.f.bulkFile !== false && body.length > MAX_FILE_LINES) fail("BATCH_TOO_LARGE", "A batch can have up to 50 payments.");
    const key = fileKey(text);
    const before = s.sent.get(key);
    if (this.f.bulkSent !== false && before) fail("ALREADY_SENT", `You already sent this file on ${stamp(before)}.`);
    return { lines: body.slice(0, MAX_FILE_LINES + 1).map(rawOf), key };
  }

  /** The lines of a batch that was paid and had payments returned, to be fixed and sent again. */
  private repairLines(co: CorpCompany, corp: CorporateProvider, s: State, id: unknown): { batch: Batch; lines: RawLine[] } {
    const batch = s.batches.get(String(id ?? "")) ?? fail("PAYMENT_NOT_FOUND", "We can’t find that batch.");
    const p = corp.getPayment(batch.id);
    const failed = batch.lines.filter((l) => l.failed && !l.resentBy);
    if (this.f.bulkRepair !== false && (p.status !== "released" || failed.length === 0)) fail("REPAIR_NOT_ALLOWED", "There is nothing to resend.");
    const want = failed.length ? failed : batch.lines;
    return { batch, lines: want.map((l) => {
      const sup = l.supplierId ? SUPPLIER_ACCOUNTS[co.id]?.[l.supplierId] : undefined;
      return { name: l.payee, account: sup?.account ?? "", code: sup?.code ?? "", amount: fromMinor(toMinor(l.amount, l.currency), l.currency).toFixed(currencyInfo(l.currency).decimals), reference: l.reference, ...(l.failed ? { note: l.failed } : {}), origN: l.n };
    }) };
  }

  /** One line against every rule of the bank, in the order of the spec; the first thing wrong is the message. */
  private evalLine(co: CorpCompany, userId: string, r: RawLine, n: number, earlier: Map<string, number>, remaining: number): View {
    const home = this.home();
    const name = r.name.trim(), acct = compact(r.account), code = compact(r.code);
    const iban = acct.length >= 4 && isUpper(acct[0]!) && isUpper(acct[1]!) && isDigit(acct[2]!) && isDigit(acct[3]!);
    const kind: "iban" | "routing" | "sort" | "none" = iban ? "iban" : code.length === 6 && allDigits(code) ? "sort" : code.length === 9 && allDigits(code) ? "routing" : "none";
    const currency = kind === "iban" ? IBAN_CURRENCY[acct.slice(0, 2)] ?? co.currency : kind === "sort" ? "GBP" : co.currency;
    const minor = parseMinor(r.amount, currency);
    const usdMinor = minor ? convertMinor(minor, currency, co.currency) : 0;
    const codeWords = kind === "routing" || (kind === "none" && home === "us") ? "Check the routing number." : kind === "sort" || (kind === "none" && home === "uk") ? "Check the sort code." : "Check the bank code.";
    const sup = co.whitelist.find((b) => sameName(b.name, name));
    const saved = sup ? SUPPLIER_ACCOUNTS[co.id]?.[sup.id] : undefined;
    const key = `${name.toLowerCase()}|${acct}|${code}|${minor}|${currency}|${r.reference.toLowerCase()}`;

    let message = "";
    if (this.f.lineChecks === false) message = r.note ?? "";
    else if (r.note) message = r.note;
    else if (this.f.bulkName !== false && (!name || name.length > MAX_NAME)) message = name ? "The name is too long." : "Enter the payee name.";
    else if (this.f.bulkAmount !== false && (!minor || minor <= 0)) message = "Enter an amount above zero.";
    else if (this.f.bulkAccount !== false && !this.accountOk(kind, acct, code)) message = "Check the account number.";
    else if (this.f.bulkAccount !== false && !this.codeOk(kind, code)) message = codeWords;
    else if (this.f.bulkApproved !== false && !sup) message = "Not an approved payee.";
    else if (this.f.bulkMatch !== false && saved && (compact(saved.account) !== acct || compact(saved.code) !== code)) message = "Doesn’t match the saved account details.";
    else if (this.f.bulkLineLimit !== false && usdMinor > remaining) message = "Above your payment limit.";
    else if (this.f.bulkDuplicate !== false && earlier.has(key)) message = `Same as payment ${earlier.get(key)}.`;
    if (!earlier.has(key)) earlier.set(key, n);

    const amount = minor ? fromMinor(minor, currency) : 0;
    const country = iban ? acct.slice(0, 2) : kind === "routing" ? "US" : kind === "sort" ? "GB" : "";
    return {
      n, name, account: acct, accountText: acct ? `••${acct.slice(-4)}` : "None", code, amount, currency, usdMinor, usd: fromMinor(usdMinor, co.currency), reference: r.reference,
      amountText: minor ? fmt(amount, currency) : r.amount ? r.amount : "None",
      status: message ? "fix" : "ready", statusText: message ? "Needs fixing" : "Ready", message, supplierId: sup?.id ?? "",
      canUseSaved: !!saved && !!sup && (compact(saved.account) !== acct || compact(saved.code) !== code),
      domestic: !!country && DOMESTIC[home].includes(country), amountRaw: r.amount, codeLabel: kind === "routing" || (kind === "none" && home === "us") ? "Routing number" : kind === "sort" || (kind === "none" && home === "uk") ? "Sort code" : "Bank code", showCode: kind !== "iban",
    };
  }
  private accountOk(kind: string, acct: string, code: string): boolean {
    if (!acct) return false;
    if (kind === "iban") { const len = IBAN_LENGTH[acct.slice(0, 2)]; return !!len && acct.length === len && [...acct].every((c) => isDigit(c) || isUpper(c)) && ibanValid(acct); }
    if (kind === "routing") return allDigits(acct) && acct.length >= 4 && acct.length <= 17;
    if (kind === "sort") return allDigits(acct) && acct.length === 8;
    return [...acct].every((c) => isDigit(c) || isUpper(c));
  }
  private codeOk(kind: string, code: string): boolean { return kind === "iban" || kind === "sort" || (kind === "routing" && abaValid(code)); }

  private views(co: CorpCompany, userId: string, raws: RawLine[]): View[] {
    const user = co.users.find((u) => u.id === userId);
    const remaining = user ? toMinor(user.dailyLimit, co.currency) - toMinor(user.usedToday, co.currency) : 0;
    const earlier = new Map<string, number>();
    return raws.map((r, i) => this.evalLine(co, userId, r, i + 1, earlier, remaining));
  }

  /** Reads the lines (a file, the lines sent back, or a batch to resend), applies what the person did (add, edit, remove) and says what each line is. Moves nothing and keeps nothing. */
  private check(corp: CorporateProvider, co: CorpCompany, s: State, userId: string, input: Record<string, any>) {
    const account = this.payAccount(co, input.fromAccountId, userId);
    let raws: RawLine[] = [], key = String(input.fileKey ?? ""), batch: Batch | undefined, resend = false;
    if (input.repairOf) {
      resend = true;
      const r = this.repairLines(co, corp, s, input.repairOf);
      batch = r.batch;
      if (batch.accountId !== account.id) fail("ACCOUNT_NOT_PERMITTED", "A batch is sent again from the account it was paid from.");
      raws = Array.isArray(input.lines) ? this.rawFrom(input.lines) : r.lines;
    } else if (Array.isArray(input.lines)) raws = this.rawFrom(input.lines);
    else if (input.file !== undefined) { const f = this.readFile(co, s, input); raws = f.lines; key = f.key; }

    // what the person did to the list
    const pos = (n: unknown) => { const k = Number(n); return Number.isInteger(k) && k >= 1 && k <= raws.length ? k - 1 : -1; };
    const e = pos(input.editN);
    if (e >= 0) {
      const cur = raws[e]!;
      raws[e] = { ...cur, ...(input.editName !== undefined ? { name: cleanCell(input.editName) } : {}), ...(input.editAccount !== undefined ? { account: cleanCell(input.editAccount) } : {}), ...(input.editCode !== undefined ? { code: cleanCell(input.editCode) } : {}), ...(input.editAmount !== undefined ? { amount: cleanCell(input.editAmount, 20) } : {}) };
      delete raws[e]!.note;
    }
    const u = pos(input.useSavedN);
    if (u >= 0) {
      const sup = co.whitelist.find((b) => sameName(b.name, raws[u]!.name)), saved = sup ? SUPPLIER_ACCOUNTS[co.id]?.[sup.id] : undefined;
      if (saved) { raws[u] = { ...raws[u]!, account: saved.account, code: saved.code }; delete raws[u]!.note; }
    }
    if (input.add === true) {
      const sup = co.whitelist.find((b) => b.id === input.addSupplierId), saved = sup ? SUPPLIER_ACCOUNTS[co.id]?.[sup.id] : undefined;
      if (!sup || !saved || !String(input.addAmount ?? "").trim() || !(Number(input.addAmount) > 0)) fail("ADD_INVALID", "Choose a payee and enter an amount.");
      if (this.f.bulkFile !== false && raws.length >= MAX_FILE_LINES) fail("BATCH_TOO_LARGE", "A batch can have up to 50 payments.");
      raws.push({ name: sup.name, account: saved.account, code: saved.code, amount: cleanCell(input.addAmount, 20), reference: cleanCell(input.addReference, MAX_REFERENCE * 2) });
    }
    const rm = pos(input.removeN);
    if (rm >= 0) raws.splice(rm, 1);
    if (input.removeErrors === true) { const v = this.views(co, userId, raws); raws = raws.filter((_, i) => v[i]!.status === "ready"); }

    if (this.f.bulkFile !== false && raws.length > MAX_FILE_LINES) fail("BATCH_TOO_LARGE", "A batch can have up to 50 payments.");
    if (input.begin === true && raws.length === 0) fail("EMPTY_BATCH", "Add at least one payment.");
    const v = this.views(co, userId, raws);
    const valid = v.filter((x) => x.status === "ready"), bad = v.length - valid.length;
    const totalMinor = valid.reduce((sum, x) => sum + x.usdMinor, 0);
    const currencies = [...new Set(v.map((x) => x.currency))];
    const blocker = resend && v.length === 0 ? "There is nothing to resend." : v.length === 0 ? "Add at least one payment." : bad > 0 ? "Fix or remove the payments that need fixing." : "";
    const name = batch ? `Resend of ${batch.name}`.slice(0, MAX_BATCH_NAME) : "";
    return {
      count: v.length, valid: valid.length, invalid: bad, total: fromMinor(totalMinor, co.currency), totalText: fmt(fromMinor(totalMinor, co.currency), co.currency), currency: co.currency,
      mixed: currencies.length > 1, currencies, accountId: account.id, accountName: `${account.name} ${account.maskedNumber}`, fileKey: key,
      canContinue: blocker === "", blocker, firstFix: v.find((x) => x.status === "fix")?.n ?? 0,
      resend, repairOf: batch?.id ?? "", batchName: name, empty: v.length === 0,
      requiredApprovers: totalMinor > toMinor(co.dualApprovalAbove, co.currency) ? 2 : 1,
      lines: Object.fromEntries(v.map((x) => [String(x.n), { id: String(x.n), ...x, note: raws[x.n - 1]!.note ?? "" }])),
      raw: raws,
    };
  }

  /* ----------------------------------------------------------------------------------------------- speeds, the review */

  /** What the lines add up to in each currency they are in: "$9,800.00 + €6,500.00". */
  private amountsOf(views: View[]) {
    const per = new Map<string, number>();
    for (const v of views) per.set(v.currency, (per.get(v.currency) ?? 0) + toMinor(v.amount, v.currency));
    return [...per].map(([c, m]) => fmt(fromMinor(m, c), c)).join(" + ");
  }
  private speedsOf(co: CorpCompany, views: View[], input: Record<string, any>) {
    const rails = railsFor(this.home()), down = (this.host.conditions().unavailable ?? []).filter((x) => x.startsWith("rail:")).map((x) => x.slice(5));
    const allowed: Record<SpeedClass, boolean> = { standard: true, sameDay: input.allowSameDay !== false, instant: input.allowInstant !== false, priority: false };
    return SPEEDS.filter((sp) => allowed[sp]).map((sp) => {
      let feeMinor = 0, usable = true, reason = "";
      for (const l of views) {
        const rail = l.domestic ? rails.domestic.find((r) => r.speed === sp) : RAILS.international.find((r) => r.speed === sp);
        if (!rail) { usable = false; reason = reason || "Some payments go abroad"; continue; }
        if (down.includes(rail.id)) { usable = false; reason = reason || "Not available right now"; continue; }
        if (rail.limit !== null && l.amount > rail.limit && this.f.bulkSpeed !== false) { usable = false; reason = "Some payments are too large"; }
        feeMinor += toMinor(rail.fee, co.currency);
      }
      const sample = rails.domestic.find((r) => r.speed === sp) ?? RAILS.international[0]!;
      return { speed: sp, name: sp === "standard" ? "Standard" : sp === "sameDay" ? "Same day" : "Instant", arrives: sp === "standard" ? "1 to 3 business days" : sp === "sameDay" ? "Today" : "In seconds", feeMinor, usable, reason, id: sample.id };
    });
  }

  /**
   * The speeds a batch can go at, with the fee of each and the dates it can be sent on; with a speed and `review`, the totals, the approvers and the checks
   * that come before the code: nothing payable, the person's limit, the company's limit and the money in the account.
   */
  private quote(co: CorpCompany, s: State, userId: string, input: Record<string, any>) {
    const account = this.payAccount(co, input.fromAccountId, userId);
    const views = this.views(co, userId, this.rawFrom(input.lines));
    if (views.length === 0) fail("NO_VALID_LINES", "None of the payments can be sent.");
    if (this.f.bulkFixed !== false && views.some((v) => v.status === "fix")) fail("LINES_NEED_FIXING", "Fix or remove the payments that need fixing.");
    const speeds = this.speedsOf(co, views, input);
    const dates = this.workingDays(co, 30);
    const fmtFee = (m: number) => (m === 0 ? "No fee" : fmt(fromMinor(m, co.currency), co.currency));
    const list = speeds.map((x) => ({ id: x.speed, name: x.name, sub: x.usable ? `${x.arrives} · ${fmtFee(x.feeMinor)}` : x.reason, arrives: x.arrives, fee: fromMinor(x.feeMinor, co.currency), feeText: fmtFee(x.feeMinor), usable: x.usable, ...(x.reason ? { reason: x.reason } : {}) }));
    const first = list.find((x) => x.usable);
    const out: Record<string, any> = { speeds: Object.fromEntries(list.map((x) => [x.id, x])), firstUsable: first?.id ?? "", dates, count: views.length };
    const chosen = input.speed ? speeds.find((x) => x.speed === input.speed) : undefined;
    if (input.speed) {
      if (!chosen) fail("RAIL_NOT_AVAILABLE", "Choose a speed from the list.");
      if (!chosen.usable) fail(chosen.reason === "Some payments are too large" ? "RAIL_LIMIT" : "RAIL_NOT_AVAILABLE", chosen.reason === "Some payments are too large" ? "Some payments are too large for this speed. Choose another speed or fix the payments." : `${chosen.reason}. Choose another speed.`);
      const sendOn = this.sendDate(co, chosen.speed, input.sendOn, dates);
      const totalMinor = views.reduce((sum, x) => sum + x.usdMinor, 0), youPay = totalMinor + chosen.feeMinor;
      Object.assign(out, { speed: chosen.speed, speedName: chosen.name, sendOn, sendText: sendOn === this.today() ? "Today" : dayName(sendOn), total: fromMinor(totalMinor, co.currency), totalText: fmt(fromMinor(totalMinor, co.currency), co.currency), fee: fromMinor(chosen.feeMinor, co.currency), feeText: chosen.feeMinor ? fmt(fromMinor(chosen.feeMinor, co.currency), co.currency) : "None", youPay: fromMinor(youPay, co.currency), youPayText: fmt(fromMinor(youPay, co.currency), co.currency), currency: co.currency, requiredApprovers: youPay > toMinor(co.dualApprovalAbove, co.currency) ? 2 : 1, codeExtra: co.codeAbove !== undefined && youPay >= toMinor(co.codeAbove, co.currency), mixed: new Set(views.map((x) => x.currency)).size > 1, amountsText: this.amountsOf(views), accountName: `${account.name} ${account.maskedNumber}` });
      if (input.review === true) this.limits(co, userId, account, youPay);
    }
    return out;
  }
  private sendDate(co: CorpCompany, speed: string, raw: unknown, dates: Record<string, unknown>): string {
    if (speed === "instant" || raw === undefined || raw === "today") return this.today();
    const want = String(raw);
    if (this.f.bulkDate !== false && want === "") fail("DATE_REQUIRED", "Choose a date.");
    if (this.f.bulkDate !== false && !(validIso(want) && want in dates)) fail("DATE_NOT_WORKING_DAY", "Choose a working day.");
    return want;
  }
  /** The checks of the review, in the order of the spec; the payment meets the same ones again when it starts. */
  private limits(co: CorpCompany, userId: string, account: CorpCompany["accounts"][number], youPayMinor: number) {
    const user = co.users.find((u) => u.id === userId);
    if (this.f.userLimit !== false && user && toMinor(user.usedToday, co.currency) + youPayMinor > toMinor(user.dailyLimit, co.currency)) fail("LIMIT_USER_EXCEEDED", "This is above your payment limit.");
    if (this.f.companyLimit !== false && toMinor(co.companyUsedToday, co.currency) + youPayMinor > toMinor(co.companyDailyLimit, co.currency)) fail("LIMIT_COMPANY_EXCEEDED", "This is above the company limit.");
    if (this.f.bulkFunds !== false && youPayMinor > toMinor(account.balance, account.currency)) fail("INSUFFICIENT_FUNDS", "There isn’t enough money in this account.");
  }

  /** Sends the batch for approval as one payment. The code comes first, every line is checked again and nothing is paid until the approvers release it. */
  private submit(corp: CorporateProvider, co: CorpCompany, s: State, userId: string, input: Record<string, any>) {
    const account = this.payAccount(co, input.fromAccountId, userId);
    const resend = input.repairOf ? this.repairLines(co, corp, s, input.repairOf) : undefined;
    if (resend && resend.batch.accountId !== account.id) fail("ACCOUNT_NOT_PERMITTED", "A batch is sent again from the account it was paid from.");
    const raws = this.rawFrom(input.lines);
    const views = this.views(co, userId, raws);
    if (views.length === 0) fail(resend ? "REPAIR_NOT_ALLOWED" : "NO_VALID_LINES", resend ? "There is nothing to resend." : "None of the payments can be sent.");
    if (this.f.bulkFixed !== false && views.some((v) => v.status === "fix")) fail("LINES_NEED_FIXING", "Fix or remove the payments that need fixing.");
    const name = cleanCell(input.name, 200);
    if (name.length > MAX_BATCH_NAME) fail("NAME_TOO_LONG", "Use up to 35 characters for the name.");
    const batchName = name || (resend ? `Resend of ${resend.batch.name}`.slice(0, MAX_BATCH_NAME) : `Batch ${this.today()}`);
    const speeds = this.speedsOf(co, views, input), chosen = speeds.find((x) => x.speed === input.speed);
    if (!chosen) fail("RAIL_NOT_AVAILABLE", "Choose a speed from the list.");
    if (!chosen.usable) fail(chosen.reason === "Some payments are too large" ? "RAIL_LIMIT" : "RAIL_NOT_AVAILABLE", `${chosen.reason}.`);
    const sendOn = this.sendDate(co, chosen.speed, input.sendOn, this.workingDays(co, 30));
    const totalMinor = views.reduce((sum, x) => sum + x.usdMinor, 0), youPay = totalMinor + chosen.feeMinor;
    // a batch always needs the one-time code, from the larger amounts with the extra line
    if (this.f.bulkCode !== false) this.host.requireCode(co, true, () => fromMinor(youPay, co.currency));
    const p = (corp as any).initiateChecked
      ? (corp as any).initiateChecked({ userId, fromAccountId: account.id, total: fromMinor(youPay, co.currency), reference: batchName, lines: views.map((x) => ({ n: x.n, beneficiaryId: x.supplierId, amount: x.usd, reference: x.reference })) }) as CorpPayment
      : fail("NOT_SUPPORTED", "This bank cannot start a batch.");
    this.host.spendCode();
    s.batches.set(p.id, { id: p.id, kind: "bulk", name: batchName, accountId: account.id, sendOn, speed: chosen.speed, fee: fromMinor(chosen.feeMinor, co.currency), ...(resend ? { repairOf: resend.batch.id } : {}), lines: views.map((x) => ({ n: x.n, supplierId: x.supplierId, payee: x.name, last4: x.account.slice(-4), amount: x.amount, currency: x.currency, usd: x.usd, reference: x.reference })) });
    // the payments sent again are marked on the batch they came from, so they cannot be sent twice
    if (resend && this.f.bulkResent !== false) for (const r of raws) { const orig = resend.batch.lines.find((l) => l.n === r.origN && l.failed && !l.resentBy); if (orig) orig.resentBy = p.id; }
    if (typeof input.fileKey === "string" && input.fileKey) s.sent.set(input.fileKey, this.today());
    this.host.log(corp, userId, `Started bulk payment ${p.id} of ${views.length} payments`);
    const needed = p.required;
    return {
      id: p.id, status: p.status, required: needed, amount: p.amount, currency: p.currency, name: batchName, count: views.length, totalText: fmt(fromMinor(totalMinor, co.currency), co.currency), youPayText: fmt(fromMinor(youPay, co.currency), co.currency),
      speedName: chosen.name, sendText: sendOn === this.today() ? "Today" : dayName(sendOn), approvalsText: `Waiting for ${needed} approver${needed > 1 ? "s" : ""}`, reference: this.reference(p), resent: resend ? resend.batch.id : "",
      mixed: new Set(views.map((x) => x.currency)).size > 1, amountsText: this.amountsOf(views),
    };
  }

  /* ----------------------------------------------------------------------------------------------- the batches */

  /** Where a batch stands, as one word; the words of its payments follow from it. */
  private statusOf(batch: Batch, p: CorpPayment): keyof typeof STATUS_WORDS {
    if (p.status === "pending_approval") return "waiting";
    if (p.status === "rejected") return p.rejectReason?.startsWith("Withdrawn by") ? "withdrawn" : "rejected";
    const earlier = (p.releasedAt ?? "").slice(0, 10) < this.today();
    if (!earlier) return "sent";
    return this.f.bulkStatus !== false && batch.lines.some((l) => l.failed) ? "partly" : "paid";
  }
  private lineStatus(batch: Batch, l: BLine, status: string): keyof typeof LINE_WORDS {
    if (status === "waiting") return "waiting";
    if (status === "rejected") return "cancelled";
    if (status === "withdrawn") return "withdrawn";
    if (l.failed) return l.resentBy ? "resent" : "failed";
    return status === "sent" ? "sent" : "paid";
  }
  private batchOf(co: CorpCompany, s: State, p: CorpPayment): Batch {
    return s.batches.get(p.id) ?? { id: p.id, kind: p.period ? "payroll" : "bulk", name: p.reference, accountId: p.fromAccountId, sendOn: p.valueDate, speed: "standard", fee: 0, lines: (p.lines ?? []).map((l) => ({ n: l.n, supplierId: l.beneficiaryId, payee: co.whitelist.find((b) => b.id === l.beneficiaryId)?.name ?? l.beneficiaryId, last4: SUPPLIER_ACCOUNTS[co.id]?.[l.beneficiaryId]?.account.slice(-4) ?? "", amount: l.amount, currency: co.currency, usd: l.amount, reference: l.reference })) };
  }
  private batches(corp: CorporateProvider, co: CorpCompany, s: State) {
    return (corp.all?.() ?? []).filter((p) => p.lines && !p.period).sort((a, b) => b.initiatedAt.localeCompare(a.initiatedAt) || b.id.localeCompare(a.id)).map((p) => ({ p, b: this.batchOf(co, s, p) }));
  }
  private card(corp: CorporateProvider, co: CorpCompany, s: State, p: CorpPayment, b: Batch) {
    const status = this.statusOf(b, p);
    const failed = b.lines.filter((l) => l.failed && !l.resentBy).length;
    return {
      id: p.id, name: b.name, kind: b.kind, count: b.lines.length, countText: `${b.lines.length} ${b.kind === "payroll" ? "employee" : "payment"}${b.lines.length === 1 ? "" : "s"}`, total: p.amount, totalText: fmt(p.amount, p.currency), currency: p.currency,
      statusKey: status, statusText: STATUS_WORDS[status], date: stamp(p.initiatedAt), line: `${b.lines.length} ${b.kind === "payroll" ? "employee" : "payment"}${b.lines.length === 1 ? "" : "s"} · ${p.id}`, sub: `${b.lines.length} ${b.kind === "payroll" ? "employees" : "payments"} · ${stamp(p.initiatedAt)}`,
      canResend: p.status === "released" && failed > 0 && b.kind === "bulk", failed,
    };
  }
  private list(corp: CorporateProvider, co: CorpCompany, s: State) {
    const rows = this.batches(corp, co, s).map(({ p, b }) => this.card(corp, co, s, p, b));
    return { count: rows.length, latest: rows[0]?.id ?? "", batches: Object.fromEntries(rows.map((r) => [r.id, r])) };
  }
  /** One batch with the standing of each of its payments; with `report`, the file the person downloads. */
  private get(corp: CorporateProvider, co: CorpCompany, s: State, input: Record<string, any>) {
    const all = this.batches(corp, co, s);
    const hit = input.id ? all.find((x) => x.p.id === input.id) : all[0];
    if (!hit) fail(input.id ? "PAYMENT_NOT_FOUND" : "NO_BATCHES", input.id ? "We can’t find that batch." : "No batches yet.");
    const { p, b } = hit, card = this.card(corp, co, s, p, b), status = card.statusKey;
    const lines = b.lines.map((l) => {
      const st = this.lineStatus(b, l, status);
      return { id: String(l.n), n: l.n, payee: `${l.n}. ${l.payee}`, name: l.payee, account: l.last4 ? `••${l.last4}` : "••", amount: l.amount, currency: l.currency, amountText: fmt(l.amount, l.currency), reference: l.reference, statusKey: st, statusText: LINE_WORDS[st], note: st === "failed" ? l.failed ?? "" : "" };
    });
    const out: Record<string, any> = { ...card, lines: Object.fromEntries(lines.map((l) => [l.id, l])), others: Object.fromEntries(all.filter((x) => x.p.id !== p.id).map((x) => { const c = this.card(corp, co, s, x.p, x.b); return [c.id, c]; })) };
    if (input.report === true) {
      const head = "Line,Payee,Amount,Currency,Status,Note";
      const rows = lines.map((l) => [l.n, l.name, fromMinor(toMinor(l.amount, l.currency), l.currency).toFixed(currencyInfo(l.currency).decimals), l.currency, l.statusText, l.note].map(reportCell).join(","));
      out.report = { fileName: `${p.id}_report.csv`, csv: [head, ...rows].join("\n"), rows: lines.map((l) => ({ id: String(l.n), line: l.n, payee: l.name, amountText: l.amountText, currency: l.currency, statusText: l.statusText, note: l.note })) };
    }
    return out;
  }

  /* ----------------------------------------------------------------------------------------------- payroll */

  private register_(co: CorpCompany): Employee[] { return PAYROLL_REGISTER[co.id] ?? []; }
  private periodTaken(corp: CorporateProvider, co: CorpCompany, period: string) {
    return (PAYROLL_HISTORY[co.id] ?? []).some((h) => h.period === period) || (corp.all?.() ?? []).some((p) => p.period === period && p.status !== "rejected");
  }
  private prevPeriod(period: string) { const y = Number(period.slice(0, 4)), m = Number(period.slice(5, 7)); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`; }
  private lastMonthMinor(corp: CorporateProvider, co: CorpCompany, period: string): number | null {
    const prev = this.prevPeriod(period);
    const paid = (corp.all?.() ?? []).find((p) => p.period === prev && p.status !== "rejected");
    if (paid) return toMinor(paid.amount, co.currency);
    return (PAYROLL_HISTORY[co.id] ?? []).some((h) => h.period === prev) ? defaultRunMinor(co.id, co.currency) : null;
  }
  private emp(co: CorpCompany, id: unknown) {
    const e = this.register_(co).find((x) => x.id === id);
    if (!e && this.f.employeeChecks !== false) fail("NOT_AN_EMPLOYEE", "Not on the company's payroll register");
    return e;
  }

  /** The employees of a run with what each is paid, the messages, the totals and the checks that come before the review. */
  private payView(corp: CorporateProvider, co: CorpCompany, d: Draft, input: Record<string, any>) {
    const reg = this.register_(co);
    const rows = d.rows.filter((r) => !r.removed).map((r) => {
      const e = reg.find((x) => x.id === r.id)!;
      const net = parseMinor(r.netText, e.currency);
      const pay = (net ?? 0) + r.bonus.reduce((a, b) => a + b, 0) - r.deduct.reduce((a, b) => a + b, 0);
      const cap = Math.floor((toMinor(e.salary, e.currency) * 3) / 2);
      let message = "";
      if (this.f.lineChecks === false) message = "";
      else if (this.f.payAmount !== false && net === null) message = "Enter an amount with up to 2 decimals.";
      else if (this.f.payAmount !== false && pay <= 0) message = "Pay must be above zero.";
      else if (this.f.payCap !== false && pay > cap) message = `Above the maximum of ${fmt(fromMinor(cap, e.currency), e.currency)}.`;
      const usdMinor = pay > 0 ? convertMinor(pay, e.currency, co.currency) : 0;
      return {
        id: e.id, name: e.name, dept: e.dept, currency: e.currency, netText: r.netText, net: net === null ? 0 : fromMinor(net, e.currency), pay: fromMinor(pay, e.currency), payText: fmt(fromMinor(pay, e.currency), e.currency), message, status: message ? "fix" : "ready", statusText: message ? "Needs fixing" : "Ready",
        usdMinor, detail: [message, ...r.bonus.map((b) => `Bonus +${fmt(fromMinor(b, e.currency), e.currency)}`), ...r.deduct.map((x) => `Deduction -${fmt(fromMinor(x, e.currency), e.currency)}`)].filter(Boolean).join(" · "),
        bonuses: Object.fromEntries(r.bonus.map((b, i) => [String(i), { id: `bonus${i}`, index: i, kind: "bonus", name: `Bonus +${fmt(fromMinor(b, e.currency), e.currency)}` }])),
        deductions: Object.fromEntries(r.deduct.map((x, i) => [String(i), { id: `deduction${i}`, index: i, kind: "deduction", name: `Deduction -${fmt(fromMinor(x, e.currency), e.currency)}` }])),
        lineCount: r.bonus.length + r.deduct.length,
      };
    });
    const out = d.rows.filter((r) => r.removed || !reg.find((x) => x.id === r.id)?.bank).map((r) => ({ id: r.id, name: reg.find((x) => x.id === r.id)?.name ?? r.id, reason: "Removed", canAddBack: true }));
    const notIn = [...out, ...reg.filter((e) => !e.bank).map((e) => ({ id: e.id, name: e.name, reason: "No bank details", canAddBack: false }))];
    const totalUsd = rows.reduce((a, r) => a + r.usdMinor, 0);
    const perCurrency = new Map<string, number>();
    for (const r of rows) perCurrency.set(r.currency, (perCurrency.get(r.currency) ?? 0) + toMinor(r.pay, r.currency));
    const account = co.accounts.find((a) => a.id === d.accountId)!;
    const balanceMinor = toMinor(account.balance, account.currency);
    const funds = totalUsd <= balanceMinor;
    const last = input.varianceCheck === false || this.f.payVariance === false ? null : this.lastMonthMinor(corp, co, d.period);
    const pct = last && last > 0 ? Math.round((Math.abs(totalUsd - last) * 100) / last) : 0;
    const needsReason = !!last && last > 0 && rows.length > 0 && Math.abs(totalUsd - last) * 100 > last * 20;
    const nowAfter = balanceMinor - totalUsd;
    const bad = rows.filter((r) => r.status === "fix").length;
    const blocker = rows.length === 0 ? "Add at least one person." : bad ? "Fix or remove the people marked." : !funds && this.f.payFunds !== false ? "There isn’t enough money in this account." : "";
    return {
      period: d.period, periodText: periodText(d.period), payDate: d.payDate, payDateText: dayName(d.payDate, true), accountId: d.accountId, accountName: `${account.name} ${account.maskedNumber}`, currency: co.currency,
      count: rows.length, countText: `${rows.length} employee${rows.length === 1 ? "" : "s"}`, totalText: rows.length ? [...perCurrency].map(([c, m]) => fmt(fromMinor(m, c), c)).join(" + ") : "None", totalUsd: fromMinor(totalUsd, co.currency), totalUsdText: fmt(fromMinor(totalUsd, co.currency), co.currency),
      from: `${rows.length} employee${rows.length === 1 ? "" : "s"} · from ${account.name} ${account.maskedNumber}`, balanceAfterText: funds && rows.length ? `balance after ${fmt(fromMinor(nowAfter, account.currency), account.currency)}` : "", fundsOk: funds, fundsMessage: funds ? "" : "There isn’t enough money in this account.",
      variance: needsReason ? { needed: true, percent: pct, direction: totalUsd > last! ? "up" : "down", text: `The total is ${totalUsd > last! ? "up" : "down"} ${pct}% on last month.` } : { needed: false, percent: 0, direction: "", text: "" },
      varianceText: needsReason ? `The total is ${totalUsd > last! ? "up" : "down"} ${pct}% on last month.` : "", varianceNeeded: needsReason,
      canReview: blocker === "", blocker, rows: Object.fromEntries(rows.map((r) => [r.id, r])), notIn: Object.fromEntries(notIn.map((r) => [r.id, r])), notInCount: notIn.length,
      requiredApprovers: totalUsd > toMinor(co.dualApprovalAbove, co.currency) ? 2 : 1, codeExtra: co.codeAbove !== undefined && totalUsd >= toMinor(co.codeAbove, co.currency),
      periods: Object.fromEntries(PAY_PERIODS.map((p) => [p, { id: p, name: periodText(p) }])),
    };
  }
  private draftOf(s: State, co: CorpCompany, userId: string): Draft { return s.drafts.get(`${co.id}:${userId}`) ?? fail("NO_RUN_STARTED", "Start a run first."); }

  /** The register behind a run: open one (a period, a pay date and an account), then change it one person at a time. Moves nothing; the draft is the person's own and lasts until they send or leave it. */
  private register(corp: CorporateProvider, co: CorpCompany, s: State, userId: string, input: Record<string, any>) {
    const op = String(input.op ?? "open");
    if (op === "options") return { periods: Object.fromEntries(PAY_PERIODS.map((p) => [p, { id: p, name: periodText(p), taken: this.periodTaken(corp, co, p) }])), dates: this.workingDays(co, 25), count: this.register_(co).filter((e) => e.bank).length };
    if (op === "open") {
      const account = this.payAccount(co, input.fromAccountId, userId);
      const period = String(input.period ?? "");
      if (this.f.payrollPeriod !== false && !PAY_PERIODS.includes(period)) fail("INVALID_PERIOD", "Choose this month or an earlier one.");
      if (this.f.payrollPeriod !== false && period > this.today().slice(0, 7)) fail("INVALID_PERIOD", "Choose this month or an earlier one.");
      if (this.f.payrollPeriod !== false && this.periodTaken(corp, co, period)) fail("PAYROLL_ALREADY_RUN", "Payroll for this period was already sent.");
      const payDate = String(input.payDate ?? "");
      if (!payDate) fail("DATE_REQUIRED", "Choose the pay date.");
      if (this.f.payDate !== false && !(validIso(payDate) && payDate in this.workingDays(co, 25))) fail("DATE_NOT_WORKING_DAY", "Choose a working day.");
      const d: Draft = { period, accountId: account.id, payDate, rows: this.register_(co).filter((e) => e.bank).map((e) => ({ id: e.id, netText: fromMinor(toMinor(e.net, e.currency), e.currency).toFixed(currencyInfo(e.currency).decimals), bonus: [], deduct: [], removed: false })) };
      s.drafts.set(`${co.id}:${userId}`, d);
      return this.payView(corp, co, d, input);
    }
    const d = this.draftOf(s, co, userId);
    const e = this.emp(co, input.employeeId);
    const row = d.rows.find((r) => r.id === input.employeeId);
    // one person's row, with the lines under it: the card of that person
    if (op === "row") return (this.payView(corp, co, d, input).rows as Record<string, unknown>)[String(input.employeeId)] ?? fail("NOT_AN_EMPLOYEE", "Not in this run.");
    if (op === "addBack") {
      if (!e) return this.payView(corp, co, d, input);
      if (!e.bank && this.f.employeeChecks !== false) fail("NO_BANK_DETAILS", "No bank details.");
      if (row) row.removed = false;
      else d.rows.push({ id: e.id, netText: fromMinor(toMinor(e.net, e.currency), e.currency).toFixed(currencyInfo(e.currency).decimals), bonus: [], deduct: [], removed: false });
      return this.payView(corp, co, d, input);
    }
    if (!row || !e) fail("NOT_AN_EMPLOYEE", "Not on the company's payroll register");
    if (op === "remove") row.removed = true;
    else if (op === "net") row.netText = cleanCell(input.amount, 20);
    else if (op === "bonus" || op === "deduction") {
      if (op === "bonus" ? input.allowBonus === false : input.allowDeduction === false) fail(op === "bonus" ? "BONUS_NOT_ALLOWED" : "DEDUCTION_NOT_ALLOWED", op === "bonus" ? "Bonus lines are switched off." : "Deduction lines are switched off.");
      const minor = parseMinor(cleanCell(input.amount, 20), e.currency);
      if (!minor || minor <= 0) fail("INVALID_AMOUNT", "Enter an amount above zero");
      (op === "bonus" ? row.bonus : row.deduct).push(minor);
    } else if (op === "removeLine") {
      const list = input.kind === "bonus" ? row.bonus : row.deduct, i = Number(input.index);
      if (Number.isInteger(i) && i >= 0 && i < list.length) list.splice(i, 1);
    } else fail("UNKNOWN_OP", "Unknown change.");
    return this.payView(corp, co, d, input);
  }

  /** Everything that must hold before a run can be reviewed or sent; with `review`, also the limits and the money in the account. */
  private payCheck(corp: CorporateProvider, co: CorpCompany, s: State, userId: string, input: Record<string, any>) {
    const d = this.draftOf(s, co, userId);
    const v = this.payView(corp, co, d, input);
    if (v.count === 0) fail("EMPTY_BATCH", "Add at least one person.");
    if (Object.values(v.rows).some((r: any) => r.status === "fix")) fail("ROWS_NEED_FIXING", "Fix or remove the people marked.");
    if (this.f.payFunds !== false && !v.fundsOk) fail("INSUFFICIENT_FUNDS", "There isn’t enough money in this account.");
    const reason = cleanCell(input.reason, MAX_REASON * 2);
    if (v.varianceNeeded && (reason === "" || reason.length > MAX_REASON)) fail("REASON_REQUIRED", "Add a short reason.");
    if (input.review === true) this.limits(co, userId, co.accounts.find((a) => a.id === d.accountId)!, toMinor(v.totalUsd, co.currency));
    return { ...v, feeText: "None", youPayText: v.totalUsdText, payslips: input.payslips !== false };
  }

  /** Sends the run for approval as one payment. */
  private paySubmit(corp: CorporateProvider, co: CorpCompany, s: State, userId: string, input: Record<string, any>) {
    const d = this.draftOf(s, co, userId);
    const v = this.payCheck(corp, co, s, userId, { ...input, review: true });
    if (this.f.payrollPeriod !== false && this.periodTaken(corp, co, d.period)) fail("PAYROLL_ALREADY_RUN", "Payroll for this period was already sent.");
    if (this.f.payCode !== false) this.host.requireCode(co, true, () => v.totalUsd);
    const rows = Object.values(v.rows) as any[];
    const p = (corp as any).initiateChecked
      ? (corp as any).initiateChecked({ userId, fromAccountId: d.accountId, total: v.totalUsd, reference: `Payroll ${d.period}`, period: d.period, lines: rows.map((r, i) => ({ n: i + 1, beneficiaryId: r.id, amount: fromMinor(r.usdMinor, co.currency), reference: `Payroll ${d.period}` })) }) as CorpPayment
      : fail("NOT_SUPPORTED", "This bank cannot start a run.");
    this.host.spendCode();
    s.drafts.delete(`${co.id}:${userId}`);
    s.batches.set(p.id, { id: p.id, kind: "payroll", name: `Payroll ${periodText(d.period)}`, accountId: d.accountId, period: d.period, sendOn: d.payDate, speed: "standard", fee: 0, payslips: input.payslips !== false, reason: cleanCell(input.reason, MAX_REASON), lines: rows.map((r, i) => ({ n: i + 1, employeeId: r.id, payee: r.name, last4: EMPLOYEE_LAST4[r.id] ?? "", amount: r.pay, currency: r.currency, usd: fromMinor(r.usdMinor, co.currency), reference: `Payroll ${d.period}` })) });
    this.host.log(corp, userId, `Started payroll run ${p.id} for ${d.period} (${rows.length} employees)`);
    return {
      id: p.id, status: p.status, required: p.required, amount: p.amount, currency: p.currency, period: d.period, periodText: periodText(d.period), payDateText: v.payDateText, count: rows.length, countText: v.countText, totalText: v.totalText, totalUsdText: v.totalUsdText, youPayText: v.totalUsdText,
      approvalsText: `Waiting for ${p.required} approver${p.required > 1 ? "s" : ""}`, reference: this.reference(p), payslips: input.payslips !== false,
    };
  }

  /** The lines of a batch for the approver: who is paid how much, with no account numbers. */
  linesView(co: CorpCompany, p: CorpPayment) {
    if (!p.lines) return undefined;
    const b = this.batchOf(co, this.state(co), p);
    return { kind: b.kind, name: b.name, countText: `${b.lines.length} ${b.kind === "payroll" ? "employee" : "payment"}${b.lines.length === 1 ? "" : "s"}`, rows: Object.fromEntries(b.lines.map((l) => [String(l.n), { id: String(l.n), n: l.n, payee: l.payee, amountText: fmt(l.usd, co.currency), reference: l.reference }])) };
  }

  /* ----------------------------------------------------------------------------------------------- scenarios */

  /** Scenario only: a file that was sent before, a batch of the person's own that was paid and had a payment returned. */
  private arrange(corp: CorporateProvider, co: CorpCompany, s: State, input: Record<string, any>) {
    switch (input.op) {
      case "sentFile": s.sent.set(fileKey(String(input.file ?? "")), String(input.on ?? "2026-10-30")); return { ok: true };
      case "failLine": {
        const b = s.batches.get(String(input.id)); const l = b?.lines.find((x) => x.n === Number(input.n));
        if (l) { l.failed = String(input.message ?? "The account name didn’t match."); delete l.resentBy; }
        return { ok: !!l };
      }
      case "dualAbove": (corp as any).arrange?.({ kind: "dualAbove", amount: Number(input.amount) }); return { ok: true };
      case "userUsed": (corp as any).arrange?.({ kind: "userUsed", userId: String(input.userId ?? "alex"), amount: Number(input.amount) }); return { ok: true };
      case "companyUsed": (corp as any).arrange?.({ kind: "companyUsed", amount: Number(input.amount) }); return { ok: true };
      case "bulkBatch": { corp.seedPayment?.(input.payment as CorpPayment); return { ok: true }; }
    }
    return fail("UNKNOWN_ARRANGEMENT", "Unknown arrangement.");
  }
}

export { MONTH_NAMES, stamp as stampOf, fmt as formatMoney };
