import { describe, it, expect } from "vitest";
import { defaultPersonaFor, MockBank, BankError, ADAPTER_CATALOG, describePersonas, personasFor, INSTRUMENTS, RANGES, portfolioSeries } from "./index";

describe("mock bank sandbox", () => {
  it("lists accounts and limits for Ayesha", async () => {
    const b = new MockBank("ayesha");
    const accs = await b.call("bank.accounts.list");
    expect(Object.keys(accs)).toEqual(["acc_current", "acc_savings"]);
    expect((await b.call("bank.limits.get")).daily).toBe(50000);
  });
  it("requires OTP before a transfer", async () => {
    const b = new MockBank("ayesha");
    await expect(b.call("bank.transfers.create", { fromAccountId: "acc_current", amount: 100 })).rejects.toMatchObject({ code: "OTP_REQUIRED" });
  });
  it("moves money and consumes limit after OTP", async () => {
    const b = new MockBank("ayesha");
    await b.call("bank.otp.send");
    await b.call("bank.otp.verify", { code: "482100" });
    const r = await b.call("bank.transfers.create", { fromAccountId: "acc_current", amount: 25000 });
    expect(r.newBalance).toBe(159250);
    expect((await b.call("bank.limits.get")).usedToday).toBe(25000);
  });
  it("rejects a wrong OTP", async () => {
    const b = new MockBank("ayesha");
    await b.call("bank.otp.send");
    await expect(b.call("bank.otp.verify", { code: "999999" })).rejects.toBeInstanceOf(BankError);
  });
  it("Bilal's transfer fails at the core", async () => {
    const b = new MockBank("bilal");
    await b.call("bank.otp.send");
    await b.call("bank.otp.verify", { code: "111111" });
    await expect(b.call("bank.transfers.create", { fromAccountId: "acc_current", amount: 1000 })).rejects.toMatchObject({ code: "CORE_UNAVAILABLE" });
  });

  it("looks up a bill by reference and rejects a malformed one", async () => {
    const b = new MockBank("ayesha");
    const bill = await b.call("bank.bills.lookup", { billerId: "k_electric", reference: "0123456789" });
    expect(bill).toMatchObject({ billerName: "K-Electric", payerName: "Ayesha Rahman", amount: 1000 + (6789 % 9000) });
    await expect(b.call("bank.bills.lookup", { billerId: "k_electric", reference: "12" })).rejects.toMatchObject({ code: "BILL_NOT_FOUND" });
  });
  it("pays a bill only after OTP and uses the daily limit", async () => {
    const b = new MockBank("ayesha");
    await expect(b.call("bank.bills.pay", { fromAccountId: "acc_current", amount: 5000 })).rejects.toMatchObject({ code: "OTP_REQUIRED" });
    await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" });
    const r = await b.call("bank.bills.pay", { fromAccountId: "acc_current", amount: 7789 });
    expect(r.reference).toMatch(/^BILL-/);
    expect((await b.call("bank.limits.get")).usedToday).toBe(7789);
  });
  it("top-up enforces the 50 to 5,000 range", async () => {
    const b = new MockBank("ayesha");
    await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" });
    await expect(b.call("bank.topup.create", { fromAccountId: "acc_current", amount: 9000 })).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
    expect((await b.call("bank.topup.create", { fromAccountId: "acc_current", amount: 500 })).reference).toMatch(/^TOP-/);
  });

  it("every adapter in the catalog is implemented by the sandbox", async () => {
    for (const a of ADAPTER_CATALOG) {
      const b = new MockBank("ayesha");
      const r = await b.call(a.adapter, {}).catch((e) => e);
      expect(r instanceof BankError && r.code === "UNKNOWN_ADAPTER", a.adapter).toBe(false);
    }
  });
  it("catalog ids are unique and OTP verification uses the id the engine counts failures for", () => {
    const ids = ADAPTER_CATALOG.map((a) => a.suggestedId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ADAPTER_CATALOG.find((a) => a.adapter === "bank.otp.verify")!.suggestedId).toBe("otpVerify");
  });
  it("describes the sandbox customers with their test OTPs, per bank app", () => {
    expect(describePersonas().map((p) => [p.id, p.otpCode])).toEqual([["ayesha", "482100"], ["bilal", "111111"], ["alex", "482100"], ["alexglobal", "482100"], ["alexpayees", "482100"], ["alexfull", "482100"], ["alexbills", "482100"], ["alextopup", "482100"], ["alexsched", "482100"], ["sam", "123456"], ["zara", "123456"], ["hina", "482100"], ["acme", "482100"], ["nour", "482100"], ["sara", "482100"], ["yasmin", "482100"], ["lina", "482100"], ["omar", "482100"], ["alexbiz", "482100"], ["demolocked", "482100"], ["demoexpired", "482100"], ["demoinactive", "482100"], ["demonew", "482100"]]);
    expect(personasFor("meezan").map((p) => p.id)).toEqual(["ayesha", "bilal", "zara", "hina", "acme"]);
    expect(personasFor("bankworkx").map((p) => p.id)).toEqual(["alex", "alexglobal", "alexpayees", "alexfull", "alexbills", "alextopup", "alexsched", "sam", "alexbiz", "demolocked", "demoexpired", "demoinactive", "demonew"]);
  });
});


