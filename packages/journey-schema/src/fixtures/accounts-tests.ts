import type { Journey } from "../schema";

/** What must be true for "Accounts" to be right. Each is proved by at least one scenario below. */
export const accountsAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "The total balance is the dollar equivalent of the ledger balances of all visible accounts; hidden accounts and, with showFx off, foreign currency accounts are not in it." },
  { id: "AC-2", text: "Every row shows the available balance (ledger minus holds), not the ledger balance." },
  { id: "AC-3", text: "Accounts are grouped Everyday, Savings, Other currencies; an empty group is not drawn; hidden accounts are in a last group \"Hidden\"." },
  { id: "AC-4", text: "Hide masks every amount on the screen and the account it opens; Show brings them back. With hideBalance off there is no button." },
  { id: "AC-5", text: "A row for an account that is not active shows a status chip (Dormant, Closing, Frozen)." },
  { id: "AC-6", text: "Tapping a row opens that account in account-details; opened with an account it goes straight there." },
  { id: "AC-7", text: "With no accounts the screen says \"No accounts yet\" and offers Open an account; the button is absent when open-another-account is off." },
  { id: "AC-8", text: "When the service is unavailable or times out the first load shows the error card with Try again and nothing else changes." },
  { id: "AC-9", text: "With showFx off foreign currency accounts are neither listed nor in the total." },
  { id: "AC-10", text: "It needs accounts.view; Open another account is offered only with accounts.manage." },
];

// Alex Morgan on Tuesday 3 November 2026. Main has a card payment on hold (ledger $8,720.76, available $8,602.36).
const NOW = "2026-11-03T10:00:00Z";
type Step = Record<string, unknown>;
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const base = { persona: "alex", now: NOW };
const TOTAL = "$29,562.57";

