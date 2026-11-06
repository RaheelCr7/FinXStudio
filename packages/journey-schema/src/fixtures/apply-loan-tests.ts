import type { Journey } from "../schema";

/** What must be true for "Apply for a loan" to be right. Each is proved by at least one scenario below. */
export const applyLoanAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "The first screen shows the monthly payment and rate for the chosen amount and term as they change, and a purpose is required." },
  { id: "AC-2", text: "A student, someone not working, or income below $1,000.00 is declined with the income message." },
  { id: "AC-3", text: "Payments above 50% of income are declined with the affordability message." },
  { id: "AC-4", text: "A request of more than 12 times monthly income, self-employed above $15,000.00, retired above $20,000.00, or payments above 40% of income is sent to review; with allowReferral off it is declined." },
  { id: "AC-5", text: "Payments above 35% of income raise the rate by one point." },
  { id: "AC-6", text: "An approved offer shows loan, term, rate, payment, total interest, the fee (when on), total to repay and first payment; the customer must tick the terms." },
  { id: "AC-7", text: "A code is asked only for an approved offer; accepting adds the loan to the Save tab and pays the account." },
  { id: "AC-8", text: "A review or a decline creates no loan and moves no money." },
  { id: "AC-9", text: "A fourth loan is refused with \"You already have the maximum number of loans.\"" },
  { id: "AC-10", text: "With arrFee off no fee is shown or deducted." },
  { id: "AC-11", text: "When the bank is unavailable or times out nothing is changed." },
  { id: "AC-12", text: "The journey needs loans.apply; the bank itself asks for the code, makes only the loan it approved and refuses without the permission, whatever a screen does." },
];

// Alex Morgan on Tuesday 3 November 2026: Main ••4410 with $8,602.36 available, Savings ••7731, and the loan ln1 (Personal loan, $9,600.00 left).
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
const base = { persona: "alex", now: NOW };
const code = (c = "482100"): Step[] => [set({ "otp.code": c }), press("Confirm")];
/** The amount, term and purpose typed, then Continue to the work and income. */
const toWork = (amount = 5000, term = "36", purpose = "Car"): Step[] => [set({ "loan.amount": amount, "loan.term": term, "loan.purpose": purpose }), press("Continue"), screen("work")];
/** Work and income typed, then the decision. */
const ask = (employment = "Employed", income = 5000, commitments = "300"): Step[] => [set({ "loan.employment": employment, "loan.income": income, "loan.commitments": commitments }), press("Check my application")];
const toOffer: Step[] = [...toWork(), ...ask(), screen("offer")];
const toCode: Step[] = [...toOffer, set({ "loan.consent": true }), press("Accept offer"), screen("code")];
/** Two more loans, each approved and made with the bank's own calls, so the customer has three. */
const approve = (amount: number, term: number, rate: number) => [
  { adapter: "bank.loans.eligibility", input: { amount, term, purpose: "Other", employment: "Employed", income: 5000, commitments: 0 } },
  { adapter: "bank.otp.send" }, { adapter: "bank.otp.verify", input: { code: "482100" } },
  { adapter: "bank.loans.apply", input: { amount, term, rate, accountId: "acc_main" } },
];
const three: NonNullable<Journey["scenarios"]>[number]["setup"] = [...approve(1000, 12, 8.9), ...approve(1000, 12, 8.9)];

