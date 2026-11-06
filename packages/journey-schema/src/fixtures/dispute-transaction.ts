import type { Journey, Screen } from "../schema";
import { disputeTransactionAcceptance, disputeTransactionScenarios } from "./dispute-transaction-tests";
import { alert, answerScreens, button, denied, go, lacks, route, set, text } from "./cards-kit";

const err = (e: string) => `ds.err == '${e}'`;
const choice = (id: string, label: string, t?: string) => ({ id, label, ...(t ? { text: t } : {}) });
const R = { none: "I don’t recognise it", twice: "Charged twice", amount: "Wrong amount", goods: "Goods or service not received", cancelled: "Cancelled but charged", other: "Other" };
const when = (reason: string) => `ds.reason == '${reason}'`;
/** The block switch is offered for a payment not recognised, when the bank offers it and the card is still active. */
const BLOCK_OFFER = `ds.reason == '${R.none}' && opt.offerBlock != false && ctx.tx.cardActive`;
/** What the bank is asked, for the report: the details its reason asks for, beside the reason (the engine fills each answer in, not an object of them). */
const details = {
  cardInPossession: "{{ds.possess == 'Yes' ? 'yes' : 'no'}}", otherChargeDate: "{{ds.otherDate}}", expectedAmount: "{{ds.expected}}", ordered: "{{ds.ordered}}", arrivedBy: "{{ds.arrivedBy}}",
  contacted: "{{ds.contacted == 'Yes' ? 'yes' : 'no'}}", cancelledOn: "{{ds.cancelledOn}}", cancellationRef: "{{ds.cancelRef}}", text: "{{ds.text}}",
};

/**
 * Report a problem with a payment (BankWorkx, Personal: Cards). Reports a card payment the person does not recognise or that went wrong: which payment (skipped when one
 * is passed in), what went wrong, the details that reason asks for, an optional receipt or screenshot, and a declaration. It moves no money and asks for no code: the bank
 * decides after review, and blocking the card from the report only restricts it. Only a posted payment out, made by card, at most 120 days old and not reported before can be
 * reported; the bank applies these rules itself and its own words are the notices.
 *
 * Built from the spec of the prototype with the blocks FinX has: the payment is found among the person's card payments (not the account activity), the switch to block the card
 * sits on the last screen, where it shows what answering "No" turned on (the engine has no live redraw), and the file is kept as a name and a size.
 */
