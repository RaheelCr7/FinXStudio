import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

let store: typeof import("./store");
beforeEach(async () => {
  process.env.FINX_DATA_DIR = mkdtempSync(path.join(tmpdir(), "finx-"));
  store = await import("./store");
});

describe("journey store", () => {
  it("seeds Local transfer as published v5", async () => {
    const list = await store.listJourneys();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ slug: "fund-transfer-local", publishedVersion: 5, draftDiffers: false, issues: 0 });
  });

  it("saves a draft, marks it as differing, and publishes as v6", async () => {
    const rec = await store.getRecord("fund-transfer-local");
    const draft = structuredClone(rec.draft);
    (draft.screens[0] as any).title = { en: "Choose account", ur: "اکاؤنٹ منتخب کریں" };
    const saved = await store.saveDraft("fund-transfer-local", draft);
    expect(saved.issues).toEqual([]);
    expect((await store.listJourneys())[0]!.draftDiffers).toBe(true);
    const pub = await store.publish("fund-transfer-local");
    expect(pub.published!.version).toBe(6);
    expect((pub.published!.screens[0] as any).title.en).toBe("Choose account");
    expect(pub.history.map((h) => h.version)).toEqual([5, 6]);
  });

  it("refuses to publish a draft with lint issues", async () => {
    const draft = structuredClone((await store.getRecord("fund-transfer-local")).draft);
    draft.screens = draft.screens.filter((s) => s.id !== "otp"); // breaks navigation + OTP-before-money
    await store.saveDraft("fund-transfer-local", draft);
    await expect(store.publish("fund-transfer-local")).rejects.toMatchObject({ status: 422 });
    expect((await store.getRecord("fund-transfer-local")).published!.version).toBe(5);
  });

  it("rejects a draft that does not match the schema", async () => {
    await expect(store.saveDraft("fund-transfer-local", { nope: true })).rejects.toMatchObject({ status: 422 });
  });

  it("creates a blank journey that passes lint and can be published", async () => {
    const rec = await store.createJourney("Pay a bill");
    expect(rec.slug).toBe("pay-a-bill");
    const pub = await store.publish("pay-a-bill");
    expect(pub.published!.version).toBe(1);
  });

  it("rejects duplicate names and bad slugs", async () => {
    await store.createJourney("Mobile top-up");
    await expect(store.createJourney("Mobile top-up")).rejects.toMatchObject({ status: 409 });
    await expect(store.getRecord("../etc/passwd")).rejects.toMatchObject({ status: 400 });
  });

  it("warns about misspelled optional fields instead of silently dropping them", async () => {
    const draft: any = structuredClone((await store.getRecord("fund-transfer-local")).draft);
    draft.screens[2].blocks[0].helperr = "typo";
    const saved = await store.saveDraft("fund-transfer-local", draft);
    expect(saved.warnings.join(" ")).toContain("screens[2].blocks[0].helperr");
    expect(JSON.stringify(saved.record.draft)).not.toContain("helperr");
  });

  it("refuses to publish when a rule refers to data that does not exist", async () => {
    const draft: any = structuredClone((await store.getRecord("fund-transfer-local")).draft);
    draft.screens[2].navigation.rules[0].when = "transfer.amout > 5";
    const saved = await store.saveDraft("fund-transfer-local", draft);
    expect(saved.issues.map((i) => i.code)).toContain("unknown_field");
    await expect(store.publish("fund-transfer-local")).rejects.toMatchObject({ status: 422 });
  });
});

