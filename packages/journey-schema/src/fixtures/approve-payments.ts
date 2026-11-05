import type { Journey } from "../schema";
import { approvePaymentsAcceptance, approvePaymentsScenarios } from "./approve-payments-tests";

const toRoute = { navigate: "route" };
const lockOnWrongCode = { showToast: "The code didn’t work.", stay: true, lockAfter: 3, lockTo: "locked" };

/** "$8,200.00" and "$8,200.00 to Nimbus Logistics", for the payment on screen (ctx.p) or the one just answered (ctx.done). */
const AMT = "{{ctx.p.amount | money2:ctx.p.currency}}";
const TO = `${AMT} to {{ctx.p.payee}}`;
const DONE_TO = "{{ctx.done.amount | money2:ctx.done.currency}} to {{ctx.done.payee}}";
const OPEN = [{ type: "navigate" as const, to: "open" }];
/** Where a row of a table goes: the payment, read again from the bank so its state is today's. */
const ROW = [{ type: "setData" as const, path: "ap.id", value: "{{item.id}}" }, ...OPEN];

const STATUSES = {
  ready: { label: "Ready for you", tone: "positive" as const }, waiting: { label: "Waiting for others", tone: "warning" as const },
  released: { label: "Sent to the bank", tone: "positive" as const }, rejected: { label: "Rejected", tone: "negative" as const },
};
const MONEY = { key: "amount", label: "Amount", type: "money" as const, currencyKey: "currency" };
const PAYMENT_COLUMNS = [
  { key: "id", label: "Payment" }, { key: "payee", label: "Payee" }, { key: "startedBy", label: "Started by" }, MONEY,
];

/** Why an approval or a rejection was refused, with the words of the spec, where a person can still do something about it. */
const REFUSALS = ["SELF_APPROVAL", "ALREADY_APPROVED", "OUT_OF_SEQUENCE", "APPROVAL_EXPIRED", "DELEGATED", "PAYMENT_NOT_PENDING", "NAME_CHECK_NOT_CONFIRMED", "NOT_FOR_BATCH", "EMPTY_BATCH", "INSUFFICIENT_FUNDS", "LIMIT_COMPANY_EXCEEDED", "NOT_AUTHORISED"];
const is = (...codes: string[]) => codes.map((c) => `ctx.error.code == '${c}'`).join(" || ");

/**
 * Approve payments (BankWorkx Business, Approvals). The inbox of an Approver: the payments colleagues started, with what the person can do with each, and
 * the history. A payment opens to its details, the approvals it needs and where each stands, and whether the bank's record of the payee's name matches;
 * the person approves it (a tick that the payee was checked, and a code from the company's threshold), rejects it with a reason, or passes it to another
 * approver (when the bank allows). Several that can be approved together are approved with one code. The last approval releases the payment.
 *
 * Built from the spec of the prototype with the blocks FinX has (see docs/BANKWORKX.md): it is stepped screens (inbox, details, confirm) rather than one
 * list beside a detail; the status buttons are the table's own filter on its status column; every approval has the tick the money rules ask for (the
 * spec asks for it only when the name does not match); the "stepUp" option and "Reject several" are not built, and the bank, not an option, decides
 * when a code is asked.
 */
