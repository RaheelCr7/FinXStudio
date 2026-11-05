import type { Journey } from "../schema";

/** What must be true for "Forgot username" to be right. Each is proved by at least one scenario below. */
export const forgotUsernameAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "A match needs the contact and the date of birth together; the message after a miss does not say which part failed." },
  { id: "AC-2", text: "The mobile number and the email follow their formats and the date of birth must be a real date in the past; nothing is sent to the bank until they do." },
  { id: "AC-3", text: "The code goes to the contact that matched and the screen shows it masked; a code is needed before anything is sent." },
  { id: "AC-4", text: "A wrong code counts toward the same lock as the identity check, so three misses lock the journey with \"Too many tries\"; an expired code asks for a new one; at most 3 resends." },
  { id: "AC-5", text: "The username is never shown on screen and never kept by the journey; the bank sends it to the contact it holds, and the result says it was sent and where." },
  { id: "AC-6", text: "With allowEmail off only the mobile number is offered." },
  { id: "AC-7", text: "When the bank is unavailable or times out nothing is sent." },
  { id: "AC-8", text: "A recovery that took more than ten minutes has run out: the person is told to start again." },
  { id: "AC-9", text: "From the result the person goes on to Sign in or Reset password." },
];

// Alex's mobile is +1 415 555 0142, his email alex.morgan@example.com and he was born on 14 March 1988. The code is 482100 (000000 is wrong, 999999 expired).
const NOW = "2026-11-03T10:00:00Z";
type Step = Record<string, unknown>;
const set = (v: Record<string, unknown>): Step => ({ set: v });
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const error = (e: string): Step => ({ expectError: e });
const inspect = (path: string, equals: unknown): Step => ({ expectBank: { adapter: "sandbox.access.inspect", input: { username: "alex.morgan" }, path, equals } });
const base = { persona: "signed-out", now: NOW };
const MINE = { "fu.mobile": "(415) 555-0142", "fu.dob": "1988-03-14" };
const NO_MATCH = "We couldn’t match those details. Check them and try again.";
const find = (v: Record<string, unknown> = MINE): Step[] => [set(v), press("Continue")];
const code = (c = "482100"): Step[] => [set({ "fu.code": c }), press("Send my username")];
const SORRY = "We couldn’t reach the bank. Nothing was changed.";
const SLOW = "This is taking longer than expected. Nothing was changed.";

