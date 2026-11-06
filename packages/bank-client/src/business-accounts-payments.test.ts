import { describe, expect, it } from "vitest";
import { MockBank } from "@finx/mock-bank-api";
import { bankworkxJourneys } from "@finx/journey-schema";
import { LAUNCH_POINTS, journeyAllowed, launchFromValues, launchPointsFor, launchValues } from "./launch-points";
import { loadScreen } from "./view-models/screens";
import { commandsFor } from "./view-models/commands";
import type { ContextInfo } from "./session";

// Business: Accounts and Payments (step 8, slice A): the buttons the Accounts and Payments tabs draw, the command bar, and what the Payments tab lists.
const NOW = Date.parse("2026-11-03T10:42:00Z");
const slugs = (...s: string[]) => s.map((slug) => ({ slug }));
/** The journeys the app has: those BankWorkx ships (a button for a journey the app does not have is not drawn). */
const ALL = slugs(...bankworkxJourneys.map((j) => j.slug));
const enter = async (id: string) => {
  const b = new MockBank("alex"); b.now = () => NOW;
  await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" });
  await b.call("bank.session.stepUp", { method: "password", secret: "Bwx!Demo2026" });
  await b.call("bank.session.switch", { contextId: id });
  const contexts = (await b.call("bank.session.get")).contexts as ContextInfo[];
  return { b, context: contexts.find((c) => c.id === id)!, contexts };
};
const labels = (context: ContextInfo, place: string) => launchPointsFor({ context, entries: ALL }, { place }).map((l) => l.label);

describe("the buttons of the Accounts and Payments tabs", () => {
  it("an account offers Statement and, where the person may pay, Pay from this account; the values reach the journey as launch values", async () => {
    const alpha = (await enter("alpha")).context, beta = (await enter("beta")).context;
    expect(labels(alpha, "accounts.detail")).toEqual(["Statement", "Transactions", "Pay from this account"]);
    expect(labels(beta, "accounts.detail")).toEqual(["Statement", "Transactions"]);
    const pay = LAUNCH_POINTS.find((l) => l.journey === "supplier-payment" && l.label === "Pay from this account")!;
    expect(launchFromValues("supplier-payment", launchValues(pay, { accountId: "alpha_ops", other: "x" }))).toEqual({ "launch.accountId": "alpha_ops" });
    expect(launchFromValues("business-statement", { accountId: "alpha_ops", from: "2026-10-05", to: "2026-11-03", extra: "x" })).toEqual({ "launch.accountId": "alpha_ops", "launch.from": "2026-10-05", "launch.to": "2026-11-03" });
  });
  it("a payment, a template, a supplier and a scheduled payment each offer what the spec says, and only to a Maker", async () => {
    const alpha = (await enter("alpha")).context, beta = (await enter("beta")).context;
    expect(labels(alpha, "payments.payment")).toEqual(["Track", "Withdraw", "Save as template", "Repeat"]);
    expect(labels(alpha, "payments.templates")).toEqual(["New template", "Use", "Delete"]);
    expect(labels(alpha, "payments.suppliers")).toEqual(["Add", "Pay"]);
    expect(labels(alpha, "payments.scheduled")).toEqual(["Schedule a payment", "Change", "Cancel"]);
    expect(labels(beta, "payments.payment")).toEqual(["Track"]);
    for (const place of ["payments.templates", "payments.suppliers", "payments.scheduled"]) expect(labels(beta, place), place).toEqual([]);
    const cancel = LAUNCH_POINTS.find((l) => l.journey === "schedule-business-payment" && l.label === "Cancel")!;
    expect(launchFromValues("schedule-business-payment", launchValues(cancel, { scheduleId: "BSC-3001" }))).toEqual({ "launch.scheduleId": "BSC-3001", "launch.mode": "cancel" });
    const del = LAUNCH_POINTS.find((l) => l.journey === "payment-template" && l.label === "Delete")!;
    expect(launchFromValues("payment-template", launchValues(del, { templateId: "tpl_freight" }))).toEqual({ "launch.templateId": "tpl_freight", "launch.mode": "delete" });
    expect(launchFromValues("supplier-payment", { templateId: "tpl_freight", supplierId: "harb", accountId: "alpha_ops" })).toEqual({ "launch.templateId": "tpl_freight", "launch.supplierId": "harb", "launch.accountId": "alpha_ops" });
  });
  it("a button needs the journey in the app: without the new journeys the tabs draw what they drew before", async () => {
    const alpha = (await enter("alpha")).context;
    const old = slugs("corporate-payment", "corporate-approval");
    expect(launchPointsFor({ context: alpha, entries: old }, { place: "accounts.detail" }).map((l) => l.label)).toEqual(["Pay from this account"]);
    expect(launchPointsFor({ context: alpha, entries: old }, { place: "payments.payment" }).map((l) => l.label)).toEqual(["Repeat"]);
    expect(launchPointsFor({ context: alpha, entries: old }, { place: "payments.scheduled" })).toEqual([]);
  });
  it("the views open from the command bar and from a link, with the permission of the context, and an Approver sees them too", async () => {
    const { context: alpha, contexts } = await enter("alpha");
    const { context: beta } = await enter("beta");
    for (const j of ["business-accounts", "payment-tracker", "templates", "business-schedules"]) {
      expect(journeyAllowed(j, { context: alpha, entries: ALL }), `${j} at Alpha`).toBe(true);
      expect(journeyAllowed(j, { context: beta, entries: ALL }), `${j} at Beta`).toBe(true);
    }
    for (const j of ["add-supplier", "payment-template", "schedule-business-payment", "withdraw-payment"]) {
      expect(journeyAllowed(j, { context: alpha, entries: ALL }), `${j} at Alpha`).toBe(true);
      expect(journeyAllowed(j, { context: beta, entries: ALL }), `${j} at Beta`).toBe(false);
    }
    const names = commandsFor({ context: alpha, entries: ALL }, contexts).filter((c) => c.kind === "journey").map((c) => c.label);
    expect(names).toEqual(expect.arrayContaining(["Accounts overview", "Payment tracker", "Templates", "Scheduled payments"]));
  });
});

