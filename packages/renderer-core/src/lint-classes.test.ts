import { describe, it, expect } from "vitest";
import * as shipped from "@finx/journey-schema";
import { CHANGES_SECURITY, MOVES_MONEY, PROTECTIVE_ONLY, type Journey } from "@finx/journey-schema";
import { ADAPTER_CATALOG } from "@finx/mock-bank-api";
import { lintAll } from "./lint-expr";

/**
 * The lint's two lists (money that moves, protection that changes) must keep up with the sandbox bank. Every adapter the sandbox says
 * moves money or asks for a one-time code is in a list, or is named here with the reason it is not. A new adapter fails this test until
 * someone decides which kind it is.
 */
const NOT_MONEY: Record<string, string> = {
  "bank.goals.contribute": "Savings goals: the money stays the customer's, an account to a goal of the same person (spec AC-9; docs/BANKWORKX.md, Save and borrow)",
  "bank.goals.withdraw": "Savings goals: the same money coming back to an account of the same person (spec AC-9)",
};
const NO_CODE_NEEDED: Record<string, string> = {
  "bank.session.stepUp": "It is the step-up itself",
  "bank.accounts.open": "Opens an empty account: nothing moves and nothing is owed",
  "bank.accounts.requestClosure": "Only asks: the balance moves when the bank closes the account, and the request can be undone (bank.accounts.restore)",
  "bank.recover.sendUsername": "Sends the username to the contact already on file and changes nothing",
};

describe("the lint knows what the sandbox bank does", () => {
  const known = new Set(ADAPTER_CATALOG.map((a) => a.adapter));

  it("every adapter marked as moving money is in MOVES_MONEY, or is named with a reason", () => {
    const missing = ADAPTER_CATALOG.filter((a) => a.moneyMoving && !MOVES_MONEY.has(a.adapter) && !(a.adapter in NOT_MONEY)).map((a) => a.adapter);
    expect(missing).toEqual([]);
  });
  it("every adapter that asks for a code is money, a security change, or named with a reason", () => {
    const missing = ADAPTER_CATALOG.filter((a) => a.requiresOtp && !MOVES_MONEY.has(a.adapter) && !CHANGES_SECURITY.has(a.adapter) && !(a.adapter in NO_CODE_NEEDED)).map((a) => a.adapter);
    expect(missing).toEqual([]);
  });
  it("every adapter in a list exists in the sandbox, so a renamed adapter cannot leave a rule pointing at nothing", () => {
    const stale = [...MOVES_MONEY, ...CHANGES_SECURITY, ...PROTECTIVE_ONLY, ...Object.keys(NOT_MONEY), ...Object.keys(NO_CODE_NEEDED)].filter((a) => !known.has(a));
    // the sandbox answers to this one (access.ts) but the AI catalog does not list it: no journey uses it yet
    expect(stale).toEqual(["bank.device.setDefault"]);
  });
  it("a reason is not kept for an adapter that has since been put in a list", () => {
    expect(Object.keys(NOT_MONEY).filter((a) => MOVES_MONEY.has(a))).toEqual([]);
    expect(Object.keys(NO_CODE_NEEDED).filter((a) => MOVES_MONEY.has(a) || CHANGES_SECURITY.has(a))).toEqual([]);
  });
});

describe("every journey the product ships is lint clean under the money and security rules", () => {
  const all = new Map<string, Journey>();
  for (const c of shipped.catalog) all.set(c.journey.slug, c.journey);
  for (const v of Object.values(shipped) as unknown[]) {
    for (const j of Array.isArray(v) ? v : [v]) {
      const x = j as Journey | null;
      if (x && typeof x === "object" && typeof x.slug === "string" && Array.isArray(x.screens)) all.set(x.slug, x);
    }
  }
  it("covers the whole set (the catalog, the fixtures and the BankWorkx and CAB lists)", () => {
    expect(all.size).toBeGreaterThanOrEqual(94);
  });
  it.each([...all.keys()])("%s", (slug) => {
    expect(lintAll(all.get(slug)!)).toEqual([]);
  });
});
