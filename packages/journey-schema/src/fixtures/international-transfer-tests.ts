import type { Journey } from "../schema";

/** What must be true for "Abroad" to be right. The rules are those of Send money for "To another country"; this journey opens Send money (launch value launch.type) so it is the same flow, opened at its first step. */
export const internationalTransferAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "It opens at the payee step with no choice of type: saved payees abroad first, or straight to a new payee when there are none. When the bank has switched this way of sending off (opt.typeIntl) it says \"Nothing to send with\"." },
  { id: "AC-2", text: "A new payee asks for the country, the name, the country's identifier (an IBAN or an account number) and, for Canada, India and Australia, a bank code; and the SWIFT/BIC. Each is checked, with the bank's own checks after the format." },
  { id: "AC-3", text: "The amount screen adds the purpose, which is required; the address and the relationship are asked only when the rule applies: some countries, and 10,000 US dollars or more in any country." },
  { id: "AC-4", text: "\"Who pays the bank charges?\" is asked only when the bank has turned chargeChoice on, and \"I pay all\" adds $15.00." },
  { id: "AC-5", text: "The speeds are Standard (1 to 3 business days) and, when the bank turns it on, Priority (next business day), each with its fee." },
  { id: "AC-6", text: "The rate is held for 60 seconds: after that the person gets a new price with the exchange-rate message, nothing is sent, and confirms again." },
  { id: "AC-7", text: "There is no name check: a new payee goes straight to the amount, and the person confirms the details on the review." },
  { id: "AC-8", text: "It keeps the rules of Send money: the confirmation and the six-digit one-time code, three wrong codes stop it and no money moves." },
  { id: "AC-9", text: "It keeps the bank's refusals of Send money for a payment abroad, each with its words and a way to fix it: not enough in the account, the daily limit, the limit of the speed, a frozen account, the 500.00 allowance of a new payee, a payee that screening holds (Held for review, nothing moves), 50 payees at most, a payee saved twice." },
  { id: "AC-10", text: "Every bank call has a way out: a timeout on the payment says to check Activity first; a service that is not available, a slow answer and a failing core say that nothing was sent; Try again goes back to where the person was." },
  { id: "AC-11", text: "Later and Repeat are offered as for another bank, only when the bank allows them: the dates are business days, nothing moves until the day, and the payment is listed as scheduled." },
];

const NOW = "2026-11-02T09:31:00Z";
type Step = Record<string, unknown>;
const set = (v: Record<string, unknown>): Step => ({ set: v });
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const error = (e: string): Step => ({ expectError: e });
const balance = (account: string, equals: number): Step => ({ expectBank: { adapter: "bank.accounts.list", path: `${account}.balance`, equals } });
const unchanged: Step[] = [balance("acc_main", 8720.76), balance("acc_save", 15254.37), { expectBank: { adapter: "bank.limits.get", path: "usedToday", equals: 0 } }];
const toReview = (amount: number, extra: Record<string, unknown> = {}): Step[] => [set({ "pt.amount": amount, ...extra }), press("Continue"), screen("options"), press("Review"), screen("review")];
const confirm: Step[] = [set({ "pt.consent": true }), press("Confirm and send code")];
const code = (c = "482100"): Step[] => [set({ "otp.code": c })];
/** Money in the account so that a large amount can be reached (the checks on the amount come before the checks on the balance). */
// 50,000.00 more in Main, put there the way a customer does it: ten card top-ups of the most the bank takes at once (5,000.00), each with its code and security code
const richMain = Array.from({ length: 10 }, () => [{ adapter: "bank.otp.send" }, { adapter: "bank.otp.verify", input: { code: "482100" } }, { adapter: "bank.deposit.create", input: { toAccountId: "acc_main", amount: 5000, fromCardId: "c_5832", securityCode: "123" } }]).flat();
const base = { persona: "alexpayees", now: NOW };

