import { describe, it, expect } from "vitest";
import { addCard, addMoney, bankworkxJourneys, connectAccount, createBudget, invest, sellInvestment, type Journey } from "@finx/journey-schema";
import { MockBank } from "@finx/mock-bank-api";
import { JourneyRunner } from "./runner";
import { cardExpiryValid, luhnValid } from "./card";
import { lintAll } from "./lint-expr";

const mk = (j: Journey, persona = "alex") => {
  const bank = new MockBank(persona);
  return { bank, r: new JourneyRunner(j, { adapter: (id, input) => bank.call(id, input) }) };
};
const press = async (r: JourneyRunner, label: string) => {
  const btn = r.view().blocks.find((b) => b.type === "button" && b.label === label);
  if (!btn) throw new Error(`No button "${label}" on ${r.current}. Buttons: ${r.view().blocks.filter((b) => b.type === "button").map((b) => b.label).join(", ")}`);
  await r.press(btn.actions);
};

describe("BankWorkx journeys are valid", () => {
  for (const j of bankworkxJourneys) it(`${j.slug} passes lint and is only for BankWorkx`, () => {
    expect(lintAll(j)).toEqual([]);
    expect(j.apps).toEqual(["bankworkx"]);
  });
});

describe("card checks", () => {
  it("accepts real test numbers and rejects typos", () => {
    expect(luhnValid("4242 4242 4242 4242")).toBe(true);
    expect(luhnValid("5555555555554444")).toBe(true);
    expect(luhnValid("4242 4242 4242 4241")).toBe(false);
    expect(luhnValid("1234")).toBe(false);
  });
  it("accepts an expiry through the end of its month, not before", () => {
    const now = new Date(2026, 10, 15);
    expect(cardExpiryValid("11/26", now)).toBe(true);
    expect(cardExpiryValid("10/26", now)).toBe(false);
    expect(cardExpiryValid("13/28", now)).toBe(false);
    expect(cardExpiryValid("1128", now)).toBe(false);
  });
});

describe("Add money", () => {
  const toCard = async () => { const m = mk(addMoney); await m.r.start(); await press(m.r, "Continue"); return m; };
  it("offers the two ways, then the accounts, the saved cards that can be used and the amount rules", async () => {
    const { r } = mk(addMoney); await r.start();
    expect(r.current).toBe("method");
    expect(r.view().blocks.find((b) => b.type === "select")!.items.map((a: any) => a.id)).toEqual(["card", "bank"]);
    await press(r, "Continue");
    expect(r.current).toBe("card");
    const selects = r.view().blocks.filter((b) => b.type === "select");
    expect(selects[0]!.items.map((a: any) => a.id)).toEqual(["acc_main", "acc_save"]);
    expect(selects[1]!.items[0]).toMatchObject({ id: "c_5832", name: "Mastercard ••5832" });
    expect(r.view().blocks.find((b) => b.type === "amountInput")!.validation).toMatchObject({ min: 10, max: 5000 });
  });
  it("checks the amount before continuing", async () => {
    const { r } = await toCard();
    await press(r, "Continue");
    expect(r.current).toBe("card");
    expect(Object.keys(r.errors)).toContain("am.amount");
    r.set("am.amount", 60000); r.set("am.cardId", "c_5832"); r.set("am.cvv", "123");
    await press(r, "Continue");
    expect(r.errors["am.amount"]).toBe("The most you can add at once is $5,000.00.");
  });
  it("adds money after a tick and a code and shows a reference; the account gets the amount, not the fee", async () => {
    const { r, bank } = await toCard();
    r.set("am.amount", 150); r.set("am.cardId", "c_5832"); r.set("am.cvv", "123");
    await press(r, "Continue");
    expect(r.current).toBe("review");
    expect(r.view().blocks.find((b) => b.type === "reviewSummary" && b.rows.some((x: any) => x.label === "Card fee"))!.rows.at(-1)).toEqual({ label: "Charged to your card", value: "$152.25" });
    r.set("am.consent", true); await press(r, "Confirm");
    expect(r.current).toBe("code");
    r.set("otp.code", "482100"); await press(r, "Add money");
    expect(r.current).toBe("done");
    expect(bank.persona.accounts[0]!.balance).toBe(8870.76);
    expect(r.view().blocks.find((b) => b.type === "result")!.meta).toMatch(/^Reference ADD-/);
    expect(r.get("am.cvv")).toBe("");
  });
});

