import { describe, expect, it } from "vitest";
import { MockBank } from "./index";

const code = async (p: Promise<unknown>) => { try { await p; return "ok"; } catch (e: any) { return e.code as string; } };
const enter = async (b: MockBank, id: string) => { await b.call("bank.session.stepUp", { code: "482100" }); return b.call("bank.session.switch", { contextId: id }); };
const verified = async (b: MockBank) => { await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" }); };

describe("one login, several places to bank", () => {
  it("lists personal and both companies with the role in each", async () => {
    const s = await new MockBank("alex").call("bank.session.get");
    expect(s.active).toBe("personal");
    expect(s.contexts.map((c: any) => [c.id, c.role])).toEqual([["personal", undefined], ["alpha", "Maker"], ["beta", "Approver"]]);
    expect(s.contexts[1].permissions).toEqual(["accounts.view", "pay.create"]);
    expect(s.contexts[2].permissions).toEqual(["accounts.view", "pay.approve"]);
  });
  it("asks for step-up before opening a company, every time", async () => {
    const b = new MockBank("alex");
    expect(await code(b.call("bank.session.switch", { contextId: "alpha" }))).toBe("STEP_UP_REQUIRED");
    expect(await code(b.call("bank.session.stepUp", { code: "999999" }))).toBe("OTP_INVALID");
    await enter(b, "alpha");
    await b.call("bank.session.switch", { contextId: "personal" });
    expect(await code(b.call("bank.session.switch", { contextId: "beta" }))).toBe("STEP_UP_REQUIRED");
    expect(await code(b.call("bank.session.switch", { contextId: "nope" }))).toBe("CONTEXT_NOT_FOUND");
  });
  it("keeps personal and company data apart", async () => {
    const b = new MockBank("alex");
    expect(Object.keys(await b.call("bank.accounts.list"))).toEqual(["acc_main", "acc_save", "acc_eur", "acc_aed"]);
    await enter(b, "alpha");
    expect(await code(b.call("bank.accounts.list"))).toBe("WRONG_CONTEXT");
    expect(Object.keys((await b.call("corp.company.get")).accounts)).toEqual(["alpha_ops", "alpha_pay", "alpha_eur"]);
    await b.call("bank.session.switch", { contextId: "personal" });
    expect(await code(b.call("corp.company.get"))).toBe("WRONG_CONTEXT");
    expect(Object.keys(await b.call("bank.accounts.list"))).toEqual(["acc_main", "acc_save", "acc_eur", "acc_aed"]);
  });
  it("gives Alpha a past: one released, one waiting for Maria, one rejected with a reason", async () => {
    const b = new MockBank("alex");
    await enter(b, "alpha");
    const got = await Promise.all(["pay_alpha_1", "pay_alpha_2", "pay_alpha_3"].map((paymentId) => b.call("corp.payments.get", { paymentId })));
    expect(got.map((p: any) => [p.amount, p.status])).toEqual([[4800, "released"], [7250, "pending_approval"], [1600, "rejected"]]);
  });
  it("lets Alex start a payment at Alpha as Maker, pending approval, and refuses him approving it", async () => {
    const b = new MockBank("alex");
    await enter(b, "alpha");
    await verified(b);
    const p = await b.call("corp.payments.initiate", { fromAccountId: "alpha_ops", beneficiaryId: "nordic", amount: 9000, reference: "INV-1" });
    expect(p).toMatchObject({ status: "pending_approval", initiatedBy: "alex", payee: "Nordic Supplies AB" });
    await verified(b);
    expect(await code(b.call("corp.payments.approve", { paymentId: p.id }))).toBe("NOT_AUTHORISED");
  });
  it("refuses acting as someone else, however the call is made", async () => {
    const b = new MockBank("alex");
    await enter(b, "alpha");
    await verified(b);
    expect(await code(b.call("corp.payments.initiate", { userId: "maria", fromAccountId: "alpha_ops", beneficiaryId: "nordic", amount: 10 }))).toBe("PERMISSION_DENIED");
    expect(await code(b.call("corp.payments.approve", { userId: "maria", paymentId: "x" }))).toBe("PERMISSION_DENIED");
  });
  it("shows Beta's own queue and lets Alex approve there", async () => {
    const b = new MockBank("alex");
    await enter(b, "beta");
    const pending = await b.call("corp.payments.pending");
    expect(Object.values(pending).map((p: any) => [p.payee, p.amount, p.approvals.length, p.required])).toEqual([["Kestrel Logistics", 12400, 1, 2], ["Orbit Print Co", 2150, 0, 1], ["Pixel Office Supply", 18900, 0, 2]]);
    const orbit = Object.values(pending).find((p: any) => p.amount === 2150) as any;
    await verified(b);
    expect(await b.call("corp.payments.approve", { paymentId: orbit.id })).toMatchObject({ status: "released" });
    const kestrel = Object.values(pending).find((p: any) => p.amount === 12400) as any;
    await verified(b);
    expect(await b.call("corp.payments.approve", { paymentId: kestrel.id })).toMatchObject({ status: "released" });
    expect(Object.values(await b.call("corp.payments.pending")).map((p: any) => p.amount)).toEqual([18900]);
  });
  it("shows none of Alpha's payments at Beta", async () => {
    const b = new MockBank("alex");
    await enter(b, "alpha");
    await verified(b);
    const p = await b.call("corp.payments.initiate", { fromAccountId: "alpha_ops", beneficiaryId: "nordic", amount: 500 });
    await b.call("bank.session.switch", { contextId: "personal" });
    await enter(b, "beta");
    expect(await code(b.call("corp.payments.get", { paymentId: p.id }))).toBe("PAYMENT_NOT_FOUND");
    expect(Object.values(await b.call("corp.payments.pending")).some((x: any) => x.id === p.id)).toBe(false);
  });
  it("leaves a customer without companies as before", async () => {
    const b = new MockBank("ayesha");
    expect(Object.keys(await b.call("bank.accounts.list")).length).toBeGreaterThan(0);
    expect(await code(b.call("corp.company.get"))).toBe("NOT_SUPPORTED");
  });
});
