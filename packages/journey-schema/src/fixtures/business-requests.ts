import type { Journey, Screen } from "../schema";
import { businessRequestsAcceptance, businessRequestsScenarios } from "./business-requests-tests";
import { button, denyScreen, failScreens, go, set, text } from "./business-kit";

const STATUSES = { received: { label: "Received", tone: "info" as const }, in_progress: { label: "In progress", tone: "warning" as const }, done: { label: "Done", tone: "positive" as const }, declined: { label: "Declined", tone: "neutral" as const } };
const NEW = button("New request", [{ type: "navigate", toJourney: "business-service-request" }]);

/**
 * Service requests (BankWorkx Business, More). A view: the requests this company sent to the bank and where each one stands (Received, In progress, Done, Declined), newest first, with the date
 * ("Today" or "28 Oct"), and a button that starts a new one. Nothing is changed here and no code is asked. The bank keeps the requests per company: Alpha's never show at Beta, and a person without
 * the permission to see accounts is refused.
 *
 * Built from the spec with the blocks FinX has (docs/BANKWORKX.md): the date is a column beside the reference (a cell has no second line), the list has no filter, search, paging or detail page (the
 * spec has none), and the New request button is part of the view (a bank that turns off Business service request leaves it drawn, the shell hides its own entry).
 */
export const businessRequests: Journey = {
  id: "jrn_business_requests",
  slug: "business-requests",
  name: "Service requests",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: businessRequestsAcceptance,
  scenarios: businessRequestsScenarios,
  dataModel: {},
  integrations: [{ id: "list", adapter: "corp.requests.list", mode: "sandbox" }],
  screens: [
    {
      id: "start", title: "Service requests", kind: "branch",
      onEnter: [set("ctx.error", null), { type: "callApi", integration: "list", saveAs: "ctx.rq", onError: { navigate: "route" } }, go("list")],
      blocks: [],
    },
    {
      id: "list", title: "Service requests",
      blocks: [
        text("Service requests", "title"),
        NEW,
        {
          type: "dataTable", source: "ctx.rq", label: "Service requests", visibleWhen: "len(ctx.rq) > 0", sort: { key: "createdAt", dir: "desc" },
          columns: [
            { key: "id", label: "Reference" }, { key: "dateText", label: "Date" }, { key: "typeText", label: "Type" }, { key: "subject", label: "About" }, { key: "status", label: "Status", type: "status", statuses: STATUSES },
          ],
        },
        text("No requests yet", "title", "len(ctx.rq) == 0"), text("Requests you send to the bank are listed here.", "body", "len(ctx.rq) == 0"),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    ...failures(),
  ] as Screen[],
};

function failures(): Screen[] {
  const base = failScreens({ title: "Service requests", unavailable: "Nothing was changed.", retry: [] });
  return base.filter((s) => s.id !== "denied").concat([denyScreen("Service requests", "see requests")]);
}