describe("Add a card", () => {
  // the journey was rewritten for the Cards spec (the bank checks the card, a code proves it, a tick saves it); its full proof is in finx-mcp (add-card scenarios)
  const fill = (r: JourneyRunner, over: Record<string, string> = {}) => {
    const v = { number: "4242 4242 4242 4242", holder: "Alex Morgan", expiry: "12/29", cvv: "123", postcode: "62704", ...over };
    for (const [k, val] of Object.entries(v)) r.set(`ac.${k}`, val);
  };
  it("shows one error per field that is wrong", async () => {
    const { r } = mk(addCard); await r.start();
    fill(r, { number: "42a2", expiry: "13/29", cvv: "1", holder: "1", postcode: "" });
    await press(r, "Continue");
    expect(r.current).toBe("card");
    expect(Object.keys(r.errors).sort()).toEqual(["ac.cvv", "ac.expiry", "ac.holder", "ac.number", "ac.postcode"]);
    expect(r.errors["ac.number"]).toBe("Use digits only.");
  });
  it("saves a valid card after the code and the tick, and does not keep the number or the security code", async () => {
    const { r, bank } = mk(addCard); await r.start();
    fill(r);
    await press(r, "Continue");
    expect(r.current).toBe("verify");
    r.set("ac.code", "482100"); await press(r, "Continue");
    expect(r.current).toBe("name");
    r.set("ac.nick", "Travel");
    await press(r, "Save card");
    expect(r.errors["ac.consent"]).toBeTruthy();
    r.set("ac.consent", true);
    await press(r, "Save card");
    expect(r.current).toBe("done");
    expect(bank.persona.finance!.cards.map((c) => [c.last4, c.nickname, c.isDefault])).toEqual([["5832", "Everyday", true], ["4242", "Travel", false]]);
    expect([r.get("ac.number"), r.get("ac.cvv"), r.get("ac.code")]).toEqual(["", "", ""]);
  });
  it("stays on the card step when the card is already saved, with the bank's words", async () => {
    const { r } = mk(addCard); await r.start();
    fill(r, { number: "5200 8282 8282 8210", expiry: "11/28" });
    await press(r, "Continue");
    expect(r.current).toBe("verify");
    r.set("ac.code", "482100"); await press(r, "Continue");
    r.set("ac.consent", true); await press(r, "Save card");
    expect(r.current).toBe("done");
    await r.start();
    fill(r, { number: "5200 8282 8282 8210", expiry: "11/28" });
    await press(r, "Continue");
    expect(r.current).toBe("card");
  });
});

describe("Connect an account", () => {
  const toLogin = async (r: JourneyRunner, bankId = "northwind") => {
    r.set("conn.accountType", "bank"); await press(r, "Continue");
    r.set("conn.bankId", bankId); await press(r, "Continue");
  };
  it("offers account types as tiles and the banks from the sandbox", async () => {
    const { r } = mk(connectAccount, "sam"); await r.start();
    expect(r.view().blocks.find((b) => b.type === "select")!.items.map((i: any) => i.name)).toEqual(["Bank account", "Credit card"]);
    await press(r, "Continue");
    expect(r.current).toBe("type");
    r.set("conn.accountType", "credit"); await press(r, "Continue");
    expect(r.view().blocks.find((b) => b.type === "select")!.items.map((i: any) => i.name)).toEqual(["Northwind Bank", "Harbor Trust", "Apex Credit Union", "Summit Federal"]);
  });
  it("connects a bank for a new customer", async () => {
    const { r, bank } = mk(connectAccount, "sam"); await r.start();
    await toLogin(r);
    r.set("conn.username", "sam"); r.set("conn.password", "sandbox1"); r.set("conn.consent", true);
    await press(r, "Connect account");
    expect(r.current).toBe("success");
    expect(bank.persona.finance!.linked).toHaveLength(1);
    expect(r.view().blocks.find((b) => b.type === "result")!.meta).toBe("Balance $4,210.25");
  });
  it("fails when the bank rejects the login, and the password field is hidden text", async () => {
    const { r } = mk(connectAccount, "sam"); await r.start();
    await toLogin(r);
    expect(r.view().blocks.filter((b) => b.type === "textInput").map((b) => b.secure)).toEqual([undefined, true]);
    r.set("conn.username", "sam"); r.set("conn.password", "invalid123"); r.set("conn.consent", true);
    await press(r, "Connect account");
    expect(r.current).toBe("failed");
  });
});

