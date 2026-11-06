import type { Block, Journey, Screen } from "../schema";
import { cardsViewAcceptance, cardsViewScenarios } from "./cards-tests";
import { alert, button, denied, go, holds, lacks, route, row, set, text } from "./cards-kit";

const SEL = "cards.sel";
/** The card that is chosen, as the bank describes it. */
const C = `ctx.cards.cards[${SEL}]`;
const can = (action: string, option: string, permission: string) => `${C}.can.${action} && opt.${option} != false && ${holds(permission)}`;
const open = (journey: string, values: Record<string, unknown>) => [{ type: "navigate" as const, toJourney: journey, with: { "launch.cardId": `{{${SEL}}}`, ...values } }];
const RECENT = { cardId: "{{cards.sel}}", limit: 5 };
const load = { type: "callApi" as const, integration: "recent", input: RECENT, saveAs: "ctx.recent", onError: { navigate: "recentFail" } };

/** One card face: the number, the holder and expiry, its status pill, and a mark on the card that is chosen. Tapping it chooses it and reads its latest spending. */
const faces: Block = {
  type: "menu", source: "ctx.cards.cards",
  item: {
    label: "{{item.id == cards.sel ? '▶ ' : ''}}{{item.name}}",
    text: "{{item.pill}} · {{item.number}} · {{item.holderLine}}",
    icon: "card",
    actions: [set(SEL, "{{item.id}}"), set("cards.msg", ""), load],
  },
};

/**
 * Cards (BankWorkx, Personal: Cards). A view, not a form: every card the bank issued as a face with its number, holder and expiry and a status pill (Active, Virtual,
 * Not activated, Frozen, Blocked, Expired, Replaced); the chosen card with one line that says what it can do now (activate it, it cannot be used, available credit and the
 * minimum due, what is left of a virtual card, the available balance); quick actions that follow the card's state; its latest spending. Freeze is instant (it only protects);
 * everything that loosens a card (Unfreeze) opens card-controls, which asks for a code.
 *
 * Built from the spec of the prototype with the blocks FinX has: the faces are a list that you tap (the engine has no sideways carousel or outline), the Wallet action is not
 * drawn (there is no card-wallet journey yet), and an unfreeze here is not instant: it opens card-controls, which asks for a one-time code (the spec's open point T-6).
 * The shell's own Cards tab is unchanged; this journey is the view a bank can switch off.
 */
