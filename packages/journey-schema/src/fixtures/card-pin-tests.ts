import type { Journey } from "../schema";

/** What must be true for "Set or change a card PIN" to be right. Each is proved by at least one scenario below. */
export const cardPinAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "A one-time code is asked before a PIN can be set, and a wrong code sets nothing." },
  { id: "AC-2", text: "The PIN is 4 digits typed twice, and both must match." },
  { id: "AC-3", text: "With blockWeak on, repeated digits, runs, patterns like 1212 and the last four digits or expiry of the card are refused with the bank's messages; with it off any 4 digits pass." },
  { id: "AC-4", text: "A virtual card, a card that is not activated, one that is blocked and one the bank does not know are refused with the messages of the spec; a frozen card can have a PIN." },
  { id: "AC-5", text: "The first PIN of a card shows \"PIN set\"; a later one shows \"PIN changed\"." },
  { id: "AC-6", text: "Three wrong codes end the attempt with nothing changed." },
  { id: "AC-7", text: "The PIN and the code are not kept: not in the result, not in what the journey holds once the bank has them, and the bank keeps a hash only." },
  { id: "AC-8", text: "When the bank is unavailable or does not answer in time, or the code cannot be sent, the PIN is not saved." },
  { id: "AC-9", text: "It needs cards.pin, and the bank itself asks for the code and refuses a card or a PIN that a screen would not offer." },
];

// Alex Morgan on Tuesday 3 November 2026: Everyday debit ••9021 (PIN set, active), Spare debit ••7745 (not activated, no PIN), Online shopping ••6150 (virtual).
const NOW = "2026-11-03T10:00:00Z";
type Step = Record<string, unknown>;
const set = (v: Record<string, unknown>): Step => ({ set: v });
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const toast = (t: string): Step => ({ expectToast: t });
const forced = (adapter: string, input: Record<string, unknown>, c: string): Step => ({ expectBankError: { adapter, input, code: c } });
const card = (id: string, path: string, equals: unknown): Step => ({ expectBank: { adapter: "bank.cards.get", input: { cardId: id }, path, equals } });
const base = { persona: "alex", now: NOW, launch: { "launch.cardId": "card_9021" } };
const code = (c = "482100"): Step[] => [set({ "otp.code": c }), press("Continue")];
/** Past the code, to the PIN screen. */
const toPin = (): Step[] => [...code(), screen("pin")];
const enter = (pin: string, confirm = pin): Step[] => [set({ "pin.new": pin, "pin.confirm": confirm }), press("Save PIN")];
/** Activates the Spare debit with the bank's own calls, so it is an active card without a PIN. */
const activated: NonNullable<Journey["scenarios"]>[number]["setup"] = [{ adapter: "bank.cards.activate", input: { cardId: "card_7745", last4: "7745", expiry: "11/29" } }];

