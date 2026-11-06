import type { Journey } from "../schema";

/** What must be true for "Virtual card" to be right. Each is proved by at least one scenario below. */
export const virtualCardAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "The card must be an active physical card with fewer than 5 virtual cards on it; a card passed in that is not one is ignored, and the only such card is used without asking." },
  { id: "AC-2", text: "The limit is from $1.00 to $5,000.00, with the messages of the spec." },
  { id: "AC-3", text: "A one-time purchase is always single use and shows its limit per payment." },
  { id: "AC-4", text: "With allowThreeYears on a shopping or subscriptions card can last 3 years; with it off every card is single use and the screen is skipped." },
  { id: "AC-5", text: "A wrong code makes no card and three wrong codes end the attempt; the right code makes the card and shows its details once." },
  { id: "AC-6", text: "The card is linked to its parent, with online and international on and cash machines and contactless off." },
  { id: "AC-7", text: "The number and the security code are not shown again after the result: not kept in the journey once the person leaves it, and not kept by the bank." },
  { id: "AC-8", text: "When the bank is unavailable or does not answer in time, or the code cannot be sent, no card is made." },
  { id: "AC-9", text: "It needs cards.manage, and the bank itself asks for the code and refuses a card, a limit or a purpose that a screen would not offer." },
  { id: "AC-10", text: "If the card reaches 5 virtual cards between the review and the code, the bank refuses and no card is made." },
];

// Alex Morgan on Tuesday 3 November 2026: Everyday debit ••9021 (one virtual card ••6150 on it), Aurora credit ••3318, Spare debit ••7745 (not activated).
// The first card the bank makes for him is card_v9194, then card_v8386, card_v7578, card_v6760 and card_v5954 (the sandbox numbers them in order).
const NOW = "2026-11-03T10:00:00Z";
type Step = Record<string, unknown>;
const set = (v: Record<string, unknown>): Step => ({ set: v });
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const toast = (t: string): Step => ({ expectToast: t });
const forced = (input: Record<string, unknown>, c: string): Step => ({ expectBankError: { adapter: "bank.cards.virtual.create", input, code: c } });
const none = (id: string): Step => ({ expectBankError: { adapter: "bank.cards.get", input: { cardId: id }, code: "CARD_NOT_FOUND" } });
const made = (id: string, path: string, equals: unknown): Step => ({ expectBank: { adapter: "bank.cards.get", input: { cardId: id }, path, equals } });
const base = { persona: "alex", now: NOW, launch: { "launch.cardId": "card_9021" } };
const code = (c = "482100"): Step[] => [set({ "otp.code": c }), press("Create card")];
const purpose = (p: string): Step[] => [set({ "vc.purpose": p }), press("Continue")];
const limit = (n: number): Step[] => [set({ "vc.limit": n }), press("Continue")];
/** To the review: a purpose, a limit and (when asked) how long it lasts. */
const toReview = (p: string, n: number, life?: string): Step[] => [...purpose(p), ...limit(n), ...(life ? [screen("expiry"), set({ "vc.life": life }), press("Continue")] : []), screen("review")];
/** To the code, as the person sees it. */
const toCode = (p = "Online shopping", n = 200, life: string | undefined = "3y"): Step[] => [...toReview(p, n, life), press("Continue"), screen("code")];
const more = (n: number) => Array.from({ length: n }, () => [
  { adapter: "bank.otp.send" }, { adapter: "bank.otp.verify", input: { code: "482100" } },
  { adapter: "bank.cards.virtual.create", input: { cardId: "card_9021", purpose: "Online shopping", limit: 50 } },
]).flat();

