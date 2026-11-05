import type { Journey } from "../schema";

/** What must be true for "Reset password" (and its two entries, Forgot password and Unlock account) to be right. Each is proved by at least one scenario below. */
export const resetPasswordAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "A reset needs the username or the email, then a correct code, then a password that follows the rules and is confirmed." },
  { id: "AC-2", text: "The code goes to the mobile number on file, shown only as its last 4 digits; a wrong code counts toward the lock; an expired code asks for a new one; at most 3 resends." },
  { id: "AC-3", text: "Three wrong identity checks or codes lock the journey with \"Too many tries\" and a way to contact the bank." },
  { id: "AC-4", text: "After a reset the new password works at sign-in, the old one does not, any lock is cleared, and the new password cannot be reused later." },
  { id: "AC-5", text: "Unlock keeps the password, clears the lock, and says so when the profile was not locked." },
  { id: "AC-6", text: "With allowUnlock off an unlock link opens a reset." },
  { id: "AC-7", text: "A new password is refused for its length, the username, a common word, a known breach and an earlier use, each with its own message and never an error code; the checklist shows the length as it is typed." },
  { id: "AC-8", text: "When the bank is unavailable or times out nothing is changed." },
  { id: "AC-9", text: "The reset token runs out after ten minutes, cannot be used without the code, and, like the new password, is not kept by the journey once the bank has it." },
  { id: "AC-10", text: "From the result the person goes on to Sign in with the username." },
];

// Alex (alex.morgan, alex.morgan@example.com, mobile ending 0142) and the locked profile demo.locked; the code is 482100 (000000 wrong, 999999 expired).
const NOW = "2026-11-03T10:00:00Z";
const PW = "Bwx!Demo2026";
const NEW_PW = "Granite-Lemon-92-River";
type Step = Record<string, unknown>;
const set = (v: Record<string, unknown>): Step => ({ set: v });
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const error = (e: string): Step => ({ expectError: e });
const inspect = (user: string, path: string, equals: unknown): Step => ({ expectBank: { adapter: "sandbox.access.inspect", input: { username: user }, path, equals } });
const signs = (user: string, pw: string, path: string, equals: unknown): Step => ({ expectBank: { adapter: "bank.auth.signIn", input: { username: user, password: pw }, path, equals } });
const base = { persona: "signed-out", now: NOW };
const who = (user = "alex.morgan"): Step[] => [set({ "rp.user": user }), press("Continue")];
const code = (c = "482100"): Step[] => [set({ "rp.code": c }), press("Continue")];
const newpw = (pw = NEW_PW, confirm = pw): Step[] => [set({ "rp.password": pw, "rp.confirm": confirm }), press("Finish")];
const SORRY = "We couldn’t reach the bank. Nothing was changed.";
const SLOW = "This is taking longer than expected. Nothing was changed.";
const NOT_FOUND = "We couldn’t find a profile with those details. Check them and try again.";
const UNLOCK = { "launch.mode": "unlock", "launch.user": "demo.locked" };

