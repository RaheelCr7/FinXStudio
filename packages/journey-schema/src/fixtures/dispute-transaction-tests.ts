import type { Journey } from "../schema";

/** What must be true for "Report a problem with a payment" to be right. Each is proved by at least one scenario below. */
export const disputeTransactionAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "Only a posted card payment out, at most 120 days old and not already reported, can be reported, with the bank's words as the notice." },
  { id: "AC-2", text: "The details asked depend on the reason, with the validations of the spec." },
  { id: "AC-3", text: "\"I don’t recognise it\" offers to block the card when offerBlock is on and the card is active; answering No to \"Do you still have your card?\" turns the block on." },
  { id: "AC-4", text: "The evidence step appears only when allowEvidence is on, and is optional." },
  { id: "AC-5", text: "The report cannot be sent until the declaration is ticked." },
  { id: "AC-6", text: "Sending creates one case, marks the payment as reported and shows \"Report received\" with the case reference and the three next steps." },
  { id: "AC-7", text: "A second report for the same payment is refused with the case reference." },
  { id: "AC-8", text: "With the block on the card becomes Blocked and the result says so." },
  { id: "AC-9", text: "When the bank is unavailable or does not answer in time nothing is sent." },
  { id: "AC-10", text: "It moves no money and asks for no code; it needs cards.dispute, and the bank itself refuses a payment, a reason or details that a screen would not offer." },
];

// Alex Morgan on Tuesday 3 November 2026. Everyday debit ••9021: ct_1 Northwind Market -64.20, ct_2 Skyline Travel Co. -420.00 (online), ct_3 Brightside Coffee -4.80 (pending),
// ct_4 Harbor Fuel -45.00, ct_5 Old Bookshop -18.00 (119 days ago), ct_6 Past Travel -75.00 (130 days ago), ct_7 a refund of 35.00, ct_8 a cash machine withdrawal of 100.00.
const NOW = "2026-11-03T10:00:00Z";
type Step = Record<string, unknown>;
const set = (v: Record<string, unknown>): Step => ({ set: v });
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const error = (m: string): Step => ({ expectError: m });
const NONE = "I don’t recognise it", TWICE = "Charged twice", AMOUNT = "Wrong amount", GOODS = "Goods or service not received", CANCELLED = "Cancelled but charged", OTHER = "Other";
const forced = (input: Record<string, unknown>, c: string): Step => ({ expectBankError: { adapter: "bank.disputes.create", input: { cardId: "card_9021", transactionId: "ct_1", reason: TWICE, details: { otherChargeDate: "2026-10-30" }, ...input }, code: c } });
const card = (path: string, equals: unknown): Step => ({ expectBank: { adapter: "bank.cards.get", input: { cardId: "card_9021" }, path, equals } });
const payment = (path: string, equals: unknown): Step => ({ expectBank: { adapter: "bank.cards.transactions", input: { cardId: "card_9021" }, path, equals } });
const balance = (): Step => ({ expectBank: { adapter: "bank.accounts.get", input: { accountId: "acc_main" }, path: "balance", equals: 8720.76 } });
const base = { persona: "alex", now: NOW };
const on = (tx: string) => ({ ...base, launch: { "launch.cardId": "card_9021", "launch.transactionId": tx } });
const ct1 = on("ct_1");
const reason = (r: string): Step[] => [set({ "ds.reason": r }), press("Continue")];
/** From the details to the confirm screen with the evidence step in between. */
const toDeclare = (): Step[] => [press("Continue"), screen("evidence"), press("Continue"), screen("declare")];
const send = (): Step[] => [set({ "ds.consent": true }), press("Send report")];
/** A report of Charged twice, ready to send. */
const twice = (): Step[] => [...reason(TWICE), set({ "ds.otherDate": "2026-10-30" }), ...toDeclare()];
const dispute = (tx: string, reasonName = TWICE, details: Record<string, unknown> = { otherChargeDate: "2026-10-30" }) => ({ adapter: "bank.disputes.create", input: { cardId: "card_9021", transactionId: tx, reason: reasonName, details } });

