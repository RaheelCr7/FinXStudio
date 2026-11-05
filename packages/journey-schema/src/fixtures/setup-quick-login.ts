import type { Journey, Screen } from "../schema";
import { setupQuickLoginAcceptance, setupQuickLoginScenarios } from "./setup-quick-login-tests";
import { alert, button, commonScreens, failRules, go, needsPermission, route, set, text } from "./security-kit";

/** What this journey holds only while it is being sent: the PIN, its confirmation and the code. Cleared on every way out. */
const wipe = [set("sq.pin", ""), set("sq.confirm", ""), set("sq.code", "")];
const NAME = (path: string) => `{{${path} == 'biometric' ? 'Face ID or fingerprint' : ${path} == 'passkey' ? 'Passkey' : ${path} == 'pin' ? 'Quick PIN' : 'Off'}}`;
const SHARED = "Your phone checks it’s you. BankWorkx® never receives your face or fingerprint.";

/**
 * Set up quick sign-in (BankWorkx, Signing in and security, Settings > Security). Choose how this device signs the person in without the password:
 * Face ID or fingerprint, a passkey or a 6-digit PIN, confirmed on the device and with a one-time code; or turn it off (no code, it only makes
 * sign-in stricter). One method per device.
 *
 * Face ID, fingerprint and passkeys are made by the phone or the browser, which this sandbox does not have: the journey models them as state.
 * A device that can do it says so (`biometricAvailable`, from the bank's record of the device) and only then is Face ID or fingerprint offered;
 * the "Confirm on this device" screen stands in for the phone's own prompt, which cannot fail here. The PIN is held only from the first screen
 * to the code and is cleared on every way out; the bank keeps it as a hash and answers with none.
 */
