import type { Journey, Screen } from "../schema";
import { paymentTrackerAcceptance, paymentTrackerScenarios } from "./payment-tracker-tests";
import { alert, button, denyScreen, go, holds, lacks, NOW_DENIED, route, set, text, toRoute } from "./business-kit";

const STATUSES = {
  pending_approval: { label: "Pending approval", tone: "warning" as const }, released: { label: "Released to bank", tone: "info" as const }, settled: { label: "Settled", tone: "positive" as const },
  rejected: { label: "Rejected", tone: "negative" as const }, withdrawn: { label: "Withdrawn", tone: "neutral" as const },
};
const filter = (id: string, label: string, icon: string) => ({ id, label, icon, actions: [set("trk.status", id), go("refresh")] });
const OPEN = "!isEmpty(ctx.p)";

/**
 * Payment tracker (BankWorkx Business, Payments). A view: every payment the company started, newest first, with its id and start time, who it is to, the amount and a status chip
 * (Pending approval, Released to bank, Settled, Rejected, Withdrawn), filtered by status one at a time. A row opens the payment's status timeline: who started it, who approved, the
 * cut-off, and for the Maker's own pending payment Withdraw (which opens withdraw-payment). Anyone who can see Payments sees the same list; an Approver sees no Withdraw and, instead of
 * New supplier payment, a note about their role. Nothing here moves money. Opened with a payment (`launch.paymentId`, the deep link) it shows that payment.
 *
 * Built from the spec with the blocks FinX has (docs/BANKWORKX.md): the list and the timeline are two screens, not a list beside a pane; "Settled" is a released payment from an earlier day
 * (the sandbox has no settled state); filters by date, type or person, search, sort by column and View receipt's own file are not built (View receipt is the receipt of the page).
 */
export const paymentTracker: Journey = {
  id: "jrn_payment_tracker",
  slug: "payment-tracker",
  name: "Payment tracker",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: paymentTrackerAcceptance,
  scenarios: paymentTrackerScenarios,
  dataModel: { "launch.paymentId": { type: "string" }, "trk.status": { type: "string" }, "trk.id": { type: "string" } },
  integrations: [
    { id: "list", adapter: "corp.payments.track", mode: "sandbox" },
    { id: "one", adapter: "corp.payments.track", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Payments", kind: "branch",
      onEnter: [set("ctx.error", null), set("trk.status", "all"), set("trk.id", "{{launch.paymentId}}"), set("launch.paymentId", ""), set("ctx.p", null), go("refresh")],
      navigation: route([lacks("biz.accounts.view"), "denied"], ["!isEmpty(trk.id)", "open"]),
      blocks: [],
    },
    {
      id: "refresh", title: "Payments", kind: "branch",
      onEnter: [set("ctx.error", null), { type: "callApi", integration: "list", input: { status: "{{trk.status}}" }, saveAs: "ctx.trk", onError: toRoute }, go("list")],
      blocks: [],
    },
    {
      id: "list", title: "Payments",
      blocks: [
        text("Payments", "title"),
        button("New supplier payment", [{ type: "navigate", toJourney: "supplier-payment" }], "primary", holds("biz.payments.initiate")),
        text("Your role here is {{ctx.trk.role}}. It can’t create payments, so this button isn’t offered. The bank refuses it too.", "caption", lacks("biz.payments.initiate")),
        {
          type: "shortcuts",
          items: [filter("all", "All", "menu"), filter("pending_approval", "Pending", "clock"), filter("released", "Released", "send"), filter("settled", "Settled", "check"), filter("rejected", "Rejected", "x"), filter("withdrawn", "Withdrawn", "back")],
        },
        {
          type: "dataTable", source: "ctx.trk.rows", label: "Payments", visibleWhen: "ctx.trk.count > 0", pageSize: 25,
          columns: [
            { key: "id", label: "Payment" }, { key: "started", label: "Started" }, { key: "to", label: "To" }, { key: "amount", label: "Amount", type: "money", currencyKey: "currency" },
            { key: "statusKey", label: "Status", type: "status", statuses: STATUSES },
          ],
          onRowPress: [set("trk.id", "{{item.id}}"), go("open")],
        },
        text("No payments yet", "title", "ctx.trk.count == 0 && trk.status == 'all'"),
        text("Payments you start will show here with their status.", "body", "ctx.trk.count == 0 && trk.status == 'all'"),
        text("Nothing here", "title", "ctx.trk.count == 0 && trk.status != 'all'"),
        text("No payment has this status.", "body", "ctx.trk.count == 0 && trk.status != 'all'"),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "open", title: "Payment", kind: "branch",
      onEnter: [set("ctx.error", null), set("ctx.p", null), { type: "callApi", integration: "one", input: { paymentId: "{{trk.id}}" }, saveAs: "ctx.p", onError: toRoute }, go("detail")],
      blocks: [],
    },
    {
      id: "detail", title: "Payment",
      blocks: [
        text("Payment not found.", "title", `!${OPEN}`),
        text("We can’t find that payment.", "body", `!${OPEN}`),
        text("{{ctx.p.id}}", "title", OPEN),
        { type: "statusChip", status: "{{ctx.p.statusKey}}", label: "{{ctx.p.statusText}}", statuses: STATUSES, visibleWhen: OPEN },
        { type: "reviewSummary", visibleWhen: OPEN, rows: [{ label: "Amount", value: "{{ctx.p.amountText}}" }, { label: "To", value: "{{ctx.p.to}}" }, { label: "Reference", value: "Ref {{ctx.p.reference}}" }, { label: "Started by", value: "{{ctx.p.startedBy}}" }] },
        { type: "timeline", label: "Status", source: "ctx.p.timeline", item: { title: "{{item.title}}", text: "{{item.text}}", state: "{{item.state}}" }, visibleWhen: OPEN },
        button("Withdraw", [{ type: "navigate", toJourney: "withdraw-payment", with: { "launch.paymentId": "{{trk.id}}" } }], "primary", `${OPEN} && ctx.p.canWithdraw && ${holds("biz.payments.withdraw")}`),
        button("View receipt", [{ type: "share", template: "receipt" }], "secondary", `${OPEN} && ctx.p.canReceipt`),
        button("Back to payments", [set("trk.id", ""), go("refresh")], "ghost"),
      ],
    },
    { id: "route", title: "One moment", kind: "branch", onEnter: [go("loadFail")], navigation: route([NOW_DENIED, "denied"], ["ctx.error.code == 'PAYMENT_NOT_FOUND'", "detail"]), blocks: [] },
    {
      id: "loadFail", title: "Payments", kind: "terminal",
      blocks: [
        text("We couldn’t load your payments. Nothing was changed.", "title"),
        alert("error", "This is taking longer than expected. Nothing was changed.", "ctx.error.code == 'TIMEOUT'"),
        alert("error", "Nothing was sent and you haven’t been charged. Try again in a moment.", "ctx.error.code == 'SERVICE_UNAVAILABLE'"),
        button("Try again", [go("start")]),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    denyScreen("Payments", "see payments"),
  ] as Screen[],
};
