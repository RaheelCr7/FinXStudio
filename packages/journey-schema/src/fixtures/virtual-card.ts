import type { Journey, Screen } from "../schema";
import { virtualCardAcceptance, virtualCardScenarios } from "./virtual-card-tests";
import { alert, answerScreens, button, denied, go, lacks, route, set, text } from "./cards-kit";

/** What this journey holds only for the bank's call: the code. */
const wipe = [set("otp.code", "")];
/** The code and the details of a card made once: cleared on every way out (the number and the security code are shown once, on the result, and nowhere after). */
const wipeAll = [...wipe, set("vc.res", null)];
const err = (e: string) => `vc.err == '${e}'`;
const choice = (id: string, label: string, t: string) => ({ id, label, text: t });
/** What the bank is asked, for the check before the code and for making the card: the same. */
const wanted = { cardId: "{{vc.cardId}}", purpose: "{{vc.purpose}}", limit: "{{vc.limit}}", singleUse: "{{vc.life == 'single'}}" };

/**
 * Virtual card (BankWorkx, Personal: Cards). A virtual card for online shopping, subscriptions or one payment, linked to one of the person's active physical cards, with
 * its own limit. Which card (skipped when one is passed in or there is only one), what it is for, the limit, how long it lasts, a review the bank has checked (the
 * five-card cap included), a one-time code, and a result that shows the number and the security code once.
 *
 * Built from the spec of the prototype with the blocks FinX has: the card is checked when Continue is pressed (the engine has no live redraw), the Copy buttons of
 * the result are not built (the engine has no clipboard), and the number and security code, which only the bank's answer to the last call carries, are held on the
 * result screen and cleared when the person leaves it.
 */
