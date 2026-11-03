import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const tmp = mkdtempSync(path.join(tmpdir(), "finx-git-"));
process.env.FINX_DATA_DIR = path.join(tmp, "data");
const g = (cwd: string, ...a: string[]) => execFileSync("git", a, { cwd, encoding: "utf8" }).trim();

import { classify, deploy, fileText, fingerprint, plan, setConfig, sync } from "./gitsync";
import { createJourney, getRecord, publish, saveDraft } from "./store";

const me = { id: "p1", name: "Sara" };
let repo = "", remote = "";

beforeAll(async () => {
  remote = path.join(tmp, "remote.git"); repo = path.join(tmp, "clone");
  execFileSync("git", ["init", "-q", "--bare", "-b", "main", remote]);
  execFileSync("git", ["init", "-q", "-b", "main", repo]);
  g(repo, "config", "user.email", "t@example.com"); g(repo, "config", "user.name", "T"); g(repo, "config", "commit.gpgsign", "false");
  g(repo, "remote", "add", "origin", remote);
  writeFileSync(path.join(repo, "README.md"), "x"); g(repo, "add", "."); g(repo, "commit", "-qm", "init"); g(repo, "push", "-q", "-u", "origin", "main");
  await createJourney("Alpha", ["meezan"], me);
  await setConfig("meezan", { dir: repo });
});

describe("the conflict rule", () => {
  it("decides from Studio, the file and the last sync", () => {
    expect(classify("a", "a", null)).toBe("in_sync");
    expect(classify("a", "b", null)).toBe("conflict"); // both exist, never synced, different
    expect(classify("b", "a", "a")).toBe("push");
    expect(classify("a", "b", "a")).toBe("pull");
    expect(classify("b", "c", "a")).toBe("conflict");
    expect(classify("a", null, "a")).toBe("new_here");
    expect(classify(null, "a", null)).toBe("new_in_git");
  });
  it("writes a journey the same way every time", () => {
    const a = fileText({ b: 1, a: { d: 1, c: 2 } } as any), b = fileText({ a: { c: 2, d: 1 }, b: 1 } as any);
    expect(a).toBe(b); expect(a.endsWith("\n")).toBe(true);
    expect(fingerprint(a)).toBe(fingerprint(b));
  });
});

