import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { addMoney, localTransfer } from "@finx/journey-schema";
import { brandDefs, brands } from "@finx/ui-kit";
import { crc32, generateProject, zip } from "./index";

const input = () => ({
  project: { id: "bankworkx", ...brandDefs.bankworkx! }, brand: brands.bankworkx!, studioUrl: "http://localhost:3100",
  journeys: [{ journey: addMoney, live: true }, { journey: { ...localTransfer, slug: "zz-draft", version: 0 }, live: false }],
});

describe("generateProject", () => {
  it("writes the project, its journeys, theme, README and a manifest", () => {
    const files = generateProject(input());
    expect(files.map((f) => f.path)).toEqual(["README.md", "finx.project.json", ".env.example", "theme/tokens.json", "journeys/add-money.json", "journeys/zz-draft.json", "src/journeys.ts", "src/custom/README.md", ".finx/manifest.json"]);
    const by = (p: string) => files.find((f) => f.path === p)!;
    expect(JSON.parse(by("finx.project.json").content)).toMatchObject({ id: "bankworkx", bundleId: "com.bankworkx.app", currency: "USD" });
    expect(JSON.parse(by("journeys/add-money.json").content).slug).toBe("add-money");
    expect(by("journeys/add-money.json").note).toContain("live v1");
    expect(by("journeys/zz-draft.json").note).toContain("draft");
    expect(by("src/journeys.ts").content).toContain('import j_add_money from "../journeys/add-money.json";');
    expect(by("src/journeys.ts").content).toContain("export const journeys = [j_add_money, j_zz_draft]");
    expect(by(".env.example").content).toContain("EXPO_PUBLIC_FINX_BRAND=bankworkx");
    expect(by("README.md").content).toContain("pnpm ios:sim --brand bankworkx --install");
  });

  it("tags files by who owns them, and the manifest agrees with the files", () => {
    const files = generateProject(input());
    const tag = (p: string) => files.find((f) => f.path === p)!.tag;
    expect([tag("finx.project.json"), tag("README.md"), tag("src/custom/README.md")]).toEqual(["generated", "extendable", "custom"]);
    const manifest = JSON.parse(files.find((f) => f.path === ".finx/manifest.json")!.content);
    expect(manifest.files.map((f: any) => f.path)).toEqual(files.filter((f) => f.path !== ".finx/manifest.json").map((f) => f.path));
    expect(manifest.journeys).toEqual([{ slug: "add-money", version: 1, live: true }, { slug: "zz-draft", version: 0, live: false }]);
  });

  it("is the same every time for the same input, whatever order the journeys come in", () => {
    const a = generateProject(input());
    const rev = input(); rev.journeys.reverse();
    expect(generateProject(rev)).toEqual(a);
  });

  it("works for a project with no journeys", () => {
    const files = generateProject({ ...input(), journeys: [] });
    expect(files.find((f) => f.path === "src/journeys.ts")!.content).toContain("export const journeys = [] as unknown as Journey[];");
    expect(files.find((f) => f.path === "README.md")!.content).toContain("0 journeys (0 live)");
  });
});

describe("zip", () => {
  it("computes the standard CRC-32", () => { expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926); });

  it("makes an archive the system unzip accepts, with the same files and text", () => {
    const files = [{ path: "a.txt", content: "hello" }, { path: "dir/b.json", content: '{"x":1}\n' }];
    const dir = mkdtempSync(path.join(tmpdir(), "finx-zip-"));
    const file = path.join(dir, "t.zip");
    writeFileSync(file, zip(files));
    expect(execFileSync("unzip", ["-tq", file]).toString()).toContain("No errors");
    expect(execFileSync("unzip", ["-p", file, "a.txt"]).toString()).toBe("hello");
    expect(execFileSync("unzip", ["-p", file, "dir/b.json"]).toString()).toBe('{"x":1}\n');
  });
});