export const resetPasswordScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "The username, the code, a new password twice: \"Password changed\"; the new password signs in, the old one does not, and nothing is kept", covers: ["AC-1", "AC-4", "AC-9"], ...base,
    steps: [
      screen("ident"), text("Reset your password"), ...who(), screen("code"), text("We sent a 6-digit code to ••• 0142."), ...code(), screen("newpw"), text("Choose a new password"), ...newpw(),
      screen("resetDone"), text("Password changed"), text("Sign in with your new password."), text("Done"), text("alex.morgan"), text("03 / 11 / 2026"), noText(NEW_PW),
      signs("alex.morgan", NEW_PW, "ok", true), signs("alex.morgan", PW, "code", "INVALID_CREDENTIALS"),
      { expectBankError: { adapter: "bank.recover.resetPassword", input: { recoveryToken: "{{found.recoveryToken}}", password: "Another-Phrase-77-Meadow" }, code: "TOKEN_INVALID" } },
    ],
  },
  {
    id: "T-2", name: "By the email on file the same code goes to the mobile number on file", covers: ["AC-1", "AC-2"], ...base,
    steps: [...who("alex.morgan@example.com"), screen("code"), text("We sent a 6-digit code to ••• 0142."), ...code(), screen("newpw")],
  },
  {
    id: "T-3", name: "A new password is refused for each rule with its message, the fields are emptied, a different confirmation is refused, a good phrase is accepted", covers: ["AC-1", "AC-7"], ...base,
    steps: [
      ...who(), ...code(), ...newpw("short"), error("Use at least 12 characters. Three or four unrelated words work well."), screen("newpw"),
      ...newpw("x".repeat(65)), text("Use 64 characters or fewer."), noText("xxxxxxxxxxxx"),
      ...newpw("my-alex.morgan-pass-1"), text("Don’t use your username in your password."),
      ...newpw("Password123!Password"), text("That password is too common. Try a longer phrase of unrelated words."),
      ...newpw("Winter2024!Winter"), text("This password has appeared in a data breach, so we can’t accept it."),
      ...newpw(PW), text("Choose a password you haven’t used here before."),
      ...newpw(NEW_PW, "something else entirely"), text("The two passwords don’t match."), noText("INVALID"), noText("MISMATCH"), noText("PASSWORD_"), screen("newpw"),
      ...newpw(), screen("resetDone"),
    ],
  },
  {
    id: "T-4", name: "The checklist shows the length as it is typed", covers: ["AC-7"], ...base,
    steps: [...who(), ...code(), text("○ At least 12 characters"), set({ "rp.password": "Granite-Lemon" }), text("✓ At least 12 characters"), set({ "rp.password": "short" }), text("○ At least 12 characters")],
  },
  {
    id: "T-5", name: "A wrong code says so; an expired code asks for a new one; the code is checked before it is sent", covers: ["AC-2"], ...base,
    steps: [
      ...who(), press("Continue"), error("rp.code"), ...code("000000"), screen("code"), text("That code isn’t right. Check the latest message and try again."),
      ...code("999999"), text("That code has expired. Ask for a new one."), press("Resend code"), ...code("482101"), screen("newpw"),
    ],
  },
  {
    id: "T-6", name: "A new code makes the old one useless; a fourth resend is refused", covers: ["AC-2"], ...base,
    steps: [
      ...who(), press("Resend code"), ...code("482100"), text("That code isn’t right."), press("Resend code"), press("Resend code"), noText("You have asked for the maximum number of codes."),
      press("Resend code"), text("You have asked for the maximum number of codes. Try again later."), ...code("482103"), screen("newpw"),
    ],
  },
  {
    id: "T-7", name: "A profile nobody has gets the same message twice and the third miss locks the journey", covers: ["AC-3"], ...base,
    steps: [
      ...who("nobody"), screen("ident"), text(NOT_FOUND), ...who("nobody"), text(NOT_FOUND), ...who("nobody"), screen("locked"), text("Too many tries"), text("For your security, try again in 30 minutes, or contact us."),
      press("Contact us"), text("Call us on +1 800 555 0100 (sandbox number)."),
    ],
  },
  {
    id: "T-8", name: "One identity miss and two wrong codes lock the journey: the same lock", covers: ["AC-3"], ...base,
    steps: [...who("nobody"), ...who(), screen("code"), ...code("111111"), screen("code"), ...code("111111"), screen("locked"), text("Too many tries")],
  },
  {
    id: "T-9", name: "A reset clears the lock: the locked profile signs in with its new password", covers: ["AC-4"], ...base,
    steps: [
      inspect("demo.locked", "locked", true), ...who("demo.locked"), ...code(), ...newpw(), screen("resetDone"), inspect("demo.locked", "locked", false),
      signs("demo.locked", NEW_PW, "ok", true), signs("demo.locked", PW, "code", "INVALID_CREDENTIALS"),
    ],
  },
  {
    id: "T-10", name: "Unlock keeps the password: the locked profile signs in with the old one", covers: ["AC-5"], ...base, launch: UNLOCK,
    steps: [
      screen("ident"), text("Unlock your account"), text("demo.locked"), press("Continue"), screen("code"), ...code(), screen("unlock"), text("Your password stays the same."), noText("Choose a new password"),
      press("Unlock account"), screen("unlockDone"), text("Account unlocked"), text("You can sign in now. Your password hasn’t changed."), text("Unlocked"), text("demo.locked"),
      inspect("demo.locked", "locked", false), signs("demo.locked", PW, "ok", true),
      press("Sign in"), { expectOpens: { journey: "sign-in", with: { "launch.user": "demo.locked" } } }, screen("credentials"), text("demo.locked"),
    ],
  },
  {
    id: "T-11", name: "Unlocking a profile that was not locked says so", covers: ["AC-5"], ...base, launch: { "launch.mode": "unlock", "launch.user": "sam.rivera" },
    steps: [press("Continue"), ...code(), press("Unlock account"), screen("unlockDone"), text("Your account isn’t locked"), text("You can sign in now."), noText("Your password hasn’t changed.")],
  },
  {
    id: "T-12", name: "With allowUnlock off an unlock link opens a reset", covers: ["AC-6"], ...base, launch: { ...UNLOCK, "opt.allowUnlock": false },
    steps: [screen("ident"), text("Reset your password"), noText("Unlock your account"), press("Continue"), ...code(), screen("newpw"), noText("Unlock account")],
  },
  {
    id: "T-13", name: "Without a mode it is a reset, and the username it was given is filled in", covers: ["AC-6", "AC-1"], ...base, launch: { "launch.user": "alex.morgan" },
    steps: [text("Reset your password"), text("alex.morgan")],
  },
  {
    id: "T-14", name: "The username or email is checked before it is sent", covers: ["AC-1"], ...base,
    steps: [press("Continue"), error("rp.user"), set({ "rp.user": "ab" }), press("Continue"), error("Enter your username or the email address we have for you."), screen("ident")],
  },
  {
    id: "T-15", name: "The token cannot be used without the code, or with another one; a reset that waited ten minutes has run out and changes nothing", covers: ["AC-9"], ...base,
    steps: [
      ...who(), screen("code"),
      { expectBankError: { adapter: "bank.recover.resetPassword", input: { recoveryToken: "{{found.recoveryToken}}", password: NEW_PW }, code: "OTP_REQUIRED" } },
      { expectBankError: { adapter: "bank.recover.unlock", input: { recoveryToken: "rt_not_mine" }, code: "TOKEN_INVALID" } },
      ...code(), screen("newpw"), { advance: 601 }, ...newpw(), screen("expired"), text("That took too long"), text("Nothing was changed."), signs("alex.morgan", PW, "ok", true), signs("alex.morgan", NEW_PW, "code", "INVALID_CREDENTIALS"),
      press("Start again"), screen("ident"),
    ],
  },
  {
    id: "T-16", name: "The bank is unavailable when the new password is saved: nothing changed", covers: ["AC-8", "AC-9"], ...base, conditions: { unavailable: ["bank.recover.resetPassword"] },
    steps: [...who(), ...code(), ...newpw(), screen("problem"), text(SORRY), noText(NEW_PW), press("Try again"), screen("ident"), signs("alex.morgan", PW, "ok", true)],
  },
  {
    id: "T-17", name: "The bank times out when the new password is saved: told so, nothing changed", covers: ["AC-8"], ...base, conditions: { timeout: ["bank.recover.resetPassword"] },
    steps: [...who(), ...code(), ...newpw(), screen("problem"), text(SLOW), signs("alex.morgan", PW, "ok", true)],
  },
  {
    id: "T-18", name: "The bank is unavailable when the profile is unlocked: it stays locked", covers: ["AC-8"], ...base, launch: UNLOCK, conditions: { unavailable: ["bank.recover.unlock"] },
    steps: [press("Continue"), ...code(), press("Unlock account"), screen("problem"), text(SORRY), inspect("demo.locked", "locked", true)],
  },
  {
    id: "T-19", name: "The bank is unavailable when the profile is looked for", covers: ["AC-8"], ...base, conditions: { unavailable: ["bank.recover.verifyUser"] },
    steps: [...who(), screen("problem"), text(SORRY)],
  },
  {
    id: "T-20", name: "The code cannot be sent just now: nothing changed", covers: ["AC-8"], ...base, conditions: { unavailable: ["bank.otp.send"] },
    steps: [...who(), screen("problem"), text(SORRY)],
  },
  {
    id: "T-21", name: "The code cannot be checked just now: nothing changed", covers: ["AC-8"], ...base, conditions: { timeout: ["bank.otp.verify"] },
    steps: [...who(), ...code(), screen("problem"), text(SLOW), signs("alex.morgan", PW, "ok", true)],
  },
  {
    id: "T-22", name: "From the result the person signs in with the username", covers: ["AC-10"], ...base,
    steps: [...who(), ...code(), ...newpw(), press("Sign in"), { expectOpens: { journey: "sign-in", with: { "launch.user": "alex.morgan" } } }, screen("credentials"), text("alex.morgan")],
  },
  {
    id: "T-23", name: "The result can be closed", covers: ["AC-10"], ...base,
    steps: [...who(), ...code(), ...newpw(), press("Done")],
  },
];
