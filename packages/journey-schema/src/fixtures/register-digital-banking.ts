import type { Journey, Screen } from "../schema";
import { registerDigitalBankingAcceptance, registerDigitalBankingScenarios } from "./register-digital-banking-tests";
import { alert, answerRules, button, CODE_WORDS, downScreens, go, lengthLine, route, set, text } from "./public-kit";

const err = (e: string) => `rg.err == '${e}'`;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));
/** What the journey holds only until the bank has it: the code, the password and its repeat. Cleared on every way out, the problem screens included. */
const wipe = [set("rg.code", ""), set("rg.password", ""), set("rg.confirm", "")];
const NOT_MATCHED = "We couldn’t match those details. Check them and try again.";
/** What a refusal of the identity step says, by the bank's code: the words of the spec, never an error code and never which part did not match. */
const IDENTITY: [string, string][] = [
  ["NOT_MATCHED", NOT_MATCHED], ["ALREADY_REGISTERED", "You’re already registered. Sign in, or reset your password if you’ve forgotten it."], ["CUSTOMER_ID_INVALID", "Enter your 8-digit customer ID."], ["CARD_INVALID", "Check the card number."],
  ["CARD_UNAVAILABLE", "Use your customer ID."], ["YEAR_INVALID", "Enter a 4-digit year."], ["DATE_INVALID", "That date doesn’t exist."], ["DATE_FUTURE", "Enter a date in the past."], ["UNDER_AGE", "You need to be 18 or over to register online."],
];
/** What the bank says about a username and a password that do not do, by its code. */
const CREDS: [string, string][] = [
  ["USERNAME_TAKEN", "That username is taken. Try another."], ["USERNAME_INVALID", "Use 6 to 30 letters, numbers, dots, dashes or underscores."], ["MISMATCH", "The two passwords don’t match."],
  ["MIN_LENGTH", "Use at least 12 characters. Three or four unrelated words work well."], ["MAX_LENGTH", "Use 64 characters or fewer."], ["PASSWORD_CONTAINS_USERNAME", "Don’t use your username in your password."],
  ["PASSWORD_COMMON", "That password is too common. Try a longer phrase of unrelated words."], ["PASSWORD_BREACHED", "This password has appeared in a data breach, so we can’t accept it."],
  ["PASSWORD_REUSED", "Choose a password you haven’t used here before."], ["TERMS_REQUIRED", "Please agree to continue."], ["NAME_REQUIRED", "Give this device a name."],
];
const OPTIONS = { allowCard: "{{opt.allowCard != false}}" };
const FINISH_INPUT = {
  registrationToken: "{{found.registrationToken}}", username: "{{rg.username}}", password: "{{rg.password}}", confirm: "{{rg.confirm}}", terms: "{{rg.terms}}",
  trustDevice: "{{opt.trustDevice != false && rg.trust}}", offerTrust: "{{opt.trustDevice != false}}", deviceName: "{{rg.device}}",
};

/**
 * Register for digital banking (BankWorkx, Public: before sign-in). An existing customer who has never used digital banking says who they are with a customer ID (or a card number) and a
 * date of birth, or comes from an application that is Ready; confirms a one-time code sent to the mobile number the bank holds; chooses a username and a password; and may trust the
 * device. It builds on the sign-in's credential model (one-time codes, passwords kept only as a salted hash, the same password rules); the profile it makes signs in with the sign-in
 * journey. A miss never says which part did not match, the third wrong check or code locks it for 30 minutes, and the password is cleared from the journey on every way out.
 *
 * Built from the spec of the prototype with the blocks FinX has: Day, Month and Year are two lists and a field; the checklist shows the length live and the other rules after Continue
 * (the engine cannot ask the bank on every key press); the username and password are checked by the bank before the device is asked about, so a refusal shows on the screen it belongs to.
 */
