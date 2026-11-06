import type { Journey, Screen } from "../schema";
import { businessBulkAcceptance, businessBulkScenarios } from "./business-bulk-tests";
import { alert, button, failScreens, go, is, lacks, lockedScreen, lockOnWrongCode, route, set, text, toRoute } from "./business-kit";

/** The codes of the bank that belong to the first step (the file or the list), the second (the lines), the third (speed and date) and the review. */
const ADD_CODES = ["FILE_TOO_BIG", "FILE_TYPE", "FILE_UNREADABLE", "FILE_EMPTY", "BATCH_TOO_LARGE", "ALREADY_SENT", "FORMAT_NOT_ENABLED", "ADD_INVALID", "EMPTY_BATCH", "ACCOUNT_NOT_FOUND", "ACCOUNT_NOT_PERMITTED"];
const FIX_CODES = ["LINES_NEED_FIXING", "NO_VALID_LINES", "REPAIR_NOT_ALLOWED", "PAYMENT_NOT_FOUND"];
const SPEED_CODES = ["RAIL_LIMIT", "RAIL_NOT_AVAILABLE", "DATE_NOT_WORKING_DAY", "DATE_REQUIRED"];
const MONEY_CODES = ["LIMIT_USER_EXCEEDED", "LIMIT_COMPANY_EXCEEDED", "INSUFFICIENT_FUNDS"];
const STEP = (n: number) => `Step {{bp.resend ? ${Math.max(1, n - 1)} : ${n}}} of {{bp.resend ? 3 : 4}} · Bulk payment`;
const STEPPER = { type: "stepper" as const, steps: ["add", "fix", "speed", "review"] };
const NOW_TEXT = "{{bp.rv.totalText}}";
/** What the bank is asked to check: the account and the lines it handed back last time, so a screen never builds a line itself. */
const LINES = { fromAccountId: "{{bp.from}}", lines: "{{bp.res.raw}}", repairOf: "{{bp.repairOf}}", fileKey: "{{bp.res.fileKey}}" };
const OPTIONS = { allowSameDay: "{{opt.allowSameDay != false}}", allowInstant: "{{opt.allowInstant != false}}" };
const STATUSES = { ready: { label: "Ready", tone: "positive" as const }, fix: { label: "Needs fixing", tone: "negative" as const } };
const clearEdit = [set("bp.e", { name: "", account: "", code: "", amount: "" })];
/** What the person did to the lines (one change at a time): the bank applies it and checks every line again, so every change goes through one call. */
const NO_OP = { editN: "", editName: "", editAccount: "", editCode: "", editAmount: "", useSavedN: "", removeN: "", removeErrors: false };
const op = (o: Partial<typeof NO_OP>) => Object.entries({ ...NO_OP, ...o }).map(([k, v]) => set(`bp.op.${k}`, v));
/** What the person did to the list they are entering: add a payment, or take one out. */
const NO_ENTRY = { add: false, supplier: "", amount: "", reference: "", removeN: "" };
const entry = (o: Partial<typeof NO_ENTRY>) => Object.entries({ ...NO_ENTRY, ...o }).map(([k, v]) => set(`bp.eop.${k}`, v));

/**
 * Bulk payment (BankWorkx Business, Payments). A Maker pays many approved payees from a CSV file (or, when the bank allows, its own bank file) or a short list: every line is
 * checked by the bank (name, amount, account, approved payee, saved account, the person's limit, duplicates), the person fixes or removes what is marked, chooses a speed and a
 * date, reviews, and sends the batch for approval as ONE payment with a one-time code that is always asked. Nothing leaves the account until the approvers release it. Opened with
 * `launch.repairOf` (a batch, from Batch status > Fix and resend, or from the old repair-bulk-lines) it starts at the lines the bank returned, with the bank's own sentence on each
 * until it is edited, and the lines sent again are marked Resent on the original.
 *
 * Replaces, for BankWorkx, the Meezan journey of the same name. Built from the spec with the blocks FinX has (docs/BANKWORKX.md): a table row opens an edit card, the sample-file
 * download is a line of text (the engine has no file download), and the engine's own words are used for a file that is the wrong kind or too big.
 */
