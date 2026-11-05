import type { Journey } from "../schema";

/** What must be true for "Unlock account" to be right. It is Reset password in its unlock mode; every rule of the recovery is Reset password's and proved there. */
export const unlockAccountAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "It opens Reset password in its unlock mode, with the username it was given, and carries none of its screens or bank calls." },
  { id: "AC-2", text: "It unlocks a locked profile after the code and keeps the password: the old password signs in." },
  { id: "AC-3", text: "It says so when the profile was not locked." },
  { id: "AC-4", text: "When the bank switched unlocking off it says so and offers the reset instead." },
];

const NOW = "2026-11-03T10:00:00Z";
const PW = "Bwx!Demo2026";
const base = { persona: "signed-out", now: NOW };
const finish = [{ press: "Continue" }, { set: { "rp.code": "482100" } }, { press: "Continue" }, { press: "Unlock account" }];

export const unlockAccountScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "Opens the reset in its unlock mode with the username that was given", covers: ["AC-1"], ...base, launch: { "launch.user": "demo.locked" },
    steps: [{ expectOpens: { journey: "reset-password", with: { "launch.mode": "unlock", "launch.user": "demo.locked" } } }, { expectScreen: "ident" }, { expectText: "Unlock your account" }, { expectText: "demo.locked" }],
  },
  {
    id: "T-2", name: "A locked profile is unlocked after the code and signs in with its old password", covers: ["AC-2"], ...base, launch: { "launch.user": "demo.locked" },
    steps: [
      ...finish, { expectText: "Account unlocked" }, { expectText: "Your password hasn’t changed." },
      { expectBank: { adapter: "sandbox.access.inspect", input: { username: "demo.locked" }, path: "locked", equals: false } },
      { expectBank: { adapter: "bank.auth.signIn", input: { username: "demo.locked", password: PW }, path: "ok", equals: true } },
    ],
  },
  {
    id: "T-3", name: "A profile that was not locked is told so", covers: ["AC-3"], ...base, launch: { "launch.user": "sam.rivera" },
    steps: [...finish, { expectText: "Your account isn’t locked" }, { expectText: "You can sign in now." }],
  },
  {
    id: "T-4", name: "When the bank switched unlocking off it says so and offers the reset instead", covers: ["AC-4"], ...base, launch: { "opt.allowUnlock": false, "launch.user": "demo.locked" },
    steps: [
      { expectScreen: "off" }, { expectText: "Unlocking isn’t available" }, { expectText: "You can reset your password instead." }, { expectNoText: "Unlock your account" },
      { press: "Reset password" }, { expectOpens: { journey: "reset-password", with: { "launch.mode": "reset", "launch.user": "demo.locked" } } }, { expectText: "Reset your password" },
    ],
  },
  {
    id: "T-5", name: "Done closes the notice", covers: ["AC-4"], ...base, launch: { "opt.allowUnlock": false },
    steps: [{ expectScreen: "off" }, { press: "Done" }],
  },
];
