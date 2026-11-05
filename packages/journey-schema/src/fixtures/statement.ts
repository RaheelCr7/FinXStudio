import type { Block, Journey, Screen } from "../schema";
import { statementAcceptance, statementScenarios } from "./statement-tests";
import { alert, button, denied, go, lacks, route, set, text } from "./accounts-kit";

const PERIODS = "(st.kind == 'statement' || st.kind == 'official')";
const CUSTOM = `${PERIODS} && st.period == 'custom'`;
const MORE = "(opt.allowOfficial != false || opt.allowLetter != false || opt.allowBalanceCert == true)";
const sel = (kind: string) => `{{st.kind == '${kind}' ? 'Selected · ' : ''}}`;
const pick = (kind: string) => [set("st.kind", kind), set("st.format", "pdf"), set("st.err", "")];
/** One type of document, shown when the bank offers it (and the Type field is drawn at all only when there is more than one). */
const kindRow = (id: string, label: string, line: string, kind: string, when: string): Block => ({ type: "menu", visibleWhen: `${MORE} && ${when}`, items: [{ id, label, text: `${sel(kind)}${line}`, actions: pick(kind) }] });

/** What the bank is asked, for checking and for issuing: the same everywhere, so a document is never issued on other terms than it was checked. */
const doc = {
  accountId: "{{st.account}}", kind: "{{st.kind}}", period: "{{st.period}}", from: "{{st.from}}", to: "{{st.to}}", format: "{{st.format}}", delivery: "{{st.delivery}}",
  allowOfxQif: "{{opt.allowOfxQif == true}}", fee: "{{opt.officialFee != false}}",
};
const wipe = [set("otp.code", "")];
const toFail = { navigate: "fail" };

/**
 * Statement (BankWorkx, Personal: Accounts). A statement for an account and a period, as PDF or CSV, downloaded or emailed; the bank can add an official
 * stamped statement, a proof of address letter and a balance certificate. A plain statement is free and needs no code. An official statement or a
 * certificate shows its fee, asks for a tick and a one-time code, and the fee is taken only when the document is issued, after the code. The bank checks the
 * period, the dormant account and the fee when Continue is pressed, so a document that cannot be issued is refused before the code.
 *
 * Built from the spec of the prototype with the blocks FinX has: the checks the spec shows on the second screen (no transactions, the fee) are made together
 * with the dates on the first, because one call to the bank makes them; the bank's own words are shown above the form. Download opens the print or share
 * sheet of the page rather than saving a file.
 */
