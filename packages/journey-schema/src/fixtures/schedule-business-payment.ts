import type { Journey, Screen } from "../schema";
import { scheduleBusinessAcceptance, scheduleBusinessScenarios } from "./schedule-business-payment-tests";
import { alert, button, denyScreen, failScreens, go, is, lacks, lockOnWrongCode, lockedScreen, PURPOSES, REFERENCE, route, set, text, toRoute } from "./business-kit";

const STEPPER = { type: "stepper" as const, steps: ["supplier", "amount", "when", "review"] };
const NEW = "sc.mode == 'new'";
const EDIT = "sc.mode == 'edit'";
const PLAN = {
  supplierId: "{{sc.supplierId}}", amount: "{{sc.amount}}", reference: "{{sc.reference}}", purpose: "{{sc.purpose}}", frequency: "{{sc.frequency}}", start: "{{sc.start}}",
  endMode: "{{sc.endMode}}", endDate: "{{sc.endDate}}", endCount: "{{sc.endCount}}", allowQuarterly: "{{opt.allowQuarterly != false}}", strictCutoff: "{{opt.strictCutoff == true}}",
  scheduleId: "{{sc.id}}",
};
const REFUSED = ["SCHEDULE_NOT_FOUND", "SCHEDULE_NOT_ACTIVE", "SCHEDULE_RUNNING", "SCHEDULE_CUTOFF_PASSED"];
const AMOUNT_CODES = ["RAIL_LIMIT", "RAIL_NOT_AVAILABLE", "LIMIT_USER_EXCEEDED", "INVALID_AMOUNT", "REFERENCE_REQUIRED", "INVALID_REFERENCE", "PURPOSE_REQUIRED"];
const DATE_CODES = ["DATE_TOO_SOON", "DATE_TOO_FAR", "NOT_A_WEEKDAY", "END_BEFORE_START", "INVALID_COUNT", "INVALID_END_DATE", "INVALID_FREQUENCY", "INVALID_END"];

/** A new schedule from the result of another: what the first one was opened with is forgotten. */
const FRESH = [set("launch.mode", ""), set("launch.scheduleId", ""), set("launch.supplierId", ""), set("launch.amount", null)];

/** The rows of a schedule's receipt (a new one, and a change). */
const rows = (r: string) => [
  { type: "reviewSummary" as const, rows: [{ label: "Supplier", value: "{{sc.supplierName}}" }, { label: "Amount", value: `{{${r}.amountText}}` }, { label: "How often", value: `{{${r}.how}}` }] },
  { type: "reviewSummary" as const, visibleWhen: "sc.frequency == 'once'", rows: [{ label: "Date", value: `{{${r}.firstText}}` }] },
  { type: "reviewSummary" as const, visibleWhen: "sc.frequency != 'once'", rows: [{ label: "Starts", value: `{{${r}.firstText}}` }, { label: "Ends", value: `{{${r}.ends}}` }] },
  { type: "reviewSummary" as const, rows: [{ label: "Approval", value: `{{${r}.approvalText}}` }] },
];

/**
 * Schedule a supplier payment (BankWorkx Business, Payments). A Maker schedules a payment to a saved, approved supplier once, weekly, monthly or every 3 months; approvers approve
 * it once before the first payment, and before each payment the bank checks again (balance, limits, the supplier). Three modes in one journey: new, change (`launch.mode = edit`,
 * `launch.scheduleId`: the amount, reference, purpose, next date and the end, never the supplier or how often; it goes back for approval) and cancel (`launch.mode = cancel`: at once, no code).
 * Nothing is taken when a payment is scheduled. A code is asked only from the company's threshold (25,000.00 in the demo) and names the amount, the supplier and how often.
 *
 * Built from the spec with the blocks FinX has (docs/BANKWORKX.md): the bank checks everything when Continue is pressed and says which field is wrong in words; the dates are the calendar
 * field, not a list of working days; "On a date" shows the dates the bank offers on a screen of its own; the review has the confirmation tick the money rules ask for (the spec has none).
 */
