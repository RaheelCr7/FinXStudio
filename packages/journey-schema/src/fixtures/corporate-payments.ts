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
  onEnter: [{ type: "callApi" as const, integration: "people", saveAs: "ctx.people", onError: { navigate: "unavailable" } }],
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
const unavailable = {
  id: "unavailable", title: "Not available", kind: "terminal" as const,
  blocks: [
    { type: "result" as const, tone: "error" as const, title: "We can't open this right now", text: "{{ctx.error.message}}" },
    btn("Try again", [go("who")]), btn("Close", [{ type: "exit" }], "secondary"),
  ],
};
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
    { type: "otp" as const, bind: "otp.code", length: 6, maxAttempts: 3, resendAfterSeconds: 60, hint: "Enter the code sent to {{ctx.otp.maskedPhone}}", onResend: [{ type: "callApi" as const, integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: { showToast: "We couldn't send a new code. Try again.", stay: true } }] },
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


/* ------------------------------------------------------------------------- scenarios (the tests that travel with the journeys) */
const NOW = "2026-11-03T10:00:00Z"; // Tuesday morning, before the 16:00 cut-off
const SEED = (userId: string, amount: number, reference: string) => [
  { adapter: "bank.otp.send" }, { adapter: "bank.otp.verify", input: { code: "482100" } },
  { adapter: "corp.payments.initiate", input: { userId, fromAccountId: "acme_ops", beneficiaryId: "sup_logistics", amount, reference } },
];
const signIn = (who: string) => [{ set: { "session.userId": who } }, { press: "Continue" }];
const fillPayment = (p: { from?: string; to?: string; amount: number }) => [
  { set: { "pay.fromAccountId": p.from ?? "acme_ops", "pay.beneficiaryId": p.to ?? "sup_textile", "pay.amount": p.amount, "pay.reference": "INV-1" } }, { press: "Continue" },
];
const sendWithCode = (code = "482100") => [{ set: { "pay.consent": true } }, { press: "Confirm and send OTP" }, { set: { "otp.code": code } }, { press: "Verify and send for approval" }];
const balance = (equals: number) => ({ expectBank: { adapter: "corp.company.get", input: { userId: "sara" }, path: "accounts.acme_ops.balance", equals } });
const approveWithCode = (code = "482100") => [{ set: { "appr.consent": true } }, { press: "Approve and send OTP" }, { set: { "otp.code": code } }, { press: "Verify and approve" }];

