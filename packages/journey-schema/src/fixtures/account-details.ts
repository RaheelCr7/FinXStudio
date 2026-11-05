import type { Block, Journey, Screen } from "../schema";
import { accountDetailsAcceptance, accountDetailsScenarios } from "./account-details-tests";
import { alert, button, denied, go, holds, lacks, route, row, set, SLOW, SORRY, text } from "./accounts-kit";

const HIDE = "ad.hide";
/** An amount, masked when the person pressed Hide in the list. */
const amt = (v: string) => `{{${HIDE} ? '••••••' : ${v}}}`;
const MANAGE = holds("accounts.manage");
const REASONS = ["I do not need it", "I am moving to another bank", "Fees are too high", "Something else"];
const choices = (list: string[]) => list.map((l) => ({ id: l, label: l }));
const err = (code: string) => `ad.err == '${code}'`;
/** The code is held only while it is being sent. */
const wipe = [set("otp.code", "")];

/**
 * Account details (BankWorkx, Personal: Accounts). Everything about one account: the available and ledger balances and what is on hold, the numbers of the
 * bank's home market, the product, a short More list (Rename, Statement, Hide or Show, Close) and the transactions with a search, All / In / Out and
 * Show more. A row opens the transaction, which can be reported when it was a payment out. Closing an account asks for a reason, where the balance goes,
 * a tick and a one-time code. Nothing moves money here.
 *
 * Built from the spec of the prototype with the blocks FinX has: the search is applied with a Search button (the engine has no live redraw), the rows are not
 * grouped under day headings (each row says Pending, Today, Yesterday or its date), and Copy and the clipboard are not there (Share opens the share sheet
 * or prints, like a receipt). The one-time code asks the place of the PIN. Also opens at Rename (launch.view = rename), so account-nickname is its alias.
 */
