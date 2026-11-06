import type { Journey } from "../schema";

/** What must be true for "Replace a card" to be right. Each is proved by at least one scenario below. */
export const replaceCardAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "Lost and Stolen block the card when the person presses \"Block card and continue\", before the delivery is chosen and without a code; a reason passed in still blocks the card; a card that was blocked already carries on." },
  { id: "AC-2", text: "Damaged leaves the old card working; Expired is accepted only for an expired card or one with 60 days or fewer left." },
  { id: "AC-3", text: "A virtual card, a card not activated, a card already replaced, a card already being replaced and an unknown card are refused with the messages of the spec." },
  { id: "AC-4", text: "The delivery address is the home address of the bank's market or another address with a line, a city and a valid postcode (no postcode in market D)." },
  { id: "AC-5", text: "Standard is free; Express costs $15.00 only while expressFee is on." },
  { id: "AC-6", text: "A one-time code is always asked before the order and the review needs the confirmation ticked; a wrong code orders nothing and three wrong codes end the attempt (a block already made stays)." },
  { id: "AC-7", text: "A fee above the available balance is refused before the code, with \"Choose Standard\", and nothing is ordered." },
  { id: "AC-8", text: "The result shows the new card as Not activated with an arrival date and the fee; a second order for the same card is refused." },
  { id: "AC-9", text: "When the bank is unavailable or does not answer in time nothing is ordered and the words say to call about a lost or stolen card; a block already made stays." },
  { id: "AC-10", text: "It needs cards.manage, and the bank itself asks for the code, refuses a lost or stolen card that is still working, a bad address, a card it cannot replace and a second order." },
];

// Alex Morgan on Tuesday 3 November 2026: Everyday debit ••9021 (active, spends from Main with $8,720.76, expiry 09/29), Aurora credit ••3318, Spare debit ••7745 (not activated), a virtual card ••6150.
const NOW = "2026-11-03T10:00:00Z";
type Step = Record<string, unknown>;
const set = (v: Record<string, unknown>): Step => ({ set: v });
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const error = (m: string): Step => ({ expectError: m });
const toast = (t: string): Step => ({ expectToast: t });
const forced = (adapter: string, input: Record<string, unknown>, c: string): Step => ({ expectBankError: { adapter, input, code: c } });
const card = (id: string, path: string, equals: unknown): Step => ({ expectBank: { adapter: "bank.cards.get", input: { cardId: id }, path, equals } });
const balance = (equals: number): Step => ({ expectBank: { adapter: "bank.accounts.get", input: { accountId: "acc_main" }, path: "balance", equals } });
const lost = { persona: "alex", now: NOW, launch: { "launch.cardId": "card_9021", "launch.reason": "lost" } };
const damaged = { persona: "alex", now: NOW, launch: { "launch.cardId": "card_9021", "launch.reason": "damaged" } };
const withOtp: NonNullable<Journey["scenarios"]>[number]["setup"] = [{ adapter: "bank.otp.send" }, { adapter: "bank.otp.verify", input: { code: "482100" } }];
/** An order already made with the bank's own calls: the new card ••9301 is on its way and Everyday debit has a replacement pending. */
const ordered: NonNullable<Journey["scenarios"]>[number]["setup"] = [...withOtp, { adapter: "bank.cards.replace", input: { cardId: "card_9021", reason: "damaged", speed: "standard", address: "home" } }];
/** From the review to the end: tick, the code, the order. */
const order = (code = "482100"): Step[] => [set({ "rp.consent": true }), press("Continue"), screen("code"), set({ "otp.code": code }), press("Order card")];
const REPLACING = "A replacement is already on its way. It arrives by Tue 10 Nov.";

