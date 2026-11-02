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
    expect(rows).toEqual(["K-Electric", "0123456789", "2026-11-12", "PKR 7,789", "Current ••7710", "PKR 0"]);

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

  describe("after the review fixes", () => {
    const toOtp = async (r: JourneyRunner) => {
      await r.start();
      r.set("bill.billerId", "k_electric"); r.set("bill.fromAccountId", "acc_current"); r.set("bill.reference", "0123456789");
      await press(r, "Find my bill"); r.set("bill.consent", true); await press(r, "Confirm and send OTP");
    };

    it("three wrong codes lead to their own screen that says no money left, and nothing is debited", async () => {
      const { r, bank } = mk(); await toOtp(r);
      for (let i = 0; i < 3; i++) { r.set("otp.code", "999999"); await press(r, "Pay now"); }
      expect(r.current).toBe("locked");
      const v = r.view();
      expect(v.title).toBe("Too many wrong codes");
      expect(v.blocks.find((b) => b.type === "result")!.text).toContain("No money has left your account");
      expect((await bank.call("bank.accounts.list")).acc_current.balance).toBe(184250);
    });

    it("the wrong-code message says what to do", async () => {
      const { r } = mk(); await toOtp(r);
      r.set("otp.code", "999999"); await press(r, "Pay now");
      expect(r.view().toast).toBe("That code didn't match. Check the SMS and try again.");
      expect(r.current).toBe("otp");
    });

    it("starting again asks for consent and the code again", async () => {
      const { r } = mk(); await toOtp(r);
      for (let i = 0; i < 3; i++) { r.set("otp.code", "999999"); await press(r, "Pay now"); }
      await press(r, "Start again");
      expect(r.current).toBe("bill");
      expect(r.state.bill.consent).toBe(false);
      expect(r.state.otp.code).toBe("");
      r.set("bill.billerId", "k_electric"); r.set("bill.fromAccountId", "acc_current"); r.set("bill.reference", "0123456789");
      await press(r, "Find my bill"); await press(r, "Confirm and send OTP");
      expect(r.current).toBe("review");
      expect(r.errors["bill.consent"]).toBe("Tick the confirmation first");
    });

    it("a bank failure after the right code keeps its own screen, which also clears the answers and can be closed", async () => {
      const { r } = mk("bilal"); await toOtp(r);
      r.set("otp.code", "111111"); await press(r, "Pay now");
      expect(r.current).toBe("failed");
      expect(r.view().blocks.filter((b) => b.type === "button").map((b) => b.label)).toEqual(["Try again", "Close"]);
      await press(r, "Try again");
      expect(r.state.bill.consent).toBe(false);
      expect(r.state.otp.code).toBe("");
    });

    it("says who was paid in Urdu, and names the OTP step as a code", async () => {
      const { r } = mk("ayesha", "ur"); await r.start();
      r.set("bill.billerId", "k_electric"); r.set("bill.fromAccountId", "acc_current"); r.set("bill.reference", "0123456789");
      await press(r, "میرا بل تلاش کریں"); r.set("bill.consent", true); await press(r, "تصدیق کریں اور کوڈ بھیجیں");
      r.set("otp.code", "482100"); await press(r, "ابھی ادا کریں");
      expect(r.view().blocks.find((b) => b.type === "result")!.text).toBe("K-Electric کو PKR 7,789 ادا کر دیے گئے");
    });
  });
});
