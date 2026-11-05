import type { Journey } from "../schema";

/** What must be true for "Statement" to be right. Each is proved by at least one scenario below. */
export const statementAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "A Statement for a chosen account and one of the four period choices shows the right opening and closing balance and file name, as PDF by default." },
  { id: "AC-2", text: "Custom dates refuse an end before the start, a start before the account opened, and a period over 24 months (12 for an official statement)." },
  { id: "AC-3", text: "A Statement can be delivered as PDF or CSV (and OFX or QIF when allowOfxQif is on); letters, certificates and official statements are PDF only." },
  { id: "AC-4", text: "Choosing Email shows the masked address, the button reads Email statement, and the result says it was emailed." },
  { id: "AC-5", text: "A period with no transactions is refused with \"No transactions in this period.\" and no document or fee is produced." },
  { id: "AC-6", text: "An official statement or a balance certificate shows the fee when officialFee is on, asks for a tick and a code, and takes the fee only after the code, in the account's currency; with too little available balance it is refused before the code." },
  { id: "AC-7", text: "A proof of address letter and a balance certificate have no period; a letter for a dormant account is refused." },
  { id: "AC-8", text: "The Type list shows only the types the bank has switched on; with only the plain statement on, the Type field is not drawn." },
  { id: "AC-9", text: "With allowPaperless on, the toggle appears for a Statement; turning it off shows the paper fee line, and the choice is remembered for that account." },
  { id: "AC-10", text: "A wrong code does not issue the document and takes no fee; three wrong codes end the attempt." },
  { id: "AC-11", text: "When the bank is unavailable or times out nothing is issued and no fee is taken." },
  { id: "AC-12", text: "It needs accounts.statement; an unknown account says so; and the bank refuses a request that skips a screen (no code, a plain statement through the official door, a period it does not allow)." },
];

// Alex Morgan on Tuesday 3 November 2026. Main: ledger $8,720.76, available $8,602.36; the account opened on 14 Mar 2019.
const NOW = "2026-11-03T10:00:00Z";
type Step = Record<string, unknown>;
const set = (v: Record<string, unknown>): Step => ({ set: v });
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const error = (m: string): Step => ({ expectError: m });
const balance = (id: string, equals: number): Step => ({ expectBank: { adapter: "bank.accounts.get", input: { accountId: id }, path: "balance", equals } });
const forced = (adapter: string, input: Record<string, unknown>, code: string): Step => ({ expectBankError: { adapter, input, code } });
const base = { persona: "alex", now: NOW, launch: { "launch.accountId": "acc_main" } };
const on = (id: string, extra: Record<string, unknown> = {}) => ({ persona: "alex", now: NOW, launch: { "launch.accountId": id, ...extra } });
const custom = (from: string, to: string): Step[] => [set({ "st.period": "custom", "st.from": from, "st.to": to }), press("Continue")];
const code = (c = "482100"): Step[] => [set({ "otp.code": c })];
const MAIN = "acc_main";
const OCT = { accountId: MAIN, period: "last" };

