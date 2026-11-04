import { describe, expect, it } from "vitest";
import { menuFor, workspaceOf, type SessionContext } from "./session";

const biz = (permissions: string[]): SessionContext => ({ id: "x", kind: "business", name: "X", permissions });

describe("menus from permissions", () => {
  it("shows Approvals only to someone who can approve, with the waiting count", () => {
    expect(menuFor(biz(["accounts.view", "pay.create"])).map((m) => m.id)).toEqual(["overview", "accounts", "payments", "more"]);
    expect(menuFor(biz(["accounts.view", "pay.approve"]), 2).find((m) => m.id === "approvals")).toEqual({ id: "approvals", label: "Approvals", badge: 2 });
  });
  it("keeps personal and business apart", () => {
    expect(workspaceOf({ id: "personal", kind: "personal", name: "P", permissions: [] })).toBe("personal");
    expect(workspaceOf(biz([]))).toBe("business");
    expect(menuFor(undefined).map((m) => m.id)).toContain("home");
  });
});
