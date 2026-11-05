import { describe, it, expect } from "vitest";
import { MockBank } from "./index";

// Wednesday 4 November 2026, ten in the morning (UTC)
const NOW = Date.parse("2026-11-04T10:00:00Z");
const alex = () => { const b = new MockBank("alex"); let t = NOW; b.now = () => t; return { b, tick: (ms: number) => { t += ms; } }; };
const code = async (p: Promise<unknown>) => p.then(() => "no error", (e) => e.code as string);
const verify = async (b: MockBank) => { await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" }); };
/** Password, then the one-time code, as the step-up sheet does it. */
async function stepUp(b: MockBank) { await b.call("bank.session.stepUp", { method: "password", secret: "Bwx!Demo2026" }).catch(() => undefined); await verify(b); return b.call("bank.session.stepUp", { method: "password", secret: "Bwx!Demo2026" }); }
async function enter(b: MockBank, id: "alpha" | "beta") { await stepUp(b); return b.call("bank.session.switch", { contextId: id }); }

describe("bank.session.get", () => {
  it("lists Personal, Alpha as Maker and Beta as Approver, with permissions and limits", async () => {
    const { b } = alex();
    const s = await b.call("bank.session.get");
    expect(s).toMatchObject({ identity: { id: "alex", name: "Alex Morgan" }, activeContextId: "personal" });
    expect(s.contexts.map((c: any) => [c.id, c.workspace, c.roles])).toEqual([["personal", "personal", []], ["alpha", "business", ["Maker"]], ["beta", "business", ["Approver"]]]);
    const [personal, alpha, beta] = s.contexts;
    expect(personal.permissions).toContain("payments.create");
    expect(alpha.permissions).toContain("biz.payments.initiate");
    expect(alpha.permissions).not.toContain("biz.approvals.approve");
    expect(beta.permissions).toContain("biz.approvals.approve");
    expect(beta.permissions).not.toContain("biz.payments.initiate");
    expect(alpha.limits).toMatchObject({ currency: "USD", personDaily: 250_000, companyDaily: 1_000_000, approvalAbove: 50_000, codeAbove: 25_000 });
    expect(personal.limits).toMatchObject({ daily: 50_000, usedToday: 0 });
    expect(s.stepUpUntil).toBeUndefined();
  });
  it("is not available to a customer with a single place", async () => {
    await expect(new MockBank("ayesha").call("bank.session.get")).rejects.toMatchObject({ code: "NOT_SUPPORTED" });
  });
});

describe("switching and step-up", () => {
  it("asks for a step-up before a company, and the context stays Personal", async () => {
    const { b } = alex();
    expect(await code(b.call("bank.session.switch", { contextId: "alpha" }))).toBe("STEP_UP_REQUIRED");
    expect(b.activeContextId).toBe("personal");
  });
  it("a wrong password is STEP_UP_FAILED; the right password needs the code too", async () => {
    const { b } = alex();
    expect(await code(b.call("bank.session.stepUp", { method: "password", secret: "nope" }))).toBe("STEP_UP_FAILED");
    expect(await code(b.call("bank.session.stepUp", { method: "password", secret: "Bwx!Demo2026" }))).toBe("OTP_REQUIRED");
    expect(await code(b.call("bank.session.switch", { contextId: "alpha" }))).toBe("STEP_UP_REQUIRED");
    await verify(b);
    const r = await b.call("bank.session.stepUp", { method: "password", secret: "Bwx!Demo2026" });
    expect(Date.parse(r.stepUpUntil) - NOW).toBe(300_000);
  });
  it("without having typed the password, the code alone is not enough", async () => {
    const { b } = alex();
    await verify(b);
    expect(await code(b.call("bank.session.stepUp", { method: "password" }))).toBe("STEP_UP_FAILED");
  });
  it("a password given once is not remembered: the call that finishes the step-up must carry it again", async () => {
    const { b } = alex();
    expect(await code(b.call("bank.session.stepUp", { method: "password", secret: "Bwx!Demo2026" }))).toBe("OTP_REQUIRED");
    await verify(b);
    expect(await code(b.call("bank.session.stepUp", { method: "password" }))).toBe("STEP_UP_FAILED");
    expect((await b.call("bank.session.stepUp", { method: "password", secret: "Bwx!Demo2026" })).stepUpUntil).toBeDefined();
  });
  it("switches into Alpha and back; going back to Personal asks for nothing", async () => {
    const { b } = alex();
    expect(await enter(b, "alpha")).toMatchObject({ id: "alpha", roles: ["Maker"] });
    expect(b.activeContextId).toBe("alpha");
    expect((await b.call("bank.session.get")).stepUpUntil).toBeDefined();
    await b.call("bank.session.switch", { contextId: "personal" });
    expect(b.activeContextId).toBe("personal");
  });
  it("a step-up lasts 5 minutes: a second switch inside it asks nothing, one after it does", async () => {
    const { b, tick } = alex();
    await enter(b, "alpha");
    await b.call("bank.session.switch", { contextId: "beta" });
    expect(b.activeContextId).toBe("beta");
    await b.call("bank.session.switch", { contextId: "personal" });
    tick(301_000);
    expect(await code(b.call("bank.session.switch", { contextId: "alpha" }))).toBe("STEP_UP_REQUIRED");
  });
  it("a code verified in one place is not valid in another", async () => {
    const { b } = alex();
    await enter(b, "beta");
    await verify(b);
    await b.call("bank.session.switch", { contextId: "personal" });
    expect(await code(b.call("bank.payments.create", { quoteId: "x" }))).toBe("OTP_REQUIRED");
  });
  it("an unknown place is refused", async () => {
    const { b } = alex();
    expect(await code(b.call("bank.session.switch", { contextId: "gamma" }))).toBe("PERMISSION_DENIED");
  });
  it("an expired session refuses every call", async () => {
    const { b } = alex();
    b.expireSession();
    expect(await code(b.call("bank.session.get"))).toBe("SESSION_EXPIRED");
    expect(await code(b.call("bank.accounts.list"))).toBe("SESSION_EXPIRED");
  });
});

describe("each place is kept apart", () => {
  it("personal adapters refuse in a company, company adapters refuse in Personal (WRONG_CONTEXT)", async () => {
    const { b } = alex();
    expect(await code(b.call("corp.company.get"))).toBe("WRONG_CONTEXT");
    await enter(b, "alpha");
    for (const a of ["bank.accounts.list", "bank.transactions.list", "bank.payees.list", "bank.limits.get", "bank.cards.issued"]) expect(await code(b.call(a)), a).toBe("WRONG_CONTEXT");
    expect(await code(b.call("corp.company.get"))).toBe("no error");
  });
  it("a company adapter answers about the active company only", async () => {
    const { b } = alex();
    await enter(b, "alpha");
    expect((await b.call("corp.company.get")).name).toBe("Alpha Trading LLC");
    await b.call("bank.session.switch", { contextId: "beta" });
    const beta = await b.call("corp.company.get");
    expect(beta.name).toBe("Beta Services Ltd");
    expect(Object.keys(beta.accounts)).toEqual(["beta_ops", "beta_pay"]);
    expect(JSON.stringify(beta)).not.toContain("Alpha");
  });
  it("business adapters refuse a different userId (PERMISSION_DENIED) and take the signed-in person when none is given", async () => {
    const { b } = alex();
    await enter(b, "beta");
    expect(await code(b.call("corp.payments.pending", { userId: "tom" }))).toBe("PERMISSION_DENIED");
    expect(await code(b.call("corp.company.get", { userId: "priya" }))).toBe("PERMISSION_DENIED");
    expect((await b.call("corp.company.get")).me).toMatchObject({ id: "alex", roles: ["approver"] });
    expect((await b.call("corp.company.get", { userId: "alex" })).me.id).toBe("alex");
  });
  it("a refusal is written to the audit trail", async () => {
    const { b } = alex();
    await enter(b, "alpha");
    await b.call("corp.payments.approve", { paymentId: "PAY-2040" }).catch(() => undefined);
    const audit = Object.values(await b.call("corp.audit.list").catch(() => ({}))) as any[];
    // Alex is a Maker at Alpha: the audit trail needs biz.audit.view, which only Approvers and Admins hold
    expect(audit).toEqual([]);
    await b.call("bank.session.switch", { contextId: "beta" });
    await b.call("corp.payments.initiate", { fromAccountId: "beta_ops", beneficiaryId: "nimb", amount: 10 }).catch(() => undefined);
    const rows = Object.values(await b.call("corp.audit.list")) as any[];
    expect(rows[0]).toMatchObject({ userId: "alex", outcome: "Refused" });
  });
});

describe("Alex at Alpha is a Maker, at Beta an Approver, whatever is forced", () => {
  it("Alex cannot approve Alpha's payment, even with the call forced", async () => {
    const { b } = alex();
    await enter(b, "alpha");
    expect(await code(b.call("corp.payments.approve", { paymentId: "PAY-2040" }))).toBe("PERMISSION_DENIED");
    expect(await code(b.call("corp.payments.reject", { paymentId: "PAY-2040" }))).toBe("PERMISSION_DENIED");
    expect((await b.call("corp.payments.get", { paymentId: "PAY-2040" })).status).toBe("pending_approval");
  });
  it("Alex cannot start a payment at Beta", async () => {
    const { b } = alex();
    await enter(b, "beta");
    for (const [a, i] of [["corp.payments.initiate", { fromAccountId: "beta_ops", beneficiaryId: "nimb", amount: 100 }], ["corp.payments.quote", { fromAccountId: "beta_ops", beneficiaryId: "nimb", amount: 100, purpose: "Goods or services", reference: "X" }], ["corp.bulk.submit", { fromAccountId: "beta_ops", file: "nimb,10,x" }], ["corp.payroll.submit", { fromAccountId: "beta_pay", period: "2026-10", file: "emp_1,10" }]] as const)
      expect(await code(b.call(a, i)), a).toBe("PERMISSION_DENIED");
  });
  it("Beta has two payments started by others waiting for Alex, one needing two approvers", async () => {
    const { b } = alex();
    await enter(b, "beta");
    const pending = await b.call("corp.payments.pending");
    expect(Object.keys(pending)).toEqual(["PAY-2039", "PAY-2041"]);
    expect(pending["PAY-2041"]).toMatchObject({ payee: "Nimbus Logistics", amount: 8200, required: 1, initiatedBy: "priya" });
    expect(pending["PAY-2039"]).toMatchObject({ amount: 64_500, required: 2, initiatedBy: "omar" });
    expect(pending["PAY-2039"].approvals.map((a: any) => a.userId)).toEqual(["lee"]);
  });
  it("approving 8,200 needs no code and releases it; 64,500 needs a code and Lee's approval has been given", async () => {
    const { b } = alex();
    await enter(b, "beta");
    const small = await b.call("corp.payments.approve", { paymentId: "PAY-2041" });
    expect(small.status).toBe("released");
    expect((await b.call("corp.company.get")).accounts.beta_ops.balance).toBe(301_800);
    expect(await code(b.call("corp.payments.approve", { paymentId: "PAY-2039" }))).toBe("OTP_REQUIRED");
    await verify(b);
    expect((await b.call("corp.payments.approve", { paymentId: "PAY-2039" })).status).toBe("released");
    expect((await b.call("corp.company.get")).accounts.beta_ops.balance).toBe(237_300);
  });
  it("the Alpha seed: Alex's own payment waits, an earlier one settled, limits and approvers as agreed", async () => {
    const { b } = alex();
    await enter(b, "alpha");
    const c = await b.call("corp.company.get");
    expect(c).toMatchObject({ currency: "USD", companyDailyLimit: 1_000_000, dualApprovalAbove: 50_000, codeAbove: 25_000 });
    expect(c.me).toMatchObject({ dailyLimit: 250_000 });
    expect(Object.values(c.accounts).map((a: any) => [a.maskedNumber, a.currency, a.balance])).toEqual([["••2001", "USD", 480_000], ["••2044", "EUR", 95_200]]);
    expect((await b.call("corp.payments.pending", { as: "initiator" }))["PAY-2040"]).toMatchObject({ initiatedBy: "alex", amount: 18_900 });
    expect((await b.call("corp.payments.get", { paymentId: "PAY-1187" })).status).toBe("released");
  });
  it("Alex withdraws his own payment at Alpha but nobody else's", async () => {
    const { b } = alex();
    await enter(b, "alpha");
    expect((await b.call("corp.payments.withdraw", { paymentId: "PAY-2040" })).rejectReason).toMatch(/Withdrawn/);
  });
});

describe("the notification centre", () => {
  it("answers in every place, each item tagged with the place it belongs to", async () => {
    const { b } = alex();
    const inPersonal = Object.values(await b.call("bank.notifications.list")) as any[];
    await enter(b, "alpha");
    const inAlpha = Object.values(await b.call("bank.notifications.list")) as any[];
    expect(inAlpha).toEqual(inPersonal);
    expect(new Set(inAlpha.map((n) => n.context))).toEqual(new Set(["personal", "alpha", "beta"]));
    expect(Object.values(await b.call("bank.notifications.list", { context: "beta" })).map((n: any) => n.context)).toEqual(["beta"]);
  });
});
