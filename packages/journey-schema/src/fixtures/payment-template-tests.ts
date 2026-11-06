import type { Journey } from "../schema";
import { steps } from "./business-kit";

const { press, text, noText, screen, set, error, opens, refuses, bank } = steps;

/** What must be true for "Payment templates" to be right (the spec's criteria). */
export const paymentTemplateAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "Only a Maker who may manage templates can create, use or delete one; a role without the permission lands on a no-access card and the bank refuses the same calls." },
  { id: "AC-2", text: "A template needs an approved supplier and a name; the amount, reference and purpose are optional and checked when given (an amount above the person's limit is refused). It can start from a payment already made." },
  { id: "AC-3", text: "A second template with the same name (any case) is refused; a 21st template is refused and a 20th is not." },
  { id: "AC-4", text: "A template without an amount shows \"Amount each time\"." },
  { id: "AC-5", text: "Use opens Pay a supplier with the template, which fills in the supplier and the amount." },
  { id: "AC-6", text: "Delete asks first and does not touch payments already sent." },
  { id: "AC-7", text: "A template whose supplier is waiting for approval or is gone cannot be used, with the words for each; a supplier that is not approved cannot be put on a new template." },
  { id: "AC-8", text: "A slow bank changes nothing and says so; an unavailable bank shows the sheet and changes nothing." },
];

const NOW = "2026-11-03T10:42:00Z";
const alpha = { persona: "alex", context: "alpha", now: NOW };
type Scenario = NonNullable<Journey["scenarios"]>[number];
const T = (id: string, name: string, covers: string[], base: Record<string, unknown>, stepList: Record<string, unknown>[], extra: Record<string, unknown> = {}): Scenario => ({ id, name, covers, ...base, ...extra, steps: stepList } as Scenario);
const arrange = (input: Record<string, unknown>) => ({ adapter: "corp.sandbox.arrange", input });
const tpl = (id: string, path: string, equals: unknown) => bank("corp.templates.list", `${id}.${path}`, equals);
/** From the first screen to the review, for Harbour Packaging. */
const toReview = (name: string, extra: Record<string, unknown> = {}): Record<string, unknown>[] => [
  screen("supplier"), press("Harbour Packaging"), screen("details"), set({ "pt.name": name, ...extra }), press("Review"), screen("review"),
];

