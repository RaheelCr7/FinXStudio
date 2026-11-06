import type { Journey, Screen } from "../schema";
import { saveBorrowAcceptance, saveBorrowScenarios } from "./save-borrow-tests";

/** Save (BankWorkx, Personal: Save & Borrow). Stub: to be built. */
export const saveBorrow: Journey = {
  id: "jrn_bankworkx_save_borrow",
  slug: "save-borrow",
  name: "Save",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: saveBorrowAcceptance,
  scenarios: saveBorrowScenarios,
  dataModel: {},
  integrations: [],
  screens: [{ id: "start", title: "Save", kind: "terminal", blocks: [{ type: "result", tone: "error", title: "Not built yet" }] }] as Screen[],
};