export const businessBulk: Journey = {
  id: "jrn_bulk_payment_business",
  slug: "bulk-payment",
  name: "Bulk payment",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: businessBulkAcceptance,
  scenarios: businessBulkScenarios,
  dataModel: {
    "launch.repairOf": { type: "string" }, "opt.allowEnter": { type: "boolean" }, "opt.bankFormats": { type: "boolean" }, "opt.allowSameDay": { type: "boolean" }, "opt.allowInstant": { type: "boolean" },
    "bp.how": { type: "string" }, "bp.from": { type: "string", required: true }, "bp.format": { type: "string" }, "bp.file": { type: "object" },
    "bp.payee": { type: "string" }, "bp.amt": { type: "string", pattern: "^[0-9]{0,12}(\\.[0-9]{0,3})?$" }, "bp.ref": { type: "string", pattern: "^.{0,35}$" },
    "bp.list": { type: "object" }, "bp.res": { type: "object" }, "bp.repairOf": { type: "string" }, "bp.resend": { type: "boolean" }, "bp.tried": { type: "boolean" }, "bp.noFile": { type: "boolean" },
    "bp.cur": { type: "number" }, "bp.e": { type: "object" }, "bp.e.name": { type: "string" }, "bp.e.account": { type: "string" }, "bp.e.code": { type: "string" }, "bp.e.amount": { type: "string" }, "bp.speed": { type: "string", required: true }, "bp.when": { type: "string" }, "bp.date": { type: "string" },
    "bp.op": { type: "object" }, "bp.op.editN": { type: "string" }, "bp.op.editName": { type: "string" }, "bp.op.editAccount": { type: "string" }, "bp.op.editCode": { type: "string" }, "bp.op.editAmount": { type: "string" }, "bp.op.useSavedN": { type: "string" }, "bp.op.removeN": { type: "string" }, "bp.op.removeErrors": { type: "boolean" },
    "bp.eop": { type: "object" }, "bp.eop.add": { type: "boolean" }, "bp.eop.supplier": { type: "string" }, "bp.eop.amount": { type: "string" }, "bp.eop.reference": { type: "string" }, "bp.eop.removeN": { type: "string" },
    "bp.name": { type: "string", pattern: "^.{0,35}$" }, "bp.consent": { type: "boolean", required: true }, "bp.rv": { type: "object" }, "bp.done": { type: "object" },
    "otp.code": { type: "string", pattern: "^[0-9]{6}$" },
  },
  integrations: [
    { id: "company", adapter: "corp.company.get", mode: "sandbox" },
    { id: "accts", adapter: "corp.accounts.list", mode: "sandbox" },
    { id: "suppliers", adapter: "corp.suppliers.list", mode: "sandbox" },
    { id: "check", adapter: "corp.bulk.check", mode: "sandbox" },
    { id: "enter", adapter: "corp.bulk.check", mode: "sandbox" },
    { id: "repair", adapter: "corp.bulk.check", mode: "sandbox" },
    { id: "edit", adapter: "corp.bulk.check", mode: "sandbox" },
    { id: "gate", adapter: "corp.bulk.check", mode: "sandbox" },
    { id: "quote", adapter: "corp.bulk.quote", mode: "sandbox" },
    { id: "speedQuote", adapter: "corp.bulk.quote", mode: "sandbox" },
    { id: "review", adapter: "corp.bulk.quote", mode: "sandbox" },
    { id: "otpSend", adapter: "bank.otp.send", mode: "sandbox" },
    { id: "otpVerify", adapter: "bank.otp.verify", mode: "sandbox" },
    { id: "submit", adapter: "corp.bulk.submit", mode: "sandbox" },
  ],
  screens: [
    {
      // the company's accounts to pay from and its approved payees, and a clean form. Opened with a batch to resend (launch.repairOf) it goes straight to the lines the bank returned.
      id: "start", title: "Bulk payment", kind: "branch",
      onEnter: [
        set("ctx.error", null), set("bp.how", "upload"), set("bp.format", "csv"), set("bp.file", null), set("bp.payee", ""), set("bp.amt", ""), set("bp.ref", ""),
        set("bp.list", { raw: [], lines: {}, count: 0 }), set("bp.res", { raw: [], lines: {}, count: 0, valid: 0, invalid: 0, canContinue: false, blocker: "Add at least one payment.", resend: false }),
        set("bp.repairOf", "{{isEmpty(launch.repairOf) ? '' : launch.repairOf}}"), set("launch.repairOf", ""), set("bp.resend", false), set("bp.tried", false), set("bp.noFile", false), set("bp.cur", 0), ...clearEdit,
        set("bp.speed", ""), set("bp.when", "today"), set("bp.date", ""), set("bp.name", ""), set("bp.consent", false), set("otp.code", ""),
        { type: "callApi", integration: "company", saveAs: "ctx.company", onError: toRoute },
        { type: "callApi", integration: "accts", input: { for: "pay" }, saveAs: "ctx.accts", onError: toRoute },
        { type: "callApi", integration: "suppliers", saveAs: "ctx.suppliers", onError: toRoute },
        set("bp.from", "{{ctx.company.defaultAccountId}}"),
        go("add"),
      ],
      navigation: route([lacks("biz.payments.bulk"), "denied"], ["!isEmpty(bp.repairOf)", "repairLoad"]),
      blocks: [],
    },
    {
      // a batch to resend: the lines the bank returned, each with the bank's own sentence until it is edited
      id: "repairLoad", title: "Bulk payment", kind: "branch",
      onEnter: [
        set("bp.resend", true),
        set("bp.res", { raw: [], lines: {}, count: 0, valid: 0, invalid: 0, canContinue: false, blocker: "There is nothing to resend.", resend: true }),
        { type: "callApi", integration: "repair", input: { fromAccountId: "{{bp.from}}", repairOf: "{{bp.repairOf}}" }, saveAs: "bp.res", onError: toRoute },
        set("bp.name", "{{bp.res.batchName}}"),
        go("fix"),
      ],
      blocks: [],
    },
    {
      id: "add", title: "Add payments",
      blocks: [
        STEPPER,
        text(STEP(1), "caption"),
        text("Add payments", "title"),
        text("Upload a file or enter the payments.", "body"),
        { type: "select", bind: "bp.how", label: "How", variant: "chips", choices: [{ id: "upload", label: "Upload a file" }, { id: "enter", label: "Enter payments" }], visibleWhen: "opt.allowEnter != false" },
        { type: "select", bind: "bp.from", label: "Pay from", variant: "dropdown", source: "ctx.accts" },
        alert("error", "{{ctx.error.message}}", is(...ADD_CODES)),
        { type: "select", bind: "bp.format", label: "Format", variant: "chips", choices: [{ id: "csv", label: "Template (CSV)" }, { id: "bank", label: "Bank file" }], visibleWhen: "opt.bankFormats == true && bp.how == 'upload'" },
        // one field when the bank offers only the template, one that names the bank file too when it offers both
        { type: "fileUpload", bind: "bp.file", label: "File", accept: ["csv"], maxKb: 256, helper: "Choose a file (up to 256 KB)", visibleWhen: "bp.how == 'upload' && opt.bankFormats != true" },
        { type: "fileUpload", bind: "bp.file", label: "File", accept: ["csv", "xml"], maxKb: 256, helper: "Choose a file (up to 256 KB)", visibleWhen: "bp.how == 'upload' && opt.bankFormats == true" },
        alert("error", "Choose a file first.", "bp.noFile && isEmpty(bp.file)"),
        text("Columns: Payee name, Account number or IBAN, Bank code, Amount, Reference. For example: Harbour Packaging, 5520018841, 021000021, 1200.00, INV-1001. Nothing in a file is run; it is only read.", "caption", "bp.how == 'upload'"),
        { type: "select", bind: "bp.payee", label: "Payee", variant: "dropdown", source: "ctx.suppliers", visibleWhen: "bp.how == 'enter'" },
        { type: "textInput", bind: "bp.amt", label: "Amount", placeholder: "0.00", keyboard: "number", pattern: "^[0-9]{0,12}(\\.[0-9]{0,3})?$", patternMessage: "Enter an amount above zero.", visibleWhen: "bp.how == 'enter'" },
        { type: "textInput", bind: "bp.ref", label: "Reference", placeholder: "INV-1001", pattern: "^.{0,35}$", patternMessage: "Use up to 35 characters.", visibleWhen: "bp.how == 'enter'" },
        button("Add payment", [
          { type: "validate" }, set("ctx.error", null),
          ...entry({ add: true, supplier: "{{bp.payee}}", amount: "{{bp.amt}}", reference: "{{bp.ref}}" }),
          go("enterApply"),
        ], "secondary", "bp.how == 'enter'"),
        { type: "sectionHeader", title: "{{bp.list.count}} added", visibleWhen: "bp.how == 'enter' && bp.list.count > 0" },
        {
          type: "menu", source: "bp.list.lines", visibleWhen: "bp.how == 'enter' && bp.list.count > 0",
          item: {
            label: "{{item.name}} · {{item.amountText}}", text: "{{item.reference}} · tap to remove",
            actions: [set("ctx.error", null), ...entry({ removeN: "{{item.n}}" }), go("enterApply")],
          },
        },
        // continuing with a file: the bank reads it and checks every line
        button("Continue", [
          { type: "validate" }, set("ctx.error", null), set("bp.tried", false),
          { type: "callApi", integration: "check", input: { fromAccountId: "{{bp.from}}", file: "{{bp.file.content}}", kind: "{{bp.file.kind}}", size: "{{bp.file.size}}", format: "{{bp.format}}", bankFormats: "{{opt.bankFormats == true}}" }, saveAs: "bp.res", onError: toRoute },
          go("fix"),
        ], "primary", "bp.how == 'upload' && !isEmpty(bp.file)"),
        button("Continue", [set("bp.noFile", true)], "primary", "bp.how == 'upload' && isEmpty(bp.file)"),
        // continuing with the list: the bank checks the lines that were added
        button("Continue", [
          set("ctx.error", null), set("bp.tried", false),
          { type: "callApi", integration: "check", input: { fromAccountId: "{{bp.from}}", lines: "{{bp.list.raw}}", begin: true }, saveAs: "bp.res", onError: toRoute },
          go("fix"),
        ], "primary", "bp.how == 'enter'"),
        button("Cancel", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      // adds a payment to the list being entered, or takes one out: the bank applies it and gives the list back
      id: "enterApply", title: "Add payments", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "enter", input: { fromAccountId: "{{bp.from}}", lines: "{{bp.list.raw}}", add: "{{bp.eop.add}}", addSupplierId: "{{bp.eop.supplier}}", addAmount: "{{bp.eop.amount}}", addReference: "{{bp.eop.reference}}", removeN: "{{bp.eop.removeN}}" }, saveAs: "bp.list", onError: toRoute },
        set("bp.payee", ""), set("bp.amt", ""), set("bp.ref", ""),
        go("add"),
      ],
      blocks: [],
    },
    {
      id: "fix", title: "Check payments",
      blocks: [
        STEPPER,
        text(STEP(2), "caption"),
        text("Check payments", "title"),
        text("Fix or remove anything marked, then continue.", "body"),
        alert("error", "{{bp.res.blocker}}", "bp.tried && !bp.res.canContinue && !(ctx.error.code == 'REPAIR_NOT_ALLOWED')"),
        alert("error", "{{ctx.error.message}}", is(...FIX_CODES)),
        {
          type: "reviewSummary", visibleWhen: "bp.res.count > 0",
          rows: [{ label: "Valid", value: "{{bp.res.valid}}" }, { label: "Need fixing", value: "{{bp.res.invalid}}" }, { label: "{{bp.res.mixed ? 'Total in USD, about' : 'Total'}}", value: "{{bp.res.totalText}}" }],
        },
        button("Fix lines", [set("bp.cur", "{{bp.res.firstFix}}"), go("editOpen")], "secondary", "bp.res.invalid > 0"),
        button("Remove all errors", [set("ctx.error", null), ...op({ removeErrors: true }), go("apply")], "secondary", "bp.res.invalid > 0"),
        text("No payments", "title", "bp.res.count == 0 && !bp.resend"),
        text("Go back to add some.", "body", "bp.res.count == 0 && !bp.resend"),
        text("Nothing to resend", "title", "bp.res.count == 0 && bp.resend"),
        text("All payments in this batch went through.", "body", "bp.res.count == 0 && bp.resend"),
        {
          type: "dataTable", source: "bp.res.lines", label: "Payments", visibleWhen: "bp.res.count > 0",
          columns: [{ key: "name", label: "Payee" }, { key: "accountText", label: "Account" }, { key: "amountText", label: "Amount" }, { key: "status", label: "Status", type: "status", statuses: STATUSES }, { key: "message", label: "Details" }],
          onRowPress: [set("bp.cur", "{{item.n}}"), go("editOpen")],
        },
        button("Continue", [
          set("ctx.error", null), set("bp.tried", true),
          go("gate"),
        ]),
        button("Back", [go("add")], "ghost", "!bp.resend"),
        button("Cancel", [{ type: "exit" }], "ghost", "bp.resend"),
      ],
    },
    {
      // checks the lines once more, and only a list with nothing marked goes on to the speeds
      id: "gate", title: "Check payments", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "gate", input: LINES, saveAs: "bp.res", onError: toRoute },
        go("speeds"),
      ],
      navigation: route(["!bp.res.canContinue", "fix"]),
      blocks: [],
    },
    {
      // the speeds the bank offers for these lines, with a fee and a reason for one that is not usable
      id: "speeds", title: "Speed and date", kind: "branch",
      onEnter: [
        set("bp.when", "today"), set("bp.date", ""),
        { type: "callApi", integration: "quote", input: { fromAccountId: "{{bp.from}}", lines: "{{bp.res.raw}}", ...OPTIONS }, saveAs: "ctx.bq", onError: toRoute },
        set("bp.speed", "{{ctx.bq.firstUsable}}"),
        go("speed"),
      ],
      blocks: [],
    },
    {
      // a change to the lines (an edit, the saved details, a removal): the bank applies it and checks every line again
      id: "apply", title: "Check payments", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "edit", input: { ...LINES, editN: "{{bp.op.editN}}", editName: "{{bp.op.editName}}", editAccount: "{{bp.op.editAccount}}", editCode: "{{bp.op.editCode}}", editAmount: "{{bp.op.editAmount}}", useSavedN: "{{bp.op.useSavedN}}", removeN: "{{bp.op.removeN}}", removeErrors: "{{bp.op.removeErrors}}" }, saveAs: "bp.res", onError: toRoute },
        go("fix"),
      ],
      blocks: [],
    },
    {
      id: "editOpen", title: "Payment", kind: "branch",
      onEnter: [
        set("ctx.error", null),
        set("bp.e.name", "{{bp.res.lines[bp.cur].name}}"), set("bp.e.account", "{{bp.res.lines[bp.cur].account}}"), set("bp.e.code", "{{bp.res.lines[bp.cur].code}}"), set("bp.e.amount", "{{bp.res.lines[bp.cur].amountRaw}}"),
        go("edit"),
      ],
      blocks: [],
    },
    {
      id: "edit", title: "Payment",
      blocks: [
        text("Payment {{bp.cur}}", "title"),
        alert("error", "{{bp.res.lines[bp.cur].message}}", "bp.res.lines[bp.cur].status == 'fix'"),
        { type: "textInput", bind: "bp.e.name", label: "Payee name" },
        { type: "textInput", bind: "bp.e.account", label: "Account number or IBAN" },
        { type: "textInput", bind: "bp.e.code", label: "{{bp.res.lines[bp.cur].codeLabel}}", visibleWhen: "bp.res.lines[bp.cur].showCode" },
        { type: "textInput", bind: "bp.e.amount", label: "Amount", keyboard: "number" },
        button("Done", [set("ctx.error", null), ...op({ editN: "{{bp.cur}}", editName: "{{bp.e.name}}", editAccount: "{{bp.e.account}}", editCode: "{{bp.e.code}}", editAmount: "{{bp.e.amount}}" }), go("apply")]),
        button("Use saved details", [set("ctx.error", null), ...op({ useSavedN: "{{bp.cur}}" }), go("apply")], "secondary", "bp.res.lines[bp.cur].canUseSaved"),
        button("Remove", [set("ctx.error", null), ...op({ removeN: "{{bp.cur}}" }), go("apply")], "secondary"),
        button("Back", [go("fix")], "ghost"),
      ],
    },
    {
      id: "speed", title: "Speed and date",
      blocks: [
        STEPPER,
        text(STEP(3), "caption"),
        text("Speed and date", "title"),
        alert("error", "{{ctx.error.message}}", is(...SPEED_CODES)),
        { type: "select", bind: "bp.speed", label: "Speed", variant: "rows", source: "ctx.bq.speeds" },
        text("A speed is marked when a payment is too large for it. Some payments are too large for that speed.", "caption", "ctx.bq.firstUsable != 'standard'"),
        { type: "select", bind: "bp.when", label: "Send", variant: "chips", choices: [{ id: "today", label: "Today" }, { id: "later", label: "Later" }], visibleWhen: "bp.speed != 'instant'" },
        { type: "select", bind: "bp.date", label: "Date", variant: "dropdown", source: "ctx.bq.dates", visibleWhen: "bp.speed != 'instant' && bp.when == 'later'" },
        button("Continue", [
          { type: "validate" }, set("ctx.error", null), set("bp.consent", false),
          { type: "callApi", integration: "speedQuote", input: { fromAccountId: "{{bp.from}}", lines: "{{bp.res.raw}}", speed: "{{bp.speed}}", sendOn: "{{bp.speed != 'instant' && bp.when == 'later' ? bp.date : 'today'}}", ...OPTIONS }, saveAs: "bp.rv", onError: toRoute },
          go("review"),
        ]),
        button("Back", [go("fix")], "ghost"),
      ],
    },
    {
      id: "review", title: "Review",
      blocks: [
        STEPPER,
        text(STEP(4), "caption"),
        text("Review", "title"),
        alert("error", "{{ctx.error.message}}", `${is(...MONEY_CODES)} || ${is("NAME_TOO_LONG")}`),
        {
          type: "reviewSummary",
          rows: [
            { label: "{{bp.rv.mixed ? 'Total in USD, about' : 'Total'}}", value: NOW_TEXT },
            { label: "Payments", value: "{{bp.res.count}}" },
            { label: "Pay from", value: "{{bp.rv.accountName}}" },
          ],
        },
        { type: "reviewSummary", visibleWhen: "bp.rv.mixed", rows: [{ label: "Amounts", value: "{{bp.rv.amountsText}}" }] },
        {
          type: "reviewSummary",
          rows: [
            { label: "Speed", value: "{{bp.rv.speedName}}" },
            { label: "Send", value: "{{bp.rv.sendText}}" },
            { label: "Fees", value: "{{bp.rv.feeText}}" },
            { label: "You pay", value: "{{bp.rv.youPayText}}" },
            { label: "Approvals needed", value: "{{bp.rv.requiredApprovers}}" },
          ],
        },
        { type: "textInput", bind: "bp.name", label: "Batch name (optional)", placeholder: "Suppliers November", pattern: "^.{0,35}$", patternMessage: "Use up to 35 characters." },
        alert("info", "Nothing leaves the account until the approvers release the payment.", undefined),
        { type: "consent", bind: "bp.consent", termsVersion: "bulk-payment-v1", text: "I confirm the payments are correct", validation: { mustBeTrue: true, messages: { mustBeTrue: "Tick the confirmation first" } } },
        button("Submit for approval", [
          { type: "validate" }, set("ctx.error", null), set("otp.code", ""),
          // the limits and the money are checked before the code is asked
          { type: "callApi", integration: "review", input: { fromAccountId: "{{bp.from}}", lines: "{{bp.res.raw}}", speed: "{{bp.speed}}", sendOn: "{{bp.speed != 'instant' && bp.when == 'later' ? bp.date : 'today'}}", review: true, ...OPTIONS }, saveAs: "bp.rv", onError: toRoute },
          { type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: toRoute },
          go("otp"),
        ]),
        button("Back", [go("speed")], "ghost"),
      ],
    },
    {
      id: "otp", title: "Enter your code",
      blocks: [
        text("Authorise {{bp.rv.totalText}} in {{bp.res.count}} payments", "title"),
        text("Code sent to {{ctx.otp.maskedPhone}}.", "caption"),
        text("This amount needs an extra code.", "caption", "bp.rv.codeExtra"),
        {
          type: "otp", bind: "otp.code", length: 6, maxAttempts: 3, resendAfterSeconds: 30, keypad: true,
          onResend: [{ type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: toRoute }],
        },
        button("Submit for approval", [
          { type: "validate" },
          { type: "callApi", integration: "otpVerify", input: { code: "{{otp.code}}" }, onError: lockOnWrongCode },
          { type: "callApi", integration: "submit", input: { ...LINES, speed: "{{bp.speed}}", sendOn: "{{bp.speed != 'instant' && bp.when == 'later' ? bp.date : 'today'}}", name: "{{bp.name}}", ...OPTIONS }, saveAs: "bp.done", onError: toRoute },
          go("done"),
        ]),
      ],
    },
    {
      id: "done", title: "Sent for approval", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Sent for approval", text: "{{bp.done.count}} payments, {{bp.done.mixed ? bp.done.amountsText : bp.done.totalText}}. Nothing has left the account yet.", meta: "Payment {{bp.done.id}}" },
        { type: "statusChip", status: "pending_approval", label: "{{bp.done.approvalsText}}" },
        {
          type: "reviewSummary",
          rows: [
            { label: "Batch", value: "{{bp.done.name}}" },
            { label: "Payments", value: "{{bp.done.count}}" },
            { label: "Total", value: "{{bp.done.totalText}}" },
            { label: "You pay", value: "{{bp.done.youPayText}}" },
            { label: "Speed", value: "{{bp.done.speedName}}" },
            { label: "Send", value: "{{bp.done.sendText}}" },
            { label: "Approvals needed", value: "{{bp.done.required}}" },
            { label: "Reference", value: "{{bp.done.reference}}" },
          ],
        },
        button("View batch", [{ type: "navigate", toJourney: "bulk-status", with: { "launch.id": "{{bp.done.id}}" } }]),
        button("Track in Payments", [{ type: "navigate", toJourney: "payment-tracker", with: { "launch.paymentId": "{{bp.done.id}}" } }], "secondary"),
        button("Share receipt", [{ type: "share", template: "receipt" }], "ghost"),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      // why the batch cannot go ahead, and where to fix it
      id: "problem", title: "Check the batch",
      blocks: [
        { type: "result", tone: "error", title: "This is above your payment limit.", text: "Nothing was sent.", visibleWhen: "ctx.error.code == 'LIMIT_USER_EXCEEDED'" },
        { type: "result", tone: "error", title: "This is above the company limit.", text: "Wait for the limit to reset or send less. Nothing was sent.", visibleWhen: "ctx.error.code == 'LIMIT_COMPANY_EXCEEDED'" },
        { type: "result", tone: "error", title: "There isn’t enough money in this account.", text: "Nothing was sent.", visibleWhen: "ctx.error.code == 'INSUFFICIENT_FUNDS'" },
        button("Remove lines", [go("fix")], "primary", "ctx.error.code == 'LIMIT_USER_EXCEEDED'"),
        button("Change account", [go("add")], "primary", "ctx.error.code == 'INSUFFICIENT_FUNDS'"),
        button("Remove lines", [go("fix")], "secondary", "ctx.error.code == 'LIMIT_COMPANY_EXCEEDED'"),
        button("Back to review", [go("review")], "secondary"),
        button("Cancel", [{ type: "exit" }], "ghost"),
      ],
    },
    lockedScreen("batch"),
    ...failures(),
  ] as Screen[],
};

