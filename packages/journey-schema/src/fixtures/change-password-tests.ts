import type { Journey } from "../schema";

/** What must be true for "Change password" to be right. Each is proved by at least one scenario below. */
export const changePasswordAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "A wrong current password shows the message and the attempts left; the fifth locks the profile and offers a reset; a right one sets the count back to zero." },
  { id: "AC-2", text: "The new password must differ from the current one and pass every rule, with the message of the first rule it breaks and never an error code." },
  { id: "AC-3", text: "The checklist ticks the length as it is typed and the other rules after Continue; the confirmation must match." },
  { id: "AC-4", text: "A one-time code is required; a wrong code shows the tries left; three wrong codes end the attempt with nothing changed; an expired code asks to go back." },
  { id: "AC-5", text: "After success the new password works at sign-in, the old one does not, and it cannot be reused later." },
  { id: "AC-6", text: "The result shows the date and whether other devices were signed out, following the option signOutOthers." },
  { id: "AC-7", text: "When the bank is unavailable or times out nothing is changed and no wrong attempt is counted." },
  { id: "AC-8", text: "It needs the permission to manage security and a step-up in the last five minutes; without them it says so and changes nothing, and the bank refuses a request that skips a screen." },
  { id: "AC-9", text: "No password is kept: the current one is cleared once the bank has checked it, the new one once the bank has it or the person leaves, and none is ever shown." },
];

// Alex (alex.morgan, mobile ending 0142), signed in and stepped up (the shell does that before it opens the journey); the code is 482100
// (000000 is wrong, 999999 expired). The sandbox clock is pinned.
const NOW = "2026-11-03T10:00:00Z";
const PW = "Bwx!Demo2026";
const NEW_PW = "Harbour-Maple-47-Tide";
type Step = Record<string, unknown>;
const set = (v: Record<string, unknown>): Step => ({ set: v });
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const inspect = (path: string, equals: unknown): Step => ({ expectBank: { adapter: "sandbox.access.inspect", input: { username: "alex.morgan" }, path, equals } });
const signs = (pw: string, path: string, equals: unknown): Step => ({ expectBank: { adapter: "bank.auth.signIn", input: { username: "alex.morgan", password: pw }, path, equals } });
const base = { persona: "alex", context: "personal", now: NOW };
const cur = (pw = PW): Step[] => [set({ "cp.current": pw }), press("Continue")];
const newpw = (pw: string, confirm = pw): Step[] => [set({ "cp.new": pw, "cp.confirm": confirm }), press("Continue")];
const code = (c = "482100"): Step[] => [set({ "cp.code": c }), press("Confirm")];
const SORRY = "This isn’t available right now. Nothing was changed. Try again in a few minutes.";
const SLOW = "This is taking longer than expected. Nothing was changed.";
const toCode: Step[] = [...cur(), ...newpw(NEW_PW)];
/** The password was changed once already (so the demo password has been used before and the current one is NEW_PW). */
const changed = [
  { adapter: "bank.otp.send", input: { strict: true } }, { adapter: "bank.otp.verify", input: { code: "482100", strict: true } },
  { adapter: "bank.password.change", input: { current: PW, new: NEW_PW, confirm: NEW_PW } },
];