/* ------------------------------------------------------------ start a payment (initiator) */
export const corporatePayment: Journey = {
  ...base, id: "jrn_corporate_payment", slug: "corporate-payment", name: "Start a payment", entryScreen: "who",
  acceptance: [
    { id: "AC-1", text: "Only an initiator can start a payment" },
    { id: "AC-2", text: "A person cannot send more than their own daily limit" },
    { id: "AC-3", text: "Only beneficiaries on the company's approved list can be paid" },
    { id: "AC-4", text: "A payment above the threshold needs two approvers" },
    { id: "AC-5", text: "Starting a payment moves no money: it waits for approval" },
    { id: "AC-6", text: "A payment started after the cut-off goes out the next working day" },
    { id: "AC-7", text: "When the bank refuses, the reason is shown and no money has left" },
    { id: "AC-8", text: "Three wrong one-time codes stop the payment" },
    { id: "AC-9", text: "A payment cannot be sent without the confirmation" },
    { id: "AC-10", text: "A person must say who they are, and a customer who is not a company is told it is not available" },
    { id: "AC-11", text: "A one-time code must be six digits" },
  ],
  scenarios: [
    { id: "T-1", name: "An approver cannot start a payment", covers: ["AC-1"], persona: "acme", now: NOW, steps: [...signIn("hassan"), { expectScreen: "denied" }, { expectText: "Only an initiator" }] },
    { id: "T-2", name: "Omar cannot send above his 500,000 limit", covers: ["AC-2"], persona: "acme", now: NOW, steps: [...signIn("omar"), ...fillPayment({ amount: 600_000 }), { expectScreen: "start" }, { expectError: "daily limit" }] },
    { id: "T-3", name: "A supplier that is not approved is refused, with the reason", covers: ["AC-3", "AC-7"], persona: "acme", now: NOW, steps: [...signIn("sara"), ...fillPayment({ to: "someone-new", amount: 1000 }), ...sendWithCode(), { expectScreen: "failed" }, { expectText: "approved list" }, { expectText: "No money has left the account" }] },
    { id: "T-4", name: "A large payment needs two approvers", covers: ["AC-4"], persona: "acme", now: NOW, steps: [...signIn("sara"), ...fillPayment({ amount: 2_000_000 }), ...sendWithCode(), { expectScreen: "success" }, { expectText: "waits for 2 approver" }] },
    { id: "T-5", name: "A small payment needs one approver and moves no money yet", covers: ["AC-4", "AC-5"], persona: "acme", now: NOW, steps: [...signIn("sara"), ...fillPayment({ amount: 250_000 }), ...sendWithCode(), { expectScreen: "success" }, { expectText: "waits for 1 approver" }, balance(25_000_000)] },
    { id: "T-6", name: "After the cut-off it goes out the next working day", covers: ["AC-6"], persona: "acme", now: "2026-11-03T17:00:00Z", steps: [...signIn("sara"), ...fillPayment({ amount: 1000 }), ...sendWithCode(), { expectScreen: "success" }, { expectText: "value date 2026-11-04" }] },
    { id: "T-7", name: "A payment from a dollar account is refused with the reason", covers: ["AC-7"], persona: "acme", now: NOW, steps: [...signIn("sara"), ...fillPayment({ from: "acme_usd", amount: 100 }), ...sendWithCode(), { expectScreen: "failed" }, { expectText: "choose a PKR account" }, { expectText: "No money has left the account" }, balance(25_000_000)] },
    { id: "T-8", name: "Three wrong codes stop the payment", covers: ["AC-8"], persona: "acme", now: NOW, steps: [...signIn("sara"), ...fillPayment({ amount: 1000 }), { set: { "pay.consent": true } }, { press: "Confirm and send OTP" }, { set: { "otp.code": "999999" } }, { press: "Verify and send for approval" }, { press: "Verify and send for approval" }, { press: "Verify and send for approval" }, { expectScreen: "failed" }, balance(25_000_000)] },
    { id: "T-9", name: "It cannot be sent without the confirmation", covers: ["AC-9"], persona: "acme", now: NOW, steps: [...signIn("sara"), ...fillPayment({ amount: 1000 }), { press: "Confirm and send OTP" }, { expectScreen: "review" }, { expectError: "confirmation" }] },
    { id: "T-10", name: "Continuing without saying who you are is refused", covers: ["AC-10"], persona: "acme", now: NOW, steps: [{ press: "Continue" }, { expectScreen: "who" }, { expectError: "session.userId" }] },
    { id: "T-11", name: "A customer who is not a company is told it is not available", covers: ["AC-10"], persona: "ayesha", steps: [{ expectScreen: "unavailable" }, { expectText: "Not available for this customer" }] },
    { id: "T-12", name: "A code that is not six digits is refused", covers: ["AC-11"], persona: "acme", now: NOW, steps: [...signIn("sara"), ...fillPayment({ amount: 1000 }), { set: { "pay.consent": true } }, { press: "Confirm and send OTP" }, { set: { "otp.code": "123" } }, { press: "Verify and send for approval" }, { expectScreen: "otp" }, { expectError: "otp.code" }] },
  ],
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
            { label: "From", value: "{{ctx.company.accounts[pay.fromAccountId].name}} {{ctx.company.accounts[pay.fromAccountId].maskedNumber}}" },
            { label: "To", value: "{{ctx.company.beneficiaries[pay.beneficiaryId].name}}" },
            { label: "Amount", value: money("pay.amount", "ctx.company.accounts[pay.fromAccountId].currency") },
            { label: "Reference", value: "{{pay.reference}}" },
            { label: "Approvers needed", value: "{{pay.amount > ctx.company.dualApprovalAbove ? 2 : 1}}" },
          ],
        },
        { type: "alert", tone: "info", text: "Payments made after {{ctx.company.cutoff}} UTC, or on a day the bank is closed, go out on the next working day." },
        { type: "consent", bind: "pay.consent", termsVersion: "corporate-v1", text: "I confirm the payment details are correct", validation: { mustBeTrue: true, messages: { mustBeTrue: "Tick the confirmation first" } } },
        btn("Confirm and send OTP", [{ type: "validate" }, { type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: { showToast: "We couldn't send the code. Try again.", stay: true } }, go("otp")]),
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
    unavailable,
    denied("an initiator"),
  ],
};

