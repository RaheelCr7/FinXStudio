import type { Block, Journey, Screen } from "../schema";
import { forgotUsernameAcceptance, forgotUsernameScenarios } from "./forgot-username-tests";

const text = (t: string, variant?: "title" | "body" | "caption", visibleWhen?: string): Block => ({ type: "text", text: t, ...(variant ? { variant } : {}), ...(visibleWhen ? { visibleWhen } : {}) });
const alert = (tone: "info" | "warning" | "error" | "success", t: string, visibleWhen?: string): Block => ({ type: "alert", tone, text: t, ...(visibleWhen ? { visibleWhen } : {}) });
const button = (label: string, actions: any[], variant: "primary" | "secondary" | "ghost" = "primary", visibleWhen?: string): Block => ({ type: "button", label, variant, actions, ...(visibleWhen ? { visibleWhen } : {}) });
const go = (to: string) => ({ type: "navigate" as const, to });
const set = (path: string, value: unknown) => ({ type: "setData" as const, path, value });
const route = (...rules: [string, string][]) => ({ rules: rules.map(([when, to]) => ({ when, to })) });

/**
 * Forgot username (BankWorkx, Signing in and security). Say who you are with a mobile number (or an email) and a date of birth, confirm a
 * one-time code, and the bank sends the username to the contact it already holds. The username is never shown, and never held by this
 * journey: the bank's answers carry only a masked contact and a token that is cleared after use.
 *
 * Built from the spec of the prototype with the blocks FinX has: the date of birth is one calendar field (dateInput) where the prototype has
 * Day, Month and Year; "Contact us" shows the bank's sandbox number because there is no contact-support journey yet.
 */
