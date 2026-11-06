import type { Journey } from "../schema";

/** What must be true for "Cards" to be right. Each is proved by at least one scenario below. */
export const cardsViewAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "Every card shows its number, holder, expiry and a status pill, and the chosen card is marked." },
  { id: "AC-2", text: "The status line matches the card: activate prompt, \"can’t be used\", available credit with the minimum due, what is left of a virtual card, or the available balance." },
  { id: "AC-3", text: "The quick actions match the card's state; an action whose journey the bank switched off, or that the person may not use, is not drawn; a blocked or expired card shows only Replace." },
  { id: "AC-4", text: "Freeze turns an active card to Frozen at once with no code and changes the pill; Unfreeze opens the controls, which ask for a code; a card that is not active cannot be frozen." },
  { id: "AC-5", text: "Recent shows up to five rows, newest first with a pending one at the top, hides when showTx is off or the card is not active, and See all opens the account the card spends from (not for a credit card)." },
  { id: "AC-6", text: "No Wallet action is drawn, whatever showWallet says: there is no card-wallet journey in this build." },
  { id: "AC-7", text: "A card whose activation is locked shows \"Activation is locked. Please call us.\" and no Activate action." },
  { id: "AC-8", text: "With no cards the screen says \"No cards yet\" and offers Add a card, unless add-card is off." },
  { id: "AC-9", text: "When the bank is unavailable or does not answer in time the screen shows the error with Try again and nothing is changed; a freeze that fails leaves the card as it was and says why; the spending that cannot be read leaves the cards in place." },
  { id: "AC-10", text: "A frozen card is marked Frozen and Controls stays available." },
  { id: "AC-11", text: "Opened with a card, that card is chosen; an unknown card is ignored." },
  { id: "AC-12", text: "It needs cards.view; an action needs the permission of its journey (cards.manage, cards.pin, payments.create)." },
];

// Alex Morgan on Tuesday 3 November 2026: Everyday debit ••9021, Aurora credit ••3318, Spare debit ••7745 (not activated) and the virtual card Online shopping ••6150.
const NOW = "2026-11-03T10:00:00Z";
type Step = Record<string, unknown>;
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const toast = (t: string): Step => ({ expectToast: t });
const opens = (journey: string, w?: Record<string, unknown>): Step => ({ expectOpens: { journey, ...(w ? { with: w } : {}) } });
const forced = (adapter: string, input: Record<string, unknown>, c: string): Step => ({ expectBankError: { adapter, input, code: c } });
const card = (id: string, path: string, equals: unknown): Step => ({ expectBank: { adapter: "bank.cards.get", input: { cardId: id }, path, equals } });
const base = { persona: "alex", now: NOW };
const wrong = { adapter: "bank.cards.verifyActivation", input: { cardId: "card_7745", last4: "0000", expiry: "11/29" } };
const FREEZE = "Stops the card at once", UNFREEZE = "Asks for a code", CONTROLS = "Limits, where it works and alerts", PIN = "Set or change the PIN", ACTIVATE = "Turn on your new card", REPLACE = "Order a new card";

