import type { Journey, Screen } from "../schema";
import { applyLoanAcceptance, applyLoanScenarios } from "./apply-loan-tests";

/** Apply for a loan (BankWorkx, Personal: Save & Borrow). Stub: to be built. */
export const applyLoan: Journey = {
  id: "jrn_bankworkx_apply_loan",
  slug: "apply-loan",
  name: "Apply for a loan",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: applyLoanAcceptance,
  scenarios: applyLoanScenarios,
  dataModel: {},
  integrations: [],
  screens: [{ id: "start", title: "Apply for a loan", kind: "terminal", blocks: [{ type: "result", tone: "error", title: "Not built yet" }] }] as Screen[],
};
