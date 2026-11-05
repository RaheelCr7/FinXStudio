import type { Journey } from "../schema";

/** What must be true for "Trusted devices" to be right. Each is proved by at least one scenario below. */
export const trustedDevicesAcceptance: NonNullable<Journey["acceptance"]> = [
  { id: "AC-1", text: "The list shows each device with its last use, the current one marked This device and not removable here (the bank refuses it too)." },
  { id: "AC-2", text: "Remove asks for a code first; a correct code removes the device and shows the toast; nothing else changes." },
  { id: "AC-3", text: "A wrong code shows the tries left; three wrong codes lock the view with \"Too many wrong codes. Try again later.\"; an expired code asks to cancel and start again." },
  { id: "AC-4", text: "Sign out other devices appears only with signOutAll and another device, and after a correct code leaves only this device." },
  { id: "AC-5", text: "With limit on the header shows \"{n} of 5\"; with it off there is no count." },
  { id: "AC-6", text: "Cancel closes the panel and changes nothing." },
  { id: "AC-7", text: "When the bank is unavailable or times out nothing is changed, the list says it may be out of date, and a device already gone is said so." },
  { id: "AC-8", text: "Removing needs the permission to manage security, a step-up in the last five minutes and the code; without them it says so and changes nothing, and the bank refuses a request that skips a screen." },
];

// Alex (alex.morgan): his three trusted devices as the seed has them; the device in hand is the iPhone 15. The code is 482100 (000000 wrong, 999999 expired).
const NOW = "2026-11-03T10:00:00Z";
type Step = Record<string, unknown>;
const set = (v: Record<string, unknown>): Step => ({ set: v });
const press = (label: string): Step => ({ press: label });
const text = (t: string): Step => ({ expectText: t });
const noText = (t: string): Step => ({ expectNoText: t });
const screen = (s: string): Step => ({ expectScreen: s });
const trusted = (equals: string[]): Step => ({ expectBank: { adapter: "sandbox.access.inspect", input: { username: "alex.morgan" }, path: "trustedDevices", equals } });
const base = { persona: "alex", context: "personal", now: NOW };
const code = (c = "482100", button = "Remove"): Step[] => [set({ "td.code": c }), press(button)];
const ALL = ["dev_iphone15", "dev_laptop", "dev_tablet"];
const SORRY = "This isn’t available right now. Nothing was changed.";
const SLOW = "This is taking longer than expected. Nothing was changed.";
const strictCode: Step[] = [{ expectBank: { adapter: "bank.otp.send", input: { strict: true }, path: "sent", equals: true } }, { expectBank: { adapter: "bank.otp.verify", input: { code: "482100", strict: true }, path: "verified", equals: true } }];
/** The other devices are already gone (the step-up and a code have been done): only this one is left. */
const onlyThis = [{ adapter: "bank.otp.send", input: { strict: true } }, { adapter: "bank.otp.verify", input: { code: "482100", strict: true } }, { adapter: "bank.devices.remove", input: { all: true } }];

