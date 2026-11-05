import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { brands, workspaceBrands } from "@finx/ui-kit";
import { themeCss } from "./theme";

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
  it("carries each bank's component sizes, following its corner radii unless it overrides them", () => {
    expect(themeCss(brands.cab!)).toContain("--fxc-button-height:56px;");
    expect(themeCss(brands.cab!)).toContain("--fxc-button-radius:12px;");
    expect(themeCss(brands.bankworkx!)).toContain("--fxc-field-radius:14px;");
    expect(themeCss(brands.meezan!)).toContain("--fxc-field-height:52px;");
  });
  it("scopes each workspace's look by data-workspace, after the bank's own, in light and dark", () => {
    const css = themeCss(brands.bankworkx!, workspaceBrands.bankworkx);
    const personal = ':root[data-brand="bankworkx"][data-workspace="personal"]', business = ':root[data-brand="bankworkx"][data-workspace="business"]';
    for (const root of [personal, business]) {
      expect(css).toContain(`${root}{`);
      expect(css).toContain(`${root}[data-mode="dark"]{`);
      expect(css).toContain(`${root}:not([data-mode="light"]){`);
    }
    // the same variables, with each workspace's own values
    const block = (root: string) => css.split("\n").find((l) => l.startsWith(`${root}{`))!;
    expect(block(personal)).toContain("--r-lg:24px;");
    expect(block(business)).toContain("--r-lg:8px;");
    expect(block(business)).toContain("--c-ink:#18211E;");
    expect(block(business)).toContain("--fxc-button-height:46px;");
    expect(block(personal)).toContain("--fxc-row-height:62px;");
    expect(css.indexOf(personal)).toBeGreaterThan(css.indexOf(':root[data-brand="bankworkx"]{'));
  });
  it("is unchanged for a bank without workspace looks", () => {
    expect(themeCss(brands.meezan!, workspaceBrands.meezan)).toBe(themeCss(brands.meezan!));
    expect(themeCss(brands.bankworkx!)).not.toContain("data-workspace");
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
