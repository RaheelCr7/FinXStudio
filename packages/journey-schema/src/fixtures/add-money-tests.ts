import type { Journey } from "../schema";

/** What must be true for "Add money" to be right. Each is proved by at least one scenario below. */
export const addMoneyAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "The customer chooses card or bank transfer; a way switched off is not offered and a line says it is not available." },
  { id: "AC-2", text: "A card top-up needs an amount from $10.00 to $5,000.00, an account, a card that has not expired and a 3-digit security code, with the messages of the spec." },
  { id: "AC-3", text: "An expired card cannot be chosen: it is listed apart as Expired, and the bank refuses it if it is sent." },
  { id: "AC-4", text: "With cardFee on, the fee (1.5%) and the total charged are shown before the code and on the receipt; with it off no fee line appears." },
  { id: "AC-5", text: "A code is asked before a card is charged, never for bank transfer details, and a wrong code charges nothing." },
  { id: "AC-6", text: "A successful top-up raises the chosen account by the amount (not the fee) and shows \"Money added\"." },
  { id: "AC-7", text: "Bank transfer shows the account's identifiers for the home market, the account name and the reference note." },
  { id: "AC-8", text: "When the bank is unavailable or does not answer in time the card is not charged and nothing is credited." },
  { id: "AC-9", text: "It needs payments.create, and the bank itself asks for the code and the security code and refuses an amount, card or account that a screen would not offer, whatever a screen does." },
  { id: "AC-10", text: "The security code, the one-time code and the tick are not kept: not on the receipt, not in what the journey holds once the bank has them." },
];

// Alex Morgan on Tuesday 3 November 2026 with the saved cards of the brief (the customer alexsave): Visa ••4242 (Harbor Bank 09/28), Mastercard ••5100 (Crest Bank 03/29) and Visa ••0019
// (Lakeside Bank 01/26, expired). Main ••4410 has $8,602.36 available, Savings ••7731 $15,254.37.
const NOW = "2026-11-03T10:00:00Z";
type Step = Record<string, unknown>;
const set = (v: Record<string, unknown>): Step => ({ set: v });
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const toast = (t: string): Step => ({ expectToast: t });
const forced = (adapter: string, input: Record<string, unknown>, c: string): Step => ({ expectBankError: { adapter, input, code: c } });
const avail = (id: string, equals: number): Step => ({ expectBank: { adapter: "bank.accounts.payFrom", path: `accounts.${id}.available`, equals } });
const base = { persona: "alexsave", now: NOW };
const code = (c = "482100"): Step[] => [set({ "otp.code": c }), press("Add money")];
/** The way chosen (a card), then the account, amount, card and security code of the spec's first test. */
const fill = (over: Record<string, unknown> = {}): Step[] => [set({ "am.amount": 200, "am.cardId": "c_4242", "am.cvv": "123", ...over }), press("Continue")];
const toCard: Step[] = [press("Continue"), screen("card")];
const toReview = (over: Record<string, unknown> = {}): Step[] => [...toCard, ...fill(over), screen("review")];
const toCode = (over: Record<string, unknown> = {}): Step[] => [...toReview(over), set({ "am.consent": true }), press("Confirm"), screen("code")];
/** A card ending 0000 (the network declines it), saved with the bank's own calls. */
const declined: NonNullable<Journey["scenarios"]>[number]["setup"] = [
  { adapter: "bank.cards.check", input: { number: "4242 0000 0000 0000", holder: "Alex Morgan", expiry: "12/29", cvv: "123", postcode: "62704", nickname: "Declined" } },
  { adapter: "bank.cards.verify", input: { method: "sms", code: "482100" } },
  { adapter: "bank.cards.add", input: { number: "4242 0000 0000 0000", holder: "Alex Morgan", expiry: "12/29", cvv: "123", postcode: "62704", nickname: "Declined" } },
];
const bankPath = (market: "us" | "uk" | "eu"): NonNullable<Journey["scenarios"]>[number]["config"] => ({ homeMarket: market });

