import type { Block, Journey, Screen } from "../schema";
import { saveBorrowAcceptance, saveBorrowScenarios } from "./save-borrow-tests";
import { button, denied, go, holds, lacks, route, row, set, text } from "./save-kit";

/** A section is drawn only when its option is on, its journey is allowed (the bank has not switched it off) and the person holds the permission of the journey. */
const allowed = (journey: string, permission: string) => `!has(ctx.cfg.disabled, '${journey}') && ${holds(permission)}`;
const GOALS = `opt.showGoals != false && ${allowed("savings-goal", "payments.create")}`;
const DEPOSITS = `opt.showDeposits != false && ${allowed("term-deposit", "payments.create")}`;
const LOANS = `opt.showLoans != false && ${allowed("apply-loan", "loans.apply")}`;
const INVEST = `opt.showInvest != false && ${allowed("invest", "payments.create")}`;
const REPAY = allowed("repay-loan", "payments.create");
const SELL = `${allowed("sell-investment", "payments.create")} && ctx.pf.count > 0`;
const open = (journey: string, values: Record<string, unknown> = {}) => [{ type: "navigate" as const, toJourney: journey, ...(Object.keys(values).length ? { with: values } : {}) }];
const empty = (title: string, line: string, label: string, actions: any[], when: string): Block[] => [
  text(title, "title", when), text(line, "body", when), button(label, actions, "primary", when),
];

/**
 * Save (BankWorkx, Personal: Save & Borrow). A view, not a form: what the customer saves, owes and invests on one screen, in four sections in a fixed order (Savings goals, Term
 * deposits, Loans, Investments), each with its key number and the next action. A section is drawn when its option is on, its journey is allowed and the person may use it; with none
 * left the screen says "Nothing to show". Nothing here moves money.
 *
 * Built from the spec of the prototype with the blocks FinX has: a card is a row (what it holds in its second line) and each button is a row of its own under it; the bar is "{n}% saved"
 * or "{n}% repaid" in words (the engine has no bar); the skeleton and the failure of one section on its own are not built, so a section that cannot be read fails the whole screen
 * with Try again. The shell's own Save tab is unchanged; this journey is the view a bank can switch off.
 */
