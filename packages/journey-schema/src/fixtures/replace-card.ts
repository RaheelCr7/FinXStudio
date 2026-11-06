import type { Journey, Screen } from "../schema";
import { replaceCardAcceptance, replaceCardScenarios } from "./replace-card-tests";
import { alert, button, denied, go, lacks, route, set, text } from "./cards-kit";

/** What this journey holds only while it is being sent: the one-time code. Cleared on every way out. */
const wipe = [set("otp.code", "")];
const err = (e: string) => `rp.err == '${e}'`;
const LOST_OR_STOLEN = "rp.reason == 'lost' || rp.reason == 'stolen'";
const choice = (id: string, label: string, t: string) => ({ id, label, text: t });
/** What the bank is asked, for the check before the code and for the order: the same. */
const wanted = { cardId: "{{rp.cardId}}", reason: "{{rp.reason}}", speed: "{{rp.speed}}", where: "{{rp.where}}", line: "{{rp.line}}", city: "{{rp.city}}", postcode: "{{rp.postcode}}", fee: "{{opt.expressFee != false}}" };
const speeds = (express: string, visibleWhen: string): any => ({
  type: "select", bind: "rp.speed", label: "How fast?", variant: "tiles", visibleWhen,
  choices: [choice("standard", "Standard", "By the 5th working day · Free"), choice("express", "Express", express)],
});

/**
 * Replace a card (BankWorkx, Personal: Cards). Orders a replacement for a lost, stolen, damaged or expired card: which card (skipped when one is passed in), what
 * happened, where to send it and how fast, a review with the confirmation tick, a one-time code, and the order. A lost or stolen card is blocked at the "what
 * happened" step, at once and without a code (blocking only protects), before the rest of the order; the bank refuses an order for a lost or stolen card that is still
 * working. Every order asks for the code, because the card goes to an address and a fee may be taken (the spec asks for one only when there is a fee).
 *
 * Built from the spec of the prototype with the blocks FinX has: the engine cannot dim an option, so "Expired" is offered always and the bank refuses it for a card
 * that has not expired (with more than 60 days left), the bank's checks come when Continue is pressed, and a refusal is one screen or one message with the bank's
 * own words. A reason passed in (launch.reason) skips the question but not the block.
 */
