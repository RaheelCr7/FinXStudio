import type { Journey, Screen } from "../schema";
import { freezeCardAcceptance, freezeCardScenarios } from "./freeze-card-tests";

/** STUB: replaced by the real journey. */
export const freezeCard: Journey = {
  id: "jrn_bankworkx_freeze_card", slug: "freeze-card", name: "Freeze a card", version: 1, status: "published", channels: ["web", "mobile"], apps: ["bankworkx"], locale: { default: "en", supported: ["en"] },
  entryScreen: "start", acceptance: freezeCardAcceptance, scenarios: freezeCardScenarios, dataModel: {}, integrations: [],
  screens: [{ id: "start", title: "Freeze a card", kind: "terminal", blocks: [{ type: "result", tone: "error", title: "Not built", text: "Not built yet" }] }] as Screen[],
};
