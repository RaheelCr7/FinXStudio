/** Copies the canonical skills in packages/finx-mcp/skills into the repo's .claude/skills, where Claude Code loads them. */
import { cpSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const from = join(here, "..", "skills");
const to = join(here, "..", "..", "..", ".claude", "skills");
for (const name of readdirSync(from)) {
  mkdirSync(join(to, name), { recursive: true });
  cpSync(join(from, name), join(to, name), { recursive: true });
  console.log(`synced ${name} -> .claude/skills/${name}`);
}
