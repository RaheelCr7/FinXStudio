import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

let code: typeof import("./code");
let cat: typeof import("./catalog");
beforeEach(async () => {
  process.env.FINX_DATA_DIR = mkdtempSync(path.join(tmpdir(), "finx-"));
  delete process.env.FINX_BRANDS_FILE;
  code = await import("./code");
  cat = await import("./catalog");
});

describe("project source", () => {
  it("holds only the project's own journeys, live ones as published", async () => {
    const files = await code.projectFiles("meezan", "http://studio.test");
    expect(files.filter((f) => f.path.startsWith("journeys/")).map((f) => f.path)).toEqual(["journeys/fund-transfer-local.json"]);
    expect(files.find((f) => f.path === "journeys/fund-transfer-local.json")!.note).toContain("live v5");
    expect(files.find((f) => f.path === ".env.example")!.content).toContain("http://studio.test");
  });

  it("picks up a journey added from the catalog, as a draft", async () => {
    await cat.addFromCatalog("add-money", "meezan");
    const files = await code.projectFiles("meezan", "http://studio.test");
    expect(files.find((f) => f.path === "journeys/add-money-meezan.json")!.note).toContain("draft");
  });

  it("refuses an unknown project", async () => {
    await expect(code.projectFiles("nobank", "http://x")).rejects.toMatchObject({ status: 404 });
  });
});