export const addMoneyScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "A card top-up of 200.00 from Visa 4242: the review shows the 3.00 fee and 203.00 charged, a tick, the code sheet names 203.00; Money added and Main up by 200.00", covers: ["AC-1", "AC-2", "AC-4", "AC-5", "AC-6", "AC-9"], ...base,
    steps: [
      screen("method"), text("From a card"), text("Usually instant"), text("By bank transfer"), text("From an account at another bank"), press("Continue"), screen("card"),
      text("Main ••4410"), text("$8,602.36 available"), text("Savings ••7731"), text("From $10.00 to $5,000.00"), text("Visa ••4242"), text("Harbor Bank · expires 09/28"), text("Mastercard ••5100"), text("Crest Bank · expires 03/29"), text("Visa ••0019 · Expired"),
      ...fill(), screen("review"), text("Added to"), text("Main ••4410"), text("Visa ••4242"), text("Amount"), text("$200.00"), text("Card fee"), text("$3.00"), text("Charged to your card"), text("$203.00"),
      avail("acc_main", 8602.36), press("Confirm"), screen("review"), { expectError: "am.consent" }, avail("acc_main", 8602.36),
      set({ "am.consent": true }), press("Confirm"), screen("code"), text("Authorise $203.00 from Visa ••4242"), text("Code sent to"), avail("acc_main", 8602.36),
      ...code(), screen("done"), text("Money added"), text("$200.00 is in Main ••4410."), text("Reference ADD-20261103-"), text("Card fee"), text("$3.00"), text("$203.00"),
      avail("acc_main", 8802.36), avail("acc_save", 15254.37), text("View accounts"), text("Add more"),
    ],
  },
  {
    id: "T-2", name: "Amount rules: 5.00, 6,000, a security code of 2 digits, none, and no card are each refused with their words; 10.00 and 5,000.00 are accepted", covers: ["AC-2"], ...base,
    steps: [
      ...toCard,
      ...fill({ "am.amount": 5 }), screen("card"), { expectError: "am.amount" }, text("The smallest amount is $10.00."),
      ...fill({ "am.amount": 6000 }), screen("card"), { expectError: "am.amount" }, text("The most you can add at once is $5,000.00."),
      set({ "am.amount": null }), press("Continue"), screen("card"), { expectError: "am.amount" },
      ...fill({ "am.cvv": "12" }), screen("card"), { expectError: "am.cvv" }, text("Enter the 3 digits on the back of the card."),
      ...fill({ "am.cvv": "" }), screen("card"), text("Enter the 3 digits on the back of the card."), noText("Review"),
      ...fill({ "am.cardId": "" }), screen("card"), text("Choose a card."),
      ...fill({ "am.amount": 10 }), screen("review"), text("$10.00"), text("$0.15"), text("$10.15"), press("Back"), screen("card"),
      ...fill({ "am.amount": 5000 }), screen("review"), text("$75.00"), text("$5,075.00"),
    ],
  },
  {
    id: "T-3", name: "An expired card is listed apart as Expired and is not among the cards to choose; sending it is refused with its words", covers: ["AC-3"], ...base,
    steps: [
      ...toCard, text("Visa ••0019 · Expired"), noText("Lakeside Bank"),
      ...fill({ "am.cardId": "c_0019" }), screen("card"), text("This card has expired. Choose another card."), noText("Review"),
      ...fill({ "am.cardId": "c_5100" }), screen("review"), text("Mastercard ••5100"),
    ],
  },
  {
    id: "T-4", name: "With cardFee off there is no fee line on the review or the receipt and the card is charged 200.00", covers: ["AC-4"], ...base, launch: { "opt.cardFee": false },
    steps: [
      ...toReview(), noText("Card fee"), text("Charged to your card"), text("$200.00"), noText("$203.00"),
      set({ "am.consent": true }), press("Confirm"), text("Authorise $200.00 from Visa ••4242"), ...code(), screen("done"), noText("Card fee"), text("$200.00 is in Main ••4410."), avail("acc_main", 8802.36),
    ],
  },
  {
    id: "T-5", name: "With allowCard off the card way is not offered and says so; the person goes on to bank transfer", covers: ["AC-1"], ...base, launch: { "opt.allowCard": false },
    steps: [screen("method"), text("From a card isn’t available at your bank."), noText("Usually instant"), text("By bank transfer"), press("Continue"), screen("bank")],
  },
  {
    id: "T-6", name: "With allowTransfer off bank transfer is not offered and says so", covers: ["AC-1"], ...base, launch: { "opt.allowTransfer": false },
    steps: [screen("method"), text("By bank transfer isn’t available at your bank."), noText("From an account at another bank"), text("Usually instant"), press("Continue"), screen("card")],
  },
  {
    id: "T-7", name: "With both ways off nothing can be chosen", covers: ["AC-1"], ...base, launch: { "opt.allowCard": false, "opt.allowTransfer": false },
    steps: [screen("method"), text("From a card isn’t available at your bank."), text("By bank transfer isn’t available at your bank."), noText("Continue"), noText("Usually instant")],
  },
  {
    id: "T-8", name: "Bank transfer in Market A shows the routing number and account number, the name Alex Morgan and the reference note; Details ready, no code", covers: ["AC-5", "AC-7"], ...base, config: bankPath("us"),
    steps: [
      set({ "am.method": "bank" }), press("Continue"), screen("bank"), text("Main ••4410"), press("Show details"), screen("details"),
      text("Details ready"), text("Send money to this account from your other bank."), text("Main ••4410"), text("Routing number"), text("100200300"), text("Account number"), text("0000004410"),
      text("Account name"), text("Alex Morgan"), text("Money usually arrives the same day. Use your name as the reference."), noText("Confirm with your code"), avail("acc_main", 8602.36),
    ],
  },
  {
    id: "T-9", name: "Bank transfer in Market B shows the sort code and account number of the account chosen", covers: ["AC-7"], ...base, config: bankPath("uk"),
    steps: [set({ "am.method": "bank" }), press("Continue"), set({ "am.to": "acc_save" }), press("Show details"), screen("details"), text("Savings ••7731"), text("Sort code"), text("20-30-40"), text("Account number"), text("00007731"), text("Alex Morgan")],
  },
  {
    id: "T-10", name: "Bank transfer in Market C shows the IBAN and the BIC", covers: ["AC-7"], ...base, config: bankPath("eu"),
    steps: [set({ "am.method": "bank" }), press("Continue"), press("Show details"), screen("details"), text("IBAN"), text("US00 BWX 0000 0000 4410"), text("BIC"), text("BWXBUS33"), text("Alex Morgan")],
  },
  {
    id: "T-11", name: "An account that is not the person's is refused on the bank transfer screen with the bank's words", covers: ["AC-7"], ...base,
    steps: [set({ "am.method": "bank" }), press("Continue"), set({ "am.to": "nope" }), press("Show details"), screen("bank"), text("We can’t find that account. Choose another."), set({ "am.to": "acc_main" }), press("Show details"), screen("details")],
  },
  {
    id: "T-12", name: "Opened with an account the top-up goes to that account: Savings is credited and Main is not", covers: ["AC-6"], ...base, launch: { "launch.accountId": "acc_save" },
    steps: [...toCode(), ...code(), screen("done"), text("Savings ••7731"), avail("acc_save", 15454.37), avail("acc_main", 8602.36)],
  },
  {
    id: "T-13", name: "Opened with an amount it is filled in; an account that is not the person's is ignored", covers: ["AC-6"], ...base, launch: { "launch.amount": 75, "launch.accountId": "acc_nope" },
    steps: [...toCard, { expectText: "$8,602.36 available" }, set({ "am.cardId": "c_4242", "am.cvv": "123" }), press("Continue"), screen("review"), text("$75.00"), text("Main ••4410"), text("$1.13"), text("$76.13")],
  },
  {
    id: "T-14", name: "A wrong code charges nothing and says so; the right code goes on", covers: ["AC-5", "AC-6"], ...base,
    steps: [...toCode(), ...code("111111"), toast("That code isn’t right. Try again."), screen("code"), noText("Money added"), avail("acc_main", 8602.36), ...code(), screen("done"), avail("acc_main", 8802.36)],
  },
  {
    id: "T-15", name: "Three wrong codes end the attempt: nothing credited, nothing charged, and the security code is not kept", covers: ["AC-5", "AC-10"], ...base,
    steps: [...toCode(), ...code("111111"), ...code("111111"), ...code("111111"), screen("locked"), text("Too many wrong codes"), text("Nothing was charged."), avail("acc_main", 8602.36), press("Start again"), screen("method")],
  },
  {
    id: "T-16", name: "An empty code is not sent", covers: ["AC-5"], ...base,
    steps: [...toCode(), press("Add money"), screen("code"), { expectError: "otp.code" }, avail("acc_main", 8602.36)],
  },
  {
    id: "T-17", name: "A card the network declines is refused with its words and nothing is credited", covers: ["AC-3", "AC-2"], ...base, setup: declined,
    steps: [...toCard, ...fill({ "am.cardId": "c_0000" }), screen("card"), text("Your card was declined. Try another card."), avail("acc_main", 8602.36)],
  },
  {
    id: "T-18", name: "An account that cannot receive money is refused on the card screen, and Savings works", covers: ["AC-6", "AC-2"], ...base, conditions: { frozen: ["acc_main"] },
    steps: [
      ...toCard, text("Frozen"), ...fill({ "am.to": "acc_main" }), screen("card"), text("This account can’t receive money right now. Choose another account."),
      ...fill({ "am.to": "acc_save", "am.cvv": "123" }), screen("review"), text("Savings ••7731"),
    ],
  },
  {
    id: "T-19", name: "With no usable card the screen says so and offers Add a card, which opens that journey", covers: ["AC-3"], persona: "sam", now: NOW,
    steps: [...toCard, text("You have no saved card that can be used."), press("Add a card"), { expectOpens: { journey: "add-card" } }],
  },
  {
    id: "T-20", name: "When the bank is unavailable the card is not charged and nothing is credited", covers: ["AC-8"], ...base, conditions: { unavailable: ["bank.deposit.create"] },
    steps: [...toCard, ...fill(), screen("unavailable"), text("We couldn’t reach the bank"), text("Nothing was sent and you haven’t been charged. Try again in a moment."), avail("acc_main", 8602.36), press("Try again"), screen("method")],
  },
  {
    id: "T-21", name: "When the bank does not answer in time nothing is credited and the person is told to check Activity", covers: ["AC-8"], ...base, conditions: { timeout: ["bank.deposit.create"], latencyMs: 10000 },
    steps: [...toCard, ...fill(), screen("timeout"), text("This is taking longer than expected"), text("We didn’t get an answer in time. Check Activity before you try again, so you don’t pay twice."), avail("acc_main", 8602.36), press("Try again"), screen("method")],
  },
  {
    id: "T-22", name: "When the accounts cannot be read, nothing starts", covers: ["AC-8"], ...base, conditions: { unavailable: ["bank.accounts.payFrom"] },
    steps: [screen("unavailable"), text("Nothing was sent and you haven’t been charged.")],
  },
  {
    id: "T-23", name: "When the saved cards cannot be read, nothing starts", covers: ["AC-8"], ...base, conditions: { timeout: ["bank.deposit.cards"], latencyMs: 10000 },
    steps: [screen("timeout")],
  },
  {
    id: "T-24", name: "When the code cannot be sent, nothing goes on and the card is not charged", covers: ["AC-8"], ...base, conditions: { unavailable: ["bank.otp.send"] },
    steps: [...toReview(), set({ "am.consent": true }), press("Confirm"), screen("unavailable"), avail("acc_main", 8602.36)],
  },
  {
    id: "T-25", name: "When the details of the account cannot be read, none are shown", covers: ["AC-8", "AC-7"], ...base, conditions: { unavailable: ["bank.accounts.get"] },
    steps: [set({ "am.method": "bank" }), press("Continue"), press("Show details"), screen("unavailable"), noText("Details ready")],
  },
  {
    id: "T-26", name: "When the name on the account cannot be read, no details are shown", covers: ["AC-8", "AC-7"], ...base, conditions: { timeout: ["bank.profile.get"], latencyMs: 10000 },
    steps: [set({ "am.method": "bank" }), press("Continue"), press("Show details"), screen("timeout"), noText("Details ready")],
  },
  {
    id: "T-27", name: "Without payments.create it is not available, and the bank refuses a card top-up whatever a screen does", covers: ["AC-9"], ...base, conditions: { withoutPermissions: ["payments.create"] },
    steps: [screen("denied"), text("Not available"), forced("bank.deposit.create", { toAccountId: "acc_main", fromCardId: "c_4242", amount: 200, securityCode: "123" }, "PERMISSION_DENIED")],
  },
  {
    id: "T-28", name: "The bank asks for the code itself and refuses an amount, a card, a security code or an account that a screen would not offer", covers: ["AC-9", "AC-2", "AC-3", "AC-5"], ...base, setup: declined,
    steps: [
      forced("bank.deposit.create", { toAccountId: "acc_main", fromCardId: "c_4242", amount: 200, securityCode: "123" }, "OTP_REQUIRED"),
      forced("bank.deposit.create", { toAccountId: "acc_main", fromCardId: "c_4242", amount: 5, securityCode: "123" }, "INVALID_AMOUNT"),
      forced("bank.deposit.create", { toAccountId: "acc_main", fromCardId: "c_4242", amount: 6000, securityCode: "123" }, "LIMIT_EXCEEDED"),
      forced("bank.deposit.create", { toAccountId: "acc_main", fromCardId: "c_4242", amount: 10.005, securityCode: "123" }, "INVALID_AMOUNT"),
      forced("bank.deposit.create", { toAccountId: "acc_main", fromCardId: "c_0019", amount: 200, securityCode: "123" }, "CARD_EXPIRED"),
      forced("bank.deposit.create", { toAccountId: "acc_main", fromCardId: "c_0000", amount: 200, securityCode: "123" }, "CARD_DECLINED"),
      forced("bank.deposit.create", { toAccountId: "acc_main", fromCardId: "c_nope", amount: 200, securityCode: "123" }, "CARD_NOT_FOUND"),
      forced("bank.deposit.create", { toAccountId: "acc_main", fromCardId: "c_4242", amount: 200, securityCode: "12" }, "CVV_INVALID"),
      forced("bank.deposit.create", { toAccountId: "acc_main", fromCardId: "c_4242", amount: 200 }, "CVV_INVALID"),
      forced("bank.deposit.create", { toAccountId: "acc_nope", fromCardId: "c_4242", amount: 200, securityCode: "123" }, "ACCOUNT_NOT_FOUND"),
      forced("bank.deposit.create", { toAccountId: "acc_main", fromCardId: "c_4242", amount: 200, securityCode: "123", allowCard: false }, "CARD_OFF"),
      avail("acc_main", 8602.36),
    ],
  },
  {
    id: "T-29", name: "The bank refuses an account that cannot receive money, whatever a screen does", covers: ["AC-9", "AC-6"], ...base, conditions: { frozen: ["acc_main"] },
    steps: [forced("bank.deposit.create", { toAccountId: "acc_main", fromCardId: "c_4242", amount: 200, securityCode: "123" }, "ACCOUNT_CANNOT_CREDIT"), avail("acc_save", 15254.37)],
  },
  {
    id: "T-30", name: "After the result the journey holds neither the security code nor the one-time code, and the receipt does not show them", covers: ["AC-10"], ...base,
    steps: [...toCode(), ...code(), screen("done"), noText("123"), noText("482100")],
  },
  {
    id: "T-31", name: "Add more starts again with nothing kept from the last top-up", covers: ["AC-10", "AC-6"], ...base,
    steps: [...toCode(), ...code(), screen("done"), press("Add more"), screen("method"), press("Continue"), screen("card"), ...fill({ "am.cvv": "" }), screen("card"), text("Enter the 3 digits on the back of the card.")],
  },
  {
    id: "T-32", name: "View accounts opens the accounts", covers: ["AC-6"], ...base,
    steps: [...toCode(), ...code(), press("View accounts"), { expectOpens: { journey: "accounts" } }],
  },
];
