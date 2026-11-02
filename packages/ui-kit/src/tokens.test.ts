import { describe, it, expect } from "vitest";
import { themes, brands, contrast, toCssVars, formatMoney } from "./index";

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
