/** Small helpers shared by server pages and client components. */
export const COOKIE = "finx.project";

/** Which projects show a journey: its apps, or Meezan when none are listed. */
export const appsOfJourney = (j: { apps?: string[] }) => (j.apps?.length ? j.apps : ["meezan"]);