export const paymentTemplateScenarios: NonNullable<Journey["scenarios"]> = [
  T("T-1", "Save a template: Harbour Packaging, Weekly supplies, 1,200.00, PO-STANDING, Goods: Template saved, and the list shows it with $1,200.00", ["AC-2"], alpha, [
    screen("supplier"), text("Choose a supplier"), text("Harbour Packaging"), text("USD · ••8841"), text("Nordic Supplies AB"), text("Whitby Logistics"), text("Gulf Trade FZE"),
    press("Harbour Packaging"), screen("details"), text("Leave empty to enter it each time"),
    set({ "pt.name": "Weekly supplies", "pt.amount": 1200, "pt.reference": "PO-STANDING", "pt.purpose": "Goods" }), press("Review"), screen("review"),
    text("Weekly supplies"), text("Harbour Packaging"), text("$1,200.00"), text("PO-STANDING"), text("Goods"), noText("Each time"),
    press("Save template"), screen("saved"), text("Template saved"), text("Weekly supplies for Harbour Packaging."), text("Saved"), text("PO-STANDING"),
    tpl("tpl_3", "line", "Harbour Packaging · $1,200.00"), tpl("tpl_3", "purpose", "Goods"), tpl("tpl_3", "reference", "PO-STANDING"), tpl("tpl_3", "status", "ready"),
  ]),
  T("T-2", "A template with no amount shows Amount each time on the review, the result and the list", ["AC-2", "AC-4"], alpha, [
    ...toReview("Quarterly supplies"), text("Each time"), noText("$"), press("Save template"), screen("saved"), text("Amount each time"), noText("Reference"), noText("Purpose"),
    tpl("tpl_3", "amountText", "Amount each time"), tpl("tpl_3", "line", "Harbour Packaging · Amount each time"),
  ]),
  T("T-3", "A name that another template has (any case) is refused with the spec's words", ["AC-3"], alpha, [
    screen("supplier"), press("Harbour Packaging"), set({ "pt.name": "monthly packaging" }), press("Review"), screen("details"), text("You already have a template with this name."),
    set({ "pt.name": "Monthly packaging 2" }), press("Review"), screen("review"),
  ]),
  T("T-4", "The 21st template is refused when it is saved and nothing is saved", ["AC-3"], alpha, [
    ...toReview("The 21st"), press("Save template"), screen("review"), text("You can have up to 20 templates. Delete one to add another."), noText("Template saved"),
  ], { setup: [arrange({ op: "fillTemplates", count: 20 })] }),
  T("T-5", "The 20th template is saved", ["AC-3"], alpha, [...toReview("The 20th"), press("Save template"), screen("saved"), text("Template saved")], { setup: [arrange({ op: "fillTemplates", count: 19 })] }),
  T("T-6", "A name is required and the amount cannot be above the person's limit", ["AC-2"], alpha, [
    screen("supplier"), press("Harbour Packaging"), press("Review"), screen("details"), error("pt.name"),
    set({ "pt.name": "Big one", "pt.amount": 250_000.01 }), press("Review"), screen("details"), text("That is over your limit of $250,000.00 a payment."),
    set({ "pt.amount": 250_000 }), press("Review"), screen("review"),
  ]),
  T("T-7", "Use opens Pay a supplier with the template, whose supplier and amount are filled in", ["AC-5"], alpha, [
    screen("use"), text("Use template"), text("Monthly packaging"), text("Harbour Packaging"), text("$4,500.00"), text("PO-STANDING"), text("Goods"), press("Continue to payment"), screen("ready"),
    text("Ready to pay"), text("Ready"), press("Continue to payment"), opens("supplier-payment", { "launch.templateId": "tpl_packaging" }), screen("amount"), text("Harbour Packaging"), text("PO-STANDING"), press("Review"), screen("speed"), text("$4,500.00"),
  ], { launch: { "launch.templateId": "tpl_packaging" } }),
  T("T-8", "A template without an amount: Use opens Pay a supplier and the amount is asked", ["AC-4", "AC-5"], alpha, [
    screen("use"), text("Amount each time"), press("Continue to payment"), press("Continue to payment"), opens("supplier-payment", { "launch.templateId": "tpl_freight" }), screen("amount"), text("Whitby Logistics"), text("FREIGHT-Q"),
  ], { launch: { "launch.templateId": "tpl_freight" } }),
  T("T-9", "Delete asks first, then deletes; payments already sent are untouched", ["AC-6"], alpha, [
    screen("delete"), text("Delete this template?"), text("Quarterly freight"), text("Amount each time"), text("Payments already sent are not affected."), tpl("tpl_freight", "name", "Quarterly freight"),
    press("Delete template"), screen("deleted"), text("Template deleted"), text("Quarterly freight is gone. Payments already sent are not affected."), text("Deleted"), tpl("tpl_freight", "name", undefined), tpl("tpl_packaging", "name", "Monthly packaging"),
    bank("corp.payments.get", "status", "pending_approval", { paymentId: "PAY-2040" }), refuses("corp.templates.delete", "TEMPLATE_NOT_FOUND", { templateId: "tpl_freight" }),
  ], { launch: { "launch.mode": "delete", "launch.templateId": "tpl_freight" } }),
  T("T-10", "A template that is not there says so, for use and for delete", ["AC-6"], alpha, [screen("delete"), text("Template not found"), text("It may have been deleted."), noText("Delete template")], { launch: { "launch.mode": "delete", "launch.templateId": "tpl_nobody" } }),
  T("T-11", "A template whose supplier is waiting for approval cannot be used", ["AC-7"], alpha, [screen("use"), text("Quarterly freight"), text("That supplier is waiting for approval."), noText("Continue to payment"), tpl("tpl_freight", "statusText", "Waiting for approval")], { launch: { "launch.templateId": "tpl_freight" }, setup: [arrange({ op: "waitSupplier", id: "whit" })] }),
  T("T-12", "A template whose supplier is gone cannot be used", ["AC-7"], alpha, [screen("use"), text("That supplier isn’t on your list any more."), noText("Continue to payment"), tpl("tpl_freight", "line", "Supplier removed · Amount each time")], { launch: { "launch.templateId": "tpl_freight" }, setup: [arrange({ op: "removeSupplier", id: "whit" })] }),
  T("T-13", "A supplier that is not approved cannot be put on a new template, even when asked directly", ["AC-7"], alpha, [screen("supplier"), refuses("corp.templates.save", "SUPPLIER_NOT_APPROVED", { name: "Sneaky", supplierId: "req_1" })]),
  T("T-14", "With no suppliers the first step offers Add a supplier, which opens it", ["AC-2"], { persona: "alexempty", context: "gamma", now: NOW }, [screen("supplier"), text("No suppliers yet"), text("Add a supplier first."), press("Add a supplier"), opens("add-supplier")]),
  T("T-15", "Started from a payment already made: its supplier, amount and reference are filled in", ["AC-2"], alpha, [
    screen("details"), text("PO-5612"), set({ "pt.name": "Repeat of 2040" }), press("Review"), screen("review"), text("Harbour Packaging"), text("$18,900.00"), text("PO-5612"), press("Save template"), screen("saved"), tpl("tpl_3", "amount", 18_900),
  ], { launch: { "launch.paymentId": "PAY-2040" } }),
  T("T-16", "Alex at Beta (an Approver): the no-access card, and the bank refuses saving and deleting", ["AC-1"], { persona: "alex", context: "beta", now: NOW }, [
    screen("denied"), text("You can’t use templates at this company"), refuses("corp.templates.save", "PERMISSION_DENIED", { name: "Sneaky", supplierId: "nimb" }), refuses("corp.templates.delete", "PERMISSION_DENIED", { templateId: "tpl_packaging" }),
  ]),
  T("T-17", "From Personal the bank refuses a company's templates", ["AC-1"], { persona: "alex", now: NOW }, [screen("denied"), refuses("corp.templates.save", "WRONG_CONTEXT", { name: "x", supplierId: "harb" })]),
  T("T-18", "A slow bank at Review changes nothing and says so; Try again goes back to the details", ["AC-8"], alpha, [
    screen("supplier"), press("Harbour Packaging"), set({ "pt.name": "Weekly supplies" }), press("Review"), screen("slow"), text("This is taking longer than expected. Nothing was changed."), press("Try again"), screen("details"), tpl("tpl_3", "name", undefined),
  ], { conditions: { timeout: ["corp.templates.save"], latencyMs: 10000 } }),
  T("T-19", "An unavailable bank at Review shows the sheet and nothing is saved", ["AC-8"], alpha, [
    screen("supplier"), press("Harbour Packaging"), set({ "pt.name": "Weekly supplies" }), press("Review"), screen("unavailable"), text("We couldn’t reach the bank"), text("Nothing was sent and you haven’t been charged. Try again in a moment."), press("Try again"), screen("details"),
  ], { conditions: { unavailable: ["corp.templates.save"] } }),
  T("T-20", "The suppliers or the templates not loading shows the sheet", ["AC-8"], alpha, [screen("unavailable"), press("Try again"), screen("unavailable")], { conditions: { unavailable: ["corp.suppliers.list"] } }),
  T("T-21", "The templates not loading shows the sheet", ["AC-8"], alpha, [screen("unavailable")], { conditions: { unavailable: ["corp.templates.list"] } }),
  T("T-22", "Deleting with an unavailable bank shows the sheet; the template stays", ["AC-8"], alpha, [press("Delete template"), screen("unavailable"), press("Try again"), screen("delete")], { launch: { "launch.mode": "delete", "launch.templateId": "tpl_freight" }, conditions: { unavailable: ["corp.templates.delete"] } }),
  T("T-23", "A payment that cannot be read shows the sheet", ["AC-8"], alpha, [screen("unavailable")], { launch: { "launch.paymentId": "PAY-2040" }, conditions: { unavailable: ["corp.payments.get"] } }),
  T("T-25", "Use it now on the result of a saved template opens Pay a supplier with that template; Back to templates opens the list", ["AC-5"], alpha, [
    ...toReview("Weekly supplies"), press("Save template"), screen("saved"), press("Back to templates"), opens("templates"),
  ]),
  T("T-26", "Use it now opens Pay a supplier with the template just saved", ["AC-5"], alpha, [
    ...toReview("Weekly supplies"), press("Save template"), screen("saved"), press("Use it now"), opens("supplier-payment", { "launch.templateId": "tpl_3" }),
  ]),
  T("T-27", "After a delete, Back to templates opens the list", ["AC-6"], alpha, [press("Delete template"), screen("deleted"), press("Back to templates"), opens("templates")], { launch: { "launch.mode": "delete", "launch.templateId": "tpl_freight" } }),
  T("T-24", "The bank refuses a reference with odd characters and a purpose that is not on the list, forced", ["AC-2"], alpha, [
    screen("supplier"), refuses("corp.templates.save", "INVALID_REFERENCE", { name: "A", supplierId: "harb", reference: "bad_ref" }), refuses("corp.templates.save", "PURPOSE_REQUIRED", { name: "A", supplierId: "harb", purpose: "Gifts" }),
    refuses("corp.templates.save", "INVALID_AMOUNT", { name: "A", supplierId: "harb", amount: 0.001 }),
  ]),
];
