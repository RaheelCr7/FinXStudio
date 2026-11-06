import type { Journey } from "../schema";

/** What must be true for "Savings goal" to be right. Each is proved by at least one scenario below. */
export const savingsGoalAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "A goal needs a name of 2 to 30 characters, a target of $50.00 to $1,000,000.00 and a month, with the messages of the spec." },
  { id: "AC-2", text: "The saving plan shows the monthly amount needed to reach the target by the chosen month." },
  { id: "AC-3", text: "Switching the top-up on fills the monthly amount with that figure (at least $5.00); it needs an amount of at least $5.00 and an account." },
  { id: "AC-4", text: "With allowAuto off, the toggle, amount and account are absent and no top-up is saved." },
  { id: "AC-5", text: "A top-up appears in scheduled payments as \"Goal: {name}\" and is replaced on edit and removed when switched off." },
  { id: "AC-6", text: "An eleventh goal is refused with \"You can have up to 10 goals. Close one to add another.\"" },
  { id: "AC-7", text: "Adding money takes it from the chosen account, raises the goal and shows \"Money added\"; reaching the target says so." },
  { id: "AC-8", text: "Taking money out cannot exceed the saved amount and pays the chosen account; with allowWithdraw off it is refused." },
  { id: "AC-9", text: "No code is asked in any mode." },
  { id: "AC-10", text: "When the bank is unavailable or times out nothing is changed." },
  { id: "AC-11", text: "With one goal the choice of goal is skipped, with none the journey says \"You have no goals yet.\"; it needs payments.create, and the bank itself refuses without the permission and applies its rules to a call a screen would not make." },
];

// Alex Morgan on Tuesday 3 November 2026: Main ••4410 with $8,602.36 available, Savings ••7731, and the goal g1 "Holiday fund" ($3,200.00 of $5,000.00, $200.00 a month from Main).
const NOW = "2026-11-03T10:00:00Z";
type Step = Record<string, unknown>;
const set = (v: Record<string, unknown>): Step => ({ set: v });
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const forced = (adapter: string, input: Record<string, unknown>, c: string): Step => ({ expectBankError: { adapter, input, code: c } });
const bank = (adapter: string, input: Record<string, unknown>, path: string, equals: unknown): Step => ({ expectBank: { adapter, input, path, equals } });
const avail = (id: string, equals: number): Step => bank("bank.accounts.payFrom", {}, `accounts.${id}.available`, equals);
const goals = (path: string, equals: unknown): Step => bank("bank.goals.list", {}, path, equals);
const sched = (path: string, equals: unknown): Step => bank("bank.schedule.list", {}, path, equals);
const create = { persona: "alex", now: NOW, launch: { "launch.mode": "create" } };
const add = { persona: "alex", now: NOW, launch: { "launch.mode": "add", "launch.goalId": "g1" } };
const out = { persona: "alex", now: NOW, launch: { "launch.mode": "withdraw", "launch.goalId": "g1" } };
const edit = { persona: "alex", now: NOW, launch: { "launch.mode": "edit", "launch.goalId": "g1" } };
/** A goal typed, through to the saving plan. */
const toPlan: Step[] = [set({ "sg.name": "New laptop", "sg.target": 2000, "sg.date": "2027-06-30" }), press("Continue"), screen("fund")];
/** Nine more goals, made with the bank's own calls, so that the person has ten. */
const nine: NonNullable<Journey["scenarios"]>[number]["setup"] = Array.from({ length: 9 }, (_, i) => ({ adapter: "bank.goals.create", input: { name: `Goal ${i + 2}`, target: 100, date: "2027-01-31" } }));
const one: NonNullable<Journey["scenarios"]>[number]["setup"] = [{ adapter: "bank.goals.create", input: { name: "New laptop", target: 2000, date: "2027-06-30" } }];

