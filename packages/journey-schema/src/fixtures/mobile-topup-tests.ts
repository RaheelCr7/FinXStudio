import type { Journey } from "../schema";

/** What must be true for "Mobile top-up" to be right. Each is proved by at least one scenario below. AC-9 of the spec (a deep link that skips the operator step) needs launch values, which the engine does not have. */
export const mobileTopupAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "Only the operator's own amounts can be chosen: each operator offers its fixed amounts, and the bank refuses any other amount." },
  { id: "AC-2", text: "The number must match the home market's rule, with the market's message; spaces, brackets and hyphens are ignored." },
  { id: "AC-3", text: "Saved numbers for the chosen operator that fit the market are offered; \"Another number\" shows the number field, and with no saved number the field shows at once." },
  { id: "AC-4", text: "A top-up that would take one number above $300.00 for the day is refused with \"You’ve reached today’s top-up limit for this number.\"; exactly $300.00 is accepted." },
  { id: "AC-5", text: "An amount above the available balance, an account that cannot pay, or an amount over the daily limit is refused before the review with the message, and nothing is taken; the balance is checked again when the code is entered." },
  { id: "AC-6", text: "A wrong code takes no money; three wrong codes stop the journey; the right code takes the amount once, adds it to the activity list and shows \"Top-up sent\"." },
  { id: "AC-7", text: "With saveNumbers on, \"Save this number\" appears for a new number and saves it under the name given (2 to 20 characters); with it off, or for a number already saved, the switch is absent and nothing is saved." },
  { id: "AC-8", text: "A number ending 0000 or 1111 is refused with the messages \"We can’t top up this number. Check it and try again.\" and \"The operator isn’t available right now. Try again later.\"" },
  { id: "AC-10", text: "On timeout the person is told to check Activity first; when the bank is unavailable, or a slow or unavailable service is met on the way, nothing is taken." },
];

// The sandbox customer "alextopup" has Main $8,720.76, Savings $15,254.37, EUR Travel €2,400.00 and AED Home AED 11,000.00, a daily limit of $50,000.00
// and three saved numbers: My phone (5550123456) and Maya (5550987654) with Aster Mobile, Lena (5550765432) with Brightline. Today is Tuesday 3 November 2026.
const PERSONA = "alextopup";
const NOW = "2026-11-03T10:00:00Z";
type Step = Record<string, unknown>;
const set = (v: Record<string, unknown>): Step => ({ set: v });
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const error = (e: string): Step => ({ expectError: e });
const toast = (t: string): Step => ({ expectToast: t });
/** Reads one balance from the bank. */
const balance = (account: string, equals: number): Step => ({ expectBank: { adapter: "bank.accounts.list", path: `${account}.balance`, equals } });
const unchanged: Step[] = [balance("acc_main", 8720.76), balance("acc_save", 15254.37), balance("acc_eur", 2400), balance("acc_aed", 11000)];
const used = (equals: number): Step => ({ expectBank: { adapter: "bank.limits.get", path: "usedToday", equals } });
const saved = (id: string, field: string, equals: unknown): Step => ({ expectBank: { adapter: "bank.topup.numbers", path: `${id}.${field}`, equals } });

/** Choose the operator, the saved number and the amount: ends on the account step. */
const walk = (operator: string, who: string, amount: string): Step[] => [press(operator), press(who), press(amount)];
/** From the account step to the review (the bank checks the top-up on the way). */
const review: Step[] = [press("Continue"), screen("review")];
/** Tick the confirmation and ask for the code. */
const confirm: Step[] = [set({ "tu.consent": true }), press("Confirm and send code")];
const code = (c = "482100"): Step[] => [set({ "otp.code": c })];
/** The whole top-up, from the review to the receipt. */
const pay = (): Step[] => [...confirm, ...code(), press("Top up"), screen("success")];

