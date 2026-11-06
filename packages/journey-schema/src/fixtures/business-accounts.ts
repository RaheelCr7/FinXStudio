import type { Journey } from "../schema";
import { businessAccountsAcceptance, businessAccountsScenarios } from "./business-accounts-tests";
import { alert, button, denyScreen, go, holds, lacks, NOW_DENIED, route, set, text, toRoute } from "./business-kit";

const CAN_EXPORT = "(isEmpty(ba.sel) ? ctx.ov.exportable > 0 : ctx.det.rights.export)";
/** One period button: it sets the period and reads the list again. */
const period = (id: string, label: string) => ({ id, label, icon: "calendar", actions: [set("ba.period", id), go("refresh")] });

/**
 * Business accounts (BankWorkx Business, Accounts). A view, not a form: the total across the company's accounts, a row for each with its available and
 * ledger balance, and one list of transactions with a period and a search. A row selects the account: its numbers for receiving money, Pay from this account,
 * and its own transactions. Nothing here moves money and no code is asked.
 *
 * Built from the spec with the blocks FinX has (docs/BANKWORKX.md): the period and the search are applied with a button (there is no live redraw), the account
 * detail sits under the table instead of beside it on a wide screen, Copy details is a message (the engine has no clipboard) and the skeleton is not drawn. The
 * shell's own Accounts tab is unchanged; this is the view a bank can switch off.
 */
