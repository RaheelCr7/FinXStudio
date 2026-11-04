import { afterEach, describe, expect, it, vi } from "vitest";
import { addMoney } from "@finx/journey-schema";
import { BankApp, createLive } from "./index";

const down = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
const studio = (journeys: any[], get: Record<string, unknown> = {}) => (async (url: string) => {
  const path = url.replace("http://studio", "");
  const body = path === "/api/journeys" ? journeys : get[path];
  return { ok: body !== undefined, status: body !== undefined ? 200 : 404, json: async () => body };
}) as unknown as typeof fetch;
const make = (brand: "meezan" | "bankworkx", fetchImpl: typeof fetch = down, extra: object = {}) =>
  new BankApp({ preset: brand, live: createLive({ brand, fetch: fetchImpl }), studioUrl: "http://studio", toastMs: 20, ...extra });

afterEach(() => vi.useRealTimers());

describe("signing in and out", () => {
  it("starts on the sign-in screen with the first customer of this bank, and tells listeners about changes", () => {
    const a = make("bankworkx");
    expect(a.getState()).toMatchObject({ screen: "login", personaId: "alex", tab: "dashboard", lang: "en" });
    expect(a.personas().map((p) => p.id)).toEqual(["alex", "alexglobal", "alexpayees", "alexfull", "alexbills", "sam"]);
    let calls = 0; const off = a.subscribe(() => { calls++; });
    a.selectPersona("sam");
    expect(a.persona.name).toMatch(/Sam/);
    expect(calls).toBeGreaterThan(0);
    off(); const before = calls; a.setLang("ur"); expect(calls).toBe(before);
    expect(make("meezan").getState().personaId).toBe("ayesha");
  });

  it("signing in opens the dashboard, and signing out resets the sandbox and every overlay", async () => {
    const a = make("bankworkx");
    a.login();
    expect(a.getState()).toMatchObject({ screen: "app", tab: "dashboard" });
    a.openBudget("b_food"); a.openInvest(); a.openSheet("fab");
    await a.bank.call("bank.invest.buy", { symbol: "GLBX", amount: 100, fromAccountId: "acc_main" });
    const bankBefore = a.bank;
    a.logout();
    expect(a.getState()).toMatchObject({ screen: "login", budgetId: null, investView: null, sheet: null });
    expect(a.bank).not.toBe(bankBefore);
    expect(a.persona.accounts[0]!.balance).toBe(8720.76);
  });

  it("keeps the bank adapter the same until the bank changes", () => {
    const a = make("bankworkx");
    const first = a.adapter;
    expect(a.adapter).toBe(first);
    a.selectPersona("sam");
    expect(a.adapter).not.toBe(first);
  });

  it("toggles the language", () => {
    const a = make("meezan");
    a.toggleLang(); expect(a.getState().lang).toBe("ur");
    a.toggleLang(); expect(a.getState().lang).toBe("en");
  });
});

describe("places", () => {
  it("moves between tabs, budgets, invest and sheets", () => {
    const a = make("bankworkx"); a.login();
    a.setTab("wallet"); expect(a.getState().tab).toBe("wallet");
    a.openInstrument("LMRB"); expect(a.getState().investView).toEqual({ symbol: "LMRB" });
    a.backInvest(); expect(a.getState().investView).toEqual({});
    a.backInvest(); expect(a.getState().investView).toBeNull();
    a.openSheet("notes"); a.closeSheet(); expect(a.getState().sheet).toBeNull();
    a.openBudget("b_food"); expect(a.getState().budgetId).toBe("b_food"); a.closeBudget(); expect(a.getState().budgetId).toBeNull();
  });
});