export const accountsScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "The total is the ledger balances in dollars; each row shows the available balance, in groups Everyday, Savings and Other currencies", covers: ["AC-1", "AC-2", "AC-3"], ...base,
    steps: [
      screen("list"), text("Total balance"), text(TOTAL), text("Everyday"), text("Main"), text("••4410 · USD · $8,602.36"), noText("$8,720.76"),
      text("Savings"), text("••7731 · USD · $15,254.37"), text("Other currencies"), text("EUR Travel"), text("••5502 · EUR · €2,400.00"), text("AED Home"), text("AED 11,000.00"), noText("Hidden"),
    ],
  },
  {
    id: "T-2", name: "Hide masks every amount, Show brings them back, and the account it opens is told", covers: ["AC-4"], ...base,
    steps: [
      press("Hide"), text("••••••"), noText(TOTAL), noText("$8,602.36"), noText("$15,254.37"), text("Main"), text("Show"), noText("Hide"),
      press("Main"), { expectOpens: { journey: "account-details", with: { "launch.accountId": "acc_main", "launch.hide": true } } },
    ],
  },
  {
    id: "T-3", name: "Show brings the amounts back; with hideBalance off there is no button", covers: ["AC-4"], ...base,
    steps: [press("Hide"), press("Show"), text(TOTAL), text("$8,602.36"), noText("••••••")],
  },
  {
    id: "T-4", name: "With hideBalance off there is no Hide button", covers: ["AC-4"], ...base, launch: { "opt.hideBalance": false },
    steps: [screen("list"), text(TOTAL), noText("Hide"), noText("Show")],
  },
  {
    id: "T-5", name: "An account that is frozen, dormant or closing shows its status", covers: ["AC-5"], ...base, persona: "alexaccounts", conditions: { frozen: ["acc_aed"] },
    setup: [
      { adapter: "bank.otp.send" }, { adapter: "bank.otp.verify", input: { code: "482100" } },
      { adapter: "bank.accounts.requestClosure", input: { accountId: "acc_save", reason: "I do not need it", destination: "acc_main" } },
    ],
    steps: [screen("list"), text("••6602 · USD · $12.00 · Dormant"), text("••7731 · USD · $15,254.37 · Closing"), text("AED 11,000.00 · Frozen"), text("••6603 · USD · -$5.00"), noText("$8,602.36 ·")],
  },
  {
    id: "T-6", name: "A hidden account moves to the last group, marked Hidden, and its value leaves the total", covers: ["AC-1", "AC-3"], ...base,
    setup: [{ adapter: "bank.accounts.setHidden", input: { accountId: "acc_eur", hidden: true } }],
    steps: [text("Hidden"), text("••5502 · EUR · €2,400.00 · Hidden"), text("$26,970.77"), noText(TOTAL), text("Other currencies"), text("AED Home")],
  },
  {
    id: "T-7", name: "Tapping Savings opens that account in account-details", covers: ["AC-6"], ...base,
    steps: [press("Savings"), { expectOpens: { journey: "account-details", with: { "launch.accountId": "acc_save", "launch.hide": false } } }, screen("main"), text("Savings ••7731")],
  },
  {
    id: "T-8", name: "Opened with an account (a link to it) it goes straight to that account", covers: ["AC-6"], ...base, launch: { "launch.accountId": "acc_eur" },
    steps: [{ expectOpens: { journey: "account-details", with: { "launch.accountId": "acc_eur" } } }, screen("main"), text("EUR Travel ••5502")],
  },
  {
    id: "T-9", name: "A customer with no account sees No accounts yet and Open an account, which opens open-another-account", covers: ["AC-7"], persona: "sam", now: NOW,
    steps: [screen("empty"), text("No accounts yet"), text("Open one in a few minutes."), noText("Total balance"), press("Open an account"), { expectOpens: { journey: "open-another-account" } }],
  },
  {
    id: "T-10", name: "With open-another-account off there is no Open an account button", covers: ["AC-7"], persona: "sam", now: NOW, launch: { "opt.openAnother": false },
    steps: [screen("empty"), text("No accounts yet"), noText("Open an account")],
  },
  {
    id: "T-11", name: "When the bank is unavailable the error card shows with Try again and no list", covers: ["AC-8"], ...base, conditions: { unavailable: ["bank.accounts.overview"] },
    steps: [screen("loadFail"), text("We couldn’t load your accounts"), text("Nothing was changed."), noText("Total balance"), press("Try again"), screen("loadFail")],
  },
  {
    id: "T-12", name: "When the bank does not answer in time the error card says so", covers: ["AC-8"], ...base, conditions: { timeout: ["bank.accounts.overview"], latencyMs: 10000 },
    steps: [screen("loadFail"), text("We couldn’t load your accounts"), text("This is taking longer than expected. Nothing was changed."), press("Try again"), screen("loadFail")],
  },
  {
    id: "T-13", name: "With showFx off the Euro and Dirham accounts are not listed and not in the total", covers: ["AC-9"], ...base, launch: { "opt.showFx": false },
    steps: [text("$23,975.13"), noText(TOTAL), noText("Other currencies"), noText("EUR Travel"), noText("AED Home"), text("Main"), text("Savings")],
  },
  {
    id: "T-14", name: "Without accounts.view it says it is not available; without accounts.manage there is no Open another account", covers: ["AC-10"], ...base, conditions: { withoutPermissions: ["accounts.view"] },
    steps: [screen("denied"), text("Not available"), text("This isn’t available for your profile."), noText("Total balance")],
  },
  {
    id: "T-15", name: "Open another account is offered with accounts.manage and opens open-another-account", covers: ["AC-10"], ...base,
    steps: [text("Open another account"), press("Open another account"), { expectOpens: { journey: "open-another-account" } }],
  },
  {
    id: "T-16", name: "Without accounts.manage the list shows and there is no Open another account", covers: ["AC-10"], ...base, conditions: { withoutPermissions: ["accounts.manage"] },
    steps: [screen("list"), text(TOTAL), noText("Open another account")],
  },
  {
    id: "T-17", name: "Refresh loads the list again", covers: ["AC-8"], ...base,
    steps: [press("Refresh"), screen("list"), text(TOTAL), noText("out of date")],
  },
  {
    id: "T-18", name: "Tapping an account in another currency opens it", covers: ["AC-6"], ...base,
    steps: [press("AED Home"), { expectOpens: { journey: "account-details", with: { "launch.accountId": "acc_aed", "launch.hide": false } } }, screen("main"), text("AED Home ••8816")],
  },
  {
    id: "T-19", name: "Tapping a hidden account opens it, and it can be shown again there", covers: ["AC-3", "AC-6"], ...base,
    setup: [{ adapter: "bank.accounts.setHidden", input: { accountId: "acc_eur", hidden: true } }],
    steps: [press("EUR Travel"), { expectOpens: { journey: "account-details", with: { "launch.accountId": "acc_eur", "launch.hide": false } } }, screen("main"), text("Hidden"), text("Show account")],
  },
];
