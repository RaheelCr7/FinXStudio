import type { Journey, Screen } from "../schema";
import { virtualCardAcceptance, virtualCardScenarios } from "./virtual-card-tests";

/** STUB: replaced by the real journey. */
export const virtualCard: Journey = {
  id: "jrn_bankworkx_virtual_card", slug: "virtual-card", name: "Virtual card", version: 1, status: "published", channels: ["web", "mobile"], apps: ["bankworkx"], locale: { default: "en", supported: ["en"] },
  entryScreen: "start", acceptance: virtualCardAcceptance, scenarios: virtualCardScenarios, dataModel: {}, integrations: [],
  screens: [{ id: "start", title: "Virtual card", kind: "terminal", blocks: [{ type: "result", tone: "error", title: "Not built", text: "Not built yet" }] }] as Screen[],
};
