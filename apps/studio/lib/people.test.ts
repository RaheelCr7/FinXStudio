import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { can, ROLES } from "./roles";

let people: typeof import("./people");
beforeEach(async () => {
  process.env.FINX_DATA_DIR = mkdtempSync(path.join(tmpdir(), "finx-"));
  people = await import("./people");
});
const as = (id?: string) => new Request("http://x/api", { headers: id ? { cookie: `theme=dark; finx.user=${id}` } : {} });

describe("roles", () => {
  it("gives each role its own powers", () => {
    expect(ROLES.map((r) => [r, can(r, "edit"), can(r, "publish")])).toEqual([["admin", true, true], ["designer", true, false], ["developer", true, false], ["reviewer", false, true]]);
    expect(can("designer", "projects")).toBe(true);
    expect(can("developer", "projects")).toBe(false);
    expect(can("developer", "agents")).toBe(true);
    expect(can("reviewer", "people")).toBe(false);
    expect(can(undefined, "edit")).toBe(false);
  });
});

describe("people and who is acting", () => {
  it("starts with one person per role, and acts as the Admin when no one chose", async () => {
    expect((await people.listPeople()).map((p) => p.role)).toEqual(["admin", "designer", "developer", "reviewer"]);
    expect((await people.actorOf(as())).role).toBe("admin");
    expect((await people.actorOf(as("riya"))).name).toBe("Riya Khan");
    expect((await people.actorOf(as("ghost"))).role).toBe("admin");
  });

  it("lets editors edit but not publish, and reviewers publish but not edit", async () => {
    await expect(people.requireCan(as("dana"), "edit")).resolves.toMatchObject({ id: "dana" });
    await expect(people.requireCan(as("dana"), "publish")).rejects.toMatchObject({ status: 403, message: expect.stringContaining("Dana Lee is a Designer and cannot publish") });
    await expect(people.requireCan(as("riya"), "publish")).resolves.toBeTruthy();
    await expect(people.requireCan(as("riya"), "edit")).rejects.toMatchObject({ status: 403 });
    await expect(people.requireCan(as("sam"), "people")).rejects.toMatchObject({ status: 403 });
    await expect(people.requireCan(as(), "people")).resolves.toBeTruthy();
  });

  it("adds, renames and re-roles people, with unique ids", async () => {
    const a = await people.addPerson({ name: "Zed Ali", role: "reviewer" });
    const b = await people.addPerson({ name: "Zed Ali", role: "developer" });
    expect([a.id, b.id]).toEqual(["zed-ali", "zed-ali-2"]);
    expect(await people.updatePerson("zed-ali", { role: "designer", name: "Zed A." })).toMatchObject({ role: "designer", name: "Zed A." });
    await expect(people.addPerson({ name: "x", role: "admin" })).rejects.toMatchObject({ status: 400 });
    await expect(people.addPerson({ name: "Fine Name", role: "boss" })).rejects.toMatchObject({ status: 400 });
  });

  it("never leaves Studio without an Admin", async () => {
    await expect(people.updatePerson("alex", { role: "reviewer" })).rejects.toMatchObject({ status: 409 });
    await expect(people.removePerson("alex")).rejects.toMatchObject({ status: 409 });
    await people.updatePerson("dana", { role: "admin" });
    await expect(people.removePerson("alex")).resolves.toBeUndefined();
    expect((await people.listPeople()).some((p) => p.id === "alex")).toBe(false);
  });
});
