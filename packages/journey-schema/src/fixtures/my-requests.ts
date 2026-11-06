import type { Journey, Screen } from "../schema";
import { myRequestsAcceptance, myRequestsScenarios } from "./my-requests-tests";
import { alert, button, denied, go, holds, lacks, route, set, text } from "./more-kit";

const SEND = holds("messages.send");
const load = { type: "callApi" as const, integration: "request", input: { requestId: "{{mr.id}}" }, saveAs: "ctx.req", onError: { navigate: "loadFail" } };

/**
 * My requests (BankWorkx, Personal: More). A view, not a form: the service requests the person has sent, newest first, each with its title, its date and reference and where it stands
 * (Received, In progress, Done, Cancelled). A request opens to what was asked, when it was sent and its reference; one that is only Received can be cancelled after a confirmation.
 * What the person wrote is shown as text, never as markup. Nothing here moves money.
 *
 * Built from the spec of the prototype with the blocks FinX has: the status is in the line of each row (a row cannot carry a chip) and as a chip on the detail, the confirmation is a question on the
 * detail (not a card over it), and the cancel shows its answer as a toast on the detail. The shell's own More tab is unchanged; this journey is the view a bank can switch off.
 */
export const myRequests: Journey = {
  id: "jrn_bankworkx_my_requests",
  slug: "my-requests",
  name: "My requests",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: myRequestsAcceptance,
  scenarios: myRequestsScenarios,
  dataModel: { "mr.id": { type: "string" }, "mr.msg": { type: "string" }, "mr.confirm": { type: "boolean" } },
  integrations: [
    { id: "requests", adapter: "bank.requests.list", mode: "sandbox" },
    { id: "request", adapter: "bank.requests.get", mode: "sandbox" },
    { id: "cancel", adapter: "bank.requests.cancel", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "My requests", kind: "branch",
      onEnter: [set("mr.msg", ""), set("ctx.error", null), { type: "callApi", integration: "requests", saveAs: "ctx.reqs", onError: { navigate: "loadFail" } }, go("list")],
      navigation: route([lacks("accounts.view"), "denied"], ["len(ctx.reqs) == 0", "empty"]),
      blocks: [],
    },
    {
      id: "list", title: "My requests",
      blocks: [
        text("My requests", "title"),
        button("New request", [{ type: "navigate", toJourney: "service-request" }], "secondary", SEND),
        {
          type: "menu", source: "ctx.reqs",
          item: { label: "{{item.title}}", text: "{{item.line}} · {{item.status}}", icon: "doc", actions: [set("mr.id", "{{item.id}}"), set("mr.msg", ""), set("mr.confirm", false), load, go("detail")] },
        },
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "detail", title: "{{ctx.req.title}}",
      blocks: [
        {
          type: "statusChip", status: "{{ctx.req.status}}",
          statuses: { Received: { label: "Received", tone: "info" }, "In progress": { label: "In progress", tone: "warning" }, Done: { label: "Done", tone: "positive" }, Cancelled: { label: "Cancelled", tone: "neutral" } },
        },
        alert("error", "{{mr.msg}}", "!isEmpty(mr.msg)"),
        { type: "menu", source: "ctx.req.rows", item: { label: "{{item.label}}", text: "{{item.value}}", icon: "doc", actions: [] } },
        { type: "reviewSummary", rows: [{ label: "Sent", value: "{{ctx.req.date}}" }, { label: "Reference", value: "{{ctx.req.reference}}" }] },
        button("Cancel request", [set("mr.msg", ""), set("mr.confirm", true)], "secondary", `ctx.req.canCancel && ${SEND} && !mr.confirm`),
        // the confirmation sits on the detail, so the answer of a cancel (a toast) is shown where the person is
        text("Cancel this request?", "title", "mr.confirm"),
        button("Yes, cancel", [
          set("mr.confirm", false), { type: "callApi", integration: "cancel", input: { requestId: "{{mr.id}}" }, onError: { navigate: "cancelFail" } },
          { ...load, onError: { navigate: "detail" } }, { type: "showToast", text: "Request cancelled" },
        ], "primary", "mr.confirm"),
        button("Keep it", [set("mr.confirm", false)], "ghost", "mr.confirm"),
        button("‹ My requests", [set("mr.msg", ""), set("mr.confirm", false), go("start")], "ghost"),
      ],
    },
    {
      // the cancel was refused or the bank did not answer: the request is as it was, and the person is told; one the bank has started is read again
      id: "cancelFail", title: "My requests", kind: "branch",
      onEnter: [
        set("mr.msg", "{{ctx.error.code == 'ALREADY_STARTED' ? 'This request has already started, so it can’t be cancelled.' : ctx.error.code == 'TIMEOUT' ? 'This is taking longer than expected. Nothing was changed.' : ctx.error.code == 'SERVICE_UNAVAILABLE' ? 'This isn’t available right now. Nothing was changed. Try again in a few minutes.' : 'Something went wrong. Nothing was changed.'}}"),
        go("detail"),
      ],
      navigation: route(["ctx.error.code == 'ALREADY_STARTED'", "refresh"]),
      blocks: [],
    },
    { id: "refresh", title: "My requests", kind: "branch", onEnter: [{ ...load, onError: { navigate: "detail" } }, go("detail")], blocks: [] },
    {
      id: "empty", title: "My requests",
      blocks: [
        text("No requests", "title"),
        text("Requests you send will show here.", "body"),
        button("New request", [{ type: "navigate", toJourney: "service-request" }], "primary", SEND),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "loadFail", title: "My requests",
      blocks: [
        text("We couldn’t load your requests. Nothing was changed.", "title"),
        text("This is taking longer than expected. Nothing was changed.", "body", "ctx.error.code == 'TIMEOUT'"),
        text("This isn’t available right now. Try again in a few minutes.", "body", "ctx.error.code != 'TIMEOUT'"),
        button("Try again", [go("start")]),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    denied("My requests"),
  ] as Screen[],
};
