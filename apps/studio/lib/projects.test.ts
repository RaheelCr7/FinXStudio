import { describe, it, expect, beforeEach } from "vitest";
import { copyFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

let projects: typeof import("./projects");
let store: typeof import("./store");
let file: string;
beforeEach(async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "finx-projects-"));
  file = path.join(dir, "brands.json");
  copyFileSync(path.resolve(__dirname, "../../../packages/ui-kit/src/brands.json"), file); // a copy, so the real file is never touched
  process.env.FINX_BRANDS_FILE = file;
  process.env.FINX_DATA_DIR = path.join(dir, "data");
  process.env.FINX_SKIP_ICONS = "1";
  projects = await import("./projects");
  store = await import("./store");
});

const good = { name: "Acme Bank", preset: "bankworkx", accent: "#7C3AED", currency: "USD" };

describe("projects", () => {
  it("lists the banks already in the file, the two original ones first, with their themes", async () => {
    const list = await projects.listProjects();
    expect(list.map((p) => p.id).slice(0, 2)).toEqual(["meezan", "bankworkx"]);
    expect(list.map((p) => p.id)).toEqual(Object.keys(JSON.parse(readFileSync(file, "utf8"))));
    expect(list[1]!.brand.light.colors.accent).toBe("#3155CE");
  });

  it("creates a project in the file the apps build from, with sensible defaults", async () => {
    const before = Object.keys(JSON.parse(readFileSync(file, "utf8")));
    const { project, iconsMade, iconWarning } = await projects.createProject(good);
    expect(project).toMatchObject({ id: "acme-bank", slug: "acme-bank", bundleId: "com.acmebank.app", scheme: "acmebank", preset: "bankworkx", accent: "#7C3AED", currency: "USD", locale: "en-US", assets: "./assets/acme-bank" });
    expect(iconsMade).toBe(false);
    expect(iconWarning).toMatch(/first time/);
    const saved = JSON.parse(readFileSync(file, "utf8"));
    expect(Object.keys(saved)).toEqual([...before, "acme-bank"]);
    expect(saved["meezan"].name).toBe("Meezan Digital"); // existing banks untouched
    expect((await projects.getProject("acme-bank"))!.brand.light.colors.accent).toBe("#7C3AED");
  });

  it("refuses names, ids, colours and currencies that would not work", async () => {
    await expect(projects.createProject({ ...good, name: "A" })).rejects.toMatchObject({ status: 400 });
    await expect(projects.createProject({ ...good, name: "!!!" })).rejects.toMatchObject({ status: 400 });
    await expect(projects.createProject({ ...good, name: "All" })).rejects.toMatchObject({ status: 400 });
    await expect(projects.createProject({ ...good, bundleId: "Bad Id" })).rejects.toMatchObject({ status: 400 });
    await expect(projects.createProject({ ...good, accent: "#FFD700" })).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/too light/) });
    await expect(projects.createProject({ ...good, preset: "wild" })).rejects.toMatchObject({ status: 400 });
    await expect(projects.createProject({ ...good, currency: "XXX" })).rejects.toMatchObject({ status: 400 });
  });

  it("refuses duplicates: same name or same app id", async () => {
    await projects.createProject(good);
    await expect(projects.createProject(good)).rejects.toMatchObject({ status: 409 });
    await expect(projects.createProject({ ...good, name: "Other Bank", bundleId: "com.acmebank.app" })).rejects.toMatchObject({ status: 409 });
    await expect(projects.createProject({ ...good, name: "BankWorkx" })).rejects.toMatchObject({ status: 409 });
  });

  it("suggests an app id and a slug from the name", () => {
    expect(projects.suggestBundleId("Café del Mar!")).toBe("com.cafedelmar.app");
    expect(projects.slugOf("  Hello   World  ")).toBe("hello-world");
  });

  it("a new project can start from copies of another bank's journeys, which are published and belong only to it", async () => {
    await projects.createProject(good);
    const copy = await store.cloneJourney("fund-transfer-local", "acme-bank", { publishNow: true });
    expect(copy.slug).toBe("fund-transfer-local-acme-bank");
    expect(copy.published!.apps).toEqual(["acme-bank"]);
    expect(copy.history[0]!.by).toBe("new project");
    expect((await store.getRecord("fund-transfer-local")).published!.apps).toBeUndefined(); // the original is unchanged
    await expect(store.cloneJourney("fund-transfer-local", "acme-bank")).rejects.toMatchObject({ status: 409 });
    await expect(store.cloneJourney("fund-transfer-local", "nobody")).rejects.toMatchObject({ status: 400 });
  });

  it("changes a project's colour in the file, remembers the old one, and refuses a pale colour", async () => {
    const out = await projects.updateProjectAccent("bankworkx", "#7c3aed");
    expect(out).toMatchObject({ previous: "#3155CE", project: { accent: "#7C3AED" } });
    expect(JSON.parse(readFileSync(file, "utf8")).bankworkx.accent).toBe("#7C3AED");
    expect((await projects.getProject("bankworkx"))!.brand.light.colors.accent).toBe("#7C3AED");
    await expect(projects.updateProjectAccent("bankworkx", "#FFEE99")).rejects.toMatchObject({ status: 400 });
    await expect(projects.updateProjectAccent("nobank", "#7C3AED")).rejects.toMatchObject({ status: 404 });
  });
});