export const approvePayments: Journey = {
  id: "jrn_approve_payments",
  slug: "approve-payments",
  name: "Approve payments",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: approvePaymentsAcceptance,
  scenarios: approvePaymentsScenarios,
  // a person whose role in this company does not include approving is sent to the no-access card (the screen only hides what the bank refuses again)
  authorisation: { role: "approver", rolesFrom: "ctx.company.me.roles", deniedScreen: "denied" },
  dataModel: {
    "launch.paymentId": { type: "string" },
    "launch.paymentIds": { type: "array" },
    "opt.batch": { type: "boolean" },
    "opt.delegation": { type: "boolean" },
    "ap.id": { type: "string" },
    "ap.picked": { type: "array" },
    "ap.ack": { type: "boolean", required: true },
    "ap.reason": { type: "string" },
    "ap.note": { type: "string", required: true },
    "ap.noReason": { type: "boolean" },
    "ap.to": { type: "string", required: true },
    "otp.code": { type: "string", pattern: "^[0-9]{6}$" },
  },
  integrations: [
    { id: "company", adapter: "corp.company.get", mode: "sandbox" },
    { id: "inbox", adapter: "corp.payments.list", mode: "sandbox" },
    { id: "ready", adapter: "corp.payments.list", mode: "sandbox" },
    { id: "history", adapter: "corp.payments.list", mode: "sandbox" },
    { id: "mine", adapter: "corp.payments.pending", mode: "sandbox" },
    { id: "get", adapter: "corp.payments.get", mode: "sandbox" },
    { id: "otpSend", adapter: "bank.otp.send", mode: "sandbox" },
    { id: "otpSendMany", adapter: "bank.otp.send", mode: "sandbox" },
    { id: "otpVerify", adapter: "bank.otp.verify", mode: "sandbox" },
    { id: "approve", adapter: "corp.payments.approve", mode: "sandbox" },
    { id: "approveMany", adapter: "corp.payments.approveMany", mode: "sandbox" },
    { id: "reject", adapter: "corp.payments.reject", mode: "sandbox" },
    { id: "delegate", adapter: "corp.payments.delegate", mode: "sandbox" },
  ],
  screens: [
    {
      // reads the company (who the person is there) and clears the screen's choices. Opened with a payment (launch.paymentId) it opens that one; with several
      // (launch.paymentIds) they are ticked in Approve several.
      id: "start", title: "Approvals", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "company", saveAs: "ctx.company", onError: toRoute },
        { type: "setData", path: "ctx.error", value: null },
        { type: "setData", path: "ap.id", value: "{{isEmpty(launch.paymentId) ? '' : launch.paymentId}}" },
        { type: "setData", path: "ap.picked", value: "{{launch.paymentIds}}" },
        // used once: Back to approvals does not open the same payment again
        { type: "setData", path: "launch.paymentId", value: "" },
        { type: "setData", path: "launch.paymentIds", value: "" },
        { type: "setData", path: "ap.ack", value: false },
        { type: "setData", path: "ap.reason", value: "" },
        { type: "setData", path: "ap.note", value: "" },
        { type: "setData", path: "ap.noReason", value: false },
        { type: "setData", path: "ap.to", value: "" },
        { type: "setData", path: "otp.code", value: "" },
        { type: "navigate", to: "inbox" },
      ],
      navigation: {
        rules: [
          { when: "!isEmpty(session.permissions) && !has(session.permissions, 'biz.approvals.approve')", to: "denied" },
          { when: "!isEmpty(ap.id)", to: "open" },
          { when: "len(ap.picked) > 0", to: "many" },
        ],
      },
      blocks: [],
    },
    {
      id: "inbox", title: "Approvals",
      onEnter: [
        { type: "callApi", integration: "inbox", input: { status: "pending" }, saveAs: "ctx.inbox", onError: toRoute },
        { type: "callApi", integration: "ready", input: { status: "ready" }, saveAs: "ctx.ready", onError: toRoute },
        { type: "setData", path: "ctx.error", value: null },
      ],
      blocks: [
        { type: "text", variant: "title", text: "Inbox ({{len(ctx.inbox)}})" },
        { type: "text", variant: "title", text: "All caught up", visibleWhen: "len(ctx.inbox) == 0" },
        { type: "text", variant: "body", text: "No payments are waiting for approval.", visibleWhen: "len(ctx.inbox) == 0" },
        {
          type: "dataTable", source: "ctx.inbox", label: "Payments waiting for approval", visibleWhen: "len(ctx.inbox) > 0", search: true, pageSize: 10,
          columns: [...PAYMENT_COLUMNS, { key: "statusKey", label: "Status", type: "status", filter: true, statuses: STATUSES }, { key: "note", label: "Details" }],
          onRowPress: ROW, empty: "Nothing found. Try another search or status.",
        },
        { type: "button", label: "Approve several", variant: "secondary", visibleWhen: "opt.batch != false && len(ctx.ready) > 1", actions: [{ type: "navigate", to: "many" }] },
        { type: "button", label: "History", variant: "ghost", actions: [{ type: "navigate", to: "history" }] },
        { type: "button", label: "Close", variant: "ghost", actions: [{ type: "exit" }] },
      ],
    },
    {
      id: "history", title: "History",
      onEnter: [{ type: "callApi", integration: "history", input: { status: "history" }, saveAs: "ctx.history", onError: toRoute }, { type: "setData", path: "ctx.error", value: null }],
      blocks: [
        { type: "text", variant: "title", text: "History" },
        { type: "text", variant: "title", text: "No history yet", visibleWhen: "len(ctx.history) == 0" },
        { type: "text", variant: "body", text: "Payments you approve or reject are listed here.", visibleWhen: "len(ctx.history) == 0" },
        {
          type: "dataTable", source: "ctx.history", label: "Payments approved or rejected", visibleWhen: "len(ctx.history) > 0", pageSize: 10,
          columns: [...PAYMENT_COLUMNS, { key: "statusKey", label: "Status", type: "status", filter: true, statuses: STATUSES }],
          onRowPress: ROW,
        },
        { type: "button", label: "Inbox ({{len(ctx.inbox)}})", variant: "ghost", actions: [{ type: "navigate", to: "inbox" }] },
      ],
    },
    {
      // reads the payment again from the bank (its state is today's) and opens it
      id: "open", title: "Approvals", kind: "branch",
      onEnter: [
        { type: "setData", path: "ctx.error", value: null },
        { type: "setData", path: "ap.ack", value: false },
        { type: "callApi", integration: "get", input: { paymentId: "{{ap.id}}" }, saveAs: "ctx.p", onError: toRoute },
        { type: "navigate", to: "detail" },
      ],
      blocks: [],
    },
    {
      id: "detail", title: "Payment",
      blocks: [
        { type: "text", variant: "title", text: TO },
        { type: "text", variant: "caption", text: "The payee gets about {{ctx.p.receive.amount | money2:ctx.p.receive.currency}}", visibleWhen: "!isEmpty(ctx.p.receive) && ctx.p.receive.currency != ctx.p.currency" },
        { type: "statusChip", status: "{{ctx.p.statusKey}}", statuses: STATUSES },
        {
          type: "reviewSummary",
          rows: [
            { label: "Payment", value: "{{ctx.p.id}}" },
            { label: "Account", value: "{{ctx.company.accounts[ctx.p.fromAccountId].name}} {{ctx.company.accounts[ctx.p.fromAccountId].maskedNumber}}" },
            { label: "Reference", value: "{{ctx.p.reference}}" },
            { label: "Started by", value: "{{ctx.p.startedBy}}" },
          ],
        },
        { type: "reviewSummary", visibleWhen: "!isEmpty(ctx.p.purpose)", rows: [{ label: "Purpose", value: "{{ctx.p.purpose}}" }, { label: "Speed", value: "{{ctx.p.rail.name}}" }] },
        { type: "reviewSummary", visibleWhen: "ctx.p.status == 'rejected'", rows: [{ label: "Reason", value: "{{ctx.p.rejectReason}}" }] },
        // the bank's record of the payee, when it does not match the name on the payment
        { type: "statusChip", status: "{{ctx.p.nameResult}}", visibleWhen: "ctx.p.nameResult != 'match'", statuses: { close: { label: "Close match", tone: "warning" }, none: { label: "No match", tone: "negative" } } },
        { type: "text", variant: "body", text: "{{ctx.p.nameSentence}}", visibleWhen: "ctx.p.nameResult != 'match'" },
        { type: "sectionHeader", title: "Approvals", subtitle: "{{ctx.p.progress}}", visibleWhen: "ctx.p.status == 'pending_approval'" },
        {
          // who must approve, in order, and where each one stands
          type: "timeline", source: "ctx.p.signatories", visibleWhen: "ctx.p.status == 'pending_approval'",
          item: { title: "{{item.label}}", text: "{{item.text}}", state: "{{item.state == 'approved' ? 'done' : (item.state == 'next' ? 'current' : (item.state == 'can' ? 'current' : 'upcoming'))}}" },
        },
        {
          type: "statusChip", status: "{{ctx.p.cutoffTone}}", label: "{{ctx.p.cutoffText}}", visibleWhen: "!isEmpty(ctx.p.cutoffText)",
          statuses: { neutral: { tone: "neutral" }, warning: { tone: "warning" }, negative: { tone: "negative" } },
        },
        { type: "text", variant: "caption", text: "You’ll be asked for a code.", visibleWhen: "ctx.p.you.can && ctx.p.codeRequired" },
        { type: "button", label: `Approve ${AMT}`, variant: "primary", visibleWhen: "ctx.p.you.can", actions: [{ type: "setData", path: "ap.ack", value: false }, { type: "setData", path: "ctx.error", value: null }, { type: "navigate", to: "confirm" }] },
        { type: "button", label: "Reject", variant: "secondary", visibleWhen: "ctx.p.you.can", actions: [{ type: "setData", path: "ap.reason", value: "" }, { type: "setData", path: "ap.note", value: "" }, { type: "setData", path: "ap.noReason", value: false }, { type: "setData", path: "ctx.error", value: null }, { type: "navigate", to: "reject" }] },
        { type: "button", label: "Pass to someone", variant: "secondary", visibleWhen: "ctx.p.you.can && opt.delegation == true", actions: [{ type: "setData", path: "ap.to", value: "" }, { type: "setData", path: "ctx.error", value: null }, { type: "navigate", to: "pass" }] },
        { type: "text", variant: "body", text: "{{ctx.p.you.sentence}}", visibleWhen: "!ctx.p.you.can" },
        { type: "button", label: "Back", variant: "ghost", actions: [{ type: "navigate", to: "inbox" }] },
      ],
    },
    {
      id: "confirm", title: "Approve",
      blocks: [
        { type: "text", variant: "title", text: `Approve ${AMT}` },
        { type: "reviewSummary", rows: [{ label: "Payee", value: "{{ctx.p.payee}}" }, { label: "Amount", value: AMT }, { label: "Reference", value: "{{ctx.p.reference}}" }] },
        { type: "statusChip", status: "{{ctx.p.nameResult}}", visibleWhen: "ctx.p.nameResult != 'match'", statuses: { close: { label: "Close match", tone: "warning" }, none: { label: "No match", tone: "negative" } } },
        { type: "text", variant: "body", text: "{{ctx.p.nameSentence}}", visibleWhen: "ctx.p.nameResult != 'match'" },
        { type: "alert", tone: "info", text: "The last approval sends the payment to the bank." },
        { type: "consent", bind: "ap.ack", termsVersion: "approve-payments-v1", text: "I checked the payee details", validation: { mustBeTrue: true, messages: { mustBeTrue: "Confirm that you checked the payee details." } } },
        {
          // under the company's threshold no code is asked
          type: "button", label: `Approve ${AMT}`, variant: "primary", visibleWhen: "!ctx.p.codeRequired",
          actions: [
            { type: "validate" },
            { type: "setData", path: "ctx.error", value: null },
            { type: "callApi", integration: "approve", input: { paymentId: "{{ap.id}}", acknowledged: "{{ap.ack}}" }, saveAs: "ctx.done", onError: toRoute },
            { type: "navigate", to: "approved" },
          ],
        },
        {
          type: "button", label: `Approve ${AMT}`, variant: "primary", visibleWhen: "ctx.p.codeRequired",
          actions: [
            { type: "validate" },
            { type: "setData", path: "ctx.error", value: null },
            { type: "setData", path: "otp.code", value: "" },
            { type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: toRoute },
            { type: "navigate", to: "otp" },
          ],
        },
        { type: "button", label: "Cancel", variant: "ghost", actions: [{ type: "navigate", to: "detail" }] },
      ],
    },
    {
      id: "otp", title: "Enter your code",
      blocks: [
        { type: "text", variant: "title", text: `Approve ${AMT}` },
        { type: "text", variant: "caption", text: "It only works for this payment." },
        {
          type: "otp", bind: "otp.code", length: 6, maxAttempts: 3, resendAfterSeconds: 30, keypad: true,
          hint: "Code sent to {{ctx.otp.maskedPhone}}.",
          onResend: [{ type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: toRoute }],
        },
        {
          type: "button", label: `Approve ${AMT}`, variant: "primary",
          actions: [
            { type: "validate" },
            { type: "callApi", integration: "otpVerify", input: { code: "{{otp.code}}" }, onError: lockOnWrongCode },
            { type: "callApi", integration: "approve", input: { paymentId: "{{ap.id}}", acknowledged: "{{ap.ack}}" }, saveAs: "ctx.done", onError: toRoute },
            { type: "navigate", to: "approved" },
          ],
        },
      ],
    },
    {
      id: "approved", title: "Approved", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Approved", text: DONE_TO, meta: "Ref {{ctx.done.releaseReference}}", visibleWhen: "ctx.done.status == 'released'" },
        { type: "result", tone: "success", title: "Approved, one more needed", text: DONE_TO, meta: "Payment {{ctx.done.id}}", visibleWhen: "ctx.done.status != 'released'" },
        { type: "statusChip", status: "released", label: "Sent to the bank", visibleWhen: "ctx.done.status == 'released'" },
        { type: "statusChip", status: "pending_approval", label: "Waiting for another approver", visibleWhen: "ctx.done.status != 'released'" },
        {
          type: "reviewSummary",
          rows: [
            { label: "Payment", value: "{{ctx.done.id}}" },
            { label: "Total", value: "{{ctx.done.amount | money2:ctx.done.currency}}" },
            { label: "Approvals", value: "{{len(ctx.done.approvals)}} of {{ctx.done.required}}" },
          ],
        },
        { type: "button", label: "Back to approvals", variant: "primary", actions: [{ type: "navigate", to: "inbox" }] },
        { type: "button", label: "Share receipt", variant: "ghost", actions: [{ type: "share", template: "receipt" }] },
      ],
    },
    {
      id: "reject", title: "Reject payment",
      blocks: [
        { type: "text", variant: "title", text: `Reject ${TO}` },
        { type: "alert", tone: "error", text: "Choose a reason.", visibleWhen: "ap.noReason && isEmpty(ap.reason)" },
        { type: "select", bind: "ap.reason", label: "Reason", variant: "chips", options: ["Wrong amount", "Wrong payee", "Unknown supplier", "Duplicate", "Other"] },
        { type: "textInput", bind: "ap.note", label: "Note", lines: 3, visibleWhen: "ap.reason == 'Other'", pattern: "^[\\s\\S]{10,300}$", patternMessage: "Write at least 10 characters (up to 300)." },
        {
          type: "button", label: "Reject payment", variant: "primary", visibleWhen: "!isEmpty(ap.reason)",
          actions: [
            { type: "validate" },
            { type: "setData", path: "ctx.error", value: null },
            { type: "callApi", integration: "reject", input: { paymentId: "{{ap.id}}", reason: "{{ap.reason == 'Other' ? ap.note : ap.reason}}" }, saveAs: "ctx.done", onError: toRoute },
            { type: "navigate", to: "rejected" },
          ],
        },
        { type: "button", label: "Reject payment", variant: "primary", visibleWhen: "isEmpty(ap.reason)", actions: [{ type: "setData", path: "ap.noReason", value: true }] },
        { type: "button", label: "Cancel", variant: "ghost", actions: [{ type: "navigate", to: "detail" }] },
      ],
    },
    {
      id: "rejected", title: "Payment rejected", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Payment rejected", text: `${DONE_TO}. Nothing was sent.`, meta: "Payment {{ctx.done.id}}" },
        { type: "statusChip", status: "rejected" },
        { type: "reviewSummary", rows: [{ label: "Payment", value: "{{ctx.done.id}}" }, { label: "Reason", value: "{{ctx.done.rejectReason}}" }, { label: "Told", value: "{{ctx.done.startedBy}}" }] },
        { type: "button", label: "Back to approvals", variant: "primary", actions: [{ type: "navigate", to: "inbox" }] },
      ],
    },
    {
      id: "pass", title: "Pass to someone",
      blocks: [
        { type: "text", variant: "title", text: `Pass ${TO}` },
        { type: "alert", tone: "error", text: "{{ctx.error.message}}", visibleWhen: is("DELEGATE_CONFLICT", "DELEGATE_ALREADY_APPROVED") },
        { type: "select", bind: "ap.to", label: "Pass to", variant: "rows", source: "ctx.p.delegates" },
        {
          type: "button", label: "Pass on", variant: "primary",
          actions: [
            { type: "validate" },
            { type: "setData", path: "ctx.error", value: null },
            { type: "callApi", integration: "delegate", input: { paymentId: "{{ap.id}}", toUserId: "{{ap.to}}" }, saveAs: "ctx.done", onError: toRoute },
            { type: "navigate", to: "passed" },
          ],
        },
        { type: "button", label: "Cancel", variant: "ghost", actions: [{ type: "navigate", to: "detail" }] },
      ],
    },
    {
      id: "passed", title: "Passed on", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Passed to {{ctx.done.passedToName}}", text: "{{ctx.done.passedToName}} can now approve this payment.", meta: "Payment {{ctx.done.id}}" },
        { type: "statusChip", status: "info", label: "Passed on", statuses: { info: { tone: "info" } } },
        { type: "reviewSummary", rows: [{ label: "Payment", value: "{{ctx.done.id}}" }, { label: "Passed to", value: "{{ctx.done.passedToName}}" }] },
        { type: "button", label: "Back to approvals", variant: "primary", actions: [{ type: "navigate", to: "inbox" }] },
      ],
    },
    {
      // several at once: only what the person can approve now whose name matches is offered
      id: "many", title: "Approve several",
      onEnter: [{ type: "callApi", integration: "ready", input: { status: "ready" }, saveAs: "ctx.ready", onError: toRoute }, { type: "setData", path: "ctx.error", value: null }, { type: "setData", path: "ap.ack", value: false }],
      blocks: [
        { type: "text", variant: "title", text: "Approve several" },
        { type: "text", variant: "caption", text: "These are the payments you can approve now whose payee name matches the bank’s record. A payment with a name to check is approved on its own." },
        {
          type: "dataTable", source: "ctx.ready", label: "Payments ready for you", bind: "ap.picked", total: { key: "amount", currency: "{{ctx.company.currency}}" },
          columns: PAYMENT_COLUMNS, empty: "No payments are ready to approve together.",
        },
        { type: "consent", bind: "ap.ack", termsVersion: "approve-payments-v1", text: "I checked these payments", validation: { mustBeTrue: true, messages: { mustBeTrue: "Confirm that you checked these payments." } } },
        {
          type: "button", label: "Approve {{len(ap.picked)}}", variant: "primary", visibleWhen: "len(ap.picked) > 0",
          actions: [
            { type: "validate" },
            { type: "setData", path: "ctx.error", value: null },
            // the bank asks for the code when one of them is at or above its threshold: then one code covers them all
            { type: "callApi", integration: "approveMany", input: { paymentIds: "{{ap.picked}}" }, saveAs: "ctx.many", onError: toRoute },
            { type: "navigate", to: "manyDone" },
          ],
        },
        { type: "text", variant: "caption", text: "Tick the payments to approve.", visibleWhen: "len(ap.picked) == 0" },
        { type: "button", label: "Back", variant: "ghost", actions: [{ type: "navigate", to: "inbox" }] },
      ],
    },
    {
      id: "askCode", title: "One moment", kind: "branch",
      onEnter: [
        { type: "setData", path: "otp.code", value: "" },
        { type: "callApi", integration: "otpSendMany", input: { channel: "sms" }, saveAs: "ctx.otp", onError: toRoute },
        { type: "navigate", to: "otpMany" },
      ],
      blocks: [],
    },
    {
      id: "otpMany", title: "Enter your code",
      blocks: [
        { type: "text", variant: "title", text: "Approve {{len(ap.picked)}} payments" },
        { type: "text", variant: "caption", text: "One code covers them all. Sent to {{ctx.otp.maskedPhone}}." },
        { type: "otp", bind: "otp.code", length: 6, maxAttempts: 3, resendAfterSeconds: 30, keypad: true, onResend: [{ type: "callApi", integration: "otpSendMany", input: { channel: "sms" }, saveAs: "ctx.otp", onError: toRoute }] },
        {
          type: "button", label: "Approve {{len(ap.picked)}}", variant: "primary",
          actions: [
            { type: "validate" },
            { type: "callApi", integration: "otpVerify", input: { code: "{{otp.code}}" }, onError: lockOnWrongCode },
            { type: "callApi", integration: "approveMany", input: { paymentIds: "{{ap.picked}}" }, saveAs: "ctx.many", onError: toRoute },
            { type: "navigate", to: "manyDone" },
          ],
        },
      ],
    },
    {
      id: "manyDone", title: "Approved", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "{{ctx.many.count}} payment{{ctx.many.count > 1 ? 's' : ''}} approved", text: "{{ctx.many.total | money2:ctx.many.currency}} in total." },
        { type: "statusChip", status: "released", label: "Sent to the bank", visibleWhen: "ctx.many.released == ctx.many.count" },
        { type: "statusChip", status: "pending_approval", label: "Some wait for another approver", visibleWhen: "ctx.many.released != ctx.many.count" },
        { type: "reviewSummary", rows: [{ label: "Payments", value: "{{ctx.many.count}}" }, { label: "Total", value: "{{ctx.many.total | money2:ctx.many.currency}}" }, { label: "Sent to the bank", value: "{{ctx.many.released}} of {{ctx.many.count}}" }] },
        { type: "button", label: "Back to approvals", variant: "primary", actions: [{ type: "navigate", to: "inbox" }] },
        { type: "button", label: "Share receipt", variant: "ghost", actions: [{ type: "share", template: "receipt" }] },
      ],
    },
    {
      // after a failed bank call: where to go depends on what the bank said (ctx.error)
      id: "route", title: "One moment", kind: "branch",
      onEnter: [{ type: "navigate", to: "failed" }],
      blocks: [],
      navigation: {
        rules: [
          { when: `ctx.error.code == 'TIMEOUT' && (${["approve", "approveMany", "reject", "delegate"].map((i) => `ctx.error.integration == '${i}'`).join(" || ")})`, to: "timeout" },
          { when: "ctx.error.code == 'TIMEOUT'", to: "slow" },
          { when: "ctx.error.code == 'SERVICE_UNAVAILABLE'", to: "unavailable" },
          { when: is("PERMISSION_DENIED", "WRONG_CONTEXT"), to: "denied" },
          { when: "ctx.error.code == 'PAYMENT_NOT_FOUND'", to: "gone" },
          { when: "ctx.error.code == 'OTP_REQUIRED' && ctx.error.integration == 'approveMany'", to: "askCode" },
          { when: is("DELEGATE_CONFLICT", "DELEGATE_ALREADY_APPROVED"), to: "pass" },
          { when: is(...REFUSALS), to: "problem" },
        ],
      },
    },
    {
      // Try again after a slow or unavailable service: back to where the person was
      id: "retry", title: "One moment", kind: "branch",
      onEnter: [{ type: "navigate", to: "start" }],
      blocks: [],
      navigation: {
        rules: [
          { when: "ctx.error.integration == 'approve' || ctx.error.integration == 'otpSend'", to: "confirm" },
          { when: "ctx.error.integration == 'approveMany' || ctx.error.integration == 'otpSendMany' || ctx.error.integration == 'ready'", to: "many" },
          { when: "ctx.error.integration == 'reject'", to: "reject" },
          { when: "ctx.error.integration == 'delegate'", to: "pass" },
        ],
      },
    },
    {
      // not a holder of the approve permission: the card, and the person's own payments waiting for approval
      id: "denied", title: "No access", kind: "terminal",
      onEnter: [{ type: "callApi", integration: "mine", input: { as: "initiator" }, saveAs: "ctx.mine", onError: { stay: true } }],
      blocks: [
        { type: "result", tone: "error", title: "You don’t have access to the approvals inbox", text: "Your role at this company doesn’t include it. The bank checks this on its side too, so hiding the button isn’t the only guard.", visibleWhen: "ctx.error.code != 'WRONG_CONTEXT'" },
        { type: "result", tone: "error", title: "Switch to your business first", text: "{{ctx.error.message}}", visibleWhen: "ctx.error.code == 'WRONG_CONTEXT'" },
        { type: "sectionHeader", title: "Your requests waiting for approval", visibleWhen: "len(ctx.mine) > 0" },
        { type: "menu", source: "ctx.mine", item: { label: "{{item.id}} · {{item.progress}}", text: "{{item.payee}}", actions: [{ type: "exit" }] } },
        { type: "button", label: "Close", variant: "primary", actions: [{ type: "exit" }] },
      ],
    },
    {
      id: "gone", title: "Already handled", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "This payment has already been handled.", text: "It is no longer in the list." },
        { type: "button", label: "Go to approvals", variant: "primary", actions: [{ type: "navigate", to: "inbox" }] },
      ],
    },
    {
      // why an approval was refused, in the words of the spec; nothing was approved
      id: "problem", title: "Not approved", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "You started this payment, so another approver must approve it.", text: "Nothing was approved.", visibleWhen: "ctx.error.code == 'SELF_APPROVAL'" },
        { type: "result", tone: "error", title: "You already approved this payment.", text: "Nothing more was approved.", visibleWhen: "ctx.error.code == 'ALREADY_APPROVED'" },
        { type: "result", tone: "error", title: "Another approver goes first.", text: "Nothing was approved.", visibleWhen: "ctx.error.code == 'OUT_OF_SEQUENCE'" },
        { type: "result", tone: "error", title: "The cut-off has passed. This payment can’t be approved today.", text: "Nothing was approved.", visibleWhen: "ctx.error.code == 'APPROVAL_EXPIRED'" },
        { type: "result", tone: "error", title: "This payment was passed to another approver.", text: "Nothing was approved.", visibleWhen: "ctx.error.code == 'DELEGATED'" },
        { type: "result", tone: "error", title: "This payment is no longer waiting for approval.", text: "Nothing was approved.", visibleWhen: "ctx.error.code == 'PAYMENT_NOT_PENDING'" },
        { type: "result", tone: "error", title: "You can’t approve payments at this company.", text: "Nothing was approved.", visibleWhen: "ctx.error.code == 'NOT_AUTHORISED'" },
        {
          type: "result", tone: "error", title: "{{ctx.error.message}}", text: "Nothing was approved.",
          visibleWhen: "ctx.error.code != 'SELF_APPROVAL' && ctx.error.code != 'ALREADY_APPROVED' && ctx.error.code != 'OUT_OF_SEQUENCE' && ctx.error.code != 'APPROVAL_EXPIRED' && ctx.error.code != 'DELEGATED' && ctx.error.code != 'PAYMENT_NOT_PENDING' && ctx.error.code != 'NOT_AUTHORISED'",
        },
        { type: "button", label: "Back to approvals", variant: "primary", actions: [{ type: "navigate", to: "inbox" }] },
        { type: "button", label: "Close", variant: "secondary", actions: [{ type: "exit" }] },
      ],
    },
    {
      id: "locked", title: "Too many wrong codes", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "The code didn’t work.", text: "Nothing was approved." },
        { type: "button", label: "Back to approvals", variant: "primary", actions: [{ type: "navigate", to: "inbox" }] },
        { type: "button", label: "Close", variant: "secondary", actions: [{ type: "exit" }] },
      ],
    },
    {
      // the approval may or may not have been made: say so, and send the person to check
      id: "timeout", title: "No answer in time", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We didn’t get an answer in time", text: "We didn’t get an answer in time. Check Payments before you try again, so you don’t approve twice." },
        { type: "button", label: "Check Payments", variant: "primary", actions: [{ type: "exit" }] },
        { type: "button", label: "Close", variant: "secondary", actions: [{ type: "exit" }] },
      ],
    },
    {
      // a slow answer to a question that changes nothing (the list, the payment): safe to ask again
      id: "slow", title: "No answer in time", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We didn’t get an answer in time", text: "This is taking longer than expected. Nothing was approved." },
        { type: "button", label: "Try again", variant: "primary", actions: [{ type: "navigate", to: "retry" }] },
        { type: "button", label: "Close", variant: "secondary", actions: [{ type: "exit" }] },
      ],
    },
    {
      id: "unavailable", title: "We couldn’t reach the bank", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We couldn’t reach the bank", text: "We couldn’t reach the bank. Nothing was approved. Try again." },
        { type: "button", label: "Try again", variant: "primary", actions: [{ type: "navigate", to: "retry" }] },
        { type: "button", label: "Cancel", variant: "secondary", actions: [{ type: "exit" }] },
      ],
    },
    {
      id: "failed", title: "Not approved", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "The code didn’t work.", text: "Nothing was approved.", visibleWhen: is("OTP_REQUIRED", "OTP_INVALID", "STEP_UP_FAILED") },
        { type: "result", tone: "error", title: "We couldn’t complete this right now.", text: "Nothing was approved.", visibleWhen: "ctx.error.code == 'CORE_UNAVAILABLE'" },
        { type: "result", tone: "error", title: "Something went wrong.", text: "Nothing was approved.", visibleWhen: `!(${is("OTP_REQUIRED", "OTP_INVALID", "STEP_UP_FAILED", "CORE_UNAVAILABLE")})` },
        { type: "button", label: "Back to approvals", variant: "primary", actions: [{ type: "navigate", to: "inbox" }] },
        { type: "button", label: "Close", variant: "secondary", actions: [{ type: "exit" }] },
      ],
    },
  ],
};
