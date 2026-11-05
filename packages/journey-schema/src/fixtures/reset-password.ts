import type { Block, Journey, Screen } from "../schema";
import { resetPasswordAcceptance, resetPasswordScenarios } from "./reset-password-tests";

const text = (t: string, variant?: "title" | "body" | "caption", visibleWhen?: string): Block => ({ type: "text", text: t, ...(variant ? { variant } : {}), ...(visibleWhen ? { visibleWhen } : {}) });
const alert = (tone: "info" | "warning" | "error" | "success", t: string, visibleWhen?: string): Block => ({ type: "alert", tone, text: t, ...(visibleWhen ? { visibleWhen } : {}) });
const button = (label: string, actions: any[], variant: "primary" | "secondary" | "ghost" = "primary", visibleWhen?: string): Block => ({ type: "button", label, variant, actions, ...(visibleWhen ? { visibleWhen } : {}) });
const go = (to: string) => ({ type: "navigate" as const, to });
const set = (path: string, value: unknown) => ({ type: "setData" as const, path, value });
const route = (...rules: [string, string][]) => ({ rules: rules.map(([when, to]) => ({ when, to })) });

/**
 * Reset password (BankWorkx, Signing in and security). Say who you are with a username or an email, confirm a one-time code sent to the
 * mobile number on file, then either choose a new password or, in the unlock mode, just unlock the profile and keep the old password.
 * `forgot-password` (mode reset) and `unlock-account` (mode unlock) are thin entries that open this journey with launch.mode.
 * The journey never keeps the new password, and the token the bank hands out is cleared once it has been used.
 *
 * Built from the spec of the prototype with the blocks FinX has: the live checklist shows only the length (the other rules are checked by
 * the bank when you finish), there is no Show or Hide link, and "Contact us" shows the bank's sandbox number.
 */