export const forgotUsernameScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "The mobile number and the date of birth, then the code: \"We sent your username\" and where, with no username on screen", covers: ["AC-1", "AC-3", "AC-5"], ...base,
    steps: [
      screen("find"), text("Forgot your username?"), text("Tell us how to find you."), ...find(), screen("code"), text("We sent a 6-digit code to ••• 0142."),
      ...code(), screen("result"), text("We sent your username"), text("Check your messages. We never send your password."), text("Sent to"), text("••• 0142"), noText("alex.morgan"), noText("Alex"),
      inspect("outbox", [{ to: "••• 0142", kind: "username" }]),
    ],
  },
  {
    id: "T-2", name: "By email: the code goes to the email on file, masked, and so does the username", covers: ["AC-2", "AC-3", "AC-5"], ...base,
    steps: [
      ...find({ "fu.by": "email", "fu.email": "alex.morgan@example.com", "fu.dob": "1988-03-14" }), screen("code"), text("We sent a 6-digit code to a•••@example.com."),
      ...code(), screen("result"), text("a•••@example.com"), noText("alex.morgan"), inspect("outbox", [{ to: "a•••@example.com", kind: "username" }]),
    ],
  },
  {
    id: "T-3", name: "The formats and the date are checked before anything is sent", covers: ["AC-2"], ...base,
    steps: [
      press("Continue"), error("fu.mobile"), error("fu.dob"),
      set({ "fu.mobile": "12", "fu.dob": "1988-03-14" }), press("Continue"), error("Enter a valid mobile number."), screen("find"),
      set({ "fu.mobile": "(415) 555-0142", "fu.dob": "2999-01-01" }), press("Continue"), error("Enter a date in the past."),
      set({ "fu.dob": "1988-02-31" }), press("Continue"), error("fu.dob"),
      set({ "fu.by": "email", "fu.email": "not-an-email" }), set({ "fu.dob": "1988-03-14" }), press("Continue"), error("Enter a valid email address."), screen("find"),
    ],
  },
  {
    id: "T-4", name: "A wrong date of birth and a wrong contact get the same message; the third miss locks the journey with \"Too many tries\"", covers: ["AC-1", "AC-4"], ...base,
    steps: [
      ...find({ ...MINE, "fu.dob": "1990-01-01" }), text(NO_MATCH), screen("find"),
      ...find({ "fu.mobile": "(415) 555-0000", "fu.dob": "1988-03-14" }), text(NO_MATCH),
      ...find({ ...MINE, "fu.dob": "1990-01-01" }), screen("locked"), text("Too many tries"), text("For your security, try again in 30 minutes, or contact us."), text("Contact us"), noText("Send my username"),
      press("Contact us"), text("Call us on +1 800 555 0100 (sandbox number)."),
    ],
  },
  {
    id: "T-5", name: "A wrong code says so and counts; an expired code asks for a new one; a new code works", covers: ["AC-4"], ...base,
    steps: [
      ...find(), ...code("000000"), screen("code"), text("That code isn’t right. Check the latest message and try again."),
      ...code("999999"), text("That code has expired. Ask for a new one."), press("Resend code"), { expectToast: "New code sent. The old code no longer works." }, ...code("482101"), screen("result"),
    ],
  },
  {
    id: "T-6", name: "A new code makes the old one useless; a fourth resend is refused", covers: ["AC-4"], ...base,
    steps: [
      ...find(), press("Resend code"), ...code("482100"), text("That code isn’t right."), press("Resend code"), press("Resend code"), noText("You have asked for the maximum number of codes."),
      press("Resend code"), screen("code"), text("You have asked for the maximum number of codes. Try again later."), ...code("482103"), screen("result"),
    ],
  },
  {
    id: "T-7", name: "A wrong code counts toward the same lock as the identity check: one miss and two wrong codes lock the journey", covers: ["AC-4"], ...base,
    steps: [
      ...find({ ...MINE, "fu.dob": "1990-01-01" }), text(NO_MATCH), ...find(), screen("code"), ...code("111111"), screen("code"), ...code("111111"), screen("locked"), text("Too many tries"), inspect("outbox", []),
    ],
  },
  {
    id: "T-8", name: "A recovery that ran out (ten minutes) has to start again", covers: ["AC-8"], ...base,
    steps: [...find(), screen("code"), { advance: 601 }, press("Resend code"), screen("expired"), text("That took too long"), text("Nothing was sent."), press("Start again"), screen("find"), inspect("outbox", [])],
  },
  {
    id: "T-9", name: "A code is needed before anything is sent: the bank refuses the forced call, and the empty code is refused on the screen", covers: ["AC-3", "AC-5"], ...base,
    steps: [
      ...find(), press("Send my username"), error("fu.code"), screen("code"),
      { expectBankError: { adapter: "bank.recover.sendUsername", input: { recoveryToken: "{{found.recoveryToken}}" }, code: "OTP_REQUIRED" } }, inspect("outbox", []),
    ],
  },
  {
    id: "T-10", name: "With allowEmail off only the mobile number is offered", covers: ["AC-6"], ...base, launch: { "opt.allowEmail": false },
    steps: [screen("find"), text("Mobile number"), noText("Email"), noText("Find you by"), ...find({ "fu.by": "email", "fu.email": "x", ...MINE }), screen("code")],
  },
  {
    id: "T-11", name: "With allowEmail on both are offered", covers: ["AC-6"], ...base,
    steps: [screen("find"), text("Find you by"), text("Mobile number"), text("Email")],
  },
  {
    id: "T-12", name: "The bank is unavailable when the username is sent: nothing is sent", covers: ["AC-7"], ...base, conditions: { unavailable: ["bank.recover.sendUsername"] },
    steps: [...find(), ...code(), screen("problem"), text(SORRY), inspect("outbox", []), press("Try again"), screen("find")],
  },
  {
    id: "T-13", name: "The bank times out when the username is sent: told so, nothing is sent", covers: ["AC-7"], ...base, conditions: { timeout: ["bank.recover.sendUsername"] },
    steps: [...find(), ...code(), screen("problem"), text(SLOW), inspect("outbox", [])],
  },
  {
    id: "T-14", name: "The bank is unavailable when the person is looked for", covers: ["AC-7"], ...base, conditions: { unavailable: ["bank.recover.verifyUser"] },
    steps: [...find(), screen("problem"), text(SORRY)],
  },
  {
    id: "T-15", name: "The code cannot be sent just now: nothing is sent", covers: ["AC-7"], ...base, conditions: { unavailable: ["bank.otp.send"] },
    steps: [...find(), screen("problem"), text(SORRY), inspect("outbox", [])],
  },
  {
    id: "T-16", name: "The code cannot be checked just now: nothing is sent", covers: ["AC-7"], ...base, conditions: { timeout: ["bank.otp.verify"] },
    steps: [...find(), ...code(), screen("problem"), text(SLOW), inspect("outbox", [])],
  },
  {
    id: "T-17", name: "From the result the person goes on to Sign in or to Reset password", covers: ["AC-9"], ...base,
    steps: [...find(), ...code(), press("Sign in"), { expectOpens: { journey: "sign-in" } }, screen("credentials")],
  },
  {
    id: "T-18", name: "Reset password opens from the result", covers: ["AC-9"], ...base,
    steps: [...find(), ...code(), press("Reset password"), { expectOpens: { journey: "reset-password" } }, screen("ident"), text("Reset your password")],
  },
];
