import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { BUILTIN_ROLES, canDo, roleIn, selfPublishBlock, type RoleDef } from "./roles";

let access: typeof import("./access");
let people: typeof import("./people");
let activity: typeof import("./activity");
beforeEach(async () => {
  process.env.FINX_DATA_DIR = mkdtempSync(path.join(tmpdir(), "finx-acc-"));
  access = await import("./access"); people = await import("./people"); activity = await import("./activity");
});
const as = (id?: string) => new Request("http://x/api", { headers: id ? { cookie: `finx.user=${id}` } : {} });

describe("what a role allows, in one project or all", () => {
  const dana = { role: "designer", access: { meezan: "reviewer" } };
  it("uses the project's role where one is given, and the main role elsewhere", () => {
    expect(roleIn(dana, "meezan")).toBe("reviewer");
    expect(roleIn(dana, "bankworkx")).toBe("designer");
    expect(roleIn(dana)).toBe("designer");
  });
  it("lets a person publish only where their role there can", () => {
    expect(canDo(dana, "publish", ["meezan"])).toBe(true);
    expect(canDo(dana, "publish", ["bankworkx"])).toBe(false);
    expect(canDo(dana, "edit", ["meezan"])).toBe(false);
    expect(canDo(dana, "edit", ["bankworkx"])).toBe(true);
  });
  it("lets one project that allows it be enough for a journey shared by two", () => {
    expect(canDo(dana, "publish", ["bankworkx", "meezan"])).toBe(true);
    expect(canDo(dana, "publish", ["bankworkx"])).toBe(false);
  });
  it("keeps Studio-wide actions on the main role, whatever a project says", () => {
    expect(canDo({ role: "designer", access: { meezan: "admin" } }, "people", ["meezan"])).toBe(false);
    expect(canDo({ role: "admin", access: { meezan: "reviewer" } }, "people", ["meezan"])).toBe(true);
    expect(canDo({ role: "designer" }, "projects", ["anything"])).toBe(true);
  });
  it("works with roles people added", () => {
    const defs: RoleDef[] = [...BUILTIN_ROLES, { id: "qa", label: "QA", blurb: "", actions: ["edit", "agents"] }];
    expect(canDo({ role: "qa" }, "agents", undefined, defs)).toBe(true);
    expect(canDo({ role: "qa" }, "publish", undefined, defs)).toBe(false);
    expect(canDo({ role: "qa" }, "edit", undefined)).toBe(false); // unknown without the definitions
  });
});

describe("the approval rule", () => {
  const maker = { id: "dana", role: "designer" }, admin = { id: "alex", role: "admin" };
  it("never holds back someone else's change, an unchanged journey, or a change with no known author", () => {
    for (const rule of ["admin", "never", "anyone"] as const) {
      expect(selfPublishBlock(rule, admin, { id: "dana" }, true)).toBeNull();
      expect(selfPublishBlock(rule, maker, { id: "dana" }, false)).toBeNull();
      expect(selfPublishBlock(rule, maker, undefined, true)).toBeNull();
    }
  });
  it("lets anyone publish their own change when the project says so", () => {
    expect(selfPublishBlock("anyone", maker, { id: "dana" }, true)).toBeNull();
  });
  it("on 'admin' lets only an Admin publish their own change", () => {
    expect(selfPublishBlock("admin", admin, { id: "alex" }, true)).toBeNull();
    expect(selfPublishBlock("admin", maker, { id: "dana" }, true)).toMatch(/only an Admin/);
  });
  it("on 'never' stops everyone, Admins included", () => {
    expect(selfPublishBlock("never", admin, { id: "alex" }, true)).toMatch(/second person/);
  });
});

describe("custom roles", () => {
  it("adds a role, rejects bad input and duplicates, and edits it", async () => {
    const r = await access.createRole({ label: "QA tester", blurb: "Tests and reports", actions: ["agents", "edit"] });
    expect(r).toMatchObject({ id: "qa-tester", actions: ["edit", "agents"] });
    expect((await access.listRoles()).map((x) => x.id)).toEqual(["admin", "designer", "developer", "reviewer", "qa-tester"]);
    await expect(access.createRole({ label: "x", actions: ["edit"] })).rejects.toMatchObject({ status: 400 });
    await expect(access.createRole({ label: "Fine", actions: [] })).rejects.toMatchObject({ status: 400 });
    await expect(access.createRole({ label: "Fine", actions: ["teleport"] })).rejects.toMatchObject({ status: 400 });
    await expect(access.createRole({ label: "qa TESTER", actions: ["edit"] })).rejects.toMatchObject({ status: 409 });
    await expect(access.createRole({ label: "Admin", actions: ["edit"] })).rejects.toMatchObject({ status: 409 });
    expect(await access.updateRole("qa-tester", { actions: ["edit"], label: "QA" })).toMatchObject({ id: "qa-tester", label: "QA", actions: ["edit"] });
  });
  it("never changes or removes the built-in four, nor a role someone still has", async () => {
    await expect(access.updateRole("admin", { label: "Boss" })).rejects.toMatchObject({ status: 409 });
    await expect(access.deleteRole("designer", [])).rejects.toMatchObject({ status: 409 });
    await access.createRole({ label: "QA", actions: ["edit"] });
    await expect(access.deleteRole("qa", ["Sam Keller"])).rejects.toMatchObject({ status: 409, message: expect.stringContaining("Sam Keller") });
    await expect(access.deleteRole("nope", [])).rejects.toMatchObject({ status: 404 });
    await access.deleteRole("qa", []);
    expect((await access.listRoles()).some((r) => r.id === "qa")).toBe(false);
  });
});