const base = { persona: PERSONA, now: NOW };
type Setup = NonNullable<NonNullable<Journey["scenarios"]>[number]["setup"]>;
/** n top-ups of this amount to a number, made before the walk starts. */
const earlier = (n: number, amount = 50, number = "5550123456"): Setup =>
  Array.from({ length: n }).flatMap(() => [
    { adapter: "bank.otp.send" }, { adapter: "bank.otp.verify", input: { code: "482100" } },
    { adapter: "bank.topup.create", input: { operatorId: "aster", number, amount, fromAccountId: "acc_main" } },
  ]);
/** Main drained to the given balance before the walk. */
const drain = (left: number): Setup => [
  { adapter: "bank.otp.send" }, { adapter: "bank.otp.verify", input: { code: "482100" } },
  { adapter: "bank.transfers.own", input: { fromAccountId: "acc_main", toAccountId: "acc_save", amount: Math.round((8720.76 - left) * 100) / 100 } },
];

export const mobileTopupScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "Aster Mobile, My phone, $20, Main, code: Top-up sent; the balance falls by $20.00, the daily limit moves and Activity names the operator", covers: ["AC-1", "AC-6"], ...base,
    steps: [
      screen("op"), text("Aster Mobile"), text("Brightline"), text("Cobalt Wireless"),
      press("Aster Mobile"), screen("num"), press("My phone"), screen("amt"), press("$20.00"), screen("from"), text("Main"), text("Savings"), noText("EUR Travel"), noText("AED Home"),
      press("Continue"), screen("review"), text("You’re topping up $20.00"), text("Aster Mobile"), text("•••• 3456"), text("Main ••4410"), balance("acc_main", 8720.76),
      ...confirm, screen("otp"), text("Authorise $20.00 top-up"), text("We sent a 6-digit code to"), ...code(), press("Top up"),
      screen("success"), text("Top-up sent"), text("$20.00 added to •••• 3456."), text("Completed"), text("3 Nov 2026"), text("Aster Mobile"), text("Main ••4410"),
      balance("acc_main", 8700.76), balance("acc_save", 15254.37), used(20),
      { expectBank: { adapter: "bank.activity.list", path: "t_topup1.title", equals: "Aster Mobile top-up" } },
      { expectBank: { adapter: "bank.activity.list", path: "t_topup1.category", equals: "bills" } },
    ],
  },
  {
    id: "T-2", name: "Each operator offers only its own amounts", covers: ["AC-1"], ...base,
    steps: [
      press("Aster Mobile"), press("My phone"), screen("amt"), text("$5.00"), text("$10.00"), text("$20.00"), text("$50.00"), noText("$25.00"), noText("$30.00"), noText("$100.00"),
      press("Back"), press("Change"), press("Brightline"), press("Lena"), screen("amt"), text("$10.00"), text("$20.00"), text("$30.00"), text("$50.00"), noText("$5.00"), noText("$25.00"), noText("$100.00"),
      press("Back"), press("Change"), press("Cobalt Wireless"), set({ "tu.number": "5550123456" }), press("Continue"), screen("amt"),
      text("$5.00"), text("$10.00"), text("$25.00"), text("$100.00"), noText("$20.00"), noText("$30.00"), noText("$50.00"),
      ...unchanged,
    ],
  },
  {
    id: "T-3", name: "The bank refuses an amount that is not on the operator's list, even if one is forced in after the review: nothing is taken", covers: ["AC-1"], ...base,
    steps: [
      ...walk("Aster Mobile", "My phone", "$20.00"), ...review,
      set({ "tu.amount": 7 }), ...confirm, ...code(), press("Top up"),
      screen("problem"), text("Choose an amount."), text("Nothing was taken."), ...unchanged, used(0),
      press("Change amount"), screen("amt"), press("$10.00"), screen("from"),
    ],
  },
  {
    id: "T-4", name: "Market A: the number must be 10 digits; spaces, brackets and hyphens are ignored and the bank takes the number that way too", covers: ["AC-2"], ...base,
    steps: [
      press("Aster Mobile"), press("Another number"), press("Continue"), screen("num"), error("tu.number"),
      set({ "tu.number": "12345" }), press("Continue"), screen("num"), error("Enter the 10-digit number."),
      set({ "tu.number": "55501234567" }), press("Continue"), screen("num"), error("Enter the 10-digit number."),
      set({ "tu.number": "555-ABC-3456" }), press("Continue"), screen("num"), error("Enter the 10-digit number."),
      set({ "tu.number": "(555) 012-3456" }), press("Continue"), screen("amt"), press("$10.00"), ...review, text("•••• 3456"),
      ...pay(), text("$10.00 added to •••• 3456."), balance("acc_main", 8710.76),
    ],
  },
  {
    id: "T-5", name: "Market B: 11 digits starting 07; no saved number fits, so the field shows at once", covers: ["AC-2", "AC-3"], ...base,
    steps: [
      set({ "opt.market": "B" }), press("Aster Mobile"), screen("num"), noText("My phone"), noText("Maya"), noText("Another number"),
      set({ "tu.number": "0712345678" }), press("Continue"), screen("num"), error("Enter 11 digits, starting 07."),
      set({ "tu.number": "07700 90012" }), press("Continue"), screen("num"), error("Enter 11 digits, starting 07."),
      set({ "tu.number": "077 0090 0123" }), press("Continue"), screen("amt"), press("$10.00"), ...review, text("•••• 0123"),
    ],
  },
  {
    id: "T-6", name: "Market C: 8 to 12 digits", covers: ["AC-2"], ...base,
    steps: [
      set({ "opt.market": "C" }), press("Aster Mobile"), text("My phone"), press("Another number"), screen("num"),
      set({ "tu.number": "1234567" }), press("Continue"), screen("num"), error("Enter 8 to 12 digits."),
      set({ "tu.number": "1234567890123" }), press("Continue"), screen("num"), error("Enter 8 to 12 digits."),
      set({ "tu.number": "12345678" }), press("Continue"), screen("amt"), press("Back"),
      set({ "tu.number": "123456789012" }), press("Continue"), screen("amt"), press("$5.00"), ...review, text("•••• 9012"),
    ],
  },
  {
    id: "T-7", name: "Market D: 10 digits starting 05", covers: ["AC-2"], ...base,
    steps: [
      set({ "opt.market": "D" }), press("Aster Mobile"), screen("num"),
      set({ "tu.number": "0601234567" }), press("Continue"), screen("num"), error("Enter 10 digits, starting 05."),
      set({ "tu.number": "050123456" }), press("Continue"), screen("num"), error("Enter 10 digits, starting 05."),
      set({ "tu.number": "(050) 123-4567" }), press("Continue"), screen("amt"), press("$20.00"), ...review, text("•••• 4567"),
    ],
  },
  {
    id: "T-8", name: "Saved numbers of the chosen operator are offered with their last four digits; Another number shows the field", covers: ["AC-3"], ...base,
    steps: [
      press("Aster Mobile"), text("Saved numbers"), text("My phone"), text("•••• 3456"), text("Maya"), text("•••• 7654"), noText("Lena"), text("Another number"),
      press("Another number"), screen("num"), noText("Saved numbers"), noText("My phone"), noText("Another number"), text("Continue"),
      press("Change"), press("Brightline"), text("Lena"), text("•••• 5432"), noText("My phone"), noText("Maya"),
      press("Lena"), screen("amt"), text("$30.00"),
      press("Back"), press("Change"), press("Cobalt Wireless"), noText("Saved numbers"), noText("Another number"), text("Continue"),
    ],
  },
  {
    id: "T-9", name: "Six $50 top-ups to one number make $300.00; the next one is refused at the account step and nothing is taken; another number is not held to it", covers: ["AC-4"], ...base, setup: earlier(6),
    steps: [
      ...walk("Aster Mobile", "My phone", "$50.00"), press("Continue"), screen("problem"),
      text("You’ve reached today’s top-up limit for this number."), text("Nothing was taken."), text("Change amount"),
      balance("acc_main", 8420.76), used(300),
      press("Change amount"), screen("amt"), press("$5.00"), press("Continue"), screen("problem"), text("top-up limit for this number"),
      press("Change amount"), press("Back"), press("Maya"), press("$50.00"), ...review,
    ],
  },
  {
    id: "T-10", name: "Exactly $300.00 in a day is accepted; one more dollar is not", covers: ["AC-4"], ...base, setup: earlier(5),
    steps: [
      ...walk("Aster Mobile", "My phone", "$50.00"), ...review, ...pay(), text("$50.00 added to •••• 3456."), used(300), balance("acc_main", 8420.76),
      press("Top up again"), screen("op"), ...walk("Aster Mobile", "My phone", "$5.00"), press("Continue"), screen("problem"), text("You’ve reached today’s top-up limit for this number."),
      balance("acc_main", 8420.76),
    ],
  },
  {
    id: "T-11", name: "An account with $4.00 cannot top up $5.00: the message, nothing taken, and another account can", covers: ["AC-5"], ...base, setup: drain(4),
    steps: [
      ...walk("Aster Mobile", "My phone", "$5.00"), balance("acc_main", 4), press("Continue"), screen("problem"), text("Not enough in this account."), text("Nothing was taken."), text("Change account"),
      balance("acc_main", 4), used(0),
      press("Change account"), screen("from"), set({ "tu.from": "acc_save" }), ...review, text("Savings ••7731"),
    ],
  },
  {
    id: "T-12", name: "An account with exactly $5.00 can top up $5.00", covers: ["AC-5"], ...base, setup: drain(5),
    steps: [
      ...walk("Aster Mobile", "My phone", "$5.00"), ...review, ...pay(), text("$5.00 added to •••• 3456."), balance("acc_main", 0),
    ],
  },
  {
    id: "T-13", name: "The balance is checked again when the code is entered: an amount that grew after the review is refused and nothing is taken", covers: ["AC-5"], ...base, setup: drain(5),
    steps: [
      ...walk("Aster Mobile", "My phone", "$5.00"), ...review,
      set({ "tu.amount": 20 }), ...confirm, ...code(), press("Top up"),
      screen("problem"), text("Not enough in this account."), text("Nothing was taken."), balance("acc_main", 5), used(0),
      press("Change account"), screen("from"),
    ],
  },
  {
    id: "T-14", name: "An account that is frozen cannot top up; another can", covers: ["AC-5"], ...base, conditions: { frozen: ["acc_save"] },
    steps: [
      ...walk("Aster Mobile", "My phone", "$20.00"), set({ "tu.from": "" }), press("Continue"), screen("from"), error("tu.from"), set({ "tu.from": "acc_save" }), press("Continue"), screen("problem"), text("You can’t pay from this account right now."), text("Nothing was taken."),
      press("Change account"), screen("from"), set({ "tu.from": "acc_main" }), ...review,
      ...unchanged,
    ],
  },
  {
    id: "T-15", name: "An amount over the daily limit is refused before the review; exactly what is left is accepted", covers: ["AC-5"], ...base, conditions: { limitUsed: 49990 },
    steps: [
      ...walk("Aster Mobile", "My phone", "$20.00"), press("Continue"), screen("problem"), text("That is over your daily limit."), text("Nothing was taken."),
      press("Change amount"), press("$10.00"), ...review, text("$10.00"),
      ...pay(), balance("acc_main", 8710.76), used(50000),
    ],
  },
  {
    id: "T-16", name: "A wrong code takes no money and says so; the right code takes the amount once", covers: ["AC-6"], ...base,
    steps: [
      ...walk("Aster Mobile", "My phone", "$20.00"), ...review, ...confirm, ...code("111111"), press("Top up"),
      screen("otp"), toast("That code isn’t right. Try again."), ...unchanged, used(0),
      ...code(), press("Top up"), screen("success"), text("Top-up sent"), balance("acc_main", 8700.76), used(20),
    ],
  },
  {
    id: "T-17", name: "Three wrong codes stop the journey and nothing is taken", covers: ["AC-6"], ...base,
    steps: [
      ...walk("Aster Mobile", "My phone", "$20.00"), ...review, ...confirm, ...code("111111"), press("Top up"), screen("otp"), press("Top up"), screen("otp"), press("Top up"),
      screen("locked"), text("Too many wrong codes"), text("No money has left your account."), ...unchanged, used(0),
      press("Start again"), screen("op"),
    ],
  },
  {
    id: "T-18", name: "The confirmation must be ticked and the code must be six digits before anything is asked of the bank", covers: ["AC-6"], ...base,
    steps: [
      ...walk("Aster Mobile", "My phone", "$20.00"), ...review, press("Confirm and send code"), screen("review"), error("Tick the confirmation first"),
      ...confirm, screen("otp"), press("Top up"), screen("otp"), error("Enter all 6 digits"),
      ...code("12345"), press("Top up"), screen("otp"), error("Enter all 6 digits"),
      ...unchanged,
    ],
  },
  {
    id: "T-19", name: "Top up again starts a fresh top-up; each one takes its own amount once", covers: ["AC-6"], ...base,
    steps: [
      ...walk("Aster Mobile", "My phone", "$20.00"), ...review, ...pay(), balance("acc_main", 8700.76),
      press("Top up again"), screen("op"), ...walk("Brightline", "Lena", "$30.00"), ...review, text("•••• 5432"), ...pay(), text("$30.00 added to •••• 5432."), text("Brightline"),
      balance("acc_main", 8670.76), used(50),
      { expectBank: { adapter: "bank.activity.list", path: "t_topup2.title", equals: "Brightline top-up" } },
    ],
  },
  {
    id: "T-20", name: "A new number can be saved under a name of 2 to 20 characters; the receipt says so and the number is offered next time", covers: ["AC-7"], ...base,
    steps: [
      press("Aster Mobile"), press("Another number"), set({ "tu.number": "(555) 000-2222" }), press("Continue"), press("$10.00"), ...review,
      text("Save this number"), noText("For example, Mum"),
      set({ "tu.save": true }), text("Name"),
      press("Confirm and send code"), screen("review"), error("tu.name"),
      set({ "tu.name": "A", "tu.consent": true }), press("Confirm and send code"), screen("review"), error("Use 2 to 20 characters."),
      set({ "tu.name": "x".repeat(21) }), press("Confirm and send code"), screen("review"), error("Use 2 to 20 characters."),
      set({ "tu.name": "Family" }), press("Confirm and send code"), ...code(), press("Top up"), screen("success"), text("Family is saved."),
      saved("sn_new1", "name", "Family"), saved("sn_new1", "number", "5550002222"), saved("sn_new1", "operatorId", "aster"),
      press("Top up again"), press("Aster Mobile"), text("Family"), text("•••• 2222"),
    ],
  },
  {
    id: "T-21", name: "With saveNumbers off the switch is absent, and nothing is saved even if it were set", covers: ["AC-7"], ...base,
    steps: [
      set({ "opt.saveNumbers": false }), press("Aster Mobile"), press("Another number"), set({ "tu.number": "5550002222" }), press("Continue"), press("$10.00"), ...review,
      noText("Save this number"), set({ "tu.save": true, "tu.name": "Family" }), ...pay(), noText("is saved."),
      saved("sn_new1", "name", undefined),
    ],
  },
  {
    id: "T-22", name: "A number that is already saved does not offer to be saved again", covers: ["AC-7"], ...base,
    steps: [...walk("Aster Mobile", "My phone", "$10.00"), ...review, noText("Save this number"), noText("Name")],
  },
  {
    id: "T-23", name: "A number ending 0000 is refused with its message and Change number; one ending 1111 with its message and Try again; nothing is taken", covers: ["AC-8"], ...base,
    steps: [
      press("Aster Mobile"), press("Another number"), set({ "tu.number": "5550120000" }), press("Continue"), press("$10.00"), press("Continue"),
      screen("problem"), text("We can’t top up this number. Check it and try again."), text("Nothing was taken."), press("Change number"), screen("num"),
      set({ "tu.number": "5550121111" }), press("Continue"), press("$10.00"), press("Continue"),
      screen("problem"), text("The operator isn’t available right now. Try again later."), press("Try again"), screen("from"),
      ...unchanged, used(0),
    ],
  },
  {
    id: "T-24", name: "The bank does not answer in time when topping up: Check Activity first, nothing taken", covers: ["AC-10"], ...base,
    conditions: { timeout: ["bank.topup.create"], latencyMs: 10000 },
    steps: [
      ...walk("Aster Mobile", "My phone", "$20.00"), ...review, ...confirm, ...code(), press("Top up"),
      screen("timeout"), text("We didn't get an answer in time"), text("Check Activity before you try again"), press("Check Activity"),
      ...unchanged, used(0),
    ],
  },
  {
    id: "T-25", name: "The bank is unavailable when topping up: nothing taken, and Try again goes back to the review", covers: ["AC-10"], ...base, conditions: { unavailable: ["bank.topup.create"] },
    steps: [
      ...walk("Aster Mobile", "My phone", "$20.00"), ...review, ...confirm, ...code(), press("Top up"),
      screen("unavailable"), text("Service not available"), text("Nothing was changed."), press("Try again"), screen("review"),
      ...unchanged,
    ],
  },
  {
    id: "T-26", name: "The core fails after the code: no money has left the account", covers: ["AC-10"], ...base, conditions: { transferFails: true },
    steps: [
      ...walk("Aster Mobile", "My phone", "$20.00"), ...review, ...confirm, ...code(), press("Top up"),
      screen("failed"), text("We couldn't complete this right now."), text("No money has left your account."),
      ...unchanged,
    ],
  },
  {
    id: "T-27", name: "The operators cannot be loaded: standard message, and Try again asks again", covers: ["AC-10"], ...base, conditions: { unavailable: ["bank.carriers.list"] },
    steps: [screen("unavailable"), text("Service not available"), press("Try again"), screen("unavailable")],
  },
  {
    id: "T-28", name: "The saved numbers cannot be loaded: standard message, and Try again returns to the number", covers: ["AC-10"], ...base, conditions: { unavailable: ["bank.topup.numbers"] },
    steps: [press("Aster Mobile"), screen("unavailable"), press("Try again"), screen("unavailable")],
  },
  {
    id: "T-29", name: "The amounts cannot be loaded: standard message", covers: ["AC-10"], ...base, conditions: { unavailable: ["bank.topup.amounts"] },
    steps: [press("Aster Mobile"), press("My phone"), screen("unavailable"), press("Try again"), screen("unavailable")],
  },
  {
    id: "T-30", name: "The accounts cannot be loaded: standard message", covers: ["AC-10"], ...base, conditions: { unavailable: ["bank.accounts.list"] },
    steps: [press("Aster Mobile"), press("My phone"), press("$20.00"), screen("unavailable"), press("Try again"), screen("unavailable")],
  },
  {
    id: "T-31", name: "The number cannot be checked: standard message, and Try again returns to the account step", covers: ["AC-10"], ...base, conditions: { unavailable: ["bank.topup.check"] },
    steps: [...walk("Aster Mobile", "My phone", "$20.00"), press("Continue"), screen("unavailable"), text("Nothing was changed."), press("Try again"), screen("from"), ...unchanged],
  },
  {
    id: "T-32", name: "The number check is slow to answer: nothing was taken and the person can try again", covers: ["AC-10"], ...base, conditions: { timeout: ["bank.topup.check"], latencyMs: 10000 },
    steps: [
      ...walk("Aster Mobile", "My phone", "$20.00"), press("Continue"), screen("slow"), text("This is taking longer than expected."), text("Nothing was taken."), press("Try again"), screen("from"),
      ...unchanged,
    ],
  },
  {
    id: "T-33", name: "The code cannot be sent: standard message, nothing taken, and Try again returns to the review", covers: ["AC-10"], ...base, conditions: { unavailable: ["bank.otp.send"] },
    steps: [...walk("Aster Mobile", "My phone", "$20.00"), ...review, ...confirm, screen("unavailable"), press("Try again"), screen("review"), ...unchanged],
  },
];
