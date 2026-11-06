import { describe, expect, it } from "vitest";
import { MockBank } from "@finx/mock-bank-api";
import { bankworkxJourneys } from "@finx/journey-schema";
import { LAUNCH_POINTS, forRow, journeyAllowed, journeyOn, launchFromValues, launchPointsFor, launchValues } from "./launch-points";
import { loadScreen } from "./view-models/screens";
import { commandsFor } from "./view-models/commands";
import type { ContextInfo } from "./session";

// Business: Bulk and payroll, and Approvals (step 8, slice B): the buttons that open them, the batches the Payments tab lists, and what an Approver is never offered.
const NOW = Date.parse("2026-11-03T10:42:00Z");
const ALL = bankworkxJourneys.map((j) => ({ slug: j.slug }));
const enter = async (id: string) => {
  const b = new MockBank("alex"); b.now = () => NOW;
  await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" });
  await b.call("bank.session.stepUp", { method: "password", secret: "Bwx!Demo2026" });
  await b.call("bank.session.switch", { contextId: id });
  const contexts = (await b.call("bank.session.get")).contexts as ContextInfo[];
  return { b, context: contexts.find((c) => c.id === id)!, contexts };
};
const labels = (context: ContextInfo, place: string) => launchPointsFor({ context, entries: ALL }, { place }).map((l) => l.label);

describe("the buttons that open bulk payments, payroll and the approvals", () => {
  it("a Maker is offered Upload payments and Run payroll (quick actions and the Payments hub), an Approver none of them", async () => {
    const alpha = (await enter("alpha")).context, beta = (await enter("beta")).context;
    const quick = (c: ContextInfo) => launchPointsFor({ context: c, entries: ALL }, { quick: true }).map((l) => l.label);
    expect(quick(alpha)).toEqual(expect.arrayContaining(["Upload payments", "Run payroll"]));
    expect(quick(beta)).not.toEqual(expect.arrayContaining(["Upload payments"]));
    expect(labels(alpha, "payments.hub")).toEqual(expect.arrayContaining(["Upload a file", "Run payroll"]));
    for (const place of ["payments.hub", "payments.bulk"]) for (const l of labels(beta, place)) expect(["Upload a file", "Run payroll", "Batch status", "Repair rejected lines"], `${l} at Beta`).not.toContain(l);
    for (const j of ["bulk-payment", "repair-bulk-lines", "bulk-status", "payroll-run"]) {
      expect(journeyAllowed(j, { context: alpha, entries: ALL }), `${j} at Alpha`).toBe(true);
      expect(journeyAllowed(j, { context: beta, entries: ALL }), `${j} at Beta`).toBe(false);
    }
  });
  it("a batch row offers Batch status, and Repair rejected lines only on a batch that was paid with a returned payment", async () => {
    const alpha = (await enter("alpha")).context;
    expect(labels(alpha, "payments.bulk")).toEqual(["Batch status", "Repair rejected lines"]);
    // the old button of a payment row (a payment still waiting cannot be repaired) is gone from there
    expect(labels(alpha, "payments.payment")).toEqual(["Track", "Withdraw", "Save as template", "Repeat"]);
    const points = launchPointsFor({ context: alpha, entries: ALL }, { place: "payments.bulk" });
    expect(forRow(points, { state: "paid" }).map((l) => l.label)).toEqual(["Batch status"]);
    expect(forRow(points, { state: "partly" }).map((l) => l.label)).toEqual(["Batch status", "Repair rejected lines"]);
    expect(forRow(points, {}).map((l) => l.label)).toEqual(["Batch status"]);
    const status = LAUNCH_POINTS.find((l) => l.journey === "bulk-status" && l.label === "Batch status")!;
    expect(launchFromValues("bulk-status", launchValues(status, { id: "PAY-1190", other: "x" }))).toEqual({ "launch.id": "PAY-1190" });
    const repair = LAUNCH_POINTS.find((l) => l.journey === "repair-bulk-lines")!;
    expect(launchFromValues("repair-bulk-lines", launchValues(repair, { paymentId: "PAY-1190" }))).toEqual({ "launch.paymentId": "PAY-1190" });
  });
  it("Reject several opens the approvals in reject mode with the ticked payments; Approve several does not", async () => {
    const reject = LAUNCH_POINTS.find((l) => l.journey === "approve-payments" && l.label === "Reject several")!;
    const approve = LAUNCH_POINTS.find((l) => l.journey === "approve-payments" && l.label === "Approve several")!;
    expect(launchFromValues("approve-payments", launchValues(reject, { paymentIds: ["PAY-2041", "PAY-2043"], other: "x" }))).toEqual({ "launch.paymentIds": ["PAY-2041", "PAY-2043"], "launch.mode": "reject" });
    expect(launchFromValues("approve-payments", launchValues(approve, { paymentIds: ["PAY-2041"] }))).toEqual({ "launch.paymentIds": ["PAY-2041"] });
  });
  it("a link can open a batch, and the command bar lists Bulk payments for a Maker only", async () => {
    const { context: alpha, contexts } = await enter("alpha");
    const { context: beta } = await enter("beta");
    expect(commandsFor({ context: alpha, entries: ALL }, contexts).filter((c) => c.kind === "journey").map((c) => c.label)).toContain("Bulk payments");
    expect(commandsFor({ context: beta, entries: ALL }, contexts).filter((c) => c.kind === "journey").map((c) => c.label)).not.toContain("Bulk payments");
    expect(launchFromValues("bulk-payment", { repairOf: "PAY-1190", id: "x" })).toEqual({});
  });
  it("a bank switches Repair rejected lines off only together with Bulk payment, and an app without the new journeys draws what it drew before", async () => {
    expect(journeyOn("repair-bulk-lines", { disabled: [], options: {} })).toBe(true);
    expect(journeyOn("repair-bulk-lines", { disabled: ["bulk-payment"], options: {} })).toBe(false);
    expect(journeyOn("repair-bulk-lines", { disabled: [], options: { "bulk-payment": { enabled: false } } })).toBe(false);
    expect(journeyOn("repair-bulk-lines", { disabled: ["repair-bulk-lines"], options: {} })).toBe(false);
    expect(journeyOn("bulk-payment", { disabled: ["repair-bulk-lines"], options: {} })).toBe(true);
    const alpha = (await enter("alpha")).context;
    const old = [{ slug: "corporate-payment" }, { slug: "corporate-approval" }];
    expect(launchPointsFor({ context: alpha, entries: old }, { place: "payments.bulk" })).toEqual([]);
  });
});