describe("journeys", () => {
  it("loads the catalog from Studio when signing in, and uses bundled copies when Studio is down", async () => {
    const a = make("bankworkx", studio([{ slug: "add-money", name: "Add money", publishedVersion: 3, apps: ["bankworkx"] }]));
    expect(a.getState().catalog.source).toBe("bundled");
    a.login(); await vi.waitFor(() => expect(a.getState().catalog.source).toBe("studio"));
    expect(a.getState().catalog.entries).toEqual([{ slug: "add-money", name: "Add money", version: 3 }]);
  });

  it("opens a journey (even a copy made for this bank), fills in answers, and refreshes everything when it closes", async () => {
    const copy = { ...addMoney, slug: "add-money-acme", id: "jrn_add_money_acme" };
    const a = make("bankworkx", studio([{ slug: "add-money-acme", name: "Add money", publishedVersion: 1, apps: ["bankworkx"] }], { "/api/journeys/add-money-acme?env=published": copy }));
    a.login(); await vi.waitFor(() => expect(a.getState().catalog.source).toBe("studio"));
    const opening = a.openJourney("add-money", { "add.toAccountId": "acc_main" });
    expect(a.getState().opening).toBe("add-money-acme");
    await opening;
    expect(a.getState()).toMatchObject({ screen: "journey", opening: null, active: { source: "studio", initial: { "add.toAccountId": "acc_main" } } });
    const tick = a.getState().tick;
    a.closeJourney();
    expect(a.getState()).toMatchObject({ screen: "app", active: null });
    expect(a.getState().tick).toBe(tick + 1);
  });

  it("says so, and stays put, when a journey is not available", async () => {
    const a = make("bankworkx"); a.login();
    await a.openJourney("no-such-journey");
    expect(a.getState()).toMatchObject({ screen: "app", opening: null, toast: { text: "That journey is not available right now.", ok: false } });
  });

  it("uses the bundled copy offline", async () => {
    const a = make("bankworkx"); a.login();
    await a.openJourney("invest");
    expect(a.getState()).toMatchObject({ screen: "journey", active: { source: "bundled" } });
  });
});

describe("fetching a journey for an address-driven app", () => {
  it("resolves names to this bank's copies and loads without changing the screen", async () => {
    const copy = { ...addMoney, slug: "add-money-acme", id: "jrn_add_money_acme" };
    const a = make("bankworkx", studio([{ slug: "add-money-acme", name: "Add money", publishedVersion: 1, apps: ["bankworkx"] }], { "/api/journeys/add-money-acme?env=published": copy }));
    a.login(); await vi.waitFor(() => expect(a.getState().catalog.source).toBe("studio"));
    expect(a.resolveSlug("add-money")).toBe("add-money-acme");
    expect(a.resolveSlug("invest")).toBe("invest");
    const l = await a.fetchJourney("add-money");
    expect(l).toMatchObject({ source: "studio" });
    expect(a.getState().screen).toBe("app");
    expect(await make("bankworkx").fetchJourney("nope")).toBeNull();
  });
});

describe("payments and notices", () => {
  it("pays a subscription from the first account and says so", async () => {
    const a = make("bankworkx"); a.login();
    a.paySubscription("s_google");
    expect(a.getState().subId).toBe("s_google");
    await a.confirmPayment();
    expect(a.persona.accounts[0]!.balance).toBe(8699.76);
    expect(a.getState()).toMatchObject({ subId: null, paying: false, toast: { text: "Paid Google One $21", ok: true } });
  });

  it("explains a failed payment and does nothing without a subscription chosen", async () => {
    const a = make("bankworkx"); a.login();
    await a.confirmPayment(); expect(a.getState().toast).toBeNull();
    a.paySubscription("s_google");
    a.persona.accounts[0]!.balance = 1;
    await a.confirmPayment();
    expect(a.getState()).toMatchObject({ paying: false, subId: "s_google", toast: { text: "Insufficient funds", ok: false } });
    a.cancelPayment(); expect(a.getState().subId).toBeNull();
  });

  it("clears a notice after a moment, and a new notice replaces the old one", async () => {
    const a = make("bankworkx");
    a.say("one"); a.say("two", false);
    expect(a.getState().toast).toEqual({ text: "two", ok: false });
    await vi.waitFor(() => expect(a.getState().toast).toBeNull());
    a.dispose();
  });
});

describe("the project's bank API", () => {
  it("a corporate customer's company sits behind the API the project runs against", async () => {
    const ids: Record<string, string> = {};
    for (const bankApi of [undefined, "reference", "bank-b"] as const) {
      const app = make("meezan", down, { defaultPersona: "acme", bankApi });
      await app.bank.call("bank.otp.send"); await app.bank.call("bank.otp.verify", { code: "482100" });
      const p = await app.adapter("corp.payments.initiate", { userId: "sara", fromAccountId: "acme_ops", beneficiaryId: "sup_textile", amount: 1000 });
      ids[String(bankApi)] = p.id;
    }
    expect(ids["undefined"]).toBe("pay_1"); expect(ids["reference"]).toBe("pay_1");
    expect(ids["bank-b"]).toBe("TXN-000001"); // Bank B numbers its own transactions
  });
  it("ignores a bank API it does not know instead of breaking", () => {
    const app = make("meezan", down, { defaultPersona: "acme", bankApi: "bank-z" });
    expect(app.persona.id).toBe("acme");
  });
});