describe("people with project access and custom roles", () => {
  it("gives someone a different role in one project, and acts on it", async () => {
    await people.updatePerson("dana", { access: { meezan: "reviewer" } });
    expect((await people.listPeople()).find((p) => p.id === "dana")?.access).toEqual({ meezan: "reviewer" });
    await expect(people.requireCan(as("dana"), "publish", ["meezan"])).resolves.toMatchObject({ id: "dana" });
    await expect(people.requireCan(as("dana"), "publish", ["bankworkx"])).rejects.toMatchObject({ status: 403, message: expect.stringContaining("Dana Lee is a Designer in bankworkx and cannot publish") });
    await expect(people.requireCan(as("dana"), "edit", ["meezan"])).rejects.toMatchObject({ status: 403 });
    await people.updatePerson("dana", { access: { meezan: null } });
    expect((await people.listPeople()).find((p) => p.id === "dana")?.access).toBeUndefined();
  });
  it("rejects unknown projects and roles in access", async () => {
    await expect(people.updatePerson("dana", { access: { atlantis: "reviewer" } })).rejects.toMatchObject({ status: 400 });
    await expect(people.updatePerson("dana", { access: { meezan: "wizard" } })).rejects.toMatchObject({ status: 400 });
    await expect(people.updatePerson("dana", { access: "all" })).rejects.toMatchObject({ status: 400 });
  });
  it("takes a custom role as a person's role and checks it", async () => {
    await access.createRole({ label: "QA", actions: ["edit", "agents"] });
    await people.updatePerson("riya", { role: "qa" });
    await expect(people.requireCan(as("riya"), "agents")).resolves.toBeTruthy();
    await expect(people.requireCan(as("riya"), "publish")).rejects.toMatchObject({ status: 403, message: expect.stringContaining("Riya Khan is a QA") });
  });
  it("lets a custom role stand in for Admin as the one who manages people, but never leaves nobody", async () => {
    await access.createRole({ label: "Office manager", actions: ["people"] });
    await people.updatePerson("dana", { role: "office-manager" });
    await expect(people.updatePerson("alex", { role: "reviewer" })).resolves.toBeTruthy();
    await expect(people.updatePerson("dana", { role: "designer" })).rejects.toMatchObject({ status: 409 });
    await expect(people.removePerson("dana")).rejects.toMatchObject({ status: 409 });
  });
});

describe("approval rules per project", () => {
  it("defaults to Admins only and takes the strictest rule across a journey's projects", async () => {
    expect(await access.selfPublishFor(["meezan"])).toBe("admin");
    await access.setPolicy("meezan", "anyone");
    await access.setPolicy("bankworkx", "never");
    expect(await access.selfPublishFor(["meezan"])).toBe("anyone");
    expect(await access.selfPublishFor(["meezan", "bankworkx"])).toBe("never");
    await expect(access.setPolicy("meezan", "whenever")).rejects.toMatchObject({ status: 400 });
  });
});

describe("the activity log", () => {
  const dana = { id: "dana", name: "Dana Lee" }, sam = { id: "sam", name: "Sam Keller" };
  it("lists newest first and filters by person, project and kind", async () => {
    await activity.record({ actor: dana, action: "journey.publish", target: "Invest", projectIds: ["bankworkx"], at: "2026-01-01T10:00:00Z" });
    await activity.record({ actor: sam, action: "person.role", target: "Riya", at: "2026-01-01T11:00:00Z" });
    await activity.record({ actor: sam, action: "journey.restore", target: "Invest", projectIds: ["bankworkx"], at: "2026-01-01T12:00:00Z" });
    expect((await activity.listActivity()).map((a) => a.action)).toEqual(["journey.restore", "person.role", "journey.publish"]);
    expect((await activity.listActivity({ person: "dana" })).map((a) => a.action)).toEqual(["journey.publish"]);
    expect((await activity.listActivity({ project: "bankworkx" })).length).toBe(2);
    expect((await activity.listActivity({ kind: "person" })).map((a) => a.target)).toEqual(["Riya"]);
    expect((await activity.listActivity({ before: "2026-01-01T11:30:00Z" })).length).toBe(2);
    expect((await activity.listActivity({ limit: 1 })).length).toBe(1);
  });
  it("keeps one entry per person, journey and ten minutes for draft saves", async () => {
    for (const t of ["10:00", "10:03", "10:09"]) await activity.record({ actor: dana, action: "journey.edit", target: "Invest", at: `2026-01-01T${t}:00Z` });
    await activity.record({ actor: dana, action: "journey.edit", target: "Invest", at: "2026-01-01T10:11:00Z" });
    await activity.record({ actor: sam, action: "journey.edit", target: "Invest", at: "2026-01-01T10:11:30Z" });
    expect((await activity.listActivity()).length).toBe(3);
  });
  it("never throws, and names a translated title by its English words", async () => {
    await expect(activity.record({ actor: dana, action: "x.y", target: "t" })).resolves.toBeUndefined();
    expect(activity.nameOf({ en: "Pay a bill", ur: "x" })).toBe("Pay a bill");
    expect(activity.nameOf("Plain")).toBe("Plain");
  });
});
