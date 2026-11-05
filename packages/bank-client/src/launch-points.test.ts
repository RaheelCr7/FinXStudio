import { describe, expect, it } from "vitest";
import { MockBank } from "@finx/mock-bank-api";
import { LAUNCH_POINTS, entryFor, journeyOn, launchPointsFor, launchValues, tabOfPlace } from "./launch-points";
import { tabsOf } from "./view-models/menus";
import type { ContextInfo } from "./session";

/** A context as the bank describes it (permissions are the same before and after switching). */
const ctx = async (id: string) => ((await new MockBank("alex").call("bank.session.get")).contexts as ContextInfo[]).find((c) => c.id === id)!;
const slugs = (...s: string[]) => s.map((slug) => ({ slug }));
const ALL = slugs(...new Set(LAUNCH_POINTS.map((l) => l.journey)));

describe("the launch-points registry", () => {
  it("is well formed: unique ids, every place on a real tab of its workspace, every journey and value name plain", () => {
    expect(new Set(LAUNCH_POINTS.map((l) => l.id)).size).toBe(LAUNCH_POINTS.length);
    for (const l of LAUNCH_POINTS) {
      expect(tabsOf(l.workspace), l.id).toContain(tabOfPlace(l.place));
      expect(l.journey, l.id).toMatch(/^[a-z0-9-]+$/);
      expect(l.label.length, l.id).toBeGreaterThan(0);
      l.passes.forEach((p) => expect(p, l.id).toMatch(/^[a-zA-Z]+$/));
      // personal permissions have no prefix, business ones start with biz.
      if (l.needs) expect(l.needs.startsWith("biz."), l.id).toBe(l.workspace === "business");
    }
  });
  it("only asks for permissions the bank can grant", async () => {
    const granted = new Set([...(await ctx("personal")).permissions, ...(await ctx("alpha")).permissions, ...(await ctx("beta")).permissions, "biz.admin.users", "biz.admin.limits", "biz.admin.signatories", "biz.payroll.run"]);
    for (const l of LAUNCH_POINTS) if (l.needs) expect(granted.has(l.needs), `${l.id} needs ${l.needs}`).toBe(true);
  });
  it("follows the link map for the examples in the spec", () => {
    const freeze = LAUNCH_POINTS.find((l) => l.journey === "freeze-card")!;
    expect(freeze).toMatchObject({ place: "cards.card", needs: "cards.manage", passes: ["cardId", "action"] });
    expect(LAUNCH_POINTS.find((l) => l.journey === "approve-payments" && l.place === "approvals.inbox")).toMatchObject({ needs: "biz.approvals.approve" });
    expect(LAUNCH_POINTS.filter((l) => l.quick && l.workspace === "personal").map((l) => l.journey)).toEqual(["personal-transfer", "pay-bill", "mobile-topup", "add-money"]);
  });
});

describe("which buttons a person sees", () => {
  it("shows Personal buttons only in Personal and Business buttons only in a company", async () => {
    const personal = launchPointsFor({ context: await ctx("personal"), entries: ALL });
    expect(personal.length).toBeGreaterThan(30);
    expect(personal.every((l) => l.workspace === "personal")).toBe(true);
    const alpha = launchPointsFor({ context: await ctx("alpha"), entries: ALL });
    expect(alpha.every((l) => l.workspace === "business")).toBe(true);
  });
  it("follows the permissions of the context: Alex can start payments at Alpha but not approve, and the reverse at Beta", async () => {
    const at = async (id: string) => new Set(launchPointsFor({ context: await ctx(id), entries: ALL }).map((l) => l.journey));
    const alpha = await at("alpha"), beta = await at("beta");
    expect(alpha.has("supplier-payment")).toBe(true);
    expect(alpha.has("approve-payments")).toBe(false);
    expect(beta.has("approve-payments")).toBe(true);
    expect(beta.has("supplier-payment")).toBe(false);
    expect(alpha.has("manage-user")).toBe(false);
  });
  it("hides a button when the context lacks its permission, even if the journey exists", async () => {
    const personal = await ctx("personal");
    const noCards = { ...personal, permissions: personal.permissions.filter((p) => p !== "cards.manage") };
    const sees = (c: ContextInfo) => launchPointsFor({ context: c, entries: ALL }, { place: "cards.card" }).map((l) => l.journey);
    expect(sees(personal)).toContain("freeze-card");
    expect(sees(noCards)).not.toContain("freeze-card");
    expect(sees(noCards)).toContain("card-pin");
  });
  it("hides buttons for journeys this app does not have, and uses an older name when that is what exists", async () => {
    const business = await ctx("alpha");
    expect(launchPointsFor({ context: business, entries: slugs("corporate-approval") }, { place: "approvals.inbox" })).toHaveLength(0); // beta only: alpha cannot approve
    expect(launchPointsFor({ context: business, entries: slugs("corporate-payment") }, { place: "overview" }).map((l) => l.journey)).toEqual(["supplier-payment"]);
    expect(entryFor("supplier-payment", slugs("corporate-payment"))).toBe("corporate-payment");
    expect(entryFor("pay-bill", slugs("pay-bill-acme-bank"))).toBe("pay-bill-acme-bank");
    expect(entryFor("statement", slugs("pay-bill"))).toBeUndefined();
  });
  it("honours the bank's disabled list and per-journey options", async () => {
    const personal = await ctx("personal");
    const see = (settings: { disabled: string[]; options: Record<string, Record<string, unknown>> }) => launchPointsFor({ context: personal, entries: ALL, settings }, { quick: true }).map((l) => l.journey);
    expect(see({ disabled: [], options: {} })).toContain("mobile-topup");
    expect(see({ disabled: ["mobile-topup"], options: {} })).not.toContain("mobile-topup");
    expect(see({ disabled: [], options: { "pay-bill": { enabled: false } } })).not.toContain("pay-bill");
    expect(see({ disabled: [], options: { "pay-bill": { instant: false } } })).toContain("pay-bill");
    expect(journeyOn("pay-bill", { disabled: ["pay-a-bill"], options: {} })).toBe(false); // the older name counts
  });
  it("matches what the sandbox reports as switched off", async () => {
    const b = new MockBank("alex");
    b.config = { ...b.config, disabled: ["mobile-topup"], options: {} } as typeof b.config;
    const cfg = await b.call("bank.app.config");
    expect(cfg.disabled).toEqual(["mobile-topup"]);
    const personal = (await b.call("bank.session.get")).contexts[0] as ContextInfo;
    expect(launchPointsFor({ context: personal, entries: ALL, settings: cfg }, { quick: true }).map((l) => l.journey)).not.toContain("mobile-topup");
  });
});

describe("the values a button passes", () => {
  it("passes only the values the place declares, then the fixed ones, and drops empty values", () => {
    const renew = LAUNCH_POINTS.find((l) => l.journey === "term-deposit" && l.label === "Renew")!;
    expect(launchValues(renew, { depositId: "td_1", other: "x" })).toEqual({ depositId: "td_1", mode: "renew" });
    const freeze = LAUNCH_POINTS.find((l) => l.journey === "freeze-card")!;
    expect(launchValues(freeze, { cardId: "card_debit", action: "block" })).toEqual({ cardId: "card_debit", action: "freeze" });
    expect(launchValues(freeze, { cardId: "" })).toEqual({ action: "freeze" });
  });
});
