import type { Journey, Screen } from "../schema";
import { templatesAcceptance, templatesScenarios } from "./templates-tests";
import { alert, button, denyScreen, go, holds, lacks, NOW_DENIED, route, set, text, toRoute } from "./business-kit";

const STATUSES = { ready: { label: "Ready", tone: "positive" as const }, waiting: { label: "Waiting for approval", tone: "warning" as const }, unavailable: { label: "Unavailable", tone: "neutral" as const } };
const KNOWN = "has(ctx.tpl, tp.id)";

/**
 * Templates (BankWorkx Business, Payments). A view: the company's saved payments, each with its supplier and its amount (or "Amount each time"), and the way to save a new one.
 * A template opens to its card, where Use starts Pay a supplier with it and Delete opens the delete of Payment templates. The buttons show only to a person who may start payments or
 * manage templates; an Approver sees the list. A template whose supplier is waiting for approval or gone shows its chip in place of Use. Nothing here moves money.
 *
 * Built from the spec with the blocks FinX has (docs/BANKWORKX.md): a row opens a card with Use and Delete (a row has no buttons of its own at the end), and the skeleton is not drawn.
 */
export const templates: Journey = {
  id: "jrn_templates",
  slug: "templates",
  name: "Templates",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: templatesAcceptance,
  scenarios: templatesScenarios,
  dataModel: { "tp.id": { type: "string" } },
  integrations: [{ id: "list", adapter: "corp.templates.list", mode: "sandbox" }],
  screens: [
    {
      id: "start", title: "Templates", kind: "branch",
      onEnter: [set("ctx.error", null), set("tp.id", ""), { type: "callApi", integration: "list", saveAs: "ctx.tpl", onError: toRoute }, go("list")],
      navigation: route([lacks("biz.accounts.view"), "denied"]),
      blocks: [],
    },
    {
      id: "list", title: "Templates",
      blocks: [
        text("Templates", "title"),
        button("Save a template", [{ type: "navigate", toJourney: "payment-template" }], "primary", holds("biz.templates.manage")),
        {
          type: "dataTable", source: "ctx.tpl", label: "Templates", visibleWhen: "len(ctx.tpl) > 0",
          columns: [
            { key: "name", label: "Template" }, { key: "supplierName", label: "Supplier" }, { key: "amountText", label: "Amount" },
            { key: "status", label: "Status", type: "status", statuses: STATUSES },
          ],
          onRowPress: [set("tp.id", "{{item.id}}"), go("detail")],
        },
        text("No templates yet", "title", "len(ctx.tpl) == 0"),
        text("Save a payment you make often.", "body", "len(ctx.tpl) == 0"),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "detail", title: "Template",
      blocks: [
        text("{{ctx.tpl[tp.id].name}}", "title", KNOWN),
        text("Template not found", "title", `!${KNOWN}`),
        text("It may have been deleted.", "body", `!${KNOWN}`),
        { type: "reviewSummary", visibleWhen: KNOWN, rows: [{ label: "Supplier", value: "{{ctx.tpl[tp.id].line}}" }, { label: "Amount", value: "{{ctx.tpl[tp.id].amountText}}" }] },
        { type: "reviewSummary", visibleWhen: `${KNOWN} && !isEmpty(ctx.tpl[tp.id].reference)`, rows: [{ label: "Reference", value: "{{ctx.tpl[tp.id].reference}}" }] },
        { type: "reviewSummary", visibleWhen: `${KNOWN} && !isEmpty(ctx.tpl[tp.id].purpose)`, rows: [{ label: "Purpose", value: "{{ctx.tpl[tp.id].purpose}}" }] },
        { type: "statusChip", status: "waiting", label: "Waiting for approval", tone: "warning", visibleWhen: `${KNOWN} && ctx.tpl[tp.id].status == 'waiting'` },
        { type: "statusChip", status: "unavailable", label: "Unavailable", tone: "neutral", visibleWhen: `${KNOWN} && ctx.tpl[tp.id].status == 'unavailable'` },
        button("Use", [{ type: "navigate", toJourney: "supplier-payment", with: { "launch.templateId": "{{tp.id}}" } }], "primary", `${KNOWN} && ctx.tpl[tp.id].status == 'ready' && ${holds("biz.payments.initiate")}`),
        button("Delete", [{ type: "navigate", toJourney: "payment-template", with: { "launch.mode": "delete", "launch.templateId": "{{tp.id}}" } }], "secondary", `${KNOWN} && ${holds("biz.templates.manage")}`),
        button("Back", [go("start")], "ghost"),
      ],
    },
    {
      id: "route", title: "One moment", kind: "branch", onEnter: [go("loadFail")], navigation: route([NOW_DENIED, "denied"]), blocks: [],
    },
    {
      id: "loadFail", title: "Templates", kind: "terminal",
      blocks: [
        text("We couldn’t load your templates. Nothing was changed.", "title"),
        alert("error", "This is taking longer than expected. Nothing was changed.", "ctx.error.code == 'TIMEOUT'"),
        alert("error", "Nothing was sent and you haven’t been charged. Try again in a moment.", "ctx.error.code == 'SERVICE_UNAVAILABLE'"),
        button("Try again", [go("start")]),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    denyScreen("Templates", "see templates"),
  ] as Screen[],
};
