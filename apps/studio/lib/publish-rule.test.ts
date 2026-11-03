import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Person } from "./people";

let store: typeof import("./store");
let access: typeof import("./access");
let people: typeof import("./people");
let rule: typeof import("./publish-rule");
const by = (p: Person) => ({ id: p.id, name: p.name });
let sam: Person, alex: Person, riya: Person;

beforeEach(async () => {
  process.env.FINX_DATA_DIR = mkdtempSync(path.join(tmpdir(), "finx-rule-"));
  store = await import("./store"); access = await import("./access"); people = await import("./people"); rule = await import("./publish-rule");
  await access.createRole({ label: "Maker", actions: ["edit", "publish"] });
  await people.updatePerson("sam", { role: "maker" });
  const all = await people.listPeople();
  sam = all.find((p) => p.id === "sam")!; alex = all.find((p) => p.id === "alex")!; riya = all.find((p) => p.id === "riya")!;
});

/** A draft in BankWorkx that sam changed last. */
let n = 0;
async function samsDraft() {
  const rec = await store.createJourney(`Rule test ${++n}`, ["bankworkx"], by(sam));
  return (await store.saveDraft(rec.slug, { ...rec.draft, name: "Rule test v2" }, by(sam))).record;
}

describe("the approval rule when publishing", () => {
  it("lets Admins only publish their own change by default, so a Maker is held back", async () => {
    const rec = await samsDraft();
    await expect(rule.assertMayPublish(rec, sam)).rejects.toMatchObject({ status: 403, message: expect.stringContaining("only an Admin") });
  });
  it("lets someone else publish it", async () => {
    const rec = await samsDraft();
    await expect(rule.assertMayPublish(rec, riya)).resolves.toBeUndefined();
    await expect(rule.assertMayPublish(rec, alex)).resolves.toBeUndefined();
  });
  it("on 'never' holds back the author even when they are an Admin", async () => {
    await access.setPolicy("bankworkx", "never");
    const rec = await store.createJourney("Admin change", ["bankworkx"], by(alex));
    await expect(rule.assertMayPublish(rec, alex)).rejects.toMatchObject({ status: 403, message: expect.stringContaining("second person") });
    await expect(rule.assertMayPublish(rec, riya)).resolves.toBeUndefined();
  });
  it("on 'anyone' lets the author publish", async () => {
    await access.setPolicy("bankworkx", "anyone");
    await expect(rule.assertMayPublish(await samsDraft(), sam)).resolves.toBeUndefined();
  });
  it("applies only to the project it is set on", async () => {
    await access.setPolicy("meezan", "never");
    await expect(rule.assertMayPublish(await samsDraft(), sam)).rejects.toMatchObject({ status: 403 }); // bankworkx is still the default: Admins only
    await access.setPolicy("bankworkx", "anyone");
    await expect(rule.assertMayPublish(await samsDraft(), sam)).resolves.toBeUndefined();
  });
  it("lets the author publish once nothing is left to approve, and ignores changes of unknown authorship", async () => {
    const rec = await samsDraft();
    const live = await store.publish(rec.slug, "Riya Khan");
    await expect(rule.assertMayPublish(live, sam)).resolves.toBeUndefined();
    const anon = await store.createJourney("Agent draft", ["bankworkx"]);
    await expect(rule.assertMayPublish(anon, sam)).resolves.toBeUndefined();
  });
});