export const virtualCardScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "Online shopping, 200, 3 years on Everyday debit: review, code, Virtual card ready with the details once; linked to its parent", covers: ["AC-1", "AC-5", "AC-6"], ...base,
    steps: [
      screen("purpose"), text("What is it for?"), text("Online shopping"), text("Subscriptions"), text("One-time purchase"), ...toReview("Online shopping", 200, "3y"),
      text("Linked to"), text("Everyday debit ••9021"), text("Online shopping"), text("$200.00 a month"), text("3 years"), press("Continue"), screen("code"), text("You’ll see the card details once."),
      ...code(), screen("done"), text("Virtual card ready"), text("Save these details now. We won’t show the number again."), text("Active"),
      text("4000 0010 0007 9194"), text("11/29"), text("137"), text("$200.00 a month"),
      made("card_v9194", "parentCardId", "card_9021"), made("card_v9194", "controls.online", true), made("card_v9194", "controls.abroad", true), made("card_v9194", "controls.atm", false), made("card_v9194", "controls.contactless", false),
      made("card_v9194", "pill", "Virtual"), made("card_v9194", "limits.monthly", 200),
    ],
  },
  {
    id: "T-2", name: "A limit below 1.00 or above 5,000.00 is refused with the spec's words; 1.00 and 5,000.00 pass", covers: ["AC-2"], ...base,
    steps: [
      ...purpose("Online shopping"), ...limit(0.5), screen("limit"), text("The smallest limit is $1.00."), ...limit(6000), screen("limit"), text("The most is $5,000.00."), noText("The smallest limit is $1.00."),
      ...limit(1), screen("expiry"), press("Back"), ...limit(5000), screen("expiry"),
    ],
  },
  {
    id: "T-3", name: "A limit with more decimals than dollars have is refused, and nothing typed is refused as Required", covers: ["AC-2"], ...base,
    steps: [...purpose("Online shopping"), ...limit(10.005), screen("limit"), set({ "vc.limit": "" }), press("Continue"), screen("limit"), { expectError: "vc.limit" }, press("Back"), screen("purpose"), text("What is it for?")],
  },
  {
    id: "T-4", name: "A one-time purchase is single use: the hint says one payment, the review says per payment and One payment, and no screen asks how long", covers: ["AC-3"], ...base,
    steps: [...purpose("One-time purchase"), text("The most it can spend in one payment."), noText("The most it can spend in a month."), ...limit(25), screen("review"), text("$25.00 per payment"), text("One payment"), noText("How long should it last?")],
  },
  {
    id: "T-5", name: "A shopping card asks how long it should last: Single use gives One payment, 3 years gives 3 years; the hint says a month", covers: ["AC-4"], ...base,
    steps: [
      ...purpose("Subscriptions"), text("The most it can spend in a month."), ...limit(30), screen("expiry"), text("How long should it last?"), text("Single use"), text("3 years"),
      press("Continue"), screen("expiry"), { expectError: "vc.life" }, set({ "vc.life": "single" }), press("Continue"), screen("review"), text("$30.00 per payment"), text("One payment"), noText("3 years"),
    ],
  },
  {
    id: "T-6", name: "With allowThreeYears off every card is single use and the screen is absent", covers: ["AC-4"], ...base, launch: { "launch.cardId": "card_9021", "opt.allowThreeYears": false },
    steps: [...purpose("Online shopping"), ...limit(75), screen("review"), text("One payment"), noText("3 years"), noText("How long should it last?")],
  },
  {
    id: "T-7", name: "With four more virtual cards on Everyday debit a sixth is refused at the card, with the bank's words", covers: ["AC-1"], ...base, setup: more(4),
    steps: [screen("card"), text("You have 5 virtual cards on this card, the most you can have. Delete one first."), noText("What is it for?")],
  },
  {
    id: "T-8", name: "Chosen from the list: Everyday debit with five virtual cards is refused, Aurora credit goes on; a virtual, a blocked and a not activated card are not offered", covers: ["AC-1"], persona: "alex", now: NOW, setup: more(4),
    steps: [
      screen("card"), text("Everyday debit ••9021"), text("Aurora credit ••3318"), noText("Spare debit"), noText("Online shopping ••6150"),
      press("Continue"), screen("card"), { expectError: "vc.cardId" },
      set({ "vc.cardId": "card_9021" }), press("Continue"), screen("card"), text("You have 5 virtual cards on this card, the most you can have. Delete one first."),
      set({ "vc.cardId": "card_3318" }), press("Continue"), screen("purpose"), noText("You have 5 virtual cards"),
    ],
  },
  {
    id: "T-9", name: "With only one active physical card it is used without asking", covers: ["AC-1"], persona: "alex", now: NOW, setup: [{ adapter: "bank.cards.block", input: { cardId: "card_3318", reason: "lost" } }],
    steps: [screen("purpose"), text("What is it for?"), ...purpose("Subscriptions"), ...limit(20), ...[set({ "vc.life": "single" }), press("Continue")], text("Everyday debit ••9021")],
  },
  {
    id: "T-10", name: "A card passed in that is virtual or not activated is ignored: the person chooses", covers: ["AC-1"], persona: "alex", now: NOW, launch: { "launch.cardId": "card_6150" },
    steps: [screen("card"), text("Everyday debit ••9021"), text("Aurora credit ••3318"), noText("We can’t find")],
  },
  {
    id: "T-11", name: "An inactive card passed in is ignored too", covers: ["AC-1"], persona: "alex", now: NOW, launch: { "launch.cardId": "card_7745" },
    steps: [screen("card"), noText("Spare debit")],
  },
  {
    id: "T-12", name: "A wrong code makes no card and says so; the right code makes it", covers: ["AC-5"], ...base,
    steps: [...toCode(), ...code("111111"), toast("That code isn’t right. Try again."), screen("code"), none("card_v9194"), ...code(), screen("done"), made("card_v9194", "last4", "9194")],
  },
  {
    id: "T-13", name: "Three wrong codes end the attempt and no card is made; Start again begins again", covers: ["AC-5"], ...base,
    steps: [...toCode(), ...code("111111"), ...code("111111"), ...code("111111"), screen("locked"), text("Too many wrong codes"), text("Nothing was changed on your card."), none("card_v9194"), press("Start again"), screen("purpose")],
  },
  {
    id: "T-14", name: "An empty code is not sent", covers: ["AC-5"], ...base,
    steps: [...toCode(), press("Create card"), screen("code"), { expectError: "otp.code" }, none("card_v9194")],
  },
  {
    id: "T-15", name: "After Go to cards the number and the security code are gone from the journey and the bank keeps only the last four digits", covers: ["AC-7"], ...base,
    steps: [
      ...toCode(), ...code(), screen("done"), text("4000 0010 0007 9194"), press("Go to cards"),
      made("card_v9194", "number", "•••• •••• •••• 9194"), made("card_v9194", "nickname", "Online shopping"), made("card_v9194", "name", "Online shopping ••9194"),
    ],
  },
  {
    id: "T-16", name: "When the bank is unavailable no card is made", covers: ["AC-8"], ...base, conditions: { unavailable: ["bank.cards.virtual.create"] },
    steps: [screen("unavailable"), text("This isn’t available right now. Nothing was changed. Try again in a few minutes."), none("card_v9194")],
  },
  {
    id: "T-17", name: "When the bank does not answer in time no card is made", covers: ["AC-8"], ...base, conditions: { timeout: ["bank.cards.virtual.create"], latencyMs: 10000 },
    steps: [screen("timeout"), text("This is taking longer than expected. Nothing was changed."), none("card_v9194"), press("Try again"), screen("timeout")],
  },
  {
    id: "T-18", name: "When the code cannot be sent no card is made", covers: ["AC-8"], ...base, conditions: { unavailable: ["bank.otp.send"] },
    steps: [...toReview("Online shopping", 200, "3y"), press("Continue"), screen("unavailable"), none("card_v9194")],
  },
  {
    id: "T-19", name: "When the cards cannot be read nothing starts", covers: ["AC-8"], ...base, conditions: { unavailable: ["bank.cards.eligible"] },
    steps: [screen("unavailable")],
  },
  {
    id: "T-20", name: "Without cards.manage it is not available, and the bank refuses", covers: ["AC-9"], ...base, conditions: { withoutPermissions: ["cards.manage"] },
    steps: [screen("denied"), text("Not available"), forced({ cardId: "card_9021", purpose: "Online shopping", limit: 200 }, "PERMISSION_DENIED"), none("card_v9194")],
  },
  {
    id: "T-21", name: "The bank asks for the code itself, and refuses a limit, a purpose and a card that a screen would not offer", covers: ["AC-9", "AC-2", "AC-1"], persona: "alex", now: NOW,
    steps: [
      forced({ cardId: "card_9021", purpose: "Online shopping", limit: 200 }, "OTP_REQUIRED"), forced({ cardId: "card_9021", purpose: "Online shopping", limit: 0.5 }, "LIMIT_INVALID"),
      forced({ cardId: "card_9021", purpose: "Online shopping", limit: 10.005 }, "LIMIT_INVALID"), forced({ cardId: "card_9021", purpose: "Online shopping", limit: 6000 }, "LIMIT_ABOVE_CEILING"),
      forced({ cardId: "card_9021", purpose: "Fun", limit: 200 }, "PURPOSE_INVALID"), forced({ cardId: "card_6150", purpose: "Online shopping", limit: 200 }, "CARD_NOT_ACTIVE"),
      forced({ cardId: "card_7745", purpose: "Online shopping", limit: 200 }, "CARD_NOT_ACTIVE"), forced({ cardId: "card_nope", purpose: "Online shopping", limit: 200 }, "CARD_NOT_FOUND"),
      none("card_v9194"),
    ],
  },
  {
    id: "T-22", name: "The bank refuses a sixth virtual card whatever a screen would do", covers: ["AC-9", "AC-1"], persona: "alex", now: NOW, setup: more(4),
    steps: [forced({ cardId: "card_9021", purpose: "Online shopping", limit: 200 }, "VIRTUAL_LIMIT_REACHED"), none("card_v5954")],
  },
  {
    id: "T-23", name: "A card that reached five virtual cards after the review is refused at the code, and no card is made", covers: ["AC-10", "AC-1"], ...base, setup: more(3),
    steps: [
      ...toCode(), { expectBank: { adapter: "bank.otp.verify", input: { code: "482100" }, path: "verified", equals: true } },
      { expectBank: { adapter: "bank.cards.virtual.create", input: { cardId: "card_9021", purpose: "Online shopping", limit: 50 }, path: "status", equals: "Active" } },
      ...code(), screen("card"), text("You have 5 virtual cards on this card, the most you can have. Delete one first."), none("card_v5954"),
    ],
  },
  {
    id: "T-24", name: "A virtual card on Aurora credit is made and shows what it can spend", covers: ["AC-1", "AC-6"], persona: "alex", now: NOW,
    steps: [set({ "vc.cardId": "card_3318" }), press("Continue"), ...purpose("One-time purchase"), ...limit(40), screen("review"), text("Aurora credit ••3318"), text("$40.00 per payment"), press("Continue"), ...code(), screen("done"), text("Single use"), made("card_v9194", "parentCardId", "card_3318"), made("card_v9194", "lineValue", "$40.00")],
  },
  {
    id: "T-25", name: "A purpose has to be chosen", covers: ["AC-5", "AC-1"], ...base,
    steps: [press("Continue"), screen("purpose"), { expectError: "vc.purpose" }],
  },
  {
    id: "T-26", name: "A card that reached five virtual cards after it was chosen is refused at the review, with the bank's words", covers: ["AC-10", "AC-1"], ...base, setup: more(3),
    steps: [
      ...purpose("Online shopping"), screen("limit"),
      { expectBank: { adapter: "bank.otp.verify", input: { code: "482100" }, path: "verified", equals: true } },
      { expectBank: { adapter: "bank.cards.virtual.create", input: { cardId: "card_9021", purpose: "Online shopping", limit: 50 }, path: "status", equals: "Active" } },
      ...limit(200), set({ "vc.life": "3y" }), press("Continue"), screen("card"), text("You have 5 virtual cards on this card, the most you can have. Delete one first."), none("card_v5954"),
    ],
  },
];
