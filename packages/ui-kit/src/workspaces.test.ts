import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { brandDefs, brandFor, brands, contrast, resolveBrand, resolveWorkspaces, workspaceBrands, type BrandDef } from "./tokens";
import { checkWorkspaceTheme, readWorkspaces } from "./workspaces";
import { workspaceLookReport } from "./looks";
import { resolveComponentTokens } from "./components";

const bw = brandDefs.bankworkx!;
const aurora = resolveBrand("bankworkx", bw, "personal");
const graphite = resolveBrand("bankworkx", bw, "business");

describe("workspace themes as data", () => {
  it("gives BankWorkx an Aurora personal look and a Graphite business look in brands.json", () => {
    expect(bw.workspaces?.personal?.name).toBe("Aurora");
    expect(bw.workspaces?.business?.name).toBe("Graphite");
    expect(aurora.workspace).toBe("personal");
    expect(graphite.workspace).toBe("business");
  });
  it("makes Aurora blue, white, round and airy, and Graphite green, charcoal, square and dense", () => {
    // the accent is nudged a little where it must read on its own soft fill, so it stays the same blue rather than the same bytes
    expect(aurora.light.colors.heroFrom).toBe("#2F5BFF");
    expect(contrast(aurora.light.colors.accent!, "#2F5BFF")).toBeLessThan(1.2);
    expect(aurora.preset).toBe("bankworkx");
    expect(graphite.light.colors.accent).toBe("#0B7350");
    expect(graphite.light.colors.ink).toBe("#18211E");
    expect(graphite.light.colors.heroFrom).toBe("#18211E");
    expect(aurora.radius.lg).toBeGreaterThan(graphite.radius.lg);
    const a = resolveComponentTokens(aurora.components, aurora.radius), g = resolveComponentTokens(graphite.components, graphite.radius);
    expect(a.row.height).toBeGreaterThan(g.row.height);
    expect(a.button.height).toBeGreaterThan(g.button.height);
    expect(graphite.look?.fields).toBe("outlined");
    expect(aurora.mode).toBe("light");
  });
  it("uses a workspace's page colour as its light canvas, with muted text still readable on it, and leaves the bank's own canvas alone", () => {
    expect(aurora.light.colors.bg).toBe("#F3F6FF");
    expect(graphite.light.colors.bg).toBe("#EDF0EE");
    expect(aurora.dark.colors.bg).toBe(brands.bankworkx!.dark.colors.bg);
    for (const b of [aurora, graphite]) {
      const c = b.light.colors;
      expect(contrast(c.textMuted!, c.surfaceMuted!), `${b.light.name} muted on muted fill`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.textMuted!, c.bg!), `${b.light.name} muted on page`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.text!, c.surfaceMuted!)).toBeGreaterThanOrEqual(4.5);
    }
    expect(brands.cab!.light.colors.bg).toBe(resolveBrand("cab", brandDefs.cab!).light.colors.bg);
    expect(brands.bankworkx!.light.colors.bg).toBe("#F6F4FC");
  });
  it("leaves the bank's own brand alone", () => {
    expect(brands.bankworkx!.light.colors.accent).toBe("#3155CE");
    expect(brands.bankworkx!.workspace).toBeUndefined();
    expect(resolveBrand("bankworkx", bw)).toEqual(brands.bankworkx);
  });
  it("names each look's themes apart, in both modes", () => {
    expect(aurora.light.name).toBe("bankworkx-personal-light");
    expect(graphite.dark.name).toBe("bankworkx-business-dark");
  });
  it("keeps every workspace look readable in light and dark", () => {
    for (const b of [aurora, graphite]) for (const t of [b.light, b.dark]) {
      const c = t.colors;
      expect(contrast(c.text!, c.bg!), `${t.name} text`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.textMuted!, c.surface!), `${t.name} muted`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.accentOn!, c.accent!), `${t.name} button`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.accent!, c.surface!), `${t.name} accent on surface`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.accent!, c.accentSoft!), `${t.name} accent on soft`).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("passes the look report (contrast and tap targets) for both workspaces", () => {
    for (const w of ["personal", "business"] as const) {
      const failing = workspaceLookReport(bw, w).filter((c) => !c.ok);
      expect(failing, w).toEqual([]);
    }
    expect(workspaceLookReport(bw, "business").map((c) => c.id)).toContain("hero");
  });
  it("fails the report for a workspace look that is too light or too small", () => {
    const bad: BrandDef = { ...bw, workspaces: { business: { accent: "#0B7350", look: { hero: { from: "#18211E", to: "#9FD8C0" } }, components: { button: { height: 40 } } } } };
    const failing = workspaceLookReport(bad, "business").filter((c) => !c.ok).map((c) => c.id);
    expect(failing).toEqual(expect.arrayContaining(["hero", "target"]));
  });
});

