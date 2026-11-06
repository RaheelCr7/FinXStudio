import type { Journey } from "../schema";
import { steps } from "./business-kit";

const { press, text, noText, screen, opens, refuses } = steps;

/** What must be true for "Scheduled supplier payments" to be right (the spec's criteria). */
export const businessSchedulesAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "The list shows each schedule with its supplier, reference, amount, how often, next date and badge." },
  { id: "AC-2", text: "A schedule waiting for approval shows \"Waiting for approval\" and \"{n} of {need} approved\"; an active one shows Active and its last result." },
  { id: "AC-3", text: "An active schedule that would fail shows the reason and \"The next payment would be skipped.\"" },
  { id: "AC-4", text: "Schedule a payment, Change and Cancel show only to a person who may schedule payments; an Approver sees the list without them." },
  { id: "AC-5", text: "Cancelled schedules are not listed; with none left \"Nothing scheduled\" shows. Change, Cancel and Schedule a payment open the schedule journey." },
  { id: "AC-6", text: "A bank that cannot be reached, or does not answer in time, shows the retry state; from Personal the bank does not answer for a company." },
];

const NOW = "2026-11-03T10:42:00Z";
const alpha = { persona: "alex", context: "alpha", now: NOW };
type Scenario = NonNullable<Journey["scenarios"]>[number];
const T = (id: string, name: string, covers: string[], base: Record<string, unknown>, stepList: Record<string, unknown>[], extra: Record<string, unknown> = {}): Scenario => ({ id, name, covers, ...base, ...extra, steps: stepList } as Scenario);
const arrange = (input: Record<string, unknown>) => ({ adapter: "corp.sandbox.arrange", input });

export const businessSchedulesScenarios: NonNullable<Journey["scenarios"]> = [
  T("T-1", "Alex at Alpha: two schedules, the active one with its last result and the one waiting for approval", ["AC-1", "AC-2"], alpha, [
    screen("list"), text("Scheduled supplier payments"), text("Harbour Packaging"), text("PO-STANDING"), text("$4,500.00 · Monthly · next Tue 1 Dec"), text("Active"), text("Paid 3 Nov"),
    text("Whitby Logistics"), text("£12,000.00 · Every 3 months · next Mon 4 Jan"), text("Waiting for approval"), text("0 of 1 approved"), text("Schedule a payment"), noText("Nothing scheduled"),
  ]),
  T("T-2", "A balance below the amount: the warning says why and that the next payment would be skipped", ["AC-3"], alpha, [
    screen("list"), text("There isn’t enough money in the account. The next payment would be skipped."), press("BSC-3001"), screen("detail"), text("There isn’t enough money in the account. The next payment would be skipped."),
  ], { setup: [arrange({ op: "balance", accountId: "alpha_ops", balance: 4_000 })] }),
  T("T-3", "A supplier taken off the list: the warning says so", ["AC-3"], alpha, [screen("list"), text("The supplier is no longer on your list. The next payment would be skipped."), noText("There isn’t enough money")], { setup: [arrange({ op: "removeSupplier", id: "harb" })] }),
  T("T-4", "Alex at Beta (an Approver): the list without Schedule a payment, Change or Cancel", ["AC-4"], { persona: "alex", context: "beta", now: NOW }, [
    screen("list"), text("Nimbus Logistics"), text("FILL"), noText("Schedule a payment"), press("BSC-F0"), screen("detail"), text("Active"), noText("Change"), noText("Cancel"),
  ], { setup: [arrange({ op: "fillSchedules", count: 1 })] }),
  T("T-5", "Alex at Beta with nothing scheduled: Nothing scheduled and no button", ["AC-4", "AC-5"], { persona: "alex", context: "beta", now: NOW }, [screen("list"), text("Nothing scheduled"), text("Payments you schedule show here."), noText("Schedule a payment")]),
  T("T-6", "Both cancelled: Nothing scheduled, and the button stays", ["AC-5"], alpha, [screen("list"), text("Nothing scheduled"), text("Payments you schedule show here."), text("Schedule a payment"), noText("Harbour Packaging")], {
    setup: [{ adapter: "corp.schedules.cancel", input: { scheduleId: "BSC-3001" } }, { adapter: "corp.schedules.cancel", input: { scheduleId: "BSC-3002" } }],
  }),
  T("T-7", "Change opens the schedule journey on that payment", ["AC-5"], alpha, [press("BSC-3001"), screen("detail"), text("Harbour Packaging"), text("PO-STANDING"), press("Change"), opens("schedule-business-payment", { "launch.mode": "edit", "launch.scheduleId": "BSC-3001" }), screen("editCard")]),
  T("T-8", "Cancel opens the schedule journey in cancel mode", ["AC-5"], alpha, [press("BSC-3002"), press("Cancel"), opens("schedule-business-payment", { "launch.mode": "cancel", "launch.scheduleId": "BSC-3002" }), screen("cancelCard")]),
  T("T-9", "Schedule a payment opens the schedule journey from the first step", ["AC-5"], alpha, [press("Schedule a payment"), opens("schedule-business-payment"), screen("supplier")]),
  T("T-10", "A row opens its card and Back returns to the list", ["AC-1"], alpha, [press("BSC-3002"), screen("detail"), text("Whitby Logistics"), text("0 of 1 approved"), text("8 payments"), press("Back"), screen("list")]),
  T("T-11", "When the bank is unavailable the list shows the retry state", ["AC-6"], alpha, [screen("loadFail"), text("We couldn’t load your scheduled payments. Nothing was changed."), text("Nothing was sent and you haven’t been charged. Try again in a moment."), noText("Harbour Packaging"), press("Try again"), screen("loadFail")], { conditions: { unavailable: ["corp.schedules.list"] } }),
  T("T-12", "When the bank does not answer in time the retry state says so", ["AC-6"], alpha, [screen("loadFail"), text("This is taking longer than expected. Nothing was changed."), press("Try again"), screen("loadFail")], { conditions: { timeout: ["corp.schedules.list"], latencyMs: 10000 } }),
  T("T-13", "From Personal the bank does not answer for a company's schedules", ["AC-6"], { persona: "alex", now: NOW }, [screen("denied"), text("Switch to your business first"), refuses("corp.schedules.list", "WRONG_CONTEXT")]),
];
