import type { Journey, Screen } from "../schema";
import { cardPinAcceptance, cardPinScenarios } from "./card-pin-tests";
import { alert, answerScreens, button, denied, go, lacks, route, set, text } from "./cards-kit";

/** What this journey holds only while it is being sent: the PIN and the code. Cleared on every way out. */
const wipe = [set("pin.new", ""), set("pin.confirm", ""), set("otp.code", "")];
const err = (e: string) => `pin.err == '${e}'`;

/**
 * Card PIN (BankWorkx, Personal: Cards). Sets or changes the PIN of a card after a one-time code: which card (skipped when one is passed in), the code, the new
 * PIN typed twice. The PIN is never shown, never kept in the journey after the bank has it, and the bank keeps only a hash.
 *
 * Built from the spec of the prototype with the blocks FinX has: the card is checked again when Continue is pressed (the engine has no live redraw), the
 * messages about a PIN that is too easy are the bank's own (one screen, the first problem found), and "{n} tries left" under the code is not drawn (the code field
 * has no such hint); three wrong codes end the attempt on a screen of their own.
 */
export const cardPin: Journey = {
  id: "jrn_bankworkx_card_pin",
  slug: "card-pin",
  name: "Set or change a card PIN",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: cardPinAcceptance,
  scenarios: cardPinScenarios,
  dataModel: {
    "launch.cardId": { type: "string" },
    "opt.blockWeak": { type: "boolean" },
    "pin.cardId": { type: "string", required: true },
    "pin.new": { type: "string", required: true, pattern: "^[0-9]{4}$" },
    "pin.confirm": { type: "string", required: true },
    "pin.mismatch": { type: "boolean" },
    "pin.verified": { type: "boolean" },
    "pin.err": { type: "string" },
    "pin.msg": { type: "string" },
    "otp.code": { type: "string", required: true, pattern: "^[0-9]{6}$" },
  },
  integrations: [
    { id: "eligible", adapter: "bank.cards.eligible", mode: "sandbox" },
    { id: "card", adapter: "bank.cards.get", mode: "sandbox" },
    { id: "otpSend", adapter: "bank.otp.send", mode: "sandbox" },
    { id: "otpVerify", adapter: "bank.otp.verify", mode: "sandbox" },
    { id: "setPin", adapter: "bank.cards.pin.set", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Set or change a PIN", kind: "branch",
      onEnter: [
        ...wipe, set("pin.err", ""), set("pin.msg", ""), set("pin.mismatch", false), set("pin.verified", false), set("ctx.error", null),
        { type: "callApi", integration: "eligible", input: { for: "pin" }, saveAs: "ctx.cards", onError: { navigate: "fail" } },
        // a card passed in is the card; otherwise the first card that can have a PIN is chosen for the person
        set("pin.cardId", "{{isEmpty(launch.cardId) ? ctx.cards.firstId : launch.cardId}}"),
        go("pick"),
      ],
      navigation: route([lacks("cards.pin"), "denied"], ["!isEmpty(launch.cardId)", "check"]),
      blocks: [],
    },
    {
      id: "pick", title: "Which card?",
      blocks: [
        text("Which card?", "title"),
        alert("error", "We can’t find that card.", err("notfound")),
        alert("error", "Virtual cards don’t have a PIN.", err("virtual")),
        alert("error", "Activate this card first.", err("inactive")),
        alert("error", "This card can’t be changed.", err("other")),
        text("You have no card that can have a PIN.", "body", "ctx.cards.count == 0"),
        { type: "select", bind: "pin.cardId", label: "Card", source: "ctx.cards.cards", variant: "rows", visibleWhen: "ctx.cards.count > 0" },
        button("Continue", [{ type: "validate" }, set("pin.err", ""), go("check")], "primary", "ctx.cards.count > 0"),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      // the card, read again every time the person moves on, so a card that changed in between is caught here
      id: "check", title: "Set or change a PIN", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "card", input: { cardId: "{{pin.cardId}}" }, saveAs: "ctx.card", onError: { navigate: "fail" } },
        set("pin.err", "{{ctx.card.virtual ? 'virtual' : ctx.card.status == 'inactive' ? 'inactive' : ctx.card.status == 'active' ? '' : ctx.card.status == 'frozen' ? '' : 'other'}}"),
        go("code"),
      ],
      navigation: route(["pin.err != ''", "pick"], ["pin.verified", "pin"]),
      blocks: [],
    },
    {
      id: "code", title: "Enter your code",
      onEnter: [{ type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: { navigate: "fail" } }],
      blocks: [
        text("Enter your code", "title"),
        text("{{ctx.card.name}}", "caption"),
        {
          type: "otp", bind: "otp.code", length: 6, maxAttempts: 3, resendAfterSeconds: 30, keypad: true,
          hint: "We sent a 6-digit code to {{ctx.otp.maskedPhone}}.",
          onResend: [{ type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: { navigate: "fail" } }],
        },
        button("Continue", [
          { type: "validate" },
          { type: "callApi", integration: "otpVerify", input: { code: "{{otp.code}}" }, onError: { showToast: "That code isn’t right. Try again.", stay: true, lockAfter: 3, lockTo: "locked" } },
          set("otp.code", ""), set("pin.verified", true), go("check"),
        ]),
        button("Back", [set("otp.code", ""), go("pick")], "ghost"),
      ],
    },
    {
      id: "pin", title: "New PIN",
      blocks: [
        text("New PIN", "title"),
        text("{{ctx.card.name}}", "caption"),
        text("4 digits. Don’t use your birthday.", "caption"),
        alert("error", "{{pin.msg}}", "pin.err == 'weak' || pin.err == 'invalid'"),
        alert("error", "The PINs don’t match.", "pin.mismatch"),
        { type: "textInput", bind: "pin.new", label: "New PIN", placeholder: "4 digits", keyboard: "number", secure: true, pattern: "^[0-9]{4}$", patternMessage: "Enter 4 digits." },
        { type: "textInput", bind: "pin.confirm", label: "Confirm PIN", placeholder: "4 digits", keyboard: "number", secure: true },
        button("Save PIN", [{ type: "validate" }, set("pin.mismatch", "{{pin.new != pin.confirm}}"), set("pin.err", ""), { type: "navigate" }]),
      ],
      navigation: route(["!pin.mismatch", "save"]),
    },
    {
      id: "save", title: "Saving your PIN", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "setPin", input: { cardId: "{{pin.cardId}}", pin: "{{pin.new}}", blockWeak: "{{opt.blockWeak != false}}" }, saveAs: "pin.res", onError: { navigate: "fail" } },
        // the bank has the PIN (as a hash): the journey does not keep it
        ...wipe, set("pin.verified", false),
        go("done"),
      ],
      blocks: [],
    },
    {
      id: "done", title: "PIN saved", kind: "terminal", onEnter: wipe,
      blocks: [
        { type: "result", tone: "success", title: "PIN set", text: "Use your new PIN from now on.", visibleWhen: "pin.res.firstSet" },
        { type: "result", tone: "success", title: "PIN changed", text: "Use your new PIN from now on.", visibleWhen: "!pin.res.firstSet" },
        { type: "reviewSummary", rows: [{ label: "Card", value: "{{pin.res.name}}" }, { label: "Ready to use", value: "Now" }] },
        button("Go to cards", [{ type: "exit" }]),
      ],
    },
    {
      id: "locked", title: "Too many wrong codes", kind: "terminal", onEnter: wipe,
      blocks: [
        { type: "result", tone: "error", title: "Too many wrong codes", text: "Too many wrong codes. Nothing was changed. Go back to start again." },
        button("Back to start", [go("start")]),
        button("Close", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      // where a refusal goes: what the person can fix has its screen, the bank not answering has another
      id: "fail", title: "Set or change a PIN", kind: "branch",
      onEnter: [
        ...wipe, set("pin.verified", false),
        set("pin.err", "{{ctx.error.code == 'CARD_NOT_FOUND' ? 'notfound' : ctx.error.code == 'PIN_WEAK' ? 'weak' : ctx.error.code == 'PIN_INVALID' ? 'invalid' : ctx.error.code == 'CARD_VIRTUAL' ? 'virtual' : ctx.error.code == 'CARD_NOT_ACTIVATED' ? 'inactive' : ctx.error.code == 'CARD_NOT_ACTIVE' ? 'other' : ''}}"),
        set("pin.msg", "{{ctx.error.message}}"),
        go("problem"),
      ],
      navigation: route(
        ["ctx.error.code == 'TIMEOUT'", "timeout"],
        ["ctx.error.code == 'SERVICE_UNAVAILABLE'", "unavailable"],
        ["pin.err == 'weak' || pin.err == 'invalid'", "pin"],
        ["pin.err != ''", "pick"],
        ["ctx.error.code == 'OTP_REQUIRED'", "code"],
      ),
      blocks: [],
    },
    ...answerScreens("start", "changed", wipe),
    {
      id: "problem", title: "Set or change a PIN", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We couldn’t save the PIN", text: "{{pin.msg}} Nothing was changed." },
        button("Try again", [go("start")]),
        button("Close", [{ type: "exit" }], "ghost"),
      ],
    },
    denied("Set or change a PIN"),
  ] as Screen[],
};
