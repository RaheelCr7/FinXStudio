import { describe, expect, it } from "vitest";
import { MockBank } from "@finx/mock-bank-api";
import type { ContextInfo } from "../session";
import { FIRST_TAB, isTab, menuFor, tabAllowed, tabsOf } from "./menus";
import { noticesFor, unreadCount, type RawNotification } from "./notices";
import { approvalBadge, approvalQueue, businessOverview, personalHome, sumMoney, type RawCorpPayment } from "./widgets";
import { loadScreen, screenIsEmpty } from "./screens";

const ctxs = async () => (await new MockBank("alex").call("bank.session.get")).contexts as ContextInfo[];
const by = async (id: string) => (await ctxs()).find((c) => c.id === id)!;

describe("menus", () => {
  it("Personal has Home, Accounts, Payments, Cards, Save & Borrow, More; Business has Overview, Accounts, Payments, Approvals, Admin, More", async () => {
    expect(menuFor(await by("personal")).map((m) => m.label)).toEqual(["Home", "Accounts", "Payments", "Cards", "Save & Borrow", "More"]);
    expect(menuFor(await by("alpha")).map((m) => m.label)).toEqual(["Overview", "Accounts", "Payments", "Approvals", "Admin", "More"]);
    expect(tabsOf("business")).toEqual(["overview", "accounts", "payments", "approvals", "admin", "more"]);
    expect(FIRST_TAB).toEqual({ personal: "home", business: "overview" });
    expect(isTab("personal", "cards")).toBe(true);
    expect(isTab("business", "cards")).toBe(false);
  });
  it("marks what the permissions do not allow: Admin is closed to Alex the Maker at Alpha, and open at Beta only for the audit trail", async () => {
    const alpha = menuFor(await by("alpha")), beta = menuFor(await by("beta"));
    expect(alpha.find((x) => x.id === "admin")!.allowed).toBe(false);
    expect(alpha.filter((x) => x.id !== "admin").every((x) => x.allowed)).toBe(true);
    expect(beta.every((x) => x.allowed)).toBe(true);
    expect(tabAllowed(await by("alpha"), "admin")).toBe(false);
    expect(tabAllowed(await by("beta"), "approvals")).toBe(true);
  });
  it("allows a tab when any one of its permissions is held, and shows the approvals badge only when there is something to act on", async () => {
    const alpha = await by("alpha");
    const admin = { ...alpha, permissions: [...alpha.permissions, "biz.admin.limits"] };
    expect(menuFor(admin).find((m) => m.id === "admin")!.allowed).toBe(true);
    expect(menuFor(alpha, { approvals: 2 }).find((m) => m.id === "approvals")!.badge).toBe(2);
    expect(menuFor(alpha, { approvals: 0 }).find((m) => m.id === "approvals")!.badge).toBeUndefined();
    expect(menuFor(undefined)).toEqual([]);
  });
});

describe("notifications", () => {
  const raw: RawNotification[] = [
    { id: "n_1", context: "beta", text: "Payment awaiting your approval: USD 8,200.00 to Nimbus Logistics", at: "2026-11-03T09:12:00Z", read: false },
    { id: "n_2", context: "personal", text: "Salary received: $4,200.00", at: "2026-11-01T06:00:00Z", read: true },
    { id: "n_3", context: "alpha", text: "Payment PAY-1187 settled", at: "2026-10-30T14:00:00Z", read: false },
  ];
  it("shows the active place in full and other places only as a pointer, with no company detail", async () => {
    const contexts = await ctxs();
    const inPersonal = noticesFor(raw, contexts, "personal");
    expect(inPersonal.map((n) => n.id)).toEqual(["n_1", "n_2", "n_3"]); // newest first
    expect(inPersonal[1]!.text).toContain("Salary");
    const beta = inPersonal[0]!;
    expect(beta).toMatchObject({ text: "New activity", from: "Beta Services Ltd" });
    expect(JSON.stringify(inPersonal.filter((n) => n.context !== "personal"))).not.toMatch(/Nimbus|8,200|PAY-1187/);
    expect(noticesFor(raw, contexts, "beta")[0]!.text).toContain("Nimbus");
  });
  it("tags each with where it leads: a company notice leads to that company's place, which means switching first", async () => {
    const n = noticesFor(raw, await ctxs(), "personal");
    expect(n[0]!.link).toEqual({ workspace: "business", companyId: "beta", tab: "approvals" });
    expect(n[1]!.link).toEqual({ workspace: "personal", tab: "accounts" });
  });
  it("counts unread, per place, and treats opened ones as read", async () => {
    const contexts = await ctxs();
    const n = noticesFor(raw, contexts, "personal");
    expect(unreadCount(n)).toBe(2);
    expect(unreadCount(n, "beta")).toBe(1);
    expect(unreadCount(noticesFor(raw, contexts, "personal", new Set(["n_1"])))).toBe(1);
  });
});

