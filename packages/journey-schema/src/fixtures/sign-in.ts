import type { Block, Journey, Screen } from "../schema";
import { signInAcceptance, signInScenarios } from "./sign-in-tests";

const text = (t: string, variant?: "title" | "body" | "caption", visibleWhen?: string): Block => ({ type: "text", text: t, ...(variant ? { variant } : {}), ...(visibleWhen ? { visibleWhen } : {}) });
const alert = (tone: "info" | "warning" | "error" | "success", t: string, visibleWhen?: string): Block => ({ type: "alert", tone, text: t, ...(visibleWhen ? { visibleWhen } : {}) });
const button = (label: string, actions: any[], variant: "primary" | "secondary" | "ghost" = "primary", visibleWhen?: string): Block => ({ type: "button", label, variant, actions, ...(visibleWhen ? { visibleWhen } : {}) });
const go = (to: string) => ({ type: "navigate" as const, to });
const set = (path: string, value: unknown) => ({ type: "setData" as const, path, value });
const route = (...rules: [string, string][]) => ({ rules: rules.map(([when, to]) => ({ when, to })) });
/** The secrets and the one-time values a journey holds only while they are being sent. Cleared wherever a failure sends the person to the "problem" screen. */
const wipe = [set("login.password", ""), set("login.newPassword", ""), set("login.confirm", ""), set("login.pin", ""), set("login.pinConfirm", ""), set("login.quickPin", ""), set("login.code", "")];

/**
 * Sign in (BankWorkx, Signing in and security). A username and a password, a one-time code on a new or unusual device, a new password when
 * the old one expired or was temporary, "Trust this device?" and "Sign in faster next time", then the session opens at the bank
 * (bank.auth.completeSignIn). The journey never keeps the password: it is cleared as soon as it has been sent. It tells the app nothing
 * but that it ended; the app asks the bank who is signed in.
 *
 * Built from the spec of the prototype with the blocks FinX has (see docs/BANKWORKX.md): the live checklist beyond the length, the show/hide
 * link on the password, the Caps Lock line, the resend countdown, the "Register" link and the place and time on the device card are not there.
 */
