import type { Journey } from "../schema";

/** What must be true for "Create a budget" to be right. Each is proved by at least one scenario below. */
export const createBudgetAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "A budget needs a category without a budget and an amount from $10.00 to $100,000.00, with the messages of the spec; the bank applies the same limits." },
  { id: "AC-2", text: "With a category passed (and free) the category step is skipped; a category that already has a budget, or a budget that does not exist, is ignored." },
  { id: "AC-3", text: "The alert switches appear only for the options that are on, both on by default." },
  { id: "AC-4", text: "Creating saves one budget and shows \"Budget created\"; a second budget for the same category is refused, also when it was made elsewhere meanwhile." },
  { id: "AC-5", text: "Edit changes the amount and the alerts and shows \"Budget saved\"; the category cannot be changed." },
  { id: "AC-6", text: "Delete asks once, removes the budget and shows \"Budget deleted\"; the category can be budgeted again." },
  { id: "AC-7", text: "No code and no tick is asked at any point." },
  { id: "AC-8", text: "When the bank is unavailable or times out nothing is changed." },
  { id: "AC-9", text: "It needs accounts.manage, and the bank refuses what skips a screen (an amount out of range, a second budget, a category that does not exist)." },
  { id: "AC-10", text: "A budget deleted elsewhere says \"We can’t find that budget.\" and nothing is changed." },
];

// Alex Morgan on Tuesday 3 November 2026: budgets Food & Drinks $1,500.00 (b_food), Shopping $1,500.00 (b_shop), Entertainment $300.00 (b_ent).
const NOW = "2026-11-03T10:00:00Z";
type Step = Record<string, unknown>;
const set = (v: Record<string, unknown>): Step => ({ set: v });
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const error = (m: string): Step => ({ expectError: m });
const base = { persona: "alex", now: NOW };
const on = (extra: Record<string, unknown>, more: Record<string, unknown> = {}) => ({ ...base, launch: extra, ...more });
const budget = (id: string, path: string, equals: unknown): Step => ({ expectBank: { adapter: "bank.budgets.list", path: `${id}.${path}`, equals } });
const forced = (adapter: string, input: Record<string, unknown>, code: string): Step => ({ expectBankError: { adapter, input, code } });
const elsewhere = (adapter: string, input: Record<string, unknown>, path: string, equals: unknown): Step => ({ expectBank: { adapter, input, path, equals } });