export const cardPinScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "A code, then 2580 twice: PIN changed, with the card and Ready to use now", covers: ["AC-1", "AC-2", "AC-5"], ...base,
    steps: [screen("code"), text("Enter your code"), text("Everyday debit ••9021"), ...toPin(), text("4 digits. Don’t use your birthday."), ...enter("2580"), screen("done"), text("PIN changed"), text("Use your new PIN from now on."), text("Everyday debit ••9021"), text("Ready to use"), text("Now"), noText("PIN set"), noText("2580")],
  },
  {
    id: "T-2", name: "The two entries must match and be 4 digits", covers: ["AC-2"], ...base,
    steps: [
      ...toPin(), ...enter("2580", "2581"), screen("pin"), text("The PINs don’t match."), ...enter("2580"), screen("done"),
    ],
  },
  {
    id: "T-3", name: "Fewer than 4 digits or letters are refused on the screen: Enter 4 digits.", covers: ["AC-2"], ...base,
    steps: [...toPin(), ...enter("123"), screen("pin"), text("Enter 4 digits."), ...enter("12a4"), screen("pin"), text("Enter 4 digits."), set({ "pin.new": "", "pin.confirm": "" }), press("Save PIN"), screen("pin")],
  },
  {
    id: "T-4", name: "With blockWeak on, 1111, 1234, 4321, 1212 and the card's last four or expiry are each refused with their own words", covers: ["AC-3"], ...base,
    steps: [
      ...toPin(),
      ...enter("1111"), screen("pin"), text("Don’t use the same digit four times."),
      ...enter("1234"), text("Don’t use numbers in a row, like 1234."),
      ...enter("4321"), text("Don’t use numbers in a row, like 1234."),
      ...enter("1212"), text("Choose a PIN that’s harder to guess."),
      ...enter("2121"), text("Choose a PIN that’s harder to guess."),
      ...enter("9021"), text("Don’t use part of your card number or expiry date."),
      ...enter("0929"), text("Don’t use part of your card number or expiry date."),
      card("card_9021", "pinSet", true), ...enter("2580"), screen("done"),
    ],
  },
  {
    id: "T-5", name: "With blockWeak off any 4 digits pass", covers: ["AC-3"], ...base, launch: { "launch.cardId": "card_9021", "opt.blockWeak": false },
    steps: [...toPin(), ...enter("1111"), screen("done"), text("PIN changed")],
  },
  {
    id: "T-6", name: "Without a card it starts with the first card that can have a PIN, and lists the physical cards only", covers: ["AC-4"], persona: "alex", now: NOW,
    steps: [screen("pick"), text("Everyday debit ••9021"), text("Spare debit ••7745"), text("Aurora credit ••3318"), noText("Online shopping"), press("Continue"), screen("code"), text("Everyday debit ••9021")],
  },
  {
    id: "T-24", name: "Nothing chosen is refused on the card step", covers: ["AC-4"], persona: "alex", now: NOW,
    steps: [set({ "pin.cardId": "" }), press("Continue"), screen("pick"), { expectError: "pin.cardId" }],
  },
  {
    id: "T-7", name: "A card that is not activated says to activate it first", covers: ["AC-4"], persona: "alex", now: NOW,
    steps: [set({ "pin.cardId": "card_7745" }), press("Continue"), screen("pick"), text("Activate this card first."), noText("Enter your code")],
  },
  {
    id: "T-8", name: "A virtual card has no PIN, a blocked card cannot be changed, an unknown card is not found", covers: ["AC-4"], persona: "alex", now: NOW,
    setup: [{ adapter: "bank.cards.block", input: { cardId: "card_3318", reason: "lost" } }],
    steps: [
      set({ "pin.cardId": "card_6150" }), press("Continue"), screen("pick"), text("Virtual cards don’t have a PIN."),
      set({ "pin.cardId": "card_3318" }), press("Continue"), text("This card can’t be changed."), noText("Virtual cards don’t have a PIN."),
      set({ "pin.cardId": "card_nope" }), press("Continue"), text("We can’t find that card."),
      set({ "pin.cardId": "card_9021" }), press("Continue"), screen("code"),
    ],
  },
  {
    id: "T-9", name: "A card opened with its id that cannot be changed shows the reason on the card step", covers: ["AC-4"], persona: "alex", now: NOW, launch: { "launch.cardId": "card_6150" },
    steps: [screen("pick"), text("Virtual cards don’t have a PIN.")],
  },
  {
    id: "T-10", name: "A frozen card can have a PIN", covers: ["AC-4"], ...base, setup: [{ adapter: "bank.cards.freeze", input: { cardId: "card_9021" } }],
    steps: [...toPin(), ...enter("2580"), screen("done"), text("PIN changed")],
  },
  {
    id: "T-11", name: "A card activated without a PIN shows PIN set", covers: ["AC-5"], ...base, launch: { "launch.cardId": "card_7745" }, setup: activated,
    steps: [card("card_7745", "pinSet", false), ...toPin(), ...enter("2580"), screen("done"), text("PIN set"), noText("PIN changed"), card("card_7745", "pinSet", true)],
  },
  {
    id: "T-12", name: "A wrong code sets nothing and says so; the right code goes on", covers: ["AC-1"], ...base,
    steps: [...code("111111"), toast("That code isn’t right. Try again."), screen("code"), noText("New PIN"), ...code(), screen("pin")],
  },
  {
    id: "T-13", name: "Three wrong codes end the attempt: Too many wrong codes, nothing changed, and the card has no PIN set", covers: ["AC-6"], ...base, launch: { "launch.cardId": "card_7745" }, setup: activated,
    steps: [...code("111111"), ...code("111111"), ...code("111111"), screen("locked"), text("Too many wrong codes"), text("Too many wrong codes. Nothing was changed. Go back to start again."), card("card_7745", "pinSet", false), press("Back to start"), screen("code")],
  },
  {
    id: "T-14", name: "An empty code is not sent", covers: ["AC-1"], ...base,
    steps: [press("Continue"), screen("code"), { expectError: "otp.code" }],
  },
  {
    id: "T-15", name: "After the result no PIN and no code is on the screen or kept, and the bank has set the PIN", covers: ["AC-7"], ...base,
    steps: [...toPin(), ...enter("2580"), screen("done"), noText("2580"), card("card_9021", "pinSet", true), press("Go to cards")],
  },
  {
    id: "T-16", name: "A PIN the bank refuses clears both entries: they have to be typed again", covers: ["AC-7"], ...base,
    steps: [...toPin(), ...enter("1111"), screen("pin"), text("Don’t use the same digit four times."), press("Save PIN"), screen("pin"), { expectError: "pin.new" }],
  },
  {
    id: "T-17", name: "When the bank is unavailable the PIN is not saved", covers: ["AC-8"], ...base, launch: { "launch.cardId": "card_7745" }, setup: activated, conditions: { unavailable: ["bank.cards.pin.set"] },
    steps: [...toPin(), ...enter("2580"), screen("unavailable"), text("This isn’t available right now. Nothing was changed. Try again in a few minutes."), noText("2580")],
  },
  {
    id: "T-18", name: "When the bank does not answer in time the PIN is not saved", covers: ["AC-8"], ...base, launch: { "launch.cardId": "card_7745" }, setup: activated, conditions: { timeout: ["bank.cards.pin.set"], latencyMs: 10000 },
    steps: [...toPin(), ...enter("2580"), screen("timeout"), text("This is taking longer than expected. Nothing was changed."), press("Try again"), screen("code")],
  },
  {
    id: "T-19", name: "When the code cannot be sent nothing starts", covers: ["AC-8"], ...base, conditions: { unavailable: ["bank.otp.send"] },
    steps: [screen("unavailable")],
  },
  {
    id: "T-20", name: "When the cards cannot be read nothing starts", covers: ["AC-8"], persona: "alex", now: NOW, conditions: { unavailable: ["bank.cards.eligible"] },
    steps: [screen("unavailable")],
  },
  {
    id: "T-21", name: "When the card cannot be read when Continue is pressed nothing is changed", covers: ["AC-8"], ...base, conditions: { timeout: ["bank.cards.get"], latencyMs: 10000 },
    steps: [screen("timeout"), text("This is taking longer than expected. Nothing was changed.")],
  },
  {
    id: "T-22", name: "Without cards.pin it is not available, and the bank refuses", covers: ["AC-9"], ...base, conditions: { withoutPermissions: ["cards.pin"] },
    steps: [screen("denied"), text("Not available"), forced("bank.cards.pin.set", { cardId: "card_9021", pin: "2580" }, "PERMISSION_DENIED")],
  },
  {
    id: "T-23", name: "The bank asks for the code itself, refuses easy PINs, virtual cards and cards that are not activated whatever a screen would do", covers: ["AC-9", "AC-3", "AC-4"], persona: "alex", now: NOW,
    steps: [
      forced("bank.cards.pin.set", { cardId: "card_9021", pin: "2580" }, "OTP_REQUIRED"), forced("bank.cards.pin.set", { cardId: "card_9021", pin: "1111" }, "PIN_WEAK"),
      forced("bank.cards.pin.set", { cardId: "card_9021", pin: "12" }, "PIN_INVALID"), forced("bank.cards.pin.set", { cardId: "card_6150", pin: "2580" }, "CARD_VIRTUAL"),
      forced("bank.cards.pin.set", { cardId: "card_7745", pin: "2580" }, "CARD_NOT_ACTIVATED"), forced("bank.cards.pin.set", { cardId: "card_nope", pin: "2580" }, "CARD_NOT_FOUND"),
      card("card_9021", "pinSet", true),
    ],
  },
];