export const disputeTransaction: Journey = {
  id: "jrn_bankworkx_dispute_transaction",
  slug: "dispute-transaction",
  name: "Report a problem with a payment",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: disputeTransactionAcceptance,
  scenarios: disputeTransactionScenarios,
  dataModel: {
    "launch.cardId": { type: "string" },
    "launch.transactionId": { type: "string" },
    "opt.offerBlock": { type: "boolean" },
    "opt.allowEvidence": { type: "boolean" },
    "ds.txId": { type: "string", required: true },
    "ds.cardId": { type: "string" },
    "ds.reason": { type: "string", required: true },
    "ds.possess": { type: "string", required: true },
    "ds.block": { type: "boolean" },
    "ds.otherDate": { type: "string", required: true },
    "ds.expected": { type: "money", currency: "USD", required: true },
    "ds.same": { type: "boolean" },
    "ds.go": { type: "boolean" },
    "ds.ordered": { type: "string", required: true },
    "ds.arrivedBy": { type: "string", required: true },
    "ds.contacted": { type: "string", required: true },
    "ds.cancelledOn": { type: "string", required: true },
    "ds.cancelRef": { type: "string" },
    "ds.text": { type: "string", required: true },
    "ds.file": { type: "string" },
    "ds.consent": { type: "boolean", required: true },
    "ds.err": { type: "string" },
    "ds.msg": { type: "string" },
  },
  integrations: [
    { id: "reasons", adapter: "bank.disputes.reasons", mode: "sandbox" },
    { id: "payments", adapter: "bank.cards.transactions", mode: "sandbox" },
    { id: "checkTx", adapter: "bank.disputes.check", mode: "sandbox" },
    { id: "create", adapter: "bank.disputes.create", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Report a problem", kind: "branch",
      onEnter: [
        set("ds.err", ""), set("ds.msg", ""), set("ds.block", false), set("ds.same", false), set("ds.go", false), set("ds.consent", false), set("ds.file", null), set("ctx.error", null),
        set("ds.txId", "{{launch.transactionId}}"), set("ds.cardId", "{{launch.cardId}}"),
        { type: "callApi", integration: "reasons", saveAs: "ctx.reasons", onError: { navigate: "fail" } },
        go("pick"),
      ],
      // opened with the card and the payment (the Report a problem button of a card payment): the payment is checked at once
      navigation: route([lacks("cards.dispute"), "denied"], ["!isEmpty(launch.transactionId) && !isEmpty(launch.cardId)", "check"]),
      blocks: [],
    },
    {
      id: "pick", title: "Which payment?",
      onEnter: [{ type: "callApi", integration: "payments", input: { status: "posted", limit: 12 }, saveAs: "ctx.txs", onError: { navigate: "fail" } }],
      blocks: [
        text("Which payment?", "title"),
        alert("error", "{{ds.msg}}", err("notice")),
        text("You have no card payments to report.", "body", "ctx.txs.total == 0"),
        { type: "select", bind: "ds.txId", label: "Payment", source: "ctx.txs.choices", variant: "rows", visibleWhen: "ctx.txs.total > 0" },
        button("Continue", [{ type: "validate" }, set("ds.err", ""), set("ds.cardId", "{{ctx.txs.choices[ds.txId].cardId}}"), go("check")], "primary", "ctx.txs.total > 0"),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      // the payment, asked of the bank with the checks the report will make: its words are the notice when it cannot be reported
      id: "check", title: "Report a problem", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "checkTx", input: { cardId: "{{ds.cardId}}", transactionId: "{{ds.txId}}" }, saveAs: "ctx.tx", onError: { navigate: "fail" } },
        go("reason"),
      ],
      blocks: [],
    },
    {
      id: "reason", title: "What went wrong?",
      blocks: [
        text("What went wrong?", "title"),
        text("{{ctx.tx.merchant}}", "body"),
        text("{{ctx.tx.date}} · {{ctx.tx.amountText}}", "caption"),
        {
          type: "select", bind: "ds.reason", label: "Reason", variant: "tiles",
          choices: [choice(R.none, R.none), choice(R.twice, R.twice), choice(R.amount, R.amount), choice(R.goods, R.goods), choice(R.cancelled, R.cancelled), choice(R.other, R.other)],
        },
        button("Continue", [{ type: "validate" }, set("ds.err", ""), set("ds.same", false), go("details")]),
        button("Back", [go("pick")], "ghost"),
      ],
    },
    {
      id: "details", title: "Tell us more",
      blocks: [
        text("Tell us more", "title"),
        alert("error", "{{ds.msg}}", err("details")),
        { type: "select", bind: "ds.possess", label: "Do you still have your card?", options: ["Yes", "No"], visibleWhen: when(R.none) },
        { type: "select", bind: "ds.otherDate", label: "When was the other charge?", source: "ctx.reasons.days30", variant: "dropdown", visibleWhen: when(R.twice) },
        { type: "amountInput", bind: "ds.expected", currency: "USD", label: "Amount you expected", visibleWhen: when(R.amount) },
        alert("error", "This is the amount that was charged.", `${when(R.amount)} && ds.same`),
        { type: "textInput", bind: "ds.ordered", label: "What did you order?", placeholder: "For example, a pair of shoes", pattern: "^.{3,80}$", patternMessage: "Tell us what you ordered.", visibleWhen: when(R.goods) },
        { type: "select", bind: "ds.arrivedBy", label: "When should it have arrived?", source: "ctx.reasons.days60", variant: "dropdown", visibleWhen: when(R.goods) },
        { type: "select", bind: "ds.contacted", label: "Have you contacted the merchant?", options: ["Yes", "Not yet"], visibleWhen: when(R.goods) },
        alert("info", "If you can, contact the merchant first. You can still send this report.", `${when(R.goods)} && ds.contacted == 'Not yet'`),
        { type: "select", bind: "ds.cancelledOn", label: "When did you cancel?", source: "ctx.reasons.days90", variant: "dropdown", visibleWhen: when(R.cancelled) },
        { type: "textInput", bind: "ds.cancelRef", label: "Cancellation reference (optional)", pattern: "^.{0,30}$", patternMessage: "Use up to 30 characters.", visibleWhen: when(R.cancelled) },
        { type: "textInput", bind: "ds.text", label: "What happened?", lines: 4, pattern: "^[\\s\\S]{10,300}$", patternMessage: "Tell us a little more (at least 10 characters).", visibleWhen: when(R.other) },
        button("Continue", [
          { type: "validate" }, set("ds.err", ""),
          // the amount you expected cannot be the amount charged; "No" to "Do you still have your card?" turns the block on (when the bank offers it)
          set("ds.same", `{{${"ds.reason == 'Wrong amount' ? ds.expected == abs(ctx.tx.amount) : false"}}}`),
          set("ds.block", "{{ds.reason == 'I don’t recognise it' ? (ds.possess == 'No' ? opt.offerBlock != false && ctx.tx.cardActive : false) : false}}"),
          set("ds.go", true), { type: "navigate" },
        ]),
        // Back is not Continue: the rules below apply only after Continue (they would take it onward too)
        button("Back", [set("ds.go", false), go("reason")], "ghost"),
      ],
      navigation: route(["ds.go && ds.same", "details"], ["ds.go && opt.allowEvidence != false", "evidence"], ["ds.go && opt.allowEvidence == false", "declare"]),
    },
    {
      id: "evidence", title: "Add evidence",
      blocks: [
        text("Add evidence", "title"),
        text("Optional. A receipt, order email or screenshot helps.", "body"),
        { type: "fileUpload", bind: "ds.file", label: "Add a file", accept: ["pdf", "image"], helper: "A PDF, JPG or PNG." },
        button("Continue", [{ type: "validate" }, go("declare")]),
        button("Back", [go("details")], "ghost"),
      ],
    },
    {
      id: "declare", title: "Confirm and send",
      blocks: [
        text("Confirm and send", "title"),
        {
          type: "reviewSummary",
          rows: [
            { label: "Payment", value: "{{ctx.tx.merchant}}" }, { label: "Amount", value: "{{ctx.tx.amountText}}" }, { label: "Reason", value: "{{ds.reason}}" },
            { label: "Evidence", value: "{{isEmpty(ds.file) ? 'None' : ds.file.name}}" },
          ],
        },
        { type: "toggle", bind: "ds.block", label: "Block this card", helper: "Recommended if someone else may have your details", visibleWhen: BLOCK_OFFER },
        { type: "reviewSummary", rows: [{ label: "Card", value: "Will be blocked" }], visibleWhen: `ds.block && ${BLOCK_OFFER}` },
        {
          type: "consent", bind: "ds.consent", termsVersion: "dispute-v1", text: "I confirm what I’ve told you is true and complete.",
          validation: { mustBeTrue: true, messages: { mustBeTrue: "Please confirm to continue." } },
        },
        button("Send report", [
          { type: "validate" },
          {
            type: "callApi", integration: "create", saveAs: "ds.res", onError: { navigate: "fail" },
            input: { cardId: "{{ds.cardId}}", transactionId: "{{ds.txId}}", reason: "{{ds.reason}}", ...details, blockCard: "{{ds.block}}", evidenceName: "{{isEmpty(ds.file) ? '' : ds.file.name}}" },
          },
          go("done"),
        ]),
        button("Back", [go("details")], "ghost"),
      ],
    },
    {
      id: "done", title: "Report received", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Report received", text: "We’ll keep you updated in your messages.", meta: "{{ds.res.statusLabel}}" },
        {
          type: "reviewSummary",
          rows: [{ label: "Case", value: "{{ds.res.disputeId}}" }, { label: "Payment", value: "{{ds.res.merchant}}" }, { label: "Amount", value: "{{ds.res.amountText}}" }, { label: "Reason", value: "{{ds.res.reason}}" }],
        },
        { type: "reviewSummary", rows: [{ label: "Card", value: "Blocked" }], visibleWhen: "ds.res.cardBlocked" },
        { type: "sectionHeader", title: "What happens next" },
        {
          type: "reviewSummary",
          rows: [
            { label: "Within 2 working days", value: "We review your report" }, { label: "Within 10 working days", value: "We ask the merchant" }, { label: "Within 45 days", value: "You get our decision" },
          ],
        },
        button("Back to cards", [{ type: "exit" }]),
      ],
    },
    {
      // where a refusal goes: a payment that cannot be reported says why on the payment step, a detail the bank did not accept on the details, no answer has its own screen
      id: "fail", title: "Report a problem", kind: "branch",
      onEnter: [
        set("ds.msg", "{{ctx.error.message}}"),
        set("ds.err", "{{ctx.error.code == 'DETAILS_INVALID' ? 'details' : ctx.error.code == 'DISPUTE_AMOUNT_INVALID' ? 'details' : ctx.error.code == 'REASON_INVALID' ? 'details' : ctx.error.code == 'TRANSACTION_NOT_FOUND' ? 'notice' : ctx.error.code == 'TRANSACTION_PENDING' ? 'notice' : ctx.error.code == 'NOT_A_PAYMENT_OUT' ? 'notice' : ctx.error.code == 'NOT_A_CARD_PAYMENT' ? 'notice' : ctx.error.code == 'DISPUTE_EXISTS' ? 'notice' : ctx.error.code == 'DISPUTE_WINDOW_CLOSED' ? 'notice' : ctx.error.code == 'CARD_NOT_FOUND' ? 'notice' : ''}}"),
        go("problem"),
      ],
      navigation: route(
        ["ctx.error.code == 'TIMEOUT'", "timeout"],
        ["ctx.error.code == 'SERVICE_UNAVAILABLE'", "unavailable"],
        ["ds.err == 'details'", "details"],
        ["ds.err == 'notice'", "pick"],
      ),
      blocks: [],
    },
    ...answerScreens("start", "sent"),
    {
      id: "problem", title: "Report a problem", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We couldn’t send the report", text: "Something went wrong. Nothing was sent." },
        button("Try again", [go("start")]),
        button("Close", [{ type: "exit" }], "ghost"),
      ],
    },
    denied("Report a problem"),
  ] as Screen[],
};
