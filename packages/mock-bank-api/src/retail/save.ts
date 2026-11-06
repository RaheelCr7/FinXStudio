import { formatMoney, fromMinor, toMinor } from "@finx/ui-kit";
import { BankError } from "../errors";
import type { Account, Persona, SandboxConditions } from "../index";
import type { Flaws } from "../business/corporate";
import type { BankConfig } from "../config";
import type { AccountTxn } from "./data";
import type { Category } from "./finance";
import { credit, debit, spendable } from "./money";
import { receiptDate } from "./topup";

/**
 * Save and borrow (BankWorkx, Personal: Save & Borrow). The sandbox side of the journeys save-borrow, term-deposit, savings-goal, apply-loan, repay-loan,
 * invest, sell-investment and add-money: term deposits, savings goals, loans and what is paid on them, the shelf of four funds and what a customer holds,
 * and topping an account up from a saved card. All amounts are in the currency of the customer's first account, all sums are done in whole minor units
 * (cents) and rounded half up; the one place a float enters is the loan instalment formula, whose result is rounded to cents at once. Every rule can be
 * switched off for the mutation check (Flaws). Rates, limits and fees are sandbox policy, not market data.
 */
export const DEPOSIT = { terms: [3, 6, 12, 24], bp: { 3: 340, 6: 380, 12: 420, 24: 450 } as Record<number, number>, min: 1000, max: 250_000, earlyChargePercent: 50 };
export const GOAL = { max: 10, nameMin: 2, nameMax: 30, targetMin: 50, targetMax: 1_000_000, autoMin: 5, contributeMin: 1, months: 36 };
export const LOAN = {
  terms: [12, 24, 36, 48, 60], bp: { 12: 890, 24: 940, 36: 990, 48: 1040, 60: 1090 } as Record<number, number>, riseBp: 100, min: 1000, max: 50_000, step: 500, maxLoans: 3,
  feePercent: 1, incomeFloor: 1000, incomeMax: 1_000_000, commitmentsMax: 1_000_000, purposes: ["Home improvement", "Car", "Education", "Medical", "Travel", "Debt consolidation", "Other"],
  employment: ["Employed", "Self-employed", "Retired", "Student", "Not working"], selfEmployedAbove: 15_000, retiredAbove: 20_000, incomeMultiple: 12,
  refuse: { affordability: 50, referral: 40, rise: 35 },
};
export const REPAY = { customMin: 10, settleFeePercent: 1, settleFeeAbove: 12 };
export const SELL = { feeBp: 25, min: 10, settleDays: 2 };
export const TOPUP = { min: 10, max: 5000, feeBp: 150, declineEnding: "0000" };
export const FUNDS = [
  { id: "gov", name: "Government Bond Fund", risk: "low", chargeBp: 30, min: 50, price: 10.5, about: "Short-dated government bonds" },
  { id: "bal", name: "Balanced Portfolio", risk: "medium", chargeBp: 65, min: 100, price: 16, about: "A mix of shares and bonds" },
  { id: "geq", name: "Global Equity Fund", risk: "high", chargeBp: 85, min: 100, price: 27.5, about: "Shares in large companies worldwide" },
  { id: "tech", name: "Technology Growth Fund", risk: "high", chargeBp: 110, min: 250, price: 42, about: "Shares in technology companies" },
] as const;
type Fund = (typeof FUNDS)[number];
const RISK_TEXT: Record<string, string> = { low: "Low risk", medium: "Medium risk", high: "High risk" };
const INSTRUCTIONS: Record<string, string> = { renew: "Renew with interest", "renew-payout": "Renew, pay interest out", payout: "Pay out at maturity" };
const DAY = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export type DepositRec = {
  id: string; principal: number; currency: string; /** basis points a year: 420 is 4.20% */ bp: number; termMonths: number; /** YYYY-MM-DD */ openedOn: string; maturesOn: string;
  payout: "maturity" | "monthly"; accountId: string; renewal?: { termMonths: number; bp: number; instruction: "renew" | "renew-payout" };
};
export type GoalRec = { id: string; name: string; target: number; saved: number; currency: string; /** the last day of a month, YYYY-MM-DD */ targetDate: string; auto?: { fromAccountId: string; amount: number } };
export type LoanRec = {
  id: string; name: string; original: number; outstanding: number; currency: string; bp: number; instalment: number; termMonths: number; paymentsLeft: number; /** YYYY-MM-DD */ lastPaid: string; nextDue: string; accountId: string;
};
export type HoldingRec = { fundId: string; /** three decimals */ units: number; cost: number };
export type SaveSeed = { deposits: DepositRec[]; goals: GoalRec[]; loans: LoanRec[]; holdings: HoldingRec[] };

/** Alex Morgan's savings and borrowing (synthetic): a deposit of 10,000 at 4.20% opened 12 Aug 2026, the Holiday fund, a personal loan with 24 payments left, two funds. */
export const alexSave = (): SaveSeed => ({
  deposits: [{ id: "td1", principal: 10_000, currency: "USD", bp: 420, termMonths: 12, openedOn: "2026-08-12", maturesOn: "2027-08-12", payout: "maturity", accountId: "acc_main" }],
  goals: [{ id: "g1", name: "Holiday fund", target: 5000, saved: 3200, currency: "USD", targetDate: "2027-06-30", auto: { fromAccountId: "acc_main", amount: 200 } }],
  loans: [{ id: "ln1", name: "Personal loan", original: 16_000, outstanding: 9600, currency: "USD", bp: 990, instalment: 412.5, termMonths: 48, paymentsLeft: 24, lastPaid: "2026-11-01", nextDue: "2026-12-01", accountId: "acc_main" }],
  holdings: [{ fundId: "bal", units: 150, cost: 2300 }, { fundId: "geq", units: 88, cost: 2350 }],
});
export const emptySave = (): SaveSeed => ({ deposits: [], goals: [], loans: [], holdings: [] });

export type SaveHost = { now: () => number; otp: { attempts: number; verified: boolean }; conditions: () => SandboxConditions; flaws: Flaws; config: () => BankConfig };
const ADAPTERS = /^bank\.(accounts\.payFrom|deposits\.(list|terms|quote|open|renew(\.quote)?|close(\.quote)?)|goals\.(list|months|plan|create|update|contribute|withdraw)|schedule\.list|loans\.(list|get|quote|eligibility|apply|repay|settle|settlement\.quote)|funds\.(list|get|holdings|portfolio|buy|sell)|cards\.forTopup|deposit\.create)$/;
/** Answered only for a customer who has a savings seed: the older records answer for the rest. */
const NEEDS_SEED = /^bank\.(deposits|goals|loans)\.(list|get)$/;

