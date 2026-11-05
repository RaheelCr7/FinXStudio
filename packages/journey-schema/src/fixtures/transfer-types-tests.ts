import type { Journey } from "../schema";

/** What must be true for "Ways to send money" to be right. Each is proved by at least one scenario below. */
export const transferTypesAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "The screen shows one row for each way to send that is switched on, and each opens the journey that sends that way: between my accounts, and Send money with the type already chosen." },
  { id: "AC-2", text: "The line under \"To another bank\" and \"To another country\" lists exactly the speeds that are on for that type in the bank's home market." },
  { id: "AC-3", text: "The two speed tables show Speed, Arrives, Fee and Limit for the same speeds, with \"Free\" for a zero fee and \"None\" for no limit." },
  { id: "AC-4", text: "Switching a type off removes its row and its table; switching a speed off removes it from the line and the table." },
  { id: "AC-5", text: "No payment scheme name and no country name appears on the screen." },
  { id: "AC-6", text: "With every type off the empty state shows." },
  { id: "AC-7", text: "The screen moves no money and asks for no code; when the speeds cannot be loaded it says nothing was changed, with Try again." },
  { id: "AC-8", text: "It needs payments.create." },
];

// Alex Morgan on Tuesday 3 November 2026; the bank's home market is the default one.
const NOW = "2026-11-03T10:00:00Z";
type Step = Record<string, unknown>;
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const base = { persona: "alex", now: NOW };
const balance = (equals: number): Step => ({ expectBank: { adapter: "bank.accounts.get", input: { accountId: "acc_main" }, path: "balance", equals } });

export const transferTypesScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "The four ways to send, each with its line; nothing moves", covers: ["AC-1", "AC-7"], ...base,
    steps: [screen("ways"), text("Ways to send money"), text("Between my accounts"), text("To a BankWorkx® customer"), text("To another bank"), text("To another country"), noText("code"), balance(8720.76)],
  },
  {
    id: "T-2", name: "Between my accounts opens its own journey", covers: ["AC-1"], ...base,
    steps: [press("Between my accounts"), { expectOpens: { journey: "own-transfer" } }],
  },
  {
    id: "T-3", name: "To a BankWorkx customer opens Send money with that type chosen", covers: ["AC-1"], ...base,
    steps: [press("To a BankWorkx® customer"), { expectOpens: { journey: "personal-transfer", with: { "launch.type": "internal" } } }, screen("payee"), text("Taylor Brooks")],
  },
  {
    id: "T-4", name: "To another bank opens Send money with that type chosen", covers: ["AC-1"], ...base,
    steps: [press("To another bank"), { expectOpens: { journey: "personal-transfer", with: { "launch.type": "domestic" } } }],
  },
  {
    id: "T-5", name: "To another country opens Send money with that type chosen", covers: ["AC-1"], ...base,
    steps: [press("To another country"), { expectOpens: { journey: "personal-transfer", with: { "launch.type": "international" } } }],
  },
  {
    id: "T-6", name: "The lines list the speeds on offer and the tables their arrival, fee and limit", covers: ["AC-2", "AC-3"], ...base,
    steps: [
      text("Standard, Same day, Instant"), text("Speeds, to another bank"), text("1 to 2 business days"), text("Free"), text("$25,000.00"), text("Today"), text("$1.00"), text("None"), text("In seconds"), text("$0.25"), text("$500,000.00"),
      text("Speeds, to another country"), text("1 to 3 business days"), text("$25.00"),
    ],
  },
  {
    id: "T-7", name: "With Priority on, another country offers Standard and Priority", covers: ["AC-2", "AC-3"], ...base, launch: { "opt.speedPriority": true },
    steps: [text("Standard, Priority"), text("Next business day"), text("$40.00")],
  },
  {
    id: "T-8", name: "With the international type off there is no row and no table for another country", covers: ["AC-4"], ...base, launch: { "opt.typeIntl": false },
    steps: [text("To another bank"), noText("To another country"), noText("Speeds, to another country"), text("Speeds, to another bank")],
  },
  {
    id: "T-9", name: "With Same day off it is gone from the line and the table", covers: ["AC-4"], ...base, launch: { "opt.speedSameDay": false },
    steps: [text("Standard, Instant"), noText("Same day"), noText("Today"), noText("$1.00"), text("In seconds")],
  },
  {
    id: "T-10", name: "With the other types off their rows go; with the domestic type off there is no table for another bank", covers: ["AC-4"], ...base, launch: { "opt.typeOwn": false, "opt.typeInternal": false, "opt.typeDomestic": false },
    steps: [noText("Between my accounts"), noText("To a BankWorkx® customer"), noText("To another bank"), noText("Speeds, to another bank"), text("To another country"), text("Speeds, to another country")],
  },
  {
    id: "T-11", name: "No scheme name and no country name is on the screen", covers: ["AC-5"], ...base,
    steps: [
      screen("ways"), noText("ACH"), noText("RTP"), noText("SWIFT"), noText("SEPA"), noText("CHAPS"), noText("Faster Payments"), noText("Bacs"), noText("Fedwire"), noText("United States"), noText("Germany"), noText("Canada"),
    ],
  },
  {
    id: "T-12", name: "With every type off the empty state shows", covers: ["AC-6"], ...base, launch: { "opt.typeOwn": false, "opt.typeInternal": false, "opt.typeDomestic": false, "opt.typeIntl": false },
    steps: [screen("empty"), text("Nothing is switched on"), text("Sending money isn’t available right now."), noText("Between my accounts")],
  },
  {
    id: "T-13", name: "When the speeds cannot be loaded it says so with Try again, and nothing changes", covers: ["AC-7"], ...base, conditions: { unavailable: ["bank.payments.speeds"] },
    steps: [screen("loadFail"), text("We couldn’t load the ways to send money. Nothing was changed."), text("This service is not available right now."), press("Try again"), screen("loadFail"), balance(8720.76)],
  },
  {
    id: "T-14", name: "When the bank does not answer in time it says so with Try again", covers: ["AC-7"], ...base, conditions: { timeout: ["bank.payments.speeds"], latencyMs: 10000 },
    steps: [screen("loadFail"), text("This is taking longer than expected. Nothing was changed."), press("Try again"), screen("loadFail")],
  },
  {
    id: "T-15", name: "Without payments.create it is not available", covers: ["AC-8"], ...base, conditions: { withoutPermissions: ["payments.create"] },
    steps: [screen("denied"), text("Not available"), noText("To another bank")],
  },
];
