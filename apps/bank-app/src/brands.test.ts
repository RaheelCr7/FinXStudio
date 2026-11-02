import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { brands } from "@finx/ui-kit";
import { brandConfig, brandIds } from "../scripts/lib/brands.mjs";

describe("brands", () => {
  it("lists the same banks in the build config and in the design system", () => {
    expect([...brandIds].sort()).toEqual(Object.keys(brands).sort());
  });
  it("gives each bank its own name, bundle id, scheme and icons", () => {
    const all = brandIds.map((id) => brandConfig(id));
    for (const k of ["name", "slug", "bundleId", "scheme", "assets"] as const) expect(new Set(all.map((b) => b[k])).size).toBe(all.length);
  });
  it("keeps Meezan's identity the same as the static app.json", () => {
    const expo = JSON.parse(readFileSync(new URL("../app.json", import.meta.url), "utf8")).expo;
    const m = brandConfig("meezan");
    expect([m.name, m.slug, m.bundleId, m.scheme]).toEqual([expo.name, expo.slug, expo.android.package, expo.scheme]);
    expect(expo.ios.bundleIdentifier).toBe(m.bundleId);
  });
  it("rejects an unknown brand with a helpful message", () => {
    expect(() => brandConfig("nope")).toThrow(/meezan, bankworkx/);
  });
  it("uses the brand accent colour for the app's accent", () => {
    for (const id of brandIds) expect(brands[id as keyof typeof brands].light.colors.accent!.toLowerCase()).toBe(brandConfig(id).accent.toLowerCase());
  });
});
