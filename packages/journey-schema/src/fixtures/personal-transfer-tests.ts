import type { Journey } from "../schema";

/** What must be true for "Send money" to be right. Each is proved by at least one scenario below. */
export const personalTransferAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "The type screen offers only the ways to send that the bank has on; with none on it says \"Nothing to send with\"; with no saved payee of the chosen type it goes straight to a new payee." },
  { id: "AC-2", text: "To a BankWorkx® customer: found by mobile number, email or BankWorkx ID, shown by name, an unknown customer and one already saved are refused with the exact messages; it is free, instant, limited to 25,000.00 a payment and cannot be scheduled." },
  { id: "AC-3", text: "To another bank asks exactly the identifier fields of the home market, each with its message and the bank's own checks, and never shows a scheme or a country name." },
  { id: "AC-4", text: "To another country asks for the country, the name, the country's identifier and bank code and the SWIFT/BIC; each field is checked as listed; the purpose is required; the address and the relationship are asked when the rule applies (some countries, and 10,000 US dollars or more)." },
  { id: "AC-5", text: "The speeds on offer follow the bank's options and show arrival, limit and fee; one that is over the limit is marked and refused; the first that fits is chosen; the review shows the rate, the fee and what the person pays." },
  { id: "AC-6", text: "The amount is checked against the available balance (with the fee), the daily limit, the speed limit, the 25,000.00 limit of a BankWorkx® customer and the 500.00 allowance of a new payee, with the exact messages and a way to fix each." },
  { id: "AC-7", text: "Each type lists only its own saved payees (a payee at the home bank is \"To another bank\", any other is \"To another country\"); choosing one goes straight to the amount." },
  { id: "AC-8", text: "\"Later\" and \"Repeat\" appear only for the two bank types and only when the bank allows them; the dates are business days; nothing moves until the day; the payment is listed as scheduled." },
  { id: "AC-9", text: "A payment in another currency is priced for 60 seconds; after that the person gets a new price with the exchange-rate message, nothing is sent, and confirms again." },
  { id: "AC-10", text: "The result matches the case: sent, on its way, scheduled or held; the balance and the daily limit change only for a payment that goes now; a held payment changes neither and saves nobody." },
  { id: "AC-11", text: "\"Save this payee\" saves a payee typed in the payment as a new payee (24 hours, 500.00 allowance, what was already sent counts) when ticked, and not otherwise." },
  { id: "AC-12", text: "Every payment needs the confirmation tick and a one-time code that names the amount and the payee; three wrong codes stop it and no money moves." },
  { id: "AC-13", text: "A timeout on the payment tells the person to check Activity first and applies nothing; a service that is not available, a slow answer and a failing core each say that nothing was sent; every bank call has a way out." },
];

// The sandbox customer "alexpayees" has Main $8,720.76, Savings $15,254.37, EUR Travel €2,400.00, AED Home AED 11,000.00 and six saved payees:
// Taylor Brooks (BankWorkx), Jamie Lee and Casey Nguyen (another bank; Casey was added 3 hours ago), Marco Rossi, Lena Fischer and James Whitfield (abroad).
// "alexglobal" has the same accounts and no payees; "alexfull" has 50 payees.
const PERSONA = "alexpayees";
const NOW = "2026-11-02T09:31:00Z";
type Step = Record<string, unknown>;
const set = (v: Record<string, unknown>): Step => ({ set: v });
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const error = (e: string): Step => ({ expectError: e });
const bank = (adapter: string, path: string, equals: unknown, input?: Record<string, unknown>): Step => ({ expectBank: { adapter, path, equals, ...(input ? { input } : {}) } });
const balance = (account: string, equals: number): Step => bank("bank.accounts.list", `${account}.balance`, equals);
const used = (equals: number): Step => bank("bank.limits.get", "usedToday", equals);
/** Nothing has left any account and the daily limit is untouched. */
const unchanged: Step[] = [balance("acc_main", 8720.76), balance("acc_save", 15254.37), balance("acc_eur", 2400), balance("acc_aed", 11000), used(0)];

const BANKWORKX = "To a BankWorkx® customer", DOMESTIC = "To another bank", ABROAD = "To another country";
/** A saved payee: the type, then the row. */
const saved = (type: string, who: string): Step[] => [press(type), press(who)];
/** A new payee at another bank (valid in the sandbox: a routing number with a good check digit). */
const typed = (name = "Priya Raman", routing = "021000021", account = "987654321"): Step[] => [press(DOMESTIC), press("New payee"), set({ "pt.name": name, "pt.routing": routing, "pt.account": account }), press("Continue")];
/** A new payee in Germany (a valid IBAN). */
const german = (name = "Greta Vogel"): Step[] => [press(ABROAD), press("New payee"), set({ "pt.country": "DE", "pt.name": name, "pt.account": "DE89 3704 0044 0532 0130 00", "pt.swift": "COBADEFFXXX" }), press("Continue")];
/** From the amount screen to the review (another bank or another country: one stop in between for the speed). */
const toReview = (amount: number, extra: Record<string, unknown> = {}): Step[] => [set({ "pt.amount": amount, ...extra }), press("Continue"), screen("options"), press("Review"), screen("review")];
const confirm: Step[] = [set({ "pt.consent": true }), press("Confirm and send code")];
const code = (c = "482100"): Step[] => [set({ "otp.code": c })];
/** The whole way from the amount to the result. */
const pay = (amount: number, label: string, extra: Record<string, unknown> = {}): Step[] => [...toReview(amount, extra), ...confirm, ...code(), press(label)];
/** Money in the account so that a large amount can be reached (the checks on the amount come before the checks on the balance). */
const richMain = [{ adapter: "bank.deposit.create", input: { toAccountId: "acc_main", amount: 50000, fromCardId: "c_5832" } }];

