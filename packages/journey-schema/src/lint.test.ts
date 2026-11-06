import { describe, it, expect } from "vitest";
import { CHANGES_SECURITY, Journey, MOVES_MONEY, PROTECTIVE_ONLY, changesSecurity, lintJourney, localTransfer, movesMoney } from "./index";

/**
 * The money and security rules of the lint. Every case starts from the Local transfer fixture, which is compliant (consent, a code screen
 * that verifies before the call), and swaps the adapter of its one money call, so a rule is proved for each adapter on its own.
 */
const CALL = "transfer";
const journeyWith = (adapter: string): Journey => {
  const j = structuredClone(localTransfer) as any;
  j.integrations.find((i: any) => i.id === CALL).adapter = adapter;
  return j;
};
const codes = (j: Journey) => lintJourney(j).map((i) => i.code);
const withoutConsent = (j: Journey) => { for (const s of j.screens as any[]) s.blocks = s.blocks.filter((b: any) => b.type !== "consent"); return j; };
const withoutCodeScreen = (j: Journey) => { for (const s of j.screens as any[]) s.blocks = s.blocks.filter((b: any) => b.type !== "otp"); return j; };
const otpButton = (j: Journey) => ((j.screens as any[]).find((s) => s.id === "otp").blocks as any[]).find((b) => b.type === "button");
const withoutVerify = (j: Journey) => { const b = otpButton(j); b.actions = b.actions.filter((a: any) => a.integration !== "otpVerify"); return j; };
/** The call before the check of the code. */
const verifyAfterCall = (j: Journey) => { const b = otpButton(j); const [v, c] = [b.actions.findIndex((a: any) => a.integration === "otpVerify"), b.actions.findIndex((a: any) => a.integration === CALL)]; [b.actions[v], b.actions[c]] = [b.actions[c], b.actions[v]]; return j; };
/** Company payments name a role; that is a different rule and not what these cases are about. */
const mine = (list: string[]) => list.filter((c) => c !== "authorisation_missing");

const MONEY = [...MOVES_MONEY];
const SECURITY = [...CHANGES_SECURITY];

describe("the fixture the cases start from", () => {
  it("is clean", () => expect(lintJourney(localTransfer)).toEqual([]));
});

describe("MOVES_MONEY: consent and a verified code before money moves", () => {
  it.each(MONEY)("%s: passes with a consent block and the code checked first", (adapter) => {
    expect(mine(codes(journeyWith(adapter)))).toEqual([]);
  });
  it.each(MONEY)("%s: has no consent block, so it fails consent_before_submit", (adapter) => {
    expect(codes(withoutConsent(journeyWith(adapter)))).toContain("consent_before_submit");
  });
  it.each(MONEY)("%s: has no code screen, so it fails otp_before_money", (adapter) => {
    expect(codes(withoutCodeScreen(journeyWith(adapter)))).toContain("otp_before_money");
  });
  it.each(MONEY)("%s: never checks the code, so it fails otp_before_money", (adapter) => {
    expect(codes(withoutVerify(journeyWith(adapter)))).toContain("otp_before_money");
  });
  it.each(MONEY)("%s: checks the code after the call, so it fails otp_before_money on that screen", (adapter) => {
    const issue = lintJourney(verifyAfterCall(journeyWith(adapter))).find((i) => i.code === "otp_before_money");
    expect(issue?.screen).toBe("otp");
  });

  // the adapters the old pattern missed or only matched by accident: each one now needs the consent and the code
  const NEWLY_COVERED = ["bank.deposits.renew", "bank.subscriptions.pay"];
  it.each(NEWLY_COVERED)("%s is money-moving and is now required to have consent and a code", (adapter) => {
    expect(movesMoney(adapter)).toBe(true);
    const bare = withoutCodeScreen(withoutConsent(journeyWith(adapter)));
    expect(codes(bare)).toEqual(expect.arrayContaining(["consent_before_submit", "otp_before_money"]));
  });

  it("keeps the adapters the old pattern named", () => {
    for (const a of ["bank.transfers.create", "bank.transfers.own", "bank.fx.convert", "bank.payments.create", "bank.bills.pay", "bank.topup.create", "bank.schedules.create", "bank.schedules.update",
      "corp.payments.initiate", "corp.payments.approve", "corp.payments.approveMany", "corp.payments.create", "corp.schedules.create", "corp.schedules.update", "corp.bulk.submit", "corp.payroll.submit",
      "bank.statements.issue", "bank.cards.replace", "bank.deposit.create", "bank.deposits.open", "bank.deposits.close", "bank.loans.apply", "bank.loans.repay", "bank.loans.settle",
      "bank.funds.buy", "bank.funds.sell", "bank.invest.buy", "bank.invest.sell"]) expect(MOVES_MONEY.has(a), a).toBe(true);
  });
  it("does not match an adapter by accident (only exact names count)", () => {
    for (const a of ["bank.deposits.renew.quote", "bank.deposits.close.quote", "bank.cards.replace.check", "bank.loans.quote", "bank.loans.settlement.quote", "bank.payments.quote", "bank.payments.createAndRun",
      "bank.fx.quote", "bank.bills.quote", "bank.topup.check", "bank.schedules.check", "bank.schedules.runDue", "bank.schedules.cancel", "corp.schedules.cancel", "corp.payments.withdraw", "corp.payments.reject", "bank.otp.verify"]) {
      expect(movesMoney(a), a).toBe(false);
      expect(codes(withoutCodeScreen(withoutConsent(journeyWith(a)))), a).toEqual([]);
    }
  });
  it("leaves savings goals out on purpose: the money stays the customer's (spec AC-9, docs/BANKWORKX.md)", () => {
    expect(movesMoney("bank.goals.contribute")).toBe(false);
    expect(movesMoney("bank.goals.withdraw")).toBe(false);
  });
});