describe("syncing a project with git", () => {
  it("refuses a folder that is not a git work tree or a relative path", async () => {
    await expect(setConfig("meezan", { dir: tmp })).rejects.toThrow(/git working tree/);
    await expect(setConfig("meezan", { dir: "relative/path" })).rejects.toThrow(/full path/);
  });

  it("pushes a new draft: one commit on the branch, pushed to the remote, never a force push", async () => {
    const before = await plan("meezan");
    expect(before.entries.find((e) => e.slug === "alpha")!.state).toBe("new_here");
    const r = await sync("meezan", me);
    expect(r.pushed).toContain("alpha");
    expect(r.committed).toBeTruthy(); expect(r.pushedToRemote).toBe(true);
    expect(existsSync(path.join(repo, "finx/meezan/alpha.json"))).toBe(true);
    expect(g(repo, "log", "-1", "--format=%s")).toMatch(/Studio: sync meezan drafts/);
    expect(g(remote, "log", "-1", "--format=%s", "main")).toMatch(/Studio: sync meezan/);
    expect((await plan("meezan")).entries.find((e) => e.slug === "alpha")!.state).toBe("in_sync");
  });

  it("pulls a change made in git into the draft, and never publishes", async () => {
    const file = path.join(repo, "finx/meezan/alpha.json");
    const j = JSON.parse(readFileSync(file, "utf8")); j.name = "Alpha edited in git";
    writeFileSync(file, JSON.stringify(j, null, 2) + "\n"); g(repo, "commit", "-qam", "edit in git");
    expect((await plan("meezan")).entries.find((e) => e.slug === "alpha")!.state).toBe("pull");
    const r = await sync("meezan", me);
    expect(r.pulled).toEqual(["alpha"]);
    const rec = await getRecord("alpha");
    expect(rec.draft.name).toBe("Alpha edited in git"); expect(rec.published).toBeUndefined();
  });

  it("leaves a conflict untouched until someone chooses, backs up Studio's draft when git wins", async () => {
    const file = path.join(repo, "finx/meezan/alpha.json");
    const git1 = JSON.parse(readFileSync(file, "utf8")); git1.name = "From git"; writeFileSync(file, JSON.stringify(git1, null, 2) + "\n"); g(repo, "commit", "-qam", "git edit 2");
    const cur = (await getRecord("alpha")).draft; await saveDraft("alpha", { ...cur, name: "From Studio" }, me);
    expect((await plan("meezan")).entries.find((e) => e.slug === "alpha")!.state).toBe("conflict");
    const skipped = await sync("meezan", me);
    expect(skipped.skipped.map((s) => s.slug)).toEqual(["alpha"]);
    expect((await getRecord("alpha")).draft.name).toBe("From Studio");
    expect(JSON.parse(readFileSync(file, "utf8")).name).toBe("From git");
    await sync("meezan", me, { resolutions: { alpha: "git" } });
    expect((await getRecord("alpha")).draft.name).toBe("From git");
    expect(existsSync(path.join(tmp, "data/git-backups"))).toBe(true);
    const cur2 = (await getRecord("alpha")).draft; await saveDraft("alpha", { ...cur2, name: "Studio wins" }, me);
    const gitAgain = JSON.parse(readFileSync(file, "utf8")); gitAgain.name = "Git again"; writeFileSync(file, JSON.stringify(gitAgain, null, 2) + "\n"); g(repo, "commit", "-qam", "git edit 3");
    await sync("meezan", me, { resolutions: { alpha: "studio" } });
    expect(JSON.parse(readFileSync(file, "utf8")).name).toBe("Studio wins");
  });

  it("imports a journey that only exists in git, and skips an invalid file without breaking the rest", async () => {
    const dir = path.join(repo, "finx/meezan");
    const alpha = JSON.parse(readFileSync(path.join(dir, "alpha.json"), "utf8"));
    writeFileSync(path.join(dir, "beta.json"), JSON.stringify({ ...alpha, id: "jrn_beta", slug: "beta", name: "Beta" }, null, 2) + "\n");
    writeFileSync(path.join(dir, "broken.json"), "{ not json");
    g(repo, "add", "."); g(repo, "commit", "-qm", "add beta and a broken file");
    const r = await sync("meezan", me);
    expect(r.created).toContain("beta"); expect(r.skipped.find((s) => s.slug === "broken")?.why).toMatch(/not valid JSON/);
    expect((await getRecord("beta")).draft.name).toBe("Beta");
  });

  it("refuses to sync when the clone is on another branch", async () => {
    g(repo, "checkout", "-q", "-b", "other");
    await expect(sync("meezan", me)).rejects.toThrow(/Studio never switches branches/);
    g(repo, "checkout", "-q", "main");
  });
});

describe("deploy", () => {
  it("needs a git folder, and something published", async () => {
    await expect(deploy("no-such-project", me)).rejects.toThrow(/no git folder/);
    await setConfig("empty-project", { dir: repo });
    await expect(deploy("empty-project", me)).rejects.toThrow(/Nothing is published/);
  });
  it("commits the published journeys, tags the commit and pushes the tag, never the drafts", async () => {
    const { catalog } = await import("@finx/journey-schema");
    const { addJourneyCopy } = await import("./store");
    await addJourneyCopy(catalog.find((c) => c.id === "pay-a-bill")!.journey as any, "meezan", { publishNow: true });
    const r = await deploy("meezan", me, "first release");
    expect(r.tag).toMatch(/^deploy\/meezan\/\d{8}-\d{6}$/);
    expect(r.pushedToRemote).toBe(true);
    expect(existsSync(path.join(repo, "finx/meezan/published/pay-a-bill-meezan.json"))).toBe(true);
    expect(existsSync(path.join(repo, "finx/meezan/published/alpha.json"))).toBe(false);
    expect(g(remote, "tag", "-l", "deploy/*")).toContain(r.tag);
    expect(g(repo, "tag", "-n1", r.tag)).toContain("first release");
  });
});
