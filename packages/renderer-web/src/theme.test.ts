import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { brands } from "@finx/ui-kit";
import { themeCss, themeVars } from "./theme";

describe("theme variables for one element", () => {
  it("gives the same variables as the stylesheet, per mode, so a preview can scope a bank to one box", () => {
    const light = themeVars(brands.bankworkx!, "light"), dark = themeVars(brands.bankworkx!, "dark");
    expect(light["--c-accent"]?.toLowerCase()).toBe("#3155ce");
    expect(light.colorScheme).toBe("light");
    expect(dark.colorScheme).toBe("dark");
    expect(dark["--c-bg"]).not.toBe(light["--c-bg"]);
    expect(Object.keys(light).some((k) => k.startsWith("--r-"))).toBe(true);
    for (const [k, v] of Object.entries(light).filter(([k]) => k.startsWith("--"))) expect(themeCss(brands.bankworkx!)).toContain(`${k}:${v};`);
  });
});

describe("theme stylesheet", () => {
  it("gives a bank its light and dark variables, scoped to its own pages", () => {
    const css = themeCss(brands.bankworkx!);
    expect(css).toContain(':root[data-brand="bankworkx"]{');
    expect(css).toContain('[data-mode="dark"]{');
    expect(css).toContain("@media (prefers-color-scheme:dark)");
    expect(css).toMatch(/--c-accent:#3155CE;/i);
    expect(css).toContain("--c-accent-on:");
    expect(css).toContain("--c-text-muted:");
    expect(css).toContain("--r-lg:");
    expect(css).not.toContain('data-brand="meezan"');
  });
  it("differs between banks and carries every colour the styles use", () => {
    const a = themeCss(brands.meezan!), b = themeCss(brands.bankworkx!);
    expect(a).not.toEqual(b);
    const used = new Set([...readFileSync(path.resolve(__dirname, "styles/renderer.css"), "utf8").matchAll(/var\((--(?:c|r)-[a-z0-9-]+)/g)].map((m) => m[1]!));
    for (const v of used) expect(a, v).toContain(`${v}:`);
  });
  it("refuses an unsafe brand id", () => {
    expect(() => themeCss({ ...brands.meezan!, id: 'x"]{}*{' })).toThrow(/Unsafe/);
  });
});

describe("right-to-left safety", () => {
  it("uses no physical left/right in the renderer styles", () => {
    const dir = path.resolve(__dirname, "styles");
    for (const f of readdirSync(dir)) {
      const css = readFileSync(path.join(dir, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      const hits = css.match(/(margin|padding|border)-(left|right)\b|(?:^|[\s;{])(left|right)\s*:|text-align:\s*(left|right)|border-(top|bottom)-(left|right)-radius|translateX\(-?\d+px\)(?![^}]*\[dir)/gm) ?? [];
      // the switch knob slides with translateX, mirrored for rtl by an explicit rule
      expect(hits.filter((h) => !/translateX/.test(h)), f).toEqual([]);
    }
  });
});
