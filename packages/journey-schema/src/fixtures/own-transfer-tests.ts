import type { Journey } from "../schema";

/** What must be true for "Between my accounts" to be right. Each is proved by at least one scenario below. */
export const ownTransferAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "A same-currency transfer needs a verified code, moves the exact amount, and both balances change by it with no fee." },
  { id: "AC-2", text: "A different-currency transfer shows the mid-market rate, \"Margin on the rate: None\", the 0.20% fee as its own line, the total taken and what the person gets, before any code is asked." },
  { id: "AC-3", text: "The rate is held 30 seconds; after that the person gets a new rate with the old and new values named and must confirm again; the old rate can never be charged." },
  { id: "AC-4", text: "The amount plus fee can never exceed the available balance; the smallest amount is 1.00." },
  { id: "AC-5", text: "The person can type either what they send or what they get; the other side is computed and rounded as stated." },
  { id: "AC-6", text: "Choosing the same account twice, or a frozen account to send from, is refused with the exact message." },
  { id: "AC-7", text: "With allowFx off a currency pair is refused; with fxFee off the fee line is 0.00." },
  { id: "AC-8", text: "A wrong code three times stops the journey and no balance changes." },
  { id: "AC-9", text: "A timeout tells the person to check Activity and changes no balance; an unavailable service shows the standard message and changes no balance." },
  { id: "AC-10", text: "The daily limit is untouched by a transfer between own accounts." },
];

// The sandbox customer "alexglobal" has Main $8,720.76, Savings $15,254.37, EUR Travel €2,400.00 and AED Home AED 11,000.00.
const PERSONA = "alexglobal";
const NOW = "2026-11-02T09:31:00Z";
type Step = Record<string, unknown>;
const set = (v: Record<string, unknown>): Step => ({ set: v });
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const screen = (s: string): Step => ({ expectScreen: s });
/** Reads one balance from the bank. */
const balance = (account: string, equals: number): Step => ({ expectBank: { adapter: "bank.accounts.list", path: `${account}.balance`, equals } });
const unchanged: Step[] = [balance("acc_main", 8720.76), balance("acc_save", 15254.37), balance("acc_eur", 2400), balance("acc_aed", 11000)];
/** Choose the accounts (From Main by default) and go to the amount. */
const accounts = (from: string, to: string): Step[] => [set({ "own.from": from, "own.to": to }), press("Continue")];
const confirm: Step[] = [set({ "own.consent": true }), press("Confirm and send code")];
const code = (c = "482100"): Step[] => [set({ "otp.code": c })];

const base = { persona: PERSONA, now: NOW };

