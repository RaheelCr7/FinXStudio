import type { Journey, Screen } from "../schema";
import { createBudgetAcceptance, createBudgetScenarios } from "./create-budget-tests";
import { alert, button, denied, go, lacks, route, set, text } from "./accounts-kit";

const toFail = { navigate: "fail" };
const MODE = "budget.mode";
const NEW = `${MODE} == 'new'`, EDIT = `${MODE} == 'edit'`, DELETE = `${MODE} == 'delete'`;
const onOff = (flag: string) => `{{${flag} ? 'On' : 'Off'}}`;
const err = (code: string) => `budget.err == '${code}'`;

/**
 * Create a budget (BankWorkx, Personal: Accounts). One journey creates, changes and deletes a monthly budget for a spending category: choose a category
 * that has none, the amount for the month (with what was spent in the last 30 days beside it), and the alerts at 80% and 100%. Opened with a budget
 * (launch.budgetId) it changes that one, or with launch.mode = delete asks once and removes it. A budget moves no money and blocks nothing, so it never
 * asks for a code or a tick.
 *
 * Built from the spec of the prototype with the blocks FinX has: the category cards are rows that say "Budget set" or what was spent, the amount is
 * checked when Continue is pressed, and the categories are the bank's eight (Food & Drinks where the spec says Food).
 */
