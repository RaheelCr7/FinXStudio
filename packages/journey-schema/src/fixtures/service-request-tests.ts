import type { Journey } from "../schema";

/** What must be true for "Service request" to be right. Each is proved by at least one scenario below. */
export const serviceRequestAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "The first screen offers only the kinds that are on; a launch value type preselects one." },
  { id: "AC-2", text: "A lost card creates no request and leads to the card controls (or tells the person to call)." },
  { id: "AC-3", text: "Each kind asks for its fields with the validation of the spec; the branch field appears only when collecting." },
  { id: "AC-4", text: "\"Change to\" never offers the account's current type." },
  { id: "AC-5", text: "A sent request returns a reference, the chip Received and rows that repeat what was asked, and appears in my-requests." },
  { id: "AC-6", text: "A second open cheque book request for the same account is refused with \"You already have this request open.\"" },
  { id: "AC-7", text: "When the bank is unavailable or does not answer in time, nothing is sent and nothing is added to my-requests." },
  { id: "AC-8", text: "It needs messages.send, and the bank itself refuses a kind it switched off, a lost card as a request, an account it does not know and fields a screen would not send." },
];

// Alex Morgan on Tuesday 3 November 2026: Main ••4410 (Everyday), Savings ••7731 (Savings), and the two requests SR-204118 (a cheque book for Main, In progress) and SR-203077 (a letter, Done).
// A new request is SR-204119.
const NOW = "2026-11-03T10:00:00Z";
type Step = Record<string, unknown>;
const set = (v: Record<string, unknown>): Step => ({ set: v });
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const error = (m: string): Step => ({ expectError: m });
const inspect = (path: string, equals: unknown): Step => ({ expectBank: { adapter: "sandbox.more.inspect", path, equals } });
const requests = (path: string, equals: unknown): Step => ({ expectBank: { adapter: "bank.requests.list", path, equals } });
const options = (input: Record<string, unknown>, path: string, equals: unknown): Step => ({ expectBank: { adapter: "bank.requests.options", input, path, equals } });
const forced = (input: Record<string, unknown>, c: string): Step => ({ expectBankError: { adapter: "bank.requests.create", input, code: c } });
const base = { persona: "alex", now: NOW };
const pick = (kind: string): Step[] => [set({ "sr.kind": kind }), press("Continue")];
const OTHER = { "sr.subject": "Update my records", "sr.details": "Please update my records after my move." };
const chequeSetup: NonNullable<Journey["scenarios"]>[number]["setup"] = [{ adapter: "bank.requests.create", input: { type: "cheque", accountId: "acc_save", leaves: "25", delivery: "Post to my address" } }];

