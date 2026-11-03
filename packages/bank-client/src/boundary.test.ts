import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * The sharing rule: logic lives in platform-neutral packages, presentation in the platform ones.
 * These tests fail when a shared package reaches for react-native, the DOM or a framework, or when one renderer reaches into the other.
 */
const root = path.resolve(__dirname, "../../..");
const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = path.join(dir, f);
  if (f === "node_modules") return [];
  return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f) && !/\.d\.ts$/.test(f) ? [p] : [];
});
const imports = (src: string) => [...src.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]!);
/** Source with comments and string contents removed, so a word in a comment is not a use. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1").replace(/`(?:[^`\\]|\\.)*`|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, '""');

const SHARED = ["bank-client", "renderer-core", "journey-schema", "ui-kit", "mock-bank-api"];
const PLATFORM_IMPORTS = /^(react-native|react-dom|next|expo|@expo|@react-native|react-native-svg|react-native-web)(\/|$)/;
const BROWSER_GLOBALS = /\b(window|document|localStorage|sessionStorage|navigator)\b/;

describe("shared packages stay platform-neutral", () => {
  for (const pkg of SHARED) {
    it(`${pkg} imports no react-native, react-dom or framework, and uses no browser globals`, () => {
      const problems: string[] = [];
      for (const f of files(path.join(root, "packages", pkg, "src"))) {
        const src = readFileSync(f, "utf8");
        for (const i of imports(src)) if (PLATFORM_IMPORTS.test(i)) problems.push(`${path.relative(root, f)} imports ${i}`);
        const hit = code(src).match(BROWSER_GLOBALS);
        if (hit) problems.push(`${path.relative(root, f)} uses ${hit[1]}`);
      }
      expect(problems).toEqual([]);
    });
  }

  it("shared packages do not import the platform renderers or the apps", () => {
    const problems: string[] = [];
    for (const pkg of SHARED) for (const f of files(path.join(root, "packages", pkg, "src"))) {
      for (const i of imports(readFileSync(f, "utf8"))) if (/^@finx\/(renderer-native|renderer-web)/.test(i) || /apps\//.test(i)) problems.push(`${pkg}: ${path.relative(root, f)} imports ${i}`);
    }
    expect(problems).toEqual([]);
  });

  it("the native renderer does not use the DOM, and the web renderer does not use react-native", () => {
    const problems: string[] = [];
    const scan = (pkg: string, forbidden: RegExp) => {
      const dir = path.join(root, "packages", pkg, "src");
      try { statSync(dir); } catch { return; } // the web renderer does not exist yet in early phases
      for (const f of files(dir)) for (const i of imports(readFileSync(f, "utf8"))) if (forbidden.test(i)) problems.push(`${pkg}: ${path.relative(root, f)} imports ${i}`);
    };
    scan("renderer-native", /^react-dom(\/|$)/);
    scan("renderer-web", /^(react-native|react-native-svg|react-native-web)(\/|$)/);
    expect(problems).toEqual([]);
  });
});
