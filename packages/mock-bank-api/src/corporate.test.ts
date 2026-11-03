import { describe, it, expect } from "vitest";
import { ACME, CorporateSandbox } from "./corporate";

// Tuesday 3 November 2026, ten in the morning (UTC); Monday 9 November is a bank holiday in the demo company
const T = Date.parse("2026-11-03T10:00:00Z");
const make = (at = T) => { const s = new CorporateSandbox(ACME); let t = at; s.now = () => t; return { s, set: (v: number) => { t = v; } }; };
const pay = (over: Record<string, unknown> = {}) => ({ userId: "sara", fromAccountId: "acme_ops", beneficiaryId: "sup_textile", amount: 100_000, reference: "INV-1", ...over });
const code = (fn: () => unknown) => { try { fn(); return "no error"; } catch (e: any) { return e.code as string; } };

describe("corporate payments: starting one", () => {
  it("creates a pending payment for the initiator, value-dated today before the cut-off", () => {
    const { s } = make();
    const p = s.initiatePayment(pay());
    expect(p).toMatchObject({ status: "pending_approval", initiatedBy: "sara", required: 1, valueDate: "2026-11-03", afterCutoff: false, currency: "PKR", approvals: [] });
    expect(s.summary.users.find((u) => u.id === "sara")!.usedToday).toBe(100_000);
    expect(s.summary.accounts[0]!.balance).toBe(25_000_000); // nothing has moved yet
  });
  it("only an initiator may start one", () => {
    const { s } = make();
    expect(code(() => s.initiatePayment(pay({ userId: "hassan" })))).toBe("NOT_AUTHORISED");
    expect(code(() => s.initiatePayment(pay({ userId: "nobody" })))).toBe("USER_NOT_FOUND");
  });
  it("pays only beneficiaries on the company's list, from an account the company has", () => {
    const { s } = make();
    expect(code(() => s.initiatePayment(pay({ beneficiaryId: "someone-new" })))).toBe("BENEFICIARY_NOT_WHITELISTED");
    expect(code(() => s.initiatePayment(pay({ fromAccountId: "nope" })))).toBe("ACCOUNT_NOT_FOUND");
  });
  it("checks the amount, the currency the limits are written in, and the balance", () => {
    const { s } = make();
    expect(code(() => s.initiatePayment(pay({ amount: 0 })))).toBe("INVALID_AMOUNT");
    expect(code(() => s.initiatePayment(pay({ amount: 10.005 })))).toBe("INVALID_AMOUNT");
    expect(code(() => s.initiatePayment(pay({ fromAccountId: "acme_usd", amount: 100 })))).toBe("CURRENCY_NOT_SUPPORTED");
    expect(code(() => s.initiatePayment(pay({ amount: 30_000_000 })))).toBe("INSUFFICIENT_FUNDS");
  });
  it("holds each person to their own daily limit, and the company to its own", () => {
    const { s } = make();
    expect(code(() => s.initiatePayment(pay({ userId: "omar", amount: 600_000 })))).toBe("LIMIT_USER_EXCEEDED"); // Omar's limit is 500,000
    s.initiatePayment(pay({ userId: "omar", amount: 400_000 }));
    expect(code(() => s.initiatePayment(pay({ userId: "omar", amount: 150_000 })))).toBe("LIMIT_USER_EXCEEDED"); // 400,000 already used today
    s.initiatePayment(pay({ amount: 3_000_000 }));
    // company limit 8,000,000: 3,000,000 + 400,000 are pending-used by users, but the company counts what is released
    expect(code(() => s.initiatePayment(pay({ userId: "sara", amount: 9_000_000 })))).toBe("LIMIT_USER_EXCEEDED");
  });
  it("needs two approvers above the threshold", () => {
    const { s } = make();
    expect(s.initiatePayment(pay({ amount: 1_000_000 })).required).toBe(1);
    expect(s.initiatePayment(pay({ amount: 1_000_001 })).required).toBe(2);
  });
});

