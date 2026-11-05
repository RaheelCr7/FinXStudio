import type { Journey } from "../schema";
import { resetPassword } from "./reset-password";

/**
 * An alias of Reset password: a thin entry that opens `reset-password` with the mode already chosen (launch.mode) and the username it was
 * given (launch.user), so it carries none of its screens, rules or bank calls and cannot drift from them. `option` is the bank option that
 * switches it off: with it off the alias says so and, for unlocking, offers the reset instead, without opening Reset password.
 */
export function resetAlias(preset: { mode: "reset" | "unlock"; option: string; title: string; offTitle: string; offText: string; id: string; slug: string; acceptance: NonNullable<Journey["acceptance"]>; scenarios: NonNullable<Journey["scenarios"]> }): Journey {
  const { id: _i, slug: _s, name: _n, acceptance: _a, scenarios: _t, dataModel: _d, integrations: _g, screens: _c, entryScreen: _e, authorisation: _u, ...shared } = resetPassword;
  return {
    ...shared,
    id: preset.id, slug: preset.slug, name: preset.title, entryScreen: "start",
    acceptance: preset.acceptance, scenarios: preset.scenarios,
    dataModel: { [`opt.${preset.option}`]: { type: "boolean" }, "launch.user": { type: "string" } },
    integrations: [],
    screens: [
      {
        id: "start", title: preset.title, kind: "branch",
        onEnter: [{ type: "navigate", toJourney: resetPassword.slug, with: { "launch.mode": preset.mode, "launch.user": "{{launch.user}}" } }],
        navigation: { rules: [{ when: `opt.${preset.option} == false`, to: "off" }] },
        blocks: [],
      },
      {
        id: "off", title: preset.title, kind: "terminal",
        blocks: [
          { type: "result", tone: "error", title: preset.offTitle, text: preset.offText },
          ...(preset.mode === "unlock" ? [{ type: "button" as const, label: "Reset password", variant: "primary" as const, actions: [{ type: "navigate" as const, toJourney: "forgot-password", with: { "launch.user": "{{launch.user}}" } }] }] : []),
          { type: "button", label: "Done", variant: preset.mode === "unlock" ? "ghost" : "primary", actions: [{ type: "exit" }] },
        ],
      },
    ],
  };
}
