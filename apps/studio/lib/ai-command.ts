export type Agent = "journey" | "review" | "code";
export const SKILL: Record<Agent, string> = { journey: "finx-journey", review: "finx-review", code: "finx-code" };

const shellQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

export type JourneyRef = { slug: string; name: string; /** a block picked in the preview, for example `the "Continue" button on screen "review"` */ focus?: string };
export type ProjectRef = { id: string; name: string };

/**
 * The text after the skill name. With a journey in view, the request already names it. A new journey names the project
 * (the bank app chosen in the sidebar), so the draft lands there whatever is selected when the command runs.
 */
export function promptFor(agent: Agent, brief: string, journey?: JourneyRef, project?: ProjectRef): string {
  const b = brief.trim();
  if (journey && agent === "review") return `${journey.slug} ${journey.focus ? `focus on ${journey.focus}. ` : ""}${b}`.trim();
  if (journey && agent === "journey") return `Change the "${journey.name}" journey (${journey.slug})${journey.focus ? `, about ${journey.focus}` : ""}: ${b || "<describe the change>"}`;
  if (project && agent === "journey") return `For ${project.name} (${project.id}): ${b || "<describe what you want>"}`;
  return b || "<describe what you want>";
}

/** The exact command to paste into a terminal, safe against quotes in the request. */
export const commandFor = (agent: Agent, brief: string, journey?: JourneyRef, project?: ProjectRef) => `claude ${shellQuote(`/${SKILL[agent]} ${promptFor(agent, brief, journey, project)}`)}`;
