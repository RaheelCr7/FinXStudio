import type { Journey, Screen } from "../schema";
import { paymentTemplateAcceptance, paymentTemplateScenarios } from "./payment-template-tests";
import { alert, button, denyScreen, failScreens, go, is, lacks, PURPOSES, REFERENCE, route, set, text, toRoute } from "./business-kit";

const STEPPER = { type: "stepper" as const, steps: ["supplier", "details", "review"] };
const SUPPLIER = "{{ctx.sup[pt.supplierId].displayName}}";
const FORM = { name: "{{pt.name}}", supplierId: "{{pt.supplierId}}", amount: "{{pt.amount}}", reference: "{{pt.reference}}", purpose: "{{pt.purpose}}" };
const TPL = "ctx.tpl[pt.id]";
const KNOWN = "has(ctx.tpl, pt.id)";

/**
 * Payment templates (BankWorkx Business, Payments). A Maker saves a payment made often (a supplier, an amount or none, a reference, a purpose), starts it again from the list of
 * templates, or deletes one. A template holds no money and no approval and no code is asked: the payment it starts asks for its own approval and its own code. Three modes in one journey:
 * create (the default), use and delete (`launch.mode`, with `launch.templateId`); opened with `launch.paymentId` a new template starts from that payment.
 *
 * Built from the spec with the blocks FinX has (docs/BANKWORKX.md): the bank checks the name, the amount and the reference when Review is pressed (no per-field messages), and Use hands the
 * template to Pay a supplier as `launch.templateId`, which fills in the supplier, the amount, the reference and the purpose.
 */