export const virtualCard: Journey = {
  id: "jrn_bankworkx_virtual_card",
  slug: "virtual-card",
  name: "Virtual card",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: virtualCardAcceptance,
  scenarios: virtualCardScenarios,
  dataModel: {
    "launch.cardId": { type: "string" },
    "opt.allowThreeYears": { type: "boolean" },
    "vc.cardId": { type: "string", required: true },
    "vc.purpose": { type: "string", required: true },
    "vc.limit": { type: "money", currency: "USD", required: true },
    "vc.life": { type: "string", required: true },
    "vc.err": { type: "string" },
    "vc.go": { type: "boolean" },
    "otp.code": { type: "string", required: true, pattern: "^[0-9]{6}$" },
  },
  integrations: [
    { id: "eligible", adapter: "bank.cards.eligible", mode: "sandbox" },
    { id: "check", adapter: "bank.cards.virtual.create", mode: "sandbox" },
    { id: "otpSend", adapter: "bank.otp.send", mode: "sandbox" },
    { id: "otpVerify", adapter: "bank.otp.verify", mode: "sandbox" },
    { id: "create", adapter: "bank.cards.virtual.create", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Virtual card", kind: "branch",
      onEnter: [
        ...wipeAll, set("vc.err", ""), set("vc.go", false), set("vc.life", ""), set("vc.purpose", ""), set("ctx.error", null),
        { type: "callApi", integration: "eligible", input: { for: "virtual" }, saveAs: "ctx.cards", onError: { navigate: "fail" } },
        // a card passed in is used when it is one of the active physical cards; otherwise the only such card, or the person chooses
        set("vc.cardId", "{{has(ctx.cards.cards, launch.cardId) ? launch.cardId : ctx.cards.count == 1 ? ctx.cards.firstId : ''}}"),
        go("card"),
      ],
      navigation: route([lacks("cards.manage"), "denied"], ["!isEmpty(vc.cardId)", "check"]),
      blocks: [],
    },
    {
      id: "card", title: "Link to which card?",
      blocks: [
        text("Link to which card?", "title"),
        alert("error", "Choose an active card to link this to.", err("card")),
        alert("error", "You have 5 virtual cards on this card, the most you can have. Delete one first.", err("cap")),
        text("You have no active card to link a virtual card to.", "body", "ctx.cards.count == 0"),
        { type: "select", bind: "vc.cardId", label: "Card", source: "ctx.cards.cards", variant: "rows", visibleWhen: "ctx.cards.count > 0" },
        button("Continue", [{ type: "validate" }, set("vc.err", ""), go("check")], "primary", "ctx.cards.count > 0"),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      // the card and its virtual cards, asked of the bank with the smallest card there is: it says no to a card that is not active and to a sixth virtual card
      id: "check", title: "Virtual card", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "check", input: { cardId: "{{vc.cardId}}", purpose: "Online shopping", limit: 1, singleUse: true, dryRun: true }, onError: { navigate: "fail" } },
        go("purpose"),
      ],
      blocks: [],
    },
    {
      id: "purpose", title: "What is it for?",
      blocks: [
        text("What is it for?", "title"),
        {
          type: "select", bind: "vc.purpose", label: "Purpose", variant: "tiles",
          choices: [choice("Online shopping", "Online shopping", "Use it with any online shop"), choice("Subscriptions", "Subscriptions", "For regular payments"), choice("One-time purchase", "One-time purchase", "Closes after one payment")],
        },
        // a one-time purchase is always single use, and so is every card when the bank does not offer the 3 years
        button("Continue", [{ type: "validate" }, set("vc.life", "{{vc.purpose == 'One-time purchase' ? 'single' : opt.allowThreeYears == false ? 'single' : ''}}"), set("vc.err", ""), go("limit")]),
        button("Back", [go("card")], "ghost", "ctx.cards.count > 1"),
      ],
    },
    {
      id: "limit", title: "Spending limit",
      blocks: [
        text("Spending limit", "title"),
        alert("error", "Choose a limit within what the card allows.", err("limit")),
        {
          type: "amountInput", bind: "vc.limit", currency: "USD", label: "Limit", helper: "{{vc.life == 'single' ? 'The most it can spend in one payment.' : 'The most it can spend in a month.'}}",
          validation: { min: 1, max: 5000, messages: { min: "The smallest limit is $1.00.", max: "The most is $5,000.00." } },
        },
        // how long it lasts is asked only when the person has the choice (not a one-time purchase, and the bank offers 3 years)
        button("Continue", [{ type: "validate" }, set("vc.err", ""), set("vc.go", true), { type: "navigate" }]),
        // Back is not Continue: the rules below apply only after Continue (they would take it onward too)
        button("Back", [set("vc.go", false), go("purpose")], "ghost"),
      ],
      navigation: route(["vc.go && vc.life == ''", "expiry"], ["vc.go && vc.life != ''", "review"]),
    },
    {
      id: "expiry", title: "How long should it last?",
      blocks: [
        text("How long should it last?", "title"),
        { type: "select", bind: "vc.life", label: "Lasts", variant: "tiles", choices: [choice("single", "Single use", "Closes after one payment"), choice("3y", "3 years", "Until it expires or you delete it")] },
        button("Continue", [{ type: "validate" }, go("review")]),
        button("Back", [go("limit")], "ghost"),
      ],
    },
    {
      // what the bank says it will make, with every rule applied (the five-card cap too) and nothing made
      id: "review", title: "Review",
      onEnter: [{ type: "callApi", integration: "check", input: { ...wanted, dryRun: true }, saveAs: "vc.sum", onError: { navigate: "fail" } }],
      blocks: [
        text("Review", "title"),
        {
          type: "reviewSummary",
          rows: [
            { label: "Linked to", value: "{{vc.sum.parentName}}" }, { label: "Purpose", value: "{{vc.sum.purpose}}" },
            { label: "Limit", value: "{{vc.sum.limitText}} {{vc.sum.per}}" }, { label: "Lasts", value: "{{vc.sum.lasts}}" },
          ],
        },
        button("Continue", [...wipe, { type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: { navigate: "fail" } }, go("code")]),
        button("Back", [go("limit")], "ghost"),
      ],
    },
    {
      id: "code", title: "Create a virtual card",
      blocks: [
        text("Create a virtual card", "title"),
        text("Code sent to {{ctx.otp.maskedPhone}}. You’ll see the card details once.", "caption"),
        {
          type: "otp", bind: "otp.code", length: 6, maxAttempts: 3, resendAfterSeconds: 30, keypad: true,
          hint: "We sent a 6-digit code to {{ctx.otp.maskedPhone}}.",
          onResend: [{ type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: { navigate: "fail" } }],
        },
        button("Create card", [
          { type: "validate" },
          { type: "callApi", integration: "otpVerify", input: { code: "{{otp.code}}" }, onError: { showToast: "That code isn’t right. Try again.", stay: true, lockAfter: 3, lockTo: "locked" } },
          { type: "callApi", integration: "create", input: wanted, saveAs: "vc.res", onError: { navigate: "fail" } },
          ...wipe, go("done"),
        ]),
        button("Back", [...wipe, go("review")], "ghost"),
      ],
    },
    {
      // the number and the security code are shown here, once, and cleared when the person leaves
      id: "done", title: "Virtual card ready", kind: "terminal", onEnter: wipe,
      blocks: [
        { type: "result", tone: "success", title: "Virtual card ready", text: "Save these details now. We won’t show the number again.", meta: "{{vc.res.status}}" },
        {
          type: "reviewSummary",
          rows: [
            { label: "Card number", value: "{{vc.res.number}}" }, { label: "Expiry", value: "{{vc.res.expiry}}" }, { label: "Security code", value: "{{vc.res.cvv}}" },
            { label: "Limit", value: "{{vc.res.limitText}} {{vc.res.per}}" }, { label: "Purpose", value: "{{vc.res.purpose}}" },
          ],
        },
        button("Go to cards", [set("vc.res", null), { type: "exit" }]),
      ],
    },
    {
      id: "locked", title: "Too many wrong codes", kind: "terminal", onEnter: wipeAll,
      blocks: [
        { type: "result", tone: "error", title: "Too many wrong codes", text: "Nothing was changed on your card. Start again when you’re ready." },
        button("Start again", [go("start")]),
        button("Back to cards", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      // where a refusal goes: what the person can fix has its screen, the bank not answering has another
      id: "fail", title: "Virtual card", kind: "branch",
      onEnter: [
        ...wipeAll,
        set("vc.err", "{{ctx.error.code == 'VIRTUAL_LIMIT_REACHED' ? 'cap' : ctx.error.code == 'CARD_NOT_FOUND' ? 'card' : ctx.error.code == 'CARD_NOT_ACTIVE' ? 'card' : ctx.error.code == 'LIMIT_INVALID' ? 'limit' : ctx.error.code == 'LIMIT_ABOVE_CEILING' ? 'limit' : ctx.error.code == 'PURPOSE_INVALID' ? 'purpose' : ''}}"),
        go("problem"),
      ],
      navigation: route(
        ["ctx.error.code == 'TIMEOUT'", "timeout"],
        ["ctx.error.code == 'SERVICE_UNAVAILABLE'", "unavailable"],
        ["vc.err == 'cap' || vc.err == 'card'", "card"],
        ["vc.err == 'limit'", "limit"],
        ["vc.err == 'purpose'", "purpose"],
      ),
      blocks: [],
    },
    ...answerScreens("start", "changed", wipeAll),
    {
      id: "problem", title: "Virtual card", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We couldn’t make the card", text: "Something went wrong. Nothing was changed." },
        button("Try again", [go("start")]),
        button("Close", [{ type: "exit" }], "ghost"),
      ],
    },
    denied("Virtual card"),
  ] as Screen[],
};
