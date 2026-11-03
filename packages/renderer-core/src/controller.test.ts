import { describe, expect, it } from "vitest";
import { addMoney, payBill } from "@finx/journey-schema";
import { MockBank } from "@finx/mock-bank-api";
import { JourneyController } from "./controller";

const make = (journey = payBill, extra: object = {}) => {
  const bank = new MockBank("ayesha");
  return new JourneyController(journey, { adapter: (id, input) => bank.call(id, input), ...extra });
};

describe("JourneyController", () => {
  it("splits the first screen into body and buttons, with a step bar and no back button", async () => {
    const c = make(); await c.start();
    const l = c.layout();
    expect(l.view.screenId).toBe("bill");
    expect(l.buttons.map((b) => b.label)).toEqual(["Find my bill"]);
    expect(l.body.some((b) => b.type === "button")).toBe(false);
    expect(l).toMatchObject({ terminal: false, canGoBack: false, rtl: false, lang: "en" });
    expect(l.steps).toEqual({ count: 3, done: [true, false, false], label: "Step 1 of 3" });
  });

  it("applies initial answers after the journey opens", async () => {
    const bank = new MockBank("alex");
    const c = new JourneyController(addMoney, { adapter: (id, i) => bank.call(id, i), initial: { "add.fromCardId": "c_5832" } });
    await c.start();
    expect(c.runner.get("add.fromCardId")).toBe("c_5832");
    expect(c.layout().body.find((b) => b.type === "select")!.value).toBe("c_5832");
  });

  it("steps back when it can and says to close when it cannot", async () => {
    const c = make(); await c.start();
    expect(c.stepBack()).toBe(false);
    c.set("bill.billerId", "k_electric"); c.set("bill.fromAccountId", "acc_current"); c.set("bill.reference", "0123456789");
    await c.press(c.layout().buttons[0]!.actions);
    expect(c.layout()).toMatchObject({ canGoBack: true });
    expect(c.layout().view.screenId).toBe("review");
    expect(c.stepBack()).toBe(true);
    expect(c.layout().view.screenId).toBe("bill");
  });

  it("shows no back button on an end screen, and reads right to left in Urdu", async () => {
    const c = make(payBill, { lang: "ur" }); await c.start();
    expect(c.layout().rtl).toBe(true);
    c.setLang("en"); expect(c.layout().rtl).toBe(false);
    c.set("bill.billerId", "k_electric"); c.set("bill.fromAccountId", "acc_current"); c.set("bill.reference", "0123456789");
    await c.press(c.layout().buttons[0]!.actions);
    c.set("bill.consent", true); await c.press(c.layout().buttons[0]!.actions);
    c.set("otp.code", "482100"); await c.press(c.layout().buttons[0]!.actions);
    const l = c.layout();
    expect(l).toMatchObject({ terminal: true, canGoBack: false });
    expect(c.stepBack()).toBe(false);
  });

  it("notifies subscribers when something changes", async () => {
    const c = make(); await c.start();
    let n = 0; const off = c.subscribe(() => { n++; });
    c.set("bill.reference", "1"); expect(n).toBe(1);
    off(); c.set("bill.reference", "12"); expect(n).toBe(1);
  });
});

describe("run events (analytics)", () => {
  it("reports screen views, mistakes, bank failures, back and exit, without any answers", async () => {
    const { Journey } = await import("@finx/journey-schema");
    const events: any[] = [];
    const j = Journey.parse({
      id: "jrn_ev", slug: "ev", version: 3, status: "draft", channels: ["mobile"], name: { en: "Ev" }, locale: { default: "en", supported: ["en"] }, entryScreen: "a",
      integrations: [{ id: "boom", adapter: "bank.boom", mode: "sandbox" }],
      dataModel: { "form.name": { type: "string", required: true } },
      screens: [
        { id: "a", title: { en: "A" }, blocks: [{ type: "textInput", bind: "form.name", label: { en: "Name" } }, { type: "button", label: { en: "Go" }, actions: [{ type: "validate" }, { type: "callApi", integration: "boom", onError: { navigate: "c" } }, { type: "navigate", to: "b" }] }], navigation: { next: "b" } },
        { id: "b", title: { en: "B" }, blocks: [{ type: "button", label: { en: "Quit" }, actions: [{ type: "exit" }] }] },
        { id: "c", title: { en: "C" }, kind: "terminal", blocks: [] },
      ],
    });
    const c = new JourneyController(j, { adapter: async () => { throw Object.assign(new Error("no"), { code: "ERR-9" }); }, onEvent: (e) => events.push(e) });
    await c.start();
    await c.press(c.layout().buttons[0]!.actions); // the name is empty: a mistake
    c.set("form.name", "secret-name");
    await c.press(c.layout().buttons[0]!.actions); // the bank call fails and sends the person to c
    expect(events.map((e) => e.type)).toEqual(["screen", "invalid", "apiError", "screen"]);
    expect(events[1]).toMatchObject({ screen: "a", fields: ["form.name"] });
    expect(events[2]).toMatchObject({ screen: "a", integration: "boom", code: "ERR-9" });
    expect(events[3]).toMatchObject({ screen: "c", kind: "terminal", slug: "ev", version: 3, lang: "en" });
    expect(new Set(events.map((e) => e.session)).size).toBe(1);
    expect(JSON.stringify(events)).not.toContain("secret-name");
  });

  it("a listener that throws never breaks the journey", async () => {
    const { Journey, corporatePayment } = await import("@finx/journey-schema");
    const c = new JourneyController(Journey.parse(corporatePayment), { adapter: async () => ({}), onEvent: () => { throw new Error("analytics down"); } });
    await expect(c.start()).resolves.toBeUndefined();
  });
});
