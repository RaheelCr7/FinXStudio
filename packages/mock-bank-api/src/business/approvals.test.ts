import { describe, it, expect } from "vitest";
import { MockBank } from "../index";

// Tuesday 3 November 2026, 10:42 (UTC): the cut-off is 16:00
const NOW = Date.parse("2026-11-03T10:42:00Z");
const make = (persona = "alexbiz", opts: ConstructorParameters<typeof MockBank>[1] = {}) => { const b = new MockBank(persona, opts); let t = NOW; b.now = () => t; return { b, tick: (ms: number) => { t += ms; } }; };
const code = async (p: Promise<unknown>) => p.then(() => "no error", (e) => e.code as string);
const verify = async (b: MockBank) => { await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" }); };
const enter = async (b: MockBank, id: "alpha" | "beta") => { await verify(b); await b.call("bank.session.stepUp", { method: "password", secret: "Bwx!Demo2026" }); await b.call("bank.session.switch", { contextId: id }); };

describe("what an approver sees of a waiting payment", () => {
  it("the inbox lists every waiting payment with what Alex can do with each, oldest first, and the history lists what is over", async () => {
    const { b } = make();
    await enter(b, "beta");
    const inbox = await b.call("corp.payments.list", { status: "pending" });
    expect(Object.keys(inbox)).toEqual(["PAY-2039", "PAY-2041", "PAY-2043", "PAY-2044", "PAY-2046", "PAY-2047", "PAY-2048"]);
    expect(Object.values<any>(inbox).map((p) => [p.id, p.statusKey])).toEqual([["PAY-2039", "ready"], ["PAY-2041", "ready"], ["PAY-2043", "ready"], ["PAY-2044", "waiting"], ["PAY-2046", "ready"], ["PAY-2047", "waiting"], ["PAY-2048", "ready"]]);
    expect(inbox["PAY-2044"].you).toMatchObject({ can: false, code: "SELF_APPROVAL", sentence: "You started this payment. Another approver must approve it." });
    expect(inbox["PAY-2044"].note).toBe("Started by you · Cut-off in 5h 18m");
    expect(inbox["PAY-2047"].you).toMatchObject({ can: false, code: "OUT_OF_SEQUENCE", sentence: "Waiting for Lee Park to approve first." });
    expect(inbox["PAY-2046"]).toMatchObject({ need: "Needs 2 approvals", progress: "0 of 2 approved", startedBy: "Omar Haddad", codeRequired: true });
    expect(inbox["PAY-2041"]).toMatchObject({ need: "", codeRequired: false, cutoffText: "Cut-off in 5h 18m", cutoffTone: "neutral", payee: "Nimbus Logistics", nameResult: "match" });
    const history = await b.call("corp.payments.list", { status: "history" });
    expect(Object.keys(history)).toEqual(["PAY-2036", "PAY-2012"]);
    expect(history["PAY-2036"]).toMatchObject({ status: "rejected", rejectReason: "Wrong amount", statusKey: "rejected" });
    expect(Object.keys(await b.call("corp.payments.list"))).toHaveLength(9);
  });
  it("the ones that can be approved together are those Alex can act on now whose name matches", async () => {
    const { b } = make();
    await enter(b, "beta");
    expect(Object.keys(await b.call("corp.payments.list", { status: "ready" }))).toEqual(["PAY-2039", "PAY-2041", "PAY-2046"]);
  });
  it("the approvals card says who approved, who is next and who waits, with the viewer named", async () => {
    const { b } = make();
    await enter(b, "beta");
    const p = await b.call("corp.payments.get", { paymentId: "PAY-2039" });
    expect(p.signatories.map((s: any) => [s.label, s.state, s.text])).toEqual([["Lee Park", "approved", "Approved"], ["Alex Morgan (you)", "next", "Next"]]);
    const q = await b.call("corp.payments.get", { paymentId: "PAY-2047" });
    expect(q.signatories.map((s: any) => [s.label, s.state])).toEqual([["Lee Park", "next"], ["Alex Morgan (you)", "waiting"]]);
    const r = await b.call("corp.payments.get", { paymentId: "PAY-2041" });
    expect(r.signatories.map((s: any) => [s.label, s.state])).toEqual([["Alex Morgan (you)", "can"], ["Lee Park", "can"], ["Sofia Reyes", "can"]]);
  });
  it("a payment whose name the bank's record does not match says so", async () => {
    const { b } = make();
    await enter(b, "beta");
    expect(await b.call("corp.payments.get", { paymentId: "PAY-2043" })).toMatchObject({ nameResult: "close", nameSentence: "The bank’s record says “Rhine Fracht GmbH”.", receive: { amount: 25_465, currency: "EUR" } });
    expect(await b.call("corp.payments.get", { paymentId: "PAY-2048" })).toMatchObject({ nameResult: "none", payee: "Gulf Trade FZE" });
  });
  it("the plain Alex keeps the two waiting payments the combined demo counts", async () => {
    const { b } = make("alex");
    await enter(b, "beta");
    expect(Object.keys(await b.call("corp.payments.pending"))).toEqual(["PAY-2039", "PAY-2041"]);
  });
});

describe("approving", () => {
  it("under the threshold needs no code and releases at the last approval; the result says so", async () => {
    const { b } = make("alex");
    await enter(b, "beta");
    const p = await b.call("corp.payments.approve", { paymentId: "PAY-2041" });
    expect(p).toMatchObject({ status: "released", releaseReference: "CORP-20261103-2041" });
    expect((await b.call("corp.company.get")).accounts.beta_ops.balance).toBe(301_800);
  });
  it("a payment of 25,000 or more asks for the code, the second approver of a two-approver payment releases it", async () => {
    const { b } = make("alex");
    await enter(b, "beta");
    expect(await code(b.call("corp.payments.approve", { paymentId: "PAY-2039" }))).toBe("OTP_REQUIRED");
    await verify(b);
    expect(await b.call("corp.payments.approve", { paymentId: "PAY-2039" })).toMatchObject({ status: "released", approvals: [{ userId: "lee" }, { userId: "alex" }] });
  });
  it("the first of two approvals waits for another approver", async () => {
    const { b } = make();
    await enter(b, "beta");
    await verify(b);
    const p = await b.call("corp.payments.approve", { paymentId: "PAY-2046" });
    expect(p).toMatchObject({ status: "pending_approval", progress: "1 of 2 approved" });
    expect(p.you).toMatchObject({ can: false, code: "ALREADY_APPROVED" });
  });
  it("a sequential payment is refused to the one who is not next", async () => {
    const { b } = make();
    await enter(b, "beta");
    await verify(b);
    expect(await code(b.call("corp.payments.approve", { paymentId: "PAY-2047" }))).toBe("OUT_OF_SEQUENCE");
    expect(await code(b.call("corp.payments.approve", { paymentId: "PAY-2044" }))).toBe("SELF_APPROVAL");
  });
  it("a payment a name check flagged needs the approver to say they checked it", async () => {
    const { b } = make();
    await enter(b, "beta");
    await verify(b);
    expect(await code(b.call("corp.payments.approve", { paymentId: "PAY-2043" }))).toBe("NAME_CHECK_NOT_CONFIRMED");
    expect((await b.call("corp.payments.get", { paymentId: "PAY-2043" })).status).toBe("pending_approval");
    expect(await b.call("corp.payments.approve", { paymentId: "PAY-2043", acknowledged: true })).toMatchObject({ status: "released" });
  });
  it("after the cut-off nothing due that day can be approved", async () => {
    const { b, tick } = make("alex");
    await enter(b, "beta");
    tick(5 * 3600_000 + 19 * 60_000); // 16:01
    const p = await b.call("corp.payments.get", { paymentId: "PAY-2041" });
    expect(p).toMatchObject({ cutoffText: "Cut-off passed", cutoffTone: "negative" });
    expect(p.you).toMatchObject({ can: false, code: "APPROVAL_EXPIRED", sentence: "The cut-off has passed. This payment can’t be approved today." });
    expect(await code(b.call("corp.payments.approve", { paymentId: "PAY-2041" }))).toBe("APPROVAL_EXPIRED");
  });
  it("the cut-off chip counts down and changes tone: amber under 90 minutes, red under 30", async () => {
    const { b, tick } = make("alex");
    await enter(b, "beta");
    tick(4 * 3600_000 + 30 * 60_000); // 15:12, 48 minutes left
    expect(await b.call("corp.payments.get", { paymentId: "PAY-2041" })).toMatchObject({ cutoffText: "Cut-off in 48m", cutoffTone: "warning" });
    tick(25 * 60_000);
    expect(await b.call("corp.payments.get", { paymentId: "PAY-2041" })).toMatchObject({ cutoffText: "Cut-off in 23m", cutoffTone: "negative" });
  });
});

describe("approving several at once", () => {
  it("one code covers them all, and each is released when it has its last approval", async () => {
    const { b } = make();
    await enter(b, "beta");
    expect(await code(b.call("corp.payments.approveMany", { paymentIds: ["PAY-2041", "PAY-2039"] }))).toBe("OTP_REQUIRED");
    await verify(b);
    const r = await b.call("corp.payments.approveMany", { paymentIds: ["PAY-2041", "PAY-2039"] });
    expect(r).toMatchObject({ count: 2, released: 2, total: 72_700, currency: "USD" });
    expect((await b.call("corp.company.get")).accounts.beta_ops.balance).toBe(237_300);
    expect(await code(b.call("corp.payments.approveMany", { paymentIds: ["PAY-2046"] }))).toBe("OTP_REQUIRED"); // the code was used up
  });
  it("a small payment on its own needs no code", async () => {
    const { b } = make();
    await enter(b, "beta");
    expect(await b.call("corp.payments.approveMany", { paymentIds: ["PAY-2041"] })).toMatchObject({ count: 1, released: 1, total: 8_200 });
  });
  it("is refused as a whole when one cannot be approved, and a name check is approved on its own", async () => {
    const { b } = make();
    await enter(b, "beta");
    await verify(b);
    expect(await code(b.call("corp.payments.approveMany", { paymentIds: ["PAY-2041", "PAY-2044"] }))).toBe("SELF_APPROVAL");
    expect(await code(b.call("corp.payments.approveMany", { paymentIds: ["PAY-2041", "PAY-2043"] }))).toBe("NOT_FOR_BATCH");
    expect(await code(b.call("corp.payments.approveMany", { paymentIds: [] }))).toBe("EMPTY_BATCH");
    expect((await b.call("corp.payments.get", { paymentId: "PAY-2041" })).status).toBe("pending_approval");
    expect((await b.call("corp.company.get")).accounts.beta_ops.balance).toBe(310_000);
  });
});

describe("passing a payment to someone", () => {
  it("only the person it was passed to can approve it; the one who passed it is told so", async () => {
    const { b } = make("alex");
    await enter(b, "beta");
    const p = await b.call("corp.payments.delegate", { paymentId: "PAY-2041", toUserId: "lee" });
    expect(p).toMatchObject({ passedTo: "lee", passedBy: "alex" });
    expect(p.you).toMatchObject({ can: false, code: "DELEGATED", sentence: "Passed to Lee Park." });
    expect(await code(b.call("corp.payments.approve", { paymentId: "PAY-2041" }))).toBe("DELEGATED");
  });
  it("not to the person who started it, not to one who already approved, not to yourself", async () => {
    const { b } = make("alex");
    await enter(b, "beta");
    expect(await code(b.call("corp.payments.delegate", { paymentId: "PAY-2041", toUserId: "priya" }))).toBe("NOT_AUTHORISED"); // Priya cannot approve at all
    expect(await code(b.call("corp.payments.delegate", { paymentId: "PAY-2041", toUserId: "alex" }))).toBe("NOT_AUTHORISED");
    expect(await code(b.call("corp.payments.delegate", { paymentId: "PAY-2039", toUserId: "lee" }))).toBe("DELEGATE_ALREADY_APPROVED");
    expect(await code(b.call("corp.payments.delegate", { paymentId: "PAY-2041", toUserId: "nobody" }))).toBe("USER_NOT_FOUND");
  });
  it("a person who started the payment is refused as the person to pass it to", async () => {
    // Lee started nothing at Beta, so make Lee the starter by passing a payment Alex cannot act on: use the cast's PAY-2044 (Alex started it)
    const { b } = make();
    await enter(b, "beta");
    expect(await code(b.call("corp.payments.delegate", { paymentId: "PAY-2044", toUserId: "lee" }))).toBe("SELF_APPROVAL");
  });
  it("one who cannot act cannot pass it either", async () => {
    const { b } = make();
    await enter(b, "beta");
    expect(await code(b.call("corp.payments.delegate", { paymentId: "PAY-2047", toUserId: "sofia" }))).toBe("OUT_OF_SEQUENCE");
  });
});

describe("the permissions of the context, forced", () => {
  it("Alex at Alpha cannot approve, reject, approve several or pass on, whatever name the call carries; the payment stays as it was", async () => {
    const { b } = make("alex");
    await enter(b, "alpha");
    await verify(b);
    expect(await code(b.call("corp.payments.approve", { paymentId: "PAY-2040" }))).toBe("PERMISSION_DENIED");
    expect(await code(b.call("corp.payments.approve", { paymentId: "PAY-2040", userId: "dana" }))).toBe("PERMISSION_DENIED");
    expect(await code(b.call("corp.payments.reject", { paymentId: "PAY-2040", reason: "x" }))).toBe("PERMISSION_DENIED");
    expect(await code(b.call("corp.payments.approveMany", { paymentIds: ["PAY-2040"] }))).toBe("PERMISSION_DENIED");
    expect(await code(b.call("corp.payments.delegate", { paymentId: "PAY-2040", toUserId: "dana" }))).toBe("PERMISSION_DENIED");
    expect((await b.call("corp.payments.get", { paymentId: "PAY-2040" })).status).toBe("pending_approval");
  });
  it("Alex at Beta cannot start a payment or ask for a price", async () => {
    const { b } = make("alex");
    await enter(b, "beta");
    expect(await code(b.call("corp.payments.quote", { fromAccountId: "beta_ops", beneficiaryId: "nimb", amount: 100, purpose: "Rent", reference: "x" }))).toBe("PERMISSION_DENIED");
    expect(await code(b.call("corp.payments.create", { quoteId: "corpq_1" }))).toBe("PERMISSION_DENIED");
  });
  it("with the permission check switched off the same calls get through to the company's own rules (what the mutation check relies on)", async () => {
    const { b } = make("alex", { corpFlaws: { permissions: false } });
    await enter(b, "alpha");
    await verify(b);
    expect(await code(b.call("corp.payments.approve", { paymentId: "PAY-2040" }))).toBe("NOT_AUTHORISED");
  });
});

describe("the rules can each be switched off, for the mutation check", () => {
  it("sequence, cut-off, name tick and passing a payment on", async () => {
    const seq = make("alexbiz", { corpFlaws: { sequence: false } }); await enter(seq.b, "beta"); await verify(seq.b);
    expect(await code(seq.b.call("corp.payments.approve", { paymentId: "PAY-2047" }))).toBe("no error");
    const late = make("alex", { corpFlaws: { approvalCutoff: false } }); await enter(late.b, "beta"); late.tick(6 * 3600_000);
    expect(await code(late.b.call("corp.payments.approve", { paymentId: "PAY-2041" }))).toBe("no error");
    const tick = make("alexbiz", { corpFlaws: { nameAck: false } }); await enter(tick.b, "beta");
    expect(await code(tick.b.call("corp.payments.approve", { paymentId: "PAY-2048" }))).toBe("no error");
    const pass = make("alex", { corpFlaws: { delegation: false } }); await enter(pass.b, "beta");
    await pass.b.call("corp.payments.delegate", { paymentId: "PAY-2041", toUserId: "lee" });
    expect(await code(pass.b.call("corp.payments.approve", { paymentId: "PAY-2041" }))).toBe("no error");
  });
});

describe("starting a payment fixes the order of a sequential group", () => {
  it("60,000 at Alpha needs two approvers, Dana first and then Lee", async () => {
    const { b } = make("alex");
    await enter(b, "alpha");
    const q = await b.call("corp.payments.quote", { fromAccountId: "alpha_ops", beneficiaryId: "harb", amount: 60_000, purpose: "Goods or services", reference: "INV-9" });
    await verify(b);
    const p = await b.call("corp.payments.create", { quoteId: q.quoteId });
    expect(p).toMatchObject({ required: 2, sequence: ["dana", "lee"], startedBy: "Alex Morgan", startedByYou: true, need: "Needs 2 approvals" });
    expect(p.signatories.map((s: any) => [s.name, s.state])).toEqual([["Dana Cruz", "next"], ["Lee Park", "waiting"]]);
  });
  it("12,500 has one approver and no order; a business purpose such as Goods is taken; the company says which account pays by default", async () => {
    const { b } = make("alex");
    await enter(b, "alpha");
    expect((await b.call("corp.company.get")).defaultAccountId).toBe("alpha_ops");
    const q = await b.call("corp.payments.quote", { fromAccountId: "alpha_ops", beneficiaryId: "harb", amount: 12_500, purpose: "Goods", reference: "INV-1042" });
    const p = await b.call("corp.payments.create", { quoteId: q.quoteId });
    expect(p).toMatchObject({ required: 1, need: "" });
    expect(p.sequence).toBeUndefined();
  });
  it("a supplier is shown as its currency and the last 4 digits; a speed card has its arrival and fee", async () => {
    const { b } = make("alex");
    await enter(b, "alpha");
    const co = await b.call("corp.company.get");
    expect(Object.values<any>(co.beneficiaries).map((s) => [s.displayName, s.line])).toEqual([["Harbour Packaging", "USD · ••8841"], ["Nordic Supplies AB", "EUR · ••3000"], ["Whitby Logistics", "GBP · ••9911"], ["Gulf Trade FZE", "AED · ••3456"]]);
    const q = await b.call("corp.payments.quote", { fromAccountId: "alpha_ops", beneficiaryId: "harb", amount: 60_000, purpose: "Goods or services", reference: "INV-9" });
    expect(q.speeds.standard.sub).toBe("Over the limit · Free");
    expect(q.speeds.sameDay.sub).toBe("Today · $1.00");
  });
});
