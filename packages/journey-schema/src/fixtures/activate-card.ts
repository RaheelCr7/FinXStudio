import type { Journey, Screen } from "../schema";
import { activateCardAcceptance, activateCardScenarios } from "./activate-card-tests";
import { alert, answerScreens, button, denied, go, lacks, route, set, text } from "./cards-kit";

/** What this journey holds only while it is being sent: the security code and the PIN. Cleared as soon as the bank has answered, and on every way out. */
const wipe = [set("act.cvv", ""), set("act.pin", ""), set("act.repeat", "")];
const err = (e: string) => `act.err == '${e}'`;
const NOW_PIN = "Set it now";
const LATER = "Later";
const CHOOSE_NOW = `act.choice == '${NOW_PIN}'`;

/**
 * Activate card (BankWorkx, Personal: Cards). Turns on a new card with its last 4 digits, expiry and, when the bank asks for it, the 3-digit security code, then
 * sets the PIN now or later. Holding the card is the proof, so no one-time code is asked (as the spec says). The bank counts the wrong tries (three lock the card for
 * good, until the bank resets it) and answers a wrong try as data, so the screen can say how many are left; the security code is cleared as soon as the bank
 * has answered and the PIN as soon as it has been sent.
 *
 * Built from the spec of the prototype with the blocks FinX has: the card step is skipped when a card is passed in or exactly one card is waiting, the date
 * "has expired" is the bank's check (the engine does not know today's date), and a PIN the bank refuses is one message on the PIN screen (the first problem found).
 */