const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const at = (d: string) => Date.parse(`${d}T00:00:00Z`);
const dayText = (d: string) => receiptDate(at(d));
const dayMonth = (d: string) => `${new Date(at(d)).getUTCDate()} ${MONTHS[new Date(at(d)).getUTCMonth()]}`;
const addMonths = (d: string, n: number) => {
  const [y, m, day] = d.split("-").map(Number) as [number, number, number];
  const first = Date.UTC(y, m - 1 + n, 1), last = new Date(Date.UTC(new Date(first).getUTCFullYear(), new Date(first).getUTCMonth() + 1, 0)).getUTCDate();
  return iso(Date.UTC(new Date(first).getUTCFullYear(), new Date(first).getUTCMonth(), Math.min(day, last)));
};
const monthEnd = (y: number, m0: number) => iso(Date.UTC(y, m0 + 1, 0));
const daysBetween = (a: string, b: string) => Math.max(0, Math.round((at(b) - at(a)) / DAY));
/** Whole-number arithmetic rounded half up: a × b ÷ c. */
const mdiv = (a: number, b: number, c: number) => Math.floor((a * b * 2 + c) / (c * 2));
const nameOf = (a: Account) => a.nickname || a.name;
const units3 = (u: number) => Math.round(u * 1000) / 1000;
const unitsText = (u: number) => String(units3(u));
const bpText = (bp: number) => String(bp / 100);

export class SaveApi {
  private seq = 0;
  /** What the bank last approved for this customer: the offer a loan can be made from, and nothing else. */
  private offer: { amount: number; term: number; bp: number; payment: number; purpose: string; fee: boolean } | undefined;
  constructor(private p: Persona, private host: SaveHost) {}
  private get f() { return this.host.flaws; }
  private now = () => this.host.now();
  private today = () => iso(this.now());
  private day = () => this.today().replace(/-/g, "");
  private get data(): SaveSeed {
    if (!this.p.save) throw new BankError("NOT_SUPPORTED", "Not available for this customer");
    return this.p.save;
  }
  private cur = () => this.p.accounts[0]?.currency ?? "USD";
  private money = (amount: number) => formatMoney(amount, this.cur(), "en-US", undefined, true);
  private minor = (amount: number) => toMinor(amount, this.cur());
  private major = (minor: number) => fromMinor(minor, this.cur());
  private ref = (prefix: string) => `${prefix}-${this.day()}-${String(930 + ++this.seq).padStart(4, "0")}`;
  /** The next free id of a kind: td2, g3, ln2. */
  private newId(prefix: string, taken: { id: string }[]) { let n = taken.length + 1; while (taken.some((x) => x.id === `${prefix}${n}`)) n += 1; return `${prefix}${n}`; }
  private ensureOtp() { if (!this.host.otp.verified) throw new BankError("OTP_REQUIRED", "OTP not verified"); }
  private spent() { this.host.otp.verified = false; }

  handles = (adapter: string) => ADAPTERS.test(adapter) && (!NEEDS_SEED.test(adapter) || !!this.p.save);

  call(adapter: string, input: Record<string, any>): any {
    switch (adapter) {
      case "bank.accounts.payFrom": return this.payFrom();
      case "bank.deposits.list": return this.pick(this.depositList(), input);
      case "bank.deposits.terms": return this.depositTerms(input);
      case "bank.deposits.quote": return this.depositQuote(input);
      case "bank.deposits.open": return this.depositOpen(input);
      case "bank.deposits.renew": return this.depositRenew(input);
      case "bank.deposits.renew.quote": return this.depositRenew({ ...input, dryRun: true });
      case "bank.deposits.close.quote": return this.closeQuote(input);
      case "bank.deposits.close": return this.depositClose(input);
      case "bank.goals.list": return this.pick(this.goalList(), input);
      case "bank.goals.months": return this.goalMonths();
      case "bank.goals.plan": return this.goalPlan(input);
      case "bank.goals.create": return this.goalSave(input, false);
      case "bank.goals.update": return this.goalSave(input, true);
      case "bank.goals.contribute": return this.goalContribute(input);
      case "bank.goals.withdraw": return this.goalWithdraw(input);
      case "bank.schedule.list": return this.scheduled();
      case "bank.loans.list": return this.pick(this.loanList(), input);
      case "bank.loans.get": return this.loanDetail(input);
      case "bank.loans.quote": return this.loanQuote(input);
      case "bank.loans.eligibility": return this.eligibility(input);
      case "bank.loans.apply": return this.loanApply(input);
      case "bank.loans.repay": return this.repay(input);
      case "bank.loans.settle": return this.settle(input);
      case "bank.loans.settlement.quote": return this.settlement(this.loan(input.loanId), input.settleFee !== false);
      case "bank.funds.list": return this.fundList(input);
      case "bank.funds.get": return this.fundView(this.fund(input.fundId));
      case "bank.funds.holdings": return this.holdings();
      case "bank.funds.portfolio": return this.portfolio();
      case "bank.funds.buy": return this.buy(input);
      case "bank.funds.sell": return this.sell(input);
      case "bank.cards.forTopup": return this.topupCards();
      case "bank.deposit.create": return this.topup(input);
    }
    throw new BankError("UNKNOWN_ADAPTER", `No sandbox handler for ${adapter}`);
  }

  /* ----------------------------------------------------------------------------------------------- accounts and money */