export const accountDetails: Journey = {
  id: "jrn_bankworkx_account_details",
  slug: "account-details",
  name: "Account details",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: accountDetailsAcceptance,
  scenarios: accountDetailsScenarios,
  dataModel: {
    "launch.accountId": { type: "string" },
    "launch.hide": { type: "boolean" },
    "launch.view": { type: "string" },
    "opt.shareDetails": { type: "boolean" },
    "opt.closeRequest": { type: "boolean" },
    "opt.reportProblem": { type: "boolean" },
    "opt.hideAccount": { type: "boolean" },
    "opt.statement": { type: "boolean" },
    "ad.q": { type: "string" },
    "ad.dir": { type: "string" },
    "ad.reason": { type: "string", required: true },
    "ad.note": { type: "string" },
    "ad.name": { type: "string", required: true },
    "ad.cReason": { type: "string", required: true },
    "ad.cNote": { type: "string" },
    "ad.cDest": { type: "string", required: true },
    "ad.cConsent": { type: "boolean", required: true },
    "otp.code": { type: "string", required: true, pattern: "^[0-9]{6}$" },
  },
  integrations: [
    { id: "account", adapter: "bank.accounts.get", mode: "sandbox" },
    { id: "transactions", adapter: "bank.accounts.transactions", mode: "sandbox" },
    { id: "rename", adapter: "bank.accounts.rename", mode: "sandbox" },
    { id: "setHidden", adapter: "bank.accounts.setHidden", mode: "sandbox" },
    { id: "report", adapter: "bank.accounts.reportProblem", mode: "sandbox" },
    { id: "restore", adapter: "bank.accounts.restore", mode: "sandbox" },
    { id: "otpSend", adapter: "bank.otp.send", mode: "sandbox" },
    { id: "otpVerify", adapter: "bank.otp.verify", mode: "sandbox" },
    { id: "requestClosure", adapter: "bank.accounts.requestClosure", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Account", kind: "branch",
      onEnter: [
        set("ad.id", "{{launch.accountId}}"), set("ad.hide", "{{launch.hide == true}}"), set("ad.next", "{{launch.view == 'rename' ? 'nick' : ''}}"),
        set("ad.q", ""), set("ad.dir", "all"), set("ad.limit", 10), set("ad.err", ""), set("ad.errMsg", ""), set("ad.flow", ""), set("ad.notice", ""), set("ctx.error", null), ...wipe,
        go("load"),
      ],
      navigation: route([lacks("accounts.view"), "denied"]),
      blocks: [],
    },
    {
      // reads the account and the first page of its transactions again, then shows the account (or Rename, when it was opened there)
      id: "load", title: "Account", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "account", input: { accountId: "{{ad.id}}" }, saveAs: "ctx.ad", onError: { navigate: "fail" } },
        set("ad.id", "{{ctx.ad.id}}"),
        { type: "callApi", integration: "transactions", input: { accountId: "{{ad.id}}", q: "{{ad.q}}", direction: "{{ad.dir}}", limit: "{{ad.limit}}" }, saveAs: "ctx.tx", onError: { navigate: "fail" } },
        set("ad.name", "{{ad.next == 'nick' ? ctx.ad.nickname : ad.name}}"), set("ad.flow", ""), ...wipe,
        go("main"),
      ],
      navigation: route(["ad.next == 'nick'", "nick"]),
      blocks: [],
    },
    {
      id: "main", title: "{{ctx.ad.name}}",
      blocks: [
        text("{{ctx.ad.name}} {{ctx.ad.maskedNumber}}", "caption"),
        text("{{ctx.ad.chip}}{{ctx.ad.hiddenChip ? (ctx.ad.chip ? ' · ' : '') + ctx.ad.hiddenChip : ''}}", "caption", "ctx.ad.chip || ctx.ad.hiddenChip"),
        alert("success", "{{ad.notice}}", "ad.notice"),
        text(amt("ctx.ad.availableText"), "title"),
        text("Available balance", "caption"),
        { type: "reviewSummary", visibleWhen: "ctx.ad.onHold", rows: [{ label: "Balance", value: amt("ctx.ad.ledgerText") }, { label: "On hold", value: amt("ctx.ad.heldText") }] },
        text("Available is your ledger balance minus money held for card payments that haven’t settled yet.", "caption", "ctx.ad.onHold"),
        text("Nothing is on hold.", "caption", "!ctx.ad.onHold"),
        // an account that needs something
        alert("warning", "Dormant account. Make a deposit or a transfer to use it again.", "ctx.ad.warning == 'dormant'"),
        row("reactivate", "Reactivate", "Use this account again", [set("ad.flow", "restore"), { type: "callApi", integration: "restore", input: { accountId: "{{ad.id}}" }, onError: { navigate: "fail" } }, set("ad.notice", "Account reactivated"), go("load")], `ctx.ad.warning == 'dormant' && ${MANAGE}`),
        alert("warning", "Closure requested. Reference {{ctx.ad.closureReference}}. We will close this account within 14 days.", "ctx.ad.warning == 'closing'"),
        row("cancelClosure", "Cancel the request", "Keep this account open", [set("ad.flow", "restore"), { type: "callApi", integration: "restore", input: { accountId: "{{ad.id}}" }, onError: { navigate: "fail" } }, set("ad.notice", "Request cancelled"), go("load")], `ctx.ad.warning == 'closing' && ${MANAGE}`),
        { type: "sectionHeader", title: "Account numbers" },
        { type: "reviewSummary", rows: [{ label: "{{ctx.ad.rows[0].label}}", value: "{{ctx.ad.rows[0].value}}" }, { label: "{{ctx.ad.rows[1].label}}", value: "{{ctx.ad.rows[1].value}}" }] },
        row("share", "Share details", "Send or print the numbers of this account", [{
          type: "share", template: "receipt", title: "Account details",
          rows: [{ label: "Account", value: "{{ctx.ad.name}} {{ctx.ad.maskedNumber}} ({{ctx.ad.currency}})" }, { label: "{{ctx.ad.rows[0].label}}", value: "{{ctx.ad.rows[0].value}}" }, { label: "{{ctx.ad.rows[1].label}}", value: "{{ctx.ad.rows[1].value}}" }],
        }], "opt.shareDetails != false"),
        { type: "sectionHeader", title: "Account info" },
        { type: "reviewSummary", rows: [{ label: "Type", value: "{{ctx.ad.productName}}" }, { label: "Opened", value: "{{ctx.ad.openedOn}}" }, { label: "Interest rate", value: "{{ctx.ad.interestRate}}" }] },
        { type: "sectionHeader", title: "More" },
        row("rename", "Rename", "Give this account a name of your own", [set("ad.err", ""), set("ad.name", "{{ctx.ad.nickname}}"), go("nick")], MANAGE),
        row("statement", "Statement", "Download or email a statement", [{ type: "navigate", toJourney: "statement", with: { "launch.accountId": "{{ad.id}}" } }], "opt.statement != false"),
        row("hide", "Hide account", "Leave it out of your overview and total", [set("ad.err", ""), go("hide")], `opt.hideAccount != false && !ctx.ad.hidden && ${MANAGE}`),
        row("show", "Show account", "Bring it back to your overview and total", [set("ad.flow", "hide"), { type: "callApi", integration: "setHidden", input: { accountId: "{{ad.id}}", hidden: false }, onError: { navigate: "fail" } }, set("ad.notice", "Account shown again"), go("load")], `opt.hideAccount != false && ctx.ad.hidden && ${MANAGE}`),
        row("close", "Close account", "Ask the bank to close it", [set("ad.err", ""), set("ad.cReason", ""), set("ad.cNote", ""), set("ad.cDest", ""), set("ad.cConsent", false), go("closeStart")], `opt.closeRequest != false && ctx.ad.warning != 'closing' && ${MANAGE}`),
        // the transactions: a search, All / In / Out, and ten at a time
        { type: "sectionHeader", title: "Transactions" },
        { type: "textInput", bind: "ad.q", label: "Search transactions", placeholder: "Search" },
        { type: "select", bind: "ad.dir", label: "Show", choices: [{ id: "all", label: "All" }, { id: "in", label: "In" }, { id: "out", label: "Out" }] },
        row("search", "Search", "Apply the search and the filter", [set("ad.limit", 10), set("ad.notice", ""), go("load")]),
        text("No activity yet", "title", "ctx.tx.empty"),
        text("Money you send, spend and receive will show here.", "body", "ctx.tx.empty"),
        text("No transactions found", "title", "ctx.tx.filtered"),
        text("Try another search.", "body", "ctx.tx.filtered"),
        row("clear", "Clear", "Remove the search and show everything", [set("ad.q", ""), set("ad.dir", "all"), set("ad.limit", 10), go("load")], "ctx.tx.filtered"),
        {
          type: "menu", source: "ctx.tx.items", visibleWhen: "ctx.tx.shown > 0",
          item: {
            label: "{{item.title}}",
            text: `{{item.pending ? 'Pending · ' : ''}}{{${HIDE} ? '••••••' : item.amountText}} · {{item.category}}{{item.pending ? '' : ' · ' + item.when}}`,
            icon: "wallet",
            actions: [
              set("ad.txId", "{{item.id}}"), set("ad.txTitle", "{{item.title}}"), set("ad.txAmount", "{{item.amountText}}"), set("ad.txStatus", "{{item.status}}"), set("ad.txDate", "{{item.date}}"),
              set("ad.txParty", "{{item.party}}"), set("ad.txWho", "{{item.counterparty}}"), set("ad.txRef", "{{item.reference}}"), set("ad.txKind", "{{item.kind}}"),
              set("ad.txOut", "{{item.reportable}}"), set("ad.txCase", "{{item.reported}}"), set("ad.err", ""), { type: "navigate", to: "tx" },
            ],
          },
        },
        text("{{ctx.tx.shown}} of {{ctx.tx.total}}", "caption", "ctx.tx.shown > 0"),
        row("more", "Show more", "Ten more transactions", [set("ad.limit", "{{ad.limit + 10}}"), go("load")], "ctx.tx.more"),
        button("‹ Accounts", [{ type: "navigate", toJourney: "accounts" }], "ghost"),
      ],
    },
    {
      id: "tx", title: "Transaction",
      blocks: [
        text("Transaction", "title"),
        text("{{ad.txTitle}}", "body"),
        text(amt("ad.txAmount"), "body"),
        text("{{ad.txStatus}}", "caption"),
        { type: "reviewSummary", rows: [{ label: "Date", value: "{{ad.txDate}}" }, { label: "Status", value: "{{ad.txStatus}}" }] },
        { type: "reviewSummary", visibleWhen: "ad.txWho", rows: [{ label: "{{ad.txParty}}", value: "{{ad.txWho}}" }] },
        { type: "reviewSummary", rows: [{ label: "Reference", value: "{{ad.txRef}}" }] },
        text("Problem reported. Case {{ad.txCase}}.", "body", "ad.txCase"),
        button("Report a problem", [set("ad.err", ""), set("ad.reason", ""), set("ad.note", ""), go("report")], "secondary", "opt.reportProblem != false && ad.txOut == 'true' && !ad.txCase"),
        button("Back", [go("main")], "ghost"),
      ],
    },
    {
      id: "report", title: "Report a problem",
      blocks: [
        text("Report a problem", "title"),
        text("{{ad.txTitle}} · {{ad.txAmount}}", "caption"),
        alert("error", "This payment is still pending. Try again when it completes.", err("PENDING_NOT_DISPUTABLE")),
        alert("error", "Add a few more words.", err("NOTE_TOO_SHORT")),
        alert("error", "Choose what went wrong.", err("REASON_INVALID")),
        alert("info", "{{ad.errMsg}}", err("DUPLICATE_REPORT")),
        alert("error", "You can only report a payment you made.", err("NOT_REPORTABLE")),
        alert("error", "Transaction not found. Choose another from the list.", err("TRANSACTION_NOT_FOUND")),
        alert("error", "We could not reach the bank. Nothing was sent.", err("SERVICE_UNAVAILABLE")),
        alert("error", SLOW, err("TIMEOUT")),
        { type: "select", bind: "ad.reason", label: "What went wrong?", choices: choices(["I do not recognise it", "I was charged twice", "The amount is wrong", "Something else"]), visibleWhen: "ad.txKind == 'card'" },
        { type: "select", bind: "ad.reason", label: "What went wrong?", choices: choices(["I sent it to the wrong person", "I did not make this transfer", "Something else"]), visibleWhen: "ad.txKind != 'card'" },
        { type: "textInput", bind: "ad.note", label: "Details", placeholder: "Tell us a little more", lines: 3, visibleWhen: "ad.reason == 'Something else'" },
        button("Send", [
          { type: "validate" }, set("ad.flow", "report"),
          { type: "callApi", integration: "report", input: { accountId: "{{ad.id}}", transactionId: "{{ad.txId}}", reason: "{{ad.reason}}", note: "{{ad.note}}" }, saveAs: "ad.reported", onError: { navigate: "fail" } },
          go("reported"),
        ], "primary", "ad.err != 'DUPLICATE_REPORT' && ad.err != 'NOT_REPORTABLE' && ad.err != 'TRANSACTION_NOT_FOUND'"),
        button("Back", [go("tx")], "ghost"),
      ],
    },
    {
      id: "reported", title: "Report sent",
      blocks: [
        { type: "result", tone: "success", title: "Report sent", text: "We will reply within 2 working days." },
        { type: "reviewSummary", rows: [{ label: "Case", value: "{{ad.reported.caseRef}}" }, { label: "Payment", value: "{{ad.reported.title}} · {{ad.reported.amountText}}" }] },
        button("Done", [set("ad.txCase", "{{ad.reported.caseRef}}"), go("load")]),
      ],
    },
    {
      id: "nick", title: "Rename account",
      onEnter: [set("ad.next", "")],
      blocks: [
        text("Rename account", "title"),
        text("{{ctx.ad.productName}} {{ctx.ad.maskedNumber}}", "caption"),
        alert("error", "Use 2 to 24 characters.", err("INVALID_NICKNAME")),
        alert("error", "Use letters, numbers and spaces.", err("NAME_CHARS")),
        alert("error", "You already have an account with this name.", err("NAME_TAKEN")),
        { type: "textInput", bind: "ad.name", label: "Account name", placeholder: "Holiday fund" },
        button("Save", [
          { type: "validate" }, set("ad.flow", "nick"),
          { type: "callApi", integration: "rename", input: { accountId: "{{ad.id}}", nickname: "{{ad.name}}" }, onError: { navigate: "fail" } },
          set("ad.notice", "Name saved"), go("load"),
        ]),
        button("Use the original name", [
          set("ad.flow", "nick"), { type: "callApi", integration: "rename", input: { accountId: "{{ad.id}}", reset: true }, onError: { navigate: "fail" } },
          set("ad.name", ""), set("ad.notice", "Name reset"), go("load"),
        ], "secondary", "ctx.ad.nickname"),
        button("Back", [go("load")], "ghost"),
      ],
    },
    {
      id: "hide", title: "Hide this account?",
      blocks: [
        text("Hide this account?", "title"),
        text("It stays open and leaves your overview and total. You can show it again from the list.", "body"),
        alert("error", "Keep at least one account on your overview.", err("LAST_VISIBLE_ACCOUNT")),
        button("Hide account", [
          set("ad.flow", "hide"), { type: "callApi", integration: "setHidden", input: { accountId: "{{ad.id}}", hidden: true }, onError: { navigate: "fail" } },
          { type: "navigate", toJourney: "accounts" },
        ]),
        button("Back", [go("load")], "ghost"),
      ],
    },
    {
      // the check comes first: card payments on hold, or an overdrawn account, stop the request before a form is shown
      id: "closeStart", title: "Close account", kind: "branch", onEnter: [go("close")],
      navigation: route(["ctx.ad.onHold || ctx.ad.overdrawn", "closeBlocked"]),
      blocks: [],
    },
    {
      id: "closeBlocked", title: "Close account",
      blocks: [
        text("Close account", "title"),
        alert("warning", "Card payments are still on hold. Try again when they complete.", "ad.err == 'ACCOUNT_HAS_HOLDS' || (ad.err != 'ACCOUNT_OVERDRAWN' && ctx.ad.onHold)"),
        alert("warning", "This account is overdrawn. Pay in the shortfall first.", "ad.err == 'ACCOUNT_OVERDRAWN' || (ad.err != 'ACCOUNT_HAS_HOLDS' && !ctx.ad.onHold)"),
        button("Back", [go("load")]),
      ],
    },
    {
      id: "close", title: "Close account",
      blocks: [
        text("Close account", "title"),
        text("{{ctx.ad.name}} {{ctx.ad.maskedNumber}}", "caption"),
        alert("error", "Add a few more words.", err("NOTE_TOO_SHORT")),
        alert("error", "Choose where to send the balance.", err("DESTINATION_INVALID")),
        alert("error", "A closure has already been requested.", err("CLOSURE_PENDING")),
        { type: "select", bind: "ad.cReason", label: "Reason", choices: choices(REASONS) },
        { type: "textInput", bind: "ad.cNote", label: "Details", placeholder: "At least 10 characters", lines: 3, visibleWhen: "ad.cReason == 'Something else'" },
        { type: "select", bind: "ad.cDest", label: "Send {{ctx.ad.ledgerText}} to", source: "ctx.ad.destinations", variant: "dropdown", visibleWhen: "ctx.ad.balance > 0" },
        {
          type: "consent", bind: "ad.cConsent", termsVersion: "account-closure-v1", text: "I understand that payments and cards linked to this account will stop.",
          validation: { mustBeTrue: true, messages: { mustBeTrue: "Tick the confirmation first." } },
        },
        button("Request closure", [
          { type: "validate" }, set("ad.err", ""), set("ad.flow", "close"),
          { type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: { navigate: "fail" } },
          ...wipe, go("closeCode"),
        ]),
        button("Keep account", [go("load")], "ghost"),
      ],
    },
    {
      id: "closeCode", title: "Confirm closure",
      blocks: [
        text("Confirm closure", "title"),
        text("Enter your code to close {{ctx.ad.name}} {{ctx.ad.maskedNumber}}.", "caption"),
        {
          type: "otp", bind: "otp.code", length: 6, maxAttempts: 3, resendAfterSeconds: 30, keypad: true,
          hint: "We sent a 6-digit code to {{ctx.otp.maskedPhone}}.",
          onResend: [{ type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: { navigate: "fail" } }],
        },
        button("Close account", [
          { type: "validate" },
          { type: "callApi", integration: "otpVerify", input: { code: "{{otp.code}}" }, onError: { showToast: "That code isn’t right.", stay: true, lockAfter: 3, lockTo: "locked" } },
          { type: "callApi", integration: "requestClosure", input: { accountId: "{{ad.id}}", reason: "{{ad.cReason}}", note: "{{ad.cNote}}", destination: "{{ad.cDest}}" }, saveAs: "ad.closed", onError: { navigate: "fail" } },
          ...wipe, go("closed"),
        ]),
        button("Back", [go("close")], "ghost"),
      ],
    },
    {
      id: "closed", title: "Closure requested",
      blocks: [
        { type: "result", tone: "success", title: "Closure requested", text: "We will close the account within 14 days." },
        { type: "reviewSummary", rows: [{ label: "Account", value: "{{ad.closed.name}} {{ad.closed.maskedNumber}}" }, { label: "Reference", value: "{{ad.closed.reference}}" }] },
        { type: "reviewSummary", visibleWhen: "ad.closed.destination", rows: [{ label: "Send balance to", value: "{{ad.closed.destination}}" }] },
        button("Done", [go("load")]),
      ],
    },
    {
      id: "locked", title: "Too many wrong codes", kind: "terminal", onEnter: wipe,
      blocks: [
        { type: "result", tone: "error", title: "Too many wrong codes", text: "You entered the wrong code 3 times, so we stopped. Nothing was changed." },
        button("Start again", [go("start")]),
        button("Close", [{ type: "exit" }], "secondary"),
      ],
    },
    {
      // where a failed bank call goes: the account is gone, the bank did not answer, or the form the person was on says what was wrong
      id: "fail", title: "Account", kind: "branch",
      onEnter: [set("ad.err", "{{ctx.error.code}}"), set("ad.errMsg", "{{ctx.error.message}}"), ...wipe, go("problem")],
      navigation: route(
        ["ctx.error.code == 'ACCOUNT_NOT_FOUND'", "notFound"],
        ["ctx.error.code == 'ACCOUNT_HAS_HOLDS' || ctx.error.code == 'ACCOUNT_OVERDRAWN'", "closeBlocked"],
        ["ad.flow == 'report'", "report"],
        ["ad.flow == 'nick' && ctx.error.code != 'TIMEOUT' && ctx.error.code != 'SERVICE_UNAVAILABLE'", "nick"],
        ["ad.flow == 'hide' && ctx.error.code == 'LAST_VISIBLE_ACCOUNT'", "hide"],
        ["ad.flow == 'close' && ctx.error.code != 'TIMEOUT' && ctx.error.code != 'SERVICE_UNAVAILABLE' && ctx.error.code != 'OTP_REQUIRED' && ctx.error.code != 'OTP_INVALID'", "close"],
      ),
      blocks: [],
    },
    {
      id: "problem", title: "Account",
      blocks: [
        alert("error", SORRY, "ctx.error.code == 'SERVICE_UNAVAILABLE'"),
        alert("error", SLOW, "ctx.error.code == 'TIMEOUT'"),
        alert("error", "We couldn’t confirm it. Nothing was changed.", "ctx.error.code == 'OTP_REQUIRED' || ctx.error.code == 'OTP_INVALID'"),
        alert("error", "Something went wrong. Nothing was changed.", "ctx.error.code != 'SERVICE_UNAVAILABLE' && ctx.error.code != 'TIMEOUT' && ctx.error.code != 'OTP_REQUIRED' && ctx.error.code != 'OTP_INVALID'"),
        button("Try again", [go("load")]),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "notFound", title: "Account not found",
      blocks: [
        text("Account not found", "title"),
        text("Choose another.", "body"),
        text("We can’t find that account. Choose another.", "caption"),
        button("Back to accounts", [{ type: "navigate", toJourney: "accounts" }]),
      ],
    },
    denied("Account"),
  ] as Screen[],
};