describe("what the Payments tab lists", () => {
  it("the payments in progress, the scheduled payments, the templates and the approved suppliers of the company the person is in", async () => {
    const { b, context } = await enter("alpha");
    const screen = await loadScreen((a, i) => b.call(a, i), context, "payments");
    const section = (id: string) => screen.sections.find((s) => s.id === id)!;
    expect(section("scheduled").rows.map((r) => [r.id, r.title, r.subtitle, r.tag])).toEqual([
      ["BSC-3001", "Harbour Packaging · PO-STANDING", "$4,500.00 · Monthly · next Tue 1 Dec", "Active"],
      ["BSC-3002", "Whitby Logistics · FREIGHT-Q", "£12,000.00 · Every 3 months · next Mon 4 Jan", "Waiting for approval"],
    ]);
    expect(section("scheduled")).toMatchObject({ place: "payments.scheduled" });
    expect(section("templates").rows.map((r) => [r.id, r.value])).toEqual([["tpl_packaging", "$4,500.00"], ["tpl_freight", "Amount each time"]]);
    expect(section("suppliers").rows.map((r) => r.title)).toEqual(["Harbour Packaging", "Nordic Supplies AB", "Whitby Logistics", "Gulf Trade FZE"]);
    expect(section("tracker").rows.map((r) => r.id)).toEqual(["PAY-2040"]);
    // nothing of Beta is in Alpha's tab
    expect(JSON.stringify(screen)).not.toContain("Nimbus");
  });
  it("a scheduled list that cannot be read leaves its section empty and does not take the tab down", async () => {
    const b = new MockBank("alex", { conditions: { unavailable: ["corp.schedules.list"] } }); b.now = () => NOW;
    await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" });
    await b.call("bank.session.stepUp", { method: "password", secret: "Bwx!Demo2026" }); await b.call("bank.session.switch", { contextId: "alpha" });
    const context = ((await b.call("bank.session.get")).contexts as ContextInfo[]).find((c) => c.id === "alpha")!;
    const screen = await loadScreen((a, i) => b.call(a, i), context, "payments");
    expect(screen.sections.find((s) => s.id === "scheduled")!.rows).toEqual([]);
    expect(screen.sections.find((s) => s.id === "templates")!.rows.length).toBe(2);
  });
});
