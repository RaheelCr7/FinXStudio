import type { Journey, Screen } from "../schema";
import { addCardAcceptance, addCardScenarios } from "./add-card-tests";
import { alert, answerScreens, button, denied, go, lacks, route, set, text } from "./cards-kit";

/** What this journey holds only while it is being sent: the card number, the security code and the code that proves the card. Cleared on every way out. */
const wipe = [set("ac.number", ""), set("ac.cvv", ""), set("ac.code", "")];
const wiped = [...wipe, set("ac.expiry", ""), set("ac.holder", ""), set("ac.postcode", "")];
/** What the bank is asked, for the check of the details and for saving the card: the same. */
const card = { number: "{{ac.number}}", expiry: "{{ac.expiry}}", cvv: "{{ac.cvv}}", holder: "{{ac.holder}}", postcode: "{{ac.postcode}}", acceptAmex: "{{opt.acceptAmex != false}}" };
/** The home markets that do not ask for a billing postcode (Market D of the spec). */
const NO_POSTCODE = "ctx.cfg.homeMarket == 'ae' || ctx.cfg.homeMarket == 'sa' || ctx.cfg.homeMarket == 'jo'";

/**
 * Add a card (BankWorkx, Personal: Cards). Saves a card from another bank to add money or pay. Card details are checked by the bank before anything else, a code proves the person
 * holds the card (a text message, or the code in a small test charge), then a nickname and what the card is used for, and a tick. Up to 5 cards; the same card (last four digits and
 * expiry) cannot be saved twice. The bank keeps the last four digits and the expiry only: the number and the security code are held here from the first screen to the last call and
 * cleared on every way out.
 *
 * Built from the spec of the prototype with the blocks FinX has: each field has a pattern with the spec's message, the bank's own checks (type, length, check digit, expiry, postcode
 * of the home market, a declined card, a duplicate, the limit) come with Continue and show one message above the fields, "{n} tries left" is not drawn, and the line under the
 * number that names the card type is the bank's answer on Continue. The tick that says the person authorises saving the card is kept from the first version of this journey.
 */
