import type { Journey, Screen } from "../schema";
import { activateCardAcceptance, activateCardScenarios } from "./activate-card-tests";

/** STUB: replaced by the real journey. */
export const activateCard: Journey = {
  id: "jrn_bankworkx_activate_card", slug: "activate-card", name: "Activate a card", version: 1, status: "published", channels: ["web", "mobile"], apps: ["bankworkx"], locale: { default: "en", supported: ["en"] },
  entryScreen: "start", acceptance: activateCardAcceptance, scenarios: activateCardScenarios, dataModel: {}, integrations: [],
  screens: [{ id: "start", title: "Activate a card", kind: "terminal", blocks: [{ type: "result", tone: "error", title: "Not built", text: "Not built yet" }] }] as Screen[],
};
