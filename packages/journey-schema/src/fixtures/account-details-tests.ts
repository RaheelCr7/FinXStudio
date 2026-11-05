import type { Journey } from "../schema";

/** What must be true for "Account details" to be right. Each is proved by at least one scenario below. */
export const accountDetailsAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "The big number is the available balance; when holds exist \"Balance\" and \"On hold\" are shown and available equals balance minus holds." },
  { id: "AC-2", text: "The account numbers follow the bank's home market; Share appears only when shareDetails is on." },
  { id: "AC-3", text: "Search narrows the list (title, category, reference or amount) when Search is pressed; All, In and Out filter by direction; a search with no result shows \"No transactions found\" and Clear resets it." },
  { id: "AC-4", text: "Pending items are listed first with a Pending note; the list shows ten rows and Show more adds ten." },
  { id: "AC-5", text: "A transaction shows date, status, counterparty (when known) and reference." },
  { id: "AC-6", text: "Report a problem is offered only on outgoing transactions and only when reportProblem is on; \"Something else\" needs 10 characters; a pending payment accepts only the reasons listed; a second report on the same payment is not offered." },
  { id: "AC-7", text: "Rename accepts 2 to 24 allowed characters, refuses a name another account already shows, and Use the original name removes it." },
  { id: "AC-8", text: "Hide takes the account off the overview and the total; the last visible account cannot be hidden; Show account restores it." },
  { id: "AC-9", text: "Closure is refused with a reason while card payments are on hold or the balance is below zero; otherwise it needs a reason, a destination when there is a balance, the ticked confirmation and the one-time code." },
  { id: "AC-10", text: "After a closure request the account shows \"Closing\" and Cancel the request removes it; Close account is no longer offered." },
  { id: "AC-11", text: "A dormant account shows the warning and Reactivate makes it active." },
  { id: "AC-12", text: "Switching off shareDetails, reportProblem, hideAccount, closeRequest or statement removes only the matching control." },
  { id: "AC-13", text: "When the bank cannot be reached on Send, Save or Request closure, or does not answer in time, nothing is changed and the person is told so." },
  { id: "AC-14", text: "An unknown account says \"Account not found\" with Back to accounts; without accounts.view it is not available; Rename, Hide and Close need accounts.manage, and the bank refuses what skips a screen." },
];

// Alex Morgan on Tuesday 3 November 2026. Main: ledger $8,720.76, available $8,602.36, one card payment on hold ($118.40).
const NOW = "2026-11-03T10:00:00Z";
type Step = Record<string, unknown>;
const set = (v: Record<string, unknown>): Step => ({ set: v });
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const error = (m: string): Step => ({ expectError: m });
const account = (id: string, path: string, equals: unknown): Step => ({ expectBank: { adapter: "bank.accounts.get", input: { accountId: id }, path, equals } });
const base = { persona: "alex", now: NOW, launch: { "launch.accountId": "acc_main" } };
const on = (id: string, extra: Record<string, unknown> = {}) => ({ launch: { "launch.accountId": id, ...extra } });
const forced = (adapter: string, input: Record<string, unknown>, code: string): Step => ({ expectBankError: { adapter, input, code } });
const codeSetup = [{ adapter: "bank.otp.send" }, { adapter: "bank.otp.verify", input: { code: "482100" } }];
const hideSome = (...ids: string[]) => ids.map((accountId) => ({ adapter: "bank.accounts.setHidden", input: { accountId, hidden: true } }));
const close = (reason = "I do not need it"): Step[] => [set({ "ad.cReason": reason, "ad.cDest": "acc_main", "ad.cConsent": true }), press("Request closure")];

