import { describe, it, expect } from "vitest";
import { payBill } from "@finx/journey-schema";
import { MockBank } from "@finx/mock-bank-api";
import { JourneyRunner } from "./runner";

const mk = (persona = "ayesha", lang = "en") => {
  const bank = new MockBank(persona);
  return { bank, r: new JourneyRunner(payBill, { adapter: (id, input) => bank.call(id, input), lang }) };
};
const press = async (r: JourneyRunner, label: string) => {
  const btn = r.view().blocks.find((b) => b.type === "button" && b.label === label);
  if (!btn) throw new Error(`No button "${label}" on ${r.current}`);
  await r.press(btn.actions);
};

describe("Pay a bill, end to end", () => {
  it("lists billers from the sandbox as select items", async () => {
    const { r } = mk(); await r.start();
    const sel = r.view().blocks.find((b) => b.type === "select")!;
    expect(sel.items.map((i: any) => i.name)).toEqual(["K-Electric", "LESCO", "SSGC", "PTCL"]);
  });

  it("happy path: pays the bill and debits the account", async () => {
    const { r, bank } = mk(); await r.start();
    await press(r, "Find my bill");
    expect(r.current).toBe("bill");
    expect(Object.keys(r.errors).sort()).toEqual(["bill.billerId", "bill.fromAccountId", "bill.reference"]);

    r.set("bill.billerId", "k_electric"); r.set("bill.fromAccountId", "acc_current"); r.set("bill.reference", "0123456789");
    await press(r, "Find my bill");
    expect(r.current).toBe("review");
    const rows = r.view().blocks.find((b) => b.type === "reviewSummary")!.rows.map((x: any) => x.value);
    expect(rows).toEqual(["K-Electric", "0123456789", "2026-11-12", "PKR 7,789"]);

    await press(r, "Confirm and send OTP");
    expect(r.current).toBe("review");
    r.set("bill.consent", true);
    await press(r, "Confirm and send OTP");
    expect(r.current).toBe("otp");
    r.set("otp.code", "482100");
    await press(r, "Pay now");
    expect(r.current).toBe("success");
    expect(r.view().blocks.find((b) => b.type === "result")!.text).toBe("PKR 7,789 to K-Electric");
    expect((await bank.call("bank.accounts.list")).acc_current.balance).toBe(184250 - 7789);
  });

  it("rejects a malformed consumer number before calling the bank", async () => {
    const { r } = mk(); await r.start();
    r.set("bill.billerId", "ptcl"); r.set("bill.fromAccountId", "acc_current"); r.set("bill.reference", "12ab");
    await press(r, "Find my bill");
    expect(r.current).toBe("bill");
    expect(r.errors["bill.reference"]).toBe("Enter 10 to 14 digits");
  });

  it("stays on the first screen with a toast when the sandbox cannot find the bill", async () => {
    // the sandbox accepts any 10-14 digit reference, so use a bank that rejects the lookup
    const bank = new MockBank("ayesha");
    const strict = new JourneyRunner(payBill, { adapter: async (id, input) => { if (id === "bank.bills.lookup") throw new Error("not found"); return bank.call(id, input); } });
    await strict.start();
    strict.set("bill.billerId", "lesco"); strict.set("bill.fromAccountId", "acc_current"); strict.set("bill.reference", "1234567890");
    await press(strict, "Find my bill");
    expect(strict.current).toBe("bill");
    expect(strict.view().toast).toBe("We couldn't find that bill. Check the number and try again.");
  });

  it("renders in Urdu", async () => {
    const { r } = mk("ayesha", "ur"); await r.start();
    expect(r.view().title).toBe("بل ادا کریں");
    const t = r.view().blocks.find((b) => b.type === "textInput")!;
    expect(t.label).toBe("کنزیومر نمبر");
  });
});