  private account(id: unknown): Account {
    const a = this.p.accounts.find((x) => x.id === id);
    if (!a) throw new BankError("ACCOUNT_NOT_FOUND", "We can’t find that account. Choose another.");
    return a;
  }
  /** The shared check of the account that pays: chosen, able to pay, holding the amount. */
  private payer(id: unknown, amount: number): Account {
    const a = this.account(id);
    if (this.f.saveDebit !== false && (a.status === "frozen" || a.status === "closing" || !a.canDebit)) throw new BankError("ACCOUNT_CANNOT_DEBIT", "You can’t use this account right now. Choose another account.");
    if (this.f.saveFunds !== false && this.minor(amount) > this.minor(spendable(a))) throw new BankError("INSUFFICIENT_FUNDS", `Not enough money in ${nameOf(a)}. Available: ${this.money(spendable(a))}.`);
    return a;
  }
  private receiver(id: unknown): Account {
    const a = this.account(id);
    if (this.f.saveCredit !== false && (a.status === "frozen" || a.status === "closing")) throw new BankError("ACCOUNT_CANNOT_CREDIT", "This account can’t receive money right now. Choose another account.");
    return a;
  }
  /** A number with no more digits after the point than the currency has. */
  private isAmount = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && this.major(this.minor(v)) === v;
  private needAmount(v: unknown, empty = "Enter an amount."): number {
    if (v === undefined || v === null || v === "") throw new BankError("AMOUNT_REQUIRED", empty);
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) throw new BankError("AMOUNT_REQUIRED", "Enter an amount above zero.");
    if (!this.isAmount(n)) throw new BankError("AMOUNT_DECIMALS", "Use up to 2 decimals.");
    return n;
  }
  /** Writes the entry to the account's activity and to the dashboard's list. `kind` is how the dashboard draws it. */
  private note(a: Account, title: string, category: string, amount: number, kind: Category) {
    this.p.retail?.transactions.unshift({ id: `tx_sv${++this.seq}`, accountId: a.id, date: this.today(), title, category, amount, currency: a.currency, status: "posted" } as AccountTxn);
    this.p.finance?.transactions.unshift({ id: `t_sv${this.seq}`, title, category: kind, amount, daysAgo: 0, time: "Now" });
  }
  private payFrom() {
    const cur = this.cur(), rows = this.p.accounts.filter((a) => a.currency === cur && a.status !== "closing");
    const accounts = Object.fromEntries(rows.map((a) => [a.id, { id: a.id, name: `${nameOf(a)} ${a.maskedNumber}`, sub: a.status === "frozen" ? "Frozen" : `${this.money(spendable(a))} available`, available: spendable(a), status: a.status }]));
    const first = rows.find((a) => a.status === "active" && a.canDebit) ?? rows[0];
    return { accounts, count: rows.length, firstId: first?.id ?? "", defaultId: first?.id ?? "" };
  }

  /* -------------------------------------------------------------------------------------------------- term deposits */

  private deposit(id: unknown): DepositRec {
    const d = this.data.deposits.find((x) => x.id === id);
    if (!d) throw new BankError("DEPOSIT_NOT_FOUND", "We can’t find that deposit.");
    return d;
  }
  private depositView(d: DepositRec) {
    const renewing = d.renewal && d.renewal.instruction !== undefined;
    return {
      id: d.id, name: this.money(d.principal), title: "Term deposit", sub: `${(d.bp / 100).toFixed(2)}% · matures ${dayText(d.maturesOn)}`, principal: d.principal, currency: d.currency, ratePercent: d.bp / 100, termMonths: d.termMonths,
      openedOn: d.openedOn, maturesOn: d.maturesOn, status: "active", autoRenew: !!renewing, accountId: d.accountId, payout: d.payout,
      amountText: this.money(d.principal), rateText: `${(d.bp / 100).toFixed(2)}%`, maturesText: dayText(d.maturesOn), line: `${(d.bp / 100).toFixed(2)}% · matures ${dayText(d.maturesOn)}`,
      renewalMonths: d.renewal?.termMonths ?? 0, renewalText: d.renewal ? `Renews for ${d.renewal.termMonths} months` : "",
    };
  }
  private depositList() { return Object.fromEntries(this.data.deposits.map((d) => [d.id, this.depositView(d)])); }
  /** With `pick: true` a list comes as { items, count, firstId } so a journey can skip the choice when there is one thing to choose and say so when there is none. */
  private pick(items: Record<string, any>, input: Record<string, any>) {
    return input.pick === true ? { items, count: Object.keys(items).length, firstId: Object.keys(items)[0] ?? "" } : items;
  }
  private depositTerms(input: Record<string, any>) {
    const today = this.today();
    const pct = (t: number) => (DEPOSIT.bp[t]! / 100).toFixed(2);
    // the same four terms twice: for a new deposit (with the day each matures) and for a renewal (with the rate only)
    const terms = (sub: (t: number) => string) => Object.fromEntries(DEPOSIT.terms.map((t) => [String(t), { id: String(t), name: `${t} months`, sub: sub(t), months: t, rateText: `${pct(t)}%`, maturesText: dayText(addMonths(today, t)) }]));
    return { terms: terms((t) => `Matures ${dayText(addMonths(today, t))} · ${pct(t)}% a year`), renewTerms: terms((t) => `Rate ${pct(t)}% a year`), allowMonthly: input.allowMonthly !== false };
  }
  private termOf(v: unknown): number {
    const t = Number(v);
    if (this.f.depositTerm !== false && !DEPOSIT.terms.includes(t)) throw new BankError("TERM_INVALID", "Choose a term.");
    return t;
  }
  private depositSum(amount: number, term: number, payout: unknown, allowMonthly: boolean) {
    const monthly = payout === "monthly";
    if (this.f.depositTerm !== false && payout !== undefined && payout !== "maturity" && payout !== "monthly") throw new BankError("PAYOUT_INVALID", "Choose when interest is paid.");
    if (this.f.depositTerm !== false && monthly && !allowMonthly) throw new BankError("PAYOUT_OFF", "Interest paid every month isn’t available.");
    const bp = DEPOSIT.bp[term] ?? DEPOSIT.bp[12]!, am = this.minor(amount), interest = mdiv(am * bp, term, 120_000), matures = addMonths(this.today(), term);
    const receive = monthly ? am : am + interest;
    return {
      amount, amountText: this.money(amount), term, termText: `${term} months`, rate: bp / 100, rateText: `${(bp / 100).toFixed(2)}% a year`, interest: this.major(interest), interestText: this.money(this.major(interest)),
      matures, maturesText: dayText(matures), receive: this.major(receive), receiveText: this.money(this.major(receive)), payout: monthly ? "monthly" : "maturity", payoutText: monthly ? "Every month" : "At maturity", bp,
      resultText: `${this.money(amount)} is earning ${(bp / 100).toFixed(2)}% for ${term} months.`,
    };
  }
  private depositCheck(input: Record<string, any>) {
    const amount = this.needAmount(input.amount);
    if (this.f.depositRange !== false) {
      if (amount < DEPOSIT.min) throw new BankError("BELOW_MINIMUM", `The smallest deposit is ${this.money(DEPOSIT.min)}.`);
      if (amount > DEPOSIT.max) throw new BankError("ABOVE_MAXIMUM", `The largest deposit is ${this.money(DEPOSIT.max)}.`);
    }
    const term = this.termOf(input.term), sum = this.depositSum(amount, term, input.payout, input.allowMonthly !== false);
    const from = input.fromAccountId === undefined ? undefined : this.payer(input.fromAccountId, amount);
    return { sum, from };
  }
  private depositQuote(input: Record<string, any>) {
    const { sum, from } = this.depositCheck(input);
    return { ...sum, from: from ? `${nameOf(from)} ${from.maskedNumber}` : "" };
  }
  private depositOpen(input: Record<string, any>) {
    const { sum, from } = this.depositCheck({ ...input, fromAccountId: input.fromAccountId ?? "" });
    const acc = from!;
    if (input.dryRun === true) return { ...sum, from: `${nameOf(acc)} ${acc.maskedNumber}` };
    if (this.f.depositCode !== false) this.ensureOtp();
    debit(acc, sum.amount);
    const id = this.newId("td", this.data.deposits);
    this.data.deposits.push({ id, principal: sum.amount, currency: acc.currency, bp: sum.bp, termMonths: sum.term, openedOn: this.today(), maturesOn: sum.matures, payout: sum.payout as "maturity" | "monthly", accountId: acc.id });
    this.note(acc, "Term deposit", "Savings", -sum.amount, "investing");
    this.spent();
    return { ...sum, depositId: id, reference: this.ref("TD"), from: `${nameOf(acc)} ${acc.maskedNumber}` };
  }
  private depositRenew(input: Record<string, any>) {
    const d = this.deposit(input.depositId), term = this.termOf(input.term), instruction = String(input.instruction ?? "renew");
    if (this.f.depositTerm !== false && !(instruction in INSTRUCTIONS)) throw new BankError("INSTRUCTION_INVALID", "Choose what happens at maturity.");
    const bp = DEPOSIT.bp[term] ?? d.bp;
    const out = {
      depositId: d.id, depositText: `${this.money(d.principal)} · ${(d.bp / 100).toFixed(2)}% · matures ${dayText(d.maturesOn)}`, termText: `${term} months`, term, rateText: `${(bp / 100).toFixed(2)}% a year`, instructionText: INSTRUCTIONS[instruction] ?? instruction,
      instruction, effectText: dayText(d.maturesOn), maturesText: dayText(d.maturesOn),
      renewsText: instruction === "payout" ? `It will be paid out on ${dayText(d.maturesOn)}.` : `It renews for ${term} months on ${dayText(d.maturesOn)}.`,
    };
    if (input.dryRun === true) return out;
    if (this.f.depositCode !== false) this.ensureOtp();
    // renewing changes what happens at maturity only: no money moves
    d.renewal = instruction === "payout" ? undefined : { termMonths: term, bp, instruction: instruction as "renew" | "renew-payout" };
    this.spent();
    return { ...out, reference: this.ref("TD") };
  }
  private closeQuote(input: Record<string, any>) {
    const d = this.deposit(input.depositId);
    if (this.f.depositEarly !== false && input.earlyClose === false) throw new BankError("EARLY_CLOSE_OFF", "This deposit can’t be closed early.");
    const days = daysBetween(d.openedOn, this.today()), pm = this.minor(d.principal);
    const earned = mdiv(pm * d.bp, days, 10_000 * 365);
    // half the interest earned so far, taken from the rounded interest; the money paid in is never touched
    const charge = this.f.depositCharge !== false ? Math.floor((earned * DEPOSIT.earlyChargePercent + 50) / 100) : 0;
    const net = pm + earned - charge;
    return {
      depositId: d.id, principal: d.principal, depositText: this.money(d.principal), days, earned: this.major(earned), earnedText: this.money(this.major(earned)), charge: this.major(charge), chargeText: `-${this.money(this.major(charge))}`,
      net: this.major(net), netText: this.money(this.major(net)),
    };
  }
  private depositClose(input: Record<string, any>) {
    const q = this.closeQuote(input), d = this.deposit(input.depositId), to = this.receiver(input.toAccountId);
    if (this.f.depositCode !== false) this.ensureOtp();
    credit(to, q.net);
    this.data.deposits.splice(this.data.deposits.indexOf(d), 1);
    this.note(to, "Term deposit closed", "Savings", q.net, "income");
    this.spent();
    return { ...q, reference: this.ref("TD"), paidInto: `${nameOf(to)} ${to.maskedNumber}` };
  }

  /* --------------------------------------------------------------------------------------------------- savings goals */

  private goal(id: unknown): GoalRec {
    const g = this.data.goals.find((x) => x.id === id);
    if (!g) throw new BankError("GOAL_NOT_FOUND", "We can’t find that goal.");
    return g;
  }
  private nextFirst = () => { const d = new Date(this.now()); return iso(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)); };
  private goalView(g: GoalRec) {
    const reached = this.minor(g.saved) >= this.minor(g.target), pct = Math.min(100, Math.floor((this.minor(g.saved) * 100) / this.minor(g.target)));
    const auto = g.auto ? `${this.money(g.auto.amount)} a month` : "";
    return {
      id: g.id, name: g.name, sub: `${this.money(g.saved)} of ${this.money(g.target)}`, target: g.target, saved: g.saved, currency: g.currency, targetDate: g.targetDate, accountId: g.auto?.fromAccountId ?? "",
      savedText: this.money(g.saved), targetText: this.money(g.target), ofText: `of ${this.money(g.target)}`, pct, pctText: `${pct}% saved`, reached,
      byText: reached ? "Goal reached" : `By ${dayText(g.targetDate)}`, line: `${reached ? "Goal reached" : `By ${dayText(g.targetDate)}`}${auto ? ` · ${auto}` : ""}`,
      autoOn: !!g.auto, autoAmount: g.auto?.amount ?? 0, autoFrom: g.auto?.fromAccountId ?? "", autoText: auto,
    };
  }
  private goalList() { return Object.fromEntries(this.data.goals.map((g) => [g.id, this.goalView(g)])); }
  /** The next 36 month ends, starting with next month. */
  private monthList(): { id: string; name: string }[] {
    const d = new Date(this.now());
    return Array.from({ length: GOAL.months }, (_, i) => { const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1 + i, t = new Date(Date.UTC(y, m, 1)); return { id: monthEnd(t.getUTCFullYear(), t.getUTCMonth()), name: `${MONTH_NAMES[t.getUTCMonth()]} ${t.getUTCFullYear()}` }; });
  }
  private goalMonths() { return { months: Object.fromEntries(this.monthList().map((m) => [m.id, { id: m.id, name: m.name }])) }; }
  /** What it takes to reach `target` by `date`: the months left count this month, so 2,000 by June 2027 from 3 Nov 2026 is 8 months of 250. */
  private goalPlan(input: Record<string, any>) {
    const target = this.needAmount(input.target), date = String(input.date ?? ""), saved = Number(input.saved ?? 0);
    const now = new Date(this.now()), end = new Date(at(date));
    const months = (end.getUTCFullYear() - now.getUTCFullYear()) * 12 + (end.getUTCMonth() - now.getUTCMonth()) + 1;
    const remaining = Math.max(0, this.minor(target) - this.minor(Number.isFinite(saved) ? saved : 0));
    const monthly = months > 0 ? Math.ceil(remaining / months) : remaining;
    return {
      months, remaining: this.major(remaining), monthly: this.major(monthly), monthlyText: `${this.money(this.major(monthly))} a month`, byText: dayText(date), line: `To get there by ${dayText(date)}`,
      suggested: this.major(Math.max(monthly, this.minor(GOAL.autoMin))), reachedAlready: remaining === 0,
    };
  }
  private goalSave(input: Record<string, any>, editing: boolean) {
    const g = editing ? this.goal(input.goalId) : undefined;
    if (!editing && this.f.goalLimit !== false && this.data.goals.length >= GOAL.max) throw new BankError("GOAL_LIMIT", "You can have up to 10 goals. Close one to add another.");
    const name = String(input.name ?? "").trim();
    if (this.f.goalRules !== false && (name.length < GOAL.nameMin || name.length > GOAL.nameMax)) throw new BankError("NAME_INVALID", "Use 2 to 30 characters.");
    const target = this.needAmount(input.target, "Enter a target amount.");
    if (this.f.goalRules !== false) {
      if (target < GOAL.targetMin) throw new BankError("TARGET_BELOW", `The smallest target is ${this.money(GOAL.targetMin)}.`);
      if (target > GOAL.targetMax) throw new BankError("TARGET_ABOVE", `The largest target is ${this.money(GOAL.targetMax)}.`);
    }
    const date = String(input.date ?? "");
    if (this.f.goalRules !== false) {
      if (!date) throw new BankError("DATE_REQUIRED", "This is required.");
      if (!this.monthList().some((m) => m.id === date) && g?.targetDate !== date) throw new BankError("DATE_INVALID", "Choose a month from the list.");
    }
    const flat = input.auto ?? {}, on = (flat.on ?? input.autoOn) === true, amountIn = flat.amount ?? input.autoAmount, from = flat.fromAccountId ?? input.fromAccountId;
    let auto: GoalRec["auto"];
    if (on) {
      if (input.allowAuto === false) throw new BankError("AUTO_OFF", "Automatic top-ups aren’t available.");
      if (amountIn === undefined || amountIn === null || amountIn === "") throw new BankError("AUTO_REQUIRED", "Enter a monthly amount.");
      const am = this.needAmount(amountIn, "Enter a monthly amount.");
      if (this.f.goalRules !== false && am < GOAL.autoMin) throw new BankError("AUTO_BELOW", `The smallest amount is ${this.money(GOAL.autoMin)}.`);
      const acc = this.account(from);
      auto = { fromAccountId: acc.id, amount: am };
    }
    const summary = { name, targetText: this.money(target), byText: dayText(date || this.today()), autoText: auto ? `${this.money(auto.amount)} from ${nameOf(this.account(auto.fromAccountId))}` : "Off" };
    if (input.dryRun === true) return { ok: true, ...summary };
    if (g) { g.name = name; g.target = target; g.targetDate = date; g.auto = auto; return { goalId: g.id, ...summary, reference: this.ref("GL") }; }
    const id = this.newId("g", this.data.goals);
    this.data.goals.push({ id, name, target, saved: 0, currency: this.cur(), targetDate: date, auto });
    return { goalId: id, ...summary, reference: this.ref("GL") };
  }
  private goalMove(input: Record<string, any>, into: boolean) {
    const g = this.goal(input.goalId);
    if (into) {
      const amount = this.needAmount(input.amount);
      if (this.f.goalAmounts !== false && amount < GOAL.contributeMin) throw new BankError("AMOUNT_BELOW", `The smallest amount is ${this.money(GOAL.contributeMin)}.`);
      return { g, amount };
    }
    if (input.allowWithdraw === false && this.f.withdrawOff !== false) throw new BankError("WITHDRAW_OFF", "Taking money out isn’t available.");
    const amount = this.needAmount(input.amount);
    if (this.f.goalAmounts !== false) {
      if (amount < GOAL.contributeMin) throw new BankError("AMOUNT_BELOW", `The smallest amount is ${this.money(GOAL.contributeMin)}.`);
      if (this.minor(amount) > this.minor(g.saved)) throw new BankError("ABOVE_SAVED", `You only have ${this.money(g.saved)} in this goal.`);
    }
    return { g, amount };
  }
  private goalContribute(input: Record<string, any>) {
    const { g, amount } = this.goalMove(input, true), from = this.payer(input.fromAccountId, amount);
    debit(from, amount);
    g.saved = this.major(this.minor(g.saved) + this.minor(amount));
    this.note(from, `To goal: ${g.name}`, "Savings", -amount, "investing");
    const v = this.goalView(g);
    return {
      saved: g.saved, goalName: g.name, amountText: this.money(amount), fromName: `${nameOf(from)} ${from.maskedNumber}`, savedText: `${this.money(g.saved)} of ${this.money(g.target)}`, reached: v.reached,
      reachedText: v.reached ? `${g.name} has reached its target.` : "", reference: this.ref("GL"),
    };
  }
  private goalWithdraw(input: Record<string, any>) {
    const { g, amount } = this.goalMove(input, false), to = this.receiver(input.toAccountId);
    g.saved = this.major(this.minor(g.saved) - this.minor(amount));
    credit(to, amount);
    this.note(to, `From goal: ${g.name}`, "Savings", amount, "income");
    return { saved: g.saved, goalName: g.name, amountText: this.money(amount), intoName: `${nameOf(to)} ${to.maskedNumber}`, savedText: `${this.money(g.saved)} of ${this.money(g.target)}`, reference: this.ref("GL") };
  }
  /** The monthly top-ups of the goals, as a list of scheduled payments ("Goal: Holiday fund", "Monthly · 1 Dec"). */
  private scheduled() {
    const next = this.nextFirst();
    return Object.fromEntries(this.data.goals.filter((g) => g.auto).map((g) => [`goal:${g.id}`, {
      id: `goal:${g.id}`, name: `Goal: ${g.name}`, kind: "goal", goalId: g.id, amount: g.auto!.amount, amountText: this.money(g.auto!.amount), fromAccountId: g.auto!.fromAccountId, nextOn: next, nextText: dayText(next), sub: `Monthly · ${dayMonth(next)}`,
    }]));
  }

  /* ------------------------------------------------------------------------------------------------------------- loans */

  private loan(id: unknown): LoanRec {
    const l = this.data.loans.find((x) => x.id === id);
    if (!l) throw new BankError("LOAN_NOT_FOUND", "We can’t find that loan.");
    return l;
  }
  /** The equal monthly payment, in minor units: the one place a float is used, rounded to cents at once. */
  private annuity(principalMinor: number, bp: number, n: number) {
    const i = bp / 120_000;
    return Math.round((principalMinor * i) / (1 - (1 + i) ** -n));
  }
  private loanFacts(l: LoanRec) {
    const bal = this.minor(l.outstanding), interest = mdiv(bal, l.bp, 120_000), inst = this.minor(l.instalment);
    const next = Math.min(inst, bal + interest);
    return { bal, interest, next, principal: next - interest };
  }
  private loanView(l: LoanRec) {
    const f = this.loanFacts(l), pct = Math.round(((l.original - l.outstanding) * 100) / l.original);
    return {
      id: l.id, name: l.name, sub: `${this.money(l.outstanding)} left · next payment ${dayText(l.nextDue)}`, principal: l.original, original: l.original, outstanding: l.outstanding, currency: l.currency, ratePercent: l.bp / 100, monthlyPayment: l.instalment, nextDue: l.nextDue,
      lastPaid: l.lastPaid, paymentsLeft: l.paymentsLeft, termMonths: l.termMonths, accountId: l.accountId, leftText: `${this.money(l.outstanding)} left`, pct, pctText: `${pct}% repaid`,
      nextAmount: this.major(f.next), nextAmountText: this.money(this.major(f.next)), nextDueText: dayText(l.nextDue), nextText: `Next payment ${this.money(this.major(f.next))} on ${dayText(l.nextDue)}`,
    };
  }
  private loanList() { return Object.fromEntries(this.data.loans.map((l) => [l.id, this.loanView(l)])); }
  private settlement(l: LoanRec, feeOn: boolean) {
    const bal = this.minor(l.outstanding), interest = this.f.settleInterest !== false ? mdiv(bal * l.bp, daysBetween(l.lastPaid, this.today()), 10_000 * 365) : 0;
    const fee = (this.f.settleFee !== false ? feeOn && l.paymentsLeft > REPAY.settleFeeAbove : true) ? mdiv(bal, REPAY.settleFeePercent, 100) : 0;
    const total = bal + interest + fee;
    return {
      loanId: l.id, balance: l.outstanding, balanceText: this.money(l.outstanding), interest: this.major(interest), interestText: this.money(this.major(interest)), fee: this.major(fee), feeText: this.money(this.major(fee)), total: this.major(total), totalText: this.money(this.major(total)),
      sub: fee > 0 ? `Includes a ${this.money(this.major(fee))} early settlement fee` : "No early settlement fee",
    };
  }
  /** One loan with what the three ways to pay it cost: the card of each way reads this. */
  private loanDetail(input: Record<string, any>) {
    const l = this.loan(input.loanId), v = this.loanView(l), f = this.loanFacts(l);
    return { ...v, interestText: this.money(this.major(f.interest)), principalText: this.money(this.major(f.principal)), nextSub: `Due ${dayText(l.nextDue)}`, settle: this.settlement(l, input.settleFee !== false) };
  }
  private rateFor(term: number) { return LOAN.bp[term] ?? LOAN.bp[36]!; }
  private loanCheck(input: Record<string, any>) {
    if (this.f.loanLimit !== false && this.data.loans.length >= LOAN.maxLoans) throw new BankError("LOAN_LIMIT", "You already have the maximum number of loans.");
    const amount = this.needAmount(input.amount, "Enter an amount."), term = Number(input.term);
    if (this.f.loanRange !== false) {
      if (amount < LOAN.min || amount > LOAN.max) throw new BankError("AMOUNT_RANGE", `Choose an amount from ${this.money(LOAN.min)} to ${this.money(LOAN.max)}.`);
      if (this.minor(amount) % this.minor(LOAN.step) !== 0) throw new BankError("AMOUNT_STEP", `Choose an amount in steps of ${this.money(LOAN.step)}.`);
      if (!LOAN.terms.includes(term)) throw new BankError("TERM_INVALID", "Choose a term.");
    }
    return { amount, term };
  }
  /** Without an amount: the table of rates and what $1 costs each month at each (a screen multiplies it to show the payment as the amount changes). With one: the checks of the first screen. */
  private loanQuote(input: Record<string, any>) {
    const rates = Object.fromEntries(LOAN.terms.map((t) => [String(t), { id: String(t), term: t, name: `${t} months`, rate: this.rateFor(t) / 100, factor: this.annuity(1_000_000_000_000, this.rateFor(t), t) / 1_000_000_000_000 }]));
    if (input.amount === undefined) return { rates, min: LOAN.min, max: LOAN.max, step: LOAN.step };
    const { amount, term } = this.loanCheck(input), bp = this.rateFor(term), pay = this.annuity(this.minor(amount), bp, term);
    return { rates, ok: true, amount, term, rate: bp / 100, rateText: `${bpText(bp)}% a year`, payment: this.major(pay), paymentText: this.money(this.major(pay)) };
  }
  private reference = () => this.ref("LA");
  /** The decision, in the order of the credit policy. A refusal or a referral keeps nothing but its reference; an approval keeps the offer the loan is made from. */
  private eligibility(input: Record<string, any>) {
    const { amount, term } = this.loanCheck(input);
    const purpose = String(input.purpose ?? ""), employment = String(input.employment ?? "");
    if (!LOAN.purposes.includes(purpose)) throw new BankError("PURPOSE_INVALID", "Choose what the loan is for.");
    if (!LOAN.employment.includes(employment)) throw new BankError("EMPLOYMENT_INVALID", "Choose your employment status.");
    const income = Number(input.income), commitments = Number(input.commitments ?? 0);
    if (!Number.isFinite(income) || income <= 0 || income > LOAN.incomeMax || !this.isAmount(income)) throw new BankError("INCOME_INVALID", income > LOAN.incomeMax ? "Check this amount." : "Enter your monthly income.");
    if (!Number.isFinite(commitments) || commitments < 0 || commitments > LOAN.commitmentsMax || !this.isAmount(commitments)) throw new BankError("COMMITMENTS_INVALID", commitments > LOAN.commitmentsMax ? "Check this amount." : "Enter 0 or more.");
    const am = this.minor(amount), inc = this.minor(income), com = this.minor(commitments), baseBp = this.rateFor(term), basePay = this.annuity(am, baseBp, term);
    // the share of income the payments take, compared without dividing: payments * 100 > income * share
    const over = (share: number) => (basePay + com) * 100 > inc * share;
    const decide = (decision: "approved" | "referred" | "declined", reason: string, bp: number) => ({ decision, reason, rate: bp / 100, payment: this.major(this.annuity(am, bp, term)), ratio: Math.round(((basePay + com) * 1000) / inc) / 10, reference: this.reference() });
    if (this.f.loanIncome !== false && (employment === "Student" || employment === "Not working" || income < LOAN.incomeFloor)) return decide("declined", "income", baseBp);
    if (this.f.loanAffordability !== false && over(LOAN.refuse.affordability)) return decide("declined", "affordability", baseBp);
    const refer = amount > LOAN.incomeMultiple * income || (employment === "Self-employed" && amount > LOAN.selfEmployedAbove) || (employment === "Retired" && amount > LOAN.retiredAbove) || over(LOAN.refuse.referral);
    if (this.f.loanReferral !== false && refer) return decide(input.allowReferral === false ? "declined" : "referred", input.allowReferral === false ? "affordability" : "review", baseBp);
    const bp = baseBp + (this.f.loanRateRise !== false && over(LOAN.refuse.rise) ? LOAN.riseBp : 0), pay = this.annuity(am, bp, term), fee = input.arrFee !== false ? mdiv(am, LOAN.feePercent, 100) : 0;
    this.offer = { amount, term, bp, payment: pay, purpose, fee: fee > 0 };
    const interest = pay * term - am, first = addMonths(this.today(), 1);
    return {
      ...decide("approved", "", bp), offer: {
        loanText: this.money(amount), termText: `${term} months`, rateText: `${bpText(bp)}% a year`, paymentText: this.money(this.major(pay)), interestText: this.money(this.major(interest)), fee: this.major(fee), feeText: this.money(this.major(fee)),
        totalText: this.money(this.major(pay * term + fee)), firstText: dayText(first), payoutText: this.money(this.major(am - fee)),
      },
    };
  }
  private loanApply(input: Record<string, any>) {
    if (this.f.loanLimit !== false && this.data.loans.length >= LOAN.maxLoans) throw new BankError("LOAN_LIMIT", "You already have the maximum number of loans.");
    const o = this.offer, accountId = input.accountId;
    // only what the bank approved can be made: the figures must be the offer's own
    if (this.f.loanOffer !== false && (!o || Number(input.amount) !== o.amount || Number(input.term) !== o.term || Math.round(Number(input.rate) * 100) !== o.bp)) throw new BankError("OFFER_NOT_FOUND", "We can’t find that offer. Check your application again.");
    const offer = o ?? { amount: Number(input.amount), term: Number(input.term), bp: Math.round(Number(input.rate) * 100), payment: this.annuity(this.minor(Number(input.amount)), Math.round(Number(input.rate) * 100), Number(input.term)), purpose: String(input.purpose ?? "Other"), fee: input.arrFee !== false };
    const to = this.receiver(accountId);
    if (this.f.loanCode !== false) this.ensureOtp();
    const am = this.minor(offer.amount), fee = offer.fee ? mdiv(am, LOAN.feePercent, 100) : 0;
    credit(to, this.major(am - fee));
    const id = this.newId("ln", this.data.loans), first = addMonths(this.today(), 1);
    this.data.loans.push({ id, name: `${offer.purpose} loan`, original: offer.amount, outstanding: offer.amount, currency: this.cur(), bp: offer.bp, instalment: this.major(offer.payment), termMonths: offer.term, paymentsLeft: offer.term, lastPaid: this.today(), nextDue: first, accountId: to.id });
    this.note(to, "Loan paid out", "Loans", this.major(am - fee), "income");
    this.offer = undefined;
    this.spent();
    return {
      loanId: id, reference: this.ref("LN"), name: `${offer.purpose} loan`, paidIntoText: `${nameOf(to)} ${to.maskedNumber}`, rateText: `${bpText(offer.bp)}% a year`, paymentText: this.money(this.major(offer.payment)),
      feeText: this.money(this.major(fee)), fee: this.major(fee), firstText: dayText(first), paidOutText: this.money(this.major(am - fee)),
    };
  }
  private repay(input: Record<string, any>) {
    const l = this.loan(input.loanId), f = this.loanFacts(l), option = String(input.option ?? "next");
    if (option !== "next" && option !== "custom") throw new BankError("OPTION_INVALID", "Choose how much to pay.");
    let pay: number, principal: number, oneInstalment: boolean;
    if (option === "next") { pay = f.next; principal = this.f.repayPrincipal !== false ? f.principal : f.next; oneInstalment = true; }
    else {
      const amount = this.needAmount(input.amount), am = this.minor(amount);
      if (this.f.repayRange !== false) {
        if (am < this.minor(REPAY.customMin)) throw new BankError("REPAY_BELOW", `The smallest payment is ${this.money(REPAY.customMin)}.`);
        if (am >= f.bal) throw new BankError("REPAY_ABOVE", "To pay everything off, choose Settle in full.");
      }
      pay = am; principal = am; oneInstalment = am >= this.minor(l.instalment);
    }
    const from = this.payer(input.fromAccountId, this.major(pay)), after = f.bal - principal;
    const out = {
      loanId: l.id, loanName: l.name, fromName: `${nameOf(from)} ${from.maskedNumber}`, paid: this.major(pay), paidText: this.money(this.major(pay)), balance: this.major(after), balanceText: this.money(this.major(after)),
      next: after > 0 ? dayText(this.f.repayDate !== false && !oneInstalment ? l.nextDue : addMonths(l.nextDue, 1)) : "",
    };
    if (input.dryRun === true) return out;
    if (this.f.repayCode !== false) this.ensureOtp();
    debit(from, this.major(pay));
    l.outstanding = this.major(after);
    l.lastPaid = this.today();
    if (this.f.repayDate !== false ? oneInstalment : true) { l.nextDue = addMonths(l.nextDue, 1); l.paymentsLeft = Math.max(0, l.paymentsLeft - 1); }
    this.note(from, `Loan payment: ${l.name}`, "Loans", -this.major(pay), "bills");
    if (after <= 0) this.data.loans.splice(this.data.loans.indexOf(l), 1);
    this.spent();
    const nextDue = after > 0 ? dayText(l.nextDue) : "";
    return { ...out, next: nextDue, nextText: nextDue ? `Your next payment is ${nextDue}.` : "", resultText: option === "next" ? `Your next payment is ${nextDue}.` : `${this.money(this.major(after))} left to pay.`, reference: this.ref("LR") };
  }
  private settle(input: Record<string, any>) {
    const l = this.loan(input.loanId), s = this.settlement(l, input.settleFee !== false), from = this.payer(input.fromAccountId, s.total);
    const out = { ...s, loanName: l.name, fromName: `${nameOf(from)} ${from.maskedNumber}`, paid: s.total, paidText: s.totalText, after: 0, balanceText: this.money(0) };
    if (input.dryRun === true) return out;
    if (this.f.repayCode !== false) this.ensureOtp();
    debit(from, s.total);
    this.note(from, `Loan payment: ${l.name}`, "Loans", -s.total, "bills");
    this.data.loans.splice(this.data.loans.indexOf(l), 1);
    this.spent();
    return { ...out, reference: this.ref("LR") };
  }

  /* ----------------------------------------------------------------------------------------------------------- funds */

  private fund(id: unknown): Fund {
    const f = FUNDS.find((x) => x.id === id);
    if (!f) throw new BankError("FUND_NOT_FOUND", "We can’t find that investment.");
    return f;
  }
  private fundView(f: Fund) {
    return {
      id: f.id, name: f.name, sub: `${f.about} · from ${this.money(f.min)} · ${(f.chargeBp / 100).toFixed(2)}% a year · ${RISK_TEXT[f.risk]}`, risk: f.risk, riskText: RISK_TEXT[f.risk], charge: f.chargeBp / 100, chargeText: `${(f.chargeBp / 100).toFixed(2)}% a year`,
      min: f.min, minText: this.money(f.min), price: f.price, priceText: `${this.money(f.price)} per unit`, about: f.about,
    };
  }
  private fundList(input: Record<string, any>) {
    const shown = FUNDS.filter((f) => input.allowHigh !== false || f.risk !== "high"), by = (r: string) => Object.fromEntries(shown.filter((f) => !r || f.risk === r).map((f) => [f.id, this.fundView(f)]));
    return { funds: { all: by(""), low: by("low"), medium: by("medium"), high: by("high") }, count: shown.length };
  }
  private valueOf(h: HoldingRec) { const f = this.fund(h.fundId); return this.major(Math.round(h.units * this.minor(f.price))); }
  private holdings() {
    return Object.fromEntries(this.data.holdings.map((h) => {
      const f = this.fund(h.fundId), value = this.valueOf(h);
      return [h.fundId, { id: h.fundId, fundId: h.fundId, name: f.name, units: h.units, unitsText: unitsText(h.units), cost: h.cost, value, valueText: this.money(value), sub: `${unitsText(h.units)} units · ${this.money(value)}`, riskText: RISK_TEXT[f.risk] }];
    }));
  }
  private portfolio() {
    const value = this.data.holdings.reduce((s, h) => s + this.minor(this.valueOf(h)), 0), cost = this.data.holdings.reduce((s, h) => s + this.minor(h.cost), 0), gain = value - cost;
    const pct = cost > 0 ? Math.round((Math.abs(gain) * 1000) / cost) / 10 : 0;
    return {
      count: this.data.holdings.length, value: this.major(value), valueText: this.money(this.major(value)), cost: this.major(cost), gain: this.major(gain), up: gain >= 0,
      gainText: `${gain >= 0 ? "▲" : "▼"} ${this.money(this.major(Math.abs(gain)))} (${pct.toFixed(1)}%) since you invested`,
    };
  }
  private buy(input: Record<string, any>) {
    const f = this.fund(input.fundId);
    if (input.allowHigh === false && f.risk === "high" && this.f.fundHigh !== false) throw new BankError("FUND_CLOSED", "This fund is closed to new money.");
    const amount = this.needAmount(input.amount, "Enter an amount.");
    if (this.f.fundMinimum !== false && amount < f.min) throw new BankError("BELOW_MINIMUM", `The smallest amount for this fund is ${this.money(f.min)}.`);
    const from = this.payer(input.fromAccountId, amount), units = units3(this.minor(amount) / this.minor(f.price)), charge = mdiv(this.minor(amount), f.chargeBp, 10_000);
    const out = {
      fundId: f.id, name: f.name, riskText: RISK_TEXT[f.risk], fromName: `${nameOf(from)} ${from.maskedNumber}`, amountText: this.money(amount), units, unitsText: unitsText(units), price: f.price, priceText: `${this.money(f.price)} per unit`,
      chargeText: `${(f.chargeBp / 100).toFixed(2)}% a year`, chargeAbout: `about ${this.money(this.major(charge))}`,
    };
    if (input.dryRun === true) return out;
    if (this.f.investCode !== false) this.ensureOtp();
    debit(from, amount);
    const held = this.data.holdings.find((h) => h.fundId === f.id);
    if (held) { held.units = units3(held.units + units); held.cost = this.major(this.minor(held.cost) + this.minor(amount)); } else this.data.holdings.push({ fundId: f.id, units, cost: amount });
    this.note(from, `Invested: ${f.name}`, "Investing", -amount, "investing");
    this.spent();
    return { ...out, reference: this.ref("INV") };
  }
  private businessDay(from: number, n: number) {
    let t = at(iso(from)), left = n;
    while (left > 0) { t += DAY; const w = new Date(t).getUTCDay(); if (w !== 0 && w !== 6) left -= 1; }
    return iso(t);
  }
  private sell(input: Record<string, any>) {
    const f = this.fund(input.fundId), held = this.data.holdings.find((h) => h.fundId === f.id);
    if (!held) throw new BankError("NOTHING_TO_SELL", "You don’t hold any of this investment.");
    const value = this.valueOf(held), all = input.all === true;
    const amount = all ? value : this.needAmount(input.amount, "Enter an amount.");
    if (this.f.sellRange !== false && !all) {
      if (amount < SELL.min) throw new BankError("SELL_BELOW", `The smallest sale is ${this.money(SELL.min)}.`);
      if (this.minor(amount) > this.minor(value)) throw new BankError("ABOVE_HOLDING", `You can’t sell more than ${this.money(value)}.`);
    }
    const to = this.receiver(input.toAccountId), fee = input.sellFee !== false && this.f.sellFee !== false ? mdiv(this.minor(amount), SELL.feeBp, 10_000) : 0, proceeds = this.minor(amount) - fee;
    const settles = this.f.sellSettle !== false ? this.businessDay(this.now(), SELL.settleDays) : this.today();
    const out = {
      fundId: f.id, name: f.name, soldText: this.money(amount), fee: this.major(fee), feeText: `-${this.money(this.major(fee))}`, proceeds: this.major(proceeds), proceedsText: this.money(this.major(proceeds)), settlesOn: settles, settlesText: dayText(settles),
      intoName: `${nameOf(to)} ${to.maskedNumber}`, everything: all || this.minor(amount) === this.minor(value),
    };
    if (input.dryRun === true) return out;
    if (this.f.sellCode !== false) this.ensureOtp();
    if (out.everything) this.data.holdings.splice(this.data.holdings.indexOf(held), 1);
    else {
      const sold = units3(this.minor(amount) / this.minor(f.price)), left = units3(held.units - sold);
      held.cost = this.major(Math.round((this.minor(held.cost) * left) / held.units));
      held.units = left;
    }
    credit(to, this.major(proceeds));
    this.note(to, `Sold: ${f.name}`, "Investing", this.major(proceeds), "investing");
    this.spent();
    return { ...out, reference: this.ref("SEL") };
  }

  /* ----------------------------------------------------------------------------------------------------- add money */

  private cardName = (c: { network: string; last4: string }) => `${{ visa: "Visa", mastercard: "Mastercard", amex: "American Express" }[c.network] ?? c.network} ••${c.last4}`;
  private expired = (c: { expiry: string }) => { const [m, y] = c.expiry.split("/").map(Number) as [number, number]; return this.now() > Date.UTC(2000 + y, m, 0, 23, 59, 59); };
  /** The saved cards a top-up can use (the expired ones are listed apart: they cannot be chosen). */
  private topupCards() {
    const cards = this.p.finance?.cards ?? [], usable = cards.filter((c) => !this.expired(c)), gone = cards.filter((c) => this.expired(c));
    return {
      cards: Object.fromEntries(usable.map((c) => [c.id, { id: c.id, name: this.cardName(c), sub: `${c.bank ? `${c.bank} · ` : c.nickname ? `${c.nickname} · ` : ""}expires ${c.expiry}` }])),
      count: usable.length, firstId: usable[0]?.id ?? "", expired: gone.map((c) => `${this.cardName(c)} · Expired`), expiredText: gone.map((c) => `${this.cardName(c)} · Expired`).join(", "), hasExpired: gone.length > 0,
    };
  }
  private topup(input: Record<string, any>) {
    const fin = this.p.finance; if (!fin) throw new BankError("NOT_SUPPORTED", "Not available for this customer");
    if (input.allowCard === false) throw new BankError("CARD_OFF", "Adding money from a card isn’t available.");
    const to = this.account(input.toAccountId), amount = Number(input.amount);
    if (this.f.topupRange !== false) {
      if (!Number.isFinite(amount) || amount < TOPUP.min) throw new BankError("INVALID_AMOUNT", `The smallest amount is ${this.money(TOPUP.min)}.`);
      if (amount > TOPUP.max) throw new BankError("LIMIT_EXCEEDED", `The most you can add at once is ${this.money(TOPUP.max)}.`);
      if (!this.isAmount(amount)) throw new BankError("INVALID_AMOUNT", "Use up to 2 decimals.");
    } else if (!(amount > 0)) throw new BankError("INVALID_AMOUNT", "Enter an amount.");
    const card = fin.cards.find((c) => c.id === input.fromCardId);
    if (!card) throw new BankError("CARD_NOT_FOUND", "Choose a card.");
    if (this.f.topupCard !== false) {
      if (this.expired(card)) throw new BankError("CARD_EXPIRED", "This card has expired. Choose another card.");
      if (card.last4 === TOPUP.declineEnding) throw new BankError("CARD_DECLINED", "Your card was declined. Try another card.");
    }
    if (this.f.topupCvv !== false && !/^[0-9]{3}$/.test(String(input.securityCode ?? ""))) throw new BankError("CVV_INVALID", "Enter the 3 digits on the back of the card.");
    this.receiver(to.id);
    const fee = input.fee !== false && this.f.topupFee !== false ? mdiv(this.minor(amount), TOPUP.feeBp, 10_000) : 0, charged = this.minor(amount) + fee;
    const out = { toName: `${nameOf(to)} ${to.maskedNumber}`, cardName: this.cardName(card), amountText: this.money(amount), fee: this.major(fee), feeText: this.money(this.major(fee)), chargedText: this.money(this.major(charged)) };
    if (input.dryRun === true) return out;
    if (this.f.topupCode !== false) this.ensureOtp();
    credit(to, amount);
    this.note(to, "Card top-up", "Transfer", amount, "income");
    this.spent();
    return { ...out, reference: this.ref("ADD"), newBalance: to.balance };
  }
}
