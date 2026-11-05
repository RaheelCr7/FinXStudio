import { afterEach, describe, expect, it, vi } from "vitest";

const load = async (env: Record<string, string>) => {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  const [brand, kit] = await Promise.all([import("./brand"), import("@finx/ui-kit")]);
  return { ...brand, brands: kit.brands, workspaceBrands: kit.workspaceBrands };
};
afterEach(() => vi.unstubAllEnvs());

describe("the brand the mobile app draws", () => {
  it("is the bank's own brand when no workspace is chosen", async () => {
    const m = await load({ EXPO_PUBLIC_FINX_BRAND: "bankworkx" });
    expect(m.WORKSPACE).toBeUndefined();
    expect(m.brandOf()).toBe(m.brands.bankworkx);
  });
  it("passes the resolved workspace brand object when the bank themed that workspace", async () => {
    const m = await load({ EXPO_PUBLIC_FINX_BRAND: "bankworkx", EXPO_PUBLIC_FINX_WORKSPACE: "business" });
    expect(m.WORKSPACE).toBe("business");
    expect(m.brandOf()).toBe(m.workspaceBrands.bankworkx!.business);
    expect(m.brandOf().workspace).toBe("business");
    expect(m.brandOf("personal")).toBe(m.workspaceBrands.bankworkx!.personal);
    // the shell still follows the bank, whatever look the workspace has
    expect(m.BRAND_INFO.preset).toBe("bankworkx");
  });
  it("keeps the bank's own brand for a bank that did not theme its workspaces, and ignores an unknown workspace", async () => {
    const m = await load({ EXPO_PUBLIC_FINX_BRAND: "meezan", EXPO_PUBLIC_FINX_WORKSPACE: "business" });
    expect(m.brandOf()).toBe(m.brands.meezan);
    const n = await load({ EXPO_PUBLIC_FINX_BRAND: "bankworkx", EXPO_PUBLIC_FINX_WORKSPACE: "admin" });
    expect(n.WORKSPACE).toBeUndefined();
  });
});

describe("deep links", () => {
  it("use the build's URL scheme, which the app config registers", async () => {
    const m = await load({ EXPO_PUBLIC_FINX_BRAND: "bankworkx" });
    expect(m.LINK_SCHEME).toBe("bankworkx");
    const { parseLink } = await import("@finx/bank-client");
    expect(parseLink("bankworkx://business/beta/approvals", m.LINK_SCHEME)).toEqual({ workspace: "business", companyId: "beta", tab: "approvals" });
    expect(parseLink("finx://business/beta/approvals", m.LINK_SCHEME)).toBeNull(); // another build's links are not ours
  });
});
