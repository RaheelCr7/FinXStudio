import type { Journey, Screen } from "../schema";
import { replaceCardAcceptance, replaceCardScenarios } from "./replace-card-tests";

/** STUB: replaced by the real journey. */
export const replaceCard: Journey = {
  id: "jrn_bankworkx_replace_card", slug: "replace-card", name: "Replace a card", version: 1, status: "published", channels: ["web", "mobile"], apps: ["bankworkx"], locale: { default: "en", supported: ["en"] },
  entryScreen: "start", acceptance: replaceCardAcceptance, scenarios: replaceCardScenarios, dataModel: {}, integrations: [],
  screens: [{ id: "start", title: "Replace a card", kind: "terminal", blocks: [{ type: "result", tone: "error", title: "Not built", text: "Not built yet" }] }] as Screen[],
};