describe("BankWorkx sandbox", () => {
  it("adds money from a saved card and records it", async () => {
    const b = new MockBank("alex");
    const r = await b.call("bank.deposit.create", { toAccountId: "acc_main", fromCardId: "c_5832", amount: 150 });
    expect(r.newBalance).toBe(8870.76);
    expect(b.persona.finance!.transactions[0]).toMatchObject({ title: "Added money", amount: 150 });
  });
  it("limits deposits to $1 to $50,000", async () => {
    const b = new MockBank("alex");
    await expect(b.call("bank.deposit.create", { toAccountId: "acc_main", fromCardId: "c_5832", amount: 50001 })).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
    await expect(b.call("bank.deposit.create", { toAccountId: "acc_main", fromCardId: "nope", amount: 5 })).rejects.toMatchObject({ code: "CARD_NOT_FOUND" });
  });
  it("adds a card only when the number passes the Luhn check and the dates make sense", async () => {
    const b = new MockBank("alex");
    const ok = await b.call("bank.cards.add", { number: "4242 4242 4242 4242", holder: "Alex Morgan", expiry: "12/29", cvv: "123", nickname: "Travel" });
    expect(ok).toMatchObject({ last4: "4242", network: "visa" });
    await expect(b.call("bank.cards.add", { number: "4242 4242 4242 4241", expiry: "12/29", cvv: "123" })).rejects.toMatchObject({ code: "CARD_INVALID" });
    await expect(b.call("bank.cards.add", { number: "5555 5555 5555 4444", expiry: "01/20", cvv: "123" })).rejects.toMatchObject({ code: "CARD_EXPIRED" });
    await expect(b.call("bank.cards.add", { number: "5555 5555 5555 4444", expiry: "13/29", cvv: "123" })).rejects.toMatchObject({ code: "EXPIRY_INVALID" });
    await expect(b.call("bank.cards.add", { number: "4242 4242 4242 4242", expiry: "12/29", cvv: "123" })).rejects.toMatchObject({ code: "CARD_EXISTS" });
  });
  it("connects a bank, refuses a bad login, and does not connect twice", async () => {
    const b = new MockBank("alex");
    await expect(b.call("bank.accounts.connect", { bankId: "northwind", username: "alex", password: "invalid123" })).rejects.toMatchObject({ code: "BANK_AUTH_FAILED" });
    const r = await b.call("bank.accounts.connect", { bankId: "northwind", username: "alex", password: "sandbox1", accountType: "credit" });
    expect(r).toMatchObject({ bank: "Northwind Bank", kind: "Credit" });
    await expect(b.call("bank.accounts.connect", { bankId: "northwind", username: "alex", password: "sandbox1" })).rejects.toMatchObject({ code: "ALREADY_CONNECTED" });
  });
  it("creates a budget once per category and pays a subscription", async () => {
    const b = new MockBank("alex");
    await expect(b.call("bank.budgets.create", { category: "Food & Drinks", limit: 200 })).rejects.toMatchObject({ code: "BUDGET_EXISTS" });
    expect(await b.call("bank.budgets.create", { category: "Travel", limit: 500 })).toMatchObject({ name: "Travel", limit: 500 });
    const r = await b.call("bank.subscriptions.pay", { subscriptionId: "s_google", fromAccountId: "acc_main" });
    expect(r.newBalance).toBe(8699.76);
  });
  it("gives a new customer empty data", () => {
    expect(new MockBank("sam").persona.finance!.cards).toEqual([]);
  });
});

