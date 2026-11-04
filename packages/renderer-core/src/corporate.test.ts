import { beforeEach, describe, it, expect } from "vitest";
import { corporateApproval, corporatePayment, Journey } from "@finx/journey-schema";
import { MockBank, PROVIDERS, type ProviderId } from "@finx/mock-bank-api";
import { JourneyRunner } from "./runner";
import { lintAll } from "./lint-expr";

const T = Date.parse("2026-11-03T10:00:00Z"); // Tuesday morning, before the 16:00 cut-off

// the same journeys, the same tests, on every corporate bank API: only the mapping and the adapter behind them differ
let provider: ProviderId = "reference";
const setup = () => {
  const bank = new MockBank("acme", { corpProvider: provider }); bank.now = () => T;
  const run = (journey: unknown) => new JourneyRunner(Journey.parse(journey), { adapter: (id, input) => bank.call(id, input) });
  return { bank, run };
};
const press = async (r: JourneyRunner, label: string) => r.press((r.view().blocks.find((b) => b.type === "button" && b.label === label) as any).actions);
const tapRow = async (r: JourneyRunner, startsWith: string) => {
  const item = r.view().blocks.filter((b) => b.type === "menu").flatMap((b: any) => b.items).find((i: any) => i.label.startsWith(startsWith));
  if (!item) throw new Error(`No row "${startsWith}" on ${r.current}`);
  await r.press(item.actions);
};
const rows = (r: JourneyRunner) => (r.view().blocks.find((b) => b.type === "reviewSummary") as any).rows as { label: string; value: string }[];
const result = (r: JourneyRunner) => r.view().blocks.filter((b) => b.type === "result") as any[];

/** Signs in as someone, fills in the payment, and gets to the review screen. */
async function startPayment(x: ReturnType<typeof setup>, who: string, p: { from?: string; to?: string; amount: number; reference?: string }) {
  const r = x.run(corporatePayment); await r.start();
  r.set("session.userId", who); await press(r, "Continue");
  if (r.current !== "start") return r;
  r.set("pay.fromAccountId", p.from ?? "acme_ops"); r.set("pay.beneficiaryId", p.to ?? "sup_textile"); r.set("pay.amount", p.amount); r.set("pay.reference", p.reference ?? "INV-1");
  await press(r, "Continue");
  return r;
}
const confirmWithCode = async (r: JourneyRunner, button: string, code = "482100") => {
  r.set("pay.consent", true); r.set("appr.consent", true); await press(r, "Confirm and send OTP").catch(() => press(r, "Approve and send OTP"));
  r.set("otp.code", code); await press(r, button);
};