describe("Create a budget", () => {
  // the journey was rebuilt (docs/BANKWORKX.md, Accounts): the category is chosen first (or passed in), then the amount, then the alerts, and a category that has a budget cannot be chosen
  const open = async (bank: MockBank, launch: Record<string, unknown> = {}) => { const r = new JourneyRunner(createBudget, { adapter: (id, input) => bank.call(id, input), launch }); await r.start(); return r; };
  it("creates a budget and refuses a duplicate category", async () => {
    const { bank } = mk(createBudget);
    const r = await open(bank, { "launch.category": "Travel" });
    expect(r.current).toBe("amt");
    r.set("budget.limit", 500);
    await press(r, "Continue");
    expect(r.current).toBe("alerts");
    await press(r, "Create budget");
    expect(r.current).toBe("success");
    expect(bank.persona.finance!.budgets.some((b) => b.name === "Travel" && b.limit === 500)).toBe(true);

    // a second budget for Travel: the category is marked and cannot be chosen, and the bank refuses it
    const second = await open(bank, { "launch.category": "Travel" });
    expect(second.current).toBe("cat");
    expect(second.view().blocks.find((b) => b.type === "menu")!.items.find((i: any) => i.label === "Travel").text).toBe("Budget set");
    await expect(bank.call("bank.budgets.create", { category: "Travel", limit: 100 })).rejects.toMatchObject({ code: "BUDGET_EXISTS" });
  });
  it("needs a limit of at least $10", async () => {
    const { bank } = mk(createBudget);
    const r = await open(bank, { "launch.category": "Health" });
    r.set("budget.limit", 5);
    await press(r, "Continue");
    expect(r.current).toBe("amt");
    expect(r.errors["budget.limit"]).toBe("The smallest budget is $10.00.");
    const none = await open(bank);
    expect(none.current).toBe("cat");
  });
});

// Invest and Sell investment on Tuesday 3 November 2026: the funds of the Save and borrow brief; a stock from the Invest tab takes the older road (launch value symbol)
const NOW = Date.parse("2026-11-03T10:00:00Z");
const run = (j: Journey, launch?: Record<string, any>) => {
  const bank = new MockBank("alex"); bank.now = () => NOW;
  return { bank, r: new JourneyRunner(j, { adapter: (id, input) => bank.call(id, input), launch }) };
};
const shown = (r: JourneyRunner) => r.view().blocks.filter((b) => b.type === "select").flatMap((b) => b.items.map((i: any) => i.id));
const alertText = (r: JourneyRunner) => r.view().blocks.filter((b) => b.type === "alert").map((b) => b.text).join(" | ");
const code = async (r: JourneyRunner) => { r.set("otp.code", "482100"); await press(r, "Confirm"); };

describe("Invest", () => {
  it("lists the funds and checks the form before continuing", async () => {
    const { r } = run(invest); await r.start();
    expect(r.current).toBe("fund");
    expect(shown(r)).toEqual(expect.arrayContaining(["gov", "bal", "geq", "tech"]));
    await press(r, "Continue");
    expect(r.current).toBe("fund");
    expect(Object.keys(r.errors)).toEqual(["inv.fundId"]);
  });
  it("buys a fund: asks for the tick and the code, takes the money and adds the units", async () => {
    const { r, bank } = run(invest); await r.start();
    r.set("inv.fundId", "bal"); await press(r, "Continue");
    expect(r.current).toBe("amount");
    await press(r, "Continue");
    expect(Object.keys(r.errors).sort()).toEqual(["inv.amount"]);
    r.set("inv.amount", 100); await press(r, "Continue");
    expect(r.current).toBe("review");
    expect(r.view().blocks.find((b) => b.type === "reviewSummary")!.rows.find((x: any) => x.label === "Estimated units")!.value).toBe("6.25");
    await press(r, "Invest");
    expect(r.current).toBe("review");
    r.set("inv.consent", true); await press(r, "Invest");
    expect(r.current).toBe("code");
    await code(r);
    expect(r.current).toBe("done");
    expect(bank.persona.accounts[0]!.balance).toBe(8620.76);
    expect(bank.persona.save!.holdings.find((h) => h.fundId === "bal")).toMatchObject({ units: 156.25, cost: 2400 });
    expect(r.view().blocks.find((b) => b.type === "result")!.text).toBe("$100.00 is invested in Balanced Portfolio.");
  });
  it("fails safely when the account cannot cover it: the bank says so and nothing is bought", async () => {
    const { r, bank } = run(invest); await r.start();
    r.set("inv.fundId", "bal"); await press(r, "Continue");
    r.set("inv.amount", 9000); await press(r, "Continue");
    expect(r.current).toBe("amount");
    expect(alertText(r)).toBe("Not enough money in Main. Available: $8,602.36.");
    expect(bank.persona.accounts[0]!.balance).toBe(8720.76);
    expect(bank.persona.save!.holdings.find((h) => h.fundId === "bal")!.units).toBe(150);
  });
  it("buys a stock from the Invest tab the older way: part of a share, with the tick and the code", async () => {
    const { r, bank } = run(invest, { "launch.symbol": "APXC" }); await r.start();
    expect(r.current).toBe("stockAmount");
    await press(r, "Continue");
    expect(Object.keys(r.errors).sort()).toEqual(["inv.amount"]);
    r.set("inv.amount", 100); await press(r, "Continue");
    expect(r.view().blocks.find((b) => b.type === "reviewSummary")!.rows[1]).toEqual({ label: "Amount", value: "$100" });
    r.set("inv.consent", true); await press(r, "Invest"); await code(r);
    expect(r.current).toBe("doneStock");
    expect(bank.persona.accounts[0]!.balance).toBe(8620.76);
    expect(bank.persona.finance!.invest.holdings.find((h) => h.symbol === "APXC")).toMatchObject({ shares: 1.0368 });
    expect(r.view().blocks.find((b) => b.type === "result")!.text).toBe("You bought 1.0368 of APXC at $96.45.");
  });
  it("a stock the account cannot cover is refused after the code and nothing is bought", async () => {
    const { r, bank } = run(invest, { "launch.symbol": "LMRB" }); await r.start();
    r.set("inv.amount", 50000); await press(r, "Continue");
    r.set("inv.consent", true); await press(r, "Invest"); await code(r);
    expect(r.current).toBe("stockAmount");
    expect(alertText(r)).toBe("Insufficient funds");
    expect(bank.persona.accounts[0]!.balance).toBe(8720.76);
    expect(bank.persona.finance!.invest.holdings.some((h) => h.symbol === "LMRB" && h.shares > 6.5)).toBe(false);
  });
});

