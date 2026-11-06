import type { Journey } from "../schema";

/** What must be true for "Connect a bank" to be right. Each is proved by at least one scenario below. */
export const connectAccountAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "The bank list leaves out banks already connected; a connected bank shows with its account count and end date and can be disconnected after a confirmation." },
  { id: "AC-2", text: "The person must agree before continuing; the screen says what is shared, until when, and that BankWorkx can only read." },
  { id: "AC-3", text: "The other bank's sign-in is a separate step; Deny connects nothing and says so." },
  { id: "AC-4", text: "An unavailable bank connects nothing and says so." },
  { id: "AC-5", text: "At least one account must be chosen; the credit card appears only with allowCards." },
  { id: "AC-6", text: "After connecting, the chosen accounts show as read only with their balances; none can be used in a payment journey." },
  { id: "AC-7", text: "The sharing period follows the market (365, 90, 180, 365 days) and amounts use the market symbol." },
  { id: "AC-8", text: "Disconnecting removes the bank's accounts from the list." },
  { id: "AC-9", text: "When the bank is unavailable or does not answer in time, nothing is connected." },
  { id: "AC-10", text: "It needs accounts.manage, and the bank itself asks for the agreement, refuses a connection that was not started, a bank that is connected or not answering and a choice of no account, and writes every connection and disconnection to the log without a value." },
];

// Alex Morgan on Tuesday 3 November 2026 (Market A). He has Summit Federal ••9876 connected (Savings, until 1 Mar 2027). Harbor Bank has one account (Current ••1137, $2,410.45); Maple Credit Union has
// Current ••1274 $2,510.45, Savings ••5422 $9,620.80 and Credit card ••8186 −$440.15; Lakeside Bank never answers. Sharing lasts 365 days: until 3 Nov 2027.
const NOW = "2026-11-03T10:00:00Z";
type Step = Record<string, unknown>;
const set = (v: Record<string, unknown>): Step => ({ set: v });
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const error = (m: string): Step => ({ expectError: m });
const toast = (t: string): Step => ({ expectToast: t });
const linked = (path: string, equals: unknown): Step => ({ expectBank: { adapter: "bank.accounts.linked", path, equals } });
const banks = (path: string, equals: unknown): Step => ({ expectBank: { adapter: "bank.connections.banks", path, equals } });
const inspect = (path: string, equals: unknown): Step => ({ expectBank: { adapter: "sandbox.more.inspect", path, equals } });
const forced = (adapter: string, input: Record<string, unknown>, c: string): Step => ({ expectBankError: { adapter, input, code: c } });
const base = { persona: "alex", now: NOW };
/** From the first screen to the other bank's sign-in with a bank chosen. */
const toSignIn = (bank: string): Step[] => [set({ "cx.bankId": bank }), press("Continue"), screen("consent"), set({ "cx.consent": true }), press("Continue"), screen("signin")];
const allow = (): Step[] => [press("Allow"), screen("accounts")];
/** The calls a connection makes, as setup: Maple Credit Union with all three accounts. */
const maple: NonNullable<Journey["scenarios"]>[number]["setup"] = [
  { adapter: "bank.connections.start", input: { bankId: "maple" }, saveAs: "cx" },
  { adapter: "bank.connections.finish", input: { state: "{{setup.cx.state}}", consent: true, pick1: true, pick2: true, pick3: true } },
];
const start = (bankId: string, saveAs = "cx") => ({ adapter: "bank.connections.start", input: { bankId }, saveAs });

