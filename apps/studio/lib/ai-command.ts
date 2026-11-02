export type Agent = "journey" | "review" | "code";
export const SKILL: Record<Agent, string> = { journey: "finx-journey", review: "finx-review", code: "finx-code" };

const shellQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

/** The text after the skill name. With a journey in view, the request already names it. */
export function promptFor(agent: Agent, brief: string, journey?: { slug: string; name: string }): string {
  const b = brief.trim();
  if (journey && agent === "review") return `${journey.slug} ${b}`.trim();
  if (journey && agent === "journey") return `Change the "${journey.name}" journey (${journey.slug}): ${b || "<describe the change>"}`;
  return b || "<describe what you want>";
}

/** The exact command to paste into a terminal, safe against quotes in the request. */
export const commandFor = (agent: Agent, brief: string, journey?: { slug: string; name: string }) => `claude ${shellQuote(`/${SKILL[agent]} ${promptFor(agent, brief, journey)}`)}`;
