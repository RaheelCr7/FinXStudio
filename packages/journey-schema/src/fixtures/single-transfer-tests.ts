import type { Journey } from "../schema";

/**
 * What must be true for "Quick transfer" to be right. It is an alias of Send money (`personal-transfer`) for the two kinds of saved payee the spec names, so the
 * rules of a payment are proved where they live; here that it opens Send money with the right type and options, and that the rules are the ones of Send money.
 */
export const singleTransferAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "It offers the two kinds of saved payee (another bank, another country) and no BankWorkx® customer and no own account; each opens Send money at that type's saved payees; with both off it says \"Nothing to send with\"." },
  { id: "AC-2", text: "The speeds follow the payee's type, and \"Instant\" disappears when allowInstant is off." },
  { id: "AC-3", text: "Amount, balance, daily-limit, speed-limit and new-payee checks give the messages of Send money." },
  { id: "AC-4", text: "A payee in another country needs a purpose before Review." },
  { id: "AC-5", text: "Later and Repeat appear only when allowLater is on." },
  { id: "AC-6", text: "A one-time code confirms the payment, three wrong codes stop it and no money moves; the payment is sent as Send money sends it." },
  { id: "AC-7", text: "The new-payee limit is Send money's: Quick transfer's coolingOff option switches it." },
];

// The sandbox customer "alexpayees" has Main $8,720.76 and six saved payees: Taylor Brooks (BankWorkx), Jamie Lee and Casey Nguyen (another bank; Casey was added
// 3 hours ago), Marco Rossi, Lena Fischer and James Whitfield (abroad).
const NOW = "2026-11-02T09:31:00Z";
type Step = Record<string, unknown>;
const set = (v: Record<string, unknown>): Step => ({ set: v });
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const balance = (equals: number): Step => ({ expectBank: { adapter: "bank.accounts.list", path: "acc_main.balance", equals } });
const base = { persona: "alexpayees", now: NOW };
const DOMESTIC = "To another bank", ABROAD = "To another country";
const confirm: Step[] = [set({ "pt.consent": true }), press("Confirm and send code")];

