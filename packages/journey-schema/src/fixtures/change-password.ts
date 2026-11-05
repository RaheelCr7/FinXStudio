import type { Journey, Screen } from "../schema";
import { changePasswordAcceptance, changePasswordScenarios } from "./change-password-tests";
import { alert, button, CALL_US, commonScreens, failRules, go, needsPermission, route, set, text } from "./security-kit";

/** What this journey holds only while it is being sent. Cleared on every way out. */
const wipe = [set("cp.current", ""), set("cp.new", ""), set("cp.confirm", ""), set("cp.code", "")];
/** The tick or the circle for one rule of the list the bank gave back after Continue (the length is live; the other four come from the bank). */
const tick = (i: number, label: string) => text(`{{cp.pol ? (cp.pol.rules[${i}].ok ? '✓' : '○') : '○'}} ${label}`, "caption");

/**
 * Change password (BankWorkx, Signing in and security, Settings > Security). The current password, a new one checked against the rules, then a
 * one-time code. The bank keeps the checked current password for five minutes, so the journey clears it the moment the bank has it and never
 * holds the password it was told about; the new password is held from the second screen to the code and is cleared on every way out.
 *
 * Built from the spec of the prototype with the blocks FinX has: the checklist ticks the length as it is typed and the other four rules when
 * the person presses Continue (the engine cannot ask the bank on every key press), and there is no Show or Hide link.
 */