describe.each(PROVIDERS)("corporate journeys on the %s bank API", (p) => {
  beforeEach(() => { provider = p; });
  it("are lint clean and say which role may use them", () => {
    for (const j of [corporatePayment, corporateApproval]) { expect(lintAll(Journey.parse(j)), j.slug).toEqual([]); expect(j.authorisation).toBeTruthy(); }
  });

  it("an initiator starts a payment: it is sent for approval, nothing has moved", async () => {
    const x = setup();
    const r = await startPayment(x, "sara", { amount: 250_000, reference: "INV-77" });
    expect(r.current).toBe("review");
    expect(rows(r)).toContainEqual({ label: "From", value: "Operations ••6100" });
    expect(rows(r)).toContainEqual({ label: "To", value: "Atlas Textiles" });
    expect(rows(r)).toContainEqual({ label: "Amount", value: "PKR 250,000" });
    expect(rows(r)).toContainEqual({ label: "Approvers needed", value: "1" });
    await confirmWithCode(r, "Verify and send for approval");
    expect(r.current).toBe("success");
    expect(result(r)[0].text).toContain("PKR 250,000 to Atlas Textiles now waits for 1 approver(s)");
    const [id] = Object.keys(await x.bank.call("corp.payments.pending", { userId: "hassan" }));
    expect(result(r)[0].meta).toBe(`Payment ${id} · value date 2026-11-03`);
    expect((await x.bank.call("corp.company.get", { userId: "sara" })).accounts.acme_ops.balance).toBe(25_000_000);
    expect(Object.keys(await x.bank.call("corp.payments.pending", { userId: "hassan" }))).toEqual([id]);
  });

  it("shows two approvers needed above the threshold, and the cut-off note", async () => {
    const x = setup();
    const r = await startPayment(x, "sara", { amount: 2_000_000 });
    expect(rows(r)).toContainEqual({ label: "Approvers needed", value: "2" });
    expect(r.view().blocks.some((b: any) => b.type === "alert" && b.text.includes("after 16:00 UTC"))).toBe(true);
  });

  it("sends someone who is not an initiator to the denied screen", async () => {
    const x = setup();
    const r = await startPayment(x, "hassan", { amount: 1000 });
    expect(r.current).toBe("denied");
    expect(result(r)[0].text).toBe("Only an initiator can use this. You are signed in as Hassan Mahfouz.");
  });

  it("stops an amount above the person's own daily limit before it goes anywhere", async () => {
    const x = setup();
    const r = await startPayment(x, "omar", { amount: 600_000 }); // Omar's limit is 500,000
    expect(r.current).toBe("start");
    expect(r.errors["pay.amount"]).toBe("That is above your daily limit");
    const helper = (r.view().blocks.find((b) => b.type === "amountInput") as any).helper;
    expect(helper).toBe("Your limit left today: PKR 500,000");
  });

  it("explains a refusal from the bank and says no money has left", async () => {
    const x = setup();
    const r = await startPayment(x, "sara", { from: "acme_usd", amount: 100 }); // the limits are in PKR
    await confirmWithCode(r, "Verify and send for approval");
    expect(r.current).toBe("failed");
    expect(result(r)[0].text).toBe("Payments are limited in PKR: choose a PKR account");
    expect(r.view().blocks.some((b: any) => b.type === "text" && b.text === "No money has left the account.")).toBe(true);
    await press(r, "Try again"); expect(r.current).toBe("start");
  });

  it("locks after three wrong codes", async () => {
    const x = setup();
    const r = await startPayment(x, "sara", { amount: 1000 });
    r.set("pay.consent", true); await press(r, "Confirm and send OTP");
    for (let i = 0; i < 3; i++) { r.set("otp.code", "999999"); await press(r, "Verify and send for approval"); }
    expect(r.current).toBe("failed");
  });

  async function approver(x: ReturnType<typeof setup>, who: string) {
    const r = x.run(corporateApproval); await r.start();
    r.set("session.userId", who); await press(r, "Continue");
    return r;
  }
  const initiate = (x: ReturnType<typeof setup>, userId: string, amount: number, reference: string) => x.bank.call("bank.otp.send").then(() => x.bank.call("bank.otp.verify", { code: "482100" }))
    .then(() => x.bank.call("corp.payments.initiate", { userId, fromAccountId: "acme_ops", beneficiaryId: "sup_logistics", amount, reference }));

  it("an approver sees what waits, reviews it, approves with a code, and the money is released", async () => {
    const x = setup(); await initiate(x, "sara", 250_000, "INV-9");
    const r = await approver(x, "hassan");
    expect(r.current).toBe("start");
    const [row]: any[] = (r.view().blocks.find((b) => b.type === "menu") as any).items;
    expect(row.label).toBe("PKR 250,000 to Nile Logistics");
    expect(row.text).toBe("INV-9 · started by sara · 0 of 1 approved");
    await tapRow(r, "PKR 250,000");
    expect(r.current).toBe("review");
    expect(rows(r)).toContainEqual({ label: "Started by", value: "sara" });
    await confirmWithCode(r, "Verify and approve");
    expect(r.current).toBe("approved");
    expect(result(r)[0]).toMatchObject({ title: "Payment released" });
    expect(result(r)[0].text).toMatch(/^CORP-20261103-0001: PKR 250,000 has been sent\.$/);
    expect(result(r).length).toBe(1); // the "waiting for a second approver" message is hidden
    expect((await x.bank.call("corp.company.get", { userId: "hassan" })).accounts.acme_ops.balance).toBe(24_750_000);
  });

  it("a large payment needs a second, different approver, and says so", async () => {
    const x = setup(); await initiate(x, "sara", 2_000_000, "BIG");
    const first = await approver(x, "hassan"); await tapRow(first, "PKR 2,000,000"); await confirmWithCode(first, "Verify and approve");
    expect(result(first)[0]).toMatchObject({ title: "Approved" });
    expect(result(first)[0].text).toBe("It needs 2 approvers: 1 so far. It is released when the next one approves.");
    const again = await approver(x, "hassan");
    expect((again.view().blocks.find((b) => b.type === "menu") as any).items).toEqual([]); // nothing left for Hassan
    expect(again.view().blocks.some((b: any) => b.type === "text" && b.text === "Nothing is waiting for your approval.")).toBe(true);
    const second = await approver(x, "layla"); await tapRow(second, "PKR 2,000,000"); await confirmWithCode(second, "Verify and approve");
    expect(result(second)[0]).toMatchObject({ title: "Payment released" });
  });

  it("nobody sees their own payment to approve, and an initiator cannot use the approval journey", async () => {
    const x = setup(); await initiate(x, "nadia", 100_000, "MINE");
    const nadia = await approver(x, "nadia");
    expect((nadia.view().blocks.find((b) => b.type === "menu") as any).items).toEqual([]); // she holds both roles, but may not approve her own
    const sara = await approver(x, "sara");
    expect(sara.current).toBe("denied");
  });

  it("an approver rejects with a reason", async () => {
    const x = setup(); const made = await initiate(x, "sara", 100_000, "WRONG");
    const r = await approver(x, "layla"); await tapRow(r, "PKR 100,000");
    await press(r, "Reject"); expect(r.current).toBe("reject");
    r.set("appr.reason", "Wrong supplier"); await press(r, "Reject payment");
    expect(r.current).toBe("rejected");
    expect((await x.bank.call("corp.payments.get", { paymentId: made.id }))).toMatchObject({ status: "rejected", rejectReason: "Wrong supplier" });
    expect((await x.bank.call("corp.company.get", { userId: "sara" })).me.remainingToday).toBe(3_000_000); // the limit came back
  });
});

