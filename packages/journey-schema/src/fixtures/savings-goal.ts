import type { Journey, Screen } from "../schema";
import { savingsGoalAcceptance, savingsGoalScenarios } from "./savings-goal-tests";

/** Savings goal (BankWorkx, Personal: Save & Borrow). Stub: to be built. */
export const savingsGoal: Journey = {
  id: "jrn_bankworkx_savings_goal",
  slug: "savings-goal",
  name: "Savings goal",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: savingsGoalAcceptance,
  scenarios: savingsGoalScenarios,
  dataModel: {},
  integrations: [],
  screens: [{ id: "start", title: "Savings goal", kind: "terminal", blocks: [{ type: "result", tone: "error", title: "Not built yet" }] }] as Screen[],
};