export const serviceRequestScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "All five kinds are offered when they are on", covers: ["AC-1"], ...base,
    steps: [screen("type"), text("New request"), text("Order cheque book"), text("Request a letter"), text("Report a lost card"), text("Change account type"), text("Other")],
  },
  {
    id: "T-2", name: "With the cheque book switched off the kinds are Request a letter, Report a lost card, Change account type and Other", covers: ["AC-1"], ...base, config: { options: { "service-request": { cheque: false } } },
    steps: [text("Request a letter"), text("Report a lost card"), text("Change account type"), text("Other"), noText("Order cheque book"), options({}, "kindCount", 4)],
  },
  {
    id: "T-3", name: "With letters and account types switched off only the cheque book, a lost card and Other are offered", covers: ["AC-1"], ...base, config: { options: { "service-request": { letter: false, acctype: false } } },
    steps: [text("Order cheque book"), text("Report a lost card"), text("Other"), noText("Request a letter"), noText("Change account type"), options({}, "kindCount", 3)],
  },
  {
    id: "T-4", name: "A kind passed in is chosen: Continue goes on to it", covers: ["AC-1"], ...base, launch: { "launch.type": "letter" },
    steps: [screen("type"), press("Continue"), screen("letter"), text("Request a letter")],
  },
  {
    id: "T-5", name: "A kind that is not offered or not known is ignored: nothing is chosen", covers: ["AC-1"], ...base, launch: { "launch.type": "cheque" }, config: { options: { "service-request": { cheque: false } } },
    steps: [press("Continue"), screen("type"), error("sr.kind")],
  },
  {
    id: "T-6", name: "Nothing chosen is refused on the first screen", covers: ["AC-1"], ...base,
    steps: [press("Continue"), screen("type"), error("sr.kind")],
  },
  {
    id: "T-7", name: "A lost card creates no request: Freeze your card now, then order a new one, and Go to my cards opens the card controls in freeze mode; Continue is blocked", covers: ["AC-2"], ...base,
    steps: [
      ...pick("lost"), screen("lost"), text("Lost or stolen card"), text("Freeze your card now, then order a new one."), noText("Call us now"),
      press("Continue"), screen("lost"), text("Use your card options."), inspect("requests", 2),
      press("Go to my cards"), { expectOpens: { journey: "card-controls", with: { "launch.mode": "freeze" } } },
    ],
  },
  {
    id: "T-8", name: "With the card controls switched off a lost card says to call now, and still creates no request", covers: ["AC-2"], ...base, config: { disabled: ["card-controls"] },
    steps: [...pick("lost"), text("Call us now so we can stop your card."), noText("Freeze your card now"), noText("Go to my cards"), press("Continue"), text("Use your card options."), inspect("requests", 2)],
  },
  {
    id: "T-9", name: "The bank refuses a lost card as a request", covers: ["AC-2", "AC-8"], ...base,
    steps: [forced({ type: "lost", accountId: "acc_main" }, "USE_CARD_OPTIONS"), inspect("requests", 2)],
  },
  {
    id: "T-10", name: "A cheque book of 50 leaves for Savings, collected at Riverside: Request sent, Received, the reference and the rows", covers: ["AC-3", "AC-5"], ...base,
    steps: [
      ...pick("cheque"), screen("cheque"), text("Order cheque book"), text("Leaves"),
      set({ "sr.accountId": "acc_save", "sr.leaves": "50", "sr.delivery": "Collect at a branch" }), set({ "sr.branch": "Riverside" }), press("Submit request"),
      screen("done"), text("Request sent"), text("We’ll update the status under My requests."), text("Received"), text("SR-204119"), text("Order cheque book"), text("Savings ••7731"), text("50"), text("Collect at Riverside"),
      noText("Letter"), requests("SR-204119.status", "Received"), requests("SR-204119.line", "3 Nov 2026 · SR-204119"), requests("SR-204119.rank", 1), inspect("requests", 3),
    ],
  },
  {
    id: "T-11", name: "A cheque book posted to the address is 25 leaves unless 50 is chosen", covers: ["AC-3", "AC-5"], ...base,
    steps: [...pick("cheque"), set({ "sr.accountId": "acc_save" }), press("Submit request"), screen("done"), text("Post to your address"), text("25"), requests("SR-204119.rows.1.value", "25")],
  },
  {
    id: "T-12", name: "A cheque book needs an account, and a branch when collecting", covers: ["AC-3"], ...base,
    steps: [
      ...pick("cheque"), press("Submit request"), screen("cheque"), error("sr.accountId"),
      set({ "sr.accountId": "acc_save", "sr.delivery": "Collect at a branch" }), press("Submit request"), screen("cheque"), error("sr.branch"), inspect("requests", 2),
      set({ "sr.delivery": "Post to my address" }), press("Submit request"), screen("done"),
    ],
  },
  {
    id: "T-13", name: "A letter of Proof of address for Main by Email, addressed to Landlord: the rows of a letter", covers: ["AC-3", "AC-5"], ...base,
    steps: [
      ...pick("letter"), screen("letter"), set({ "sr.letter": "Proof of address", "sr.accountId": "acc_main", "sr.delivery": "Email", "sr.addressedTo": "Landlord" }), press("Submit request"),
      screen("done"), text("Request a letter"), text("Proof of address"), text("Main ••4410"), text("Email"), text("Addressed to"), text("Landlord"), requests("SR-204119.kind", "letter"),
    ],
  },
  {
    id: "T-14", name: "A letter without Addressed to has no such row; it is posted unless another way is chosen", covers: ["AC-3", "AC-5"], ...base,
    steps: [...pick("letter"), set({ "sr.letter": "Balance confirmation", "sr.accountId": "acc_main" }), press("Submit request"), screen("done"), text("Balance confirmation"), text("Post"), noText("Addressed to")],
  },
  {
    id: "T-15", name: "A letter needs the letter and the account, and a branch when collecting; Addressed to is at most 60 characters", covers: ["AC-3"], ...base,
    steps: [
      ...pick("letter"), press("Submit request"), screen("letter"), error("sr.letter"), error("sr.accountId"),
      set({ "sr.letter": "Interest certificate", "sr.accountId": "acc_main", "sr.delivery": "Collect at a branch" }), press("Submit request"), error("sr.branch"),
      set({ "sr.branch": "Station Road", "sr.addressedTo": "x".repeat(61) }), press("Submit request"), screen("letter"), error("Use 60 characters or fewer."),
      set({ "sr.addressedTo": "x".repeat(60) }), press("Submit request"), screen("done"), text("Collect at Station Road"),
    ],
  },
  {
    id: "T-16", name: "Change to never offers the type the account already has: Main is Everyday, so Savings and Premium; Savings offers Everyday and Premium", covers: ["AC-4"], ...base,
    steps: [
      ...pick("acctype"), screen("acctPick"), set({ "sr.accountId": "acc_main" }), press("Continue"), screen("acctype"), text("Now: Everyday"), text("Fees and limits can change. We’ll confirm before we switch it."),
      options({ accountId: "acc_main" }, "changeTo.Savings.id", "Savings"), options({ accountId: "acc_main" }, "changeTo.Premium.id", "Premium"), options({ accountId: "acc_main" }, "changeTo.Everyday", undefined),
      options({ accountId: "acc_save" }, "changeTo.Everyday.id", "Everyday"), options({ accountId: "acc_save" }, "changeTo.Savings", undefined), options({ accountId: "acc_save" }, "changeTo.Premium.id", "Premium"),
      press("Back"), screen("acctPick"), set({ "sr.accountId": "acc_save" }), press("Continue"), text("Now: Savings"),
    ],
  },
  {
    id: "T-17", name: "A change of account type to Premium with a reason: the rows are the account and the new type", covers: ["AC-3", "AC-4", "AC-5"], ...base,
    steps: [
      ...pick("acctype"), set({ "sr.accountId": "acc_save" }), press("Continue"), set({ "sr.changeTo": "Premium", "sr.reason": "I travel a lot" }), press("Submit request"),
      screen("done"), text("Change account type"), text("Savings ••7731"), text("Change to"), text("Premium"), requests("SR-204119.rows.1.value", "Premium"), requests("SR-204119.rows.2.value", "I travel a lot"),
    ],
  },
  {
    id: "T-18", name: "An account type change needs the account, then the type; the reason is at most 300 characters", covers: ["AC-3"], ...base,
    steps: [
      ...pick("acctype"), press("Continue"), screen("acctPick"), error("sr.accountId"), set({ "sr.accountId": "acc_main" }), press("Continue"),
      press("Submit request"), screen("acctype"), error("sr.changeTo"), set({ "sr.changeTo": "Savings", "sr.reason": "r".repeat(301) }), press("Submit request"), error("Use 300 characters or fewer."),
      set({ "sr.reason": "" }), press("Submit request"), screen("done"),
    ],
  },
  {
    id: "T-19", name: "Other: a subject under 3 characters and details under 10 are refused with the words of the spec; then the request is sent with its subject", covers: ["AC-3", "AC-5"], ...base,
    steps: [
      ...pick("other"), screen("other"), set({ "sr.subject": "ab", "sr.details": "Please update my records after my move." }), press("Submit request"), screen("other"), error("Use at least 3 characters."),
      set({ ...OTHER, "sr.details": "short" }), press("Submit request"), error("Write at least 10 characters."),
      set({ ...OTHER }), press("Submit request"), screen("done"), text("Other request"), text("Subject"), text("Update my records"), text("SR-204119"), requests("SR-204119.status", "Received"),
    ],
  },
  {
    id: "T-20", name: "Other with a subject of spaces is refused by the bank in its words, and the form keeps what was typed", covers: ["AC-3", "AC-8"], ...base,
    steps: [...pick("other"), set({ ...OTHER, "sr.subject": "     " }), press("Submit request"), screen("other"), text("Use at least 3 characters."), inspect("requests", 2), set({ "sr.subject": "Update my records" }), press("Submit request"), screen("done")],
  },
  {
    id: "T-21", name: "A name change from the Profile is an Other request about the name, with the subject already filled in", covers: ["AC-3", "AC-1"], ...base, launch: { "launch.type": "name-change" },
    steps: [press("Continue"), screen("other"), set({ "sr.details": "I changed my name last month." }), press("Submit request"), screen("done"), text("Change of name")],
  },
  {
    id: "T-22", name: "A second cheque book request for an account that has one open is refused: You already have this request open, with a button to My requests", covers: ["AC-6"], ...base,
    steps: [
      ...pick("cheque"), set({ "sr.accountId": "acc_main" }), press("Submit request"), screen("cheque"), text("You already have this request open."), press("My requests"), { expectOpens: { journey: "my-requests" } }, inspect("requests", 2),
    ],
  },
  {
    id: "T-23", name: "The same account after the first cheque book was sent is refused; another account is not", covers: ["AC-6"], ...base, setup: chequeSetup,
    steps: [
      ...pick("cheque"), set({ "sr.accountId": "acc_save" }), press("Submit request"), screen("cheque"), text("You already have this request open."), inspect("requests", 3),
      set({ "sr.accountId": "acc_eur" }), press("Submit request"), screen("done"), text("SR-204120"),
    ],
  },
  {
    id: "T-24", name: "A cheque book request that was cancelled or is done does not count as open", covers: ["AC-6"], ...base,
    setup: [{ adapter: "bank.requests.create", input: { type: "cheque", accountId: "acc_save", leaves: "25", delivery: "Post to my address" }, saveAs: "first" }, { adapter: "bank.requests.cancel", input: { requestId: "{{setup.first.requestId}}" } }],
    steps: [...pick("cheque"), set({ "sr.accountId": "acc_save" }), press("Submit request"), screen("done"), text("SR-204120")],
  },
  {
    id: "T-25", name: "When the bank is unavailable nothing is sent and nothing is added to the list", covers: ["AC-7"], ...base, conditions: { unavailable: ["bank.requests.create"] },
    steps: [
      ...pick("other"), set({ ...OTHER }), press("Submit request"), screen("unavailable"), text("We couldn’t send it. Nothing was sent. Try again in a few minutes."), inspect("requests", 2),
      press("Try again"), screen("other"), press("Submit request"), screen("unavailable"),
    ],
  },
  {
    id: "T-26", name: "When the bank does not answer in time nothing is sent: This is taking longer than expected, Nothing was sent", covers: ["AC-7"], ...base, conditions: { timeout: ["bank.requests.create"], latencyMs: 10000 },
    steps: [...pick("cheque"), set({ "sr.accountId": "acc_save" }), press("Submit request"), screen("timeout"), text("This is taking longer than expected. Nothing was sent."), inspect("requests", 2), press("Try again"), screen("cheque")],
  },
  {
    id: "T-27", name: "When the bank is unavailable for a letter or an account type change nothing is sent and Try again returns to the form", covers: ["AC-7"], ...base, conditions: { unavailable: ["bank.requests.create"] },
    steps: [
      ...pick("letter"), set({ "sr.letter": "Proof of address", "sr.accountId": "acc_main" }), press("Submit request"), screen("unavailable"), press("Try again"), screen("letter"), inspect("requests", 2),
    ],
  },
  {
    id: "T-28", name: "When the form's options cannot be read nothing starts", covers: ["AC-7"], ...base, conditions: { unavailable: ["bank.requests.options"] },
    steps: [screen("unavailable"), noText("Order cheque book")],
  },
  {
    id: "T-29", name: "When the options of an account type change cannot be read nothing is sent", covers: ["AC-7"], ...base, conditions: { timeout: ["bank.requests.options"], latencyMs: 10000 },
    steps: [screen("timeout"), text("This is taking longer than expected. Nothing was sent.")],
  },
  {
    id: "T-30", name: "Without messages.send it is not available, and the bank refuses the request", covers: ["AC-8"], ...base, conditions: { withoutPermissions: ["messages.send"] },
    steps: [screen("denied"), text("Not available"), forced({ type: "other", subject: "Update my records", details: "Please update my records after my move." }, "PERMISSION_DENIED")],
  },
  {
    id: "T-31", name: "The bank refuses a kind it switched off, an account it does not know and fields a screen would not send", covers: ["AC-8", "AC-3", "AC-4", "AC-6"], ...base, config: { options: { "service-request": { letter: false } } },
    steps: [
      forced({ type: "letter", accountId: "acc_main", letter: "Proof of address", delivery: "Email" }, "TYPE_UNAVAILABLE"), forced({ type: "weather" }, "TYPE_INVALID"),
      forced({ type: "cheque", accountId: "acc_nope", leaves: "25", delivery: "Post to my address" }, "ACCOUNT_NOT_FOUND"), forced({ type: "cheque", accountId: "acc_save", leaves: "30", delivery: "Post to my address" }, "LEAVES_INVALID"),
      forced({ type: "cheque", accountId: "acc_save", leaves: "25", delivery: "Collect at a branch", branch: "Nowhere" }, "BRANCH_INVALID"), forced({ type: "cheque", accountId: "acc_main", leaves: "25", delivery: "Post to my address" }, "DUPLICATE"),
      forced({ type: "acctype", accountId: "acc_main", changeTo: "Everyday" }, "SAME_TYPE"), forced({ type: "acctype", accountId: "acc_main", changeTo: "Gold" }, "TYPE_INVALID"),
      forced({ type: "other", subject: "ab", details: "Please update my records after my move." }, "SUBJECT_INVALID"), forced({ type: "other", subject: "Update my records", details: "short" }, "DETAILS_INVALID"),
      forced({ type: "other", subject: "Update my records", details: "d".repeat(501) }, "DETAILS_INVALID"), forced({ type: "acctype", accountId: "acc_main", changeTo: "Premium", reason: "r".repeat(301) }, "REASON_INVALID"),
      inspect("requests", 2),
    ],
  },
  {
    id: "T-32", name: "The bank refuses a letter that is not on its list, or a delivery it does not know", covers: ["AC-3", "AC-8"], ...base,
    steps: [
      forced({ type: "letter", accountId: "acc_main", letter: "Birthday card", delivery: "Email" }, "LETTER_INVALID"), forced({ type: "letter", accountId: "acc_main", letter: "Proof of address", delivery: "Courier" }, "DELIVERY_INVALID"),
      forced({ type: "letter", accountId: "acc_main", letter: "Proof of address", delivery: "Email", addressedTo: "x".repeat(61) }, "ADDRESSED_TO_INVALID"),
    ],
  },
  {
    id: "T-33", name: "Back from a form returns to the first screen, and Done leaves", covers: ["AC-1"], ...base,
    steps: [...pick("cheque"), press("Back"), screen("type"), ...pick("letter"), press("Back"), screen("type"), ...pick("other"), press("Back"), screen("type"), ...pick("lost"), press("Back"), screen("type"), press("Done")],
  },
  {
    id: "T-34", name: "Markup in an Other request is kept as written", covers: ["AC-5"], ...base,
    steps: [...pick("other"), set({ "sr.subject": "<b>Records</b>", "sr.details": "<script>alert(1)</script> please" }), press("Submit request"), screen("done"), text("<b>Records</b>"), requests("SR-204119.rows.1.value", "<script>alert(1)</script> please")],
  },
  {
    id: "T-35", name: "After a request is sent, My requests opens the list", covers: ["AC-5"], ...base,
    steps: [...pick("other"), set({ ...OTHER }), press("Submit request"), screen("done"), press("My requests"), { expectOpens: { journey: "my-requests" } }],
  },
  {
    id: "T-36", name: "When the bank is unavailable for an account type change nothing is sent and Try again returns to the type", covers: ["AC-7"], ...base, conditions: { unavailable: ["bank.requests.create"] },
    steps: [
      ...pick("acctype"), set({ "sr.accountId": "acc_main" }), press("Continue"), set({ "sr.changeTo": "Premium" }), press("Submit request"), screen("unavailable"), inspect("requests", 2),
      press("Try again"), screen("acctype"), text("Now: Everyday"),
    ],
  },
];