export const changePasswordScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "A wrong current password says so with the attempts left; the fifth locks the profile and offers a reset", covers: ["AC-1"], ...base,
    steps: [
      screen("cur"), text("Current password"), ...cur("wrong-wrong-12"), text("That isn’t your current password."), text("4 attempts left."), noText("INVALID"),
      ...cur("wrong-wrong-12"), text("3 attempts left."), ...cur("wrong-wrong-12"), ...cur("wrong-wrong-12"), text("1 attempt left."), screen("cur"),
      ...cur("wrong-wrong-12"), screen("locked"), text("Account locked"), text("Too many wrong passwords."), text("Reset password"), text("Contact support"), inspect("locked", true),
      press("Contact support"), text("Call us on +1 800 555 0100 (sandbox number)."),
      press("Reset password"), { expectOpens: { journey: "reset-password", with: { "launch.mode": "reset" } } }, text("Reset your password"),
    ],
  },
  {
    id: "T-2", name: "A right current password sets the count of wrong ones back to zero", covers: ["AC-1"], ...base,
    steps: [...cur("wrong-wrong-12"), ...cur("wrong-wrong-12"), inspect("failedSignIns", 2), ...cur(), screen("new"), text("New password"), inspect("failedSignIns", 0), noText(PW)],
  },
  {
    id: "T-3", name: "Each rule has its own message, the first one broken is the one shown, and a different confirmation is refused", covers: ["AC-2", "AC-3"], ...base,
    steps: [
      ...cur(),
      ...newpw(PW), text("Choose a different password."), screen("new"),
      ...newpw("short"), text("Use at least 12 characters. Three or four unrelated words work well."), noText("Choose a different password."),
      ...newpw("x".repeat(65)), text("Use 64 characters or fewer."),
      ...newpw("my-alex.morgan-pass-1"), text("Don’t use your username in your password."),
      ...newpw("Password123!Password"), text("That password is too common. Try a longer phrase of unrelated words."),
      ...newpw("Winter2024!Winter"), text("This password has appeared in a data breach, so we can’t accept it."),
      ...newpw(NEW_PW, "something else entirely"), text("The two passwords don’t match."), screen("new"),
      noText("MIN_LENGTH"), noText("PASSWORD_"), noText("MISMATCH"),
      ...newpw(NEW_PW), screen("code"),
    ],
  },
  {
    id: "T-4", name: "The checklist ticks the length as it is typed and the other rules once the bank has judged the password", covers: ["AC-3"], ...base,
    steps: [
      ...cur(), text("○ At least 12 characters"), set({ "cp.new": "Granite-Lemon" }), text("✓ At least 12 characters"), set({ "cp.new": "short" }), text("○ At least 12 characters"),
      text("○ Not a common password"), ...newpw("Winter2024!Winter"), text("✓ Not your username"), text("✓ Not a common password"), text("○ Not in a known data breach"), text("✓ At least 12 characters"),
      ...newpw("Password123!Password"), text("○ Not a common password"), text("✓ Not in a known data breach"),
    ],
  },
  {
    id: "T-5", name: "A wrong code says so with the tries left; the third ends the attempt, even the right code is refused, nothing is changed and the person starts again", covers: ["AC-4"], ...base,
    steps: [
      ...toCode, text("Sent to the phone ending 0142."), ...code("000000"), screen("code"), text("That code isn’t right. Try again."), text("2 tries left."),
      ...code("000000"), text("1 try left."), ...code("000000"), screen("codeLocked"), text("Too many wrong codes"), text("Nothing was changed. Go back to start again."),
      { expectBankError: { adapter: "bank.otp.verify", input: { code: "482100", strict: true }, code: "OTP_LOCKED" } },
      signs(PW, "ok", true), signs(NEW_PW, "code", "INVALID_CREDENTIALS"),
      press("Back to start"), screen("cur"), ...toCode, ...code(), screen("done"),
    ],
  },
  {
    id: "T-6", name: "An expired code asks to go back and get a new one; going back empties the password fields", covers: ["AC-4", "AC-9"], ...base,
    steps: [
      ...toCode, ...code("999999"), text("That code has expired. Go back to get a new one."), noText("Confirm"), noText("Resend code"), press("Back"), screen("new"), noText(NEW_PW),
      ...newpw(NEW_PW), screen("code"), ...code(), screen("done"),
    ],
  },
  {
    id: "T-24", name: "A code that waited five minutes has run out too", covers: ["AC-4"], ...base,
    steps: [...toCode, { advance: 301 }, ...code("482100"), text("That code has expired. Go back to get a new one."), screen("code"), signs(PW, "ok", true)],
  },
  {
    id: "T-7", name: "A new code makes the old one useless and the fourth resend is refused", covers: ["AC-4"], ...base,
    steps: [
      ...toCode, press("Resend code"), ...code("482100"), text("That code isn’t right."), press("Resend code"), press("Resend code"), noText("You have asked for the maximum number of codes."),
      press("Resend code"), text("You have asked for the maximum number of codes. Try again later."), ...code("482103"), screen("done"),
    ],
  },
  {
    id: "T-8", name: "A password change: \"Password changed\" with the date and the other devices signed out; the new password signs in, the old one does not, and no password is shown", covers: ["AC-5", "AC-6", "AC-9"], ...base,
    steps: [
      ...toCode, ...code(), screen("done"), text("Password changed"), text("Use your new password next time you sign in."), text("3 Nov 2026"), text("Other devices"), text("Signed out"), text("Back to security"), text("Done"),
      noText(NEW_PW), noText(PW), signs(NEW_PW, "ok", true), signs(PW, "code", "INVALID_CREDENTIALS"),
      { expectBankError: { adapter: "bank.password.change", input: { new: "Another-Phrase-77-Meadow", confirm: "Another-Phrase-77-Meadow" }, code: "OTP_REQUIRED" } },
    ],
  },
  {
    id: "T-9", name: "A password the person had before cannot be chosen again, and the current one cannot either", covers: ["AC-5", "AC-2"], ...base, setup: changed,
    steps: [
      ...cur(NEW_PW), ...newpw(PW), text("Choose a password you haven’t used here before."), screen("new"), ...newpw(NEW_PW), text("Choose a different password."), noText("haven’t used here before"),
      ...newpw("Another-Phrase-77-Meadow"), screen("code"),
    ],
  },
  {
    id: "T-10", name: "With signOutOthers off the result says the other devices are still signed in", covers: ["AC-6"], ...base, launch: { "opt.signOutOthers": false },
    steps: [...toCode, ...code(), screen("done"), text("Other devices"), text("Still signed in"), noText("Signed out")],
  },
  {
    id: "T-11", name: "The bank is unavailable when the password is saved: nothing changed, and the new password is not kept", covers: ["AC-7", "AC-9"], ...base, conditions: { unavailable: ["bank.password.change"] },
    steps: [...toCode, ...code(), screen("problem"), text(SORRY), noText(NEW_PW), signs(PW, "ok", true), signs(NEW_PW, "code", "INVALID_CREDENTIALS"), press("Try again"), screen("cur")],
  },
  {
    id: "T-12", name: "The bank times out when the password is saved: told so, nothing changed", covers: ["AC-7"], ...base, conditions: { timeout: ["bank.password.change"] },
    steps: [...toCode, ...code(), screen("problem"), text(SLOW), signs(PW, "ok", true)],
  },
  {
    id: "T-13", name: "The bank is unavailable when the current password is checked: no wrong attempt is counted", covers: ["AC-7"], ...base, conditions: { unavailable: ["bank.password.check"] },
    steps: [...cur("wrong-wrong-12"), screen("problem"), text(SORRY), inspect("failedSignIns", 0)],
  },
  {
    id: "T-14", name: "The bank times out when the rules are checked: told so, and the new password is not kept", covers: ["AC-7"], ...base, conditions: { timeout: ["bank.password.policy"] },
    steps: [...cur(), ...newpw(NEW_PW), screen("problem"), text(SLOW), noText(NEW_PW)],
  },
  {
    id: "T-15", name: "The code cannot be sent just now: nothing changed", covers: ["AC-7"], ...base, conditions: { unavailable: ["bank.otp.send"] },
    steps: [...toCode, screen("problem"), text(SORRY), noText(NEW_PW), signs(PW, "ok", true)],
  },
  {
    id: "T-16", name: "The code cannot be checked just now: nothing changed", covers: ["AC-7"], ...base, conditions: { timeout: ["bank.otp.verify"] },
    steps: [...toCode, ...code(), screen("problem"), text(SLOW), signs(PW, "ok", true)],
  },
  {
    id: "T-17", name: "Without a step-up the journey says so at the first check and changes nothing; the bank refuses a forged change", covers: ["AC-8"], persona: "alex", now: NOW,
    steps: [
      ...cur(), screen("stepup"), text("Confirm it’s you first"), text("Nothing was changed."),
      { expectBankError: { adapter: "bank.password.change", input: { current: PW, new: NEW_PW, confirm: NEW_PW }, code: "STEP_UP_REQUIRED" } },
      { expectBankError: { adapter: "bank.password.check", input: { current: PW }, code: "STEP_UP_REQUIRED" } },
      signs(PW, "ok", true), press("Done"),
    ],
  },
  {
    id: "T-18", name: "A step-up that runs out while the person is choosing the password is asked for again, and nothing is changed", covers: ["AC-8", "AC-9"], ...base,
    steps: [...cur(), { advance: 280 }, ...newpw(NEW_PW), { advance: 30 }, ...code(), screen("stepup"), text("Confirm it’s you first"), noText(NEW_PW), signs(PW, "ok", true), signs(NEW_PW, "code", "INVALID_CREDENTIALS")],
  },
  {
    id: "T-19", name: "Working as a company without the permission: not available", covers: ["AC-8"], persona: "alex", context: "alpha", now: NOW,
    steps: [screen("denied"), text("This isn’t available for your profile."), press("Done")],
  },
  {
    id: "T-20", name: "The bank has the last word on the new password: a password it refuses after the code goes back to the choice", covers: ["AC-2", "AC-9"], ...base,
    steps: [...toCode, set({ "cp.new": "short", "cp.confirm": "short" }), ...code(), screen("new"), text("That didn’t work. Nothing was changed. Choose the new password again."), noText("short"), signs(PW, "ok", true)],
  },
  {
    id: "T-21", name: "The bank refuses a change without the code, without the current password checked, or with a wrong one; the bank's own rules hold", covers: ["AC-8", "AC-2"], ...base,
    steps: [
      { expectBankError: { adapter: "bank.password.change", input: { new: NEW_PW, confirm: NEW_PW }, code: "OTP_REQUIRED" } },
      { expectBank: { adapter: "bank.otp.send", input: { strict: true }, path: "sent", equals: true } },
      { expectBank: { adapter: "bank.otp.verify", input: { code: "482100", strict: true }, path: "verified", equals: true } },
      { expectBankError: { adapter: "bank.password.change", input: { new: NEW_PW, confirm: NEW_PW }, code: "PASSWORD_NOT_VERIFIED" } },
      { expectBankError: { adapter: "bank.password.change", input: { current: "wrong-wrong-12", new: NEW_PW, confirm: NEW_PW }, code: "INVALID_PASSWORD" } },
      { expectBank: { adapter: "bank.password.change", input: { current: PW, new: PW, confirm: PW }, path: "code", equals: "PASSWORD_SAME" } },
      { expectBank: { adapter: "bank.password.change", input: { current: PW, new: "short", confirm: "short" }, path: "code", equals: "MIN_LENGTH" } },
      signs(PW, "ok", true),
    ],
  },
  {
    id: "T-23", name: "Nothing is sent without a current password or a new one", covers: ["AC-2", "AC-9"], ...base,
    steps: [press("Continue"), { expectError: "cp.current" }, screen("cur"), ...cur(), press("Continue"), { expectError: "cp.new" }, screen("new")],
  },
  {
    id: "T-25", name: "An empty code is not sent and does not count as a wrong one", covers: ["AC-4"], ...base,
    steps: [...toCode, press("Confirm"), { expectError: "cp.code" }, screen("code"), noText("tries left"), set({ "cp.code": "12" }), press("Confirm"), screen("code"), noText("tries left"), ...code(), screen("done")],
  },
  {
    id: "T-22", name: "The result and the notice can be closed", covers: ["AC-6"], ...base,
    steps: [...toCode, ...code(), press("Back to security")],
  },
];
