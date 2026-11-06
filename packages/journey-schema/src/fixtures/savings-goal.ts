import type { Journey, Screen } from "../schema";
import { savingsGoalAcceptance, savingsGoalScenarios } from "./savings-goal-tests";
import { alert, answerScreens, button, denied, go, lacks, payIntegration, route, set, text } from "./save-kit";

const err = (e: string) => `sg.err == '${e}'`;
const TIMEOUT = "We didn’t get an answer in time. Check your goal before you try again.";
const G = "ctx.goals.items[sg.goalId]";
const summary = (rows: [string, string][]) => ({ type: "reviewSummary" as const, rows: rows.map(([label, value]) => ({ label, value })) });
const view = (label: string, to: string) => button(label, [{ type: "navigate", toJourney: to }], "secondary");
const AUTO = "sg.auto && opt.allowAuto != false";
/** Which kind of problem a bank refusal is: what the person can fix on a screen has its place, the rest is a plain failure. */
const KIND = "{{ctx.error.code == 'GOAL_NOT_FOUND' ? 'gone' : ctx.error.code == 'GOAL_LIMIT' ? 'limit' : ctx.error.code == 'NAME_INVALID' || ctx.error.code == 'TARGET_BELOW' || ctx.error.code == 'TARGET_ABOVE' || ctx.error.code == 'DATE_REQUIRED' || ctx.error.code == 'DATE_INVALID' ? 'goal' : ctx.error.code == 'AUTO_OFF' || ctx.error.code == 'AUTO_REQUIRED' || ctx.error.code == 'AUTO_BELOW' ? 'plan' : ctx.error.code == 'AMOUNT_REQUIRED' || ctx.error.code == 'AMOUNT_DECIMALS' || ctx.error.code == 'AMOUNT_BELOW' || ctx.error.code == 'ABOVE_SAVED' || ctx.error.code == 'WITHDRAW_OFF' || ctx.error.code == 'INSUFFICIENT_FUNDS' || ctx.error.code == 'ACCOUNT_NOT_FOUND' || ctx.error.code == 'ACCOUNT_CANNOT_DEBIT' || ctx.error.code == 'ACCOUNT_CANNOT_CREDIT' ? (sg.mode == 'create' || sg.mode == 'edit' ? 'plan' : 'move') : ''}}";

/**
 * Savings goal (BankWorkx, Personal: Save & Borrow). Four modes: create a goal (a name, a target, a month, then the saving plan with an automatic monthly top-up), edit one,
 * add money to one from an account, take money out. No one-time code is asked in any mode: the money stays the customer's, and the bank asks for none either.
 *
 * Built from the spec of the prototype with the blocks FinX has: the plan line ("To get there by 30 Jun 2027", the monthly amount) is the bank's answer when Continue is
 * pressed on the goal screen (the engine has no live redraw while typing); the monthly amount is filled with the bank's figure when the screen opens, so switching the toggle on
 * shows it; the bank's refusals (not enough money, more than is saved, taking out switched off) are a line above the fields; an empty choice of goal says "Required" (the
 * engine's word); the monthly top-up is only data (nothing moves on the 1st in the sandbox).
 */