export const scheduleBusinessPayment: Journey = {
  id: "jrn_schedule_business_payment",
  slug: "schedule-business-payment",
  name: "Schedule a supplier payment",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: scheduleBusinessAcceptance,
  scenarios: scheduleBusinessScenarios,
  dataModel: {
    "launch.mode": { type: "string" }, "launch.scheduleId": { type: "string" }, "launch.supplierId": { type: "string" }, "launch.amount": { type: "number" },
    "opt.allowQuarterly": { type: "boolean" }, "opt.reminder": { type: "boolean" }, "opt.strictCutoff": { type: "boolean" },
    "sc.mode": { type: "string" }, "sc.id": { type: "string" }, "sc.supplierId": { type: "string", required: true }, "sc.supplierName": { type: "string" }, "sc.ccy": { type: "string" },
    "sc.amount": { type: "money", required: true, currency: "{{sc.ccy}}" }, "sc.reference": { type: "string", required: true }, "sc.purpose": { type: "string", required: true },
    "sc.frequency": { type: "string" }, "sc.start": { type: "string", required: true }, "sc.endMode": { type: "string" }, "sc.endDate": { type: "string", required: true }, "sc.endCount": { type: "string", required: true },
    "sc.consent": { type: "boolean", required: true }, "sc.res": { type: "object" }, "otp.code": { type: "string", pattern: "^[0-9]{6}$" },
  },
  integrations: [
    { id: "suppliers", adapter: "corp.suppliers.list", mode: "sandbox" },
    { id: "get", adapter: "corp.schedules.get", mode: "sandbox" },
    { id: "check", adapter: "corp.schedules.check", mode: "sandbox" },
    { id: "otpSend", adapter: "bank.otp.send", mode: "sandbox" },
    { id: "otpVerify", adapter: "bank.otp.verify", mode: "sandbox" },
    { id: "create", adapter: "corp.schedules.create", mode: "sandbox" },
    { id: "update", adapter: "corp.schedules.update", mode: "sandbox" },
    { id: "cancel", adapter: "corp.schedules.cancel", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Schedule a supplier payment", kind: "branch",
      onEnter: [
        set("ctx.error", null),
        { type: "callApi", integration: "suppliers", saveAs: "ctx.sup", onError: toRoute },
        set("sc.mode", "{{launch.mode == 'edit' || launch.mode == 'cancel' ? launch.mode : 'new'}}"), set("sc.id", "{{launch.scheduleId}}"),
        set("sc.supplierId", "{{has(ctx.sup, launch.supplierId) ? launch.supplierId : ''}}"), set("sc.amount", "{{isEmpty(launch.amount) ? null : launch.amount}}"),
        set("sc.supplierName", ""), set("sc.ccy", ""), set("sc.reference", ""), set("sc.purpose", ""), set("sc.frequency", "monthly"), set("sc.start", ""), set("sc.endMode", "never"), set("sc.endDate", ""), set("sc.endCount", ""),
        set("sc.consent", false), set("sc.res", null), set("otp.code", ""),
        go("supplier"),
      ],
      navigation: route([lacks("biz.payments.schedule"), "denied"], ["sc.mode == 'cancel'", "cancelLoad"], ["sc.mode == 'edit'", "editLoad"], ["!isEmpty(sc.supplierId)", "chosen"]),
      blocks: [],
    },
    {
      id: "supplier", title: "Choose a supplier",
      blocks: [
        STEPPER,
        text("Step 1 of 4 · Schedule a supplier payment", "caption"),
        text("Choose a supplier", "title"),
        alert("error", "Choose a supplier from your list.", is("SUPPLIER_NOT_APPROVED")),
        { type: "menu", source: "ctx.sup", item: { label: "{{item.displayName}}", text: "{{item.line}}", actions: [set("ctx.error", null), set("sc.supplierId", "{{item.id}}"), go("chosen")] } },
        text("No suppliers are saved yet.", "body", "len(ctx.sup) == 0"),
        button("Cancel", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      // the currency and the name come from the saved supplier
      id: "chosen", title: "Schedule a supplier payment", kind: "branch",
      onEnter: [
        set("sc.supplierName", "{{ctx.sup[sc.supplierId].displayName}}"),
        set("sc.ccy", "{{ctx.sup[sc.supplierId].currency ? ctx.sup[sc.supplierId].currency : 'USD'}}"),
        go("amount"),
      ],
      blocks: [],
    },
    {
      id: "amount", title: "Amount and reference",
      blocks: [
        STEPPER,
        text("Step 2 of 4 · Schedule a supplier payment", "caption", NEW),
        text("Step 2 of 3 · Change payment", "caption", EDIT),
        text("Amount and reference", "title"),
        { type: "reviewSummary", rows: [{ label: "Supplier", value: "{{sc.supplierName}} {{ctx.sup[sc.supplierId].line}}" }] },
        alert("error", "{{ctx.error.message}}", is(...AMOUNT_CODES)),
        { type: "amountInput", bind: "sc.amount", currency: "{{sc.ccy}}", label: "{{sc.ccy == 'USD' ? 'Amount' : 'Amount (' + sc.ccy + ')'}}" },
        { type: "textInput", bind: "sc.reference", label: "Reference", placeholder: "Invoice or PO number", pattern: REFERENCE, patternMessage: "Use letters, numbers and spaces only." },
        { type: "select", bind: "sc.purpose", label: "Purpose", variant: "dropdown", options: PURPOSES },
        button("Continue", [{ type: "validate" }, set("ctx.error", null), go("when")]),
        button("Back", [go("supplier")], "ghost", NEW),
        button("Back", [go("editCard")], "ghost", EDIT),
      ],
    },
    {
      id: "when", title: "How often",
      blocks: [
        STEPPER,
        text("Step 3 of 4 · Schedule a supplier payment", "caption", NEW),
        text("Step 2 of 3 · Change payment", "caption", EDIT),
        text("How often", "title", NEW),
        text("Next payment", "title", EDIT),
        alert("error", "{{ctx.error.message}}", is(...DATE_CODES)),
        { type: "select", bind: "sc.frequency", label: "How often", visibleWhen: `${NEW} && opt.allowQuarterly != false`, choices: [{ id: "once", label: "Once" }, { id: "weekly", label: "Weekly" }, { id: "monthly", label: "Monthly" }, { id: "quarterly", label: "Every 3 months" }] },
        { type: "select", bind: "sc.frequency", label: "How often", visibleWhen: `${NEW} && opt.allowQuarterly == false`, choices: [{ id: "once", label: "Once" }, { id: "weekly", label: "Weekly" }, { id: "monthly", label: "Monthly" }] },
        { type: "dateInput", bind: "sc.start", label: "Date", placeholder: "Choose a date", visibleWhen: "sc.frequency == 'once'" },
        { type: "dateInput", bind: "sc.start", label: "Start date", placeholder: "Choose a date", visibleWhen: `sc.frequency != 'once' && ${NEW}` },
        { type: "dateInput", bind: "sc.start", label: "Next payment", placeholder: "Choose a date", visibleWhen: `sc.frequency != 'once' && ${EDIT}` },
        { type: "select", bind: "sc.endMode", label: "Ends", visibleWhen: "sc.frequency != 'once'", choices: [{ id: "never", label: "Never" }, { id: "date", label: "On a date" }, { id: "count", label: "After a number of payments" }] },
        { type: "textInput", bind: "sc.endCount", label: "Number of payments", placeholder: "For example 12", keyboard: "number", helper: "From 2 to 104 (weekly), 60 (monthly) or 40 (every 3 months).", visibleWhen: "sc.frequency != 'once' && sc.endMode == 'count'" },
        button("Continue", [
          { type: "validate" }, set("ctx.error", null),
          { type: "callApi", integration: "check", input: { ...PLAN }, saveAs: "ctx.pv", onError: toRoute },
          go("afterWhen"),
        ]),
        button("Back", [go("amount")], "ghost"),
      ],
    },
    {
      id: "afterWhen", title: "Schedule a supplier payment", kind: "branch",
      onEnter: [set("sc.consent", false), go("review")],
      navigation: route(["sc.endMode == 'date' && sc.frequency != 'once'", "endDate"]),
      blocks: [],
    },
    {
      id: "endDate", title: "Last payment",
      blocks: [
        STEPPER,
        text("Last payment", "title"),
        alert("error", "{{ctx.error.message}}", is("END_BEFORE_START", "INVALID_END_DATE")),
        { type: "select", bind: "sc.endDate", label: "Last payment on", variant: "dropdown", source: "ctx.pv.endDates" },
        button("Continue", [
          { type: "validate" }, set("ctx.error", null),
          { type: "callApi", integration: "check", input: { ...PLAN }, saveAs: "ctx.pv", onError: toRoute },
          set("sc.consent", false), go("review"),
        ]),
        button("Back", [go("when")], "ghost"),
      ],
    },
    {
      id: "review", title: "Review",
      blocks: [
        STEPPER,
        text("Step 4 of 4 · Schedule a supplier payment", "caption", NEW),
        text("Step 3 of 3 · Change payment", "caption", EDIT),
        text("Review", "title"),
        alert("error", "You can have up to 20 scheduled payments. Cancel one to add another.", is("SCHEDULE_LIMIT")),
        { type: "reviewSummary", rows: [{ label: "Supplier", value: "{{sc.supplierName}}" }, { label: "Amount", value: "{{ctx.pv.amountText}}" }, { label: "Reference", value: "{{sc.reference}}" }, { label: "Purpose", value: "{{sc.purpose}}" }, { label: "How often", value: "{{ctx.pv.how}}" }] },
        { type: "reviewSummary", visibleWhen: "sc.frequency == 'once'", rows: [{ label: "Date", value: "{{ctx.pv.firstText}}" }] },
        { type: "reviewSummary", visibleWhen: "sc.frequency != 'once'", rows: [{ label: "Starts", value: "{{ctx.pv.firstText}}" }, { label: "Ends", value: "{{ctx.pv.ends}}" }, { label: "Next dates", value: "{{ctx.pv.nextDates}}" }] },
        { type: "reviewSummary", rows: [{ label: "Approval", value: "{{ctx.pv.approvalText}}" }, { label: "Before each payment", value: "{{ctx.pv.before}}" }] },
        { type: "alert", tone: "info", text: "Nothing is taken when you schedule a payment. Each payment waits for the approvers." },
        { type: "consent", bind: "sc.consent", termsVersion: "schedule-business-payment-v1", text: "I confirm the details are correct", validation: { mustBeTrue: true, messages: { mustBeTrue: "Tick the confirmation first" } } },
        // under the company's threshold no code is asked: the list of approved suppliers is the control
        button("Send for approval", [{ type: "validate" }, set("ctx.error", null), { type: "callApi", integration: "create", input: { ...PLAN }, saveAs: "sc.res", onError: toRoute }, go("sent")], "primary", `${NEW} && !ctx.pv.codeRequired`),
        button("Send for approval", [{ type: "validate" }, set("ctx.error", null), { type: "callApi", integration: "update", input: { ...PLAN }, saveAs: "sc.res", onError: toRoute }, go("changed")], "primary", `${EDIT} && !ctx.pv.codeRequired`),
        button("Send for approval", [{ type: "validate" }, set("ctx.error", null), set("otp.code", ""), { type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: toRoute }, go("otp")], "primary", "ctx.pv.codeRequired"),
        button("Back", [go("when")], "ghost"),
      ],
    },
    {
      id: "otp", title: "Enter your code",
      blocks: [
        text("Authorise {{ctx.pv.amountText}} to {{sc.supplierName}}, {{ctx.pv.adverb}}", "title"),
        text("It only works for this payment.", "caption"),
        { type: "otp", bind: "otp.code", length: 6, maxAttempts: 3, resendAfterSeconds: 30, keypad: true, hint: "Code sent to {{ctx.otp.maskedPhone}}.", onResend: [{ type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: toRoute }] },
        button("Send for approval", [
          { type: "validate" },
          { type: "callApi", integration: "otpVerify", input: { code: "{{otp.code}}" }, onError: lockOnWrongCode },
          { type: "callApi", integration: "create", input: { ...PLAN }, saveAs: "sc.res", onError: toRoute },
          go("sent"),
        ], "primary", NEW),
        button("Send for approval", [
          { type: "validate" },
          { type: "callApi", integration: "otpVerify", input: { code: "{{otp.code}}" }, onError: lockOnWrongCode },
          { type: "callApi", integration: "update", input: { ...PLAN }, saveAs: "sc.res", onError: toRoute },
          go("changed"),
        ], "primary", EDIT),
      ],
    },
    {
      id: "sent", title: "Sent for approval", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Sent for approval", text: "{{sc.res.amountText}} to {{sc.supplierName}}, {{sc.res.adverb}}, from {{sc.res.firstShort}}.", meta: "Reference {{sc.res.reference}}" },
        { type: "statusChip", status: "pending_approval", label: "Waiting for {{sc.res.required}} approval{{sc.res.required > 1 ? 's' : ''}}" },
        ...rows("sc.res"),
        button("View scheduled", [{ type: "navigate", toJourney: "business-schedules" }]),
        button("Schedule another", [...FRESH, go("start")], "secondary"),
      ],
    },
    {
      id: "changed", title: "Change sent for approval", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Change sent for approval", text: "The payment to {{sc.supplierName}} waits until it is approved.", meta: "Reference {{sc.res.reference}}" },
        { type: "statusChip", status: "pending_approval", label: "Waiting for {{sc.res.required}} approval{{sc.res.required > 1 ? 's' : ''}}" },
        ...rows("sc.res"),
        button("View scheduled", [{ type: "navigate", toJourney: "business-schedules" }]),
      ],
    },
    // ---- change
    {
      id: "editLoad", title: "Change payment", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "get", input: { scheduleId: "{{sc.id}}", strictCutoff: "{{opt.strictCutoff == true}}" }, saveAs: "ctx.cur", onError: toRoute },
        set("sc.supplierId", "{{ctx.cur.supplierId}}"), set("sc.supplierName", "{{ctx.cur.supplierName}}"), set("sc.ccy", "{{ctx.cur.currency}}"), set("sc.amount", "{{ctx.cur.amount}}"), set("sc.reference", "{{ctx.cur.reference}}"),
        set("sc.purpose", "{{ctx.cur.purpose}}"), set("sc.frequency", "{{ctx.cur.frequency}}"), set("sc.start", "{{ctx.cur.nextRunOn}}"), set("sc.endMode", "{{ctx.cur.endMode}}"), set("sc.endDate", "{{ctx.cur.endsOn}}"), set("sc.endCount", "{{ctx.cur.endCount}}"),
        go("editCard"),
      ],
      blocks: [],
    },
    {
      id: "editCard", title: "Change payment",
      blocks: [
        STEPPER,
        text("Change payment", "title"),
        { type: "reviewSummary", rows: [{ label: "Supplier", value: "{{ctx.cur.supplierName}}" }, { label: "Reference", value: "{{ctx.cur.reference}}" }, { label: "Amount", value: "{{ctx.cur.amountText}}" }, { label: "How often", value: "{{ctx.cur.how}}" }, { label: "Next payment", value: "{{ctx.cur.nextText}}" }, { label: "Ends", value: "{{ctx.cur.ends}}" }] },
        { type: "statusChip", status: "{{ctx.cur.statusKey}}", label: "{{ctx.cur.badge}}", tone: "warning", visibleWhen: "ctx.cur.statusKey == 'awaiting'" },
        { type: "statusChip", status: "{{ctx.cur.statusKey}}", label: "{{ctx.cur.badge}}", tone: "positive", visibleWhen: "ctx.cur.statusKey == 'active'" },
        text("A change goes back to the approvers, and earlier approvals are cleared.", "caption"),
        button("Continue", [set("ctx.error", null), go("amount")]),
        button("Close", [{ type: "exit" }], "ghost"),
      ],
    },
    // ---- cancel
    {
      id: "cancelLoad", title: "Cancel this payment?", kind: "branch",
      onEnter: [{ type: "callApi", integration: "get", input: { scheduleId: "{{sc.id}}", strictCutoff: "{{opt.strictCutoff == true}}" }, saveAs: "ctx.cur", onError: toRoute }, go("cancelCard")],
      blocks: [],
    },
    {
      id: "cancelCard", title: "Cancel this payment?",
      blocks: [
        text("Cancel this payment?", "title"),
        { type: "reviewSummary", rows: [{ label: "Supplier", value: "{{ctx.cur.supplierName}}" }, { label: "Reference", value: "{{ctx.cur.reference}}" }, { label: "Amount", value: "{{ctx.cur.amountText}}" }, { label: "How often", value: "{{ctx.cur.how}}" }, { label: "Next payment", value: "{{ctx.cur.nextText}}" }] },
        text("No more payments will go out. No code is needed.", "caption"),
        button("Cancel payment", [set("ctx.error", null), { type: "callApi", integration: "cancel", input: { scheduleId: "{{sc.id}}", strictCutoff: "{{opt.strictCutoff == true}}" }, saveAs: "sc.res", onError: toRoute }, go("cancelled")]),
        button("Close", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "cancelled", title: "Payment cancelled", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Payment cancelled", text: "No more payments will go to {{sc.res.supplierName}}." },
        { type: "statusChip", status: "cancelled", label: "Cancelled", tone: "positive" },
        { type: "reviewSummary", rows: [{ label: "Supplier", value: "{{sc.res.supplierName}}" }, { label: "Amount", value: "{{sc.res.amountText}}" }, { label: "How often", value: "{{sc.res.how}}" }, { label: "Cancelled on", value: "{{sc.res.cancelledOn}}" }] },
        button("Back to scheduled", [{ type: "navigate", toJourney: "business-schedules" }]),
        button("Schedule a payment", [...FRESH, go("start")], "secondary"),
      ],
    },
    {
      id: "refused", title: "Schedule a supplier payment", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "This payment can’t be changed", text: "{{ctx.error.message}}" },
        button("Back", [{ type: "exit" }]),
      ],
    },
    lockedScreen("payment", "Nothing was scheduled."),
    ...scheduleFailures(),
  ] as Screen[],
};

