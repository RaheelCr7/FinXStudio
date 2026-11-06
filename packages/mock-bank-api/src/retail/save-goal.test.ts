import { describe, expect, it } from "vitest";
import { MockBank } from "../index";

describe("the empty condition and the Save screen", () => {
  it("empties the portfolio, the holdings, the goals, the deposits and the loans: each answers nothing, so the screen shows its empty text", async () => {
    const b = new MockBank("alex", { now: Date.parse("2026-11-03T10:00:00Z"), conditions: { empty: ["bank.funds.portfolio", "bank.funds.holdings", "bank.goals.list", "bank.deposits.list", "bank.loans.list"] } });
    for (const adapter of ["bank.funds.portfolio", "bank.funds.holdings", "bank.goals.list", "bank.deposits.list", "bank.loans.list"]) expect(await b.call(adapter), adapter).toEqual({});
  });
  it("answers the portfolio of a customer with funds and of one with none", async () => {
    expect(await new MockBank("alex", { now: Date.parse("2026-11-03T10:00:00Z") }).call("bank.funds.portfolio")).toMatchObject({ count: 2, valueText: "$4,820.00" });
    expect(await new MockBank("sam").call("bank.funds.portfolio")).toMatchObject({ count: 0 });
  });
  it("a list with pick: true says how many and which is first, so a journey can skip a choice of one", async () => {
    const b = new MockBank("alex", { now: Date.parse("2026-11-03T10:00:00Z") });
    expect(await b.call("bank.goals.list", { pick: true })).toMatchObject({ count: 1, firstId: "g1" });
    expect(await b.call("bank.deposits.list", { pick: true })).toMatchObject({ count: 1, firstId: "td1" });
    expect(await b.call("bank.loans.list", { pick: true })).toMatchObject({ count: 1, firstId: "ln1" });
  });
  it("a scenario can switch journeys off for the bank: bank.app.config says which", async () => {
    const b = new MockBank("alex", { config: { disabled: ["invest", "term-deposit"] } });
    expect((await b.call("bank.app.config")).disabled).toEqual(["invest", "term-deposit"]);
  });
});