export const connectAccountScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "Maple Credit Union: agree, Allow, leave all three on, Connect: Bank connected with the bank, 3 accounts and the date sharing ends; the accounts are read only with their balances", covers: ["AC-2", "AC-5", "AC-6"], ...base,
    steps: [
      screen("bank"), text("Connect a bank"), text("See your accounts from another bank here."), ...toSignIn("maple"), ...allow(),
      text("Choose accounts"), text("Current ••1274"), text("$2,510.45"), text("Savings ••5422"), text("$9,620.80"), text("Credit card ••8186"), text("−$440.15"),
      press("Connect"), screen("done"), text("Bank connected"), text("Its accounts are on your Accounts tab, read only."), text("Bank"), text("Maple Credit Union"), text("Accounts"), text("3"), text("Shared until"), text("3 Nov 2027"),
      linked("l_maple_current.title", "Maple Credit Union Current"), linked("l_maple_current.line", "At Maple Credit Union (read only)"), linked("l_maple_current.balanceText", "$2,510.45"),
      linked("l_maple_savings.balanceText", "$9,620.80"), linked("l_maple_credit.balanceText", "−$440.15"), linked("l_maple_credit.readOnly", true), linked("l_maple_current.maskedNumber", "••1274"),
    ],
  },
  {
    id: "T-2", name: "With every switch off Connect says Choose at least one account, and nothing is connected", covers: ["AC-5"], ...base,
    steps: [...toSignIn("maple"), ...allow(), set({ "cx.on1": false, "cx.on2": false, "cx.on3": false }), press("Connect"), screen("accounts"), text("Choose at least one account."), linked("l_maple_current", undefined), inspect("log", [])],
  },
  {
    id: "T-3", name: "With allowCards off only Current and Savings are listed and the result says 2 accounts", covers: ["AC-5"], ...base, launch: { "opt.allowCards": false }, config: { options: { "connect-account": { allowCards: false } } },
    steps: [...toSignIn("maple"), ...allow(), text("Current ••1274"), text("Savings ••5422"), noText("Credit card"), press("Connect"), screen("done"), text("Accounts"), text("2"), linked("l_maple_credit", undefined)],
  },
  {
    id: "T-4", name: "Harbor Bank has one account: only Current is offered, and the result says 1", covers: ["AC-5", "AC-6"], ...base,
    steps: [...toSignIn("harbor"), ...allow(), text("Current ••1137"), text("$2,410.45"), noText("Savings"), noText("Credit card"), press("Connect"), screen("done"), text("1"), linked("l_harbor_current.balanceText", "$2,410.45")],
  },
  {
    id: "T-5", name: "The screen says what is shared, until when and that BankWorkx can only read; Continue without the tick says Agree to continue", covers: ["AC-2"], ...base,
    steps: [
      set({ "cx.bankId": "maple" }), press("Continue"), screen("consent"), text("Maple Credit Union will share with BankWorkx®"), text("Account names and last 4 digits"), text("Balances"), text("Transactions from the last 12 months"),
      text("Until 3 Nov 2027"), text("We can only read. We can’t move money."), press("Continue"), screen("consent"), error("Agree to continue."), noText("Sign in at your bank"),
      set({ "cx.consent": true }), press("Continue"), screen("signin"),
    ],
  },
  {
    id: "T-6", name: "The bank's own sign-in is a separate step that says it is secure; the person never types a password here", covers: ["AC-3"], ...base,
    steps: [...toSignIn("maple"), text("Sign in at your bank"), text("Secure sign-in"), text("BankWorkx® wants to read your accounts."), text("You’re signed in at Maple Credit Union."), noText("Password"), noText("Username")],
  },
  {
    id: "T-7", name: "Deny connects nothing and says so: Access was not allowed. Nothing was connected.; the bank is not in Connected", covers: ["AC-3"], ...base,
    steps: [...toSignIn("maple"), press("Deny"), screen("refused"), text("Access was not allowed. Nothing was connected."), linked("l_maple_current", undefined), inspect("log", []), press("Back to start"), screen("bank"), text("Maple Credit Union")],
  },
  {
    id: "T-8", name: "Lakeside Bank never answers: That bank isn’t answering right now. Nothing was connected. Try again later; Choose another bank starts again", covers: ["AC-4"], ...base,
    steps: [...toSignIn("lakeside"), press("Allow"), screen("unreachable"), text("That bank isn’t answering right now. Nothing was connected. Try again later."), inspect("log", []), press("Choose another bank"), screen("bank")],
  },
  {
    id: "T-9", name: "A connected bank is left out of the list; Connected shows it with its account count and end date", covers: ["AC-1"], ...base, setup: maple,
    steps: [
      screen("bank"), text("Connected"), text("Disconnect Maple Credit Union"), text("3 accounts · until 3 Nov 2027"), text("Disconnect Summit Federal"), text("1 account · until 1 Mar 2027"),
      banks("banks.maple", undefined), banks("banks.harbor.id", "harbor"), banks("connectedCount", 2),
    ],
  },
  {
    id: "T-10", name: "Disconnect asks first: Disconnect Maple Credit Union?, Its accounts leave your list; Disconnect removes the bank and its accounts with the toast Bank disconnected", covers: ["AC-1", "AC-8"], ...base, setup: maple,
    steps: [
      press("Disconnect Maple Credit Union"), screen("bank"), text("Disconnect Maple Credit Union?"), text("Its accounts leave your list."), linked("l_maple_current.title", "Maple Credit Union Current"),
      press("Disconnect"), screen("bank"), toast("Bank disconnected"), noText("Disconnect Maple Credit Union"), linked("l_maple_current", undefined), linked("l_maple_savings", undefined), linked("l_maple_credit", undefined),
      banks("banks.maple.id", "maple"), inspect("log", ["connections.maple.added", "connections.maple.removed"]), linked("l_summit.bank", "Summit Federal"),
    ],
  },
  {
    id: "T-11", name: "Keep leaves the bank connected", covers: ["AC-1"], ...base, setup: maple,
    steps: [press("Disconnect Maple Credit Union"), press("Keep"), screen("bank"), noText("Disconnect Maple Credit Union?"), text("Disconnect Maple Credit Union"), linked("l_maple_current.title", "Maple Credit Union Current")],
  },
  {
    id: "T-12", name: "The bank that was already connected when the person signed up can be disconnected too", covers: ["AC-1", "AC-8"], ...base,
    steps: [press("Disconnect Summit Federal"), press("Disconnect"), toast("Bank disconnected"), linked("l_summit", undefined), noText("Disconnect Summit Federal")],
  },
  {
    id: "T-13", name: "A connected account is read only: it is not one of the accounts that can send money, and the bank offers it nowhere to pay from", covers: ["AC-6"], ...base, setup: maple,
    steps: [
      { expectBank: { adapter: "bank.accounts.list", path: "l_maple_current", equals: undefined } }, { expectBank: { adapter: "bank.accounts.list", path: "l_maple_savings", equals: undefined } },
      { expectBank: { adapter: "bank.accounts.payFrom", path: "accounts.l_maple_current", equals: undefined } }, { expectBank: { adapter: "bank.accounts.payFrom", path: "count", equals: 2 } }, linked("l_maple_current.readOnly", true),
    ],
  },
  {
    id: "T-14", name: "Market B: sharing lasts 90 days and amounts have the pound sign", covers: ["AC-7"], ...base, config: { homeMarket: "uk" },
    steps: [set({ "cx.bankId": "maple" }), press("Continue"), text("Until 1 Feb 2027"), set({ "cx.consent": true }), press("Continue"), ...allow(), text("£2,510.45"), text("−£440.15"), press("Connect"), text("1 Feb 2027"), linked("l_maple_current.balanceText", "£2,510.45")],
  },
  {
    id: "T-15", name: "Market C: sharing lasts 180 days and amounts have the euro sign", covers: ["AC-7"], ...base, config: { homeMarket: "eu" },
    steps: [set({ "cx.bankId": "maple" }), press("Continue"), text("Until 2 May 2027"), set({ "cx.consent": true }), press("Continue"), ...allow(), text("€2,510.45"), press("Connect"), text("2 May 2027"), linked("l_maple_savings.balanceText", "€9,620.80")],
  },
  {
    id: "T-16", name: "Market D: sharing lasts 365 days and amounts have AED", covers: ["AC-7"], ...base, config: { homeMarket: "ae" },
    steps: [set({ "cx.bankId": "maple" }), press("Continue"), text("Until 3 Nov 2027"), set({ "cx.consent": true }), press("Continue"), ...allow(), text("AED 2,510.45"), press("Connect"), text("3 Nov 2027"), linked("l_maple_current.balanceText", "AED 2,510.45")],
  },
  {
    id: "T-17", name: "When the bank is unavailable on Connect nothing is connected, and Try again returns to the accounts", covers: ["AC-9"], ...base, conditions: { unavailable: ["bank.connections.finish"] },
    steps: [...toSignIn("maple"), ...allow(), press("Connect"), screen("unavailable"), text("We couldn’t reach the bank"), text("We couldn’t reach the bank. Nothing was connected."), linked("l_maple_current", undefined), press("Try again"), screen("accounts")],
  },
  {
    id: "T-18", name: "When the bank does not answer in time on Connect nothing is connected: This is taking longer than expected", covers: ["AC-9"], ...base, conditions: { timeout: ["bank.connections.finish"], latencyMs: 10000 },
    steps: [...toSignIn("maple"), ...allow(), press("Connect"), screen("timeout"), text("This is taking longer than expected. Nothing was connected."), linked("l_maple_current", undefined), press("Try again"), screen("accounts")],
  },
  {
    id: "T-19", name: "When the bank is unavailable on Allow nothing is connected, and Try again returns to the sign-in", covers: ["AC-9"], ...base, conditions: { unavailable: ["bank.connections.start"] },
    steps: [...toSignIn("maple"), press("Allow"), screen("unavailable"), text("Nothing was connected."), press("Try again"), screen("signin")],
  },
  {
    id: "T-20", name: "When the bank does not answer in time on Allow nothing is connected", covers: ["AC-9"], ...base, conditions: { timeout: ["bank.connections.start"], latencyMs: 10000 },
    steps: [...toSignIn("maple"), press("Allow"), screen("timeout"), text("This is taking longer than expected. Nothing was connected."), press("Try again"), screen("signin")],
  },
  {
    id: "T-21", name: "When the list of banks cannot be read nothing starts", covers: ["AC-9"], ...base, conditions: { unavailable: ["bank.connections.banks"] },
    steps: [screen("loadFail"), text("We couldn’t reach the bank"), noText("Your bank"), press("Try again"), screen("loadFail")],
  },
  {
    id: "T-22", name: "When a disconnect cannot be made the bank stays connected and the person is told", covers: ["AC-9", "AC-8"], ...base, setup: maple, conditions: { unavailable: ["bank.connections.remove"] },
    steps: [press("Disconnect Maple Credit Union"), press("Disconnect"), screen("bank"), text("This isn’t available right now. Nothing was changed. Try again in a few minutes."), linked("l_maple_current.title", "Maple Credit Union Current"), noText("Disconnect Maple Credit Union?")],
  },
  {
    id: "T-23", name: "When a disconnect does not get an answer in time the bank stays connected", covers: ["AC-9", "AC-8"], ...base, setup: maple, conditions: { timeout: ["bank.connections.remove"], latencyMs: 10000 },
    steps: [press("Disconnect Maple Credit Union"), press("Disconnect"), text("This is taking longer than expected. Nothing was changed."), linked("l_maple_current.title", "Maple Credit Union Current")],
  },
  {
    id: "T-24", name: "A bank passed in with a link is chosen and still confirmed with Continue; one that is not on the list is ignored", covers: ["AC-1"], ...base, launch: { "launch.bank": "maple" },
    steps: [press("Continue"), screen("consent"), text("Maple Credit Union will share")],
  },
  {
    id: "T-25", name: "A bank passed in that is not offered is ignored: nothing is chosen", covers: ["AC-1"], ...base, launch: { "launch.bank": "nowhere" },
    steps: [press("Continue"), screen("bank"), error("cx.bankId")],
  },
  {
    id: "T-26", name: "Without accounts.manage it is not available, and the bank refuses the connection", covers: ["AC-10"], ...base, conditions: { withoutPermissions: ["accounts.manage"] },
    steps: [screen("denied"), text("Not available"), forced("bank.connections.start", { bankId: "maple" }, "PERMISSION_DENIED"), forced("bank.connections.remove", { bankId: "summit" }, "PERMISSION_DENIED")],
  },
  {
    id: "T-27", name: "The bank asks for the agreement itself, needs a connection that was started, an account chosen, and refuses a bank that is connected, unknown or not answering", covers: ["AC-10", "AC-5", "AC-4"], ...base,
    setup: [start("maple")],
    steps: [
      forced("bank.connections.finish", { state: "cx_maple_1", pick1: true }, "CONSENT_REQUIRED"), forced("bank.connections.finish", { state: "cx_maple_1", consent: true, pick1: false, pick2: false, pick3: false }, "NO_ACCOUNT_CHOSEN"),
      forced("bank.connections.finish", { state: "nope", consent: true, pick1: true }, "STATE_INVALID"), forced("bank.connections.finish", { state: "cx_maple_1", denied: true }, "ACCESS_DENIED"),
      forced("bank.connections.finish", { state: "cx_maple_1", consent: true, pick1: true }, "STATE_INVALID"),
      forced("bank.connections.start", { bankId: "lakeside" }, "BANK_UNAVAILABLE"), forced("bank.connections.start", { bankId: "nowhere" }, "BANK_NOT_FOUND"), forced("bank.connections.remove", { bankId: "nowhere" }, "LINK_NOT_FOUND"),
      linked("l_maple_current", undefined),
    ],
  },
  {
    id: "T-28", name: "The bank refuses a bank that is already connected, at the start and when a second connection is finished", covers: ["AC-10", "AC-1"], ...base, setup: [...maple, start("northern", "n1")],
    steps: [
      forced("bank.connections.start", { bankId: "maple" }, "ALREADY_CONNECTED"), forced("bank.connections.start", { bankId: "summit" }, "BANK_NOT_FOUND"),
      { expectBank: { adapter: "bank.connections.finish", input: { state: "{{setup.n1.state}}", consent: true, pick1: true }, path: "accounts", equals: 1 } },
    ],
  },
  {
    id: "T-29", name: "Every connection and disconnection is logged without a value, and the bank is told it connected in the notification list", covers: ["AC-10"], ...base, setup: maple,
    steps: [inspect("log", ["connections.maple.added"]), { expectBank: { adapter: "bank.notifications.list", path: "n_more101.text", equals: "Maple Credit Union connected" } }, inspect("outbox", [])],
  },
  {
    id: "T-30", name: "Back goes one step: from the agreement to the list, from the sign-in to the agreement, from the accounts to the sign-in", covers: ["AC-2"], ...base,
    steps: [...toSignIn("maple"), press("Back"), screen("consent"), press("Back"), screen("bank"), set({ "cx.bankId": "maple" }), press("Continue"), set({ "cx.consent": true }), press("Continue"), ...allow(), press("Back"), screen("signin")],
  },
  {
    id: "T-31", name: "Nothing chosen on the first screen is refused", covers: ["AC-1"], ...base,
    steps: [press("Continue"), screen("bank"), error("cx.bankId"), press("Done")],
  },
  {
    id: "T-32", name: "After connecting, See accounts opens the accounts", covers: ["AC-6"], ...base,
    steps: [...toSignIn("harbor"), ...allow(), press("Connect"), screen("done"), press("See accounts"), { expectOpens: { journey: "accounts" } }],
  },
];