export const setupQuickLogin: Journey = {
  id: "jrn_bankworkx_setup_quick_login",
  slug: "setup-quick-login",
  name: "Set up quick sign-in",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: setupQuickLoginAcceptance,
  scenarios: setupQuickLoginScenarios,
  dataModel: {
    "opt.allowBio": { type: "boolean" }, "opt.allowPasskey": { type: "boolean" }, "opt.allowPin": { type: "boolean" },
    "sq.method": { type: "string" },
    "sq.pin": { type: "string", required: true, pattern: "^[0-9]{6}$" },
    "sq.confirm": { type: "string", required: true },
    "sq.mismatch": { type: "boolean" },
    "sq.tried": { type: "boolean" },
    "sq.code": { type: "string", required: true, pattern: "^[0-9]{6}$" },
    "sq.codeError": { type: "string" },
    "sq.wrong": { type: "number" },
  },
  integrations: [
    { id: "deviceOptions", adapter: "bank.device.options", mode: "sandbox" },
    { id: "checkPin", adapter: "bank.devices.checkPin", mode: "sandbox" },
    { id: "otpSend", adapter: "bank.otp.send", mode: "sandbox" },
    { id: "otpVerify", adapter: "bank.otp.verify", mode: "sandbox" },
    { id: "setQuickSignIn", adapter: "bank.devices.setQuickSignIn", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Quick sign-in", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "deviceOptions", saveAs: "sq.dev", onError: { navigate: "fail" } },
        ...wipe, set("sq.method", ""), set("sq.mismatch", false), set("sq.tried", false), set("sq.codeError", ""), set("sq.wrong", 0), set("sq.chk", null), set("sq.res", null),
        go("method"),
      ],
      navigation: route([needsPermission, "denied"], ["!sq.dev.trusted", "untrusted"]),
      blocks: [],
    },
    {
      id: "method", title: "Quick sign-in",
      blocks: [
        text("Quick sign-in", "title"),
        text("Sign in on this device without your password.", "body"),
        { type: "reviewSummary", rows: [{ label: "This device", value: "{{sq.dev.device.name}}" }, { label: "On now", value: NAME("sq.dev.quick") }] },
        alert("error", "This is required.", "sq.tried && !sq.method"),
        alert("error", "That didn’t work. Nothing was changed. Choose again.", "sq.res.ok == false"),
        { type: "menu", visibleWhen: "opt.allowBio != false && sq.dev.biometricAvailable && sq.dev.quick != 'biometric'", items: [{ id: "bio", label: "Face ID or fingerprint", text: SHARED, icon: "shield", actions: [set("sq.method", "biometric")] }] },
        text("Face ID or fingerprint · On", "body", "opt.allowBio != false && sq.dev.biometricAvailable && sq.dev.quick == 'biometric'"),
        { type: "menu", visibleWhen: "opt.allowPasskey != false && sq.dev.quick != 'passkey'", items: [{ id: "passkey", label: "Passkey", text: "A secure key stored on your device. Nothing to remember or type.", icon: "shield", actions: [set("sq.method", "passkey")] }] },
        text("Passkey · On", "body", "opt.allowPasskey != false && sq.dev.quick == 'passkey'"),
        { type: "menu", visibleWhen: "opt.allowPin != false && sq.dev.quick != 'pin'", items: [{ id: "pin", label: "6-digit PIN", text: "Works only on this device.", icon: "lock", actions: [set("sq.method", "pin")] }] },
        text("6-digit PIN · On", "body", "opt.allowPin != false && sq.dev.quick == 'pin'"),
        { type: "menu", visibleWhen: "sq.dev.quick != 'off'", items: [{ id: "off", label: "Turn off", text: "You will use your password.", icon: "x", actions: [set("sq.method", "off")] }] },
        text("You chose: {{sq.method == 'biometric' ? 'Face ID or fingerprint' : sq.method == 'passkey' ? 'Passkey' : sq.method == 'pin' ? '6-digit PIN' : 'Turn off'}}", "caption", "sq.method"),
        alert("error", "That PIN is too easy to guess. Avoid repeats and runs like 111111 or 123456.", "sq.chk.code == 'PIN_WEAK'"),
        alert("error", "Don’t use digits from your phone number.", "sq.chk.code == 'PIN_PHONE'"),
        alert("error", "The PINs don’t match.", "sq.method == 'pin' && sq.mismatch"),
        { type: "textInput", bind: "sq.pin", label: "Choose a PIN", placeholder: "6 digits", keyboard: "number", secure: true, pattern: "^[0-9]{6}$", patternMessage: "Use exactly 6 digits.", visibleWhen: "sq.method == 'pin'" },
        { type: "textInput", bind: "sq.confirm", label: "Confirm PIN", placeholder: "6 digits", keyboard: "number", secure: true, visibleWhen: "sq.method == 'pin'" },
        button("Continue", [
          { type: "validate" },
          set("sq.tried", true), set("sq.chk", null), set("sq.mismatch", "{{sq.pin != sq.confirm}}"),
          { type: "navigate" },
        ]),
      ],
      navigation: route(
        ["sq.method == 'pin' && sq.mismatch", "method"], ["sq.method == 'pin'", "checkPin"], ["sq.method == 'off'", "turnOff"], ["sq.method == 'biometric' || sq.method == 'passkey'", "bio"],
      ),
    },
    {
      // the rules for a PIN are the bank's: it says whether this one would do before the code is asked for
      id: "checkPin", title: "Quick sign-in", kind: "branch",
      onEnter: [{ type: "callApi", integration: "checkPin", input: { pin: "{{sq.pin}}" }, saveAs: "sq.chk", onError: { navigate: "fail" } }, go("sendCode")],
      navigation: route(["!sq.chk.ok", "method"]),
      blocks: [],
    },
    {
      // turning off needs no code: it only makes sign-in stricter
      id: "turnOff", title: "Quick sign-in", kind: "branch",
      onEnter: [{ type: "callApi", integration: "setQuickSignIn", input: { method: "off" }, saveAs: "sq.res", onError: { navigate: "fail" } }, go("done")],
      blocks: [],
    },
    {
      id: "bio", title: "Confirm on this device",
      blocks: [
        text("Confirm on this device", "title"),
        text("Look at your phone or use your fingerprint.", "body", "sq.method == 'biometric'"),
        text("Use your device lock to create a passkey.", "body", "sq.method == 'passkey'"),
        button("Continue", [go("sendCode")]),
        button("Back", [go("method")], "ghost"),
      ],
    },
    {
      id: "sendCode", title: "Enter your code", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "otpSend", input: { channel: "sms", strict: true }, saveAs: "sq.otp", onError: { navigate: "codeFail" } },
        set("sq.code", ""), set("sq.codeError", ""), set("sq.wrong", 0),
        go("code"),
      ],
      blocks: [],
    },
    {
      id: "code", title: "Enter your code",
      blocks: [
        text("Enter your code", "title"),
        text("Sent to the phone ending {{sq.otp.last4}}.", "body"),
        alert("error", "That code isn’t right. Try again.", "sq.codeError == 'OTP_INVALID'"),
        alert("warning", "{{3 - sq.wrong}} {{sq.wrong == 2 ? 'try' : 'tries'}} left.", "sq.codeError == 'OTP_INVALID' && sq.wrong > 0"),
        alert("error", "That code has expired. Go back to get a new one.", "sq.codeError == 'OTP_EXPIRED'"),
        { type: "otp", bind: "sq.code", length: 6, visibleWhen: "sq.codeError != 'OTP_EXPIRED'" },
        button("Turn on", [
          { type: "validate" },
          { type: "callApi", integration: "otpVerify", input: { code: "{{sq.code}}", strict: true }, onError: { navigate: "codeFail" } },
          set("sq.code", ""),
          { type: "callApi", integration: "setQuickSignIn", input: { method: "{{sq.method}}", pin: "{{sq.pin}}" }, saveAs: "sq.res", onError: { navigate: "fail" } },
          // the bank has the PIN: the journey does not keep it
          set("sq.pin", ""), set("sq.confirm", ""),
          { type: "navigate" },
        ], "primary", "sq.codeError != 'OTP_EXPIRED'"),
        button("Back", [set("sq.codeError", ""), ...wipe, go("method")], "primary", "sq.codeError == 'OTP_EXPIRED'"),
      ],
      navigation: route(["sq.res.ok", "done"], ["sq.res.ok == false", "method"]),
    },
    {
      id: "codeFail", title: "Enter your code", kind: "branch",
      onEnter: [
        set("sq.code", ""),
        set("sq.codeError", "{{ctx.error.code}}"),
        set("sq.wrong", "{{ctx.error.code == 'OTP_INVALID' ? sq.wrong + 1 : sq.wrong}}"),
        go("code"),
      ],
      navigation: route(["ctx.error.code == 'OTP_LOCKED'", "codeLocked"], ["ctx.error.code != 'OTP_INVALID' && ctx.error.code != 'OTP_EXPIRED'", "problem"]),
      blocks: [],
    },
    {
      id: "fail", title: "Quick sign-in", kind: "branch",
      onEnter: [...wipe, go("problem")],
      navigation: route(...failRules),
      blocks: [],
    },
    {
      id: "codeLocked", title: "Too many wrong codes", kind: "terminal", onEnter: wipe,
      blocks: [
        { type: "result", tone: "error", title: "Too many wrong codes", text: "Nothing was changed. Go back to start again." },
        button("Back to start", [go("start")]),
      ],
    },
    {
      id: "untrusted", title: "Trust this device first", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "Trust this device first", text: "Quick sign-in works on a device you trust. Sign in again and choose Trust this device." },
        button("Done", [{ type: "exit" }]),
      ],
    },
    {
      id: "done", title: "Quick sign-in", kind: "terminal", onEnter: wipe,
      blocks: [
        { type: "result", tone: "success", title: "Quick sign-in is on", text: "Next time you can sign in on this device without your password.", visibleWhen: "sq.res.method != 'off'" },
        { type: "result", tone: "success", title: "Quick sign-in is off", text: "You will use your password on this device.", visibleWhen: "sq.res.method == 'off'" },
        { type: "reviewSummary", rows: [{ label: "Device", value: "{{sq.res.device}}" }, { label: "Method", value: NAME("sq.res.method") }] },
        button("Change PIN", [{ type: "navigate", toJourney: "change-quick-pin" }], "secondary", "sq.res.method == 'pin'"),
        button("Back to security", [{ type: "exit" }]),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    ...commonScreens("Quick sign-in", wipe),
  ] as Screen[],
};