describe("resolving a workspace", () => {
  it("follows the bank's own look wherever the workspace sets nothing, and replaces it where it does", () => {
    const def: BrandDef = { ...bw, accent: "#1D4ED8", radius: { md: 20 }, workspaces: { business: { accent: "#0B7350" }, personal: { radius: { md: 4 } } } };
    const business = resolveBrand("x", def, "business");
    expect(business.radius.md).toBe(20);
    expect(business.light.colors.accent).toBe("#0B7350");
    const personal = resolveBrand("x", def, "personal");
    expect(personal.radius.md).toBe(4);
    expect(personal.light.colors.accent).toBe("#1D4ED8");
  });
  it("uses the bank's brand for a workspace the bank did not theme", () => {
    const def: BrandDef = { ...bw, workspaces: { personal: { accent: "#0B7350" } } };
    expect(resolveBrand("x", def, "business").light.colors.accent).toBe(resolveBrand("x", { ...def, workspaces: undefined }).light.colors.accent);
    expect(Object.keys(resolveWorkspaces("x", def))).toEqual(["personal"]);
    expect(resolveWorkspaces("meezan", brandDefs.meezan!)).toEqual({});
  });
  it("hands out the workspace brand by bank id, with fallbacks", () => {
    expect(brandFor("bankworkx", "business")).toBe(workspaceBrands.bankworkx!.business);
    expect(brandFor("bankworkx")).toBe(brands.bankworkx);
    expect(brandFor("meezan", "business")).toBe(brands.meezan);
    expect(brandFor("nobody", "personal")).toBe(brands.meezan);
  });
});

describe("workspace themes from outside the code", () => {
  it("accepts the shipped looks unchanged", () => {
    for (const w of ["personal", "business"] as const) expect(checkWorkspaceTheme(bw.workspaces![w])).toEqual({ ok: true, theme: bw.workspaces![w] });
  });
  it("reports every problem at once", () => {
    const r = checkWorkspaceTheme({ accent: "#FFD700", preset: "nope", mode: "blue", look: { bar: "red" }, radius: { md: 400 }, components: { button: { height: -1 } } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toHaveLength(6);
  });
  it("carries nothing it does not know, such as a logo or a font", () => {
    const r = checkWorkspaceTheme({ look: { chrome: "bar", logo: "data:image/svg+xml,<svg/>", font: "x" }, extra: 1, components: { nothing: { height: 3 } } });
    expect(r).toEqual({ ok: true, theme: { look: { chrome: "bar" } } });
  });
  it("keeps the valid workspaces and drops the rest", () => {
    expect(readWorkspaces({ personal: { accent: "#2F5BFF" }, business: { accent: "yellow" }, other: { accent: "#2F5BFF" } })).toEqual({ personal: { accent: "#2F5BFF" } });
    expect(readWorkspaces({ business: 3 })).toBeUndefined();
    expect(readWorkspaces(undefined)).toBeUndefined();
  });
});

describe("the apps draw a workspace from data", () => {
  it("never names a look in the components or screens", () => {
    const root = path.resolve(__dirname, "../../..");
    const dirs = ["apps/bank-app/src", "apps/bank-web/components", "apps/bank-web/app", "packages/renderer-web/src", "packages/renderer-native/src", "packages/components/src", "packages/bank-client/src"];
    const files = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = path.join(d, f); return statSync(p).isDirectory() ? files(p) : /\.(tsx?|css)$/.test(f) && !/\.test\./.test(f) ? [p] : []; });
    for (const d of dirs) for (const f of files(path.join(root, d))) expect(readFileSync(f, "utf8"), f).not.toMatch(/Aurora|Graphite/);
  });
});
