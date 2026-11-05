import type { Journey, Screen } from "../schema";
import { changeQuickPinAcceptance, changeQuickPinScenarios } from "./change-quick-pin-tests";
import { alert, button, commonScreens, failRules, go, needsPermission, route, set, text } from "./security-kit";

/** What this journey holds only while it is being sent: the PINs. Cleared on every way out. */
const wipe = [set("cq.cur", ""), set("cq.new", ""), set("cq.confirm", "")];

/**
 * Change quick PIN (BankWorkx, Signing in and security, Settings > Security). The current PIN is the proof (no code): the bank keeps for five
 * minutes that it was right, so the journey clears it the moment the bank has checked it. A new 6-digit PIN replaces it, with no repeats or
 * runs and none of the digits of the phone number. Three wrong PINs turn quick sign-in off on the device.
 *
 * The bank checks the PIN as a hash and answers with none. The new PIN is held from the second screen to the bank's answer and cleared on every way out.
 */
export const changeQuickPin: Journey = {
  id: "jrn_bankworkx_change_quick_pin",
  slug: "change-quick-pin",
  name: "Change quick PIN",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: changeQuickPinAcceptance,
  scenarios: changeQuickPinScenarios,
  dataModel: {
    "cq.cur": { type: "string", required: true, pattern: "^[0-9]{6}$" },
    "cq.new": { type: "string", required: true, pattern: "^[0-9]{6}$" },
    "cq.confirm": { type: "string", required: true },
    "cq.mismatch": { type: "boolean" },
  },
  integrations: [
    { id: "deviceOptions", adapter: "bank.device.options", mode: "sandbox" },
    { id: "verifyPin", adapter: "bank.devices.verifyPin", mode: "sandbox" },
    { id: "changePin", adapter: "bank.devices.changePin", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Change quick PIN", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "deviceOptions", saveAs: "cq.dev", onError: { navigate: "fail" } },
        ...wipe, set("cq.chk", null), set("cq.res", null), set("cq.mismatch", false),
        go("cur"),
      ],
      navigation: route([needsPermission, "denied"], ["!cq.dev.pinSet", "none"]),
      blocks: [],
    },
    {
      id: "none", title: "No quick PIN yet", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "No quick PIN yet", text: "You haven’t set a quick PIN on this device." },
        button("Set up quick sign-in", [{ type: "navigate", toJourney: "setup-quick-login" }]),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "cur", title: "Current PIN",
      blocks: [
        text("Current PIN", "title"),
        alert("error", "That PIN isn’t right.", "cq.chk.code == 'PIN_WRONG'"),
        alert("warning", "{{cq.chk.triesLeft}} {{cq.chk.triesLeft == 1 ? 'try' : 'tries'}} left.", "cq.chk.code == 'PIN_WRONG'"),
        { type: "textInput", bind: "cq.cur", label: "Current PIN", placeholder: "6 digits", keyboard: "number", secure: true, pattern: "^[0-9]{6}$", patternMessage: "Enter your 6-digit PIN." },
        button("Continue", [
          { type: "validate" },
          { type: "callApi", integration: "verifyPin", input: { pin: "{{cq.cur}}" }, saveAs: "cq.chk", onError: { navigate: "fail" } },
          // the bank has it (and remembers for five minutes that it was right): the journey does not keep it
          set("cq.cur", ""),
          { type: "navigate" },
        ]),
      ],
      navigation: route(["cq.chk.ok", "new"], ["cq.chk.code == 'PIN_LOCKED'", "locked"], ["cq.chk.code == 'PIN_NOT_SET'", "none"]),
    },
    {
      id: "new", title: "New PIN",
      blocks: [
        text("New PIN", "title"),
        alert("error", "Choose a different PIN.", "cq.res.code == 'PIN_SAME'"),
        alert("error", "That PIN is too easy to guess. Avoid repeats and runs like 111111 or 123456.", "cq.res.code == 'PIN_WEAK'"),
        alert("error", "Don’t use digits from your phone number.", "cq.res.code == 'PIN_PHONE'"),
        alert("error", "Use exactly 6 digits.", "cq.res.code == 'PIN_INVALID'"),
        alert("error", "The PINs don’t match.", "cq.mismatch"),
        { type: "textInput", bind: "cq.new", label: "New PIN", placeholder: "6 digits", keyboard: "number", secure: true, pattern: "^[0-9]{6}$", patternMessage: "Use exactly 6 digits." },
        text("Avoid repeats like 111111 and runs like 123456.", "caption"),
        { type: "textInput", bind: "cq.confirm", label: "Confirm new PIN", placeholder: "6 digits", keyboard: "number", secure: true },
        button("Change PIN", [
          { type: "validate" },
          set("cq.mismatch", "{{cq.new != cq.confirm}}"), set("cq.res", null),
          { type: "navigate" },
        ]),
      ],
      navigation: route(["!cq.mismatch", "change"]),
    },
    {
      id: "change", title: "Change quick PIN", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "changePin", input: { new: "{{cq.new}}" }, saveAs: "cq.res", onError: { navigate: "fail" } },
        // the bank has the new PIN: the journey does not keep it
        ...wipe,
        go("done"),
      ],
      navigation: route(["cq.res.ok == false", "new"]),
      blocks: [],
    },
    {
      id: "locked", title: "Quick PIN turned off", kind: "terminal", onEnter: wipe,
      blocks: [
        { type: "result", tone: "error", title: "Quick PIN turned off", text: "Too many wrong PINs. Quick sign-in is off. Set it up again." },
        button("Set up again", [{ type: "navigate", toJourney: "setup-quick-login" }]),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "done", title: "PIN changed", kind: "terminal", onEnter: wipe,
      blocks: [
        { type: "result", tone: "success", title: "PIN changed", text: "Use your new PIN next time." },
        { type: "reviewSummary", rows: [{ label: "Device", value: "{{cq.res.device}}" }] },
        button("Back to security", [{ type: "exit" }]),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "fail", title: "Change quick PIN", kind: "branch",
      onEnter: [...wipe, go("problem")],
      navigation: route(...failRules),
      blocks: [],
    },
    ...commonScreens("Change quick PIN", wipe),
  ] as Screen[],
};
