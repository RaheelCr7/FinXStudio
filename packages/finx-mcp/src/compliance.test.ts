import { describe, it, expect } from "vitest";
import { Journey, bulkPayment, corporatePayment, payBill, payrollRun } from "@finx/journey-schema";
import { complianceReport } from "./compliance";

const status = (r: Awaited<ReturnType<typeof complianceReport>>, id: string) => r.checks.find((c) => c.id === id)!.status;

describe("compliance report", () => {
  it("a corporate payroll journey passes every check and traces each criterion to screens on both banks", async () => {
    const r = await complianceReport(Journey.parse(payrollRun));
    expect(r.checks.filter((c) => c.status === "fail"), JSON.stringify(r.checks.filter((c) => c.status === "fail"))).toEqual([]);
    expect(r.movesMoney).toBe(true);
    expect(r.summary).toMatchObject({ criteria: 13, proved: 13, fail: 0 });
    for (const t of r.trace) { expect(Object.keys(t.banks)).toEqual(["reference", "bank-b"]); expect(t.scenarios.length).toBeGreaterThan(0); expect(t.screens.length).toBeGreaterThan(0); }
    expect(r.trace.find((t) => t.id === "AC-1")!.screens.map((s) => s.id)).toContain(payrollRun.entryScreen);
  });

  it("a consumer journey has no corporate role check and no tests to trace", async () => {
    const r = await complianceReport(Journey.parse(payBill));
    expect(status(r, "authorisation")).toBe("n/a");
    expect(status(r, "proof")).toBe("n/a");
    expect(status(r, "consent")).toBe("pass");
    expect(r.trace).toEqual([]);
  });

  it("fails the checks when consent, the code check, the error path or the role is taken away", async () => {
    const j: any = structuredClone(corporatePayment);
    for (const s of j.screens) s.blocks = s.blocks.filter((b: any) => b.type !== "consent" && b.type !== "otp");
    delete j.authorisation;
    const r = await complianceReport(Journey.parse(j));
    expect(status(r, "consent")).toBe("fail");
    expect(status(r, "otp")).toBe("fail");
    expect(status(r, "authorisation")).toBe("fail");

    const k: any = structuredClone(bulkPayment);
    for (const s of k.screens) for (const b of s.blocks) for (const a of b.actions ?? []) if (a.type === "callApi" && /submit/.test(k.integrations.find((i: any) => i.id === a.integration)?.adapter)) delete a.onError;
    const r2 = await complianceReport(Journey.parse(k));
    expect(status(r2, "failure-paths")).toBe("fail");
    expect(r2.checks.find((c) => c.id === "failure-paths")!.detail).toContain("corp.bulk.submit has no error path");
  });
});
