import { describe, it, expect } from "vitest";
import { MockBank, type Flaws, type SandboxConditions } from "../index";

const code = async (p: Promise<unknown>) => p.then(() => "no error", (e) => e.code as string);
const NOW = "2026-11-03T10:00:00Z";
const bank = (persona = "alex", flaws: Flaws = {}, conditions: SandboxConditions = {}) => new MockBank(persona, { now: Date.parse(NOW), corpFlaws: flaws, conditions });
const verified = async (b: MockBank) => { await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" }); };

describe("the overview of the accounts", () => {
  it("groups the accounts and adds the ledger balances in dollars, never across currencies as they are", async () => {
    const o = await bank().call("bank.accounts.overview");
    expect(o.groups.everyday.map((r: any) => [r.name, r.line, r.balanceText])).toEqual([["Main", "••4410 · USD", "$8,602.36"]]);
    expect(o.groups.savings.map((r: any) => r.name)).toEqual(["Savings"]);
    expect(o.groups.other.map((r: any) => [r.name, r.balanceText])).toEqual([["EUR Travel", "€2,400.00"], ["AED Home", "AED 11,000.00"]]);
    expect(o.groups.hidden).toEqual([]);
    // 8,720.76 + 15,254.37 + 2,400 / 0.926 + 11,000 / 3.672 (the ledger balances, not the available ones), rounded once at the end
    expect(o.total).toEqual({ currency: "USD", amount: 29562.57, text: "$29,562.57" });
    expect([o.count, o.visible]).toEqual([4, 4]);
  });
  it("leaves the foreign currency accounts out of the list and the total when asked", async () => {
    const o = await bank().call("bank.accounts.overview", { showFx: false });
    expect(o.groups.other).toEqual([]);
    expect(o.total.amount).toBe(23975.13);
    const flawed = await bank("alex", { totalFx: false }).call("bank.accounts.overview", { showFx: false });
    expect(flawed.total.amount).toBe(29562.57);
  });
  it("a hidden account moves to its own group and leaves the total", async () => {
    const b = bank();
    await b.call("bank.accounts.setHidden", { accountId: "acc_eur", hidden: true });
    const o = await b.call("bank.accounts.overview");
    expect(o.groups.hidden.map((r: any) => [r.name, r.hidden])).toEqual([["EUR Travel", true]]);
    expect(o.groups.other.map((r: any) => r.name)).toEqual(["AED Home"]);
    expect(o.total.amount).toBe(26970.77);
    const flawed = bank("alex", { totalHidden: false });
    await flawed.call("bank.accounts.setHidden", { accountId: "acc_eur", hidden: true });
    expect((await flawed.call("bank.accounts.overview")).total.amount).toBe(29562.57);
  });
  it("shows a status chip on an account that is frozen, dormant or closing, and answers a new customer with nothing", async () => {
    const o = await bank("alexaccounts", {}, { frozen: ["acc_save"] }).call("bank.accounts.overview");
    expect(o.groups.savings.map((r: any) => [r.name, r.chip])).toEqual([["Savings", "Frozen"], ["Old savings", "Dormant"]]);
    expect(await bank("sam").call("bank.accounts.overview")).toMatchObject({ count: 0, total: null });
  });
});

describe("one account", () => {
  it("has the two balances, what is on hold, the product and the numbers of the home market", async () => {
    const a = await bank().call("bank.accounts.get", { accountId: "acc_main" });
    expect(a).toMatchObject({ availableText: "$8,602.36", ledgerText: "$8,720.76", heldText: "$118.40", onHold: true, productName: "Current account", openedOn: "14 Mar 2019", interestRate: "None" });
    expect(a.holds).toEqual([{ id: "tx_2", title: "Online order, Parcel Co", amount: 118.4, text: "$118.40", date: "3 Nov 2026" }]);
    expect(a.rows).toEqual([{ label: "Routing number", value: "100200300" }, { label: "Account number", value: "0000004410" }]);
    expect(await bank().call("bank.accounts.get", { accountId: "acc_save" })).toMatchObject({ onHold: false, interestRate: "3.10% a year, variable" });
    expect(await code(bank().call("bank.accounts.get", { accountId: "nope" }))).toBe("ACCOUNT_NOT_FOUND");
    expect((await bank().call("bank.accounts.get", {})).id).toBe("acc_main"); // no account named: the first
  });
  it("follows the bank's home market for the numbers it shows", async () => {
    const uk = new MockBank("alex", { now: Date.parse(NOW), config: { homeMarket: "uk" } });
    expect((await uk.call("bank.accounts.get", { accountId: "acc_main" })).rows).toEqual([{ label: "Sort code", value: "20-30-40" }, { label: "Account number", value: "00004410" }]);
    const eu = new MockBank("alex", { now: Date.parse(NOW), config: { homeMarket: "eu" } });
    expect((await eu.call("bank.accounts.get", { accountId: "acc_main" })).rows).toEqual([{ label: "IBAN", value: "US00 BWX 0000 0000 4410" }, { label: "BIC", value: "BWXBUS33" }]);
  });
  it("lists where a balance can go when the account closes", async () => {
    const a = await bank().call("bank.accounts.get", { accountId: "acc_save" });
    expect(Object.values(a.destinations).map((d: any) => d.name)).toEqual(["Main ••4410", "A cheque by post"]);
  });
});

describe("renaming and hiding", () => {
  it("accepts 2 to 24 allowed characters and refuses a name another account shows, in any case", async () => {
    const b = bank();
    expect(await code(b.call("bank.accounts.rename", { accountId: "acc_save", nickname: "A" }))).toBe("INVALID_NICKNAME");
    expect(await code(b.call("bank.accounts.rename", { accountId: "acc_save", nickname: "x".repeat(25) }))).toBe("INVALID_NICKNAME");
    expect(await code(b.call("bank.accounts.rename", { accountId: "acc_save", nickname: "Holiday #1" }))).toBe("NAME_CHARS");
    expect(await code(b.call("bank.accounts.rename", { accountId: "acc_save", nickname: "eur travel" }))).toBe("NAME_TAKEN");
    expect(await b.call("bank.accounts.rename", { accountId: "acc_save", nickname: "  Holiday fund  " })).toEqual({ accountId: "acc_save", nickname: "Holiday fund" });
    expect((await b.call("bank.accounts.overview")).groups.savings[0].name).toBe("Holiday fund");
    expect(await b.call("bank.accounts.rename", { accountId: "acc_save", nickname: "Holiday fund" })).toMatchObject({ nickname: "Holiday fund" }); // its own name again is fine
    expect(await b.call("bank.accounts.rename", { accountId: "acc_save", reset: true })).toEqual({ accountId: "acc_save", nickname: "" });
    expect((await b.call("bank.accounts.overview")).groups.savings[0].name).toBe("Savings");
  });
  it("each rule can be switched off", async () => {
    expect(await code(bank("alex", { nameRules: false }).call("bank.accounts.rename", { accountId: "acc_save", nickname: "Holiday #1" }))).toBe("no error");
    expect(await code(bank("alex", { nameTaken: false }).call("bank.accounts.rename", { accountId: "acc_save", nickname: "EUR Travel" }))).toBe("no error");
  });
  it("keeps one account on the overview and brings a hidden one back", async () => {
    const b = bank("alex");
    for (const id of ["acc_main", "acc_save", "acc_eur"]) await b.call("bank.accounts.setHidden", { accountId: id, hidden: true });
    expect(await code(b.call("bank.accounts.setHidden", { accountId: "acc_aed", hidden: true }))).toBe("LAST_VISIBLE_ACCOUNT");
    expect(await b.call("bank.accounts.setHidden", { accountId: "acc_main", hidden: false })).toEqual({ accountId: "acc_main", hidden: false });
    const c = bank("alex", { lastVisible: false });
    for (const id of ["acc_main", "acc_save", "acc_eur"]) await c.call("bank.accounts.setHidden", { accountId: id, hidden: true });
    expect(await code(c.call("bank.accounts.setHidden", { accountId: "acc_aed", hidden: true }))).toBe("no error");
  });
  it("needs the permission to manage accounts", async () => {
    const b = bank("alex", {}, { withoutPermissions: ["accounts.manage"] });
    for (const [a, i] of [["bank.accounts.rename", { accountId: "acc_main", nickname: "Daily" }], ["bank.accounts.setHidden", { accountId: "acc_main", hidden: true }], ["bank.budgets.create", { category: "Travel", limit: 100 }]] as const) expect(await code(b.call(a, i)), a).toBe("PERMISSION_DENIED");
  });
});

describe("the transactions of an account", () => {
  it("lists the pending ones first, then the newest, ten at a time", async () => {
    const b = bank();
    const r = await b.call("bank.accounts.transactions", { accountId: "acc_main" });
    expect(r.items.slice(0, 3).map((t: any) => [t.title, t.when])).toEqual([["Online order, Parcel Co", "Pending"], ["Blue Bottle Café", "Today"], ["Salary, Northwind", "1 Nov 2026"]]);
    expect([r.items.length, r.total, r.more]).toEqual([10, 17, true]);
    expect((await b.call("bank.accounts.transactions", { accountId: "acc_main", limit: 20 })).more).toBe(false);
    expect(r.items[0]).toMatchObject({ amountText: "−$118.40", pending: true, status: "Pending", reportable: true, kind: "card", reference: "TX-000002" });
    expect(r.items[2]).toMatchObject({ amountText: "+$4,200.00", incoming: true, party: "From", counterparty: "Northwind", reportable: false });
  });
  it("narrows by title, category, reference or amount, and by direction", async () => {
    const b = bank();
    const titles = async (i: Record<string, unknown>) => (await b.call("bank.accounts.transactions", { accountId: "acc_main", ...i })).items.map((t: any) => t.title);
    expect(await titles({ q: "coffee" })).toEqual([]);
    expect(await titles({ q: "BLUE" })).toEqual(["Blue Bottle Café"]);
    expect(await titles({ q: "health" })).toEqual(["Pharmacy", "Gym membership"]);
    expect(await titles({ q: "118.40" })).toEqual(["Online order, Parcel Co"]);
    expect(await titles({ q: "tx-000006" })).toEqual(["Maya Chen"]);
    expect((await titles({ direction: "in" })).sort()).toEqual(["Interest", "Salary, Northwind", "Salary, Northwind", "Salary, Northwind"]);
    expect((await titles({ direction: "out", limit: 100 })).length).toBe(13);
    const none = await b.call("bank.accounts.transactions", { accountId: "acc_main", q: "zzz" });
    expect([none.total, none.filtered, none.empty]).toEqual([0, true, false]);
    expect(await bank().call("bank.accounts.transactions", { accountId: "acc_aed", q: "zzz" })).toMatchObject({ filtered: true });
  });
  it("each rule can be switched off", async () => {
    expect((await bank("alex", { txFilter: false }).call("bank.accounts.transactions", { accountId: "acc_main", q: "zzz" })).total).toBe(17);
    const first = (await bank("alex", { pendingFirst: false }).call("bank.accounts.transactions", { accountId: "acc_main" })).items[0];
    expect(first.title).toBe("Blue Bottle Café");
  });
});

describe("reporting a problem with a payment", () => {
  it("opens a case for a payment made, once", async () => {
    const b = bank();
    expect(await b.call("bank.accounts.reportProblem", { accountId: "acc_main", transactionId: "tx_7", reason: "I was charged twice" })).toMatchObject({ caseRef: "DSP-8001", title: "Green Grocer" });
    expect(await code(b.call("bank.accounts.reportProblem", { accountId: "acc_main", transactionId: "tx_7", reason: "I was charged twice" }))).toBe("DUPLICATE_REPORT");
    expect((await b.call("bank.accounts.transactions", { accountId: "acc_main", limit: 30 })).items.find((t: any) => t.id === "tx_7").reported).toBe("DSP-8001");
    expect(await code(bank("alex", { reportDuplicate: false }).call("bank.accounts.reportProblem", { accountId: "acc_main", transactionId: "tx_7", reason: "The amount is wrong" }))).toBe("no error");
  });
  it("refuses an incoming payment, a reason that does not fit, a short note and a pending payment's other reasons", async () => {
    const b = bank();
    const report = (transactionId: string, reason: string, note = "") => code(b.call("bank.accounts.reportProblem", { accountId: "acc_main", transactionId, reason, note }));
    expect(await report("tx_3", "Something else", "this is a long note")).toBe("NOT_REPORTABLE");
    expect(await report("tx_7", "I sent it to the wrong person")).toBe("REASON_INVALID");
    expect(await report("tx_6", "I sent it to the wrong person")).toBe("no error");
    expect(await report("tx_9", "Something else", "short")).toBe("NOTE_TOO_SHORT");
    expect(await report("tx_2", "The amount is wrong")).toBe("PENDING_NOT_DISPUTABLE");
    expect(await report("tx_2", "I do not recognise it")).toBe("no error");
    expect(await report("tx_nope", "Something else", "this is a long note")).toBe("TRANSACTION_NOT_FOUND");
    expect(await code(bank("alex", { reportPending: false }).call("bank.accounts.reportProblem", { accountId: "acc_main", transactionId: "tx_2", reason: "The amount is wrong" }))).toBe("no error");
    expect(await code(bank("alex", { reportOutgoing: false }).call("bank.accounts.reportProblem", { accountId: "acc_main", transactionId: "tx_3", reason: "Something else", note: "this is a long note" }))).toBe("no error");
  });
});

describe("closing an account", () => {
  const ask = (b: MockBank, input: Record<string, unknown>) => b.call("bank.accounts.requestClosure", { reason: "I do not need it", ...input });
  it("is refused while card payments are on hold or the account is overdrawn", async () => {
    const b = bank(); await verified(b);
    expect(await code(ask(b, { accountId: "acc_main", destination: "acc_save" }))).toBe("ACCOUNT_HAS_HOLDS");
    expect(await code(ask(bank("alex", { closeHolds: false }), { accountId: "acc_main", destination: "post" }))).toBe("OTP_REQUIRED");
    const over = bank("alexaccounts"); await verified(over);
    expect(await code(ask(over, { accountId: "acc_spare" }))).toBe("ACCOUNT_OVERDRAWN");
    expect((await over.call("bank.accounts.get", { accountId: "acc_spare" })).overdrawn).toBe(true);
    expect(await code(ask(bank("alexaccounts", { closeOverdrawn: false }), { accountId: "acc_spare" }))).toBe("OTP_REQUIRED");
  });
  it("needs a reason, a place for the balance, a note for something else and the code", async () => {
    const b = bank();
    expect(await code(ask(b, { accountId: "acc_save", destination: "acc_main" }))).toBe("OTP_REQUIRED");
    await verified(b);
    expect(await code(ask(b, { accountId: "acc_save", destination: "acc_main", reason: "" }))).toBe("REASON_REQUIRED");
    expect(await code(ask(b, { accountId: "acc_save", destination: "acc_main", reason: "Something else", note: "short" }))).toBe("NOTE_TOO_SHORT");
    expect(await code(ask(b, { accountId: "acc_save", destination: "" }))).toBe("DESTINATION_INVALID");
    expect(await code(ask(b, { accountId: "acc_save", destination: "acc_eur" }))).toBe("DESTINATION_INVALID"); // another currency
    expect(await code(ask(b, { accountId: "acc_save", destination: "acc_save" }))).toBe("DESTINATION_INVALID");
    expect(await ask(b, { accountId: "acc_save", destination: "acc_main" })).toMatchObject({ reference: "CLS-5001", destination: "Main ••4410", name: "Savings" });
    expect((await b.call("bank.accounts.get", { accountId: "acc_save" }))).toMatchObject({ status: "closing", warning: "closing", closureReference: "CLS-5001" });
    expect(await code(ask(b, { accountId: "acc_save", destination: "acc_main" }))).toBe("CLOSURE_PENDING");
    expect(await code(ask(bank("alex", { closeNeedsCode: false }), { accountId: "acc_save", destination: "acc_main" }))).toBe("no error");
  });
  it("can be cancelled, and a dormant account made active", async () => {
    const b = bank("alexaccounts"); await verified(b);
    await ask(b, { accountId: "acc_save", destination: "post" });
    expect(await b.call("bank.accounts.restore", { accountId: "acc_save" })).toEqual({ accountId: "acc_save", status: "active", was: "closing" });
    expect(await b.call("bank.accounts.restore", { accountId: "acc_old" })).toEqual({ accountId: "acc_old", status: "active", was: "dormant" });
    expect(await code(b.call("bank.accounts.restore", { accountId: "acc_main" }))).toBe("NOT_RESTORABLE");
  });
});

describe("opening another account", () => {
  it("opens an empty account after the code, and the list has it at once", async () => {
    const b = bank();
    expect(await code(b.call("bank.accounts.open", { product: "savings", name: "Holiday fund" }))).toBe("OTP_REQUIRED");
    await verified(b);
    expect(await b.call("bank.accounts.open", { product: "savings", name: "Holiday fund" })).toMatchObject({ name: "Holiday fund", productName: "Savings account", currency: "USD", maskedNumber: "••9101", last4: "9101", openedOn: "3 Nov 2026" });
    const o = await b.call("bank.accounts.overview");
    expect(o.groups.savings.map((r: any) => [r.name, r.balanceText])).toEqual([["Savings", "$15,254.37"], ["Holiday fund", "$0.00"]]);
    expect(await b.call("bank.accounts.get", { accountId: "acc_new1" })).toMatchObject({ interestRate: "3.10% a year, variable", openedOn: "3 Nov 2026" });
    expect(await code(b.call("bank.accounts.open", { product: "savings", name: "Another" }))).toBe("OTP_REQUIRED"); // the code was used
  });
  it("a check before the code applies every rule and opens nothing", async () => {
    const b = bank();
    expect(await b.call("bank.accounts.open", { product: "savings", name: "Holiday fund", dryRun: true })).toEqual({ ok: true, name: "Holiday fund", currency: "USD", productName: "Savings account", interest: "3.10% a year, variable", monthlyFee: "None", minimumBalance: "$1.00" });
    expect(await b.call("bank.accounts.open", { product: "currency", currency: "AED", name: "Dirhams", dryRun: true })).toMatchObject({ productName: "Dirham account", currency: "AED", interest: "None", minimumBalance: "None" });
    expect((await b.call("bank.accounts.overview")).count).toBe(4);
    expect(await code(b.call("bank.accounts.open", { product: "current", name: "savings", dryRun: true }))).toBe("NAME_TAKEN");
    expect(await code(b.call("bank.accounts.open", { product: "current", name: "Daily", dryRun: false }))).toBe("OTP_REQUIRED");
    expect(await code(bank("alexaccounts").call("bank.accounts.open", { product: "current", name: "Fifth", dryRun: true }))).toBe("ACCOUNT_LIMIT");
  });
  it("a currency account asks for one of three currencies", async () => {
    const b = bank(); await verified(b);
    expect(await code(b.call("bank.accounts.open", { product: "currency", name: "Pounds" }))).toBe("CURRENCY_REQUIRED");
    expect(await code(b.call("bank.accounts.open", { product: "currency", currency: "JPY", name: "Pounds" }))).toBe("CURRENCY_REQUIRED");
    expect(await b.call("bank.accounts.open", { product: "currency", currency: "GBP", name: "Pounds" })).toMatchObject({ productName: "Pound account", currency: "GBP" });
    expect(await code(b.call("bank.accounts.open", { product: "mortgage", name: "Home" }))).toBe("PRODUCT_UNAVAILABLE");
  });
  it("checks the name and holds at most six accounts", async () => {
    const b = bank("alexaccounts"); await verified(b);
    expect(await code(b.call("bank.accounts.open", { product: "current", name: "Fifth" }))).toBe("ACCOUNT_LIMIT");
    expect(await code(bank("alexaccounts", { accountLimit: false }).call("bank.accounts.open", { product: "current", name: "Fifth" }))).toBe("OTP_REQUIRED");
    const c = bank(); await verified(c);
    expect(await code(c.call("bank.accounts.open", { product: "current", name: "A" }))).toBe("INVALID_NICKNAME");
    expect(await code(c.call("bank.accounts.open", { product: "current", name: "Holiday #1" }))).toBe("NAME_CHARS");
    expect(await code(c.call("bank.accounts.open", { product: "current", name: "savings" }))).toBe("NAME_TAKEN");
    expect(await code(bank("alex", { openNeedsCode: false }).call("bank.accounts.open", { product: "current", name: "Daily" }))).toBe("no error");
  });
});

describe("statements, letters and certificates", () => {
  const prep = (b: MockBank, input: Record<string, unknown>) => b.call("bank.statements.prepare", { accountId: "acc_main", kind: "statement", period: "last", ...input });
  it("prepares a statement for last month with its balances and file name", async () => {
    const s = await prep(bank(), {});
    expect(s).toMatchObject({ from: "2026-10-01", to: "2026-10-31", file: "statement-4410-2026-10-01-2026-10-31.pdf", needsCode: false, fee: 0, emailMasked: "a•••@example.com", periodText: "1 Oct 2026 to 31 Oct 2026" });
    expect([s.openingText, s.closingText, s.count]).toEqual(["$2,085.95", "$4,527.16", 11]);
    expect(s.sizeKb).toBe(40 + 6 * s.count);
  });
  it("knows the four periods", async () => {
    const b = bank();
    expect(await prep(b, { period: "this" })).toMatchObject({ from: "2026-11-01", to: "2026-11-03", count: 2 });
    expect(await prep(b, { period: "3m" })).toMatchObject({ from: "2026-08-03", to: "2026-11-03" });
    expect(await prep(b, { period: "custom", from: "2026-10-05", to: "2026-10-10" })).toMatchObject({ count: 1, format: "pdf" });
  });
  it("refuses dates that cannot be, before the account opened, and too long a period", async () => {
    const b = bank(), custom = (from: string, to: string, kind = "statement") => code(prep(b, { period: "custom", from, to, kind }));
    expect(await custom("2026-10-10", "2026-10-01")).toBe("RANGE_INVALID");
    expect(await custom("", "2026-10-01")).toBe("RANGE_INVALID");
    expect(await custom("2019-03-13", "2026-10-01")).toBe("BEFORE_OPENING");
    expect(await custom("2024-11-03", "2026-11-03")).toBe("no error"); // exactly 24 months
    expect(await custom("2024-11-03", "2026-11-04")).toBe("PERIOD_TOO_LONG");
    expect(await custom("2025-11-03", "2026-11-03", "official")).toBe("no error"); // exactly 12 months
    expect(await custom("2025-11-03", "2026-11-04", "official")).toBe("PERIOD_TOO_LONG");
    expect(await code(prep(bank("alex", { statementDates: false }), { period: "custom", from: "2026-10-10", to: "2026-10-01" }))).toBe("NO_TRANSACTIONS");
  });
  it("refuses a period with nothing in it", async () => {
    expect(await code(prep(bank(), { accountId: "acc_save", period: "this" }))).toBe("NO_TRANSACTIONS");
    expect(await code(prep(bank("alex", { statementEmpty: false }), { accountId: "acc_save", period: "this" }))).toBe("no error");
  });
  it("offers the formats a document has", async () => {
    const b = bank();
    expect(await code(prep(b, { format: "csv" }))).toBe("no error");
    expect(await code(prep(b, { format: "ofx" }))).toBe("FORMAT_UNAVAILABLE");
    expect(await code(prep(b, { format: "ofx", allowOfxQif: true }))).toBe("no error");
    expect(await code(prep(b, { kind: "official", format: "csv" }))).toBe("FORMAT_UNAVAILABLE");
    expect(await code(prep(b, { kind: "bogus" }))).toBe("KIND_UNAVAILABLE");
  });
  it("a plain statement is free and needs no code; it remembers paperless for the account", async () => {
    const b = bank();
    const d = await b.call("bank.statements.deliver", { accountId: "acc_main", kind: "statement", period: "last", format: "csv", delivery: "email", paperless: false });
    expect(d).toMatchObject({ reference: "STM-20261103-0931", file: "statement-4410-2026-10-01-2026-10-31.csv", delivery: "email" });
    expect(await b.call("bank.accounts.get", { accountId: "acc_main" })).toMatchObject({ paperless: false, balance: 8720.76 });
    await b.call("bank.statements.deliver", { accountId: "acc_main", period: "last", paperless: true });
    expect((await b.call("bank.accounts.get", { accountId: "acc_main" })).paperless).toBe(true);
    expect(await code(b.call("bank.statements.deliver", { accountId: "acc_main", kind: "official", period: "last" }))).toBe("OTP_REQUIRED");
    expect(await code(b.call("bank.statements.issue", { accountId: "acc_main", kind: "statement", period: "last" }))).toBe("NOT_OFFICIAL");
  });
  it("an official statement takes the fee after the code, once", async () => {
    const b = bank();
    const input = { accountId: "acc_main", kind: "official", period: "last" };
    expect(await prep(b, { kind: "official" })).toMatchObject({ fee: 5, feeText: "$5.00", needsCode: true });
    expect(await code(b.call("bank.statements.issue", input))).toBe("OTP_REQUIRED");
    expect((await b.call("bank.accounts.get", { accountId: "acc_main" })).balance).toBe(8720.76);
    await verified(b);
    expect(await b.call("bank.statements.issue", input)).toMatchObject({ fee: 5, newBalanceText: "$8,715.76", availableText: "$8,597.36" });
    expect(await code(b.call("bank.statements.issue", input))).toBe("OTP_REQUIRED");
    expect((await b.call("bank.accounts.get", { accountId: "acc_main" })).balance).toBe(8715.76);
    expect(await code(bank("alex", { issueNeedsCode: false }).call("bank.statements.issue", input))).toBe("no error");
  });
  it("the fee is in the account's currency, and refused before the code when there is not enough", async () => {
    const eur = await prep(bank(), { accountId: "acc_eur", kind: "certificate" });
    expect(eur).toMatchObject({ fee: 4.63, feeText: "€4.63" });
    expect((await prep(bank("alex", { feeConvert: false }), { accountId: "acc_eur", kind: "certificate" })).fee).toBe(5);
    const spare = { accountId: "acc_spare", kind: "official", period: "custom", from: "2026-10-01", to: "2026-10-31" };
    expect(await code(prep(bank("alexaccounts"), spare))).toBe("FEE_INSUFFICIENT_FUNDS");
    expect(await code(prep(bank("alexaccounts", { feeFunds: false }), spare))).toBe("no error");
    expect(await prep(bank("alexaccounts"), { ...spare, fee: false })).toMatchObject({ fee: 0, feeText: "" });
  });
  it("a letter and a certificate have no period; a letter for a dormant account is refused", async () => {
    const b = bank("alexaccounts");
    expect(await prep(b, { kind: "letter" })).toMatchObject({ periodText: "As of 3 Nov 2026", file: "address-letter-4410-2026-11-03.pdf", fee: 0, needsCode: true });
    expect(await prep(b, { kind: "certificate", accountId: "acc_save" })).toMatchObject({ file: "balance-certificate-7731-2026-11-03.pdf", fee: 5 });
    expect(await code(prep(b, { kind: "letter", accountId: "acc_old" }))).toBe("ACCOUNT_DORMANT");
    expect(await code(prep(bank("alexaccounts", { letterDormant: false }), { kind: "letter", accountId: "acc_old" }))).toBe("no error");
  });
});

describe("budgets", () => {
  it("says how far each is used: on track below 80%, close from 80%, over from 100%", async () => {
    const list = Object.values(await bank("alexaccounts").call("bank.budgets.list")) as any[];
    expect(list.map((b) => [b.name, b.pct, b.chip, b.barPct])).toEqual([
      ["Food & Drinks", 79, "On track", 79], ["Shopping", 80, "Close to limit", 80], ["Transport", 99, "Close to limit", 99], ["Health", 100, "Over budget", 100],
      ["Travel", 320, "Over budget", 100], ["Bills", 0, "On track", 0], ["Entertainment", 90, "Close to limit", 90], ["Subscriptions", 80, "Close to limit", 80],
    ]);
    expect(list[7]).toMatchObject({ line: "$32.00 of $40.00 · last 30 days", leftText: "$8.00", canAdd: false });
    const flawed = Object.values(await bank("alexaccounts", { budgetChips: false }).call("bank.budgets.list")) as any[];
    expect(flawed.every((b) => b.chip === "On track")).toBe(true);
  });
  it("Alex has three, in the order created, and more can be added", async () => {
    const list = Object.values(await bank().call("bank.budgets.list")) as any[];
    expect(list.map((b) => [b.name, b.chip, b.canAdd])).toEqual([["Food & Drinks", "On track", true], ["Shopping", "On track", true], ["Entertainment", "Close to limit", true]]);
    expect(await bank("sam").call("bank.budgets.list")).toEqual({});
    expect(await bank("ayesha").call("bank.budgets.list")).toEqual({});
  });
  it("creates one per category from 10.00 to 100,000.00, counting the last 30 days of spending", async () => {
    const b = bank();
    expect(await code(b.call("bank.budgets.create", { category: "Food & Drinks", limit: 200 }))).toBe("BUDGET_EXISTS");
    expect(await code(b.call("bank.budgets.create", { category: "Travel", limit: 9.99 }))).toBe("INVALID_AMOUNT");
    expect(await code(b.call("bank.budgets.create", { category: "Travel", limit: 100000.01 }))).toBe("INVALID_AMOUNT");
    expect(await code(b.call("bank.budgets.create", { category: "Travel", limit: 10.005 }))).toBe("INVALID_AMOUNT");
    expect(await code(b.call("bank.budgets.create", { category: "", limit: 100 }))).toBe("CATEGORY_REQUIRED");
    expect(await code(b.call("bank.budgets.create", { category: "Pets", limit: 100 }))).toBe("CATEGORY_REQUIRED");
    expect(await b.call("bank.budgets.create", { category: "Health", limit: 150, alert100: false })).toEqual({ budgetId: "b_health", name: "Health", limit: 150 });
    expect((await b.call("bank.budgets.list")).b_health).toMatchObject({ spent: 57.9, alert80: true, alert100: false, spentText: "$57.90" });
    expect(await b.call("bank.spending.byCategory", { category: "Health" })).toEqual({ id: "Health", category: "Health", amount: 57.9, text: "$57.90", hasBudget: true, budgetId: "b_health", days: 30 });
    expect(await b.call("bank.budgets.create", { category: "Bills", limit: 100000 })).toMatchObject({ limit: 100000 });
    expect(await code(bank("alex", { budgetAmount: false }).call("bank.budgets.create", { category: "Travel", limit: 5 }))).toBe("no error");
    expect(await code(bank("alex", { budgetDuplicate: false }).call("bank.budgets.create", { category: "Shopping", limit: 5000 }))).toBe("no error");
  });
  it("changes and removes one", async () => {
    const b = bank();
    expect(await code(b.call("bank.budgets.update", { budgetId: "b_nope", limit: 100 }))).toBe("BUDGET_NOT_FOUND");
    expect(await code(b.call("bank.budgets.update", { budgetId: "b_food", limit: 5 }))).toBe("INVALID_AMOUNT");
    expect(await b.call("bank.budgets.update", { budgetId: "b_food", limit: 350, alert80: false })).toEqual({ budgetId: "b_food", name: "Food & Drinks", limit: 350 });
    expect((await b.call("bank.budgets.list")).b_food).toMatchObject({ limit: 350, alert80: false, alert100: true });
    expect(await b.call("bank.budgets.delete", { budgetId: "b_food" })).toEqual({ budgetId: "b_food", name: "Food & Drinks" });
    expect(await code(b.call("bank.budgets.delete", { budgetId: "b_food" }))).toBe("BUDGET_NOT_FOUND");
    expect(Object.keys(await b.call("bank.budgets.list"))).toEqual(["b_shop", "b_ent"]);
  });
  it("counts spending by category over the last 30 days", async () => {
    const all = await bank().call("bank.spending.byCategory", { days: 30 });
    expect(Object.values(all).filter((x: any) => x.hasBudget).map((x: any) => x.budgetId)).toEqual(["b_food", "b_shop", "b_ent"]);
    expect(Object.values(all).map((x: any) => [x.category, x.amount])).toEqual([["Food & Drinks", 64.6], ["Shopping", 118.4], ["Transport", 78.1], ["Health", 57.9], ["Travel", 0], ["Bills", 1450], ["Entertainment", 32], ["Subscriptions", 14.99]]);
  });
});

describe("the speeds on offer", () => {
  it("lists the speeds for another bank and for another country with their arrival, fee and limit, naming no scheme and no country", async () => {
    const s = await bank().call("bank.payments.speeds");
    expect(s.domestic).toEqual([
      { id: "standard", speed: "Standard", arrives: "1 to 2 business days", fee: "Free", limit: "$25,000.00" },
      { id: "sameDay", speed: "Same day", arrives: "Today", fee: "$1.00", limit: "None" },
      { id: "instant", speed: "Instant", arrives: "In seconds", fee: "$0.25", limit: "$500,000.00" },
    ]);
    expect(s.international).toEqual([{ id: "standard", speed: "Standard", arrives: "1 to 3 business days", fee: "$25.00", limit: "None" }]);
    expect([s.domesticLine, s.internationalLine]).toEqual(["Standard, Same day, Instant", "Standard"]);
  });
  it("names no payment scheme and no country in any home market", async () => {
    for (const homeMarket of ["us", "uk", "eu", "ae", "sa", "jo"] as const) {
      const s = await new MockBank("alex", { now: Date.parse(NOW), config: { homeMarket } }).call("bank.payments.speeds", { priority: true });
      expect(JSON.stringify(s), homeMarket).not.toMatch(/ACH|RTP|SWIFT|SEPA|CHAPS|BACS|FPS|FASTER PAYMENTS|CLIQ|AANI|SARIE|UAEFTS|FEDWIRE|UNITED|GERMANY|CANADA|JORDAN|EMIRATES|SAUDI/i);
      expect(s.domestic.length, homeMarket).toBeGreaterThanOrEqual(2);
    }
  });
  it("follows the bank's home market and the speeds it switches off", async () => {
    const eu = new MockBank("alex", { now: Date.parse(NOW), config: { homeMarket: "eu" } });
    expect((await eu.call("bank.payments.speeds")).domesticLine).toBe("Standard, Instant");
    const s = await bank().call("bank.payments.speeds", { sameDay: false, priority: true });
    expect([s.domesticLine, s.internationalLine]).toEqual(["Standard, Instant", "Standard, Priority"]);
  });
});