export const resetPassword: Journey = {
  id: "jrn_bankworkx_reset_password",
  slug: "reset-password",
  name: "Reset password",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: resetPasswordAcceptance,
  scenarios: resetPasswordScenarios,
  dataModel: {
    "launch.mode": { type: "string" },
    "launch.user": { type: "string" },
    "opt.allowUnlock": { type: "boolean" },
    "rp.mode": { type: "string" },
    "rp.user": { type: "string", required: true, pattern: "^\\S{3,80}$" },
    "rp.code": { type: "string", required: true, pattern: "^[0-9]{6}$" },
    "rp.codeError": { type: "string" },
    "rp.password": { type: "string", required: true },
    "rp.confirm": { type: "string", required: true },
    "ui.callUs": { type: "boolean" },
  },
  integrations: [
    { id: "findProfile", adapter: "bank.recover.verifyUser", mode: "sandbox" },
    { id: "otpSend", adapter: "bank.otp.send", mode: "sandbox" },
    { id: "otpVerify", adapter: "bank.otp.verify", mode: "sandbox" },
    { id: "resetPassword", adapter: "bank.recover.resetPassword", mode: "sandbox" },
    { id: "unlockProfile", adapter: "bank.recover.unlock", mode: "sandbox" },
  ],
  screens: [
    {
      // the mode comes from the way in; with unlock switched off an unlock link opens a reset
      id: "start", title: "Reset your password", kind: "branch",
      onEnter: [
        set("rp.mode", "{{launch.mode == 'unlock' && opt.allowUnlock != false ? 'unlock' : 'reset'}}"),
        set("rp.user", "{{launch.user ? launch.user : ''}}"), set("rp.code", ""), set("rp.codeError", ""), set("rp.password", ""), set("rp.confirm", ""), set("ui.callUs", false),
        go("ident"),
      ],
      blocks: [],
    },
    {
      id: "ident", title: "{{rp.mode == 'unlock' ? 'Unlock your account' : 'Reset your password'}}",
      blocks: [
        text("{{rp.mode == 'unlock' ? 'Unlock your account' : 'Reset your password'}}", "title"),
        alert("error", "We couldn’t find a profile with those details. Check them and try again.", "found.code == 'NOT_FOUND'"),
        { type: "textInput", bind: "rp.user", label: "Username or email", placeholder: "Username or email", pattern: "^\\S{3,80}$", patternMessage: "Enter your username or the email address we have for you." },
        button("Continue", [
          { type: "validate" },
          { type: "callApi", integration: "findProfile", input: { usernameOrEmail: "{{rp.user}}" }, saveAs: "found", onError: { navigate: "problem" } },
          { type: "navigate" },
        ]),
      ],
      navigation: route(["found.ok", "sendCode"], ["found.code == 'ID_LOCKED'", "locked"]),
    },
    {
      id: "sendCode", title: "Enter your code", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "otpSend", input: { channel: "sms" }, onError: { navigate: "codeFail" } },
        set("rp.code", ""), set("rp.codeError", ""),
        go("code"),
      ],
      blocks: [],
    },
    {
      id: "code", title: "Enter your code",
      blocks: [
        text("Enter your code", "title"),
        alert("info", "We sent a 6-digit code to {{found.maskedMobile}}.", "found.maskedMobile"),
        alert("error", "That code isn’t right. Check the latest message and try again.", "rp.codeError == 'OTP_INVALID'"),
        alert("error", "That code has expired. Ask for a new one.", "rp.codeError == 'OTP_EXPIRED'"),
        alert("error", "You have asked for the maximum number of codes. Try again later.", "rp.codeError == 'OTP_RESEND_LIMIT'"),
        { type: "otp", bind: "rp.code", length: 6 },
        button("Resend code", [
          { type: "callApi", integration: "otpSend", input: { channel: "sms" }, onError: { navigate: "codeFail" } },
          set("rp.code", ""), set("rp.codeError", ""),
          { type: "showToast", text: "New code sent. The old code no longer works." },
        ], "secondary"),
        button("Continue", [
          { type: "validate" },
          { type: "callApi", integration: "otpVerify", input: { code: "{{rp.code}}" }, onError: { navigate: "codeFail" } },
          set("rp.code", ""), set("rp.codeError", ""),
          go("newpw"),
        ]),
      ],
      navigation: route(["rp.mode == 'unlock'", "unlock"]),
    },
    {
      id: "codeFail", title: "Enter your code", kind: "branch",
      onEnter: [set("rp.code", ""), set("rp.codeError", "{{ctx.error.code}}"), go("code")],
      navigation: route(
        ["ctx.error.code == 'ID_LOCKED'", "locked"],
        ["ctx.error.code == 'TOKEN_EXPIRED' || ctx.error.code == 'TOKEN_INVALID'", "expired"],
        ["ctx.error.code == 'SERVICE_UNAVAILABLE' || ctx.error.code == 'TIMEOUT'", "problem"],
      ),
      blocks: [],
    },
    {
      id: "newpw", title: "Choose a new password",
      blocks: [
        text("Choose a new password", "title"),
        alert("error", "Use at least 12 characters. Three or four unrelated words work well.", "rs.code == 'MIN_LENGTH'"),
        alert("error", "Use 64 characters or fewer.", "rs.code == 'MAX_LENGTH'"),
        alert("error", "Don’t use your username in your password.", "rs.code == 'PASSWORD_CONTAINS_USERNAME'"),
        alert("error", "That password is too common. Try a longer phrase of unrelated words.", "rs.code == 'PASSWORD_COMMON'"),
        alert("error", "This password has appeared in a data breach, so we can’t accept it.", "rs.code == 'PASSWORD_BREACHED'"),
        alert("error", "Choose a password you haven’t used here before.", "rs.code == 'PASSWORD_REUSED'"),
        alert("error", "The two passwords don’t match.", "rs.code == 'MISMATCH'"),
        { type: "textInput", bind: "rp.password", label: "Password", placeholder: "At least 12 characters", secure: true, pattern: "^.{12,}$", patternMessage: "Use at least 12 characters. Three or four unrelated words work well." },
        { type: "textInput", bind: "rp.confirm", label: "Confirm password", secure: true },
        text("{{len(rp.password) >= 12 ? '✓' : '○'}} At least 12 characters", "caption"),
        text("○ Not your username · not a common password · not in a known data breach (checked when you finish)", "caption"),
        button("Finish", [
          { type: "validate" },
          { type: "callApi", integration: "resetPassword", input: { recoveryToken: "{{found.recoveryToken}}", password: "{{rp.password}}", confirm: "{{rp.confirm}}" }, saveAs: "rs", onError: { navigate: "codeFail" } },
          // the new password is not kept once the bank has it
          set("rp.password", ""), set("rp.confirm", ""),
          { type: "navigate" },
        ]),
      ],
      navigation: route(["rs.ok", "resetDone"]),
    },
    {
      id: "unlock", title: "Unlock your account",
      blocks: [
        text("Unlock your account", "title"),
        text("Your password stays the same.", "body"),
        button("Unlock account", [
          { type: "callApi", integration: "unlockProfile", input: { recoveryToken: "{{found.recoveryToken}}" }, saveAs: "ul", onError: { navigate: "codeFail" } },
          go("unlockDone"),
        ]),
      ],
    },
    {
      id: "resetDone", title: "Password changed", kind: "terminal",
      onEnter: [set("found.recoveryToken", "")],
      blocks: [
        { type: "result", tone: "success", title: "Password changed", text: "Sign in with your new password." },
        { type: "statusChip", status: "done", label: "Done", tone: "positive" },
        { type: "reviewSummary", rows: [{ label: "Username", value: "{{rs.username}}" }, { label: "Changed", value: "{{rs.changedOn | date}}" }] },
        button("Sign in", [{ type: "navigate", toJourney: "sign-in", with: { "launch.user": "{{rs.username}}" } }]),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "unlockDone", title: "Account unlocked", kind: "terminal",
      onEnter: [set("found.recoveryToken", "")],
      blocks: [
        { type: "result", tone: "success", title: "Account unlocked", text: "You can sign in now. Your password hasn’t changed.", visibleWhen: "ul.wasLocked" },
        { type: "statusChip", status: "unlocked", label: "Unlocked", tone: "positive", visibleWhen: "ul.wasLocked" },
        { type: "result", tone: "success", title: "Your account isn’t locked", text: "You can sign in now.", visibleWhen: "!ul.wasLocked" },
        { type: "reviewSummary", rows: [{ label: "Username", value: "{{ul.username}}" }] },
        button("Sign in", [{ type: "navigate", toJourney: "sign-in", with: { "launch.user": "{{ul.username}}" } }]),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "locked", title: "Too many tries", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "Too many tries", text: "For your security, try again in 30 minutes, or contact us." },
        button("Contact us", [set("ui.callUs", true)], "secondary"),
        alert("info", "Call us on +1 800 555 0100 (sandbox number).", "ui.callUs"),
      ],
    },
    {
      id: "expired", title: "Start again", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "That took too long", text: "For your security this has timed out. Nothing was changed. Start again." },
        button("Start again", [go("start")]),
      ],
    },
    {
      id: "problem", title: "Reset your password",
      blocks: [
        alert("error", "We couldn’t reach the bank. Nothing was changed.", "ctx.error.code == 'SERVICE_UNAVAILABLE'"),
        alert("error", "This is taking longer than expected. Nothing was changed.", "ctx.error.code == 'TIMEOUT'"),
        alert("error", "Something went wrong. Nothing was changed.", "ctx.error.code != 'SERVICE_UNAVAILABLE' && ctx.error.code != 'TIMEOUT'"),
        button("Try again", [go("start")]),
      ],
    },
  ] as Screen[],
};