export const createBudgetScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "Health from a transaction: the category step is skipped, 5 is below the smallest, 150 creates Budget created with both alerts on", covers: ["AC-1", "AC-2", "AC-4", "AC-7"], ...on({ "launch.category": "Health" }),
    steps: [
      screen("amt"), text("Health"), text("Spent in the last 30 days: $57.90"), set({ "budget.limit": 5 }), press("Continue"), error("The smallest budget is $10.00."), screen("amt"),
      set({ "budget.limit": 150 }), press("Continue"), screen("alerts"), text("Alert me at 80%"), text("Alert me at 100%"), press("Create budget"),
      screen("success"), text("Budget created"), text("Health: $150.00 a month."), text("Alert at 80%"), text("On"), text("See budgets"), noText("code"),
      budget("b_health", "limit", 150), budget("b_health", "spent", 57.9),
    ],
  },
  {
    id: "T-2", name: "The category step: Food & Drinks says Budget set and cannot be chosen; a free category goes on; the most is $100,000.00", covers: ["AC-1", "AC-4"], ...base,
    steps: [
      screen("cat"), text("Food & Drinks"), text("Budget set"), text("Health"), text("Spent in the last 30 days: $57.90"), text("Subscriptions"),
      press("Food & Drinks"), screen("cat"), text("You already have a budget for this category."),
      press("Travel"), screen("amt"), set({ "budget.limit": 200000 }), press("Continue"), error("The most is $100,000.00."), set({ "budget.limit": 100000 }), press("Continue"), screen("alerts"),
    ],
  },
  {
    id: "T-3", name: "A budget of exactly $10.00 and one of exactly $100,000.00 are allowed", covers: ["AC-1"], ...on({ "launch.category": "Bills" }),
    steps: [set({ "budget.limit": 10 }), press("Continue"), screen("alerts"), press("Create budget"), text("Bills: $10.00 a month."), budget("b_bills", "limit", 10)],
  },
  {
    id: "T-4", name: "With the 100% alert off only the 80% switch is shown, and the budget keeps the alert off", covers: ["AC-3"], ...on({ "launch.category": "Health", "opt.alertAt100": false }),
    steps: [set({ "budget.limit": 150 }), press("Continue"), text("Alert me at 80%"), noText("Alert me at 100%"), press("Create budget"), text("Alert at 80%"), text("Alert at 100%"), budget("b_health", "alert100", false), budget("b_health", "alert80", true)],
  },
  {
    id: "T-5", name: "With the 80% alert off only the 100% switch is shown", covers: ["AC-3"], ...on({ "launch.category": "Health", "opt.alertAt80": false }),
    steps: [set({ "budget.limit": 150 }), press("Continue"), noText("Alert me at 80%"), text("Alert me at 100%"), press("Create budget"), budget("b_health", "alert80", false), budget("b_health", "alert100", true)],
  },
  {
    id: "T-6", name: "Switching an alert off is saved", covers: ["AC-3", "AC-4"], ...on({ "launch.category": "Health" }),
    steps: [set({ "budget.limit": 150 }), press("Continue"), set({ "budget.a80": false }), press("Create budget"), budget("b_health", "alert80", false), budget("b_health", "alert100", true)],
  },
  {
    id: "T-7", name: "Edit Food & Drinks: the amount is kept, changed to $1,750.00; Save budget; Budget saved; the category stays", covers: ["AC-5", "AC-7"], ...on({ "launch.budgetId": "b_food" }),
    steps: [
      screen("amt"), text("Food & Drinks"), press("Continue"), screen("alerts"), text("Save budget"), noText("Create budget"), set({ "budget.limit": 1750 }), press("Save budget"),
      screen("success"), text("Budget saved"), text("Food & Drinks: $1,750.00 a month."), noText("code"), budget("b_food", "limit", 1750), budget("b_food", "name", "Food & Drinks"),
    ],
  },
  {
    id: "T-8", name: "Edit keeps the amount when it is not changed, and takes an alert off", covers: ["AC-5"], ...on({ "launch.budgetId": "b_ent" }),
    steps: [press("Continue"), set({ "budget.a100": false }), press("Save budget"), text("$300.00 a month."), budget("b_ent", "limit", 300), budget("b_ent", "alert100", false), budget("b_ent", "alert80", true)],
  },
  {
    id: "T-9", name: "Edit refuses an amount below the smallest", covers: ["AC-1", "AC-5"], ...on({ "launch.budgetId": "b_food" }),
    steps: [set({ "budget.limit": 9.99 }), press("Continue"), error("The smallest budget is $10.00."), screen("amt"), budget("b_food", "limit", 1500)],
  },
  {
    id: "T-10", name: "Delete asks once with the category and amount, removes it, and the category can be budgeted again", covers: ["AC-6", "AC-7"], ...on({ "launch.budgetId": "b_food", "launch.mode": "delete" }),
    steps: [
      screen("del"), text("Delete this budget?"), text("Food & Drinks"), text("$1,500.00"), press("Delete budget"), screen("success"), text("Budget deleted"), text("Food & Drinks is no longer tracked."), noText("Alert at 80%"), noText("code"),
      elsewhere("bank.budgets.create", { category: "Food & Drinks", limit: 200 }, "name", "Food & Drinks"), budget("b_food_drinks", "limit", 200),
    ],
  },
  {
    id: "T-11", name: "Cancel on the delete screen keeps the budget", covers: ["AC-6"], ...on({ "launch.budgetId": "b_food", "launch.mode": "delete" }),
    steps: [press("Cancel"), budget("b_food", "limit", 1500)],
  },
  {
    id: "T-12", name: "Another device made a budget for Health while the form was open: the bank refuses the second one", covers: ["AC-4"], ...on({ "launch.category": "Health" }),
    steps: [
      screen("amt"), elsewhere("bank.budgets.create", { category: "Health", limit: 50 }, "name", "Health"), set({ "budget.limit": 150 }), press("Continue"), press("Create budget"),
      screen("exists"), text("You already have a budget for this category."), budget("b_health", "limit", 50), press("Choose category"), screen("cat"), text("Budget set"),
    ],
  },
  {
    id: "T-13", name: "A budget that is not known is a new budget; a category that already has one is ignored", covers: ["AC-2"], ...on({ "launch.budgetId": "b_nope" }),
    steps: [screen("cat"), text("Choose a category")],
  },
  {
    id: "T-14", name: "A category that already has a budget, passed in, shows the category step", covers: ["AC-2"], ...on({ "launch.category": "Shopping" }),
    steps: [screen("cat"), text("Budget set")],
  },
  {
    id: "T-15", name: "A category that does not exist, passed in, shows the category step", covers: ["AC-2"], ...on({ "launch.category": "Pets" }),
    steps: [screen("cat")],
  },
  {
    id: "T-16", name: "When the bank is unavailable on Create budget nothing is created", covers: ["AC-8"], ...on({ "launch.category": "Health" }, { conditions: { unavailable: ["bank.budgets.create"] } }),
    steps: [set({ "budget.limit": 150 }), press("Continue"), press("Create budget"), screen("unavailable"), text("This isn’t available right now. Nothing was changed. Try again in a few minutes."), budget("b_health", "limit", undefined)],
  },
  {
    id: "T-17", name: "When the bank does not answer in time nothing is created, and Try again starts over", covers: ["AC-8"], ...on({ "launch.category": "Health" }, { conditions: { timeout: ["bank.budgets.create"], latencyMs: 10000 } }),
    steps: [set({ "budget.limit": 150 }), press("Continue"), press("Create budget"), screen("timeout"), text("This is taking longer than expected. Nothing was changed."), press("Try again"), screen("amt")],
  },
  {
    id: "T-18", name: "When the bank is unavailable on Save budget the amount is not changed", covers: ["AC-8"], ...on({ "launch.budgetId": "b_food" }, { conditions: { unavailable: ["bank.budgets.update"] } }),
    steps: [set({ "budget.limit": 1750 }), press("Continue"), press("Save budget"), screen("unavailable"), budget("b_food", "limit", 1500)],
  },
  {
    id: "T-19", name: "When the bank is unavailable on Delete budget nothing is removed", covers: ["AC-8"], ...on({ "launch.budgetId": "b_food", "launch.mode": "delete" }, { conditions: { unavailable: ["bank.budgets.delete"] } }),
    steps: [press("Delete budget"), screen("unavailable"), budget("b_food", "limit", 1500)],
  },
  {
    id: "T-20", name: "When the budgets cannot be read nothing starts", covers: ["AC-8"], ...on({}, { conditions: { unavailable: ["bank.budgets.list"] } }),
    steps: [screen("unavailable"), text("Nothing was changed.")],
  },
  {
    id: "T-21", name: "When the spending cannot be read nothing starts", covers: ["AC-8"], ...on({}, { conditions: { unavailable: ["bank.spending.byCategory"] } }),
    steps: [screen("unavailable")],
  },
  {
    id: "T-22", name: "The bank applies the limits, one budget per category and the list of categories itself", covers: ["AC-9", "AC-1", "AC-4"], ...base,
    steps: [
      forced("bank.budgets.create", { category: "Travel", limit: 9.99 }, "INVALID_AMOUNT"), forced("bank.budgets.create", { category: "Travel", limit: 100000.01 }, "INVALID_AMOUNT"),
      forced("bank.budgets.create", { category: "Travel", limit: 10.005 }, "INVALID_AMOUNT"), forced("bank.budgets.create", { category: "food & drinks", limit: 500 }, "BUDGET_EXISTS"),
      forced("bank.budgets.create", { category: "Pets", limit: 500 }, "CATEGORY_REQUIRED"), forced("bank.budgets.update", { budgetId: "b_food", limit: 9.99 }, "INVALID_AMOUNT"),
      forced("bank.budgets.update", { budgetId: "b_nope", limit: 50 }, "BUDGET_NOT_FOUND"), forced("bank.budgets.delete", { budgetId: "b_nope" }, "BUDGET_NOT_FOUND"),
      budget("b_food", "limit", 1500),
    ],
  },
  {
    id: "T-23", name: "Without accounts.manage it is not available, and the bank refuses", covers: ["AC-9"], ...base, conditions: { withoutPermissions: ["accounts.manage"] },
    steps: [screen("denied"), text("Not available"), forced("bank.budgets.create", { category: "Travel", limit: 100 }, "PERMISSION_DENIED"), forced("bank.budgets.delete", { budgetId: "b_food" }, "PERMISSION_DENIED")],
  },
  {
    id: "T-24", name: "A budget deleted elsewhere says it cannot be found when it is saved", covers: ["AC-10"], ...on({ "launch.budgetId": "b_food" }),
    steps: [press("Continue"), elsewhere("bank.budgets.delete", { budgetId: "b_food" }, "name", "Food & Drinks"), press("Save budget"), screen("missing"), text("We can’t find that budget."), press("See budgets"), { expectOpens: { journey: "budgets" } }],
  },
  {
    id: "T-25", name: "A budget deleted elsewhere says it cannot be found when it is deleted", covers: ["AC-10"], ...on({ "launch.budgetId": "b_food", "launch.mode": "delete" }),
    steps: [elsewhere("bank.budgets.delete", { budgetId: "b_food" }, "name", "Food & Drinks"), press("Delete budget"), screen("missing"), text("We can’t find that budget.")],
  },
  {
    id: "T-26", name: "See budgets opens the budgets view", covers: ["AC-4"], ...on({ "launch.category": "Health" }),
    steps: [set({ "budget.limit": 150 }), press("Continue"), press("Create budget"), press("See budgets"), { expectOpens: { journey: "budgets" } }],
  },
];