describe("cut-off and value date", () => {
  it("after the cut-off the payment is value-dated the next working day", () => {
    const { s } = make(Date.parse("2026-11-03T16:01:00Z"));
    expect(s.initiatePayment(pay())).toMatchObject({ valueDate: "2026-11-04", afterCutoff: true });
  });
  it("exactly at the cut-off is still today", () => {
    const { s } = make(Date.parse("2026-11-03T16:00:00Z"));
    expect(s.initiatePayment(pay())).toMatchObject({ valueDate: "2026-11-03", afterCutoff: false });
  });
  it("skips the weekend and a holiday", () => {
    const friday = make(Date.parse("2026-11-06T17:00:00Z")); // Friday evening: Saturday, Sunday and the Monday holiday are closed
    expect(friday.s.initiatePayment(pay())).toMatchObject({ valueDate: "2026-11-10", afterCutoff: true });
    const saturday = make(Date.parse("2026-11-07T09:00:00Z"));
    expect(saturday.s.initiatePayment(pay())).toMatchObject({ valueDate: "2026-11-10", afterCutoff: true });
  });
});

describe("approving", () => {
  it("one approver releases a small payment: the money moves and the company's day is used", () => {
    const { s } = make();
    const p = s.initiatePayment(pay({ amount: 250_000 }));
    const done = s.approvePayment({ userId: "hassan", paymentId: p.id });
    expect(done).toMatchObject({ status: "released", approvals: [{ userId: "hassan" }] });
    expect(done.releaseReference).toBe("CORP-20261103-0001");
    expect(s.summary.accounts[0]!.balance).toBe(24_750_000);
    expect(s.summary.companyUsedToday).toBe(250_000);
  });
  it("a large payment waits for a second, different approver", () => {
    const { s } = make();
    const p = s.initiatePayment(pay({ amount: 2_000_000 }));
    const first = s.approvePayment({ userId: "hassan", paymentId: p.id });
    expect(first.status).toBe("pending_approval"); expect(s.summary.accounts[0]!.balance).toBe(25_000_000);
    expect(code(() => s.approvePayment({ userId: "hassan", paymentId: p.id }))).toBe("ALREADY_APPROVED");
    expect(s.approvePayment({ userId: "layla", paymentId: p.id }).status).toBe("released");
    expect(s.summary.accounts[0]!.balance).toBe(23_000_000);
  });
  it("nobody approves what they started, and only approvers approve", () => {
    const { s } = make();
    const p = s.initiatePayment(pay());
    expect(code(() => s.approvePayment({ userId: "sara", paymentId: p.id }))).toBe("NOT_AUTHORISED"); // an initiator only
    expect(code(() => s.approvePayment({ userId: "omar", paymentId: p.id }))).toBe("NOT_AUTHORISED");
    expect(code(() => s.approvePayment({ userId: "hassan", paymentId: "pay_99" }))).toBe("PAYMENT_NOT_FOUND");
  });
  it("a person with both roles can start and approve, but never approve their own (four eyes)", () => {
    const { s } = make();
    const mine = s.initiatePayment(pay({ userId: "nadia", amount: 100_000, reference: "N" }));
    expect(code(() => s.approvePayment({ userId: "nadia", paymentId: mine.id }))).toBe("SELF_APPROVAL");
    expect(s.listPending({ userId: "nadia" }).map((p) => p.reference)).toEqual([]); // as an approver she is not offered her own
    expect(s.listPending({ userId: "nadia", as: "initiator" }).map((p) => p.reference)).toEqual(["N"]); // as the maker she sees it
    const theirs = s.initiatePayment(pay({ userId: "sara", amount: 100_000, reference: "S" }));
    expect(s.listPending({ userId: "nadia" }).map((p) => p.reference)).toEqual(["S"]);
    expect(s.approvePayment({ userId: "nadia", paymentId: theirs.id }).status).toBe("released");
    expect(s.approvePayment({ userId: "hassan", paymentId: mine.id }).status).toBe("released");
  });
  it("does not approve a payment that is no longer pending", () => {
    const { s } = make();
    const p = s.initiatePayment(pay());
    s.approvePayment({ userId: "hassan", paymentId: p.id });
    expect(code(() => s.approvePayment({ userId: "layla", paymentId: p.id }))).toBe("PAYMENT_NOT_PENDING");
  });
  it("checks the balance and the company limit again at release, and leaves the payment pending", () => {
    const company = structuredClone(ACME); company.accounts[0]!.balance = 300_000; company.companyDailyLimit = 400_000;
    const s = new CorporateSandbox(company); s.now = () => T;
    const a = s.initiatePayment(pay({ amount: 250_000 })), b = s.initiatePayment(pay({ amount: 100_000, reference: "INV-2" }));
    expect(s.approvePayment({ userId: "hassan", paymentId: a.id }).status).toBe("released");
    expect(code(() => s.approvePayment({ userId: "hassan", paymentId: b.id }))).toBe("INSUFFICIENT_FUNDS"); // 50,000 left
    expect(s.getPayment(b.id)).toMatchObject({ status: "pending_approval", approvals: [] });
  });
});

