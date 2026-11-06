import type { Journey } from "../schema";

/** What must be true for "Term deposit" to be right. Each is proved by at least one scenario below. */
export const termDepositAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "Opening needs an amount from $1,000.00 to $250,000.00 and an account that can cover it, with the messages of the spec." },
  { id: "AC-2", text: "The four terms show their rate and maturity date; interest and the amount received at maturity are shown before the code." },
  { id: "AC-3", text: "\"Every month\" is offered only when allowMonthly is on; with it the amount received at maturity is the principal alone." },
  { id: "AC-4", text: "A code is asked before opening, renewing or closing; a wrong code changes nothing, and three wrong codes end the attempt." },
  { id: "AC-5", text: "Opening takes the amount from the chosen account, adds a deposit to the Save tab and shows \"Deposit opened\"." },
  { id: "AC-6", text: "Renew changes the term and the maturity instruction only; no money moves; the Save tab shows \"Renews for {n} months\"." },
  { id: "AC-7", text: "Close shows interest earned, a closure charge of half that interest and the amount received before the code; the principal is never reduced." },
  { id: "AC-8", text: "With allowEarlyClose off, Close is blocked with \"This deposit can’t be closed early.\"" },
  { id: "AC-9", text: "With one deposit the choice of deposit is skipped; with none, the journey says \"You have no term deposits.\"" },
  { id: "AC-10", text: "When the bank is unavailable or times out nothing is changed." },
  { id: "AC-11", text: "A tick is needed before the code for an opening and a closure; the journey needs payments.create, and the bank itself refuses without the permission and without the code, whatever a screen does." },
];

// Alex Morgan on Tuesday 3 November 2026: Main ••4410 with $8,602.36 available, Savings ••7731, and the deposit td1 of $10,000.00 at 4.20% opened 12 Aug 2026 (83 days ago).
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
const deposits = (path: string, equals: unknown): Step => bank("bank.deposits.list", { pick: true }, path === "count" ? path : `items.${path}`, equals);
const open = { persona: "alex", now: NOW, launch: { "launch.mode": "open" } };
const code = (c = "482100"): Step[] => [set({ "otp.code": c }), press("Confirm")];
/** The amount typed, then through the term (12 months, at maturity) to the review. */
const toReview = (amount = 5000, extra: Record<string, unknown> = {}): Step[] => [set({ "td.amount": amount, ...extra }), press("Continue"), screen("term"), press("Continue"), screen("review")];
const toCode: Step[] = [...toReview(), set({ "td.consent": true }), press("Confirm"), screen("code")];
const renewTd1 = { persona: "alex", now: NOW, launch: { "launch.mode": "renew", "launch.depositId": "td1" } };
const closeTd1 = { persona: "alex", now: NOW, launch: { "launch.mode": "close", "launch.depositId": "td1" } };
const toRenewCode: Step[] = [set({ "td.term": "24", "td.instruction": "renew-payout" }), press("Review"), screen("renewReview"), press("Confirm"), screen("code")];
const toCloseCode: Step[] = [screen("close"), set({ "td.consent": true }), press("Confirm"), screen("code")];
/** A second deposit of $1,000.00, opened with the bank's own calls. */
const second: NonNullable<Journey["scenarios"]>[number]["setup"] = [{ adapter: "bank.otp.send" }, { adapter: "bank.otp.verify", input: { code: "482100" } }, { adapter: "bank.deposits.open", input: { amount: 1000, term: 3, payout: "maturity", fromAccountId: "acc_main" } }];

