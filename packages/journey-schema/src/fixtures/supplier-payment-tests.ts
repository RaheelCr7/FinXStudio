import type { Journey } from "../schema";

/**
 * What must be true for "Pay a supplier" to be right (the spec's criteria AC-1 to AC-8, with the ones this build adds: the role without the
 * permission is refused by the bank, a price that ran out is renewed, and the amounts at the edge of the code and daily limit).
 * Each is proved by at least one scenario below.
 */
export const supplierPaymentAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "Only a saved supplier can be chosen; a supplier that is not on the company's list is refused with \"Choose a supplier from your list.\"; a new supplier is requested through add-supplier. Opened with a supplier (launch.supplierId) the choice is skipped, and with an amount (launch.amount) it is filled in." },
  { id: "AC-2", text: "The speeds come from the bank for this supplier and amount; one over its limit is marked \"Over the limit\" and the bank will not use it: the first speed that fits is chosen, and choosing the marked one is refused." },
  { id: "AC-3", text: "Reference (letters, digits, space and . , ' - / ( ) + : #, up to 35) and Purpose are required before Review, and so is a speed and the confirmation tick." },
  { id: "AC-4", text: "An amount above the balance, above the person's daily limit or above every speed's limit is refused with the message of the spec, and no payment is made." },
  { id: "AC-5", text: "Below 25,000.00 USD no code is asked; from it the code sheet names the amount and the supplier, and three wrong codes stop the payment." },
  { id: "AC-6", text: "Two approvals are needed above 50,000.00 USD, one otherwise, and the review and the receipt say so." },
  { id: "AC-7", text: "The result is \"Sent for approval\" with a waiting chip and the payment id; the payment waits, no money leaves the account and the company's limit is not used." },
  { id: "AC-8", text: "A timeout shows the \"Check Payments\" message and creates no payment; an unavailable bank shows the sheet and creates no payment; a price that ran out is renewed and confirmed again." },
  { id: "AC-9", text: "A person whose role has no pay.create permission (an Approver) is not offered the journey, and the bank refuses the same calls when they are forced." },
];

// Alex Morgan at Alpha Trading LLC (a Maker), working in the company from the start. Today is Tuesday 3 November 2026, 10:42 UTC; the cut-off is 16:00.
// Alpha: Operating ••2001 USD 480,000.00; Alex's day limit 250,000.00 with 18,900.00 used; the code is asked from 25,000.00; two approvers above 50,000.00.
const NOW = "2026-11-03T10:42:00Z";
type Step = Record<string, unknown>;
const set = (v: Record<string, unknown>): Step => ({ set: v });
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const error = (e: string): Step => ({ expectError: e });
/** The bank, read as the person's company: the balance is still the seed's, and the company's day limit is not used (it counts at release). */
const unmoved: Step[] = [
  { expectBank: { adapter: "corp.company.get", path: "accounts.alpha_ops.balance", equals: 480_000 } },
  { expectBank: { adapter: "corp.company.get", path: "companyUsedToday", equals: 0 } },
];
/** No payment of Alex's was started in the walk: the only one waiting is the seed's. */
const noPayment = (id: string): Step => ({ expectBank: { adapter: "corp.payments.pending", input: { as: "initiator" }, path: id, equals: undefined } });
const nothingStarted = noPayment("PAY-2042");
const waiting = (id: string, path: string, equals: unknown): Step => ({ expectBank: { adapter: "corp.payments.get", input: { paymentId: id }, path, equals } });
/** The payment the walk started, read back by the id the result showed. */
const started = (path: string, equals: unknown): Step => ({ expectBank: { adapter: "corp.payments.get", input: { paymentId: "{{sp.result.id}}" }, path, equals } });

const pick = (name: string): Step[] => [screen("supplier"), press(name), screen("amount")];
const fill = (amount: number, reference = "INV-1042", purpose = "Goods"): Step[] => [set({ "sp.amount": amount, "sp.reference": reference, "sp.purpose": purpose }), press("Review"), screen("speed")];
/** From the speeds to the review, and the confirmation. */
const toReview: Step[] = [press("Review"), screen("review")];
const confirm: Step = set({ "sp.consent": true });
const send: Step[] = [confirm, press("Send for approval")];
const code = (c = "482100"): Step[] => [set({ "otp.code": c }), press("Send for approval")];
/** The whole walk for one supplier and amount, to the review. */
const toTheReview = (name: string, amount: number, reference = "INV-1042"): Step[] => [...pick(name), ...fill(amount, reference), ...toReview];

