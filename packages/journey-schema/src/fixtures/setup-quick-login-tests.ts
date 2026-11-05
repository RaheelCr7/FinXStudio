import type { Journey } from "../schema";

/** What must be true for "Set up quick sign-in" to be right. Each is proved by at least one scenario below. */
export const setupQuickLoginAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "The screen shows this device and what is on now, and offers only the methods the bank has on and the device can do (no Face ID or fingerprint on a device without it)." },
  { id: "AC-2", text: "The current method is shown On and cannot be chosen again; Turn off appears only when a method is on." },
  { id: "AC-3", text: "A PIN must be 6 digits, not a repeat or run, not contain digits of the phone number, and be confirmed." },
  { id: "AC-4", text: "Face ID or fingerprint and passkey go through the device confirmation before the code." },
  { id: "AC-5", text: "Turning a method on needs a one-time code; three wrong codes end the attempt with nothing changed; an expired code asks to go back." },
  { id: "AC-6", text: "Turning off needs no code and the device returns to password sign-in." },
  { id: "AC-7", text: "The result shows the device and the method now on." },
  { id: "AC-8", text: "When the bank is unavailable or times out nothing is changed." },
  { id: "AC-9", text: "It needs the permission to manage security, a step-up in the last five minutes and a trusted device; without them it says so and changes nothing, and the bank refuses a request that skips a screen." },
  { id: "AC-10", text: "The PIN is not kept: it is cleared once the bank has it or the person leaves, and it is never shown." },
];

// Alex (alex.morgan, mobile ending 0142) on his iPhone 15 with quick sign-in off; the code is 482100 (000000 wrong, 999999 expired).
const NOW = "2026-11-03T10:00:00Z";
type Step = Record<string, unknown>;
const set = (v: Record<string, unknown>): Step => ({ set: v });
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const quick = (equals: Record<string, string>): Step => ({ expectBank: { adapter: "sandbox.access.inspect", input: { username: "alex.morgan" }, path: "quick", equals } });
const base = { persona: "alex", context: "personal", now: NOW };
const pick = (label: string): Step[] => [press(label), press("Continue")];
const pin = (p: string, confirm = p): Step[] => [set({ "sq.pin": p, "sq.confirm": confirm }), press("Continue")];
const code = (c = "482100"): Step[] => [set({ "sq.code": c }), press("Turn on")];
const PIN = "504719";
const SORRY = "This isn’t available right now. Nothing was changed. Try again in a few minutes.";
const SLOW = "This is taking longer than expected. Nothing was changed.";
const TOO_EASY = "That PIN is too easy to guess. Avoid repeats and runs like 111111 or 123456.";
/** A quick PIN is already on for the iPhone (the step-up and a code have been done). */
const pinOn = [{ adapter: "bank.otp.send", input: { strict: true } }, { adapter: "bank.otp.verify", input: { code: "482100", strict: true } }, { adapter: "bank.devices.setQuickSignIn", input: { method: "pin", pin: PIN } }];