export const paymentTemplate: Journey = {
  id: "jrn_payment_template",
  slug: "payment-template",
  name: "Payment templates",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: paymentTemplateAcceptance,
  scenarios: paymentTemplateScenarios,
  dataModel: {
    "launch.mode": { type: "string" }, "launch.templateId": { type: "string" }, "launch.paymentId": { type: "string" },
    "pt.mode": { type: "string" }, "pt.id": { type: "string" }, "pt.supplierId": { type: "string", required: true }, "pt.ccy": { type: "string" },
    "pt.name": { type: "string", required: true }, "pt.amount": { type: "money", currency: "{{pt.ccy}}" }, "pt.reference": { type: "string" }, "pt.purpose": { type: "string" }, "pt.result": { type: "object" },
  },
  integrations: [
    { id: "suppliers", adapter: "corp.suppliers.list", mode: "sandbox" },
    { id: "templates", adapter: "corp.templates.list", mode: "sandbox" },
    { id: "payment", adapter: "corp.payments.get", mode: "sandbox" },
    { id: "check", adapter: "corp.templates.save", mode: "sandbox" },
    { id: "save", adapter: "corp.templates.save", mode: "sandbox" },
    { id: "delete", adapter: "corp.templates.delete", mode: "sandbox" },
  ],
  screens: [
    {
      // the approved suppliers and the templates; the mode is what the link says, or use for a template and create for nothing
      id: "start", title: "Payment templates", kind: "branch",
      onEnter: [
        set("ctx.error", null),
        { type: "callApi", integration: "suppliers", saveAs: "ctx.sup", onError: toRoute },
        { type: "callApi", integration: "templates", saveAs: "ctx.tpl", onError: toRoute },
        set("pt.mode", "{{isEmpty(launch.mode) ? (isEmpty(launch.templateId) ? 'create' : 'use') : launch.mode}}"), set("pt.id", "{{launch.templateId}}"),
        set("pt.supplierId", ""), set("pt.ccy", ""), set("pt.name", ""), set("pt.amount", null), set("pt.reference", ""), set("pt.purpose", ""), set("pt.result", null),
        go("supplier"),
      ],
      navigation: route([lacks("biz.templates.manage"), "denied"], ["pt.mode == 'delete'", "delete"], ["pt.mode == 'use'", "use"], ["!isEmpty(launch.paymentId)", "fromPayment"]),
      blocks: [],
    },
    {
      // a template that starts from a payment already made: its supplier, amount and reference
      id: "fromPayment", title: "Payment templates", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "payment", input: { paymentId: "{{launch.paymentId}}" }, saveAs: "ctx.pay", onError: toRoute },
        set("launch.paymentId", ""),
        set("pt.supplierId", "{{has(ctx.sup, ctx.pay.beneficiaryId) ? ctx.pay.beneficiaryId : ''}}"),
        set("pt.amount", "{{isEmpty(ctx.pay.receive) ? ctx.pay.amount : ctx.pay.receive.amount}}"), set("pt.reference", "{{ctx.pay.reference}}"),
        go("supplier"),
      ],
      navigation: route(["!isEmpty(pt.supplierId)", "chosen"]),
      blocks: [],
    },
    {
      id: "supplier", title: "Choose a supplier",
      blocks: [
        STEPPER,
        text("Step 1 of 3 · Payment templates", "caption"),
        text("Choose a supplier", "title"),
        alert("error", "That supplier isn’t on your list or is waiting for approval.", is("SUPPLIER_NOT_APPROVED")),
        { type: "menu", source: "ctx.sup", item: { label: "{{item.displayName}}", text: "{{item.line}}", actions: [set("ctx.error", null), set("pt.supplierId", "{{item.id}}"), go("chosen")] } },
        text("No suppliers yet", "title", "len(ctx.sup) == 0"),
        text("Add a supplier first.", "body", "len(ctx.sup) == 0"),
        button("Add a supplier", [{ type: "navigate", toJourney: "add-supplier" }], "secondary", "len(ctx.sup) == 0"),
        button("Cancel", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      // takes the currency from the saved supplier
      id: "chosen", title: "Payment templates", kind: "branch",
      onEnter: [set("pt.ccy", "{{has(ctx.sup, pt.supplierId) && ctx.sup[pt.supplierId].currency ? ctx.sup[pt.supplierId].currency : 'USD'}}"), go("details")],
      blocks: [],
    },
    {
      id: "details", title: "Template details",
      blocks: [
        STEPPER,
        text("Step 2 of 3 · Payment templates", "caption"),
        text("Template details", "title"),
        alert("error", "You already have a template with this name.", is("TEMPLATE_NAME_EXISTS")),
        alert("error", "{{ctx.error.message}}", is("NAME_REQUIRED", "INVALID_AMOUNT", "LIMIT_USER_EXCEEDED", "INVALID_REFERENCE", "PURPOSE_REQUIRED")),
        { type: "textInput", bind: "pt.name", label: "Template name", placeholder: "Monthly supplies" },
        { type: "amountInput", bind: "pt.amount", currency: "{{pt.ccy}}", label: "Amount", helper: "Leave empty to enter it each time" },
        { type: "textInput", bind: "pt.reference", label: "Reference", placeholder: "Invoice or PO number", pattern: REFERENCE.replace("{1,35}", "{0,35}"), patternMessage: "Use letters, numbers and spaces only." },
        { type: "select", bind: "pt.purpose", label: "Purpose", variant: "dropdown", options: PURPOSES },
        button("Review", [
          { type: "validate" }, set("ctx.error", null),
          { type: "callApi", integration: "check", input: { ...FORM, dryRun: true }, onError: toRoute },
          go("review"),
        ]),
        button("Back", [set("ctx.error", null), go("supplier")], "ghost"),
      ],
    },
    {
      id: "review", title: "Review",
      blocks: [
        STEPPER,
        text("Step 3 of 3 · Payment templates", "caption"),
        text("Review", "title"),
        alert("error", "You can have up to 20 templates. Delete one to add another.", is("TEMPLATE_LIMIT")),
        alert("error", "That supplier isn’t on your list or is waiting for approval.", is("SUPPLIER_NOT_APPROVED")),
        { type: "reviewSummary", rows: [{ label: "Name", value: "{{pt.name}}" }, { label: "Supplier", value: SUPPLIER }] },
        { type: "reviewSummary", visibleWhen: "!isEmpty(pt.amount)", rows: [{ label: "Amount", value: "{{pt.amount | money2:pt.ccy}}" }] },
        { type: "reviewSummary", visibleWhen: "isEmpty(pt.amount)", rows: [{ label: "Amount", value: "Each time" }] },
        { type: "reviewSummary", visibleWhen: "!isEmpty(pt.reference)", rows: [{ label: "Reference", value: "{{pt.reference}}" }] },
        { type: "reviewSummary", visibleWhen: "!isEmpty(pt.purpose)", rows: [{ label: "Purpose", value: "{{pt.purpose}}" }] },
        text("A template holds no money and needs no approval. The payment it starts does.", "caption"),
        button("Save template", [set("ctx.error", null), { type: "callApi", integration: "save", input: { ...FORM }, saveAs: "pt.result", onError: toRoute }, go("saved")]),
        button("Back", [set("ctx.error", null), go("details")], "ghost"),
      ],
    },
    {
      id: "saved", title: "Template saved", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Template saved", text: "{{pt.result.name}} for {{pt.result.supplierName}}." },
        { type: "statusChip", status: "saved", label: "Saved", tone: "positive" },
        { type: "reviewSummary", rows: [{ label: "Name", value: "{{pt.result.name}}" }, { label: "Supplier", value: "{{pt.result.supplierName}}" }, { label: "Amount", value: "{{isEmpty(pt.result.amount) ? 'Amount each time' : pt.result.amountText}}" }] },
        { type: "reviewSummary", visibleWhen: "!isEmpty(pt.result.reference)", rows: [{ label: "Reference", value: "{{pt.result.reference}}" }] },
        { type: "reviewSummary", visibleWhen: "!isEmpty(pt.result.purpose)", rows: [{ label: "Purpose", value: "{{pt.result.purpose}}" }] },
        button("Use it now", [{ type: "navigate", toJourney: "supplier-payment", with: { "launch.templateId": "{{pt.result.id}}" } }]),
        button("Back to templates", [{ type: "navigate", toJourney: "templates" }], "secondary"),
      ],
    },
    // ---- use
    {
      id: "use", title: "Use template",
      blocks: [
        text("Use template", "title"),
        ...card("ctx.tpl[pt.id]"),
        button("Continue to payment", [go("ready")], "primary", `${KNOWN} && ${TPL}.status == 'ready'`),
        button("Close", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "ready", title: "Ready to pay", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Ready to pay", text: "{{ctx.tpl[pt.id].name}}" },
        { type: "statusChip", status: "ready", label: "Ready", tone: "positive" },
        { type: "reviewSummary", rows: [{ label: "Supplier", value: "{{ctx.tpl[pt.id].supplierName}}" }, { label: "Amount", value: "{{ctx.tpl[pt.id].amountText}}" }] },
        button("Continue to payment", [{ type: "navigate", toJourney: "supplier-payment", with: { "launch.templateId": "{{pt.id}}" } }]),
      ],
    },
    // ---- delete
    {
      id: "delete", title: "Delete this template?",
      blocks: [
        text("Delete this template?", "title"),
        ...card("ctx.tpl[pt.id]"),
        text("Payments already sent are not affected.", "caption", KNOWN),
        button("Delete template", [set("ctx.error", null), { type: "callApi", integration: "delete", input: { templateId: "{{pt.id}}" }, saveAs: "pt.result", onError: toRoute }, go("deleted")], "primary", KNOWN),
        button("Back", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "deleted", title: "Template deleted", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Template deleted", text: "{{pt.result.name}} is gone. Payments already sent are not affected." },
        { type: "statusChip", status: "deleted", label: "Deleted", tone: "neutral" },
        { type: "reviewSummary", rows: [{ label: "Template", value: "{{pt.result.name}}" }] },
        button("Back to templates", [{ type: "navigate", toJourney: "templates" }]),
      ],
    },
    ...templateFailures(),
  ] as Screen[],
};

/** The card of a template (use and delete): its name and supplier, the amount, the reference and the purpose; or the words for one that is gone. */
function card(tpl: string) {
  return [
    text("Template not found", "title", `!${KNOWN}`),
    text("It may have been deleted.", "body", `!${KNOWN}`),
    { type: "reviewSummary" as const, visibleWhen: KNOWN, rows: [{ label: "Template", value: `{{${tpl}.name}}` }, { label: "Supplier", value: `{{${tpl}.supplierName}}` }, { label: "Amount", value: `{{${tpl}.amountText}}` }] },
    { type: "reviewSummary" as const, visibleWhen: `${KNOWN} && !isEmpty(${tpl}.reference)`, rows: [{ label: "Reference", value: `{{${tpl}.reference}}` }] },
    { type: "reviewSummary" as const, visibleWhen: `${KNOWN} && !isEmpty(${tpl}.purpose)`, rows: [{ label: "Purpose", value: `{{${tpl}.purpose}}` }] },
    alert("warning", "That supplier is waiting for approval.", `${KNOWN} && ${tpl}.status == 'waiting'`),
    alert("warning", "That supplier isn’t on your list any more.", `${KNOWN} && ${tpl}.status == 'unavailable'`),
    alert("error", "We can’t find that template.", is("TEMPLATE_NOT_FOUND")),
  ];
}

function templateFailures(): Screen[] {
  const base = failScreens({
    title: "Payment templates", retry: [["check", "details"], ["save", "review"]],
    routes: [
      [is("TEMPLATE_NAME_EXISTS", "NAME_REQUIRED", "INVALID_AMOUNT", "LIMIT_USER_EXCEEDED", "INVALID_REFERENCE", "PURPOSE_REQUIRED"), "details"],
      [is("TEMPLATE_LIMIT"), "review"], [`${is("SUPPLIER_NOT_APPROVED")} && ctx.error.integration == 'save'`, "review"], [is("SUPPLIER_NOT_APPROVED"), "supplier"], [is("TEMPLATE_NOT_FOUND"), "delete"],
    ],
    // a slow answer here changes nothing: the words are those of the spec
  });
  return base.filter((s) => s.id !== "denied").concat([denyScreen("Payment templates", "use templates")]);
}
