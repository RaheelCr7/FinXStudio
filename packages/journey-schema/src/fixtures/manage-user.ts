import type { Journey, Screen } from "../schema";
import { manageUserAcceptance, manageUserScenarios } from "./manage-user-tests";
import { alert, button, denyScreen, failScreens, go, is, lockOnWrongCode, lockedScreen, route, set, text } from "./business-kit";

const STEP1 = ["INVALID_NAME", "INVALID_EMAIL", "INVALID_PHONE", "USER_EXISTS"];
const STEP2 = ["INVALID_ROLE", "NO_ACCOUNT", "ACCOUNT_NOT_FOUND", "INVALID_AMOUNT", "LIMIT_ABOVE_COMPANY", "LIMIT_ABOVE_PERSON", "NO_CHANGE", "USER_HAS_PENDING_PAYMENTS"];
const BLOCKED = ["CANNOT_DISABLE_SELF", "SELF_CHANGE", "LAST_ADMIN", "LAST_APPROVER", "USER_NOT_FOUND", "CHANGE_PENDING", "ALREADY_DISABLED", "NOT_DISABLED"];
const MODE = { invite: "mu.mode == 'invite'", edit: "mu.mode == 'edit'", disable: "mu.mode == 'disable'", enable: "mu.mode == 'enable'" };
const PERSON = "mu.mode == 'invite' || mu.mode == 'edit'";
const MAKER = "mu.role == 'maker' || mu.role == 'both'";
/** What the person typed, as the bank takes it (the engine resolves only the top level of a call's input, so the account switches are flat). */
const FORM = {
  personId: "{{mu.id}}", name: "{{mu.name}}", email: "{{mu.email}}", phone: "{{mu.phone}}", role: "{{mu.role}}", on1: "{{mu.on1}}", on2: "{{mu.on2}}", on3: "{{mu.on3}}", on4: "{{mu.on4}}", limit: "{{mu.limit}}",
  reason: "{{mu.reason}}", note: "{{mu.note}}", askReason: "{{opt.askReason != false}}", secondApproval: "{{opt.secondAdmin != false}}",
};
const STEPPER = { type: "stepper" as const, steps: ["who", "access", "review"] };
const progress = (n: number, of: number) => text(`Step ${n} of ${of} · Manage a user`, "caption");
const switchOn = (n: number) => ({ type: "toggle" as const, bind: `mu.on${n}`, label: `{{ctx.p.label${n}}}`, visibleWhen: `ctx.p.count >= ${n}` });
const reviewRow = (label: string, value: string, visibleWhen: string) => ({ type: "reviewSummary" as const, visibleWhen, rows: [{ label, value }] });

/**
 * Invite, edit or disable a user (BankWorkx Business, Admin). An administrator invites a person, changes a person's name, mobile number, role, accounts or daily limit, disables a person or enables
 * a disabled one. It changes who can move money, so the bank (not this screen) decides everything: the rules of the fields and the limits, that an administrator cannot change or disable themselves,
 * that the last active administrator and the last approver of a group stay, that a Maker with payments waiting keeps the role, and that anything that involves an administrator waits for ANOTHER
 * administrator (the option `secondAdmin`, on unless a bank turns it off). A one-time code is always asked before a change; three wrong codes change nothing. Every outcome is in the activity log.
 *
 * Built from the spec with the blocks FinX has (docs/BANKWORKX.md): the bank's checks come with Continue and Review and show as a banner on the step they belong to (no live notes while typing: "Change
 * something to continue." is the bank's answer to Review), the Autofill of sample values is not built, and the mobile number and the email are shown masked on the review and the result.
 */
