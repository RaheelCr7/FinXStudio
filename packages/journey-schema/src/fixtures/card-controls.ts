import type { Journey, Screen } from "../schema";
import { cardControlsAcceptance, cardControlsScenarios } from "./card-controls-tests";

/** STUB: replaced by the real journey. */
export const cardControls: Journey = {
  id: "jrn_bankworkx_card_controls", slug: "card-controls", name: "Card limits and controls", version: 1, status: "published", channels: ["web", "mobile"], apps: ["bankworkx"], locale: { default: "en", supported: ["en"] },
  entryScreen: "start", acceptance: cardControlsAcceptance, scenarios: cardControlsScenarios, dataModel: {}, integrations: [],
  screens: [{ id: "start", title: "Card limits and controls", kind: "terminal", blocks: [{ type: "result", tone: "error", title: "Not built", text: "Not built yet" }] }] as Screen[],
};
