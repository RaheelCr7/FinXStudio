import type { Journey } from "../schema";
import { steps } from "./business-kit";

const { press, text, noText, screen, set, opens, refuses } = steps;

/** What must be true for "Business accounts" to be right (the spec's criteria, with the bank's own refusal added). Each is proved by at least one scenario below. */
export const businessAccountsAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "The total balance (every ledger balance in the company's currency) and each account's available and ledger balances are shown; available is the ledger less pending outgoing items and payments waiting for approval." },
  { id: "AC-2", text: "An account the person cannot see the transactions of shows \"View only\" and the not-allowed card, with no list; the bank refuses the same transactions when asked for them." },
  { id: "AC-3", text: "The period buttons (7 days, 30 days, 90 days, This month) and the search box narrow the list; an empty result shows \"No transactions\" and \"Try another period or search.\"" },
  { id: "AC-4", text: "The account numbers for receiving money show only when the option details is on, in the identifiers of the bank's home market (routing number, sort code or IBAN), with the account name and Copy details." },
  { id: "AC-5", text: "Export shows only to a person who may export the account, and Pay from this account only to one who may pay from it; each opens the journey with the account." },
  { id: "AC-6", text: "A bank that cannot be reached, or does not answer in time, shows the retry state and no balances." },
  { id: "AC-7", text: "A company with no accounts shows \"No accounts yet\"." },
  { id: "AC-8", text: "The company's accounts are answered only inside that company: from Personal the bank refuses them, and a screen that is opened there says to switch first." },
];

// Alex Morgan, a Maker at Alpha Trading LLC and an Approver at Beta Services Ltd. Today is Tuesday 3 November 2026, 10:42 UTC.
const NOW = "2026-11-03T10:42:00Z";
const alpha = { persona: "alex", context: "alpha", now: NOW };
const beta = { persona: "alex", context: "beta", now: NOW };
type Scenario = NonNullable<Journey["scenarios"]>[number];
const T = (id: string, name: string, covers: string[], base: Record<string, unknown>, stepList: Record<string, unknown>[], extra: Record<string, unknown> = {}): Scenario => ({ id, name, covers, ...base, ...extra, steps: stepList } as Scenario);