export const trustedDevicesScenarios: NonNullable<Journey["scenarios"]> = [
  {
    id: "T-1", name: "Three devices with their last use, 3 of 5, the iPhone 15 marked This device; opening it does nothing, and the bank refuses to remove the device in hand", covers: ["AC-1", "AC-5"], ...base,
    steps: [
      screen("list"), text("Trusted devices"), text("3 of 5"), text("iPhone 15"), text("This device · Last used Now"), text("Work laptop, Chrome"), text("Last used Yesterday, 18:20"), text("Android tablet"), text("Last used 12 Oct 2026"),
      press("iPhone 15"), screen("list"), noText("Remove iPhone 15?"), trusted(ALL),
      ...strictCode, { expectBankError: { adapter: "bank.devices.remove", input: { deviceId: "dev_iphone15" }, code: "CURRENT_DEVICE" } }, trusted(ALL),
    ],
  },
  {
    id: "T-2", name: "Remove asks for a code first; a correct code removes the device, shows the toast and the list has two", covers: ["AC-2"], ...base,
    steps: [
      press("Work laptop, Chrome"), screen("remove"), text("Remove Work laptop, Chrome?"), text("It will ask for a code next time it signs in."), text("Code sent to the phone ending 0142"), noText("Sign out"),
      ...code(), screen("list"), text("Device removed"), text("2 of 5"), noText("Work laptop, Chrome"), text("Android tablet"), trusted(["dev_iphone15", "dev_tablet"]),
    ],
  },
  {
    id: "T-3", name: "A short code is not sent; a wrong code says so with the tries left; the third wrong one locks the view and nothing is removed", covers: ["AC-3"], ...base,
    steps: [
      press("Work laptop, Chrome"), ...code("12"), { expectError: "Enter the 6 digits." }, screen("remove"), noText("tries left"),
      ...code("000000"), text("That code isn’t right. 2 tries left."), screen("remove"), ...code("000000"), text("That code isn’t right. 1 try left."),
      ...code("000000"), screen("list"), text("Too many wrong codes. Try again later."), trusted(ALL),
      press("Work laptop, Chrome"), screen("list"), noText("Remove Work laptop, Chrome?"), noText("Sign out other devices"),
      { expectBankError: { adapter: "bank.otp.verify", input: { code: "482100", strict: true }, code: "OTP_LOCKED" } },
    ],
  },
  {
    id: "T-4", name: "An expired code asks to cancel and start again; Cancel returns to the list", covers: ["AC-3", "AC-6"], ...base,
    steps: [
      press("Android tablet"), ...code("999999"), text("That code has expired. Cancel and start again."), press("Cancel"), screen("list"), noText("Too many wrong codes"), text("Android tablet"), trusted(ALL),
      press("Android tablet"), { advance: 301 }, ...code("482100"), text("That code has expired. Cancel and start again."), trusted(ALL),
    ],
  },
  {
    id: "T-5", name: "Sign out other devices: the panel, a correct code, one row left, the toast, and the button is gone", covers: ["AC-4"], ...base,
    steps: [
      screen("list"), text("Sign out other devices"), press("Sign out other devices"), screen("remove"), text("Sign out other devices?"), text("Every other device is signed out and asks for a code next time."), noText("It will ask for a code next time it signs in."),
      ...code("000000", "Sign out"), text("That code isn’t right. 2 tries left."), trusted(ALL), ...code("482100", "Sign out"),
      screen("list"), text("Other devices signed out"), text("1 of 5"), text("iPhone 15"), noText("Work laptop, Chrome"), noText("Android tablet"), noText("Sign out other devices"), trusted(["dev_iphone15"]),
    ],
  },
  {
    id: "T-6", name: "With signOutAll off there is no sign-out button", covers: ["AC-4"], ...base, launch: { "opt.signOutAll": false },
    steps: [screen("list"), text("Work laptop, Chrome"), noText("Sign out other devices")],
  },
  {
    id: "T-7", name: "With only this device left there is no sign-out button and a row cannot be removed", covers: ["AC-4"], ...base, setup: onlyThis,
    steps: [screen("list"), text("1 of 5"), text("iPhone 15"), noText("Sign out other devices"), noText("Work laptop, Chrome")],
  },
  {
    id: "T-8", name: "With limit off the list has no count", covers: ["AC-5"], ...base, launch: { "opt.limit": false },
    steps: [screen("list"), text("iPhone 15"), noText("of 5")],
  },
  {
    id: "T-9", name: "Cancel on the sign-out panel changes nothing", covers: ["AC-6"], ...base,
    steps: [press("Sign out other devices"), screen("remove"), press("Cancel"), screen("list"), text("3 of 5"), text("Sign out other devices"), trusted(ALL)],
  },
  {
    id: "T-10", name: "The bank is unavailable when the device is removed: nothing is changed and the list says it may be out of date", covers: ["AC-7"], ...base, conditions: { unavailable: ["bank.devices.remove"] },
    steps: [
      press("Work laptop, Chrome"), ...code(), screen("removeProblem"), text(SORRY), noText("Device removed"), trusted(ALL),
      press("Cancel"), screen("list"), text("Some details may be out of date."), text("Work laptop, Chrome"), text("3 of 5"),
    ],
  },
  {
    id: "T-11", name: "The bank times out when the device is removed: told so, a new code is needed to try again", covers: ["AC-7"], ...base, conditions: { timeout: ["bank.devices.remove"] },
    steps: [press("Android tablet"), ...code(), text(SLOW), trusted(ALL), press("Try again"), screen("remove"), text("Code sent to the phone ending 0142")],
  },
  {
    id: "T-12", name: "The bank is unavailable when the list is read: nothing to show, nothing changed", covers: ["AC-7"], ...base, conditions: { unavailable: ["bank.devices.list"] },
    steps: [screen("problem"), text("This isn’t available right now. Nothing was changed. Try again in a few minutes."), press("Try again"), screen("problem")],
  },
  {
    id: "T-13", name: "A device that is already gone is said so, and the list is read again", covers: ["AC-7"], ...base,
    steps: [
      press("Work laptop, Chrome"), ...strictCode, { expectBank: { adapter: "bank.devices.remove", input: { deviceId: "dev_laptop" }, path: "removed", equals: 1 } },
      { expectBank: { adapter: "bank.otp.send", input: { strict: true }, path: "sent", equals: true } }, ...code(), screen("list"), text("That device is already gone."), noText("Work laptop, Chrome"), text("2 of 5"),
    ],
  },
  {
    id: "T-14", name: "The code cannot be sent just now: nothing changed", covers: ["AC-7"], ...base, conditions: { unavailable: ["bank.otp.send"] },
    steps: [press("Work laptop, Chrome"), screen("problem"), text("This isn’t available right now. Nothing was changed. Try again in a few minutes."), trusted(ALL)],
  },
  {
    id: "T-15", name: "The code cannot be checked just now: nothing changed", covers: ["AC-7"], ...base, conditions: { timeout: ["bank.otp.verify"] },
    steps: [press("Work laptop, Chrome"), ...code(), screen("problem"), text("This is taking longer than expected. Nothing was changed."), trusted(ALL)],
  },
  {
    id: "T-16", name: "Without a step-up the list can be read but a removal says to confirm first and changes nothing; the bank refuses a forged request", covers: ["AC-8"], persona: "alex", now: NOW,
    steps: [
      screen("list"), text("3 of 5"), press("Work laptop, Chrome"), ...code(), screen("stepup"), text("Confirm it’s you first"), text("Nothing was changed."), trusted(ALL),
      { expectBankError: { adapter: "bank.devices.remove", input: { deviceId: "dev_laptop" }, code: "STEP_UP_REQUIRED" } }, { expectBankError: { adapter: "bank.devices.remove", input: { all: true }, code: "STEP_UP_REQUIRED" } }, press("Done"),
    ],
  },
  {
    id: "T-17", name: "Working as a company without the permission: not available", covers: ["AC-8"], persona: "alex", context: "alpha", now: NOW,
    steps: [screen("denied"), text("This isn’t available for your profile."), press("Done")],
  },
  {
    id: "T-18", name: "The bank refuses a removal without the code, even from a person who is stepped up", covers: ["AC-8", "AC-2"], ...base,
    steps: [{ expectBankError: { adapter: "bank.devices.remove", input: { deviceId: "dev_laptop" }, code: "OTP_REQUIRED" } }, { expectBankError: { adapter: "bank.devices.remove", input: { all: true }, code: "OTP_REQUIRED" } }, trusted(ALL)],
  },
  {
    id: "T-19", name: "A step-up that runs out while the code is typed is asked for again and nothing is removed", covers: ["AC-8"], ...base,
    steps: [press("Work laptop, Chrome"), { advance: 290 }, press("Cancel"), press("Work laptop, Chrome"), { advance: 20 }, ...code(), screen("stepup"), trusted(ALL)],
  },
  {
    id: "T-21", name: "The bank is unavailable when the other devices are signed out: a short code is not sent, nothing is changed", covers: ["AC-7", "AC-4"], ...base, conditions: { unavailable: ["bank.devices.remove"] },
    steps: [press("Sign out other devices"), ...code("12", "Sign out"), { expectError: "Enter the 6 digits." }, screen("remove"), ...code("482100", "Sign out"), screen("removeProblem"), text(SORRY), noText("Other devices signed out"), trusted(ALL)],
  },
  {
    id: "T-20", name: "The view can be closed", covers: ["AC-6"], ...base,
    steps: [press("Done")],
  },
];
