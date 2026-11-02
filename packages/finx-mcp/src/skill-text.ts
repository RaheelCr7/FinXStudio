import { readFileSync } from "node:fs";

const SKILL = new URL("../skills/finx-journey/SKILL.md", import.meta.url);

/** The instructions of the /finx-journey skill, without its front matter, with the brief filled in. */
export function skillBody(brief: string): string {
  const raw = readFileSync(SKILL, "utf8");
  return raw.replace(/^---[\s\S]*?\n---\s*/, "").replaceAll("$ARGUMENTS", brief.trim() || "(no brief given: ask the person what journey to build)");
}
