import type { Journey } from "../schema";

/** What must be true for "Open another account" to be right. Each is proved by at least one scenario below. */
export const openAnotherAccountAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "A current account can always be chosen; the savings and currency accounts appear only when their options are on." },
  { id: "AC-2", text: "A currency account asks for a currency; the other products skip that step." },
  { id: "AC-3", text: "The name must be 2 to 24 allowed characters and not already used, with the messages of the spec, and the bank applies the same rules itself." },
  { id: "AC-4", text: "Review shows the account, the name and the key facts for the chosen product, and cannot continue until the terms are ticked." },
  { id: "AC-5", text: "A wrong code opens nothing; the right code opens the account with a zero balance and shows \"Account opened\"; three wrong codes end the attempt." },
  { id: "AC-6", text: "With 6 accounts the person cannot continue and sees the limit message, and the bank refuses a seventh." },
  { id: "AC-7", text: "The new account shows in the account list and keeps its name and currency." },
  { id: "AC-8", text: "When the bank is unavailable or times out nothing is opened." },
  { id: "AC-9", text: "It needs accounts.manage, and the bank asks for the code and refuses what skips a screen; a product it is opened with is ticked, an unknown one ignored." },
  { id: "AC-10", text: "If the customer reaches 6 accounts or another account takes the name between the review and the code, the bank refuses and nothing is opened." },
];

// Alex Morgan on Tuesday 3 November 2026 with four accounts (Main, Savings, EUR Travel, AED Home).
const NOW = "2026-11-03T10:00:00Z";
type Step = Record<string, unknown>;
const set = (v: Record<string, unknown>): Step => ({ set: v });
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const error = (m: string): Step => ({ expectError: m });
const base = { persona: "alex", now: NOW };
const count = (equals: number): Step => ({ expectBank: { adapter: "bank.accounts.overview", path: "count", equals } });
const forced = (adapter: string, input: Record<string, unknown>, code: string): Step => ({ expectBankError: { adapter, input, code } });
const code = (c = "482100"): Step[] => [set({ "otp.code": c })];
const toReview = (product: string, name: string): Step[] => [set({ "oa.product": product }), press("Continue"), set({ "oa.name": name }), press("Continue")];

