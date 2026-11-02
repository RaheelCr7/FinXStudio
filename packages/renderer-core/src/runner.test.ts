import { describe, it, expect } from "vitest";
import { localTransfer } from "@finx/journey-schema";
import { MockBank } from "@finx/mock-bank-api";
import { JourneyRunner } from "./runner";

const mk = (persona = "ayesha", lang = "en") => {
  const bank = new MockBank(persona);
  const r = new JourneyRunner(localTransfer, { adapter: (id, input) => bank.call(id, input), lang });
  return { r, bank };
};
const press = async (r: JourneyRunner, label: string) => {
  const btn = r.view().blocks.find((b) => b.type === "button" && b.label === label);
  if (!btn) throw new Error(`No button "${label}" on ${r.current}; has ${r.view().blocks.filter((b) => b.type === "button").map((b) => b.label)}`);
  await r.press(btn.actions);
};

describe("Local transfer journey, end to end against the sandbox", () => {
  it("happy path: account -> beneficiary -> amount -> review -> otp -> success", async () => {
    const { r, bank } = mk();
    await r.start();
    expect(r.current).toBe("account");
    expect(r.view().blocks.find((b) => b.type === "accountPicker")!.items).toHaveLength(2);

    await press(r, "Continue");
    expect(r.current).toBe("account"); // blocked: no account selected
    expect(r.errors["transfer.fromAccountId"]).toBeTruthy();

    r.set("transfer.fromAccountId", "acc_current");
    await press(r, "Continue");
    expect(r.current).toBe("beneficiary");

    r.set("transfer.beneficiaryId", "ben_4821");
    await press(r, "Continue");
    expect(r.current).toBe("amount");
    expect(r.view().blocks.find((b) => b.type === "amountInput")!.helper).toBe("Daily limit PKR 50,000 · used PKR 0");

    r.set("transfer.amount", 25000);
    r.set("transfer.purpose", "Family support");
    await press(r, "Continue");
    expect(r.current).toBe("review");
    const rows = r.view().blocks.find((b) => b.type === "reviewSummary")!.rows;
    expect(rows.map((x: any) => x.value)).toEqual(["••7710", "Ahmed Khan", "PKR 25,000", "PKR 0"]);

    await press(r, "Confirm and send OTP");
    expect(r.current).toBe("review"); // consent missing
    expect(r.errors["transfer.consent"]).toBe("Tick the confirmation first");

    r.set("transfer.consent", true);
    await press(r, "Confirm and send OTP");
    expect(r.current).toBe("otp");

    r.set("otp.code", "482100");
    await press(r, "Verify and send");
    expect(r.current).toBe("success");
    expect(r.view().kind).toBe("terminal");
    expect(r.view().blocks.find((b) => b.type === "result")!.meta).toMatch(/^Ref TRX-/);
    expect((await bank.call("bank.accounts.list")).acc_current.balance).toBe(159250);
  });

  it("amount above remaining daily limit branches to limitExceeded", async () => {
    const { r } = mk();
    await r.start();
    r.set("transfer.fromAccountId", "acc_current"); await press(r, "Continue");
    r.set("transfer.beneficiaryId", "ben_4821"); await press(r, "Continue");
    r.set("transfer.amount", 60000); r.set("transfer.purpose", "Rent");
    await press(r, "Continue");
    expect(r.current).toBe("limitExceeded");
    await press(r, "Change amount");
    expect(r.current).toBe("amount");
  });

  it("amount above balance is rejected on the amount screen", async () => {
    const { r } = mk("bilal");
    await r.start();
    r.set("transfer.fromAccountId", "acc_current"); await press(r, "Continue");
    r.set("transfer.beneficiaryId", "ben_9001"); await press(r, "Continue");
    r.set("transfer.amount", 95000); r.set("transfer.purpose", "Rent");
    await press(r, "Continue");
    expect(r.current).toBe("amount");
    expect(r.errors["transfer.amount"]).toBe("Amount is more than your available balance");
  });

  it("three wrong OTPs lock the journey to the failed screen", async () => {
    const { r } = mk();
    await r.start();
    r.set("transfer.fromAccountId", "acc_current"); await press(r, "Continue");
    r.set("transfer.beneficiaryId", "ben_4821"); await press(r, "Continue");
    r.set("transfer.amount", 1000); r.set("transfer.purpose", "Rent"); await press(r, "Continue");
    r.set("transfer.consent", true); await press(r, "Confirm and send OTP");
    for (let i = 0; i < 2; i++) { r.set("otp.code", "999999"); await press(r, "Verify and send"); expect(r.current).toBe("otp"); expect(r.view().toast).toBe("Incorrect code"); }
    r.set("otp.code", "999999"); await press(r, "Verify and send");
    expect(r.current).toBe("failed");
  });

  it("a core failure after valid OTP ends on the failed screen, money untouched", async () => {
    const { r, bank } = mk("bilal");
    await r.start();
    r.set("transfer.fromAccountId", "acc_current"); await press(r, "Continue");
    r.set("transfer.beneficiaryId", "ben_9001"); await press(r, "Continue");
    r.set("transfer.amount", 5000); r.set("transfer.purpose", "Rent"); await press(r, "Continue");
    r.set("transfer.consent", true); await press(r, "Confirm and send OTP");
    r.set("otp.code", "111111"); await press(r, "Verify and send");
    expect(r.current).toBe("failed");
    expect((await bank.call("bank.accounts.list")).acc_current.balance).toBe(92000);
  });

  it("renders in Urdu with RTL", async () => {
    const { r } = mk("ayesha", "ur");
    await r.start();
    expect(r.isRtl).toBe(true);
    expect(r.view().title).toBe("کس اکاؤنٹ سے");
  });
});
