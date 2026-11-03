import { describe, expect, it } from "vitest";
import { MockBank } from "@finx/mock-bank-api";
import {
  accountItems, actionMeta, actionOf, budgetDetail, budgetIcon, budgetProgress, cardPictureNumber, compactMoney, dayLabel, displayName, filterTransactions, firstName,
  groupByDay, hasAccounts, hasAction, homeView, inDays, initials, instrumentView, investHome, notifications, orderedActions, pctText, personaSummary, recentTransactions,
  signedMoney, spendingSegments, subscriptionsDue, totalBalance, transactionsTitle, usd, usd2, isRtl,
} from "./index";

const alex = () => new MockBank("alex").persona;
const fin = () => alex().finance!;

describe("formatting", () => {
  it("shows money, compact money, signs and percents", () => {
    expect(usd(1200)).toBe("$1,200");
    expect(usd2(1200)).toBe("$1,200.00");
    expect([compactMoney(950), compactMoney(1000), compactMoney(5240)]).toEqual(["$950", "$1K", "$5.2K"]);
    expect([signedMoney(12.5, usd2), signedMoney(-3, usd)]).toEqual(["+$12.50", "-$3"]);
    expect([pctText(0.0178), pctText(-0.0052)]).toEqual(["+1.78%", "-0.52%"]);
  });
  it("names days relative to now", () => {
    const now = Date.UTC(2026, 10, 2, 12);
    expect([dayLabel(0, now), dayLabel(1, now)]).toEqual(["Today", "Yesterday"]);
    expect(dayLabel(3, now)).toMatch(/Fri/);
    expect(inDays(4, now)).toMatch(/6/);
    expect([isRtl("ur"), isRtl("en"), isRtl("ar"), isRtl("ar-JO")]).toEqual([true, false, true, true]);
  });
});

describe("dashboard view-models", () => {
  it("names and totals", () => {
    const p = alex();
    expect([displayName({ name: "Alex Morgan (new)" }), firstName(p), initials(p)]).toEqual(["Alex Morgan", "Alex", "AM"]);
    expect(totalBalance(p, fin())).toBeCloseTo(8720.76 + 15254.37 + 9876.54, 2);
    expect(hasAccounts(p, fin())).toBe(true);
    expect(hasAccounts(new MockBank("sam").persona, new MockBank("sam").persona.finance!)).toBe(false);
  });
  it("filters recent transactions", () => {
    expect(recentTransactions(fin().transactions, "all")).toHaveLength(4);
    expect(recentTransactions(fin().transactions, "income").every((t) => t.amount > 0)).toBe(true);
    expect(recentTransactions(fin().transactions, "expense", 2)).toHaveLength(2);
    expect([transactionsTitle("all"), transactionsTitle("income"), transactionsTitle("expense")]).toEqual(["Transactions", "Money in", "Money out"]);
  });
  it("judges a budget by how much is used", () => {
    expect(budgetProgress({ limit: 1500, spent: 525 })).toMatchObject({ tone: "ok", pct: 0.35 });
    expect(budgetProgress({ limit: 300, spent: 272 })).toMatchObject({ tone: "over" });
    expect(budgetProgress({ limit: 100, spent: 70 }).tone).toBe("warn");
    expect(budgetProgress({ limit: 0, spent: 0 }).pct).toBe(0);
    expect([budgetIcon("Food & Drinks"), budgetIcon("Shopping"), budgetIcon("Travel")]).toEqual(["food", "bag", "repeat"]);
  });
  it("works out the spending ring", () => {
    const s = spendingSegments(fin());
    expect(s.total).toBe(5200);
    expect(s.segments.reduce((a, x) => a + x.share, 0)).toBeCloseTo(1, 6);
    expect(spendingSegments({ spendingByCategory: [] }).total).toBe(1);
  });
  it("lists notifications for nearly used budgets and renewing subscriptions", () => {
    const n = notifications(fin(), usd);
    expect(n.map((x) => x.text)).toEqual(["Entertainment budget is 91% used", "Google One renews in 4 days ($21)"]);
    expect(notifications(undefined, usd)).toEqual([{ icon: "check", text: "You're all caught up.", tone: "positive" }]);
    expect(subscriptionsDue(fin().subscriptions, 9).map((s) => s.name)).toEqual(["Google One", "StreamPlus"]);
  });
});