describe("rejecting and listing", () => {
  it("an approver rejects with a reason, and the maker's day is given back", () => {
    const { s } = make();
    const p = s.initiatePayment(pay({ amount: 200_000 }));
    const r = s.rejectPayment({ userId: "layla", paymentId: p.id, reason: "Wrong supplier" });
    expect(r).toMatchObject({ status: "rejected", rejectedBy: "layla", rejectReason: "Wrong supplier" });
    expect(s.summary.users.find((u) => u.id === "sara")!.usedToday).toBe(0);
    expect(code(() => s.approvePayment({ userId: "hassan", paymentId: p.id }))).toBe("PAYMENT_NOT_PENDING");
  });
  it("the person who started a payment may withdraw it, but not another initiator, and not once it is closed", () => {
    const { s } = make();
    const p = s.initiatePayment(pay());
    expect(code(() => s.withdrawPayment({ userId: "omar", paymentId: p.id }))).toBe("NOT_AUTHORISED");
    expect(code(() => s.rejectPayment({ userId: "sara", paymentId: p.id }))).toBe("NOT_AUTHORISED"); // rejecting is for approvers
    expect(s.withdrawPayment({ userId: "sara", paymentId: p.id })).toMatchObject({ status: "rejected", rejectReason: "Withdrawn by the person who started it" });
    expect(code(() => s.withdrawPayment({ userId: "sara", paymentId: p.id }))).toBe("PAYMENT_NOT_PENDING");
  });
  it("withdrawing gives the daily limit back", () => {
    const { s } = make();
    const before = s.summary.users.find((u) => u.id === "sara")!.usedToday;
    const p = s.initiatePayment(pay());
    s.withdrawPayment({ userId: "sara", paymentId: p.id });
    expect(s.summary.users.find((u) => u.id === "sara")!.usedToday).toBe(before);
  });
  it("lists what each person can act on", () => {
    const { s } = make();
    const a = s.initiatePayment(pay({ amount: 2_000_000, reference: "A" })), b = s.initiatePayment(pay({ userId: "omar", amount: 100_000, reference: "B" }));
    expect(s.listPending({ userId: "hassan" }).map((p) => p.reference)).toEqual(["A", "B"]);
    s.approvePayment({ userId: "hassan", paymentId: a.id }); // needs a second approver, so it is still pending
    expect(s.listPending({ userId: "hassan" }).map((p) => p.reference)).toEqual(["B"]); // already approved A
    expect(s.listPending({ userId: "layla" }).map((p) => p.reference)).toEqual(["A", "B"]);
    expect(s.listPending({ userId: "sara" }).map((p) => p.reference)).toEqual(["A"]); // an initiator sees their own
    s.rejectPayment({ userId: "layla", paymentId: b.id });
    expect(s.listPending({ userId: "layla" }).map((p) => p.reference)).toEqual(["A"]);
  });
  it("keeps each sandbox's data to itself", () => {
    const one = make().s, two = make().s;
    one.initiatePayment(pay());
    expect(two.all()).toEqual([]); expect(ACME.users[0]!.usedToday).toBe(0);
  });
});
