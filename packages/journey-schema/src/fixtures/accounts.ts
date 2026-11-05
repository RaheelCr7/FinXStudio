import type { Block, Journey, Screen } from "../schema";
import { accountsAcceptance, accountsScenarios } from "./accounts-tests";
import { alert, button, denied, go, holds, lacks, route, row, set, text } from "./accounts-kit";

const HIDE = "acc.hide";
/** One group of the list: a small heading and a row for each account, each opening it in account-details. */
const group = (id: "everyday" | "savings" | "other" | "hidden", heading: string): Block[] => [
  { type: "sectionHeader", title: heading, visibleWhen: `len(ctx.acc.groups.${id}) > 0` },
  {
    type: "menu", source: `ctx.acc.groups.${id}`, visibleWhen: `len(ctx.acc.groups.${id}) > 0`,
    item: {
      label: "{{item.name}}",
      // the available balance (the ledger balance less what is on hold), in the account's own currency, and a chip for an account that is not active
      text: `{{item.line}} · {{${HIDE} ? '••••••' : item.balanceText}}{{item.chip ? ' · ' + item.chip : ''}}{{item.hidden ? ' · Hidden' : ''}}`,
      icon: "wallet",
      actions: [{ type: "navigate", toJourney: "account-details", with: { "launch.accountId": "{{item.id}}", "launch.hide": `{{${HIDE}}}` } }],
    },
  },
];

const OPEN_ANOTHER = `opt.openAnother != false && ${holds("accounts.manage")}`;

/**
 * Accounts (BankWorkx, Personal: Accounts). A view, not a form: every account in one place with a total in the home currency and one row per account with
 * its available balance, grouped as Everyday, Savings, Other currencies and (dimmed) Hidden. A row opens the account in account-details. Nothing here moves money.
 *
 * Built from the spec of the prototype with the blocks FinX has: the account does not open beside the list on a wide screen (it opens in account-details),
 * and the skeleton is not drawn. The shell's own Accounts tab is unchanged; this journey is the view a bank can switch off.
 */
export const accounts: Journey = {
  id: "jrn_bankworkx_accounts",
  slug: "accounts",
  name: "Accounts",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: accountsAcceptance,
  scenarios: accountsScenarios,
  dataModel: {
    "launch.accountId": { type: "string" },
    "opt.hideBalance": { type: "boolean" },
    "opt.showFx": { type: "boolean" },
    "opt.openAnother": { type: "boolean" },
    "acc.hide": { type: "boolean" },
    "acc.stale": { type: "boolean" },
  },
  integrations: [{ id: "overview", adapter: "bank.accounts.overview", mode: "sandbox" }],
  screens: [
    {
      id: "start", title: "Accounts", kind: "branch",
      onEnter: [
        set("acc.hide", false), set("acc.stale", false), set("ctx.error", null),
        { type: "callApi", integration: "overview", input: { showFx: "{{opt.showFx != false}}" }, saveAs: "ctx.acc", onError: { navigate: "loadFail" } },
        go("list"),
      ],
      // opened with an account (a link to /personal/accounts?accountId=...): straight to that account
      navigation: route([lacks("accounts.view"), "denied"], ["!isEmpty(launch.accountId)", "open"], ["ctx.acc.count == 0", "empty"]),
      blocks: [],
    },
    {
      id: "list", title: "Accounts",
      blocks: [
        text("Accounts", "title"),
        alert("warning", "Some balances may be out of date.", "acc.stale"),
        text("Total balance", "caption"),
        text(`{{${HIDE} ? '••••••' : ctx.acc.total.text}}`, "title"),
        row("hide", "Hide", "Mask every amount on this screen", [set(HIDE, true)], `opt.hideBalance != false && !${HIDE}`),
        row("show", "Show", "Bring the amounts back", [set(HIDE, false)], `opt.hideBalance != false && ${HIDE}`),
        ...group("everyday", "Everyday"),
        ...group("savings", "Savings"),
        ...group("other", "Other currencies"),
        ...group("hidden", "Hidden"),
        row("open", "Open another account", "A current, savings or currency account", [{ type: "navigate", toJourney: "open-another-account" }], OPEN_ANOTHER),
        row("refresh", "Refresh", "Load the accounts again", [
          { type: "callApi", integration: "overview", input: { showFx: "{{opt.showFx != false}}" }, saveAs: "ctx.acc", onError: { navigate: "stale" } },
          set("acc.stale", false),
        ]),
      ],
    },
    // a refresh that failed after the list had loaded: the list stays, with a note that it may be out of date
    { id: "stale", title: "Accounts", kind: "branch", onEnter: [set("acc.stale", true), go("list")], blocks: [] },
    { id: "open", title: "Accounts", kind: "branch", onEnter: [{ type: "navigate", toJourney: "account-details", with: { "launch.accountId": "{{launch.accountId}}" } }], blocks: [] },
    {
      id: "empty", title: "Accounts",
      blocks: [
        text("No accounts yet", "title"),
        text("Open one in a few minutes.", "body"),
        button("Open an account", [{ type: "navigate", toJourney: "open-another-account" }], "primary", OPEN_ANOTHER),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "loadFail", title: "Accounts",
      blocks: [
        text("We couldn’t load your accounts", "title"),
        text("This is taking longer than expected. Nothing was changed.", "body", "ctx.error.code == 'TIMEOUT'"),
        text("Nothing was changed. Please try again.", "body", "ctx.error.code != 'TIMEOUT'"),
        button("Try again", [go("start")]),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    denied("Accounts"),
  ] as Screen[],
};
