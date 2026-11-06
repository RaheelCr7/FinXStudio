import type { Journey } from "../schema";
import { steps } from "./business-kit";

const { press, text, noText, screen, opens, refuses } = steps;

/** What must be true for "Templates" to be right (the spec's criteria). */
export const templatesAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "The list shows the company's templates with the supplier and the amount, or \"Amount each time\"." },
  { id: "AC-2", text: "Use shows only to a person who may start payments and Delete and Save a template only to one who may manage templates; an Approver sees the list without buttons." },
  { id: "AC-3", text: "A template whose supplier is waiting for approval shows \"Waiting for approval\" and no Use; one whose supplier is gone shows \"Unavailable\" and \"Supplier removed\"." },
  { id: "AC-4", text: "With no templates the empty state \"No templates yet\" shows." },
  { id: "AC-5", text: "Use, Delete and Save a template open Pay a supplier and Payment templates with the template; a bank that cannot be reached or does not answer shows the retry state." },
];

const NOW = "2026-11-03T10:42:00Z";
const alpha = { persona: "alex", context: "alpha", now: NOW };
const beta = { persona: "alex", context: "beta", now: NOW };
type Scenario = NonNullable<Journey["scenarios"]>[number];
const T = (id: string, name: string, covers: string[], base: Record<string, unknown>, stepList: Record<string, unknown>[], extra: Record<string, unknown> = {}): Scenario => ({ id, name, covers, ...base, ...extra, steps: stepList } as Scenario);
const arrange = (input: Record<string, unknown>) => ({ adapter: "corp.sandbox.arrange", input });

export const templatesScenarios: NonNullable<Journey["scenarios"]> = [
  T("T-1", "Alex at Alpha: two templates, with their suppliers and amounts, and Save a template", ["AC-1", "AC-2"], alpha, [
    screen("list"), text("Templates"), text("Monthly packaging"), text("Harbour Packaging"), text("$4,500.00"), text("Quarterly freight"), text("Whitby Logistics"), text("Amount each time"), text("Ready"), text("Save a template"), noText("No templates yet"),
  ]),
  T("T-2", "Alex at Beta: no templates, the empty state and no Save a template", ["AC-2", "AC-4"], beta, [screen("list"), text("No templates yet"), text("Save a payment you make often."), noText("Save a template")]),
  T("T-3", "An Approver sees the list without Use or Delete", ["AC-2"], beta, [
    screen("list"), text("Filler 1"), noText("Save a template"), press("tpl_fill1"), screen("detail"), text("Filler 1"), noText("Use"), noText("Delete"),
  ], { setup: [arrange({ op: "fillTemplates", count: 2 })] }),
  T("T-4", "A template whose supplier is waiting for approval shows the chip and no Use; Delete stays", ["AC-3"], alpha, [
    screen("list"), text("Waiting for approval"), press("tpl_freight"), screen("detail"), text("Quarterly freight"), text("Waiting for approval"), noText("Use"), text("Delete"),
  ], { setup: [arrange({ op: "waitSupplier", id: "whit" })] }),
  T("T-5", "A template whose supplier is gone shows Unavailable and Supplier removed, and no Use", ["AC-3"], alpha, [
    screen("list"), text("Unavailable"), press("tpl_freight"), text("Supplier removed · Amount each time"), noText("Use"),
  ], { setup: [arrange({ op: "removeSupplier", id: "whit" })] }),
  T("T-6", "Use opens Pay a supplier with the template", ["AC-5"], alpha, [press("tpl_packaging"), screen("detail"), text("Harbour Packaging · $4,500.00"), text("PO-STANDING"), text("Goods"), press("Use"), opens("supplier-payment", { "launch.templateId": "tpl_packaging" }), screen("amount")]),
  T("T-7", "Delete opens Payment templates in delete mode with the template", ["AC-5"], alpha, [press("tpl_packaging"), press("Delete"), opens("payment-template", { "launch.mode": "delete", "launch.templateId": "tpl_packaging" }), screen("delete"), text("Monthly packaging")]),
  T("T-8", "Save a template opens Payment templates", ["AC-5"], alpha, [press("Save a template"), opens("payment-template"), screen("supplier")]),
  T("T-9", "A row opens the card of its template and Back returns to the list", ["AC-1"], alpha, [press("tpl_packaging"), screen("detail"), text("Monthly packaging"), press("Back"), screen("list")]),
  T("T-10", "When the bank is unavailable the list shows the retry state", ["AC-5"], alpha, [screen("loadFail"), text("We couldn’t load your templates. Nothing was changed."), text("Nothing was sent and you haven’t been charged. Try again in a moment."), noText("Monthly packaging"), press("Try again"), screen("loadFail")], { conditions: { unavailable: ["corp.templates.list"] } }),
  T("T-11", "When the bank does not answer in time the retry state says so", ["AC-5"], alpha, [screen("loadFail"), text("This is taking longer than expected. Nothing was changed."), press("Try again"), screen("loadFail")], { conditions: { timeout: ["corp.templates.list"], latencyMs: 10000 } }),
  T("T-12", "From Personal the bank does not answer for a company's templates", ["AC-5"], { persona: "alex", now: NOW }, [screen("denied"), text("Switch to your business first"), refuses("corp.templates.list", "WRONG_CONTEXT")]),
];