export const saveBorrow: Journey = {
  id: "jrn_bankworkx_save_borrow",
  slug: "save-borrow",
  name: "Save",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: saveBorrowAcceptance,
  scenarios: saveBorrowScenarios,
  dataModel: {
    "opt.showGoals": { type: "boolean" },
    "opt.showDeposits": { type: "boolean" },
    "opt.showLoans": { type: "boolean" },
    "opt.showInvest": { type: "boolean" },
  },
  integrations: [
    { id: "cfg", adapter: "bank.app.config", mode: "sandbox" },
    { id: "goals", adapter: "bank.goals.list", mode: "sandbox" },
    { id: "deposits", adapter: "bank.deposits.list", mode: "sandbox" },
    { id: "loans", adapter: "bank.loans.list", mode: "sandbox" },
    { id: "pf", adapter: "bank.funds.portfolio", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Save", kind: "branch",
      onEnter: [
        set("ctx.error", null),
        { type: "callApi", integration: "cfg", saveAs: "ctx.cfg", onError: { navigate: "loadFail" } },
        { type: "callApi", integration: "goals", saveAs: "ctx.goals", onError: { navigate: "loadFail" } },
        { type: "callApi", integration: "deposits", saveAs: "ctx.deps", onError: { navigate: "loadFail" } },
        { type: "callApi", integration: "loans", saveAs: "ctx.loans", onError: { navigate: "loadFail" } },
        { type: "callApi", integration: "pf", saveAs: "ctx.pf", onError: { navigate: "loadFail" } },
        go("list"),
      ],
      navigation: route([lacks("accounts.view"), "denied"]),
      blocks: [],
    },
    {
      id: "list", title: "Save",
      blocks: [
        text("Save", "title"),
        // 1. savings goals
        { type: "sectionHeader", title: "Savings goals", visibleWhen: GOALS },
        row("newGoal", "New goal", "Set a target and watch it grow", open("savings-goal", { "launch.mode": "create" }), `${GOALS} && len(ctx.goals) > 0`),
        { type: "menu", source: "ctx.goals", visibleWhen: `${GOALS} && len(ctx.goals) > 0`, item: { label: "{{item.name}}", text: "{{item.savedText}} {{item.ofText}} · {{item.pctText}} · {{item.line}}", icon: "wallet", actions: [] } },
        { type: "menu", source: "ctx.goals", visibleWhen: `${GOALS} && len(ctx.goals) > 0`, item: { label: "Add money to {{item.name}}", text: "From one of your accounts", icon: "plus", actions: open("savings-goal", { "launch.mode": "add", "launch.goalId": "{{item.id}}" }) } },
        { type: "menu", source: "ctx.goals", visibleWhen: `${GOALS} && len(ctx.goals) > 0`, item: { label: "Edit {{item.name}}", text: "Name, target, month and top-up", icon: "settings", actions: open("savings-goal", { "launch.mode": "edit", "launch.goalId": "{{item.id}}" }) } },
        ...empty("No savings goals", "Set a target and watch it grow.", "Create a goal", open("savings-goal", { "launch.mode": "create" }), `${GOALS} && len(ctx.goals) == 0`),
        // 2. term deposits
        { type: "sectionHeader", title: "Term deposits", visibleWhen: DEPOSITS },
        row("openDeposit", "Open", "A new term deposit", open("term-deposit", { "launch.mode": "open" }), `${DEPOSITS} && len(ctx.deps) > 0`),
        { type: "menu", source: "ctx.deps", visibleWhen: `${DEPOSITS} && len(ctx.deps) > 0`, item: { label: "{{item.title}} · {{item.amountText}}", text: "{{item.line}}{{item.renewalText ? ' · ' + item.renewalText : ''}}", icon: "bank", actions: [] } },
        { type: "menu", source: "ctx.deps", visibleWhen: `${DEPOSITS} && len(ctx.deps) > 0`, item: { label: "Renew the {{item.amountText}} deposit", text: "Change the term or what happens at maturity", icon: "repeat", actions: open("term-deposit", { "launch.mode": "renew", "launch.depositId": "{{item.id}}" }) } },
        { type: "menu", source: "ctx.deps", visibleWhen: `${DEPOSITS} && len(ctx.deps) > 0`, item: { label: "Close the {{item.amountText}} deposit", text: "With the early closure charge shown first", icon: "down", actions: open("term-deposit", { "launch.mode": "close", "launch.depositId": "{{item.id}}" }) } },
        ...empty("No term deposits", "Lock money away for a fixed rate.", "Open a term deposit", open("term-deposit", { "launch.mode": "open" }), `${DEPOSITS} && len(ctx.deps) == 0`),
        // 3. loans
        { type: "sectionHeader", title: "Loans", visibleWhen: LOANS },
        row("apply", "Apply", "For a loan", open("apply-loan"), `${LOANS} && len(ctx.loans) > 0`),
        { type: "menu", source: "ctx.loans", visibleWhen: `${LOANS} && len(ctx.loans) > 0`, item: { label: "{{item.name}}", text: "{{item.leftText}} · {{item.pctText}} · {{item.nextText}}", icon: "home", actions: [] } },
        { type: "menu", source: "ctx.loans", visibleWhen: `${LOANS} && len(ctx.loans) > 0 && ${REPAY}`, item: { label: "Repay {{item.name}}", text: "The next payment, another amount or in full", icon: "dollar", actions: open("repay-loan", { "launch.loanId": "{{item.id}}" }) } },
        ...empty("No loans", "Borrow when you need to, with a clear monthly payment.", "Apply for a loan", open("apply-loan"), `${LOANS} && len(ctx.loans) == 0`),
        // 4. investments
        { type: "sectionHeader", title: "Investments", visibleWhen: INVEST },
        text("Portfolio", "caption", `${INVEST} && ctx.pf.count > 0`),
        text("{{ctx.pf.valueText}}", "title", `${INVEST} && ctx.pf.count > 0`),
        text("{{ctx.pf.gainText}}", "body", `${INVEST} && ctx.pf.count > 0`),
        row("invest", "Invest", "Put money into a fund", open("invest"), `${INVEST} && ctx.pf.count > 0`),
        row("sell", "Sell", "Sell part or all of a holding", open("sell-investment"), `${INVEST} && ${SELL}`),
        ...empty("No investments yet", "Start with as little as $50.", "Start investing", open("invest"), `${INVEST} && !(ctx.pf.count > 0)`),
        // nothing at all
        text("Nothing to show", "title", `!(${GOALS}) && !(${DEPOSITS}) && !(${LOANS}) && !(${INVEST})`),
        text("Savings and borrowing aren’t available right now.", "body", `!(${GOALS}) && !(${DEPOSITS}) && !(${LOANS}) && !(${INVEST})`),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "loadFail", title: "Save",
      blocks: [
        text("We couldn’t load this.", "title"),
        text("This is taking longer than expected. Nothing was changed.", "body", "ctx.error.code == 'TIMEOUT'"),
        text("Nothing was changed. Please try again.", "body", "ctx.error.code != 'TIMEOUT'"),
        button("Try again", [go("start")]),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    denied("Save"),
  ] as Screen[],
};