describe("accounts, budgets and wallet view-models", () => {
  it("merges own accounts and linked banks", () => {
    const items = accountItems(alex(), fin());
    expect(items.map((i) => i.bank)).toEqual(["BankWorkx", "BankWorkx", "Summit Federal"]);
  });
  it("searches and groups transactions", () => {
    const t = fin().transactions;
    expect(filterTransactions(t, "starbucks", "all").map((x) => x.title)).toEqual(["Starbucks Coffee"]);
    expect(filterTransactions(t, "", "in").every((x) => x.amount > 0)).toBe(true);
    const g = groupByDay(t);
    expect(g.map(([d]) => d)).toEqual([...g.map(([d]) => d)].sort((a, b) => a - b));
    expect(g[1]![1].map((x) => x.title)).toEqual(["Freelancing Work", "Shopping"]);
  });
  it("shows a budget's detail with a daily allowance and its transactions", () => {
    const food = fin().budgets[0]!;
    const month = budgetDetail(food, fin().transactions, "month");
    expect(month).toMatchObject({ left: 975, perDay: 34, daysLeft: 28 });
    expect(month.transactions.map((t) => t.title)).toEqual(["Food & Drinks", "Starbucks Coffee"]);
    expect(budgetDetail(fin().budgets[1]!, fin().transactions, "week").transactions.map((t) => t.title)).toEqual(["Shopping"]);
  });
  it("draws card numbers that end in the real last four", () => {
    expect(cardPictureNumber({ network: "mastercard", last4: "5832" })).toBe("5200000000005832");
    expect(cardPictureNumber({ network: "visa", last4: "4242" })).toBe("4000000000004242");
  });
});

describe("catalog and home view-models", () => {
  const entries = [{ slug: "create-budget", name: "x", version: 1 }, { slug: "zzz-custom", name: "y", version: 1 }, { slug: "invest-acme", name: "z", version: 1 }, { slug: "add-money", name: "a", version: 1 }];
  it("orders known actions first and finds them even as copies", () => {
    expect(orderedActions(entries).map((e) => e.slug)).toEqual(["add-money", "create-budget", "invest-acme", "zzz-custom"]);
    expect(actionOf("invest-acme")).toBe("invest");
    expect(actionMeta("zzz-custom").icon).toBe("plus");
    expect(hasAction(entries, "invest")).toBe(true);
    expect(hasAction(entries, "sell-investment")).toBe(false);
  });
  it("describes the Meezan home", () => {
    const p = new MockBank("ayesha").persona;
    const v = homeView(p, { entries: [], source: "studio" });
    expect(v).toMatchObject({ hasAccounts: true, limit: { used: 0, daily: 50000 } });
    expect(v.sourcePill).toEqual({ tone: "positive", text: "Live from Studio · 0 journeys" });
    expect(homeView(p, { entries: [], source: "bundled" }).sourcePill.text).toBe("Offline copies");
    expect(personaSummary(p, usd)).toBe("2 account(s) · daily limit $50,000");
    expect(personaSummary(new MockBank("zara").persona, usd)).toBe("No accounts (KYC rejected)");
  });
});

describe("invest view-models", () => {
  it("builds the invest home", () => {
    const inv = fin().invest;
    const h = investHome(inv, "1M");
    expect(h.held.map((x) => x.instrument.symbol)).toEqual(["LMRB", "GLBX", "ORCH", "TBND"]);
    expect(h.watch.map((x) => x.symbol)).toEqual(["APXC", "SMTH", "GRNF"]);
    expect(h.series).toHaveLength(22);
    expect(h.movers).toHaveLength(3);
    expect(investHome(inv, "1W", "fund", "fund").explore.map((x) => x.symbol)).toEqual(["GLBX", "GRNF", "TBND"]);
    expect(investHome(inv, "1W", "lumen").explore.map((x) => x.symbol)).toEqual(["LMRB"]);
  });
  it("builds a stock page with the customer's position", () => {
    const v = instrumentView("LMRB", fin().invest, "1M");
    expect(v.held).toMatchObject({ shares: 6.5 });
    expect(v.held!.value).toBeCloseTo(6.5 * 184.2, 6);
    expect(v.watching).toBe(false);
    expect(instrumentView("APXC", fin().invest, "1D")).toMatchObject({ watching: true, held: undefined });
  });
});
