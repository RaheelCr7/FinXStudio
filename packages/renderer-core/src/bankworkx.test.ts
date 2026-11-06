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
  it("shows the customer's accounts and saved cards, and one-tap amounts", async () => {
    const { r } = mk(addMoney); await r.start();
    const blocks = r.view().blocks;
    expect(blocks.find((b) => b.type === "accountPicker")!.items.map((a: any) => a.id)).toEqual(["acc_main", "acc_save", "acc_eur", "acc_aed"]);
    expect(blocks.find((b) => b.type === "select")!.items[0]).toMatchObject({ id: "c_5832", name: "Everyday ••5832" });
    expect(blocks.find((b) => b.type === "amountInput")!.quickAmounts).toEqual([50, 100, 150, 200]);
  });
  it("checks the amount before continuing", async () => {
    const { r } = mk(addMoney); await r.start();
    await press(r, "Continue");
    expect(r.current).toBe("amount");
    expect(Object.keys(r.errors).sort()).toEqual(["add.amount", "add.fromCardId", "add.toAccountId"]);
    r.set("add.toAccountId", "acc_main"); r.set("add.fromCardId", "c_5832"); r.set("add.amount", 60000);
    await press(r, "Continue");
    expect(r.errors["add.amount"]).toBe("The most you can add at once is $50,000");
  });
  it("adds money and shows a reference", async () => {
    const { r, bank } = mk(addMoney); await r.start();
    r.set("add.toAccountId", "acc_main"); r.set("add.fromCardId", "c_5832"); r.set("add.amount", 150);
    await press(r, "Continue");
    expect(r.current).toBe("review");
    expect(r.view().blocks.find((b) => b.type === "reviewSummary")!.rows[2]).toEqual({ label: "You'll add", value: "$150" });
    await press(r, "Add $150");
    expect(r.current).toBe("success");
    expect(bank.persona.accounts[0]!.balance).toBe(8870.76);
    expect(r.view().blocks.find((b) => b.type === "result")!.meta).toMatch(/^Ref ADD-/);
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

describe("Invest", () => {
  it("lists the instruments and the accounts, and checks the form before continuing", async () => {
    const { r } = mk(invest); await r.start();
    expect(r.view().blocks.find((b) => b.type === "select")!.items.map((i: any) => i.id)).toContain("LMRB");
    await press(r, "Continue");
    expect(r.current).toBe("buy");
    expect(Object.keys(r.errors).sort()).toEqual(["invest.amount", "invest.fromAccountId", "invest.symbol"]);
  });
  it("buys part of a share, takes the money and adds the holding", async () => {
    const { r, bank } = mk(invest); await r.start();
    r.set("invest.symbol", "APXC"); r.set("invest.fromAccountId", "acc_main"); r.set("invest.amount", 100);
    await press(r, "Continue");
    expect(r.view().blocks.find((b) => b.type === "reviewSummary")!.rows[1]).toEqual({ label: "Amount", value: "$100" });
    await press(r, "Buy $100");
    expect(r.current).toBe("success");
    expect(bank.persona.accounts[0]!.balance).toBe(8620.76);
    expect(bank.persona.finance!.invest.holdings.find((h) => h.symbol === "APXC")).toMatchObject({ shares: 1.0368 });
    expect(r.view().blocks.find((b) => b.type === "result")!.text).toBe("You bought 1.0368 of APXC at $96.45.");
  });
  it("fails safely when the account cannot cover it", async () => {
    const { r, bank } = mk(invest); await r.start();
    r.set("invest.symbol", "LMRB"); r.set("invest.fromAccountId", "acc_main"); r.set("invest.amount", 50000);
    await press(r, "Continue"); await press(r, "Buy $50,000");
    expect(r.current).toBe("failed");
    expect(bank.persona.accounts[0]!.balance).toBe(8720.76);
    expect(bank.persona.finance!.invest.holdings.some((h) => h.symbol === "LMRB" && h.shares > 6.5)).toBe(false);
  });
});

describe("Sell investment", () => {
  it("offers only what the customer owns", async () => {
    const { r } = mk(sellInvestment); await r.start();
    expect(r.view().blocks.find((b) => b.type === "select")!.items.map((i: any) => i.id)).toEqual(["LMRB", "GLBX", "ORCH", "TBND"]);
  });
  it("sells part of a holding and pays the account", async () => {
    const { r, bank } = mk(sellInvestment); await r.start();
    r.set("sell.symbol", "LMRB"); r.set("sell.toAccountId", "acc_main"); r.set("sell.amount", 184.2);
    await press(r, "Continue"); await press(r, "Sell $184.2");
    expect(r.current).toBe("success");
    expect(bank.persona.accounts[0]!.balance).toBe(8904.96);
    expect(bank.persona.finance!.invest.holdings.find((h) => h.symbol === "LMRB")!.shares).toBe(5.5);
    expect(r.view().blocks.find((b) => b.type === "result")!.text).toBe("You sold 1 of LMRB and $184.20 is in your account.");
  });
  it("closes the holding when everything is sold, and refuses more than is owned", async () => {
    const { r, bank } = mk(sellInvestment); await r.start();
    r.set("sell.symbol", "TBND"); r.set("sell.toAccountId", "acc_main"); r.set("sell.amount", 600);
    await press(r, "Continue"); await press(r, "Sell $600");
    expect(r.current).toBe("failed");
    expect(bank.persona.accounts[0]!.balance).toBe(8720.76);
    r.set("sell.amount", 491.5); await press(r, "Try again"); r.set("sell.symbol", "TBND"); r.set("sell.toAccountId", "acc_main"); r.set("sell.amount", 491.5);
    await press(r, "Continue"); await press(r, "Sell $491.5");
    expect(r.current).toBe("success");
    expect(bank.persona.finance!.invest.holdings.some((h) => h.symbol === "TBND")).toBe(false);
    expect(bank.persona.accounts[0]!.balance).toBe(9212.26);
  });
});
