import { describe, it, expect } from "vitest";
import { MockBank } from "../index";
import { RIGHTS } from "./sme-data";

// Tuesday 3 November 2026, 10:42 UTC: the day of the demo (the cut-off is 16:00 and changes close at 18:00 the business day before)
const NOW = Date.parse("2026-11-03T10:42:00Z");
const make = (opts: ConstructorParameters<typeof MockBank>[1] = {}, persona = "alex") => { const b = new MockBank(persona, { ...opts }); let t = NOW; b.now = () => t; return { b, tick: (ms: number) => { t += ms; } }; };
const code = async (p: Promise<unknown>) => p.then(() => "no error", (e) => e.code as string);
const verify = async (b: MockBank) => { await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" }); };
const enter = async (b: MockBank, id: string) => { await verify(b); await b.call("bank.session.stepUp", { method: "password", secret: "Bwx!Demo2026" }); await b.call("bank.session.switch", { contextId: id }); };
const at = async (id: string, opts?: ConstructorParameters<typeof MockBank>[1], persona?: string) => { const m = make(opts, persona); await enter(m.b, id); return m; };

describe("business accounts", () => {
  it("the total is each ledger balance in dollars; available is the ledger less pending and waiting payments", async () => {
    const { b } = await at("alpha");
    const o = await b.call("corp.accounts.overview");
    expect(o).toMatchObject({ count: 2, currency: "USD", total: 582_807.78, totalText: "$582,807.78", note: "Total across 2 accounts, in USD" });
    // Operating 480,000.00 less 2,340.00 pending and 18,900.00 waiting for approval (PAY-2040)
    expect(o.accounts.alpha_ops).toMatchObject({ ledgerBalance: 480_000, availableBalance: 458_760, availableText: "$458,760.00", ledgerText: "$480,000.00", chip: "", type: "current" });
    expect(o.accounts.alpha_res).toMatchObject({ currency: "EUR", availableText: "€93,700.00", ledgerText: "€95,200.00", type: "savings" });
    expect(o.accounts.alpha_ops.rights).toEqual({ transactions: true, export: true, pay: true });
    expect(o.accounts.alpha_res.rights).toEqual({ transactions: true, export: true, pay: false });
  });
  it("an Approver sees Payroll as view only, and no pay right anywhere", async () => {
    const { b } = await at("beta");
    const o = await b.call("corp.accounts.overview");
    expect(o.accounts.beta_pay).toMatchObject({ chip: "View only", nameText: "Payroll · View only", rights: { transactions: false, export: false, pay: false } });
    expect(o.accounts.beta_ops.rights).toEqual({ transactions: true, export: true, pay: false });
    expect(await code(b.call("corp.transactions.list", { accountId: "beta_pay" }))).toBe("ACCOUNT_NOT_PERMITTED");
    expect(Object.keys(await b.call("corp.accounts.list", { for: "export" }))).toEqual(["beta_ops"]);
  });
  it("the identifiers for receiving money follow the home market, and only when the journey asks for them", async () => {
    for (const [market, first, second] of [["us", "Routing number", "Account number"], ["uk", "Sort code", "Account number"], ["eu", "IBAN", "BIC"], ["ae", "IBAN", "BIC"]] as const) {
      const { b } = await at("alpha", { config: { homeMarket: market } });
      const d = await b.call("corp.accounts.get", { accountId: "alpha_ops" });
      expect([d.identifiers.first.label, d.identifiers.second.label, d.identifiers.name]).toEqual([first, second, { label: "Account name", value: "Alpha Trading LLC" }]);
    }
    const { b } = await at("alpha");
    expect((await b.call("corp.accounts.get", { accountId: "alpha_ops", details: false })).identifiers).toBeNull();
    expect(await code(b.call("corp.accounts.get", { accountId: "nope" }))).toBe("ACCOUNT_NOT_FOUND");
  });
  it("transactions: a period, a search, the right to see them, at most 25 and pending ones marked", async () => {
    const { b } = await at("alpha");
    const all = await b.call("corp.transactions.list", {});
    expect(all).toMatchObject({ period: "30d", from: "2026-10-05", to: "2026-11-03" });
    expect(all.shown).toBe(Object.keys(all.rows).length);
    expect(all.shown).toBeLessThanOrEqual(25);
    expect(all.rows["TX-OP-001"]).toMatchObject({ description: "Whitby Logistics", status: "Pending", amountText: "-$2,340.00", date: "3 Nov", where: "Operating · Pending" });
    const week = await b.call("corp.transactions.list", { accountId: "alpha_ops", period: "7d" }), ninety = await b.call("corp.transactions.list", { accountId: "alpha_ops", period: "90d" });
    expect(week.count).toBeLessThan(ninety.count);
    expect(Object.values<any>(week.rows).every((r) => r.dateIso >= "2026-10-28")).toBe(true);
    expect(Object.values<any>(week.rows)[0].where).toMatch(/^(Pending|Booked)$/);
    const found = await b.call("corp.transactions.list", { accountId: "alpha_ops", period: "90d", text: "whitby" });
    expect(found.count).toBeGreaterThan(0);
    expect(Object.values<any>(found.rows).every((r) => `${r.description} ${r.reference}`.toLowerCase().includes("whitby"))).toBe(true);
    expect((await b.call("corp.transactions.list", { text: "zzzz-no-such-thing" })).count).toBe(0);
    expect((await b.call("corp.transactions.list", { period: "month" })).from).toBe("2026-11-01");
    expect(await code(b.call("corp.transactions.list", { period: "forever" }))).toBe("INVALID_RANGE");
  });
  it("the company's accounts are for the company: from Personal it is refused, and a person without the permission is refused", async () => {
    const { b } = make();
    expect(await code(b.call("corp.accounts.overview"))).toBe("WRONG_CONTEXT");
    const { b: beta } = await at("beta");
    expect(await code(beta.call("corp.schedules.cancel", { scheduleId: "BSC-3001" }))).toBe("PERMISSION_DENIED");
    expect(await code(beta.call("corp.templates.save", { name: "x", supplierId: "nimb" }))).toBe("PERMISSION_DENIED");
    expect(await code(beta.call("corp.suppliers.request", {}))).toBe("PERMISSION_DENIED");
    expect(await code(beta.call("corp.payments.withdraw", { paymentId: "PAY-2041" }))).toBe("PERMISSION_DENIED");
  });
});

describe("paying from an account", () => {
  it("a price from an account the person may not pay from is refused, and the account says so", async () => {
    const was = RIGHTS.alpha!.alpha_ops;
    RIGHTS.alpha!.alpha_ops = { alex: { pay: false } };
    try {
      const { b } = await at("alpha");
      expect((await b.call("corp.accounts.overview")).accounts.alpha_ops.rights.pay).toBe(false);
      expect(await code(b.call("corp.payments.quote", { fromAccountId: "alpha_ops", beneficiaryId: "harb", amount: 100, purpose: "Goods", reference: "X" }))).toBe("ACCOUNT_NOT_PERMITTED");
      // an account in another currency is refused for its currency first, as it always was
      expect(await code(b.call("corp.payments.quote", { fromAccountId: "alpha_res", beneficiaryId: "harb", amount: 100, purpose: "Goods", reference: "X" }))).toBe("CURRENCY_NOT_SUPPORTED");
    } finally { if (was) RIGHTS.alpha!.alpha_ops = was; else delete RIGHTS.alpha!.alpha_ops; }
    const { b } = await at("alpha");
    expect(await code(b.call("corp.payments.quote", { fromAccountId: "alpha_ops", beneficiaryId: "harb", amount: 100, purpose: "Goods", reference: "X" }))).toBe("no error");
  });
});

describe("statements by email", () => {
  const base = { accountIds: ["alpha_ops", "alpha_res"], type: "eod", period: "last", format: "pdf", recipients: "alex.morgan@alpha-trading.example" };
  it("sends a statement once to an address at the company, and writes it to the audit trail", async () => {
    const { b } = await at("alpha");
    const r = await b.call("corp.statements.generate", base);
    expect(r).toMatchObject({ sent: true, formatText: "PDF", accounts: "Operating, Reserve", from: "2026-10-01", to: "2026-10-31", recipients: "alex.morgan@alpha-trading.example", period: "Thu 1 Oct 2026 to Sat 31 Oct 2026" });
    expect(r.reference).toMatch(/^STM-20261103-0001$/);
  });
  it("the periods: last 7 days, this month, last month, last 3 months, custom (in order, within 24 months)", async () => {
    const { b } = await at("alpha");
    const span = async (period: string, extra = {}) => { const r = await b.call("corp.statements.check", { ...base, period, ...extra }); return [r.from, r.to]; };
    expect(await span("7d")).toEqual(["2026-10-28", "2026-11-03"]);
    expect(await span("month")).toEqual(["2026-11-01", "2026-11-03"]);
    expect(await span("last")).toEqual(["2026-10-01", "2026-10-31"]);
    expect(await span("3m")).toEqual(["2026-08-01", "2026-10-31"]);
    expect(await span("custom", { from: "2026-01-05", to: "2026-02-10" })).toEqual(["2026-01-05", "2026-02-10"]);
    expect(await code(b.call("corp.statements.generate", { ...base, period: "custom", from: "2026-02-10", to: "2026-01-05" }))).toBe("INVALID_RANGE");
    expect(await code(b.call("corp.statements.generate", { ...base, period: "custom", from: "2023-11-03", to: "2026-11-03" }))).toBe("PERIOD_TOO_LONG");
    // exactly 24 months is allowed, one day more is not
    expect(await code(b.call("corp.statements.generate", { ...base, period: "custom", from: "2024-11-03", to: "2026-11-03", check: true }))).toBe("no error");
    expect(await code(b.call("corp.statements.generate", { ...base, period: "custom", from: "2024-11-02", to: "2026-11-03", check: true }))).toBe("PERIOD_TOO_LONG");
    expect(await code(b.call("corp.statements.generate", { ...base, period: "custom", check: true }))).toBe("INVALID_RANGE");
  });
  it("only accounts the person may export; at least one; the formats; the recipients", async () => {
    const { b } = await at("beta");
    expect(await code(b.call("corp.statements.generate", { ...base, accountIds: ["beta_pay"] }))).toBe("ACCOUNT_NOT_PERMITTED");
    expect(await code(b.call("corp.statements.generate", { ...base, accountIds: [] }))).toBe("ACCOUNT_REQUIRED");
    const { b: a } = await at("alpha");
    expect(await code(a.call("corp.statements.generate", { ...base, format: "bai2" }))).toBe("FORMAT_NOT_ENABLED");
    expect(await code(a.call("corp.statements.generate", { ...base, format: "bai2", bankFormats: true }))).toBe("no error");
    expect(await code(a.call("corp.statements.generate", { ...base, format: "mt942", bankFormats: true }))).toBe("FORMAT_NOT_ENABLED");
    expect(await code(a.call("corp.statements.generate", { ...base, recipients: "bob@outside.example" }))).toBe("EXTERNAL_RECIPIENT_BLOCKED");
    expect(await code(a.call("corp.statements.generate", { ...base, recipients: "bob@outside.example", external: true }))).toBe("no error");
    expect(await code(a.call("corp.statements.generate", { ...base, recipients: "a@alpha-trading.example,b@alpha-trading.example,c@alpha-trading.example,d@alpha-trading.example,e@alpha-trading.example,f@alpha-trading.example" }))).toBe("INVALID_RECIPIENT");
    expect(await code(a.call("corp.statements.generate", { ...base, recipients: "not an email" }))).toBe("INVALID_RECIPIENT");
    expect(await code(a.call("corp.statements.generate", { ...base, recipients: "x@@alpha-trading.example" }))).toBe("INVALID_RECIPIENT");
    expect(await code(a.call("corp.statements.generate", { ...base, recipients: "X@Alpha-Trading.Example" }))).toBe("no error");
  });
  it("a period with no booked transactions is refused; today so far counts pending ones and needs intraday", async () => {
    const { b } = await at("alpha");
    expect(await code(b.call("corp.statements.generate", { ...base, period: "custom", from: "2026-01-05", to: "2026-01-10" }))).toBe("NO_TRANSACTIONS");
    // today's two pending items on Operating are not booked
    expect(await code(b.call("corp.statements.generate", { ...base, accountIds: ["alpha_ops"], period: "custom", from: "2026-11-03", to: "2026-11-03" }))).toBe("NO_TRANSACTIONS");
    expect(await code(b.call("corp.statements.generate", { ...base, type: "intraday" }))).toBe("FORMAT_NOT_ENABLED");
    const r = await b.call("corp.statements.generate", { ...base, type: "intraday", intraday: true, format: "pdf" });
    expect(r).toMatchObject({ period: "Today so far", count: 3 });
    expect(await code(b.call("corp.statements.generate", { ...base, type: "intraday", intraday: true, format: "mt942", bankFormats: true }))).toBe("no error");
  });
  it("schedules: the first run, ten at most, and removing one", async () => {
    const { b } = await at("alpha");
    const first = async (frequency: string, day = "") => (await b.call("corp.statements.schedule", { action: "create", ...base, frequency, day })).first;
    const list = await b.call("corp.statements.list");
    expect(list).toMatchObject({ count: 1, max: 10, defaultRecipient: "alex.morgan@alpha-trading.example" });
    expect(list.schedules["STS-1"]).toMatchObject({ how: "Weekly, Monday", recipients: "finance@alpha-trading.example", first: "Mon 9 Nov" });
    const w = await b.call("corp.statements.schedule", { action: "create", ...base, frequency: "weekly", day: "fri" });
    expect(w).toMatchObject({ first: "Fri 6 Nov", count: 2, how: "Weekly, Friday", frequencyText: "weekly" });
    expect(await first("weekly", "tue")).toBe("Tue 10 Nov");
    expect(await first("daily")).toBe("Wed 4 Nov");
    expect(await first("monthly", "5")).toBe("Thu 5 Nov");
    expect(await first("monthly", "1")).toBe("Tue 1 Dec");
    expect(await first("monthly", "last")).toBe("Mon 30 Nov");
    expect(await code(b.call("corp.statements.schedule", { action: "create", ...base, frequency: "weekly", day: "wed" }))).toBe("INVALID_SCHEDULE");
    await b.call("corp.sandbox.arrange", { op: "fillStatements", count: 10 });
    expect(await code(b.call("corp.statements.schedule", { action: "create", ...base, frequency: "daily" }))).toBe("SCHEDULE_LIMIT");
    expect((await b.call("corp.statements.schedule", { action: "remove", scheduleId: "STS-1" })).count).toBe(9);
    expect(await code(b.call("corp.statements.schedule", { action: "create", ...base, frequency: "daily", schedule: false }))).toBe("FORMAT_NOT_ENABLED");
  });
});

describe("suppliers, templates and the old lists", () => {
  const brightline = { name: "Brightline Packaging", type: "company", where: "same", routing: "021000021", account: "100004321", accountType: "checking" };
  it("a supplier request: the name, the details, the name check, always a code, and it waits for an administrator", async () => {
    const { b } = await at("alpha");
    expect(await code(b.call("corp.suppliers.validate", { step: 1, name: "harbour packaging" }))).toBe("SUPPLIER_NAME_EXISTS");
    expect(await code(b.call("corp.suppliers.validate", { step: 1, name: "B" }))).toBe("INVALID_NAME");
    expect(await code(b.call("corp.suppliers.validate", { step: 1, name: "Bad <name>" }))).toBe("INVALID_NAME");
    expect(await code(b.call("corp.suppliers.validate", { ...brightline, routing: "021000020" }))).toBe("INVALID_ROUTING");
    expect(await code(b.call("corp.suppliers.validate", { ...brightline, routing: "021000021", account: "100008841" }))).toBe("SUPPLIER_EXISTS");
    const ok = await b.call("corp.suppliers.validate", brightline);
    expect(ok).toMatchObject({ ok: true, account: "021000021 · ••4321", needsAddress: false });
    expect((await b.call("corp.suppliers.check", brightline)).result).toBe("na");
    expect(await code(b.call("corp.suppliers.request", brightline))).toBe("OTP_REQUIRED");
    await verify(b);
    const r = await b.call("corp.suppliers.request", brightline);
    expect(r).toMatchObject({ status: "waiting_approval", approval: "An administrator", name: "Brightline Packaging" });
    // the code is spent, and the supplier is not payable yet
    expect(await code(b.call("corp.suppliers.request", { ...brightline, name: "Another" }))).toBe("SUPPLIER_EXISTS");
    const list = await b.call("corp.suppliers.list", { include: "all" });
    expect(list[r.requestId]).toMatchObject({ status: "waiting_approval", statusText: "Waiting for approval" });
    expect(Object.keys(await b.call("corp.suppliers.list")).sort()).toEqual(["gulf", "harb", "nord", "whit"]);
    expect(await code(b.call("corp.payments.quote", { fromAccountId: "alpha_ops", beneficiaryId: r.requestId, amount: 10, purpose: "Goods", reference: "x" }))).toBe("BENEFICIARY_NOT_WHITELISTED");
  });
  it("a name that is close needs the person to say so; a supplier abroad needs an address; ten waiting is the most", async () => {
    const { b } = await at("alpha", { config: { homeMarket: "uk" } });
    const uk = { name: "Whitfield Services", type: "company", where: "same", sort: "20-00-00", account: "55779911", accountType: "personal", accountName: "James Whitfeld" };
    expect((await b.call("corp.suppliers.check", uk)).result).toBe("close");
    expect((await b.call("corp.suppliers.check", { ...uk, accountName: "James Whitfield" })).result).toBe("match");
    expect(await b.call("corp.suppliers.check", { ...uk, accountName: "James Whitfield", accountType: "business" })).toMatchObject({ result: "wrongType", recorded: "personal", fix: "personal" });
    expect((await b.call("corp.suppliers.check", { ...uk, accountName: "Someone Else" })).result).toBe("none");
    await verify(b);
    expect(await code(b.call("corp.suppliers.request", uk))).toBe("NAME_CHECK_NOT_CONFIRMED");
    expect(await code(b.call("corp.suppliers.request", { ...uk, acknowledged: true }))).toBe("no error");
    const abroad = { name: "Maple Freight", type: "company", where: "abroad", country: "DE", iban: "DE44500105175407324931", swift: "DEUTDEFFXXX", accountName: "Maple Freight GmbH" };
    expect(await b.call("corp.suppliers.validate", abroad)).toMatchObject({ ok: true, needsAddress: true, countryName: "Germany", account: "DEUTDEFFXXX · ••4931" });
    expect(await code(b.call("corp.suppliers.validate", { ...abroad, swift: "DEUTFRFFXXX" }))).toBe("INVALID_BIC");
    await verify(b);
    expect(await code(b.call("corp.suppliers.request", abroad))).toBe("ADDRESS_REQUIRED");
    await b.call("corp.sandbox.arrange", { op: "fillRequests", count: 10 });
    expect(await code(b.call("corp.suppliers.validate", { step: 1, name: "Next One" }))).toBe("TOO_MANY_PENDING");
  });
  it("templates: the seed, saving, the name, the supplier, the limit of 20 and deleting", async () => {
    const { b } = await at("alpha");
    const t = await b.call("corp.templates.list");
    expect(t.tpl_packaging).toMatchObject({ name: "Monthly packaging", supplierName: "Harbour Packaging", amount: 4_500, amountText: "$4,500.00", line: "Harbour Packaging · $4,500.00", status: "ready", purpose: "Goods" });
    expect(t.tpl_freight).toMatchObject({ amountText: "Amount each time", line: "Whitby Logistics · Amount each time" });
    const saved = await b.call("corp.templates.save", { name: "Weekly supplies", supplierId: "harb", amount: 1_200, reference: "PO-STANDING", purpose: "Goods" });
    expect(saved).toMatchObject({ name: "Weekly supplies", line: "Harbour Packaging · $1,200.00" });
    expect(await code(b.call("corp.templates.save", { name: "monthly packaging", supplierId: "harb" }))).toBe("TEMPLATE_NAME_EXISTS");
    expect(await code(b.call("corp.templates.save", { name: " ", supplierId: "harb" }))).toBe("NAME_REQUIRED");
    expect(await code(b.call("corp.templates.save", { name: "X1", supplierId: "nobody" }))).toBe("SUPPLIER_NOT_APPROVED");
    expect(await code(b.call("corp.templates.save", { name: "X2", supplierId: "harb", amount: 250_000.01 }))).toBe("LIMIT_USER_EXCEEDED");
    expect(await code(b.call("corp.templates.save", { name: "X3", supplierId: "harb", amount: 250_000 }))).toBe("no error");
    expect(await code(b.call("corp.templates.save", { name: "X4", supplierId: "harb", reference: "bad_ref" }))).toBe("INVALID_REFERENCE");
    expect(await code(b.call("corp.templates.save", { name: "X5", supplierId: "harb", purpose: "Gifts" }))).toBe("PURPOSE_REQUIRED");
    expect(await code(b.call("corp.templates.save", { name: "X6", supplierId: "harb" }))).toBe("no error");
    await b.call("corp.sandbox.arrange", { op: "fillTemplates", count: 20 });
    expect(await code(b.call("corp.templates.save", { name: "The 21st", supplierId: "harb" }))).toBe("TEMPLATE_LIMIT");
    expect((await b.call("corp.templates.delete", { templateId: "tpl_freight" })).name).toBe("Quarterly freight");
    expect(await code(b.call("corp.templates.delete", { templateId: "tpl_freight" }))).toBe("TEMPLATE_NOT_FOUND");
    await b.call("corp.sandbox.arrange", { op: "waitSupplier", id: "harb" });
    expect((await b.call("corp.templates.list")).tpl_packaging).toMatchObject({ status: "waiting", statusText: "Waiting for approval", supplierName: "Harbour Packaging" });
    await b.call("corp.sandbox.arrange", { op: "removeSupplier", id: "nord" });
  });
});

describe("scheduled supplier payments", () => {
  const plan = { supplierId: "harb", amount: 4_500, reference: "INV-2041", purpose: "Goods", frequency: "monthly", start: "2026-12-01", endMode: "never" };
  it("the seeds, with the next date, the badge, the last result and the warning", async () => {
    const { b } = await at("alpha");
    const l = await b.call("corp.schedules.list");
    expect(Object.keys(l)).toEqual(["BSC-3001", "BSC-3002"]);
    expect(l["BSC-3001"]).toMatchObject({ supplierName: "Harbour Packaging", line: "$4,500.00 · Monthly · next Tue 1 Dec", badge: "Active", last: "Paid 3 Nov", info: "Paid 3 Nov", warning: "" });
    expect(l["BSC-3002"]).toMatchObject({ supplierName: "Whitby Logistics", line: "£12,000.00 · Every 3 months · next Mon 4 Jan", badge: "Waiting for approval", progress: "0 of 1 approved", info: "0 of 1 approved", ends: "8 payments" });
  });
  it("a check names the next three dates, the approvers and whether a code is asked; nothing is made", async () => {
    const { b } = await at("alpha");
    const c = await b.call("corp.schedules.check", plan);
    expect(c).toMatchObject({ nextDates: "Tue 1 Dec · Fri 1 Jan · Mon 1 Feb", required: 1, approvalText: "Needs 1 approval before the first payment", codeRequired: false, firstText: "Tue 1 Dec 2026" });
    expect(Object.keys(await b.call("corp.schedules.list"))).toHaveLength(2);
    // a monthly payment keeps its day and moves off a weekend (Sat 1 Jan 2028 ... here 1 Jan 2027 is a Friday and 1 Feb 2027 a Monday)
    const w = await b.call("corp.schedules.check", { ...plan, supplierId: "nord", amount: 60_000 });
    expect(w).toMatchObject({ required: 2, approvalText: "Needs 2 approvals before the first payment", codeRequired: true, amountText: "€60,000.00" });
    expect(await code(b.call("corp.schedules.check", { ...plan, amount: 60_000 }))).toBe("RAIL_LIMIT");
  });
  it("making one: after the code from 25,000 only, awaiting approval, nothing taken; the dates and the end are checked", async () => {
    const { b } = await at("alpha");
    const made = await b.call("corp.schedules.create", plan);
    expect(made).toMatchObject({ id: "BSC-3003", badge: "Waiting for approval", progress: "0 of 1 approved" });
    expect((await b.call("corp.company.get")).accounts.alpha_ops.balance).toBe(480_000);
    expect(await code(b.call("corp.schedules.create", { ...plan, supplierId: "nord", amount: 30_000 }))).toBe("OTP_REQUIRED");
    await verify(b);
    expect(await code(b.call("corp.schedules.create", { ...plan, supplierId: "nord", amount: 30_000, frequency: "once" }))).toBe("no error");
    for (const [start, c] of [["2026-11-03", "DATE_TOO_SOON"], ["2026-11-02", "DATE_TOO_SOON"], ["2027-11-04", "DATE_TOO_FAR"], ["2026-12-05", "NOT_A_WEEKDAY"], ["2026-11-09", "NOT_A_WEEKDAY"], ["2026-11-04", "no error"], ["2027-11-03", "no error"]] as const) expect(await code(b.call("corp.schedules.check", { ...plan, start })), start).toBe(c);
    expect(await code(b.call("corp.schedules.check", { ...plan, endMode: "count", endCount: 1 }))).toBe("INVALID_COUNT");
    expect(await code(b.call("corp.schedules.check", { ...plan, endMode: "count", endCount: 61 }))).toBe("INVALID_COUNT");
    expect(await code(b.call("corp.schedules.check", { ...plan, endMode: "count", endCount: 60 }))).toBe("no error");
    expect(await code(b.call("corp.schedules.check", { ...plan, frequency: "weekly", endMode: "count", endCount: 104 }))).toBe("no error");
    expect(await code(b.call("corp.schedules.check", { ...plan, frequency: "quarterly", endMode: "count", endCount: 41 }))).toBe("INVALID_COUNT");
    expect(await code(b.call("corp.schedules.check", { ...plan, endMode: "date", endDate: "2026-12-01" }))).toBe("END_BEFORE_START");
    expect(await code(b.call("corp.schedules.check", { ...plan, endMode: "date", endDate: "2027-01-03" }))).toBe("INVALID_END_DATE");
    expect(await code(b.call("corp.schedules.check", { ...plan, endMode: "date", endDate: "2027-01-01" }))).toBe("no error");
    expect(await code(b.call("corp.schedules.check", { ...plan, reference: "bad_ref" }))).toBe("INVALID_REFERENCE");
    expect(await code(b.call("corp.schedules.check", { ...plan, purpose: "" }))).toBe("PURPOSE_REQUIRED");
    expect(await code(b.call("corp.schedules.check", { ...plan, supplierId: "nobody" }))).toBe("SUPPLIER_NOT_APPROVED");
    expect(await code(b.call("corp.schedules.check", { ...plan, amount: 250_001, supplierId: "nord" }))).toBe("LIMIT_USER_EXCEEDED");
    expect(await code(b.call("corp.schedules.check", { ...plan, frequency: "quarterly", allowQuarterly: false }))).toBe("INVALID_FREQUENCY");
  });
  it("twenty at most; a change goes back to waiting; a cancel is immediate; changes close at 18:00 the business day before (09:00 when strict)", async () => {
    const { b } = await at("alpha");
    const upd = await b.call("corp.schedules.update", { scheduleId: "BSC-3001", amount: 5_000, reference: "INV-2", purpose: "Goods", start: "2026-12-01", endMode: "never" });
    expect(upd).toMatchObject({ id: "BSC-3001", badge: "Waiting for approval", progress: "0 of 1 approved", amountText: "$5,000.00" });
    const gone = await b.call("corp.schedules.cancel", { scheduleId: "BSC-3002" });
    expect(gone).toMatchObject({ cancelled: true, supplierName: "Whitby Logistics", how: "Every 3 months", cancelledOn: "3 Nov 2026" });
    expect(Object.keys(await b.call("corp.schedules.list"))).toEqual(["BSC-3001"]);
    expect(await code(b.call("corp.schedules.cancel", { scheduleId: "BSC-3002" }))).toBe("SCHEDULE_NOT_ACTIVE");
    expect(await code(b.call("corp.schedules.cancel", { scheduleId: "BSC-9" }))).toBe("SCHEDULE_NOT_FOUND");
    const tomorrow = await b.call("corp.schedules.create", { ...plan, start: "2026-11-04" });
    expect(await code(b.call("corp.schedules.get", { scheduleId: tomorrow.id }))).toBe("no error");
    expect(await code(b.call("corp.schedules.get", { scheduleId: tomorrow.id, strictCutoff: true }))).toBe("SCHEDULE_CUTOFF_PASSED");
    expect(await code(b.call("corp.schedules.cancel", { scheduleId: tomorrow.id, strictCutoff: true }))).toBe("SCHEDULE_CUTOFF_PASSED");
    const today = await b.call("corp.schedules.create", { ...plan, start: "2026-11-04" });
    void today;
    const { b: late, tick } = await at("alpha");
    const mine = await late.call("corp.schedules.create", { ...plan, start: "2026-11-04" });
    tick(7 * 3_600_000 + 18 * 60_000); // 18:00 on Tuesday: changes for Wednesday's payment have closed
    expect(await code(late.call("corp.schedules.update", { scheduleId: mine.id, amount: 1, reference: "x", purpose: "Goods", start: "2026-11-05", endMode: "never" }))).toBe("SCHEDULE_CUTOFF_PASSED");
    await b.call("corp.sandbox.arrange", { op: "fillSchedules", count: 20 });
    expect(await code(b.call("corp.schedules.create", plan))).toBe("SCHEDULE_LIMIT");
    expect(await code(b.call("corp.schedules.check", plan))).toBe("no error");
  });
  it("a payment that is due today is running and cannot be changed", async () => {
    const { b } = await at("alpha");
    await b.call("corp.sandbox.arrange", { op: "fillSchedules", count: 0 });
    const x = await b.call("corp.schedules.create", { ...plan, start: "2026-11-04" });
    const { b: next, tick } = await at("alpha");
    const y = await next.call("corp.schedules.create", { ...plan, start: "2026-11-04" });
    tick(24 * 3_600_000);
    expect(await code(next.call("corp.schedules.cancel", { scheduleId: y.id }))).toBe("SCHEDULE_RUNNING");
    void x;
  });
  it("the list warns when the next payment would be skipped, with the reason", async () => {
    const { b } = await at("alpha");
    await b.call("corp.sandbox.arrange", { op: "removeSupplier", id: "harb" });
    expect((await b.call("corp.schedules.list"))["BSC-3001"]).toMatchObject({ warning: "The supplier is no longer on your list. The next payment would be skipped.", info: "The supplier is no longer on your list. The next payment would be skipped." });
    const { b: low } = await at("alpha");
    await low.call("corp.sandbox.arrange", { op: "balance", accountId: "alpha_ops", balance: 4_000 });
    expect((await low.call("corp.schedules.list"))["BSC-3001"].warning).toBe("There isn’t enough money in the account. The next payment would be skipped.");
  });
});

describe("the tracker and withdrawing", () => {
  it("lists every payment of the company, newest first, with the words of its status; settled is released on an earlier day", async () => {
    const { b } = await at("alpha");
    const t = await b.call("corp.payments.track", {});
    expect(Object.keys(t.rows)).toEqual(["PAY-2040", "PAY-1187", "PAY-1190", "PAY-1180"]);
    expect(t).toMatchObject({ count: 4, role: "Maker", canStart: true });
    expect(t.rows["PAY-2040"]).toMatchObject({ started: "Today 09:30", to: "Harbour Packaging", amountText: "$18,900.00", statusKey: "pending_approval", statusText: "Pending approval", canWithdraw: true });
    expect(t.rows["PAY-1180"]).toMatchObject({ to: "Bulk · 3 payments", statusKey: "settled", statusText: "Settled", canWithdraw: false });
    expect(Object.keys((await b.call("corp.payments.track", { status: "settled" })).rows)).toEqual(["PAY-1187", "PAY-1190", "PAY-1180"]);
    expect((await b.call("corp.payments.track", { status: "rejected" })).count).toBe(0);
    const { b: beta } = await at("beta");
    const bt = await beta.call("corp.payments.track", {});
    expect(bt).toMatchObject({ role: "Approver", canStart: false });
    expect(Object.keys(bt.rows)).toEqual(["PAY-2041", "PAY-2039", "PAY-2012"]);
    expect(Object.values<any>(bt.rows).every((r) => r.canWithdraw === false)).toBe(true);
    const d = await b.call("corp.payments.track", { paymentId: "PAY-2040" });
    expect(d.timeline.created).toMatchObject({ text: "Alex Morgan · Today 09:30", state: "done" });
    expect(d.timeline.approval).toMatchObject({ text: "0 of 1 approved", state: "current" });
    expect(Object.keys(d.timeline)).toEqual(["created", "approval", "released", "settled"]);
    expect((await b.call("corp.payments.track", { paymentId: "PAY-1187" })).timeline.settled.state).toBe("done");
    expect(await code(b.call("corp.payments.track", { paymentId: "PAY-9" }))).toBe("PAYMENT_NOT_FOUND");
  });
  it("a payment released today is Released to bank, not Settled", async () => {
    const { b } = await at("alpha");
    await b.call("corp.sandbox.arrange", { op: "release", paymentId: "PAY-2040" });
    expect((await b.call("corp.payments.track", { paymentId: "PAY-2040" })).statusText).toBe("Released to bank");
  });
  it("withdraw: only your own, only while it waits; the reason is kept; the day's limit is given back", async () => {
    const { b } = await at("alpha");
    expect((await b.call("corp.company.get")).me.usedToday).toBe(18_900);
    const out = await b.call("corp.payments.withdraw", { paymentId: "PAY-2040", reason: "Other", note: "Wrong invoice" });
    expect(out).toMatchObject({ id: "PAY-2040", statusKey: "withdrawn", statusText: "Withdrawn", withdrawReason: "Wrong invoice", to: "Harbour Packaging" });
    expect((await b.call("corp.company.get")).me.usedToday).toBe(0);
    const d = await b.call("corp.payments.track", { paymentId: "PAY-2040" });
    expect(d.timeline.approval).toMatchObject({ text: "Withdrawn · Wrong invoice", state: "failed" });
    expect(Object.keys(d.timeline)).toEqual(["created", "approval"]);
    expect(await code(b.call("corp.payments.withdraw", { paymentId: "PAY-2040" }))).toBe("PAYMENT_NOT_PENDING");
    expect(await code(b.call("corp.payments.withdraw", { paymentId: "PAY-1187" }))).toBe("PAYMENT_RELEASED");
    expect(await code(b.call("corp.payments.withdraw", { paymentId: "PAY-9" }))).toBe("PAYMENT_NOT_FOUND");
    const { b: c } = await at("alpha");
    expect(await code(c.call("corp.payments.withdraw", { paymentId: "PAY-2040", reason: "Because" }))).toBe("INVALID_REASON");
    expect(await code(c.call("corp.payments.withdraw", { paymentId: "PAY-2040", reason: "Other", note: "x".repeat(101) }))).toBe("INVALID_REASON");
    await c.call("corp.sandbox.arrange", { op: "payment", payment: { id: "PAY-7001", companyId: "alpha", fromAccountId: "alpha_ops", beneficiaryId: "harb", amount: 100, currency: "USD", reference: "X", status: "pending_approval", initiatedBy: "tess_m", initiatedAt: "2026-11-03T09:00:00Z", valueDate: "2026-11-03", afterCutoff: false, required: 1, approvals: [] } });
    expect(await code(c.call("corp.payments.withdraw", { paymentId: "PAY-7001" }))).toBe("NOT_YOUR_PAYMENT");
  });
});

describe("a new company has nothing yet", () => {
  it("no accounts, suppliers, templates, schedules or payments", async () => {
    const { b } = await at("gamma", undefined, "alexempty");
    expect(await b.call("corp.accounts.overview")).toMatchObject({ count: 0, totalText: "$0.00" });
    expect(await b.call("corp.templates.list")).toEqual({});
    expect(await b.call("corp.schedules.list")).toEqual({});
    expect((await b.call("corp.payments.track", {})).count).toBe(0);
    expect(await b.call("corp.suppliers.list")).toEqual({});
  });
});