function scheduleFailures(): Screen[] {
  const base = failScreens({
    title: "Schedule a supplier payment", effects: ["create", "update", "cancel"],
    timeoutText: "We didn’t get an answer in time. Check Scheduled payments before you try again, so you don’t schedule it twice.",
    retry: [["check", "when"], ["otpSend", "review"], ["create", "review"], ["update", "review"]],
    routes: [
      [is(...REFUSED), "refused"], [is(...AMOUNT_CODES), "amount"], [is(...DATE_CODES), "when"], [is("SUPPLIER_NOT_APPROVED"), "supplier"], [is("SCHEDULE_LIMIT"), "review"],
    ],
    unavailable: "Nothing was sent and you haven’t been charged. Try again in a moment.",
  });
  return base.filter((s) => s.id !== "denied").map((s) => (s.id === "failed" ? {
    ...s, blocks: [
      { type: "result", tone: "error", title: "We couldn’t confirm this payment.", text: "Nothing was scheduled. Start again.", visibleWhen: "ctx.error.code == 'OTP_REQUIRED' || ctx.error.code == 'OTP_INVALID' || ctx.error.code == 'STEP_UP_FAILED'" },
      { type: "result", tone: "error", title: "Something went wrong.", text: "Nothing was scheduled.", visibleWhen: "ctx.error.code != 'OTP_REQUIRED' && ctx.error.code != 'OTP_INVALID' && ctx.error.code != 'STEP_UP_FAILED'" },
      button("Start again", [go("start")]), button("Close", [{ type: "exit" }], "secondary"),
    ],
  } as Screen : s)).concat([denyScreen("Schedule a supplier payment", "schedule payments")]);
}