export const forgotUsername: Journey = {
  id: "jrn_bankworkx_forgot_username",
  slug: "forgot-username",
  name: "Forgot username",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: forgotUsernameAcceptance,
  scenarios: forgotUsernameScenarios,
  dataModel: {
    "opt.allowEmail": { type: "boolean" },
    "fu.by": { type: "string" },
    "fu.mobile": { type: "string", required: true, pattern: "^\\+?(?:[ ()-]*[0-9]){7,18}[ ()-]*$" },
    "fu.email": { type: "string", required: true, pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$" },
    "fu.dob": { type: "string", required: true },
    "fu.code": { type: "string", required: true, pattern: "^[0-9]{6}$" },
    "fu.codeError": { type: "string" },
    "ui.callUs": { type: "boolean" },
  },
  integrations: [
    { id: "findProfile", adapter: "bank.recover.verifyUser", mode: "sandbox" },
    { id: "otpSend", adapter: "bank.otp.send", mode: "sandbox" },
    { id: "otpVerify", adapter: "bank.otp.verify", mode: "sandbox" },
    { id: "sendUsername", adapter: "bank.recover.sendUsername", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Forgot your username?", kind: "branch",
      onEnter: [set("fu.by", "mobile"), set("fu.mobile", ""), set("fu.email", ""), set("fu.dob", null), set("fu.code", ""), set("fu.codeError", ""), set("ui.callUs", false), go("find")],
      blocks: [],
    },
    {
      id: "find", title: "Forgot your username?",
      blocks: [
        text("Forgot your username?", "title"),
        text("Tell us how to find you.", "body"),
        alert("error", "We couldn’t match those details. Check them and try again.", "found.code == 'NOT_FOUND'"),
        { type: "select", bind: "fu.by", label: "Find you by", variant: "chips", choices: [{ id: "mobile", label: "Mobile number" }, { id: "email", label: "Email" }], visibleWhen: "opt.allowEmail != false" },
        { type: "textInput", bind: "fu.mobile", label: "Mobile number", placeholder: "Mobile number", keyboard: "phone", pattern: "^\\+?(?:[ ()-]*[0-9]){7,18}[ ()-]*$", patternMessage: "Enter a valid mobile number.", visibleWhen: "fu.by == 'mobile' || opt.allowEmail == false" },
        { type: "textInput", bind: "fu.email", label: "Email", placeholder: "name@example.com", keyboard: "email", pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", patternMessage: "Enter a valid email address.", visibleWhen: "fu.by == 'email' && opt.allowEmail != false" },
        { type: "dateInput", bind: "fu.dob", label: "Date of birth", max: "today", messages: { max: "Enter a date in the past." } },
        button("Continue", [
          { type: "validate" },
          { type: "callApi", integration: "findProfile", input: { mobile: "{{fu.by == 'email' && opt.allowEmail != false ? '' : fu.mobile}}", email: "{{fu.by == 'email' && opt.allowEmail != false ? fu.email : ''}}", dateOfBirth: "{{fu.dob}}" }, saveAs: "found", onError: { navigate: "problem" } },
          { type: "navigate" },
        ]),
      ],
      navigation: route(["found.ok", "sendCode"], ["found.code == 'ID_LOCKED'", "locked"]),
    },
    {
      id: "sendCode", title: "Enter your code", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "otpSend", input: { channel: "sms" }, onError: { navigate: "codeFail" } },
        set("fu.code", ""), set("fu.codeError", ""),
        go("code"),
      ],
      blocks: [],
    },
    {
      id: "code", title: "Enter your code",
      blocks: [
        text("Enter your code", "title"),
        alert("info", "We sent a 6-digit code to {{found.maskedContact}}.", "found.maskedContact"),
        alert("error", "That code isn’t right. Check the latest message and try again.", "fu.codeError == 'OTP_INVALID'"),
        alert("error", "That code has expired. Ask for a new one.", "fu.codeError == 'OTP_EXPIRED'"),
        alert("error", "You have asked for the maximum number of codes. Try again later.", "fu.codeError == 'OTP_RESEND_LIMIT'"),
        { type: "otp", bind: "fu.code", length: 6 },
        button("Resend code", [
          { type: "callApi", integration: "otpSend", input: { channel: "sms" }, onError: { navigate: "codeFail" } },
          set("fu.code", ""), set("fu.codeError", ""),
          { type: "showToast", text: "New code sent. The old code no longer works." },
        ], "secondary"),
        button("Send my username", [
          { type: "validate" },
          { type: "callApi", integration: "otpVerify", input: { code: "{{fu.code}}" }, onError: { navigate: "codeFail" } },
          { type: "callApi", integration: "sendUsername", input: { recoveryToken: "{{found.recoveryToken}}" }, saveAs: "sent", onError: { navigate: "codeFail" } },
          // the token has done its work
          set("found.recoveryToken", ""), set("fu.code", ""),
          go("result"),
        ]),
      ],
    },
    {
      // a code that did not work, or a call that did not answer
      id: "codeFail", title: "Enter your code", kind: "branch",
      onEnter: [set("fu.code", ""), set("fu.codeError", "{{ctx.error.code}}"), go("code")],
      navigation: route(
        ["ctx.error.code == 'ID_LOCKED'", "locked"],
        ["ctx.error.code == 'TOKEN_EXPIRED' || ctx.error.code == 'TOKEN_INVALID'", "expired"],
        ["ctx.error.code == 'SERVICE_UNAVAILABLE' || ctx.error.code == 'TIMEOUT'", "problem"],
      ),
      blocks: [],
    },
    {
      id: "result", title: "We sent your username", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "We sent your username", text: "Check your messages. We never send your password." },
        { type: "statusChip", status: "sent", label: "Sent", tone: "positive" },
        { type: "reviewSummary", rows: [{ label: "Sent to", value: "{{sent.maskedContact}}" }] },
        button("Sign in", [{ type: "navigate", toJourney: "sign-in" }]),
        button("Reset password", [{ type: "navigate", toJourney: "reset-password" }], "secondary"),
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
        { type: "result", tone: "error", title: "That took too long", text: "For your security this has timed out. Nothing was sent. Start again." },
        button("Start again", [go("start")]),
      ],
    },
    {
      id: "problem", title: "Forgot your username?",
      blocks: [
        alert("error", "We couldn’t reach the bank. Nothing was changed.", "ctx.error.code == 'SERVICE_UNAVAILABLE'"),
        alert("error", "This is taking longer than expected. Nothing was changed.", "ctx.error.code == 'TIMEOUT'"),
        alert("error", "Something went wrong. Nothing was changed.", "ctx.error.code != 'SERVICE_UNAVAILABLE' && ctx.error.code != 'TIMEOUT'"),
        button("Try again", [go("start")]),
      ],
    },
  ] as Screen[],
};
