import type { Journey, Screen } from "../schema";
import { singleTransferAcceptance, singleTransferScenarios } from "./single-transfer-tests";

/** The bank's options of Quick transfer, passed on as those of Send money: the Instant speed is Send money's opt.speedInstant. "Later" and the new-payee limit have the same names there. */
const instant = "{{opt.allowInstant != false}}";
const way = (id: string, label: string, line: string, type: string, when: string) => ({
  type: "menu" as const, visibleWhen: when,
  items: [{ id, label, text: line, actions: [{ type: "navigate" as const, toJourney: "personal-transfer", with: { "launch.type": type, "opt.speedInstant": instant } }] }],
});

/**
 * Quick transfer (BankWorkx, Personal: Payments). Pay a saved payee at another bank or in another country. The spec builds it on the helpers of Send money, so the
 * speeds, fees, limits and checks are the same; here it is the alias the spec describes, not a second copy: a thin entry that asks which of the two it is and opens
 * `personal-transfer` with that type (launch.type), so the payee list, the amount, the speed, the review, the one-time code and every rule are Send money's and
 * cannot drift. Quick transfer's options reach it: allowInstant is Send money's opt.speedInstant, and allowLater and coolingOff are its opt.allowLater and
 * opt.coolingOff (the spec lists as a bug that Quick transfer's coolingOff changed nothing; here it does).
 */
export const singleTransfer: Journey = {
  id: "jrn_single_transfer",
  slug: "single-transfer",
  name: "Quick transfer",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: singleTransferAcceptance,
  scenarios: singleTransferScenarios,
  dataModel: {
    "opt.typeDomestic": { type: "boolean" },
    "opt.typeIntl": { type: "boolean" },
    "opt.allowInstant": { type: "boolean" },
    "opt.allowLater": { type: "boolean" },
    "opt.coolingOff": { type: "boolean" },
  },
  integrations: [],
  screens: [
    // the bank may have both ways off: then there is nothing to send with
    { id: "start", title: "Quick transfer", kind: "branch", onEnter: [{ type: "navigate", to: "choose" }], navigation: { rules: [{ when: "opt.typeDomestic == false && opt.typeIntl == false", to: "off" }] }, blocks: [] },
    {
      id: "choose", title: "Quick transfer",
      blocks: [
        { type: "text", variant: "title", text: "Quick transfer" },
        { type: "text", variant: "caption", text: "Pay someone you have saved. For a new payee or a BankWorkx® customer, use Send money." },
        way("domestic", "To another bank", "A person or company at another bank", "domestic", "opt.typeDomestic != false"),
        way("international", "To another country", "A person or company abroad", "international", "opt.typeIntl != false"),
        { type: "button", label: "Done", variant: "ghost", actions: [{ type: "exit" }] },
      ],
    },
    {
      id: "off", title: "Quick transfer", kind: "terminal",
      blocks: [
        { type: "text", variant: "title", text: "Nothing to send with" },
        { type: "text", variant: "body", text: "Sending money isn’t available right now." },
        { type: "button", label: "Continue", variant: "primary", actions: [{ type: "exit" }] },
      ],
    },
  ] as Screen[],
};