export const businessAccounts: Journey = {
  id: "jrn_business_accounts",
  slug: "business-accounts",
  name: "Business accounts",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: businessAccountsAcceptance,
  scenarios: businessAccountsScenarios,
  dataModel: {
    "launch.accountId": { type: "string" },
    "opt.details": { type: "boolean" },
    "ba.sel": { type: "string" },
    "ba.pick": { type: "string" },
    "ba.period": { type: "string" },
    "ba.q": { type: "string" },
  },
  integrations: [
    { id: "overview", adapter: "corp.accounts.overview", mode: "sandbox" },
    { id: "account", adapter: "corp.accounts.get", mode: "sandbox" },
    { id: "tx", adapter: "corp.transactions.list", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Accounts", kind: "branch",
      onEnter: [
        set("ctx.error", null), set("ba.sel", ""), set("ba.period", "30d"), set("ba.q", ""), set("ctx.tx", { count: 0, rows: {} }), set("ctx.det", null),
        { type: "callApi", integration: "overview", saveAs: "ctx.ov", onError: toRoute },
        go("txload"),
      ],
      // opened with an account (Pay from, Export and the links of the Accounts tab pass one): straight to it
      navigation: route([lacks("biz.accounts.view"), "denied"], ["ctx.ov.count == 0", "empty"], ["!isEmpty(launch.accountId)", "pick"]),
      blocks: [],
    },
    {
      id: "pick", title: "Accounts", kind: "branch",
      onEnter: [set("ba.sel", "{{has(ctx.ov.accounts, launch.accountId) ? launch.accountId : ''}}"), set("launch.accountId", ""), go("refresh")],
      blocks: [],
    },
    {
      // a row was pressed: that account is selected, or cleared when it was the selected one
      id: "toggle", title: "Accounts", kind: "branch",
      onEnter: [set("ba.sel", "{{ba.sel == ba.pick ? '' : ba.pick}}"), go("refresh")],
      blocks: [],
    },
    {
      // an account without the right to see its transactions is not asked for them
      id: "refresh", title: "Accounts", kind: "branch",
      onEnter: [set("ctx.error", null), set("ctx.tx", { count: 0, rows: {} }), go("txload")],
      navigation: route(["!isEmpty(ba.sel) && !ctx.ov.accounts[ba.sel].rights.transactions", "detail"]),
      blocks: [],
    },
    {
      id: "txload", title: "Accounts", kind: "branch",
      onEnter: [{ type: "callApi", integration: "tx", input: { accountId: "{{ba.sel}}", period: "{{ba.period}}", text: "{{ba.q}}" }, saveAs: "ctx.tx", onError: toRoute }, go("detail")],
      navigation: route(["isEmpty(ba.sel)", "main"]),
      blocks: [],
    },
    {
      id: "detail", title: "Accounts", kind: "branch",
      onEnter: [set("ctx.det", null), { type: "callApi", integration: "account", input: { accountId: "{{ba.sel}}", details: "{{opt.details != false}}" }, saveAs: "ctx.det", onError: toRoute }, go("main")],
      blocks: [],
    },
    {
      id: "main", title: "Accounts",
      blocks: [
        text("Accounts", "title"),
        text("{{ctx.ov.company}}", "caption"),
        text("Total balance: {{ctx.ov.totalText}}", "title"),
        text("{{ctx.ov.note}}. {{ctx.ov.rates}}", "caption"),
        {
          type: "dataTable", source: "ctx.ov.accounts", label: "Accounts",
          columns: [
            { key: "nameText", label: "Account" }, { key: "maskedNumber", label: "Number" }, { key: "currency", label: "Currency" },
            { key: "availableBalance", label: "Available", type: "money", currencyKey: "currency" }, { key: "ledgerBalance", label: "Ledger", type: "money", currencyKey: "currency" },
          ],
          onRowPress: [set("ba.pick", "{{item.id}}"), go("toggle")],
        },
        text("Select an account to see its details. Select it again to clear.", "caption", "isEmpty(ba.sel)"),
        // the selected account
        { type: "sectionHeader", title: "{{ctx.det.name}} {{ctx.det.maskedNumber}}", subtitle: "{{ctx.det.chip}}", visibleWhen: "!isEmpty(ba.sel) && !isEmpty(ctx.det)" },
        {
          type: "reviewSummary", visibleWhen: "!isEmpty(ba.sel) && !isEmpty(ctx.det)",
          rows: [{ label: "Currency", value: "{{ctx.det.currency}}" }, { label: "Available", value: "{{ctx.det.availableText}}" }, { label: "Ledger", value: "{{ctx.det.ledgerText}}" }],
        },
        {
          type: "reviewSummary", visibleWhen: "!isEmpty(ba.sel) && !isEmpty(ctx.det) && !isEmpty(ctx.det.identifiers)",
          rows: [
            { label: "{{ctx.det.identifiers.first.label}}", value: "{{ctx.det.identifiers.first.value}}" },
            { label: "{{ctx.det.identifiers.second.label}}", value: "{{ctx.det.identifiers.second.value}}" },
            { label: "{{ctx.det.identifiers.name.label}}", value: "{{ctx.det.identifiers.name.value}}" },
          ],
        },
        button("Copy details", [{ type: "showToast", text: "Account details copied" }], "secondary", "!isEmpty(ba.sel) && !isEmpty(ctx.det) && !isEmpty(ctx.det.identifiers)"),
        button("Pay from this account", [{ type: "navigate", toJourney: "supplier-payment", with: { "launch.accountId": "{{ba.sel}}" } }], "secondary", "!isEmpty(ba.sel) && !isEmpty(ctx.det) && ctx.det.rights.pay"),
        { type: "result", tone: "error", title: "You can’t see these transactions", text: "You can see the balance of this account, but not its transactions.", visibleWhen: "!isEmpty(ba.sel) && !isEmpty(ctx.det) && !ctx.det.rights.transactions" },
        // the transactions
        { type: "sectionHeader", title: "Transactions{{isEmpty(ba.sel) ? '' : ' · ' + ctx.det.name}}", subtitle: "Showing: {{ctx.tx.periodText}}", visibleWhen: "isEmpty(ba.sel) || ctx.det.rights.transactions" },
        {
          type: "shortcuts", visibleWhen: "isEmpty(ba.sel) || ctx.det.rights.transactions",
          items: [period("7d", "7 days"), period("30d", "30 days"), period("90d", "90 days"), period("month", "This month")],
        },
        { type: "textInput", bind: "ba.q", label: "Search", placeholder: "Counterparty or reference", visibleWhen: "isEmpty(ba.sel) || ctx.det.rights.transactions" },
        button("Search", [go("refresh")], "secondary", "isEmpty(ba.sel) || ctx.det.rights.transactions"),
        button("Export", [{ type: "navigate", toJourney: "business-statement", with: { "launch.accountId": "{{ba.sel}}", "launch.from": "{{ctx.tx.from}}", "launch.to": "{{ctx.tx.to}}" } }], "secondary", `${CAN_EXPORT} && ${holds("biz.accounts.export")} && (isEmpty(ba.sel) || ctx.det.rights.transactions)`),
        {
          type: "dataTable", source: "ctx.tx.rows", label: "Transactions", visibleWhen: "ctx.tx.count > 0 && isEmpty(ba.sel)", pageSize: 25,
          columns: [{ key: "date", label: "Date" }, { key: "text", label: "Description" }, { key: "where", label: "Account" }, { key: "amount", label: "Amount", type: "money", currencyKey: "currency" }],
        },
        {
          type: "dataTable", source: "ctx.tx.rows", label: "Transactions", visibleWhen: "ctx.tx.count > 0 && !isEmpty(ba.sel)", pageSize: 25,
          columns: [{ key: "date", label: "Date" }, { key: "text", label: "Description" }, { key: "where", label: "Status" }, { key: "amount", label: "Amount", type: "money", currencyKey: "currency" }],
        },
        text("{{ctx.tx.shown}} of {{ctx.tx.count}} shown", "caption", "ctx.tx.count > ctx.tx.shown"),
        text("No transactions", "title", "ctx.tx.count == 0 && (isEmpty(ba.sel) || ctx.det.rights.transactions)"),
        text("Try another period or search.", "body", "ctx.tx.count == 0 && (isEmpty(ba.sel) || ctx.det.rights.transactions)"),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "empty", title: "Accounts", kind: "terminal",
      blocks: [text("No accounts yet", "title"), text("Ask an administrator for access.", "body"), button("Done", [{ type: "exit" }], "ghost")],
    },
    {
      // the bank could not be reached: the retry state, with no balances
      id: "loadFail", title: "Accounts", kind: "terminal",
      blocks: [
        text("We couldn’t load your accounts", "title"),
        alert("error", "We couldn’t load your accounts. Try again.", "ctx.error.code != 'TIMEOUT'"),
        alert("error", "This is taking longer than expected. Nothing was changed.", "ctx.error.code == 'TIMEOUT'"),
        button("Try again", [go("start")]),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    { id: "route", title: "One moment", kind: "branch", onEnter: [go("loadFail")], navigation: route([NOW_DENIED, "denied"]), blocks: [] },
    denyScreen("Accounts", "see accounts"),
  ],
};
