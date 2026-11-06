import type { Journey, Screen } from "../schema";
import { repayLoanAcceptance, repayLoanScenarios } from "./repay-loan-tests";

/** Repay a loan (BankWorkx, Personal: Save & Borrow). Stub: to be built. */
export const repayLoan: Journey = {
  id: "jrn_bankworkx_repay_loan",
  slug: "repay-loan",
  name: "Repay a loan",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: repayLoanAcceptance,
  scenarios: repayLoanScenarios,
  dataModel: {},
  integrations: [],
  screens: [{ id: "start", title: "Repay a loan", kind: "terminal", blocks: [{ type: "result", tone: "error", title: "Not built yet" }] }] as Screen[],
};
