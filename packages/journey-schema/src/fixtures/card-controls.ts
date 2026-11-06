import type { Block, Journey, Screen } from "../schema";
import { cardControlsAcceptance, cardControlsScenarios } from "./card-controls-tests";
import { alert, answerScreens, button, denied, go, lacks, route, set, text } from "./cards-kit";

/** What this journey holds only while it is being sent: the code. Cleared on every way out. */
const wipe = [set("otp.code", "")];
const err = (e: string) => `cc.err == '${e}'`;
const COUNTRIES = ["Spain", "France", "Germany", "Italy", "Portugal", "United Kingdom", "Canada", "Mexico", "Japan", "United Arab Emirates"];
const money = (bind: string, label: string, helper: string, max: string, maxMessage: string, min?: { value: number; message: string }, visibleWhen?: string): Block => ({
  type: "amountInput", bind, currency: "USD", label, helper, ...(visibleWhen ? { visibleWhen } : {}),
  validation: { ...(min ? { min: min.value } : {}), max, messages: { ...(min ? { min: min.message } : {}), max: maxMessage } },
});
const toggle = (bind: string, label: string, helper?: string, visibleWhen?: string): Block => ({ type: "toggle", bind, label, ...(helper ? { helper } : {}), ...(visibleWhen ? { visibleWhen } : {}) });
/** What the bank is asked, for the check at the review and for saving: every value the journey holds; the bank keeps what changed and ignores the rest. */
const wanted = {
  cardId: "{{cc.cardId}}", status: "{{cc.status}}",
  perTransaction: "{{cc.lim.perTx}}", dailyPurchases: "{{cc.lim.daily}}", monthly: "{{cc.lim.monthly}}", dailyAtm: "{{cc.lim.cash}}",
  allowContactless: "{{cc.where.contactless}}", allowOnline: "{{cc.where.online}}", allowAbroad: "{{cc.where.abroad}}", allowAtm: "{{cc.where.atm}}",
  tripCountry: "{{cc.trip.country}}", tripFrom: "{{cc.trip.from}}", tripTo: "{{cc.trip.to}}",
  alertEvery: "{{cc.alert.every}}", alertLarge: "{{cc.alert.large}}", alertFrom: "{{cc.alert.from}}", alertOnline: "{{cc.alert.online}}",
};
const preview = (): any => ({ type: "callApi", integration: "preview", input: { ...wanted, dryRun: true }, saveAs: "ctx.prev", onError: { navigate: "fail" } });
const TRIP_ON = "cc.where.abroad && opt.allowTrip != false";

/**
 * Card limits and controls (BankWorkx, Personal: Cards). Freezes or unfreezes a card, sets its spending limits, chooses where it works (with an optional trip) and
 * sets alerts. Tightening (freezing, a lower limit, a place turned off, the alerts) saves at once; loosening (unfreezing, a higher limit, a place turned on, a trip)
 * asks for a one-time code. Which card is skipped when one is passed in (launch.cardId); "What do you want to change?" is skipped when a section is passed in
 * (launch.mode: freeze, unfreeze, limits, where or alerts). The bank applies every rule at the review (a dry run, which changes nothing) and again when it saves.
 *
 * Built from the spec of the prototype with the blocks FinX has: the limits are checked against the ceilings on the screen (the engine cannot take a limit of
 * zero) and the order of the limits, the trip and the alert amount by the bank, shown above the fields in its words; the review lists the changes the bank
 * found; "{n} tries left" under the code is not drawn.
 */
