import type { Journey } from "../schema";
import { personalTransfer } from "./personal-transfer";

/**
 * An alias of Send money: a thin entry that opens `personal-transfer` with the type already chosen (the launch value `launch.type`),
 * so it carries none of its screens, rules or bank calls and cannot drift from them. `option` is the bank option that switches this way
 * of sending off; with it off the alias says there is nothing to send with, without opening Send money.
 */
export function sendMoneyAlias(preset: { type: string; option: string; title: string; id: string; slug: string; acceptance: NonNullable<Journey["acceptance"]>; scenarios: NonNullable<Journey["scenarios"]> }): Journey {
  const { id: _i, slug: _s, name: _n, acceptance: _a, scenarios: _t, dataModel: _d, integrations: _g, screens: _c, entryScreen: _e, authorisation: _u, ...shared } = personalTransfer;
  return {
    ...shared,
    id: preset.id, slug: preset.slug, name: preset.title, entryScreen: "start",
    acceptance: preset.acceptance, scenarios: preset.scenarios,
    dataModel: { [`opt.${preset.option}`]: { type: "boolean" } },
    integrations: [],
    screens: [
      {
        id: "start", title: preset.title, kind: "branch",
        onEnter: [{ type: "navigate", toJourney: personalTransfer.slug, with: { "launch.type": preset.type } }],
        navigation: { rules: [{ when: `opt.${preset.option} == false`, to: "off" }] },
        blocks: [],
      },
      {
        id: "off", title: preset.title, kind: "terminal",
        blocks: [
          { type: "text", variant: "title", text: "Nothing to send with" },
          { type: "text", variant: "body", text: "Sending money isn’t available right now." },
          { type: "button", label: "Continue", variant: "primary", actions: [{ type: "exit" }] },
        ],
      },
    ],
  };
}
