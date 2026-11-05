import type { Journey, Screen } from "../schema";
import { accountNicknameAcceptance, accountNicknameScenarios } from "./account-nickname-tests";

/**
 * Rename an account (BankWorkx, Personal: Accounts). An alias of account-details, as the spec describes it: a thin entry that opens account-details at its
 * Rename step for the account (the launch values launch.accountId and launch.view = rename), so it carries none of its screens, rules or bank calls and cannot
 * drift from them. Switching account-details off removes it; opt.enabled = false is that switch for this entry.
 */
export const accountNickname: Journey = {
  id: "jrn_bankworkx_account_nickname",
  slug: "account-nickname",
  name: "Rename an account",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: accountNicknameAcceptance,
  scenarios: accountNicknameScenarios,
  dataModel: { "launch.accountId": { type: "string" }, "opt.enabled": { type: "boolean" } },
  integrations: [],
  screens: [
    {
      id: "start", title: "Rename an account", kind: "branch",
      onEnter: [{ type: "navigate", toJourney: "account-details", with: { "launch.accountId": "{{launch.accountId}}", "launch.view": "rename" } }],
      navigation: { rules: [{ when: "opt.enabled == false", to: "off" }] },
      blocks: [],
    },
    {
      id: "off", title: "Rename an account", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "Not available", text: "This isn’t available at your bank." },
        { type: "button", label: "Done", variant: "primary", actions: [{ type: "exit" }] },
      ],
    },
  ] as Screen[],
};
