import type { Journey } from "../schema";

/** What must be true for "To a BankWorkx® customer" to be right. The rules are those of Send money; this is the same flow, opened at its first step. */
export const internalTransferAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "It opens at the BankWorkx® customer step with no choice of type: saved customers first, a new one found by mobile number, email or BankWorkx ID. When the bank has switched this way of sending off it says \"Nothing to send with\"." },
  { id: "AC-2", text: "It keeps every rule of Send money for this type: free, instant, up to 25,000.00 a payment, the 500.00 allowance of a new payee, the confirmation and the one-time code, three wrong codes stop it, and every bank call has a way out." },
];

const NOW = "2026-11-02T09:31:00Z";
type Step = Record<string, unknown>;
const set = (v: Record<string, unknown>): Step => ({ set: v });
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const balance = (account: string, equals: number): Step => ({ expectBank: { adapter: "bank.accounts.list", path: `${account}.balance`, equals } });
const unchanged: Step[] = [balance("acc_main", 8720.76), balance("acc_save", 15254.37), { expectBank: { adapter: "bank.limits.get", path: "usedToday", equals: 0 } }];
/** Jordan Keller, found by mobile number, as the new payee: on to the amount. */
const jordan: Step[] = [set({ "pt.mobile": "+1 202 555 0177" }), press("Continue"), screen("amount"), text("Jordan Keller")];
const confirm: Step[] = [set({ "pt.consent": true }), press("Confirm and send code")];
const code = (c = "482100"): Step[] => [set({ "otp.code": c })];
const base = { persona: "alexpayees", now: NOW };

export const internalTransferScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "Opens at the saved customers, with no choice of type; a new customer is found by mobile number", covers: ["AC-1"], ...base,
    steps: [screen("payee"), text("Taylor Brooks"), noText("To another bank"), noText("To another country"), press("New payee"), screen("details"), text("Mobile number"), press("Back"), screen("payee")],
  },
  {
    id: "T-2", name: "With no saved customer it opens at the search; a customer found by mobile number gets $50, free and instant", covers: ["AC-1", "AC-2"], ...base, persona: "alexglobal",
    steps: [
      screen("details"), text("Find them by"), ...jordan, set({ "pt.amount": 50 }), press("Continue"),
      screen("review"), text("Instant"), text("Free"), noText("Send on"), ...confirm, ...code(), text("Authorise $50.00 to Jordan Keller"), press("Send $50.00"),
      screen("result"), text("Sent"), text("Delivered"), balance("acc_main", 8670.76),
      // Jordan was saved with the payment, as a new payee: the next payment starts at the saved customers
      press("Send another"), screen("payee"), text("Jordan Keller"), text("New · 24 hours left"),
    ],
  },
  {
    id: "T-3", name: "When the bank has switched this way of sending off: Nothing to send with", covers: ["AC-1"], ...base,
    steps: [set({ "opt.typeInternal": false }), press("Back"), screen("type"), text("Nothing to send with"), text("Sending money isn’t available right now."), press("Continue")],
  },
  {
    id: "T-4", name: "Over 25,000.00 is refused; a saved customer gets a payment of $20 straight away", covers: ["AC-2"], ...base,
    steps: [
      press("Taylor Brooks"), set({ "pt.amount": 30000 }), press("Continue"), screen("problem"), text("You can send up to $25,000.00 at a time."), press("Change amount"),
      set({ "pt.amount": 20 }), press("Continue"), screen("review"), text("Taylor Brooks"), ...unchanged,
    ],
  },
  {
    id: "T-5", name: "A customer found just now is a new payee: more than $500.00 is refused", covers: ["AC-2"], ...base,
    steps: [press("New payee"), ...jordan, set({ "pt.amount": 600 }), press("Continue"), screen("problem"), text("Jordan Keller was added 0 hours ago."), text("up to $500.00 more now"), ...unchanged],
  },
  {
    id: "T-6", name: "Three wrong codes stop the payment and no money moves", covers: ["AC-2"], ...base,
    steps: [
      press("Taylor Brooks"), set({ "pt.amount": 20 }), press("Continue"), ...confirm, ...code("111111"),
      press("Send $20.00"), screen("otp"), press("Send $20.00"), screen("otp"), press("Send $20.00"), screen("locked"), text("No money has left your account."), ...unchanged,
    ],
  },
  {
    id: "T-7", name: "The lookup is not available, or the payment does not answer in time: nothing sent", covers: ["AC-2"], ...base, conditions: { unavailable: ["bank.payees.lookup"], timeout: ["bank.payments.create"], latencyMs: 10000 },
    steps: [
      press("New payee"), set({ "pt.mobile": "+1 202 555 0177" }), press("Continue"), screen("unavailable"), text("Nothing was changed."), press("Try again"), screen("details"),
      press("Back"), press("Taylor Brooks"), set({ "pt.amount": 20 }), press("Continue"), ...confirm, ...code(), press("Send $20.00"),
      screen("timeout"), text("Check Activity before you try again"), ...unchanged,
    ],
  },
];