export const setupQuickLoginScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "Face ID or fingerprint: the device, what is on now, the methods; the device confirmation, then the code: \"Quick sign-in is on\" with the device and the method", covers: ["AC-1", "AC-4", "AC-5", "AC-7"], ...base,
    steps: [
      screen("method"), text("Quick sign-in"), text("iPhone 15"), text("On now"), text("Off"), text("Face ID or fingerprint"), text("Passkey"), text("6-digit PIN"), noText("Turn off"),
      press("Face ID or fingerprint"), text("You chose: Face ID or fingerprint"), press("Continue"), screen("bio"), text("Confirm on this device"), text("Look at your phone or use your fingerprint."),
      press("Continue"), screen("code"), text("Sent to the phone ending 0142."), ...code(), screen("done"), text("Quick sign-in is on"), text("iPhone 15"), text("Face ID or fingerprint"), text("Back to security"), noText("Change PIN"),
      quick({ dev_iphone15: "biometric" }),
      { expectBank: { adapter: "bank.device.options", path: "default", equals: "biometric" } },
    ],
  },
  {
    id: "T-2", name: "A passkey goes through the device confirmation too", covers: ["AC-4", "AC-7"], ...base,
    steps: [...pick("Passkey"), screen("bio"), text("Use your device lock to create a passkey."), noText("fingerprint"), press("Continue"), ...code(), text("Quick sign-in is on"), text("Passkey"), quick({ dev_iphone15: "passkey" })],
  },
  {
    id: "T-3", name: "A PIN is refused when it is a repeat, a run, part of the phone number, too short or not confirmed; nothing is sent to the bank until it passes", covers: ["AC-3", "AC-10"], ...base,
    steps: [
      press("6-digit PIN"), ...pin("111111"), text(TOO_EASY), screen("method"), ...pin("123456"), text(TOO_EASY), ...pin("654321"), text(TOO_EASY), ...pin("121212"), text(TOO_EASY), ...pin("696969"), text(TOO_EASY),
      ...pin("014204"), text("Don’t use digits from your phone number."), noText(TOO_EASY),
      ...pin("504719", "504718"), text("The PINs don’t match."), screen("method"), noText("Don’t use digits"),
      ...pin("12345"), { expectError: "Use exactly 6 digits." }, screen("method"),
      ...pin(PIN), screen("code"), noText(PIN), quick({}),
    ],
  },
  {
    id: "T-4", name: "Three wrong codes end the attempt with nothing changed and the PIN not kept; a wrong code says so with the tries left", covers: ["AC-5", "AC-10"], ...base,
    steps: [
      ...pick("6-digit PIN"), ...pin(PIN), ...code("000000"), text("That code isn’t right. Try again."), text("2 tries left."), screen("code"), ...code("000000"), text("1 try left."),
      ...code("000000"), screen("codeLocked"), text("Too many wrong codes"), text("Nothing was changed. Go back to start again."), noText(PIN), quick({}),
      { expectBankError: { adapter: "bank.devices.setQuickSignIn", input: { method: "pin", pin: PIN }, code: "OTP_REQUIRED" } },
      press("Back to start"), screen("method"), text("Off"),
    ],
  },
  {
    id: "T-5", name: "An expired code asks to go back and get a new one; a code that waited five minutes has run out too", covers: ["AC-5"], ...base,
    steps: [
      ...pick("Face ID or fingerprint"), press("Continue"), ...code("999999"), text("That code has expired. Go back to get a new one."), noText("Turn on"), press("Back"), screen("method"), quick({}),
      ...pick("Face ID or fingerprint"), press("Continue"), { advance: 301 }, ...code("482100"), text("That code has expired. Go back to get a new one."), quick({}),
    ],
  },
  {
    id: "T-6", name: "The code is checked before it is sent: an empty or short one is not a wrong one", covers: ["AC-5"], ...base,
    steps: [...pick("Face ID or fingerprint"), press("Continue"), press("Turn on"), { expectError: "sq.code" }, screen("code"), noText("tries left"), ...code("482100"), screen("done")],
  },
  {
    id: "T-7", name: "With a PIN on, the PIN row shows On and cannot be chosen; turning off needs no code, the result says it is off and the device goes back to the password", covers: ["AC-2", "AC-6", "AC-7"], ...base, setup: pinOn,
    steps: [
      screen("method"), text("6-digit PIN · On"), noText("Works only on this device."), text("Turn off"), text("You will use your password."), text("Quick PIN"),
      press("Turn off"), press("Continue"), screen("done"), text("Quick sign-in is off"), text("You will use your password on this device."), text("Off"), noText("Change PIN"),
      quick({}), { expectBank: { adapter: "bank.device.options", path: "default", equals: "password" } }, { expectBank: { adapter: "bank.device.options", path: "pinSet", equals: false } },
    ],
  },
  {
    id: "T-8", name: "Turning on a method replaces the one that was on", covers: ["AC-2", "AC-7"], ...base, setup: pinOn,
    steps: [...pick("Face ID or fingerprint"), press("Continue"), ...code(), text("Quick sign-in is on"), text("Face ID or fingerprint"), quick({ dev_iphone15: "biometric" }), { expectBank: { adapter: "bank.device.options", path: "pinSet", equals: false } }],
  },
  {
    id: "T-9", name: "A PIN that is on opens Change PIN from the result", covers: ["AC-7"], ...base,
    steps: [...pick("6-digit PIN"), ...pin(PIN), ...code(), text("Quick PIN"), press("Change PIN"), { expectOpens: { journey: "change-quick-pin" } }],
  },
  {
    id: "T-10", name: "Nothing is chosen: it is required", covers: ["AC-1"], ...base,
    steps: [press("Continue"), text("This is required."), screen("method"), noText("You chose")],
  },
  {
    id: "T-11", name: "With the PIN and the passkey off in the bank's setup only Face ID or fingerprint is offered", covers: ["AC-1"], ...base, launch: { "opt.allowPin": false, "opt.allowPasskey": false },
    steps: [text("Face ID or fingerprint"), noText("Passkey"), noText("6-digit PIN"), noText("Turn off")],
  },
  {
    id: "T-12", name: "With Face ID off in the bank's setup it is not offered", covers: ["AC-1"], ...base, launch: { "opt.allowBio": false },
    steps: [noText("Face ID or fingerprint"), text("Passkey"), text("6-digit PIN")],
  },
  {
    id: "T-13", name: "On a device without fingerprint or face (a browser) Face ID is not offered, whatever the bank allows", covers: ["AC-1"], ...base, conditions: { device: "browser" },
    steps: [text("Work laptop, Chrome"), noText("Face ID or fingerprint"), text("Passkey"), text("6-digit PIN"), ...pick("6-digit PIN").slice(0, 1)],
  },
  {
    id: "T-14", name: "The bank is unavailable when quick sign-in is turned on: nothing changed and the PIN is not kept", covers: ["AC-8", "AC-10"], ...base, conditions: { unavailable: ["bank.devices.setQuickSignIn"] },
    steps: [...pick("6-digit PIN"), ...pin(PIN), ...code(), screen("problem"), text(SORRY), noText(PIN), quick({})],
  },
  {
    id: "T-15", name: "The bank times out when quick sign-in is turned on: told so, nothing changed", covers: ["AC-8"], ...base, conditions: { timeout: ["bank.devices.setQuickSignIn"] },
    steps: [...pick("Passkey"), press("Continue"), ...code(), screen("problem"), text(SLOW), quick({}), press("Try again"), screen("method")],
  },
  {
    id: "T-17", name: "The bank is unavailable when the PIN is checked, when the code is sent and when the device is read: nothing changed", covers: ["AC-8"], ...base, conditions: { unavailable: ["bank.devices.checkPin"] },
    steps: [...pick("6-digit PIN"), ...pin(PIN), screen("problem"), text(SORRY), noText(PIN)],
  },
  {
    id: "T-18", name: "The code cannot be sent just now: nothing changed", covers: ["AC-8"], ...base, conditions: { unavailable: ["bank.otp.send"] },
    steps: [...pick("Passkey"), press("Continue"), screen("problem"), text(SORRY), quick({})],
  },
  {
    id: "T-19", name: "The device cannot be read just now: nothing to set up", covers: ["AC-8"], ...base, conditions: { timeout: ["bank.device.options"] },
    steps: [screen("problem"), text(SLOW)],
  },
  {
    id: "T-20", name: "The code cannot be checked just now: nothing changed", covers: ["AC-8"], ...base, conditions: { timeout: ["bank.otp.verify"] },
    steps: [...pick("Passkey"), press("Continue"), ...code(), screen("problem"), text(SLOW), quick({})],
  },
  {
    id: "T-21", name: "Without a step-up the journey opens but turning on says to confirm first and changes nothing; the bank refuses a forged request", covers: ["AC-9"], persona: "alex", now: NOW,
    steps: [
      ...pick("Passkey"), press("Continue"), ...code(), screen("stepup"), text("Confirm it’s you first"), text("Nothing was changed."), quick({}),
      { expectBankError: { adapter: "bank.devices.setQuickSignIn", input: { method: "pin", pin: PIN }, code: "STEP_UP_REQUIRED" } },
      { expectBankError: { adapter: "bank.device.setDefault", input: { mode: "biometric" }, code: "STEP_UP_REQUIRED" } },
      { expectBank: { adapter: "bank.devices.setQuickSignIn", input: { method: "off" }, path: "ok", equals: true } }, press("Done"),
    ],
  },
  {
    id: "T-22", name: "Working as a company without the permission: not available", covers: ["AC-9"], persona: "alex", context: "alpha", now: NOW,
    steps: [screen("denied"), text("This isn’t available for your profile."), press("Done")],
  },
  {
    id: "T-23", name: "A device the person does not trust cannot use quick sign-in", covers: ["AC-9"], ...base, conditions: { device: "new" },
    steps: [screen("untrusted"), text("Trust this device first"), press("Done")],
  },
  {
    id: "T-24", name: "The bank has the last word on the PIN: one it refuses after the code goes back to the choice, and the PIN is not kept", covers: ["AC-3", "AC-10"], ...base,
    steps: [...pick("6-digit PIN"), ...pin(PIN), set({ "sq.pin": "111111" }), ...code(), screen("method"), text("That didn’t work. Nothing was changed. Choose again."), noText("111111"), quick({})],
  },
  {
    id: "T-25", name: "The bank refuses a PIN without the code, and a method it does not know", covers: ["AC-5", "AC-9"], ...base,
    steps: [
      { expectBankError: { adapter: "bank.devices.setQuickSignIn", input: { method: "pin", pin: PIN }, code: "OTP_REQUIRED" } }, { expectBankError: { adapter: "bank.devices.setQuickSignIn", input: { method: "biometric" }, code: "OTP_REQUIRED" } },
      { expectBank: { adapter: "bank.devices.checkPin", input: { pin: "111111" }, path: "code", equals: "PIN_WEAK" } }, { expectBank: { adapter: "bank.devices.checkPin", input: { pin: "014299" }, path: "code", equals: "PIN_PHONE" } },
      quick({}),
    ],
  },
  {
    id: "T-26", name: "The result can be closed", covers: ["AC-7"], ...base,
    steps: [...pick("Passkey"), press("Continue"), ...code(), press("Done")],
  },
];