export const createBudget: Journey = {
  id: "jrn_create_budget",
  slug: "create-budget",
  name: "Create budget",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: createBudgetAcceptance,
  scenarios: createBudgetScenarios,
  dataModel: {
    "launch.budgetId": { type: "string" },
    "launch.mode": { type: "string" },
    "launch.category": { type: "string" },
    "opt.alertAt80": { type: "boolean" },
    "opt.alertAt100": { type: "boolean" },
    "budget.limit": { type: "money", required: true, currency: "USD" },
    "budget.a80": { type: "boolean" },
    "budget.a100": { type: "boolean" },
  },
  integrations: [
    { id: "budgets", adapter: "bank.budgets.list", mode: "sandbox" },
    { id: "spend", adapter: "bank.spending.byCategory", mode: "sandbox" },
    { id: "create", adapter: "bank.budgets.create", mode: "sandbox" },
    { id: "update", adapter: "bank.budgets.update", mode: "sandbox" },
    { id: "remove", adapter: "bank.budgets.delete", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Budget", kind: "branch",
      onEnter: [
        set("budget.err", ""), set("budget.taken", ""), set("ctx.error", null),
        { type: "callApi", integration: "budgets", saveAs: "ctx.budgets", onError: toFail },
        { type: "callApi", integration: "spend", input: { days: 30 }, saveAs: "ctx.spend", onError: toFail },
        // a budget the bank does not know is a new budget; a category that already has one is ignored
        set("budget.id", "{{isEmpty(get(ctx.budgets, launch.budgetId)) ? '' : launch.budgetId}}"),
        set(MODE, "{{budget.id ? (launch.mode == 'delete' ? 'delete' : 'edit') : 'new'}}"),
        set("budget.category", "{{budget.id ? ctx.budgets[budget.id].name : (ctx.spend[launch.category].hasBudget == false ? launch.category : '')}}"),
        set("budget.limit", "{{budget.id ? ctx.budgets[budget.id].limit : null}}"),
        set("budget.a80", "{{budget.id ? ctx.budgets[budget.id].alert80 : true}}"),
        set("budget.a100", "{{budget.id ? ctx.budgets[budget.id].alert100 : true}}"),
        go("cat"),
      ],
      navigation: route([lacks("accounts.manage"), "denied"], [DELETE, "del"], [EDIT, "amt"], [`${NEW} && budget.category`, "amt"]),
      blocks: [],
    },
    {
      id: "cat", title: "Choose a category",
      onEnter: [set("budget.taken", "")],
      blocks: [
        text("Choose a category", "title"),
        alert("error", "You already have a budget for this category.", err("BUDGET_EXISTS")),
        alert("error", "Choose a category.", err("CATEGORY_REQUIRED")),
        {
          type: "menu", source: "ctx.spend",
          item: {
            label: "{{item.category}}",
            text: "{{item.hasBudget ? 'Budget set' : 'Spent in the last 30 days: ' + item.text}}",
            icon: "wallet",
            actions: [set("budget.category", "{{item.category}}"), set("budget.taken", "{{item.hasBudget}}"), set("budget.err", ""), { type: "navigate", to: "amt" }],
          },
        },
        button("Done", [{ type: "exit" }], "ghost"),
      ],
      // a category that has a budget cannot be chosen
      navigation: route(["budget.taken == 'true'", "taken"]),
    },
    { id: "taken", title: "Choose a category", kind: "branch", onEnter: [set("budget.err", "BUDGET_EXISTS"), set("budget.category", ""), go("cat")], blocks: [] },
    {
      id: "amt", title: "{{budget.category}}",
      blocks: [
        text("Monthly amount", "title"),
        text("{{budget.category}}", "body"),
        text("Spent in the last 30 days: {{ctx.spend[budget.category].text}}", "caption"),
        alert("error", "{{budget.errMsg}}", err("INVALID_AMOUNT")),
        {
          type: "amountInput", bind: "budget.limit", currency: "USD", label: "Amount per month",
          validation: { min: 10, max: 100000, messages: { min: "The smallest budget is $10.00.", max: "The most is $100,000.00." } },
        },
        button("Continue", [{ type: "validate" }, set("budget.err", ""), go("alerts")]),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "alerts", title: "Alerts",
      blocks: [
        text("Alerts", "title"),
        { type: "toggle", bind: "budget.a80", label: "Alert me at 80%", helper: "When you’ve used most of it", visibleWhen: "opt.alertAt80 != false" },
        { type: "toggle", bind: "budget.a100", label: "Alert me at 100%", helper: "When you reach the limit", visibleWhen: "opt.alertAt100 != false" },
        button("Create budget", [
          { type: "callApi", integration: "create", input: { category: "{{budget.category}}", limit: "{{budget.limit}}", alert80: "{{opt.alertAt80 != false && budget.a80}}", alert100: "{{opt.alertAt100 != false && budget.a100}}" }, saveAs: "budget.res", onError: toFail },
          go("success"),
        ], "primary", NEW),
        button("Save budget", [
          { type: "callApi", integration: "update", input: { budgetId: "{{budget.id}}", limit: "{{budget.limit}}", alert80: "{{opt.alertAt80 != false && budget.a80}}", alert100: "{{opt.alertAt100 != false && budget.a100}}" }, saveAs: "budget.res", onError: toFail },
          go("success"),
        ], "primary", EDIT),
        button("Back", [go("amt")], "ghost"),
      ],
    },
    {
      id: "del", title: "Delete this budget?",
      blocks: [
        text("Delete this budget?", "title"),
        { type: "reviewSummary", rows: [{ label: "Category", value: "{{budget.category}}" }, { label: "Amount per month", value: "{{budget.limit | money2:USD}}" }] },
        button("Delete budget", [{ type: "callApi", integration: "remove", input: { budgetId: "{{budget.id}}" }, onError: toFail }, go("success")]),
        button("Cancel", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "success", title: "Done", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Budget created", text: "{{budget.category}}: {{budget.limit | money2:USD}} a month.", visibleWhen: NEW },
        { type: "result", tone: "success", title: "Budget saved", text: "{{budget.category}}: {{budget.limit | money2:USD}} a month.", visibleWhen: EDIT },
        { type: "result", tone: "success", title: "Budget deleted", text: "{{budget.category}} is no longer tracked.", visibleWhen: DELETE },
        {
          type: "reviewSummary", visibleWhen: `${NEW} || ${EDIT}`,
          rows: [
            { label: "Category", value: "{{budget.category}}" }, { label: "Amount per month", value: "{{budget.limit | money2:USD}}" },
            { label: "Alert at 80%", value: onOff("opt.alertAt80 != false && budget.a80") }, { label: "Alert at 100%", value: onOff("opt.alertAt100 != false && budget.a100") },
          ],
        },
        button("See budgets", [{ type: "navigate", toJourney: "budgets" }]),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      // where a refusal goes: the form it belongs to, or a screen of its own (the bank not answering, or anything else, is the unavailable screen)
      id: "fail", title: "Budget", kind: "branch",
      onEnter: [set("budget.err", "{{ctx.error.code}}"), set("budget.errMsg", "{{ctx.error.message}}"), go("unavailable")],
      navigation: route(
        ["ctx.error.code == 'TIMEOUT'", "timeout"],
        ["ctx.error.code == 'BUDGET_EXISTS'", "exists"], ["ctx.error.code == 'BUDGET_NOT_FOUND'", "missing"],
        ["ctx.error.code == 'INVALID_AMOUNT'", "amt"], ["ctx.error.code == 'CATEGORY_REQUIRED'", "cat"],
      ),
      blocks: [],
    },
    {
      id: "exists", title: "Budget not created", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "You already have a budget for this category.", text: "Nothing was changed." },
        button("Choose category", [go("start")]),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "missing", title: "Budget not found", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We can’t find that budget.", text: "It may have been deleted. Nothing was changed." },
        button("See budgets", [{ type: "navigate", toJourney: "budgets" }]),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "timeout", title: "No answer in time", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "This is taking longer than expected", text: "This is taking longer than expected. Nothing was changed." },
        button("Try again", [go("start")]),
        button("Close", [{ type: "exit" }], "secondary"),
      ],
    },
    {
      id: "unavailable", title: "Not available right now", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "Not available right now", text: "This isn’t available right now. Nothing was changed. Try again in a few minutes." },
        button("Try again", [go("start")]),
        button("Close", [{ type: "exit" }], "secondary"),
      ],
    },
    denied("Budget"),
  ] as Screen[],
};
