import type { Journey, Screen } from "../schema";
import { personalTransfer } from "./personal-transfer";
import { internalTransferAcceptance, internalTransferScenarios } from "./internal-transfer-tests";

/**
 * To a BankWorkx® customer (BankWorkx, Payments): an alias of Send money. The engine cannot open one journey from another with a value,
 * so the alias is Send money itself with the type already chosen: the same screens, rules, bank calls and bank options (the option
 * opt.typeInternal switches it off), opened at the step after the type. It exists so that links to the old name open the right place.
 */
const FREE = "opt.typeInternal == false";

/** Anything that went back to the choice of type goes back to the start of this journey, which has none. */
const noType = (node: any): any => {
  if (Array.isArray(node)) return node.map(noType);
  if (node && typeof node === "object") return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, k === "to" && v === "type" ? "start" : noType(v)]));
  return node;
};

const screens: Screen[] = personalTransfer.screens.map((s): Screen => {
  if (s.id === "start") {
    // the same start, then straight to the customers: the type is set here and the choice of type is only for a way of sending the bank has switched off
    const onEnter = s.onEnter!.slice(0, -1).map((a: any) => (a.type === "setData" && a.path === "pt.type" ? { ...a, value: "internal" } : a));
    return { ...s, onEnter: [...onEnter, { type: "navigate", to: "payeeList" }], navigation: { rules: [{ when: FREE, to: "type" }] } };
  }
  if (s.id === "type") {
    return {
      ...s, title: "To a BankWorkx® customer",
      blocks: [
        { type: "stepper", steps: ["payee", "details", "amount", "review", "otp"] },
        { type: "text", variant: "title", text: "Nothing to send with" },
        { type: "text", variant: "body", text: "Sending money isn’t available right now." },
        { type: "button", label: "Continue", variant: "primary", actions: [{ type: "exit" }] },
      ],
    };
  }
  return noType(s);
});

export const internalTransfer: Journey = { ...personalTransfer, id: "jrn_internal_transfer", slug: "internal-transfer", name: "To a BankWorkx® customer", acceptance: internalTransferAcceptance, scenarios: internalTransferScenarios, screens };
