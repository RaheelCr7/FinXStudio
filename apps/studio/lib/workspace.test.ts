import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { GeneratedFile } from "@finx/codegen";
import { assertLocal, commitWorkspace, exportToFolder, setRemote, workspaceDir, workspaceStatus } from "./workspace";

const files = (v = "1"): GeneratedFile[] => [
  { path: "finx.project.json", content: `{"v":${v}}`, tag: "generated" },
  { path: "journeys/a.json", content: `{"a":${v}}`, tag: "generated" },
  { path: "src/custom/README.md", content: "yours\n", tag: "custom" },
  { path: ".env.example", content: "A=1\n", tag: "extendable" },
];
const who = { name: "Sam Patel", id: "sam" };
let root: string;
beforeEach(() => { root = mkdtempSync(path.join(tmpdir(), "finx-ws-")); process.env.FINX_WORKSPACES_DIR = root; });

describe("exporting a project to its folder", () => {
  it("writes every file under the project's own folder", async () => {
    const r = await exportToFolder("bankworkx", files());
    expect(r.dir).toBe(path.join(root, "bankworkx"));
    expect(r.written).toHaveLength(4);
    expect(readFileSync(path.join(r.dir, "journeys/a.json"), "utf8")).toBe('{"a":1}');
  });
  it("rewrites generated files but never touches extendable or custom files that exist", async () => {
    const { dir } = await exportToFolder("bankworkx", files());
    writeFileSync(path.join(dir, "src/custom/README.md"), "my notes\n");
    writeFileSync(path.join(dir, ".env.example"), "A=mine\n");
    const r = await exportToFolder("bankworkx", files("2"));
    expect(r.written.sort()).toEqual(["finx.project.json", "journeys/a.json"]);
    expect(r.kept.sort()).toEqual([".env.example", "src/custom/README.md"]);
    expect(readFileSync(path.join(dir, "src/custom/README.md"), "utf8")).toBe("my notes\n");
    expect(readFileSync(path.join(dir, "journeys/a.json"), "utf8")).toBe('{"a":2}');
  });
  it("reports a repeat export with no changes as unchanged", async () => {
    await exportToFolder("bankworkx", files());
    const r = await exportToFolder("bankworkx", files());
    expect(r.written).toEqual([]);
    expect(r.unchanged).toBe(2);
  });
  it("refuses paths that leave the folder and project ids that are not plain", async () => {
    await expect(exportToFolder("bankworkx", [{ path: "../evil.txt", content: "x", tag: "generated" }])).rejects.toThrow(/outside/);
    await expect(exportToFolder("bankworkx", [{ path: "/etc/evil", content: "x", tag: "generated" }])).rejects.toThrow(/outside/);
    expect(() => workspaceDir("../x")).toThrow(/valid project id/);
    expect(() => workspaceDir("A B")).toThrow(/valid project id/);
  });
});

describe("git in the project folder", () => {
  it("needs the folder first, then starts a repository and commits", async () => {
    await expect(commitWorkspace("bankworkx", "first", who)).rejects.toThrow(/folder first/);
    await exportToFolder("bankworkx", files());
    expect((await workspaceStatus("bankworkx")).git.initialised).toBe(false);
    const c = await commitWorkspace("bankworkx", "Studio export", who);
    expect(c?.subject).toBe("Studio export");
    const s = await workspaceStatus("bankworkx");
    expect(s.git).toMatchObject({ initialised: true, branch: "main", changes: 0, last: { subject: "Studio export" } });
    expect(s.vscodeUrl).toBe(`vscode://file${encodeURI(path.join(root, "bankworkx"))}`);
  });
  it("makes no empty commits and asks for a message", async () => {
    await exportToFolder("bankworkx", files());
    await commitWorkspace("bankworkx", "one", who);
    expect(await commitWorkspace("bankworkx", "two", who)).toBeNull();
    await exportToFolder("bankworkx", files("3"));
    expect((await workspaceStatus("bankworkx")).git.changes).toBe(2);
    await expect(commitWorkspace("bankworkx", "   ", who)).rejects.toThrow(/message/);
  });
  it("connects only plain https or ssh remotes, and only after the first commit", async () => {
    await exportToFolder("bankworkx", files());
    await expect(setRemote("bankworkx", "https://github.com/a/b.git")).rejects.toThrow(/Commit once/);
    await commitWorkspace("bankworkx", "one", who);
    for (const bad of ["file:///etc", "--upload-pack=x", "http://github.com/a/b", "https://x.com/a b", "ext::sh -c id", ""]) await expect(setRemote("bankworkx", bad)).rejects.toThrow(/https address/);
    await setRemote("bankworkx", "https://github.com/acme/bankworkx.git");
    await setRemote("bankworkx", "git@github.com:acme/bankworkx.git");
    expect((await workspaceStatus("bankworkx")).git.remote).toBe("git@github.com:acme/bankworkx.git");
  });
});

describe("local only", () => {
  it("allows localhost and refuses any other address", () => {
    expect(() => assertLocal(new Request("http://localhost:3100/api"))).not.toThrow();
    expect(() => assertLocal(new Request("http://127.0.0.1:3100/api"))).not.toThrow();
    expect(() => assertLocal(new Request("http://192.168.1.20:3100/api"))).toThrow(/localhost/);
    expect(() => assertLocal(new Request("https://studio.example.com/api"))).toThrow(/localhost/);
  });
});