const base = { persona: "alex", context: "alpha", now: NOW };
type Setup = NonNullable<NonNullable<Journey["scenarios"]>[number]["setup"]>;
/** A payment Alex started earlier today with his own code, so that his day limit is partly used (the price includes the 1.00 fee of Same day). */
const earlier = (amount: number): Setup => [
  { adapter: "bank.otp.send" }, { adapter: "bank.otp.verify", input: { code: "482100" } },
  { adapter: "corp.payments.quote", input: { fromAccountId: "alpha_ops", beneficiaryId: "harb", amount, purpose: "Goods", reference: "EARLIER" }, saveAs: "q" },
  { adapter: "corp.payments.create", input: { quoteId: "{{setup.q.quoteId}}" } },
];
const T = (id: string, name: string, covers: string[], steps: Step[], extra: Record<string, unknown> = {}): NonNullable<Journey["scenarios"]>[number] => ({ id, name, covers, ...base, ...extra, steps } as any);

export const supplierPaymentScenarios: NonNullable<Journey["scenarios"]> = [
  T("T-1", "Harbour Packaging, 12,500.00, Standard: no code, Sent for approval, waiting for 1 approval, balance unchanged", ["AC-1", "AC-3", "AC-5", "AC-6", "AC-7"], [
    screen("supplier"), text("Choose a supplier"), text("Harbour Packaging"), text("USD · ••8841"), text("Nordic Supplies AB"), text("EUR · ••3000"), text("Whitby Logistics"), text("Gulf Trade FZE"),
    press("Harbour Packaging"), screen("amount"), text("Harbour Packaging"), text("Operating ••2001"), text("Amount"), noText("Amount (USD)"),
    ...fill(12_500), text("Standard"), text("1 to 2 business days"), text("How fast?"),
    press("Review"), screen("review"), text("You’re paying $12,500.00 to Harbour Packaging"), text("$12,500.00"), text("INV-1042"), text("Needs 1 approval"), text("1 to 2 business days"),
    press("Send for approval"), screen("review"), error("sp.consent"), text("Tick the confirmation first"),
    ...send, screen("result"), noText("Authorise"), text("Sent for approval"), text("$12,500.00 to Harbour Packaging"), text("Waiting for 1 approval"), text("PAY-2042"), text("Needs 1 approval"),
    started("status", "pending_approval"), started("required", 1), started("initiatedBy", "alex"), started("approvals", []), ...unmoved,
    { expectBank: { adapter: "corp.company.get", path: "me.usedToday", equals: 31_400 } },
  ]),
  T("T-2", "Nordic Supplies AB, 30,000.00 EUR: the rate is shown, the code sheet names the amount and the supplier, and with the code it is sent for approval", ["AC-5", "AC-7"], [
    ...pick("Nordic Supplies AB"), text("Amount (EUR)"), ...fill(30_000, "INV-77"), text("1 USD = 0.926 EUR"), text("You pay"), text("$32,422.41"),
    ...toReview, text("€30,000.00"), text("1 USD = 0.926 EUR"), text("Needs 1 approval"), noText("Authorise"),
    ...send, screen("otp"), text("Authorise €30,000.00 to Nordic Supplies AB"), text("Code sent to"), ...unmoved,
    ...code(), screen("result"), text("Sent for approval"), text("€30,000.00 to Nordic Supplies AB"), text("Waiting for 1 approval"),
    started("status", "pending_approval"), started("receive.currency", "EUR"), started("rate", 0.926), ...unmoved,
  ]),
  T("T-3", "Harbour Packaging, 60,000.00: Standard is marked Over the limit and Same day is used, two approvals on the review and the receipt, a code first", ["AC-2", "AC-6", "AC-5"], [
    ...pick("Harbour Packaging"), ...fill(60_000, "INV-9"), text("Standard"), text("Over the limit"), text("Same day"), text("Today"), text("$60,001.00"),
    ...toReview, text("Same day"), text("Needs 2 approvals"), text("$60,001.00"),
    ...send, screen("otp"), text("Authorise $60,000.00 to Harbour Packaging"), ...code(), screen("result"), text("Waiting for 2 approvals"), text("Needs 2 approvals"), text("Same day"),
    started("required", 2), started("sequence", ["dana", "lee"]), started("status", "pending_approval"), ...unmoved,
  ]),
  T("T-4", "An amount above every speed's limit: \"That is over the limit for this payment. Try a smaller amount.\" and Change amount goes back", ["AC-2", "AC-4"], [
    ...pick("Harbour Packaging"), set({ "sp.amount": 600_000, "sp.reference": "INV-1", "sp.purpose": "Goods" }), press("Review"), screen("problem"),
    text("That is over the limit for this payment. Try a smaller amount."), text("Nothing was sent."), noText("Change speed"), press("Change amount"), screen("amount"), nothingStarted, ...unmoved,
  ], { conditions: { unavailable: ["rail:sach"] } }),
  T("T-5", "600,000.00 is more than Operating holds: \"Not enough in Operating. Available: $480,000.00.\"", ["AC-4"], [
    ...pick("Harbour Packaging"), set({ "sp.amount": 600_000, "sp.reference": "INV-1", "sp.purpose": "Goods" }), press("Review"), screen("problem"),
    text("There isn’t enough money in the account."), text("Not enough in Operating. Available: $480,000.00."), text("Nothing was sent."), press("Change amount"), screen("amount"), nothingStarted, ...unmoved,
  ]),
  T("T-6", "240,000.00 already sent today and another 20,000.00: \"That is over your limit of $250,000.00 a day.\"", ["AC-4"], [
    ...pick("Harbour Packaging"), set({ "sp.amount": 20_000, "sp.reference": "INV-2", "sp.purpose": "Goods" }), press("Review"), screen("problem"),
    text("That is over your daily limit."), text("That is over your limit of $250,000.00 a day."), text("Nothing was sent."), noPayment("PAY-2043"),
  ], { setup: earlier(221_099) }),
  T("T-7", "Exactly at the daily limit goes through; one cent over is refused", ["AC-4"], [
    ...pick("Harbour Packaging"), ...fill(10_000, "INV-3"), ...toReview, ...send, screen("result"), text("Sent for approval"),
    press("Pay another supplier"), ...pick("Harbour Packaging"), set({ "sp.amount": 0.01, "sp.reference": "INV-4", "sp.purpose": "Goods" }), press("Review"), screen("problem"), text("That is over your daily limit."),
  ], { setup: earlier(221_099) }),
  T("T-8", "Reference and Purpose empty: Review stays on the amount with an error for each; a reference with a character the bank does not take, or over 35 characters, is refused", ["AC-3"], [
    ...pick("Harbour Packaging"), set({ "sp.amount": 100 }), press("Review"), screen("amount"), error("sp.reference"), error("sp.purpose"),
    set({ "sp.reference": "INV<1>", "sp.purpose": "Goods" }), press("Review"), screen("amount"), error("Use letters, numbers and spaces only."),
    set({ "sp.reference": "A".repeat(36) }), press("Review"), screen("amount"), error("Use letters, numbers and spaces only."),
    set({ "sp.reference": "PO #12/B (Q4), Nov-26: 1+1" }), press("Review"), screen("speed"), nothingStarted,
  ]),
  T("T-9", "The amount must be there, and a speed must be chosen before the review", ["AC-3"], [
    ...pick("Harbour Packaging"), set({ "sp.reference": "INV-1", "sp.purpose": "Goods" }), press("Review"), screen("amount"), error("sp.amount"),
    ...fill(100), set({ "sp.speed": "" }), press("Review"), screen("speed"), error("sp.speed"),
  ]),
  T("T-10", "Wrong code three times: \"We couldn’t confirm this payment. Nothing was sent. Start again.\" and no payment", ["AC-5"], [
    ...toTheReview("Nordic Supplies AB", 30_000), ...send, screen("otp"),
    ...code("111111"), screen("otp"), ...code("111111"), screen("otp"), ...code("111111"), screen("locked"),
    text("We couldn’t confirm this payment."), text("Nothing was sent. Start again."), nothingStarted, ...unmoved,
    press("Start again"), screen("supplier"),
  ]),
  T("T-11", "The bank does not answer when the payment is sent: Check Payments before trying again, and no payment", ["AC-8"], [
    ...toTheReview("Harbour Packaging", 12_500), ...send, screen("timeout"), text("We didn’t get an answer in time"), text("Check Payments before you try again, so you don’t pay twice."), press("Check Payments"), nothingStarted, ...unmoved,
  ], { conditions: { timeout: ["corp.payments.create"], latencyMs: 10_000 } }),
  T("T-12", "The bank is unavailable when the payment is sent: the sheet, nothing sent or charged, and Try again returns to the review", ["AC-8"], [
    ...toTheReview("Harbour Packaging", 12_500), ...send, screen("unavailable"), text("We couldn’t reach the bank"), text("Nothing was sent and you haven’t been charged. Try again in a moment."), nothingStarted,
    press("Try again"), screen("review"), ...unmoved,
  ], { conditions: { unavailable: ["corp.payments.create"] } }),
  T("T-13", "Alex at Beta, an Approver: the journey is not for him, and the bank refuses the same calls when they are forced", ["AC-9"], [
    screen("denied"), text("You can’t pay suppliers at this company"), noText("Choose a supplier"),
    { expectBankError: { adapter: "corp.payments.quote", input: { fromAccountId: "beta_ops", beneficiaryId: "nimb", amount: 100, purpose: "Goods", reference: "FORCED" }, code: "PERMISSION_DENIED" } },
    { expectBankError: { adapter: "corp.payments.create", input: { quoteId: "corpq_1" }, code: "PERMISSION_DENIED" } },
    { expectBankError: { adapter: "corp.payments.initiate", input: { fromAccountId: "beta_ops", beneficiaryId: "nimb", amount: 100 }, code: "PERMISSION_DENIED" } },
    { expectBank: { adapter: "corp.company.get", path: "accounts.beta_ops.balance", equals: 310_000 } },
    press("Close"),
  ], { context: "beta" }),
  T("T-14", "The price ran out while the person looked at the review: a new price is asked for, the person confirms the new amount, and it is sent", ["AC-8"], [
    ...toTheReview("Harbour Packaging", 12_500), { advance: 61 }, ...send, screen("review"), text("The price changed. Check the new amount and confirm again."), nothingStarted,
    press("Send for approval"), error("sp.consent"), ...send, screen("result"), text("Sent for approval"), started("status", "pending_approval"),
  ]),
  T("T-15", "A supplier that is not on the company's list is refused by the bank and the person goes back to the list with the message", ["AC-1"], [
    ...pick("Harbour Packaging"), set({ "sp.supplierId": "ghost" }), ...[set({ "sp.amount": 100, "sp.reference": "INV-1", "sp.purpose": "Goods" }), press("Review")],
    screen("supplier"), text("Choose a supplier from your list."), nothingStarted,
    { expectBankError: { adapter: "corp.payments.quote", input: { fromAccountId: "alpha_ops", beneficiaryId: "ghost", amount: 100, purpose: "Goods", reference: "X" }, code: "BENEFICIARY_NOT_WHITELISTED" } },
  ]),
  T("T-16", "Request a new supplier opens add-supplier", ["AC-1"], [
    screen("supplier"), press("Request a new supplier"), { expectOpens: { journey: "add-supplier" } },
  ]),
  T("T-17", "Opened with a saved supplier and an amount: the choice is skipped and the amount is there; an unknown supplier is ignored; Pay another supplier asks again", ["AC-1"], [
    screen("amount"), text("Nordic Supplies AB"), text("Amount (EUR)"), set({ "sp.reference": "INV-5", "sp.purpose": "Services" }), press("Review"), screen("speed"), text("1 USD = 0.926 EUR"),
    ...toReview, ...send, screen("result"), text("€5,000.00 to Nordic Supplies AB"), press("Pay another supplier"), screen("supplier"),
  ], { launch: { "launch.supplierId": "nord", "launch.amount": 5_000 } }),
  T("T-18", "Opened with a supplier the company does not have: ignored, the list shows", ["AC-1"], [screen("supplier"), text("Harbour Packaging")], { launch: { "launch.supplierId": "nobody" } }),
  T("T-19", "Choosing the speed that is over its limit is refused, and Change speed goes back to the speeds", ["AC-2"], [
    ...pick("Harbour Packaging"), ...fill(60_000), set({ "sp.speed": "standard" }), press("Review"), screen("problem"),
    text("That speed is limited to $25,000.00 a payment. Choose another speed or send less."), text("Nothing was sent."), press("Change speed"), screen("speed"), nothingStarted,
  ]),
  T("T-20", "Instant is a choice too: its fee is on the card and on the review", ["AC-2"], [
    ...pick("Harbour Packaging"), ...fill(1_000), text("In seconds"), text("$0.25"), set({ "sp.speed": "instant" }), ...toReview, text("Instant"), text("$1,000.25"), ...send, screen("result"), text("Instant"), started("rail.id", "rtp"),
  ]),
  T("T-21", "Exactly 25,000.00 asks for a code; one cent less does not", ["AC-5"], [
    ...toTheReview("Harbour Packaging", 25_000), ...send, screen("otp"), text("Authorise $25,000.00 to Harbour Packaging"), ...code(), screen("result"),
    press("Pay another supplier"), ...toTheReview("Harbour Packaging", 24_999.99), ...send, screen("result"), text("Sent for approval"),
  ]),
  T("T-22", "Without the tick the review does not send", ["AC-3"], [
    ...toTheReview("Harbour Packaging", 12_500), press("Send for approval"), screen("review"), error("sp.consent"), nothingStarted, ...unmoved,
  ]),
  T("T-23", "The company cannot be read: the sheet, and Try again asks again", ["AC-8"], [
    screen("unavailable"), text("We couldn’t reach the bank"), press("Try again"), screen("unavailable"),
  ], { conditions: { unavailable: ["corp.company.get"] } }),
  T("T-24", "The price cannot be asked for in time: nothing was sent and Try again returns to the amount", ["AC-8"], [
    ...pick("Harbour Packaging"), set({ "sp.amount": 100, "sp.reference": "INV-1", "sp.purpose": "Goods" }), press("Review"), screen("slow"), text("This is taking longer than expected."), text("Nothing was sent."), press("Try again"), screen("amount"), nothingStarted,
  ], { conditions: { timeout: ["corp.payments.quote"], latencyMs: 10_000 } }),
  T("T-25", "The code cannot be sent: the sheet, nothing sent, and Try again returns to the review", ["AC-8"], [
    ...toTheReview("Nordic Supplies AB", 30_000), ...send, screen("unavailable"), text("Nothing was sent and you haven’t been charged."), press("Try again"), screen("review"), nothingStarted,
  ], { conditions: { unavailable: ["bank.otp.send"] } }),
  T("T-26", "The core fails after a right code: the payment is not made and the person is told nothing was sent", ["AC-8"], [
    ...toTheReview("Nordic Supplies AB", 30_000), ...send, ...code(), screen("failed"), text("We couldn’t complete this right now."), text("Nothing was sent."), nothingStarted, ...unmoved,
  ], { conditions: { transferFails: true } }),
  T("T-28", "Without the tick a payment that asks for a code does not go on to the code", ["AC-3"], [
    ...toTheReview("Nordic Supplies AB", 30_000), press("Send for approval"), screen("review"), error("sp.consent"), nothingStarted, ...unmoved,
  ]),
  T("T-29", "The code sheet needs all six digits before it checks anything", ["AC-5"], [
    ...toTheReview("Nordic Supplies AB", 30_000), ...send, screen("otp"), press("Send for approval"), screen("otp"), error("otp.code"), ...code("123"), screen("otp"), error("otp.code"), nothingStarted,
  ]),
  T("T-30", "The new price is refused when the person's day was used up meanwhile (another device): nothing is sent and the person is told why", ["AC-8", "AC-4"], [
    ...toTheReview("Harbour Packaging", 12_500),
    { expectBank: { adapter: "bank.otp.send", path: "sent", equals: true } }, { expectBank: { adapter: "bank.otp.verify", input: { code: "482100" }, path: "verified", equals: true } },
    { expectBank: { adapter: "corp.payments.create", input: { quoteId: "{{setup.big.quoteId}}" }, path: "status", equals: "pending_approval" } },
    { advance: 61 }, ...send, screen("problem"), text("That is over your daily limit."), noPayment("PAY-2043"),
  ], { setup: [{ adapter: "corp.payments.quote", input: { fromAccountId: "alpha_ops", beneficiaryId: "harb", amount: 221_099, purpose: "Goods", reference: "MEANWHILE" }, saveAs: "big" }] }),
  T("T-31", "Started from Personal the bank says it belongs to the business side: the journey asks the person to switch and sends nothing", ["AC-9"], [
    screen("denied"), text("Switch to your business first"), text("This belongs to your business banking."), press("Close"),
  ], { context: undefined }),
  T("T-32", "After the 16:00 cut-off the payment is dated the next working day; before it, today", ["AC-7"], [
    ...toTheReview("Harbour Packaging", 12_500), ...send, screen("result"), started("afterCutoff", true), started("valueDate", "2026-11-04"),
  ], { now: "2026-11-03T16:30:00Z" }),
  T("T-33", "Before the cut-off the payment is dated today and waits for approval", ["AC-7"], [
    ...toTheReview("Harbour Packaging", 12_500), ...send, screen("result"), started("afterCutoff", false), started("valueDate", "2026-11-03"),
  ]),
  T("T-27", "A price used twice, as a screen could not do it, is refused by the bank; the first payment stands", ["AC-7"], [
    ...toTheReview("Harbour Packaging", 12_500), ...send, screen("result"),
    { expectBankError: { adapter: "corp.payments.create", input: { quoteId: "{{ctx.quote.quoteId}}" }, code: "QUOTE_USED" } },
    started("status", "pending_approval"),
  ]),
];