describe("CHANGES_SECURITY: a verified code before a protection setting changes, and no consent needed", () => {
  it.each(SECURITY)("%s: passes with the code checked first and no consent block", (adapter) => {
    expect(mine(codes(withoutConsent(journeyWith(adapter))))).toEqual([]);
  });
  it.each(SECURITY)("%s: has no code screen, so it fails step_up_before_security_change only", (adapter) => {
    expect(codes(withoutCodeScreen(withoutConsent(journeyWith(adapter))))).toEqual(["step_up_before_security_change"]);
  });
  it.each(SECURITY)("%s: never checks the code, so it fails step_up_before_security_change", (adapter) => {
    expect(codes(withoutVerify(withoutConsent(journeyWith(adapter))))).toEqual(["step_up_before_security_change"]);
  });
  it.each(SECURITY)("%s: checks the code after the call, so it fails step_up_before_security_change on that screen", (adapter) => {
    const issue = lintJourney(verifyAfterCall(withoutConsent(journeyWith(adapter)))).find((i) => i.code === "step_up_before_security_change");
    expect(issue?.screen).toBe("otp");
  });
  it.each(SECURITY)("%s: is not money-moving, so a consent block is not asked for", (adapter) => {
    expect(movesMoney(adapter)).toBe(false);
    expect(codes(withoutConsent(journeyWith(adapter)))).not.toContain("consent_before_submit");
  });

  it("names the card, payee, profile, access and company-administration changes", () => {
    for (const a of ["bank.cards.unfreeze", "bank.cards.controls.update", "bank.cards.pin.set", "bank.cards.virtual.create", "bank.payees.save", "corp.suppliers.request",
      "bank.profile.update", "bank.password.change", "bank.recover.resetPassword", "cab.recover.resetPassword", "bank.recover.unlock", "bank.devices.remove", "bank.devices.setQuickSignIn", "bank.device.setDefault",
      "corp.users.invite", "corp.users.update", "corp.users.disable", "corp.users.enable", "corp.limits.set", "corp.signatories.update", "corp.changes.decide", "corp.payments.delegate"]) expect(changesSecurity(a), a).toBe(true);
  });

  // freezing has to be one tap in an emergency (spec: Freeze needs no code, Unfreeze does)
  it.each([...PROTECTIVE_ONLY])("%s only protects, so it needs no code", (adapter) => {
    expect(changesSecurity(adapter)).toBe(false);
    expect(movesMoney(adapter)).toBe(false);
    expect(codes(withoutCodeScreen(withoutConsent(journeyWith(adapter))))).toEqual([]);
  });
  it("freezing is exempt and unfreezing is not", () => {
    expect([changesSecurity("bank.cards.freeze"), changesSecurity("bank.cards.unfreeze")]).toEqual([false, true]);
  });
  it.each(["bank.accounts.list", "bank.cards.issued", "bank.profile.get", "bank.devices.list", "corp.users.list", "corp.limits.get", "corp.signatories.list", "bank.devices.changePin", "bank.devices.checkPin", "bank.password.check", "bank.auth.changePassword"])(
    "%s is a read or is proved another way (the current PIN or password), so it needs no code", (adapter) => {
      expect(changesSecurity(adapter)).toBe(false);
      expect(codes(withoutCodeScreen(withoutConsent(journeyWith(adapter))))).toEqual([]);
    });

  it("a journey that moves money and changes security is told once, about the money", () => {
    const j = withoutCodeScreen(journeyWith("bank.transfers.create"));
    j.integrations.push({ id: "pin", adapter: "bank.cards.pin.set", mode: "sandbox" } as any);
    expect(codes(j).filter((c) => c === "otp_before_money" || c === "step_up_before_security_change")).toEqual(["otp_before_money"]);
  });
  it("the two lists do not overlap", () => {
    expect(MONEY.filter((a) => CHANGES_SECURITY.has(a))).toEqual([]);
    expect([...PROTECTIVE_ONLY].filter((a) => MOVES_MONEY.has(a) || CHANGES_SECURITY.has(a))).toEqual([]);
  });
});
