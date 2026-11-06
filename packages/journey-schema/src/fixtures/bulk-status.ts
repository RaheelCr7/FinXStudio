import type { Journey, Screen } from "../schema";
import { bulkStatusAcceptance, bulkStatusScenarios } from "./bulk-status-tests";
import { button, denyScreen, failScreens, go, lacks, route, set, text, toRoute } from "./business-kit";

const BATCH = {
  waiting: { label: "Waiting for approval", tone: "warning" as const }, sent: { label: "Sent to bank", tone: "positive" as const }, paid: { label: "Paid", tone: "positive" as const },
  partly: { label: "Partly paid", tone: "warning" as const }, rejected: { label: "Rejected", tone: "negative" as const }, withdrawn: { label: "Withdrawn", tone: "neutral" as const },
};
const LINE = {
  waiting: { label: "Waiting for approval", tone: "warning" as const }, sent: { label: "Sent to bank", tone: "positive" as const }, paid: { label: "Paid", tone: "positive" as const },
  failed: { label: "Failed", tone: "negative" as const }, resent: { label: "Resent", tone: "info" as const }, cancelled: { label: "Cancelled", tone: "negative" as const }, withdrawn: { label: "Withdrawn", tone: "neutral" as const },
};

/**
 * Batch status (BankWorkx Business, Payments). A view of one bulk batch: its name, its total, where it stands, the standing of every payment in it (with the bank's own
 * sentence under one that was returned), a report to take away, the way to fix and resend what failed, and the company's other batches. Nothing here moves money and no
 * code is asked. Opened with a batch (`launch.id`, from the receipt of Bulk payment or a row of Payments); without one it shows the company's latest.
 *
 * Built from the spec with the blocks FinX has (docs/BANKWORKX.md): the report is shown on a screen of its own with the button to share or print it (the engine has no file
 * download, so the CSV itself is what the bank builds and the scenarios check), and a failed read is the shared sheet "We couldn't reach the bank".
 */
export const bulkStatus: Journey = {
  id: "jrn_bulk_status",
  slug: "bulk-status",
  name: "Batch status",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: bulkStatusAcceptance,
  scenarios: bulkStatusScenarios,
  dataModel: { "launch.id": { type: "string" }, "launch.paymentId": { type: "string" }, "bs.id": { type: "string" } },
  integrations: [
    { id: "list", adapter: "corp.bulk.list", mode: "sandbox" },
    { id: "get", adapter: "corp.bulk.get", mode: "sandbox" },
    { id: "report", adapter: "corp.bulk.get", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Batch status", kind: "branch",
      onEnter: [
        set("ctx.error", null), set("bs.id", "{{isEmpty(launch.id) ? (isEmpty(launch.paymentId) ? '' : launch.paymentId) : launch.id}}"), set("launch.id", ""), set("launch.paymentId", ""),
        { type: "callApi", integration: "list", saveAs: "ctx.list", onError: toRoute },
        go("open"),
      ],
      navigation: route([lacks("biz.payments.bulk"), "denied"], ["ctx.list.count == 0", "empty"]),
      blocks: [],
    },
    {
      // reads the batch again from the bank (its state is today's); without an id, the latest
      id: "open", title: "Batch status", kind: "branch",
      onEnter: [set("ctx.error", null), { type: "callApi", integration: "get", input: { id: "{{bs.id}}" }, saveAs: "ctx.b", onError: toRoute }, go("view")],
      blocks: [],
    },
    {
      id: "view", title: "Batch status",
      blocks: [
        text("Batch: {{ctx.b.name}}", "title"),
        { type: "statusChip", status: "{{ctx.b.statusKey}}", statuses: BATCH },
        text("Total: {{ctx.b.totalText}}", "title"),
        text("{{ctx.b.countText}} · {{ctx.b.id}}", "caption"),
        button("Fix and resend", [{ type: "navigate", toJourney: "bulk-payment", with: { "launch.repairOf": "{{ctx.b.id}}" } }], "primary", "ctx.b.canResend"),
        button("Download report", [go("reportOpen")], "secondary"),
        {
          type: "dataTable", source: "ctx.b.lines", label: "Payments in this batch", pageSize: 25,
          columns: [{ key: "payee", label: "Payee" }, { key: "account", label: "Account" }, { key: "amountText", label: "Amount" }, { key: "statusKey", label: "Status", type: "status", statuses: LINE }, { key: "note", label: "Note" }],
        },
        { type: "sectionHeader", title: "Other batches", visibleWhen: "len(ctx.b.others) > 0" },
        { type: "menu", source: "ctx.b.others", item: { label: "{{item.name}}", text: "{{item.sub}} · {{item.statusText}}", actions: [set("bs.id", "{{item.id}}"), go("open")] } },
        button("New bulk payment", [{ type: "navigate", toJourney: "bulk-payment" }], "ghost"),
        button("Close", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      // the report of one batch: a row for each payment, with the bank's sentence for one that failed
      id: "reportOpen", title: "Report", kind: "branch",
      onEnter: [set("ctx.error", null), { type: "callApi", integration: "report", input: { id: "{{ctx.b.id}}", report: true }, saveAs: "ctx.rep", onError: toRoute }, go("report")],
      blocks: [],
    },
    {
      id: "report", title: "Report",
      blocks: [
        text("Report for {{ctx.rep.name}}", "title"),
        text("{{ctx.rep.report.fileName}}", "caption"),
        {
          type: "dataTable", source: "ctx.rep.report.rows", label: "Report", pageSize: 25,
          columns: [{ key: "line", label: "Line" }, { key: "payee", label: "Payee" }, { key: "amountText", label: "Amount" }, { key: "currency", label: "Currency" }, { key: "statusText", label: "Status" }, { key: "note", label: "Note" }],
        },
        button("Share report", [{ type: "share", template: "receipt" }], "primary"),
        button("Back", [go("view")], "ghost"),
      ],
    },
    {
      id: "empty", title: "Batch status", kind: "terminal",
      blocks: [
        text("No batches yet", "title"),
        text("Batches you send show here.", "body"),
        button("New bulk payment", [{ type: "navigate", toJourney: "bulk-payment" }]),
        button("Close", [{ type: "exit" }], "ghost"),
      ],
    },
    ...failures(),
  ] as Screen[],
};

function failures(): Screen[] {
  const base = failScreens({ title: "Batch status", retry: [["get", "open"], ["report", "reportOpen"]] });
  return base.filter((s) => s.id !== "denied").concat([denyScreen("Batch status", "see bulk batches")]);
}