export const singleTransferScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "It offers another bank and another country, and no BankWorkx customer", covers: ["AC-1"], ...base,
    steps: [screen("choose"), text("Quick transfer"), text(DOMESTIC), text(ABROAD), noText("To a BankWorkx® customer"), noText("Between my accounts")],
  },
  {
    id: "T-2", name: "Another bank opens Send money at its saved payees: Jamie Lee and Casey Nguyen, not the others", covers: ["AC-1"], ...base,
    steps: [press(DOMESTIC), { expectOpens: { journey: "personal-transfer", with: { "launch.type": "domestic" } } }, screen("payee"), text("Jam (Jamie Lee)"), text("Casey Nguyen"), noText("Taylor Brooks"), noText("Marco Rossi")],
  },
  {
    id: "T-3", name: "Another country opens Send money at its saved payees: Marco Rossi, Lena Fischer and James Whitfield", covers: ["AC-1"], ...base,
    steps: [press(ABROAD), { expectOpens: { journey: "personal-transfer", with: { "launch.type": "international" } } }, screen("payee"), text("Marco Rossi"), text("Lena Fischer"), text("James Whitfield"), noText("Jam (Jamie Lee)")],
  },
  {
    id: "T-4", name: "With both ways off it says Nothing to send with", covers: ["AC-1"], ...base, launch: { "opt.typeDomestic": false, "opt.typeIntl": false },
    steps: [screen("off"), text("Nothing to send with"), text("Sending money isn’t available right now."), noText(DOMESTIC), press("Continue")],
  },
  {
    id: "T-5", name: "With one way off only the other is offered", covers: ["AC-1"], ...base, launch: { "opt.typeIntl": false },
    steps: [text(DOMESTIC), noText(ABROAD)],
  },
  {
    id: "T-6", name: "The speeds for a payee at another bank are Standard, Same day and Instant", covers: ["AC-2"], ...base,
    steps: [press(DOMESTIC), press("Jam (Jamie Lee)"), set({ "pt.amount": 100 }), press("Continue"), screen("options"), text("Standard"), text("Same day"), text("Instant")],
  },
  {
    id: "T-7", name: "With allowInstant off there is no Instant speed", covers: ["AC-2"], ...base, launch: { "opt.allowInstant": false },
    steps: [press(DOMESTIC), { expectOpens: { journey: "personal-transfer", with: { "opt.speedInstant": false } } }, press("Jam (Jamie Lee)"), set({ "pt.amount": 100 }), press("Continue"), screen("options"), text("Standard"), text("Same day"), noText("Instant")],
  },
  {
    id: "T-8", name: "A payment above the balance, and more than $500.00 to a payee added today, are refused with the messages of Send money", covers: ["AC-3", "AC-7"], ...base,
    steps: [
      press(DOMESTIC), press("Casey Nguyen"), set({ "pt.amount": 600 }), press("Continue"), screen("problem"),
      text("Casey Nguyen was added 3 hours ago. For your security you can send up to $500.00 to a new beneficiary in the first 24 hours."), balance(8720.76),
    ],
  },
  {
    id: "T-9", name: "More than the account holds is refused", covers: ["AC-3"], ...base,
    steps: [press(DOMESTIC), press("Jam (Jamie Lee)"), set({ "pt.amount": 9000 }), press("Continue"), screen("problem"), text("Not enough in the account"), balance(8720.76)],
  },
  {
    id: "T-10", name: "With coolingOff off the allowance of a new payee does not apply", covers: ["AC-7"], ...base, launch: { "opt.coolingOff": false },
    steps: [press(DOMESTIC), { expectOpens: { journey: "personal-transfer", with: { "opt.coolingOff": false } } }, press("Casey Nguyen"), set({ "pt.amount": 600 }), press("Continue"), screen("options")],
  },
  {
    id: "T-11", name: "A payee in another country needs a purpose before Review", covers: ["AC-4"], ...base,
    steps: [
      press(ABROAD), press("Marco Rossi"), set({ "pt.amount": 100 }), press("Continue"), screen("problem"), text("Choose a purpose for this payment."), press("Edit"), screen("amount"),
      set({ "pt.purpose": "Rent" }), press("Continue"), screen("options"),
    ],
  },
  {
    id: "T-12", name: "Later appears when allowLater is on", covers: ["AC-5"], ...base,
    steps: [press(DOMESTIC), press("Jam (Jamie Lee)"), set({ "pt.amount": 100 }), press("Continue"), screen("options"), text("When"), text("Later")],
  },
  {
    id: "T-13", name: "With allowLater off there is no When", covers: ["AC-5"], ...base, launch: { "opt.allowLater": false },
    steps: [press(DOMESTIC), press("Jam (Jamie Lee)"), set({ "pt.amount": 100 }), press("Continue"), screen("options"), noText("When"), noText("Later")],
  },
  {
    id: "T-14", name: "A payment of $20 to Jamie Lee is confirmed with a code and sent; the balance falls", covers: ["AC-6"], ...base,
    steps: [
      press(DOMESTIC), press("Jam (Jamie Lee)"), set({ "pt.amount": 20 }), press("Continue"), press("Review"), screen("review"), ...confirm, text("Authorise $20.00 to Jamie Lee"),
      set({ "otp.code": "482100" }), press("Send $20.00"), screen("result"), text("On its way"), balance(8700.76),
    ],
  },
  {
    id: "T-15", name: "Three wrong codes stop the payment and no money moves", covers: ["AC-6"], ...base,
    steps: [
      press(DOMESTIC), press("Jam (Jamie Lee)"), set({ "pt.amount": 20 }), press("Continue"), press("Review"), ...confirm, set({ "otp.code": "111111" }),
      press("Send $20.00"), screen("otp"), press("Send $20.00"), screen("otp"), press("Send $20.00"), screen("locked"), text("No money has left your account."), balance(8720.76),
    ],
  },
  {
    id: "T-16", name: "Another country opens Send money with the bank's options too: Instant off", covers: ["AC-2", "AC-1"], ...base, launch: { "opt.allowInstant": false },
    steps: [press(ABROAD), { expectOpens: { journey: "personal-transfer", with: { "launch.type": "international", "opt.speedInstant": false } } }, screen("payee"), text("Marco Rossi")],
  },
];
