import type { Journey, Screen } from "../schema";
import { updateProfileAcceptance, updateProfileScenarios } from "./update-profile-tests";
import { alert, answerScreens, button, denied, go, lacks, route, set, text } from "./more-kit";

/** What this journey holds only while the change is being sent: the codes, and the new value once the bank has it. Cleared on every way out. */
const codes = [set("up.code", ""), set("up.code2", "")];
const values = [set("up.mobile", ""), set("up.email", ""), set("up.line1", ""), set("up.line2", ""), set("up.city", ""), set("up.state", ""), set("up.postal", ""), set("up.proof", null)];
const wipe = [...codes];
const DOWN = { title: "We couldn’t reach the bank", text: "This isn’t available right now. Nothing was changed. Try again in a few minutes." };
/** The flags the bank is told, so what the bank applies and what the screens drew cannot differ. */
const flags = { verifyNewMobile: "{{opt.verifyNewMobile != false}}", verifyEmail: "{{opt.verifyEmail != false}}", verifyAddress: "{{opt.verifyAddress != false}}", requireProof: "{{opt.requireProof == true}}" };
const address = { line1: "{{up.line1}}", line2: "{{up.line2}}", city: "{{up.city}}", state: "{{up.state}}", postal: "{{up.postal}}", proofName: "{{isEmpty(up.proof) ? '' : up.proof.name}}" };
const value = "{{up.what == 'mobile' ? up.mobile : up.email}}";
const check = (): any => ({ type: "callApi", integration: "update", input: { field: "{{up.what}}", value, ...address, ...flags, dryRun: true }, onError: { navigate: "fail" } });
const WRONG = (n: string) => `up.codeError${n} == 'OTP_INVALID'`;

/**
 * Update profile (BankWorkx, Personal: More). Changes the mobile number, the email or the address the bank holds. Every change needs a one-time code sent to the number on file; a
 * new mobile number also gets a code of its own (`verifyNewMobile`); an email and an address wait for the bank's check (`verifyEmail`, `verifyAddress`) and show as Pending. The bank
 * tells the old contact (and the new one) what happened. Values are shown masked; nothing the person typed is kept once the bank has it.
 *
 * Built from the spec of the prototype with the blocks FinX has: the bank applies the rules of the home market when Continue is pressed (the engine has no per-field messages from the
 * bank), so a refused value shows above the field in the bank's words, and the first screen is a list of rows with the masked value and "Pending" in the line (it cannot draw a chip
 * inside a choice).
 */