export const cardsViewScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "Each card shows its face and status; the status line and the actions follow its state (debit, credit, not activated, virtual)", covers: ["AC-1", "AC-2", "AC-3"], ...base,
    steps: [
      screen("list"), text("▶ Everyday debit ••9021"), text("Active · •••• •••• •••• 9021 · ALEX MORGAN · 09/29"), text("Aurora credit ••3318"), text("Not activated · •••• •••• •••• 7745 · ALEX MORGAN · 11/29"), text("Virtual · •••• •••• •••• 6150"),
      text("Available balance · $8,602.36"), text(FREEZE), text(CONTROLS), text(PIN), noText(ACTIVATE), noText(UNFREEZE), noText(REPLACE),
      press("Aurora credit ••3318"), text("▶ Aurora credit ••3318"), text("Available credit · $3,640.20 · Minimum due $45.00 by 28 Nov 2026"), text(FREEZE), text(CONTROLS), text(PIN),
      press("Spare debit ••7745"), text("Activate this card to start using it."), text(ACTIVATE), noText(FREEZE), noText(CONTROLS), noText(PIN), noText("Recent"),
      press("Online shopping ••6150"), text("Available · $240.02"), text(FREEZE), text(CONTROLS), noText(PIN), noText(ACTIVATE),
    ],
  },
  {
    id: "T-2", name: "Freeze: Card frozen at once, the pill says Frozen, the actions are Unfreeze and Controls; Unfreeze opens the controls, which ask for a code, and changes nothing here", covers: ["AC-4", "AC-10"], ...base,
    steps: [
      press("Freeze"), toast("Card frozen"), text("Frozen · •••• •••• •••• 9021"), text(UNFREEZE), text(CONTROLS), noText(FREEZE), noText(PIN), card("card_9021", "status", "frozen"),
      press("Unfreeze"), opens("card-controls", { "launch.cardId": "card_9021", "launch.mode": "unfreeze" }), card("card_9021", "status", "frozen"),
    ],
  },
  {
    id: "T-3", name: "Recent: five rows, the pending one first, the sixth not shown; See all opens Main; a credit card has no See all", covers: ["AC-5"], ...base,
    steps: [
      text("Recent"), text("Brightside Coffee"), text("Pending · −$4.80"), text("Northwind Market"), text("Yesterday · −$64.20"), text("Harbor Fuel"), text("Skyline Travel Co."), text("Skyline Travel Co. refund"), text("+$35.00"), noText("Metro cash machine"),
      text("The account this card spends from"), press("See all"), opens("account-details", { "launch.accountId": "acc_main" }),
    ],
  },
  {
    id: "T-4", name: "A credit card shows its own spending and no See all; with showTx off there is no Recent at all", covers: ["AC-5"], ...base,
    steps: [press("Aurora credit ••3318"), text("Recent"), text("Globe Hotels"), text("Metro Transit"), noText("Northwind Market"), noText("The account this card spends from")],
  },
  {
    id: "T-5", name: "With showTx off the Recent section and See all are gone", covers: ["AC-5"], ...base, launch: { "opt.showTx": false },
    steps: [screen("list"), noText("Recent"), noText("Brightside Coffee"), noText("The account this card spends from"), text(FREEZE)],
  },
  {
    id: "T-6", name: "A card with no spending says so", covers: ["AC-5"], ...base, setup: [{ adapter: "bank.cards.activate", input: { cardId: "card_7745", last4: "7745", expiry: "11/29" } }],
    steps: [press("Spare debit ••7745"), text("Recent"), text("No card activity yet"), noText("Brightside Coffee")],
  },
  {
    id: "T-7", name: "No Wallet action is drawn, with showWallet on or off; with the PIN entry off there is no PIN action", covers: ["AC-6", "AC-3"], ...base, launch: { "opt.showWallet": false, "opt.pinEntry": false },
    steps: [screen("list"), noText("Wallet"), noText(PIN), text(FREEZE), text(CONTROLS)],
  },
  {
    id: "T-8", name: "With showWallet on there is still no Wallet action", covers: ["AC-6"], ...base, launch: { "opt.showWallet": true },
    steps: [screen("list"), noText("Wallet"), text(PIN)],
  },
  {
    id: "T-9", name: "An action whose journey the bank switched off is not drawn (Freeze, Controls, Activate, Replace, Add a card)", covers: ["AC-3"], ...base,
    launch: { "opt.freezeEntry": false, "opt.controlsEntry": false, "opt.activateEntry": false, "opt.replaceEntry": false, "opt.addCard": false },
    steps: [screen("list"), noText(FREEZE), noText(CONTROLS), noText("Add a card"), text(PIN), press("Spare debit ••7745"), noText(ACTIVATE)],
  },
  {
    id: "T-10", name: "A card whose activation is locked says so and has no Activate action", covers: ["AC-7"], ...base, setup: [wrong, wrong, wrong],
    steps: [press("Spare debit ••7745"), text("Activation is locked. Please call us."), noText(ACTIVATE), noText("Activate this card to start using it.")],
  },
  {
    id: "T-11", name: "PIN opens card-pin with the chosen card", covers: ["AC-3"], ...base,
    steps: [press("PIN"), opens("card-pin", { "launch.cardId": "card_9021" })],
  },
  {
    id: "T-29", name: "Activate opens activate-card with the card that is waiting", covers: ["AC-3"], ...base,
    steps: [press("Spare debit ••7745"), press("Activate"), opens("activate-card", { "launch.cardId": "card_7745" })],
  },
  {
    id: "T-30", name: "Add a card opens add-card", covers: ["AC-3"], ...base,
    steps: [press("Add a card"), opens("add-card")],
  },
  {
    id: "T-12", name: "Controls opens the controls for the chosen card, all of them", covers: ["AC-3"], ...base,
    steps: [press("Aurora credit ••3318"), press("Controls"), opens("card-controls", { "launch.cardId": "card_3318", "launch.mode": "all" })],
  },
  {
    id: "T-13", name: "A blocked card is greyed out of every action but Replace, which opens replace-card", covers: ["AC-3"], ...base, setup: [{ adapter: "bank.cards.block", input: { cardId: "card_9021", reason: "lost" } }],
    steps: [press("Everyday debit ••9021"), text("Blocked · •••• •••• •••• 9021"), text("This card can’t be used."), text(REPLACE), noText(FREEZE), noText(CONTROLS), noText(PIN), noText("Recent"), press("Replace"), opens("replace-card", { "launch.cardId": "card_9021" })],
  },
  {
    id: "T-14", name: "A card past its expiry shows Expired and Replace", covers: ["AC-3"], persona: "alex", now: "2029-10-05T10:00:00Z",
    steps: [press("Everyday debit ••9021"), text("Expired · •••• •••• •••• 9021"), text("This card can’t be used."), text(REPLACE), noText(FREEZE)],
  },
  {
    id: "T-15", name: "A card that is not active cannot be frozen, whatever a screen offers", covers: ["AC-4"], ...base,
    steps: [forced("bank.cards.freeze", { cardId: "card_7745" }, "CARD_NOT_ACTIVE"), forced("bank.cards.freeze", { cardId: "card_nope" }, "CARD_NOT_FOUND"), card("card_7745", "status", "inactive")],
  },
  {
    id: "T-16", name: "A card that stopped being active while the list was open: Freeze says Only an active card can be frozen. and nothing changes", covers: ["AC-4", "AC-9"], ...base,
    steps: [
      { expectBank: { adapter: "bank.cards.block", input: { cardId: "card_9021", reason: "lost" }, path: "status", equals: "blocked" } },
      press("Freeze"), text("Only an active card can be frozen."), card("card_9021", "status", "blocked"),
    ],
  },
  {
    id: "T-17", name: "With no cards the screen says No cards yet and offers Add a card; with add-card off it does not", covers: ["AC-8"], persona: "sam", now: NOW,
    steps: [screen("empty"), text("No cards yet"), text("Your cards will show here."), text("Add a card"), press("Add a card"), opens("add-card")],
  },
  {
    id: "T-18", name: "With no cards and add-card off there is no button", covers: ["AC-8"], persona: "sam", now: NOW, launch: { "opt.addCard": false },
    steps: [screen("empty"), text("No cards yet"), noText("Add a card")],
  },
  {
    id: "T-19", name: "When the bank is unavailable the error shows with Try again and nothing is changed", covers: ["AC-9"], ...base, conditions: { unavailable: ["bank.cards.eligible"] },
    steps: [screen("loadFail"), text("We couldn’t load your cards"), text("Nothing was changed. Try again in a moment."), press("Try again"), screen("loadFail")],
  },
  {
    id: "T-20", name: "When the bank does not answer in time the screen says so", covers: ["AC-9"], ...base, conditions: { timeout: ["bank.cards.eligible"], latencyMs: 10000 },
    steps: [screen("loadFail"), text("This is taking longer than expected. Nothing was changed.")],
  },
  {
    id: "T-21", name: "A freeze while the bank is unavailable leaves the card as it was and says so", covers: ["AC-9"], ...base, conditions: { unavailable: ["bank.cards.freeze"] },
    steps: [press("Freeze"), text("This isn’t available right now. Nothing was changed. Try again in a few minutes."), text(FREEZE), card("card_9021", "status", "active")],
  },
  {
    id: "T-22", name: "A freeze that gets no answer in time leaves the card as it was", covers: ["AC-9"], ...base, conditions: { timeout: ["bank.cards.freeze"], latencyMs: 10000 },
    steps: [press("Freeze"), text("This is taking longer than expected. Nothing was changed."), card("card_9021", "status", "active")],
  },
  {
    id: "T-23", name: "When the spending cannot be read the cards stay and Recent says so", covers: ["AC-9"], ...base, conditions: { unavailable: ["bank.cards.transactions"] },
    steps: [
      screen("list"), text("Everyday debit ••9021"), text("Available balance · $8,602.36"), text("We couldn’t load the activity."), noText("No card activity yet"),
      press("Aurora credit ••3318"), text("Available credit · $3,640.20"), text("We couldn’t load the activity."), press("Refresh"), text("We couldn’t load the activity."), text("Aurora credit ••3318"),
    ],
  },
  {
    id: "T-24", name: "Opened with a card, that card is chosen; an unknown card is ignored", covers: ["AC-11"], ...base, launch: { "launch.cardId": "card_3318" },
    steps: [text("▶ Aurora credit ••3318"), text("Available credit · $3,640.20")],
  },
  {
    id: "T-25", name: "An unknown card in the link is ignored and the first card is chosen", covers: ["AC-11"], ...base, launch: { "launch.cardId": "card_nope" },
    steps: [text("▶ Everyday debit ••9021")],
  },
  {
    id: "T-26", name: "Without cards.view it is not available", covers: ["AC-12"], ...base, conditions: { withoutPermissions: ["cards.view"] },
    steps: [screen("denied"), text("Not available")],
  },
  {
    id: "T-27", name: "Without cards.manage the actions of cards are gone, PIN stays with cards.pin; without payments.create there is no Add a card", covers: ["AC-12"], ...base, conditions: { withoutPermissions: ["cards.manage", "payments.create"] },
    steps: [screen("list"), noText(FREEZE), noText(CONTROLS), noText("Add a card"), text(PIN)],
  },
  {
    id: "T-28", name: "Without cards.pin there is no PIN action", covers: ["AC-12"], ...base, conditions: { withoutPermissions: ["cards.pin"] },
    steps: [screen("list"), noText(PIN), text(FREEZE)],
  },
];
