import type { Journey } from "../schema";

/**
 * Corporate payments with maker-checker approval, on the corporate sandbox (plan, Stage 1). Two journeys that share the rules
 * of the company: one starts a payment (an initiator), one approves or rejects it (an approver). Each is only for its role,
 * every rule answers with a message the screen shows, and money only moves after the one-time code. English only.
 */
const base = { version: 1, status: "published" as const, channels: ["web" as const, "mobile" as const], locale: { default: "en", supported: ["en"] }, apps: ["meezan"] };
const go = (to: string) => ({ type: "navigate" as const, to });
const btn = (label: string, actions: any[], variant: "primary" | "secondary" | "ghost" = "primary") => ({ type: "button" as const, label, variant, actions });
const money = (path: string, cur: string) => `{{${path} | money:${cur}}}`;
const COMPANY = [{ type: "callApi" as const, integration: "company", input: { userId: "{{session.userId}}" }, saveAs: "ctx.company", onError: { showToast: "We couldn't load your company. Try again.", stay: true } }];
const WHO = (title: string) => ({
  id: "who", title: "Sign in",
  onEnter: [{ type: "callApi" as const, integration: "people", saveAs: "ctx.people" }],
  blocks: [
    { type: "text" as const, variant: "title" as const, text: title },
    { type: "alert" as const, tone: "info" as const, text: "Sandbox: choose who you are. A real bank app already knows who signed in." },
    { type: "select" as const, bind: "session.userId", label: "I am", source: "ctx.people", variant: "rows" as const },
    btn("Continue", [{ type: "validate" }, ...COMPANY, go("start")]),
  ],
});
const failed = (title: string, again: string) => ({
  id: "failed", title, kind: "terminal" as const,
  blocks: [
    { type: "result" as const, tone: "error" as const, title, text: "{{ctx.error.message}}" },
    { type: "text" as const, variant: "caption" as const, text: "No money has left the account." },
    btn("Try again", [go(again)]), btn("Close", [{ type: "exit" }], "secondary"),
  ],
});
const denied = (what: string) => ({
  id: "denied", title: "Not allowed", kind: "terminal" as const,
  blocks: [
    { type: "result" as const, tone: "error" as const, title: "You can't do this", text: `Only ${what} can use this. You are signed in as {{ctx.company.me.name}}.` },
    btn("Close", [{ type: "exit" }]),
  ],
});
const OTP = (verifyLabel: string, doIt: any[]) => ({
  id: "otp", title: "Verify",
  blocks: [
    { type: "otp" as const, bind: "otp.code", length: 6, maxAttempts: 3, resendAfterSeconds: 60, hint: "Enter the code sent to {{ctx.otp.maskedPhone}}", onResend: [{ type: "callApi" as const, integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp" }] },
    btn(verifyLabel, [
      { type: "validate" },
      { type: "callApi", integration: "otpVerify", input: { code: "{{otp.code}}" }, onError: { showToast: "Incorrect code", stay: true, lockAfter: 3, lockTo: "failed" } },
      ...doIt,
    ]),
  ],
});
const COMMON_INTEG = [
  { id: "people", adapter: "corp.users.list", mode: "sandbox" as const },
  { id: "company", adapter: "corp.company.get", mode: "sandbox" as const },
  { id: "otpSend", adapter: "bank.otp.send", mode: "sandbox" as const },
  { id: "otpVerify", adapter: "bank.otp.verify", mode: "sandbox" as const },
];

/* ------------------------------------------------------------ start a payment (initiator) */
export const corporatePayment: Journey = {
  ...base, id: "jrn_corporate_payment", slug: "corporate-payment", name: "Start a payment", entryScreen: "who",
  authorisation: { role: "initiator", rolesFrom: "ctx.company.me.roles", deniedScreen: "denied" },
  dataModel: {
    "session.userId": { type: "string", required: true },
    "pay.fromAccountId": { type: "string", required: true }, "pay.beneficiaryId": { type: "string", required: true },
    "pay.amount": { type: "money", required: true }, "pay.reference": { type: "string", required: true },
    "pay.consent": { type: "boolean", required: true }, "otp.code": { type: "string", pattern: "^[0-9]{6}$" },
  },
  integrations: [...COMMON_INTEG, { id: "initiate", adapter: "corp.payments.initiate", mode: "sandbox" }],
  screens: [
    WHO("Start a company payment"),
    {
      id: "start", title: "Payment details",
      blocks: [
        { type: "accountPicker", bind: "pay.fromAccountId", source: "ctx.company.accounts", showBalance: true },
        { type: "beneficiaryPicker", bind: "pay.beneficiaryId", source: "ctx.company.beneficiaries" },
        {
          type: "amountInput", bind: "pay.amount", currency: "{{ctx.company.accounts[pay.fromAccountId].currency}}", label: "Amount",
          helper: "Your limit left today: " + money("ctx.company.me.remainingToday", "ctx.company.currency"),
          validation: { max: "ctx.company.me.remainingToday", messages: { max: "That is above your daily limit" } },
        },
        { type: "textInput", bind: "pay.reference", label: "Reference", placeholder: "Invoice number" },
        btn("Continue", [{ type: "validate" }, go("review")]),
      ],
    },
    {
      id: "review", title: "Review payment",
      blocks: [
        {
          type: "reviewSummary", rows: [
            { label: "From", value: "{{ctx.company.accounts[pay.fromAccountId].name}}" },
            { label: "To", value: "{{ctx.company.beneficiaries[pay.beneficiaryId].name}}" },
            { label: "Amount", value: money("pay.amount", "ctx.company.accounts[pay.fromAccountId].currency") },
            { label: "Reference", value: "{{pay.reference}}" },
            { label: "Approvers needed", value: "{{pay.amount > ctx.company.dualApprovalAbove ? 2 : 1}}" },
          ],
        },
        { type: "alert", tone: "info", text: "Payments made after {{ctx.company.cutoff}} UTC, or on a day the bank is closed, go out on the next working day." },
        { type: "consent", bind: "pay.consent", termsVersion: "corporate-v1", text: "I confirm the payment details are correct", validation: { mustBeTrue: true, messages: { mustBeTrue: "Tick the confirmation first" } } },
        btn("Confirm and send OTP", [{ type: "validate" }, { type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp" }, go("otp")]),
      ],
    },
    OTP("Verify and send for approval", [
      { type: "callApi", integration: "initiate", input: { userId: "{{session.userId}}", fromAccountId: "{{pay.fromAccountId}}", beneficiaryId: "{{pay.beneficiaryId}}", amount: "{{pay.amount}}", reference: "{{pay.reference}}" }, saveAs: "pay.result", onError: { navigate: "failed" } },
      go("success"),
    ]),
    {
      id: "success", title: "Sent for approval", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Sent for approval", text: money("pay.result.amount", "pay.result.currency") + " to {{ctx.company.beneficiaries[pay.beneficiaryId].name}} now waits for {{pay.result.required}} approver(s). Nothing has left the account yet.", meta: "Payment {{pay.result.id}} · value date {{pay.result.valueDate}}" },
        { type: "alert", tone: "info", text: "It was started after the cut-off, so it goes out on {{pay.result.valueDate}}.", visibleWhen: "pay.result.afterCutoff" },
        btn("Done", [{ type: "exit" }]),
      ],
    },
    failed("Payment not sent", "start"),
    denied("an initiator"),
  ],
};

/* ------------------------------------------------------- approve or reject a payment (approver) */
export const corporateApproval: Journey = {
  ...base, id: "jrn_corporate_approval", slug: "corporate-approval", name: "Approve payments", entryScreen: "who",
  authorisation: { role: "approver", rolesFrom: "ctx.company.me.roles", deniedScreen: "denied" },
  dataModel: {
    "session.userId": { type: "string", required: true }, "appr.paymentId": { type: "string", required: true },
    "appr.consent": { type: "boolean", required: true }, "appr.reason": { type: "string" }, "otp.code": { type: "string", pattern: "^[0-9]{6}$" },
  },
  integrations: [
    ...COMMON_INTEG,
    { id: "pending", adapter: "corp.payments.pending", mode: "sandbox" }, { id: "payment", adapter: "corp.payments.get", mode: "sandbox" },
    { id: "approve", adapter: "corp.payments.approve", mode: "sandbox" }, { id: "reject", adapter: "corp.payments.reject", mode: "sandbox" },
  ],
  screens: [
    WHO("Approve company payments"),
    {
      id: "start", title: "Waiting for you",
      onEnter: [{ type: "callApi", integration: "pending", input: { userId: "{{session.userId}}" }, saveAs: "ctx.pending" }],
      blocks: [
        { type: "text", text: "Nothing is waiting for your approval.", visibleWhen: "len(ctx.pending) == 0" },
        {
          // each pending payment is a row; tapping it opens it for review
          type: "menu", source: "ctx.pending", item: {
            label: "{{item.amount | money:item.currency}} to {{ctx.company.beneficiaries[item.beneficiaryId].name}}",
            text: "{{item.reference}} · started by {{item.initiatedBy}} · {{len(item.approvals)}} of {{item.required}} approved", icon: "send",
            actions: [{ type: "setData", path: "appr.paymentId", value: "{{item.id}}" }, { type: "callApi", integration: "payment", input: { paymentId: "{{item.id}}" }, saveAs: "appr.payment" }, go("review")],
          },
        },
        btn("Close", [{ type: "exit" }], "secondary"),
      ],
    },
    {
      id: "review", title: "Review payment",
      blocks: [
        {
          type: "reviewSummary", rows: [
            { label: "From", value: "{{ctx.company.accounts[appr.payment.fromAccountId].name}}" },
            { label: "To", value: "{{ctx.company.beneficiaries[appr.payment.beneficiaryId].name}}" },
            { label: "Amount", value: money("appr.payment.amount", "appr.payment.currency") },
            { label: "Reference", value: "{{appr.payment.reference}}" },
            { label: "Started by", value: "{{appr.payment.initiatedBy}}" },
            { label: "Approved so far", value: "{{len(appr.payment.approvals)}} of {{appr.payment.required}}" },
            { label: "Value date", value: "{{appr.payment.valueDate}}" },
          ],
        },
        { type: "consent", bind: "appr.consent", termsVersion: "corporate-v1", text: "I have checked this payment and approve it", validation: { mustBeTrue: true, messages: { mustBeTrue: "Tick the confirmation first" } } },
        btn("Approve and send OTP", [{ type: "validate" }, { type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp" }, go("otp")]),
        btn("Reject", [go("reject")], "secondary"),
      ],
    },
    OTP("Verify and approve", [
      { type: "callApi", integration: "approve", input: { userId: "{{session.userId}}", paymentId: "{{appr.paymentId}}" }, saveAs: "appr.result", onError: { navigate: "failed" } },
      go("approved"),
    ]),
    {
      id: "reject", title: "Reject payment",
      blocks: [
        { type: "text", variant: "title", text: "Why are you rejecting it?" },
        { type: "textInput", bind: "appr.reason", label: "Reason (optional)", placeholder: "Wrong supplier" },
        btn("Reject payment", [{ type: "callApi", integration: "reject", input: { userId: "{{session.userId}}", paymentId: "{{appr.paymentId}}", reason: "{{appr.reason}}" }, saveAs: "appr.result", onError: { navigate: "failed" } }, go("rejected")]),
        btn("Back", [go("review")], "secondary"),
      ],
    },
    {
      id: "approved", title: "Approved", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Payment released", text: "{{appr.result.releaseReference}}: " + money("appr.result.amount", "appr.result.currency") + " has been sent.", visibleWhen: "appr.result.status == 'released'" },
        { type: "result", tone: "success", title: "Approved", text: "It needs {{appr.result.required}} approvers: {{len(appr.result.approvals)}} so far. It is released when the next one approves.", visibleWhen: "appr.result.status != 'released'" },
        btn("Back to the list", [go("start")]), btn("Close", [{ type: "exit" }], "secondary"),
      ],
    },
    {
      id: "rejected", title: "Rejected", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Payment rejected", text: "Nothing has left the account. The person who started it can see your reason." },
        btn("Back to the list", [go("start")]), btn("Close", [{ type: "exit" }], "secondary"),
      ],
    },
    failed("Not completed", "start"),
    denied("an approver"),
  ],
};