export const changePassword: Journey = {
  id: "jrn_bankworkx_change_password",
  slug: "change-password",
  name: "Change password",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: changePasswordAcceptance,
  scenarios: changePasswordScenarios,
  dataModel: {
    "opt.signOutOthers": { type: "boolean" },
    "cp.current": { type: "string", required: true },
    "cp.new": { type: "string", required: true },
    "cp.confirm": { type: "string", required: true },
    "cp.code": { type: "string", required: true, pattern: "^[0-9]{6}$" },
    "cp.codeError": { type: "string" },
    "cp.wrong": { type: "number" },
    "cp.mismatch": { type: "boolean" },
    "ui.callUs": { type: "boolean" },
  },
  integrations: [
    { id: "checkPassword", adapter: "bank.password.check", mode: "sandbox" },
    { id: "passwordPolicy", adapter: "bank.password.policy", mode: "sandbox" },
    { id: "otpSend", adapter: "bank.otp.send", mode: "sandbox" },
    { id: "otpVerify", adapter: "bank.otp.verify", mode: "sandbox" },
    { id: "changePassword", adapter: "bank.password.change", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Change password", kind: "branch",
      onEnter: [...wipe, set("cp.check", null), set("cp.pol", null), set("cp.cr", null), set("cp.codeError", ""), set("cp.wrong", 0), set("cp.mismatch", false), set("ui.callUs", false), go("cur")],
      navigation: route([needsPermission, "denied"]),
      blocks: [],
    },
    {
      id: "cur", title: "Current password",
      blocks: [
        text("Current password", "title"),
        alert("error", "That isn’t your current password.", "cp.check.code == 'INVALID_PASSWORD'"),
        alert("warning", "{{cp.check.attemptsLeft}} {{cp.check.attemptsLeft == 1 ? 'attempt' : 'attempts'}} left.", "cp.check.code == 'INVALID_PASSWORD'"),
        { type: "textInput", bind: "cp.current", label: "Current password", secure: true },
        button("Continue", [
          { type: "validate" },
          { type: "callApi", integration: "checkPassword", input: { current: "{{cp.current}}" }, saveAs: "cp.check", onError: { navigate: "fail" } },
          // the bank has it (and remembers for five minutes that it was right): the journey does not keep it
          set("cp.current", ""),
          { type: "navigate" },
        ]),
      ],
      navigation: route(["cp.check.ok", "new"], ["cp.check.code == 'ACCOUNT_LOCKED'", "locked"]),
    },
    {
      id: "new", title: "New password",
      blocks: [
        text("New password", "title"),
        alert("error", "Choose a different password.", "cp.pol.code == 'PASSWORD_SAME'"),
        alert("error", "Use at least 12 characters. Three or four unrelated words work well.", "cp.pol.code == 'MIN_LENGTH'"),
        alert("error", "Use 64 characters or fewer.", "cp.pol.code == 'MAX_LENGTH'"),
        alert("error", "Don’t use your username in your password.", "cp.pol.code == 'PASSWORD_CONTAINS_USERNAME'"),
        alert("error", "That password is too common. Try a longer phrase of unrelated words.", "cp.pol.code == 'PASSWORD_COMMON'"),
        alert("error", "This password has appeared in a data breach, so we can’t accept it.", "cp.pol.code == 'PASSWORD_BREACHED'"),
        alert("error", "Choose a password you haven’t used here before.", "cp.pol.code == 'PASSWORD_REUSED'"),
        alert("error", "The two passwords don’t match.", "cp.mismatch"),
        alert("error", "That didn’t work. Nothing was changed. Choose the new password again.", "cp.cr.ok == false"),
        { type: "textInput", bind: "cp.new", label: "New password", placeholder: "At least 12 characters", secure: true },
        { type: "textInput", bind: "cp.confirm", label: "Confirm new password", secure: true },
        text("{{len(cp.new) >= 12 ? '✓' : '○'}} At least 12 characters", "caption"),
        tick(1, "Not your username"), tick(2, "Not a common password"), tick(3, "Not in a known data breach"), tick(4, "Not one you used before"),
        button("Continue", [
          { type: "validate" },
          { type: "callApi", integration: "passwordPolicy", input: { password: "{{cp.new}}" }, saveAs: "cp.pol", onError: { navigate: "fail" } },
          set("cp.mismatch", "{{cp.new != cp.confirm}}"),
          set("cp.cr", null),
          { type: "navigate" },
        ]),
      ],
      navigation: route(["cp.pol.ok && !cp.mismatch", "sendCode"]),
    },
    {
      id: "sendCode", title: "Enter your code", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "otpSend", input: { channel: "sms", strict: true }, saveAs: "cp.otp", onError: { navigate: "codeFail" } },
        set("cp.code", ""), set("cp.codeError", ""), set("cp.wrong", 0),
        go("code"),
      ],
      blocks: [],
    },
    {
      id: "code", title: "Enter your code",
      blocks: [
        text("Enter your code", "title"),
        text("Sent to the phone ending {{cp.otp.last4}}.", "body"),
        alert("error", "That code isn’t right. Try again.", "cp.codeError == 'OTP_INVALID'"),
        alert("warning", "{{3 - cp.wrong}} {{cp.wrong == 2 ? 'try' : 'tries'}} left.", "cp.codeError == 'OTP_INVALID' && cp.wrong > 0"),
        alert("error", "That code has expired. Go back to get a new one.", "cp.codeError == 'OTP_EXPIRED'"),
        alert("error", "You have asked for the maximum number of codes. Try again later.", "cp.codeError == 'OTP_RESEND_LIMIT'"),
        { type: "otp", bind: "cp.code", length: 6 },
        button("Resend code", [
          { type: "callApi", integration: "otpSend", input: { channel: "sms", strict: true, resend: true }, saveAs: "cp.otp", onError: { navigate: "codeFail" } },
          set("cp.code", ""), set("cp.codeError", ""), set("cp.wrong", 0),
          { type: "showToast", text: "New code sent. The old code no longer works." },
        ], "secondary", "cp.codeError != 'OTP_EXPIRED'"),
        button("Confirm", [
          { type: "validate" },
          { type: "callApi", integration: "otpVerify", input: { code: "{{cp.code}}", strict: true }, onError: { navigate: "codeFail" } },
          set("cp.code", ""),
          { type: "callApi", integration: "changePassword", input: { new: "{{cp.new}}", confirm: "{{cp.confirm}}", signOutOthers: "{{opt.signOutOthers != false}}" }, saveAs: "cp.cr", onError: { navigate: "fail" } },
          // the bank has the new password: the journey does not keep it
          set("cp.new", ""), set("cp.confirm", ""),
          { type: "navigate" },
        ], "primary", "cp.codeError != 'OTP_EXPIRED'"),
        button("Back", [set("cp.codeError", ""), ...wipe, go("new")], "primary", "cp.codeError == 'OTP_EXPIRED'"),
      ],
      navigation: route(["cp.cr.ok", "done"], ["cp.cr.ok == false", "new"]),
    },
    {
      // a code that did not work: what it says, and the third wrong one ends the attempt
      id: "codeFail", title: "Enter your code", kind: "branch",
      onEnter: [
        set("cp.code", ""),
        set("cp.codeError", "{{ctx.error.code}}"),
        set("cp.wrong", "{{ctx.error.code == 'OTP_INVALID' ? cp.wrong + 1 : cp.wrong}}"),
        go("code"),
      ],
      navigation: route(["ctx.error.code == 'OTP_LOCKED'", "codeLocked"], ["ctx.error.code != 'OTP_INVALID' && ctx.error.code != 'OTP_EXPIRED' && ctx.error.code != 'OTP_RESEND_LIMIT'", "problem"]),
      blocks: [],
    },
    {
      // any other failure of a bank call: the step-up ran out, the bank did not answer
      id: "fail", title: "Change password", kind: "branch",
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
      id: "locked", title: "Account locked", kind: "terminal", onEnter: wipe,
      blocks: [
        { type: "result", tone: "error", title: "Account locked", text: "Too many wrong passwords." },
        button("Reset password", [{ type: "navigate", toJourney: "forgot-password" }]),
        button("Contact support", [set("ui.callUs", true)], "secondary"),
        alert("info", CALL_US, "ui.callUs"),
      ],
    },
    {
      id: "done", title: "Password changed", kind: "terminal", onEnter: wipe,
      blocks: [
        { type: "result", tone: "success", title: "Password changed", text: "Use your new password next time you sign in." },
        { type: "reviewSummary", rows: [{ label: "Changed", value: "{{cp.cr.changedText}}" }, { label: "Other devices", value: "{{cp.cr.otherDevicesSignedOut ? 'Signed out' : 'Still signed in'}}" }] },
        button("Back to security", [{ type: "exit" }]),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    ...commonScreens("Change password", wipe),
  ] as Screen[],
};
