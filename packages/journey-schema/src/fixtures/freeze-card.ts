import type { Journey, Screen } from "../schema";
import { freezeCardAcceptance, freezeCardScenarios } from "./freeze-card-tests";

/**
 * Freeze card (BankWorkx, Personal: Cards). An alias of card-controls, as the spec describes it: a thin entry that opens card-controls on the freeze change for the
 * card it is given (launch.cardId), or on the unfreeze change (launch.action = unfreeze, which asks for a one-time code), so it carries none of its screens, rules
 * or bank calls and cannot drift from them. Switching card-controls off removes it; opt.enabled = false is that switch for this entry (the spec makes it a switch of
 * its own that leaves card-controls on). Any other action (the shell's "block") opens the freeze: blocking a card is Replace card's job and is not built here.
 */
export const freezeCard: Journey = {
  id: "jrn_bankworkx_freeze_card",
  slug: "freeze-card",
  name: "Freeze a card",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: freezeCardAcceptance,
  scenarios: freezeCardScenarios,
  dataModel: { "launch.cardId": { type: "string" }, "launch.action": { type: "string" }, "opt.enabled": { type: "boolean" } },
  integrations: [],
  screens: [
    {
      id: "start", title: "Freeze a card", kind: "branch",
      onEnter: [{ type: "navigate", toJourney: "card-controls", with: { "launch.cardId": "{{launch.cardId}}", "launch.mode": "{{launch.action == 'unfreeze' ? 'unfreeze' : 'freeze'}}" } }],
      navigation: { rules: [{ when: "opt.enabled == false", to: "off" }] },
      blocks: [],
    },
    {
      id: "off", title: "Freeze a card", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "Not available", text: "This isn’t available at your bank." },
        { type: "button", label: "Done", variant: "primary", actions: [{ type: "exit" }] },
      ],
    },
  ] as Screen[],
};
