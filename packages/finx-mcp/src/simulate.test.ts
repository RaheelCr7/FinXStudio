import { describe, it, expect } from "vitest";
import { localTransfer, payBill } from "@finx/journey-schema";
import { simulate, type Step } from "./simulate";

const payHappy: Step[] = [
  { press: "Find my bill" }, { expectError: "bill.reference" },
  { set: { "bill.billerId": "k_electric", "bill.fromAccountId": "acc_current", "bill.reference": "0123456789" } },
  { press: "Find my bill" }, { expectScreen: "review" }, { expectText: "K-Electric" }, { expectText: "7,789" },
  { press: "Confirm and send OTP" }, { expectError: "Tick the confirmation first" },
  { set: { "bill.consent": true } }, { press: "Confirm and send OTP" }, { expectScreen: "otp" },
  { set: { "otp.code": "482100" } }, { press: "Pay now" }, { expectScreen: "success" }, { expectText: "Bill paid" },
];

describe("simulate", () => {
  it("runs the Pay a bill happy path, checks, and reports balances and coverage", async () => {
    const r = await simulate({ journey: payBill, persona: "ayesha", lang: "en", steps: payHappy });
    expect(r.failures).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.finalScreen).toBe("success");
    expect(r.finalKind).toBe("terminal");
    expect(r.bank.balances.acc_current).toBe(184250 - 7789);
    expect(r.bank.limitUsedToday).toBe(7789);
    expect(r.visited).toEqual(["bill", "review", "otp", "success"]);
    expect(r.unvisited).toEqual(["failed"]);
    expect(r.frames[0]!.did).toBe("start");
    expect(r.frames[0]!.blocks.join(" ")).toContain("select[bill.billerId]= options: K-Electric, LESCO, SSGC, PTCL");
  });

  it("shows the lock-out path: three wrong OTPs end on the failed screen with money untouched", async () => {
    const steps: Step[] = [
      { set: { "bill.billerId": "ptcl", "bill.fromAccountId": "acc_current", "bill.reference": "9999999999", "bill.consent": true } },
      { press: "Find my bill" }, { press: "Confirm and send OTP" },
      { set: { "otp.code": "000001" } }, { press: "Pay now" }, { expectToast: "Incorrect code" }, { expectScreen: "otp" },
      { press: "Pay now" }, { press: "Pay now" }, { expectScreen: "failed" },
    ];
    const r = await simulate({ journey: payBill, persona: "ayesha", lang: "en", steps });
    expect(r.failures).toEqual([]);
    expect(r.bank.balances.acc_current).toBe(184250);
  });

  it("shows a core failure after a correct OTP (Bilal) and that no money moved", async () => {
    const steps: Step[] = [
      { set: { "bill.billerId": "lesco", "bill.fromAccountId": "acc_current", "bill.reference": "1234500001", "bill.consent": true } },
      { press: "Find my bill" }, { press: "Confirm and send OTP" }, { set: { "otp.code": "111111" } }, { press: "Pay now" }, { expectScreen: "failed" },
    ];
    const r = await simulate({ journey: payBill, persona: "bilal", lang: "en", steps });
    expect(r.failures).toEqual([]);
    expect(r.bank.balances.acc_current).toBe(92000);
  });

  it("runs in Urdu and still matches buttons by their English label", async () => {
    const r = await simulate({ journey: payBill, persona: "ayesha", lang: "ur", steps: [{ expectText: "کنزیومر نمبر" }, { press: "Find my bill" }, { expectError: "ضروری ہے" }] });
    expect(r.failures).toEqual([]);
    expect(r.frames[0]!.title).toBe("بل ادا کریں");
  });

  it("reports failed expectations with context and keeps going", async () => {
    const r = await simulate({ journey: payBill, persona: "ayesha", lang: "en", steps: [{ expectScreen: "review" }, { expectText: "nonsense" }, { expectToast: "hello" }] });
    expect(r.ok).toBe(false);
    expect(r.failures).toHaveLength(3);
    expect(r.failures[0]).toContain('the journey is on "bill" instead');
    expect(r.failures[1]).toContain("Visible:");
  });

  it("stops with the list of real buttons when a button does not exist", async () => {
    const r = await simulate({ journey: payBill, persona: "ayesha", lang: "en", steps: [{ press: "Submit" }, { expectScreen: "review" }] });
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0]).toContain('Buttons here: "Find my bill"');
  });

  it("tells the author when an API call can fail but the button has no onError", async () => {
    const j = structuredClone(payBill);
    const pay = (j.screens.find((s) => s.id === "otp")!.blocks[1] as any).actions[2];
    delete pay.onError;
    const r = await simulate({
      journey: j, persona: "bilal", lang: "en",
      steps: [{ set: { "bill.billerId": "lesco", "bill.fromAccountId": "acc_current", "bill.reference": "1234500001", "bill.consent": true } }, { press: "Find my bill" }, { press: "Confirm and send OTP" }, { set: { "otp.code": "111111" } }, { press: "Pay now" }],
    });
    expect(r.ok).toBe(false);
    expect(r.failures[0]).toContain("Add onError to that callApi");
  });

  it("runs Local transfer through the daily-limit branch", async () => {
    const r = await simulate({
      journey: localTransfer, persona: "ayesha", lang: "en",
      steps: [{ set: { "transfer.fromAccountId": "acc_current" } }, { press: "Continue" }, { set: { "transfer.beneficiaryId": "ben_4821" } }, { press: "Continue" },
        { set: { "transfer.amount": 60000, "transfer.purpose": "Rent" } }, { press: "Continue" }, { expectScreen: "limitExceeded" }, { expectText: "above your remaining daily limit" }],
    });
    expect(r.failures).toEqual([]);
    expect(r.unvisited).toEqual(["review", "otp", "success", "failed"]);
  });

  it("rejects an unknown persona, an unsupported language and too many steps", async () => {
    await expect(simulate({ journey: payBill, persona: "nobody", lang: "en", steps: [] })).rejects.toThrow(/Unknown persona/);
    await expect(simulate({ journey: payBill, persona: "ayesha", lang: "fr", steps: [] })).rejects.toThrow(/not supported/);
    await expect(simulate({ journey: payBill, persona: "ayesha", lang: "en", steps: Array(81).fill({ expectScreen: "bill" }) })).rejects.toThrow(/Too many steps/);
  });
});