describe("widgets", () => {
  it("adds money through minor units, not floats", () => {
    expect(sumMoney([0.1, 0.2], "USD")).toBe(0.3);
    expect(sumMoney([1000, 0.5], "JPY")).toBe(1001);
    expect(sumMoney([1.005, 2], "KWD")).toBe(3.005);
  });
  it("builds the Personal home: main currency total, other currencies kept apart, budgets with progress", () => {
    const h = personalHome({
      accounts: [{ id: "a", name: "Main", maskedNumber: "••1", balance: 8720.76, currency: "USD" }, { id: "b", name: "Savings", maskedNumber: "••2", balance: 15254.37, currency: "USD" }, { id: "c", name: "EUR", maskedNumber: "••3", balance: 2400, currency: "EUR" }],
      budgets: [{ id: "b1", name: "Food", category: "food", limit: 1500, spent: 525 }, { id: "b2", name: "Fun", category: "fun", limit: 300, spent: 330 }],
    });
    expect(h.hero).toEqual({ currency: "USD", total: "$23,975.13", label: "Total balance", others: [{ label: "EUR", value: "€2,400" }] });
    expect(h.insights.map((i) => [i.pct, i.over])).toEqual([[35, false], [100, true]]);
    expect(personalHome({ accounts: [] }).accounts).toEqual([]);
  });
  const pay = (over: Partial<RawCorpPayment>): RawCorpPayment => ({ id: "P", payee: "Nimbus", amount: 8200, currency: "USD", status: "pending_approval", initiatedBy: "priya", initiatedAt: "2026-11-03T09:00:00Z", required: 2, approvals: [], ...over });
  it("builds the approvals queue: nobody is offered what they started or already approved, and finished payments do not appear", () => {
    const q = approvalQueue([pay({ id: "own", initiatedBy: "alex" }), pay({ id: "done", approvals: [{ userId: "alex", at: "x" }] }), pay({ id: "open" }), pay({ id: "paid", status: "released" })], "alex", true);
    expect(q.map((i) => [i.id, i.approvable, i.own])).toEqual([["own", false, true], ["done", false, false], ["open", true, false]]);
    expect(approvalBadge(q)).toBe(1);
    expect(approvalBadge(approvalQueue([pay({})], "alex", false))).toBe(0); // a Maker is not asked to approve
    expect(q[2]!.progress).toBe("0 of 2");
  });
  it("keeps company currencies apart in the Business overview", () => {
    const o = businessOverview({ currency: "USD", cutoff: "15:00", queue: [], accounts: [{ id: "o", name: "Operating", maskedNumber: "••1", currency: "USD", balance: 480000 }, { id: "r", name: "Reserve", maskedNumber: "••2", currency: "EUR", balance: 95200 }], me: { dailyLimit: 250000, usedToday: 18900 } });
    expect(o.total).toBe("$480,000");
    expect(o.others).toEqual([{ label: "EUR", value: "€95,200" }]);
    expect(o.limit).toEqual({ used: "$18,900", daily: "$250,000", pct: 8 });
  });
});

