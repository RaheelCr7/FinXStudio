import { listRoles, selfPublishFor } from "./access";
import { sameContent } from "./edit";
import type { Person } from "./people";
import { appsOfJourney } from "./project-utils";
import { selfPublishBlock } from "./roles";
import { StoreError, type JourneyRecord } from "./store";

/** Applies the project's approval rule: refuses (403) when this person made the latest change and the rule wants someone else to publish it. */
export async function assertMayPublish(rec: JourneyRecord, who: Person): Promise<void> {
  const rule = await selfPublishFor(appsOfJourney(rec.draft));
  const why = selfPublishBlock(rule, who, rec.editedBy, !sameContent(rec.draft, rec.published), await listRoles());
  if (why) throw new StoreError(403, why);
}
