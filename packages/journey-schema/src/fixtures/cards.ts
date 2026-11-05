import type { Journey, Screen } from "../schema";
import { cardsViewAcceptance, cardsViewScenarios } from "./cards-tests";

/** STUB: replaced by the real journey. */
export const cardsView: Journey = {
  id: "jrn_bankworkx_cards", slug: "cards", name: "Cards", version: 1, status: "published", channels: ["web", "mobile"], apps: ["bankworkx"], locale: { default: "en", supported: ["en"] },
  entryScreen: "start", acceptance: cardsViewAcceptance, scenarios: cardsViewScenarios, dataModel: {}, integrations: [],
  screens: [{ id: "start", title: "Cards", kind: "terminal", blocks: [{ type: "result", tone: "error", title: "Not built", text: "Not built yet" }] }] as Screen[],
};
