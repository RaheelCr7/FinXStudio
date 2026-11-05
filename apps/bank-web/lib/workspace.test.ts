import { describe, expect, it } from "vitest";
import { workspaceFromSearch } from "./workspace";

describe("workspace from the address", () => {
  it("reads personal and business, and nothing else", () => {
    expect(workspaceFromSearch("?workspace=business")).toBe("business");
    expect(workspaceFromSearch("?a=1&workspace=personal")).toBe("personal");
    for (const s of ["", "?workspace=", "?workspace=admin", "?workspace=Business", "?workspace=__proto__"]) expect(workspaceFromSearch(s), s).toBeUndefined();
  });
});