export const manageUser: Journey = {
  id: "jrn_manage_user",
  slug: "manage-user",
  name: "Invite, edit or disable a user",
  version: 1,
  status: "published",
  channels: ["web", "mobile"],
  apps: ["bankworkx"],
  locale: { default: "en", supported: ["en"] },
  entryScreen: "start",
  acceptance: manageUserAcceptance,
  scenarios: manageUserScenarios,
  dataModel: {
    "launch.mode": { type: "string" }, "launch.userId": { type: "string" }, "opt.secondAdmin": { type: "boolean" }, "opt.askReason": { type: "boolean" },
    "mu.mode": { type: "string" }, "mu.id": { type: "string" }, "mu.name": { type: "string" }, "mu.email": { type: "string" }, "mu.phone": { type: "string" }, "mu.role": { type: "string" },
    "mu.on1": { type: "boolean" }, "mu.on2": { type: "boolean" }, "mu.on3": { type: "boolean" }, "mu.on4": { type: "boolean" }, "mu.limit": { type: "number" },
    "mu.reason": { type: "string" }, "mu.note": { type: "string", pattern: "^.{0,200}$" }, "mu.res": { type: "object" },
    "otp.code": { type: "string", pattern: "^[0-9]{6}$" },
  },
  integrations: [
    { id: "person", adapter: "corp.users.get", mode: "sandbox" },
    { id: "inviteCheck", adapter: "corp.users.invite", mode: "sandbox" }, { id: "editCheck", adapter: "corp.users.update", mode: "sandbox" },
    { id: "disableCheck", adapter: "corp.users.disable", mode: "sandbox" }, { id: "enableCheck", adapter: "corp.users.enable", mode: "sandbox" },
    { id: "otpSend", adapter: "bank.otp.send", mode: "sandbox" },
    { id: "otpVerify", adapter: "bank.otp.verify", mode: "sandbox" },
    { id: "invite", adapter: "corp.users.invite", mode: "sandbox" }, { id: "edit", adapter: "corp.users.update", mode: "sandbox" },
    { id: "disable", adapter: "corp.users.disable", mode: "sandbox" }, { id: "enable", adapter: "corp.users.enable", mode: "sandbox" },
  ],
  screens: [
    {
      id: "start", title: "Manage a user", kind: "branch",
      onEnter: [
        set("ctx.error", null), set("ctx.p", null), set("ctx.rv", null), set("mu.res", null), set("otp.code", ""),
        set("mu.mode", "{{launch.mode == 'edit' || launch.mode == 'disable' || launch.mode == 'enable' ? launch.mode : 'invite'}}"), set("mu.id", "{{launch.userId}}"),
        set("mu.reason", ""), set("mu.note", ""),
        { type: "callApi", integration: "person", input: { personId: "{{mu.id}}" }, saveAs: "ctx.p", onError: { navigate: "route" } },
        set("mu.name", "{{ctx.p.name}}"), set("mu.email", ""), set("mu.phone", "{{ctx.p.phone}}"), set("mu.role", "{{ctx.p.role}}"), set("mu.limit", "{{ctx.p.limit > 0 ? ctx.p.limit : ''}}"),
        set("mu.on1", "{{ctx.p.on1}}"), set("mu.on2", "{{ctx.p.on2}}"), set("mu.on3", "{{ctx.p.on3}}"), set("mu.on4", "{{ctx.p.on4}}"),
        go("who"),
      ],
      navigation: route([MODE.disable + " && opt.askReason != false", "why"], [MODE.disable, "prep"], [MODE.enable, "prepEnable"]),
      blocks: [],
    },
    {
      id: "who", title: "Who is it?",
      blocks: [
        STEPPER, progress(1, 3), text("Who is it?", "title"),
        alert("error", "{{ctx.error.message}}", is(...STEP1)),
        { type: "textInput", bind: "mu.name", label: "Full name", placeholder: "First and last name" },
        { type: "textInput", bind: "mu.email", label: "Work email", placeholder: "name@company.com", keyboard: "email", visibleWhen: MODE.invite },
        text("We send the invitation here.", "caption", MODE.invite),
        { type: "reviewSummary", visibleWhen: MODE.edit, rows: [{ label: "Work email", value: "{{ctx.p.emailMasked}}" }] },
        { type: "textInput", bind: "mu.phone", label: "Mobile number", placeholder: "+1 415 555 0100", keyboard: "phone" },
        text("With the country code. Used for codes.", "caption"),
        button("Continue", [
          set("ctx.error", null),
          { type: "callApi", integration: "inviteCheck", input: { ...FORM, step: 1, dryRun: true }, onError: { navigate: "route" } },
          go("access"),
        ], "primary", MODE.invite),
        button("Continue", [
          set("ctx.error", null),
          { type: "callApi", integration: "editCheck", input: { ...FORM, step: 1, dryRun: true }, onError: { navigate: "route" } },
          go("access"),
        ], "primary", MODE.edit),
        button("Cancel", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "access", title: "Role and access",
      blocks: [
        STEPPER, progress(2, 3), text("Role and access", "title"),
        alert("error", "{{ctx.error.message}}", is(...STEP2)),
        {
          type: "select", bind: "mu.role", label: "Role", variant: "tiles",
          choices: [
            { id: "maker", label: "Maker", text: "Starts payments" }, { id: "approver", label: "Approver", text: "Approves payments others start" },
            { id: "both", label: "Maker and approver", text: "Starts and approves, never their own" }, { id: "viewer", label: "Viewer", text: "Sees accounts and payments" },
            { id: "admin", label: "Administrator", text: "Manages people and limits" },
          ],
        },
        text("They can start and approve payments, but never approve their own.", "caption", "mu.role == 'both'"),
        text("A second administrator has to approve this.", "caption", "mu.role == 'admin' && opt.secondAdmin != false"),
        text("Accounts", "caption"),
        switchOn(1), switchOn(2), switchOn(3), switchOn(4),
        { type: "amountInput", bind: "mu.limit", currency: "USD", label: "Daily limit", helper: "Up to {{ctx.p.ceilingText}} for one person.", visibleWhen: MAKER },
        button("Review", [
          { type: "validate" }, set("ctx.error", null),
          { type: "callApi", integration: "inviteCheck", input: { ...FORM, dryRun: true }, saveAs: "ctx.rv", onError: { navigate: "route" } },
          go("review"),
        ], "primary", MODE.invite),
        button("Review", [
          { type: "validate" }, set("ctx.error", null),
          { type: "callApi", integration: "editCheck", input: { ...FORM, dryRun: true }, saveAs: "ctx.rv", onError: { navigate: "route" } },
          go("review"),
        ], "primary", MODE.edit),
        button("Back", [set("ctx.error", null), go("who")], "ghost"),
      ],
    },
    {
      id: "why", title: "Why disable?",
      blocks: [
        { type: "stepper", steps: ["why", "review"] }, progress(1, 2), text("Why disable?", "title"),
        alert("error", "{{ctx.error.message}}", is("REASON_REQUIRED")),
        alert("warning", "{{ctx.p.paymentsWaiting}} payment(s) waiting. They stay as they are after {{ctx.p.name}} is disabled.", "ctx.p.paymentsWaiting > 0"),
        { type: "select", bind: "mu.reason", label: "Reason", choices: [{ id: "Left the company", label: "Left the company" }, { id: "Changed role", label: "Changed role" }, { id: "Security concern", label: "Security concern" }, { id: "Other", label: "Other" }] },
        { type: "textInput", bind: "mu.note", label: "Note", placeholder: "A few words", lines: 3, visibleWhen: "mu.reason == 'Other'", pattern: "^.{0,200}$", patternMessage: "Use up to 200 characters." },
        button("Review", [set("ctx.error", null), go("prep")]),
        button("Cancel", [{ type: "exit" }], "ghost"),
      ],
    },
    {
      id: "prep", title: "Manage a user", kind: "branch",
      onEnter: [
        set("ctx.error", null), set("ctx.rv", null),
        { type: "callApi", integration: "disableCheck", input: { ...FORM, dryRun: true }, saveAs: "ctx.rv", onError: { navigate: "route" } },
        go("review"),
      ],
      blocks: [],
    },
    {
      // enabling has no step before the review
      id: "prepEnable", title: "Manage a user", kind: "branch",
      onEnter: [
        set("ctx.error", null), set("ctx.rv", null),
        { type: "callApi", integration: "enableCheck", input: { ...FORM, dryRun: true }, saveAs: "ctx.rv", onError: { navigate: "route" } },
        go("review"),
      ],
      blocks: [],
    },
    {
      id: "review", title: "Review",
      blocks: [
        { type: "stepper", steps: ["who", "access", "review"] },
        text("Step 3 of 3 · Manage a user", "caption", PERSON),
        text("Step 2 of 2 · Manage a user", "caption", `${MODE.disable} && opt.askReason != false`),
        text("Step 1 of 1 · Manage a user", "caption", `(${MODE.disable} && opt.askReason == false) || ${MODE.enable}`),
        text("Review", "title"),
        reviewRow("Name", "{{ctx.rv.name}}", MODE.invite), reviewRow("Work email", "{{ctx.rv.emailMasked}}", MODE.invite), reviewRow("Mobile", "{{ctx.rv.phoneMasked}}", MODE.invite),
        reviewRow("Role", "{{ctx.rv.roleText}}", `${MODE.invite} || ${MODE.disable} || ${MODE.enable}`), reviewRow("Accounts", "{{ctx.rv.accountsText}}", MODE.invite),
        reviewRow("Daily limit", "{{ctx.rv.limitText}}", `${MODE.invite} && ctx.rv.isMaker`), reviewRow("Company", "{{ctx.rv.company}}", MODE.invite),
        reviewRow("Person", "{{ctx.rv.name}}", `${MODE.edit} || ${MODE.disable} || ${MODE.enable}`),
        reviewRow("Name", "{{ctx.rv.nameChange}}", `${MODE.edit} && !isEmpty(ctx.rv.nameChange)`), reviewRow("Mobile", "{{ctx.rv.mobileChange}}", `${MODE.edit} && !isEmpty(ctx.rv.mobileChange)`),
        reviewRow("Role", "{{ctx.rv.roleChange}}", `${MODE.edit} && !isEmpty(ctx.rv.roleChange)`), reviewRow("Accounts", "{{ctx.rv.accountsChange}}", `${MODE.edit} && !isEmpty(ctx.rv.accountsChange)`),
        reviewRow("Daily limit", "{{ctx.rv.limitChange}}", `${MODE.edit} && !isEmpty(ctx.rv.limitChange)`),
        reviewRow("Status", "{{ctx.rv.statusFrom}} → {{ctx.rv.statusTo}}", `${MODE.disable} || ${MODE.enable}`), reviewRow("Reason", "{{ctx.rv.reasonText}}", `${MODE.disable} && !isEmpty(ctx.rv.reasonText)`),
        reviewRow("Approval", "Second administrator needed", "ctx.rv.approvalNeeded"),
        button("Confirm", [
          set("ctx.error", null), set("otp.code", ""),
          { type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: { navigate: "route" } },
          go("otp"),
        ]),
        button("Back", [set("ctx.error", null), go("goBack")], "ghost"),
      ],
    },
    {
      id: "otp", title: "Enter your code",
      blocks: [
        text("Invite {{mu.name}}", "title", MODE.invite), text("Save changes for {{mu.name}}", "title", MODE.edit),
        text("Disable {{ctx.rv.name}}", "title", MODE.disable), text("Enable {{ctx.rv.name}}", "title", MODE.enable),
        text("It only works for this change.", "caption"),
        { type: "otp", bind: "otp.code", length: 6, maxAttempts: 3, resendAfterSeconds: 30, keypad: true, hint: "Code sent to {{ctx.otp.maskedPhone}}.", onResend: [{ type: "callApi", integration: "otpSend", input: { channel: "sms" }, saveAs: "ctx.otp", onError: { navigate: "route" } }] },
        ...(["invite", "edit", "disable", "enable"] as const).map((m) => button(m === "edit" ? "Save changes" : m[0]!.toUpperCase() + m.slice(1), [
          { type: "validate" },
          { type: "callApi", integration: "otpVerify", input: { code: "{{otp.code}}" }, onError: lockOnWrongCode },
          { type: "callApi", integration: m, input: { ...FORM }, saveAs: "mu.res", onError: { navigate: "route" } },
          set("otp.code", ""), go("result"),
        ], "primary", MODE[m])),
      ],
    },
    {
      id: "result", title: "Done", kind: "terminal",
      blocks: [
        { type: "result", tone: "success", title: "Sent for approval", text: "Another administrator has to approve this before it takes effect.", visibleWhen: "mu.res.status == 'waiting'" },
        { type: "statusChip", status: "waiting", label: "Waiting for approval", tone: "warning", visibleWhen: "mu.res.status == 'waiting'" },
        { type: "result", tone: "success", title: "Invitation sent", text: "We emailed {{mu.res.emailMasked}}. They can sign in after they accept.", visibleWhen: "mu.res.status == 'invited'" },
        { type: "statusChip", status: "invited", label: "Invited", tone: "info", visibleWhen: "mu.res.status == 'invited'" },
        { type: "result", tone: "success", title: "Changes saved", text: "{{mu.res.name}} has the new access.", visibleWhen: "mu.res.status == 'saved'" },
        { type: "statusChip", status: "saved", label: "Saved", tone: "positive", visibleWhen: "mu.res.status == 'saved'" },
        { type: "result", tone: "success", title: "{{mu.res.name}} is disabled", text: "They are signed out now.", visibleWhen: "mu.res.status == 'disabled'" },
        { type: "statusChip", status: "disabled", label: "Disabled", tone: "neutral", visibleWhen: "mu.res.status == 'disabled'" },
        { type: "result", tone: "success", title: "{{mu.res.name}} can sign in again", visibleWhen: "mu.res.status == 'active'" },
        { type: "statusChip", status: "active", label: "Active", tone: "positive", visibleWhen: "mu.res.status == 'active'" },
        reviewRow("Person", "{{mu.res.name}}", "true"),
        reviewRow("Role", "{{mu.res.roleText}}", `${MODE.invite} || ${MODE.disable} || ${MODE.enable}`), reviewRow("Work email", "{{mu.res.emailMasked}}", `${MODE.invite}`),
        reviewRow("Changed", "{{mu.res.changed}}", MODE.edit), reviewRow("Status", "{{mu.res.statusFrom}} → {{mu.res.statusTo}}", `${MODE.disable} || ${MODE.enable}`),
        reviewRow("Reason", "{{mu.res.reasonText}}", `${MODE.disable} && !isEmpty(mu.res.reasonText)`), reviewRow("Company", "{{mu.res.company}}", "true"),
        reviewRow("Approval", "Second administrator", "mu.res.status == 'waiting'"),
        button("Back to people", [{ type: "navigate", toJourney: "admin" }]),
        button("Invite another", [go("start")], "secondary", `${MODE.invite} && mu.res.status != 'waiting'`),
      ],
    },
    {
      // the bank refused the change for a reason about the person (themselves, the last administrator, a change already waiting): said on a screen of its own, with the way back
      id: "blocked", title: "Review",
      blocks: [text("We can’t do this", "title"), alert("error", "{{ctx.error.message}}"), button("Back", [set("ctx.error", null), go("goBack")]), button("Close", [{ type: "exit" }], "ghost")],
    },
    {
      id: "goBack", title: "Manage a user", kind: "branch", onEnter: [go("start")], blocks: [],
      navigation: route([PERSON, "access"]),
    },
    lockedScreen("change", "Nothing was changed."),
    ...failures(),
  ] as Screen[],
};

function failures(): Screen[] {
  const base = failScreens({
    title: "Manage a user", effects: ["invite", "edit", "disable", "enable"], timeoutText: "We didn’t get an answer in time. Check the Admin tab before you try again, so it isn’t done twice.",
    retry: [["otpSend", "review"], ["inviteCheck", "access"], ["editCheck", "access"], ["invite", "review"], ["edit", "review"], ["disable", "review"], ["enable", "review"]],
    routes: [[is(...STEP1), "who"], [is(...STEP2), "access"], [is("REASON_REQUIRED"), "why"], [is(...BLOCKED), "blocked"]],
    unavailable: "Nothing was changed.",
  });
  return base.filter((s) => s.id !== "denied").concat([denyScreen("Manage a user", "manage people")]);
}