export const activateCard: Journey = {
  id: "jrn_bankworkx_activate_card",
  slug: "activate-card",
  name: "Activate a card",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: activateCardAcceptance,
  scenarios: activateCardScenarios,
  dataModel: {
    "launch.cardId": { type: "string" },
    "opt.askCvv": { type: "boolean" },
    "opt.pinAtActivation": { type: "boolean" },
    "act.cardId": { type: "string", required: true },
    "act.last4": { type: "string", required: true, pattern: "^[0-9]{4}$" },
    "act.expiry": { type: "string", required: true, pattern: "^(0[1-9]|1[0-2])/[0-9]{2}$" },
    "act.cvv": { type: "string", required: true, pattern: "^[0-9]{3}$" },
    "act.choice": { type: "string", required: true },
    "act.pin": { type: "string", required: true, pattern: "^[0-9]{4}$" },
    "act.repeat": { type: "string", required: true },
    "act.mismatch": { type: "boolean" },
    "act.go": { type: "boolean" },
    "act.err": { type: "string" },
    "act.msg": { type: "string" },
  },
  integrations: [
    { id: "eligible", adapter: "bank.cards.eligible", mode: "sandbox" },
    { id: "card", adapter: "bank.cards.get", mode: "sandbox" },
    { id: "verify", adapter: "bank.cards.verifyActivation", mode: "sandbox" },
    { id: "activate", adapter: "bank.cards.activate", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Activate a card", kind: "branch",
      onEnter: [
        ...wipe, set("act.last4", ""), set("act.expiry", ""), set("act.err", ""), set("act.msg", ""), set("act.mismatch", false), set("act.go", false), set("act.choice", NOW_PIN), set("ctx.error", null), set("act.v", null),
        { type: "callApi", integration: "eligible", input: { for: "activate" }, saveAs: "ctx.cards", onError: { navigate: "fail" } },
        // a card passed in is the card; with exactly one card waiting that one is used; otherwise the person chooses
        set("act.cardId", "{{!isEmpty(launch.cardId) ? launch.cardId : ctx.cards.count == 1 ? ctx.cards.firstId : ''}}"),
        go("pick"),
      ],
      navigation: route(
        [lacks("cards.manage"), "denied"],
        ["isEmpty(launch.cardId) && ctx.cards.count == 0", "none"],
        ["!isEmpty(act.cardId)", "check"],
      ),
      blocks: [],
    },
    {
      id: "none", title: "Activate a card", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "Nothing to activate", text: "No cards are waiting to be activated." },
        button("Go to cards", [{ type: "exit" }]),
      ],
    },
    {
      id: "pick", title: "Which card?",
      blocks: [
        text("Which card?", "title"),
        alert("error", "We can’t find that card.", err("notfound")),
        alert("error", "This card is already active.", err("active")),
        alert("error", "This card can’t be activated.", err("blocked")),
        alert("error", "Activation is locked. Please call us.", err("locked")),
        { type: "select", bind: "act.cardId", label: "Card", source: "ctx.cards.cards", variant: "rows", visibleWhen: "ctx.cards.count > 0" },
        button("Continue", [{ type: "validate" }, set("act.err", ""), go("check")], "primary", "ctx.cards.count > 0"),
        button("Go to cards", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      // the card, read again whenever the person moves on from the card step, so a card that changed in between is caught here
      id: "check", title: "Activate a card", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "card", input: { cardId: "{{act.cardId}}" }, saveAs: "ctx.card", onError: { navigate: "fail" } },
        set("act.err", "{{ctx.card.virtual ? 'blocked' : ctx.card.status == 'active' ? 'active' : ctx.card.status == 'frozen' ? 'active' : ctx.card.status == 'inactive' ? (ctx.card.locked ? 'locked' : '') : 'blocked'}}"),
        go("details"),
      ],
      navigation: route(["act.err != ''", "pick"]),
      blocks: [],
    },
    {
      id: "details", title: "Activate your card",
      blocks: [
        text("Activate your card", "title"),
        text("{{ctx.card.name}}", "caption"),
        alert("error", "The details don’t match this card. Check them and try again.", err("mismatch")),
        alert("warning", "{{act.v.triesLeft}} {{act.v.triesLeft == 1 ? 'try' : 'tries'}} left.", "act.err == 'mismatch' && !isEmpty(act.v)"),
        alert("error", "This card has expired.", err("expired")),
        { type: "textInput", bind: "act.last4", label: "Last 4 digits", placeholder: "0000", keyboard: "number", pattern: "^[0-9]{4}$", patternMessage: "Enter the last 4 digits on the card." },
        { type: "textInput", bind: "act.expiry", label: "Expiry date", placeholder: "MM/YY", pattern: "^(0[1-9]|1[0-2])/[0-9]{2}$", patternMessage: "Use MM/YY." },
        { type: "textInput", bind: "act.cvv", label: "Security code", placeholder: "•••", keyboard: "number", secure: true, pattern: "^[0-9]{3}$", patternMessage: "Enter the 3 digits on the back.", visibleWhen: "opt.askCvv != false" },
        button("Continue", [
          { type: "validate" }, set("act.err", ""),
          { type: "callApi", integration: "verify", input: { cardId: "{{act.cardId}}", last4: "{{act.last4}}", expiry: "{{act.expiry}}", securityCode: "{{opt.askCvv != false ? act.cvv : ''}}" }, saveAs: "act.v", onError: { navigate: "fail" } },
          // the bank has the security code (and does not keep it): the journey does not keep it either
          set("act.cvv", ""),
          set("act.err", "{{act.v.code == 'ACTIVATION_MISMATCH' ? 'mismatch' : ''}}"),
          { type: "navigate" },
        ]),
        button("Go to cards", [...wipe, { type: "exit" }], "ghost"),
      ],
      navigation: route(
        ["act.v.verified && opt.pinAtActivation != false", "pin"],
        ["act.v.verified", "activate"],
        ["act.v.code == 'ACTIVATION_LOCKED'", "locked"],
      ),
    },
    {
      id: "pin", title: "Set your PIN",
      blocks: [
        text("Set your PIN", "title"),
        text("{{ctx.card.name}}", "caption"),
        alert("error", "{{act.msg}}", err("pin")),
        alert("error", "The PINs don’t match.", "act.mismatch"),
        { type: "select", bind: "act.choice", label: "PIN", options: [NOW_PIN, LATER] },
        { type: "textInput", bind: "act.pin", label: "New PIN", placeholder: "4 digits", keyboard: "number", secure: true, pattern: "^[0-9]{4}$", patternMessage: "Use exactly 4 digits.", visibleWhen: CHOOSE_NOW },
        { type: "textInput", bind: "act.repeat", label: "Repeat PIN", placeholder: "4 digits", keyboard: "number", secure: true, visibleWhen: CHOOSE_NOW },
        button("Activate card", [{ type: "validate" }, set("act.mismatch", `{{${CHOOSE_NOW} && act.pin != act.repeat}}`), set("act.err", ""), set("act.go", true), { type: "navigate" }]),
        button("Back", [...wipe, set("act.go", false), set("act.mismatch", false), set("act.err", ""), go("details")], "ghost"),
      ],
      navigation: route(["act.go && !act.mismatch", "activate"]),
    },
    {
      id: "activate", title: "Activating", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "activate", input: { cardId: "{{act.cardId}}", pin: `{{opt.pinAtActivation != false ? (${CHOOSE_NOW} ? act.pin : '') : ''}}` }, saveAs: "act.res", onError: { navigate: "fail" } },
        // the bank has the PIN (as a hash): the journey does not keep it
        ...wipe,
        go("done"),
      ],
      blocks: [],
    },
    {
      id: "done", title: "Card activated", kind: "terminal", onEnter: wipe,
      blocks: [
        { type: "result", tone: "success", title: "Card activated", text: "Your card ending {{ctx.card.last4}} is ready to use.", meta: "Active" },
        { type: "reviewSummary", rows: [{ label: "Card", value: "{{act.res.name}}" }, { label: "PIN", value: "{{act.res.pinSet ? 'Set' : 'Not set yet'}}" }] },
        button("Set my PIN", [{ type: "navigate", toJourney: "card-pin", with: { "launch.cardId": "{{act.cardId}}" } }], "primary", "!act.res.pinSet"),
        button("Go to cards", [{ type: "exit" }], "secondary"),
      ],
    },
    {
      id: "locked", title: "Activation locked", kind: "terminal", onEnter: wipe,
      blocks: [
        { type: "result", tone: "error", title: "Too many wrong tries", text: "Too many wrong tries. Activation is locked. Please call us." },
        button("Go to cards", [{ type: "exit" }]),
      ],
    },
    {
      // where a refusal goes: what the person can fix has its screen, what the bank says about the card another, the bank not answering the rest
      id: "fail", title: "Activate a card", kind: "branch",
      onEnter: [
        ...wipe,
        set("act.err", "{{ctx.error.code == 'CARD_NOT_FOUND' ? 'notfound' : ctx.error.code == 'CARD_ALREADY_ACTIVE' ? 'active' : ctx.error.code == 'CARD_BLOCKED' ? 'blocked' : ctx.error.code == 'ACTIVATION_LOCKED' ? 'locked' : ctx.error.code == 'ACTIVATION_MISMATCH' ? 'mismatch' : ctx.error.code == 'CARD_EXPIRED' ? 'expired' : ctx.error.code == 'PIN_WEAK' ? 'pin' : ctx.error.code == 'PIN_INVALID' ? 'pin' : ''}}"),
        set("act.msg", "{{ctx.error.message}}"),
        go("problem"),
      ],
      navigation: route(
        ["ctx.error.code == 'TIMEOUT'", "timeout"],
        ["ctx.error.code == 'SERVICE_UNAVAILABLE'", "unavailable"],
        ["act.err == 'locked'", "locked"],
        ["act.err == 'pin'", "pin"],
        ["act.err == 'mismatch' || act.err == 'expired'", "details"],
        ["act.err != ''", "pick"],
      ),
      blocks: [],
    },
    ...answerScreens("start", "changed", wipe),
    {
      id: "problem", title: "Activate a card", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We couldn’t activate the card", text: "{{act.msg}} Nothing was changed." },
        button("Try again", [go("start")]),
        button("Go to cards", [{ type: "exit" }], "ghost"),
      ],
    },
    denied("Activate a card"),
  ] as Screen[],
};
