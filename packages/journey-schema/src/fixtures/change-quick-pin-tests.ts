import type { Journey } from "../schema";

/** What must be true for "Change quick PIN" to be right. Each is proved by at least one scenario below. */
export const changeQuickPinAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "With no quick PIN the person sees \"No quick PIN yet\" and a way to set one up, and cannot go on." },
  { id: "AC-2", text: "A wrong current PIN shows \"That PIN isn’t right.\" and the tries left; the third turns quick sign-in off and offers to set it up again; a right PIN sets the count back to zero." },
  { id: "AC-3", text: "The new PIN must be 6 digits, differ from the current one, not be a repeat or run, not contain digits of the phone number, and be confirmed." },
  { id: "AC-4", text: "After success the new PIN works for quick sign-in and the old one does not." },
  { id: "AC-5", text: "When the bank is unavailable or times out the PIN is unchanged." },
  { id: "AC-6", text: "It needs the permission to manage security and a step-up in the last five minutes; without them it says so and changes nothing, and the bank refuses a request that skips the current PIN or the step-up." },
  { id: "AC-7", text: "No PIN is kept: the current one is cleared once the bank has checked it, the new one once the bank has it or the person leaves, and none is ever shown." },
];

// Alex (alex.morgan) on his iPhone 15 with the quick PIN 837215 (phone ending 0142).
const NOW = "2026-11-03T10:00:00Z";
type Step = Record<string, unknown>;
const set = (v: Record<string, unknown>): Step => ({ set: v });
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const bank = (adapter: string, input: Record<string, unknown>, path: string, equals: unknown): Step => ({ expectBank: { adapter, input, path, equals } });
const quick = (equals: Record<string, string>): Step => ({ expectBank: { adapter: "sandbox.access.inspect", input: { username: "alex.morgan" }, path: "quick", equals } });
const base = { persona: "alex", context: "personal", now: NOW };
const OLD = "837215", NEW = "504719";
const cur = (p = OLD): Step[] => [set({ "cq.cur": p }), press("Continue")];
const newpin = (p: string, confirm = p): Step[] => [set({ "cq.new": p, "cq.confirm": confirm }), press("Change PIN")];
const pinOn = [{ adapter: "bank.otp.send", input: { strict: true } }, { adapter: "bank.otp.verify", input: { code: "482100", strict: true } }, { adapter: "bank.devices.setQuickSignIn", input: { method: "pin", pin: OLD } }];
const SORRY = "This isn’t available right now. Nothing was changed. Try again in a few minutes.";
const SLOW = "This is taking longer than expected. Nothing was changed.";
const TOO_EASY = "That PIN is too easy to guess. Avoid repeats and runs like 111111 or 123456.";