describe("sandbox investing", () => {
  it("lists made-up instruments and starts the demo customer with holdings and a watchlist", async () => {
    const b = new MockBank("alex");
    const list = await b.call("bank.invest.instruments", {});
    expect(Object.keys(list)).toEqual(["LMRB", "APXC", "HBRE", "ORCH", "SMTH", "MRDB", "GLBX", "GRNF", "TBND"]);
    expect(list.GLBX).toMatchObject({ kind: "fund", price: 42.18 });
    expect(b.persona.finance!.invest.holdings.map((h) => h.symbol)).toEqual(["LMRB", "GLBX", "ORCH", "TBND"]);
    expect(new MockBank("sam").persona.finance!.invest).toEqual({ holdings: [], watchlist: [] });
  });
  it("draws the same chart every time, ending at today's price", () => {
    for (const i of INSTRUMENTS) for (const r of RANGES) { expect(i.series[r].at(-1)!.value).toBe(i.price); expect(i.series[r]).toEqual(INSTRUMENTS.find((x) => x.symbol === i.symbol)!.series[r]); }
    expect(portfolioSeries([{ symbol: "GLBX", shares: 2, avgCost: 40 }], "1W").at(-1)!.value).toBe(84.36);
    expect(portfolioSeries([], "1W")).toEqual([]);
  });
  it("buys into an existing holding at an average cost, and refuses bad orders", async () => {
    const b = new MockBank("alex");
    const out = await b.call("bank.invest.buy", { symbol: "GLBX", amount: 421.8, fromAccountId: "acc_main" });
    expect(out).toMatchObject({ shares: 10, newBalance: 8298.96 });
    const h = b.persona.finance!.invest.holdings.find((x) => x.symbol === "GLBX")!;
    expect(h.shares).toBe(50); expect(h.avgCost).toBeCloseTo((38.5 * 40 + 421.8) / 50, 6);
    await expect(b.call("bank.invest.buy", { symbol: "NOPE", amount: 10, fromAccountId: "acc_main" })).rejects.toMatchObject({ code: "INSTRUMENT_NOT_FOUND" });
    await expect(b.call("bank.invest.buy", { symbol: "GLBX", amount: 0.5, fromAccountId: "acc_main" })).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
    await expect(b.call("bank.invest.buy", { symbol: "GLBX", amount: 20000, fromAccountId: "acc_main" })).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" });
  });
  it("adds and removes watchlist entries", async () => {
    const b = new MockBank("alex");
    await b.call("bank.invest.watch", { symbol: "HBRE" });
    await b.call("bank.invest.watch", { symbol: "APXC", on: false });
    expect(b.persona.finance!.invest.watchlist).toEqual(["SMTH", "GRNF", "HBRE"]);
  });
  it("sells part or all of a holding and refuses what is not owned or too much", async () => {
    const b = new MockBank("alex");
    expect(Object.keys(await b.call("bank.invest.holdings", {}))).toEqual(["LMRB", "GLBX", "ORCH", "TBND"]);
    const part = await b.call("bank.invest.sell", { symbol: "GLBX", amount: 421.8, toAccountId: "acc_main" });
    expect(part).toMatchObject({ shares: 10, proceeds: 421.8, newBalance: 9142.56 });
    expect(b.persona.finance!.invest.holdings.find((h) => h.symbol === "GLBX")!.shares).toBe(30);
    await expect(b.call("bank.invest.sell", { symbol: "APXC", amount: 10, toAccountId: "acc_main" })).rejects.toMatchObject({ code: "NOT_HELD" });
    await expect(b.call("bank.invest.sell", { symbol: "GLBX", amount: 99999, toAccountId: "acc_main" })).rejects.toMatchObject({ code: "INSUFFICIENT_HOLDING" });
    await expect(b.call("bank.invest.sell", { symbol: "GLBX", amount: 0, toAccountId: "acc_main" })).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
    const all = await b.call("bank.invest.sell", { symbol: "GLBX", amount: 30 * 42.18, toAccountId: "acc_main" });
    expect(all.shares).toBe(30);
    expect(b.persona.finance!.invest.holdings.some((h) => h.symbol === "GLBX")).toBe(false);
  });
});