export const cardsView: Journey = {
  id: "jrn_bankworkx_cards",
  slug: "cards",
  name: "Cards",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: cardsViewAcceptance,
  scenarios: cardsViewScenarios,
  dataModel: {
    "launch.cardId": { type: "string" },
    "opt.showTx": { type: "boolean" },
    "opt.showWallet": { type: "boolean" },
    "opt.freezeEntry": { type: "boolean" },
    "opt.controlsEntry": { type: "boolean" },
    "opt.pinEntry": { type: "boolean" },
    "opt.activateEntry": { type: "boolean" },
    "opt.replaceEntry": { type: "boolean" },
    "opt.addCard": { type: "boolean" },
    "opt.seeAll": { type: "boolean" },
    "cards.sel": { type: "string" },
    "cards.msg": { type: "string" },
    "cards.stale": { type: "boolean" },
    "cards.recentFailed": { type: "boolean" },
  },
  integrations: [
    { id: "eligible", adapter: "bank.cards.eligible", mode: "sandbox" },
    { id: "freeze", adapter: "bank.cards.freeze", mode: "sandbox" },
    { id: "recent", adapter: "bank.cards.transactions", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Cards", kind: "branch",
      onEnter: [
        set("cards.msg", ""), set("cards.stale", false), set("cards.recentFailed", false), set("ctx.error", null),
        { type: "callApi", integration: "eligible", input: { for: "view" }, saveAs: "ctx.cards", onError: { navigate: "loadFail" } },
        // opened with a card (a link to /personal/cards?cardId=...): that card is chosen; otherwise the first one
        set(SEL, "{{isEmpty(launch.cardId) ? ctx.cards.firstId : has(ctx.cards.cards, launch.cardId) ? launch.cardId : ctx.cards.firstId}}"),
        { type: "callApi", integration: "recent", input: { cardId: "{{cards.sel}}", limit: 5 }, saveAs: "ctx.recent", onError: { navigate: "recentFail" } },
        go("list"),
      ],
      navigation: route([lacks("cards.view"), "denied"], ["ctx.cards.count == 0", "empty"]),
      blocks: [],
    },
    {
      id: "list", title: "Cards",
      blocks: [
        text("Cards", "title"),
        alert("warning", "Some of this may be out of date.", "cards.stale"),
        alert("error", "{{cards.msg}}", "!isEmpty(cards.msg)"),
        faces,
        text("{{" + C + ".name}}", "title"),
        text("{{" + C + ".line}}", "body"),
        // quick actions: each only when the card's state allows it, its journey is on and the person may use it
        row("freeze", "Freeze", "Stops the card at once", [
          { type: "callApi", integration: "freeze", input: { cardId: "{{cards.sel}}" }, onError: { navigate: "freezeFail" } },
          { type: "callApi", integration: "eligible", input: { for: "view" }, saveAs: "ctx.cards", onError: { navigate: "staleList" } },
          set("cards.msg", ""), { type: "showToast", text: "Card frozen" },
        ], can("freeze", "freezeEntry", "cards.manage")),
        row("unfreeze", "Unfreeze", "Asks for a code", open("card-controls", { "launch.mode": "unfreeze" }), can("unfreeze", "freezeEntry", "cards.manage")),
        row("controls", "Controls", "Limits, where it works and alerts", open("card-controls", { "launch.mode": "all" }), can("controls", "controlsEntry", "cards.manage")),
        row("pin", "PIN", "Set or change the PIN", open("card-pin", {}), can("pin", "pinEntry", "cards.pin")),
        row("activate", "Activate", "Turn on your new card", open("activate-card", {}), can("activate", "activateEntry", "cards.manage")),
        row("replace", "Replace", "Order a new card", open("replace-card", {}), can("replace", "replaceEntry", "cards.manage")),
        { type: "sectionHeader", title: "Recent", visibleWhen: `opt.showTx != false && (${C}.status == 'active' || ${C}.status == 'frozen')` },
        text("We couldn’t load the activity.", "caption", "cards.recentFailed"),
        {
          type: "menu", source: "ctx.recent.items", visibleWhen: `opt.showTx != false && len(ctx.recent.items) > 0 && (${C}.status == 'active' || ${C}.status == 'frozen')`,
          item: { label: "{{item.merchant}}", text: "{{item.when}} · {{item.amountText}}", icon: "bag", actions: [] },
        },
        text("No card activity yet", "caption", `opt.showTx != false && ctx.recent.total == 0 && !cards.recentFailed && (${C}.status == 'active' || ${C}.status == 'frozen')`),
        row("seeAll", "See all", "The account this card spends from", [{ type: "navigate", toJourney: "account-details", with: { "launch.accountId": `{{${C}.accountId}}` } }],
          `opt.showTx != false && opt.seeAll != false && !${C}.credit && !isEmpty(${C}.accountId) && (${C}.status == 'active' || ${C}.status == 'frozen')`),
        button("Add a card", [{ type: "navigate", toJourney: "add-card" }], "secondary", `opt.addCard != false && ${holds("payments.create")}`),
        row("refresh", "Refresh", "Load the cards again", [
          { type: "callApi", integration: "eligible", input: { for: "view" }, saveAs: "ctx.cards", onError: { navigate: "staleList" } },
          { ...load }, set("cards.stale", false),
        ]),
      ],
    },
    {
      // the freeze was refused or the bank did not answer: the card is as it was, and the person is told
      id: "freezeFail", title: "Cards", kind: "branch",
      onEnter: [
        set("cards.msg", "{{ctx.error.code == 'CARD_NOT_ACTIVE' ? 'Only an active card can be frozen.' : ctx.error.code == 'CARD_ALREADY_FROZEN' ? 'This card is already frozen.' : ctx.error.code == 'CARD_NOT_FOUND' ? 'We can’t find that card.' : ctx.error.code == 'TIMEOUT' ? 'This is taking longer than expected. Nothing was changed.' : 'This isn’t available right now. Nothing was changed. Try again in a few minutes.'}}"),
        go("list"),
      ],
      blocks: [],
    },
    // a refresh that failed after the list had loaded: the list stays, with a note that it may be out of date
    { id: "staleList", title: "Cards", kind: "branch", onEnter: [set("cards.stale", true), go("list")], blocks: [] },
    // the latest spending could not be read: the cards stay, and the Recent list says so
    { id: "recentFail", title: "Cards", kind: "branch", onEnter: [set("cards.recentFailed", true), set("ctx.recent", { items: [], total: 0 }), go("list")], blocks: [] },
    {
      id: "empty", title: "Cards",
      blocks: [
        text("No cards yet", "title"),
        text("Your cards will show here.", "body"),
        button("Add a card", [{ type: "navigate", toJourney: "add-card" }], "primary", `opt.addCard != false && ${holds("payments.create")}`),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "loadFail", title: "Cards",
      blocks: [
        text("We couldn’t load your cards", "title"),
        text("This is taking longer than expected. Nothing was changed.", "body", "ctx.error.code == 'TIMEOUT'"),
        text("Nothing was changed. Try again in a moment.", "body", "ctx.error.code != 'TIMEOUT'"),
        button("Try again", [go("start")]),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    denied("Cards"),
  ] as Screen[],
};
