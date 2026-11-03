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

  it("stores only the component sizes that differ from the defaults, and can clear them", async () => {
    const r = await projects.updateProjectComponents("meezan", { field: { height: 48, radius: 12 }, button: { height: 54 } });
    expect(r.project.components).toEqual({ field: { height: 48 } });
    expect(JSON.parse(readFileSync(file, "utf8")).meezan.components).toEqual({ field: { height: 48 } });
    const cleared = await projects.updateProjectComponents("meezan", { field: { height: 52 } });
    expect(cleared.previous).toEqual({ field: { height: 48 } });
    expect(JSON.parse(readFileSync(file, "utf8")).meezan.components).toBeUndefined();
  });

  it("refuses bad component sizes and unknown projects", async () => {
    await expect(projects.updateProjectComponents("meezan", { field: { height: -1 } })).rejects.toThrow(/0 to 200/);
    await expect(projects.updateProjectComponents("meezan", { field: { height: "big" } })).rejects.toThrow(/0 to 200/);
    await expect(projects.updateProjectComponents("meezan", null)).rejects.toThrow(/object/);
    await expect(projects.updateProjectComponents("nope", {})).rejects.toThrow(/No project/);
  });

  it("reports an existing project's shape without changing the file", async () => {
    const before = readFileSync(file, "utf8");
    const shape = await projects.getProjectShape("cab");
    expect(shape.entities.map((e) => e.country)).toEqual(["JO"]);
    expect(shape.languages).toEqual(["en", "ar"]);
    expect(readFileSync(file, "utf8")).toBe(before);
  });

  it("saves a two-entity group with a custom language, and returns the previous shape", async () => {
    const r = await projects.updateProjectShape("cab", {
      customLanguages: [{ code: "ku", name: "Kurdish", dir: "rtl" }], languages: ["en", "ar", "ku"], channels: ["web", "mobile", "tablet"],
      entities: [{ id: "jo", name: "CAB Jordan", country: "JO", currency: "JOD", languages: ["en", "ar"] }, { id: "eg", name: "CAB Egypt", country: "EG", currency: "EGP", languages: ["ar", "ku"] }],
    });
    expect(r.previous.entities).toHaveLength(1);
    const saved = JSON.parse(readFileSync(file, "utf8")).cab;
    expect(saved.entities.map((e: { id: string }) => e.id)).toEqual(["jo", "eg"]);
    expect(saved.customLanguages[0].code).toBe("ku");
    expect(saved.channels).toContain("tablet");
    expect(saved.accent).toBe("#00853E"); // the rest of the project is untouched
  });

  it("refuses bad shapes with every problem named, and an entity using a language the project does not offer", async () => {
    await expect(projects.updateProjectShape("cab", { channels: ["tablet"], entities: [] })).rejects.toThrow(/Choose web or mobile.*at least one entity/);
    await expect(projects.updateProjectShape("cab", { languages: ["en"], entities: [{ id: "jo", name: "CAB Jordan", country: "JO", currency: "JOD", languages: ["ar"] }] })).rejects.toThrow(/does not offer/);
    await expect(projects.updateProjectShape("nope", {})).rejects.toThrow(/No project/);
  });

  it("offers a project's currencies: base first, a custom one added, the base changed, undo with the previous shape", async () => {
    const before = await projects.getProjectShape("cab");
    expect(before.baseCurrency).toBe("JOD");
    expect(before.currencies).toEqual(["JOD"]);
    const r = await projects.updateProjectShape("cab", { currencies: ["USD", "JOD", "EUR"], customCurrencies: [{ code: "GLD", name: "Gold coin", symbol: "◎", decimals: 3 }] });
    expect(r.shape.currencies).toEqual(["JOD", "USD", "EUR"]); // base first
    expect(r.shape.customCurrencies).toEqual([{ code: "GLD", name: "Gold coin", symbol: "◎", decimals: 3, custom: true }]);
    const saved = JSON.parse(readFileSync(file, "utf8")).cab;
    expect(saved.currency).toBe("JOD");
    expect(saved.currencies).toEqual(["JOD", "USD", "EUR"]);
    await projects.updateProjectShape("cab", { currencies: ["JOD", "USD", "EUR", "GLD"], baseCurrency: "USD" });
    const moved = await projects.getProjectShape("cab");
    expect(moved.baseCurrency).toBe("USD");
    expect(moved.currencies[0]).toBe("USD");
    expect((await projects.getProject("cab"))!.currency).toBe("USD");
    await projects.updateProjectShape("cab", r.previous); // undo
    const undone = await projects.getProjectShape("cab");
    expect(undone.currencies).toEqual(["JOD"]);
    expect(undone.customCurrencies).toEqual([]);
  });

  it("refuses currency changes that would break the project", async () => {
    expect((await projects.updateProjectShape("cab", { currencies: ["USD"] })).shape.currencies).toEqual(["JOD", "USD"]); // the base currency is always offered
    await expect(projects.updateProjectShape("cab", { currencies: ["JOD"], entities: [{ id: "eu", name: "CAB Europe", country: "JO", currency: "EUR", languages: ["en"] }] })).rejects.toThrow(/EUR is the base currency or used by an entity/);
    await expect(projects.updateProjectShape("cab", { currencies: ["JOD", "ZZZ"] })).rejects.toThrow(/Unknown currency: ZZZ/);
    await expect(projects.updateProjectShape("cab", { baseCurrency: "EUR" })).rejects.toThrow(/Add it to the currencies first|base currency/);
    await expect(projects.updateProjectShape("cab", { customCurrencies: [{ code: "USD", name: "Dollar", symbol: "$", decimals: 2 }] })).rejects.toThrow(/already built in/);
    await projects.updateProjectShape("cab", { currencies: ["JOD", "GLD"], customCurrencies: [{ code: "GLD", name: "Gold coin", symbol: "◎", decimals: 3 }] });
    await expect(projects.updateProjectShape("cab", { customCurrencies: [] })).rejects.toThrow(/GLD.*no longer defined/);
  });

  it("creates a project from a country, a library look and the sliders, with the shape filled in", async () => {
    const { project } = await projects.createProject({ name: "Levant Bank", preset: "meezan", accent: "#0B5D4B", currency: "", country: "JO", look: "corporate", radius: { md: 9 }, components: { field: { height: 48 } } });
    const saved = JSON.parse(readFileSync(file, "utf8"))["levant-bank"];
    expect(saved.currency).toBe("JOD");
    expect(saved.locale).toBe("en-JO");
    expect(saved.look.chrome).toBe("bar");
    expect(saved.radius.md).toBe(9);
    expect(saved.components.field.height).toBe(48);
    expect(saved.components.button.height).toBe(46);
    expect(saved.languages).toEqual(["en", "ar"]);
    expect(saved.entities).toEqual([{ id: "main", name: "Levant Bank", country: "JO", currency: "JOD", languages: ["en", "ar"] }]);
    expect(project.brand.radius.md).toBe(9);
  });

  it("creates a two-entity group and refuses an entity that needs a language the project lacks", async () => {
    const ent = (id: string, country: string, currency: string, languages: string[]) => ({ id, name: id.toUpperCase(), country, currency, languages });
    const ok = await projects.createProject({ name: "Gulf Group", preset: "meezan", accent: "#0F6E56", currency: "AED", country: "AE", languages: ["en", "ar"], entities: [ent("ae", "AE", "AED", ["en", "ar"]), ent("om", "OM", "OMR", ["ar"])] });
    expect(ok.project.entities).toHaveLength(2);
    await expect(projects.createProject({ name: "Bad Group", preset: "meezan", accent: "#0F6E56", currency: "AED", country: "AE", languages: ["en"], entities: [ent("ae", "AE", "AED", ["ar"])] })).rejects.toThrow(/does not offer/);
    await expect(projects.createProject({ name: "Nowhere Bank", preset: "meezan", accent: "#0F6E56", currency: "USD", country: "ZZ" })).rejects.toThrow(/country/);
    await expect(projects.createProject({ name: "Odd Look", preset: "meezan", accent: "#0F6E56", currency: "USD", look: "nope" })).rejects.toThrow(/library/);
    await expect(projects.createProject({ name: "Odd Radius", preset: "meezan", accent: "#0F6E56", currency: "USD", radius: { md: 99 } })).rejects.toThrow(/0 to 40/);
  });
});
