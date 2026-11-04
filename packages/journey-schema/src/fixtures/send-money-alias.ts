import type { Journey, Screen } from "../schema";
import { personalTransfer } from "./personal-transfer";

/**
 * An alias of Send money: the engine cannot open one journey from another with a value, so an alias is Send money itself with the type
 * already chosen: the same screens, rules, bank calls and bank options, opened at the step after the type. `option` is the bank option
 * that switches this way of sending off; with it off the journey says there is nothing to send with.
 */
export function sendMoneyAlias(preset: { type: string; option: string; title: string; id: string; slug: string; acceptance: NonNullable<Journey["acceptance"]>; scenarios: NonNullable<Journey["scenarios"]> }): Journey {
  const off = `opt.${preset.option} == false`;
  /** Anything that went back to the choice of type goes back to the start of this journey, which has none. */
  const noType = (node: any): any => {
    if (Array.isArray(node)) return node.map(noType);
    if (node && typeof node === "object") return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, k === "to" && v === "type" ? "start" : noType(v)]));
    return node;
  };
  const screens: Screen[] = personalTransfer.screens.map((s): Screen => {
    if (s.id === "start") {
      // the same start, then straight to the payees: the type is set here and the choice of type is only for a way of sending the bank has switched off
      const onEnter = s.onEnter!.slice(0, -1).map((a: any) => (a.type === "setData" && a.path === "pt.type" ? { ...a, value: preset.type } : a));
      return { ...s, onEnter: [...onEnter, { type: "navigate", to: "payeeList" }], navigation: { rules: [{ when: off, to: "type" }] } };
    }
    if (s.id === "type") {
      return {
        ...s, title: preset.title,
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
  return { ...personalTransfer, id: preset.id, slug: preset.slug, name: preset.title, acceptance: preset.acceptance, scenarios: preset.scenarios, screens };
}