export const statement: Journey = {
  id: "jrn_bankworkx_statement",
  slug: "statement",
  name: "Statement",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: statementAcceptance,
  scenarios: statementScenarios,
  dataModel: {
    "launch.accountId": { type: "string" },
    "opt.allowOfficial": { type: "boolean" },
    "opt.allowLetter": { type: "boolean" },
    "opt.allowBalanceCert": { type: "boolean" },
    "opt.officialFee": { type: "boolean" },
    "opt.allowPaperless": { type: "boolean" },
    "opt.allowOfxQif": { type: "boolean" },
    "st.account": { type: "string", required: true },
    "st.kind": { type: "string" },
    "st.period": { type: "string" },
    "st.from": { type: "string", required: true },
    "st.to": { type: "string", required: true },
    "st.format": { type: "string" },
    "st.delivery": { type: "string" },
    "st.paperless": { type: "boolean" },
    "st.consent": { type: "boolean", required: true },
    "otp.code": { type: "string", required: true, pattern: "^[0-9]{6}$" },
  },
  integrations: [
    { id: "accounts", adapter: "bank.accounts.list", mode: "sandbox" },
    { id: "first", adapter: "bank.accounts.get", mode: "sandbox" },
    { id: "prepare", adapter: "bank.statements.prepare", mode: "sandbox" },
    { id: "deliver", adapter: "bank.statements.deliver", mode: "sandbox" },
    { id: "otpSend", adapter: "bank.otp.send", mode: "sandbox" },
    { id: "otpVerify", adapter: "bank.otp.verify", mode: "sandbox" },
    { id: "issue", adapter: "bank.statements.issue", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Statements", kind: "branch",
      onEnter: [
        set("st.kind", "statement"), set("st.period", "last"), set("st.from", ""), set("st.to", ""), set("st.format", "pdf"), set("st.delivery", "download"), set("st.err", ""), set("st.consent", false), set("ctx.error", null), ...wipe,
        { type: "callApi", integration: "accounts", saveAs: "ctx.accounts", onError: toFail },
        // opened with an account it is that one; opened with none, the bank's first
        { type: "callApi", integration: "first", input: { accountId: "{{launch.accountId}}" }, saveAs: "ctx.first", onError: toFail },
        set("st.account", "{{ctx.first.id}}"),
        go("where"),
      ],
      navigation: route([lacks("accounts.statement"), "denied"]),
      blocks: [],
    },
    {
      id: "where", title: "Statements",
      blocks: [
        text("Statements", "title"),
        alert("error", "{{st.err}}", "st.err"),
        { type: "accountPicker", bind: "st.account", source: "ctx.accounts", showBalance: true },
        { type: "sectionHeader", title: "Type", visibleWhen: MORE },
        kindRow("statement", "Statement", "Your transactions for a period, free", "statement", "true"),
        kindRow("official", "Official statement", "Stamped by the bank{{opt.officialFee != false ? ' · a fee applies' : ''}}", "official", "opt.allowOfficial != false"),
        kindRow("letter", "Proof of address letter", "A letter with your address, as of today", "letter", "opt.allowLetter != false"),
        kindRow("certificate", "Balance certificate", "Your balance as of today{{opt.officialFee != false ? ' · a fee applies' : ''}}", "certificate", "opt.allowBalanceCert == true"),
        { type: "select", bind: "st.period", label: "Period", visibleWhen: PERIODS, choices: [{ id: "this", label: "This month" }, { id: "last", label: "Last month" }, { id: "3m", label: "Last 3 months" }, { id: "custom", label: "Custom dates" }] },
        { type: "dateInput", bind: "st.from", label: "From", visibleWhen: CUSTOM },
        { type: "dateInput", bind: "st.to", label: "To", visibleWhen: CUSTOM },
        button("Continue", [
          { type: "validate" }, set("st.err", ""), set("st.format", "pdf"),
          { type: "callApi", integration: "prepare", input: doc, saveAs: "ctx.prep", onError: toFail },
          go("format"),
        ]),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "format", title: "Format and delivery",
      onEnter: [set("st.paperless", "{{ctx.accounts[st.account].paperless != false}}"), set("st.consent", false)],
      blocks: [
        text("Format and delivery", "title"),
        text("{{ctx.prep.kindLabel}} · {{ctx.prep.periodText}}", "caption"),
        text("{{ctx.prep.name}} {{ctx.prep.maskedNumber}}", "caption"),
        { type: "select", bind: "st.format", label: "Format", choices: [{ id: "pdf", label: "PDF" }, { id: "csv", label: "CSV" }], visibleWhen: "st.kind == 'statement' && opt.allowOfxQif != true" },
        { type: "select", bind: "st.format", label: "Format", choices: [{ id: "pdf", label: "PDF" }, { id: "csv", label: "CSV" }, { id: "ofx", label: "OFX" }, { id: "qif", label: "QIF" }], visibleWhen: "st.kind == 'statement' && opt.allowOfxQif == true" },
        { type: "select", bind: "st.delivery", label: "Delivery", choices: [{ id: "download", label: "Download" }, { id: "email", label: "Email" }] },
        text("We email it to {{ctx.prep.emailMasked}}.", "caption", "st.delivery == 'email'"),
        { type: "toggle", bind: "st.paperless", label: "Paperless statements", visibleWhen: "st.kind == 'statement' && opt.allowPaperless != false" },
        text("Paper statements cost {{ctx.prep.paperFeeText}} a month.", "caption", "st.kind == 'statement' && opt.allowPaperless != false && !st.paperless"),
        text("Fee: {{ctx.prep.feeText}}", "title", "ctx.prep.fee > 0"),
        {
          type: "consent", bind: "st.consent", termsVersion: "statement-fee-v1", visibleWhen: "ctx.prep.fee > 0", text: "I agree to pay the fee of {{ctx.prep.feeText}}.",
          validation: { mustBeTrue: true, messages: { mustBeTrue: "Tick the confirmation first." } },
        },
        button("Get statement", [{ type: "callApi", integration: "deliver", input: { ...doc, paperless: "{{st.paperless}}" }, saveAs: "st.res", onError: toFail }, go("done")], "primary", "!ctx.prep.needsCode && st.delivery == 'download'"),
        button("Email statement", [{ type: "callApi", integration: "deliver", input: { ...doc, paperless: "{{st.paperless}}" }, saveAs: "st.res", onError: toFail }, go("done")], "primary", "!ctx.prep.needsCode && st.delivery == 'email'"),
        button("Continue", [
          { type: "validate" }, ...wipe,
          { type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: toFail },
          go("code"),
        ], "primary", "ctx.prep.needsCode"),
        button("Back", [go("where")], "ghost"),
      ],
    },
    {
      id: "code", title: "Confirm {{ctx.prep.kindLower}}",
      blocks: [
        text("Confirm {{ctx.prep.kindLower}}", "title"),
        {
          type: "otp", bind: "otp.code", length: 6, maxAttempts: 3, resendAfterSeconds: 30, keypad: true,
          hint: "We sent a 6-digit code to {{ctx.otp.maskedPhone}}.",
          onResend: [{ type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: toFail }],
        },
        button("Issue {{ctx.prep.kindLower}}", [
          { type: "validate" },
          { type: "callApi", integration: "otpVerify", input: { code: "{{otp.code}}" }, onError: { showToast: "That code isn’t right.", stay: true, lockAfter: 3, lockTo: "locked" } },
          { type: "callApi", integration: "issue", input: doc, saveAs: "st.res", onError: toFail },
          ...wipe, go("done"),
        ]),
        button("Back", [go("format")], "ghost"),
      ],
    },
    {
      id: "done", title: "{{st.delivery == 'email' ? 'On its way' : 'Statement ready'}}", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "On its way", text: "We emailed it. It can take a few minutes.", visibleWhen: "st.delivery == 'email'" },
        { type: "result", tone: "success", title: "Statement ready", text: "Your {{st.res.format | upper}} is ready.", visibleWhen: "st.delivery != 'email'", meta: "{{st.res.reference}}" },
        {
          type: "reviewSummary",
          rows: [
            { label: "Account", value: "{{st.res.name}} {{st.res.maskedNumber}}" },
            { label: "Type", value: "{{st.res.kindLabel}}" },
            { label: "Period", value: "{{st.res.periodText}}" },
          ],
        },
        { type: "reviewSummary", visibleWhen: "st.res.kind == 'statement' || st.res.kind == 'official'", rows: [{ label: "Opening balance", value: "{{st.res.openingText}}" }, { label: "Closing balance", value: "{{st.res.closingText}}" }] },
        { type: "reviewSummary", visibleWhen: "st.res.kind == 'certificate'", rows: [{ label: "Balance", value: "{{st.res.balanceText}}" }] },
        { type: "reviewSummary", rows: [{ label: "File", value: "{{st.res.file}} · {{st.res.sizeKb}} KB" }, { label: "Delivery", value: "{{st.res.delivery == 'email' ? 'Emailed to ' + st.res.emailMasked : 'Download'}}" }] },
        { type: "reviewSummary", visibleWhen: "st.res.fee > 0", rows: [{ label: "Fee", value: "{{st.res.feeText}}" }] },
        { type: "button", label: "Download", variant: "primary", visibleWhen: "st.delivery != 'email'", actions: [{ type: "share", template: "receipt", title: "{{st.res.kindLabel}}" }] },
        button("Back to account", [{ type: "navigate", toJourney: "account-details", with: { "launch.accountId": "{{st.account}}" } }], "secondary"),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "locked", title: "Too many wrong codes", kind: "terminal", onEnter: wipe,
      blocks: [
        { type: "result", tone: "error", title: "Too many wrong codes", text: "You entered the wrong code 3 times, so we stopped. Nothing was issued and no fee was taken." },
        button("Start again", [go("start")]),
        button("Close", [{ type: "exit" }], "secondary"),
      ],
    },
    {
      // after a refusal: what went wrong decides where to go (the form says it; the others have a screen)
      id: "fail", title: "Statements", kind: "branch",
      onEnter: [set("st.err", "{{ctx.error.message}}"), ...wipe, go("where")],
      navigation: route(
        ["ctx.error.code == 'TIMEOUT'", "timeout"],
        ["ctx.error.code == 'SERVICE_UNAVAILABLE'", "unavailable"],
        ["ctx.error.code == 'ACCOUNT_NOT_FOUND'", "notFound"],
        ["ctx.error.code == 'OTP_REQUIRED' || ctx.error.code == 'OTP_INVALID' || ctx.error.code == 'NOT_OFFICIAL' || ctx.error.code == 'PERMISSION_DENIED'", "failed"],
      ),
      blocks: [],
    },
    {
      id: "timeout", title: "No answer in time", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We didn’t get an answer in time", text: "We didn’t get an answer in time. Nothing was changed and no fee was taken." },
        button("Try again", [go("start")]),
        button("Close", [{ type: "exit" }], "secondary"),
      ],
    },
    {
      id: "unavailable", title: "Service not available", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "Service not available", text: "This service is not available right now. Nothing was changed and no fee was taken. Please try again in a few minutes." },
        button("Try again", [go("start")]),
        button("Close", [{ type: "exit" }], "secondary"),
      ],
    },
    {
      id: "failed", title: "Not issued", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We couldn’t issue it", text: "Nothing was issued and no fee was taken. Start again." },
        button("Start again", [go("start")]),
        button("Close", [{ type: "exit" }], "secondary"),
      ],
    },
    {
      id: "notFound", title: "Account not found", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "Account not found", text: "We can’t find that account. Choose another." },
        button("Back to accounts", [{ type: "navigate", toJourney: "accounts" }]),
      ],
    },
    denied("Statements"),
  ] as Screen[],
};
