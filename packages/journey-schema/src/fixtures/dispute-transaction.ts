import type { Journey, Screen } from "../schema";
import { disputeTransactionAcceptance, disputeTransactionScenarios } from "./dispute-transaction-tests";

/** STUB: replaced by the real journey. */
export const disputeTransaction: Journey = {
  id: "jrn_bankworkx_dispute_transaction", slug: "dispute-transaction", name: "Report a problem with a payment", version: 1, status: "published", channels: ["web", "mobile"], apps: ["bankworkx"], locale: { default: "en", supported: ["en"] },
  entryScreen: "start", acceptance: disputeTransactionAcceptance, scenarios: disputeTransactionScenarios, dataModel: {}, integrations: [],
  screens: [{ id: "start", title: "Report a problem with a payment", kind: "terminal", blocks: [{ type: "result", tone: "error", title: "Not built", text: "Not built yet" }] }] as Screen[],
};