describe("accounts in several currencies", () => {
  const verified = async () => { const b = new MockBank("hina"); await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" }); return b; };
  it("lists an account per currency, each with its own balance and currency", async () => {
    const accs = await new MockBank("hina").call("bank.accounts.list");
    expect(Object.values<any>(accs).map((a) => [a.id, a.currency, a.balance])).toEqual([["acc_pkr", "PKR", 320000], ["acc_usd", "USD", 4200.5], ["acc_aed", "AED", 15000], ["acc_kwd", "KWD", 120.75]]);
  });
  it("adds balances up per currency and never across currencies", async () => {
    const b = new MockBank("hina");
    const t = await b.call("bank.accounts.totals");
    expect(Object.keys(t)).toEqual(["PKR", "USD", "AED", "KWD"]);
    expect(t.KWD).toEqual({ id: "KWD", currency: "KWD", total: 120.75, count: 1 });
    const a = new MockBank("ayesha");
    expect((await a.call("bank.accounts.totals")).PKR).toMatchObject({ total: 1434250, count: 2 });
  });
  it("has a daily limit for each currency, and the main one is unchanged", async () => {
    const b = new MockBank("hina");
    expect(await b.call("bank.limits.get")).toEqual({ daily: 50000, usedToday: 0 });
    expect(await b.call("bank.limits.get", { currency: "USD" })).toEqual({ daily: 2000, usedToday: 0, currency: "USD" });
    expect(await b.call("bank.limits.get", { currency: "KWD" })).toMatchObject({ daily: 300 });
    await expect(b.call("bank.limits.get", { currency: "EUR" })).rejects.toMatchObject({ code: "LIMIT_NOT_SET" });
  });
  it("takes a transfer from the account in its own currency, against that currency's limit", async () => {
    const b = await verified();
    const r = await b.call("bank.transfers.create", { fromAccountId: "acc_kwd", amount: 20.25 });
    expect(r).toMatchObject({ newBalance: 100.5, currency: "KWD" });
    expect((await b.call("bank.limits.get", { currency: "KWD" })).usedToday).toBe(20.25);
    expect((await b.call("bank.limits.get")).usedToday).toBe(0); // PKR limit untouched
  });
  it("refuses more than that currency's balance or limit", async () => {
    let b = await verified();
    await expect(b.call("bank.transfers.create", { fromAccountId: "acc_usd", amount: 2500 })).rejects.toMatchObject({ code: "LIMIT_EXCEEDED" }); // balance is enough, USD limit is 2,000
    b = await verified();
    await expect(b.call("bank.transfers.create", { fromAccountId: "acc_kwd", amount: 250 })).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" });
  });
});

describe("corporate payments through the bank", () => {
  const acting = async (id = "acme") => { const b = new MockBank(id); await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" }); return b; };
  it("shows the company to the signed-in user, with their own remaining limit", async () => {
    const c = await new MockBank("acme").call("corp.company.get", { userId: "omar" });
    expect(c).toMatchObject({ name: "Acme Trading Co.", currency: "PKR", dualApprovalAbove: 1_000_000, cutoff: "16:00", me: { id: "omar", roles: ["initiator"], remainingToday: 500_000 } });
    expect(Object.keys(c.accounts)).toEqual(["acme_ops", "acme_usd"]);
    expect(c.beneficiaries.sup_textile.displayName).toBe("Crescent Textiles");
  });
  it("needs the one-time code to start and to approve, but not to reject", async () => {
    const b = new MockBank("acme");
    await expect(b.call("corp.payments.initiate", { userId: "sara", fromAccountId: "acme_ops", beneficiaryId: "sup_textile", amount: 1000 })).rejects.toMatchObject({ code: "OTP_REQUIRED" });
    await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" });
    const p = await b.call("corp.payments.initiate", { userId: "sara", fromAccountId: "acme_ops", beneficiaryId: "sup_textile", amount: 1000 });
    expect(p.status).toBe("pending_approval");
    await expect(b.call("corp.payments.approve", { userId: "hassan", paymentId: p.id })).rejects.toMatchObject({ code: "OTP_REQUIRED" }); // the code was used up by the first step
    expect((await b.call("corp.payments.reject", { userId: "hassan", paymentId: p.id, reason: "Not today" })).status).toBe("rejected");
  });
  it("runs a payment from start to release across two people", async () => {
    const b = await acting();
    const p = await b.call("corp.payments.initiate", { userId: "sara", fromAccountId: "acme_ops", beneficiaryId: "sup_logistics", amount: 250_000, reference: "INV-77" });
    expect(Object.keys(await b.call("corp.payments.pending", { userId: "hassan" }))).toEqual([p.id]);
    await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" });
    const done = await b.call("corp.payments.approve", { userId: "hassan", paymentId: p.id });
    expect(done).toMatchObject({ status: "released", reference: "INV-77" });
    expect((await b.call("corp.company.get", { userId: "sara" })).accounts.acme_ops.balance).toBe(24_750_000);
    expect(await b.call("corp.payments.pending", { userId: "hassan" })).toEqual({});
  });
  it("is only for a company customer", async () => {
    await expect(new MockBank("ayesha").call("corp.company.get", { userId: "x" })).rejects.toMatchObject({ code: "NOT_SUPPORTED" });
  });
});

describe("which sandbox customer a journey previews with", () => {
  const people = personasFor("meezan");
  it("picks a company for corporate adapters, a Cairo Amman Bank profile for cab adapters, otherwise the first", () => {
    expect(defaultPersonaFor(people, [{ adapter: "corp.company.get" }]).id).toBe("acme");
    expect(defaultPersonaFor(personasFor("meezan", "cab"), [{ adapter: "cab.auth.signIn" }]).id).toBe("nour");
    expect(defaultPersonaFor(people, [{ adapter: "bank.accounts.list" }]).id).toBe("ayesha");
    expect(defaultPersonaFor(people).id).toBe("ayesha");
    expect(defaultPersonaFor(personasFor("bankworkx"), [{ adapter: "corp.company.get" }]).id).toBe("alex"); // none has a company: the first
  });
});
