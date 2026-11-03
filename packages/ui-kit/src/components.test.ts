import { describe, expect, it } from "vitest";
import { componentCssVars, defaultComponentTokens, resolveComponentTokens } from "./components";

describe("component tokens", () => {
  it("falls back to the defaults", () => {
    expect(resolveComponentTokens()).toEqual(defaultComponentTokens);
  });
  it("applies a bank's overrides and ignores bad ones", () => {
    const t = resolveComponentTokens({ field: { height: 48 }, button: { radius: -3 }, bogus: { x: 1 } } as never);
    expect(t.field.height).toBe(48);
    expect(t.field.radius).toBe(defaultComponentTokens.field.radius);
    expect(t.button.radius).toBe(defaultComponentTokens.button.radius);
  });
  it("does not change the defaults", () => {
    resolveComponentTokens({ field: { height: 1 } });
    expect(defaultComponentTokens.field.height).toBe(52);
  });
  it("names the CSS variables by group and size", () => {
    const v = componentCssVars(defaultComponentTokens);
    expect(v["--fxc-field-height"]).toBe("52px");
    expect(v["--fxc-keypad-gap-x"]).toBe("14px");
  });
});