export const replaceCardScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "Lost: the card is blocked at once with no code, then home address and Standard, the review says Old card Blocked, a code, and the new card is Not activated", covers: ["AC-1", "AC-4", "AC-5", "AC-6", "AC-8"], ...lost,
    steps: [
      screen("delivery"), text("Everyday debit ••9021 is blocked. No one can use it. This can’t be undone."), card("card_9021", "status", "blocked"), text("12 Example Street, Springfield 62704"),
      press("Continue"), screen("review"), text("Everyday debit ••9021"), text("Lost"), text("12 Example Street, Springfield 62704"), text("Standard, by Tue 10 Nov"), text("Free"), text("Old card"), text("Blocked"), noText("Replacement"),
      ...order(), screen("done"), text("Card blocked and replacement ordered"), text("It arrives by Tue 10 Nov."), text("On its way"), text("Everyday debit ••9021 (blocked)"), text("••9301"), text("Arrives by"), text("The new card is Not activated"),
      card("card_9301", "status", "inactive"), card("card_9021", "status", "blocked"), balance(8720.76),
    ],
  },
  {
    id: "T-2", name: "Damaged: the card is not blocked and keeps working; Express costs $15.00 after the code and the result says Replacement ordered", covers: ["AC-2", "AC-5", "AC-6", "AC-8"], persona: "alex", now: NOW, launch: { "launch.cardId": "card_9021" },
    steps: [
      screen("reason"), text("What happened?"), text("Lost"), text("Stolen"), text("Damaged"), text("Expired"), set({ "rp.reason": "lost" }), text("Block card and continue"), set({ "rp.reason": "damaged" }), press("Continue"),
      screen("delivery"), noText("is blocked"), card("card_9021", "status", "active"), text("By the 2nd working day · $15.00"), set({ "rp.speed": "express" }), press("Continue"),
      screen("review"), text("Damaged"), text("Express, by Thu 5 Nov"), text("$15.00"), noText("Old card"), balance(8720.76), ...order(), screen("done"), text("Replacement ordered"), text("Fee"), text("$15.00"), noText("Card blocked and replacement ordered"), noText("(blocked)"),
      card("card_9021", "status", "active"), balance(8705.76), card("card_9021", "replacement.newCardId", "card_9301"),
    ],
  },
  {
    id: "T-3", name: "Expired is refused for a card that runs to 09/29 with the words of the bank, and the person can choose another reason", covers: ["AC-2"], persona: "alex", now: NOW, launch: { "launch.cardId": "card_9021", "launch.reason": "expired" },
    steps: [screen("reason"), text("This card hasn’t expired yet."), set({ "rp.reason": "damaged" }), press("Continue"), screen("delivery"), noText("This card hasn’t expired yet.")],
  },
  {
    id: "T-4", name: "Expired is accepted with 60 days or fewer left, and for an expired card; with 61 or more it is refused", covers: ["AC-2"], persona: "alex", now: "2029-08-01T10:00:00Z", launch: { "launch.cardId": "card_9021", "launch.reason": "expired" },
    steps: [screen("delivery"), noText("This card hasn’t expired yet."), press("Continue"), screen("review"), text("Expired")],
  },
  {
    id: "T-5", name: "An expired card can be replaced as Expired", covers: ["AC-2"], persona: "alex", now: "2029-10-15T10:00:00Z", launch: { "launch.cardId": "card_9021", "launch.reason": "expired" },
    steps: [screen("delivery"), press("Continue"), screen("review"), text("Expired"), card("card_9021", "status", "expired")],
  },
  {
    id: "T-6", name: "With 61 days left Expired is refused; with 60 it was accepted", covers: ["AC-2"], persona: "alex", now: "2029-07-31T10:00:00Z", launch: { "launch.cardId": "card_9021", "launch.reason": "expired" },
    steps: [screen("reason"), text("This card hasn’t expired yet.")],
  },
  {
    id: "T-7", name: "Without a card the person chooses; a card not activated, a virtual card and an unknown card are refused with their messages; nothing chosen is refused", covers: ["AC-3"], persona: "alex", now: NOW,
    steps: [
      screen("pick"), text("Everyday debit ••9021"), text("Spare debit ••7745"), text("Aurora credit ••3318"), noText("Online shopping"), press("Continue"), error("Required"), screen("pick"),
      set({ "rp.cardId": "card_7745" }), press("Continue"), text("This card isn’t active yet."),
      set({ "rp.cardId": "card_6150" }), press("Continue"), text("Virtual cards can’t be replaced. Create a new one instead."), noText("This card isn’t active yet."),
      set({ "rp.cardId": "card_nope" }), press("Continue"), text("We can’t find that card."), noText("Virtual cards can’t be replaced."),
      set({ "rp.cardId": "card_9021" }), press("Continue"), screen("reason"),
    ],
  },
  {
    id: "T-8", name: "A card with a replacement on its way says when it arrives; a second order is refused", covers: ["AC-3", "AC-8"], persona: "alex", now: NOW, launch: { "launch.cardId": "card_9021" }, setup: ordered,
    steps: [screen("pick"), text(REPLACING), noText("What happened?"), card("card_9021", "replacement.arrivesBy", "Tue 10 Nov")],
  },
  {
    id: "T-9", name: "A card that was replaced and whose new card is in use says so", covers: ["AC-3"], persona: "alex", now: NOW, launch: { "launch.cardId": "card_9021" },
    setup: [...ordered, { adapter: "bank.cards.activate", input: { cardId: "card_9301", last4: "9301", expiry: "11/29" } }],
    steps: [screen("pick"), text("This card has already been replaced."), noText(REPLACING)],
  },
  {
    id: "T-10", name: "Another address needs a line, a city and a postcode, each with its message; the review shows the address typed", covers: ["AC-4"], ...damaged,
    steps: [
      screen("delivery"), noText("Address line"), set({ "rp.where": "other" }), text("Address line"), text("City"), text("Postcode"),
      set({ "rp.line": "ab", "rp.city": "S", "rp.postcode": "1" }), press("Continue"), screen("delivery"), error("Enter the address line (3 to 60 characters)."), error("Enter the city (2 to 40 characters)."), error("Enter a valid postcode."),
      set({ "rp.line": "5 Elm Road", "rp.city": "Springfield", "rp.postcode": "62704" }), press("Continue"), screen("review"), text("5 Elm Road, Springfield 62704"), noText("12 Example Street"),
    ],
  },
  {
    id: "T-11", name: "Back from the review returns to the delivery, and the confirmation has to be ticked again", covers: ["AC-6"], ...damaged,
    steps: [press("Continue"), set({ "rp.consent": true }), press("Back"), screen("delivery"), press("Continue"), screen("review"), press("Continue"), error("Tick the confirmation first.")],
  },
  {
    id: "T-12", name: "Back from the code returns to the review and the code is gone", covers: ["AC-6"], ...damaged,
    steps: [press("Continue"), set({ "rp.consent": true }), press("Continue"), set({ "otp.code": "123456" }), press("Back"), screen("review"), press("Continue"), screen("code"), press("Order card"), error("otp.code"), card("card_9021", "replacement", null)],
  },
  {
    id: "T-13", name: "With expressFee off Express is Free, no fee is taken and it still arrives by the 2nd working day", covers: ["AC-5"], persona: "alex", now: NOW, launch: { "launch.cardId": "card_9021", "launch.reason": "damaged", "opt.expressFee": false },
    steps: [
      text("By the 2nd working day · Free"), noText("$15.00"), set({ "rp.speed": "express" }), press("Continue"), screen("review"), text("Express, by Thu 5 Nov"), text("Free"), noText("$15.00"),
      ...order(), screen("done"), text("Thu 5 Nov"), balance(8720.76),
    ],
  },
  {
    id: "T-14", name: "A wrong code orders nothing and says so; the right code goes on", covers: ["AC-6"], ...damaged,
    steps: [
      press("Continue"), ...order("111111"), toast("That code isn’t right. Try again."), screen("code"), card("card_9021", "replacement", null), balance(8720.76),
      set({ "otp.code": "482100" }), press("Order card"), screen("done"),
    ],
  },
  {
    id: "T-15", name: "Three wrong codes end the attempt, nothing is ordered and the block already made stays; starting again carries on from the block", covers: ["AC-6", "AC-1"], ...lost,
    steps: [
      press("Continue"), ...order("111111"), set({ "otp.code": "111111" }), press("Order card"), set({ "otp.code": "111111" }), press("Order card"),
      screen("locked"), text("Too many wrong codes"), text("Nothing was ordered. Start again when you’re ready. A block you already made stays."), card("card_9021", "replacement", null), card("card_9021", "status", "blocked"),
      press("Start again"), screen("delivery"), text("Everyday debit ••9021 is blocked."),
    ],
  },
  {
    id: "T-16", name: "The review cannot be left without the confirmation, and an empty code is not sent", covers: ["AC-6"], ...damaged,
    steps: [press("Continue"), screen("review"), press("Continue"), error("Tick the confirmation first."), screen("review"), set({ "rp.consent": true }), press("Continue"), screen("code"), press("Order card"), error("otp.code"), screen("code")],
  },
  {
    id: "T-17", name: "A fee above the available balance is refused before the code with Choose Standard, and Standard goes on", covers: ["AC-7"], ...damaged,
    setup: [...withOtp, { adapter: "bank.transfers.own", input: { fromAccountId: "acc_main", toAccountId: "acc_save", amount: 8600 } }],
    steps: [
      set({ "rp.speed": "express" }), press("Continue"), screen("delivery"), text("Not enough in your account to pay the delivery fee. Choose Standard."), card("card_9021", "replacement", null),
      set({ "rp.speed": "standard" }), press("Continue"), screen("review"), text("Free"),
    ],
  },
  {
    id: "T-18", name: "When the bank is unavailable for the order nothing is ordered, the words say to call about a lost or stolen card and the block stays", covers: ["AC-9"], ...lost, conditions: { unavailable: ["bank.cards.replace"] },
    steps: [
      press("Continue"), ...order(), screen("unavailable"), text("This isn’t available right now. Try again in a few minutes. If your card is lost or stolen, call us."), text("A block you already made stays."),
    ],
  },
  {
    id: "T-19", name: "When the bank does not answer in time for the order nothing is ordered and the words say to check the cards", covers: ["AC-9"], ...damaged, conditions: { timeout: ["bank.cards.replace"], latencyMs: 10000 },
    steps: [press("Continue"), ...order(), screen("timeout"), text("This is taking longer than expected. Check your cards before you try again."), text("Nothing was ordered."), press("Try again"), screen("delivery")],
  },
  {
    id: "T-20", name: "When the block cannot be made nothing happens to the card and the person is told to call", covers: ["AC-9", "AC-1"], ...lost, conditions: { unavailable: ["bank.cards.block"] },
    steps: [screen("unavailable"), text("If your card is lost or stolen, call us."), card("card_9021", "status", "active")],
  },
  {
    id: "T-21", name: "When the bank cannot check the order the block already made stays and nothing is ordered", covers: ["AC-9"], ...lost, conditions: { timeout: ["bank.cards.replace.check"], latencyMs: 10000 },
    steps: [press("Continue"), screen("timeout"), card("card_9021", "status", "blocked")],
  },
  {
    id: "T-22", name: "When the reason cannot be checked, or the cards or the card cannot be read, or the code cannot be sent, nothing is ordered", covers: ["AC-9"], ...damaged, conditions: { unavailable: ["bank.cards.replace.check"] },
    steps: [screen("unavailable"), text("Nothing was ordered.")],
  },
  {
    id: "T-23", name: "When the cards cannot be read nothing starts", covers: ["AC-9"], ...damaged, conditions: { unavailable: ["bank.cards.eligible"] },
    steps: [screen("unavailable")],
  },
  {
    id: "T-24", name: "When the card cannot be read when the person moves on nothing is ordered", covers: ["AC-9"], ...damaged, conditions: { timeout: ["bank.cards.get"], latencyMs: 10000 },
    steps: [screen("timeout"), text("Check your cards before you try again.")],
  },
  {
    id: "T-25", name: "When the code cannot be sent nothing is ordered", covers: ["AC-9"], ...damaged, conditions: { unavailable: ["bank.otp.send"] },
    steps: [press("Continue"), set({ "rp.consent": true }), press("Continue"), screen("unavailable"), card("card_9021", "replacement", null)],
  },
  {
    id: "T-26", name: "Without cards.manage it is not available, and the bank refuses to block, check or order", covers: ["AC-10"], ...damaged, conditions: { withoutPermissions: ["cards.manage"] },
    steps: [
      screen("denied"), text("Not available"), forced("bank.cards.block", { cardId: "card_9021", reason: "lost" }, "PERMISSION_DENIED"), forced("bank.cards.replace.check", { cardId: "card_9021", reason: "damaged" }, "PERMISSION_DENIED"),
      forced("bank.cards.replace", { cardId: "card_9021", reason: "damaged", speed: "standard", where: "home" }, "PERMISSION_DENIED"),
    ],
  },
  {
    id: "T-27", name: "The bank asks for the code itself and refuses a lost card still working, a bad address, a bad speed, a virtual card, a card not activated and Expired too early", covers: ["AC-10", "AC-4", "AC-3", "AC-2"], persona: "alex", now: NOW,
    steps: [
      forced("bank.cards.replace", { cardId: "card_9021", reason: "damaged", speed: "standard", where: "home" }, "OTP_REQUIRED"), forced("bank.cards.replace", { cardId: "card_9021", reason: "lost", speed: "standard", where: "home" }, "CARD_NOT_BLOCKED"),
      forced("bank.cards.replace", { cardId: "card_9021", reason: "stolen", speed: "standard", where: "home" }, "CARD_NOT_BLOCKED"),
      forced("bank.cards.replace.check", { cardId: "card_9021", reason: "damaged", speed: "standard", where: "other", line: "ab", city: "S", postcode: "1" }, "ADDRESS_INVALID"),
      forced("bank.cards.replace.check", { cardId: "card_9021", reason: "damaged", speed: "standard", where: "other", line: "5 Elm Road", city: "Springfield", postcode: "1" }, "ADDRESS_INVALID"),
      forced("bank.cards.replace.check", { cardId: "card_9021", reason: "damaged", speed: "rocket", where: "home" }, "DELIVERY_INVALID"), forced("bank.cards.replace.check", { cardId: "card_9021", reason: "fun", speed: "standard", where: "home" }, "REASON_INVALID"),
      forced("bank.cards.replace.check", { cardId: "card_6150", reason: "damaged", speed: "standard", where: "home" }, "CARD_VIRTUAL"), forced("bank.cards.replace.check", { cardId: "card_7745", reason: "damaged", speed: "standard", where: "home" }, "CARD_NOT_ACTIVATED"),
      forced("bank.cards.replace.check", { cardId: "card_9021", reason: "expired", speed: "standard", where: "home" }, "REASON_INVALID"), forced("bank.cards.replace.check", { cardId: "card_nope", reason: "damaged" }, "CARD_NOT_FOUND"),
      forced("bank.cards.block", { cardId: "card_7745", reason: "lost" }, "CARD_NOT_ACTIVE"), forced("bank.cards.block", { cardId: "card_9021", reason: "boredom" }, "REASON_INVALID"),
      card("card_9021", "replacement", null), card("card_9021", "status", "active"),
    ],
  },
  {
    id: "T-28", name: "The bank refuses a second order and a card already replaced whatever a screen would do", covers: ["AC-10", "AC-8", "AC-3"], persona: "alex", now: NOW,
    setup: [...ordered, { adapter: "bank.cards.activate", input: { cardId: "card_9301", last4: "9301", expiry: "11/29" } }, ...withOtp, { adapter: "bank.cards.replace", input: { cardId: "card_3318", reason: "damaged", speed: "standard", where: "home" } }],
    steps: [
      forced("bank.cards.replace.check", { cardId: "card_3318", reason: "damaged", speed: "standard", where: "home" }, "REPLACEMENT_PENDING"), forced("bank.cards.replace.check", { cardId: "card_9021", reason: "damaged", speed: "standard", where: "home" }, "CARD_REPLACED"),
    ],
  },
  {
    id: "T-29", name: "A reason passed in as Stolen blocks the card too, and the review says Stolen", covers: ["AC-1"], persona: "alex", now: NOW, launch: { "launch.cardId": "card_9021", "launch.reason": "stolen" },
    steps: [screen("delivery"), text("is blocked"), card("card_9021", "status", "blocked"), press("Continue"), text("Stolen"), text("Blocked")],
  },
  {
    id: "T-30", name: "A reason chosen as Lost blocks the card when Block card and continue is pressed; a card already blocked carries on with the same notice", covers: ["AC-1"], persona: "alex", now: NOW, launch: { "launch.cardId": "card_9021" },
    setup: [{ adapter: "bank.cards.block", input: { cardId: "card_9021", reason: "lost" } }],
    steps: [screen("reason"), set({ "rp.reason": "lost" }), press("Block card and continue"), screen("delivery"), text("Everyday debit ••9021 is blocked."), card("card_9021", "status", "blocked")],
  },
  {
    id: "T-31", name: "Pressing Block card and continue blocks the card at once, before any delivery is chosen and with no code", covers: ["AC-1"], persona: "alex", now: NOW, launch: { "launch.cardId": "card_9021" },
    steps: [screen("reason"), card("card_9021", "status", "active"), set({ "rp.reason": "lost" }), press("Block card and continue"), screen("delivery"), card("card_9021", "status", "blocked"), text("This can’t be undone."), card("card_9021", "replacement", null)],
  },
  {
    id: "T-32", name: "With no card passed in, the first blocked card is chosen for the person", covers: ["AC-3", "AC-1"], persona: "alex", now: NOW,
    setup: [{ adapter: "bank.cards.block", input: { cardId: "card_3318", reason: "lost" } }],
    steps: [screen("pick"), press("Continue"), screen("reason"), text("Aurora credit ••3318")],
  },
  {
    id: "T-33", name: "A reason that is not one of the four is ignored and asked", covers: ["AC-2"], persona: "alex", now: NOW, launch: { "launch.cardId": "card_9021", "launch.reason": "bored" },
    steps: [screen("reason"), text("What happened?"), press("Continue"), error("Required"), screen("reason")],
  },
  {
    id: "T-34", name: "In Market D the home address is the one of that market and another address has no postcode", covers: ["AC-4"], ...damaged, config: { homeMarket: "ae" },
    steps: [
      screen("delivery"), text("Example Tower, Flat 1204, Dubai"), set({ "rp.where": "other" }), text("Address line"), text("City"), noText("Postcode"),
      set({ "rp.line": "Villa 5", "rp.city": "Dubai" }), press("Continue"), screen("review"), text("Villa 5, Dubai"), noText("Example Tower"),
    ],
  },
  {
    id: "T-35", name: "In Market B the home address is the one of that market and a postcode is asked for another address", covers: ["AC-4"], ...damaged, config: { homeMarket: "uk" },
    steps: [screen("delivery"), text("12 Example Road, London SW1A 1AA"), set({ "rp.where": "other" }), text("Postcode")],
  },
];