export const savingsGoalScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "Create New laptop, 2,000.00 by June 2027: the plan says 250.00 a month, the top-up is filled with it, the goal is created with no code and the top-up is listed as Goal: New laptop", covers: ["AC-1", "AC-2", "AC-3", "AC-5", "AC-9"], ...create,
    steps: [
      screen("goal"), text("Your goal"), text("June 2027"),
      ...toPlan, text("Saving plan"), text("To get there by 30 Jun 2027"), text("$250.00 a month"), text("Add automatically every month"), text("On the 1st of each month"), noText("Monthly amount"),
      set({ "sg.auto": true }), text("Monthly amount"), text("Take it from"), text("Main ••4410"),
      press("Save goal"), screen("doneCreate"), text("Goal created"), text("New laptop is ready. Add money any time."), text("$250.00 from Main"), text("Reference GL-20261103-"),
      goals("g2.name", "New laptop"), sched("goal:g2.name", "Goal: New laptop"), sched("goal:g2.amount", 250), sched("goal:g2.sub", "Monthly · 1 Dec"), text("Add money"), text("View goals"),
    ],
  },
  {
    id: "T-2", name: "A name of one character, a target of 20.00 and no month are each refused with their words", covers: ["AC-1"], ...create,
    steps: [
      set({ "sg.name": "A", "sg.target": 2000, "sg.date": "2027-06-30" }), press("Continue"), screen("goal"), text("Use 2 to 30 characters."),
      set({ "sg.name": "New laptop", "sg.target": 20 }), press("Continue"), screen("goal"), text("The smallest target is $50.00."),
      set({ "sg.target": 2000000 }), press("Continue"), screen("goal"), text("The largest target is $1,000,000.00."),
      set({ "sg.target": 2000, "sg.date": "" }), press("Continue"), screen("goal"), { expectError: "sg.date" },
      set({ "sg.name": "x".repeat(31), "sg.date": "2027-06-30" }), press("Continue"), screen("goal"), text("Use 2 to 30 characters."),
      set({ "sg.name": "New laptop" }), press("Continue"), screen("fund"),
    ],
  },
  {
    id: "T-3", name: "With the top-up on, a monthly amount of 3.00 is refused: the smallest is 5.00", covers: ["AC-3"], ...create,
    steps: [...toPlan, set({ "sg.auto": true, "sg.amount": 3 }), press("Save goal"), screen("fund"), text("The smallest amount is $5.00."), set({ "sg.amount": 5 }), press("Save goal"), screen("doneCreate"), sched("goal:g2.amount", 5)],
  },
  {
    id: "T-4", name: "The top-up needs an account that exists; the bank's refusal goes back to the plan", covers: ["AC-3"], ...create,
    steps: [...toPlan, set({ "sg.auto": true, "sg.from": "acc_nope" }), press("Save goal"), screen("fund"), text("We can’t find that account. Choose another."), set({ "sg.from": "acc_save" }), press("Save goal"), screen("doneCreate"), text("$250.00 from Savings"), sched("goal:g2.fromAccountId", "acc_save")],
  },
  {
    id: "T-5", name: "With allowAuto off there is no toggle, no amount and no account, and no top-up is saved", covers: ["AC-4"], ...create, launch: { "launch.mode": "create", "opt.allowAuto": false },
    steps: [...toPlan, noText("Add automatically every month"), noText("Monthly amount"), noText("Take it from"), press("Save goal"), screen("doneCreate"), text("Off"), goals("g2.name", "New laptop"), sched("goal:g2.id", undefined)],
  },
  {
    id: "T-6", name: "With allowAuto off an edit of a goal that had a top-up saves none", covers: ["AC-4"], ...edit, launch: { "launch.mode": "edit", "launch.goalId": "g1", "opt.allowAuto": false },
    steps: [press("Continue"), screen("fund"), noText("Add automatically every month"), press("Save goal"), screen("doneEdit"), sched("goal:g1.id", undefined)],
  },
  {
    id: "T-7", name: "Edit: the goal starts with its values; turning the top-up off removes it from the scheduled payments", covers: ["AC-5"], ...edit,
    steps: [
      screen("goal"), text("Holiday fund"), sched("goal:g1.name", "Goal: Holiday fund"), press("Continue"), screen("fund"), text("To get there by 30 Jun 2027"), text("$225.00 a month"), text("Monthly amount"),
      set({ "sg.auto": false }), press("Save goal"), screen("doneEdit"), text("Goal updated"), text("Holiday fund is up to date."), text("Off"), sched("goal:g1.id", undefined), goals("g1.autoOn", false),
    ],
  },
  {
    id: "T-8", name: "Edit: a new monthly amount replaces the top-up, and the saved amount stays", covers: ["AC-5"], ...edit,
    steps: [press("Continue"), set({ "sg.amount": 300, "sg.from": "acc_save" }), press("Save goal"), screen("doneEdit"), text("$300.00 from Savings"), sched("goal:g1.amountText", "$300.00"), sched("goal:g1.fromAccountId", "acc_save"), goals("g1.savedText", "$3,200.00")],
  },
  {
    id: "T-9", name: "Edit: a new name and target are saved, and a goal already reached asks for nothing a month", covers: ["AC-5", "AC-1"], ...edit,
    steps: [set({ "sg.name": "Summer trip", "sg.target": 3000 }), press("Continue"), screen("fund"), text("$0.00 a month"), press("Save goal"), screen("doneEdit"), goals("g1.name", "Summer trip"), goals("g1.targetText", "$3,000.00"), goals("g1.reached", true)],
  },
  {
    id: "T-10", name: "With ten goals Continue on the goal says You can have up to 10 goals. Close one to add another., and nothing is made", covers: ["AC-6"], ...create, setup: nine,
    steps: [...[set({ "sg.name": "New laptop", "sg.target": 2000, "sg.date": "2027-06-30" }), press("Continue")], screen("goal"), text("You can have up to 10 goals. Close one to add another."), goals("g11.id", undefined)],
  },
  {
    id: "T-11", name: "An edit is not limited by the number of goals", covers: ["AC-6"], persona: "alex", now: NOW, launch: { "launch.mode": "edit", "launch.goalId": "g1" }, setup: nine,
    steps: [press("Continue"), screen("fund"), press("Save goal"), screen("doneEdit")],
  },
  {
    id: "T-12", name: "The bank refuses an eleventh goal itself, and the rules of a goal that a screen would not break", covers: ["AC-6", "AC-1", "AC-11"], persona: "alex", now: NOW, setup: nine,
    steps: [forced("bank.goals.create", { name: "New laptop", target: 2000, date: "2027-06-30" }, "GOAL_LIMIT"), forced("bank.goals.update", { goalId: "g9", name: "A", target: 2000, date: "2027-06-30" }, "NAME_INVALID")],
  },
  {
    id: "T-13", name: "The bank applies the name, target, month and top-up rules to a call that a screen would not make", covers: ["AC-1", "AC-3", "AC-4", "AC-11"], persona: "alex", now: NOW,
    steps: [
      forced("bank.goals.create", { name: "A", target: 2000, date: "2027-06-30" }, "NAME_INVALID"), forced("bank.goals.create", { name: "Laptop", target: 20, date: "2027-06-30" }, "TARGET_BELOW"),
      forced("bank.goals.create", { name: "Laptop", target: 2000000, date: "2027-06-30" }, "TARGET_ABOVE"), forced("bank.goals.create", { name: "Laptop", target: 2000, date: "" }, "DATE_REQUIRED"),
      forced("bank.goals.create", { name: "Laptop", target: 2000, date: "2027-06-15" }, "DATE_INVALID"), forced("bank.goals.create", { name: "Laptop", target: 2000, date: "2027-06-30", autoOn: true, autoAmount: 3, fromAccountId: "acc_main" }, "AUTO_BELOW"),
      forced("bank.goals.create", { name: "Laptop", target: 2000, date: "2027-06-30", autoOn: true, fromAccountId: "acc_main" }, "AUTO_REQUIRED"), forced("bank.goals.create", { name: "Laptop", target: 2000, date: "2027-06-30", autoOn: true, autoAmount: 50, fromAccountId: "acc_main", allowAuto: false }, "AUTO_OFF"),
      goals("g2.id", undefined),
    ],
  },
  {
    id: "T-14", name: "Add 100.00 from Main: Money added, 3,300.00 of 5,000.00, Main 100.00 less, no code", covers: ["AC-7", "AC-9"], ...add,
    steps: [
      screen("move"), text("Add money"), text("Holiday fund"), text("$3,200.00"), text("$5,000.00"), text("Main ••4410"), set({ "sg.move": 100 }), press("Add money"), screen("doneAdd"), text("Money added"), text("$100.00 is now in Holiday fund."),
      text("Saved so far"), text("$3,300.00 of $5,000.00"), text("Reference GL-20261103-"), avail("acc_main", 8502.36), goals("g1.savedText", "$3,300.00"),
    ],
  },
  {
    id: "T-15", name: "Adding enough to reach the target says Holiday fund has reached its target.", covers: ["AC-7"], ...add,
    steps: [set({ "sg.move": 1800 }), press("Add money"), screen("doneAdd"), text("Holiday fund has reached its target."), noText("is now in Holiday fund."), goals("g1.reached", true), goals("g1.byText", "Goal reached")],
  },
  {
    id: "T-16", name: "Adding more than Main holds is refused with the shared message; Savings can pay it; an amount below 1.00 is refused", covers: ["AC-7"], ...add,
    steps: [
      set({ "sg.move": 0.5 }), press("Add money"), screen("move"), text("The smallest amount is $1.00."),
      set({ "sg.move": 9000 }), press("Add money"), screen("move"), text("Not enough money in Main. Available: $8,602.36."), avail("acc_main", 8602.36), goals("g1.savedText", "$3,200.00"),
      set({ "sg.from": "acc_save" }), press("Add money"), screen("doneAdd"), text("Savings ••7731"), avail("acc_save", 6254.37),
    ],
  },
  {
    id: "T-17", name: "A frozen account cannot pay into a goal", covers: ["AC-7"], ...add, conditions: { frozen: ["acc_main"] },
    steps: [set({ "sg.move": 100, "sg.from": "acc_main" }), press("Add money"), screen("move"), text("You can’t use this account right now. Choose another account."), goals("g1.savedText", "$3,200.00")],
  },
  {
    id: "T-18", name: "Take money out: more than is saved is refused with the amount saved; 50.00 is paid into Main", covers: ["AC-8"], ...out,
    steps: [
      screen("out"), text("Take money out"), text("$3,200.00"), set({ "sg.move": 5000 }), press("Take money out"), screen("out"), text("You only have $3,200.00 in this goal."), goals("g1.savedText", "$3,200.00"),
      set({ "sg.move": 50 }), press("Take money out"), screen("doneOut"), text("Money taken out"), text("$50.00 was paid into Main ••4410."), text("$3,150.00 of $5,000.00"), avail("acc_main", 8652.36), goals("g1.savedText", "$3,150.00"),
    ],
  },
  {
    id: "T-19", name: "Taking out less than 1.00 is refused; Savings can receive it", covers: ["AC-8"], ...out,
    steps: [set({ "sg.move": 0.5 }), press("Take money out"), screen("out"), text("The smallest amount is $1.00."), set({ "sg.move": 20, "sg.into": "acc_save" }), press("Take money out"), screen("doneOut"), text("Savings ••7731")],
  },
  {
    id: "T-20", name: "With allowWithdraw off taking money out is refused when it is sent, and nothing changes", covers: ["AC-8"], ...out, launch: { "launch.mode": "withdraw", "launch.goalId": "g1", "opt.allowWithdraw": false },
    steps: [set({ "sg.move": 50 }), press("Take money out"), screen("out"), text("Taking money out isn’t available."), avail("acc_main", 8602.36), goals("g1.savedText", "$3,200.00")],
  },
  {
    id: "T-21", name: "Money cannot be taken out into an account that cannot receive it", covers: ["AC-8"], ...out, conditions: { frozen: ["acc_main"] },
    steps: [set({ "sg.move": 50, "sg.into": "acc_main" }), press("Take money out"), screen("out"), text("This account can’t receive money right now. Choose another account."), goals("g1.savedText", "$3,200.00")],
  },
  {
    id: "T-22", name: "No mode asks for a code: a goal is created, edited, added to and taken from without one", covers: ["AC-9"], ...create,
    steps: [...toPlan, press("Save goal"), screen("doneCreate"), noText("code")],
  },
  {
    id: "T-23", name: "When the bank is unavailable adding money changes nothing", covers: ["AC-10"], ...add, conditions: { unavailable: ["bank.goals.contribute"] },
    steps: [set({ "sg.move": 100 }), press("Add money"), screen("unavailable"), text("We couldn’t reach the bank"), avail("acc_main", 8602.36), goals("g1.savedText", "$3,200.00")],
  },
  {
    id: "T-24", name: "When the bank does not answer in time adding money changes nothing; Try again starts again", covers: ["AC-10"], ...add, conditions: { timeout: ["bank.goals.contribute"], latencyMs: 10000 },
    steps: [set({ "sg.move": 100 }), press("Add money"), screen("timeout"), text("We didn’t get an answer in time. Check your goal before you try again."), avail("acc_main", 8602.36), goals("g1.savedText", "$3,200.00"), press("Try again"), screen("move")],
  },
  {
    id: "T-25", name: "When the bank is unavailable taking money out changes nothing", covers: ["AC-10"], ...out, conditions: { unavailable: ["bank.goals.withdraw"] },
    steps: [set({ "sg.move": 50 }), press("Take money out"), screen("unavailable"), goals("g1.savedText", "$3,200.00"), avail("acc_main", 8602.36)],
  },
  {
    id: "T-26", name: "When the bank is unavailable creating a goal makes none", covers: ["AC-10"], ...create, conditions: { unavailable: ["bank.goals.create"] },
    steps: [...toPlan, press("Save goal"), screen("unavailable"), goals("g2.id", undefined)],
  },
  {
    id: "T-27", name: "When the bank is unavailable editing a goal changes nothing", covers: ["AC-10"], ...edit, conditions: { unavailable: ["bank.goals.update"] },
    steps: [press("Continue"), set({ "sg.name": "Summer trip" }), press("Save goal"), screen("unavailable"), goals("g1.name", "Holiday fund")],
  },
  {
    id: "T-28", name: "When the goals, the accounts or the months cannot be read, nothing starts", covers: ["AC-10"], ...create, conditions: { unavailable: ["bank.goals.list"] },
    steps: [screen("unavailable"), text("Nothing was sent and you haven’t been charged.")],
  },
  {
    id: "T-29", name: "When the accounts cannot be read in time, nothing starts", covers: ["AC-10"], ...create, conditions: { timeout: ["bank.accounts.payFrom"], latencyMs: 10000 },
    steps: [screen("timeout")],
  },
  {
    id: "T-30", name: "When the months cannot be read, the goal screen does not open", covers: ["AC-10"], ...create, conditions: { unavailable: ["bank.goals.months"] },
    steps: [screen("unavailable"), press("Try again"), screen("unavailable")],
  },
  {
    id: "T-31", name: "When the plan cannot be worked out, nothing goes on and Try again starts again", covers: ["AC-10"], ...create, conditions: { unavailable: ["bank.goals.plan"] },
    steps: [set({ "sg.name": "New laptop", "sg.target": 2000, "sg.date": "2027-06-30" }), press("Continue"), screen("unavailable")],
  },
  {
    id: "T-32", name: "A name the bank refuses when the goal is saved goes back to the goal with its message", covers: ["AC-1", "AC-10"], ...create,
    steps: [...toPlan, set({ "sg.name": "A" }), press("Save goal"), screen("goal"), text("Use 2 to 30 characters."), set({ "sg.name": "New laptop" }), press("Continue"), screen("fund")],
  },
  {
    id: "T-33", name: "With one goal the choice of goal is skipped; with two the person chooses, and must choose", covers: ["AC-11"], persona: "alex", now: NOW, launch: { "launch.mode": "add" },
    steps: [screen("move"), text("Holiday fund")],
  },
  {
    id: "T-34", name: "With two goals the list is shown: Continue needs a choice, and the choice is the goal used", covers: ["AC-11"], persona: "alex", now: NOW, launch: { "launch.mode": "add" }, setup: one,
    steps: [
      screen("pick"), text("Choose a goal"), text("Holiday fund"), text("$3,200.00 of $5,000.00"), text("New laptop"), text("$0.00 of $2,000.00"), set({ "sg.goalId": "" }), press("Continue"), screen("pick"), { expectError: "sg.goalId" },
      set({ "sg.goalId": "g2" }), press("Continue"), screen("move"), text("New laptop"),
    ],
  },
  {
    id: "T-35", name: "A goal id that is not the person's is ignored: the goal they have is used", covers: ["AC-11"], persona: "alex", now: NOW, launch: { "launch.mode": "withdraw", "launch.goalId": "g9" },
    steps: [screen("out"), text("Holiday fund")],
  },
  {
    id: "T-36", name: "With no goals Add, Edit and Take out say You have no goals yet., and offer to create one", covers: ["AC-11"], persona: "alex", now: NOW, launch: { "launch.mode": "edit" }, conditions: { empty: ["bank.goals.list"] },
    steps: [screen("none"), text("You have no goals yet."), press("Create a goal"), screen("goal")],
  },
  {
    id: "T-37", name: "Without a mode it creates a goal", covers: ["AC-1"], persona: "alex", now: NOW,
    steps: [screen("goal"), text("Your goal")],
  },
  {
    id: "T-38", name: "Without payments.create it is not available, and the bank refuses a goal made, changed, added to or taken from, whatever a screen does", covers: ["AC-11"], ...create, conditions: { withoutPermissions: ["payments.create"] },
    steps: [
      screen("denied"), text("Not available"), forced("bank.goals.create", { name: "New laptop", target: 2000, date: "2027-06-30" }, "PERMISSION_DENIED"), forced("bank.goals.update", { goalId: "g1", name: "Holiday fund", target: 5000, date: "2027-06-30" }, "PERMISSION_DENIED"),
      forced("bank.goals.contribute", { goalId: "g1", amount: 10, fromAccountId: "acc_main" }, "PERMISSION_DENIED"), forced("bank.goals.withdraw", { goalId: "g1", amount: 10, toAccountId: "acc_main" }, "PERMISSION_DENIED"), goals("g1.savedText", "$3,200.00"),
    ],
  },
  {
    id: "T-39", name: "The bank applies the rules of an addition and a withdrawal itself: less than 1.00, more than is saved, taking out switched off, an unknown goal", covers: ["AC-7", "AC-8", "AC-11"], persona: "alex", now: NOW,
    steps: [
      forced("bank.goals.contribute", { goalId: "g1", amount: 0.5, fromAccountId: "acc_main" }, "AMOUNT_BELOW"), forced("bank.goals.contribute", { goalId: "g9", amount: 10, fromAccountId: "acc_main" }, "GOAL_NOT_FOUND"),
      forced("bank.goals.withdraw", { goalId: "g1", amount: 5000, toAccountId: "acc_main" }, "ABOVE_SAVED"), forced("bank.goals.withdraw", { goalId: "g1", amount: 0.5, toAccountId: "acc_main" }, "AMOUNT_BELOW"),
      forced("bank.goals.withdraw", { goalId: "g1", amount: 50, toAccountId: "acc_main", allowWithdraw: false }, "WITHDRAW_OFF"), goals("g1.savedText", "$3,200.00"),
    ],
  },
  {
    id: "T-40", name: "After a new goal Add money opens the journey again at that goal, and View goals opens the Save screen", covers: ["AC-7"], ...create,
    steps: [...toPlan, press("Save goal"), press("Add money"), { expectOpens: { journey: "savings-goal", with: { "launch.mode": "add", "launch.goalId": "g2" } } }],
  },
  {
    id: "T-41", name: "After a new goal View goals opens the Save screen", covers: ["AC-5"], ...create,
    steps: [...toPlan, press("Save goal"), press("View goals"), { expectOpens: { journey: "save-borrow" } }],
  },
  {
    id: "T-42", name: "After an edit, an addition and a withdrawal View goals opens the Save screen", covers: ["AC-5", "AC-7", "AC-8"], ...edit,
    steps: [press("Continue"), press("Save goal"), press("View goals"), { expectOpens: { journey: "save-borrow" } }],
  },
  {
    id: "T-43", name: "After adding money View goals opens the Save screen", covers: ["AC-7"], ...add,
    steps: [set({ "sg.move": 10 }), press("Add money"), press("View goals"), { expectOpens: { journey: "save-borrow" } }],
  },
  {
    id: "T-44", name: "After taking money out View goals opens the Save screen", covers: ["AC-8"], ...out,
    steps: [set({ "sg.move": 10 }), press("Take money out"), press("View goals"), { expectOpens: { journey: "save-borrow" } }],
  },
  {
    id: "T-46", name: "With the top-up on, a monthly amount left empty is refused on the plan", covers: ["AC-3"], ...create,
    steps: [...toPlan, set({ "sg.auto": true, "sg.amount": null }), press("Save goal"), screen("fund"), { expectError: "sg.amount" }, goals("g2.id", undefined)],
  },
  {
    id: "T-47", name: "An amount to add that is left empty is refused", covers: ["AC-7"], ...add,
    steps: [press("Add money"), screen("move"), { expectError: "sg.move" }, avail("acc_main", 8602.36)],
  },
  {
    id: "T-48", name: "An amount to take out that is left empty is refused", covers: ["AC-8"], ...out,
    steps: [press("Take money out"), screen("out"), { expectError: "sg.move" }, avail("acc_main", 8602.36)],
  },
  {
    id: "T-45", name: "Back from the plan returns to the goal with what was typed", covers: ["AC-1"], ...create,
    steps: [...toPlan, press("Back"), screen("goal"), press("Continue"), screen("fund")],
  },
];