export const termDepositScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "Open 5,000.00 for 12 months from Main: the four terms, the review with 210.00 of interest, a tick, the code; Deposit opened and 5,000.00 less in Main", covers: ["AC-1", "AC-2", "AC-4", "AC-5", "AC-11"], ...open,
    steps: [
      screen("amount"), text("Open a term deposit"), text("From $1,000.00 to $250,000.00"), text("Main ••4410"), text("$8,602.36 available"),
      set({ "td.amount": 5000 }), press("Continue"), screen("term"),
      text("3 months"), text("Matures 3 Feb 2027 · 3.40% a year"), text("6 months"), text("Matures 3 May 2027 · 3.80% a year"), text("12 months"), text("Matures 3 Nov 2027 · 4.20% a year"), text("24 months"), text("Matures 3 Nov 2028 · 4.50% a year"),
      text("At maturity"), text("Every month"), press("Continue"), screen("review"),
      text("$5,000.00"), text("Main ••4410"), text("12 months"), text("4.20% a year"), text("At maturity"), text("$210.00"), text("3 Nov 2027"), text("$5,210.00"), text("You receive at maturity"),
      avail("acc_main", 8602.36), deposits("count", 1), press("Confirm"), screen("review"), { expectError: "td.consent" },
      set({ "td.consent": true }), press("Confirm"), screen("code"), text("Authorise a deposit of $5,000.00"), text("Code sent to"), deposits("count", 1), avail("acc_main", 8602.36),
      ...code(), screen("doneOpen"), text("Deposit opened"), text("$5,000.00 is earning 4.20% for 12 months."), text("Reference TD-20261103-"), text("Interest paid"),
      avail("acc_main", 3602.36), deposits("count", 2), deposits("td2.name", "$5,000.00"), deposits("td2.maturesText", "3 Nov 2027"), text("View deposits"),
    ],
  },
  {
    id: "T-2", name: "Amount rules: 500 and 300,000 are refused with their words, nothing typed is refused, 9,000 is more than Main holds", covers: ["AC-1"], ...open,
    steps: [
      set({ "td.amount": 500 }), press("Continue"), screen("amount"), text("The smallest deposit is $1,000.00."),
      set({ "td.amount": 300000 }), press("Continue"), screen("amount"), text("The largest deposit is $250,000.00."),
      set({ "td.amount": null }), press("Continue"), screen("amount"), { expectError: "td.amount" },
      set({ "td.amount": 9000 }), press("Continue"), screen("term"), press("Continue"), screen("amount"), text("Not enough money in Main. Available: $8,602.36."), noText("Review"),
      set({ "td.amount": 1000 }), press("Continue"), press("Continue"), screen("review"), text("$1,000.00"), text("$42.00"),
    ],
  },
  {
    id: "T-3", name: "The account that pays is chosen: Savings can cover 9,000; a frozen account is refused with the shared message", covers: ["AC-1"], ...open,
    steps: [set({ "td.amount": 9000, "td.from": "acc_save" }), press("Continue"), press("Continue"), screen("review"), text("Savings ••7731"), text("$9,000.00")],
  },
  {
    id: "T-4", name: "A frozen account cannot pay: You can’t use this account right now", covers: ["AC-1"], ...open, conditions: { frozen: ["acc_main"] },
    steps: [text("Frozen"), set({ "td.amount": 2000, "td.from": "acc_main" }), press("Continue"), press("Continue"), screen("amount"), text("You can’t use this account right now. Choose another account."), set({ "td.from": "acc_save" }), press("Continue"), press("Continue"), screen("review")],
  },
  {
    id: "T-5", name: "With allowMonthly on there are two chips; choosing Every month receives the 5,000.00 alone at maturity", covers: ["AC-3"], ...open,
    steps: [set({ "td.amount": 5000 }), press("Continue"), text("At maturity"), text("Every month"), set({ "td.payout": "monthly" }), press("Continue"), screen("review"), text("Every month"), text("$210.00"), text("$5,000.00"), noText("$5,210.00")],
  },
  {
    id: "T-6", name: "With allowMonthly off there is one way: interest at maturity, and no Every month", covers: ["AC-3"], ...open, launch: { "launch.mode": "open", "opt.allowMonthly": false },
    steps: [set({ "td.amount": 5000 }), press("Continue"), screen("term"), noText("Every month"), text("Interest is paid at maturity."), press("Continue"), screen("review"), text("At maturity"), text("$5,210.00")],
  },
  {
    id: "T-7", name: "A term chosen shows its own rate and maturity: 24 months at 4.50% matures 3 Nov 2028 with 450.00 of interest", covers: ["AC-2"], ...open,
    steps: [set({ "td.amount": 5000 }), press("Continue"), set({ "td.term": "24" }), press("Continue"), screen("review"), text("24 months"), text("4.50% a year"), text("$450.00"), text("3 Nov 2028"), text("$5,450.00")],
  },
  {
    id: "T-8", name: "Renew with a deposit passed in: 24 months and Renew, pay interest out; the review shows 4.50% and the maturity date; code; Deposit updated and no money moves", covers: ["AC-4", "AC-6", "AC-9"], ...renewTd1,
    steps: [
      screen("renew"), text("$10,000.00"), text("4.20% · matures 12 Aug 2027"), text("Rate 3.40% a year"), text("Rate 4.50% a year"), text("Renew with interest"), text("Pay out at maturity"),
      set({ "td.term": "24", "td.instruction": "renew-payout" }), press("Review"), screen("renewReview"), text("24 months"), text("4.50% a year"), text("Renew, pay interest out"), text("12 Aug 2027"), text("No money moves."),
      deposits("td1.renewalText", ""), press("Confirm"), screen("code"), text("Authorise the change to your deposit"), deposits("td1.renewalText", ""),
      ...code(), screen("doneRenew"), text("Deposit updated"), text("It renews for 24 months on 12 Aug 2027."), text("Reference TD-20261103-"),
      deposits("td1.renewalText", "Renews for 24 months"), avail("acc_main", 8602.36), deposits("count", 1),
    ],
  },
  {
    id: "T-9", name: "Pay out at maturity: the deposit says nothing about renewing, and the result says when it is paid out", covers: ["AC-6"], ...renewTd1,
    steps: [set({ "td.term": "12", "td.instruction": "payout" }), press("Review"), text("Pay out at maturity"), press("Confirm"), ...code(), screen("doneRenew"), text("It will be paid out on 12 Aug 2027."), deposits("td1.renewalText", "")],
  },
  {
    id: "T-10", name: "Close early: the rows are 10,000.00, 95.51, -47.76 and 10,047.75; a tick and the code; Main gets 10,047.75 and the deposit is gone", covers: ["AC-4", "AC-7", "AC-11"], ...closeTd1,
    steps: [
      screen("close"), text("$10,000.00"), text("Interest earned"), text("$95.51"), text("Early closure charge"), text("-$47.76"), text("You receive"), text("$10,047.75"), text("Main ••4410"),
      press("Confirm"), screen("close"), { expectError: "td.consent" }, avail("acc_main", 8602.36),
      set({ "td.consent": true }), press("Confirm"), screen("code"), text("Authorise closing your deposit"), deposits("count", 1), avail("acc_main", 8602.36),
      ...code(), screen("doneClose"), text("Deposit closed"), text("$10,047.75 was paid into Main ••4410."), text("Reference TD-20261103-"), text("Paid into"), text("You received"),
      avail("acc_main", 18650.11), deposits("count", 0), text("View accounts"),
    ],
  },
  {
    id: "T-11", name: "Close into Savings: the money goes where it was told", covers: ["AC-7"], ...closeTd1,
    steps: [set({ "td.to": "acc_save" }), ...toCloseCode.slice(1), ...code(), screen("doneClose"), text("Savings ••7731"), avail("acc_save", 25302.12), avail("acc_main", 8602.36)],
  },
  {
    id: "T-12", name: "With allowEarlyClose off the screen says This deposit can’t be closed early. and offers no way to confirm", covers: ["AC-8"], ...closeTd1, launch: { "launch.mode": "close", "launch.depositId": "td1", "opt.allowEarlyClose": false },
    steps: [screen("close"), text("This deposit can’t be closed early."), noText("Confirm"), noText("Early closure charge"), noText("Pay into"), deposits("count", 1)],
  },
  {
    id: "T-13", name: "A wrong code changes nothing and says so; the right code goes on", covers: ["AC-4"], ...open,
    steps: [...toCode, ...code("111111"), toast("That code isn’t right. Try again."), screen("code"), deposits("count", 1), avail("acc_main", 8602.36), ...code(), screen("doneOpen"), deposits("count", 2)],
  },
  {
    id: "T-14", name: "Three wrong codes end the attempt: nothing opened, nothing taken", covers: ["AC-4"], ...open,
    steps: [...toCode, ...code("111111"), ...code("111111"), ...code("111111"), screen("locked"), text("Too many wrong codes"), text("Nothing was changed."), deposits("count", 1), avail("acc_main", 8602.36), press("Start again"), screen("amount")],
  },
  {
    id: "T-15", name: "A wrong code on a renewal and on a closure changes nothing either", covers: ["AC-4"], ...renewTd1,
    steps: [...toRenewCode, ...code("111111"), toast("That code isn’t right. Try again."), deposits("td1.renewalText", ""), screen("code")],
  },
  {
    id: "T-16", name: "A wrong code on a closure leaves the deposit and the balance as they were", covers: ["AC-4"], ...closeTd1,
    steps: [...toCloseCode, ...code("111111"), toast("That code isn’t right. Try again."), deposits("count", 1), avail("acc_main", 8602.36)],
  },
  {
    id: "T-17", name: "An empty code is not sent", covers: ["AC-4"], ...open,
    steps: [...toCode, press("Confirm"), screen("code"), { expectError: "otp.code" }],
  },
  {
    id: "T-18", name: "With one deposit the choice of deposit is skipped; with two the person chooses one, and must choose", covers: ["AC-9"], persona: "alex", now: NOW, launch: { "launch.mode": "renew" },
    steps: [screen("renew"), text("$10,000.00")],
  },
  {
    id: "T-19", name: "With two deposits the list is shown: Continue needs a choice, and the choice is the one renewed", covers: ["AC-9"], persona: "alex", now: NOW, launch: { "launch.mode": "close" }, setup: second,
    steps: [screen("pick"), text("Choose a deposit"), text("$10,000.00"), text("4.20% · matures 12 Aug 2027"), text("$1,000.00"), text("3.40% · matures 3 Feb 2027"), set({ "td.depositId": "" }), press("Continue"), screen("pick"), { expectError: "td.depositId" }, set({ "td.depositId": "td2" }), press("Continue"), screen("close"), text("$1,000.00"), text("$0.00")],
  },
  {
    id: "T-20", name: "A deposit id that is not the person's is ignored: the deposit they have is used", covers: ["AC-9"], persona: "alex", now: NOW, launch: { "launch.mode": "close", "launch.depositId": "td9" },
    steps: [screen("close"), text("$10,000.00")],
  },
  {
    id: "T-21", name: "With no deposits Renew and Close say You have no term deposits., and offer to open one", covers: ["AC-9"], persona: "alex", now: NOW, launch: { "launch.mode": "renew" }, conditions: { empty: ["bank.deposits.list"] },
    steps: [screen("none"), text("You have no term deposits."), press("Open a term deposit"), screen("amount")],
  },
  {
    id: "T-22", name: "Without a mode it opens a deposit", covers: ["AC-1"], persona: "alex", now: NOW,
    steps: [screen("amount"), text("Open a term deposit")],
  },
  {
    id: "T-23", name: "When the bank is unavailable at the last step nothing is opened and no money is taken", covers: ["AC-10"], ...open, conditions: { unavailable: ["bank.deposits.open"] },
    steps: [...toCode, ...code(), screen("unavailable"), text("We couldn’t reach the bank"), text("Nothing was sent and you haven’t been charged. Try again in a moment."), deposits("count", 1), avail("acc_main", 8602.36)],
  },
  {
    id: "T-24", name: "When the bank does not answer in time nothing is opened; Try again starts again", covers: ["AC-10"], ...open, conditions: { timeout: ["bank.deposits.open"], latencyMs: 10000 },
    steps: [...toCode, ...code(), screen("timeout"), text("This is taking longer than expected"), text("We didn’t get an answer in time. Check Activity before you try again, so you don’t pay twice."), deposits("count", 1), avail("acc_main", 8602.36), press("Try again"), screen("amount")],
  },
  {
    id: "T-25", name: "When the bank is unavailable renewing, nothing changes", covers: ["AC-10"], ...renewTd1, conditions: { unavailable: ["bank.deposits.renew"] },
    steps: [...toRenewCode, ...code(), screen("unavailable"), deposits("td1.renewalText", "")],
  },
  {
    id: "T-26", name: "When the bank is unavailable closing, the deposit stays and no money is paid", covers: ["AC-10"], ...closeTd1, conditions: { unavailable: ["bank.deposits.close"] },
    steps: [...toCloseCode, ...code(), screen("unavailable"), deposits("count", 1), avail("acc_main", 8602.36)],
  },
  {
    id: "T-27", name: "When the bank does not answer closing in time the deposit stays", covers: ["AC-10"], ...closeTd1, conditions: { timeout: ["bank.deposits.close"], latencyMs: 10000 },
    steps: [...toCloseCode, ...code(), screen("timeout"), deposits("count", 1), avail("acc_main", 8602.36)],
  },
  {
    id: "T-28", name: "When the bank does not answer renewing in time nothing changes", covers: ["AC-10"], ...renewTd1, conditions: { timeout: ["bank.deposits.renew"], latencyMs: 10000 },
    steps: [...toRenewCode, ...code(), screen("timeout"), deposits("td1.renewalText", "")],
  },
  {
    id: "T-29", name: "When the deposits, the accounts or the terms cannot be read, nothing starts", covers: ["AC-10"], ...open, conditions: { unavailable: ["bank.deposits.list"] },
    steps: [screen("unavailable"), text("Nothing was sent and you haven’t been charged.")],
  },
  {
    id: "T-30", name: "When the accounts cannot be read, nothing starts", covers: ["AC-10"], ...open, conditions: { timeout: ["bank.accounts.payFrom"], latencyMs: 10000 },
    steps: [screen("timeout")],
  },
  {
    id: "T-31", name: "When the terms cannot be read, nothing starts", covers: ["AC-10"], ...open, conditions: { unavailable: ["bank.deposits.terms"] },
    steps: [screen("unavailable")],
  },
  {
    id: "T-32", name: "When the check of the deposit cannot be made at Continue, nothing opens and the person can try again", covers: ["AC-10"], ...open, conditions: { unavailable: ["bank.deposits.quote"] },
    steps: [set({ "td.amount": 5000 }), press("Continue"), press("Continue"), screen("unavailable"), press("Try again"), screen("amount")],
  },
  {
    id: "T-33", name: "When the check of a renewal or a closure cannot be made, nothing changes", covers: ["AC-10"], ...renewTd1, conditions: { unavailable: ["bank.deposits.renew.quote"] },
    steps: [press("Review"), screen("unavailable"), deposits("td1.renewalText", "")],
  },
  {
    id: "T-34", name: "When what closing pays cannot be asked of the bank, nothing is shown to confirm", covers: ["AC-10"], ...closeTd1, conditions: { unavailable: ["bank.deposits.close.quote"] },
    steps: [screen("unavailable"), noText("Confirm")],
  },
  {
    id: "T-35", name: "When the code cannot be sent, nothing goes on", covers: ["AC-10"], ...open, conditions: { unavailable: ["bank.otp.send"] },
    steps: [...toReview(), set({ "td.consent": true }), press("Confirm"), screen("unavailable"), deposits("count", 1)],
  },
  {
    id: "T-36", name: "Without payments.create it is not available, and the bank refuses an opening, a renewal and a closure, and any without the code, whatever a screen does", covers: ["AC-11", "AC-4"], ...open, conditions: { withoutPermissions: ["payments.create"] },
    steps: [
      screen("denied"), text("Not available"),
      forced("bank.deposits.open", { amount: 5000, term: 12, payout: "maturity", fromAccountId: "acc_main" }, "PERMISSION_DENIED"), forced("bank.deposits.renew", { depositId: "td1", term: 24, instruction: "renew" }, "PERMISSION_DENIED"),
      forced("bank.deposits.close", { depositId: "td1", toAccountId: "acc_main" }, "PERMISSION_DENIED"), deposits("count", 1),
    ],
  },
  {
    id: "T-37", name: "The bank asks for the code itself, and refuses amounts, terms and accounts that a screen would not offer", covers: ["AC-4", "AC-11", "AC-1"], persona: "alex", now: NOW,
    steps: [
      forced("bank.deposits.open", { amount: 5000, term: 12, payout: "maturity", fromAccountId: "acc_main" }, "OTP_REQUIRED"), forced("bank.deposits.renew", { depositId: "td1", term: 24, instruction: "renew" }, "OTP_REQUIRED"),
      forced("bank.deposits.close", { depositId: "td1", toAccountId: "acc_main" }, "OTP_REQUIRED"), forced("bank.deposits.quote", { amount: 500, term: 12, fromAccountId: "acc_main" }, "BELOW_MINIMUM"),
      forced("bank.deposits.quote", { amount: 300000, term: 12, fromAccountId: "acc_main" }, "ABOVE_MAXIMUM"), forced("bank.deposits.quote", { amount: 5000, term: 5, fromAccountId: "acc_main" }, "TERM_INVALID"),
      forced("bank.deposits.quote", { amount: 5000, term: 12, payout: "monthly", allowMonthly: false, fromAccountId: "acc_main" }, "PAYOUT_OFF"), forced("bank.deposits.close.quote", { depositId: "td1", earlyClose: false }, "EARLY_CLOSE_OFF"),
      forced("bank.deposits.close.quote", { depositId: "td9" }, "DEPOSIT_NOT_FOUND"), forced("bank.deposits.renew.quote", { depositId: "td1", term: 24, instruction: "x" }, "INSTRUCTION_INVALID"),
      deposits("count", 1),
    ],
  },
  {
    id: "T-39", name: "When the code cannot be sent for a renewal or a closure, nothing goes on", covers: ["AC-10"], ...renewTd1, conditions: { unavailable: ["bank.otp.send"] },
    steps: [set({ "td.term": "24" }), press("Review"), press("Confirm"), screen("unavailable"), deposits("td1.renewalText", "")],
  },
  {
    id: "T-40", name: "When the code cannot be sent for a closure, nothing goes on", covers: ["AC-10"], ...closeTd1, conditions: { unavailable: ["bank.otp.send"] },
    steps: [screen("close"), set({ "td.consent": true }), press("Confirm"), screen("unavailable"), deposits("count", 1)],
  },
  {
    id: "T-41", name: "Each result opens where it says: View deposits opens the Save screen, View accounts the accounts", covers: ["AC-5", "AC-7"], ...open,
    steps: [...toCode, ...code(), press("View deposits"), { expectOpens: { journey: "save-borrow" } }],
  },
  {
    id: "T-42", name: "After a renewal View deposits opens the Save screen", covers: ["AC-6"], ...renewTd1,
    steps: [...toRenewCode, ...code(), press("View deposits"), { expectOpens: { journey: "save-borrow" } }],
  },
  {
    id: "T-43", name: "After a closure View accounts opens the accounts", covers: ["AC-7"], ...closeTd1,
    steps: [...toCloseCode, ...code(), press("View accounts"), { expectOpens: { journey: "accounts" } }],
  },
  {
    id: "T-44", name: "With two deposits and a renewal the person chooses the deposit first, then the new term", covers: ["AC-9"], persona: "alex", now: NOW, launch: { "launch.mode": "renew" }, setup: second,
    steps: [screen("pick"), set({ "td.depositId": "td2" }), press("Continue"), screen("renew"), text("$1,000.00")],
  },
  {
    id: "T-45", name: "Closing into an account that cannot receive money keeps the deposit and says so on the screen", covers: ["AC-7", "AC-10"], ...closeTd1, conditions: { frozen: ["acc_save"] },
    steps: [set({ "td.to": "acc_save" }), ...toCloseCode.slice(1), ...code(), screen("close"), text("This account can’t receive money right now. Choose another account."), deposits("count", 1), set({ "td.to": "acc_main", "td.consent": true }), press("Confirm"), ...code(), screen("doneClose")],
  },
  {
    id: "T-46", name: "A term the bank does not offer goes back to the term with its message, for an opening and for a renewal", covers: ["AC-2"], ...open,
    steps: [set({ "td.amount": 5000 }), press("Continue"), set({ "td.term": "5" }), press("Continue"), screen("term"), text("Choose a term."), set({ "td.term": "6" }), press("Continue"), screen("review"), text("6 months")],
  },
  {
    id: "T-47", name: "A term the bank does not offer on a renewal goes back to the renewal with its message", covers: ["AC-6"], ...renewTd1,
    steps: [set({ "td.term": "7" }), press("Review"), screen("renew"), text("Choose a term."), set({ "td.term": "24" }), press("Review"), screen("renewReview")],
  },
  {
    id: "T-38", name: "The code and the tick are not kept: after the result the journey holds neither", covers: ["AC-4", "AC-11"], ...open,
    steps: [...toCode, ...code(), screen("doneOpen"), noText("482100")],
  },
];
