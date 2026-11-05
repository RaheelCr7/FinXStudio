import { describe, it, expect } from "vitest";
import { MockBank } from "./index";

const code = async (p: Promise<unknown>) => p.then(() => "no error", (e) => e.code as string);

describe("sandbox conditions", () => {
  it("timeout answers TIMEOUT and applies nothing", async () => {
    const b = new MockBank("ayesha", { conditions: { timeout: ["bank.transfers.create"] } });
    await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" });
    expect(await code(b.call("bank.transfers.create", { fromAccountId: "acc_current", amount: 1000 }))).toBe("TIMEOUT");
    expect((await b.call("bank.accounts.list")).acc_current.balance).toBe(184250);
    expect((await b.call("bank.limits.get")).usedToday).toBe(0);
    b.conditions = {};
    expect((await b.call("bank.transfers.create", { fromAccountId: "acc_current", amount: 1000 })).newBalance).toBe(183250);
  });
  it("unavailable answers SERVICE_UNAVAILABLE at once, for an adapter or a prefix", async () => {
    const b = new MockBank("ayesha", { conditions: { unavailable: ["bank.accounts.list", "corp."] } });
    expect(await code(b.call("bank.accounts.list"))).toBe("SERVICE_UNAVAILABLE");
    expect(await code(b.call("corp.company.get"))).toBe("SERVICE_UNAVAILABLE");
    expect(await code(b.call("bank.limits.get"))).toBe("no error");
  });
  it("a name ending in * matches every adapter that starts with it", async () => {
    const b = new MockBank("ayesha", { conditions: { unavailable: ["bank.o*"] } });
    expect(await code(b.call("bank.otp.send"))).toBe("SERVICE_UNAVAILABLE");
    expect(await code(b.call("bank.accounts.list"))).toBe("no error");
  });
  it("empty answers an empty list for list adapters only", async () => {
    const b = new MockBank("alex", { conditions: { empty: ["bank.transactions.list", "bank.accounts.list"] } });
    expect(await b.call("bank.transactions.list")).toEqual({});
    expect(await b.call("bank.accounts.list")).toEqual({});
    expect(Object.keys(await b.call("bank.limits.get"))).toContain("daily");
    expect(await new MockBank("alex", { conditions: { empty: ["corp."] } }).call("bank.cards.issued")).not.toEqual({});
  });
  it("a timeout without latency answers TIMEOUT; with a short latency the slow answer still arrives and the clock moves on", async () => {
    const b = new MockBank("ayesha", { conditions: { timeout: ["bank.limits.get"] } });
    expect(await code(b.call("bank.limits.get"))).toBe("TIMEOUT");
    const slow = new MockBank("ayesha", { conditions: { timeout: ["bank.limits.get"], latencyMs: 3000 } });
    const t = 1_000_000; slow.now = () => t;
    expect((await slow.call("bank.limits.get")).daily).toBe(50000);
    expect(slow.now()).toBe(t + 3000);
  });
  it("a payment rail is taken down with rail:<id>, not by an adapter name", async () => {
    const b = new MockBank("alex", { conditions: { unavailable: ["rail:rtp"] } });
    expect(await code(b.call("bank.accounts.list"))).toBe("no error");
  });
  it("conditions apply to the session adapters too", async () => {
    const b = new MockBank("alex", { conditions: { timeout: ["bank.session.switch"] } });
    expect(await code(b.call("bank.session.switch", { contextId: "alpha" }))).toBe("TIMEOUT");
    expect(b.activeContextId).toBe("personal");
  });
});

describe("journeys a bank switched off", () => {
  it("refuses a call made for a disabled journey, and lets others through", async () => {
    const b = new MockBank("alex", { config: { disabled: ["international-transfer"] } });
    expect(await code(b.call("bank.accounts.list", {}, { journey: "international-transfer" }))).toBe("JOURNEY_DISABLED");
    expect(await code(b.call("bank.accounts.list", {}, { journey: "personal-transfer" }))).toBe("no error");
    expect(await code(b.call("bank.accounts.list"))).toBe("no error");
  });
  describe("the sandbox clock", () => {
    const initiate = async (b: MockBank) => {
      await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" });
      return b.call("corp.payments.initiate", { userId: "sara", fromAccountId: "acme_ops", beneficiaryId: "sup_textile", amount: 100_000, reference: "INV-1" });
    };
    it("is pinned by the option `now` (a number or a function) or by the condition `now`, so a cut-off result does not depend on the time of day it runs", async () => {
      // Tuesday 3 November 2026: before and after the company's 16:00 UTC cut-off
      const before = await initiate(new MockBank("acme", { now: Date.parse("2026-11-03T10:00:00Z") }));
      const after = await initiate(new MockBank("acme", { now: () => Date.parse("2026-11-03T16:30:00Z") }));
      const byCondition = await initiate(new MockBank("acme", { conditions: { now: "2026-11-03T16:30:00Z" } }));
      expect(before).toMatchObject({ valueDate: "2026-11-03", afterCutoff: false });
      expect(after).toMatchObject({ valueDate: "2026-11-04", afterCutoff: true });
      expect(byCondition).toMatchObject({ valueDate: "2026-11-04", afterCutoff: true });
    });
    it("the option wins over the condition, a pinned clock stands still, and a slow answer still moves it on", async () => {
      const b = new MockBank("ayesha", { now: Date.parse("2026-11-03T10:00:00Z"), conditions: { now: "2030-01-01T00:00:00Z", timeout: ["bank.limits.get"], latencyMs: 4000 } });
      expect(b.now()).toBe(Date.parse("2026-11-03T10:00:00Z"));
      expect(b.now()).toBe(b.now());
      await b.call("bank.limits.get");
      expect(b.now()).toBe(Date.parse("2026-11-03T10:00:04Z"));
    });
    it("a clock that is not a date is refused when the bank is made, not guessed", () => {
      expect(() => new MockBank("ayesha", { conditions: { now: "tomorrow" } })).toThrow(/date and time/);
      expect(() => new MockBank("ayesha", { now: NaN })).toThrow(/date and time/);
    });
    it("the seeded payees and the account preview follow it too, not the real day", async () => {
      const at = Date.parse("2026-11-03T10:00:00Z");
      const b = new MockBank("ayesha", { now: at });
      // a payee added 90 days before the sandbox clock is long past its first 24 hours, whatever day the test runs
      expect((await b.call("bank.beneficiaries.list")).ben_4821.addedAt).toBe(at - 90 * 24 * 3600 * 1000);
      await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" });
      expect(await b.call("bank.transfers.create", { fromAccountId: "acc_current", beneficiaryId: "ben_4821", amount: 1000 })).toMatchObject({ newBalance: 183250 });
      expect((await new MockBank("nour", { now: at }).call("cab.preview.get")).asOf).toBe("2026-11-03T10:00:00.000Z");
    });
  });
  it("a core journey cannot be switched off", async () => {
    const b = new MockBank("alex", { config: { disabled: ["sign-in"] } });
    expect(await code(b.call("bank.accounts.list", {}, { journey: "sign-in" }))).toBe("no error");
  });
  it("the bank's configuration is readable: home market, disabled list, options", async () => {
    const b = new MockBank("alex", { config: { homeMarket: "uk", disabled: ["statement"], options: { "personal-transfer": { instant: false } } } });
    expect(await b.call("bank.app.config")).toMatchObject({ homeMarket: "uk", disabled: ["statement"], options: { "personal-transfer": { instant: false } } });
    expect((await new MockBank("alex").call("bank.app.config")).homeMarket).toBe("us");
  });
});