export const replaceCard: Journey = {
  id: "jrn_bankworkx_replace_card",
  slug: "replace-card",
  name: "Replace a card",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: replaceCardAcceptance,
  scenarios: replaceCardScenarios,
  dataModel: {
    "launch.cardId": { type: "string" },
    "launch.reason": { type: "string" },
    "opt.expressFee": { type: "boolean" },
    "rp.cardId": { type: "string", required: true },
    "rp.reason": { type: "string", required: true },
    "rp.where": { type: "string", required: true },
    "rp.line": { type: "string", required: true, pattern: "^.{3,60}$" },
    "rp.city": { type: "string", required: true, pattern: "^.{2,40}$" },
    "rp.postcode": { type: "string", required: true, pattern: "^[A-Za-z0-9 -]{3,10}$" },
    "rp.speed": { type: "string", required: true },
    "rp.consent": { type: "boolean", required: true },
    "rp.blocked": { type: "boolean" },
    "rp.err": { type: "string" },
    "rp.msg": { type: "string" },
    "otp.code": { type: "string", required: true, pattern: "^[0-9]{6}$" },
  },
  integrations: [
    { id: "eligible", adapter: "bank.cards.eligible", mode: "sandbox" },
    { id: "card", adapter: "bank.cards.get", mode: "sandbox" },
    { id: "block", adapter: "bank.cards.block", mode: "sandbox" },
    { id: "checkReplace", adapter: "bank.cards.replace.check", mode: "sandbox" },
    { id: "otpSend", adapter: "bank.otp.send", mode: "sandbox" },
    { id: "otpVerify", adapter: "bank.otp.verify", mode: "sandbox" },
    { id: "replace", adapter: "bank.cards.replace", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Replace a card", kind: "branch",
      onEnter: [
        ...wipe, set("rp.err", ""), set("rp.msg", ""), set("rp.blocked", false), set("rp.consent", false), set("rp.where", "home"), set("rp.speed", "standard"), set("rp.line", ""), set("rp.city", ""), set("rp.postcode", ""), set("ctx.error", null),
        { type: "callApi", integration: "eligible", input: { for: "replace" }, saveAs: "ctx.cards", onError: { navigate: "fail" } },
        // a card passed in is the card; otherwise the first blocked or expired card is chosen for the person
        set("rp.cardId", "{{isEmpty(launch.cardId) ? ctx.cards.firstId : launch.cardId}}"),
        set("rp.reason", "{{launch.reason == 'lost' ? 'lost' : launch.reason == 'stolen' ? 'stolen' : launch.reason == 'damaged' ? 'damaged' : launch.reason == 'expired' ? 'expired' : ''}}"),
        go("pick"),
      ],
      navigation: route([lacks("cards.manage"), "denied"], ["!isEmpty(launch.cardId)", "check"]),
      blocks: [],
    },
    {
      id: "pick", title: "Which card?",
      blocks: [
        text("Which card?", "title"),
        alert("error", "We can’t find that card.", err("notfound")),
        alert("error", "Virtual cards can’t be replaced. Create a new one instead.", err("virtual")),
        alert("error", "This card has already been replaced.", err("replaced")),
        alert("error", "This card isn’t active yet.", err("inactive")),
        alert("error", "A replacement is already on its way. It arrives by {{ctx.card.replacement.arrivesBy}}.", "rp.err == 'pending' && !isEmpty(ctx.card.replacement)"),
        alert("error", "{{rp.msg}}", "rp.err == 'pending' && isEmpty(ctx.card.replacement)"),
        text("You have no card to replace.", "body", "ctx.cards.count == 0"),
        { type: "select", bind: "rp.cardId", label: "Card", source: "ctx.cards.cards", variant: "rows", visibleWhen: "ctx.cards.count > 0" },
        button("Continue", [{ type: "validate" }, set("rp.err", ""), go("check")], "primary", "ctx.cards.count > 0"),
        button("Go to cards", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      // the card, read again whenever the person moves on from the card step, so a card that changed in between is caught here
      id: "check", title: "Replace a card", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "card", input: { cardId: "{{rp.cardId}}" }, saveAs: "ctx.card", onError: { navigate: "fail" } },
        set("rp.err", "{{ctx.card.virtual ? 'virtual' : !isEmpty(ctx.card.replacement) ? 'pending' : ctx.card.status == 'replaced' ? 'replaced' : ctx.card.status == 'inactive' ? 'inactive' : ''}}"),
        go("reason"),
      ],
      // a reason passed in skips the question, not the block
      navigation: route(["rp.err != ''", "pick"], ["!isEmpty(rp.reason)", "afterReason"]),
      blocks: [],
    },
    {
      id: "reason", title: "What happened?",
      blocks: [
        text("What happened?", "title"),
        text("{{ctx.card.name}}", "caption"),
        alert("error", "{{rp.msg}}", err("reason")),
        {
          type: "select", bind: "rp.reason", label: "Reason", variant: "tiles",
          choices: [
            choice("lost", "Lost", "We block it now"), choice("stolen", "Stolen", "We block it now"),
            choice("damaged", "Damaged", "It keeps working until the new one arrives"), choice("expired", "Expired", "Your card has run out"),
          ],
        },
        button("Block card and continue", [{ type: "validate" }, set("rp.err", ""), go("afterReason")], "primary", LOST_OR_STOLEN),
        button("Continue", [{ type: "validate" }, set("rp.err", ""), go("afterReason")], "primary", `!(${LOST_OR_STOLEN})`),
        button("Go to cards", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      // lost and stolen block the card here; any other reason is checked with the bank (an Expired card has to have expired)
      id: "afterReason", title: "Replace a card", kind: "branch",
      onEnter: [
        set("rp.blocked", "{{rp.reason == 'damaged' ? false : rp.reason == 'expired' ? false : rp.blocked}}"),
        go("checkReason"),
      ],
      navigation: route([LOST_OR_STOLEN, "blockCard"]),
      blocks: [],
    },
    {
      id: "blockCard", title: "Blocking the card", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "block", input: { cardId: "{{rp.cardId}}", reason: "{{rp.reason}}" }, onError: { navigate: "fail" } },
        set("rp.blocked", true),
        go("delivery"),
      ],
      blocks: [],
    },
    {
      id: "checkReason", title: "Replace a card", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "checkReplace", input: { cardId: "{{rp.cardId}}", reason: "{{rp.reason}}", speed: "standard", where: "home", fee: "{{opt.expressFee != false}}" }, saveAs: "ctx.q", onError: { navigate: "fail" } },
        go("delivery"),
      ],
      blocks: [],
    },
    {
      id: "delivery", title: "Delivery",
      blocks: [
        text("Delivery", "title"),
        text("{{ctx.card.name}}", "caption"),
        alert("success", "{{ctx.card.name}} is blocked. No one can use it. This can’t be undone.", "rp.blocked"),
        alert("error", "{{rp.msg}}", err("address")),
        alert("error", "Not enough in your account to pay the delivery fee. Choose Standard.", err("funds")),
        { type: "select", bind: "rp.where", label: "Send it to", variant: "tiles", choices: [choice("home", "Home address", "The address we have on file"), choice("other", "Another address", "Somewhere else")] },
        text("{{ctx.card.homeAddress}}", "caption", "rp.where == 'home'"),
        { type: "textInput", bind: "rp.line", label: "Address line", placeholder: "Street and number", pattern: "^.{3,60}$", patternMessage: "Enter the address line (3 to 60 characters).", visibleWhen: "rp.where == 'other'" },
        { type: "textInput", bind: "rp.city", label: "City", placeholder: "City", pattern: "^.{2,40}$", patternMessage: "Enter the city (2 to 40 characters).", visibleWhen: "rp.where == 'other'" },
        { type: "textInput", bind: "rp.postcode", label: "Postcode", placeholder: "Postcode", pattern: "^[A-Za-z0-9 -]{3,10}$", patternMessage: "Enter a valid postcode.", visibleWhen: "rp.where == 'other' && ctx.card.askPostcode" },
        speeds("By the 2nd working day · $15.00", "opt.expressFee != false"),
        speeds("By the 2nd working day · Free", "opt.expressFee == false"),
        button("Continue", [{ type: "validate" }, set("rp.err", ""), set("rp.consent", false), go("quote")]),
        button("Go to cards", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      // the bank applies every rule of the order (the address, the fee and the balance) before the code is asked for
      id: "quote", title: "Replace a card", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "checkReplace", input: wanted, saveAs: "ctx.q", onError: { navigate: "fail" } },
        go("review"),
      ],
      blocks: [],
    },
    {
      id: "review", title: "Review",
      blocks: [
        text("Review", "title"),
        {
          type: "reviewSummary",
          rows: [
            { label: "Card", value: "{{ctx.q.name}}" },
            { label: "Reason", value: "{{rp.reason == 'lost' ? 'Lost' : rp.reason == 'stolen' ? 'Stolen' : rp.reason == 'damaged' ? 'Damaged' : 'Expired'}}" },
            { label: "Deliver to", value: "{{ctx.q.deliverTo}}" },
            { label: "Delivery", value: "{{ctx.q.deliveryText}}" },
            { label: "Fee", value: "{{ctx.q.feeText}}" },
          ],
        },
        { type: "reviewSummary", visibleWhen: "!isEmpty(ctx.q.oldCard)", rows: [{ label: "Old card", value: "{{ctx.q.oldCard}}" }] },
        {
          type: "consent", bind: "rp.consent", termsVersion: "replace-card-v1", text: "I confirm this order. The card goes to the address above and the fee, if any, is taken from my account.",
          validation: { mustBeTrue: true, messages: { mustBeTrue: "Tick the confirmation first." } },
        },
        button("Continue", [
          { type: "validate" }, ...wipe,
          { type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: { navigate: "fail" } },
          go("code"),
        ]),
        button("Back", [go("delivery")], "ghost"),
      ],
    },
    {
      id: "code", title: "Confirm with your code",
      blocks: [
        text("Confirm with your code", "title"),
        text("{{ctx.q.name}} · {{ctx.q.deliveryText}} · {{ctx.q.feeText}}", "caption"),
        {
          type: "otp", bind: "otp.code", length: 6, maxAttempts: 3, resendAfterSeconds: 30, keypad: true,
          hint: "Code sent to {{ctx.otp.maskedPhone}}.",
          onResend: [{ type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: { navigate: "fail" } }],
        },
        button("Order card", [
          { type: "validate" },
          { type: "callApi", integration: "otpVerify", input: { code: "{{otp.code}}" }, onError: { showToast: "That code isn’t right. Try again.", stay: true, lockAfter: 3, lockTo: "locked" } },
          { type: "callApi", integration: "replace", input: wanted, saveAs: "rp.res", onError: { navigate: "fail" } },
          ...wipe, go("done"),
        ]),
        button("Back", [...wipe, go("review")], "ghost"),
      ],
    },
    {
      id: "done", title: "Replacement ordered", kind: "terminal", onEnter: wipe,
      blocks: [
        { type: "result", tone: "success", title: "Card blocked and replacement ordered", text: "It arrives by {{rp.res.arrivesBy}}.", meta: "On its way", visibleWhen: "rp.reason == 'lost' || rp.reason == 'stolen'" },
        { type: "result", tone: "success", title: "Replacement ordered", text: "It arrives by {{rp.res.arrivesBy}}.", meta: "On its way", visibleWhen: "rp.reason != 'lost' && rp.reason != 'stolen'" },
        {
          type: "reviewSummary",
          rows: [
            { label: "Old card", value: "{{ctx.card.name}}{{rp.blocked ? ' (blocked)' : ''}}" }, { label: "New card", value: "••{{rp.res.last4}}" }, { label: "Deliver to", value: "{{rp.res.deliverTo}}" },
            { label: "Arrives by", value: "{{rp.res.arrivesBy}}" }, { label: "Fee", value: "{{rp.res.feeText}}" },
          ],
        },
        text("The new card is Not activated: activate it when it arrives.", "caption"),
        button("Go to cards", [{ type: "exit" }]),
      ],
    },
    {
      id: "locked", title: "Too many wrong codes", kind: "terminal", onEnter: wipe,
      blocks: [
        { type: "result", tone: "error", title: "Too many wrong codes", text: "Nothing was ordered. Start again when you’re ready. A block you already made stays." },
        button("Start again", [go("start")]),
        button("Back to cards", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      // where a refusal goes: what the person can fix has its screen, what the bank says about the card another, the bank not answering the rest
      id: "fail", title: "Replace a card", kind: "branch",
      onEnter: [
        ...wipe,
        set("rp.err", "{{ctx.error.code == 'CARD_NOT_FOUND' ? 'notfound' : ctx.error.code == 'CARD_VIRTUAL' ? 'virtual' : ctx.error.code == 'CARD_REPLACED' ? 'replaced' : ctx.error.code == 'CARD_NOT_ACTIVATED' ? 'inactive' : ctx.error.code == 'REPLACEMENT_PENDING' ? 'pending' : ctx.error.code == 'REASON_INVALID' ? 'reason' : ctx.error.code == 'CARD_NOT_BLOCKED' ? 'reason' : ctx.error.code == 'ADDRESS_INVALID' ? 'address' : ctx.error.code == 'DELIVERY_INVALID' ? 'address' : ctx.error.code == 'INSUFFICIENT_FUNDS' ? 'funds' : ''}}"),
        set("rp.msg", "{{ctx.error.message}}"),
        set("rp.blocked", "{{ctx.error.code == 'CARD_ALREADY_BLOCKED' ? true : rp.blocked}}"),
        go("problem"),
      ],
      navigation: route(
        ["ctx.error.code == 'TIMEOUT'", "timeout"],
        ["ctx.error.code == 'SERVICE_UNAVAILABLE'", "unavailable"],
        // the card was blocked already: that is what the step wanted
        ["ctx.error.code == 'CARD_ALREADY_BLOCKED'", "delivery"],
        ["ctx.error.code == 'OTP_REQUIRED'", "review"],
        ["rp.err == 'reason'", "reason"],
        ["rp.err == 'address' || rp.err == 'funds'", "delivery"],
        ["rp.err != ''", "pick"],
      ),
      blocks: [],
    },
    {
      id: "timeout", title: "No answer in time", kind: "terminal", onEnter: wipe,
      blocks: [
        { type: "result", tone: "error", title: "This is taking longer than expected", text: "This is taking longer than expected. Check your cards before you try again." },
        text("Nothing was ordered. A block you already made stays.", "caption"),
        button("Try again", [go("start")]),
        button("Close", [{ type: "exit" }], "secondary"),
      ],
    },
    {
      id: "unavailable", title: "Service not available", kind: "terminal", onEnter: wipe,
      blocks: [
        { type: "result", tone: "error", title: "Not available right now", text: "This isn’t available right now. Try again in a few minutes. If your card is lost or stolen, call us." },
        text("Nothing was ordered. A block you already made stays.", "caption"),
        button("Try again", [go("start")]),
        button("Close", [{ type: "exit" }], "secondary"),
      ],
    },
    {
      id: "problem", title: "Replace a card", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We couldn’t order the card", text: "{{rp.msg}} Nothing was ordered." },
        button("Try again", [go("start")]),
        button("Go to cards", [{ type: "exit" }], "ghost"),
      ],
    },
    denied("Replace a card"),
  ] as Screen[],
};
