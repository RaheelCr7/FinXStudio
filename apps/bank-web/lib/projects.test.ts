import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultProjectId, getProject, listProjects, readProject, resetProjectsCache } from "./projects";
import { safeNext } from "./safe-next";

const studio = (body: unknown, ok = true) => vi.stubGlobal("fetch", vi.fn(async () => ({ ok, json: async () => body })));
const acme = { id: "acme-bank", name: "Acme Bank", shortName: "Acme", slug: "acme-bank", bundleId: "com.acmebank.app", scheme: "acmebank", preset: "bankworkx", accent: "#7C3AED", currency: "USD", locale: "en-US", assets: "./assets/acme-bank", background: "#F6F4FC", splashDark: "#0D1022" };

describe("projects", () => {
  beforeEach(() => { resetProjectsCache(); });
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.FINX_WEB_DEFAULT_PROJECT; delete process.env.FINX_STUDIO_URL; });

  it("serves the projects of Studio, so one added there appears without a new build, with its own look and screens", async () => {
    studio({ projects: [{ ...acme }, { ...acme, id: "plain", name: "Plain Bank", preset: "meezan", accent: "#0F6E56" }] });
    const p = await listProjects();
    expect(p.map((x) => [x.id, x.shell, x.def.currency])).toEqual([["acme-bank", "bankworkx", "USD"], ["plain", "meezan", "USD"]]);
    expect(p[0]!.brand.light.colors.accent).toBe("#7C3AED");
    expect((await getProject("acme-bank"))!.def.name).toBe("Acme Bank");
  });

  it("falls back to the bundled banks when Studio is down, answers badly, or lists nothing usable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    expect((await listProjects()).map((x) => x.id)).toEqual(["meezan", "bankworkx", "cab"]);
    resetProjectsCache(); studio({ projects: [{ id: "x" }] });
    expect((await listProjects()).map((x) => x.id)).toEqual(["meezan", "bankworkx", "cab"]);
    resetProjectsCache(); studio("nonsense");
    expect((await listProjects()).map((x) => x.id)).toEqual(["meezan", "bankworkx", "cab"]);
  });

  it("remembers the answer for a short while", async () => {
    studio({ projects: [acme] });
    await listProjects(); await listProjects();
    expect((fetch as any).mock.calls.length).toBe(1);
  });

  it("takes only plain, valid fields from Studio, and ignores anything that could carry styles or scripts", () => {
    expect(readProject({ ...acme, brand: { light: { colors: { accent: "red;}</style><script>" } } } })!.brand.light.colors.accent).toBe("#7C3AED");
    for (const bad of [{ ...acme, id: "Bad Id" }, { ...acme, id: "api" }, { ...acme, id: "x\"]{}" }, { ...acme, accent: "red" }, { ...acme, accent: "#FFEE99" }, { ...acme, preset: "constructor" }, { ...acme, name: "" }, { ...acme, currency: "dollars" }, null, "x", 5]) {
      expect(readProject(bad), JSON.stringify(bad)).toBeNull();
    }
    expect(readProject({ ...acme, background: "javascript:1" })!.def.background).toBe("#F6F7F9");
  });

  it("does not know other names, including the ones the app itself uses", async () => {
    studio({ projects: [acme] });
    for (const id of ["nobank", "api", "theme", "_next", "constructor", "__proto__", "Acme-Bank", "acme bank"]) expect(await getProject(id), id).toBeUndefined();
  });

  it("serves the default project: the first one unless the environment names a known one", async () => {
    studio({ projects: [acme, { ...acme, id: "second" }] });
    expect(await defaultProjectId()).toBe("acme-bank");
    process.env.FINX_WEB_DEFAULT_PROJECT = "second"; expect(await defaultProjectId()).toBe("second");
    process.env.FINX_WEB_DEFAULT_PROJECT = "nobank"; expect(await defaultProjectId()).toBe("acme-bank");
  });
});

describe("where to go after signing in", () => {
  it("follows addresses inside the bank, and nothing else", () => {
    expect(safeNext("/meezan/j/pay-a-bill", "meezan", "/meezan/home")).toBe("/meezan/j/pay-a-bill");
    for (const bad of [null, "", "https://evil.example/", "//evil.example/meezan/x", "/bankworkx/dashboard", "/meezan/\\evil", "javascript:alert(1)", "/meezan/x\nSet-Cookie: a=b"]) expect(safeNext(bad, "meezan", "/meezan/home"), String(bad)).toBe("/meezan/home");
  });
});
