import type { Journey } from "../schema";

/** What must be true for "Activate a card" to be right. Each is proved by at least one scenario below. */
export const activateCardAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "With the right last 4 digits, expiry and security code the card becomes Active and the result says \"Card activated\"." },
  { id: "AC-2", text: "A wrong detail shows \"The details don’t match this card…\" and the tries left; the third wrong try locks activation, and the card then offers no Activate action." },
  { id: "AC-3", text: "An expired date is refused (\"This card has expired.\") and uses no try; a wrong format is refused (\"Use MM/YY.\")." },
  { id: "AC-4", text: "With askCvv off the security code field is absent and the code is not checked." },
  { id: "AC-5", text: "The PIN rules refuse repeats, runs, patterns and PINs built from the card, birth date, phone or account digits and the common ones, and the two entries must match." },
  { id: "AC-6", text: "Choosing Later sets no PIN, the result says \"Not set yet\" and offers Set my PIN, which opens card-pin for the card." },
  { id: "AC-7", text: "With pinAtActivation off the journey has no PIN step and ends after the details." },
  { id: "AC-8", text: "A card that is already active, blocked, virtual, locked or unknown is refused with the matching message; with no card waiting the person is told so; one card waiting is used, several are chosen from." },
  { id: "AC-9", text: "The security code is not kept after the bank has checked it, and the PIN is not kept after it was sent." },
  { id: "AC-10", text: "When the bank is unavailable or does not answer in time the card stays not activated and no try is used." },
  { id: "AC-11", text: "It needs cards.manage, and the bank itself refuses activating without the details having been checked, a card that cannot be activated, and a locked card." },
];

// Alex Morgan on Tuesday 3 November 2026: Spare debit ••7745 waits to be activated (expiry 11/29, any security code but 000), Everyday debit ••9021 is active.
const NOW = "2026-11-03T10:00:00Z";
type Step = Record<string, unknown>;
const set = (v: Record<string, unknown>): Step => ({ set: v });
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const error = (m: string): Step => ({ expectError: m });
const forced = (adapter: string, input: Record<string, unknown>, c: string): Step => ({ expectBankError: { adapter, input, code: c } });
const card = (id: string, path: string, equals: unknown): Step => ({ expectBank: { adapter: "bank.cards.get", input: { cardId: id }, path, equals } });
const base = { persona: "alex", now: NOW, launch: { "launch.cardId": "card_7745" } };
const details = (last4 = "7745", expiry = "11/29", cvv = "123"): Step[] => [set({ "act.last4": last4, "act.expiry": expiry, "act.cvv": cvv }), press("Continue")];
const toPin = (): Step[] => [...details(), screen("pin")];
const pin = (p: string, repeat = p): Step[] => [set({ "act.pin": p, "act.repeat": repeat }), press("Activate card")];
const HARDER = "Choose a PIN that’s harder to guess.";
const WRONG = "The details don’t match this card. Check them and try again.";
/** Three wrong tries made with the bank's own call (it answers each as data), so the card is locked before the journey starts. */
const locked: NonNullable<Journey["scenarios"]>[number]["setup"] = [0, 1, 2].map(() => ({ adapter: "bank.cards.verifyActivation", input: { cardId: "card_7745", last4: "0000", expiry: "11/29" } }));
const right = { cardId: "card_7745", last4: "7745", expiry: "11/29" };