/* ------------------------------------------------------- approve or reject a payment (approver) */
export const corporateApproval: Journey = {
  ...base, id: "jrn_corporate_approval", slug: "corporate-approval", name: "Approve payments", entryScreen: "who",
  acceptance: [
    { id: "AC-1", text: "Only an approver can approve or reject payments" },
    { id: "AC-2", text: "An approver is never offered a payment they started" },
    { id: "AC-3", text: "Approving a payment that needs one approver releases it and moves the money" },
    { id: "AC-4", text: "A payment that needs two approvers is not released by the first" },
    { id: "AC-5", text: "Rejecting a payment records the reason and moves no money" },
    { id: "AC-6", text: "Approving needs the confirmation and a right one-time code" },
    { id: "AC-7", text: "A person must say who they are, and a customer who is not a company is told it is not available" },
    { id: "AC-8", text: "A one-time code must be six digits" },
  ],
  scenarios: [
    { id: "T-1", name: "An initiator cannot approve", covers: ["AC-1"], persona: "acme", now: NOW, setup: SEED("sara", 250_000, "INV-9"), steps: [...signIn("omar"), { expectScreen: "denied" }, { expectText: "Only an approver" }] },
    { id: "T-2", name: "A person with both roles is not offered their own payment", covers: ["AC-2"], persona: "acme", now: NOW, setup: SEED("nadia", 100_000, "MINE"), steps: [...signIn("nadia"), { expectScreen: "start" }, { expectText: "Nothing is waiting for your approval" }] },
    { id: "T-3", name: "One approver releases a small payment and the money moves", covers: ["AC-3"], persona: "acme", now: NOW, setup: SEED("sara", 250_000, "INV-9"), steps: [...signIn("hassan"), { press: "PKR 250,000 to Indus Logistics" }, ...approveWithCode(), { expectScreen: "approved" }, { expectText: "Payment released" }, balance(24_750_000)] },
    { id: "T-4", name: "The first of two approvers does not release it", covers: ["AC-4"], persona: "acme", now: NOW, setup: SEED("sara", 2_000_000, "BIG"), steps: [...signIn("hassan"), { press: "PKR 2,000,000 to Indus Logistics" }, ...approveWithCode(), { expectScreen: "approved" }, { expectText: "It needs 2 approvers" }, balance(25_000_000)] },
    { id: "T-5", name: "Rejecting records the reason and keeps the money", covers: ["AC-5"], persona: "acme", now: NOW, setup: SEED("sara", 100_000, "WRONG"), steps: [...signIn("layla"), { press: "PKR 100,000 to Indus Logistics" }, { press: "Reject" }, { set: { "appr.reason": "Wrong supplier" } }, { press: "Reject payment" }, { expectScreen: "rejected" }, { expectBank: { adapter: "corp.payments.get", input: { paymentId: "{{appr.paymentId}}" }, path: "rejectReason", equals: "Wrong supplier" } }, balance(25_000_000)] },
    { id: "T-6", name: "It cannot be approved without the confirmation", covers: ["AC-6"], persona: "acme", now: NOW, setup: SEED("sara", 250_000, "INV-9"), steps: [...signIn("hassan"), { press: "PKR 250,000 to Indus Logistics" }, { press: "Approve and send OTP" }, { expectScreen: "review" }, { expectError: "confirmation" }] },
    { id: "T-7", name: "A wrong code does not approve it", covers: ["AC-6"], persona: "acme", now: NOW, setup: SEED("sara", 250_000, "INV-9"), steps: [...signIn("hassan"), { press: "PKR 250,000 to Indus Logistics" }, ...approveWithCode("999999"), { expectToast: "Incorrect code" }, balance(25_000_000)] },
    { id: "T-8", name: "Continuing without saying who you are is refused", covers: ["AC-7"], persona: "acme", now: NOW, steps: [{ press: "Continue" }, { expectScreen: "who" }, { expectError: "session.userId" }] },
    { id: "T-9", name: "A customer who is not a company is told it is not available", covers: ["AC-7"], persona: "ayesha", steps: [{ expectScreen: "unavailable" }, { expectText: "Not available for this customer" }] },
    { id: "T-10", name: "A code that is not six digits is refused", covers: ["AC-8"], persona: "acme", now: NOW, setup: SEED("sara", 250_000, "INV-9"), steps: [...signIn("hassan"), { press: "PKR 250,000 to Indus Logistics" }, { set: { "appr.consent": true } }, { press: "Approve and send OTP" }, { set: { "otp.code": "12" } }, { press: "Verify and approve" }, { expectScreen: "otp" }, { expectError: "otp.code" }] },
  ],
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
      onEnter: [{ type: "callApi", integration: "pending", input: { userId: "{{session.userId}}" }, saveAs: "ctx.pending", onError: { navigate: "unavailable" } }],
      blocks: [
        { type: "text", text: "Nothing is waiting for your approval.", visibleWhen: "len(ctx.pending) == 0" },
        {
          // each pending payment is a row; tapping it opens it for review
          type: "menu", source: "ctx.pending", item: {
            label: "{{item.amount | money:item.currency}} to {{item.payee}}",
            text: "{{item.reference}} · started by {{item.initiatedBy}} · {{len(item.approvals)}} of {{item.required}} approved", icon: "send",
            actions: [{ type: "setData", path: "appr.paymentId", value: "{{item.id}}" }, { type: "callApi", integration: "payment", input: { paymentId: "{{item.id}}" }, saveAs: "appr.payment", onError: { navigate: "unavailable" } }, go("review")],
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
            { label: "From", value: "{{ctx.company.accounts[appr.payment.fromAccountId].name}} {{ctx.company.accounts[appr.payment.fromAccountId].maskedNumber}}" },
            { label: "To", value: "{{appr.payment.payee}}" },
            { label: "Amount", value: money("appr.payment.amount", "appr.payment.currency") },
            { label: "Reference", value: "{{appr.payment.reference}}" },
            { label: "Started by", value: "{{appr.payment.initiatedBy}}" },
            { label: "Approved so far", value: "{{len(appr.payment.approvals)}} of {{appr.payment.required}}" },
            { label: "Value date", value: "{{appr.payment.valueDate}}" },
          ],
        },
        { type: "consent", bind: "appr.consent", termsVersion: "corporate-v1", text: "I have checked this payment and approve it", validation: { mustBeTrue: true, messages: { mustBeTrue: "Tick the confirmation first" } } },
        btn("Approve and send OTP", [{ type: "validate" }, { type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: { showToast: "We couldn't send the code. Try again.", stay: true } }, go("otp")]),
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
    unavailable,
    denied("an approver"),
  ],
};
