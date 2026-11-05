import type { Journey } from "../schema";

/** What must be true for "Forgot password" to be right. It is the name of the "Forgot password?" link; every rule of the reset is Reset password's and proved there. */
export const forgotPasswordAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "It opens Reset password in its reset mode, with the username it was given, and carries none of its screens or bank calls." },
  { id: "AC-2", text: "It works end to end from the link: the code, a new password, and the new password then signs in." },
  { id: "AC-3", text: "When the bank has switched resetting a password off it says so and opens nothing." },
];

const NOW = "2026-11-03T10:00:00Z";
const PW = "Bwx!Demo2026";
const NEW_PW = "Granite-Lemon-92-River";
type Step = Record<string, unknown>;
const base = { persona: "signed-out", now: NOW };

export const forgotPasswordScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "Opens the reset in its reset mode with the username that was given", covers: ["AC-1"], ...base, launch: { "launch.user": "alex.morgan" },
    steps: [{ expectOpens: { journey: "reset-password", with: { "launch.mode": "reset", "launch.user": "alex.morgan" } } }, { expectScreen: "ident" }, { expectText: "Reset your password" }, { expectText: "alex.morgan" }],
  },
  {
    id: "T-2", name: "Without a username it still opens the reset, with the field empty", covers: ["AC-1"], ...base,
    steps: [{ expectOpens: { journey: "reset-password", with: { "launch.mode": "reset" } } }, { expectScreen: "ident" }, { expectNoText: "alex.morgan" }],
  },
  {
    id: "T-3", name: "From the link to a new password that signs in", covers: ["AC-2"], ...base, launch: { "launch.user": "alex.morgan" },
    steps: [
      { press: "Continue" }, { set: { "rp.code": "482100" } }, { press: "Continue" }, { set: { "rp.password": NEW_PW, "rp.confirm": NEW_PW } }, { press: "Finish" } as Step,
      { expectText: "Password changed" } as Step,
      { expectBank: { adapter: "bank.auth.signIn", input: { username: "alex.morgan", password: NEW_PW }, path: "ok", equals: true } },
      { expectBank: { adapter: "bank.auth.signIn", input: { username: "alex.morgan", password: PW }, path: "ok", equals: false } },
    ],
  },
  {
    id: "T-4", name: "When the bank switched resetting off it says so and opens nothing", covers: ["AC-3"], ...base, launch: { "opt.resetPassword": false },
    steps: [{ expectScreen: "off" }, { expectText: "Resetting a password isn’t available" }, { expectText: "Please contact the bank." }, { expectNoText: "Reset your password" }, { press: "Done" }],
  },
];
