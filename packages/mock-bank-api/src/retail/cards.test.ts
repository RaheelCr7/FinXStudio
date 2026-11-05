import { describe, expect, it } from "vitest";
import { MockBank } from "../index";
import type { Flaws } from "../business/corporate";

// Alex Morgan on Tuesday 3 November 2026. The clock is pinned, so ages, expiry and arrival dates do not depend on today.
const NOW = Date.parse("2026-11-03T10:00:00Z");
const alex = (over: { flaws?: Flaws; now?: number; config?: any; conditions?: any } = {}) => new MockBank("alex", { now: over.now ?? NOW, corpFlaws: over.flaws, config: over.config, conditions: over.conditions });
const code = (p: Promise<unknown>) => p.then(() => "ok", (e) => (e as { code?: string }).code ?? String(e));
const msg = (p: Promise<unknown>) => p.then(() => "ok", (e) => (e as Error).message);
const otp = async (b: MockBank) => { await b.call("bank.otp.send", {}); await b.call("bank.otp.verify", { code: "482100" }); };
const issued = async (b: MockBank) => (await b.call("bank.cards.issued")) as Record<string, any>;

describe("the cards the bank issued", () => {
  it("lists them in order with what a screen shows: a status line, a pill, a face and what each card can do", async () => {
    const c = await issued(alex());
    expect(Object.keys(c)).toEqual(["card_9021", "card_6150", "card_7745", "card_3318"]);
    expect(c.card_9021).toMatchObject({ name: "Everyday debit ••9021", pill: "Active", number: "•••• •••• •••• 9021", holderLine: "ALEX MORGAN · 09/29", lineLabel: "Available balance", lineValue: "$8,602.36" });
    expect(c.card_3318).toMatchObject({ pill: "Active", lineLabel: "Available credit", lineValue: "$3,640.20", lineExtra: "Minimum due $45.00 by 28 Nov 2026" });
    expect(c.card_7745).toMatchObject({ pill: "Not activated", line: "Activate this card to start using it.", can: { activate: true, freeze: false } });
    expect(c.card_6150).toMatchObject({ pill: "Virtual", lineLabel: "Available", lineValue: "$240.02", parentName: "Everyday debit ••9021", can: { pin: false, createVirtual: false } });
    expect(c.card_9021.can).toMatchObject({ freeze: true, unfreeze: false, controls: true, pin: true, replace: false, createVirtual: true });
    expect(c.card_3318).toMatchObject({ allowsCash: false, controls: { abroad: false, atm: false } });
  });
  it("a customer with no cards has none; a customer without records is not supported", async () => {
    expect(await new MockBank("sam").call("bank.cards.issued")).toEqual({});
    expect(await code(new MockBank("ayesha").call("bank.cards.issued"))).toBe("NOT_SUPPORTED");
    expect(await code(alex().call("bank.cards.get", { cardId: "nope" }))).toBe("CARD_NOT_FOUND");
  });
  it("keeps only masked values: no card number, no security code and no PIN anywhere in what the bank holds", async () => {
    const b = alex();
    await otp(b);
    const made = await b.call("bank.cards.virtual.create", { cardId: "card_9021", purpose: "Online shopping", limit: 200 });
    const dump = JSON.stringify([b.persona.cards, await issued(b), await b.call("bank.cards.transactions", { cardId: made.id })]);
    expect(dump).not.toContain(made.number.replace(/ /g, ""));
    expect(dump).not.toContain(made.number);
    expect(dump).not.toContain(`"cvv"`);
    expect(dump).not.toMatch(/"pin":"/);
  });
  it("a card past its expiry month is Expired whatever it was", async () => {
    const c = await issued(alex({ now: Date.parse("2029-10-05T10:00:00Z") }));
    expect(c.card_9021).toMatchObject({ status: "expired", pill: "Expired", line: "This card can’t be used.", can: { replace: true, freeze: false } });
  });
});

describe("a card's spending", () => {
  it("lists the newest first, pending first within its day, and says what can be reported", async () => {
    const r = await alex().call("bank.cards.transactions", { cardId: "card_9021", limit: 5 });
    expect(r.items.map((t: any) => t.id)).toEqual(["ct_3", "ct_1", "ct_4", "ct_2", "ct_7"]);
    expect(r.total).toBe(8);
    expect(r.more).toBe(true);
    expect(r.items[0]).toMatchObject({ merchant: "Brightside Coffee", when: "Pending", amountText: "−$4.80", status: "pending", reportable: false, noticeCode: "TRANSACTION_PENDING" });
    expect(r.items[1]).toMatchObject({ when: "Yesterday", amountText: "−$64.20", reportable: true, notice: "" });
    expect(r.items[4]).toMatchObject({ amountText: "+$35.00", noticeCode: "NOT_A_PAYMENT_OUT" });
  });
  it("filters by status and merchant, takes all cards when none is named and refuses an unknown card", async () => {
    const b = alex();
    expect((await b.call("bank.cards.transactions", { cardId: "card_9021", status: "pending" })).items.map((t: any) => t.id)).toEqual(["ct_3"]);
    expect((await b.call("bank.cards.transactions", { q: "pixel" })).items.map((t: any) => t.id)).toEqual(["ct_v1", "ct_v2"]);
    expect((await b.call("bank.cards.transactions", {})).total).toBe(12);
    expect(await code(b.call("bank.cards.transactions", { cardId: "nope" }))).toBe("CARD_NOT_FOUND");
  });
});

describe("freezing and unfreezing", () => {
  it("freezes an active card at once, with no code; a card that is not active cannot be frozen", async () => {
    const b = alex();
    expect(await b.call("bank.cards.freeze", { cardId: "card_9021" })).toMatchObject({ status: "frozen" });
    expect((await issued(b)).card_9021).toMatchObject({ pill: "Frozen", can: { unfreeze: true, freeze: false, controls: true, pin: false } });
    expect(await code(b.call("bank.cards.freeze", { cardId: "card_9021" }))).toBe("CARD_ALREADY_FROZEN");
    expect(await msg(b.call("bank.cards.freeze", { cardId: "card_7745" }))).toBe("Only an active card can be frozen.");
    expect(await code(b.call("bank.cards.freeze", { cardId: "nope" }))).toBe("CARD_NOT_FOUND");
  });
  it("unfreezing asks for the code first and a card that is not frozen cannot be unfrozen", async () => {
    const b = alex();
    expect(await code(b.call("bank.cards.unfreeze", { cardId: "card_9021" }))).toBe("CARD_NOT_FROZEN");
    await b.call("bank.cards.freeze", { cardId: "card_9021" });
    expect(await code(b.call("bank.cards.unfreeze", { cardId: "card_9021" }))).toBe("OTP_REQUIRED");
    await otp(b);
    expect(await b.call("bank.cards.unfreeze", { cardId: "card_9021" })).toMatchObject({ status: "active" });
    // the code works once
    await b.call("bank.cards.freeze", { cardId: "card_9021" });
    expect(await code(b.call("bank.cards.unfreeze", { cardId: "card_9021" }))).toBe("OTP_REQUIRED");
  });
  it("blocks for good with no code, and says so a second time", async () => {
    const b = alex();
    expect(await b.call("bank.cards.block", { cardId: "card_9021", reason: "lost" })).toMatchObject({ status: "blocked", reference: "BLK-20261103-0701" });
    expect(await code(b.call("bank.cards.block", { cardId: "card_9021", reason: "lost" }))).toBe("CARD_ALREADY_BLOCKED");
    expect(await code(b.call("bank.cards.block", { cardId: "card_3318", reason: "boredom" }))).toBe("REASON_INVALID");
    expect((await issued(b)).card_9021).toMatchObject({ pill: "Blocked", line: "This card can’t be used.", can: { replace: true, freeze: false } });
  });
});

describe("limits and controls", () => {
  const update = (b: MockBank, input: Record<string, unknown>) => b.call("bank.cards.controls.update", { cardId: "card_9021", ...input });
  it("lowering a limit or turning a place off needs no code; the changes read as before and after", async () => {
    const b = alex();
    const r = await update(b, { limits: { dailyPurchases: 2500 }, controls: { online: false } });
    expect(r).toMatchObject({ loosened: false, kind: "changes", changes: [{ label: "Daily", before: "$3,000.00", after: "$2,500.00" }, { label: "Online", before: "On", after: "Off" }] });
    expect((await issued(b)).card_9021).toMatchObject({ limits: { dailyPurchases: 2500 }, controls: { online: false } });
  });
  it("raising a limit, turning a place on and adding a trip each ask for the code", async () => {
    const b = alex();
    await update(b, { controls: { online: false } });
    for (const input of [{ limits: { dailyPurchases: 4000 } }, { controls: { online: true } }, { trip: { country: "Spain", from: "2026-12-05", to: "2026-12-12" } }]) {
      expect(await code(update(b, input)), JSON.stringify(input)).toBe("OTP_REQUIRED");
      await otp(b);
      expect(await code(update(b, input))).toBe("ok");
    }
  });
  it("a dry run applies every rule, changes nothing and needs no code", async () => {
    const b = alex();
    const r = await update(b, { limits: { dailyPurchases: 4000 }, dryRun: true });
    expect(r).toMatchObject({ loosened: true, needsCode: true });
    expect((await issued(b)).card_9021.limits.dailyPurchases).toBe(3000);
    expect(await code(update(b, { limits: { dailyPurchases: 20000 }, dryRun: true }))).toBe("LIMIT_ABOVE_CEILING");
  });
  it("checks each limit against its ceiling, the order per transaction, daily, monthly, and the amount itself", async () => {
    const b = alex();
    expect(await msg(update(b, { limits: { perTransaction: 20000 } }))).toBe("The most is $10,000.00.");
    expect(await msg(update(b, { limits: { dailyPurchases: 20000 } }))).toBe("The most is $15,000.00.");
    expect(await msg(update(b, { limits: { dailyAtm: 2000 } }))).toBe("The most is $1,500.00.");
    expect(await msg(update(b, { limits: { perTransaction: 3500 } }))).toBe("Can’t be more than the daily limit.");
    expect(await msg(update(b, { limits: { dailyPurchases: 16000 } }))).toBe("The most is $15,000.00.");
    expect(await msg(update(b, { limits: { dailyPurchases: 15000, monthly: 12000 } }))).toBe("Can’t be more than the monthly limit.");
    for (const bad of [-1, 12.345, Number.NaN, "10"]) expect(await code(update(b, { limits: { perTransaction: bad } })), String(bad)).toBe("LIMIT_INVALID");
    // a credit card has no cash limit to raise
    expect(await code(b.call("bank.cards.controls.update", { cardId: "card_3318", limits: { dailyAtm: 100 } }))).toBe("LIMIT_ABOVE_CEILING");
  });
  it("a trip needs the country and both dates, in order, up to 90 days, from today to 120 days ahead, and International on", async () => {
    const b = alex();
    const trip = (t: Record<string, string>) => msg(update(b, { trip: t, dryRun: true }));
    const ok = (t: Record<string, string>) => update(b, { trip: t, dryRun: true });
    expect(await trip({ country: "Spain", from: "", to: "" })).toBe("Add the country and both dates, or clear them.");
    expect(await trip({ country: "Spain", from: "2026-12-12", to: "2026-12-05" })).toBe("The end date is before the start date.");
    expect(await trip({ country: "Spain", from: "2026-12-01", to: "2027-03-12" })).toBe("A trip can last up to 90 days.");
    expect(await trip({ country: "Spain", from: "2026-11-02", to: "2026-11-09" })).toBe("Choose dates from today to 120 days ahead.");
    expect(await trip({ country: "Spain", from: "2027-03-20", to: "2027-03-25" })).toBe("Choose dates from today to 120 days ahead.");
    expect(await ok({ country: "Spain", from: "2026-12-05", to: "2026-12-12" })).toMatchObject({ changes: [{ label: "Trip", before: "None", after: "Spain, 5 Dec to 12 Dec" }], loosened: true });
    expect(await msg(b.call("bank.cards.controls.update", { cardId: "card_3318", trip: { country: "Spain", from: "2026-12-05", to: "2026-12-12" }, dryRun: true }))).toBe("Turn on International to add a trip.");
  });
  it("alerts never ask for a code; the amount to alert from is 1.00 to 100,000.00 when large transactions are on", async () => {
    const b = alex();
    expect(await update(b, { alerts: { online: true } })).toMatchObject({ loosened: false, changes: [{ label: "Online purchases", before: "Off", after: "On" }] });
    expect(await msg(update(b, { alerts: { large: true, largeFrom: 0 } }))).toBe("Enter an amount above zero.");
    expect(await msg(update(b, { alerts: { large: true, largeFrom: 100001 } }))).toBe("The most is $100,000.00.");
    expect(await code(update(b, { alerts: { large: true, largeFrom: 250 } }))).toBe("ok");
  });
  it("nothing changed is refused; a card that is not active is refused with its own words; a frozen card takes only its unfreezing", async () => {
    const b = alex();
    expect(await code(update(b, { limits: { dailyPurchases: 3000 } , dryRun: false }))).toBe("NOTHING_CHANGED");
    expect(await msg(b.call("bank.cards.controls.update", { cardId: "card_7745", controls: { online: false } }))).toBe("Activate this card first.");
    await b.call("bank.cards.block", { cardId: "card_3318", reason: "lost" });
    expect(await msg(b.call("bank.cards.controls.update", { cardId: "card_3318", controls: { online: false } }))).toBe("This card can’t be changed.");
    await b.call("bank.cards.freeze", { cardId: "card_9021" });
    expect(await code(update(b, { limits: { dailyPurchases: 2500 } }))).toBe("CARD_FROZEN");
    expect(await update(b, { status: "active", dryRun: true })).toMatchObject({ kind: "unfreeze", loosened: true });
    await otp(b);
    expect(await update(b, { status: "active" })).toMatchObject({ kind: "unfreeze", status: "active" });
  });
});

describe("activating a card", () => {
  const verify = (b: MockBank, input: Record<string, unknown> = {}) => b.call("bank.cards.verifyActivation", { cardId: "card_7745", last4: "7745", expiry: "11/29", securityCode: "123", ...input });
  it("takes the right last four digits, expiry and security code, then activates with a PIN kept as a hash", async () => {
    const b = alex();
    expect(await verify(b)).toMatchObject({ verified: true, triesLeft: 3 });
    expect(await b.call("bank.cards.activate", { cardId: "card_7745", pin: "7391" })).toMatchObject({ status: "active", pinSet: true });
    expect((await issued(b)).card_7745).toMatchObject({ pill: "Active", pinSet: true });
    expect(JSON.stringify(b.persona.cards)).not.toContain("7391");
    expect(await code(verify(b))).toBe("CARD_ALREADY_ACTIVE");
  });
  it("a wrong try is an answer with the tries left; the third locks the card, even for the right details afterwards", async () => {
    const b = alex();
    expect(await verify(b, { last4: "0000" })).toMatchObject({ verified: false, code: "ACTIVATION_MISMATCH", triesLeft: 2 });
    expect(await verify(b, { expiry: "10/29" })).toMatchObject({ code: "ACTIVATION_MISMATCH", triesLeft: 1 });
    expect(await verify(b, { securityCode: "000" })).toMatchObject({ code: "ACTIVATION_LOCKED", locked: true, triesLeft: 0 });
    expect(await verify(b)).toMatchObject({ verified: false, code: "ACTIVATION_LOCKED" });
    expect(await code(b.call("bank.cards.activate", { cardId: "card_7745" }))).toBe("ACTIVATION_LOCKED");
    expect((await issued(b)).card_7745).toMatchObject({ line: "Activation is locked. Please call us.", locked: true, can: { activate: false } });
  });
  it("does not check a security code that was not sent, and refuses activating without the details having been checked", async () => {
    const b = alex();
    expect(await code(b.call("bank.cards.activate", { cardId: "card_7745" }))).toBe("ACTIVATION_MISMATCH");
    expect(await verify(b, { securityCode: undefined })).toMatchObject({ verified: true });
    expect(await code(b.call("bank.cards.activate", { cardId: "card_7745" }))).toBe("ok");
  });
  it("activating can carry the details itself; a card that is blocked, virtual or unknown cannot be activated", async () => {
    const b = alex();
    expect(await code(b.call("bank.cards.activate", { cardId: "card_7745", last4: "1111", expiry: "11/29" }))).toBe("ACTIVATION_MISMATCH");
    expect(await code(b.call("bank.cards.activate", { cardId: "card_7745", last4: "7745", expiry: "11/29" }))).toBe("ok");
    expect(await code(verify(b, { cardId: "card_6150" }))).toBe("CARD_ALREADY_ACTIVE");
    await b.call("bank.cards.block", { cardId: "card_3318", reason: "lost" });
    expect(await code(verify(b, { cardId: "card_3318" }))).toBe("CARD_BLOCKED");
    expect(await code(verify(b, { cardId: "nope" }))).toBe("CARD_NOT_FOUND");
  });
  it("the PIN at activation refuses repeats, runs, patterns and PINs built from the card, birth date, phone and account digits, and the common ones", async () => {
    const b = alex();
    await verify(b);
    const pin = (p: string) => msg(b.call("bank.cards.activate", { cardId: "card_7745", pin: p }));
    expect(await pin("1111")).toBe("Don’t repeat one digit.");
    expect(await pin("1234")).toBe("Don’t use a run of digits.");
    expect(await pin("4321")).toBe("Don’t use a run of digits.");
    for (const harder of ["1212", "1122", "7745", "1988", "1704", "0417", "0142", "4410", "7731", "2580"]) expect(await pin(harder), harder).toBe("Choose a PIN that’s harder to guess.");
    expect(await pin("123")).toBe("Use exactly 4 digits.");
    expect(await pin("7391")).toBe("ok");
  });
});

describe("the PIN of a card", () => {
  const set = (b: MockBank, pin: string, extra: Record<string, unknown> = {}) => b.call("bank.cards.pin.set", { cardId: "card_9021", pin, ...extra });
  it("asks for the code first, once, and says whether it is the first PIN", async () => {
    const b = alex();
    expect(await code(set(b, "2580"))).toBe("OTP_REQUIRED");
    await otp(b);
    expect(await set(b, "2580")).toMatchObject({ pinSet: true, firstSet: false });
    expect(await code(set(b, "2580"))).toBe("OTP_REQUIRED");
    await b.call("bank.cards.activate", { cardId: "card_7745", last4: "7745", expiry: "11/29" });
    await otp(b);
    expect(await set(b, "7391", { cardId: "card_7745" })).toMatchObject({ firstSet: true });
    expect(JSON.stringify(b.persona.cards)).not.toContain("2580");
  });
  it("refuses easy PINs while blockWeak is on, and takes any four digits with it off", async () => {
    const b = alex();
    await otp(b);
    expect(await msg(set(b, "1111"))).toBe("Don’t use the same digit four times.");
    expect(await msg(set(b, "1234"))).toBe("Don’t use numbers in a row, like 1234.");
    expect(await msg(set(b, "4321"))).toBe("Don’t use numbers in a row, like 1234.");
    expect(await msg(set(b, "1212"))).toBe("Choose a PIN that’s harder to guess.");
    expect(await msg(set(b, "1122"))).toBe("Choose a PIN that’s harder to guess.");
    expect(await msg(set(b, "9021"))).toBe("Don’t use part of your card number or expiry date.");
    expect(await msg(set(b, "0929"))).toBe("Don’t use part of your card number or expiry date.");
    expect(await msg(set(b, "123"))).toBe("Enter 4 digits.");
    expect(await code(set(b, "1111", { blockWeak: false }))).toBe("ok");
  });
  it("is not for a virtual card, a card that is not activated, or one that cannot be changed", async () => {
    const b = alex();
    await otp(b);
    expect(await msg(set(b, "2580", { cardId: "card_6150" }))).toBe("Virtual cards don’t have a PIN.");
    expect(await msg(set(b, "2580", { cardId: "card_7745" }))).toBe("Activate this card first.");
    await b.call("bank.cards.block", { cardId: "card_9021", reason: "lost" });
    expect(await msg(set(b, "2580"))).toBe("This card can’t be changed.");
    expect(await code(set(b, "2580", { cardId: "nope" }))).toBe("CARD_NOT_FOUND");
  });
});

describe("virtual cards", () => {
  const make = (b: MockBank, input: Record<string, unknown> = {}) => b.call("bank.cards.virtual.create", { cardId: "card_9021", purpose: "Online shopping", limit: 200, ...input });
  it("makes one after the code, shows its details once, and links it to its parent with online and international on", async () => {
    const b = alex();
    expect(await code(make(b))).toBe("OTP_REQUIRED");
    await otp(b);
    const r = await make(b);
    expect(r).toMatchObject({ status: "Active", per: "a month", lasts: "3 years", limitText: "$200.00", parentName: "Everyday debit ••9021" });
    expect(r.number).toMatch(/^4000 00\d\d \d{4} \d{4}$/);
    expect(r.cvv).toMatch(/^[0-9]{3}$/);
    const mine = (await issued(b))[r.id];
    expect(mine).toMatchObject({ pill: "Virtual", parentCardId: "card_9021", controls: { online: true, abroad: true, atm: false, contactless: false }, nickname: "Online shopping", last4: r.last4 });
    expect(JSON.stringify(mine)).not.toContain(r.cvv);
    expect(await code(make(b))).toBe("OTP_REQUIRED");
  });
  it("a one-time purchase is always single use and its limit is per payment", async () => {
    const b = alex();
    expect(await make(b, { purpose: "One-time purchase", dryRun: true })).toMatchObject({ per: "per payment", lasts: "One payment", singleUse: true });
    await otp(b);
    expect(await make(b, { purpose: "Subscriptions", singleUse: true })).toMatchObject({ status: "Single use" });
  });
  it("takes a limit of 1.00 to 5,000.00 and a purpose from the list", async () => {
    const b = alex();
    expect(await msg(make(b, { limit: 0.5, dryRun: true }))).toBe("The smallest limit is $1.00.");
    expect(await msg(make(b, { limit: 6000, dryRun: true }))).toBe("The most is $5,000.00.");
    expect(await code(make(b, { limit: 10.005, dryRun: true }))).toBe("LIMIT_INVALID");
    expect(await code(make(b, { limit: 1, dryRun: true }))).toBe("ok");
    expect(await code(make(b, { limit: 5000, dryRun: true }))).toBe("ok");
    expect(await code(make(b, { purpose: "Fun", dryRun: true }))).toBe("PURPOSE_INVALID");
  });
  it("allows five on a card, only on an active physical card, and a deleted one makes room", async () => {
    const b = alex();
    for (let i = 0; i < 4; i++) { await otp(b); await make(b); }
    expect(await msg(make(b, { dryRun: true }))).toBe("You have 5 virtual cards on this card, the most you can have. Delete one first.");
    await b.call("bank.cards.virtual.delete", { cardId: "card_6150" });
    expect(await code(make(b, { dryRun: true }))).toBe("ok");
    expect(await code(b.call("bank.cards.virtual.delete", { cardId: "card_6150" }))).toBe("CARD_ALREADY_BLOCKED");
    expect(await code(b.call("bank.cards.virtual.delete", { cardId: "card_9021" }))).toBe("CARD_NOT_FOUND");
    for (const cardId of ["card_6150", "card_7745", "nope"]) expect(await code(make(b, { cardId, dryRun: true })), cardId).toMatch(/CARD_NOT_ACTIVE|CARD_NOT_FOUND/);
  });
});

describe("replacing a card", () => {
  const order = (b: MockBank, input: Record<string, unknown> = {}) => { const { dryRun, ...rest } = input; return b.call(dryRun ? "bank.cards.replace.check" : "bank.cards.replace", { cardId: "card_9021", reason: "damaged", speed: "standard", address: "home", ...rest }); };
  it("a standard delivery to the home address is free, asks for the code like every order, and leaves a damaged card working until the new one is activated", async () => {
    const b = alex();
    expect(await code(order(b))).toBe("OTP_REQUIRED");
    await otp(b);
    const r = await order(b);
    expect(r).toMatchObject({ fee: 0, feeText: "Free", deliveryText: "Standard, by Tue 10 Nov", newStatus: "Not activated", oldCard: "", deliverTo: "12 Example Street, Springfield 62704", needsCode: true });
    const c = await issued(b);
    expect(c.card_9021).toMatchObject({ pill: "Active", replacement: { newCardId: r.newCardId } });
    expect(c[r.newCardId]).toMatchObject({ pill: "Not activated", nickname: "Everyday debit", last4: r.last4 });
    await b.call("bank.cards.activate", { cardId: r.newCardId, last4: r.last4, expiry: c[r.newCardId].expiry });
    expect((await issued(b)).card_9021.pill).toBe("Replaced");
    expect(await code(order(b, { dryRun: true }))).toBe("CARD_REPLACED");
  });
  it("express costs 15.00 from the card's account after the code, shows in the activity, and a second order is refused while one is on its way", async () => {
    const b = alex();
    expect(await order(b, { speed: "express", dryRun: true })).toMatchObject({ fee: 15, feeText: "$15.00", needsCode: true, deliveryText: "Express, by Thu 5 Nov" });
    await otp(b);
    await order(b, { speed: "express" });
    expect((await b.call("bank.accounts.get", { accountId: "acc_main" })).balance).toBe(8705.76);
    expect(b.persona.retail!.transactions.some((t) => t.title === "Card delivery fee" && t.amount === -15)).toBe(true);
    expect(await msg(order(b, { dryRun: true }))).toBe("A replacement is already on its way. It arrives by Thu 5 Nov.");
    expect(await code(order(b, { reason: "lost", dryRun: true }))).toBe("REPLACEMENT_PENDING");
  });
  it("express is free when the bank charges no fee for it; a fee above the available balance is refused and orders nothing", async () => {
    const b = alex();
    await otp(b);
    expect(await order(b, { speed: "express", fee: false })).toMatchObject({ fee: 0, feeText: "Free" });
    const c = alex();
    await otp(c);
    await c.call("bank.transfers.own", { fromAccountId: "acc_main", toAccountId: "acc_save", amount: 8600 });
    await otp(c);
    expect(await msg(order(c, { speed: "express" }))).toBe("Not enough in your account to pay the delivery fee.");
    expect((await issued(c)).card_9021.replacement).toBeNull();
  });
  it("lost and stolen need the card blocked first, so a forged order cannot leave it working", async () => {
    const b = alex();
    await otp(b);
    expect(await code(order(b, { reason: "lost" }))).toBe("CARD_NOT_BLOCKED");
    await b.call("bank.cards.block", { cardId: "card_9021", reason: "lost" });
    expect(await order(b, { reason: "lost", dryRun: true })).toMatchObject({ oldCard: "Blocked", fee: 0 });
    expect(await order(b, { reason: "lost" })).toMatchObject({ newStatus: "Not activated" });
    expect((await issued(b)).card_9021).toMatchObject({ pill: "Blocked", can: { replace: false } });
  });
  it("another address needs a line, a city and a postcode (none in market D)", async () => {
    const b = alex();
    const away = (a: Record<string, string>) => msg(order(b, { address: a, dryRun: true }));
    expect(await away({ line: "ab", city: "Springfield", postcode: "62704" })).toBe("Enter the address line (3 to 60 characters).");
    expect(await away({ line: "5 Elm Road", city: "S", postcode: "62704" })).toBe("Enter the city (2 to 40 characters).");
    expect(await away({ line: "5 Elm Road", city: "Springfield", postcode: "1" })).toBe("Enter a valid postcode.");
    expect(await order(b, { address: { line: "5 Elm Road", city: "Springfield", postcode: "62704" }, dryRun: true })).toMatchObject({ deliverTo: "5 Elm Road, Springfield 62704", fee: 0 });
    const d = alex({ config: { homeMarket: "ae" } });
    expect(await order(d, { address: { line: "Villa 5", city: "Dubai", postcode: "" }, dryRun: true })).toMatchObject({ deliverTo: "Villa 5, Dubai" });
    expect(await order(d, { dryRun: true })).toMatchObject({ deliverTo: "Example Tower, Flat 1204, Dubai" });
    expect(await order(alex({ config: { homeMarket: "uk" } }), { dryRun: true })).toMatchObject({ deliverTo: "12 Example Road, London SW1A 1AA" });
  });
  it("Expired is only for an expired card or one with 60 days or fewer left", async () => {
    expect(await msg(order(alex(), { reason: "expired", dryRun: true }))).toBe("This card hasn’t expired yet.");
    expect(await code(order(alex({ now: Date.parse("2029-08-15T10:00:00Z") }), { reason: "expired", dryRun: true }))).toBe("ok");
    expect(await code(order(alex({ now: Date.parse("2029-07-15T10:00:00Z") }), { reason: "expired", dryRun: true }))).toBe("REASON_INVALID");
    expect(await code(order(alex({ now: Date.parse("2029-10-15T10:00:00Z") }), { reason: "expired", dryRun: true }))).toBe("ok");
    expect(await code(order(alex(), { reason: "fun", dryRun: true }))).toBe("REASON_INVALID");
  });
  it("a virtual card, a card not yet activated and an unknown card cannot be replaced; the speed has to be chosen", async () => {
    const b = alex();
    expect(await msg(order(b, { cardId: "card_6150" }))).toBe("Virtual cards can’t be replaced. Create a new one instead.");
    expect(await msg(order(b, { cardId: "card_7745" }))).toBe("This card isn’t active yet.");
    expect(await code(order(b, { cardId: "nope" }))).toBe("CARD_NOT_FOUND");
    expect(await code(order(b, { speed: "rocket" }))).toBe("DELIVERY_INVALID");
  });
});

describe("reporting a card payment", () => {
  const report = (b: MockBank, input: Record<string, unknown> = {}) => b.call("bank.cards.dispute.create", { cardId: "card_9021", transactionId: "ct_1", reason: "Charged twice", details: { otherChargeDate: "2026-10-30" }, ...input });
  it("opens one case, marks the payment as disputed, asks for no code and moves no money", async () => {
    const b = alex();
    const before = (await b.call("bank.accounts.get", { accountId: "acc_main" })).balance;
    const r = await report(b);
    expect(r).toMatchObject({ disputeId: "DSP-9001", status: "under_review", statusLabel: "Under review", cardBlocked: false, merchant: "Northwind Market", amountText: "$64.20", replyBy: "18 Dec 2026" });
    expect((await b.call("bank.accounts.get", { accountId: "acc_main" })).balance).toBe(before);
    const t = (await b.call("bank.cards.transactions", { cardId: "card_9021" })).items.find((x: any) => x.id === "ct_1");
    expect(t).toMatchObject({ status: "disputed", statusLabel: "Disputed", disputeId: "DSP-9001", reportable: false, noticeCode: "DISPUTE_EXISTS" });
    expect(Object.keys(await b.call("bank.cards.dispute.list", { cardId: "card_9021" }))).toEqual(["DSP-9001"]);
  });
  it("only a posted payment out by card, at most 120 days old and not yet reported, with the words the customer reads", async () => {
    const b = alex();
    const check = (id: string) => b.call("bank.cards.dispute.check", { cardId: "card_9021", transactionId: id }).then(() => "ok", (e) => `${e.code}: ${e.message}`);
    expect(await check("ct_3")).toBe("TRANSACTION_PENDING: This payment is still pending. You can report a problem once it has posted.");
    expect(await check("ct_7")).toBe("NOT_A_PAYMENT_OUT: Only payments out can be reported.");
    expect(await check("ct_8")).toBe("NOT_A_CARD_PAYMENT: This payment can’t be reported here. Contact us.");
    expect(await check("ct_6")).toBe("DISPUTE_WINDOW_CLOSED: It’s been more than 120 days since this payment. Contact us.");
    expect(await check("ct_5")).toBe("ok");
    expect(await check("nope")).toMatch(/^TRANSACTION_NOT_FOUND/);
    await report(b);
    expect(await check("ct_1")).toBe("DISPUTE_EXISTS: You’ve already reported this payment. Case DSP-9001.");
    expect(await code(b.call("bank.cards.dispute.check", { cardId: "card_3318", transactionId: "ct_1" }))).toBe("TRANSACTION_NOT_FOUND");
  });
  it("asks for what each reason needs", async () => {
    const b = alex();
    const r = (reason: string, details: Record<string, unknown>) => msg(report(b, { reason, details, transactionId: "ct_4" }));
    expect(await r("Charged twice", {})).toBe("Choose when the other charge was.");
    expect(await r("Wrong amount", { expectedAmount: 45 })).toBe("This is the amount that was charged.");
    expect(await r("Wrong amount", {})).toBe("Enter the amount you expected.");
    expect(await r("Goods or service not received", { ordered: "ab", arrivedBy: "2026-10-20", contacted: "yes" })).toBe("Tell us what you ordered.");
    expect(await r("Goods or service not received", { ordered: "A parcel", contacted: "yes" })).toMatch(/when it should have arrived/);
    expect(await r("Cancelled but charged", {})).toBe("Choose when you cancelled.");
    expect(await r("Other", { text: "short" })).toBe("Tell us a little more (at least 10 characters).");
    expect(await r("I don’t recognise it", {})).toMatch(/whether you still have your card/);
    expect(await code(report(b, { reason: "Because", transactionId: "ct_4" }))).toBe("REASON_INVALID");
    expect(await r("Wrong amount", { expectedAmount: 40 })).toBe("ok");
  });
  it("blocks the card from the report when asked, only for a payment not recognised on an active card", async () => {
    const b = alex();
    const r = await report(b, { reason: "I don’t recognise it", details: { cardInPossession: "no" }, blockCard: true });
    expect(r).toMatchObject({ cardBlocked: true });
    expect((await issued(b)).card_9021.pill).toBe("Blocked");
    const c = alex();
    expect(await report(c, { transactionId: "ct_4", blockCard: true })).toMatchObject({ cardBlocked: false });
    expect((await issued(c)).card_9021.pill).toBe("Active");
  });
  it("lists the reasons with what they ask and the dates for the selects", async () => {
    const r = await alex().call("bank.cards.dispute.reasons");
    expect(r.reasons.map((x: any) => x.name)).toEqual(["I don’t recognise it", "Charged twice", "Wrong amount", "Goods or service not received", "Cancelled but charged", "Other"]);
    expect([Object.keys(r.days30).length, Object.keys(r.days60).length, Object.keys(r.days90).length, r.windowDays]).toEqual([30, 60, 90, 120]);
    expect(r.days30["2026-11-02"].name).toBe("Mon 2 Nov (yesterday)");
  });
});

describe("saving a card from another bank", () => {
  const card = { number: "4242 4242 4242 4242", holder: "Alex Morgan", expiry: "12/29", cvv: "123", postcode: "62704" };
  const check = (b: MockBank, over: Record<string, unknown> = {}) => b.call("bank.cards.check", { ...card, ...over }).then(() => "ok", (e) => `${e.code}: ${e.message}`);
  it("checks the number, type, length, expiry, security code, name and postcode with the words the customer reads", async () => {
    const b = alex();
    expect(await check(b)).toBe("ok");
    expect(await check(b, { number: "4242 4242 4242 4241" })).toBe("CARD_INVALID: Check the card number.");
    expect(await check(b, { number: "abcd" })).toBe("CARD_INVALID: Use digits only.");
    expect(await check(b, { number: "6011 1111 1111 1117" })).toBe("CARD_BRAND_UNSUPPORTED: We can’t accept this type of card.");
    expect(await check(b, { number: "4242 4242 4242" })).toBe("CARD_INVALID: Check the card number.");
    expect(await check(b, { number: "5555 5555 5555 4444" })).toBe("ok");
    expect(await check(b, { number: "2221 0000 0000 0009" })).toBe("ok");
    expect(await check(b, { expiry: "13/29" })).toBe("EXPIRY_INVALID: Use the format MM/YY.");
    expect(await check(b, { expiry: "01/24" })).toBe("CARD_EXPIRED: This card has expired.");
    expect(await check(b, { expiry: "12/42" })).toBe("EXPIRY_INVALID: Check the expiry date.");
    expect(await check(b, { cvv: "12" })).toBe("CVV_INVALID: Enter the 3 digits on the back.");
    expect(await check(b, { holder: "A1" })).toBe("HOLDER_INVALID: Use letters only.");
    expect(await check(b, { postcode: "1234" })).toBe("POSTCODE_INVALID: Enter the 5-digit ZIP code.");
    expect(await check(b, { postcode: "62704-1234" })).toBe("ok");
    expect(await check(b, { number: "4000 0000 0000 0002" })).toBe("CARD_DECLINED: The card was declined. Try another card.");
  });
  it("the 15-digit type needs acceptAmex and a 4-digit code; the others need 3", async () => {
    const b = alex();
    const amex = { number: "3782 822463 10005", cvv: "1234" };
    expect(await check(b, amex)).toBe("ok");
    expect(await check(b, { ...amex, cvv: "123" })).toBe("CVV_INVALID: Enter the 4 digits on the front.");
    expect(await check(b, { ...amex, acceptAmex: false })).toBe("CARD_BRAND_UNSUPPORTED: We can’t accept this type of card.");
    expect(await check(b, { cvv: "1234" })).toBe("CVV_INVALID: Enter the 3 digits on the back.");
  });
  it("the postcode follows the home market and is not asked in market D", async () => {
    expect(await check(alex({ config: { homeMarket: "uk" } }), { postcode: "SW1A 1AA" })).toBe("ok");
    expect(await check(alex({ config: { homeMarket: "uk" } }), { postcode: "1234" })).toBe("POSTCODE_INVALID: Enter a valid postcode.");
    expect(await check(alex({ config: { homeMarket: "eu" } }), { postcode: "10115" })).toBe("ok");
    expect(await check(alex({ config: { homeMarket: "eu" } }), { postcode: "1" })).toBe("POSTCODE_INVALID: Enter a valid postcode.");
    expect(await check(alex({ config: { homeMarket: "ae" } }), { postcode: "" })).toBe("ok");
  });
  it("saves only after the right code: a text code (482100 or 000000) or the code of a test charge (4821); three wrong codes end it", async () => {
    const b = alex();
    await b.call("bank.cards.check", card);
    await expect(b.call("bank.cards.verify", { method: "sms", code: "111111" })).rejects.toMatchObject({ code: "VERIFY_INVALID", attempt: 1 });
    await expect(b.call("bank.cards.verify", { method: "sms", code: "111111" })).rejects.toMatchObject({ code: "VERIFY_INVALID", attempt: 2 });
    await expect(b.call("bank.cards.verify", { method: "sms", code: "111111" })).rejects.toMatchObject({ code: "VERIFY_LOCKED" });
    expect(await code(b.call("bank.cards.verify", { method: "sms", code: "482100" }))).toBe("VERIFY_LOCKED");
    expect(await code(b.call("bank.cards.add", card))).toBe("VERIFY_REQUIRED");
    // checking the card again starts over; the test charge has its own code
    const c = alex();
    await c.call("bank.cards.check", card);
    expect(await code(c.call("bank.cards.verify", { method: "charge", code: "482100" }))).toBe("VERIFY_INVALID");
    expect(await code(c.call("bank.cards.verify", { method: "charge", code: "4821" }))).toBe("ok");
    expect(await c.call("bank.cards.add", { ...card, nickname: "Spare card" })).toMatchObject({ last4: "4242", usedFor: "Adding money and Paying", typeText: "Visa ••4242" });
    const d = alex();
    await d.call("bank.cards.check", card);
    expect(await code(d.call("bank.cards.verify", { method: "sms", code: "000000" }))).toBe("ok");
    expect(await code(d.call("bank.cards.verify", { method: "phone", code: "x" }))).toBe("VERIFY_INVALID");
  });
  it("keeps the last four digits and the expiry only, and the uses the customer chose", async () => {
    const b = alex();
    await b.call("bank.cards.check", card);
    await b.call("bank.cards.verify", { method: "sms", code: "482100" });
    expect(await b.call("bank.cards.add", { ...card, useToPay: false })).toMatchObject({ usedFor: "Adding money" });
    const saved = Object.values(await b.call("bank.cards.list")) as any[];
    expect(saved.find((c) => c.last4 === "4242")).toMatchObject({ expiry: "12/29", uses: { addMoney: true, pay: false } });
    const dump = JSON.stringify(b.persona.finance);
    expect(dump).not.toContain("4242424242424242");
    expect(dump).not.toContain("4242 4242");
    expect(dump).not.toContain("123");
    expect(await code(b.call("bank.cards.check", card))).toBe("CARD_DUPLICATE");
  });
  it("saves up to 5 cards and a nickname of 2 or more characters", async () => {
    const b = alex();
    const numbers = ["4111 1111 1111 1111", "4012 8888 8888 1881", "5555 5555 5555 4444", "5105 1051 0510 5100"];
    for (const number of numbers) { await b.call("bank.cards.check", { ...card, number }); await b.call("bank.cards.verify", { method: "sms", code: "482100" }); await b.call("bank.cards.add", { ...card, number }); }
    expect(Object.keys(await b.call("bank.cards.list"))).toHaveLength(5);
    expect(await msg(b.call("bank.cards.check", card))).toBe("You can save up to 5 cards. Remove one to add another.");
    const c = alex();
    await c.call("bank.cards.check", card);
    await c.call("bank.cards.verify", { method: "sms", code: "482100" });
    expect(await code(c.call("bank.cards.add", { ...card, nickname: "x" }))).toBe("NICKNAME_INVALID");
  });
  it("asks again at the end for a card that was saved elsewhere in between", async () => {
    const b = alex();
    await b.call("bank.cards.check", card);
    await b.call("bank.cards.verify", { method: "sms", code: "482100" });
    b.persona.finance!.cards.push({ id: "c_4242", network: "visa", last4: "4242", holder: "Alex", expiry: "12/29", nickname: "Other", isDefault: false });
    expect(await code(b.call("bank.cards.add", card))).toBe("CARD_DUPLICATE");
  });
});

describe("who may use the card adapters", () => {
  it("a customer without the permission is refused, whatever the screen shows", async () => {
    const without = (p: string) => alex({ conditions: { withoutPermissions: [p] } });
    expect(await code(without("cards.manage").call("bank.cards.freeze", { cardId: "card_9021" }))).toBe("PERMISSION_DENIED");
    expect(await code(without("cards.manage").call("bank.cards.controls.update", { cardId: "card_9021" }))).toBe("PERMISSION_DENIED");
    expect(await code(without("cards.pin").call("bank.cards.pin.set", { cardId: "card_9021", pin: "2580" }))).toBe("PERMISSION_DENIED");
    expect(await code(without("cards.dispute").call("bank.cards.dispute.create", { cardId: "card_9021", transactionId: "ct_1" }))).toBe("PERMISSION_DENIED");
    expect(await code(without("payments.create").call("bank.cards.check", {}))).toBe("PERMISSION_DENIED");
    expect(await code(without("cards.manage").call("bank.cards.issued"))).toBe("ok");
  });
});

describe("every rule can be switched off, one at a time, for the mutation check", () => {
  const f = (k: keyof Flaws) => ({ [k]: false }) as Flaws;
  it("a card that is not active can be frozen, changed or given a PIN when cardState is off", async () => {
    const b = alex({ flaws: f("cardState") });
    expect(await code(b.call("bank.cards.freeze", { cardId: "card_7745" }))).toBe("ok");
  });
  it("unfreezing and loosening need no code when their rules are off", async () => {
    const b = alex({ flaws: { unfreezeCode: false, loosenCode: false } });
    await b.call("bank.cards.freeze", { cardId: "card_9021" });
    expect(await code(b.call("bank.cards.unfreeze", { cardId: "card_9021" }))).toBe("ok");
    expect(await code(b.call("bank.cards.controls.update", { cardId: "card_9021", limits: { dailyPurchases: 4000 } }))).toBe("ok");
  });
});