export const statementScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "A statement for last month: balances, the file name as PDF, no fee, and nothing moves", covers: ["AC-1"], ...base,
    steps: [
      screen("where"), text("Main"), text("Last month"), press("Continue"), screen("format"), text("Statement · 1 Oct 2026 to 31 Oct 2026"), noText("Fee:"), press("Get statement"),
      screen("done"), text("Statement ready"), text("Your PDF is ready."), text("Opening balance"), text("$2,085.95"), text("Closing balance"), text("$4,527.16"),
      text("statement-4410-2026-10-01-2026-10-31.pdf · 106 KB"), text("Download"), noText("Fee"), balance(MAIN, 8720.76),
    ],
  },
  {
    id: "T-2", name: "This month: from the 1st to today", covers: ["AC-1"], ...base,
    steps: [
      set({ "st.period": "this" }), press("Continue"), text("1 Nov 2026 to 3 Nov 2026"), press("Get statement"), text("statement-4410-2026-11-01-2026-11-03.pdf · 52 KB"),
    ],
  },
  {
    id: "T-3", name: "Last 3 months and a custom week", covers: ["AC-1"], ...base,
    steps: [
      set({ "st.period": "3m" }), press("Continue"), text("3 Aug 2026 to 3 Nov 2026"), press("Back"), screen("where"),
      ...custom("2026-10-05", "2026-10-10"), text("5 Oct 2026 to 10 Oct 2026"), press("Get statement"), text("statement-4410-2026-10-05-2026-10-10.pdf · 46 KB"),
    ],
  },
  {
    id: "T-4", name: "Custom dates: before the account opened, end before start, over 24 months, official over 12 months", covers: ["AC-2"], ...base,
    steps: [
      ...custom("2019-03-13", "2026-10-01"), screen("where"), text("This account opened on 14 Mar 2019."),
      ...custom("2026-10-10", "2026-10-01"), text("The end date is before the start date."), noText("This account opened"),
      ...custom("2024-11-03", "2026-11-04"), text("Use 24 months or less."),
      ...custom("2024-11-03", "2026-11-03"), screen("format"), press("Back"),
      press("Official statement"), ...custom("2025-11-03", "2026-11-04"), screen("where"), text("Use 12 months or less."),
      set({ "st.from": "", "st.to": "" }), press("Continue"), error("Required"),
    ],
  },
  {
    id: "T-5", name: "A statement as CSV; with allowOfxQif off there is no OFX or QIF; an official statement has no format to choose", covers: ["AC-3"], ...base,
    steps: [
      press("Continue"), text("PDF"), text("CSV"), noText("OFX"), noText("QIF"), set({ "st.format": "csv" }), press("Get statement"), text("Your CSV is ready."), text("statement-4410-2026-10-01-2026-10-31.csv"),
    ],
  },
  {
    id: "T-6", name: "With allowOfxQif on a statement offers OFX and QIF; an official statement offers PDF only", covers: ["AC-3"], ...on(MAIN, { "opt.allowOfxQif": true }),
    steps: [
      press("Continue"), text("OFX"), text("QIF"), set({ "st.format": "qif" }), press("Get statement"), text("Your QIF is ready."), text("statement-4410-2026-10-01-2026-10-31.qif"),
    ],
  },
  {
    id: "T-7", name: "An official statement shows no format to choose", covers: ["AC-3"], ...on(MAIN, { "opt.allowOfxQif": true }),
    steps: [press("Official statement"), press("Continue"), screen("format"), noText("CSV"), noText("OFX"), text("Fee: $5.00")],
  },
  {
    id: "T-8", name: "Email: the masked address, the button Email statement, and On its way", covers: ["AC-4"], ...base,
    steps: [
      press("Continue"), noText("We email it to"), set({ "st.delivery": "email" }), text("We email it to a•••@example.com."), noText("Get statement"), press("Email statement"),
      screen("done"), text("On its way"), text("We emailed it. It can take a few minutes."), text("Emailed to a•••@example.com"), noText("Your PDF is ready."),
    ],
  },
  {
    id: "T-9", name: "A period with nothing in it is refused before any document: Savings this month", covers: ["AC-5"], ...on("acc_save"),
    steps: [set({ "st.period": "this" }), press("Continue"), screen("where"), text("No transactions in this period."), balance("acc_save", 15254.37)],
  },
  {
    id: "T-10", name: "An official statement shows its fee and needs the tick, then the code; the fee is taken after the code", covers: ["AC-6"], ...base,
    steps: [
      press("Official statement"), text("Selected · Stamped by the bank · a fee applies"), press("Continue"), screen("format"), text("Fee: $5.00"), text("I agree to pay the fee of $5.00."),
      press("Continue"), error("Tick the confirmation first."), screen("format"), balance(MAIN, 8720.76),
      set({ "st.consent": true }), press("Continue"), screen("code"), text("Confirm official statement"), balance(MAIN, 8720.76),
      ...code(), press("Issue official statement"), screen("done"), text("Statement ready"), text("Official statement"), text("Fee"), text("$5.00"), balance(MAIN, 8715.76),
    ],
  },
  {
    id: "T-11", name: "With too little available balance the fee is refused before the code is asked: Spare, overdrawn by $5.00", covers: ["AC-6"], ...on("acc_spare"), persona: "alexaccounts",
    steps: [press("Official statement"), ...custom("2026-10-01", "2026-10-31"), screen("where"), text("Not enough available balance for the fee."), balance("acc_spare", -5)],
  },
  {
    id: "T-12", name: "With officialFee off an official statement has no fee and no tick, but still a code", covers: ["AC-6"], ...on(MAIN, { "opt.officialFee": false }),
    steps: [
      press("Official statement"), noText("a fee applies"), press("Continue"), screen("format"), noText("Fee:"), noText("I agree to pay"), press("Continue"), screen("code"),
      ...code(), press("Issue official statement"), screen("done"), noText("Fee"), balance(MAIN, 8720.76),
    ],
  },
  {
    id: "T-13", name: "A balance certificate in euros: the fee is converted (€4.63) and taken after the code", covers: ["AC-6", "AC-7"], ...on("acc_eur", { "opt.allowBalanceCert": true }),
    steps: [
      press("Balance certificate"), noText("Last month"), press("Continue"), screen("format"), text("Balance certificate · As of 3 Nov 2026"), text("Fee: €4.63"), set({ "st.consent": true }), press("Continue"),
      ...code(), press("Issue balance certificate"), screen("done"), text("Balance"), text("€2,400.00"), text("€4.63"), balance("acc_eur", 2395.37),
    ],
  },
  {
    id: "T-14", name: "A proof of address letter has no period and no fee, and needs a code", covers: ["AC-7"], ...base,
    steps: [
      press("Proof of address letter"), noText("Last month"), noText("Custom dates"), press("Continue"), screen("format"), text("Proof of address letter · As of 3 Nov 2026"), noText("Fee:"), noText("Paperless"),
      press("Continue"), screen("code"), text("Confirm proof of address letter"), ...code(), press("Issue proof of address letter"), screen("done"), text("As of 3 Nov 2026"), text("address-letter-4410-2026-11-03.pdf"), balance(MAIN, 8720.76),
    ],
  },
  {
    id: "T-15", name: "A letter for a dormant account is refused", covers: ["AC-7"], ...on("acc_old"), persona: "alexaccounts",
    steps: [press("Proof of address letter"), press("Continue"), screen("where"), text("This account is dormant. Make a deposit first.")],
  },
  {
    id: "T-16", name: "The Type list shows the types the bank has on: Balance certificate only when allowBalanceCert is on", covers: ["AC-8"], ...base,
    steps: [text("Type"), text("Statement"), text("Official statement"), text("Proof of address letter"), noText("Balance certificate")],
  },
  {
    id: "T-17", name: "With only the plain statement on the Type field is not drawn", covers: ["AC-8"], ...on(MAIN, { "opt.allowOfficial": false, "opt.allowLetter": false }),
    steps: [noText("Type"), noText("Official statement"), noText("Proof of address letter"), noText("Balance certificate"), text("Last month"), press("Continue"), screen("format")],
  },
  {
    id: "T-18", name: "The toggle is on for a statement; turning it off shows the paper fee and the bank remembers it for the account", covers: ["AC-9"], ...base,
    steps: [
      press("Continue"), text("Paperless statements"), noText("Paper statements cost"), set({ "st.paperless": false }), text("Paper statements cost $2.00 a month."), press("Get statement"), screen("done"),
      { expectBank: { adapter: "bank.accounts.get", input: { accountId: MAIN }, path: "paperless", equals: false } },
    ],
  },
  {
    id: "T-19", name: "Opened again on the same account the toggle is still off; with allowPaperless off there is no toggle", covers: ["AC-9"], ...base,
    setup: [{ adapter: "bank.statements.deliver", input: { ...OCT, kind: "statement", paperless: false } }],
    steps: [press("Continue"), text("Paperless statements"), text("Paper statements cost $2.00 a month.")],
  },
  {
    id: "T-20", name: "With allowPaperless off there is no toggle and no paper fee", covers: ["AC-9"], ...on(MAIN, { "opt.allowPaperless": false }),
    steps: [press("Continue"), noText("Paperless statements"), noText("Paper statements cost")],
  },
  {
    id: "T-21", name: "A wrong code does not issue the document or take the fee; three wrong codes end the attempt", covers: ["AC-10"], ...base,
    steps: [
      press("Official statement"), press("Continue"), set({ "st.consent": true }), press("Continue"), ...code("111111"), press("Issue official statement"), screen("code"), balance(MAIN, 8720.76),
      press("Issue official statement"), screen("code"), press("Issue official statement"), screen("locked"), text("Too many wrong codes"), text("no fee was taken"), balance(MAIN, 8720.76),
    ],
  },
  {
    id: "T-22", name: "When the bank is unavailable nothing is issued and no fee is taken", covers: ["AC-11"], ...base, conditions: { unavailable: ["bank.statements.prepare"] },
    steps: [press("Continue"), screen("unavailable"), text("Service not available"), text("Nothing was changed and no fee was taken."), balance(MAIN, 8720.76)],
  },
  {
    id: "T-23", name: "When the bank does not answer in time nothing is issued and no fee is taken", covers: ["AC-11"], ...base, conditions: { timeout: ["bank.statements.prepare"], latencyMs: 10000 },
    steps: [press("Continue"), screen("timeout"), text("We didn’t get an answer in time. Nothing was changed and no fee was taken."), balance(MAIN, 8720.76)],
  },
  {
    id: "T-24", name: "When the official document does not come in time the fee is not taken", covers: ["AC-11"], ...base, conditions: { timeout: ["bank.statements.issue"], latencyMs: 10000 },
    steps: [press("Official statement"), press("Continue"), set({ "st.consent": true }), press("Continue"), ...code(), press("Issue official statement"), screen("timeout"), balance(MAIN, 8720.76)],
  },
  {
    id: "T-25", name: "When the bank is unavailable on a plain statement or when sending the code, nothing is issued", covers: ["AC-11"], ...base, conditions: { unavailable: ["bank.statements.deliver", "bank.otp.send"] },
    steps: [press("Continue"), press("Get statement"), screen("unavailable"), press("Try again"), screen("where"), press("Official statement"), press("Continue"), set({ "st.consent": true }), press("Continue"), screen("unavailable"), balance(MAIN, 8720.76)],
  },
  {
    id: "T-26", name: "Without accounts.statement it is not available", covers: ["AC-12"], ...base, conditions: { withoutPermissions: ["accounts.statement"] },
    steps: [screen("denied"), text("Not available"), noText("Last month"), forced("bank.statements.deliver", OCT, "PERMISSION_DENIED")],
  },
  {
    id: "T-27", name: "An unknown account says Account not found", covers: ["AC-12"], ...on("acc_nope"),
    steps: [screen("notFound"), text("Account not found"), press("Back to accounts"), { expectOpens: { journey: "accounts" } }],
  },
  {
    id: "T-28", name: "The bank refuses what skips the screens: no code, a plain statement through the official door, an official one through the plain door", covers: ["AC-12", "AC-10"], ...base,
    steps: [
      forced("bank.statements.issue", { ...OCT, kind: "official" }, "OTP_REQUIRED"), forced("bank.statements.issue", { ...OCT, kind: "statement" }, "NOT_OFFICIAL"),
      forced("bank.statements.deliver", { ...OCT, kind: "official" }, "OTP_REQUIRED"), balance(MAIN, 8720.76),
    ],
  },
  {
    id: "T-29", name: "The bank refuses dates and periods itself", covers: ["AC-12", "AC-2", "AC-5"], ...base,
    steps: [
      forced("bank.statements.prepare", { accountId: MAIN, kind: "statement", period: "custom", from: "2026-10-10", to: "2026-10-01" }, "RANGE_INVALID"),
      forced("bank.statements.prepare", { accountId: MAIN, kind: "statement", period: "custom", from: "2019-03-13", to: "2026-10-01" }, "BEFORE_OPENING"),
      forced("bank.statements.prepare", { accountId: MAIN, kind: "statement", period: "custom", from: "2024-11-03", to: "2026-11-04" }, "PERIOD_TOO_LONG"),
      forced("bank.statements.prepare", { accountId: MAIN, kind: "official", period: "custom", from: "2025-11-03", to: "2026-11-04" }, "PERIOD_TOO_LONG"),
      forced("bank.statements.prepare", { accountId: "acc_save", kind: "statement", period: "this" }, "NO_TRANSACTIONS"),
      forced("bank.statements.deliver", { accountId: "acc_save", kind: "statement", period: "this" }, "NO_TRANSACTIONS"),
    ],
  },
  {
    id: "T-30", name: "The bank refuses a letter for a dormant account and a fee the account cannot pay, past the screens", covers: ["AC-12", "AC-6", "AC-7"], ...base, persona: "alexaccounts",
    steps: [
      forced("bank.statements.prepare", { accountId: "acc_old", kind: "letter" }, "ACCOUNT_DORMANT"),
      forced("bank.statements.prepare", { accountId: "acc_spare", kind: "official", period: "custom", from: "2026-10-01", to: "2026-10-31" }, "FEE_INSUFFICIENT_FUNDS"),
      { expectBank: { adapter: "bank.statements.prepare", input: { accountId: "acc_aed", kind: "certificate" }, path: "fee", equals: 18.36 } },
    ],
  },
  {
    id: "T-31", name: "Back to account opens account-details for the account", covers: ["AC-1"], ...base,
    steps: [press("Continue"), press("Get statement"), press("Back to account"), { expectOpens: { journey: "account-details", with: { "launch.accountId": MAIN } } }, screen("main")],
  },
  {
    id: "T-32", name: "Opened with no account it starts with the first one", covers: ["AC-1"], persona: "alex", now: NOW,
    steps: [screen("where"), press("Continue"), text("Main ••4410")],
  },
  {
    id: "T-33", name: "When the accounts cannot be read nothing starts", covers: ["AC-11"], ...base, conditions: { unavailable: ["bank.accounts.list"] },
    steps: [screen("unavailable"), text("Nothing was changed and no fee was taken.")],
  },
  {
    id: "T-34", name: "When the bank is unavailable on an emailed statement nothing is sent", covers: ["AC-11", "AC-4"], ...base, conditions: { unavailable: ["bank.statements.deliver"] },
    steps: [press("Continue"), set({ "st.delivery": "email" }), press("Email statement"), screen("unavailable"), balance(MAIN, 8720.76)],
  },
  {
    id: "T-35", name: "An empty or short code is not sent", covers: ["AC-10"], ...base,
    steps: [press("Official statement"), press("Continue"), set({ "st.consent": true }), press("Continue"), press("Issue official statement"), screen("code"), error("otp.code"), set({ "otp.code": "12" }), press("Issue official statement"), error("otp.code"), balance(MAIN, 8720.76)],
  },
];
