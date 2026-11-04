import { describe, it, expect } from "vitest";
import { BUILTIN_ROLES } from "./roles";
import { avatarTone, effectiveActions, initials, recentBy, roleHeld, summarise } from "./people-view";

const dana = { id: "dana", name: "Dana Lee", role: "designer", access: { meezan: "reviewer" } };
const alex = { id: "alex", name: "Alex Morgan", role: "admin" };
const sam = { id: "sam", name: "Sam Keller", role: "developer" };
const projects = [{ id: "meezan" }, { id: "bankworkx" }];

describe("people view helpers", () => {
  it("makes initials and a steady avatar colour", () => {
    expect(initials("Alex Morgan")).toBe("AM");
    expect(initials("  cher ")).toBe("C");
    expect(initials("")).toBe("?");
    expect(avatarTone("dana")).toBe(avatarTone("dana"));
    expect(avatarTone("dana")).toBeGreaterThanOrEqual(0);
    expect(avatarTone("dana")).toBeLessThan(6);
  });
  it("works out what someone can do in each project", () => {
    expect(effectiveActions(dana, "meezan", BUILTIN_ROLES)).toEqual(["publish", "projects"]);
    expect(effectiveActions(dana, "bankworkx", BUILTIN_ROLES)).toEqual(["edit", "projects"]);
    expect(effectiveActions(dana, undefined, BUILTIN_ROLES)).toEqual(["edit", "projects"]);
  });
  it("says which role someone holds in a project and whether it is special", () => {
    expect(roleHeld(dana, "meezan")).toEqual({ role: "reviewer", special: true });
    expect(roleHeld(dana, "bankworkx")).toEqual({ role: "designer", special: false });
  });
  it("counts people, who can publish, who manage people, and who has project-specific access", () => {
    expect(summarise([alex, dana, sam], projects, BUILTIN_ROLES)).toEqual({ people: 3, publishers: 2, managers: 1, special: 1 });
    expect(summarise([], projects, BUILTIN_ROLES)).toEqual({ people: 0, publishers: 0, managers: 0, special: 0 });
  });
  it("takes the newest entries by one person", () => {
    const log = [{ id: "3", actor: { id: "sam" } }, { id: "2", actor: { id: "dana" } }, { id: "1", actor: { id: "dana" } }] as any;
    expect(recentBy("dana", log).map((a) => a.id)).toEqual(["2", "1"]);
    expect(recentBy("dana", log, 1).length).toBe(1);
  });
});