export const internationalTransferScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "Opens at the saved payees abroad, with no choice of type; a new payee asks for the country", covers: ["AC-1"], ...base,
    steps: [screen("payee"), text("Marco Rossi"), noText("Taylor Brooks"), noText("Jam (Jamie Lee)"), noText("To another bank"), noText("To another country"), press("New payee"), screen("details"), text("Country"), press("Back"), screen("payee")],
  },
  {
    id: "T-2", name: "With no saved payee it opens at the new payee; a German payee asks an IBAN and the SWIFT/BIC, no bank code, and goes straight to the amount", covers: ["AC-1", "AC-2", "AC-7"], ...base, persona: "alexglobal",
    steps: [
      screen("details"), text("Country"), text("Germany"), noText("Routing number"), noText("Find them by"),
      set({ "pt.country": "DE", "pt.name": "Greta Vogel", "pt.account": "DE12", "pt.swift": "COBA" }), text("IBAN"), text("SWIFT / BIC code"), noText("Transit"), noText("IFSC"), noText("BSB"), press("Continue"),
      error("That IBAN doesn’t look right. Check each character."), error("A SWIFT/BIC has 8 or 11 letters and numbers."),
      set({ "pt.account": "DE89 3704 0044 0532 0130 01", "pt.swift": "COBADEFFXXX" }), press("Continue"), screen("details"), text("That IBAN doesn’t look right. Check each character."),
      set({ "pt.account": "DE89 3704 0044 0532 0130 00", "pt.swift": "COBAFRFFXXX" }), press("Continue"), screen("details"), text("That bank code doesn’t match the country."),
      // no name check: the next screen after the details is the amount, with the name as typed
      set({ "pt.swift": "COBADEFFXXX" }), press("Continue"), screen("amount"), text("Greta Vogel"), text("They receive (EUR)"),
    ],
  },
  {
    id: "T-3", name: "Canada asks a transit number, India an IFSC, Australia a BSB, and Japan only an account number", covers: ["AC-2"], ...base, persona: "alexglobal",
    steps: [
      set({ "pt.country": "CA", "pt.name": "Chloe Tremblay", "pt.account": "1234567", "pt.bankCode": "12-3", "pt.swift": "ROYCCAT2" }),
      text("Transit and institution number"), noText("IFSC"), noText("BSB"), noText("IBAN"), press("Continue"),
      error("Use the 5-digit transit number and 3-digit institution number, like 00012-003."),
      set({ "pt.country": "IN", "pt.bankCode": "HDFC1000001" }), text("IFSC code"), noText("Transit"), press("Continue"),
      error("An IFSC has 11 characters: 4 letters, a zero, then 6 letters or numbers."),
      set({ "pt.country": "AU", "pt.bankCode": "062" }), text("BSB"), noText("IFSC"), press("Continue"), error("A BSB has 6 digits, like 062-000."),
      set({ "pt.country": "JP", "pt.account": "12345678", "pt.swift": "MHCBJPJT" }), text("Account number"), noText("BSB"), noText("Transit"), noText("IFSC"), noText("IBAN"), press("Continue"),
      screen("amount"), text("They receive (JPY)"),
    ],
  },
  {
    id: "T-4", name: "When the bank has switched this way of sending off: Nothing to send with", covers: ["AC-1"], ...base, launch: { "opt.typeIntl": false },
    steps: [screen("off"), text("Nothing to send with"), text("Sending money isn’t available right now."), noText("Who are you paying?"), press("Continue")],
  },
  {
    id: "T-33", name: "The other ways of sending being off changes nothing: it still opens at the payee step", covers: ["AC-1"], ...base, launch: { "opt.typeInternal": false, "opt.typeDomestic": false },
    steps: [{ expectOpens: { journey: "personal-transfer", with: { "launch.type": "international" } } }, screen("payee")],
  },
  {
    id: "T-5", name: "The purpose is needed, and the bank says so with the words of the screen", covers: ["AC-3"], ...base,
    steps: [
      press("Marco Rossi"), screen("amount"), text("Purpose"), text("They receive (EUR)"), set({ "pt.amount": 0 }), press("Continue"), screen("amount"), error("Enter an amount"), set({ "pt.amount": 100 }), press("Continue"),
      screen("problem"), text("Choose a purpose for this payment."), press("Edit"), screen("amount"),
      set({ "pt.purpose": "Rent" }), press("Continue"), screen("options"), ...unchanged,
    ],
  },
  {
    id: "T-6", name: "Japan asks for the address and the relationship; so does 10,000 US dollars or more in any country, and a little under does not", covers: ["AC-3"], ...base, setup: richMain,
    steps: [
      press("New payee"), set({ "pt.country": "JP", "pt.name": "Kenji Sato", "pt.account": "12345678", "pt.swift": "MHCBJPJT" }), press("Continue"),
      screen("amount"), set({ "pt.amount": 15100, "pt.purpose": "Rent" }), press("Continue"),
      screen("address"), text("We need the payee’s address for this payment."), press("Continue"), screen("address"), error("pt.street"), error("pt.city"), error("pt.relationship"),
      set({ "pt.street": "1-1 Chome", "pt.city": "Tokyo", "pt.relationship": "Friend" }), press("Continue"), screen("options"), press("Review"), screen("review"), text("¥15,100"),
      press("Change amount"), screen("amount"), press("Back"), screen("payee"),
      // Italy has no address rule of its own: 9,000 euros is under 10,000 US dollars, 9,500 euros is over
      press("Marco Rossi"), set({ "pt.amount": 9000, "pt.purpose": "Rent", "pt.street": "", "pt.city": "", "pt.relationship": "" }), press("Continue"), screen("options"), noText("Their address"),
      press("Change amount"), set({ "pt.amount": 9500 }), press("Continue"), screen("address"),
      set({ "pt.street": "Via Roma 1", "pt.city": "Milan", "pt.relationship": "Supplier or business" }), press("Continue"), screen("options"),
    ],
  },
  {
    id: "T-7", name: "Who pays the bank charges? is not asked unless the bank turns it on; then \"I pay all\" adds $15.00", covers: ["AC-4"], ...base,
    steps: [
      press("Marco Rossi"), screen("amount"), noText("Who pays the bank charges?"),
      set({ "opt.chargeChoice": true }), text("Who pays the bank charges?"), text("Shared"), text("I pay all (+$15.00)"), text("They pay"),
      set({ "pt.amount": 100, "pt.purpose": "Rent", "pt.charges": "ours" }), press("Continue"), screen("options"), text("1 to 3 business days · $40.00"),
      press("Review"), screen("review"), text("$40.00"), text("$148"),
    ],
  },
  {
    id: "T-8", name: "Standard is 1 to 3 business days at $25.00; Priority, next business day at $40.00, only when the bank turns it on", covers: ["AC-5"], ...base,
    steps: [
      press("Marco Rossi"), set({ "pt.amount": 100, "pt.purpose": "Rent" }), press("Continue"), screen("options"),
      text("Standard"), text("1 to 3 business days · $25.00"), noText("Priority"), noText("Instant"), noText("Same day"),
      press("Change amount"), set({ "opt.speedPriority": true }), press("Continue"), screen("options"),
      text("Standard"), text("Priority"), text("Next business day · $40.00"), text("1 to 3 business days · $25.00"),
      set({ "pt.speed": "priority" }), press("Review"), screen("review"), text("Priority"), text("Next business day"), text("$40.00"), text("$148"),
    ],
  },
  {
    id: "T-9", name: "After 60 seconds the price is stale: a new price with the exchange-rate message, nothing sent, confirm again", covers: ["AC-6"], ...base,
    steps: [
      press("Marco Rossi"), ...toReview(100, { "pt.purpose": "Rent" }), text("1 USD = 0.926 EUR"),
      ...confirm, ...code(), { advance: 61 }, press("Send €100.00"),
      screen("review"), text("The exchange rate changed. Check the new amount and confirm again."), text("1 USD = 0.926185 EUR"), text("$132.97"), ...unchanged,
      ...confirm, ...code(), press("Send €100.00"),
      screen("result"), text("On its way"), balance("acc_main", 8587.79),
    ],
  },
  {
    id: "T-10", name: "Within the 60 seconds the price stays and the payment goes", covers: ["AC-6"], ...base,
    steps: [
      press("Marco Rossi"), ...toReview(100, { "pt.purpose": "Rent" }),
      ...confirm, ...code(), { advance: 59 }, press("Send €100.00"), screen("result"), text("On its way"), noText("exchange rate changed"), balance("acc_main", 8587.76),
    ],
  },
  {
    id: "T-11", name: "A new payee abroad is not name-checked: the review shows the country, the purpose and the confirmation the person must tick", covers: ["AC-7"], ...base, persona: "alexglobal",
    steps: [
      set({ "pt.country": "DE", "pt.name": "Greta Vogel", "pt.account": "DE89 3704 0044 0532 0130 00", "pt.swift": "COBADEFFXXX" }), press("Continue"), screen("amount"),
      ...toReview(100, { "pt.purpose": "Rent" }), text("Greta Vogel"), text("Country"), text("DE"), text("Purpose"), text("Rent"), text("I confirm the details are correct"),
      press("Confirm and send code"), screen("review"), error("Tick the confirmation first"), ...unchanged,
    ],
  },
  {
    id: "T-12", name: "Three wrong codes stop the payment and no money moves", covers: ["AC-8"], ...base,
    steps: [
      press("Marco Rossi"), ...toReview(100, { "pt.purpose": "Rent" }), ...confirm, ...code("111111"),
      press("Send €100.00"), screen("otp"), press("Send €100.00"), screen("otp"), press("Send €100.00"), screen("locked"), text("No money has left your account."), ...unchanged,
    ],
  },
  {
    id: "T-13", name: "The confirmation must be ticked and the code must be six digits before anything is asked of the bank", covers: ["AC-8"], ...base,
    steps: [
      press("Marco Rossi"), ...toReview(100, { "pt.purpose": "Rent" }),
      press("Confirm and send code"), screen("review"), error("Tick the confirmation first"),
      ...confirm, screen("otp"), press("Send €100.00"), screen("otp"), error("Enter all 6 digits"), ...unchanged,
    ],
  },
  {
    id: "T-14", name: "More than the daily limit and a frozen account are refused abroad, each with its words", covers: ["AC-9"], ...base, setup: richMain, conditions: { frozen: ["acc_save"], limitUsed: 49000 },
    steps: [
      press("Marco Rossi"), set({ "pt.amount": 9000, "pt.purpose": "Rent", "pt.street": "x", "pt.city": "x", "pt.relationship": "Friend" }), press("Continue"),
      screen("problem"), text("That is over your remaining daily limit of $1,000.00."), press("Change amount"),
      set({ "pt.amount": 100, "pt.from": "acc_save" }), press("Continue"), screen("problem"), text("You can’t send money from this account right now."), press("Choose account"), screen("amount"),
      set({ "pt.from": "acc_main" }), press("Continue"), screen("options"),
    ],
  },
  {
    id: "T-15", name: "More than the account holds is refused abroad with the exact words, and a payment that fits goes on", covers: ["AC-9"], ...base,
    steps: [
      press("Marco Rossi"), set({ "pt.amount": 8100, "pt.purpose": "Rent" }), press("Continue"), screen("problem"), text("Not enough in the account"), text("is available."),
      press("Change amount"), set({ "pt.amount": 100 }), press("Continue"), screen("options"),
    ],
  },
  {
    id: "T-16", name: "A payee typed in the payment is new: over $500.00 is refused abroad, and the bank can switch the rule off", covers: ["AC-9"], ...base, persona: "alexglobal",
    steps: [
      set({ "pt.country": "DE", "pt.name": "Greta Vogel", "pt.account": "DE89 3704 0044 0532 0130 00", "pt.swift": "COBADEFFXXX" }), press("Continue"), screen("amount"),
      set({ "pt.amount": 600, "pt.purpose": "Rent" }), press("Continue"), screen("problem"), text("Greta Vogel was added 0 hours ago."), text("up to $500.00 more now"), press("Change amount"),
      set({ "opt.coolingOff": false }), press("Continue"), screen("options"),
    ],
  },
  {
    id: "T-17", name: "A payee that screening holds: Held for review, no balance change, no daily limit used", covers: ["AC-9"], ...base, persona: "alexglobal",
    steps: [
      set({ "pt.country": "DE", "pt.name": "Test Sanctions", "pt.account": "DE89 3704 0044 0532 0130 00", "pt.swift": "COBADEFFXXX" }), press("Continue"),
      ...toReview(100, { "pt.purpose": "Rent" }), ...confirm, ...code(), press("Send €100.00"),
      screen("result"), text("Held for review"), noText("Delivered"), noText("On its way"), ...unchanged,
    ],
  },
  {
    id: "T-18", name: "At the most payees the bank allows, a new one abroad is refused", covers: ["AC-9"], ...base, persona: "alexfull",
    steps: [
      screen("details"),
      set({ "pt.country": "DE", "pt.name": "Greta Vogel", "pt.account": "DE89 3704 0044 0532 0130 00", "pt.swift": "COBADEFFXXX" }), press("Continue"),
      screen("details"), text("You can save up to 50 payees. Delete one to add another."),
    ],
  },
  {
    id: "T-19", name: "A payee abroad that is saved twice cannot be saved again", covers: ["AC-9"], ...base,
    steps: [
      press("New payee"),
      set({ "pt.country": "DE", "pt.name": "Marco Rossi", "pt.account": "DE89 3704 0044 0532 0130 00", "pt.swift": "NRWDDEFFXXX" }), press("Continue"),
      screen("details"), text("You already saved this payee with these details."), ...unchanged,
    ],
  },
  {
    id: "T-29", name: "Priority can be taken down: it is marked, and asking for it is refused", covers: ["AC-5"], ...base, conditions: { unavailable: ["rail:swiftp"] },
    steps: [
      set({ "opt.speedPriority": true }), press("Marco Rossi"), set({ "pt.amount": 100, "pt.purpose": "Rent" }), press("Continue"), screen("options"),
      text("Priority"), text("Not available right now"), set({ "pt.speed": "priority" }), press("Review"),
      screen("problem"), text("Sending isn’t available right now. Try again later."), text("No money has left your account."), press("Change speed"), screen("options"), ...unchanged,
    ],
  },
  {
    id: "T-30", name: "Later: business days only, Repeat, the payment is scheduled and nothing moves; with Later off there is no When", covers: ["AC-11"], ...base,
    steps: [
      press("Marco Rossi"), set({ "pt.amount": 100, "pt.purpose": "Rent" }), press("Continue"), screen("options"),
      text("When"), text("Now"), text("Later"), noText("Send on"), noText("Repeat"),
      set({ "pt.when": "later" }), text("Send on"), text("Repeat"), text("Tue 3 Nov"), text("Mon 9 Nov"), noText("Sat 7 Nov"), noText("Sun 8 Nov"),
      press("Review"), screen("options"), error("pt.sendOn"),
      set({ "pt.sendOn": "2026-11-09", "pt.repeat": "monthly" }), press("Review"),
      screen("review"), text("Scheduled for Mon 9 Nov"), text("First payment"), text("Every month"), ...confirm, text("Authorise €100.00 to Marco Rossi"),
      ...code("12"), press("Schedule €100.00"), screen("otp"), error("Enter all 6 digits"),
      ...code("111111"), press("Schedule €100.00"), screen("otp"), ...code(), press("Schedule €100.00"),
      screen("result"), text("Scheduled"), text("Scheduled for Mon 9 Nov"), ...unchanged,
      press("See scheduled payments"),
    ],
  },
  {
    id: "T-31", name: "A later payment that the bank cannot take: nothing is set up", covers: ["AC-11", "AC-10"], ...base, conditions: { unavailable: ["bank.payments.create"] },
    steps: [
      press("Marco Rossi"), set({ "pt.amount": 100, "pt.purpose": "Rent" }), press("Continue"), set({ "pt.when": "later", "pt.sendOn": "2026-11-09" }), press("Review"),
      ...confirm, ...code(), press("Schedule €100.00"), screen("unavailable"), text("Nothing was changed."), ...unchanged,
    ],
  },
  {
    id: "T-32", name: "The bank can switch Later off: no When field", covers: ["AC-11"], ...base,
    steps: [
      set({ "opt.allowLater": false }), press("Marco Rossi"), set({ "pt.amount": 100, "pt.purpose": "Rent" }), press("Continue"), screen("options"),
      noText("When"), noText("Later"), noText("Send on"), press("Review"), screen("review"), noText("Repeats"),
    ],
  },
  {
    id: "T-20", name: "The bank does not answer the payment in time: Check Activity first, nothing applied", covers: ["AC-10"], ...base, conditions: { timeout: ["bank.payments.create"], latencyMs: 10000 },
    steps: [
      press("Marco Rossi"), ...toReview(100, { "pt.purpose": "Rent" }), ...confirm, ...code(), press("Send €100.00"),
      screen("timeout"), text("Check Activity before you try again, so you don't pay twice"), ...unchanged,
    ],
  },
  {
    id: "T-21", name: "The payment service is not available: nothing sent, and Try again goes back to the review; a failing core sends nothing either", covers: ["AC-10"], ...base, conditions: { unavailable: ["bank.payments.create"] },
    steps: [
      press("Marco Rossi"), ...toReview(100, { "pt.purpose": "Rent" }), ...confirm, ...code(), press("Send €100.00"),
      screen("unavailable"), text("Nothing was changed."), ...unchanged, press("Try again"), screen("review"),
    ],
  },
  {
    id: "T-22", name: "The core fails after the code: no money has left the account", covers: ["AC-10"], ...base, conditions: { transferFails: true },
    steps: [
      press("Marco Rossi"), ...toReview(100, { "pt.purpose": "Rent" }), ...confirm, ...code(), press("Send €100.00"),
      screen("failed"), text("No money has left your account."), ...unchanged,
    ],
  },
  {
    id: "T-23", name: "The price service is not available, or answers too slowly: nothing changed, Try again comes back to the amount", covers: ["AC-10"], ...base, conditions: { unavailable: ["bank.payments.quote"] },
    steps: [
      press("Marco Rossi"), set({ "pt.amount": 100, "pt.purpose": "Rent" }), press("Continue"), screen("unavailable"), text("Nothing was changed."), press("Try again"), screen("amount"),
      set({ "pt.amount": 9500, "pt.street": "x", "pt.city": "x", "pt.relationship": "Friend" }), press("Continue"), screen("unavailable"), ...unchanged,
    ],
  },
  {
    id: "T-24", name: "A slow answer to the price: nothing changed, it is safe to ask again", covers: ["AC-10"], ...base, conditions: { timeout: ["bank.payments.quote"], latencyMs: 10000 },
    steps: [
      press("Marco Rossi"), set({ "pt.amount": 100, "pt.purpose": "Rent" }), press("Continue"),
      screen("slow"), text("This is taking longer than expected. Nothing was changed."), noText("Check Activity"), press("Try again"), screen("amount"),
    ],
  },
  {
    id: "T-25", name: "The accounts or the saved payees cannot be loaded: standard message, and Try again asks again", covers: ["AC-10"], ...base, conditions: { unavailable: ["bank.accounts.list"] },
    steps: [screen("unavailable"), text("Service not available"), press("Try again"), screen("unavailable")],
  },
  {
    id: "T-26", name: "The saved payees cannot be loaded: standard message, and Try again asks again", covers: ["AC-10"], ...base, conditions: { unavailable: ["bank.beneficiaries.list"] },
    steps: [screen("unavailable"), text("Nothing was changed."), press("Try again"), screen("unavailable")],
  },
  {
    id: "T-27", name: "The payee check is not available: standard message, and Try again goes back to the details", covers: ["AC-10"], ...base, conditions: { unavailable: ["bank.payees.validate"] },
    steps: [
      press("New payee"), set({ "pt.country": "DE", "pt.name": "Greta Vogel", "pt.account": "DE89 3704 0044 0532 0130 00", "pt.swift": "COBADEFFXXX" }), press("Continue"),
      screen("unavailable"), press("Try again"), screen("details"),
    ],
  },
  {
    id: "T-28", name: "The code cannot be sent: standard message, nothing changed", covers: ["AC-10"], ...base, conditions: { unavailable: ["bank.otp.send"] },
    steps: [press("Marco Rossi"), ...toReview(100, { "pt.purpose": "Rent" }), ...confirm, screen("unavailable"), ...unchanged],
  },
];
