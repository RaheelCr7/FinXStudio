import type { Journey, Screen } from "../schema";
import { budgetsAcceptance, budgetsScenarios } from "./budgets-tests";
import { button, denied, go, holds, lacks, route, set, text } from "./accounts-kit";

const MANAGE = holds("accounts.manage");

/**
 * Budgets (BankWorkx, Personal: Accounts). A view, not a form: every monthly budget with what was spent in the last 30 days, how much of it that is, and a chip
 * (On track below 80%, Close to limit from 80%, Over budget from 100%). A budget opens to its detail, where Edit and Delete open create-budget for that budget;
 * New budget opens it for a new one. Nothing is changed here.
 *
 * Built from the spec of the prototype with the blocks FinX has: a budget is a row that opens its detail (Edit and Delete are buttons there, not on the card),
 * and the bar is the percentage used, never more than 100. The shell's own Budgets list is unchanged; this journey is the view a bank can switch off.
 */
export const budgets: Journey = {
  id: "jrn_bankworkx_budgets",
  slug: "budgets",
  name: "Budgets",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: budgetsAcceptance,
  scenarios: budgetsScenarios,
  dataModel: {},
  integrations: [{ id: "budgets", adapter: "bank.budgets.list", mode: "sandbox" }],
  screens: [
    {
      id: "start", title: "Budgets", kind: "branch",
      onEnter: [set("ctx.error", null), { type: "callApi", integration: "budgets", saveAs: "ctx.budgets", onError: { navigate: "loadFail" } }, go("list")],
      navigation: route([lacks("accounts.view"), "denied"], ["len(ctx.budgets) == 0", "empty"]),
      blocks: [],
    },
    {
      id: "list", title: "Budgets",
      blocks: [
        text("Budgets", "title"),
        {
          type: "menu", source: "ctx.budgets",
          item: {
            label: "{{item.name}}",
            text: "{{item.line}} · {{item.chip}} · {{item.barPct}}% used",
            icon: "wallet",
            actions: [
              set("bd.id", "{{item.id}}"), set("bd.name", "{{item.name}}"), set("bd.line", "{{item.line}}"), set("bd.chip", "{{item.chip}}"),
              set("bd.pct", "{{item.barPct}}"), set("bd.left", "{{item.leftText}}"), set("bd.spent", "{{item.spentText}}"), set("bd.limit", "{{item.limitText}}"), { type: "navigate", to: "detail" },
            ],
          },
        },
        button("New budget", [{ type: "navigate", toJourney: "create-budget" }], "secondary", `len(ctx.budgets) < 8 && ${MANAGE}`),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "detail", title: "{{bd.name}}",
      blocks: [
        text("Budget", "title"),
        text("{{bd.name}}", "body"),
        {
          type: "statusChip", status: "{{bd.chip}}",
          statuses: { "On track": { label: "On track", tone: "positive" }, "Close to limit": { label: "Close to limit", tone: "warning" }, "Over budget": { label: "Over budget", tone: "negative" } },
        },
        text("{{bd.line}}", "body"),
        { type: "reviewSummary", rows: [{ label: "Spent", value: "{{bd.spent}}" }, { label: "Monthly amount", value: "{{bd.limit}}" }, { label: "Left", value: "{{bd.left}}" }, { label: "Used", value: "{{bd.pct}}%" }] },
        button("Edit", [{ type: "navigate", toJourney: "create-budget", with: { "launch.budgetId": "{{bd.id}}" } }], "primary", MANAGE),
        button("Delete", [{ type: "navigate", toJourney: "create-budget", with: { "launch.budgetId": "{{bd.id}}", "launch.mode": "delete" } }], "secondary", MANAGE),
        button("Back", [go("list")], "ghost"),
      ],
    },
    {
      id: "empty", title: "Budgets",
      blocks: [
        text("No budgets yet", "title"),
        text("Set a monthly amount for a category and we’ll tell you as you get close.", "body"),
        button("Create a budget", [{ type: "navigate", toJourney: "create-budget" }], "primary", MANAGE),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "loadFail", title: "Budgets",
      blocks: [
        text("We couldn’t load your budgets", "title"),
        text("This is taking longer than expected. Nothing was changed.", "body", "ctx.error.code == 'TIMEOUT'"),
        text("Nothing was changed. Try again in a moment.", "body", "ctx.error.code != 'TIMEOUT'"),
        button("Try again", [go("start")]),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    denied("Budgets"),
  ] as Screen[],
};
