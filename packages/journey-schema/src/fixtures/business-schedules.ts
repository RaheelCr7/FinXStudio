import type { Journey, Screen } from "../schema";
import { businessSchedulesAcceptance, businessSchedulesScenarios } from "./business-schedules-tests";
import { alert, button, denyScreen, go, holds, lacks, NOW_DENIED, route, set, text, toRoute } from "./business-kit";

const STATUSES = { active: { label: "Active", tone: "positive" as const }, awaiting: { label: "Waiting for approval", tone: "warning" as const } };
const KNOWN = "has(ctx.sch, bsv.id)";
const CAN = holds("biz.payments.schedule");

/**
 * Scheduled supplier payments (BankWorkx Business, Payments). A view: each scheduled and repeating supplier payment with its supplier and reference, the amount, how often and the
 * next date, whether it waits for approval ("0 of 1 approved") or is active, and whether the bank would skip the next payment and why. A row opens its card, where Change and Cancel
 * open the schedule journey for that payment. The buttons show only to a person who may schedule payments; an Approver sees the list. Nothing here moves money.
 *
 * Built from the spec with the blocks FinX has (docs/BANKWORKX.md): a row opens a card with Change and Cancel (a card has no buttons of its own in the list), the badge of a paused payment
 * is not drawn (nothing sets it yet) and the skeleton is not drawn.
 */
export const businessSchedules: Journey = {
  id: "jrn_business_schedules",
  slug: "business-schedules",
  name: "Scheduled supplier payments",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: businessSchedulesAcceptance,
  scenarios: businessSchedulesScenarios,
  dataModel: { "bsv.id": { type: "string" } },
  integrations: [{ id: "list", adapter: "corp.schedules.list", mode: "sandbox" }],
  screens: [
    {
      id: "start", title: "Scheduled", kind: "branch",
      onEnter: [set("ctx.error", null), set("bsv.id", ""), { type: "callApi", integration: "list", saveAs: "ctx.sch", onError: toRoute }, go("list")],
      navigation: route([lacks("biz.accounts.view"), "denied"]),
      blocks: [],
    },
    {
      id: "list", title: "Scheduled",
      blocks: [
        text("Scheduled supplier payments", "title"),
        button("Schedule a payment", [{ type: "navigate", toJourney: "schedule-business-payment" }], "primary", CAN),
        {
          type: "dataTable", source: "ctx.sch", label: "Scheduled payments", visibleWhen: "len(ctx.sch) > 0",
          columns: [
            { key: "supplierName", label: "Supplier" }, { key: "reference", label: "Reference" }, { key: "line", label: "Payment" },
            { key: "statusKey", label: "Status", type: "status", statuses: STATUSES }, { key: "info", label: "Details" },
          ],
          onRowPress: [set("bsv.id", "{{item.id}}"), go("detail")],
        },
        text("Nothing scheduled", "title", "len(ctx.sch) == 0"),
        text("Payments you schedule show here.", "body", "len(ctx.sch) == 0"),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "detail", title: "Scheduled payment",
      blocks: [
        text("{{ctx.sch[bsv.id].supplierName}}", "title", KNOWN),
        text("{{ctx.sch[bsv.id].reference}}", "caption", KNOWN),
        text("We can’t find that payment.", "title", `!${KNOWN}`),
        { type: "statusChip", status: "awaiting", label: "Waiting for approval", tone: "warning", visibleWhen: `${KNOWN} && ctx.sch[bsv.id].statusKey == 'awaiting'` },
        { type: "statusChip", status: "active", label: "Active", tone: "positive", visibleWhen: `${KNOWN} && ctx.sch[bsv.id].statusKey == 'active'` },
        { type: "reviewSummary", visibleWhen: KNOWN, rows: [{ label: "Payment", value: "{{ctx.sch[bsv.id].line}}" }, { label: "Ends", value: "{{ctx.sch[bsv.id].ends}}" }] },
        { type: "reviewSummary", visibleWhen: `${KNOWN} && !isEmpty(ctx.sch[bsv.id].progress)`, rows: [{ label: "Approval", value: "{{ctx.sch[bsv.id].progress}}" }] },
        { type: "reviewSummary", visibleWhen: `${KNOWN} && !isEmpty(ctx.sch[bsv.id].last)`, rows: [{ label: "Last payment", value: "{{ctx.sch[bsv.id].last}}" }] },
        alert("warning", "{{ctx.sch[bsv.id].warning}}", `${KNOWN} && !isEmpty(ctx.sch[bsv.id].warning)`),
        button("Change", [{ type: "navigate", toJourney: "schedule-business-payment", with: { "launch.mode": "edit", "launch.scheduleId": "{{bsv.id}}" } }], "primary", `${KNOWN} && ${CAN}`),
        button("Cancel", [{ type: "navigate", toJourney: "schedule-business-payment", with: { "launch.mode": "cancel", "launch.scheduleId": "{{bsv.id}}" } }], "secondary", `${KNOWN} && ${CAN}`),
        button("Back", [go("list")], "ghost"),
      ],
    },
    { id: "route", title: "One moment", kind: "branch", onEnter: [go("loadFail")], navigation: route([NOW_DENIED, "denied"]), blocks: [] },
    {
      id: "loadFail", title: "Scheduled", kind: "terminal",
      blocks: [
        text("We couldn’t load your scheduled payments. Nothing was changed.", "title"),
        alert("error", "This is taking longer than expected. Nothing was changed.", "ctx.error.code == 'TIMEOUT'"),
        alert("error", "Nothing was sent and you haven’t been charged. Try again in a moment.", "ctx.error.code == 'SERVICE_UNAVAILABLE'"),
        button("Try again", [go("start")]),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    denyScreen("Scheduled", "see scheduled payments"),
  ] as Screen[],
};