export const accountDetailsScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "Main: the big number is the available balance, with Balance and On hold; Savings has no pair", covers: ["AC-1"], ...base,
    steps: [screen("main"), text("Main ••4410"), text("$8,602.36"), text("Available balance"), text("Balance"), text("$8,720.76"), text("On hold"), text("$118.40"), noText("Nothing is on hold."), press("‹ Accounts"), { expectOpens: { journey: "accounts" } }],
  },
  {
    id: "T-2", name: "Savings has nothing on hold, so no Balance and On hold; the interest is shown", covers: ["AC-1"], ...on("acc_save"), persona: "alex", now: NOW,
    steps: [text("Savings ••7731"), text("$15,254.37"), text("Nothing is on hold."), noText("minus money held"), text("Savings account"), text("3.10% a year, variable"), text("14 Mar 2019")],
  },
  {
    id: "T-3", name: "The numbers of the home market are shown with Share; with shareDetails off there is no Share", covers: ["AC-2"], ...base,
    steps: [text("Account numbers"), text("Routing number"), text("100200300"), text("Account number"), text("0000004410"), text("Share details"), text("Current account"), text("None")],
  },
  {
    id: "T-4", name: "With shareDetails off there is no Share", covers: ["AC-2", "AC-12"], ...base, launch: { "launch.accountId": "acc_main", "opt.shareDetails": false },
    steps: [text("Account numbers"), noText("Share details"), text("Rename"), text("Hide account"), text("Close account"), text("Statement")],
  },
  {
    id: "T-5", name: "Search by title, by reference, by amount; Out and In filter; a search with no result says so and Clear brings the list back", covers: ["AC-3"], ...base,
    steps: [
      set({ "ad.q": "BLUE" }), press("Search"), text("Blue Bottle Café"), noText("Metro Transit"), text("1 of 1"),
      set({ "ad.q": "tx-000006" }), press("Search"), text("Maya Chen"), noText("Blue Bottle Café"),
      set({ "ad.q": "4,200" }), press("Search"), text("No transactions found"), set({ "ad.q": "4200.00" }), press("Search"), text("Salary, Northwind"), noText("Maya Chen"),
      set({ "ad.q": "", "ad.dir": "in" }), press("Search"), text("Salary, Northwind"), text("Interest"), noText("Metro Transit"),
      set({ "ad.dir": "out" }), press("Search"), text("Metro Transit"), noText("Salary, Northwind"),
      set({ "ad.q": "zzz", "ad.dir": "all" }), press("Search"), text("No transactions found"), text("Try another search."), press("Clear"), noText("No transactions found"), text("Blue Bottle Café"), text("Salary, Northwind"),
    ],
  },
  {
    id: "T-6", name: "Pending is first with a Pending note, ten rows show, Show more adds the rest", covers: ["AC-4"], ...base,
    steps: [
      text("Pending · −$118.40 · Shopping"), text("−$6.40 · Food · Today"), text("+$4,200.00 · Income · 1 Nov 2026"), text("10 of 17"), noText("Gym membership"), text("Show more"),
      press("Show more"), text("17 of 17"), text("Gym membership"), noText("Show more"),
      // the pending payment is first for the bank too: asked for one row, it is the one
      { expectBank: { adapter: "bank.accounts.transactions", input: { accountId: "acc_main", limit: 1 }, path: "items.0.title", equals: "Online order, Parcel Co" } },
    ],
  },
  {
    id: "T-7", name: "A salary row shows its date, status, who it is from and its reference, and cannot be reported", covers: ["AC-5", "AC-6"], ...base,
    steps: [press("Salary, Northwind"), screen("tx"), text("+$4,200.00"), text("Completed"), text("1 Nov 2026"), text("From"), text("Northwind"), text("TX-000003"), noText("Report a problem"), press("Back"), screen("main")],
  },
  {
    id: "T-8", name: "A card payment is reported once: Report sent with a case, then the payment says so and offers no second report", covers: ["AC-6"], ...base,
    steps: [
      press("Green Grocer"), text("Completed"), text("Report a problem"), press("Report a problem"), screen("report"), text("I was charged twice"), noText("I sent it to the wrong person"),
      press("Send"), error("Required"), set({ "ad.reason": "I was charged twice" }), press("Send"), screen("reported"), text("Report sent"), text("We will reply within 2 working days."), text("DSP-8001"),
      press("Done"), screen("main"), press("Green Grocer"), text("Problem reported. Case DSP-8001."), noText("Report a problem"),
      forced("bank.accounts.reportProblem", { accountId: "acc_main", transactionId: "tx_7", reason: "I was charged twice" }, "DUPLICATE_REPORT"),
    ],
  },
  {
    id: "T-9", name: "A pending payment takes only some reasons; Something else needs 10 characters", covers: ["AC-6"], ...base,
    steps: [
      press("Online order, Parcel Co"), text("Pending"), press("Report a problem"), set({ "ad.reason": "The amount is wrong" }), press("Send"), screen("report"), text("This payment is still pending. Try again when it completes."),
      set({ "ad.reason": "Something else", "ad.note": "short" }), press("Send"), screen("report"), text("Add a few more words."),
      set({ "ad.reason": "I do not recognise it" }), press("Send"), screen("reported"), text("DSP-8001"),
    ],
  },
  {
    id: "T-10", name: "A payment to a person is reported with the reasons for transfers", covers: ["AC-6"], ...base,
    steps: [press("Maya Chen"), press("Report a problem"), text("I sent it to the wrong person"), text("I did not make this transfer"), noText("I was charged twice"), set({ "ad.reason": "Something else", "ad.note": "I never sent this at all" }), press("Send"), screen("reported")],
  },
  {
    id: "T-11", name: "With reportProblem off there is no Report a problem on an outgoing payment", covers: ["AC-6", "AC-12"], ...base, launch: { "launch.accountId": "acc_main", "opt.reportProblem": false },
    steps: [press("Green Grocer"), text("Completed"), noText("Report a problem")],
  },
  {
    id: "T-12", name: "Rename: Holiday fund is saved with Name saved and shown; the original name comes back", covers: ["AC-7"], ...on("acc_save"), persona: "alex", now: NOW,
    steps: [
      press("Rename"), screen("nick"), set({ "ad.name": "  Holiday fund " }), press("Save"), screen("main"), text("Name saved"), text("Holiday fund ••7731"),
      press("Rename"), text("Use the original name"), press("Use the original name"), text("Name reset"), text("Savings ••7731"),
      press("Rename"), noText("Use the original name"),
    ],
  },
  {
    id: "T-13", name: "A name must be 2 to 24 characters of letters, digits and spaces, and not another account's name in any case", covers: ["AC-7"], ...on("acc_save"), persona: "alex", now: NOW,
    steps: [
      press("Rename"), set({ "ad.name": "A" }), press("Save"), screen("nick"), text("Use 2 to 24 characters."),
      set({ "ad.name": "Holiday #1" }), press("Save"), text("Use letters, numbers and spaces."), noText("Use 2 to 24 characters."),
      set({ "ad.name": "eur travel" }), press("Save"), text("You already have an account with this name."),
      set({ "ad.name": "A name of more than twenty-four characters" }), press("Save"), text("Use 2 to 24 characters."),
      set({ "ad.name": "" }), press("Save"), screen("nick"), error("Required"), account("acc_save", "nickname", undefined),
      forced("bank.accounts.rename", { accountId: "acc_save", nickname: "eur travel" }, "NAME_TAKEN"), forced("bank.accounts.rename", { accountId: "acc_save", nickname: "Holiday #1" }, "NAME_CHARS"), forced("bank.accounts.rename", { accountId: "acc_save", nickname: "A" }, "INVALID_NICKNAME"),
    ],
  },
  {
    id: "T-14", name: "Opened at Rename (as account-nickname does), the name is saved and the account shows it", covers: ["AC-7"], ...on("acc_save", { "launch.view": "rename" }), persona: "alex", now: NOW,
    steps: [screen("nick"), text("Rename account"), set({ "ad.name": "Holiday fund" }), press("Save"), screen("main"), text("Name saved"), text("Holiday fund ••7731")],
  },
  {
    id: "T-15", name: "Hide account takes the account to the list, off the total, under Hidden; Show account brings it back", covers: ["AC-8"], ...on("acc_eur"), persona: "alex", now: NOW,
    steps: [press("Hide account"), screen("hide"), text("It stays open and leaves your overview and total."), press("Hide account"), { expectOpens: { journey: "accounts" } }, text("Hidden"), text("••5502 · EUR · €2,400.00 · Hidden"), text("$26,970.77")],
  },
  {
    id: "T-16", name: "A hidden account can be shown again", covers: ["AC-8"], ...on("acc_eur"), persona: "alex", now: NOW, setup: hideSome("acc_eur"),
    steps: [text("Hidden"), noText("Hide account"), press("Show account"), text("Account shown again"), text("Hide account"), noText("Hidden ·"), account("acc_eur", "hidden", undefined)],
  },
  {
    id: "T-17", name: "The last visible account cannot be hidden", covers: ["AC-8"], ...on("acc_aed"), persona: "alex", now: NOW, setup: hideSome("acc_main", "acc_save", "acc_eur"),
    steps: [press("Hide account"), press("Hide account"), screen("hide"), text("Keep at least one account on your overview."), account("acc_aed", "hidden", undefined), forced("bank.accounts.setHidden", { accountId: "acc_aed", hidden: true }, "LAST_VISIBLE_ACCOUNT")],
  },
  {
    id: "T-18", name: "Closing is refused while card payments are on hold, and when the account is overdrawn", covers: ["AC-9"], ...base,
    steps: [press("Close account"), screen("closeBlocked"), text("Card payments are still on hold. Try again when they complete."), noText("overdrawn"), press("Back"), screen("main"), account("acc_main", "status", "active")],
  },
  {
    id: "T-19", name: "An overdrawn account cannot be closed either", covers: ["AC-9"], ...on("acc_spare"), persona: "alexaccounts", now: NOW,
    steps: [text("-$5.00"), press("Close account"), screen("closeBlocked"), text("This account is overdrawn. Pay in the shortfall first."), noText("on hold")],
  },
  {
    id: "T-20", name: "Closing Savings: a reason, where the $15,254.37 goes, a tick and the code; Closure requested with a reference, then Closing", covers: ["AC-9", "AC-10"], ...on("acc_save"), persona: "alex", now: NOW,
    steps: [
      press("Close account"), screen("close"), text("Send $15,254.37 to"), text("I understand that payments and cards linked to this account will stop."),
      press("Request closure"), screen("close"), error("Required"), ...close(), screen("closeCode"), text("Confirm closure"),
      set({ "otp.code": "482100" }), press("Close account"), screen("closed"), text("Closure requested"), text("We will close the account within 14 days."), text("CLS-5001"), text("Main ••4410"),
      press("Done"), screen("main"), text("Closure requested. Reference CLS-5001."), text("Cancel the request"), noText("Close account"), account("acc_save", "status", "closing"),
    ],
  },
  {
    id: "T-21", name: "A reason of Something else needs 10 characters; the tick is needed; the code is needed", covers: ["AC-9"], ...on("acc_save"), persona: "alex", now: NOW,
    steps: [
      press("Close account"), set({ "ad.cReason": "Something else", "ad.cDest": "acc_main", "ad.cConsent": false }), press("Request closure"), error("Tick the confirmation first."), screen("close"),
      set({ "ad.cConsent": true, "ad.cNote": "short" }), press("Request closure"), set({ "otp.code": "482100" }), press("Close account"), screen("close"), text("Add a few more words."), account("acc_save", "status", "active"),
    ],
  },
  {
    id: "T-22", name: "Three wrong codes stop the closure; nothing is closed", covers: ["AC-9"], ...on("acc_save"), persona: "alex", now: NOW,
    steps: [
      press("Close account"), ...close(), set({ "otp.code": "111111" }), press("Close account"), screen("closeCode"), press("Close account"), screen("closeCode"), press("Close account"),
      screen("locked"), text("Too many wrong codes"), account("acc_save", "status", "active"),
    ],
  },
  {
    id: "T-23", name: "A closure already asked for is shown with its reference; Cancel the request makes the account active and Close account is offered again", covers: ["AC-10"], ...on("acc_save"), persona: "alex", now: NOW,
    setup: [...codeSetup, { adapter: "bank.accounts.requestClosure", input: { accountId: "acc_save", reason: "I do not need it", destination: "post" } }],
    steps: [text("Closure requested. Reference CLS-5001."), noText("Close account"), press("Cancel the request"), text("Request cancelled"), noText("Closure requested. Reference"), text("Close account"), account("acc_save", "status", "active")],
  },
  {
    id: "T-24", name: "A dormant account shows the warning; Reactivate makes it active", covers: ["AC-11"], ...on("acc_old"), persona: "alexaccounts", now: NOW,
    steps: [text("Dormant account. Make a deposit or a transfer to use it again."), text("Dormant"), press("Reactivate"), text("Account reactivated"), noText("Dormant account."), account("acc_old", "status", "active")],
  },
  {
    id: "T-25", name: "With hideAccount and closeRequest off there is no Hide and no Close; Rename and Statement stay", covers: ["AC-12"], ...base, launch: { "launch.accountId": "acc_save", "opt.hideAccount": false, "opt.closeRequest": false },
    steps: [text("Rename"), text("Statement"), noText("Hide account"), noText("Close account"), noText("Show account")],
  },
  {
    id: "T-26", name: "With statement off there is no Statement row; with it on Statement opens the statement for this account", covers: ["AC-12"], ...on("acc_save", { "opt.statement": false }), persona: "alex", now: NOW,
    steps: [text("Rename"), noText("Download or email a statement")],
  },
  {
    id: "T-27", name: "Statement opens the statement journey for this account", covers: ["AC-12"], ...on("acc_save"), persona: "alex", now: NOW,
    steps: [press("Statement"), { expectOpens: { journey: "statement", with: { "launch.accountId": "acc_save" } } }],
  },
  {
    id: "T-28", name: "When the bank cannot be reached on Send, nothing is sent and the person is told", covers: ["AC-13"], ...base, conditions: { unavailable: ["bank.accounts.reportProblem"] },
    steps: [press("Green Grocer"), press("Report a problem"), set({ "ad.reason": "I was charged twice" }), press("Send"), screen("report"), text("We could not reach the bank. Nothing was sent."), press("Back"), text("Report a problem")],
  },
  {
    id: "T-29", name: "When the bank cannot be reached on Save, the name is not saved", covers: ["AC-13"], ...on("acc_save"), persona: "alex", now: NOW, conditions: { unavailable: ["bank.accounts.rename"] },
    steps: [press("Rename"), set({ "ad.name": "Holiday fund" }), press("Save"), screen("problem"), text("This isn’t available right now. Nothing was changed."), account("acc_save", "nickname", undefined), press("Try again"), screen("main"), text("Savings ••7731")],
  },
  {
    id: "T-30", name: "When the bank does not answer a closure request in time, nothing is changed", covers: ["AC-13"], ...on("acc_save"), persona: "alex", now: NOW, conditions: { timeout: ["bank.accounts.requestClosure"], latencyMs: 10000 },
    steps: [press("Close account"), ...close(), set({ "otp.code": "482100" }), press("Close account"), screen("problem"), text("This is taking longer than expected. Nothing was changed."), account("acc_save", "status", "active")],
  },
  {
    id: "T-31", name: "When the bank cannot be reached on a closure request, nothing is changed", covers: ["AC-13"], ...on("acc_save"), persona: "alex", now: NOW, conditions: { unavailable: ["bank.accounts.requestClosure"] },
    steps: [press("Close account"), ...close(), set({ "otp.code": "482100" }), press("Close account"), screen("problem"), text("This isn’t available right now. Nothing was changed."), account("acc_save", "status", "active")],
  },
  {
    id: "T-32", name: "An account that does not exist says Account not found, with Back to accounts", covers: ["AC-14"], ...base, launch: { "launch.accountId": "acc_nope" },
    steps: [screen("notFound"), text("Account not found"), text("Choose another."), press("Back to accounts"), { expectOpens: { journey: "accounts" } }],
  },
  {
    id: "T-33", name: "Without accounts.view it is not available", covers: ["AC-14"], ...base, conditions: { withoutPermissions: ["accounts.view"] },
    steps: [screen("denied"), text("Not available"), noText("Available balance")],
  },
  {
    id: "T-34", name: "Without accounts.manage there is no Rename, Hide or Close; the statement and the transactions stay", covers: ["AC-14"], ...base, conditions: { withoutPermissions: ["accounts.manage"] },
    steps: [text("Statement"), text("Transactions"), noText("Rename"), noText("Hide account"), noText("Close account")],
  },
  {
    id: "T-35", name: "The bank refuses a closure that skips the screens: on hold, overdrawn, and without the code", covers: ["AC-14", "AC-9"], ...on("acc_save"), persona: "alexaccounts", now: NOW,
    steps: [
      forced("bank.accounts.requestClosure", { accountId: "acc_main", reason: "I do not need it", destination: "acc_save" }, "ACCOUNT_HAS_HOLDS"),
      forced("bank.accounts.requestClosure", { accountId: "acc_spare", reason: "I do not need it" }, "ACCOUNT_OVERDRAWN"),
      forced("bank.accounts.requestClosure", { accountId: "acc_save", reason: "I do not need it", destination: "acc_main" }, "OTP_REQUIRED"),
      account("acc_save", "status", "active"),
    ],
  },
  {
    id: "T-36", name: "The bank refuses to report a payment received, and a pending payment for the wrong reason", covers: ["AC-14", "AC-6"], ...base,
    steps: [
      forced("bank.accounts.reportProblem", { accountId: "acc_main", transactionId: "tx_3", reason: "Something else", note: "a long enough note" }, "NOT_REPORTABLE"),
      forced("bank.accounts.reportProblem", { accountId: "acc_main", transactionId: "tx_2", reason: "The amount is wrong" }, "PENDING_NOT_DISPUTABLE"),
    ],
  },
  {
    id: "T-37", name: "An account with no activity says so", covers: ["AC-3"], ...on("acc_old"), persona: "alexaccounts", now: NOW,
    steps: [text("No activity yet"), text("Money you send, spend and receive will show here."), noText("No transactions found")],
  },
  {
    id: "T-38", name: "Opened with Hide on in the list, every amount is masked here", covers: ["AC-1"], ...on("acc_main", { "launch.hide": true }), persona: "alex", now: NOW,
    steps: [text("••••••"), noText("$8,602.36"), noText("$8,720.76"), noText("−$118.40"), text("Main ••4410"), press("Salary, Northwind"), noText("$4,200.00"), text("••••••")],
  },
  {
    id: "T-39", name: "An empty code is not sent", covers: ["AC-9"], ...on("acc_save"), persona: "alex", now: NOW,
    steps: [press("Close account"), ...close(), press("Close account"), screen("closeCode"), error("otp.code"), account("acc_save", "status", "active")],
  },
  {
    id: "T-40", name: "When the transactions cannot be loaded nothing is changed and the person is told", covers: ["AC-13"], ...base, conditions: { unavailable: ["bank.accounts.transactions"] },
    steps: [screen("problem"), text("This isn’t available right now. Nothing was changed."), noText("Available balance"), press("Try again"), screen("problem")],
  },
  {
    id: "T-41", name: "When the code cannot be sent the closure is not asked for", covers: ["AC-13"], ...on("acc_save"), persona: "alex", now: NOW, conditions: { unavailable: ["bank.otp.send"] },
    steps: [press("Close account"), ...close(), screen("problem"), text("This isn’t available right now. Nothing was changed."), account("acc_save", "status", "active")],
  },
  {
    id: "T-42", name: "When the bank cannot reactivate a dormant account it stays dormant", covers: ["AC-13", "AC-11"], ...on("acc_old"), persona: "alexaccounts", now: NOW, conditions: { unavailable: ["bank.accounts.restore"] },
    steps: [press("Reactivate"), screen("problem"), text("This isn’t available right now. Nothing was changed."), account("acc_old", "status", "dormant")],
  },
  {
    id: "T-43", name: "When the bank cannot cancel a closure request the account stays Closing", covers: ["AC-13", "AC-10"], ...on("acc_save"), persona: "alex", now: NOW, conditions: { unavailable: ["bank.accounts.restore"] },
    setup: [...codeSetup, { adapter: "bank.accounts.requestClosure", input: { accountId: "acc_save", reason: "I do not need it", destination: "post" } }],
    steps: [press("Cancel the request"), screen("problem"), account("acc_save", "status", "closing")],
  },
];