export const registerDigitalBanking: Journey = {
  id: "jrn_bankworkx_register_digital_banking",
  slug: "register-digital-banking",
  name: "Register for digital banking",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: registerDigitalBankingAcceptance,
  scenarios: registerDigitalBankingScenarios,
  dataModel: {
    "launch.applicationId": { type: "string" },
    "opt.allowCard": { type: "boolean" },
    "opt.trustDevice": { type: "boolean" },
    "rg.by": { type: "string" },
    "rg.customerId": { type: "string", required: true, pattern: "^[0-9]{8}$" },
    "rg.card": { type: "string", required: true, pattern: "^[0-9 ]{13,23}$" },
    "rg.day": { type: "string", required: true },
    "rg.month": { type: "string", required: true },
    "rg.year": { type: "string", required: true, pattern: "^(19|20)[0-9]{2}$" },
    "rg.code": { type: "string", required: true, pattern: "^[0-9]{6}$" },
    "rg.username": { type: "string", required: true },
    "rg.password": { type: "string", required: true },
    "rg.confirm": { type: "string", required: true },
    "rg.terms": { type: "boolean", required: true },
    "rg.trust": { type: "boolean" },
    "rg.device": { type: "string", required: true, pattern: "^.{1,30}$" },
    "rg.err": { type: "string" },
  },
  integrations: [
    { id: "verify", adapter: "bank.registration.verify", mode: "sandbox" },
    { id: "otpSend", adapter: "bank.otp.send", mode: "sandbox" },
    { id: "otpVerify", adapter: "bank.otp.verify", mode: "sandbox" },
    { id: "check", adapter: "bank.registration.complete", mode: "sandbox" },
    { id: "complete", adapter: "bank.registration.complete", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Register for digital banking", kind: "branch",
      onEnter: [
        ...wipe, set("rg.by", "id"), set("rg.customerId", ""), set("rg.card", ""), set("rg.day", ""), set("rg.month", ""), set("rg.year", ""), set("rg.username", ""), set("rg.terms", false), set("rg.trust", true), set("rg.device", "My phone"),
        set("rg.err", ""), set("ctx.error", null), { type: "navigate" },
      ],
      // with an application number the identity step is skipped: the application proved who the person is, and the code to its mobile does the rest
      navigation: route(["!isEmpty(launch.applicationId)", "viaApplication"], ["true", "find"]),
      blocks: [],
    },
    {
      id: "viaApplication", title: "Register for digital banking", kind: "branch",
      onEnter: [{ type: "callApi", integration: "verify", input: { applicationId: "{{launch.applicationId}}" }, saveAs: "found", onError: { navigate: "verifyFail" } }, go("sendCode")],
      blocks: [],
    },
    {
      id: "find", title: "Register for digital banking",
      blocks: [
        text("Register for digital banking", "title"),
        text("Tell us who you are.", "body"),
        ...IDENTITY.map(([c, t]) => alert("error", t, err(c))),
        { type: "select", bind: "rg.by", label: "Identify with", variant: "chips", choices: [{ id: "id", label: "Customer ID" }, { id: "card", label: "Card number" }], visibleWhen: "opt.allowCard != false" },
        { type: "textInput", bind: "rg.customerId", label: "Customer ID", placeholder: "8 digits", keyboard: "number", pattern: "^[0-9]{8}$", patternMessage: "Enter your 8-digit customer ID.", visibleWhen: "!(rg.by == 'card' && opt.allowCard != false)" },
        { type: "textInput", bind: "rg.card", label: "Card number", placeholder: "16 digits", keyboard: "number", secure: true, pattern: "^[0-9 ]{13,23}$", patternMessage: "Check the card number.", visibleWhen: "rg.by == 'card' && opt.allowCard != false" },
        { type: "select", bind: "rg.day", label: "Date of birth", variant: "dropdown", options: DAYS },
        { type: "select", bind: "rg.month", label: "Month", variant: "dropdown", choices: MONTHS.map((m, i) => ({ id: String(i + 1), label: m })) },
        { type: "textInput", bind: "rg.year", label: "Year", placeholder: "1990", keyboard: "number", pattern: "^(19|20)[0-9]{2}$", patternMessage: "Enter a 4-digit year." },
        button("Continue", [
          { type: "validate" }, set("rg.err", ""),
          {
            type: "callApi", integration: "verify", saveAs: "found", onError: { navigate: "verifyFail" },
            input: { customerId: "{{rg.by == 'id' || opt.allowCard == false ? rg.customerId : ''}}", cardNumber: "{{rg.by == 'card' && opt.allowCard != false ? rg.card : ''}}", day: "{{rg.day}}", month: "{{rg.month}}", year: "{{rg.year}}", ...OPTIONS },
          },
          // the bank has the number: the journey does not keep it
          set("rg.customerId", ""), set("rg.card", ""),
          go("sendCode"),
        ]),
        button("Close", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "verifyFail", title: "Register for digital banking", kind: "branch",
      onEnter: [set("rg.err", "{{ctx.error.code}}"), go("find")],
      navigation: route(["ctx.error.code == 'ID_LOCKED'", "locked"], ...answerRules),
      blocks: [],
    },
    {
      id: "sendCode", title: "Enter your code", kind: "branch",
      onEnter: [{ type: "callApi", integration: "otpSend", input: { channel: "sms" }, onError: { navigate: "codeFail" } }, set("rg.code", ""), set("rg.err", ""), go("code")],
      blocks: [],
    },
    {
      id: "code", title: "Enter your code",
      blocks: [
        text("Enter your code", "title"),
        alert("info", "We sent a 6-digit code to {{found.maskedMobile}}.", "found.maskedMobile"),
        alert("error", CODE_WORDS.wrong, err("OTP_INVALID")),
        alert("error", CODE_WORDS.expired, err("OTP_EXPIRED")),
        alert("error", CODE_WORDS.limit, err("OTP_RESEND_LIMIT")),
        { type: "otp", bind: "rg.code", length: 6 },
        button("Resend code", [
          { type: "callApi", integration: "otpSend", input: { channel: "sms" }, onError: { navigate: "codeFail" } },
          set("rg.code", ""), set("rg.err", ""), { type: "showToast", text: CODE_WORDS.resent },
        ], "secondary"),
        button("Continue", [
          { type: "validate" },
          { type: "callApi", integration: "otpVerify", input: { code: "{{rg.code}}" }, onError: { navigate: "codeFail" } },
          set("rg.code", ""), set("rg.err", ""), go("creds"),
        ]),
      ],
    },
    {
      // a wrong or an old code goes back to the code field (emptied); the third wrong try of anything locks it
      id: "codeFail", title: "Enter your code", kind: "branch",
      onEnter: [set("rg.code", ""), set("rg.err", "{{ctx.error.code}}"), go("code")],
      navigation: route(["ctx.error.code == 'ID_LOCKED'", "locked"], ...answerRules),
      blocks: [],
    },
    {
      id: "creds", title: "Choose your sign-in details",
      blocks: [
        text("Choose your sign-in details", "title"),
        ...CREDS.map(([c, t]) => alert("error", t, err(c))),
        { type: "textInput", bind: "rg.username", label: "Username", placeholder: "6 to 30 characters" },
        { type: "textInput", bind: "rg.password", label: "Password", placeholder: "At least 12 characters", secure: true, pattern: "^.{12,}$", patternMessage: "Use at least 12 characters. Three or four unrelated words work well." },
        { type: "textInput", bind: "rg.confirm", label: "Confirm password", secure: true },
        lengthLine("rg.password"),
        text("○ Not your username · not a common password · not in a known data breach (checked when you continue)", "caption"),
        { type: "consent", bind: "rg.terms", termsVersion: "2026-10", text: "I agree to the online banking terms.", validation: { mustBeTrue: true, messages: { mustBeTrue: "Please agree to continue." } } },
        button("Continue", [
          { type: "validate" }, set("rg.err", ""),
          {
            type: "callApi", integration: "check", saveAs: "chk", onError: { navigate: "completeFail" },
            input: { registrationToken: "{{found.registrationToken}}", username: "{{rg.username}}", password: "{{rg.password}}", confirm: "{{rg.confirm}}", terms: "{{rg.terms}}", trustDevice: false, dryRun: true },
          },
          set("rg.err", "{{chk.ok ? '' : chk.code}}"),
          { type: "navigate" },
        ]),
      ],
      navigation: route(["chk.ok && opt.trustDevice != false", "device"], ["chk.ok", "finish"]),
    },
    {
      // what the check of the details and the final call can refuse: the token ran out, the code was not right, locked, or the bank did not answer
      id: "completeFail", title: "Choose your sign-in details", kind: "branch",
      onEnter: [...wipe, set("rg.err", "{{ctx.error.code}}"), go("find")],
      navigation: route(["ctx.error.code == 'TOKEN_EXPIRED' || ctx.error.code == 'TOKEN_INVALID'", "expired"], ...answerRules),
      blocks: [],
    },
    {
      id: "device", title: "Trust this device?",
      blocks: [
        text("Trust this device?", "title"),
        text("You won’t need a code for 90 days.", "body"),
        { type: "toggle", bind: "rg.trust", label: "Trust this device", helper: "Turn off on a public or shared device." },
        { type: "textInput", bind: "rg.device", label: "Device name", placeholder: "My phone", pattern: "^.{1,30}$", patternMessage: "Give this device a name of 1 to 30 characters.", visibleWhen: "rg.trust" },
        button("Finish", [{ type: "validate" }, go("finish")]),
        button("Back", [go("creds")], "ghost"),
      ],
    },
    {
      // the profile is made here; the password leaves the journey the moment the bank has it
      id: "finish", title: "Register for digital banking", kind: "branch",
      onEnter: [{ type: "callApi", integration: "complete", input: FINISH_INPUT, saveAs: "done", onError: { navigate: "completeFail" } }, set("rg.err", "{{done.ok ? '' : done.code}}"), { type: "navigate", to: "creds" }],
      navigation: route(["done.ok", "registered"]),
      blocks: [],
    },
    {
      id: "registered", title: "You’re registered", kind: "terminal", onEnter: [...wipe, set("found.registrationToken", "")],
      blocks: [
        { type: "result", tone: "success", title: "You’re registered", text: "Sign in with your username and password." },
        { type: "statusChip", status: "done", label: "Done", tone: "positive" },
        { type: "reviewSummary", rows: [{ label: "Username", value: "{{done.username}}" }, { label: "This device", value: "{{done.deviceTrusted ? 'Trusted' : 'Not trusted'}}" }] },
        button("Sign in", [{ type: "navigate", toJourney: "sign-in", with: { "launch.user": "{{done.username}}" } }]),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "locked", title: "Too many tries", kind: "terminal", onEnter: wipe,
      blocks: [
        { type: "result", tone: "error", title: "Too many tries", text: "For your security, try again in 30 minutes, or contact us." },
        button("Contact us", [{ type: "navigate", toJourney: "contact-support" }], "secondary"),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "expired", title: "Start again", kind: "terminal", onEnter: wipe,
      blocks: [
        { type: "result", tone: "error", title: "That took too long", text: "For your security this has timed out. Nothing was changed. Start again." },
        button("Start again", [go("start")]),
      ],
    },
    ...downScreens({
      retry: [["!isEmpty(rg.username)", "creds"], ["true", "find"]], wipe,
      unavailable: { title: "We couldn’t reach the bank", text: "We couldn’t reach the bank. Nothing was changed." },
      timeout: { text: "This is taking longer than expected. Nothing was changed." },
    }),
  ] as Screen[],
};