describe("the tab screens, from the sandbox", () => {
  const sandbox = async (company?: "alpha" | "beta") => {
    const b = new MockBank("alex");
    if (company) { await b.call("bank.otp.send"); await b.call("bank.session.stepUp", { method: "password", secret: "Bwx!Demo2026" }).catch(() => undefined); await b.call("bank.otp.verify", { code: "000000" }); await b.call("bank.session.stepUp", { method: "password", secret: "Bwx!Demo2026" }); await b.call("bank.session.switch", { contextId: company }); }
    const contexts = (await b.call("bank.session.get")).contexts as ContextInfo[];
    const call = (id: string, input?: Record<string, any>) => b.call(id, input);
    return { call, ctx: (id: string) => contexts.find((c) => c.id === id)!, b };
  };
  it("draws every Personal tab with data", async () => {
    const { call, ctx } = await sandbox();
    for (const tab of tabsOf("personal")) {
      const s = await loadScreen(call, ctx("personal"), tab);
      expect(s.sections.length, tab).toBeGreaterThan(0);
      expect(screenIsEmpty(s), tab).toBe(false);
    }
    const home = await loadScreen(call, ctx("personal"), "home");
    expect(home.hero!.value).toBe("$23,975.13");
    expect(home.sections[0]!.rows.map((r) => r.title)).toEqual(["Main", "Savings", "EUR Travel", "AED Home"]);
    const cards = await loadScreen(call, ctx("personal"), "cards");
    expect(cards.sections[0]!.rows[0]).toMatchObject({ place: "cards.card", passes: { cardId: "card_debit" } });
  });
  it("puts no payment scheme names or codes on any screen (the owner's journey design rules)", async () => {
    const SCHEMES = /SWIFT|IBAN|\bACH\b|SEPA|sort code|\bABA\b|UETR|CHAPS|SARIE|Faster Payments/i;
    const personal = await sandbox();
    for (const tab of tabsOf("personal")) expect(JSON.stringify(await loadScreen(personal.call, personal.ctx("personal"), tab)), tab).not.toMatch(SCHEMES);
    for (const id of ["alpha", "beta"] as const) {
      const biz = await sandbox(id);
      for (const tab of tabsOf("business")) expect(JSON.stringify(await loadScreen(biz.call, biz.ctx(id), tab)), `${id} ${tab}`).not.toMatch(SCHEMES);
    }
  });
  it("shows an empty section as empty, not as missing", async () => {
    const { call, ctx, b } = await sandbox();
    b.conditions = { ...b.conditions, empty: ["bank.schedules.list"] } as typeof b.conditions;
    const pay = await loadScreen(call, ctx("personal"), "payments");
    expect(pay.sections.find((s) => s.id === "scheduled")).toMatchObject({ rows: [], empty: "Nothing scheduled" });
  });
  it("draws Alpha as Maker: balances, no approvals to act on, own payment shown as theirs", async () => {
    const { call, ctx } = await sandbox("alpha");
    const o = await loadScreen(call, ctx("alpha"), "overview");
    expect(o.hero!.value).toBe("$480,000");
    expect(o.approvals).toBe(0);
    expect(o.sections.find((s) => s.id === "approvals")!.rows[0]).toMatchObject({ id: "PAY-2040", tag: "Yours" });
    expect(JSON.stringify(o)).not.toMatch(/Beta Services|Nimbus/);
  });
  it("draws Beta as Approver with the queue Alex can act on, and nothing of Alpha", async () => {
    const { call, ctx } = await sandbox("beta");
    const a = await loadScreen(call, ctx("beta"), "approvals");
    expect(a.sections[0]!.rows.map((r) => r.id)).toEqual(["PAY-2039", "PAY-2041"]);
    expect(a.approvals).toBe(2);
    expect(JSON.stringify(a)).not.toMatch(/Alpha|Harbour/);
    const admin = await loadScreen(call, ctx("beta"), "admin");
    // an Approver reads the audit trail but holds no user or group permission: nothing is asked of the bank for those
    expect(admin.sections.find((s) => s.id === "users")!.rows).toEqual([]);
    expect(admin.sections.find((s) => s.id === "groups")!.rows).toEqual([]);
    expect(admin.sections.find((s) => s.id === "audit")!.rows.length).toBeGreaterThan(0);
  });
});

describe("the Home 'Upcoming' list", () => {
  const home = (schedules: any[]) => personalHome({ accounts: [], budgets: [], schedules, activity: [] }).upcoming;
  it("shows the three that come next by date, and leaves out ended and paused ones", () => {
    const s = (id: string, nextRunOn: string, status = "active") => ({ id, name: id, amount: 10, currency: "USD", nextRunOn, status });
    expect(home([s("rent", "2026-12-01"), s("gym", "2026-11-03"), s("insurance", "2026-11-04"), s("old", "2026-08-03", "completed"), s("paused", "2026-11-01", "paused"), s("later", "2027-01-01")]).map((u) => u.id)).toEqual(["gym", "insurance", "rent"]);
  });
  it("keeps an older entry that has no status", () => {
    expect(home([{ id: "sch_rent", name: "Rent", amount: 1450, currency: "USD", nextRunOn: "2026-12-01" }]).map((u) => u.id)).toEqual(["sch_rent"]);
  });
});
