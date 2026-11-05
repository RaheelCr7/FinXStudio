import type { Journey } from "../schema";

/** What must be true for "Rename an account" to be right. It is account-details opened at its Rename step, so the rules are proved there and here only that it opens it. */
export const accountNicknameAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "It opens account-details at Rename for the account it is given, with no screen or bank call of its own." },
  { id: "AC-2", text: "The name is saved with the rules of account-details (2 to 24 allowed characters, not another account's name) and the account then shows it." },
  { id: "AC-3", text: "When the bank has switched it off it says \"This isn’t available at your bank.\" without opening account-details." },
];

const NOW = "2026-11-03T10:00:00Z";
type Step = Record<string, unknown>;
const set = (v: Record<string, unknown>): Step => ({ set: v });
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const base = { persona: "alex", now: NOW, launch: { "launch.accountId": "acc_save" } };

export const accountNicknameScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "It opens account-details at Rename for the account it is given", covers: ["AC-1"], ...base,
    steps: [{ expectOpens: { journey: "account-details", with: { "launch.accountId": "acc_save", "launch.view": "rename" } } }, screen("nick"), text("Rename account"), text("Savings account ••7731")],
  },
  {
    id: "T-2", name: "Rename Savings to Holiday fund: Name saved, and the account shows it; a name another account has is refused", covers: ["AC-2"], ...base,
    steps: [
      set({ "ad.name": "eur travel" }), press("Save"), screen("nick"), text("You already have an account with this name."),
      set({ "ad.name": "Holiday fund" }), press("Save"), screen("main"), text("Name saved"), text("Holiday fund ••7731"),
    ],
  },
  {
    id: "T-3", name: "Use the original name takes the name away", covers: ["AC-2"], ...base,
    setup: [{ adapter: "bank.accounts.rename", input: { accountId: "acc_save", nickname: "Holiday fund" } }],
    steps: [text("Use the original name"), press("Use the original name"), text("Name reset"), text("Savings ••7731"), noText("Holiday fund")],
  },
  {
    id: "T-4", name: "When the bank has switched it off it says so and opens nothing", covers: ["AC-3"], ...base, launch: { "launch.accountId": "acc_save", "opt.enabled": false },
    steps: [screen("off"), text("Not available"), text("This isn’t available at your bank."), noText("Rename account"), press("Done")],
  },
];
