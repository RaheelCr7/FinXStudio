import type { Journey } from "../schema";

/** What must be true for "Card limits and controls" to be right. Each is proved by at least one scenario below. */
export const cardControlsAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "Freezing an active card needs no code and leaves it Frozen with the result \"Card frozen\"." },
  { id: "AC-2", text: "Unfreezing needs a one-time code and leaves the card Active with the result \"Card unfrozen\"." },
  { id: "AC-3", text: "Each limit is checked against its ceiling (on the screen and by the bank) and the order per transaction, daily, monthly (by the bank), with the messages of the spec; the cash field is absent for a card that cannot take cash." },
  { id: "AC-4", text: "Lowering a limit saves without a code; raising any limit asks for a code first." },
  { id: "AC-5", text: "Turning a place off (Contactless, Online, International, Cash machines) saves without a code; turning one on asks for a code." },
  { id: "AC-6", text: "With allowTrip on and International on, a trip needs country, From and To together; the end cannot be before the start or more than 90 days after it, and the start is from today to 120 days ahead; with allowTrip off or International off the trip fields are absent." },
  { id: "AC-7", text: "Alerts never ask for a code; \"Alert me from\" needs an amount from $1 to $100,000 when Large transactions is on." },
  { id: "AC-8", text: "Review lists exactly the changed values as before and after, and says a code is coming when something loosens; with no changes the person cannot continue." },
  { id: "AC-9", text: "A wrong code does not save; three wrong codes end the attempt with nothing changed." },
  { id: "AC-10", text: "A card that is not activated is refused with \"Activate this card first.\", a blocked card or one the bank does not know with their own words; a frozen card offers only Unfreeze." },
  { id: "AC-11", text: "With a cardId the card choice is skipped; with a mode (freeze, unfreeze, limits, where, alerts) the section choice is skipped; \"all\" or an unknown mode asks." },
  { id: "AC-12", text: "When the bank is unavailable or does not answer in time, or the card changed in the meantime, nothing is changed." },
  { id: "AC-13", text: "It needs cards.manage, and the bank itself asks for the code to loosen a card and refuses a card, a limit, a trip or an alert that a screen would not offer." },
];

// Alex Morgan on Tuesday 3 November 2026. Everyday debit ••9021: per transaction 2,000.00, daily 3,000.00, monthly 15,000.00, cash 800.00, every place on, ceilings
// 10,000.00 / 15,000.00 / 50,000.00 / 1,500.00. Aurora credit ••3318: no cash, International off. Spare debit ••7745 is not activated.
const NOW = "2026-11-03T10:00:00Z";
type Step = Record<string, unknown>;
const set = (v: Record<string, unknown>): Step => ({ set: v });
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const error = (m: string): Step => ({ expectError: m });
const toast = (t: string): Step => ({ expectToast: t });
const forced = (input: Record<string, unknown>, c: string): Step => ({ expectBankError: { adapter: "bank.cards.controls.update", input, code: c } });
const card = (path: string, equals: unknown, id = "card_9021"): Step => ({ expectBank: { adapter: "bank.cards.get", input: { cardId: id }, path, equals } });
/** The bank changes the card while the person is on a screen (another device): a call that reads back what it did. */
const elsewhere = (adapter: string, input: Record<string, unknown>, path: string, equals: unknown): Step => ({ expectBank: { adapter, input, path, equals } });
const base = { persona: "alex", now: NOW };
const on = (mode?: string, id = "card_9021") => ({ ...base, launch: { "launch.cardId": id, ...(mode ? { "launch.mode": mode } : {}) } });
const code = (c = "482100"): Step[] => [set({ "otp.code": c }), press("Save changes")];
const frozen: NonNullable<Journey["scenarios"]>[number]["setup"] = [{ adapter: "bank.cards.freeze", input: { cardId: "card_9021" } }];
const trip = { country: "Spain", from: "2026-12-05", to: "2026-12-12" };