export const activateCardScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "The right details and a PIN of 7391 twice: Card activated, the PIN Set, and the card is Active", covers: ["AC-1", "AC-5"], ...base,
    steps: [
      screen("details"), text("Activate your card"), text("Spare debit ••7745"), card("card_7745", "status", "inactive"), ...toPin(), text("Set your PIN"), ...pin("7391"),
      screen("done"), text("Card activated"), text("Your card ending 7745 is ready to use."), text("Active"), text("Spare debit ••7745"), text("PIN"), text("Set"), noText("Not set yet"), noText("Set my PIN"), noText("7391"),
      card("card_7745", "status", "active"), card("card_7745", "pinSet", true),
    ],
  },
  {
    id: "T-2", name: "A wrong detail says so and how many tries are left; the third wrong try locks activation and the card offers no Activate", covers: ["AC-2"], ...base,
    steps: [
      ...details("0000"), screen("details"), text(WRONG), text("2 tries left."), card("card_7745", "triesLeft", 2),
      ...details("7745", "10/29"), text(WRONG), text("1 try left."),
      ...details("7745", "11/29", "000"), screen("locked"), text("Too many wrong tries"), text("Too many wrong tries. Activation is locked. Please call us."), noText("Last 4 digits"),
      card("card_7745", "status", "inactive"), card("card_7745", "line", "Activation is locked. Please call us."), card("card_7745", "can.activate", false),
      { expectBank: { adapter: "bank.cards.verifyActivation", input: right, path: "code", equals: "ACTIVATION_LOCKED" } }, card("card_7745", "status", "inactive"),
    ],
  },
  {
    id: "T-3", name: "A wrong format is refused on the screen (MM/YY, 4 digits, 3 digits); a date that has gone by is refused by the bank and uses no try", covers: ["AC-3"], ...base,
    steps: [
      ...details("77", "1129", "12"), screen("details"), error("Use MM/YY."), error("Enter the last 4 digits on the card."), error("Enter the 3 digits on the back."),
      ...details("7745", "09/26"), text("This card has expired."), noText(WRONG), card("card_7745", "triesLeft", 3), card("card_7745", "status", "inactive"),
      ...details(), screen("pin"),
    ],
  },
  {
    id: "T-4", name: "With askCvv and pinAtActivation off there is no security code and no PIN step: the details activate the card, the PIN is Not set yet", covers: ["AC-4", "AC-7"], ...base, launch: { "launch.cardId": "card_7745", "opt.askCvv": false, "opt.pinAtActivation": false },
    steps: [
      screen("details"), noText("Security code"), set({ "act.last4": "7745", "act.expiry": "11/29" }), press("Continue"),
      screen("done"), text("Card activated"), text("PIN"), text("Not set yet"), text("Set my PIN"), card("card_7745", "status", "active"), card("card_7745", "pinSet", false),
    ],
  },
  {
    id: "T-5", name: "With only askCvv off the card still goes on to the PIN step; with it on a security code of 000 never matches", covers: ["AC-4"], ...base, launch: { "launch.cardId": "card_7745", "opt.askCvv": false },
    steps: [noText("Security code"), set({ "act.last4": "7745", "act.expiry": "11/29" }), press("Continue"), screen("pin"), card("card_7745", "status", "inactive")],
  },
  {
    id: "T-6", name: "Each PIN the bank refuses is told with its own words; the entries are cleared each time; the card stays not activated", covers: ["AC-5"], ...base,
    steps: [
      ...toPin(),
      ...pin("1111"), screen("pin"), text("Don’t repeat one digit."), ...pin("1234"), text("Don’t use a run of digits."), ...pin("4321"), text("Don’t use a run of digits."),
      ...pin("1212"), text(HARDER), ...pin("7745"), text(HARDER), ...pin("1129"), text(HARDER), ...pin("1988"), text(HARDER), ...pin("0142"), text(HARDER), ...pin("4410"), text(HARDER), ...pin("2580"), text(HARDER),
      card("card_7745", "status", "inactive"), ...pin("7391"), screen("done"),
    ],
  },
  {
    id: "T-7", name: "The two entries must match and be 4 digits; an empty PIN is refused", covers: ["AC-5"], ...base,
    steps: [
      ...toPin(), ...pin("7391", "7392"), screen("pin"), text("The PINs don’t match."), ...pin("123"), error("Use exactly 4 digits."), screen("pin"),
      set({ "act.pin": "", "act.repeat": "" }), press("Activate card"), error("Required"), screen("pin"), ...pin("7391"), screen("done"),
    ],
  },
  {
    id: "T-8", name: "Choosing Later sets no PIN: no PIN fields, the result says Not set yet and offers Set my PIN, which opens card-pin for this card", covers: ["AC-6"], ...base,
    steps: [
      ...toPin(), text("Set it now"), text("Later"), text("New PIN"), set({ "act.choice": "Later" }), noText("New PIN"), press("Activate card"),
      screen("done"), text("Card activated"), text("Not set yet"), card("card_7745", "pinSet", false), card("card_7745", "status", "active"),
      press("Set my PIN"), { expectOpens: { journey: "card-pin", with: { "launch.cardId": "card_7745" } } },
    ],
  },
  {
    id: "T-9", name: "A card that is already active, a virtual card, a blocked card and an unknown card are refused with their messages", covers: ["AC-8"], persona: "alex", now: NOW, launch: { "launch.cardId": "card_9021" },
    setup: [{ adapter: "bank.cards.block", input: { cardId: "card_3318", reason: "lost" } }],
    steps: [
      screen("pick"), text("This card is already active."), noText("Last 4 digits"),
      set({ "act.cardId": "card_6150" }), press("Continue"), screen("pick"), text("This card can’t be activated."), noText("This card is already active."),
      set({ "act.cardId": "card_3318" }), press("Continue"), text("This card can’t be activated."),
      set({ "act.cardId": "card_nope" }), press("Continue"), text("We can’t find that card."), noText("This card can’t be activated."),
      set({ "act.cardId": "card_7745" }), press("Continue"), screen("details"),
    ],
  },
  {
    id: "T-10", name: "A card whose activation is locked says so, whether it is passed in or chosen", covers: ["AC-8", "AC-2"], ...base, setup: locked,
    steps: [screen("pick"), text("Activation is locked. Please call us."), noText("Last 4 digits"), press("Continue"), screen("pick"), text("Activation is locked. Please call us.")],
  },
  {
    id: "T-11", name: "With exactly one card waiting that card is used without asking", covers: ["AC-8"], persona: "alex", now: NOW,
    steps: [screen("details"), text("Spare debit ••7745"), noText("Which card?")],
  },
  {
    id: "T-12", name: "With no card waiting: No cards are waiting to be activated", covers: ["AC-8"], persona: "alex", now: NOW, setup: [{ adapter: "bank.cards.activate", input: right }],
    steps: [screen("none"), text("No cards are waiting to be activated."), text("Go to cards")],
  },
  {
    id: "T-13", name: "With several cards waiting the person chooses; the card chosen is the one activated", covers: ["AC-8", "AC-1"], persona: "alex", now: NOW,
    setup: [{ adapter: "bank.otp.send" }, { adapter: "bank.otp.verify", input: { code: "482100" } }, { adapter: "bank.cards.replace", input: { cardId: "card_9021", reason: "damaged", speed: "standard", address: "home" } }],
    steps: [
      screen("pick"), text("Spare debit ••7745"), text("Everyday debit ••9301"), noText("Aurora credit"), set({ "act.cardId": "" }), press("Continue"), error("Required"), screen("pick"),
      set({ "act.cardId": "card_9301" }), press("Continue"), screen("details"), text("Everyday debit ••9301"), ...details("9301", "11/29"), screen("pin"), ...pin("7391"), screen("done"), text("Everyday debit ••9301"),
      card("card_9301", "status", "active"), card("card_7745", "status", "inactive"),
    ],
  },
  {
    id: "T-14", name: "The security code is not kept: going back from the PIN step finds the field empty and it has to be typed again", covers: ["AC-9"], ...base,
    steps: [...toPin(), press("Back"), screen("details"), press("Continue"), error("Required"), screen("details")],
  },
  {
    id: "T-15", name: "After the result neither the security code nor the PIN is on the screen, and the bank has the PIN", covers: ["AC-9"], ...base,
    steps: [...toPin(), ...pin("7391"), screen("done"), noText("7391"), noText("123"), card("card_7745", "pinSet", true)],
  },
  {
    id: "T-16", name: "When the bank is unavailable while the details are checked the card stays not activated and no try is used", covers: ["AC-10"], ...base, conditions: { unavailable: ["bank.cards.verifyActivation"] },
    steps: [...details(), screen("unavailable"), text("This isn’t available right now. Nothing was changed. Try again in a few minutes."), card("card_7745", "status", "inactive"), card("card_7745", "triesLeft", 3)],
  },
  {
    id: "T-17", name: "When the bank does not answer in time while the details are checked the card stays not activated and no try is used", covers: ["AC-10"], ...base, conditions: { timeout: ["bank.cards.verifyActivation"], latencyMs: 10000 },
    steps: [...details(), screen("timeout"), text("This is taking longer than expected. Nothing was changed."), card("card_7745", "triesLeft", 3), press("Try again"), screen("details")],
  },
  {
    id: "T-18", name: "When the bank is unavailable or slow while the card is activated the card stays not activated", covers: ["AC-10"], ...base, conditions: { unavailable: ["bank.cards.activate"] },
    steps: [...toPin(), ...pin("7391"), screen("unavailable"), noText("7391"), card("card_7745", "status", "inactive"), card("card_7745", "pinSet", false)],
  },
  {
    id: "T-19", name: "A slow answer to the activation itself changes nothing", covers: ["AC-10"], ...base, conditions: { timeout: ["bank.cards.activate"], latencyMs: 10000 },
    steps: [...toPin(), ...pin("7391"), screen("timeout"), text("This is taking longer than expected. Nothing was changed."), card("card_7745", "status", "inactive")],
  },
  {
    id: "T-20", name: "When the cards cannot be read, or the card cannot be read when the person moves on, nothing starts", covers: ["AC-10"], ...base, conditions: { unavailable: ["bank.cards.eligible"] },
    steps: [screen("unavailable"), text("Nothing was changed.")],
  },
  {
    id: "T-21", name: "A card that cannot be read when the person moves on is not activated", covers: ["AC-10"], ...base, conditions: { timeout: ["bank.cards.get"], latencyMs: 10000 },
    steps: [screen("timeout"), text("This is taking longer than expected. Nothing was changed.")],
  },
  {
    id: "T-22", name: "Without cards.manage it is not available, and the bank refuses", covers: ["AC-11"], ...base, conditions: { withoutPermissions: ["cards.manage"] },
    steps: [screen("denied"), text("Not available"), forced("bank.cards.verifyActivation", right, "PERMISSION_DENIED"), forced("bank.cards.activate", right, "PERMISSION_DENIED"), card("card_7745", "status", "inactive")],
  },
  {
    id: "T-23", name: "The bank refuses activating before the details were checked, a card that is active, blocked or virtual, and an unknown card", covers: ["AC-11"], persona: "alex", now: NOW,
    steps: [
      forced("bank.cards.activate", { cardId: "card_7745" }, "ACTIVATION_MISMATCH"), forced("bank.cards.activate", { cardId: "card_7745", last4: "0000", expiry: "11/29" }, "ACTIVATION_MISMATCH"),
      forced("bank.cards.verifyActivation", { cardId: "card_9021", last4: "9021", expiry: "09/29" }, "CARD_ALREADY_ACTIVE"), forced("bank.cards.activate", { cardId: "card_9021" }, "CARD_ALREADY_ACTIVE"),
      forced("bank.cards.verifyActivation", { cardId: "card_6150", last4: "6150", expiry: "10/28" }, "CARD_ALREADY_ACTIVE"), forced("bank.cards.verifyActivation", { cardId: "card_nope" }, "CARD_NOT_FOUND"),
      forced("bank.cards.verifyActivation", { ...right, expiry: "09/26" }, "CARD_EXPIRED"), card("card_7745", "triesLeft", 2), card("card_7745", "status", "inactive"),
    ],
  },
  {
    id: "T-24", name: "A card the bank locked cannot be activated by a call that skips the screens, even with the right details", covers: ["AC-11", "AC-2"], persona: "alex", now: NOW, setup: locked,
    steps: [forced("bank.cards.activate", right, "ACTIVATION_LOCKED"), card("card_7745", "status", "inactive")],
  },
  {
    id: "T-25", name: "A PIN the bank would refuse is refused for a call that skips the screens", covers: ["AC-11", "AC-5"], persona: "alex", now: NOW,
    setup: [{ adapter: "bank.cards.verifyActivation", input: right }],
    steps: [forced("bank.cards.activate", { cardId: "card_7745", pin: "1111" }, "PIN_WEAK"), forced("bank.cards.activate", { cardId: "card_7745", pin: "12" }, "PIN_INVALID"), card("card_7745", "status", "inactive")],
  },
  {
    id: "T-26", name: "A wrong try after an earlier right one still counts: the details have to match each time", covers: ["AC-2"], ...base,
    steps: [...details("0000"), text("2 tries left."), ...details(), screen("pin"), press("Back"), ...details("0000"), text("1 try left."), card("card_7745", "triesLeft", 1)],
  },
];