const base = { persona: PERSONA, now: NOW };

export const personalTransferScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "Send money offers the three ways to send, each with its line", covers: ["AC-1"], ...base,
    steps: [screen("type"), text(BANKWORKX), text("Free and instant"), text(DOMESTIC), text(ABROAD), noText("Nothing to send with")],
  },
  {
    id: "T-2", name: "A way to send that the bank has switched off is not offered", covers: ["AC-1"], ...base,
    steps: [set({ "opt.typeIntl": false }), screen("type"), text(BANKWORKX), text(DOMESTIC), noText(ABROAD)],
  },
  {
    id: "T-3", name: "With every way off: Nothing to send with", covers: ["AC-1"], ...base,
    steps: [
      set({ "opt.typeInternal": false, "opt.typeDomestic": false, "opt.typeIntl": false }),
      text("Nothing to send with"), text("Sending money isn’t available right now."), noText(DOMESTIC), press("Continue"),
    ],
  },
  {
    id: "T-4", name: "A BankWorkx customer found by mobile number: name shown, free, instant, $100 sent and the balance moves", covers: ["AC-1", "AC-2", "AC-10"], ...base, persona: "alexglobal",
    steps: [
      press(BANKWORKX), screen("details"), text("Mobile number"),
      set({ "pt.mobile": "+1 202 555 0142" }), press("Continue"),
      screen("amount"), text("Taylor Brooks"), text("BankWorkx® customer"),
      set({ "pt.amount": 100 }), press("Continue"),
      screen("review"), text("Instant"), text("In seconds"), text("Free"), text("$100"), noText("Send on"), balance("acc_main", 8720.76),
      ...confirm, text("Authorise $100 to Taylor Brooks"), ...code(), press("Send $100"),
      screen("result"), text("Sent"), text("Delivered"), balance("acc_main", 8620.76), used(100),
    ],
  },
  {
    id: "T-5", name: "A customer is found by email or by ID too, and the fields check their format", covers: ["AC-2"], ...base,
    steps: [
      press(BANKWORKX), press("New payee"),
      set({ "pt.by": "email", "pt.email": "jordan.keller" }), press("Continue"), screen("details"), error("Enter a full email address."),
      set({ "pt.email": "Jordan.Keller@example.com" }), press("Continue"), screen("amount"), text("Jordan Keller"),
      press("Back"), press("Back"), press(BANKWORKX), press("New payee"),
      set({ "pt.by": "id", "pt.bwid": "j" }), press("Continue"), error("A BankWorkx ID has 3 to 24 letters, numbers, dots or dashes."),
      set({ "pt.bwid": "jkeller" }), press("Continue"), screen("amount"), text("Jordan Keller"),
      press("Back"), press("Back"), press(BANKWORKX), press("New payee"),
      set({ "pt.by": "mobile", "pt.mobile": "12" }), press("Continue"), error("Enter the mobile number with its country code."),
    ],
  },
  {
    id: "T-6", name: "An unknown customer and one already saved are refused with the exact words; nothing is asked of the bank for money", covers: ["AC-2"], ...base,
    steps: [
      press(BANKWORKX), press("New payee"),
      set({ "pt.by": "email", "pt.email": "nobody@example.com" }), press("Continue"),
      screen("details"), text("We can’t find a BankWorkx® customer with those details. Check them and try again."),
      set({ "pt.by": "id", "pt.bwid": "taylorb" }), press("Continue"),
      screen("details"), text("You’ve already saved this payee. Choose them from your saved payees."),
      ...unchanged,
    ],
  },
  {
    id: "T-7", name: "A BankWorkx customer over 25,000.00 is refused, and there is no When or speed to choose", covers: ["AC-2", "AC-6", "AC-8"], ...base,
    steps: [
      ...saved(BANKWORKX, "Taylor Brooks"), screen("amount"), set({ "pt.amount": 0 }), press("Continue"), screen("amount"), error("Enter an amount"),
      set({ "pt.amount": 30000 }), press("Continue"),
      screen("problem"), text("You can send up to $25,000.00 at a time."), text("No money has left your account."), press("Change amount"), screen("amount"),
      set({ "pt.amount": 20 }), press("Continue"), screen("review"), noText("Send on"), noText("When"), noText("Repeat"), ...unchanged,
    ],
  },
  {
    id: "T-8", name: "To another bank asks the routing number, the account number and the account type, with their messages, and names no scheme or country", covers: ["AC-3"], ...base,
    steps: [
      press(DOMESTIC), press("New payee"), screen("details"),
      text("Name"), text("Routing number"), text("Account number"), text("Account type"), text("Checking"), text("Savings"),
      noText("ACH"), noText("RTP"), noText("SWIFT"), noText("Fedwire"), noText("United States"), noText("Country"),
      press("Continue"), error("pt.routing"), error("pt.account"), error("pt.name"),
      set({ "pt.name": "!", "pt.routing": "12345", "pt.account": "12" }), press("Continue"),
      error("Use letters, numbers and spaces in the name."), error("That routing number isn’t valid. Check the 9 digits."), error("An account number has 4 to 17 digits."),
      // nine digits with a wrong check digit: the bank says so
      set({ "pt.name": "Priya Raman", "pt.routing": "123456789", "pt.account": "987654321" }), press("Continue"),
      screen("details"), text("That routing number isn't valid. Check the 9 digits."),
      set({ "pt.routing": "021000021" }), press("Continue"),
      screen("amount"), text("Priya Raman"), text("JPMorgan Chase"), text("••4321"),
    ],
  },
  {
    id: "T-9", name: "A payee already saved cannot be added again, and 50 payees is the most", covers: ["AC-3"], ...base,
    steps: [
      press(DOMESTIC), press("New payee"),
      set({ "pt.name": "Jamie Lee", "pt.routing": "031201360", "pt.account": "100006620" }), press("Continue"),
      screen("details"), text("You already saved this payee with these details."),
    ],
  },
  {
    id: "T-10", name: "At the most payees the bank allows, a new one is refused", covers: ["AC-3"], ...base, persona: "alexfull",
    steps: [
      press(DOMESTIC), press("New payee"),
      set({ "pt.name": "Priya Raman", "pt.routing": "021000021", "pt.account": "987654321" }), press("Continue"),
      screen("details"), text("You can save up to 50 payees. Delete one to add another."),
    ],
  },
  {
    id: "T-11", name: "To another country: the IBAN of Germany must be a German IBAN with good check digits, and the bank code must match the country", covers: ["AC-4"], ...base,
    steps: [
      press(ABROAD), press("New payee"), screen("details"),
      text("Country"), text("Germany"), text("Switzerland"), noText("United States"), noText("IBAN"),
      set({ "pt.country": "DE", "pt.name": "Greta Vogel", "pt.account": "DE12", "pt.swift": "COBA" }), text("IBAN"), text("SWIFT / BIC code"), noText("Transit"), noText("IFSC"), noText("BSB"), press("Continue"),
      error("That IBAN doesn’t look right. Check each character."), error("A SWIFT/BIC has 8 or 11 letters and numbers."),
      // a French IBAN for a German payee, and a German one with a wrong check digit: both look like an IBAN, the bank refuses them
      set({ "pt.account": "FR14 2004 1010 0505 0001 3M02 606", "pt.swift": "COBADEFFXXX" }), press("Continue"), screen("details"), text("That IBAN doesn’t look right. Check each character."),
      set({ "pt.account": "DE89 3704 0044 0532 0130 01" }), press("Continue"), screen("details"), text("That IBAN doesn’t look right. Check each character."),
      // a bank code of another country
      set({ "pt.account": "DE89 3704 0044 0532 0130 00", "pt.swift": "COBAFRFFXXX" }), press("Continue"), screen("details"), text("That bank code doesn’t match the country."),
      set({ "pt.swift": "COBADEFFXXX" }), press("Continue"),
      screen("amount"), text("Greta Vogel"), text("They receive (EUR)"),
    ],
  },
  {
    id: "T-12", name: "Canada asks a transit number, India an IFSC, Australia a BSB, Mexico an 18-digit account", covers: ["AC-4"], ...base,
    steps: [
      press(ABROAD), press("New payee"),
      set({ "pt.country": "CA", "pt.name": "Chloe Tremblay", "pt.account": "1234567", "pt.bankCode": "12-3", "pt.swift": "ROYCCAT2" }),
      text("Transit and institution number"), noText("IFSC"), noText("BSB"), press("Continue"),
      error("Use the 5-digit transit number and 3-digit institution number, like 00012-003."),
      set({ "pt.bankCode": "00012-003" }), press("Continue"), screen("amount"), text("They receive (CAD)"),
      press("Back"), press("Back"), press(ABROAD), press("New payee"),
      set({ "pt.country": "IN", "pt.name": "Asha Rao", "pt.account": "123456789012", "pt.bankCode": "HDFC1000001", "pt.swift": "HDFCINBB" }),
      text("IFSC code"), press("Continue"), error("An IFSC has 11 characters: 4 letters, a zero, then 6 letters or numbers."),
      set({ "pt.country": "AU", "pt.bankCode": "0620", "pt.swift": "CTBAAU2S" }),
      text("BSB"), press("Continue"), error("A BSB has 6 digits, like 062-000."),
      set({ "pt.country": "MX", "pt.account": "12345678901234567", "pt.swift": "BNMXMXMM" }),
      text("Account number"), press("Continue"), error("An account number has 18 digits."),
      set({ "pt.account": "123456789012345678" }), press("Continue"), screen("amount"), text("They receive (MXN)"),
    ],
  },
  {
    id: "T-13", name: "A SWIFT/BIC of another country is refused by the bank, and a country that is not on the list asks for no bank code", covers: ["AC-4"], ...base,
    steps: [
      press(ABROAD), press("New payee"),
      set({ "pt.country": "SG", "pt.name": "Wei Tan", "pt.account": "1234567", "pt.swift": "DBSSGBSG" }), noText("Transit"), noText("IFSC"), noText("BSB"),
      press("Continue"), screen("details"), text("That bank code doesn’t match the country."),
      set({ "pt.swift": "dbssSGSG" }), press("Continue"), screen("amount"), text("They receive (SGD)"),
    ],
  },
  {
    id: "T-14", name: "Each type lists only its own saved payees, with how long a new one stays new", covers: ["AC-7"], ...base,
    steps: [
      press(DOMESTIC), screen("payee"), text("Jam (Jamie Lee)"), text("Northwind Bank"), text("Casey Nguyen"), text("New · 21 hours left"), noText("Marco Rossi"), noText("Taylor Brooks"), noText("Lena Fischer"),
      press("Back"), screen("type"), press(ABROAD), text("Marco Rossi"), text("Lena Fischer"), text("James Whitfield"), noText("Jam (Jamie Lee)"), noText("Casey Nguyen"),
      press("Marco Rossi"), screen("amount"), text("Marco Rossi"), text("They receive (EUR)"),
    ],
  },
  {
    id: "T-15", name: "The speeds: the first that fits is chosen, one over its limit is marked and refused, the others show arrival, limit and fee", covers: ["AC-5"], ...base, setup: richMain,
    steps: [
      ...saved(DOMESTIC, "Jam (Jamie Lee)"), set({ "pt.amount": 30000 }), press("Continue"), screen("options"),
      text("Standard"), text("Over the limit"), text("Same day"), text("Today · $1.00"), text("Instant"), text("In seconds · up to $500,000.00 · $0.25"),
      press("Review"), screen("review"), text("Same day"), text("Today"), text("$1.00"), text("$30,001"),
      // the person insists on Standard: the bank refuses it for this amount
      press("Change amount"), screen("amount"), press("Continue"), screen("options"),
      set({ "pt.speed": "standard" }), press("Review"),
      screen("problem"), text("That speed is limited to $25,000.00 a payment. Choose another speed or send less."), press("Change speed"), screen("options"),
      set({ "pt.speed": "instant" }), press("Review"), screen("review"), text("Instant"), text("$0.25"),
    ],
  },
  {
    id: "T-16", name: "At $100 Standard is chosen and free; Instant costs $0.25 and shows in the review and the total", covers: ["AC-5", "AC-10"], ...base,
    steps: [
      ...saved(DOMESTIC, "Jam (Jamie Lee)"), set({ "pt.amount": 100 }), press("Continue"), screen("options"),
      text("1 to 2 business days · up to $25,000.00 · Free"),
      press("Review"), text("Standard"), text("1 to 2 business days"), text("Free"), text("$100"),
      press("Change amount"), press("Continue"), set({ "pt.speed": "instant" }), press("Review"),
      text("Instant"), text("$0.25"), text("$100.25"),
      ...confirm, text("Authorise $100 to Jamie Lee"), ...code(), press("Send $100"),
      screen("result"), text("Sent"), text("Delivered"), text("$100.25"), balance("acc_main", 8620.51), used(100), press("Track payment"),
    ],
  },
  {
    id: "T-17", name: "A payment to another bank at Standard: On its way, arrives in 1 to 2 business days, the balance moves by the amount", covers: ["AC-10"], ...base,
    steps: [
      ...saved(DOMESTIC, "Jam (Jamie Lee)"), ...pay(100, "Send $100"),
      screen("result"), text("On its way"), text("1 to 2 business days"), text("Ref TRX-"), balance("acc_main", 8620.76), used(100),
      press("Send another"), screen("type"),
    ],
  },
  {
    id: "T-18", name: "More than the account holds with the fee, and the balance with a fee that does not fit, are refused with the exact words", covers: ["AC-6"], ...base,
    steps: [
      ...saved(DOMESTIC, "Jam (Jamie Lee)"), set({ "pt.amount": 9000 }), press("Continue"),
      screen("problem"), text("Not enough in the account: you’d pay $9,000.00 but $8,720.76 is available."), press("Change amount"), screen("amount"),
      // everything they have goes with Standard (free); with Same day the fee does not fit
      set({ "pt.amount": 8720.76 }), press("Continue"), screen("options"), set({ "pt.speed": "sameDay" }), press("Review"),
      screen("problem"), text("Not enough in the account: you’d pay $8,721.76 but $8,720.76 is available."), press("Change amount"),
      press("Continue"), screen("options"), press("Review"), screen("review"), ...unchanged,
    ],
  },
  {
    id: "T-19", name: "More than what is left of the daily limit is refused, and the amount that is left is told", covers: ["AC-6"], ...base, conditions: { limitUsed: 45000 },
    steps: [
      ...saved(DOMESTIC, "Jam (Jamie Lee)"), set({ "pt.amount": 6000 }), press("Continue"),
      screen("problem"), text("That is over your remaining daily limit of $5,000.00."), press("Change amount"),
      set({ "pt.amount": 5000 }), press("Continue"), screen("options"),
    ],
  },
  {
    id: "T-20", name: "An amount above zero is needed, a payment over the largest limit is refused, and no speed on means no sending", covers: ["AC-6"], ...base,
    steps: [
      ...saved(DOMESTIC, "Jam (Jamie Lee)"), set({ "pt.amount": 0 }), press("Continue"), screen("amount"), error("Enter an amount"),
      set({ "opt.speedSameDay": false, "opt.speedInstant": false, "pt.amount": 30000 }), press("Continue"),
      screen("problem"), text("That is over the limit of $25,000.00. Try a smaller amount."), press("Change amount"),
      set({ "opt.speedStandard": false, "pt.amount": 100 }), press("Continue"),
      screen("problem"), text("Sending isn’t available right now. Try again later."), text("No money has left your account."), press("Change speed"), screen("options"),
    ],
  },
  {
    id: "T-21", name: "A payee added 3 hours ago may be sent $500.00: more is refused with the words of the rule, and the bank can switch the rule off", covers: ["AC-6"], ...base,
    steps: [
      ...saved(DOMESTIC, "Casey Nguyen"), text("Casey Nguyen is a new payee"), text("$500.00"), set({ "pt.amount": 600 }), press("Continue"),
      screen("problem"), text("Casey Nguyen was added 3 hours ago. For your security you can send up to $500.00 to a new beneficiary in the first 24 hours."),
      text("You can send up to $500.00 more now, or the full amount after 3 Nov 2026 06:31 UTC."), press("Change amount"),
      set({ "pt.amount": 500 }), press("Continue"), screen("options"),
      press("Change amount"), set({ "opt.coolingOff": false, "pt.amount": 600 }), noText("is a new payee"), press("Continue"), screen("options"),
    ],
  },
  {
    id: "T-22", name: "A payee typed in the payment is new too: over $500.00 is refused", covers: ["AC-6"], ...base,
    steps: [
      ...typed(), set({ "pt.amount": 600 }), press("Continue"),
      screen("problem"), text("Priya Raman was added 0 hours ago."), text("up to $500.00 more now"),
    ],
  },
  {
    id: "T-23", name: "An account that cannot send money is refused, and money cannot leave a foreign-currency account to pay someone", covers: ["AC-6"], ...base, conditions: { frozen: ["acc_save"] },
    steps: [
      ...saved(DOMESTIC, "Jam (Jamie Lee)"), noText("EUR Travel"), noText("AED Home"), text("Main"), text("Savings"),
      set({ "pt.from": "acc_save", "pt.amount": 100 }), press("Continue"),
      screen("problem"), text("You can’t send money from this account right now."), press("Choose account"), screen("amount"),
      set({ "pt.from": "acc_main" }), press("Continue"), screen("options"),
    ],
  },
  {
    id: "T-24", name: "Abroad in euros: what they get is fixed, the rate, the fee and what you pay are shown before the code", covers: ["AC-5", "AC-10"], ...base,
    steps: [
      ...saved(ABROAD, "Marco Rossi"), text("They receive (EUR)"), set({ "pt.amount": 100, "pt.purpose": "Family support" }), press("Continue"),
      screen("options"), text("Standard"), text("1 to 3 business days · $25.00"), noText("Priority"), noText("Instant"),
      press("Review"), screen("review"), text("They receive"), text("€100"), text("1 USD = 0.926 EUR"), text("$25.00"), text("$133"), noText("Send on"), balance("acc_main", 8720.76),
    ],
  },
  {
    id: "T-25", name: "Abroad: the purpose is needed, and the bank says so with the words of the screen", covers: ["AC-4"], ...base,
    steps: [
      ...saved(ABROAD, "Marco Rossi"), set({ "pt.amount": 100 }), press("Continue"),
      screen("problem"), text("Choose a purpose for this payment."), press("Edit"), screen("amount"),
      set({ "pt.purpose": "Rent" }), press("Continue"), screen("options"),
    ],
  },
  {
    id: "T-26", name: "Japan asks for the payee's address and who they are to you; a payment of $10,000 or more does too, in any country", covers: ["AC-4"], ...base, setup: richMain,
    steps: [
      press(ABROAD), press("New payee"),
      set({ "pt.country": "JP", "pt.name": "Kenji Sato", "pt.account": "12345678", "pt.swift": "MHCBJPJT" }), press("Continue"),
      screen("amount"), text("They receive (JPY)"), set({ "pt.amount": 1000.5, "pt.purpose": "Rent" }), press("Continue"), error("Enter a whole amount, without decimals"),
      set({ "pt.amount": 15100 }), press("Continue"),
      screen("address"), text("We need the payee’s address for this payment."), press("Continue"), screen("address"), error("pt.street"), error("pt.city"), error("pt.relationship"),
      set({ "pt.street": "1-1 Chome", "pt.city": "Tokyo", "pt.relationship": "Friend" }), press("Continue"),
      screen("options"), press("Review"), screen("review"), text("¥15,100"), text("1 USD = 151 JPY"), text("$125"),
      press("Change amount"), screen("amount"), press("Back"), screen("payee"),
      press("Marco Rossi"), set({ "pt.amount": 9500, "pt.purpose": "Rent", "pt.street": "", "pt.city": "", "pt.relationship": "" }), press("Continue"),
      screen("address"), set({ "pt.street": "Hauptstrasse 1", "pt.city": "Berlin", "pt.relationship": "Supplier or business" }), press("Continue"), screen("options"),
    ],
  },
  {
    id: "T-27", name: "Later: business days only, Repeat, the payment is scheduled and nothing moves; with Later off there is no When", covers: ["AC-8"], ...base,
    steps: [
      ...saved(DOMESTIC, "Jam (Jamie Lee)"), set({ "pt.amount": 100 }), press("Continue"), screen("options"),
      text("When"), text("Now"), text("Later"), noText("Send on"), noText("Repeat"),
      set({ "pt.when": "later" }), text("Send on"), text("Repeat"), text("Tue 3 Nov"), text("Mon 9 Nov"), noText("Sat 7 Nov"), noText("Sun 8 Nov"),
      press("Review"), screen("options"), error("pt.sendOn"),
      set({ "pt.sendOn": "2026-11-09", "pt.repeat": "monthly" }), press("Review"),
      screen("review"), text("Scheduled for Mon 9 Nov"), text("First payment"), text("Every month"), ...confirm, text("Authorise $100 to Jamie Lee"),
      ...code("12"), press("Schedule $100"), screen("otp"), error("Enter all 6 digits"),
      ...code("111111"), press("Schedule $100"), screen("otp"), ...code(), press("Schedule $100"),
      screen("result"), text("Scheduled"), text("Scheduled for Mon 9 Nov"), text("First payment"), press("See scheduled payments"),
      ...unchanged,
      bank("bank.schedules.list", "sch_new1.text", "Jamie Lee · Every month, Mon 9 Nov, $100.00"),
    ],
  },
  {
    id: "T-49", name: "A later payment that the bank cannot take: nothing is set up", covers: ["AC-8", "AC-13"], ...base, conditions: { unavailable: ["bank.payments.create"] },
    steps: [
      ...saved(DOMESTIC, "Jam (Jamie Lee)"), set({ "pt.amount": 100 }), press("Continue"), set({ "pt.when": "later", "pt.sendOn": "2026-11-09" }), press("Review"),
      ...confirm, ...code(), press("Schedule $100"), screen("unavailable"), text("Nothing was changed."), ...unchanged,
      bank("bank.schedules.list", "sch_rent.name", "Rent"),
    ],
  },
  {
    id: "T-28", name: "The bank can switch Later off: no When field", covers: ["AC-8"], ...base,
    steps: [
      set({ "opt.allowLater": false }), ...saved(DOMESTIC, "Jam (Jamie Lee)"), set({ "pt.amount": 100 }), press("Continue"), screen("options"),
      noText("When"), noText("Later"), noText("Send on"), press("Review"), screen("review"), noText("Repeats"),
    ],
  },
  {
    id: "T-29", name: "A payee that screening holds: Held for review, no balance change, no daily limit used, nobody saved", covers: ["AC-10", "AC-11"], ...base,
    steps: [
      ...typed("Test Sanctions", "021000021", "555566667"), ...pay(100, "Send $100"),
      screen("result"), text("Held for review"), text("We’re checking this payment and will tell you within one working day."), noText("Delivered"), noText("On its way"),
      ...unchanged, press("Back to Payments"),
    ],
  },
  {
    id: "T-30", name: "Save this payee left ticked: saved as a new payee, and what was sent counts against its $500.00", covers: ["AC-11"], ...base,
    steps: [
      ...typed(), ...pay(300, "Send $300"),
      screen("result"), text("On its way"), text("Priya Raman is saved as a new payee for 24 hours."), balance("acc_main", 8420.76),
      press("Send another"), press(DOMESTIC), text("Priya Raman"), text("New · 24 hours left"), press("Priya Raman"),
      set({ "pt.amount": 201 }), press("Continue"), screen("problem"), text("You can send up to $200.00 more now"),
    ],
  },
  {
    id: "T-31", name: "Save this payee unticked: not saved, but the next payment to the same account is still held to the allowance", covers: ["AC-11"], ...base,
    steps: [
      ...typed(), set({ "pt.amount": 300 }), press("Continue"), press("Review"), set({ "pt.save": false }), ...confirm, ...code(), press("Send $300"),
      screen("result"), text("On its way"), noText("is saved as a new payee"), balance("acc_main", 8420.76),
      press("Send another"), press(DOMESTIC), noText("Priya Raman"), press("New payee"),
      set({ "pt.name": "Priya Raman", "pt.routing": "021000021", "pt.account": "987654321" }), press("Continue"),
      set({ "pt.amount": 201 }), press("Continue"), screen("problem"), text("You can send up to $200.00 more now"),
    ],
  },
  {
    id: "T-32", name: "The price of a payment abroad lasts 60 seconds: after that a new price with the exchange-rate message, nothing sent, confirm again", covers: ["AC-9"], ...base,
    steps: [
      ...saved(ABROAD, "Marco Rossi"), ...toReview(100, { "pt.purpose": "Rent" }), text("1 USD = 0.926 EUR"),
      ...confirm, ...code(), { advance: 61 }, press("Send €100"),
      screen("review"), text("The exchange rate changed. Check the new amount and confirm again."), text("1 USD = 0.926185 EUR"), text("$132.97"), ...unchanged,
      ...confirm, ...code(), press("Send €100"),
      screen("result"), text("On its way"), balance("acc_main", 8587.79), used(107.97),
    ],
  },
  {
    id: "T-33", name: "Within the 60 seconds the price stays; in the same currency there is no rate to go stale", covers: ["AC-9"], ...base,
    steps: [
      ...saved(ABROAD, "Marco Rossi"), ...toReview(100, { "pt.purpose": "Rent" }),
      ...confirm, ...code(), { advance: 59 }, press("Send €100"), screen("result"), text("On its way"), noText("exchange rate changed"),
      press("Send another"), ...saved(DOMESTIC, "Jam (Jamie Lee)"), ...toReview(50),
      ...confirm, ...code(), { advance: 3600 }, press("Send $50"), screen("result"), text("On its way"),
    ],
  },
  {
    id: "T-34", name: "Priority and who pays the charges, when the bank turns them on: Priority $40.00, I pay all adds $15.00", covers: ["AC-5"], ...base,
    steps: [
      set({ "opt.speedPriority": true, "opt.chargeChoice": true }), ...saved(ABROAD, "Marco Rossi"),
      text("Who pays the bank charges?"), text("I pay all (+$15.00)"), set({ "pt.amount": 100, "pt.purpose": "Rent", "pt.charges": "ours" }), press("Continue"),
      screen("options"), text("Standard"), text("Priority"), text("Next business day · $55.00"), text("1 to 3 business days · $40.00"),
      set({ "pt.speed": "priority" }), press("Review"), screen("review"), text("Priority"), text("Next business day"), text("$55.00"), text("$163"),
    ],
  },
  {
    id: "T-35", name: "One speed can be taken down: it is marked, and asking for it is refused", covers: ["AC-5"], ...base, conditions: { unavailable: ["rail:rtp"] },
    steps: [
      ...saved(DOMESTIC, "Jam (Jamie Lee)"), set({ "pt.amount": 100 }), press("Continue"), screen("options"),
      text("Instant"), text("Not available right now"), set({ "pt.speed": "instant" }), press("Review"),
      screen("problem"), text("Sending isn’t available right now. Try again later."), press("Change speed"), screen("options"),
      set({ "pt.speed": "sameDay" }), press("Review"), screen("review"), text("Same day"),
    ],
  },
  {
    id: "T-36", name: "The bank can switch a speed off: it is not offered", covers: ["AC-5"], ...base,
    steps: [
      set({ "opt.speedInstant": false }), ...saved(DOMESTIC, "Jam (Jamie Lee)"), set({ "pt.amount": 100 }), press("Continue"), screen("options"),
      text("Standard"), text("Same day"), noText("Instant"),
    ],
  },
  {
    id: "T-37", name: "The confirmation must be ticked and the code must be six digits before anything is asked of the bank", covers: ["AC-12"], ...base,
    steps: [
      ...saved(DOMESTIC, "Jam (Jamie Lee)"), ...toReview(100),
      press("Confirm and send code"), screen("review"), error("Tick the confirmation first"),
      ...confirm, screen("otp"), press("Send $100"), screen("otp"), error("Enter all 6 digits"), ...unchanged,
    ],
  },
  {
    id: "T-38", name: "Three wrong codes stop the payment and no money moves", covers: ["AC-12"], ...base,
    steps: [
      ...saved(DOMESTIC, "Jam (Jamie Lee)"), ...toReview(100), ...confirm, ...code("111111"),
      press("Send $100"), screen("otp"), press("Send $100"), screen("otp"), press("Send $100"),
      screen("locked"), text("Too many wrong codes"), text("No money has left your account."), ...unchanged, press("Start again"), screen("type"),
    ],
  },
  {
    id: "T-39", name: "The bank does not answer the payment in time: Check Activity first, nothing applied", covers: ["AC-13"], ...base, conditions: { timeout: ["bank.payments.create"], latencyMs: 10000 },
    steps: [
      ...saved(DOMESTIC, "Jam (Jamie Lee)"), ...pay(100, "Send $100"),
      screen("timeout"), text("We didn't get an answer in time"), text("Check Activity before you try again, so you don't pay twice"), press("Check Activity"), ...unchanged,
    ],
  },
  {
    id: "T-40", name: "The payment service is not available: nothing sent, and Try again goes back to the review", covers: ["AC-13"], ...base, conditions: { unavailable: ["bank.payments.create"] },
    steps: [
      ...saved(DOMESTIC, "Jam (Jamie Lee)"), ...pay(100, "Send $100"),
      screen("unavailable"), text("Service not available"), text("Nothing was changed."), ...unchanged,
      press("Try again"), screen("review"),
    ],
  },
  {
    id: "T-41", name: "The core fails after the code: no money has left the account", covers: ["AC-13"], ...base, conditions: { transferFails: true },
    steps: [
      ...saved(DOMESTIC, "Jam (Jamie Lee)"), ...pay(100, "Send $100"),
      screen("failed"), text("We couldn't complete this right now."), text("No money has left your account."), ...unchanged, press("Start again"), screen("type"),
    ],
  },
  {
    id: "T-42", name: "The price service is not available (another bank, a BankWorkx customer): standard message, Try again comes back to the amount", covers: ["AC-13"], ...base, conditions: { unavailable: ["bank.payments.quote"] },
    steps: [
      ...saved(DOMESTIC, "Jam (Jamie Lee)"), set({ "pt.amount": 100 }), press("Continue"),
      screen("unavailable"), text("Nothing was changed."), press("Try again"), screen("amount"),
      press("Back"), screen("payee"), press("Back"), press(BANKWORKX), press("Taylor Brooks"), set({ "pt.amount": 20 }), press("Continue"), screen("unavailable"), ...unchanged,
    ],
  },
  {
    id: "T-43", name: "A slow answer to a question: nothing changed, it is safe to ask again", covers: ["AC-13"], ...base, conditions: { timeout: ["bank.payments.quote"], latencyMs: 10000 },
    steps: [
      ...saved(DOMESTIC, "Jam (Jamie Lee)"), set({ "pt.amount": 100 }), press("Continue"),
      screen("slow"), text("This is taking longer than expected. Nothing was changed."), noText("Check Activity"), press("Try again"), screen("amount"),
    ],
  },
  {
    id: "T-44", name: "The accounts cannot be loaded, or the payees: standard message, and Try again asks again", covers: ["AC-13"], ...base, conditions: { unavailable: ["bank.accounts.list"] },
    steps: [screen("unavailable"), text("Service not available"), press("Try again"), screen("unavailable")],
  },
  {
    id: "T-45", name: "The saved payees cannot be loaded: standard message, and Try again asks again", covers: ["AC-13"], ...base, conditions: { unavailable: ["bank.beneficiaries.list"] },
    steps: [press(DOMESTIC), screen("unavailable"), text("Nothing was changed."), press("Try again"), screen("type"), press(DOMESTIC), screen("unavailable")],
  },
  {
    id: "T-46", name: "The customer lookup and the payee check are not available: standard message, and Try again goes back to the details", covers: ["AC-13"], ...base, conditions: { unavailable: ["bank.payees.lookup", "bank.payees.validate"] },
    steps: [
      press(BANKWORKX), press("New payee"), set({ "pt.mobile": "+1 202 555 0177" }), press("Continue"), screen("unavailable"), press("Try again"), screen("details"),
      press("Back"), press(DOMESTIC), press("New payee"), set({ "pt.name": "Priya Raman", "pt.routing": "021000021", "pt.account": "987654321" }), press("Continue"),
      screen("unavailable"), press("Try again"), screen("details"),
    ],
  },
  {
    id: "T-47", name: "The code cannot be sent: standard message, nothing changed", covers: ["AC-13"], ...base, conditions: { unavailable: ["bank.otp.send"] },
    steps: [...saved(DOMESTIC, "Jam (Jamie Lee)"), ...toReview(100), ...confirm, screen("unavailable"), ...unchanged],
  },
  {
    id: "T-48", name: "A payee that is saved twice at once cannot be saved again; the payment is not made", covers: ["AC-11", "AC-13"], ...base,
    steps: [
      ...typed("Jamie Lee", "031201360", "100006620"), screen("details"), text("You already saved this payee with these details."), ...unchanged,
    ],
  },
];