export const ownTransferScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "Main to Savings, $200 with a note: both balances move, no fee, daily limit untouched", covers: ["AC-1", "AC-10"], ...base,
    steps: [
      ...accounts("acc_main", "acc_save"), set({ "own.amount": 200, "own.note": "Rainy day" }), press("Continue"),
      screen("review"), text("Rainy day"), text("Total taken"), balance("acc_main", 8720.76),
      ...confirm, ...code(), press("Move $200.00"),
      screen("success"), text("Money moved"),
      balance("acc_main", 8520.76), balance("acc_save", 15454.37),
      { expectBank: { adapter: "bank.limits.get", path: "usedToday", equals: 0 } },
    ],
  },
  {
    id: "T-2", name: "Main to Euro, send $500: rate, no margin, fee and total shown before the code; nothing taken until it", covers: ["AC-2", "AC-4"], ...base,
    steps: [
      ...accounts("acc_main", "acc_eur"), set({ "own.amount": 500 }), press("See the rate"),
      screen("review"), text("1 USD = 0.926 EUR"), text("Margin on the rate"), text("None"), text("Fee (0.20%)"), text("Total taken"), text("$501"), text("€463"),
      ...unchanged,
      ...confirm, text("Authorise converting $500.00 to €463.00"), ...code(), press("Convert $500.00"),
      screen("success"), text("Converted"),
      balance("acc_main", 8219.76), balance("acc_eur", 2863),
    ],
  },
  {
    id: "T-3", name: "A rate that ran out: new rate named beside the old one, nothing charged, confirm again at the new rate", covers: ["AC-3"], ...base,
    steps: [
      ...accounts("acc_main", "acc_eur"), set({ "own.amount": 500 }), press("See the rate"), screen("review"),
      ...confirm, ...code(), { advance: 31 }, press("Convert $500.00"),
      screen("review"), text("The rate moved from 0.926 to 0.926185"), text("1 USD = 0.926185 EUR"),
      ...unchanged,
      press("Get a new rate"),
      { expectToast: "New rate: 1 USD = 0.925722 EUR" },
      ...confirm, ...code(), press("Convert $500.00"),
      screen("success"), balance("acc_main", 8219.76), balance("acc_eur", 2862.86),
    ],
  },
  {
    id: "T-4", name: "Typing what they get: €463.00 means sending $500.00 with a $1.00 fee", covers: ["AC-5"], ...base,
    steps: [
      ...accounts("acc_main", "acc_eur"), set({ "own.dir": "get", "own.amount": 463 }), press("See the rate"),
      screen("review"), text("$500"), text("$1"), text("$501"), text("€463"),
    ],
  },
  {
    id: "T-5", name: "Not enough money: the amount plus the fee over what is available, and under the smallest amount", covers: ["AC-4"], ...base,
    steps: [
      ...accounts("acc_main", "acc_eur"),
      set({ "own.amount": 0.5 }), press("See the rate"), screen("amount"), { expectError: "The smallest amount is 1.00." },
      set({ "own.amount": 9000 }), press("See the rate"), screen("amount"), { expectError: "There isn't enough money in Main. Available: $8,720.76, and the fee is $18." },
      // everything they have, but no room for the fee: the bank refuses with the rate
      set({ "own.amount": 8720.76 }), press("See the rate"),
      screen("amountProblem"), text("There isn't enough money in Main."), text("Available: $8,720.76"),
      ...unchanged,
    ],
  },
  {
    id: "T-6", name: "The same account twice, a frozen account to send from (it can still receive)", covers: ["AC-6"], ...base,
    conditions: { frozen: ["acc_save"] },
    steps: [
      ...accounts("acc_main", "acc_main"), screen("problem"), text("Choose two different accounts."),
      press("Choose account"), screen("accounts"),
      ...accounts("acc_save", "acc_main"), screen("problem"), text("You can't send money from this account right now."), text("Choose another account."),
      press("Choose account"),
      ...accounts("acc_main", "acc_save"), screen("amount"),
    ],
  },
  {
    id: "T-7", name: "Conversion switched off refuses a currency pair", covers: ["AC-7"], ...base,
    steps: [
      set({ "opt.allowFx": false }), ...accounts("acc_main", "acc_eur"),
      screen("problem"), text("We can't convert between USD and EUR yet."),
      press("Choose account"), ...accounts("acc_main", "acc_save"), screen("amount"),
    ],
  },
  {
    id: "T-8", name: "Three wrong codes lock the journey and no balance changes", covers: ["AC-8"], ...base,
    steps: [
      ...accounts("acc_main", "acc_save"), set({ "own.amount": 200 }), press("Continue"),
      ...confirm, ...code("111111"), press("Move $200.00"), screen("otp"), press("Move $200.00"), screen("otp"), press("Move $200.00"),
      screen("locked"), text("Too many wrong codes"), text("No money has left your account."),
      ...unchanged,
    ],
  },
  {
    id: "T-9", name: "The bank does not answer in time: Check Activity, nothing moved", covers: ["AC-9"], ...base,
    conditions: { timeout: ["bank.transfers.own"], latencyMs: 10000 },
    steps: [
      ...accounts("acc_main", "acc_save"), set({ "own.amount": 200 }), press("Continue"),
      ...confirm, ...code(), press("Move $200.00"),
      screen("timeout"), text("We didn't get an answer in time"), text("Check Activity before you try again"), press("Check Activity"),
      ...unchanged,
    ],
  },
  {
    id: "T-10", name: "The rate service is unavailable: standard message, nothing changed", covers: ["AC-9"], ...base,
    conditions: { unavailable: ["bank.fx.quote"] },
    steps: [
      ...accounts("acc_main", "acc_eur"), set({ "own.amount": 500 }), press("See the rate"),
      screen("unavailable"), text("Service not available"), text("Nothing was changed."),
      ...unchanged,
    ],
  },
  {
    id: "T-11", name: "The core fails after the code: no money has left the account", covers: ["AC-1"], ...base,
    conditions: { transferFails: true },
    steps: [
      ...accounts("acc_main", "acc_save"), set({ "own.amount": 200 }), press("Continue"),
      ...confirm, ...code(), press("Move $200.00"),
      screen("failed"), text("We couldn't complete this right now."), text("No money has left your account."),
      ...unchanged,
    ],
  },
  {
    id: "T-12", name: "Euro to Dirham, send €100: mid rate, €0.20 fee, €100.20 taken, AED 396.54 received", covers: ["AC-2"], ...base,
    steps: [
      ...accounts("acc_eur", "acc_aed"), set({ "own.amount": 100 }), press("See the rate"),
      screen("review"), text("1 EUR = 3.965443 AED"), text("Fee (0.20%)"), text("€0.20"), text("€100.20"), text("AED 396.54"),
      ...confirm, ...code(), press("Convert €100.00"),
      screen("success"), balance("acc_eur", 2299.8), balance("acc_aed", 11396.54), balance("acc_main", 8720.76),
    ],
  },
  {
    id: "T-13", name: "Typing what they get: €100.00 means $107.9914 rounded up to $108.00, fee $0.22, total $108.22", covers: ["AC-5"], ...base,
    steps: [
      ...accounts("acc_main", "acc_eur"), set({ "own.dir": "get", "own.amount": 100 }), press("See the rate"),
      screen("review"), text("$108"), text("$0.22"), text("$108.22"), text("€100"),
      ...confirm, ...code(), press("Convert $108.00"),
      screen("success"), balance("acc_main", 8612.54), balance("acc_eur", 2500),
    ],
  },
  {
    id: "T-14", name: "Same currency: more than they have is refused with the exact words, and nothing under 1.00", covers: ["AC-4"], ...base,
    steps: [
      ...accounts("acc_main", "acc_save"),
      set({ "own.amount": 0.5 }), press("Continue"), screen("amount"), { expectError: "The smallest amount is 1.00." },
      set({ "own.amount": 8720.77 }), press("Continue"), screen("amount"), { expectError: "There isn't enough money in Main. Available: $8,720.76, and the fee is $0." },
      set({ "own.amount": 8720.76 }), press("Continue"), screen("review"),
    ],
  },
  {
    id: "T-15", name: "With the conversion fee switched off the fee line is 0.00 and the total taken is the amount", covers: ["AC-7"], ...base,
    steps: [
      set({ "opt.fxFee": false }), ...accounts("acc_main", "acc_eur"), set({ "own.amount": 500 }), press("See the rate"),
      screen("review"), text("Fee"), text("$0"), text("$500"),
      ...confirm, ...code(), press("Convert $500.00"),
      screen("success"), balance("acc_main", 8220.76), balance("acc_eur", 2863),
    ],
  },
  {
    id: "T-16", name: "The confirmation must be ticked and the code must be six digits before anything is asked of the bank", covers: ["AC-1"], ...base,
    steps: [
      ...accounts("acc_main", "acc_save"), set({ "own.amount": 200 }), press("Continue"),
      press("Confirm and send code"), screen("review"), { expectError: "Tick to confirm." },
      ...confirm, screen("otp"), press("Move $200.00"), screen("otp"), { expectError: "Enter all 6 digits" },
      ...unchanged,
    ],
  },
  {
    id: "T-17", name: "Services that are down at the start, when sending the code, or when converting show the standard message", covers: ["AC-9"], ...base,
    conditions: { unavailable: ["bank.fx.convert"] },
    steps: [
      ...accounts("acc_main", "acc_eur"), set({ "own.amount": 500 }), press("See the rate"), ...confirm, ...code(), press("Convert $500.00"),
      screen("unavailable"), ...unchanged,
    ],
  },
  {
    id: "T-18", name: "The accounts cannot be loaded: standard message", covers: ["AC-9"], ...base,
    conditions: { unavailable: ["bank.accounts.list"] },
    steps: [screen("unavailable"), text("Service not available")],
  },
  {
    id: "T-19", name: "The code cannot be sent: standard message, nothing changed", covers: ["AC-9"], ...base,
    conditions: { unavailable: ["bank.otp.send"] },
    steps: [
      ...accounts("acc_main", "acc_save"), set({ "own.amount": 200 }), press("Continue"), ...confirm,
      screen("unavailable"), ...unchanged,
    ],
  },
  {
    id: "T-20", name: "Converting: a code that is too short is not sent, and three wrong codes lock the journey", covers: ["AC-8"], ...base,
    steps: [
      ...accounts("acc_main", "acc_eur"), set({ "own.amount": 500 }), press("See the rate"), ...confirm,
      press("Convert $500.00"), screen("otp"), { expectError: "Enter all 6 digits" },
      ...code("111111"), press("Convert $500.00"), screen("otp"), press("Convert $500.00"), screen("otp"), press("Convert $500.00"),
      screen("locked"), text("Too many wrong codes"),
      ...unchanged,
    ],
  },
  {
    id: "T-21", name: "Both accounts must be chosen before going on", covers: ["AC-6"], ...base,
    steps: [set({ "own.from": "" }), press("Continue"), screen("accounts"), { expectError: "own.from" }],
  },
];