export const addCard: Journey = {
  id: "jrn_add_card",
  slug: "add-card",
  name: "Add card",
  version: 2,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: addCardAcceptance,
  scenarios: addCardScenarios,
  dataModel: {
    "opt.acceptAmex": { type: "boolean" },
    "opt.allowPay": { type: "boolean" },
    "ac.number": { type: "string", required: true, pattern: "^[0-9 -]{1,23}$" },
    "ac.expiry": { type: "string", required: true, pattern: "^(0[1-9]|1[0-2])/[0-9]{2}$" },
    "ac.cvv": { type: "string", required: true, pattern: "^[0-9]{3,4}$" },
    "ac.holder": { type: "string", required: true, pattern: "^[A-Za-z .’'-]{2,40}$" },
    "ac.postcode": { type: "string", required: true },
    "ac.method": { type: "string", required: true },
    "ac.code": { type: "string", required: true },
    "ac.nick": { type: "string", pattern: "^(.{2,24})?$" },
    "ac.addMoney": { type: "boolean" },
    "ac.pay": { type: "boolean" },
    "ac.consent": { type: "boolean", required: true },
    "ac.err": { type: "string" },
    "ac.msg": { type: "string" },
  },
  integrations: [
    { id: "appConfig", adapter: "bank.app.config", mode: "sandbox" },
    { id: "check", adapter: "bank.cards.check", mode: "sandbox" },
    { id: "otpSend", adapter: "bank.otp.send", mode: "sandbox" },
    { id: "verify", adapter: "bank.cards.verify", mode: "sandbox" },
    { id: "addCard", adapter: "bank.cards.add", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Add a card", kind: "branch",
      onEnter: [
        ...wiped, set("ac.method", "sms"), set("ac.nick", ""), set("ac.addMoney", true), set("ac.pay", true), set("ac.consent", false), set("ac.err", ""), set("ac.msg", ""), set("ctx.error", null),
        { type: "callApi", integration: "appConfig", saveAs: "ctx.cfg", onError: { navigate: "fail" } },
        go("card"),
      ],
      navigation: route([lacks("payments.create"), "denied"]),
      blocks: [],
    },
    {
      id: "card", title: "Card details",
      blocks: [
        text("Card details", "title"),
        alert("error", "{{ac.msg}}", "ac.err == 'card'"),
        { type: "textInput", bind: "ac.number", label: "Card number", placeholder: "1234 5678 9012 3456", keyboard: "phone", pattern: "^[0-9 -]{1,23}$", patternMessage: "Use digits only." },
        { type: "textInput", bind: "ac.expiry", label: "Expiry", placeholder: "MM/YY", keyboard: "number", pattern: "^(0[1-9]|1[0-2])/[0-9]{2}$", patternMessage: "Use the format MM/YY." },
        { type: "textInput", bind: "ac.cvv", label: "Security code", placeholder: "123", keyboard: "number", secure: true, pattern: "^[0-9]{3,4}$", patternMessage: "Enter the 3 or 4 digits on the card." },
        { type: "textInput", bind: "ac.holder", label: "Name on card", placeholder: "As shown on the card", pattern: "^[A-Za-z .’'-]{2,40}$", patternMessage: "Use letters only." },
        { type: "textInput", bind: "ac.postcode", label: "Billing postcode", placeholder: "62704", visibleWhen: `!(${NO_POSTCODE})` },
        button("Continue", [
          { type: "validate" }, set("ac.err", ""),
          { type: "callApi", integration: "check", input: card, saveAs: "ac.chk", onError: { navigate: "fail" } },
          set("ac.code", ""), go("verify"),
        ]),
        button("Done", [...wiped, { type: "exit" }], "ghost"),
      ],
    },
    {
      id: "verify", title: "Confirm it’s your card",
      onEnter: [{ type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: { navigate: "fail" } }],
      blocks: [
        text("Confirm it’s your card", "title"),
        text("We’ll check the card before we save it. {{ac.chk.typeText}}", "body"),
        alert("error", "That code isn’t right. Try again.", "ac.err == 'code'"),
        {
          type: "select", bind: "ac.method", label: "How do you want to check?", variant: "chips",
          choices: [{ id: "sms", label: "Text message code" }, { id: "charge", label: "Small test charge" }],
        },
        text("Sent to the phone ending {{ac.chk.phoneEnding}}.", "caption", "ac.method == 'sms'"),
        text("We’ve placed a small temporary charge on your card. Its description shows the code. The charge is returned.", "caption", "ac.method == 'charge'"),
        { type: "textInput", bind: "ac.code", label: "Code", placeholder: "6 digits", keyboard: "number", pattern: "^[0-9]{6}$", patternMessage: "Enter the 6-digit code.", visibleWhen: "ac.method == 'sms'" },
        { type: "textInput", bind: "ac.code", label: "Code from the charge", placeholder: "4 digits", keyboard: "number", pattern: "^[0-9]{4}$", patternMessage: "Enter the 4-digit code.", visibleWhen: "ac.method == 'charge'" },
        button("Continue", [
          { type: "validate" }, set("ac.err", ""),
          { type: "callApi", integration: "verify", input: { method: "{{ac.method}}", code: "{{ac.code}}" }, onError: { navigate: "fail" } },
          set("ac.code", ""), go("name"),
        ]),
        button("Back", [set("ac.code", ""), go("card")], "ghost"),
      ],
    },
    {
      id: "name", title: "Save your card",
      blocks: [
        text("Save your card", "title"),
        alert("error", "{{ac.msg}}", "ac.err == 'save'"),
        { type: "textInput", bind: "ac.nick", label: "Nickname (optional)", placeholder: "For example, Joint card", pattern: "^(.{2,24})?$", patternMessage: "Use at least 2 characters." },
        { type: "toggle", bind: "ac.addMoney", label: "Use to add money" },
        { type: "toggle", bind: "ac.pay", label: "Use to pay", visibleWhen: "opt.allowPay != false" },
        {
          type: "consent", bind: "ac.consent", termsVersion: "cards-v2", text: "I authorise BankWorkx to save this card",
          validation: { mustBeTrue: true, messages: { mustBeTrue: "Tick the box to continue" } },
        },
        button("Save card", [
          { type: "validate" }, set("ac.err", ""),
          {
            type: "callApi", integration: "addCard", saveAs: "ac.res", onError: { navigate: "fail" },
            input: { ...card, nickname: "{{ac.nick}}", useToAddMoney: "{{ac.addMoney}}", useToPay: "{{ac.pay}}", allowPay: "{{opt.allowPay != false}}" },
          },
          // the bank has the last four digits and the expiry: the journey does not keep the rest
          ...wiped, go("done"),
        ]),
        button("Back", [go("verify")], "ghost"),
      ],
    },
    {
      id: "done", title: "Card saved", kind: "terminal", onEnter: wiped,
      blocks: [
        { type: "result", tone: "success", title: "Card saved", text: "{{ac.res.typeText}} is ready to use." },
        {
          type: "reviewSummary",
          rows: [{ label: "Card", value: "{{ac.res.typeText}}" }, { label: "Expires", value: "{{ac.res.expiry}}" }, { label: "Used for", value: "{{ac.res.usedFor}}" }],
        },
        { type: "reviewSummary", visibleWhen: "!isEmpty(ac.res.nickname)", rows: [{ label: "Nickname", value: "{{ac.res.nickname}}" }] },
        button("Go to cards", [{ type: "exit" }]),
      ],
    },
    {
      id: "locked", title: "Too many wrong codes", kind: "terminal", onEnter: wiped,
      blocks: [
        { type: "result", tone: "error", title: "Too many wrong codes", text: "Too many wrong codes. Nothing was saved. Go back to start again." },
        button("Back to start", [go("start")]),
        button("Close", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      // where a refusal goes: what the person can fix has its screen, the bank not answering has another
      id: "fail", title: "Add a card", kind: "branch",
      onEnter: [
        set("ac.msg", "{{ctx.error.message}}"),
        set("ac.err", "{{ctx.error.code == 'VERIFY_INVALID' ? 'code' : ctx.error.code == 'VERIFY_REQUIRED' ? 'save' : ctx.error.code == 'NICKNAME_INVALID' ? 'save' : ctx.error.code == 'TIMEOUT' ? '' : ctx.error.code == 'SERVICE_UNAVAILABLE' ? '' : ctx.error.code == 'VERIFY_LOCKED' ? '' : 'card'}}"),
        // what is wrong with the details stays on the screen to be fixed; only the code is cleared (the screens of a timeout, an outage and a lock clear everything)
        set("ac.code", ""), go("problem"),
      ],
      navigation: route(
        ["ctx.error.code == 'TIMEOUT'", "timeout"],
        ["ctx.error.code == 'SERVICE_UNAVAILABLE'", "unavailable"],
        ["ctx.error.code == 'VERIFY_LOCKED'", "locked"],
        ["ctx.error.code == 'VERIFY_INVALID'", "verify"],
        ["ctx.error.code == 'NICKNAME_INVALID'", "name"],
        ["ctx.error.code == 'VERIFY_REQUIRED'", "verify"],
      ),
      blocks: [],
    },
    ...answerScreens("start", "saved", wiped),
    {
      id: "problem", title: "Add a card", kind: "branch", onEnter: [go("card")], blocks: [],
    },
    denied("Add a card"),
  ] as Screen[],
};
