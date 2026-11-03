import { describe, it, expect, beforeAll } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Journey, payBill } from "@finx/journey-schema";
import { complianceReport } from "@finx/mcp/proof";
import { hashOf, listSnapshots, saveSnapshot } from "./compliance-store";

beforeAll(() => { process.env.FINX_DATA_DIR = mkdtempSync(path.join(tmpdir(), "finx-co-")); });

describe("compliance snapshots", () => {
  it("are kept per journey, newest first, and show when the journey changed afterwards", async () => {
    const j = Journey.parse(payBill);
    const a = await saveSnapshot(j, await complianceReport(j), "Sara", "sent to review");
    const b = await saveSnapshot({ ...j, version: 2 }, await complianceReport(j), "Omar");
    const list = await listSnapshots(j.slug);
    expect(list.map((s) => s.id)).toEqual([b.id, a.id]);
    expect(list[1]).toMatchObject({ version: j.version, by: "Sara", note: "sent to review" });
    expect(await listSnapshots("someone-else")).toEqual([]);
    expect(hashOf(j)).toBe(a.hash);
    expect(hashOf({ ...j, version: 9 })).not.toBe(a.hash);
  });
});
