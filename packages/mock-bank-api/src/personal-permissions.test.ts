import { describe, it, expect } from "vitest";
import { MockBank, PERSONAL_PERMISSIONS, type SandboxConditions } from "./index";
import { personalNeeds } from "./identity";

// Wednesday 4 November 2026, ten in the morning (UTC)
const NOW = Date.parse("2026-11-04T10:00:00Z");
const alex = (conditions?: SandboxConditions) => { const b = new MockBank("alex", { conditions }); b.now = () => NOW; return b; };
const without = (...p: string[]) => alex({ withoutPermissions: p });
const code = async (p: Promise<unknown>) => p.then(() => "no error", (e) => e.code as string);
const verify = async (b: MockBank) => { await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" }); };
const personalPermissions = async (b: MockBank) => (await b.call("bank.session.get")).contexts.find((c: any) => c.id === "personal").permissions as string[];

// one call of each adapter that needs a permission: a refusal comes before anything is looked at, so the inputs only have to be the right shape
const PAYMENTS: [string, Record<string, unknown>][] = [
  ["bank.transfers.own", { fromAccountId: "acc_main", toAccountId: "acc_save", amount: 10 }],
  ["bank.transfers.create", { fromAccountId: "acc_main", beneficiaryId: "ben_taylor", amount: 10 }],
  ["bank.payments.create", { quoteId: "q_none" }],
  ["bank.fx.convert", { quoteId: "q_none" }],
  ["bank.bills.pay", { fromAccountId: "acc_main", billerId: "city_power", reference: "4400123456", amount: 10 }],
  ["bank.topup.create", { fromAccountId: "acc_main", operatorId: "aster", number: "5550123456", amount: 10 }],
];
const SCHEDULES: [string, Record<string, unknown>][] = [
  ["bank.schedules.create", { kind: "payee", target: "ben_maya", from: "acc_main", amount: 100, frequency: "monthly", first: "2026-11-20", endType: "never" }],
  ["bank.schedules.update", { scheduleId: "SCH-1002", amount: 120 }],
  ["bank.schedules.cancel", { scheduleId: "SCH-1002" }],
];
const PAYEES: [string, Record<string, unknown>][] = [
  ["bank.payees.save", { type: "domestic", name: "Camille Dubois", routing: "021000021", accountNumber: "100009999" }],
  ["bank.payees.update", { payeeId: "ben_taylor", nickname: "T" }],
  ["bank.payees.delete", { payeeId: "ben_taylor" }],
];

describe("personal permissions", () => {
  it("the default customer holds every personal permission, so nothing changes unless a scenario takes one away", async () => {
    const b = alex();
    expect(await personalPermissions(b)).toEqual(PERSONAL_PERMISSIONS);
    await verify(b);
    expect((await b.call("bank.transfers.own", { fromAccountId: "acc_main", toAccountId: "acc_save", amount: 10 })).reference).toMatch(/^TRX-/);
  });

  it("a permission taken away is no longer listed in the personal context, which is what session.permissions shows a journey", async () => {
    const b = without("payments.create", "payments.schedule");
    const held = await personalPermissions(b);
    expect(held).not.toContain("payments.create");
    expect(held).not.toContain("payments.schedule");
    expect(held).toEqual(PERSONAL_PERMISSIONS.filter((p) => p !== "payments.create" && p !== "payments.schedule"));
  });

  for (const [group, permission, calls] of [["own and personal transfers, bills, top-up and conversions", "payments.create", PAYMENTS], ["schedules and standing orders", "payments.schedule", SCHEDULES], ["payees", "beneficiaries.manage", PAYEES]] as const) {
    it(`${group}: refused with PERMISSION_DENIED without ${permission}, even forced, and nothing moves or changes`, async () => {
      const b = without(permission);
      await verify(b); // the code is fine: it is the permission that is missing
      const accounts = JSON.stringify(await b.call("bank.accounts.list")), payees = JSON.stringify(await b.call("bank.beneficiaries.list")), schedules = JSON.stringify(await b.call("bank.schedules.list"));
      for (const [adapter, input] of calls) expect(await code(b.call(adapter, input)), adapter).toBe("PERMISSION_DENIED");
      expect(JSON.stringify(await b.call("bank.accounts.list"))).toBe(accounts);
      expect(JSON.stringify(await b.call("bank.beneficiaries.list"))).toBe(payees);
      expect(JSON.stringify(await b.call("bank.schedules.list"))).toBe(schedules);
    });
    it(`${group}: the same calls are not refused for a missing permission when ${permission} is held, or when another one is missing`, async () => {
      for (const b of [alex(), without("cards.view", "invest.trade")]) {
        await verify(b);
        for (const [adapter, input] of calls) expect(await code(b.call(adapter, input)), adapter).not.toBe("PERMISSION_DENIED");
      }
    });
  }

  it("what a call asks to keep or repeat needs the permission for that too: a payment set for later, a bill paid automatically, a payee or biller saved with it", () => {
    expect(personalNeeds("bank.payments.create", { when: "now" })).toEqual(["payments.create"]);
    expect(personalNeeds("bank.payments.create", { when: "later" })).toEqual(["payments.create", "payments.schedule"]);
    expect(personalNeeds("bank.payments.create", { save: true })).toEqual(["payments.create", "beneficiaries.manage"]);
    expect(personalNeeds("bank.bills.pay", { autopay: true, save: true })).toEqual(["payments.create", "payments.schedule", "beneficiaries.manage"]);
    expect(personalNeeds("bank.topup.create", { save: true })).toEqual(["payments.create", "beneficiaries.manage"]);
    // reading, quoting and checking need none
    for (const a of ["bank.accounts.list", "bank.payments.quote", "bank.schedules.list", "bank.schedules.check", "bank.payees.check", "bank.bills.quote", "bank.topup.check"]) expect(personalNeeds(a, {}), a).toEqual([]);
  });
  it("so a payment cannot be scheduled, or a payee saved, through a call that only holds payments.create", async () => {
    const b = without("payments.schedule", "beneficiaries.manage");
    expect(await code(b.call("bank.payments.create", { quoteId: "q_none", when: "later", sendOn: "2026-11-10" }))).toBe("PERMISSION_DENIED");
    expect(await code(b.call("bank.payments.create", { quoteId: "q_none", save: true }))).toBe("PERMISSION_DENIED");
    expect(await code(b.call("bank.bills.pay", { fromAccountId: "acc_main", billerId: "city_power", reference: "4400123456", amount: 10, autopay: true }))).toBe("PERMISSION_DENIED");
    // without the extras it goes on to its own checks
    expect(await code(b.call("bank.payments.create", { quoteId: "q_none" }))).toBe("OTP_REQUIRED");
  });

  it("inside a company the personal rules do not apply: the personal adapters still answer WRONG_CONTEXT first", async () => {
    const b = without("payments.create");
    await verify(b);
    await b.call("bank.session.stepUp", { method: "password", secret: "Bwx!Demo2026" });
    await verify(b);
    await b.call("bank.session.stepUp", { method: "password", secret: "Bwx!Demo2026" });
    await b.call("bank.session.switch", { contextId: "alpha" });
    expect(await code(b.call("bank.transfers.own", { fromAccountId: "acc_main", toAccountId: "acc_save", amount: 10 }))).toBe("WRONG_CONTEXT");
    expect(await code(b.call("corp.company.get"))).toBe("no error");
  });

  it("the mutation switch that turns company permissions off turns this off too, so a mutation check can prove the tests notice", async () => {
    const b = new MockBank("alex", { conditions: { withoutPermissions: ["payments.create"] }, corpFlaws: { permissions: false } });
    b.now = () => NOW;
    await verify(b);
    expect((await b.call("bank.transfers.own", { fromAccountId: "acc_main", toAccountId: "acc_save", amount: 10 })).reference).toMatch(/^TRX-/);
  });
});
