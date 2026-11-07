export type Agent = "journey" | "review" | "code";
export const SKILL: Record<Agent, string> = { journey: "finx-journey", review: "finx-review", code: "finx-code" };

const shellQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

export type JourneyRef = { slug: string; name: string; /** a block picked in the preview, for example `the "Continue" button on screen "review"` */ focus?: string };
export type ProjectRef = { id: string; name: string };

/** Where a new journey will run: the web app, the mobile app, or both. */
export type ChannelChoice = "web" | "mobile" | "both";
/** Said in the command, and read by the journey skill, which sets the journey's `channels` from it. */
export const CHANNEL_PHRASE: Record<ChannelChoice, string> = { web: "for web only", mobile: "for mobile only", both: "for web and mobile" };

/** What a project offers: both channels give a choice of three, one channel is fixed. A project that lists neither built channel counts as both. */
export function channelChoices(projectChannels: readonly string[]): ChannelChoice[] {
  const web = projectChannels.includes("web");
  const mobile = projectChannels.includes("mobile");
  if (web && !mobile) return ["web"];
  if (mobile && !web) return ["mobile"];
  return ["both", "web", "mobile"];
}

/**
 * The text after the skill name. With a journey in view, the request already names it. A new journey names the project
 * (the bank app chosen in the sidebar), so the draft lands there whatever is selected when the command runs, and the
 * channel when one is chosen, so the draft is built for the web app, the mobile app or both.
 */
export function promptFor(agent: Agent, brief: string, journey?: JourneyRef, project?: ProjectRef, channel?: ChannelChoice): string {
  const b = brief.trim();
  if (journey && agent === "review") return `${journey.slug} ${journey.focus ? `focus on ${journey.focus}. ` : ""}${b}`.trim();
  if (journey && agent === "journey") return `Change the "${journey.name}" journey (${journey.slug})${journey.focus ? `, about ${journey.focus}` : ""}: ${b || "<describe the change>"}`;
  if (project && agent === "journey") return `For ${project.name} (${project.id})${channel ? `, ${CHANNEL_PHRASE[channel]}` : ""}: ${b || "<describe what you want>"}`;
  return b || "<describe what you want>";
}

/** The exact command to paste into a terminal, safe against quotes in the request. */
export const commandFor = (agent: Agent, brief: string, journey?: JourneyRef, project?: ProjectRef, channel?: ChannelChoice) => `claude ${shellQuote(`/${SKILL[agent]} ${promptFor(agent, brief, journey, project, channel)}`)}`;
