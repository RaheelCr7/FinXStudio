import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { catalog } from "@finx/journey-schema";
import { lintAll } from "@finx/renderer-core";

let cat: typeof import("./catalog");
let store: typeof import("./store");
beforeEach(async () => {
  process.env.FINX_DATA_DIR = mkdtempSync(path.join(tmpdir(), "finx-"));
  delete process.env.FINX_BRANDS_FILE; // the real two banks: meezan and bankworkx
  cat = await import("./catalog");
  store = await import("./store");
});

describe("journey catalog", () => {
  it("only offers journeys that pass lint, with unique ids", () => {
    expect(new Set(catalog.map((c) => c.id)).size).toBe(catalog.length);
    for (const c of catalog) { expect(c.id).toBe(c.journey.slug); expect(lintAll(c.journey), c.id).toEqual([]); }
  });

  it("says what a journey needs, from the journey itself", () => {
    const money = cat.describeEntry(catalog.find((c) => c.id === "add-money")!);
    expect(money).toMatchObject({ name: "Add money", screens: 4, languages: ["en"], currencies: ["USD"] });
  });

  it("marks what a project already has, and nothing else", async () => {
    const rows = await cat.listCatalog("meezan");
    expect(rows.find((r) => r.id === "fund-transfer-local")!.added).toBe("fund-transfer-local");
    expect(rows.filter((r) => r.added).length).toBe(1);
  });

  it("adds a copy to a project as a draft, then refuses a second copy", async () => {
    const rec = await cat.addFromCatalog("add-money", "meezan");
    expect(rec.slug).toBe("add-money-meezan");
    expect(rec.draft).toMatchObject({ apps: ["meezan"], status: "draft", version: 0 });
    expect(rec.published).toBeUndefined();
    expect((await cat.listCatalog("meezan")).find((r) => r.id === "add-money")!.added).toBe("add-money-meezan");
    await expect(cat.addFromCatalog("add-money", "meezan")).rejects.toMatchObject({ status: 409 });
  });

  it("can publish on add, and the copy is independent of the catalog", async () => {
    const rec = await cat.addFromCatalog("add-card", "meezan", { publishNow: true });
    expect(rec.published!.version).toBe(1);
    const draft = structuredClone(rec.draft); draft.name = "Edited"; await store.saveDraft("add-card-meezan", draft);
    expect(catalog.find((c) => c.id === "add-card")!.journey.name).toBe("Add card");
  });

  it("rejects an unknown journey or project", async () => {
    await expect(cat.addFromCatalog("nope", "meezan")).rejects.toMatchObject({ status: 404 });
    await expect(cat.addFromCatalog("add-money", "nobank")).rejects.toMatchObject({ status: 404 });
  });
});