export const applyLoanScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "5,000.00 over 36 months for a car: the live card says 161.10 at 9.9%; approved, the offer lists everything, a tick and the code; Loan approved, Car loan on the Save tab and 4,950.00 in Main", covers: ["AC-1", "AC-5", "AC-6", "AC-7", "AC-10"], ...base,
    steps: [
      screen("loan"), text("How much do you need?"), text("Monthly payment"), text("$161.10"), text("Rate (APR)"), text("9.9% a year"), text("Your rate can differ after we check your details."),
      ...toWork(), text("Work and income"), ...ask(), screen("offer"), text("Your offer"),
      text("$5,000.00"), text("36 months"), text("9.9% a year"), text("$161.10"), text("$799.60"), text("Arrangement fee"), text("$50.00"), text("$5,849.60"), text("3 Dec 2026"), text("Main ••4410"),
      press("Accept offer"), screen("offer"), { expectError: "loan.consent" }, text("Agree to the terms to continue."), loans("count", 1),
      set({ "loan.consent": true }), press("Accept offer"), screen("code"), text("Authorise a loan of $5,000.00"), loans("count", 1), avail("acc_main", 8602.36),
      ...code(), screen("doneApproved"), text("Loan approved"), text("$4,950.00 is in Main ••4410."), text("Reference LN-20261103-"), text("Done"), text("First payment"), text("View loan"),
      loans("count", 2), loans("ln2.name", "Car loan"), avail("acc_main", 13552.36),
    ],
  },
  {
    id: "T-2", name: "The live card follows the amount and the term: 10,000.00 over 12 months at 8.9%, 24 months at 9.4%", covers: ["AC-1"], ...base,
    steps: [set({ "loan.amount": 10000, "loan.term": "12" }), text("8.9% a year"), text("$874.05"), set({ "loan.term": "24" }), text("9.4% a year"), text("$458.68")],
  },
  {
    id: "T-3", name: "A purpose is needed, the amount stays between 1,000.00 and 50,000.00 and in steps of 500.00, and a term is always chosen", covers: ["AC-1"], ...base,
    steps: [
      set({ "loan.purpose": "" }), press("Continue"), screen("loan"), { expectError: "loan.purpose" },
      set({ "loan.purpose": "Car", "loan.amount": 500 }), press("Continue"), screen("loan"), text("The smallest loan is $1,000.00."),
      set({ "loan.amount": 60000 }), press("Continue"), screen("loan"), text("The largest loan is $50,000.00."),
      set({ "loan.amount": 5250 }), press("Continue"), screen("loan"), text("Choose an amount in steps of $500.00."),
      set({ "loan.amount": 5500 }), press("Continue"), screen("work"),
    ],
  },
  {
    id: "T-4", name: "An amount passed in (an offer on Home, a link) fills the amount: 8,000.00 over 36 months is 257.76", covers: ["AC-1"], ...base, launch: { "launch.amount": 8000 },
    steps: [screen("loan"), text("$257.76")],
  },
  {
    id: "T-5", name: "A student and income of 800.00 are declined with the income message, no code is asked and nothing is created", covers: ["AC-2", "AC-8"], ...base,
    steps: [
      ...toWork(), ...ask("Student"), screen("outcome"), text("We can’t offer this loan"), text("We can’t lend based on the income you gave."), noText("Authorise"), loans("count", 1), avail("acc_main", 8602.36),
      press("Close"), screen("doneDeclined"), text("Application not approved"), text("No loan was created."), text("Declined"), text("Reference LA-20261103-"), text("Try a different amount"), loans("count", 1),
    ],
  },
  {
    id: "T-6", name: "Not working, and income of 800.00, are declined for income too", covers: ["AC-2"], ...base,
    steps: [...toWork(), ...ask("Not working"), screen("outcome"), text("We can’t lend based on the income you gave."), press("Close"), screen("doneDeclined"), press("Try a different amount"), screen("loan"), ...toWork(), ...ask("Employed", 800, "0"), screen("outcome"), text("We can’t lend based on the income you gave.")],
  },
  {
    id: "T-7", name: "Payments above 50% of income are declined with the affordability message: 50,000.00 over 12 months on 5,000.00", covers: ["AC-3"], ...base,
    steps: [...toWork(50000, "12"), ...ask(), screen("outcome"), text("We can’t offer this loan"), text("The payments would be too high against your income. Try a smaller amount or a longer term."), press("Close"), screen("doneDeclined")],
  },
  {
    id: "T-8", name: "Self-employed 20,000.00 over 60 months on 8,000.00: with allowReferral on it is sent to review (We need to look at this, then Application in review)", covers: ["AC-4", "AC-8"], ...base,
    steps: [
      ...toWork(20000, "60"), ...ask("Self-employed", 8000, "0"), screen("outcome"), text("We need to look at this"), text("A member of our team will review your application and reply within 2 working days."), noText("Authorise"),
      press("Close"), screen("doneReview"), text("Application in review"), text("We’ll reply within 2 working days."), text("In review"), text("Reference LA-20261103-"), text("Purpose"), text("View Save"), loans("count", 1), avail("acc_main", 8602.36),
    ],
  },
  {
    id: "T-9", name: "The same request with allowReferral off is declined: Application not approved", covers: ["AC-4"], ...base, launch: { "opt.allowReferral": false },
    steps: [...toWork(20000, "60"), ...ask("Self-employed", 8000, "0"), screen("outcome"), text("We can’t offer this loan"), text("The payments would be too high against your income."), press("Close"), screen("doneDeclined"), text("Application not approved")],
  },
  {
    id: "T-10", name: "Retired above 20,000.00 is sent to review; 20,000.00 itself is approved", covers: ["AC-4"], ...base,
    steps: [...toWork(20500, "60"), ...ask("Retired", 8000, "0"), text("We need to look at this"), press("Close"), screen("doneReview")],
  },
  {
    id: "T-34", name: "Self-employed above 15,000.00 is reviewed; 15,000.00 and Retired 20,000.00 are approved", covers: ["AC-4"], ...base,
    steps: [...toWork(15000, "60"), ...ask("Self-employed", 8000, "0"), screen("offer"), press("Back"), press("Back"), ...toWork(20000, "60"), ...ask("Retired", 8000, "0"), screen("offer")],
  },
  {
    id: "T-35", name: "More than 12 times the monthly income is sent to review: 13,000.00 on 1,000.00", covers: ["AC-4"], ...base,
    steps: [...toWork(13000, "60"), ...ask("Employed", 1000, "0"), text("We need to look at this"), press("Close"), screen("doneReview")],
  },
  {
    id: "T-36", name: "12 times the income is approved, and payments above 40% of income are sent to review", covers: ["AC-4"], ...base,
    steps: [...toWork(12000, "60"), ...ask("Employed", 1000, "0"), screen("offer"), press("Back"), press("Back"), ...toWork(5000, "36"), ...ask("Employed", 1000, "300"), text("We need to look at this"), press("Close"), screen("doneReview")],
  },
  {
    id: "T-11", name: "Payments between 35% and 40% of income raise the rate by one point: 10,000.00 over 12 months on 2,500.00 is 9.9% and 878.69", covers: ["AC-5"], ...base,
    steps: [...toWork(10000, "12"), ...ask("Employed", 2500, "100"), screen("offer"), text("9.9% a year"), text("$878.69")],
  },
  {
    id: "T-12", name: "Accepting without the tick is refused; without it nothing is sent", covers: ["AC-6"], ...base,
    steps: [...toOffer, press("Accept offer"), screen("offer"), text("Agree to the terms to continue."), { expectError: "loan.consent" }, loans("count", 1)],
  },
  {
    id: "T-13", name: "With arrFee off the offer has no fee row and Main gets the full 5,000.00", covers: ["AC-10", "AC-7"], ...base, launch: { "opt.arrFee": false },
    steps: [...toOffer, noText("Arrangement fee"), text("$5,799.60"), set({ "loan.consent": true }), press("Accept offer"), ...code(), screen("doneApproved"), noText("Arrangement fee"), text("$5,000.00 is in Main ••4410."), avail("acc_main", 13602.36)],
  },
  {
    id: "T-14", name: "The loan can be paid into Savings", covers: ["AC-7"], ...base,
    steps: [...toWork(), ...ask(), set({ "loan.to": "acc_save", "loan.consent": true }), press("Accept offer"), ...code(), screen("doneApproved"), text("Savings ••7731"), avail("acc_save", 20204.37), avail("acc_main", 8602.36)],
  },
  {
    id: "T-15", name: "A fourth loan is refused on the first screen with the maximum message", covers: ["AC-9"], ...base, setup: three,
    steps: [loans("count", 3), set({ "loan.purpose": "Car" }), press("Continue"), screen("loan"), text("You already have the maximum number of loans."), noText("Work and income")],
  },
  {
    id: "T-16", name: "A wrong code creates nothing and says so; the right code goes on", covers: ["AC-7"], ...base,
    steps: [...toCode, ...code("111111"), toast("That code isn’t right. Try again."), screen("code"), loans("count", 1), avail("acc_main", 8602.36), ...code(), screen("doneApproved"), loans("count", 2)],
  },
  {
    id: "T-17", name: "Three wrong codes end the attempt: no loan, no money", covers: ["AC-7"], ...base,
    steps: [...toCode, ...code("111111"), ...code("111111"), ...code("111111"), screen("locked"), text("Too many wrong codes"), text("No loan was created."), loans("count", 1), avail("acc_main", 8602.36), press("Start again"), screen("loan")],
  },
  {
    id: "T-18", name: "An empty code is not sent", covers: ["AC-7"], ...base,
    steps: [...toCode, press("Confirm"), screen("code"), { expectError: "otp.code" }],
  },
  {
    id: "T-19", name: "Income and the other payments are needed: nothing typed is refused on the screen; letters are refused", covers: ["AC-2"], ...base,
    steps: [
      ...toWork(), set({ "loan.employment": "", "loan.income": null, "loan.commitments": "" }), press("Check my application"), screen("work"), { expectError: "loan.employment" }, { expectError: "loan.income" }, { expectError: "loan.commitments" },
      set({ "loan.employment": "Employed", "loan.income": 5000, "loan.commitments": "abc" }), press("Check my application"), screen("work"), text("Enter 0 or more."),
      set({ "loan.commitments": "0" }), press("Check my application"), screen("offer"),
    ],
  },
  {
    id: "T-20", name: "Other payments the bank refuses (above 1,000,000) come back to the screen with its message", covers: ["AC-2"], ...base,
    steps: [...toWork(), set({ "loan.employment": "Employed", "loan.income": 5000, "loan.commitments": "2000000" }), press("Check my application"), screen("work"), text("Check this amount."), noText("Your offer")],
  },
  {
    id: "T-37", name: "An income of nothing, or above 1,000,000, is refused on the screen with its words", covers: ["AC-2"], ...base,
    steps: [
      ...toWork(), set({ "loan.employment": "Employed", "loan.income": 0, "loan.commitments": "0" }), press("Check my application"), screen("work"), { expectError: "loan.income" }, text("Enter an amount"),
      set({ "loan.income": 2000000 }), press("Check my application"), screen("work"), { expectError: "loan.income" }, text("Check this amount."),
    ],
  },
  {
    id: "T-38", name: "Each result opens where it says: View loan and View Save open the Save screen", covers: ["AC-7", "AC-4"], ...base,
    steps: [...toCode, ...code(), press("View loan"), { expectOpens: { journey: "save-borrow" } }],
  },
  {
    id: "T-39", name: "After a review View Save opens the Save screen", covers: ["AC-4"], ...base,
    steps: [...toWork(20000, "60"), ...ask("Self-employed", 8000, "0"), press("Close"), press("View Save"), { expectOpens: { journey: "save-borrow" } }],
  },
  {
    id: "T-21", name: "When the bank is unavailable at the decision nothing is recorded", covers: ["AC-11"], ...base, conditions: { unavailable: ["bank.loans.eligibility"] },
    steps: [...toWork(), ...ask(), screen("unavailable"), text("We couldn’t reach the bank"), text("Nothing was sent and you haven’t been charged. Try again in a moment."), loans("count", 1), press("Try again"), screen("loan")],
  },
  {
    id: "T-22", name: "When the bank does not answer the decision in time nothing is recorded", covers: ["AC-11"], ...base, conditions: { timeout: ["bank.loans.eligibility"], latencyMs: 10000 },
    steps: [...toWork(), ...ask(), screen("timeout"), text("This is taking longer than expected"), text("We didn’t get an answer in time. Check your loans before you try again."), loans("count", 1)],
  },
  {
    id: "T-23", name: "When the bank is unavailable at the last step no loan is made and no money paid", covers: ["AC-11"], ...base, conditions: { unavailable: ["bank.loans.apply"] },
    steps: [...toCode, ...code(), screen("unavailable"), loans("count", 1), avail("acc_main", 8602.36)],
  },
  {
    id: "T-24", name: "When the bank does not answer the last step in time no loan is made", covers: ["AC-11"], ...base, conditions: { timeout: ["bank.loans.apply"], latencyMs: 10000 },
    steps: [...toCode, ...code(), screen("timeout"), text("We didn’t get an answer in time. Check your loans before you try again."), loans("count", 1), avail("acc_main", 8602.36)],
  },
  {
    id: "T-25", name: "When the rates or the accounts cannot be read, or the code cannot be sent, nothing goes on", covers: ["AC-11"], ...base, conditions: { unavailable: ["bank.loans.quote"] },
    steps: [screen("unavailable")],
  },
  {
    id: "T-26", name: "When the accounts cannot be read nothing starts", covers: ["AC-11"], ...base, conditions: { timeout: ["bank.accounts.payFrom"], latencyMs: 10000 },
    steps: [screen("timeout")],
  },
  {
    id: "T-27", name: "When the code cannot be sent nothing goes on", covers: ["AC-11"], ...base, conditions: { unavailable: ["bank.otp.send"] },
    steps: [...toOffer, set({ "loan.consent": true }), press("Accept offer"), screen("unavailable"), loans("count", 1)],
  },
  {
    id: "T-28", name: "An account that cannot receive money keeps the loan from being made and says so on the offer; another account works", covers: ["AC-7", "AC-11"], ...base, conditions: { frozen: ["acc_save"] },
    steps: [
      ...toWork(), ...ask(), set({ "loan.to": "acc_save", "loan.consent": true }), press("Accept offer"), ...code(), screen("offer"), text("This account can’t receive money right now. Choose another account."), loans("count", 1),
      set({ "loan.to": "acc_main", "loan.consent": true }), press("Accept offer"), ...code(), screen("doneApproved"), loans("count", 2),
    ],
  },
  {
    id: "T-29", name: "Without loans.apply it is not available, and the bank refuses a decision and a loan whatever a screen does", covers: ["AC-12"], ...base, conditions: { withoutPermissions: ["loans.apply"] },
    steps: [
      screen("denied"), text("Not available"),
      forced("bank.loans.eligibility", { amount: 5000, term: 36, purpose: "Car", employment: "Employed", income: 5000, commitments: 300 }, "PERMISSION_DENIED"), forced("bank.loans.apply", { amount: 5000, term: 36, rate: 9.9, accountId: "acc_main" }, "PERMISSION_DENIED"), loans("count", 1),
    ],
  },
  {
    id: "T-30", name: "The bank makes only the loan it approved and asks for the code itself", covers: ["AC-12", "AC-7"], ...base,
    steps: [
      forced("bank.loans.apply", { amount: 5000, term: 36, rate: 9.9, accountId: "acc_main" }, "OFFER_NOT_FOUND"),
      ...toOffer,
      forced("bank.loans.apply", { amount: 5000, term: 36, rate: 5, accountId: "acc_main" }, "OFFER_NOT_FOUND"), forced("bank.loans.apply", { amount: 9000, term: 36, rate: 9.9, accountId: "acc_main" }, "OFFER_NOT_FOUND"),
      forced("bank.loans.apply", { amount: 5000, term: 36, rate: 9.9, accountId: "acc_main" }, "OTP_REQUIRED"), loans("count", 1),
    ],
  },
  {
    id: "T-31", name: "The bank refuses requests a screen would not send: a purpose it does not know, an employment it does not know, an amount out of step", covers: ["AC-12", "AC-1"], ...base,
    steps: [
      forced("bank.loans.eligibility", { amount: 5000, term: 36, purpose: "Holiday", employment: "Employed", income: 5000, commitments: 0 }, "PURPOSE_INVALID"),
      forced("bank.loans.eligibility", { amount: 5000, term: 36, purpose: "Car", employment: "Pirate", income: 5000, commitments: 0 }, "EMPLOYMENT_INVALID"),
      forced("bank.loans.quote", { amount: 5250, term: 36 }, "AMOUNT_STEP"), forced("bank.loans.quote", { amount: 5000, term: 30 }, "TERM_INVALID"), forced("bank.loans.quote", { amount: 500, term: 36 }, "AMOUNT_RANGE"),
    ],
  },
  {
    id: "T-32", name: "A fourth loan is refused by the bank itself when the offer is accepted, and a loan the bank would refuse is not made", covers: ["AC-9"], ...base, setup: three,
    steps: [forced("bank.loans.eligibility", { amount: 5000, term: 36, purpose: "Car", employment: "Employed", income: 5000, commitments: 0 }, "LOAN_LIMIT"), forced("bank.loans.apply", { amount: 5000, term: 36, rate: 9.9, accountId: "acc_main" }, "LOAN_LIMIT"), loans("count", 3)],
  },
  {
    id: "T-33", name: "The code is not kept: after the result the journey holds neither the code nor the tick", covers: ["AC-7"], ...base,
    steps: [...toCode, ...code(), screen("doneApproved"), noText("482100")],
  },
];
