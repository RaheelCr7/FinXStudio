import type { Journey } from "../schema";
import { steps } from "./business-kit";

const { press, text, screen, opens, bank } = steps;

/** What must be true for "Repair rejected lines" to be right: it is only an entry to Bulk payment in resend mode. */
const acceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "Opened with a batch (the tracker passes paymentId, an old link repairOf) it opens Bulk payment in resend mode at that batch, whose own steps, checks and code apply, and it carries no screen, rule or bank call of its own." },
  { id: "AC-2", text: "A batch with nothing left to resend opens the same empty state \"Nothing to resend\" as Bulk payment, and the bank refuses the resend." },
  { id: "AC-3", text: "Resending sends the failed lines as a new batch and marks them Resent on the original (the criteria of Bulk payment, reached through this entry)." },
  { id: "AC-4", text: "Opened with no batch it says to choose one and opens nothing." },
];

const NOW = "2026-11-03T10:42:00Z";
const alpha = { persona: "alex", context: "alpha", now: NOW };
type Scenario = NonNullable<Journey["scenarios"]>[number];
const T = (id: string, name: string, covers: string[], base: Record<string, unknown>, stepList: Record<string, unknown>[], extra: Record<string, unknown> = {}): Scenario => ({ id, name, covers, ...base, ...extra, steps: stepList } as Scenario);

const scenarios: NonNullable<Journey["scenarios"]> = [
  T("T-1", "From the tracker (paymentId) it opens Bulk payment at PAY-1190, in resend mode with the returned line and the bank's sentence", ["AC-1"], alpha, [
    opens("bulk-payment", { "launch.repairOf": "PAY-1190" }), screen("fix"), text("Step 1 of 3 · Bulk payment"), text("Gulf Trade FZE"), text("The account name didn’t match."),
  ], { launch: { "launch.paymentId": "PAY-1190" } }),
  T("T-2", "An old link (repairOf) opens the same place", ["AC-1"], alpha, [opens("bulk-payment", { "launch.repairOf": "PAY-1190" }), screen("fix")], { launch: { "launch.repairOf": "PAY-1190" } }),
  T("T-3", "A batch with nothing failed opens Nothing to resend, and Continue says so; the bank refuses the resend", ["AC-2"], alpha, [
    opens("bulk-payment", { "launch.repairOf": "PAY-1180" }), screen("fix"), text("Nothing to resend"), text("All payments in this batch went through."), press("Continue"), text("There is nothing to resend."),
    bank("corp.bulk.get", "canResend", false, { id: "PAY-1180" }),
  ], { launch: { "launch.paymentId": "PAY-1180" } }),
  T("T-5", "Opened with no batch it says to choose a batch and opens nothing", ["AC-4"], alpha, [screen("none"), text("Choose a batch first"), text("Open this from a batch in Batch status")]),
  T("T-4", "Fixed and sent, the line is Resent on the original and a new batch waits", ["AC-3"], alpha, [
    screen("fix"), press("Fix lines"), screen("edit"), { set: { "bp.e.name": "Gulf Trade FZE", "bp.e.account": "AE070331234567890123456" } }, press("Done"), screen("fix"), press("Continue"), screen("speed"), press("Continue"), screen("review"),
    { set: { "bp.consent": true } }, press("Submit for approval"), screen("otp"), { set: { "otp.code": "482100" } }, press("Submit for approval"), screen("done"), text("Sent for approval"), text("Resend of Supplier batch 19"),
    bank("corp.bulk.get", "lines.4.statusText", "Resent", { id: "PAY-1190" }), bank("corp.bulk.get", "name", "Resend of Supplier batch 19", { id: "PAY-2042" }),
  ], { launch: { "launch.paymentId": "PAY-1190" } }),
];

/**
 * Repair rejected lines (BankWorkx Business, Payments): an alias of Bulk payment in resend mode, so it cannot drift from it. Opened with a batch it opens Bulk payment with that
 * batch to resend. A bank switches it off only together with Bulk payment (the shell checks both, see launch-points.ts).
 */
export const repairBulkLines: Journey = {
  id: "jrn_repair_bulk_lines",
  slug: "repair-bulk-lines",
  name: "Repair rejected lines",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance,
  scenarios,
  dataModel: { "launch.paymentId": { type: "string" }, "launch.repairOf": { type: "string" } },
  integrations: [],
  screens: [
    {
      id: "start", title: "Repair rejected lines", kind: "branch",
      onEnter: [{ type: "navigate", toJourney: "bulk-payment", with: { "launch.repairOf": "{{isEmpty(launch.repairOf) ? launch.paymentId : launch.repairOf}}" } }],
      // opened with no batch there is nothing to resend: say so, and open nothing
      navigation: { rules: [{ when: "isEmpty(launch.repairOf) && isEmpty(launch.paymentId)", to: "none" }] },
      blocks: [],
    },
    {
      id: "none", title: "Repair rejected lines", kind: "terminal",
      blocks: [
        { type: "text", variant: "title", text: "Choose a batch first" },
        { type: "text", variant: "body", text: "Open this from a batch in Batch status or from the payment tracker." },
        { type: "button", label: "Close", variant: "primary", actions: [{ type: "exit" }] },
      ],
    },
  ],
};
