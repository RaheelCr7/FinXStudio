import type { Journey } from "../schema";

/** What must be true for "Repay a loan" to be right. Each is proved by at least one scenario below. */
export const repayLoanAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "The next instalment shows its due date and amount; another amount shows only when allowCustom is on; settle only when allowSettle is on." },
  { id: "AC-2", text: "The settlement figure (balance, interest since the last payment, fee) is shown on its card before it is chosen." },
  { id: "AC-3", text: "The fee applies only with settleFee on and more than 12 payments left." },
  { id: "AC-4", text: "Another amount is at least $10.00 and below the balance, with the messages of the spec." },
  { id: "AC-5", text: "The account that pays must hold the amount to pay." },
  { id: "AC-6", text: "Review shows the amount to pay and the balance after; a tick and a code are asked before anything is paid; a wrong code pays nothing." },
  { id: "AC-7", text: "Paying the next instalment lowers the balance by its principal part and moves the next date one month." },
  { id: "AC-8", text: "Settling pays off the loan and removes it from the Save tab." },
  { id: "AC-9", text: "With one loan, the choice of loan is skipped; with none, the journey says so." },
  { id: "AC-10", text: "When the bank is unavailable or times out nothing is paid." },
  { id: "AC-11", text: "The journey needs payments.create; the bank itself asks for the code and refuses what a screen would not offer, whatever a screen does." },
];

// Alex Morgan on Tuesday 3 November 2026: Main ••4410 with $8,602.36 available, Savings ••7731 with $15,254.37, and the loan ln1 (Personal loan, $9,600.00 left, 9.90%, instalment $412.50, 24 payments left, last paid 1 Nov, next 1 Dec).
const NOW = "2026-11-03T10:00:00Z";
type Step = Record<string, unknown>;
const set = (v: Record<string, unknown>): Step => ({ set: v });
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const toast = (t: string): Step => ({ expectToast: t });
const forced = (adapter: string, input: Record<string, unknown>, c: string): Step => ({ expectBankError: { adapter, input, code: c } });
const bank = (adapter: string, input: Record<string, unknown>, path: string, equals: unknown): Step => ({ expectBank: { adapter, input, path, equals } });
const avail = (id: string, equals: number): Step => bank("bank.accounts.payFrom", {}, `accounts.${id}.available`, equals);
const loans = (path: string, equals: unknown): Step => bank("bank.loans.list", { pick: true }, path === "count" ? path : `items.${path}`, equals);
const base = { persona: "alex", now: NOW, launch: { "launch.loanId": "ln1" } };
const code = (c = "482100"): Step[] => [set({ "otp.code": c }), press("Confirm")];
const toFrom = (extra: Record<string, unknown> = {}): Step[] => [screen("opt"), ...(Object.keys(extra).length ? [set(extra)] : []), press("Continue"), screen("from")];
const toReview = (extra: Record<string, unknown> = {}): Step[] => [...toFrom(extra), press("Review"), screen("review")];
const toCode = (extra: Record<string, unknown> = {}): Step[] => [...toReview(extra), set({ "rp.consent": true }), press("Pay"), screen("code")];
const settle = { "rp.option": "settle", "rp.from": "acc_save" };
/** A second loan of $1,000.00 over 12 months (12 payments left, so no early settlement fee), made with the bank's own calls. */
const twelve: NonNullable<Journey["scenarios"]>[number]["setup"] = [
  { adapter: "bank.loans.eligibility", input: { amount: 1000, term: 12, purpose: "Other", employment: "Employed", income: 5000, commitments: 0 } },
  { adapter: "bank.otp.send" }, { adapter: "bank.otp.verify", input: { code: "482100" } },
  { adapter: "bank.loans.apply", input: { amount: 1000, term: 12, rate: 8.9, accountId: "acc_main" } },
];