export const updateProfile: Journey = {
  id: "jrn_bankworkx_update_profile",
  slug: "update-profile",
  name: "Contact details",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: updateProfileAcceptance,
  scenarios: updateProfileScenarios,
  dataModel: {
    "launch.what": { type: "string" },
    "launch.field": { type: "string" },
    "opt.verifyNewMobile": { type: "boolean" },
    "opt.verifyEmail": { type: "boolean" },
    "opt.verifyAddress": { type: "boolean" },
    "opt.requireProof": { type: "boolean" },
    "up.what": { type: "string", required: true },
    "up.blocked": { type: "boolean" },
    "up.mobile": { type: "string", required: true },
    "up.email": { type: "string", required: true, pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$" },
    "up.line1": { type: "string", required: true },
    "up.line2": { type: "string" },
    "up.city": { type: "string", required: true },
    "up.state": { type: "string", required: true },
    "up.postal": { type: "string", required: true },
    "up.proof": { type: "string", required: true },
    "up.code": { type: "string", required: true, pattern: "^[0-9]{6}$" },
    "up.code2": { type: "string", required: true, pattern: "^[0-9]{6}$" },
    "up.codeError": { type: "string" },
    "up.codeError2": { type: "string" },
    "up.wrong": { type: "number" },
    "up.wrong2": { type: "number" },
    "up.err": { type: "string" },
    "up.msg": { type: "string" },
  },
  integrations: [
    { id: "contacts", adapter: "bank.profile.contacts", mode: "sandbox" },
    { id: "update", adapter: "bank.profile.update", mode: "sandbox" },
    { id: "otpSend", adapter: "bank.otp.send", mode: "sandbox" },
    { id: "otpVerify", adapter: "bank.otp.verify", mode: "sandbox" },
    { id: "sendNew", adapter: "bank.profile.sendContactCode", mode: "sandbox" },
    { id: "verifyNew", adapter: "bank.profile.verifyContact", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Contact details", kind: "branch",
      onEnter: [
        ...wipe, ...values, set("up.err", ""), set("up.msg", ""), set("up.blocked", false), set("up.codeError", ""), set("up.codeError2", ""), set("up.wrong", 0), set("up.wrong2", 0), set("ctx.error", null),
        { type: "callApi", integration: "contacts", saveAs: "ctx.c", onError: { navigate: "fail" } },
        // opened from a Change button of the profile (field: phone, email, address) or by a link (what: mobile, email, address): that one is chosen, and still confirmed with Continue
        set("up.what", "{{launch.what == 'mobile' || launch.field == 'phone' || launch.field == 'mobile' ? 'mobile' : launch.what == 'email' || launch.field == 'email' ? 'email' : launch.what == 'address' || launch.field == 'address' ? 'address' : ''}}"),
        go("what"),
      ],
      navigation: route([lacks("profile.update"), "denied"]),
      blocks: [],
    },
    {
      id: "what", title: "Contact details",
      blocks: [
        text("Contact details", "title"),
        text("To change your name or ID document, visit a branch.", "body"),
        alert("error", "A change to this is already waiting to be confirmed.", "up.blocked"),
        { type: "select", bind: "up.what", label: "What do you want to change?", source: "ctx.c.choices", variant: "rows" },
        button("Continue", [{ type: "validate" }, go("chosen")]),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      // a change that already waits cannot be chosen again; the bank refuses it too (ALREADY_PENDING)
      id: "chosen", title: "Contact details", kind: "branch",
      onEnter: [set("up.blocked", "{{get(ctx.c.pending, up.what) == true}}"), set("up.err", ""), go("what")],
      navigation: route(["up.blocked", "what"], ["up.what == 'mobile'", "mobile"], ["up.what == 'email'", "email"], ["up.what == 'address'", "address"]),
      blocks: [],
    },
    {
      id: "mobile", title: "New mobile number",
      blocks: [
        text("New mobile number", "title"),
        text("{{ctx.c.mobileMasked}} is your number now.", "caption"),
        alert("error", "{{up.msg}}", "up.err == 'rule'"),
        { type: "textInput", bind: "up.mobile", label: "Mobile number", placeholder: "{{ctx.c.mobileHint}}", keyboard: "phone" },
        button("Continue", [{ type: "validate" }, set("up.err", ""), check(), go("sendCode")]),
        button("Back", [set("up.err", ""), go("what")], "ghost"),
      ],
    },
    {
      id: "email", title: "New email",
      blocks: [
        text("New email", "title"),
        text("{{ctx.c.emailMasked}} is your email now.", "caption"),
        alert("error", "{{up.msg}}", "up.err == 'rule'"),
        { type: "textInput", bind: "up.email", label: "Email", placeholder: "name@example.com", keyboard: "email", pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", patternMessage: "Enter an email like name@example.com." },
        button("Continue", [{ type: "validate" }, set("up.err", ""), check(), go("sendCode")]),
        button("Back", [set("up.err", ""), go("what")], "ghost"),
      ],
    },
    {
      id: "address", title: "New address",
      blocks: [
        text("New address", "title"),
        text("{{ctx.c.addressText}}", "caption"),
        alert("error", "{{up.msg}}", "up.err == 'rule'"),
        { type: "textInput", bind: "up.line1", label: "Address line 1" },
        { type: "textInput", bind: "up.line2", label: "Address line 2 (optional)" },
        { type: "textInput", bind: "up.city", label: "City" },
        { type: "textInput", bind: "up.state", label: "State", visibleWhen: "ctx.c.state" },
        { type: "textInput", bind: "up.postal", label: "Postal code", visibleWhen: "ctx.c.postal" },
        { type: "fileUpload", bind: "up.proof", label: "Proof of address", accept: ["pdf", "image"], helper: "Add a recent bill or statement", visibleWhen: "opt.requireProof == true" },
        button("Continue", [{ type: "validate" }, set("up.err", ""), check(), go("sendCode")]),
        button("Back", [set("up.err", ""), go("what")], "ghost"),
      ],
    },
    {
      // the code goes to the number on file, never to the new one
      id: "sendCode", title: "Enter your code", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "otpSend", input: { channel: "sms", strict: true }, saveAs: "up.otp", onError: { navigate: "fail" } },
        set("up.code", ""), set("up.codeError", ""), set("up.wrong", 0),
        go("code"),
      ],
      blocks: [],
    },
    {
      id: "code", title: "Enter your code",
      blocks: [
        text("Enter your code", "title"),
        text("Sent to the phone ending {{up.otp.last4}}.", "caption"),
        alert("error", "That code isn’t right. Try again.", WRONG("")),
        alert("warning", "{{3 - up.wrong}} {{up.wrong == 2 ? 'try' : 'tries'}} left.", `${WRONG("")} && up.wrong > 0`),
        alert("error", "That code has expired. Go back to get a new one.", "up.codeError == 'OTP_EXPIRED'"),
        { type: "otp", bind: "up.code", length: 6 },
        button("Confirm", [
          { type: "validate" },
          { type: "callApi", integration: "otpVerify", input: { code: "{{up.code}}", strict: true }, onError: { navigate: "codeFail" } },
          set("up.code", ""), set("up.codeError", ""), go("afterCode"),
        ], "primary", "up.codeError != 'OTP_EXPIRED'"),
        button("Back", [set("up.codeError", ""), ...wipe, go("what")], "primary", "up.codeError == 'OTP_EXPIRED'"),
        button("Back", [set("up.codeError", ""), ...wipe, go("what")], "ghost", "up.codeError != 'OTP_EXPIRED'"),
      ],
    },
    {
      // a code that did not work: what it says, and the third wrong one ends the attempt
      id: "codeFail", title: "Enter your code", kind: "branch",
      onEnter: [
        set("up.code", ""), set("up.codeError", "{{ctx.error.code}}"), set("up.wrong", "{{ctx.error.code == 'OTP_INVALID' ? up.wrong + 1 : up.wrong}}"),
        go("code"),
      ],
      navigation: route(["ctx.error.code == 'OTP_LOCKED'", "locked"], ["ctx.error.code != 'OTP_INVALID' && ctx.error.code != 'OTP_EXPIRED'", "fail"]),
      blocks: [],
    },
    {
      // a new mobile number with verifyNewMobile on: its own code, to the new number, with its own three tries
      id: "afterCode", title: "Contact details", kind: "branch",
      onEnter: [go("save")],
      navigation: route(["up.what == 'mobile' && opt.verifyNewMobile != false", "sendCode2"]),
      blocks: [],
    },
    {
      id: "sendCode2", title: "Confirm your new number", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "sendNew", input: { channel: "sms", value: "{{up.mobile}}" }, saveAs: "up.otp2", onError: { navigate: "fail" } },
        set("up.code2", ""), set("up.codeError2", ""), set("up.wrong2", 0),
        go("code2"),
      ],
      blocks: [],
    },
    {
      id: "code2", title: "Confirm your new number",
      blocks: [
        text("Confirm your new number", "title"),
        text("Sent to the new number.", "caption"),
        alert("error", "That code isn’t right. Try again.", WRONG("2")),
        alert("warning", "{{3 - up.wrong2}} {{up.wrong2 == 2 ? 'try' : 'tries'}} left.", `${WRONG("2")} && up.wrong2 > 0`),
        alert("error", "That code has expired. Go back to get a new one.", "up.codeError2 == 'OTP_EXPIRED'"),
        { type: "otp", bind: "up.code2", length: 6 },
        button("Save", [
          { type: "validate" },
          { type: "callApi", integration: "verifyNew", input: { channel: "sms", value: "{{up.mobile}}", code: "{{up.code2}}" }, onError: { navigate: "codeFail2" } },
          set("up.code2", ""), set("up.codeError2", ""), go("save"),
        ], "primary", "up.codeError2 != 'OTP_EXPIRED'"),
        button("Back", [set("up.codeError2", ""), ...wipe, go("what")], "primary", "up.codeError2 == 'OTP_EXPIRED'"),
        button("Back", [set("up.codeError2", ""), ...wipe, go("what")], "ghost", "up.codeError2 != 'OTP_EXPIRED'"),
      ],
    },
    {
      id: "codeFail2", title: "Confirm your new number", kind: "branch",
      onEnter: [
        set("up.code2", ""), set("up.codeError2", "{{ctx.error.code}}"), set("up.wrong2", "{{ctx.error.code == 'OTP_INVALID' ? up.wrong2 + 1 : up.wrong2}}"),
        go("code2"),
      ],
      navigation: route(["ctx.error.code == 'OTP_LOCKED'", "locked"], ["ctx.error.code != 'OTP_INVALID' && ctx.error.code != 'OTP_EXPIRED'", "fail"]),
      blocks: [],
    },
    {
      id: "save", title: "Saving your change", kind: "branch",
      onEnter: [
        { type: "callApi", integration: "update", input: { field: "{{up.what}}", value, ...address, ...flags }, saveAs: "up.res", onError: { navigate: "fail" } },
        // the bank has it: the journey keeps what it says about the change (masked), not what was typed
        ...wipe, ...values,
        go("done"),
      ],
      blocks: [],
    },
    {
      id: "done", title: "{{up.res.title}}", kind: "terminal", onEnter: wipe,
      blocks: [
        { type: "result", tone: "success", title: "{{up.res.title}}", visibleWhen: "up.res.status == 'updated'" },
        { type: "result", tone: "success", title: "Change received", text: "{{up.res.text}}", visibleWhen: "up.res.status == 'pending'" },
        { type: "statusChip", status: "Pending", statuses: { Pending: { label: "Pending", tone: "warning" } }, visibleWhen: "up.res.status == 'pending'" },
        { type: "reviewSummary", rows: [{ label: "{{up.res.fieldName}}", value: "{{up.res.valueText}}" }, { label: "Status", value: "{{up.res.statusText}}" }] },
        { type: "reviewSummary", rows: [{ label: "Old number", value: "Told by message" }], visibleWhen: "up.res.field == 'mobile' && up.res.status == 'updated'" },
        button("Back to more", [{ type: "exit" }]),
        button("Done", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "locked", title: "Too many wrong codes", kind: "terminal", onEnter: [...wipe, ...values],
      blocks: [
        { type: "result", tone: "error", title: "Too many wrong codes", text: "Too many wrong codes. Nothing was changed. Go back to start again." },
        button("Back to start", [go("start")]),
        button("Close", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      // where a refusal goes: a value the bank did not accept shows on the screen of that change, a change that waits on the first screen, no answer has its own screen
      id: "fail", title: "Contact details", kind: "branch",
      onEnter: [
        ...wipe,
        set("up.err", "{{ctx.error.code == 'ALREADY_PENDING' ? 'pending' : ctx.error.code == 'INVALID_MOBILE' || ctx.error.code == 'INVALID_EMAIL' || ctx.error.code == 'INVALID_POSTAL' || ctx.error.code == 'ADDRESS_INCOMPLETE' || ctx.error.code == 'ADDRESS_TOO_LONG' || ctx.error.code == 'SAME_VALUE' || ctx.error.code == 'CONTACT_IN_USE' || ctx.error.code == 'PROOF_REQUIRED' || ctx.error.code == 'FILE_TYPE' ? 'rule' : ''}}"),
        set("up.msg", "{{ctx.error.message}}"), set("up.blocked", "{{ctx.error.code == 'ALREADY_PENDING'}}"),
        go("problem"),
      ],
      navigation: route(
        ["ctx.error.code == 'TIMEOUT'", "timeout"],
        ["ctx.error.code == 'SERVICE_UNAVAILABLE'", "unavailable"],
        ["up.err == 'pending'", "what"],
        ["up.err == 'rule' && up.what == 'mobile'", "mobile"],
        ["up.err == 'rule' && up.what == 'email'", "email"],
        ["up.err == 'rule' && up.what == 'address'", "address"],
      ),
      blocks: [],
    },
    ...answerScreens("start", "changed", DOWN, [...wipe, ...values]),
    {
      id: "problem", title: "Contact details", kind: "terminal",
      blocks: [
        { type: "result", tone: "error", title: "We couldn’t change it", text: "Something went wrong. Nothing was changed." },
        button("Try again", [go("start")]),
        button("Close", [{ type: "exit" }], "ghost"),
      ],
    },
    denied("Contact details"),
  ] as Screen[],
};