describe("what the Payments tab lists of bulk batches", () => {
  it("a Maker sees the company's batches, newest first, with their status and what to do; an Approver sees no section", async () => {
    const { b, context } = await enter("alpha");
    const screen = await loadScreen((a, i) => b.call(a, i), context, "payments");
    const section = screen.sections.find((s) => s.id === "bulk")!;
    expect(section).toMatchObject({ title: "Bulk batches", place: "payments.bulk", empty: "No batches yet" });
    expect(section.rows.map((r) => [r.id, r.title, r.subtitle, r.tag, r.state])).toEqual([
      ["PAY-1190", "Supplier batch 19", "4 payments · PAY-1190", "Partly paid", "partly"],
      ["PAY-1180", "Supplier batch 18", "6 payments · PAY-1180", "Paid", "paid"],
    ]);
    expect(section.rows[0]!.passes).toEqual({ id: "PAY-1190", paymentId: "PAY-1190" });
    const beta = await enter("beta");
    const approver = await loadScreen((a, i) => beta.b.call(a, i), beta.context, "payments");
    expect(approver.sections.find((s) => s.id === "bulk")).toBeUndefined();
    expect(JSON.stringify(approver)).not.toContain("Supplier batch");
  });
  it("a list of batches that cannot be read leaves its section empty and does not take the tab down", async () => {
    const b = new MockBank("alex", { conditions: { unavailable: ["corp.bulk.list"] } }); b.now = () => NOW;
    await b.call("bank.otp.send"); await b.call("bank.otp.verify", { code: "482100" });
    await b.call("bank.session.stepUp", { method: "password", secret: "Bwx!Demo2026" }); await b.call("bank.session.switch", { contextId: "alpha" });
    const context = ((await b.call("bank.session.get")).contexts as ContextInfo[]).find((c) => c.id === "alpha")!;
    const screen = await loadScreen((a, i) => b.call(a, i), context, "payments");
    expect(screen.sections.find((s) => s.id === "bulk")!.rows).toEqual([]);
    expect(screen.sections.find((s) => s.id === "templates")!.rows.length).toBe(2);
  });
  it("the Personal places never carry a batch", async () => {
    const b = new MockBank("alex"); b.now = () => NOW;
    const personal = (await b.call("bank.session.get")).contexts.find((c: ContextInfo) => c.id === "personal") as ContextInfo;
    const screen = await loadScreen((a, i) => b.call(a, i), personal, "payments");
    expect(JSON.stringify(screen)).not.toContain("Supplier batch");
    expect(screen.sections.find((s) => s.id === "bulk")).toBeUndefined();
  });
});