export const businessAccountsScenarios: NonNullable<Journey["scenarios"]> = [
  T("T-1", "Alex at Alpha: the total in dollars, two accounts, each with its available and ledger balance", ["AC-1"], alpha, [
    screen("main"), text("Total balance"), text("$582,807.78"), text("Total across 2 accounts, in USD"), text("Operating"), text("••2001"), text("Reserve"), text("••2044"),
    text("$458,760.00"), text("$480,000.00"), text("€93,700.00"), text("€95,200.00"), text("Transactions"), text("Whitby Logistics · INV-2290"), text("Operating · Pending"), noText("Routing number"), noText("Pay from this account"),
  ]),
  T("T-2", "Selecting Operating: its detail with the numbers to receive money, Pay from this account, Export, and the list titled Transactions · Operating", ["AC-1", "AC-4", "AC-5"], alpha, [
    press("alpha_ops"), text("Operating ••2001"), text("Currency"), text("Available"), text("$458,760.00"), text("Routing number"), text("021000021"), text("Account number"), text("100002001"), text("Account name"), text("Alpha Trading LLC"),
    text("Copy details"), text("Pay from this account"), text("Export"), text("Transactions · Operating"), text("Pending"), text("Booked"),
    press("alpha_ops"), noText("Routing number"), noText("Transactions · Operating"), text("Transactions"),
  ]),
  T("T-3", "Selecting Reserve: no Pay from this account (not allowed to pay from it), Export shown", ["AC-5"], alpha, [
    press("alpha_res"), text("Reserve ••2044"), text("Transactions · Reserve"), text("Export"), noText("Pay from this account"), text("Copy details"), text("€93,700.00"),
  ]),
  T("T-4", "Alex at Beta: Payroll is view only: the not-allowed card, no list, no Export, no Pay from this account; the bank refuses its transactions", ["AC-2", "AC-5"], beta, [
    text("View only"), press("beta_pay"), text("Payroll ••3002"), text("You can see the balance of this account, but not its transactions."), noText("Export"), noText("Pay from this account"), noText("Search"), noText("No transactions"), noText("Transactions · Payroll"),
    refuses("corp.transactions.list", "ACCOUNT_NOT_PERMITTED", { accountId: "beta_pay" }),
    press("beta_ops"), text("Transactions · Operating"), text("Export"), noText("Pay from this account"), noText("You can see the balance of this account, but not its transactions."),
  ]),
  T("T-5", "A period and a search narrow the list; nonsense shows the empty state", ["AC-3"], beta, [
    press("beta_ops"), text("Showing: 30 days"), text("Transfer to Payroll"), text("Metro Utilities"), press("7 days"), text("Showing: 7 days"), noText("Metro Utilities"), text("Delta Wholesale · Payroll Oct"), text("Nimbus Logistics · INV-2291"),
    set({ "ba.q": "Payroll" }), press("Search"), text("Delta Wholesale · Payroll Oct"), noText("Nimbus Logistics · INV-2291"),
    set({ "ba.q": "zzz-nothing" }), press("Search"), text("No transactions"), text("Try another period or search."),
  ]),
  T("T-6", "30 days or 90 days: an older payment appears only in the longer period; a search finds a reference as well as a name", ["AC-3"], alpha, [
    press("alpha_ops"), noText("Freight 1187"), press("90 days"), text("Showing: 90 days"), text("Payroll transfer · Freight 1187"),
    set({ "ba.q": "freight 1187" }), press("Search"), text("Payroll transfer · Freight 1187"), noText("Gulf Trade FZE"), press("This month"), text("Showing: This month"), text("No transactions"),
  ]),
  T("T-7", "With details off there are no numbers to receive money and no Copy details", ["AC-4"], alpha, [press("alpha_ops"), text("Operating ••2001"), text("Available"), noText("Routing number"), noText("Account name"), noText("Copy details"), text("Pay from this account")], { launch: { "opt.details": false } }),
  T("T-8", "A bank with a sort code: the first line is the sort code", ["AC-4"], alpha, [press("alpha_ops"), text("Sort code"), text("20-00-00"), text("Account number"), text("55002001"), noText("Routing number")], { config: { homeMarket: "uk" } }),
  T("T-9", "A bank with an IBAN: the IBAN and the BIC", ["AC-4"], alpha, [press("alpha_ops"), text("IBAN"), text("DE00 BWXB 0000 0000 2001"), text("BIC"), text("BWXBDEFFXXX"), noText("Routing number"), noText("Sort code")], { config: { homeMarket: "eu" } }),
  T("T-10", "Copy details says the details were copied", ["AC-4"], alpha, [press("alpha_ops"), press("Copy details"), { expectToast: "Account details copied" }]),
  T("T-11", "Export opens the statement with the account and the period", ["AC-5"], alpha, [press("alpha_ops"), press("Export"), opens("business-statement", { "launch.accountId": "alpha_ops", "launch.from": "2026-10-05", "launch.to": "2026-11-03" })]),
  T("T-12", "Pay from this account opens Pay a supplier with the account", ["AC-5"], alpha, [press("alpha_ops"), press("Pay from this account"), opens("supplier-payment", { "launch.accountId": "alpha_ops" })]),
  T("T-13", "Opened with an account (a link to it) it goes straight to that account", ["AC-1", "AC-5"], alpha, [screen("main"), text("Operating ••2001"), text("Transactions · Operating"), text("Pay from this account")], { launch: { "launch.accountId": "alpha_ops" } }),
  T("T-14", "When the bank is unavailable the first load shows the retry state and no balances", ["AC-6"], alpha, [screen("loadFail"), text("We couldn’t load your accounts"), text("We couldn’t load your accounts. Try again."), noText("Total balance"), noText("$582,807.78"), press("Try again"), screen("loadFail")], { conditions: { unavailable: ["corp.accounts.overview"] } }),
  T("T-15", "When the bank does not answer in time the retry state says so", ["AC-6"], alpha, [screen("loadFail"), text("This is taking longer than expected. Nothing was changed."), noText("Total balance"), press("Try again"), screen("loadFail")], { conditions: { timeout: ["corp.accounts.overview"], latencyMs: 10000 } }),
  T("T-16", "The transactions failing after the accounts loaded show the retry state, not half a screen", ["AC-6"], alpha, [screen("loadFail"), text("We couldn’t load your accounts"), noText("Total balance")], { conditions: { unavailable: ["corp.transactions.list"] } }),
  T("T-17", "The detail of an account failing shows the retry state", ["AC-6"], alpha, [press("alpha_ops"), screen("loadFail"), text("We couldn’t load your accounts")], { conditions: { unavailable: ["corp.accounts.get"] } }),
  T("T-18", "A company with no accounts shows No accounts yet", ["AC-7"], { persona: "alexempty", context: "gamma", now: NOW }, [screen("empty"), text("No accounts yet"), text("Ask an administrator for access."), noText("Total balance")]),
  T("T-19", "From Personal the bank does not answer for a company, and the screen says to switch first", ["AC-8"], { persona: "alex", now: NOW }, [screen("denied"), text("Switch to your business first"), noText("Total balance"), refuses("corp.accounts.overview", "WRONG_CONTEXT"), refuses("corp.transactions.list", "WRONG_CONTEXT")]),
  T("T-20", "A forced call for an account that does not exist is refused", ["AC-8"], alpha, [screen("main"), refuses("corp.accounts.get", "ACCOUNT_NOT_FOUND", { accountId: "nobody" }), refuses("corp.transactions.list", "ACCOUNT_NOT_FOUND", { accountId: "nobody" })]),
];