describe("a customer who is not a company", () => {
  it("is told it is not available, instead of the journey breaking", async () => {
    const bank = new MockBank("ayesha");
    const r = new JourneyRunner(Journey.parse(corporatePayment), { adapter: (id, input) => bank.call(id, input) });
    await r.start();
    expect(r.current).toBe("unavailable");
    expect((r.view().blocks.find((b) => b.type === "result") as any).text).toBe("Not available for this customer");
    await press(r, "Try again"); expect(r.current).toBe("unavailable");
  });
});

describe("the stage gate: one journey, two banks", () => {
  it("the journeys know nothing of either bank's vocabulary, so they are the same bytes whichever API stands behind them", () => {
    for (const j of [corporatePayment, corporateApproval]) {
      const bytes = JSON.stringify(j);
      expect(bytes, j.slug).not.toMatch(/bank-b|TXN-|ERR-\d|AWAITING_AUTH|EXECUTED|CANCELLED|authChain|remittanceInfo|signer|txnId|approvedCreditors/);
      expect(j.integrations.map((i) => i.adapter).filter((a) => a.startsWith("corp.")).sort(), j.slug).toEqual(j.integrations.map((i) => i.adapter).filter((a) => a.startsWith("corp.")).sort());
      expect(JSON.stringify(j)).toBe(bytes); // running them on either API leaves them untouched
    }
  });
});