export const cardControlsScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "Freeze the Everyday debit: the review says Card Active to Frozen and asks for no code; Save changes gives Card frozen and the bank has it frozen", covers: ["AC-1", "AC-11"], ...on("freeze"),
    steps: [
      screen("review"), text("Everyday debit ••9021"), text("Card"), text("Active → Frozen"), noText("We’ll ask for a code to confirm."), noText("No changes yet."), card("status", "active"),
      press("Save changes"), screen("done"), text("Card frozen"), text("Everyday debit ••9021"), noText("Changes saved"), card("status", "frozen"), card("pill", "Frozen"),
    ],
  },
  {
    id: "T-2", name: "Unfreeze a frozen card: the review says a code is coming, the code asked, Card unfrozen, and the card Active", covers: ["AC-2", "AC-11"], ...on("unfreeze"), setup: frozen,
    steps: [
      screen("review"), text("Frozen → Active"), text("We’ll ask for a code to confirm."), noText("Save changes"), card("status", "frozen"),
      press("Continue"), screen("code"), text("Enter your code"), card("status", "frozen"),
      ...code(), screen("done"), text("Card unfrozen"), noText("Card frozen"), card("status", "active"),
    ],
  },
  {
    id: "T-3", name: "Each limit is checked against its ceiling on the screen, with the bank's amounts in the message", covers: ["AC-3"], ...on("limits"),
    steps: [
      screen("limits"), text("Up to $10,000.00"), text("Up to $15,000.00"), text("Up to $50,000.00"), text("Up to $1,500.00"),
      set({ "cc.lim.perTx": 20000 }), press("Continue"), screen("limits"), error("The most is $10,000.00."),
      set({ "cc.lim.perTx": 2000, "cc.lim.daily": 16000 }), press("Continue"), error("The most is $15,000.00."),
      set({ "cc.lim.daily": 3000, "cc.lim.monthly": 60000 }), press("Continue"), error("The most is $50,000.00."),
      set({ "cc.lim.monthly": 15000, "cc.lim.cash": 2000 }), press("Continue"), error("The most is $1,500.00."),
      set({ "cc.lim.cash": 800 }), press("Continue"), screen("review"), card("limits.perTransaction", 2000),
    ],
  },
  {
    id: "T-4", name: "The bank checks the order: per transaction above daily, and daily above monthly, each with its words, and nothing is changed", covers: ["AC-3"], ...on("limits"),
    steps: [
      set({ "cc.lim.perTx": 3500 }), press("Continue"), screen("limits"), text("Can’t be more than the daily limit."), noText("The most is"),
      set({ "cc.lim.perTx": 2000, "cc.lim.daily": 15000, "cc.lim.monthly": 12000 }), press("Continue"), screen("limits"), text("Can’t be more than the monthly limit."), noText("Can’t be more than the daily limit."),
      card("limits.dailyPurchases", 3000), card("limits.monthly", 15000),
      set({ "cc.lim.monthly": 15000 }), press("Continue"), screen("review"), text("Daily"), text("$3,000.00 → $15,000.00"),
    ],
  },
  {
    id: "T-5", name: "The credit card has no cash field and its own ceilings", covers: ["AC-3"], ...on("limits", "card_3318"),
    steps: [screen("limits"), text("Aurora credit ••3318"), text("Per transaction"), text("Up to $5,000.00"), text("Up to $20,000.00"), noText("Cash withdrawal, daily"), noText("Up to $1,500.00"), set({ "cc.lim.perTx": 6000 }), press("Continue"), error("The most is $5,000.00.")],
  },
  {
    id: "T-6", name: "Lowering the daily limit to 2,500.00 saves without a code: Daily $3,000.00 to $2,500.00, Changes saved", covers: ["AC-4", "AC-8"], ...on("limits"),
    steps: [
      set({ "cc.lim.daily": 2500 }), press("Continue"), screen("review"), text("Daily"), text("$3,000.00 → $2,500.00"), noText("We’ll ask for a code to confirm."), noText("Per transaction"), noText("Monthly"),
      press("Save changes"), screen("done"), text("Changes saved"), text("Daily"), text("$3,000.00 → $2,500.00"), card("limits.dailyPurchases", 2500), card("limits.monthly", 15000),
    ],
  },
  {
    id: "T-7", name: "Raising the daily limit to 4,000.00 asks for a code first, and saves only after it", covers: ["AC-4"], ...on("limits"),
    steps: [
      set({ "cc.lim.daily": 4000 }), press("Continue"), text("$3,000.00 → $4,000.00"), text("We’ll ask for a code to confirm."), noText("Save changes"), card("limits.dailyPurchases", 3000),
      press("Continue"), screen("code"), card("limits.dailyPurchases", 3000), ...code(), screen("done"), text("Changes saved"), card("limits.dailyPurchases", 4000),
    ],
  },
  {
    id: "T-8", name: "Turning Online off saves without a code", covers: ["AC-5"], ...on("where"),
    steps: [
      screen("where"), text("Contactless"), text("Online"), text("International"), text("Cash machines"),
      set({ "cc.where.online": false }), press("Continue"), screen("review"), text("Online"), text("On → Off"), noText("We’ll ask for a code to confirm."),
      press("Save changes"), screen("done"), text("Changes saved"), card("controls.online", false), card("controls.contactless", true),
    ],
  },
  {
    id: "T-9", name: "Turning Online on again asks for a code", covers: ["AC-5"], ...on("where"), setup: [{ adapter: "bank.cards.controls.update", input: { cardId: "card_9021", controls: { online: false } } }],
    steps: [
      set({ "cc.where.online": true }), press("Continue"), text("Off → On"), text("We’ll ask for a code to confirm."), press("Continue"), screen("code"), card("controls.online", false),
      ...code(), screen("done"), card("controls.online", true),
    ],
  },
  {
    id: "T-10", name: "Cash machines, Contactless and International each follow the same rule; the credit card has no Cash machines switch", covers: ["AC-5", "AC-3"], ...on("where", "card_3318"),
    steps: [screen("where"), noText("Cash machines"), text("International"), set({ "cc.where.abroad": true }), press("Continue"), text("International"), text("Off → On"), text("We’ll ask for a code to confirm.")],
  },
  {
    id: "T-11", name: "A trip needs the country and both dates, no more than 90 days, and a start from today to 120 days ahead: the bank's words above the fields", covers: ["AC-6"], ...on("where"),
    steps: [
      screen("where"), text("Country (optional)"), text("Start date"), text("End date"),
      set({ "cc.trip.country": "Spain" }), press("Continue"), screen("where"), text("Add the country and both dates, or clear them."),
      set({ "cc.trip.from": "2026-12-01", "cc.trip.to": "2027-03-12" }), press("Continue"), text("A trip can last up to 90 days."), noText("Add the country and both dates"),
      set({ "cc.trip.from": "2027-03-20", "cc.trip.to": "2027-03-25" }), press("Continue"), text("Choose dates from today to 120 days ahead."),
      card("hasTrip", false),
    ],
  },
  {
    id: "T-12", name: "The end of a trip before its start is refused on the screen; a valid trip shows Trip None to the country and the dates, asks for a code and is saved after it", covers: ["AC-6", "AC-8"], ...on("where"),
    steps: [
      set({ "cc.trip.country": "Spain", "cc.trip.from": "2026-12-12", "cc.trip.to": "2026-12-05" }), press("Continue"), screen("where"), error("The end date is before the start date."),
      set({ "cc.trip.from": "2026-12-05", "cc.trip.to": "2026-12-12" }), press("Continue"), screen("review"), text("Trip"), text("None → Spain, 5 Dec to 12 Dec"), text("We’ll ask for a code to confirm."),
      press("Continue"), ...code(), screen("done"), text("Spain, 5 Dec to 12 Dec"), card("trip.country", "Spain"), card("trip.to", "2026-12-12"),
    ],
  },
  {
    id: "T-13", name: "With allowTrip off, or International off, the trip fields are absent; turning International off removes a trip", covers: ["AC-6"], ...on("where"), launch: { "launch.cardId": "card_9021", "launch.mode": "where", "opt.allowTrip": false },
    steps: [screen("where"), text("International"), noText("Country (optional)"), noText("Start date"), noText("End date")],
  },
  {
    id: "T-14", name: "International off hides the trip fields, and a trip already on the card goes with it", covers: ["AC-6", "AC-5"], ...on("where"), setup: [
      { adapter: "bank.otp.send" }, { adapter: "bank.otp.verify", input: { code: "482100" } }, { adapter: "bank.cards.controls.update", input: { cardId: "card_9021", trip } },
    ],
    steps: [
      text("Spain"), text("Start date"), set({ "cc.where.abroad": false }), noText("Country (optional)"), noText("Start date"),
      press("Continue"), screen("review"), text("International"), text("On → Off"), text("Trip"), text("Spain, 5 Dec to 12 Dec → None"), noText("We’ll ask for a code to confirm."),
      press("Save changes"), card("hasTrip", false), card("controls.abroad", false),
    ],
  },
  {
    id: "T-15", name: "The alert amount needs 1.00 to 100,000.00 when Large transactions is on", covers: ["AC-7"], ...on("alerts"),
    steps: [
      screen("alerts"), noText("Alert me from"), set({ "cc.alert.large": true }), text("Alert me from"),
      set({ "cc.alert.from": 0.5 }), press("Continue"), screen("alerts"), error("Enter an amount above zero."),
      set({ "cc.alert.from": 100001 }), press("Continue"), error("The most is $100,000.00."),
      set({ "cc.alert.from": 250 }), press("Continue"), screen("review"),
    ],
  },
  {
    id: "T-16", name: "Alerts save without a code: Online purchases Off to On and Large transactions from $250.00", covers: ["AC-7", "AC-8"], ...on("alerts"),
    steps: [
      set({ "cc.alert.large": true, "cc.alert.from": 250, "cc.alert.online": true }), press("Continue"), screen("review"),
      text("Large transactions"), text("Off → On"), text("Alert me from"), text("$500.00 → $250.00"), text("Online purchases"), noText("Every transaction"), noText("We’ll ask for a code to confirm."),
      press("Save changes"), screen("done"), text("Changes saved"), card("alerts.online", true), card("alerts.largeFrom", 250), card("alerts.every", false),
    ],
  },
  {
    id: "T-17", name: "With nothing edited the review says No changes yet and You haven't changed anything yet, with no way to save", covers: ["AC-8"], ...on("limits"),
    steps: [press("Continue"), screen("review"), text("No changes yet."), text("You haven’t changed anything yet."), noText("Save changes"), noText("Continue"), noText("We’ll ask for a code to confirm."), card("limits.dailyPurchases", 3000)],
  },
  {
    id: "T-18", name: "Back from the review returns to the section being changed", covers: ["AC-8"], ...on("limits"),
    steps: [set({ "cc.lim.daily": 2500 }), press("Continue"), screen("review"), press("Back"), screen("limits"), press("Continue"), press("Back"), screen("limits")],
  },
  {
    id: "T-19", name: "Back from the review of a freeze returns to the choice of what to change", covers: ["AC-8"], ...on("freeze"),
    steps: [screen("review"), press("Back"), screen("what"), text("What do you want to change?"), text("Freeze card")],
  },
  {
    id: "T-20", name: "Back from the review of Where it works returns to it", covers: ["AC-8"], ...on("where"),
    steps: [set({ "cc.where.online": false }), press("Continue"), press("Back"), screen("where"), set({ "cc.where.online": true }), press("Continue"), press("Back"), screen("where")],
  },
  {
    id: "T-21", name: "Back from the review of Alerts returns to Alerts, listing what was changed", covers: ["AC-8"], ...on("alerts"),
    steps: [set({ "cc.alert.every": true }), press("Continue"), screen("review"), text("Every transaction"), press("Back"), screen("alerts")],
  },
  {
    id: "T-22", name: "A wrong code does not save; the right one does", covers: ["AC-9"], ...on("unfreeze"), setup: frozen,
    steps: [press("Continue"), ...code("111111"), toast("That code isn’t right. Try again."), screen("code"), card("status", "frozen"), ...code(), screen("done"), card("status", "active")],
  },
  {
    id: "T-23", name: "Three wrong codes end the attempt: Too many wrong codes, nothing changed, the card still Frozen", covers: ["AC-9"], ...on("unfreeze"), setup: frozen,
    steps: [
      press("Continue"), ...code("111111"), ...code("111111"), ...code("111111"), screen("locked"), text("Too many wrong codes"), text("Too many wrong codes. Nothing was changed. Go back to start again."),
      card("status", "frozen"), press("Back to start"), screen("review"),
    ],
  },
  {
    id: "T-24", name: "An empty code is not sent", covers: ["AC-9"], ...on("unfreeze"), setup: frozen,
    steps: [press("Continue"), press("Save changes"), screen("code"), error("otp.code"), card("status", "frozen")],
  },
  {
    id: "T-25", name: "A card that is not activated says to activate it first, from the card step and when opened with it", covers: ["AC-10"], ...base,
    steps: [set({ "cc.cardId": "card_7745" }), press("Continue"), screen("pick"), text("Activate this card first."), noText("What do you want to change?")],
  },
  {
    id: "T-26", name: "Opened with a card that is not activated it says so on the card step", covers: ["AC-10"], ...on("limits", "card_7745"),
    steps: [screen("pick"), text("Activate this card first.")],
  },
  {
    id: "T-27", name: "A blocked card cannot be changed and an unknown card is not found", covers: ["AC-10"], ...base, setup: [{ adapter: "bank.cards.block", input: { cardId: "card_3318", reason: "lost" } }],
    steps: [
      set({ "cc.cardId": "card_3318" }), press("Continue"), screen("pick"), text("This card can’t be changed."), noText("Activate this card first."),
      set({ "cc.cardId": "card_nope" }), press("Continue"), text("We can’t find that card."), noText("This card can’t be changed."),
      set({ "cc.cardId": "card_9021" }), press("Continue"), screen("what"),
    ],
  },
  {
    id: "T-28", name: "A frozen card offers only Unfreeze card", covers: ["AC-10", "AC-11"], ...on(undefined), setup: frozen,
    steps: [screen("what"), text("Unfreeze card"), noText("Stop it being used"), noText("Spending limits"), noText("Where it works"), noText("Alerts"), set({ "cc.mode": "unfreeze" }), press("Continue"), screen("review"), text("Frozen → Active")],
  },
  {
    id: "T-29", name: "A frozen card opened for its limits still offers only Unfreeze", covers: ["AC-10", "AC-11"], ...on("limits"), setup: frozen,
    steps: [screen("what"), text("Unfreeze card"), noText("Spending limits")],
  },
  {
    id: "T-30", name: "An active card opened to unfreeze asks what to change instead", covers: ["AC-10", "AC-11"], ...on("unfreeze"),
    steps: [screen("what"), text("Freeze card"), noText("Unfreeze card")],
  },
  {
    id: "T-31", name: "With a card and no mode it asks what to change; the first choice leads to its section", covers: ["AC-11"], ...on(undefined),
    steps: [screen("what"), text("Freeze card"), text("Spending limits"), text("Where it works"), text("Alerts"), set({ "cc.mode": "alerts" }), press("Continue"), screen("alerts")],
  },
  {
    id: "T-32", name: "Choosing Spending limits leads to the limits", covers: ["AC-11"], ...on(undefined),
    steps: [
      set({ "cc.mode": "limits" }), press("Continue"), screen("limits"), press("Continue"), press("Back"), screen("limits"),
    ],
  },
  {
    id: "T-33", name: "Choosing Where it works leads to it", covers: ["AC-11"], ...on(undefined),
    steps: [set({ "cc.mode": "where" }), press("Continue"), screen("where")],
  },
  {
    id: "T-34", name: "Choosing Freeze card leads to the review without a code", covers: ["AC-11", "AC-1"], ...on(undefined),
    steps: [set({ "cc.mode": "freeze" }), press("Continue"), screen("review"), text("Active → Frozen"), press("Save changes"), text("Card frozen")],
  },
  {
    id: "T-35", name: "Without a card it asks which, offers every card that is not replaced, and starts with the first that can be changed", covers: ["AC-11"], ...base,
    steps: [screen("pick"), text("Everyday debit ••9021"), text("Aurora credit ••3318"), text("Spare debit ••7745"), text("Online shopping ••6150"), press("Continue"), screen("what"), text("Everyday debit ••9021")],
  },
  {
    id: "T-36", name: "\"all\" and an unknown mode ask what to change; a virtual card can be changed too", covers: ["AC-11"], ...on("all", "card_6150"),
    steps: [screen("what"), text("Online shopping ••6150"), text("Freeze card")],
  },
  {
    id: "T-37", name: "An unknown mode is ignored", covers: ["AC-11"], ...on("sideways"),
    steps: [screen("what")],
  },
  {
    id: "T-38", name: "Nothing chosen is refused on the card step and on the question", covers: ["AC-11"], ...base,
    steps: [set({ "cc.cardId": "" }), press("Continue"), screen("pick"), error("cc.cardId"), set({ "cc.cardId": "card_9021" }), press("Continue"), screen("what"), set({ "cc.mode": "" }), press("Continue"), screen("what"), error("cc.mode")],
  },
  {
    id: "T-39", name: "When the bank is unavailable at the review of a freeze nothing is changed", covers: ["AC-12"], ...on("freeze"), conditions: { unavailable: ["bank.cards.controls.update"] },
    steps: [screen("unavailable"), text("This isn’t available right now. Nothing was changed. Try again in a few minutes."), card("status", "active")],
  },
  {
    id: "T-40", name: "When the bank does not answer in time at the review of a freeze nothing is changed", covers: ["AC-12"], ...on("freeze"), conditions: { timeout: ["bank.cards.controls.update"], latencyMs: 10000 },
    steps: [screen("timeout"), text("This is taking longer than expected. Nothing was changed."), card("status", "active"), press("Try again"), screen("timeout")],
  },
  {
    id: "T-41", name: "When the bank is unavailable on the limits step nothing is changed", covers: ["AC-12"], ...on("limits"), conditions: { unavailable: ["bank.cards.controls.update"] },
    steps: [set({ "cc.lim.daily": 2500 }), press("Continue"), screen("unavailable"), card("limits.dailyPurchases", 3000)],
  },
  {
    id: "T-42", name: "When the bank is unavailable on the where step nothing is changed", covers: ["AC-12"], ...on("where"), conditions: { unavailable: ["bank.cards.controls.update"] },
    steps: [set({ "cc.where.online": false }), press("Continue"), screen("unavailable"), card("controls.online", true)],
  },
  {
    id: "T-43", name: "When the bank does not answer in time on the alerts step nothing is changed", covers: ["AC-12"], ...on("alerts"), conditions: { timeout: ["bank.cards.controls.update"], latencyMs: 10000 },
    steps: [set({ "cc.alert.every": true }), press("Continue"), screen("timeout"), card("alerts.every", false)],
  },
  {
    id: "T-44", name: "When the code cannot be sent nothing is changed", covers: ["AC-12"], ...on("unfreeze"), setup: frozen, conditions: { unavailable: ["bank.otp.send"] },
    steps: [screen("review"), press("Continue"), screen("unavailable"), card("status", "frozen")],
  },
  {
    id: "T-45", name: "When the cards cannot be read nothing starts", covers: ["AC-12"], ...base, conditions: { unavailable: ["bank.cards.eligible"] },
    steps: [screen("unavailable"), text("Nothing was changed.")],
  },
  {
    id: "T-46", name: "When the card cannot be read in time nothing is changed", covers: ["AC-12"], ...on("freeze"), conditions: { timeout: ["bank.cards.get"], latencyMs: 10000 },
    steps: [screen("timeout"), text("This is taking longer than expected. Nothing was changed."), { expectBank: { adapter: "bank.cards.issued", path: "card_9021.status", equals: "active" } }],
  },
  {
    id: "T-47", name: "A card that was blocked while the review was open is refused on saving, and nothing is changed", covers: ["AC-12", "AC-10"], ...on("limits"),
    steps: [
      set({ "cc.lim.daily": 2500 }), press("Continue"), screen("review"),
      elsewhere("bank.cards.block", { cardId: "card_9021", reason: "lost" }, "status", "blocked"),
      press("Save changes"), screen("pick"), text("This card can’t be changed."), card("limits.dailyPurchases", 3000),
    ],
  },
  {
    id: "T-48", name: "A card that was blocked while the code was being typed is refused on saving, after the right code, and nothing is changed", covers: ["AC-12", "AC-9"], ...on("unfreeze"), setup: frozen,
    steps: [
      press("Continue"), screen("code"), elsewhere("bank.cards.block", { cardId: "card_9021", reason: "lost" }, "status", "blocked"),
      ...code(), screen("pick"), text("This card can’t be changed."), card("pill", "Blocked"),
    ],
  },
  {
    id: "T-49", name: "Without cards.manage it is not available, and the bank refuses", covers: ["AC-13"], ...on("freeze"), conditions: { withoutPermissions: ["cards.manage"] },
    steps: [screen("denied"), text("Not available"), forced({ cardId: "card_9021", status: "frozen" }, "PERMISSION_DENIED"), card("status", "active")],
  },
  {
    id: "T-50", name: "The bank asks for the code to raise a limit, turn a place on or add a trip, whatever a screen would do", covers: ["AC-13", "AC-4"], ...base, setup: [{ adapter: "bank.cards.controls.update", input: { cardId: "card_9021", controls: { online: false } } }],
    steps: [
      forced({ cardId: "card_9021", limits: { dailyPurchases: 4000 } }, "OTP_REQUIRED"), forced({ cardId: "card_9021", controls: { online: true } }, "OTP_REQUIRED"),
      forced({ cardId: "card_9021", trip }, "OTP_REQUIRED"), card("limits.dailyPurchases", 3000), card("controls.online", false), card("hasTrip", false),
    ],
  },
  {
    id: "T-51", name: "The bank refuses unfreezing without the code", covers: ["AC-13", "AC-2"], ...base, setup: frozen,
    steps: [forced({ cardId: "card_9021", status: "active" }, "OTP_REQUIRED"), forced({ cardId: "card_9021", limits: { dailyPurchases: 2500 } }, "CARD_FROZEN"), card("status", "frozen")],
  },
  {
    id: "T-52", name: "The bank refuses a limit above its ceiling, a negative one, one with odd decimals and limits out of order", covers: ["AC-13", "AC-3"], ...base,
    steps: [
      forced({ cardId: "card_9021", limits: { perTransaction: 20000 } }, "LIMIT_ABOVE_CEILING"), forced({ cardId: "card_9021", limits: { dailyPurchases: 16000 } }, "LIMIT_ABOVE_CEILING"),
      forced({ cardId: "card_9021", limits: { monthly: 60000 } }, "LIMIT_ABOVE_CEILING"), forced({ cardId: "card_9021", limits: { dailyAtm: 2000 } }, "LIMIT_ABOVE_CEILING"),
      forced({ cardId: "card_9021", limits: { perTransaction: -1 } }, "LIMIT_INVALID"), forced({ cardId: "card_9021", limits: { perTransaction: 12.345 } }, "LIMIT_INVALID"),
      forced({ cardId: "card_9021", limits: { perTransaction: 3500 } }, "LIMIT_INVALID"), forced({ cardId: "card_9021", limits: { dailyPurchases: 15000, monthly: 12000 } }, "LIMIT_INVALID"),
      forced({ cardId: "card_3318", limits: { dailyAtm: 100 } }, "LIMIT_ABOVE_CEILING"), card("limits.perTransaction", 2000), card("limits.dailyPurchases", 3000),
    ],
  },
  {
    id: "T-53", name: "The bank refuses a trip with a missing part, dates out of order, over 90 days, out of the window, or on a card where International is off", covers: ["AC-13", "AC-6"], ...base,
    steps: [
      forced({ cardId: "card_9021", trip: { country: "Spain", from: "", to: "" } }, "TRIP_INVALID"), forced({ cardId: "card_9021", trip: { country: "Spain", from: "2026-12-12", to: "2026-12-05" } }, "TRIP_INVALID"),
      forced({ cardId: "card_9021", trip: { country: "Spain", from: "2026-12-01", to: "2027-03-12" } }, "TRIP_INVALID"), forced({ cardId: "card_9021", trip: { country: "Spain", from: "2027-03-20", to: "2027-03-25" } }, "TRIP_INVALID"),
      forced({ cardId: "card_9021", trip: { country: "Spain", from: "2026-11-01", to: "2026-11-05" } }, "TRIP_INVALID"), forced({ cardId: "card_3318", trip }, "TRIP_INVALID"), card("hasTrip", false),
    ],
  },
  {
    id: "T-54", name: "The bank refuses an alert amount below 1.00 or above 100,000.00, and a card that is not activated, blocked or unknown", covers: ["AC-13", "AC-7", "AC-10"], ...base,
    steps: [
      forced({ cardId: "card_9021", alerts: { large: true, largeFrom: 0 } }, "ALERT_INVALID"), forced({ cardId: "card_9021", alerts: { large: true, largeFrom: 100001 } }, "ALERT_INVALID"),
      forced({ cardId: "card_7745", controls: { online: false } }, "CARD_NOT_ACTIVATED"), forced({ cardId: "card_nope", controls: { online: false } }, "CARD_NOT_FOUND"),
      forced({ cardId: "card_9021", limits: { dailyPurchases: 3000 } }, "NOTHING_CHANGED"), card("alerts.large", false),
    ],
  },
  {
    id: "T-55", name: "The bank refuses a blocked card whatever a screen would offer", covers: ["AC-13", "AC-10"], ...base, setup: [{ adapter: "bank.cards.block", input: { cardId: "card_3318", reason: "lost" } }],
    steps: [forced({ cardId: "card_3318", controls: { online: false } }, "CARD_NOT_ACTIVE"), card("status", "blocked", "card_3318")],
  },
  {
    id: "T-56", name: "A change that the bank now sees as loosening (another device lowered the limit after the review) asks for the code instead of saving: the person is sent back to the section", covers: ["AC-4", "AC-12"], ...on("limits"),
    steps: [
      set({ "cc.lim.daily": 2500 }), press("Continue"), screen("review"), text("$3,000.00 → $2,500.00"), noText("We’ll ask for a code to confirm."),
      elsewhere("bank.cards.controls.update", { cardId: "card_9021", limits: { perTransaction: 1000, dailyPurchases: 2000 } }, "kind", "changes"),
      press("Save changes"), screen("limits"), card("limits.dailyPurchases", 2000),
      press("Continue"), text("$2,000.00 → $2,500.00"), text("We’ll ask for a code to confirm."),
    ],
  },
];