export const cardControls: Journey = {
  id: "jrn_bankworkx_card_controls",
  slug: "card-controls",
  name: "Card limits and controls",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: cardControlsAcceptance,
  scenarios: cardControlsScenarios,
  dataModel: {
    "launch.cardId": { type: "string" },
    "launch.mode": { type: "string" },
    "opt.allowTrip": { type: "boolean" },
    "cc.cardId": { type: "string", required: true },
    "cc.mode": { type: "string", required: true },
    "cc.status": { type: "string" },
    "cc.err": { type: "string" },
    "cc.msg": { type: "string" },
    "cc.lim.perTx": { type: "money", currency: "USD", required: true },
    "cc.lim.daily": { type: "money", currency: "USD", required: true },
    "cc.lim.monthly": { type: "money", currency: "USD", required: true },
    "cc.lim.cash": { type: "money", currency: "USD", required: true },
    "cc.where.contactless": { type: "boolean" },
    "cc.where.online": { type: "boolean" },
    "cc.where.abroad": { type: "boolean" },
    "cc.where.atm": { type: "boolean" },
    "cc.trip.country": { type: "string" },
    "cc.trip.from": { type: "string" },
    "cc.trip.to": { type: "string" },
    "cc.alert.every": { type: "boolean" },
    "cc.alert.large": { type: "boolean" },
    "cc.alert.from": { type: "money", currency: "USD", required: true },
    "cc.alert.online": { type: "boolean" },
    "otp.code": { type: "string", required: true, pattern: "^[0-9]{6}$" },
  },
  integrations: [
    { id: "eligible", adapter: "bank.cards.eligible", mode: "sandbox" },
    { id: "card", adapter: "bank.cards.get", mode: "sandbox" },
    { id: "preview", adapter: "bank.cards.controls.update", mode: "sandbox" },
    { id: "otpSend", adapter: "bank.otp.send", mode: "sandbox" },
    { id: "otpVerify", adapter: "bank.otp.verify", mode: "sandbox" },
    { id: "save", adapter: "bank.cards.controls.update", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Card limits and controls", kind: "branch",
      onEnter: [
        ...wipe, set("cc.err", ""), set("cc.msg", ""), set("ctx.error", null),
        { type: "callApi", integration: "eligible", input: { for: "controls" }, saveAs: "ctx.cards", onError: { navigate: "fail" } },
        // a card passed in is the card; otherwise the first card that can be changed is chosen for the person
        set("cc.cardId", "{{isEmpty(launch.cardId) ? ctx.cards.firstId : launch.cardId}}"),
        // a section passed in skips the question: anything else (including "all") asks what to change
        set("cc.mode", "{{launch.mode == 'freeze' ? 'freeze' : launch.mode == 'unfreeze' ? 'unfreeze' : launch.mode == 'limits' ? 'limits' : launch.mode == 'where' ? 'where' : launch.mode == 'alerts' ? 'alerts' : ''}}"),
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
        alert("error", "Activate this card first.", err("inactive")),
        alert("error", "This card can’t be changed.", err("other")),
        text("You have no card to change.", "body", "ctx.cards.count == 0"),
        { type: "select", bind: "cc.cardId", label: "Card", source: "ctx.cards.cards", variant: "rows", visibleWhen: "ctx.cards.count > 0" },
        button("Continue", [{ type: "validate" }, set("cc.err", ""), go("check")], "primary", "ctx.cards.count > 0"),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      // the card, read again every time the person starts a change, with the values the screens start from
      id: "check", title: "Card limits and controls", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "card", input: { cardId: "{{cc.cardId}}" }, saveAs: "ctx.card", onError: { navigate: "fail" } },
        set("cc.err", "{{ctx.card.status == 'inactive' ? 'inactive' : ctx.card.status == 'active' ? '' : ctx.card.status == 'frozen' ? '' : 'other'}}"),
        // a frozen card offers only its unfreezing, an active card has nothing to unfreeze
        set("cc.mode", "{{ctx.card.status == 'frozen' ? (cc.mode == 'unfreeze' ? 'unfreeze' : '') : (cc.mode == 'unfreeze' ? '' : cc.mode)}}"),
        set("cc.status", "{{cc.mode == 'freeze' ? 'frozen' : cc.mode == 'unfreeze' ? 'active' : ctx.card.status}}"),
        set("cc.lim.perTx", "{{ctx.card.limits.perTransaction}}"), set("cc.lim.daily", "{{ctx.card.limits.dailyPurchases}}"),
        set("cc.lim.monthly", "{{ctx.card.limits.monthly}}"), set("cc.lim.cash", "{{ctx.card.limits.dailyAtm}}"),
        set("cc.where.contactless", "{{ctx.card.controls.contactless}}"), set("cc.where.online", "{{ctx.card.controls.online}}"),
        set("cc.where.abroad", "{{ctx.card.controls.abroad}}"), set("cc.where.atm", "{{ctx.card.controls.atm}}"),
        set("cc.trip.country", "{{ctx.card.hasTrip ? ctx.card.trip.country : ''}}"), set("cc.trip.from", "{{ctx.card.hasTrip ? ctx.card.trip.from : ''}}"), set("cc.trip.to", "{{ctx.card.hasTrip ? ctx.card.trip.to : ''}}"),
        set("cc.alert.every", "{{ctx.card.alerts.every}}"), set("cc.alert.large", "{{ctx.card.alerts.large}}"), set("cc.alert.from", "{{ctx.card.alerts.largeFrom}}"), set("cc.alert.online", "{{ctx.card.alerts.online}}"),
        go("what"),
      ],
      navigation: route(
        ["cc.err != ''", "pick"], ["cc.mode == 'freeze' || cc.mode == 'unfreeze'", "status"], ["cc.mode == 'limits'", "limits"], ["cc.mode == 'where'", "where"], ["cc.mode == 'alerts'", "alerts"],
      ),
      blocks: [],
    },
    {
      id: "what", title: "What do you want to change?",
      blocks: [
        text("What do you want to change?", "title"),
        text("{{ctx.card.name}}", "caption"),
        {
          type: "select", bind: "cc.mode", label: "Change", variant: "tiles", visibleWhen: "ctx.card.status == 'active'",
          choices: [
            { id: "freeze", label: "Freeze card", icon: "shield", text: "Stop it being used until you unfreeze it" },
            { id: "limits", label: "Spending limits", icon: "wallet", text: "How much it can spend" },
            { id: "where", label: "Where it works", icon: "bank", text: "Online, abroad, cash machines and a trip" },
            { id: "alerts", label: "Alerts", icon: "trend", text: "Be told when it is used" },
          ],
        },
        {
          type: "select", bind: "cc.mode", label: "Change", variant: "tiles", visibleWhen: "ctx.card.status == 'frozen'",
          choices: [{ id: "unfreeze", label: "Unfreeze card", icon: "shield", text: "Use it again. We’ll ask for a code." }],
        },
        button("Continue", [
          { type: "validate" },
          set("cc.status", "{{cc.mode == 'freeze' ? 'frozen' : cc.mode == 'unfreeze' ? 'active' : ctx.card.status}}"), set("cc.err", ""),
          { type: "navigate" },
        ]),
      ],
      navigation: route(["cc.mode == 'freeze' || cc.mode == 'unfreeze'", "status"], ["cc.mode == 'limits'", "limits"], ["cc.mode == 'where'", "where"], ["cc.mode == 'alerts'", "alerts"]),
    },
    {
      // freezing or unfreezing: the bank checks it, and says whether it asks for a code
      id: "status", title: "Card limits and controls", kind: "branch",
      onEnter: [preview(), go("review")],
      blocks: [],
    },
    {
      id: "limits", title: "Spending limits",
      blocks: [
        text("Spending limits", "title"),
        text("{{ctx.card.name}}", "caption"),
        alert("error", "{{cc.msg}}", err("limit")),
        money("cc.lim.perTx", "Per transaction", "{{ctx.card.ceilingText.perTransaction}}", "ctx.card.ceilings.perTransaction", "The most is {{ctx.card.ceilings.perTransaction | money2:USD}}."),
        money("cc.lim.daily", "Daily", "{{ctx.card.ceilingText.dailyPurchases}}", "ctx.card.ceilings.dailyPurchases", "The most is {{ctx.card.ceilings.dailyPurchases | money2:USD}}."),
        money("cc.lim.monthly", "Monthly", "{{ctx.card.ceilingText.monthly}}", "ctx.card.ceilings.monthly", "The most is {{ctx.card.ceilings.monthly | money2:USD}}."),
        money("cc.lim.cash", "Cash withdrawal, daily", "{{ctx.card.ceilingText.dailyAtm}}", "ctx.card.ceilings.dailyAtm", "The most is {{ctx.card.ceilings.dailyAtm | money2:USD}}.", undefined, "ctx.card.allowsCash"),
        button("Continue", [{ type: "validate" }, set("cc.err", ""), preview(), go("review")]),
      ],
    },
    {
      id: "where", title: "Where it works",
      blocks: [
        text("Where it works", "title"),
        text("{{ctx.card.name}}", "caption"),
        alert("error", "{{cc.msg}}", err("trip")),
        toggle("cc.where.contactless", "Contactless"),
        toggle("cc.where.online", "Online"),
        toggle("cc.where.abroad", "International"),
        toggle("cc.where.atm", "Cash machines", undefined, "ctx.card.allowsCash"),
        { type: "select", bind: "cc.trip.country", label: "Country (optional)", options: COUNTRIES, variant: "dropdown", visibleWhen: TRIP_ON },
        { type: "dateInput", bind: "cc.trip.from", label: "From", placeholder: "Start date", min: "today", visibleWhen: TRIP_ON },
        { type: "dateInput", bind: "cc.trip.to", label: "To", placeholder: "End date", min: "{{cc.trip.from}}", messages: { min: "The end date is before the start date." }, visibleWhen: TRIP_ON },
        button("Continue", [
          { type: "validate" }, set("cc.err", ""),
          // a trip belongs to International: with it off the trip goes
          set("cc.trip.country", "{{cc.where.abroad ? cc.trip.country : ''}}"), set("cc.trip.from", "{{cc.where.abroad ? cc.trip.from : ''}}"), set("cc.trip.to", "{{cc.where.abroad ? cc.trip.to : ''}}"),
          preview(), go("review"),
        ]),
      ],
    },
    {
      id: "alerts", title: "Alerts",
      blocks: [
        text("Alerts", "title"),
        text("{{ctx.card.name}}", "caption"),
        alert("error", "{{cc.msg}}", err("alert")),
        toggle("cc.alert.every", "Every transaction"),
        toggle("cc.alert.large", "Large transactions"),
        money("cc.alert.from", "Alert me from", "At least $1.00", "100000", "The most is $100,000.00.", { value: 1, message: "Enter an amount above zero." }, "cc.alert.large"),
        toggle("cc.alert.online", "Online purchases"),
        button("Continue", [{ type: "validate" }, set("cc.err", ""), preview(), go("review")]),
      ],
    },
    {
      id: "review", title: "Review",
      blocks: [
        text("Review", "title"),
        text("{{ctx.prev.name}}", "caption"),
        text("No changes yet.", "body", "!ctx.prev.changed"),
        alert("warning", "You haven’t changed anything yet.", "!ctx.prev.changed"),
        { type: "menu", source: "ctx.prev.changes", visibleWhen: "ctx.prev.changed", item: { label: "{{item.label}}", text: "{{item.before}} → {{item.after}}", actions: [] } },
        alert("info", "We’ll ask for a code to confirm.", "ctx.prev.needsCode"),
        button("Save changes", [
          { type: "callApi", integration: "save", input: wanted, saveAs: "cc.res", onError: { navigate: "fail" } },
          go("done"),
        ], "primary", "ctx.prev.changed && !ctx.prev.needsCode"),
        button("Continue", [
          ...wipe,
          { type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: { navigate: "fail" } },
          go("code"),
        ], "primary", "ctx.prev.changed && ctx.prev.needsCode"),
        button("Back", [go("back")], "ghost"),
      ],
    },
    {
      // back to the section the person was in
      id: "back", title: "Card limits and controls", kind: "branch",
      onEnter: [go("what")],
      navigation: route(["cc.mode == 'limits'", "limits"], ["cc.mode == 'where'", "where"], ["cc.mode == 'alerts'", "alerts"]),
      blocks: [],
    },
    {
      id: "code", title: "Enter your code",
      blocks: [
        text("Enter your code", "title"),
        text("{{ctx.prev.name}}", "caption"),
        {
          type: "otp", bind: "otp.code", length: 6, maxAttempts: 3, resendAfterSeconds: 30, keypad: true,
          hint: "We sent a 6-digit code to {{ctx.otp.maskedPhone}}.",
          onResend: [{ type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: { navigate: "fail" } }],
        },
        button("Save changes", [
          { type: "validate" },
          { type: "callApi", integration: "otpVerify", input: { code: "{{otp.code}}" }, onError: { showToast: "That code isn’t right. Try again.", stay: true, lockAfter: 3, lockTo: "locked" } },
          { type: "callApi", integration: "save", input: wanted, saveAs: "cc.res", onError: { navigate: "fail" } },
          ...wipe, go("done"),
        ]),
        button("Back", [...wipe, go("review")], "ghost"),
      ],
    },
    {
      id: "done", title: "Card updated", kind: "terminal", onEnter: wipe,
      blocks: [
        { type: "result", tone: "success", title: "Card frozen", visibleWhen: "cc.res.kind == 'freeze'" },
        { type: "result", tone: "success", title: "Card unfrozen", visibleWhen: "cc.res.kind == 'unfreeze'" },
        { type: "result", tone: "success", title: "Changes saved", visibleWhen: "cc.res.kind == 'changes'" },
        { type: "reviewSummary", rows: [{ label: "Card", value: "{{cc.res.name}}" }] },
        { type: "menu", source: "cc.res.changes", visibleWhen: "cc.res.kind == 'changes'", item: { label: "{{item.label}}", text: "{{item.before}} → {{item.after}}", actions: [] } },
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
      id: "fail", title: "Card limits and controls", kind: "branch",
      onEnter: [
        ...wipe,
        set("cc.err", "{{ctx.error.code == 'CARD_NOT_FOUND' ? 'notfound' : ctx.error.code == 'CARD_NOT_ACTIVATED' ? 'inactive' : ctx.error.code == 'CARD_NOT_ACTIVE' ? 'other' : ctx.error.code == 'CARD_FROZEN' ? 'other' : ctx.error.code == 'LIMIT_INVALID' ? 'limit' : ctx.error.code == 'LIMIT_ABOVE_CEILING' ? 'limit' : ctx.error.code == 'TRIP_INVALID' ? 'trip' : ctx.error.code == 'ALERT_INVALID' ? 'alert' : ''}}"),
        set("cc.msg", "{{ctx.error.message}}"),
        go("problem"),
      ],
      navigation: route(
        ["ctx.error.code == 'TIMEOUT'", "timeout"],
        ["ctx.error.code == 'SERVICE_UNAVAILABLE'", "unavailable"],
        ["cc.err == 'limit'", "limits"], ["cc.err == 'trip'", "where"], ["cc.err == 'alert'", "alerts"],
        ["cc.err != ''", "pick"],
        ["ctx.error.code == 'OTP_REQUIRED'", "back"],
      ),
      blocks: [],
    },
    ...answerScreens("start", "changed", wipe),
    {
      id: "problem", title: "Card limits and controls", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We couldn’t save the changes", text: "{{cc.msg}} Nothing was changed." },
        button("Try again", [go("start")]),
        button("Close", [{ type: "exit" }], "ghost"),
      ],
    },
    denied("Card limits and controls"),
  ] as Screen[],
};