export const disputeTransactionScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "Charged twice on Northwind Market: Report received, Under review, a case reference and the three next steps; the payment is marked reported and no money moves", covers: ["AC-1", "AC-2", "AC-5", "AC-6", "AC-10"], ...ct1,
    steps: [
      screen("reason"), text("What went wrong?"), text("Northwind Market"), text("−$64.20"), ...reason(TWICE), screen("details"), set({ "ds.otherDate": "2026-10-30" }), press("Continue"), screen("evidence"), text("Add evidence"),
      press("Continue"), screen("declare"), text("Confirm and send"), text("Northwind Market"), text("Charged twice"), text("None"), noText("Block this card"), ...send(),
      screen("done"), text("Report received"), text("We’ll keep you updated in your messages."), text("Under review"), text("DSP-9001"),
      text("Within 2 working days"), text("We review your report"), text("Within 10 working days"), text("We ask the merchant"), text("Within 45 days"), text("You get our decision"), noText("Blocked"),
      payment("items.1.status", "disputed"), payment("items.1.disputeId", "DSP-9001"), balance(), card("status", "active"),
    ],
  },
  {
    id: "T-2", name: "Chosen from the list of card payments: out of the latest posted ones; a refund, a cash machine, a payment 130 days old are each refused with the bank's words; 119 days is allowed", covers: ["AC-1"], ...base,
    steps: [
      screen("pick"), text("Which payment?"), text("Northwind Market · −$64.20 · Yesterday"), text("Old Bookshop · −$18.00"), noText("Brightside Coffee"),
      press("Continue"), screen("pick"), error("Required"),
      set({ "ds.txId": "ct_7" }), press("Continue"), screen("pick"), text("Only payments out can be reported."),
      set({ "ds.txId": "ct_8" }), press("Continue"), text("This payment can’t be reported here. Contact us."), noText("Only payments out can be reported."),
      set({ "ds.txId": "ct_6" }), press("Continue"), text("It’s been more than 120 days since this payment. Contact us."),
      set({ "ds.txId": "ct_5" }), press("Continue"), screen("reason"), text("Old Bookshop"),
    ],
  },
  {
    id: "T-3", name: "A payment that is still pending says so and goes no further", covers: ["AC-1"], ...on("ct_3"),
    steps: [screen("pick"), text("This payment is still pending. You can report a problem once it has posted."), noText("What went wrong?")],
  },
  {
    id: "T-4", name: "A payment the bank does not know is not found", covers: ["AC-1"], ...on("ct_nope"),
    steps: [screen("pick"), text("We can’t find that payment.")],
  },
  {
    id: "T-5", name: "Wrong amount: the amount you expected cannot be the amount charged", covers: ["AC-2"], ...ct1,
    steps: [
      ...reason(AMOUNT), press("Continue"), screen("details"), error("Required"),
      set({ "ds.expected": 64.2 }), press("Continue"), screen("details"), text("This is the amount that was charged."),
      set({ "ds.expected": 50 }), press("Continue"), screen("evidence"), noText("This is the amount that was charged."),
    ],
  },
  {
    id: "T-6", name: "Other: at least 10 characters", covers: ["AC-2"], ...ct1,
    steps: [
      ...reason(OTHER), set({ "ds.text": "short" }), press("Continue"), screen("details"), error("Tell us a little more (at least 10 characters)."),
      set({ "ds.text": "The shop charged me after I returned it." }), press("Continue"), screen("evidence"),
    ],
  },
  {
    id: "T-7", name: "Goods or service not received: what you ordered, when it should have arrived, whether you contacted the merchant, with the hint after Not yet", covers: ["AC-2"], ...ct1,
    steps: [
      ...reason(GOODS), set({ "ds.ordered": "ab", "ds.arrivedBy": "2026-10-20", "ds.contacted": "Not yet" }), text("If you can, contact the merchant first. You can still send this report."),
      press("Continue"), screen("details"), error("Tell us what you ordered."),
      set({ "ds.ordered": "A pair of shoes", "ds.contacted": "Yes" }), noText("If you can, contact the merchant first."), press("Continue"), screen("evidence"),
    ],
  },
  {
    id: "T-8", name: "Goods or service not received: the date and whether you contacted the merchant have to be chosen", covers: ["AC-2"], ...ct1,
    steps: [...reason(GOODS), set({ "ds.ordered": "A parcel" }), press("Continue"), screen("details"), error("Required")],
  },
  {
    id: "T-9", name: "Cancelled but charged: when you cancelled is needed, the reference is optional and up to 30 characters", covers: ["AC-2"], ...ct1,
    steps: [
      ...reason(CANCELLED), press("Continue"), screen("details"), error("Required"),
      set({ "ds.cancelledOn": "2026-10-01", "ds.cancelRef": "A reference that is far longer than thirty characters" }), press("Continue"), screen("details"), error("Use up to 30 characters."),
      set({ "ds.cancelRef": "CX-1234" }), press("Continue"), screen("evidence"),
    ],
  },
  {
    id: "T-10", name: "Charged twice needs the date of the other charge; not recognised needs an answer about the card", covers: ["AC-2"], ...ct1,
    steps: [...reason(TWICE), press("Continue"), screen("details"), error("Required"), press("Back"), ...reason(NONE), press("Continue"), screen("details"), error("Required")],
  },
  {
    id: "T-11", name: "Not recognised and No card any more: the block is on, the review says the card will be blocked, and after sending the card is Blocked", covers: ["AC-3", "AC-8"], ...ct1,
    steps: [
      ...reason(NONE), text("Do you still have your card?"), set({ "ds.possess": "No" }), ...toDeclare(), text("Block this card"), text("Will be blocked"), ...send(),
      screen("done"), text("Report received"), text("Card"), text("Blocked"), card("status", "blocked"), card("pill", "Blocked"),
    ],
  },
  {
    id: "T-12", name: "Not recognised but the card is still held: the block is offered, off unless chosen, and the card stays active", covers: ["AC-3", "AC-8"], ...ct1,
    steps: [...reason(NONE), set({ "ds.possess": "Yes" }), ...toDeclare(), text("Block this card"), noText("Will be blocked"), ...send(), screen("done"), noText("Blocked"), card("status", "active")],
  },
  {
    id: "T-13", name: "The block can be chosen on the last screen for a card that is still held", covers: ["AC-3", "AC-8"], ...ct1,
    steps: [...reason(NONE), set({ "ds.possess": "Yes" }), ...toDeclare(), set({ "ds.block": true }), text("Will be blocked"), ...send(), screen("done"), text("Blocked"), card("status", "blocked")],
  },
  {
    id: "T-14", name: "With offerBlock off there is no switch and the card is not blocked, even answering No", covers: ["AC-3"], launch: { "launch.cardId": "card_9021", "launch.transactionId": "ct_1", "opt.offerBlock": false }, ...{ persona: "alex", now: NOW },
    steps: [...reason(NONE), set({ "ds.possess": "No" }), ...toDeclare(), noText("Block this card"), noText("Will be blocked"), ...send(), screen("done"), noText("Blocked"), card("status", "active")],
  },
  {
    id: "T-15", name: "A card that is not active has no block switch, and the report is still sent", covers: ["AC-3"], ...ct1, setup: [{ adapter: "bank.cards.freeze", input: { cardId: "card_9021" } }],
    steps: [...reason(NONE), set({ "ds.possess": "No" }), ...toDeclare(), noText("Block this card"), noText("Will be blocked"), ...send(), screen("done"), text("Report received"), noText("Blocked"), card("status", "frozen")],
  },
  {
    id: "T-16", name: "Evidence is optional: Continue without a file says None; a PDF or an image is named on the confirm screen; another kind of file is refused", covers: ["AC-4"], ...ct1,
    steps: [
      ...reason(TWICE), set({ "ds.otherDate": "2026-10-30" }), press("Continue"), screen("evidence"), text("Optional. A receipt, order email or screenshot helps."), text("Add a file"),
      set({ "ds.file": { name: "notes.exe", size: 2048, kind: "pdf" } }), press("Continue"), screen("evidence"), error("ds.file"),
      set({ "ds.file": { name: "Receipt.pdf", size: 2048, kind: "pdf" } }), press("Continue"), screen("declare"), text("Receipt.pdf"), noText("None"),
    ],
  },
  {
    id: "T-17", name: "With allowEvidence off the evidence step is absent", covers: ["AC-4"], launch: { "launch.cardId": "card_9021", "launch.transactionId": "ct_1", "opt.allowEvidence": false }, ...{ persona: "alex", now: NOW },
    steps: [...reason(TWICE), set({ "ds.otherDate": "2026-10-30" }), press("Continue"), screen("declare"), noText("Add a file")],
  },
  {
    id: "T-18", name: "Sending without the tick is refused, and nothing is sent", covers: ["AC-5"], ...ct1,
    steps: [...twice(), press("Send report"), screen("declare"), error("Please confirm to continue."), payment("items.1.status", "posted")],
  },
  {
    id: "T-19", name: "A payment reported before is refused with its case reference, and the bank refuses a second report", covers: ["AC-7"], ...ct1, setup: [dispute("ct_1")],
    steps: [screen("pick"), text("You’ve already reported this payment. Case DSP-9001."), noText("What went wrong?"), forced({}, "DISPUTE_EXISTS")],
  },
  {
    id: "T-20", name: "When the bank is unavailable when the report is sent nothing is sent", covers: ["AC-9"], ...ct1, conditions: { unavailable: ["bank.disputes.create"] },
    steps: [...twice(), ...send(), screen("unavailable"), text("This isn’t available right now. Nothing was sent. Try again in a few minutes."), payment("items.1.status", "posted")],
  },
  {
    id: "T-21", name: "When the bank does not answer in time nothing is sent", covers: ["AC-9"], ...ct1, conditions: { timeout: ["bank.disputes.create"], latencyMs: 10000 },
    steps: [...twice(), ...send(), screen("timeout"), text("This is taking longer than expected. Nothing was sent."), payment("items.1.status", "posted"), press("Try again"), screen("reason")],
  },
  {
    id: "T-22", name: "When the payment cannot be checked nothing starts", covers: ["AC-9"], ...ct1, conditions: { unavailable: ["bank.disputes.check"] },
    steps: [screen("unavailable"), text("Nothing was sent.")],
  },
  {
    id: "T-23", name: "When the card payments cannot be read nothing starts", covers: ["AC-9"], ...base, conditions: { unavailable: ["bank.cards.transactions"] },
    steps: [screen("unavailable")],
  },
  {
    id: "T-24", name: "When the reasons cannot be read nothing starts", covers: ["AC-9"], ...ct1, conditions: { timeout: ["bank.disputes.reasons"], latencyMs: 10000 },
    steps: [screen("timeout"), text("This is taking longer than expected. Nothing was sent.")],
  },
  {
    id: "T-25", name: "Without cards.dispute it is not available, and the bank refuses", covers: ["AC-10"], ...ct1, conditions: { withoutPermissions: ["cards.dispute"] },
    steps: [screen("denied"), text("Not available"), forced({}, "PERMISSION_DENIED"), payment("items.1.status", "posted")],
  },
  {
    id: "T-26", name: "The bank refuses a pending payment, a payment received, a cash machine, a payment over 120 days old, an unknown payment and an unknown card whatever a screen would do", covers: ["AC-10", "AC-1"], ...base,
    steps: [
      forced({ transactionId: "ct_3" }, "TRANSACTION_PENDING"), forced({ transactionId: "ct_7" }, "NOT_A_PAYMENT_OUT"), forced({ transactionId: "ct_8" }, "NOT_A_CARD_PAYMENT"),
      forced({ transactionId: "ct_6" }, "DISPUTE_WINDOW_CLOSED"), forced({ transactionId: "ct_nope" }, "TRANSACTION_NOT_FOUND"), forced({ cardId: "card_nope" }, "CARD_NOT_FOUND"),
      forced({ transactionId: "ct_c1", cardId: "card_9021" }, "TRANSACTION_NOT_FOUND"), payment("items.1.status", "posted"),
    ],
  },
  {
    id: "T-27", name: "The bank refuses a reason it does not know and details that the reason does not have", covers: ["AC-10", "AC-2"], ...base,
    steps: [
      forced({ reason: "Because" }, "REASON_INVALID"), forced({ details: {} }, "DETAILS_INVALID"),
      forced({ reason: AMOUNT, details: { expectedAmount: 64.2 } }, "DISPUTE_AMOUNT_INVALID"), forced({ reason: AMOUNT, details: {} }, "DISPUTE_AMOUNT_INVALID"),
      forced({ reason: GOODS, details: { ordered: "ab", arrivedBy: "2026-10-20", contacted: "yes" } }, "DETAILS_INVALID"), forced({ reason: GOODS, details: { ordered: "A parcel", contacted: "yes" } }, "DETAILS_INVALID"),
      forced({ reason: CANCELLED, details: {} }, "DETAILS_INVALID"), forced({ reason: OTHER, details: { text: "short" } }, "DETAILS_INVALID"), forced({ reason: NONE, details: {} }, "DETAILS_INVALID"),
      payment("items.1.status", "posted"),
    ],
  },
  {
    id: "T-28", name: "The bank takes a report made directly, once: a second one for the same payment is refused", covers: ["AC-7", "AC-6"], ...base, setup: [dispute("ct_4")],
    steps: [forced({ transactionId: "ct_4" }, "DISPUTE_EXISTS"), { expectBank: { adapter: "bank.disputes.list", input: { cardId: "card_9021" }, path: "DSP-9001.status", equals: "Under review" } }],
  },
  {
    id: "T-29", name: "A reason has to be chosen", covers: ["AC-2"], ...ct1,
    steps: [press("Continue"), screen("reason"), error("Required")],
  },
  {
    id: "T-30", name: "Details the screen lets through but the bank does not accept (an order of only spaces) come back to the details with the bank's words, and nothing is sent", covers: ["AC-2", "AC-10"], ...ct1,
    steps: [
      ...reason(GOODS), set({ "ds.ordered": "   ", "ds.arrivedBy": "2026-10-20", "ds.contacted": "Yes" }), ...toDeclare(), ...send(), screen("details"), text("Tell us what you ordered."),
      payment("items.1.status", "posted"), set({ "ds.ordered": "A pair of shoes" }), ...toDeclare(), ...send(), screen("done"), text("Report received"),
    ],
  },
];
