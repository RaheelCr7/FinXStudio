import type { Journey } from "../schema";

/** What must be true for "Budgets" to be right. Each is proved by at least one scenario below. */
export const budgetsAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "Each budget shows the category, spent of amount for the last 30 days, how much of it is used and a chip." },
  { id: "AC-2", text: "The chip is \"On track\" below 80%, \"Close to limit\" from 80% and \"Over budget\" from 100%, and the bar never shows more than 100%." },
  { id: "AC-3", text: "With no budgets the empty state shows with one button Create a budget." },
  { id: "AC-4", text: "Edit and Delete open create-budget for that budget; New budget opens it for a new one." },
  { id: "AC-5", text: "New budget is hidden when all 8 categories have a budget." },
  { id: "AC-6", text: "When the bank is unavailable or does not answer in time the error state shows with Try again and nothing is changed." },
  { id: "AC-7", text: "It needs accounts.view; Edit, Delete and New budget are offered only with accounts.manage." },
];

// Alex Morgan on Tuesday 3 November 2026: Food & Drinks $525.00 of $1,500.00, Shopping $450.00 of $1,500.00, Entertainment $272.00 of $300.00.
const NOW = "2026-11-03T10:00:00Z";
type Step = Record<string, unknown>;
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const base = { persona: "alex", now: NOW };
const edges = { persona: "alexaccounts", now: NOW };

export const budgetsScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "Three budgets in the order created, each with spent of amount, how much is used and a chip", covers: ["AC-1", "AC-2"], ...base,
    steps: [
      screen("list"), text("Budgets"), text("Food & Drinks"), text("$525.00 of $1,500.00 · last 30 days · On track · 35% used"), text("Shopping"), text("$450.00 of $1,500.00 · last 30 days · On track · 30% used"),
      text("Entertainment"), text("$272.00 of $300.00 · last 30 days · Close to limit · 90% used"), noText("Over budget"), text("New budget"),
    ],
  },
  {
    id: "T-2", name: "At the edges: 79.99% is on track, exactly 80% and 99.99% are close, exactly 100% and far over are over, and the bar stops at 100%", covers: ["AC-2"], ...edges,
    steps: [
      text("$79.99 of $100.00 · last 30 days · On track · 79% used"), text("$80.00 of $100.00 · last 30 days · Close to limit · 80% used"), text("$99.99 of $100.00 · last 30 days · Close to limit · 99% used"),
      text("$100.00 of $100.00 · last 30 days · Over budget · 100% used"), text("$320.00 of $100.00 · last 30 days · Over budget · 100% used"), text("$32.00 of $40.00 · last 30 days · Close to limit · 80% used"),
      text("$0.00 of $1,000.00 · last 30 days · On track · 0% used"), noText("320% used"),
    ],
  },
  {
    id: "T-3", name: "A budget opens to its detail with a chip, what is left and how much is used", covers: ["AC-1", "AC-2"], ...base,
    steps: [press("Entertainment"), screen("detail"), text("Close to limit"), text("$272.00"), text("$300.00"), text("$28.00"), text("90%"), press("Back"), screen("list")],
  },
  {
    id: "T-4", name: "A budget over its amount shows Over budget and a full bar, nothing left", covers: ["AC-2"], ...edges,
    steps: [press("Travel"), text("Over budget"), text("100%"), text("$0.00"), noText("320%")],
  },
  {
    id: "T-5", name: "With no budgets the empty state shows with Create a budget, which opens create-budget", covers: ["AC-3", "AC-4"], ...base,
    setup: [{ adapter: "bank.budgets.delete", input: { budgetId: "b_food" } }, { adapter: "bank.budgets.delete", input: { budgetId: "b_shop" } }, { adapter: "bank.budgets.delete", input: { budgetId: "b_ent" } }],
    steps: [screen("empty"), text("No budgets yet"), text("Set a monthly amount for a category and we’ll tell you as you get close."), noText("New budget"), press("Create a budget"), { expectOpens: { journey: "create-budget" } }, screen("cat")],
  },
  {
    id: "T-6", name: "Edit opens create-budget for that budget, with its amount", covers: ["AC-4"], ...base,
    steps: [press("Entertainment"), press("Edit"), { expectOpens: { journey: "create-budget", with: { "launch.budgetId": "b_ent" } } }, screen("amt"), text("Entertainment")],
  },
  {
    id: "T-7", name: "Delete opens create-budget in its delete mode for that budget", covers: ["AC-4"], ...base,
    steps: [press("Food & Drinks"), press("Delete"), { expectOpens: { journey: "create-budget", with: { "launch.budgetId": "b_food", "launch.mode": "delete" } } }, screen("del"), text("Delete this budget?")],
  },
  {
    id: "T-8", name: "New budget opens create-budget for a new one", covers: ["AC-4"], ...base,
    steps: [press("New budget"), { expectOpens: { journey: "create-budget" } }, screen("cat"), text("Choose a category")],
  },
  {
    id: "T-9", name: "New budget is hidden when all 8 categories have a budget", covers: ["AC-5"], ...edges,
    steps: [screen("list"), text("Subscriptions"), noText("New budget")],
  },
  {
    id: "T-10", name: "When the bank is unavailable the error state shows with Try again", covers: ["AC-6"], ...base, conditions: { unavailable: ["bank.budgets.list"] },
    steps: [screen("loadFail"), text("We couldn’t load your budgets"), text("Nothing was changed. Try again in a moment."), noText("Food & Drinks"), press("Try again"), screen("loadFail")],
  },
  {
    id: "T-11", name: "When the bank does not answer in time it says so", covers: ["AC-6"], ...base, conditions: { timeout: ["bank.budgets.list"], latencyMs: 10000 },
    steps: [screen("loadFail"), text("We couldn’t load your budgets"), text("This is taking longer than expected. Nothing was changed."), press("Try again"), screen("loadFail")],
  },
  {
    id: "T-12", name: "Without accounts.view it is not available", covers: ["AC-7"], ...base, conditions: { withoutPermissions: ["accounts.view"] },
    steps: [screen("denied"), text("Not available"), noText("Food & Drinks")],
  },
  {
    id: "T-13", name: "Without accounts.manage the budgets show but there is no New budget, Edit or Delete", covers: ["AC-7"], ...base, conditions: { withoutPermissions: ["accounts.manage"] },
    steps: [screen("list"), text("Food & Drinks"), noText("New budget"), press("Food & Drinks"), screen("detail"), noText("Edit"), noText("Delete")],
  },
];