export const repayLoanScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "Pay the next instalment: 412.50 due 1 Dec 2026; the review says 9,266.70 is left; a tick and the code; Payment made, the next payment is 1 Jan 2027", covers: ["AC-1", "AC-6", "AC-7"], ...base,
    steps: [
      screen("opt"), text("How much?"), text("Personal loan · $9,600.00 left"), text("Pay next instalment"), text("Due 1 Dec 2026 · $412.50"), text("Pay another amount"), text("Reduces what you owe"), text("Settle in full"),
      press("Continue"), screen("from"), text("Main ••4410"), press("Review"), screen("review"), text("Personal loan"), text("Main ••4410"), text("$412.50"), text("$9,266.70"), noText("Early settlement fee"),
      press("Pay"), screen("review"), { expectError: "rp.consent" }, text("Tick the box to continue."), loans("count", 1),
      set({ "rp.consent": true }), press("Pay"), screen("code"), text("Authorise $412.50 to Personal loan"), loans("ln1.outstanding", 9600), avail("acc_main", 8602.36),
      ...code(), screen("doneRepay"), text("Payment made"), text("Your next payment is 1 Jan 2027."), text("Reference LR-20261103-"), text("Next payment"), text("1 Jan 2027"), text("Balance now"), text("$9,266.70"), text("View Save"),
      loans("ln1.outstanding", 9266.7), loans("ln1.nextDue", "2027-01-01"), avail("acc_main", 8189.86),
    ],
  },
  {
    id: "T-2", name: "Another amount: 5.00 is below the smallest payment, 9,600.00 says to settle, 200.00 leaves 9,400.00 and the date stays 1 Dec 2026", covers: ["AC-4", "AC-6", "AC-7"], ...base,
    steps: [
      screen("opt"), set({ "rp.option": "custom", "rp.amount": 5 }), press("Continue"), screen("opt"), text("The smallest payment is $10.00."),
      set({ "rp.amount": 9600 }), press("Continue"), press("Review"), screen("opt"), text("To pay everything off, choose Settle in full."), noText("Review"),
      set({ "rp.amount": 200 }), press("Continue"), press("Review"), screen("review"), text("$200.00"), text("$9,400.00"),
      set({ "rp.consent": true }), press("Pay"), ...code(), screen("doneRepay"), text("$9,400.00 left to pay."), loans("ln1.outstanding", 9400), loans("ln1.nextDue", "2026-12-01"), avail("acc_main", 8402.36),
    ],
  },
  {
    id: "T-3", name: "A payment of one instalment or more moves the date: 450.00 leaves 9,150.00 and the next payment is 1 Jan 2027", covers: ["AC-4", "AC-7"], ...base,
    steps: [screen("opt"), set({ "rp.option": "custom", "rp.amount": 450 }), press("Continue"), press("Review"), set({ "rp.consent": true }), press("Pay"), ...code(), screen("doneRepay"), loans("ln1.outstanding", 9150), loans("ln1.nextDue", "2027-01-01"), text("1 Jan 2027")],
  },
  {
    id: "T-4", name: "Settle in full: the card says the 96.00 fee and 9,701.21; the review shows the balance, 5.21 of interest, the fee and what is paid; Loan settled and the loan is gone", covers: ["AC-2", "AC-3", "AC-6", "AC-8"], ...base,
    steps: [
      screen("opt"), text("Includes a $96.00 early settlement fee · $9,701.21"), ...toReview(settle), text("Balance"), text("$9,600.00"), text("Interest to date"), text("$5.21"), text("Early settlement fee"), text("$96.00"), text("You pay"), text("$9,701.21"), text("Balance after"), text("$0.00"), text("Savings ••7731"),
      set({ "rp.consent": true }), press("Pay"), screen("code"), text("Authorise $9,701.21 to Personal loan"), ...code(), screen("doneSettle"), text("Loan settled"), text("The loan is paid off."), text("Reference LR-20261103-"), text("Balance now"),
      loans("count", 0), avail("acc_save", 5553.16), avail("acc_main", 8602.36),
    ],
  },
  {
    id: "T-5", name: "With 12 payments left there is no early settlement fee", covers: ["AC-3", "AC-2"], ...base, launch: { "launch.loanId": "ln2" }, setup: twelve,
    steps: [screen("opt"), text("No early settlement fee · $1,000.00"), noText("Includes a"), ...toReview({ "rp.option": "settle" }), noText("Early settlement fee"), text("$1,000.00")],
  },
  {
    id: "T-6", name: "With settleFee off there is no fee on the card, and the total is 9,605.21", covers: ["AC-3"], ...base, launch: { "launch.loanId": "ln1", "opt.settleFee": false },
    steps: [screen("opt"), text("No early settlement fee · $9,605.21"), noText("$96.00")],
  },
  {
    id: "T-7", name: "With allowCustom and allowSettle off those cards are not offered, and the screen says so", covers: ["AC-1"], ...base, launch: { "launch.loanId": "ln1", "opt.allowCustom": false, "opt.allowSettle": false },
    steps: [screen("opt"), text("Pay next instalment"), noText("Pay another amount"), noText("Reduces what you owe"), noText("Settle in full"), text("Paying another amount isn’t available."), text("Settling in full isn’t available.")],
  },
  {
    id: "T-8", name: "With only allowCustom off, settling is offered and another amount is not; and the other way round", covers: ["AC-1"], ...base, launch: { "launch.loanId": "ln1", "opt.allowCustom": false },
    steps: [screen("opt"), text("Settle in full"), noText("Pay another amount"), text("Paying another amount isn’t available."), noText("Settling in full isn’t available.")],
  },
  {
    id: "T-9", name: "With only allowSettle off, another amount is offered and settling is not", covers: ["AC-1"], ...base, launch: { "launch.loanId": "ln1", "opt.allowSettle": false },
    steps: [screen("opt"), text("Pay another amount"), noText("Settle in full"), text("Settling in full isn’t available."), noText("Paying another amount isn’t available.")],
  },
  {
    id: "T-10", name: "Settling from Main, which holds less, is refused with the shared message and Review stays out; Savings works", covers: ["AC-5"], ...base,
    steps: [screen("opt"), set({ "rp.option": "settle" }), press("Continue"), press("Review"), screen("from"), text("Not enough money in Main. Available: $8,602.36."), noText("Authorise"), set({ "rp.from": "acc_save" }), press("Review"), screen("review"), text("Savings ••7731")],
  },
  {
    id: "T-11", name: "An account that cannot pay is refused: You can’t use this account right now", covers: ["AC-5"], ...base, conditions: { frozen: ["acc_main"] },
    steps: [screen("opt"), press("Continue"), text("Frozen"), set({ "rp.from": "acc_main" }), press("Review"), screen("from"), text("You can’t use this account right now. Choose another account."), set({ "rp.from": "acc_save" }), press("Review"), screen("review")],
  },
  {
    id: "T-12", name: "With no loans the journey says You have no loans.", covers: ["AC-9"], persona: "alex", now: NOW, launch: { "launch.loanId": "ln1" }, conditions: { empty: ["bank.loans.list"] },
    steps: [screen("none"), text("You have no loans."), text("Apply for a loan")],
  },
  {
    id: "T-13", name: "With one loan the choice of loan is skipped, with or without an id passed in; an id that is not the person's is ignored", covers: ["AC-9"], persona: "alex", now: NOW, launch: { "launch.loanId": "ln9" },
    steps: [screen("opt"), text("Personal loan · $9,600.00 left")],
  },
  {
    id: "T-14", name: "With two loans the person chooses one, and must choose", covers: ["AC-9"], persona: "alex", now: NOW, setup: twelve,
    steps: [screen("pick"), text("Choose a loan"), text("Personal loan"), text("$9,600.00 left · next payment 1 Dec 2026"), text("Other loan"), set({ "rp.loanId": "" }), press("Continue"), screen("pick"), { expectError: "rp.loanId" }, set({ "rp.loanId": "ln2" }), press("Continue"), screen("opt"), text("Other loan · $1,000.00 left")],
  },
  {
    id: "T-15", name: "A wrong code pays nothing and says so; the right code goes on", covers: ["AC-6"], ...base,
    steps: [...toCode(), ...code("111111"), toast("That code isn’t right. Try again."), screen("code"), loans("ln1.outstanding", 9600), avail("acc_main", 8602.36), ...code(), screen("doneRepay"), loans("ln1.outstanding", 9266.7)],
  },
  {
    id: "T-16", name: "Three wrong codes end the attempt: nothing paid", covers: ["AC-6"], ...base,
    steps: [...toCode(), ...code("111111"), ...code("111111"), ...code("111111"), screen("locked"), text("Too many wrong codes"), text("Nothing was paid."), loans("ln1.outstanding", 9600), avail("acc_main", 8602.36), press("Start again"), screen("opt")],
  },
  {
    id: "T-17", name: "An empty code is not sent", covers: ["AC-6"], ...base,
    steps: [...toCode(), press("Confirm"), screen("code"), { expectError: "otp.code" }],
  },
  {
    id: "T-18", name: "Another amount needs an amount; the option passed in is the one chosen", covers: ["AC-4"], ...base, launch: { "launch.loanId": "ln1", "launch.option": "custom" },
    steps: [screen("opt"), text("Amount"), set({ "rp.amount": null }), press("Continue"), screen("opt"), { expectError: "rp.amount" }],
  },
  {
    id: "T-19", name: "Settle passed in is chosen, and not when the bank does not offer it", covers: ["AC-1"], ...base, launch: { "launch.loanId": "ln1", "launch.option": "settle" },
    steps: [screen("opt"), set({ "rp.from": "acc_save" }), press("Continue"), press("Review"), screen("review"), text("$9,701.21")],
  },
  {
    id: "T-20", name: "An option the bank does not offer, passed in, falls back to the next instalment", covers: ["AC-1"], ...base, launch: { "launch.loanId": "ln1", "launch.option": "settle", "opt.allowSettle": false },
    steps: [screen("opt"), press("Continue"), press("Review"), text("$412.50"), text("$9,266.70")],
  },
  {
    id: "T-21", name: "When the bank is unavailable nothing is paid", covers: ["AC-10"], ...base, conditions: { unavailable: ["bank.loans.repay"] },
    steps: [...toFrom(), press("Review"), screen("unavailable"), text("We couldn’t reach the bank"), text("Nothing was sent and you haven’t been charged. Try again in a moment."), loans("ln1.outstanding", 9600), avail("acc_main", 8602.36)],
  },
  {
    id: "T-22", name: "When the bank does not answer in time nothing is paid", covers: ["AC-10"], ...base, conditions: { timeout: ["bank.loans.repay"], latencyMs: 10000 },
    steps: [...toFrom(), press("Review"), screen("timeout"), text("We didn’t get an answer in time. Check Activity before you try again, so you don’t pay twice."), loans("ln1.outstanding", 9600), press("Try again"), screen("opt")],
  },
  {
    id: "T-23", name: "When the bank is unavailable or slow settling, nothing is paid", covers: ["AC-10"], ...base, conditions: { unavailable: ["bank.loans.settle"] },
    steps: [...toFrom(settle), press("Review"), screen("unavailable"), loans("count", 1), avail("acc_save", 15254.37)],
  },
  {
    id: "T-24", name: "When the bank does not answer settling in time nothing is paid", covers: ["AC-10"], ...base, conditions: { timeout: ["bank.loans.settle"], latencyMs: 10000 },
    steps: [...toFrom(settle), press("Review"), screen("timeout"), loans("count", 1)],
  },
  {
    id: "T-25", name: "When the loans cannot be read nothing starts", covers: ["AC-10"], ...base, conditions: { unavailable: ["bank.loans.list"] },
    steps: [screen("unavailable")],
  },
  {
    id: "T-26", name: "When the accounts cannot be read nothing starts", covers: ["AC-10"], ...base, conditions: { timeout: ["bank.accounts.payFrom"], latencyMs: 10000 },
    steps: [screen("timeout")],
  },
  {
    id: "T-27", name: "When the loan cannot be read nothing is shown to pay", covers: ["AC-10"], ...base, conditions: { unavailable: ["bank.loans.get"] },
    steps: [screen("unavailable"), noText("Pay next instalment")],
  },
  {
    id: "T-28", name: "When the code cannot be sent nothing goes on", covers: ["AC-10"], ...base, conditions: { unavailable: ["bank.otp.send"] },
    steps: [...toReview(), set({ "rp.consent": true }), press("Pay"), screen("unavailable"), loans("ln1.outstanding", 9600)],
  },
  {
    id: "T-29", name: "Without payments.create it is not available, and the bank refuses a payment and a settlement whatever a screen does", covers: ["AC-11"], ...base, conditions: { withoutPermissions: ["payments.create"] },
    steps: [
      screen("denied"), text("Not available"), forced("bank.loans.repay", { loanId: "ln1", option: "next", fromAccountId: "acc_main" }, "PERMISSION_DENIED"), forced("bank.loans.settle", { loanId: "ln1", fromAccountId: "acc_save" }, "PERMISSION_DENIED"), loans("ln1.outstanding", 9600),
    ],
  },
  {
    id: "T-30", name: "The bank asks for the code itself and refuses what a screen would not offer: another amount below 10.00 or at the balance, an unknown loan, an unknown way, an account that cannot hold the amount", covers: ["AC-11", "AC-4", "AC-5", "AC-6"], persona: "alex", now: NOW,
    steps: [
      forced("bank.loans.repay", { loanId: "ln1", option: "next", fromAccountId: "acc_main" }, "OTP_REQUIRED"), forced("bank.loans.settle", { loanId: "ln1", fromAccountId: "acc_save" }, "OTP_REQUIRED"),
      forced("bank.loans.repay", { loanId: "ln1", option: "custom", amount: 5, fromAccountId: "acc_main" }, "REPAY_BELOW"), forced("bank.loans.repay", { loanId: "ln1", option: "custom", amount: 9600, fromAccountId: "acc_main" }, "REPAY_ABOVE"),
      forced("bank.loans.repay", { loanId: "nope", option: "next", fromAccountId: "acc_main" }, "LOAN_NOT_FOUND"), forced("bank.loans.repay", { loanId: "ln1", option: "weekly", fromAccountId: "acc_main" }, "OPTION_INVALID"),
      forced("bank.loans.settle", { loanId: "ln1", fromAccountId: "acc_main", dryRun: true }, "INSUFFICIENT_FUNDS"), loans("ln1.outstanding", 9600),
    ],
  },
  {
    id: "T-31", name: "After a payment or a settlement View Save opens the Save screen", covers: ["AC-7", "AC-8"], ...base,
    steps: [...toCode(), ...code(), press("View Save"), { expectOpens: { journey: "save-borrow" } }],
  },
  {
    id: "T-32", name: "After a settlement View Save opens the Save screen", covers: ["AC-8"], ...base,
    steps: [...toCode(settle), ...code(), screen("doneSettle"), press("View Save"), { expectOpens: { journey: "save-borrow" } }],
  },
  {
    id: "T-33", name: "With no loans, Apply for a loan opens the application", covers: ["AC-9"], persona: "alex", now: NOW, conditions: { empty: ["bank.loans.list"] },
    steps: [screen("none"), press("Apply for a loan"), { expectOpens: { journey: "apply-loan" } }],
  },
  {
    id: "T-34", name: "The code is not kept: after the result the journey holds neither the code nor the tick", covers: ["AC-6"], ...base,
    steps: [...toCode(), ...code(), screen("doneRepay"), noText("482100")],
  },
  {
    id: "T-35", name: "A payment on a second loan lowers that loan only", covers: ["AC-7"], persona: "alex", now: NOW, launch: { "launch.loanId": "ln2" }, setup: twelve,
    steps: [...toCode({ "rp.option": "custom", "rp.amount": 900 }), ...code(), screen("doneRepay"), text("$100.00 left to pay."), loans("ln2.outstanding", 100)],
  },
];