export const savingsGoal: Journey = {
  id: "jrn_bankworkx_savings_goal",
  slug: "savings-goal",
  name: "Savings goal",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: savingsGoalAcceptance,
  scenarios: savingsGoalScenarios,
  dataModel: {
    "launch.mode": { type: "string" },
    "launch.goalId": { type: "string" },
    "opt.allowAuto": { type: "boolean" },
    "opt.allowWithdraw": { type: "boolean" },
    "sg.mode": { type: "string" },
    "sg.goalId": { type: "string", required: true },
    "sg.name": { type: "string", required: true },
    "sg.target": { type: "money", currency: "USD", required: true },
    "sg.date": { type: "string", required: true },
    "sg.auto": { type: "boolean" },
    "sg.amount": { type: "money", currency: "USD", required: true },
    "sg.from": { type: "string", required: true },
    "sg.move": { type: "money", currency: "USD", required: true },
    "sg.into": { type: "string", required: true },
    "sg.err": { type: "string" },
    "sg.msg": { type: "string" },
  },
  integrations: [
    { id: "goals", adapter: "bank.goals.list", mode: "sandbox" },
    payIntegration,
    { id: "months", adapter: "bank.goals.months", mode: "sandbox" },
    { id: "plan", adapter: "bank.goals.plan", mode: "sandbox" },
    { id: "create", adapter: "bank.goals.create", mode: "sandbox" },
    { id: "update", adapter: "bank.goals.update", mode: "sandbox" },
    { id: "contribute", adapter: "bank.goals.contribute", mode: "sandbox" },
    { id: "withdraw", adapter: "bank.goals.withdraw", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Savings goal", kind: "branch",
      onEnter: [
        set("sg.err", ""), set("sg.msg", ""), set("sg.name", ""), set("sg.target", null), set("sg.date", ""), set("sg.auto", false), set("sg.amount", null), set("sg.move", null), set("ctx.error", null),
        { type: "callApi", integration: "goals", input: { pick: true }, saveAs: "ctx.goals", onError: { navigate: "fail" } },
        { type: "callApi", integration: "pay", saveAs: "ctx.pay", onError: { navigate: "fail" } },
        set("sg.mode", "{{launch.mode == 'edit' || launch.mode == 'add' || launch.mode == 'withdraw' ? launch.mode : 'create'}}"),
        set("sg.from", "{{ctx.pay.defaultId}}"), set("sg.into", "{{ctx.pay.defaultId}}"),
        // a goal passed in is used when it is one of the person's; with only one goal there is nothing to choose
        set("sg.goalId", "{{has(ctx.goals.items, launch.goalId) ? launch.goalId : len(ctx.goals.items) == 1 ? ctx.goals.firstId : ''}}"),
        go("open"),
      ],
      navigation: route([lacks("payments.create"), "denied"], ["sg.mode == 'create'", "goal"], ["len(ctx.goals.items) == 0", "none"], ["isEmpty(sg.goalId)", "pick"]),
      blocks: [],
    },
    {
      id: "none", title: "Savings goal", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "You have no goals yet.", text: "Set a target and watch it grow." },
        button("Create a goal", [set("launch.mode", "create"), go("start")]),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "pick", title: "Choose a goal",
      blocks: [
        text("Choose a goal", "title"),
        { type: "select", bind: "sg.goalId", label: "Goal", source: "ctx.goals.items", variant: "rows" },
        button("Continue", [{ type: "validate" }, go("open")]),
        button("Back", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      // the goal chosen: an edit starts with its values, an addition and a withdrawal with their card
      id: "open", title: "Savings goal", kind: "branch",
      onEnter: [
        set("sg.name", `{{sg.mode == 'edit' ? ${G}.name : ''}}`), set("sg.target", `{{sg.mode == 'edit' ? ${G}.target : null}}`), set("sg.date", `{{sg.mode == 'edit' ? ${G}.targetDate : ''}}`),
        set("sg.auto", `{{sg.mode == 'edit' ? ${G}.autoOn : false}}`), set("sg.amount", `{{sg.mode == 'edit' && ${G}.autoOn ? ${G}.autoAmount : null}}`),
        set("sg.from", `{{sg.mode == 'edit' && ${G}.autoOn ? ${G}.autoFrom : ctx.pay.defaultId}}`),
        go("move"),
      ],
      navigation: route(["sg.mode == 'edit'", "goal"], ["sg.mode == 'withdraw'", "out"]),
      blocks: [],
    },
    {
      id: "goal", title: "Your goal",
      onEnter: [{ type: "callApi", integration: "months", saveAs: "ctx.months", onError: { navigate: "fail" } }],
      blocks: [
        text("Your goal", "title"),
        alert("error", "You can have up to 10 goals. Close one to add another.", err("limit")),
        alert("error", "{{sg.msg}}", err("goal")),
        { type: "textInput", bind: "sg.name", label: "Name", placeholder: "For example, New laptop", pattern: "^.{2,30}$", patternMessage: "Use 2 to 30 characters." },
        {
          type: "amountInput", bind: "sg.target", currency: "USD", label: "Target amount",
          validation: { min: 50, max: 1000000, messages: { min: "The smallest target is $50.00.", max: "The largest target is $1,000,000.00." } },
        },
        { type: "select", bind: "sg.date", label: "Target date", source: "ctx.months.months", variant: "dropdown" },
        // the bank works out what it takes; with ten goals already a new one is refused here, as the bank itself refuses it at the end
        button("Continue", [
          { type: "validate" },
          set("sg.err", "{{sg.mode == 'create' && len(ctx.goals.items) >= 10 ? 'limit' : ''}}"),
          { type: "callApi", integration: "plan", input: { target: "{{sg.target}}", date: "{{sg.date}}", saved: `{{sg.mode == 'edit' ? ${G}.saved : 0}}` }, saveAs: "ctx.plan", onError: { navigate: "fail" } },
          set("sg.amount", "{{sg.mode == 'edit' && sg.auto ? sg.amount : ctx.plan.suggested}}"),
          { type: "navigate" },
        ]),
        button("Cancel", [{ type: "exit" }], "ghost"),
      ],
      navigation: route(["sg.err == 'limit'", "goal"], ["true", "fund"]),
    },
    {
      id: "fund", title: "Saving plan",
      blocks: [
        text("Saving plan", "title"),
        alert("error", "{{sg.msg}}", err("plan")),
        text("{{ctx.plan.line}}", "body"),
        text("{{ctx.plan.monthlyText}}", "title", "!isEmpty(ctx.plan.monthlyText)"),
        { type: "toggle", bind: "sg.auto", label: "Add automatically every month", helper: "On the 1st of each month", visibleWhen: "opt.allowAuto != false" },
        {
          type: "amountInput", bind: "sg.amount", currency: "USD", label: "Monthly amount", visibleWhen: AUTO,
          validation: { min: 5, messages: { min: "The smallest amount is $5.00." } },
        },
        { type: "select", bind: "sg.from", label: "Take it from", source: "ctx.pay.accounts", variant: "rows", visibleWhen: AUTO },
        button("Save goal", [{ type: "validate" }, set("sg.err", ""), go("save")]),
        button("Back", [set("sg.err", ""), go("goal")], "ghost"),
      ],
    },
    {
      id: "save", title: "Savings goal", kind: "branch",
      onEnter: [go("doCreate")],
      navigation: route(["sg.mode == 'edit'", "doEdit"]),
      blocks: [],
    },
    {
      id: "doCreate", title: "Savings goal", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "create", input: { name: "{{sg.name}}", target: "{{sg.target}}", date: "{{sg.date}}", autoOn: `{{${AUTO}}}`, autoAmount: "{{sg.amount}}", fromAccountId: "{{sg.from}}", allowAuto: "{{opt.allowAuto != false}}" }, saveAs: "sg.res", onError: { navigate: "fail" } },
        go("doneCreate"),
      ],
      blocks: [],
    },
    {
      id: "doEdit", title: "Savings goal", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "update", input: { goalId: "{{sg.goalId}}", name: "{{sg.name}}", target: "{{sg.target}}", date: "{{sg.date}}", autoOn: `{{${AUTO}}}`, autoAmount: "{{sg.amount}}", fromAccountId: "{{sg.from}}", allowAuto: "{{opt.allowAuto != false}}" }, saveAs: "sg.res", onError: { navigate: "fail" } },
        go("doneEdit"),
      ],
      blocks: [],
    },
    {
      id: "move", title: "Add money",
      blocks: [
        text("Add money", "title"),
        alert("error", "{{sg.msg}}", err("move")),
        summary([["Goal", `{{${G}.name}}`], ["Saved", `{{${G}.savedText}}`], ["Target", `{{${G}.targetText}}`]]),
        {
          type: "amountInput", bind: "sg.move", currency: "USD", label: "Amount",
          validation: { min: 1, messages: { min: "The smallest amount is $1.00." } },
        },
        { type: "select", bind: "sg.from", label: "From", source: "ctx.pay.accounts", variant: "rows" },
        button("Add money", [
          { type: "validate" }, set("sg.err", ""),
          { type: "callApi", integration: "contribute", input: { goalId: "{{sg.goalId}}", amount: "{{sg.move}}", fromAccountId: "{{sg.from}}" }, saveAs: "sg.res", onError: { navigate: "fail" } },
          go("doneAdd"),
        ]),
        button("Back", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "out", title: "Take money out",
      blocks: [
        text("Take money out", "title"),
        alert("error", "{{sg.msg}}", err("move")),
        summary([["Goal", `{{${G}.name}}`], ["Saved", `{{${G}.savedText}}`]]),
        {
          type: "amountInput", bind: "sg.move", currency: "USD", label: "Amount",
          validation: { min: 1, messages: { min: "The smallest amount is $1.00." } },
        },
        { type: "select", bind: "sg.into", label: "Into", source: "ctx.pay.accounts", variant: "rows" },
        button("Take money out", [
          { type: "validate" }, set("sg.err", ""),
          { type: "callApi", integration: "withdraw", input: { goalId: "{{sg.goalId}}", amount: "{{sg.move}}", toAccountId: "{{sg.into}}", allowWithdraw: "{{opt.allowWithdraw != false}}" }, saveAs: "sg.res", onError: { navigate: "fail" } },
          go("doneOut"),
        ]),
        button("Back", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "doneCreate", title: "Goal created", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Goal created", text: "{{sg.res.name}} is ready. Add money any time.", meta: "Reference {{sg.res.reference}}" },
        summary([["Goal", "{{sg.res.name}}"], ["Target", "{{sg.res.targetText}}"], ["By", "{{sg.res.byText}}"], ["Monthly top-up", "{{sg.res.autoText}}"]]),
        button("Add money", [{ type: "navigate", toJourney: "savings-goal", with: { "launch.mode": "add", "launch.goalId": "{{sg.res.goalId}}" } }]),
        view("View goals", "save-borrow"),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "doneEdit", title: "Goal updated", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Goal updated", text: "{{sg.res.name}} is up to date.", meta: "Reference {{sg.res.reference}}" },
        summary([["Goal", "{{sg.res.name}}"], ["Target", "{{sg.res.targetText}}"], ["By", "{{sg.res.byText}}"], ["Monthly top-up", "{{sg.res.autoText}}"]]),
        view("View goals", "save-borrow"),
        button("Done", [{ type: "exit" }]),
      ],
    },
    {
      id: "doneAdd", title: "Money added", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Money added", text: "{{sg.res.amountText}} is now in {{sg.res.goalName}}.", meta: "Reference {{sg.res.reference}}", visibleWhen: "!sg.res.reached" },
        { type: "result", tone: "success", title: "Money added", text: "{{sg.res.reachedText}}", meta: "Reference {{sg.res.reference}}", visibleWhen: "sg.res.reached" },
        summary([["Goal", "{{sg.res.goalName}}"], ["From", "{{sg.res.fromName}}"], ["Amount", "{{sg.res.amountText}}"], ["Saved so far", "{{sg.res.savedText}}"]]),
        view("View goals", "save-borrow"),
        button("Done", [{ type: "exit" }]),
      ],
    },
    {
      id: "doneOut", title: "Money taken out", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Money taken out", text: "{{sg.res.amountText}} was paid into {{sg.res.intoName}}.", meta: "Reference {{sg.res.reference}}" },
        summary([["Goal", "{{sg.res.goalName}}"], ["Into", "{{sg.res.intoName}}"], ["Amount", "{{sg.res.amountText}}"], ["Saved so far", "{{sg.res.savedText}}"]]),
        view("View goals", "save-borrow"),
        button("Done", [{ type: "exit" }]),
      ],
    },
    {
      // where a refusal goes: what the person can fix has its screen, the bank not answering has another
      id: "fail", title: "Savings goal", kind: "branch",
      onEnter: [set("sg.err", KIND), set("sg.msg", "{{ctx.error.message}}"), go("problem")],
      navigation: route(
        ["ctx.error.code == 'TIMEOUT'", "timeout"], ["ctx.error.code == 'SERVICE_UNAVAILABLE'", "unavailable"], ["sg.err == 'gone'", "gone"], ["sg.err == 'limit'", "goal"], ["sg.err == 'goal'", "goal"],
        ["sg.err == 'plan'", "fund"], ["sg.err == 'move' && sg.mode == 'withdraw'", "out"], ["sg.err == 'move'", "move"],
      ),
      blocks: [],
    },
    {
      id: "gone", title: "Savings goal", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We can’t find that goal.", text: "Nothing was changed." },
        button("Back", [go("start")]),
        button("Close", [{ type: "exit" }], "ghost"),
      ],
    },
    ...answerScreens("start", TIMEOUT),
    {
      id: "problem", title: "Savings goal", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We couldn’t do that", text: "Something went wrong. Nothing was changed." },
        button("Try again", [go("start")]),
        button("Close", [{ type: "exit" }], "ghost"),
      ],
    },
    denied("Savings goal"),
  ] as Screen[],
};