describe("Sell investment", () => {
  it("offers only what the customer owns", async () => {
    const { r } = run(sellInvestment); await r.start();
    expect(r.current).toBe("pick");
    expect(shown(r)).toEqual(["bal", "geq"]);
  });
  it("sells part of a holding and pays the account, after the tick and the code", async () => {
    const { r, bank } = run(sellInvestment, { "launch.holdId": "geq" }); await r.start();
    expect(r.current).toBe("amount");
    r.set("sl.amount", 100); await press(r, "Continue");
    expect(r.current).toBe("review");
    r.set("sl.consent", true); await press(r, "Sell"); await code(r);
    expect(r.current).toBe("done");
    expect(bank.persona.accounts[0]!.balance).toBe(8820.51);
    expect(bank.persona.save!.holdings.find((h) => h.fundId === "geq")!.units).toBe(84.364);
    expect(r.view().blocks.find((b) => b.type === "result")!.text).toBe("$99.75 arrives on 5 Nov 2026.");
  });
  it("closes the holding when everything is sold, and refuses more than is held", async () => {
    const { r, bank } = run(sellInvestment, { "launch.holdId": "bal" }); await r.start();
    r.set("sl.amount", 3000); await press(r, "Continue");
    expect(r.current).toBe("amount");
    expect(alertText(r)).toBe("You can’t sell more than $2,400.00.");
    r.set("sl.how", "all"); await press(r, "Continue");
    r.set("sl.consent", true); await press(r, "Sell"); await code(r);
    expect(r.current).toBe("done");
    expect(bank.persona.save!.holdings.some((h) => h.fundId === "bal")).toBe(false);
    expect(bank.persona.accounts[0]!.balance).toBe(11114.76);
  });
  it("sells a stock from the Invest tab the older way, and a stock sold in full closes the holding", async () => {
    const { r, bank } = run(sellInvestment, { "launch.symbol": "TBND" }); await r.start();
    expect(r.current).toBe("stockAmount");
    r.set("sl.amount", 600); await press(r, "Continue");
    r.set("sl.consent", true); await press(r, "Sell"); await code(r);
    expect(r.current).toBe("stockAmount");
    expect(bank.persona.accounts[0]!.balance).toBe(8720.76);
    r.set("sl.amount", 491.5); await press(r, "Continue");
    r.set("sl.consent", true); await press(r, "Sell"); await code(r);
    expect(r.current).toBe("doneStock");
    expect(bank.persona.finance!.invest.holdings.some((h) => h.symbol === "TBND")).toBe(false);
    expect(bank.persona.accounts[0]!.balance).toBe(9212.26);
  });
});
