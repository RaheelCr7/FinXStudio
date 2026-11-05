import { describe, expect, it } from "vitest";
import { MockBank } from "../index";

/** The combined demo's customer carries what the Payments journeys let a person pick, so none of them opens empty in the app. */
describe("Alex has something to pick in every Payments journey", () => {
  it("has saved payees of every kind, billers, mobile numbers and scheduled payments", async () => {
    const b = new MockBank("alex");
    const payees = Object.values(await b.call("bank.beneficiaries.list")) as any[];
    expect(payees.map((p) => p.kind)).toEqual(expect.arrayContaining(["internal", "domestic", "international"]));
    expect(payees.length).toBeGreaterThanOrEqual(10);
    expect(Object.keys(await b.call("bank.bills.saved"))).toEqual(expect.arrayContaining(["sb_power", "sb_harbor", "sb_card", "sb_net"]));
    expect(Object.keys(await b.call("bank.topup.numbers"))).toEqual(["sn_phone", "sn_maya", "sn_lena"]);
    const live = Object.values(await b.call("bank.schedules.list", { status: "live" })) as any[];
    expect(live.map((s) => s.name)).toEqual(expect.arrayContaining(["Rent", "Savings top-up", "Harbor Insurance"]));
  });
  it("keeps the test customers' own copies of the same data", async () => {
    expect(Object.keys(await new MockBank("alextopup").call("bank.topup.numbers"))).toEqual(["sn_phone", "sn_maya", "sn_lena"]);
    expect(Object.keys(await new MockBank("alexsched").call("bank.bills.saved")).sort()).toEqual(["sb_card", "sb_harbor", "sb_power"]);
  });
});