export const openAnotherAccountScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "A savings account called Holiday fund: review with the key facts, the terms, the code; Account opened with a zero balance, and the list has five", covers: ["AC-1", "AC-4", "AC-5", "AC-7"], ...base,
    steps: [
      screen("product"), text("Current account"), text("Savings account"), text("Currency account"), count(4),
      ...toReview("savings", "Holiday fund"), screen("review"), text("Savings account"), text("Holiday fund"), text("3.10% a year, variable"), text("Monthly fee"), text("None"), text("$1.00"), noText("Currency"),
      set({ "oa.consent": true }), press("Continue"), screen("code"), text("Open Holiday fund"), count(4),
      ...code(), press("Open account"), screen("done"), text("Account opened"), text("It’s ready to use."), text("Active"), text("Holiday fund"), text("Savings account"), text("USD"), text("••9101"), text("3 Nov 2026"),
      count(5), { expectBank: { adapter: "bank.accounts.overview", path: "groups.savings.1.balanceText", equals: "$0.00" } },
      { expectBank: { adapter: "bank.accounts.overview", path: "groups.savings.1.name", equals: "Holiday fund" } },
    ],
  },
  {
    id: "T-2", name: "With the savings and currency options off only a current account is offered", covers: ["AC-1"], ...base, launch: { "opt.offerSavings": false, "opt.offerCurrency": false },
    steps: [text("Current account"), noText("Savings account"), noText("Currency account")],
  },
  {
    id: "T-3", name: "With only savings off, a current and a currency account are offered; with only currency off, a current and a savings", covers: ["AC-1"], ...base, launch: { "opt.offerSavings": false },
    steps: [text("Current account"), text("Currency account"), noText("Savings account")],
  },
  {
    id: "T-4", name: "With only currency off, a current and a savings account are offered", covers: ["AC-1"], ...base, launch: { "opt.offerCurrency": false },
    steps: [text("Current account"), text("Savings account"), noText("Currency account"), press("Continue"), error("Required")],
  },
  {
    id: "T-5", name: "A currency account asks which currency; no choice is refused; Pound gives a Pound account in Other currencies", covers: ["AC-2", "AC-7"], ...base,
    steps: [
      set({ "oa.product": "currency" }), press("Continue"), screen("currency"), text("Which currency?"), text("Euro (EUR)"), text("Dirham (AED)"), press("Continue"), error("Required"), screen("currency"),
      set({ "oa.currency": "GBP" }), press("Continue"), screen("name"), set({ "oa.name": "Pounds" }), press("Continue"), text("Pound account"), text("GBP"), text("None"),
      set({ "oa.consent": true }), press("Continue"), ...code(), press("Open account"), text("Account opened"), text("Pound account"), text("GBP"),
      { expectBank: { adapter: "bank.accounts.overview", path: "groups.other.2.name", equals: "Pounds" } },
    ],
  },
  {
    id: "T-6", name: "The other products skip the currency step", covers: ["AC-2"], ...base,
    steps: [set({ "oa.product": "current" }), press("Continue"), screen("name"), text("Name your account"), text("You can change it later.")],
  },
  {
    id: "T-7", name: "A name must be 2 to 24 characters of letters, digits and spaces and not used in any case; the messages are the bank's rules", covers: ["AC-3"], ...base,
    steps: [
      set({ "oa.product": "current" }), press("Continue"), press("Continue"), error("Required"), screen("name"),
      set({ "oa.name": "A" }), press("Continue"), screen("name"), text("Use 2 to 24 characters."),
      set({ "oa.name": "Holiday #1" }), press("Continue"), text("Use letters, numbers and spaces only."), noText("Use 2 to 24 characters."),
      set({ "oa.name": "savings" }), press("Continue"), text("You already have an account with that name."),
      set({ "oa.name": "A name of more than twenty-four characters" }), press("Continue"), text("Use 2 to 24 characters."),
      set({ "oa.name": "  Daily  " }), press("Continue"), screen("review"), count(4),
    ],
  },
  {
    id: "T-8", name: "The bank applies the name rules and the limit and asks for the code itself", covers: ["AC-3", "AC-9"], ...base,
    steps: [
      forced("bank.accounts.open", { product: "current", name: "A" }, "INVALID_NICKNAME"), forced("bank.accounts.open", { product: "current", name: "Holiday #1" }, "NAME_CHARS"),
      forced("bank.accounts.open", { product: "current", name: "EUR TRAVEL" }, "NAME_TAKEN"), forced("bank.accounts.open", { product: "current", name: "Daily" }, "OTP_REQUIRED"),
      forced("bank.accounts.open", { product: "mortgage", name: "Daily" }, "PRODUCT_UNAVAILABLE"), forced("bank.accounts.open", { product: "currency", currency: "JPY", name: "Yen" }, "CURRENCY_REQUIRED"), count(4),
    ],
  },
  {
    id: "T-9", name: "On the review Continue needs the terms ticked; a current account has no interest or minimum", covers: ["AC-4"], ...base,
    steps: [...toReview("current", "Daily"), press("Continue"), error("Please agree to continue."), screen("review"), text("Current account"), text("Interest rate"), text("Minimum balance"), noText("3.10%"), noText("$1.00")],
  },
  {
    id: "T-10", name: "A wrong code opens nothing", covers: ["AC-5"], ...base,
    steps: [...toReview("current", "Daily"), set({ "oa.consent": true }), press("Continue"), ...code("111111"), press("Open account"), screen("code"), count(4)],
  },
  {
    id: "T-11", name: "Three wrong codes end the attempt and nothing is opened", covers: ["AC-5"], ...base,
    steps: [
      ...toReview("current", "Daily"), set({ "oa.consent": true }), press("Continue"), ...code("111111"), press("Open account"), press("Open account"), press("Open account"),
      screen("locked"), text("Too many wrong codes"), text("No account was opened."), count(4),
    ],
  },
  {
    id: "T-12", name: "An empty code is not sent", covers: ["AC-5"], ...base,
    steps: [...toReview("current", "Daily"), set({ "oa.consent": true }), press("Continue"), press("Open account"), screen("code"), error("otp.code"), count(4)],
  },
  {
    id: "T-13", name: "With six accounts the notice shows, Continue is gone and the bank refuses a seventh", covers: ["AC-6"], ...base, persona: "alexaccounts",
    steps: [text("You already have 6 accounts, the most you can hold. Close one to open another."), noText("Continue"), forced("bank.accounts.open", { product: "current", name: "Seventh" }, "ACCOUNT_LIMIT"), count(6)],
  },
  {
    id: "T-14", name: "When the bank is unavailable at the name nothing is opened", covers: ["AC-8"], ...base, conditions: { unavailable: ["bank.accounts.open"] },
    steps: [set({ "oa.product": "current" }), press("Continue"), set({ "oa.name": "Daily" }), press("Continue"), screen("unavailable"), text("This isn’t available right now. Nothing was changed. Try again in a few minutes."), count(4)],
  },
  {
    id: "T-15", name: "When the bank does not answer in time nothing is opened", covers: ["AC-8"], ...base, conditions: { timeout: ["bank.accounts.open"], latencyMs: 10000 },
    steps: [set({ "oa.product": "current" }), press("Continue"), set({ "oa.name": "Daily" }), press("Continue"), screen("timeout"), text("This is taking longer than expected. Nothing was changed."), press("Try again"), screen("product"), count(4)],
  },
  {
    id: "T-16", name: "When the code cannot be sent nothing is opened", covers: ["AC-8"], ...base, conditions: { unavailable: ["bank.otp.send"] },
    steps: [...toReview("current", "Daily"), set({ "oa.consent": true }), press("Continue"), screen("unavailable"), count(4)],
  },
  {
    id: "T-17", name: "When the accounts cannot be read nothing starts", covers: ["AC-8"], ...base, conditions: { unavailable: ["bank.accounts.list"] },
    steps: [screen("unavailable")],
  },
  {
    id: "T-18", name: "Without accounts.manage it is not available, and the bank refuses", covers: ["AC-9"], ...base, conditions: { withoutPermissions: ["accounts.manage"] },
    steps: [screen("denied"), text("Not available"), forced("bank.accounts.open", { product: "current", name: "Daily" }, "PERMISSION_DENIED")],
  },
  {
    id: "T-19", name: "Opened with a product (the Apply button of an offer) it is ticked; an unknown product is ignored", covers: ["AC-9"], ...base, launch: { "launch.product": "savings" },
    steps: [press("Continue"), screen("name"), set({ "oa.name": "Offer" }), press("Continue"), text("Savings account")],
  },
  {
    id: "T-20", name: "An unknown product is ignored: nothing is ticked", covers: ["AC-9"], ...base, launch: { "launch.product": "mortgage" },
    steps: [press("Continue"), error("Required"), screen("product")],
  },
  {
    id: "T-21", name: "Another account takes the name after the review: the bank refuses and nothing is opened", covers: ["AC-10"], ...base,
    steps: [
      ...toReview("current", "Daily"), set({ "oa.consent": true }), press("Continue"),
      // another device opens an account of that name while this one waits for the code
      { expectBank: { adapter: "bank.otp.verify", input: { code: "482100" }, path: "verified", equals: true } },
      { expectBank: { adapter: "bank.accounts.open", input: { product: "current", name: "Daily" }, path: "name", equals: "Daily" } },
      ...code(), press("Open account"), screen("name"), text("You already have an account with that name."), count(5),
    ],
  },
  {
    id: "T-22", name: "Two accounts are opened elsewhere after the review: the sixth is the last the bank allows, the seventh is refused and nothing is opened", covers: ["AC-10", "AC-6"], ...base,
    steps: [
      ...toReview("current", "Daily"), set({ "oa.consent": true }), press("Continue"),
      { expectBank: { adapter: "bank.otp.verify", input: { code: "482100" }, path: "verified", equals: true } },
      { expectBank: { adapter: "bank.accounts.open", input: { product: "current", name: "Other one" }, path: "name", equals: "Other one" } },
      { expectBank: { adapter: "bank.otp.verify", input: { code: "482100" }, path: "verified", equals: true } },
      { expectBank: { adapter: "bank.accounts.open", input: { product: "current", name: "Other two" }, path: "name", equals: "Other two" } },
      ...code(), press("Open account"), screen("product"), text("You already have 6 accounts, the most you can hold."), count(6),
    ],
  },
  {
    id: "T-23", name: "Go to accounts opens the list", covers: ["AC-7"], ...base,
    steps: [...toReview("current", "Daily"), set({ "oa.consent": true }), press("Continue"), ...code(), press("Open account"), press("Go to accounts"), { expectOpens: { journey: "accounts" } }, text("Daily"), text("••9101 · USD · $0.00")],
  },
];
