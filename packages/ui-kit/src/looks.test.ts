import { describe, expect, it } from "vitest";
import { accentProblem, brandDefs, resolveBrand, PRESETS, type BrandDef } from "./tokens";
import { LOOKS, applyLook, lookById, lookReport, moodTokens } from "./looks";
import { resolveComponentTokens } from "./components";

const base = brandDefs.meezan!;
const defOf = (id: string): BrandDef => ({ ...base, ...applyLook(lookById(id)!) });

describe("look library", () => {
  it("has unique ids, a real preset and a readable accent for every look", () => {
    expect(new Set(LOOKS.map((l) => l.id)).size).toBe(LOOKS.length);
    for (const l of LOOKS) {
      expect(l.preset in PRESETS, l.id).toBe(true);
      expect(accentProblem(l.accent), l.id).toBeNull();
    }
  });
  it("applies to a project: radii and sizes reach the resolved brand", () => {
    const b = resolveBrand("x", defOf("corporate"));
    expect(b.radius.md).toBe(6);
    expect(resolveComponentTokens(b.components, b.radius).button.height).toBe(46);
    expect(b.look?.chrome).toBe("bar");
    expect(resolveBrand("y", defOf("classic")).radius.md).toBe(12);
  });
  it("gives the lifestyle look full-round buttons and passes every check", () => {
    const def = defOf("lifestyle"), b = resolveBrand("z", def);
    const button = resolveComponentTokens(b.components, b.radius).button;
    expect(button.radius * 2).toBe(button.height);
    expect(lookReport(def).filter((c) => !c.ok)).toEqual([]);
  });
  it("leaves a plain look plain", () => {
    expect(applyLook(lookById("classic")!)).toEqual({ preset: "meezan", accent: "#0F6E56" });
  });
});

describe("mood sliders", () => {
  it("rounder means bigger radii, and radii keep their order", () => {
    const a = moodTokens(4, 50).radius, b = moodTokens(24, 50).radius;
    expect(b.md).toBeGreaterThan(a.md!);
    expect(a.sm! <= a.md! && a.md! <= a.lg! && a.lg! <= a.xl!).toBe(true);
  });
  it("more comfortable means taller targets, and out-of-range values are clamped", () => {
    const c = moodTokens(12, 0).components, d = moodTokens(12, 100).components;
    expect(d.button!.height).toBeGreaterThan(c.button!.height!);
    expect(moodTokens(999, 999).radius.md).toBe(28);
    expect(moodTokens(-5, -5).components.field!.height).toBe(44);
  });
});

describe("look report", () => {
  it("passes the high contrast look completely", () => {
    const r = lookReport(defOf("contrast"));
    expect(r.filter((c) => !c.ok), JSON.stringify(r.filter((c) => !c.ok))).toEqual([]);
  });
  it("flags small targets, with what to do", () => {
    const r = lookReport({ ...base, components: { button: { height: 36 } } });
    expect(r.filter((c) => !c.ok).map((c) => c.id)).toEqual(["target"]);
    expect(r.find((c) => c.id === "target")!.fix).toMatch(/44px/);
  });
  it("reads the bar colour when the look has a bar", () => {
    const light = lookReport({ ...base, look: { chrome: "bar", bar: "#F5D000" } });
    expect(light.find((c) => c.id === "button")!.ok).toBe(false);
  });
});

describe("workspace themes", () => {
  const bw = brandDefs.bankworkx!;
  it("gives personal and business their own look and leaves the bank's own alone", () => {
    const p = resolveBrand("bankworkx", bw, "personal"), b = resolveBrand("bankworkx", bw, "business");
    expect(p.preset).toBe("bankworkx");
    expect(b.preset).toBe("meezan");
    expect(b.look?.chrome).toBe("bar");
    expect(b.radius.md).toBeLessThan(p.radius.md);
    expect(resolveBrand("bankworkx", bw).radius.md).toBe(14);
    expect(resolveBrand("bankworkx", bw, undefined).look).toBeUndefined();
  });
  it("passes the contrast and tap-target checks in both workspaces", () => {
    for (const ws of ["personal", "business"] as const) {
      const def = { ...bw, ...bw.workspaces![ws]! } as BrandDef;
      expect(lookReport(def).filter((c) => !c.ok), ws).toEqual([]);
    }
  });
  it("uses the bank's look when a workspace has no theme", () => {
    expect(resolveBrand("meezan", brandDefs.meezan!, "business")).toEqual(resolveBrand("meezan", brandDefs.meezan!));
  });
});