export const changeQuickPinScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "With no quick PIN: \"No quick PIN yet\" with a way to set one up, and nothing to continue", covers: ["AC-1"], ...base,
    steps: [screen("none"), text("No quick PIN yet"), text("You haven’t set a quick PIN on this device."), noText("Continue"), press("Set up quick sign-in"), { expectOpens: { journey: "setup-quick-login" } }, text("Quick sign-in")],
  },
  {
    id: "T-2", name: "A wrong PIN says so with the tries left; the third turns quick sign-in off and offers to set it up again", covers: ["AC-2"], ...base, setup: pinOn,
    steps: [
      screen("cur"), text("Current PIN"), ...cur("000000"), text("That PIN isn’t right."), text("2 tries left."), screen("cur"), ...cur("000000"), text("1 try left."),
      ...cur("000000"), screen("locked"), text("Quick PIN turned off"), text("Too many wrong PINs. Quick sign-in is off. Set it up again."), quick({}),
      bank("bank.device.options", {}, "default", "password"), bank("bank.device.options", {}, "pinSet", false),
      press("Set up again"), { expectOpens: { journey: "setup-quick-login" } }, text("Quick sign-in"),
    ],
  },
  {
    id: "T-3", name: "A right PIN sets the count of wrong ones back to zero", covers: ["AC-2"], ...base, setup: pinOn,
    steps: [...cur("000000"), text("2 tries left."), ...cur(), screen("new"), bank("bank.devices.verifyPin", { pin: "000000" }, "triesLeft", 2)],
  },
  {
    id: "T-4", name: "The new PIN is refused when it is the current one, a repeat or run, part of the phone number, too short or not confirmed", covers: ["AC-3"], ...base, setup: pinOn,
    steps: [
      ...cur(), screen("new"), text("New PIN"), ...newpin(OLD), text("Choose a different PIN."), screen("new"),
      ...newpin("111111"), text(TOO_EASY), noText("Choose a different PIN."), ...newpin("123456"), text(TOO_EASY), ...newpin("014204"), text("Don’t use digits from your phone number."), noText(TOO_EASY),
      ...newpin(NEW, "504718"), text("The PINs don’t match."), screen("new"), ...newpin("12345"), { expectError: "Use exactly 6 digits." }, screen("new"),
      noText("PIN_"), ...newpin(NEW), screen("done"),
    ],
  },
  {
    id: "T-5", name: "A PIN change: \"PIN changed\" with the device; the new PIN works and the old one does not, and no PIN is shown", covers: ["AC-3", "AC-4", "AC-7"], ...base, setup: pinOn,
    steps: [
      ...cur(), ...newpin(NEW), screen("done"), text("PIN changed"), text("Use your new PIN next time."), text("iPhone 15"), text("Back to security"), noText(NEW), noText(OLD),
      bank("bank.devices.verifyPin", { pin: NEW }, "ok", true), bank("bank.devices.verifyPin", { pin: OLD }, "code", "PIN_WRONG"), quick({ dev_iphone15: "pin" }),
    ],
  },
  {
    id: "T-6", name: "The bank is unavailable when the current PIN is checked: nothing changed", covers: ["AC-5"], ...base, setup: pinOn, conditions: { unavailable: ["bank.devices.verifyPin"] },
    steps: [...cur(), screen("problem"), text(SORRY), noText(OLD), bank("bank.device.options", {}, "pinSet", true), press("Try again"), screen("cur"), ...cur(), screen("problem")],
  },
  {
    id: "T-7", name: "The bank times out when the current PIN is checked: told so, nothing changed", covers: ["AC-5"], ...base, setup: pinOn, conditions: { timeout: ["bank.devices.verifyPin"] },
    steps: [...cur(), screen("problem"), text(SLOW), quick({ dev_iphone15: "pin" })],
  },
  {
    id: "T-8", name: "The bank is unavailable when the new PIN is saved: the old one still works and the new one is not kept", covers: ["AC-5", "AC-7"], ...base, setup: pinOn, conditions: { unavailable: ["bank.devices.changePin"] },
    steps: [...cur(), ...newpin(NEW), screen("problem"), text(SORRY), noText(NEW), bank("bank.devices.verifyPin", { pin: OLD }, "ok", true)],
  },
  {
    id: "T-9", name: "The bank times out when the new PIN is saved: told so, the old PIN still works", covers: ["AC-5"], ...base, setup: pinOn, conditions: { timeout: ["bank.devices.changePin"] },
    steps: [...cur(), ...newpin(NEW), screen("problem"), text(SLOW), bank("bank.devices.verifyPin", { pin: OLD }, "ok", true)],
  },
  {
    id: "T-10", name: "The device cannot be read just now: nothing changed", covers: ["AC-5"], ...base, setup: pinOn, conditions: { unavailable: ["bank.device.options"] },
    steps: [screen("problem"), text(SORRY), press("Done")],
  },
  {
    id: "T-11", name: "When the step-up has run out the PIN is checked but the change says to confirm first and changes nothing; the bank refuses a forged change", covers: ["AC-6"], ...base, setup: pinOn,
    steps: [
      { advance: 301 }, ...cur(), screen("new"), ...newpin(NEW), screen("stepup"), text("Confirm it’s you first"), text("Nothing was changed."), noText(NEW),
      { expectBankError: { adapter: "bank.devices.changePin", input: { current: OLD, new: NEW }, code: "STEP_UP_REQUIRED" } },
      bank("bank.devices.verifyPin", { pin: OLD }, "ok", true), press("Done"),
    ],
  },
  {
    id: "T-12", name: "Working as a company without the permission: not available", covers: ["AC-6"], persona: "alex", context: "alpha", now: NOW,
    steps: [screen("denied"), text("This isn’t available for your profile."), press("Done")],
  },
  {
    id: "T-13", name: "A step-up that runs out while the new PIN is chosen is asked for again, and nothing is changed", covers: ["AC-6", "AC-7"], ...base, setup: pinOn,
    steps: [...cur(), { advance: 301 }, ...newpin(NEW), screen("stepup"), text("Confirm it’s you first"), noText(NEW), bank("bank.devices.verifyPin", { pin: OLD }, "ok", true)],
  },
  {
    id: "T-14", name: "The bank refuses a change without the current PIN having been checked, or with a wrong one", covers: ["AC-6", "AC-4"], ...base, setup: pinOn,
    steps: [
      { expectBankError: { adapter: "bank.devices.changePin", input: { new: NEW }, code: "PIN_NOT_VERIFIED" } }, { expectBankError: { adapter: "bank.devices.changePin", input: { current: "000000", new: NEW }, code: "PIN_WRONG" } },
      bank("bank.devices.changePin", { current: OLD, new: OLD }, "code", "PIN_SAME"), bank("bank.devices.changePin", { current: OLD, new: "111111" }, "code", "PIN_WEAK"), bank("bank.devices.changePin", { current: OLD, new: "12345" }, "code", "PIN_INVALID"),
      bank("bank.devices.verifyPin", { pin: OLD }, "ok", true),
    ],
  },
  {
    id: "T-15", name: "Nothing is sent without a current PIN of six digits or a new one", covers: ["AC-3", "AC-7"], ...base, setup: pinOn,
    steps: [press("Continue"), { expectError: "cq.cur" }, set({ "cq.cur": "12" }), press("Continue"), { expectError: "Enter your 6-digit PIN." }, screen("cur"), noText("tries left"), ...cur(), press("Change PIN"), { expectError: "cq.new" }, screen("new")],
  },
  {
    id: "T-17", name: "Quick sign-in was turned off somewhere else while the person was here: the bank says so and the journey says there is no PIN", covers: ["AC-1"], ...base, setup: pinOn,
    steps: [screen("cur"), bank("bank.devices.setQuickSignIn", { method: "off" }, "ok", true), ...cur(), screen("none"), text("No quick PIN yet")],
  },
  {
    id: "T-16", name: "The result can be closed", covers: ["AC-4"], ...base, setup: pinOn,
    steps: [...cur(), ...newpin(NEW), press("Back to security")],
  },
];
