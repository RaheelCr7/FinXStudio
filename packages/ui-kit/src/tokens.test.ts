import { describe, it, expect } from "vitest";
import { themes, brands, brandDefs, resolveBrand, accentProblem, contrast, toCssVars, formatMoney, type BrandDef } from "./index";

describe("FDS tokens", () => {
  const all = [...Object.entries(themes), ...Object.values(brands).flatMap((b) => [[`${b.id}-light`, b.light], [`${b.id}-dark`, b.dark]] as const)];
  for (const [name, t] of all) {
    it(`${name}: body text and muted text meet WCAG AA on surface and bg`, () => {
      expect(contrast(t.colors.text!, t.colors.surface!)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.colors.text!, t.colors.bg!)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.colors.textMuted!, t.colors.surface!)).toBeGreaterThanOrEqual(4.5);
    });
    it(`${name}: accent button label is readable`, () => {
      expect(contrast(t.colors.accentOn!, t.colors.accent!)).toBeGreaterThanOrEqual(4.5);
    });
    it(`${name}: semantic colours are readable on their tinted backgrounds`, () => {
      for (const k of ["positive", "negative", "warning", "info"]) expect(contrast(t.colors[k]!, t.colors[`${k}Bg`]!)).toBeGreaterThanOrEqual(4.5);
    });
  }
  it("emits CSS variables", () => {
    expect(toCssVars(themes.meezanLight)).toContain("--fds-accent-soft:#E1F5EE;");
  });
  it("formats money", () => {
    expect(formatMoney(184250)).toBe("PKR 184,250");
  });
});

describe("brands from brands.json", () => {
  it("keeps the two original banks exactly as designed", () => {
    expect(brands.meezan!.light.colors).toMatchObject({ accent: "#0F6E56", accentSoft: "#E1F5EE" });
    expect(brands.bankworkx!.light.colors).toMatchObject({ accent: "#3155CE", heroFrom: "#2B88DA" });
  });
  it("derives an accessible theme from any dark enough accent, in both modes, for both presets", () => {
    for (const preset of ["meezan", "bankworkx"] as const) for (const accent of ["#8A2BE2", "#E11D48", "#0F766E", "#B45309", "#1D4ED8"]) {
      const def: BrandDef = { ...brandDefs[preset]!, accent };
      const b = resolveBrand("t", def);
      for (const t of [b.light, b.dark]) {
        const c = t.colors;
        expect(contrast(c.accentOn!, c.accent!), `${preset} ${accent} ${t.name} button label`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(c.accent!, c.surface!), `${preset} ${accent} ${t.name} accent on surface`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(c.accent!, c.accentSoft!), `${preset} ${accent} ${t.name} accent on its soft fill`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  it("asks for a darker colour when white text would not be readable", () => {
    expect(accentProblem("#3155CE")).toBeNull();
    expect(accentProblem("#FFD700")).toMatch(/too light/);
    expect(accentProblem("blue")).toMatch(/#3155CE/);
  });
});