export const signIn: Journey = {
  id: "jrn_bankworkx_sign_in",
  // the Cairo Amman Bank journey is called sign-in too, and the catalog has one id per slug: this one keeps the name with the bank appended, and every other journey asks for "sign-in"
  slug: "sign-in-bankworkx",
  name: "Sign in",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: signInAcceptance,
  scenarios: signInScenarios,
  dataModel: {
    // what another journey or the session timeout hands in
    "launch.reason": { type: "string" },
    "launch.user": { type: "string" },
    // the options of the bank: left alone they are on
    "opt.allowSms": { type: "boolean" }, "opt.allowBio": { type: "boolean" }, "opt.allowPasskey": { type: "boolean" }, "opt.allowQuickPin": { type: "boolean" }, "opt.rememberUser": { type: "boolean" }, "opt.allowUnlock": { type: "boolean" },
    "login.username": { type: "string", required: true, pattern: "^[A-Za-z0-9._@-]{3,40}$" },
    "login.password": { type: "string", required: true },
    "login.remember": { type: "boolean" },
    "login.how": { type: "string" },
    "login.channel": { type: "string" },
    "login.code": { type: "string", required: true, pattern: "^[0-9]{6}$" },
    "login.codeError": { type: "string" },
    "login.wrong": { type: "number" },
    "login.newPassword": { type: "string", required: true },
    "login.confirm": { type: "string", required: true },
    "login.pwDone": { type: "boolean" },
    "login.trust": { type: "string", required: true },
    "login.deviceName": { type: "string", required: true, pattern: "^.{1,30}$" },
    "login.trustDone": { type: "boolean" },
    "login.quickDone": { type: "boolean" },
    "login.pin": { type: "string", required: true, pattern: "^[0-9]{6}$" },
    "login.pinConfirm": { type: "string", required: true },
    "login.quickPin": { type: "string", required: true },
    "ui.quick": { type: "boolean" }, "ui.other": { type: "boolean" }, "ui.callUs": { type: "boolean" }, "ui.pinMismatch": { type: "boolean" },
  },
  integrations: [
    { id: "deviceOptions", adapter: "bank.device.options", mode: "sandbox" },
    { id: "checkCredentials", adapter: "bank.auth.signIn", mode: "sandbox" },
    { id: "quickSignIn", adapter: "bank.auth.quickSignIn", mode: "sandbox" },
    { id: "otpSend", adapter: "bank.otp.send", mode: "sandbox" },
    { id: "otpVerify", adapter: "bank.otp.verify", mode: "sandbox" },
    { id: "changePassword", adapter: "bank.auth.changePassword", mode: "sandbox" },
    { id: "trustDevice", adapter: "bank.auth.trustDevice", mode: "sandbox" },
    { id: "setQuickSignIn", adapter: "bank.auth.setQuickSignIn", mode: "sandbox" },
    { id: "completeSignIn", adapter: "bank.auth.completeSignIn", mode: "sandbox" },
  ],
  screens: [
    {
      // reads what this device remembers, and sets every answer to where a new sign-in starts
      id: "start", title: "Sign in", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "deviceOptions", saveAs: "device", onError: { navigate: "problem" } },
        set("login.username", "{{launch.user ? launch.user : device.username}}"),
        set("login.remember", true), set("login.how", "password"), set("login.channel", "device"), set("login.wrong", 0), set("login.codeError", ""),
        set("login.pwDone", false), set("login.trustDone", false), set("login.quickDone", false), set("login.trust", null), set("login.deviceName", ""),
        set("ui.quick", false), set("ui.other", false), set("ui.callUs", false), set("ui.pinMismatch", false),
        ...wipe,
        go("credentials"),
      ],
      blocks: [],
    },
    {
      id: "credentials", title: "Sign in",
      blocks: [
        { type: "hero" },
        text("{{device.firstName && !ui.other ? 'Welcome back, ' + device.firstName : 'Welcome'}}", "title"),
        text("Use your BankWorkx® username and password.", "body"),
        alert("info", "You were signed out for your security. Sign in again to continue. Nothing you were doing was saved.", "launch.reason == 'expired'"),
        // a device that remembers a quick way in: one button opens it (the PIN over the screen, or the phone's own check)
        { type: "menu", visibleWhen: "device.firstName && !ui.other && !ui.quick && device.quick == 'pin'", items: [{ id: "usePin", label: "Use PIN", text: "Sign in with your quick PIN on this device.", icon: "lock", actions: [set("ui.quick", true)] }] },
        { type: "menu", visibleWhen: "device.firstName && !ui.other && !ui.quick && device.quick == 'biometric'", items: [{ id: "useFace", label: "Use Face ID", text: "Sign in with Face ID or your fingerprint on this device.", icon: "shield", actions: [set("login.how", "biometric"), { type: "callApi", integration: "quickSignIn", input: { method: "biometric" }, saveAs: "auth", onError: { navigate: "problem" } }, { type: "navigate" }] }] },
        { type: "menu", visibleWhen: "device.firstName && !ui.other && !ui.quick && device.quick == 'passkey'", items: [{ id: "usePasskey", label: "Use passkey", text: "Sign in with the passkey on this device.", icon: "shield", actions: [set("login.how", "passkey"), { type: "callApi", integration: "quickSignIn", input: { method: "passkey" }, saveAs: "auth", onError: { navigate: "problem" } }, { type: "navigate" }] }] },
        button("Not {{device.firstName}}? Sign in with another account", [set("ui.other", true), set("login.username", "")], "ghost", "device.firstName && !ui.other"),
        alert("error", "The username or password isn’t right. Check them and try again.", "auth.code == 'INVALID_CREDENTIALS'"),
        alert("error", "That PIN isn’t right.", "auth.code == 'QUICK_PIN_INVALID'"),
        alert("warning", "{{auth.attemptsLeft}} {{auth.attemptsLeft == 1 ? 'attempt' : 'attempts'}} left. After that, we lock sign-in to protect your account.", "(auth.code == 'INVALID_CREDENTIALS' || auth.code == 'QUICK_PIN_INVALID') && auth.attemptsLeft <= 2"),
        alert("info", "Your password has expired. Sign in with your password to choose a new one.", "auth.code == 'PASSWORD_EXPIRED'"),
        alert("info", "Quick sign-in is off on this device. Use your password.", "auth.code == 'QUICK_OFF'"),
        { type: "textInput", bind: "login.username", label: "Username", placeholder: "For example alex.morgan", pattern: "^[A-Za-z0-9._@-]{3,40}$", patternMessage: "Usernames have 3 to 40 letters, numbers, dots, dashes or underscores.", visibleWhen: "!ui.quick" },
        { type: "textInput", bind: "login.password", label: "Password", placeholder: "Your password", secure: true, visibleWhen: "!ui.quick" },
        { type: "toggle", bind: "login.remember", label: "Remember my username on this device", visibleWhen: "!ui.quick && opt.rememberUser != false" },
        button("Continue", [
          { type: "validate" },
          set("login.how", "password"),
          { type: "callApi", integration: "checkCredentials", input: { username: "{{login.username}}", password: "{{login.password}}" }, saveAs: "auth", onError: { navigate: "problem" } },
          // the password is not kept once the bank has it
          set("login.password", ""),
          { type: "navigate" },
        ], "primary", "!ui.quick"),
        button("Forgot password?", [{ type: "navigate", toJourney: "forgot-password", with: { "launch.user": "{{login.username}}" } }], "ghost", "!ui.quick"),
        button("Forgot username?", [{ type: "navigate", toJourney: "forgot-username" }], "ghost", "!ui.quick"),
        // quick mode: only the PIN, no password
        { type: "textInput", bind: "login.quickPin", label: "Quick PIN", placeholder: "6 digits", keyboard: "number", secure: true, pattern: "^[0-9]{6}$", patternMessage: "Enter your 6-digit PIN.", visibleWhen: "ui.quick" },
        button("Continue", [
          { type: "validate" },
          set("login.how", "pin"),
          { type: "callApi", integration: "quickSignIn", input: { method: "pin", pin: "{{login.quickPin}}" }, saveAs: "auth", onError: { navigate: "problem" } },
          set("login.quickPin", ""),
          // the PIN field stays open after a wrong PIN, and closes when quick sign-in was turned off
          set("ui.quick", "{{auth.code == 'QUICK_PIN_INVALID'}}"),
          set("device.quick", "{{auth.code == 'QUICK_OFF' ? 'off' : device.quick}}"),
          { type: "navigate" },
        ], "primary", "ui.quick"),
        button("Use password instead", [set("ui.quick", false), set("login.quickPin", ""), set("login.how", "password")], "ghost", "ui.quick"),
      ],
      // the word of the bank decides the way on; a wrong password stays here with its message
      navigation: route(["auth.code == 'LOCKED'", "locked"], ["auth.code == 'INACTIVE'", "inactive"], ["auth.ok && auth.status == 'otp'", "sendCode"], ["auth.ok", "next"]),
    },
    {
      // after the password (or the quick PIN): a code when the bank asks for one, else on to the next step
      id: "sendCode", title: "Sign in", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "otpSend", input: { channel: "{{login.channel}}" }, onError: { navigate: "codeFail" } },
        set("login.code", ""), set("login.codeError", ""),
        go("code"),
      ],
      blocks: [],
    },
    {
      id: "code", title: "Enter your code",
      blocks: [
        text("Enter your code", "title"),
        text("This looks like a new device, so we need one more check.", "body"),
        alert("info", "Approve in the BankWorkx® app. We sent a prompt to your other signed-in device. Open it and type the 6-digit code shown.", "login.channel == 'device'"),
        alert("info", "Code sent by text message. We sent a 6-digit code to {{auth.maskedPhone}}.", "login.channel == 'sms'"),
        text("It works for 5 minutes and only once.", "caption"),
        alert("error", "That code isn’t right. Check the latest message and try again.", "login.codeError == 'OTP_INVALID'"),
        alert("warning", "{{5 - login.wrong}} {{login.wrong == 4 ? 'attempt' : 'attempts'}} left.{{login.wrong >= 3 ? ' After that, sign-in locks.' : ''}}", "login.codeError == 'OTP_INVALID' && login.wrong > 0"),
        alert("error", "That code has expired. Ask for a new one.", "login.codeError == 'OTP_EXPIRED'"),
        alert("error", "You have asked for the maximum number of codes. Wait 15 minutes or choose another way.", "login.codeError == 'OTP_RESEND_LIMIT'"),
        { type: "otp", bind: "login.code", length: 6, hint: "You can paste the code." },
        { type: "select", bind: "login.channel", label: "Didn’t get it? Send it another way", variant: "chips", choices: [{ id: "device", label: "Another signed-in device" }, { id: "sms", label: "Text message" }], visibleWhen: "opt.allowSms != false" },
        { type: "select", bind: "login.channel", label: "Didn’t get it? Send it another way", variant: "chips", choices: [{ id: "device", label: "Another signed-in device" }], visibleWhen: "opt.allowSms == false" },
        button("Send me a new code", [
          { type: "callApi", integration: "otpSend", input: { channel: "{{login.channel}}" }, onError: { navigate: "codeFail" } },
          set("login.code", ""), set("login.codeError", ""), set("login.wrong", 0),
          { type: "showToast", text: "New code sent. The old code no longer works." },
        ], "secondary"),
        text("BankWorkx® will never call or message you to ask for this code. Don’t share it with anyone.", "caption"),
        button("Continue", [
          { type: "validate" },
          { type: "callApi", integration: "otpVerify", input: { code: "{{login.code}}" }, onError: { navigate: "codeFail" } },
          set("login.code", ""), set("login.wrong", 0), set("login.codeError", ""),
          go("next"),
        ]),
      ],
    },
    {
      // a code that did not work: what it says and, for the fifth wrong one, the lock
      id: "codeFail", title: "Enter your code", kind: "branch",
      onEnter: [
        set("login.code", ""),
        set("login.codeError", "{{ctx.error.code}}"),
        set("login.wrong", "{{ctx.error.code == 'OTP_INVALID' ? login.wrong + 1 : login.wrong}}"),
        go("code"),
      ],
      navigation: route(["ctx.error.code == 'ACCOUNT_LOCKED'", "locked"], ["ctx.error.code == 'SERVICE_UNAVAILABLE' || ctx.error.code == 'TIMEOUT'", "problem"]),
      blocks: [],
    },
    {
      // the one place that decides the next step, in the order of the spec: a new password, trust this device, quick sign-in, then in
      id: "next", title: "Sign in", kind: "branch",
      onEnter: [go("finish")],
      navigation: route(
        ["auth.reason && !login.pwDone", "newPassword"],
        ["login.how == 'password' && auth.deviceKnown == false && !login.trustDone", "trust"],
        ["login.how == 'password' && !login.quickDone && device.quick == 'off' && (auth.deviceKnown || login.trustDone && login.trust == 'trust') && ((opt.allowBio != false && device.biometricAvailable) || opt.allowPasskey != false || opt.allowQuickPin != false)", "quick"],
      ),
      blocks: [],
    },
    {
      id: "newPassword", title: "Choose a new password",
      blocks: [
        text("Choose a new password", "title"),
        alert("info", "Welcome to BankWorkx®. You signed in with a temporary password. Choose your own to continue.", "auth.reason == 'temporary'"),
        alert("info", "Your password has expired. It is more than 12 months old. Choose a new one to continue.", "auth.reason == 'expired'"),
        text("Pasting from a password manager is fine.", "caption"),
        alert("error", "Use at least 12 characters. Three or four unrelated words work well.", "chg.code == 'MIN_LENGTH'"),
        alert("error", "Use 64 characters or fewer.", "chg.code == 'MAX_LENGTH'"),
        alert("error", "Don’t use your username in your password.", "chg.code == 'PASSWORD_CONTAINS_USERNAME'"),
        alert("error", "That password is too common. Try a longer phrase of unrelated words.", "chg.code == 'PASSWORD_COMMON'"),
        alert("error", "This password has appeared in a data breach, so we can’t accept it.", "chg.code == 'PASSWORD_BREACHED'"),
        alert("error", "Choose a password you haven’t used here before.", "chg.code == 'PASSWORD_REUSED'"),
        alert("error", "The two passwords don’t match.", "chg.code == 'MISMATCH'"),
        { type: "textInput", bind: "login.newPassword", label: "New password", placeholder: "At least 12 characters", secure: true, pattern: "^.{12,}$", patternMessage: "Use at least 12 characters. Three or four unrelated words work well." },
        text("Tip: a phrase of unrelated words is easy to remember and hard to guess. No symbols required.", "caption"),
        { type: "textInput", bind: "login.confirm", label: "Confirm new password", secure: true },
        text("{{len(login.newPassword) >= 12 ? '✓' : '○'}} At least 12 characters", "caption"),
        text("○ Not your username · not a common password · not in a known data breach · not one you used before (checked when you continue)", "caption"),
        button("Continue", [
          { type: "validate" },
          { type: "callApi", integration: "changePassword", input: { newPassword: "{{login.newPassword}}", confirm: "{{login.confirm}}" }, saveAs: "chg", onError: { navigate: "problem" } },
          set("login.newPassword", ""), set("login.confirm", ""),
          set("login.pwDone", "{{chg.ok == true}}"),
          { type: "navigate" },
        ]),
      ],
      navigation: route(["chg.ok", "next"]),
    },
    {
      id: "trust", title: "Trust this device?",
      blocks: [
        text("Trust this device?", "title"),
        text("This saves you a code next time.", "body"),
        { type: "reviewSummary", rows: [{ label: "This device", value: "{{auth.device.name}}" }] },
        alert("error", "You already trust 5 devices. Remove one in Security, or choose not to trust this one.", "trustRes.code == 'DEVICE_LIMIT'"),
        { type: "select", bind: "login.trust", label: "Do you trust this device?", variant: "tiles", choices: [{ id: "trust", label: "Trust this device", text: "No code for 90 days. Remove it any time in Security › Trusted devices." }, { id: "public", label: "Don’t trust (public or shared)", text: "We ask for a code every time you sign in here." }] },
        { type: "textInput", bind: "login.deviceName", label: "Name this device", placeholder: "For example My phone", visibleWhen: "login.trust == 'trust'" },
        text("So you can recognise it later. Up to 5 trusted devices.", "caption", "login.trust == 'trust'"),
        alert("error", "Give the device a name of 1 to 30 characters.", "trustRes.code == 'NAME_REQUIRED'"),
        button("Continue", [{ type: "validate" }, set("login.trustDone", "{{login.trust == 'public'}}"), go("next")]),
      ],
      navigation: route(["login.trust == 'trust'", "doTrust"]),
    },
    {
      id: "doTrust", title: "Trust this device?", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "trustDevice", input: { name: "{{login.deviceName}}" }, saveAs: "trustRes", onError: { navigate: "problem" } },
        set("login.trustDone", "{{trustRes.ok == true}}"),
        go("trust"),
      ],
      navigation: route(["trustRes.ok", "next"]),
      blocks: [],
    },
    {
      id: "quick", title: "Sign in faster next time",
      blocks: [
        text("Sign in faster next time", "title"),
        text("Skip the password on this device.", "body"),
        text("Face ID or fingerprint: your phone checks it’s you. BankWorkx® never receives your face or fingerprint.", "caption", "opt.allowBio != false && device.biometricAvailable"),
        button("Face ID or fingerprint", [
          { type: "callApi", integration: "setQuickSignIn", input: { method: "biometric" }, saveAs: "quickRes", onError: { navigate: "problem" } },
          set("login.quickDone", "{{quickRes.ok == true}}"),
          go("next"),
        ], "secondary", "opt.allowBio != false && device.biometricAvailable"),
        text("Passkey: a secure key stored on your device. Nothing to remember or type.", "caption", "opt.allowPasskey != false"),
        button("Passkey", [
          { type: "callApi", integration: "setQuickSignIn", input: { method: "passkey" }, saveAs: "quickRes", onError: { navigate: "problem" } },
          set("login.quickDone", "{{quickRes.ok == true}}"),
          go("next"),
        ], "secondary", "opt.allowPasskey != false"),
        text("6-digit quick PIN: works only on this device.", "caption", "opt.allowQuickPin != false"),
        button("6-digit quick PIN", [go("pin")], "secondary", "opt.allowQuickPin != false"),
        text("You can turn it on later in Security.", "caption"),
        button("Not now", [set("login.quickDone", true), go("next")], "ghost"),
      ],
    },
    {
      id: "pin", title: "Choose a PIN",
      blocks: [
        text("Choose a PIN", "title"),
        alert("error", "That PIN is too easy to guess. Avoid repeats and runs like 111111 or 123456.", "quickRes.code == 'PIN_WEAK'"),
        alert("error", "Don’t use digits from your phone number.", "quickRes.code == 'PIN_PHONE'"),
        alert("error", "The PINs don’t match.", "ui.pinMismatch"),
        { type: "textInput", bind: "login.pin", label: "Choose a PIN", placeholder: "6 digits", keyboard: "number", secure: true, pattern: "^[0-9]{6}$", patternMessage: "Use exactly 6 digits." },
        text("Not 111111, 123456 or part of your phone number.", "caption"),
        { type: "textInput", bind: "login.pinConfirm", label: "Confirm PIN", placeholder: "6 digits", keyboard: "number", secure: true },
        button("Continue", [{ type: "validate" }, set("ui.pinMismatch", "{{login.pin != login.pinConfirm}}"), { type: "navigate" }]),
        button("Back", [go("quick")], "ghost"),
      ],
      navigation: route(["!ui.pinMismatch", "doPin"]),
    },
    {
      id: "doPin", title: "Choose a PIN", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "setQuickSignIn", input: { method: "pin", pin: "{{login.pin}}" }, saveAs: "quickRes", onError: { navigate: "problem" } },
        set("login.pin", ""), set("login.pinConfirm", ""),
        set("login.quickDone", "{{quickRes.ok == true}}"),
        go("pin"),
      ],
      navigation: route(["quickRes.ok", "next"]),
      blocks: [],
    },
    {
      // every step is done: the bank opens the session. Nothing in the answer is a secret.
      id: "finish", title: "Signing you in", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "completeSignIn", input: { remember: "{{opt.rememberUser == false ? false : login.remember}}" }, saveAs: "done", onError: { navigate: "problem" } },
        go("signedIn"),
      ],
      blocks: [],
    },
    {
      id: "signedIn", title: "Signed in", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Signed in", text: "Welcome, {{done.firstName}}. Taking you to your accounts.", meta: "Secure session" },
        {
          type: "reviewSummary", rows: [
            { label: "Signed in as", value: "{{done.username}}" },
            { label: "How", value: "{{done.how == 'password+code' ? 'Password and one-time code' : done.how == 'password' ? 'Password on a known device' : done.how == 'quick-pin' ? 'Quick PIN' : 'Face ID or fingerprint'}}" },
            { label: "This device", value: "{{done.deviceTrusted ? 'Trusted for ' + done.deviceTrustedDays + ' days' : 'Not trusted'}}" },
            { label: "Quick sign-in", value: "{{done.quick == 'pin' ? 'Quick PIN' : done.quick == 'biometric' ? 'Face ID or fingerprint' : done.quick == 'passkey' ? 'Passkey' : 'Off'}}" },
            { label: "Password", value: "{{done.passwordChanged ? 'Changed just now' : 'Unchanged'}}" },
            { label: "Session", value: "Ends after 5 minutes without use" },
          ],
        },
        text("Last sign-in: {{done.lastSignIn.place}}", "caption", "done.lastSignIn"),
        button("Go to Home", [{ type: "exit" }]),
      ],
    },
    {
      id: "locked", title: "Sign-in is locked", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "Sign-in is locked", text: "Too many wrong attempts. This protects your money. Unlocking takes a few minutes." },
        text("Unlock your account", "title", "opt.allowUnlock != false"),
        text("Confirm it’s you with a code sent to your registered phone. It takes about 3 minutes.", "body", "opt.allowUnlock != false"),
        button("Unlock my account", [{ type: "navigate", toJourney: "unlock-account", with: { "launch.user": "{{login.username}}" } }], "primary", "opt.allowUnlock != false"),
        button("Reset password", [{ type: "navigate", toJourney: "forgot-password", with: { "launch.user": "{{login.username}}" } }], "primary", "opt.allowUnlock == false"),
        button("Call us instead", [set("ui.callUs", true)], "secondary"),
        alert("info", "Call us on +1 800 555 0100 (sandbox number).", "ui.callUs"),
      ],
    },
    {
      id: "inactive", title: "Profile not active", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "Your profile isn’t active yet", text: "Contact the bank to activate it, then sign in again." },
        button("Back to sign in", [go("start")], "secondary"),
      ],
    },
    {
      // the bank did not answer, or not in time: nothing was changed, and no wrong try was counted
      id: "problem", title: "Sign in",
      onEnter: [...wipe],
      blocks: [
        alert("error", "We couldn’t reach the bank. Nothing was changed.", "ctx.error.code == 'SERVICE_UNAVAILABLE'"),
        alert("error", "This is taking longer than expected. Nothing was changed.", "ctx.error.code == 'TIMEOUT'"),
        alert("error", "Something went wrong. Nothing was changed.", "ctx.error.code != 'SERVICE_UNAVAILABLE' && ctx.error.code != 'TIMEOUT'"),
        button("Try again", [go("start")]),
      ],
    },
  ] as Screen[],
};
