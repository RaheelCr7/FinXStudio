import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { createFinxServer } from "./index";
import { FakeStudio } from "./testing/fake-studio";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const SOURCE = "../skills/finx-journey/SKILL.md";
const INSTALLED = "../../../.claude/skills/finx-journey/SKILL.md";

describe("the /finx-journey skill", () => {
  it("has the front matter Claude Code needs", () => {
    const fm = read(SOURCE).match(/^---\n([\s\S]*?)\n---/)![1]!;
    expect(fm).toMatch(/^name: finx-journey$/m);
    expect(fm).toMatch(/^description: .{80,}/m);
    expect(fm).toMatch(/^argument-hint: /m);
    // pre-approving tool calls is the person's decision, not the skill's
    expect(fm).not.toMatch(/allowed-tools/);
  });

  it("is installed in .claude/skills and identical to the source (run `pnpm --filter @finx/mcp sync-skills`)", () => {
    expect(existsSync(new URL(INSTALLED, import.meta.url))).toBe(true);
    expect(read(INSTALLED)).toBe(read(SOURCE));
  });

  it("takes the brief through $ARGUMENTS exactly once", () => {
    expect(read(SOURCE).match(/\$ARGUMENTS/g)).toHaveLength(1);
  });

  it("only mentions tools that the server really provides", async () => {
    const server = createFinxServer({ studio: new FakeStudio() });
    const [ct, st] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "t", version: "0" });
    await Promise.all([server.connect(st), client.connect(ct)]);
    const real = new Set((await client.listTools()).tools.map((t) => t.name));
    const mentioned = new Set([...read(SOURCE).matchAll(/`(finx_[a-z_]+)`/g)].map((m) => m[1]!));
    expect([...mentioned].filter((n) => !real.has(n))).toEqual([]);
    // and the workflow covers the essentials
    for (const must of ["finx_get_catalog", "finx_save_draft", "finx_simulate_journey", "finx_report_run", "finx_create_journey"]) expect(mentioned.has(must), must).toBe(true);
  });

  it("tells the agent never to publish on its own", () => {
    const body = read(SOURCE);
    expect(body).toMatch(/Draft only/);
    expect(body).toMatch(/Publish only if the person explicitly tells you/);
  });
});

describe("every FinX skill", () => {
  const names = readdirSync(new URL("../skills", import.meta.url));
  it("includes the journey, review, code and generate skills", () => { expect(names.sort()).toEqual(["finx-code", "finx-generate", "finx-journey", "finx-review"]); });
  for (const name of names) {
    const source = `../skills/${name}/SKILL.md`, installed = `../../../.claude/skills/${name}/SKILL.md`;
    it(`${name}: has front matter, is installed identically, takes the request once, and pre-approves nothing`, () => {
      const fm = read(source).match(/^---\n([\s\S]*?)\n---/)![1]!;
      expect(fm).toMatch(new RegExp(`^name: ${name}$`, "m"));
      expect(fm).toMatch(/^description: .{80,}/m);
      expect(fm).toMatch(/^argument-hint: /m);
      expect(fm).not.toMatch(/allowed-tools/);
      expect(read(installed)).toBe(read(source));
      expect(read(source).match(/\$ARGUMENTS/g)).toHaveLength(1);
    });
    it(`${name}: only mentions tools that exist`, async () => {
      const server = createFinxServer({ studio: new FakeStudio() });
      const [ct, st] = InMemoryTransport.createLinkedPair();
      const client = new Client({ name: "t", version: "0" });
      await Promise.all([server.connect(st), client.connect(ct)]);
      const real = new Set((await client.listTools()).tools.map((t) => t.name));
      const mentioned = [...read(source).matchAll(/`(finx_[a-z_]+)`/g)].map((m) => m[1]!);
      expect(mentioned.filter((n) => !real.has(n))).toEqual([]);
    });
  }
  it("the reviewer reads and reports but never writes or publishes", () => {
    const body = read("../skills/finx-review/SKILL.md");
    const body2 = body.slice(body.indexOf("## Checklist"));
    const steps = body.slice(body.indexOf("## How to work"), body.indexOf("## Checklist"));
    for (const writer of ["finx_save_draft", "finx_patch_journey", "finx_create_journey", "finx_publish_journey"]) expect(steps).not.toContain(writer);
    expect(body2).toMatch(/Never call `finx_save_draft`/);
  });
  it("the code agent never commits to main or develop and keeps AI off the API", () => {
    const body = read("../skills/finx-code/SKILL.md");
    expect(body).toMatch(/push to `main` or `develop`/);
    expect(body).toMatch(/Anthropic API key/);
  });
});