function failures(): Screen[] {
  const base = failScreens({
    title: "Bulk payment", effects: ["submit"], timeoutText: "We didn’t get an answer in time. Check Payments before you try again, so you don’t pay twice.",
    retry: [["check", "add"], ["enter", "add"], ["edit", "fix"], ["gate", "fix"], ["quote", "fix"], ["speedQuote", "speed"], ["review", "review"], ["otpSend", "review"], ["submit", "review"]],
    routes: [
      [is(...ADD_CODES), "add"], [is(...FIX_CODES), "fix"], [is(...SPEED_CODES), "speed"], [is(...MONEY_CODES), "problem"], [is("NAME_TOO_LONG"), "review"],
    ],
    denied: "You can’t pay in bulk at this company",
  });
  return base.filter((s) => s.id !== "denied").concat([deniedScreen()]).map((s) => (s.id === "failed" ? failedScreen(s) : s));
}
function deniedScreen(): Screen { return {
  id: "denied", title: "Bulk payment", kind: "terminal",
  blocks: [
    { type: "result", tone: "error", title: "You can’t pay in bulk at this company", text: "Your role at this company doesn’t include it. The bank checks this on its side too, so hiding the button isn’t the only guard.", visibleWhen: "ctx.error.code != 'WRONG_CONTEXT'" },
    { type: "result", tone: "error", title: "Switch to your business first", text: "{{ctx.error.message}}", visibleWhen: "ctx.error.code == 'WRONG_CONTEXT'" },
    button("Close", [{ type: "exit" }]),
  ],
  }; }
/** The generic failure of the kit says nothing was changed; a batch says nothing was sent. */
function failedScreen(s: Screen): Screen { return {
  ...s,
  blocks: [
    { type: "result", tone: "error", title: "We couldn’t confirm this batch.", text: "Nothing was sent. Start again.", visibleWhen: is("OTP_REQUIRED", "OTP_INVALID", "STEP_UP_FAILED") },
    { type: "result", tone: "error", title: "Something went wrong.", text: "Nothing was sent.", visibleWhen: `!(${is("OTP_REQUIRED", "OTP_INVALID", "STEP_UP_FAILED")})` },
    ...s.blocks.filter((b: any) => b.type === "button"),
  ],
  }; }
